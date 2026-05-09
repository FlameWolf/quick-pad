<script setup lang="ts">
	import { ref, computed, onBeforeUnmount, onMounted } from "vue";
	import { useRouter, useRoute, onBeforeRouteLeave } from "vue-router";
	import { useNotesStore } from "@/stores/notes";
	import { useUndoRedo } from "@/composables/useUndoRedo";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { NoteModel } from "@/models/NoteModel";
	import { useFileIO } from "@/composables/useFileIO";
	import { getSentenceCount, getWordCount, getCharacterCount, emptyString } from "@/library";
	import type { UUID } from "crypto";

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const props = defineProps<{ id?: UUID }>();
	const router = useRouter();
	const route = useRoute();
	const store = useNotesStore();
	const { exportNote } = useFileIO();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isCreateMode = computed(() => route.path === "/notes/new");
	const existingNote = computed(() => (props.id && !isCreateMode.value ? store.getNote(props.id) : undefined));
	const isEditing = ref(isCreateMode.value);
	const editTitle = ref(existingNote.value?.title ?? emptyString);
	const editContent = ref(existingNote.value?.content ?? emptyString);
	const undoRedo = useUndoRedo(editContent.value);
	const displayContent = computed(() => (isEditing.value ? editContent.value : (existingNote.value?.content ?? "")));
	const sentenceCount = computed(() => getSentenceCount(displayContent.value));
	const wordCount = computed(() => getWordCount(displayContent.value));
	const characterCount = computed(() => getCharacterCount(displayContent.value));
	const isArchived = computed(() => !!existingNote.value?.archivedAt && !existingNote.value?.deletedAt);
	const isTrashed = computed(() => !!existingNote.value?.deletedAt);
	const backRoute = computed(() => {
		if (isTrashed.value) {
			return "/notes/trash";
		}
		if (isArchived.value) {
			return "/notes/archive";
		}
		return "/notes";
	});
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
		return editTitle.value !== existingNote.value.title || editContent.value !== existingNote.value.content;
	});

	function onContentInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		editContent.value = value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			undoRedo.push(value);
		}, 300);
	}

	function doUndo() {
		undoRedo.undo();
		editContent.value = undoRedo.current.value;
	}

	function doRedo() {
		undoRedo.redo();
		editContent.value = undoRedo.current.value;
	}

	function startEditing() {
		editTitle.value = existingNote.value?.title ?? emptyString;
		editContent.value = existingNote.value?.content ?? emptyString;
		undoRedo.push(editContent.value);
		isEditing.value = true;
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
		}
		if (isCreateMode.value) {
			isEditing.value = false;
			router.push("/notes");
		} else {
			isEditing.value = false;
			editTitle.value = existingNote.value?.title ?? emptyString;
			editContent.value = existingNote.value?.content ?? emptyString;
		}
	}

	function saveNote() {
		const title = editTitle.value.trim() || "Untitled";
		const content = editContent.value;
		if (isCreateMode.value) {
			const note = new NoteModel(title, content);
			store.addNote(note);
			isEditing.value = false;
			requestSync();
			router.push(`/notes/${note.id}`);
			return;
		}
		if (existingNote.value) {
			existingNote.value.update(title, content);
			store.updateNote(existingNote.value);
			requestSync();
		}
		isEditing.value = false;
	}

	async function deleteNote() {
		if (!existingNote.value) {
			return;
		}
		const returnTo = backRoute.value;
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
		store.trashNote(existingNote.value.id);
		requestSync();
		router.push(returnTo);
	}

	function archiveNote() {
		if (!existingNote.value) {
			return;
		}
		store.archiveNote(existingNote.value.id);
		requestSync();
		router.push("/notes");
	}

	function unarchiveNote() {
		if (!existingNote.value) {
			return;
		}
		store.unarchiveNote(existingNote.value.id);
		requestSync();
		router.push("/notes/archive");
	}

	function restoreNote() {
		if (!existingNote.value) {
			return;
		}
		store.restoreFromTrash(existingNote.value.id);
		requestSync();
		router.push("/notes/trash");
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
		store.permanentlyDelete(existingNote.value.id);
		requestSync();
		router.push("/notes/trash");
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
			e.returnValue = "";
		}
	}

	onMounted(() => {
		window.addEventListener("beforeunload", onBeforeUnload);
	});

	onBeforeUnmount(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		window.removeEventListener("beforeunload", onBeforeUnload);
	});

	onBeforeRouteLeave(async () => {
		if (!hasUnsavedChanges.value) {
			return true;
		}
		return await confirmDiscardChanges();
	});
</script>

<template>
	<div class="edit-note">
		<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
			<RouterLink :to="backRoute" class="btn btn-outline-secondary btn-sm" aria-label="Back to notes">&larr; Back</RouterLink>
			<div class="d-flex flex-wrap gap-2" v-if="!isCreateMode && !isEditing && isTrashed">
				<button class="btn btn-outline-primary btn-sm" @click="restoreNote">Restore</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="existingNote" @click="exportNote(existingNote)">Export</button>
				<button class="btn btn-outline-danger btn-sm" @click="permanentlyDeleteNote">Delete Permanently</button>
			</div>
			<div class="d-flex flex-wrap gap-2" v-else-if="!isCreateMode && !isEditing">
				<button class="btn btn-outline-primary btn-sm" @click="startEditing">Edit</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="existingNote" @click="exportNote(existingNote)">Export</button>
				<button class="btn btn-outline-secondary btn-sm" v-if="isArchived" @click="unarchiveNote">Unarchive</button>
				<button class="btn btn-outline-secondary btn-sm" v-else @click="archiveNote">Archive</button>
				<button class="btn btn-outline-danger btn-sm" @click="deleteNote">Delete</button>
			</div>
			<div class="d-flex flex-wrap gap-2" v-if="isEditing">
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canUndo.value" @click="doUndo" title="Undo" aria-label="Undo">&#x21A9;</button>
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canRedo.value" @click="doRedo" title="Redo" aria-label="Redo">&#x21AA;</button>
				<button class="btn btn-primary btn-sm" @click="saveNote">Save</button>
				<button class="btn btn-outline-secondary btn-sm" @click="cancelEditing">Cancel</button>
			</div>
		</div>
		<template v-if="!isEditing && existingNote">
			<h2 class="mb-3">{{ existingNote.title }}</h2>
			<div class="text-muted small mb-3" v-if="existingNote.modifiedAt || existingNote.createdAt">
				{{ existingNote.modifiedAt ? `Modified ${formatDate(existingNote.modifiedAt)}` : `Created ${formatDate(existingNote.createdAt)}` }}
			</div>
			<div class="note-content">{{ existingNote.content }}</div>
		</template>
		<template v-if="isEditing">
			<input v-model="editTitle" type="text" class="form-control form-control-lg mb-3" placeholder="Note title"/>
			<textarea :value="editContent" @input="onContentInput" class="form-control note-textarea" placeholder="Start writing..." rows="12"></textarea>
		</template>
		<div class="d-flex flex-wrap gap-2 mt-3" v-if="displayContent">
			<span class="badge text-bg-secondary" v-if="sentenceCount">{{ sentenceCount }} sentences</span>
			<span class="badge text-bg-secondary" v-if="wordCount">{{ wordCount }} words</span>
			<span class="badge text-bg-secondary" v-if="characterCount">{{ characterCount }} characters</span>
		</div>
	</div>
</template>

<style>
	.edit-note {
		max-width: calc(100vw - 2rem);
		margin: 0 auto;
	}
	.note-content {
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.7;
	}
	.note-textarea {
		min-height: 300px;
		resize: vertical;
		line-height: 1.7;
	}
</style>