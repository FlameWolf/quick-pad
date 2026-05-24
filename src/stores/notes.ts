import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import { contains, emptyString } from "@/library";
import type { UUID } from "crypto";

const LEGACY_STORAGE_KEY = "quick-pad-notes";
const STORAGE_KEY = "qp-note:";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const noteKey = (id: UUID) => `${STORAGE_KEY}${id}`;

function migrateFromLegacy(): NoteModel[] {
	const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (!raw) {
		return [];
	}
	try {
		return JSON.parse(raw).map(NoteModel.fromJSON);
	} catch {
		return [];
	} finally {
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	}
}

function loadFromStorage(): NoteModel[] {
	const storedNotes: NoteModel[] = migrateFromLegacy();
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (!key?.startsWith(STORAGE_KEY)) {
			continue;
		}
		try {
			storedNotes.push(NoteModel.fromJSON(JSON.parse(localStorage.getItem(key) as string)));
		} catch {
			void 0;
		}
	}
	return storedNotes;
}

function persistNote(note: NoteModel) {
	localStorage.setItem(noteKey(note.id), JSON.stringify(note.toJSON()));
}

function removeNote(id: UUID) {
	localStorage.removeItem(noteKey(id));
}

export const useNotesStore = defineStore("notes", () => {
	const notes = ref<NoteModel[]>(loadFromStorage());
	const searchText = ref<string>(emptyString);
	const searchResults = computed(() => (searchText.value.trim() ? notes.value.filter(note => contains(note.title, searchText.value) || contains(note.content, searchText.value)) : notes.value));
	const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt && !note.purgedAt));
	const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt && !note.purgedAt));
	const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt && !note.purgedAt));

	function addNote(note: NoteModel) {
		notes.value.push(note);
		persistNote(note);
	}

	function updateNote(updatedNote: Omit<NoteModel, "createdAt" | "modifiedAt">) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.title = updatedNote.title;
			existingNote.content = updatedNote.content;
			existingNote.modifiedAt = new Date();
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
		applyToNote(id, note => note.purge());
		removeNote(id);
	}

	function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		applyToMany(idSet, note => note.purge());
		idSet.forEach(removeNote);
	}

	function purgeExpiredTrash() {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		const expiredIds = notes.value
			.filter(note => {
				const tombstoneTime = Math.max(note.deletedAt?.getTime() ?? 0, note.purgedAt?.getTime() ?? 0);
				return tombstoneTime > 0 && tombstoneTime < cutoff;
			})
			.map(expired => expired.id);
		if (expiredIds.length > 0) {
			const expiredSet = new Set<UUID>(expiredIds);
			notes.value = notes.value.filter(note => !expiredSet.has(note.id));
			expiredSet.forEach(removeNote);
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