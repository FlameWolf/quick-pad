import { getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/library";
import type { UUID } from "crypto";

export interface NoteJSON {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	modifiedAt?: string;
	archivedAt?: string;
	deletedAt?: string;
}

export class NoteModel {
	id: UUID;
	title: string;
	content: string;
	createdAt: Date;
	modifiedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;

	constructor(title: string, content: string) {
		this.id = crypto.randomUUID();
		this.title = title;
		this.content = content;
		this.createdAt = new Date();
	}

	update(title: string, content: string) {
		this.title = title;
		this.content = content;
		this.modifiedAt = new Date();
	}

	archive() {
		this.archivedAt = new Date();
	}

	unarchive() {
		this.archivedAt = undefined;
	}

	trash() {
		this.deletedAt = new Date();
		this.modifiedAt = this.deletedAt;
	}

	restore() {
		this.deletedAt = undefined;
		this.modifiedAt = new Date();
	}

	toJSON(): NoteJSON {
		return {
			id: this.id,
			title: this.title,
			content: this.content,
			createdAt: this.createdAt.toISOString(),
			modifiedAt: this.modifiedAt?.toISOString(),
			archivedAt: this.archivedAt?.toISOString(),
			deletedAt: this.deletedAt?.toISOString()
		};
	}

	static fromJSON(data: NoteJSON): NoteModel {
		const note = new NoteModel(data.title, data.content);
		note.id = data.id as UUID;
		note.createdAt = new Date(data.createdAt);
		note.modifiedAt = data.modifiedAt ? new Date(data.modifiedAt) : undefined;
		note.archivedAt = data.archivedAt ? new Date(data.archivedAt) : undefined;
		note.deletedAt = data.deletedAt ? new Date(data.deletedAt) : undefined;
		return note;
	}

	get summary(): string {
		return getSummary(this.content);
	}

	get sentenceCount(): number {
		return getSentenceCount(this.content);
	}

	get wordCount(): number {
		return getWordCount(this.content);
	}

	get characterCount(): number {
		return getCharacterCount(this.content);
	}
}