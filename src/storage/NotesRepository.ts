import * as db from "./db";
import { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

class NotesRepository {
	async loadAll(): Promise<NoteModel[]> {
		const raw = await db.getAllNotes();
		return raw.map(NoteModel.fromJSON);
	}

	loadContent(id: UUID): Promise<string | undefined> {
		return db.getNoteContent(id);
	}

	search(predicate: (content: string) => boolean): Promise<Set<string>> {
		return db.searchContents(predicate);
	}

	async saveFull(note: NoteModel): Promise<void> {
		await db.putNote(note.toJSON());
		note.content = undefined;
	}

	async saveManyFull(notes: NoteModel[]): Promise<void> {
		await db.putNotes(notes.map(note => note.toJSON()));
		notes.forEach(note => (note.content = undefined));
	}

	saveMeta(note: NoteModel): Promise<void> {
		return db.putNoteMeta(note.toMetaJSON());
	}

	saveManyMeta(notes: NoteModel[]): Promise<void> {
		return db.putNotesMeta(notes.map(note => note.toMetaJSON()));
	}

	remove(id: UUID): Promise<void> {
		return db.deleteNote(id);
	}

	removeMany(ids: UUID[]): Promise<void> {
		return db.deleteNotes(ids);
	}
}

export const notesRepository = new NotesRepository();