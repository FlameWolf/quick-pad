# Changes

## How sync works today

- useNotesSync.ts:134  `saveToCloud()`  — uploads only  **dirty**  notes (`noteEffectiveTime(note) > lastSyncedToCloudAt`), purges remote tombstones, resolves conflicts in  `uploadNote`, then sets  `lastSyncedToCloudAt`  and a "Notes saved to Drive" toast.
- useNotesSync.ts:169  `loadFromCloud()`  — reads only remote files  **changed since**  `lastSyncedToLocalAt`  (the date is passed to  `listFiles`), merges via  `mergeNotesByModifiedAt`, purges expired trash, sets  `lastSyncedToLocalAt`  and a "Notes loaded from Drive" toast.
- Both are individually guarded by  `isSyncing`  and each emit their own toast.
- App.vue:171-178  are the two dropdown buttons →  `handleSave`/`handleLoad`.
- App.vue:99-102  — on sign-in the app already does  `loadFromCloud()`  then  `saveToCloud()`. That load-then-push order  **is**  a full sync, so the combined button just reuses it.

The two date gates you'd bypass for force sync are exactly:

- **Pull**:  useNotesSync.ts:84  `listFiles(store.fileNamePrefix, lastSyncedToLocalAt.value)`  → pass  `null`  instead.  `listFiles`  already no-ops the filter when the date is falsy (useGoogleDrive.ts:42), so  **no Drive-layer change is needed**.
- **Push**:  useNotesSync.ts:143  the  `dirtyNotes`  filter → upload all  `store.notes`  instead.

The conflict-merge logic (`mergeNotesByModifiedAt` + `uploadNote`) stays exactly as-is for both modes — force sync just feeds it more candidates.

## The one gotcha

You can't just make the new button call `loadFromCloud()` then `saveToCloud()` (like the watcher does). That would (a) flicker `isSyncing` false→true between phases and (b) fire **two** toasts, the second clobbering the first. So the real work is refactoring those two functions into guard-free/toast-free cores wrapped by a single orchestrator.

## Change 1 —  `useNotesSync.ts`  (the bulk of the work)

Split each operation into a **core** (no `isSyncing`, no toast, returns counts) and add a single `sync()` orchestrator that takes a `force` flag:

```ts
// thread force through the pull
async function readRemoteNotes(force = false): Promise<NoteModel[]> {
    const files = await listFiles(store.fileNamePrefix, force ? null : lastSyncedToLocalAt.value);
    // ...unchanged...
}

// core pull — no guard, no toast; returns what happened
async function runPull(force = false) {
    const syncStartedAt = new Date();
    const remoteNotes = await readRemoteNotes(force);
    const changes = mergeNotesByModifiedAt(store.notes, remoteNotes);
    if (changes.length > 0) await store.replaceMultiple(changes);
    await purgeRemoteFiles(await store.purgeExpiredTrash());
    lastSyncedToLocalAt.value = syncStartedAt;
    return { remoteCount: remoteNotes.length, downloaded: changes.length };
}

// core push — no guard, no toast; returns what happened
async function runPush(purged: ReadonlyArray<UUID> = [], force = false) {
    const syncStartedAt = new Date();
    await purgeRemoteFiles(purged);
    const candidates = force ? store.notes : store.notes.filter(n => noteEffectiveTime(n) > (lastSyncedToCloudAt.value?.getTime() ?? 0));
    const results = await Promise.all(candidates.map(uploadNote));
    if (lastSyncedToLocalAt.value) await deleteFromLegacy();
    lastSyncedToCloudAt.value = syncStartedAt;
    return { conflicts: results.filter(r => r === "conflict").length };
}

// new single orchestrator — one guard, one toast
async function sync({ force = false, purged = [] as ReadonlyArray<UUID> } = {}) {
    if (isSyncing.value) return;
    isSyncing.value = true;
    syncError.value = null;
    try {
        const pull = await runPull(force);          // pull first
        const push = await runPush(purged, force);  // then push (incl. merge results)
        const conflicts = pull.downloaded ... ; // combine as you like
        const empty = pull.remoteCount === 0 && store.notes.length === 0;
        lastSyncMessage.value = {
            text: empty ? "No notes found on Drive"
                : `Notes synced with Drive${push.conflicts > 0 ? ` with ${push.conflicts} conflict${push.conflicts > 1 ? "s" : emptyString} resolved` : emptyString}`,
            type: "success",
            timeStamp: Date.now()
        };
    } catch (e: any) {
        syncError.value = e?.message ?? "Sync failed";
        lastSyncMessage.value = { text: `Sync failed: ${syncError.value}`, type: "error", timeStamp: Date.now() };
    } finally {
        isSyncing.value = false;
    }
}

```

Then:

- Keep a thin  `saveToCloud()`  = guard +  `runPush`  + push-only toast, because  **auto-sync still needs push-only**  —  `debouncedFlush`  (useNotesSync.ts:209) fires on every edit and must not pull mid-typing. Just rewrite its body to use  `runPush`  under the guard.
- `loadFromCloud()`  can be deleted (nothing else uses it after the UI change) — grep confirms only  `App.vue`  consumes  `saveToCloud`/`loadFromCloud`;  `DisplayNoteList`/`EditNote`  only use  `requestSync`.
- Update the returned object: add  `sync`, drop  `loadFromCloud`  (and optionally  `saveToCloud`  if you fold it away).
- The Toast component needs  **no change**  — it's generic.

## Change 2 —  `App.vue`

- Swap the destructure on  line 18: drop  `saveToCloud, loadFromCloud`, add  `sync`.
- Replace  `handleSave`/`handleLoad`  (lines 48-56) with  `handleSync`  (`sync()`) and  `handleForceSync`  (`sync({ force: true })`), each calling  `closeSyncMenu()`  first.
- Replace the two dropdown buttons (lines 171-178) with a  `Sync`  item + a  `Force sync`  item.
- Simplify the sign-in watcher (lines 99-102) to a single  `await sync()`.

## Change 3 — none needed in  `useGoogleDrive.ts`,  `library.ts`, or  `Toast.vue`

The Drive layer already supports the null-date case, and no new constants are required.

## My recommendation on checkbox vs. button

**Use a separate "Force sync" menu item, not a checkbox.** Reasons:

1. **Force sync is a rare recovery action**  (e.g. local DB was reset, suspected drift). Normal incremental sync is the 99% path.
2. **A persistent checkbox is a footgun**  — if left checked,  _every_  sync re-lists and re-uploads all notes, multiplying Drive API calls and slowing each sync.
3. **A transient checkbox fits the dropdown poorly**  — the menu closes on each action, so "check then click" is two awkward steps with ambiguous state. Two distinct menu items (`Sync`  /  `Force sync`) is one unambiguous click each, and mirrors how the existing items already work.

So the dropdown becomes: Auto-sync toggle → **Sync** (`bi-arrow-repeat`) → **Force sync** (`bi-arrow-clockwise`) → Last synced → Sign out.

----------

Net: it's essentially **one real file of logic** (`useNotesSync.ts` refactor into core pull/push + `sync({force})`) plus **wiring in `App.vue`**. The merge/conflict code and the Drive client are untouched.