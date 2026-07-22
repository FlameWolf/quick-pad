import { emptyString } from "@/constants/common";
import { TAG_PREFIX } from "@/constants/storage";
import { contains } from "@/utils/text-analysis";
import * as db from "@/storage/db";

class TagsRepository {
	async loadAll(): Promise<string[]> {
		const values = await db.getAllKV();
		return values.filter(x => x.startsWith(TAG_PREFIX)).map(x => x.replace(TAG_PREFIX, emptyString));
	}

	async search(text: string): Promise<string[]> {
		return (await this.loadAll()).filter(tag => contains(tag, text));
	}

	async load(tag: string): Promise<string | undefined> {
		return await db.getKV(`${TAG_PREFIX}${tag}`);
	}

	async save(tag: string): Promise<void> {
		db.setKV(`${TAG_PREFIX}${tag}`, tag);
	}

	async saveMany(tags: string[]): Promise<void> {
		tags.forEach(this.save);
	}

	async remove(tag: string): Promise<void> {
		db.deleteKV(`${TAG_PREFIX}${tag}`);
	}

	async removeMany(tags: string[]): Promise<void> {
		tags.forEach(this.remove);
	}
}

export const tagsRepository = new TagsRepository();