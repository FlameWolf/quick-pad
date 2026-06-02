# Completed

Done. Option B is fully implemented — `vue-tsc` type-check and `vite build` both pass clean.

## What changed

### Storage — src/storage/db.ts

- `DB_VERSION` → 2, new `note-contents` object store.
- `upgrade()` migrates v1 records: moves inline `content` into `note-contents`, rewrites each `notes` record content-free.
- New accessors: `getNoteContent(id)`, `getNoteRecord(id)` (assembles meta+content), `putNoteMeta` / `putNotesMeta` (meta store only — can't clobber content), `putNoteFull(NoteJSON)` (splits + writes both in one tx). `getAllNotes()` now reads only the meta store; `deleteNote`/`deleteNotes` delete from both.

### Model — src/models/NoteModel.ts

- `content?: string | null`; added `NoteMetaJSON`, `toMetaJSON()`, and `fromSummaryJSON()` (content-free hydration, no recompute). `fromJSON` still carries content for sync.

### Library — src/library.ts

- `DB_VERSION`/`CONTENTS_STORE` constants; `getSummary`/`getSentenceCount`/`getWordCount`/`getCharacterCount`/`contains` now null-safe.

### Store — src/stores/notes.ts

- Lean hydration via `fromSummaryJSON`. Metadata mutations (archive/trash/restore/…) persist meta-only; `addNote`/`updateNote`/`replaceNote` persist full then null `content` in memory.
- Search is now **async**: a `matchedIds` ref populated by `runSearch` (title match short-circuits; otherwise reads content from IDB, tests, discards), with a stale-query token guard. `activeNotes`/`archivedNotes`/`trashedNotes` filter by state + `matchedIds`.

### View/Edit — src/components/EditNote.vue

- Content loads into a local `loadedContent` ref via `watch(props.id, …, { immediate: true })`, decoupled from the shared model so concurrent sync can't disturb editing. View-mode counts use the note's stored counts (no flicker); a spinner shows while content loads.

### Sync — src/composables/useNotesSync.ts

- Push uploads the full stored record via `getNoteRecord(id)` (never the null-content model); pull/conflict path persists-then-nulls through the store.

### Export — src/composables/useFileIO.ts load content on demand

**Undo/redo — src/composables/useUndoRedo.ts** gained `reset()`. **Migration — src/storage/migrate.ts** routes legacy notes through `NoteModel.fromJSON().toJSON()` → `putNoteFull`.

## Worth testing manually before merge

The build can't exercise runtime, so I'd verify these in the app:

1. **The v1→v2 migration** with existing notes (open an old DB) — confirm bodies survive and counts still show.
2. **Archive/trash/restore then reopen** a note — confirm content is intact (the clobber path).
3. **Content search** — search for a word that's only in the body, confirm matches and that clearing search restores the full list.
4. **Sync round-trip** — push/pull and a forced conflict, confirm no `null`/empty bodies land in Drive or locally.

Want me to spin up the dev server and walk through these (via `/verify`), or commit the change?