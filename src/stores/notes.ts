import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

export const useNotesStore = defineStore("notes", () => {
	const notes = ref(new Array<NoteModel>());
	const noteCount = computed(() => notes.value.length);
	const addNote = (note: NoteModel) => {
		notes.value.push(note);
	};
	const updateNote = (updatedNote: Omit<NoteModel, "createdAt" | "modifiedAt">) => {
		const index = notes.value.findIndex(note => note.id === updatedNote.id);
		if (index !== -1) {
			var existingNote = notes.value[index] as NoteModel;
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
	return {
		notes,
		noteCount,
		addNote,
		updateNote,
		getNote,
		removeNote,
		getAllNotes,
		removeAllNotes
	};
});