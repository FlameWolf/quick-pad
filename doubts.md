# Doubts

1. Shouldn't there be a multi-note version of `putNoteFull` in `src\storage\db.ts`?
2. Where all are `putNoteFull` called (either directly or indirectly)? Is it ever used inside a loop?
3. What is the use of `searchToken` inside the `useNotesStore` and `useNotesStore.runSearch` functions in `src\stores\notes.ts`?

---

## Answers

### 1. Should there be a multi-note `putNoteFull`?

Yes — it's the natural missing sibling, and the codebase's own conventions point to it. You already have batched pairs everywhere else: `putNoteMeta` / `putNotesMeta` and `deleteNote` / `deleteNotes`. The "full" path is the only one without a batch variant, yet it has a genuine bulk caller (`replaceMultiple`).

The concrete problem it solves: today `replaceMultiple` does `Promise.all(updatedNotes.map(replaceNote))`, and each `replaceNote` → `persistFull` → `putNoteFull` opens **its own** readwrite transaction over `[NOTES_STORE, CONTENTS_STORE]`. So syncing N changed notes from the cloud spins up N separate transactions. IndexedDB serializes overlapping-scope readwrite transactions anyway, so you pay per-transaction overhead N times **and lose atomicity** — a failure partway through commits a partial set.

A single-transaction batch fixes both:

```ts
export async function putNotesFull(notes: NoteJSON[]): Promise<void> {
	if (notes.length === 0) {
		return;
	}
	const db = await getDB();
	const tx = db.transaction([NOTES_STORE, CONTENTS_STORE], "readwrite");
	const notesStore = tx.objectStore(NOTES_STORE);
	const contentsStore = tx.objectStore(CONTENTS_STORE);
	const ops: Promise<unknown>[] = [];
	for (const note of notes) {
		const { content, ...meta } = note;
		ops.push(notesStore.put(meta));
		ops.push(contentsStore.put({ id: note.id, content: content ?? emptyString }));
	}
	ops.push(tx.done);
	await Promise.all(ops);
}
```

`replaceMultiple` would then do the in-memory splices itself and persist in one shot:

```ts
async function replaceMultiple(updatedNotes: NoteModel[]) {
	for (const updatedNote of updatedNotes) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		index === -1 ? notes.value.push(updatedNote) : notes.value.splice(index, 1, updatedNote);
	}
	await putNotesFull(updatedNotes.map(note => note.toJSON()));
	updatedNotes.forEach(note => (note.content = undefined));
}
```

It's not _required_ for correctness — the current code works — it's a throughput + atomicity + consistency improvement that mainly benefits sync-pull and the migration loop. Want me to add it?

### 2. Where is `putNoteFull` called, and is it ever in a loop?

**Direct callers (2):**

- `persistFull` in the notes store.
- `persistLegacyNote` in the migration.

**Indirectly via `persistFull`:**

- `addNote` — single note.
- `updateNote` — single note.
- `replaceNote` — single note per call.

**Yes, it runs in loops — three paths:**

1. `replaceMultiple` → `Promise.all(updatedNotes.map(replaceNote))` → one `putNoteFull` **per note, concurrently**. Triggered by sync pull (`runPull` → `store.replaceMultiple(changes)`).
2. `runPush` → `candidates.map(uploadNote)` — a loop where each `uploadNote` calls `store.replaceNote` **on a conflict**, so `putNoteFull` fires once per conflicting note.
3. migrate.ts `runMigration` — two sequential `for…of` loops (legacy array + per-key notes) both calling `persistLegacyNote`.

So the loop callers are exactly the bulk paths that a `putNotesFull` (Q1) would consolidate — particularly path #1.

### 3. What is `searchToken` for?

It's a **stale-response guard** for overlapping async searches — the classic "last query wins" / request-sequence pattern.

`runSearch` is async because it reads each note's body from IndexedDB (`await getNoteContent(note.id)`). When the user types, `searchText` changes and the watcher fires `runSearch` again — possibly before the previous call's IDB reads have resolved. So multiple `runSearch` invocations are in flight at once, and **they can resolve out of order**: a slower earlier query could finish _after_ a newer one and clobber `matchedIds` with results for text the user already moved past.

The counter prevents that:

```ts
const token = ++searchToken; // claim a unique, monotonic id; bump the shared counter
// ... await all the per-note content reads ...
if (token === searchToken) {
	// "am I still the latest invocation?"
	matchedIds.value = ids; // only the newest search is allowed to publish
}
```

Every invocation increments the shared `searchToken` and captures its own value. Only the most recent call satisfies `token === searchToken`; any older invocation sees that a newer one has since bumped the counter (`token !== searchToken`) and **silently discards its results** instead of writing them. The empty-query branch also bumps the token and sets `matchedIds = null` synchronously, so clearing the box immediately invalidates any in-flight search.

Net effect: `matchedIds` always reflects the latest `searchText`, regardless of which IDB reads finish first. (One module-level `let` per store; Pinia makes the store a singleton, so there's a single counter — correct here.)

---

Is there not a more elegant solution for `runSearch` stale-response guarding — other than an ever-increasing number? Maybe an `IsSearching` toggle? Or something else?

---

Good instinct — and you're right that the counter feels like bookkeeping. Let me evaluate the candidates honestly.

## Why an `isSearching` toggle can't work

A boolean has no _identity_, so it can't answer the only question that matters: "am I still the latest search?"

Walk through two overlapping calls:

1. Search **A** ("fo") starts → `isSearching = true`.
2. Search **B** ("foo") starts → `isSearching = true` (already true).
3. **A** finishes first → writes its stale results, sets `isSearching = false`.
4. **B** finishes → sees `false`, writes correct results.

A's stale write in step 3 isn't prevented — the flag can't distinguish A from B. The alternative, _rejecting_ new searches while one runs (`if (isSearching) return`), is worse: it ignores the user's most recent keystroke. So `isSearching` is useful for a spinner, but it fundamentally can't guard ordering. You need something that identifies _which_ query is current — that's exactly why the token exists.

## The more elegant version: the query string **is** the token

You don't need a synthetic counter — the live `searchText` already _is_ the source of truth for "what's current." Capture the query you computed for, and before publishing, check it still matches what the user is looking at:

```ts
const searchText = ref<string>(emptyString);
const matchedIds = ref<Set<UUID> | null>(null);

const runSearch = async (text: string) => {
	const query = text.trim();
	if (!query) {
		matchedIds.value = null;
		return;
	}
	const snapshot = notes.value.slice();
	const ids = new Set<UUID>();
	await Promise.all(
		snapshot.map(async note => {
			if (contains(note.title, query)) {
				ids.add(note.id);
				return;
			}
			if (contains(await getNoteContent(note.id), query)) {
				ids.add(note.id);
			}
		})
	);
	if (query === searchText.value.trim()) {
		matchedIds.value = ids;
	}
};

watch(searchText, runSearch);
```

`let searchToken` goes away entirely. The guard reads as what it actually means — "only publish if these results still describe the current query" — instead of "is my sequence number the highest."

Why it's safe where a boolean isn't: results are deterministic for a given query, so even the rare case of two in-flight searches for the _same_ text just produces identical sets — harmless. And because the computeds re-filter `matchedIds` against the live `notes.value`, a momentarily stale ID can't surface a deleted/wrong note anyway. It's strictly at least as correct as the counter, with less state.

## The "textbook" alternative: `AbortController`

If you prefer a standard cancellation primitive, keep a `let currentSearch: AbortController | null`, abort the previous on each call, and bail when `signal.aborted` after the awaits. It's the most idiomatic _cancellation_ API — but since `getNoteContent` (an IDB `get`) takes no signal, you can't actually abort the reads; you'd still check `aborted` after they resolve. That makes it functionally the token pattern with a heavier, allocation-per-keystroke wrapper. I'd only reach for it if the per-note reads themselves became cancellable (e.g. `fetch`-backed).

**Recommendation:** the query-equality check — it removes the counter, leans on state you already have, and self-documents. Want me to apply it to notes.ts?