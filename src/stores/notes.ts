import { ref, computed, readonly, watch } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import { deleteNote, deleteNotes, getAllNotes, getNoteContent, putNoteFull, putNoteMeta, putNotesFull, putNotesMeta } from "@/storage/db";
import { contains, emptyString, STORAGE_KEY, TRASH_RETENTION_MS } from "@/library";
import type { UUID } from "crypto";

const isLoading = ref(true);
const notes = ref<NoteModel[]>([]);

export async function hydrateNotes(): Promise<void> {
	try {
		const raw = await getAllNotes();
		notes.value = raw.map(NoteModel.fromSummaryJSON);
	} catch {
		notes.value = [];
	} finally {
		isLoading.value = false;
	}
}

async function persistMeta(note: NoteModel) {
	await putNoteMeta(note.toMetaJSON());
}

async function persistManyMeta(notes: NoteModel[]) {
	await putNotesMeta(notes.map(note => note.toMetaJSON()));
}

async function persistFull(note: NoteModel) {
	await putNoteFull(note.toJSON());
	note.content = undefined;
}

async function removeNote(id: UUID) {
	await deleteNote(id);
}

async function removeNotes(ids: UUID[]) {
	await deleteNotes(ids);
}

export const useNotesStore = defineStore("notes", () => {
	const searchText = ref<string>(emptyString);
	const matchedIds = ref<Set<UUID> | null>(null);
	const runSearch = async (text: string) => {
		const query = text;
		if (!query) {
			matchedIds.value = null;
			return;
		}
		const snapshot = notes.value.slice();
		const ids = new Set<UUID>();
		await Promise.all(
			snapshot.map(async note => {
				if (contains(note.title, query)) {
					ids.add(note.id);
					return;
				}
				if (contains(await getNoteContent(note.id), query)) {
					ids.add(note.id);
				}
			})
		);
		if (query === searchText.value) {
			matchedIds.value = ids;
		}
	};
	const isMatch = (note: NoteModel) => matchedIds.value === null || matchedIds.value.has(note.id);
	const activeNotes = computed(() => notes.value.filter(note => !note.archivedAt && !note.deletedAt && !note.purgedAt && isMatch(note)));
	const archivedNotes = computed(() => notes.value.filter(note => note.archivedAt && !note.deletedAt && !note.purgedAt && isMatch(note)));
	const trashedNotes = computed(() => notes.value.filter(note => note.deletedAt && !note.purgedAt && isMatch(note)));

	watch(searchText, runSearch);

	async function addNote(note: NoteModel) {
		await persistFull(note);
		notes.value.push(note);
	}

	async function updateNote(data: { id: UUID; title: string; content: string }) {
		const index = notes.value.findIndex(note => note.id === data.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.update(data.title, data.content);
			await persistFull(existingNote);
			notes.value[index] = existingNote;
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
		mutator(note);
		await persistMeta(note);
		notes.value[index] = note;
	}

	async function applyToMany(ids: ReadonlyArray<UUID> | Set<UUID>, mutator: (note: NoteModel) => void | Promise<void>) {
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
		await persistManyMeta(targetNotes);
	}

	async function archiveNote(id: UUID) {
		await applyToNote(id, note => note.archive());
	}

	async function archiveMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		await applyToMany(idSet, note => note.archive());
	}

	async function unarchiveNote(id: UUID) {
		await applyToNote(id, note => note.unarchive());
	}

	async function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		await applyToMany(idSet, note => note.unarchive());
	}

	async function trashNote(id: UUID) {
		await applyToNote(id, note => note.trash());
	}

	async function trashMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		await applyToMany(idSet, note => note.trash());
	}

	async function restoreFromTrash(id: UUID) {
		await applyToNote(id, note => note.restore());
	}

	async function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		await applyToMany(idSet, note => note.restore());
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
		await removeNotes(Array.from(idSet));
	}

	async function purgeExpiredTrash() {
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
		await persistFull(updatedNote);
	}

	async function replaceMultiple(updatedNotes: NoteModel[]) {
		for (const updatedNote of updatedNotes) {
			const index = notes.value.findIndex(note => note.id === updatedNote.id);
			index === -1 ? notes.value.push(updatedNote) : notes.value.splice(index, 1, updatedNote);
		}
		await putNotesFull(updatedNotes.map(note => note.toJSON()));
		updatedNotes.forEach(note => (note.content = undefined));
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