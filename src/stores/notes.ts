import { computed, reactive, ref, toRef } from "vue";
import { emptyString } from "@/constants/common";
import { TRASH_RETENTION_MS } from "@/constants/notes";
import { normaliseTag } from "@/utils/common";
import { contains } from "@/utils/text-analysis";
import { notesRepository } from "@/storage/NotesRepository";
import { tagsRepository } from "@/storage/TagsRepository";
import type { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

interface NotesState {
	notes: NoteModel[];
	tags: string[];
	searchText: string;
	searchTags: Set<string>;
	isLoading: boolean;
	isSearching: boolean;
}

let hydrated = false;
const store = reactive<NotesState>({
	notes: [],
	tags: [],
	searchText: emptyString,
	searchTags: new Set<string>(),
	isLoading: true,
	isSearching: false
});
const contentMatchedIds = ref(new Set<UUID>());
export const notes = toRef(() => store.notes);
export const tags = toRef(() => store.tags);
export const searchText = computed(() => store.searchText);
export const searchTags = computed(() => store.searchTags);
export const isLoading = computed(() => store.isLoading);
export const isSearching = computed(() => store.isSearching);
export const searchResults = computed(() => {
	const trimmed = store.searchText.trim();
	const initial = trimmed ? store.notes.filter(note => contains(note.title, trimmed) || contentMatchedIds.value.has(note.id)) : store.notes;
	if (store.searchTags.size === 0) {
		return initial;
	}
	return initial.filter(note => note.tags?.some(tag => store.searchTags.has(tag)));
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
		store.notes = await notesRepository.loadAll();
		store.tags = await tagsRepository.loadAll();
	} catch (err) {
		store.notes = [];
		console.error("Failed to load notes from storage", err);
	} finally {
		store.isLoading = false;
	}
}

export function setSearchText(query: string) {
	const trimmed = query.trim();
	store.searchText = trimmed;
	if (!trimmed) {
		store.isSearching = false;
		contentMatchedIds.value.clear();
		return;
	}
	store.isSearching = true;
	notesRepository
		.search(content => contains(content, trimmed))
		.then(matches => {
			contentMatchedIds.value = matches as Set<UUID>;
		})
		.finally(() => {
			store.isSearching = false;
		});
}

export function addSearchTag(tag: string) {
	store.searchTags.add(normaliseTag(tag));
}

export function removeSearchTag(tag: string) {
	store.searchTags.delete(normaliseTag(tag));
}

export async function addNote(note: NoteModel) {
	store.notes.push(note);
	await notesRepository.saveFull(note);
}

export async function updateNote(data: { id: UUID; title: string; content: string }) {
	const note = store.notes.find(note => note.id === data.id);
	if (note) {
		note.update(data.title, data.content);
		await notesRepository.saveFull(note);
	}
}

export const getNote = (id: UUID): NoteModel | undefined => {
	return store.notes.find(note => note.id === id);
};

export const getNoteContent = (id: UUID): Promise<string | undefined> => {
	return notesRepository.loadContent(id);
};

async function applyToNote(id: UUID, mutator: (note: NoteModel) => void) {
	const note = store.notes.find(note => note.id === id);
	if (note) {
		mutator(note);
		await notesRepository.saveMeta(note);
	}
}

async function applyToMany(ids: ReadonlyArray<UUID>, mutator: (note: NoteModel) => void): Promise<void> {
	const idSet = new Set(ids);
	const targetNotes = store.notes.filter(note => idSet.has(note.id));
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

export async function addTag(id: UUID, tag: string) {
	await applyToNote(id, note => note.addTag(tag));
}

export async function addTagMultiple(ids: ReadonlyArray<UUID>, tag: string) {
	await applyToMany(ids, note => note.addTag(tag));
}

export async function removeTag(id: UUID, tag: string) {
	await applyToNote(id, note => note.removeTag(tag));
}

export async function removeTagMultiple(ids: ReadonlyArray<UUID>, tag: string) {
	await applyToMany(ids, note => note.removeTag(tag));
}

export async function permanentlyDelete(id: UUID) {
	const index = store.notes.findIndex(note => note.id === id);
	if (index !== -1) {
		store.notes.splice(index, 1);
		await notesRepository.remove(id);
	}
}

export async function permanentlyDeleteMultiple(ids: ReadonlyArray<UUID>) {
	const idSet = new Set<UUID>(ids);
	store.notes = store.notes.filter(note => !idSet.has(note.id));
	await notesRepository.removeMany(ids as UUID[]);
}

export async function purgeExpiredTrash() {
	const cutoff = Date.now() - TRASH_RETENTION_MS;
	const expiredIds = store.notes
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
	const index = store.notes.findIndex(note => note.id === updatedNote.id);
	if (index === -1) {
		store.notes.push(updatedNote);
	} else {
		store.notes.splice(index, 1, updatedNote);
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