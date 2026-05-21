# Storage Migration

The app has two single-file storage layers to refactor: **localStorage** (one key holding the full notes array) and **Google Drive sync** (one file `quick-pad-notes.json` in `appDataFolder`). Both writes are triggered indiscriminately for every change. Here's the full inventory of changes:

## 1. Local storage —  src/stores/notes.ts

The deep watch at notes.ts:33-39 re-serializes the entire array on every mutation. You need:

- **Per-note key scheme.**  Replace  `STORAGE_KEY = "quick-pad-notes"`  with a prefix like  `quick-pad-note:<uuid>`.
- **`loadFromStorage()`**  (notes.ts:12-23) — iterate  `localStorage`  keys matching the prefix and parse each. Drop the single-JSON-parse path.
- **Replace the deep watch with explicit per-mutation writes.**  Each of  `addNote`,  `updateNote`,  `applyToNote`,  `applyToMany`,  `replaceNote`,  `replaceMultple`,  `replaceAllNotes`  (notes.ts:41-145) must  `setItem`  only the touched note(s). A deep watch can't tell you which IDs changed cheaply.
- **Deletion paths must  `removeItem`.**  Currently  `permanentlyDelete`,  `permanentlyDeleteMultiple`,  `purgeExpiredTrash`  (notes.ts:112-126) just filter the array; they'll leave orphan keys.
- **One-time migration.**  On boot, if the legacy  `quick-pad-notes`  key exists, split it into per-note keys and delete the legacy key.

## 2. Drive primitives —  src/composables/useGoogleDrive.ts

The current `findFile`/`readJSON`/`writeJSON` work per-filename, so they'll mostly carry over with note-specific filenames (e.g., `note-<uuid>.json`). What's missing:

- **`listFiles()`**  — currently  `findFile`  returns only the first match (useGoogleDrive.ts:14-21). You need to list all files in  `appDataFolder`  (with  `pageToken`  pagination if there are many notes), so initial load knows what's on Drive.
- **`deleteFile(id)`**  — there's no delete method today; required when a note is permanently removed.

## 3. Sync logic —  src/composables/useNotesSync.ts

This is where most of the rework concentrates:

- **`readRemoteNotes()`**  (useNotesSync.ts:68-74) — change from reading one JSON to listing all per-note files and fetching each in parallel (`Promise.all`).
- **`saveToCloud()`**  (useNotesSync.ts:76-107) — instead of writing the whole array, write only dirty notes and  `DELETE`  files for the  `purged`  IDs explicitly. The current "merge → overwrite single blob" pattern needs to become "merge → upsert changed files → delete removed files".
- **Dirty tracking.**  To avoid uploading every note on each sync, you need a way to know which notes changed since the last sync. Options: a  `Set<UUID>`  of dirty IDs in the store (populated by mutators, cleared after successful upload), or persist  `lastSyncedAt`  per note and compare against  `modifiedAt`. The existing  `updatedInLocal`/`updatedInRemote`  flags (NoteModel.ts:22-23) are transient and not sufficient.
- **Filename convention.**  Embed the UUID in the filename (`note-<uuid>.json`) so listing yields IDs without reading file contents. Otherwise a sync starts with N round-trips just to learn what's there.
- **Optional index file.**  A tiny  `quick-pad-index.json`  listing  `{id, modifiedAt}`  per note lets sync decide which files to fetch without reading them all. Worth considering once note counts grow.
- **Drive migration.**  First-time post-upgrade, detect the legacy  `quick-pad-notes.json`, fan out into per-note files, then delete the legacy file.

## 4. Touchpoints that should  _just work_  after the store refactor

- src/composables/useFileIO.ts  —  `importFiles`  already calls  `addNote`  per file (useFileIO.ts:56), so per-note writes happen naturally.
- src/components/EditNote.vue  and  src/components/DisplayNoteList.vue  — they only call store mutators; no direct storage I/O. They don't need changes provided the store API stays stable.
- src/models/NoteModel.ts  — only needs changes if you choose to persist dirty/sync metadata per note.

## Design decisions worth pinning down before you start

1. **Dirty tracking**: in-memory Set vs. per-note persisted timestamp. The Set is simpler but loses state on reload (you'd have to mark everything dirty after a crash); the timestamp survives reloads but adds a field to the schema.
2. **Index file or not**: trades one extra write per sync for far fewer reads on load. Worth it past ~50 notes.
3. **Filename scheme**: UUID-in-filename is non-negotiable if you want to skip reading file contents during listing.

The biggest risk area is the sync rewrite — it currently leans heavily on "read everything, merge, write everything" simplicity, and the per-file version has to handle partial failures (some files uploaded, some not) more gracefully.