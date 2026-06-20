import * as db from "./db";
import { NoteModel } from "@/models/NoteModel";
import type { UUID } from "crypto";

class NotesRepository {
	async loadAll(): Promise<NoteModel[]> {
		return (await db.getAllNotes()).map(NoteModel.fromJSON);
	}

	async loadContent(id: UUID): Promise<string | undefined> {
		return await db.getNoteContent(id);
	}

	async search(predicate: (content: string) => boolean): Promise<Set<string>> {
		return await db.searchContents(predicate);
	}

	async saveFull(note: NoteModel): Promise<void> {
		await db.putNote(note.toJSON());
		note.content = undefined;
	}

	async saveManyFull(notes: NoteModel[]): Promise<void> {
		await db.putNotes(notes.map(note => note.toJSON()));
		notes.forEach(note => (note.content = undefined));
	}

	async saveMeta(note: NoteModel): Promise<void> {
		return await db.putNoteMeta(note.toMetaJSON());
	}

	async saveManyMeta(notes: NoteModel[]): Promise<void> {
		return await db.putNotesMeta(notes.map(note => note.toMetaJSON()));
	}

	async remove(id: UUID): Promise<void> {
		return await db.deleteNote(id);
	}

	async removeMany(ids: UUID[]): Promise<void> {
		return await db.deleteNotes(ids);
	}
}

export const notesRepository = new NotesRepository();