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
	stateChangedAt?: string;
	summary: string;
	sentenceCount: number;
	wordCount: number;
	characterCount: number;
}

export class NoteModel {
	id: UUID;
	title: string;
	content: string;
	createdAt: Date;
	modifiedAt?: Date;
	archivedAt?: Date;
	deletedAt?: Date;
	stateChangedAt?: Date;
	summary!: string;
	sentenceCount!: number;
	wordCount!: number;
	characterCount!: number;

	constructor(title: string, content: string, id?: UUID) {
		this.id = id ?? crypto.randomUUID();
		this.title = title;
		this.content = content;
		this.createdAt = new Date();
		this.computeDerived();
	}

	computeDerived() {
		this.summary = getSummary(this.content);
		this.sentenceCount = getSentenceCount(this.content);
		this.wordCount = getWordCount(this.content);
		this.characterCount = getCharacterCount(this.content);
	}

	update(title: string, content: string) {
		this.title = title;
		this.content = content;
		this.modifiedAt = new Date();
		this.computeDerived();
	}

	archive() {
		const now = new Date();
		this.archivedAt = now;
		this.stateChangedAt = now;
	}

	unarchive() {
		this.archivedAt = undefined;
		this.stateChangedAt = new Date();
	}

	trash() {
		const now = new Date();
		this.deletedAt = now;
		this.stateChangedAt = now;
	}

	restore() {
		this.deletedAt = undefined;
		this.stateChangedAt = new Date();
	}

	toJSON(): NoteJSON {
		return {
			id: this.id,
			title: this.title,
			content: this.content,
			createdAt: this.createdAt.toISOString(),
			modifiedAt: this.modifiedAt?.toISOString(),
			archivedAt: this.archivedAt?.toISOString(),
			deletedAt: this.deletedAt?.toISOString(),
			stateChangedAt: this.stateChangedAt?.toISOString(),
			summary: this.summary,
			sentenceCount: this.sentenceCount,
			wordCount: this.wordCount,
			characterCount: this.characterCount
		};
	}

	static fromJSON(data: NoteJSON): NoteModel {
		const note = new NoteModel(data.title, data.content, data.id as UUID);
		note.createdAt = new Date(data.createdAt);
		note.modifiedAt = data.modifiedAt ? new Date(data.modifiedAt) : undefined;
		note.archivedAt = data.archivedAt ? new Date(data.archivedAt) : undefined;
		note.deletedAt = data.deletedAt ? new Date(data.deletedAt) : undefined;
		note.stateChangedAt = data.stateChangedAt ? new Date(data.stateChangedAt) : undefined;
		if (data.summary && data.sentenceCount && data.wordCount && data.characterCount) {
			note.summary = data.summary;
			note.sentenceCount = data.sentenceCount;
			note.wordCount = data.wordCount;
			note.characterCount = data.characterCount;
		} else {
			note.computeDerived();
		}
		return note;
	}
}