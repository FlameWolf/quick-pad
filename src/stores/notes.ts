import { ref, computed, readonly, watch } from "vue";
import { notesRepository } from "@/storage/NotesRepository";
import { contains } from "@/utils/text-analysis";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

let hydrated = false;
const store = ref<NoteModel[]>([]);
const loading = ref(true);
const searching = ref(false);
export const notes = readonly(store);
export const searchText = ref<string>(emptyString);
export const isLoading = readonly(loading);
export const isSearching = readonly(searching);
export const contentMatchedIds = ref<Set<UUID> | null>(null);
export const searchResults = computed(() => {
	const trimmed = searchText.value.trim();
	if (!trimmed) {
		return store.value;
	}
	return store.value.filter(note => contains(note.title, trimmed) || contentMatchedIds.value?.has(note.id));
});
export const activeNotes = computed(() => searchResults.value.filter(note => !note.archivedAt && !note.deletedAt));
export const favedNotes = computed(() => searchResults.value.filter(note => note.favedAt && !note.deletedAt));
export const archivedNotes = computed(() => searchResults.value.filter(note => note.archivedAt && !note.deletedAt));
export const trashedNotes = computed(() => searchResults.value.filter(note => note.deletedAt));

export async function hydrateNotes(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	try {
		store.value = await notesRepository.loadAll();
	} catch (err) {
		store.value = [];
		console.error("Failed to load notes from storage", err);
	} finally {
		loading.value = false;
	}
	watch(searchText, async query => {
		const trimmed = query.trim();
		contentMatchedIds.value = null;
		if (!trimmed) {
			searching.value = false;
			return;
		}
		searching.value = true;
		const matches = await notesRepository.search(content => contains(content, trimmed));
		if (searchText.value.trim() === trimmed) {
			contentMatchedIds.value = matches as Set<UUID>;
			searching.value = false;
		}
	});
}

export async function addNote(note: NoteModel) {
	store.value.push(note);
	await notesRepository.saveFull(note);
}

export async function updateNote(data: { id: UUID; title: string; content: string }) {
	const note = store.value.find(note => note.id === data.id);
	if (note) {
		note.update(data.title, data.content);
		await notesRepository.saveFull(note);
	}
}

export const getNote = (id: UUID): NoteModel | undefined => {
	return store.value.find(note => note.id === id);
};

export const getNoteContent = (id: UUID): Promise<string | undefined> => {
	return notesRepository.loadContent(id);
};

async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
	const note = store.value.find(note => note.id === id);
	if (note) {
		mutator(note);
		await notesRepository.saveMeta(note);
	}
}

async function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: NoteModel) => void): Promise<void> {
	const idSet = new Set(ids);
	const targetNotes = store.value.filter(note => idSet.has(note.id));
	targetNotes.forEach(mutator);
	await notesRepository.saveManyMeta(targetNotes);
}

export async function faveNote(id: UUID) {
	await applyToNote(id, note => note.fave());
}

export async function faveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.fave());
}

export async function unfaveNote(id: UUID) {
	await applyToNote(id, note => note.unfave());
}

export async function unfaveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.unfave());
}

export async function pinNote(id: UUID) {
	await applyToNote(id, note => note.pin());
}

export async function unpinNote(id: UUID) {
	await applyToNote(id, note => note.unpin());
}

export async function archiveNote(id: UUID) {
	await applyToNote(id, note => note.archive());
}

export async function archiveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.archive());
}

export async function unarchiveNote(id: UUID) {
	await applyToNote(id, note => note.unarchive());
}

export async function unarchiveMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.unarchive());
}

export async function trashNote(id: UUID) {
	await applyToNote(id, note => note.trash());
}

export async function trashMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.trash());
}

export async function restoreFromTrash(id: UUID) {
	await applyToNote(id, note => note.restore());
}

export async function restoreFromTrashMultiple(ids: ReadonlyArray<UUID>) {
	await applyToMany(ids, note => note.restore());
}

export async function permanentlyDelete(id: UUID) {
	const index = store.value.findIndex(note => note.id === id);
	if (index !== -1) {
		store.value.splice(index, 1);
		await notesRepository.remove(id);
	}
}

export async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	store.value = store.value.filter(note => !idSet.has(note.id));
	await notesRepository.removeMany(ids as UUID[]);
}

export async function purgeExpiredTrash() {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const expiredIds = store.value
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
	const index = store.value.findIndex(note => note.id === updatedNote.id);
	if (index === -1) {
		store.value.push(updatedNote);
	} else {
		store.value.splice(index, 1, updatedNote);
	}
}

export async function replaceNote(updatedNote: NoteModel) {
	addOrUpdate(updatedNote);
	await notesRepository.saveFull(updatedNote);
}

export async function replaceMultiple(updatedNotes: NoteModel[]) {
	updatedNotes.forEach(addOrUpdate);
	await notesRepository.saveManyFull(updatedNotes);
}