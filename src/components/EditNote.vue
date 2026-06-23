<script setup lang="ts">
	import { ref, computed, onBeforeUnmount, onMounted, watch, useTemplateRef } from "vue";
	import { useRouter, useRoute, onBeforeRouteLeave } from "vue-router";
	import { listViewRoutes } from "@/router";
	import { useNotesStore } from "@/stores/notes";
	import { useAppStore } from "@/stores/app";
	import { useUndoRedo } from "@/composables/useUndoRedo";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { useNoteDraft } from "@/composables/useNoteDraft";
	import { NoteModel } from "@/models/NoteModel";
	import { useFileIO } from "@/composables/useFileIO";
	import { emptyString } from "@/constants/common";
	import { getSentenceCount, getWordCount, getCharacterCount } from "@/utils/text-analysis";
	import { debounce } from "@/utils/timing";
	import Icon from "@/components/Icon.vue";
	import Toast from "@/components/Toast.vue";
	import type { UUID } from "crypto";

	const props = defineProps<{
		id?: UUID;
		backRoute?: string;
	}>();
	const router = useRouter();
	const route = useRoute();
	const notesStore = useNotesStore();
	const appStore = useAppStore();
	const { exportNote } = useFileIO();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const { saveDraft, loadDraft, clearDraft } = useNoteDraft();
	const isCreateMode = computed(() => route.path === "/notes/new");
	const existingNote = computed(() => (props.id && !isCreateMode.value ? notesStore.getNote(props.id) : undefined));
	const isCopying = ref(false);
	const copyResult = ref<{
		status: "success" | "error";
		message: string;
	}>({
		status: "success",
		message: emptyString
	});
	const isEditing = ref(isCreateMode.value);
	const editTitle = ref(existingNote.value?.title ?? emptyString);
	const editContent = ref(emptyString);
	const loadedContent = ref(emptyString);
	const isContentLoaded = ref(isCreateMode.value);
	const editTextArea = useTemplateRef("edit-text-area");
	const undoRedo = useUndoRedo(editContent.value);
	const sentenceCount = computed(() => (isEditing.value ? getSentenceCount(editContent.value) : (existingNote.value?.sentenceCount ?? 0)));
	const wordCount = computed(() => (isEditing.value ? getWordCount(editContent.value) : (existingNote.value?.wordCount ?? 0)));
	const characterCount = computed(() => (isEditing.value ? getCharacterCount(editContent.value) : (existingNote.value?.characterCount ?? 0)));
	const hasContent = computed(() => !!sentenceCount.value || !!wordCount.value || !!characterCount.value);
	const isFaved = computed(() => !!existingNote.value?.favedAt && !existingNote.value?.deletedAt);
	const isPinned = computed(() => !!existingNote.value?.pinnedAt && !existingNote.value?.deletedAt);
	const isArchived = computed(() => !!existingNote.value?.archivedAt && !existingNote.value?.deletedAt);
	const isTrashed = computed(() => !!existingNote.value?.deletedAt);
	const backRoute = computed(() => props.backRoute ?? "/notes");
	const hasUnsavedChanges = computed(() => {
		if (!isEditing.value) {
			return false;
		}
		if (isCreateMode.value) {
			return editTitle.value.trim().length > 0 || editContent.value.length > 0;
		}
		if (!existingNote.value) {
			return false;
		}
		return editTitle.value !== existingNote.value.title || editContent.value !== loadedContent.value;
	});
	const draftId = computed(() => (isCreateMode.value ? "new" : props.id!));
	const debouncedPushUndo = debounce((value: string) => undoRedo.push(value), 300);
	const persistDraft = debounce(() => {
		if (hasUnsavedChanges.value) {
			saveDraft(draftId.value, editTitle.value, editContent.value);
		} else {
			clearDraft(draftId.value);
		}
	}, 500);

	function adjustTextAreaHeight() {
		if (CSS.supports("field-sizing", "content")) {
			return;
		}
		if (isEditing.value) {
			const editor = editTextArea.value;
			const editorParent = editor?.parentElement;
			if (!editorParent) {
				return;
			}
			const editorClone = editor.cloneNode() as HTMLTextAreaElement;
			editorClone.classList.add("d-hidden");
			editorClone.style.setProperty("height", "auto");
			editorClone.value = editContent.value;
			editorParent.appendChild(editorClone);
			editor.style.setProperty("height", `calc(${editorClone.scrollHeight}px + 0.5rem)`);
			editorParent.removeChild(editorClone);
		}
	}

	function setFontScaling(operator: "+" | "-") {
		const multiplier = operator === "+" ? 1 : -1;
		appStore.setFontScaleFactor(appStore.fontScaleFactor + 1 * multiplier);
	}

	function onContentInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		editContent.value = value;
		debouncedPushUndo(value);
	}

	function doUndo() {
		undoRedo.undo();
		editContent.value = undoRedo.current.value;
	}

	function doRedo() {
		undoRedo.redo();
		editContent.value = undoRedo.current.value;
	}

	function copyToClipboard() {
		isCopying.value = true;
		navigator.clipboard
			.writeText(loadedContent.value)
			.then(() => {
				copyResult.value = {
					status: "success",
					message: "Copied to clipboard"
				};
			})
			.catch(err => {
				copyResult.value = {
					status: "error",
					message: `Failed to copy: ${(err as Error).message}`
				};
			});
	}

	function startEditing() {
		editTitle.value = existingNote.value?.title ?? emptyString;
		editContent.value = loadedContent.value;
		undoRedo.push(editContent.value);
		isEditing.value = true;
		setTimeout(adjustTextAreaHeight);
	}

	async function confirmDiscardChanges(): Promise<boolean> {
		return confirm({
			title: "Discard unsaved changes?",
			message: "You have unsaved changes that will be lost if you leave this note.",
			confirmText: "Discard",
			cancelText: "Keep editing",
			variant: "danger"
		});
	}

	async function cancelEditing() {
		if (hasUnsavedChanges.value) {
			const ok = await confirmDiscardChanges();
			if (!ok) {
				return;
			}
			clearDraft(draftId.value);
		}
		if (isCreateMode.value) {
			isEditing.value = false;
			router.push(backRoute.value);
		} else {
			isEditing.value = false;
			editTitle.value = existingNote.value?.title ?? emptyString;
			editContent.value = loadedContent.value;
		}
	}

	async function saveNote() {
		const title = editTitle.value.trim() || "Untitled";
		const content = editContent.value;
		clearDraft(draftId.value);
		if (isCreateMode.value) {
			const note = new NoteModel(title, content);
			await notesStore.addNote(note);
			router.push(`/notes/${note.id}`);
		} else if (existingNote.value) {
			await notesStore.updateNote({ id: existingNote.value.id, title, content });
			loadedContent.value = content;
		}
		isEditing.value = false;
		requestSync();
	}

	async function deleteNote() {
		if (!existingNote.value) {
			return;
		}
		const ok = await confirm({
			title: "Move note to Trash?",
			message: "This note will be moved to Trash. You can restore it within 30 days.",
			confirmText: "Move to Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		await notesStore.trashNote(existingNote.value.id);
		requestSync();
		router.push(backRoute.value);
	}

	async function faveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.faveNote(existingNote.value.id);
		requestSync();
	}

	async function unfaveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unfaveNote(existingNote.value.id);
		requestSync();
	}

	async function pinNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.pinNote(existingNote.value.id);
		requestSync();
	}

	async function unpinNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unpinNote(existingNote.value.id);
		requestSync();
	}

	async function archiveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.archiveNote(existingNote.value.id);
		requestSync();
		if (appStore.lastView !== "favourited") {
			router.push(backRoute.value);
		}
	}

	async function unarchiveNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.unarchiveNote(existingNote.value.id);
		requestSync();
		if (appStore.lastView !== "favourited") {
			router.push(backRoute.value);
		}
	}

	async function restoreNote() {
		if (!existingNote.value) {
			return;
		}
		await notesStore.restoreFromTrash(existingNote.value.id);
		requestSync();
		router.push(backRoute.value);
	}

	async function permanentlyDeleteNote() {
		if (!existingNote.value) {
			return;
		}
		const ok = await confirm({
			title: "Permanently delete note?",
			message: "This note will be permanently deleted. This action cannot be undone.",
			confirmText: "Delete Permanently",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const existingNoteId = existingNote.value.id;
		await notesStore.permanentlyDelete(existingNoteId);
		requestSync([existingNoteId]);
		router.push(backRoute.value);
	}

	async function restoreDraft() {
		const draft = loadDraft(draftId.value);
		const baselineTitle = existingNote.value?.title ?? emptyString;
		if (draft && (draft.title !== baselineTitle || draft.content !== loadedContent.value)) {
			const ok = await confirm({
				title: "Restore unsaved draft?",
				message: `An unsaved draft from ${new Date(draft.savedAt).toLocaleString()} was found for this note.`,
				confirmText: "Restore",
				cancelText: "Discard draft"
			});
			if (ok) {
				isEditing.value = true;
				editTitle.value = draft.title;
				editContent.value = draft.content;
				undoRedo.push(editContent.value);
			} else {
				clearDraft(draftId.value);
			}
		}
	}

	function flushDraft() {
		persistDraft.cancel();
		if (hasUnsavedChanges.value) {
			saveDraft(draftId.value, editTitle.value, editContent.value);
		}
	}

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	function onBeforeUnload(e: BeforeUnloadEvent) {
		if (hasUnsavedChanges.value) {
			e.preventDefault();
		}
	}

	onMounted(() => {
		if (!listViewRoutes.includes(backRoute.value)) {
			appStore.setLastView(null);
		}
		window.addEventListener("beforeunload", onBeforeUnload);
		window.addEventListener("resize", adjustTextAreaHeight);
		window.addEventListener("pagehide", flushDraft);
	});

	onBeforeUnmount(() => {
		persistDraft.cancel();
		debouncedPushUndo.cancel();
		window.removeEventListener("pagehide", flushDraft);
		window.removeEventListener("resize", adjustTextAreaHeight);
		window.removeEventListener("beforeunload", onBeforeUnload);
	});

	onBeforeRouteLeave(async () => {
		if (!hasUnsavedChanges.value) {
			return true;
		}
		const ok = await confirmDiscardChanges();
		if (ok) {
			clearDraft(draftId.value);
		}
		return ok;
	});

	watch(
		() => props.id,
		async id => {
			isContentLoaded.value = isCreateMode.value;
			loadedContent.value = emptyString;
			editContent.value = emptyString;
			isEditing.value = isCreateMode.value;
			if (id && !isCreateMode.value) {
				loadedContent.value = (await notesStore.getNoteContent(id)) ?? emptyString;
			} else {
				loadedContent.value = emptyString;
			}
			isContentLoaded.value = true;
			undoRedo.reset(loadedContent.value);
			await restoreDraft();
		},
		{ immediate: true }
	);

	watch([editTitle, editContent], () => {
		adjustTextAreaHeight();
		persistDraft();
	});

	watch(
		() => appStore.fontScaleFactor,
		factor => {
			const rootElement = document.documentElement;
			if (factor === 0) {
				rootElement.style.removeProperty("--font-scale-factor");
				return;
			}
			rootElement.style.setProperty("--font-scale-factor", factor.toString());
		},
		{ immediate: true }
	);
</script>

<template>
	<div class="edit-note">
		<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
			<RouterLink :to="backRoute" class="btn btn-secondary btn-sm" aria-label="Back to notes">
				<Icon type="chevronLeft"/>
				<span class="ms-2">Back</span>
			</RouterLink>
			<div class="d-flex flex-wrap gap-2 ms-auto">
				<button class="btn btn-outline-secondary btn-sm" @click="setFontScaling(`+`)" title="Increase font size" aria-label="Increase font size">
					<Icon type="aPlus"/>
				</button>
				<button class="btn btn-outline-secondary btn-sm" @click="setFontScaling(`-`)" title="Decrease font size" aria-label="Decrease font size">
					<Icon type="aMinus"/>
				</button>
			</div>
			<div class="d-flex flex-wrap gap-2" v-if="!isCreateMode && !isEditing && isTrashed">
				<button class="btn btn-outline-primary btn-sm" @click="restoreNote" title="Restore" aria-label="Restore">
					<Icon type="reply"/>
					<span class="d-none d-sm-inline ms-2">Restore</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="existingNote" @click="exportNote(existingNote)" title="Export" aria-label="Export">
					<Icon type="download"/>
					<span class="d-none d-sm-inline ms-2">Export</span>
				</button>
				<button class="btn btn-outline-danger btn-sm" @click="permanentlyDeleteNote" title="Delete Permanently" aria-label="Delete Permanently">
					<Icon type="trashFill"/>
					<span class="d-none d-sm-inline ms-2">Delete Permanently</span>
				</button>
			</div>
			<div class="d-flex flex-wrap gap-2" v-else-if="!isCreateMode && !isEditing">
				<button class="btn btn-outline-primary btn-sm" @click="startEditing" title="Edit" aria-label="Edit">
					<Icon type="pen"/>
					<span class="d-none d-sm-inline ms-2">Edit</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" @click="copyToClipboard" title="Copy to clipboard" aria-label="Copy to clipboard">
					<Icon type="copy"/>
					<span class="d-none d-sm-inline ms-2">Copy</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="!isFaved" @click="faveNote" title="Favourite" aria-label="Favourite">
					<Icon type="star"/>
					<span class="d-none d-sm-inline ms-2">Favourite</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" v-else @click="unfaveNote" title="Unfavourite" aria-label="Unfavourite">
					<Icon type="starFill"/>
					<span class="d-none d-sm-inline ms-2">Unfavourite</span>
				</button>
				<template v-if="!isArchived">
					<button class="btn btn-outline-secondary btn-sm" v-if="!isPinned" @click="pinNote" title="Pin" aria-label="Pin">
						<Icon type="pinAngle"/>
						<span class="d-none d-sm-inline ms-2">Pin</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" v-else @click="unpinNote" title="Unpin" aria-label="Unpin">
						<Icon type="pinAngleFill"/>
						<span class="d-none d-sm-inline ms-2">Unpin</span>
					</button>
				</template>
				<button class="btn btn-outline-secondary btn-sm" v-if="existingNote" @click="exportNote(existingNote)" title="Download" aria-label="Download">
					<Icon type="download"/>
					<span class="d-none d-sm-inline ms-2">Download</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="isArchived" @click="unarchiveNote" title="Unarchive" aria-label="Unarchive">
					<Icon type="boxArrowUp"/>
					<span class="d-none d-sm-inline ms-2">Unarchive</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" v-else @click="archiveNote" title="Archive" aria-label="Archive">
					<Icon type="archive"/>
					<span class="d-none d-sm-inline ms-2">Archive</span>
				</button>
				<button class="btn btn-outline-danger btn-sm" @click="deleteNote" title="Delete" aria-label="Delete">
					<Icon type="trash"/>
					<span class="d-none d-sm-inline ms-2">Delete</span>
				</button>
			</div>
			<div class="d-flex flex-wrap gap-2" v-if="isEditing">
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canUndo.value" @click="doUndo" title="Undo" aria-label="Undo">
					<Icon type="arrowCounterclockwise"/>
					<span class="d-none d-sm-inline ms-2">Undo</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canRedo.value" @click="doRedo" title="Redo" aria-label="Redo">
					<Icon type="arrowClockwise"/>
					<span class="d-none d-sm-inline ms-2">Redo</span>
				</button>
				<button class="btn btn-primary btn-sm" :disabled="!hasUnsavedChanges" @click="saveNote" title="Save" aria-label="Save">
					<Icon type="floppy"/>
					<span class="d-none d-sm-inline ms-2">Save</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" @click="cancelEditing" title="Cancel" aria-label="Cancel">
					<Icon type="xLg"/>
					<span class="d-none d-sm-inline ms-2">Cancel</span>
				</button>
			</div>
		</div>
		<template v-if="!isEditing && existingNote">
			<h2 class="mb-3">{{ existingNote.title }}</h2>
			<div class="text-muted small mb-3" v-if="existingNote.modifiedAt || existingNote.createdAt">{{ existingNote.modifiedAt ? `Modified ${formatDate(existingNote.modifiedAt)}` : `Created ${formatDate(existingNote.createdAt)}` }}</div>
			<div v-if="!isContentLoaded" class="d-flex justify-content-center py-3">
				<div class="spinner-border" role="status" aria-label="Loading note"></div>
			</div>
			<div v-else class="note-content">{{ loadedContent }}</div>
		</template>
		<template v-if="isEditing">
			<input v-model="editTitle" type="text" class="form-control form-control-lg mb-3" placeholder="Title"/>
			<textarea ref="edit-text-area" :value="editContent" @input="onContentInput" class="form-control note-textarea" placeholder="Start writing..." rows="12"></textarea>
		</template>
		<div class="d-flex flex-wrap gap-2 mt-3" v-if="hasContent">
			<span class="badge text-bg-secondary" v-if="sentenceCount">{{ sentenceCount }} sentences</span>
			<span class="badge text-bg-secondary" v-if="wordCount">{{ wordCount }} words</span>
			<span class="badge text-bg-secondary" v-if="characterCount">{{ characterCount }} characters</span>
		</div>
	</div>
	<Toast v-if="isCopying" :message="copyResult.message" :type="copyResult.status" :visible="isCopying" :timeStamp="Date.now()" @dismiss="isCopying = false"/>
</template>

<style>
	.edit-note {
		max-width: calc(100vw - 2rem);
		margin: 0 auto;
	}
	.note-content,
	.note-textarea {
		font-size: calc(1rem + var(--font-scale-factor) * 1pt);
	}
	.note-content {
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.7;
	}
	.note-textarea {
		line-height: 1.7;
		field-sizing: content;
		min-height: 18.75rem;
		resize: vertical;
	}
	textarea.form-control {
		min-height: 18.75rem;
	}
</style>