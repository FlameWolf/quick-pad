import { ref, computed, readonly, watch } from "vue";
import { defineStore } from "pinia";
import { notesRepository } from "@/storage/NotesRepository";
import { contains } from "@/utils/text-analysis";
import { emptyString } from "@/constants/common";
import { NOTE_PREFIX } from "@/constants/storage";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { logError } from "@/utils/logger";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

const isLoading = ref(true);
const notes = ref<NoteModel[]>([]);

export async function hydrateNotes(): Promise<void> {
	try {
		notes.value = await notesRepository.loadAll();
	} catch (error) {
		logError("Failed to load notes from storage", error);
		notes.value = [];
	} finally {
		isLoading.value = false;
	}
}

export const useNotesStore = defineStore("notes", () => {
	const searchText = ref<string>(emptyString);
	const contentMatchedIds = ref<Set<UUID> | null>(null);
	const isSearching = ref(false);
	const searchResults = computed(() => {
		const trimmed = searchText.value.trim();
		if (!trimmed) {
			return notes.value;
		}
		const contentIds = contentMatchedIds.value;
		return notes.value.filter(note => contains(note.title, trimmed) || contentIds?.has(note.id));
	});
	const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt));
	const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt));
	const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt));

	watch(searchText, async query => {
		const trimmed = query.trim();
		contentMatchedIds.value = null;
		if (!trimmed) {
			isSearching.value = false;
			return;
		}
		isSearching.value = true;
		const matches = await notesRepository.search(content => contains(content, trimmed));
		if (searchText.value.trim() === trimmed) {
			contentMatchedIds.value = matches as Set<UUID>;
			isSearching.value = false;
		}
	});

	async function addNote(note: NoteModel) {
		await notesRepository.saveFull(note);
		notes.value.push(note);
	}

	async function updateNote(data: { id: UUID; title: string; content: string }) {
		const index = notes.value.findIndex(note => note.id === data.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.update(data.title, data.content);
			await notesRepository.saveFull(existingNote);
			notes.value[index] = existingNote;
		}
	}

	const getNote = (id: UUID): NoteModel | undefined => {
		return notes.value.find(note => note.id === id);
	};

	const getNoteContent = (id: UUID): Promise<string | undefined> => {
		return notesRepository.loadContent(id);
	};

	async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
		const index = notes.value.findIndex(note => note.id === id);
		if (index === -1) {
			return;
		}
		const note = notes.value[index] as NoteModel;
		await Promise.resolve(mutator(note));
		notes.value[index] = note;
		await notesRepository.saveMeta(note);
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
		await notesRepository.saveManyMeta(targetNotes);
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
			await notesRepository.remove(id);
		}
	}

	async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
		const idSet = new Set<UUID>(ids);
		notes.value = notes.value.filter(note => !idSet.has(note.id));
		await notesRepository.removeMany(ids as UUID[]);
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
		await notesRepository.saveFull(updatedNote);
		addOrUpdate(updatedNote);
	}

	async function replaceMultiple(updatedNotes: NoteModel[]) {
		await notesRepository.saveManyFull(updatedNotes);
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