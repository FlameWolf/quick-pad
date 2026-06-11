import { ref, computed, readonly, watch } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import * as db from "@/storage/db";
import { contains, emptyString, NOTE_PREFIX, TRASH_RETENTION_MS } from "@/library";
import type { UUID } from "crypto";

const isLoading = ref(true);
const notes = ref<NoteModel[]>([]);

export async function hydrateNotes(): Promise<void> {
	try {
		const raw = await db.getAllNotes();
		notes.value = raw.map(NoteModel.fromJSON);
	} catch {
		notes.value = [];
	} finally {
		isLoading.value = false;
	}
}

async function persistNoteFull(note: NoteModel) {
	await db.putNote(note.toJSON());
	note.content = undefined;
}

async function persistNotesFull(notes: NoteModel[]) {
	await db.putNotes(notes.map(note => note.toJSON()));
	notes.forEach(note => (note.content = undefined));
}

async function persistNoteMeta(note: NoteModel) {
	await db.putNoteMeta(note.toMetaJSON());
}

async function persistNotesMeta(notes: NoteModel[]) {
	await db.putNotesMeta(notes.map(note => note.toMetaJSON()));
}

async function removeNote(id: UUID) {
	await db.deleteNote(id);
}

async function removeNotes(ids: UUID[]) {
	await db.deleteNotes(ids);
}

export const useNotesStore = defineStore("notes", () => {
	const searchText = ref<string>(emptyString);
	const matchedIds = ref<Set<UUID> | null>(null);
	const isSearching = ref(false);
	const searchResults = computed(() => {
		if (!searchText.value.trim()) {
			return notes.value;
		}
		if (matchedIds.value === null) {
			return [];
		}
		const ids = matchedIds.value;
		return notes.value.filter(note => ids.has(note.id));
	});
	const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt));
	const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt));
	const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt));

	watch(searchText, async query => {
		const trimmed = query.trim();
		if (!trimmed) {
			matchedIds.value = null;
			isSearching.value = false;
			return;
		}
		isSearching.value = true;
		matchedIds.value = null;
		const ids = new Set<UUID>(notes.value.filter(note => contains(note.title, trimmed)).map(note => note.id));
		const contentMatches = await db.searchContents(content => contains(content, trimmed));
		contentMatches.forEach(id => ids.add(id as UUID));
		if (searchText.value.trim() === trimmed) {
			matchedIds.value = ids;
			isSearching.value = false;
		}
	});

	async function addNote(note: NoteModel) {
		await persistNoteFull(note);
		notes.value.push(note);
	}

	async function updateNote(data: { id: UUID; title: string; content: string }) {
		const index = notes.value.findIndex(note => note.id === data.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.update(data.title, data.content);
			await persistNoteFull(existingNote);
			notes.value[index] = existingNote;
		}
	}

	const getNote = (id: UUID): NoteModel | undefined => {
		return notes.value.find(note => note.id === id);
	};

	const getNoteContent = (id: UUID): Promise<string | undefined> => {
		return db.getNoteContent(id);
	};

	async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index === -1) {
			return;
		}
		const note = notes.value[index] as NoteModel;
		await Promise.resolve(mutator(note));
		notes.value[index] = note;
		await persistNoteMeta(note);
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
		await persistNotesMeta(targetNotes);
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

	function addOrUpdate(updatedNote: NoteModel) {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		if (index === -1) {
			notes.value.push(updatedNote);
		} else {
			notes.value.splice(index, 1, updatedNote);
		}
	}

	async function replaceNote(updatedNote: NoteModel) {
		await persistNoteFull(updatedNote);
		addOrUpdate(updatedNote);
	}

	async function replaceMultiple(updatedNotes: NoteModel[]) {
		await persistNotesFull(updatedNotes);
		updatedNotes.forEach(addOrUpdate);
	}

	return {
		notes,
		searchText,
		isSearching: readonly(isSearching),
		activeNotes,
		archivedNotes,
		trashedNotes,
		isLoading: readonly(isLoading),
		fileNamePrefix: NOTE_PREFIX,
		addNote,
		updateNote,
		getNote,
		getNoteContent,
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