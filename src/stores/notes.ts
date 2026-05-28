import { ref, computed, readonly } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import { deleteNote, getAllNotes, putNote } from "@/storage/db";
import { contains, emptyString } from "@/library";
import type { UUID } from "crypto";

const STORAGE_KEY = "qp-note:";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const isLoading = ref(true);
const notes = ref<NoteModel[]>([]);

export async function hydrateNotes(): Promise<void> {
	try {
		const raw = await getAllNotes();
		notes.value = raw.map(NoteModel.fromJSON);
	} catch {
		notes.value = [];
	} finally {
		isLoading.value = false;
	}
}

function persistNote(note: NoteModel) {
	void putNote(note.toJSON());
}

function removeNote(id: UUID) {
	void deleteNote(id);
}

export const useNotesStore = defineStore("notes", () => {
	const searchText = ref<string>(emptyString);
	const searchResults = computed(() => (searchText.value.trim() ? notes.value.filter(note => contains(note.title, searchText.value) || contains(note.content, searchText.value)) : notes.value));
	const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt && !note.purgedAt));
	const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt && !note.purgedAt));
	const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt && !note.purgedAt));

	function addNote(note: NoteModel) {
		notes.value.push(note);
		persistNote(note);
	}

	function updateNote(data: { id: UUID; title: string; content: string }) {
		const index = notes.value.findIndex(note => note.id === data.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.update(data.title, data.content);
			notes.value[index] = existingNote;
			persistNote(existingNote);
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
		const note = notes.value[index] as NoteModel;
		mutator(note);
		persistNote(note);
		notes.value[index] = note;
	}

	function applyToMany(ids: ReadonlyArray<UUID> | Set<UUID>, mutator: (note: NoteModel) => void) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.map(note => {
			if (idSet.has(note.id)) {
				mutator(note);
				persistNote(note);
			}
			return note;
		});
	}

	function archiveNote(id: UUID) {
		applyToNote(id, note => note.archive());
	}

	function archiveMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		applyToMany(idSet, note => note.archive());
	}

	function unarchiveNote(id: UUID) {
		applyToNote(id, note => note.unarchive());
	}

	function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		applyToMany(idSet, note => note.unarchive());
	}

	function trashNote(id: UUID) {
		applyToNote(id, note => note.trash());
	}

	function trashMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		applyToMany(idSet, note => note.trash());
	}

	function restoreFromTrash(id: UUID) {
		applyToNote(id, note => note.restore());
	}

	function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		applyToMany(idSet, note => note.restore());
	}

	function permanentlyDelete(id: UUID) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index !== -1) {
			notes.value.splice(index, 1);
			removeNote(id);
		}
	}

	function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.filter(note => !idSet.has(note.id));
		idSet.forEach(removeNote);
	}

	function purgeExpiredTrash() {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		const expiredIds = notes.value
			.filter(note => {
				if (!note.deletedAt) {
					return false;
				}
				if (note.purgedAt) {
					return true;
				}
				const tombstoneTime = note.deletedAt.getTime();
				return tombstoneTime > 0 && tombstoneTime < cutoff;
			})
			.map(expired => expired.id);
		if (expiredIds.length > 0) {
			permanentlyDeleteMultiple(expiredIds);
		}
		return expiredIds;
	}

	function replaceNote(updatedNote: NoteModel) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		switch (index) {
			case -1:
				notes.value.push(updatedNote);
				break;
			default:
				notes.value.splice(index, 1, updatedNote);
				break;
		}
		persistNote(updatedNote);
	}

	function replaceMultiple(updatedNotes: NoteModel[]) {
		updatedNotes.forEach(replaceNote);
	}

	function replaceAllNotes(newNotes: NoteModel[]) {
		notes.value = newNotes;
		newNotes.forEach(persistNote);
	}

	return {
		notes,
		searchText,
		activeNotes,
		archivedNotes,
		trashedNotes,
		isLoading: readonly(isLoading),
		fileNamePrefix: STORAGE_KEY,
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
		replaceNote,
		replaceMultiple,
		replaceAllNotes
	};
});