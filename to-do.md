# To Do

I've got a full picture of how editing works. Here's my advice, tailored to your code.

## The short version

You already have almost everything you need in [EditNote.vue](src/components/EditNote.vue): `editTitle`/`editContent` refs, a `hasUnsavedChanges` computed, a `debounce` util, a `beforeunload` handler, and a `confirm()` dialog. A draft feature is just four touch-points around those, plus a ~30-line storage module.

Crucially: **`localStorage` is genuinely the right tool here, not a compromise.** Your notes live in IndexedDB, but IDB writes are async and are *not guaranteed to flush during `pagehide`/`beforeunload`* — exactly the crash/close moments you care about. `localStorage` is synchronous, so a write inside an unload handler completes. Keep the durable notes in IDB and the volatile draft in `localStorage`.

## 1. Key scheme — drafts per note ID

Follow your existing `NOTE_PREFIX = "qp-note:"` convention. Add to [storage.ts](src/constants/storage.ts):

```ts
export const DRAFT_PREFIX = "qp-draft:";
```

The one wrinkle: in **create mode** (`/notes/new`) there's no ID yet — the UUID is only minted in `saveNote()`. Use a sentinel:

```ts
const draftId = computed(() => (isCreateMode.value ? "new" : props.id));
```

There's only ever one "new" note being composed at a time, so `qp-draft:new` is safe. On save it's cleared before you navigate to `/notes/<realId>`.

## 2. A tiny draft module

This fits your `src/composables/` (or `src/storage/`) folder. Note the try/catch — `localStorage` throws on quota-exceeded and in some private-mode browsers, and a draft failing to save must never break editing:

```ts
// src/composables/useNoteDraft.ts
import { DRAFT_PREFIX } from "@/constants/storage";

export interface NoteDraft {
	title: string;
	content: string;
	savedAt: number;
}

const draftKey = (id: string) => `${DRAFT_PREFIX}${id}`;

export function loadDraft(id: string): NoteDraft | null {
	try {
		const raw = localStorage.getItem(draftKey(id));
		const parsed = raw ? (JSON.parse(raw) as NoteDraft) : null;
		return parsed && typeof parsed.content === "string" ? parsed : null;
	} catch {
		return null;
	}
}

export function saveDraft(id: string, title: string, content: string): void {
	try {
		localStorage.setItem(draftKey(id), JSON.stringify({ title, content, savedAt: Date.now() } satisfies NoteDraft));
	} catch {
		/* quota exceeded / private mode — drafts are best-effort */
	}
}

export function clearDraft(id: string): void {
	try {
		localStorage.removeItem(draftKey(id));
	} catch {
		/* ignore */
	}
}
```

## 3. Wiring into EditNote.vue — four touch-points

**(a) Persist while editing** — debounced, so you write on a pause in typing (this is what survives a *crash*, since a hard crash fires no events):

```ts
const persistDraft = debounce(() => {
	if (!draftId.value) return;
	if (isEditing.value && hasUnsavedChanges.value) {
		saveDraft(draftId.value, editTitle.value, editContent.value);
	} else {
		clearDraft(draftId.value); // edits reverted to match the saved note
	}
}, 500);

watch([editTitle, editContent, isEditing], persistDraft);
```

**(b) Flush the last keystrokes on graceful close.** Your `onBeforeUnload` already runs; piggyback a synchronous flush there (and ideally also on `pagehide`, which is far more reliable than `beforeunload` on mobile):

```ts
function flushDraft() {
	persistDraft.cancel();
	if (draftId.value && isEditing.value && hasUnsavedChanges.value) {
		saveDraft(draftId.value, editTitle.value, editContent.value);
	}
}
// in onMounted: window.addEventListener("pagehide", flushDraft);
// in onBeforeUnmount: remove it + persistDraft.cancel();
```

**(c) Offer to restore on load.** Inside your existing `watch(() => props.id, …)`, *after* `loadedContent` is set, check for a draft that actually diverges from the saved note and reuse your `confirm()` dialog:

```ts
const draft = draftId.value ? loadDraft(draftId.value) : null;
const baselineTitle = existingNote.value?.title ?? emptyString;
if (draft && (draft.title !== baselineTitle || draft.content !== loadedContent.value)) {
	const restore = await confirm({
		title: "Restore unsaved draft?",
		message: `An unsaved draft from ${new Date(draft.savedAt).toLocaleString()} was found for this note.`,
		confirmText: "Restore",
		cancelText: "Discard draft"
	});
	if (restore) {
		editTitle.value = draft.title;
		editContent.value = draft.content;
		isEditing.value = true;
		undoRedo.reset(draft.content);
	} else {
		clearDraft(draftId.value);
	}
}
```

**(d) Clear on definitive outcomes** — successful `saveNote()` (clear *before* the `router.push` in create mode, while `draftId` is still `"new"`), and when the user confirms discard in `cancelEditing()` / `onBeforeRouteLeave`. Don't clear on a plain unmount with unsaved changes — that's the whole point of keeping the draft.

## 4. Decisions worth making explicitly

- **Restore prompt vs. silent restore.** I'd use the `confirm()` dialog (above) — it reuses existing infra and is the least surprising for crash recovery. The even-more-minimal alternative is to silently repopulate the textarea and show a `Toast` ("Recovered unsaved draft"). Your call; the prompt is safer when Drive sync might have changed the note underneath.
- **Divergence check matters.** Only prompt/restore when the draft differs from the now-saved content. Otherwise a user who saved normally last session gets a pointless prompt, and a stale draft (note edited on another device) won't silently clobber the newer version.
- **Dialog dismissal.** Decide what a backdrop/Esc dismiss means — I'd treat "not Restore" as *keep the draft, don't apply* rather than delete, so an accidental dismiss doesn't lose data. (Tweak the `else` branch above to skip `clearDraft` if your `confirm` can distinguish cancel from dismiss.)
- **Orphan cleanup (optional).** Abandoned drafts for notes never reopened linger in `localStorage`. A one-liner on app start can prune them: iterate keys with the `DRAFT_PREFIX`, drop any whose ID isn't `"new"` and isn't in `notesStore.notes`. Not required for correctness — quota is ~5 MB and there's one draft per note.

This stays minimal (one small module + ~4 edits to one component), keeps drafts strictly keyed by note ID, and the debounced-write-plus-unload-flush pairing is what actually covers both hard crashes and ordinary tab closes.

Want me to implement it as a PR on this branch?