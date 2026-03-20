import { getCharacterCount, getSentenceCount, getSummary, getWordCount } from "@/library";
import type { UUID } from "crypto";

export class NoteModel {
	id: UUID;
	title: string;
	content: string;
	createdAt: Date;
	modifiedAt?: Date;

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