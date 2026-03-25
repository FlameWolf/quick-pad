<script setup lang="ts">
	import { ref, computed, watch, onBeforeUnmount } from "vue";
	import { useRouter, useRoute } from "vue-router";
	import { useNotesStore } from "@/stores/notes";
	import { useUndoRedo } from "@/composables/useUndoRedo";
	import { NoteModel } from "@/models/NoteModel";
	import { getSentenceCount, getWordCount, getCharacterCount } from "@/library";
	import type { UUID } from "crypto";

	const props = defineProps<{ id?: UUID }>();
	const router = useRouter();
	const route = useRoute();
	const store = useNotesStore();

	const isCreateMode = computed(() => route.path === "/notes/new");
	const existingNote = computed(() => (props.id && !isCreateMode.value) ? store.getNote(props.id) : undefined);
	const isEditing = ref(isCreateMode.value);

	const editTitle = ref(existingNote.value?.title ?? "");
	const editContent = ref(existingNote.value?.content ?? "");

	const undoRedo = useUndoRedo(editContent.value);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
		editTitle.value = existingNote.value?.title ?? "";
		editContent.value = existingNote.value?.content ?? "";
		undoRedo.push(editContent.value);
		isEditing.value = true;
	}

	function cancelEditing() {
		if (isCreateMode.value) {
			router.push("/notes");
		} else {
			isEditing.value = false;
			editTitle.value = existingNote.value?.title ?? "";
			editContent.value = existingNote.value?.content ?? "";
		}
	}

	function saveNote() {
		const title = editTitle.value.trim() || "Untitled";
		const content = editContent.value;

		if (isCreateMode.value) {
			const note = new NoteModel(title, content);
			store.addNote(note);
			router.push(`/notes/${note.id}`);
		} else if (existingNote.value) {
			existingNote.value.update(title, content);
			store.updateNote(existingNote.value);
			isEditing.value = false;
		}
	}

	const confirmingDelete = ref(false);

	function deleteNote() {
		if (!confirmingDelete.value) {
			confirmingDelete.value = true;
			return;
		}
		if (existingNote.value) {
			store.removeNote(existingNote.value.id);
			router.push("/notes");
		}
	}

	function cancelDelete() {
		confirmingDelete.value = false;
	}

	const displayContent = computed(() => isEditing.value ? editContent.value : (existingNote.value?.content ?? ""));
	const sentenceCount = computed(() => getSentenceCount(displayContent.value));
	const wordCount = computed(() => getWordCount(displayContent.value));
	const characterCount = computed(() => getCharacterCount(displayContent.value));

	function formatDate(date?: Date): string {
		if (!date) return "";
		return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
	}

	onBeforeUnmount(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});
</script>

<template>
	<div class="edit-note">
		<!-- Top action bar -->
		<div class="d-flex justify-content-between align-items-center mb-3">
			<RouterLink to="/notes" class="btn btn-outline-secondary btn-sm">&larr; Back</RouterLink>
			<div class="d-flex gap-2" v-if="!isCreateMode && !isEditing">
				<button class="btn btn-outline-primary btn-sm" @click="startEditing">Edit</button>
				<button
					v-if="!confirmingDelete"
					class="btn btn-outline-danger btn-sm"
					@click="deleteNote"
				>Delete</button>
				<template v-if="confirmingDelete">
					<button class="btn btn-danger btn-sm" @click="deleteNote">Confirm Delete</button>
					<button class="btn btn-outline-secondary btn-sm" @click="cancelDelete">Cancel</button>
				</template>
			</div>
			<div class="d-flex gap-2" v-if="isEditing">
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canUndo.value" @click="doUndo" title="Undo">&#x21A9;</button>
				<button class="btn btn-outline-secondary btn-sm" :disabled="!undoRedo.canRedo.value" @click="doRedo" title="Redo">&#x21AA;</button>
				<button class="btn btn-primary btn-sm" @click="saveNote">Save</button>
				<button class="btn btn-outline-secondary btn-sm" @click="cancelEditing">Cancel</button>
			</div>
		</div>

		<!-- View mode -->
		<template v-if="!isEditing && existingNote">
			<h2 class="mb-3">{{ existingNote.title }}</h2>
			<div class="text-muted small mb-3" v-if="existingNote.modifiedAt || existingNote.createdAt">
				{{ existingNote.modifiedAt ? `Modified ${formatDate(existingNote.modifiedAt)}` : `Created ${formatDate(existingNote.createdAt)}` }}
			</div>
			<div class="note-content">{{ existingNote.content }}</div>
		</template>

		<!-- Edit / Create mode -->
		<template v-if="isEditing">
			<input
				v-model="editTitle"
				type="text"
				class="form-control form-control-lg mb-3"
				placeholder="Note title"
			/>
			<textarea
				:value="editContent"
				@input="onContentInput"
				class="form-control note-textarea"
				placeholder="Start writing..."
				rows="12"
			></textarea>
		</template>

		<!-- Stats footer -->
		<div class="d-flex gap-2 mt-3" v-if="displayContent">
			<span class="badge text-bg-secondary" v-if="sentenceCount">{{ sentenceCount }} sentences</span>
			<span class="badge text-bg-secondary" v-if="wordCount">{{ wordCount }} words</span>
			<span class="badge text-bg-secondary" v-if="characterCount">{{ characterCount }} characters</span>
		</div>
	</div>
</template>

<style scoped>
	.edit-note {
		max-width: 800px;
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
