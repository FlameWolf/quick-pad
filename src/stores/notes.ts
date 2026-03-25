import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

const STORAGE_KEY = "quick-pad-notes";

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
	const noteCount = computed(() => notes.value.length);

	watch(
		notes,
		() => {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value));
		},
		{ deep: true }
	);

	const addNote = (note: NoteModel) => {
		notes.value.push(note);
	};

	const updateNote = (updatedNote: Omit<NoteModel, "createdAt" | "modifiedAt">) => {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		if (index !== -1) {
			const existingNote = notes.value[index] as NoteModel;
			existingNote.title = updatedNote.title;
			existingNote.content = updatedNote.content;
			existingNote.modifiedAt = new Date();
			notes.value[index] = existingNote;
		}
	};

	const getNote = (id: UUID): NoteModel | undefined => {
		return notes.value.find(note => note.id === id);
	};

	const removeNote = (id: UUID) => {
		notes.value = notes.value.filter(note => note.id !== id);
	};

	const getAllNotes = () => {
		return notes.value;
	};

	const removeAllNotes = () => {
		notes.value = [];
	};

	const replaceAllNotes = (newNotes: NoteModel[]) => {
		notes.value = newNotes;
	};

	return {
		notes,
		noteCount,
		addNote,
		updateNote,
		getNote,
		removeNote,
		getAllNotes,
		removeAllNotes,
		replaceAllNotes
	};
});