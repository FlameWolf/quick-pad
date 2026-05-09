import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

const STORAGE_KEY = "quick-pad-notes";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function loadFromStorage(): NoteModel[] {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return [];
	}
	try {
		const parsed: NoteJSON[] = JSON.parse(raw);
		return parsed.map(NoteModel.fromJSON);
	} catch {
		return [];
	}
}

export const useNotesStore = defineStore("notes", () => {
	const notes = ref<NoteModel[]>(loadFromStorage());

	const activeNotes = computed(() => notes.value.filter(note => !note.archivedAt && !note.deletedAt));
	const archivedNotes = computed(() => notes.value.filter(note => note.archivedAt && !note.deletedAt));
	const trashedNotes = computed(() => notes.value.filter(note => note.deletedAt));
	const noteCount = computed(() => activeNotes.value.length);

	watch(
		notes,
		() => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value));
		},
		{ deep: true }
	);

	function addNote(note: NoteModel) {
		notes.value.push(note);
	}

	function updateNote(updatedNote: Omit<NoteModel, "createdAt" | "modifiedAt">) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.title = updatedNote.title;
			existingNote.content = updatedNote.content;
			existingNote.modifiedAt = new Date();
			notes.value[index] = existingNote;
		}
	}

	const getNote = (id: UUID): NoteModel | undefined => {
		return notes.value.find(note => note.id === id);
	};

	function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index === -1) {
			return;
		}
		const existing = notes.value[index] as NoteModel;
		mutator(existing);
		notes.value[index] = existing;
	}

	function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: NoteModel) => void) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.map(note => {
			if (idSet.has(note.id)) {
				mutator(note);
			}
			return note;
		});
	}

	function archiveNote(id: UUID) {
		applyToNote(id, note => note.archive());
	}

	function archiveMultiple(ids: ReadonlyArray<UUID>) {
		applyToMany(ids, note => note.archive());
	}

	function unarchiveNote(id: UUID) {
		applyToNote(id, note => note.unarchive());
	}

	function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
		applyToMany(ids, note => note.unarchive());
	}

	function trashNote(id: UUID) {
		applyToNote(id, note => note.trash());
	}

	function trashMultiple(ids: ReadonlyArray<UUID>) {
		applyToMany(ids, note => note.trash());
	}

	function restoreFromTrash(id: UUID) {
		applyToNote(id, note => note.restore());
	}

	function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
		applyToMany(ids, note => note.restore());
	}

	function permanentlyDelete(id: UUID) {
		notes.value = notes.value.filter(note => note.id !== id);
	}

	function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.filter(note => !idSet.has(note.id));
	}

	function purgeExpiredTrash() {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		const before = notes.value.length;
		notes.value = notes.value.filter(note => !note.deletedAt || note.deletedAt.getTime() >= cutoff);
		return before - notes.value.length;
	}

	function removeNote(id: UUID) {
		trashNote(id);
	}

	function getAllNotes() {
		return notes.value;
	}

	function removeAllNotes() {
		notes.value = [];
	}

	function replaceAllNotes(newNotes: NoteModel[]) {
		notes.value = newNotes;
	}

	return {
		notes,
		activeNotes,
		archivedNotes,
		trashedNotes,
		noteCount,
		addNote,
		updateNote,
		getNote,
		archiveNote,
		archiveMultiple,
		unarchiveNote,
		unarchiveMultiple,
		trashNote,
		trashMultiple,
		restoreFromTrash,
		restoreFromTrashMultiple,
		permanentlyDelete,
		permanentlyDeleteMultiple,
		purgeExpiredTrash,
		removeNote,
		getAllNotes,
		removeAllNotes,
		replaceAllNotes
	};
});