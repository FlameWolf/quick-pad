# Changes

## The core trap: persistence clobbering

Right now every mutation persists through `persistNote` / `persistNotes`, which call `note.toJSON()` — and `toJSON()` always writes `content`. So the moment a note's in‑memory `content` is `null`, any metadata-only operation (archive, trash, restore, sort-touch) would write `content: null` back to IndexedDB and **erase the stored note body**. `putNote` does a full-record `db.put`, so there's no protection.

This is the central thing the design has to solve: _metadata writes must never touch stored content._ There are two clean ways to guarantee that.

### Decision: where does content live in IndexedDB?

**Option B (recommended) — split content into its own object store.**

- `notes` store keeps metadata + `summary` + counts (no `content`).
- New `note-contents` store keyed by `id` holds just the body.
- Metadata writes only touch `notes`, so content _cannot_ be clobbered. `getAllNotes()` naturally returns zero content, so content is never in the big array even transiently. Costs you a `DB_VERSION` bump (1→2) and a one-time migration.

**Option A (lighter) — keep one record, but make writes content-preserving.**

- No migration. But every metadata mutation becomes a read‑modify‑write that re-reads the stored record and merges content back in, and `getAllNotes()` still pulls full content off disk on startup (you strip it after, so steady-state heap is clean, but it's loaded transiently). More per-op I/O and more places to get wrong.

I'd go with **B** — it's a bit more setup but removes the clobber risk entirely and is the only one that literally keeps content out of memory at all times. The cloud format is unchanged either way (still one JSON-with-content per note), so **no remote/Drive migration is needed**.

The file-by-file list below assumes Option B, with Option A deltas noted.

---

## 1. Storage layer — src/storage/db.ts

- Bump `DB_VERSION` to `2` and in `upgrade()` create a `note-contents` store (`{ keyPath: "id" }` or a plain keyed store).
- Change `getAllNotes()` to read **only** the `notes` (meta) store.
- Add content accessors:
  - `getNoteContent(id): Promise<string>` — read from `note-contents`.
  - `putNoteFull(meta, content)` — single transaction over **both** stores (editor save, import, pull).
  - `putNoteMeta(meta)` / `putNotesMeta(metas)` — meta store only (archive/trash/restore/etc.).
  - `deleteNote`/`deleteNotes` must delete from **both** stores.
- `getNoteRecord(id)` returning the assembled `{...meta, content}` is handy for sync push.

_Option A instead:_ keep one store; add `getNoteContent(id)` (reads record, returns `.content`), `putNoteFull` (full put), and `putNoteMeta` as read‑modify‑write that preserves the existing `content`.

## 2. Migration — src/storage/migrate.ts (+ library.ts `DB_VERSION`)

- For Option B you need an IDB v1→v2 upgrade that, per existing note, moves `content` into `note-contents` and rewrites the `notes` record without it. The cleanest spot is the `idb` `upgrade(db, oldVersion, ...)` callback in `db.ts` (it can iterate the existing `notes` store). The existing localStorage migration in `runMigration()` also calls `putNote(note)` with full records (migrate.ts:46, 67) — switch those to `putNoteFull`.

## 3. Model — src/models/NoteModel.ts

- Make `content` optional: `content?: string | null`, and in `NoteJSON` too.
- Add a content-less hydration factory, e.g. `fromSummaryJSON(meta)` that sets timestamps + `summary` + counts and leaves `content` undefined **without** calling `computeDerived` (the constructor currently always runs `computeDerived`, which would blow up or zero the counts on absent content).
- Guard `computeDerived()` (and/or the `getSummary`/`getXCount` helpers) against `null`/`undefined`.
- Split serialization: a `toMetaJSON()` (no content) for the meta store, keep full `toJSON()` for sync uploads where content is present.

## 4. Library helpers — src/library.ts

- `getSummary` (library.ts:39), `getSentenceCount`, `getWordCount`, `getCharacterCount` all do `text.length` / segment `text` and will throw on `null`/`undefined`. Add null guards (return `""`/`0`).

## 5. Store — src/stores/notes.ts

This is the biggest change.

- **Hydration** (notes.ts:11-20): map via `fromSummaryJSON` so `notes.value` never holds content.
- **persist paths**: `persistNote`/`persistNotes` → `putNoteMeta`/`putNotesMeta` (meta only). `addNote` and `updateNote` are the content-changing paths → use `putNoteFull(meta, content)`, then drop content from the in-memory model.
- **`addNote`** (notes.ts:45-48): persist full, then set `note.content = undefined` before/after pushing into the array.
- **`updateNote`** (notes.ts:50-58): this is editor-save; write full record, recompute derived from the new content, then null the model's content.
- **`replaceNote`/`replaceMultiple`** (notes.ts:159-174): these get _remote_ models that have content (from sync). Persist full, refresh the model's meta/summary/counts, then null `content` before it lands in `notes.value`.
- **Search rework (the other big one)** — `searchResults` is a synchronous computed doing `contains(note.content, …)`. With content out of memory this can't stay synchronous. Replace with:
  - A `matchedIds = ref<Set<UUID> | null>(null)` (null = not searching).
  - An async `runSearch(text)` that matches titles in memory, and for content reads each note's body via `getNoteContent(id)`, tests `contains`, and discards it — then sets `matchedIds`. Add a watcher on `searchText` to drive it (App.vue already debounces _setting_ `searchText` at App.vue:32-34, so you don't need a second debounce, but you do need a stale-result guard so the latest query wins).
  - Rewrite `activeNotes`/`archivedNotes`/`trashedNotes` (notes.ts:41-43) to filter by state **and** `matchedIds`.
  - Optimization: skip the content read for notes whose title already matched.

## 6. View/Edit — src/components/EditNote.vue

- On mount (non-create mode): `await getNoteContent(props.id)` into a **local** ref (e.g. `originalContent`), and seed `editContent`. Keep it local rather than writing onto the shared model — that decouples the editor from any concurrent sync that loads/clears content.
- Repoint everything that reads `existingNote.content` to the local ref:
  - `editContent` init (EditNote.vue:33), `displayContent` (line 36), `hasUnsavedChanges` comparison (line 61), `copyToClipboard` (line 102), `startEditing`/`cancelEditing` resets (lines 119, 148), and the template body `{{ existingNote.content }}` (line 327).
  - `exportNote(existingNote)` (lines 282, 296) needs content — pass the loaded ref, or have `useFileIO` load it (see #7).
- Handle the async load with a small loading state (the note view currently renders synchronously off `existingNote`).
- On unmount, just let the local ref go (GC); nothing to write back since saves go through `updateNote`.

## 7. File I/O — src/composables/useFileIO.ts

- `exportNote` (line 76) and `exportNotes` (line 94) read `note.content`, which is now empty. Make them `async` and `await getNoteContent(id)` per note. `exportNotes`/`exportAllNotes` are already awaited at their call sites (DisplayNoteList.vue:126,149-style usage), `exportNote` is called unawaited in templates — fine once it's async.
- `importFiles` (line 52-56) creates `new NoteModel(title, content)` then `addNote` — works, just make sure `addNote`'s new "persist full + null content" path covers it.

## 8. Sync — src/composables/useNotesSync.ts

- **Push** — `uploadNote` (lines 110-132) and `runPush` build the upload payload from `note.toJSON()` (lines 120, 129), which would now upload `content: null` and **corrupt the cloud copy**. Change so the payload is the full stored record: `await getNoteRecord(note.id)` (meta+content) and upload that. The candidate filtering and `noteEffectiveTime` comparisons use only timestamps (lines 41-43, 117-119, 152) — those are unaffected and need no content.
- **Pull** — `readRemoteNotes`/`runPull` build remote `NoteModel`s with content (lines 89-90, 116) and hand them to `replaceMultiple`/`replaceNote`. Once #5 makes those persist-full-then-null-content, pull is correct and content never lingers in `notes.value`.
- `mergeNotesByModifiedAt` (lines 45-55): no change (timestamps only).
- This satisfies your "read content as needed during sync, reset after" requirement — with the record-based push, content is read straight from IDB into the upload and never parked on the model at all.

## 9. No change needed (verified)

- DisplayNoteList.vue renders `note.summary` + counts (lines 284, 287-289) — already summary-only. ✅
- useNoteSort.ts sorts on stored counts, not content (lines 40-46). ✅
- `NoteModel.purge()` (NoteModel.ts:79-86) sets `content=""` but has no caller — leave it; just note that with split-store, permanent deletes already drop the content store row.

---

## Gotchas to keep in mind

1. **Clobbering** is the #1 risk — re-confirm _every_ persist path is either meta-only or full-with-content. A single stray `toJSON()`-based write erases bodies.
2. **Search goes async** — this ripples into the `activeNotes`/`archived`/`trashed` computeds and needs a stale-query guard. It's the largest behavioral change and the part most worth testing (especially "clear search" resetting `matchedIds` to `null`).
3. **Editor ↔ sync cross-talk** — keeping the editor's content in a _local_ ref (not on the shared model) avoids a concurrent auto-sync load/clear making `hasUnsavedChanges` think everything changed.
4. **Async loading states** — single-note view and export now have an `await` before content is available; add minimal spinners/guards so you don't flash empty bodies.
5. **Counts stay accurate without content** because `summary`/counts are persisted in the meta record and recomputed only on save/import (when content is present).

---

Net: ~9 files. The two non-trivial pieces are the **storage split + migration** and the **async search rewrite**; the rest is mechanical (route reads through `getNoteContent`, make exports async, fix the sync payload).

Want me to go ahead and implement this (Option B), or would you prefer the lighter Option A single-store version? I can also start with just the storage + model + store foundation so you can review before I touch sync/search/editor.