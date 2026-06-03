import { ref, computed, readonly } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import { deleteNote, deleteNotes, getAllNotes, putNote, putNotes } from "@/storage/db";
import { contains, emptyString, STORAGE_KEY, TRASH_RETENTION_MS } from "@/library";
import type { UUID } from "crypto";

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

async function persistNote(note: NoteModel) {
	await putNote(note.toJSON());
}

async function persistNotes(notes: NoteModel[]) {
	await putNotes(notes.map(note => note.toJSON()));
}

async function removeNote(id: UUID) {
	await deleteNote(id);
}

async function removeNotes(ids: UUID[]) {
	await deleteNotes(ids);
}

export const useNotesStore = defineStore("notes", () => {
	const searchText = ref<string>(emptyString);
	const searchResults = computed(() => (searchText.value.trim() ? notes.value.filter(note => contains(note.title, searchText.value) || contains(note.content, searchText.value)) : notes.value));
	const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt));
	const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt));
	const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt));

	async function addNote(note: NoteModel) {
		notes.value.push(note);
		await persistNote(note);
	}

	async function updateNote(data: { id: UUID; title: string; content: string }) {
		const index = notes.value.findIndex(note => note.id === data.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.update(data.title, data.content);
			notes.value[index] = existingNote;
			await persistNote(existingNote);
		}
	}

	const getNote = (id: UUID): NoteModel | undefined => {
		return notes.value.find(note => note.id === id);
	};

	async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index === -1) {
			return;
		}
		const note = notes.value[index] as NoteModel;
		await Promise.resolve(mutator(note));
		notes.value[index] = note;
		await persistNote(note);
	}

	async function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: NoteModel) => void | Promise<void>) {
		const idSet = new Set<UUID>(ids);
		const targets = notes.value.reduce((acc: Array<{ index: number; note: NoteModel }>, curr: NoteModel, index) => {
			if (idSet.has(curr.id)) {
				acc.push({ index, note: curr });
			}
			return acc;
		}, []);
		const targetNotes = targets.map(x => x.note);
		await Promise.all(targetNotes.map(mutator));
		targets.forEach(t => notes.value.splice(t.index, 1, t.note));
		await persistNotes(targetNotes);
	}

	async function archiveNote(id: UUID) {
		await applyToNote(id, note => note.archive());
	}

	async function archiveMultiple(ids: ReadonlyArray<UUID>) {
		await applyToMany(ids, note => note.archive());
	}

	async function unarchiveNote(id: UUID) {
		await applyToNote(id, note => note.unarchive());
	}

	async function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
		await applyToMany(ids, note => note.unarchive());
	}

	async function trashNote(id: UUID) {
		await applyToNote(id, note => note.trash());
	}

	async function trashMultiple(ids: ReadonlyArray<UUID>) {
		await applyToMany(ids, note => note.trash());
	}

	async function restoreFromTrash(id: UUID) {
		await applyToNote(id, note => note.restore());
	}

	async function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
		await applyToMany(ids, note => note.restore());
	}

	async function permanentlyDelete(id: UUID) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index !== -1) {
			notes.value.splice(index, 1);
			await removeNote(id);
		}
	}

	async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.filter(note => !idSet.has(note.id));
		await removeNotes(ids as UUID[]);
	}

	async function purgeExpiredTrash() {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		const expiredIds = notes.value
			.filter(note => {
				if (!note.deletedAt) {
					return false;
				}
				const tombstoneTime = note.deletedAt.getTime();
				return tombstoneTime > 0 && tombstoneTime < cutoff;
			})
			.map(expired => expired.id);
		if (expiredIds.length > 0) {
			await permanentlyDeleteMultiple(expiredIds);
		}
		return expiredIds;
	}

	async function replaceNote(updatedNote: NoteModel) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		switch (index) {
			case -1:
				notes.value.push(updatedNote);
				break;
			default:
				notes.value.splice(index, 1, updatedNote);
				break;
		}
		await persistNote(updatedNote);
	}

	async function replaceMultiple(updatedNotes: NoteModel[]) {
		await Promise.all(updatedNotes.map(replaceNote));
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
		replaceMultiple
	};
});