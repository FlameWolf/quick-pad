import { ref, readonly, watch } from "vue";
import { getKV, setKV } from "@/storage/db";
import { SORT_BY_KEY, SORT_DIRECTION_KEY, SORT_DIRECTIONS, SORT_FIELDS } from "@/constants/sort";
import type { NoteModel } from "@/models/NoteModel";

export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_DIRECTIONS)[number];

let hydrated = false;
const sortBy = ref<SortField>("modifiedAt");
const sortDir = ref<SortOrder>("desc");
export const sortField = readonly(sortBy);
export const sortOrder = readonly(sortDir);

export async function hydrateSortPrefs(): Promise<void> {
	if (hydrated) {
		return;
	}
	hydrated = true;
	const storedBy = await getKV(SORT_BY_KEY);
	if (SORT_FIELDS.includes(storedBy as SortField)) {
		sortBy.value = storedBy as SortField;
	}
	const storedDir = await getKV(SORT_DIRECTION_KEY);
	if (SORT_DIRECTIONS.includes(storedDir as SortOrder)) {
		sortDir.value = storedDir as SortOrder;
	}
	watch(sortBy, async field => {
		await setKV(SORT_BY_KEY, field);
	});
	watch(sortDir, async direction => {
		await setKV(SORT_DIRECTION_KEY, direction);
	});
}

function compareNotes(a: NoteModel, b: NoteModel, field: SortField): number {
	switch (field) {
		case "title":
			return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
		case "createdAt":
			return a.createdAt.getTime() - b.createdAt.getTime();
		case "modifiedAt": {
			const aTime = (a.modifiedAt ?? a.createdAt).getTime();
			const bTime = (b.modifiedAt ?? b.createdAt).getTime();
			return aTime - bTime;
		}
		case "sentenceCount":
			return a.sentenceCount - b.sentenceCount;
		case "wordCount":
			return a.wordCount - b.wordCount;
		case "characterCount":
			return a.characterCount - b.characterCount;
	}
}

export function setSortBy(field: SortField) {
	sortBy.value = field;
}

export function setSortDirection(direction: SortOrder) {
	sortDir.value = direction;
}

export function toggleSortDirection() {
	setSortDirection(sortDir.value === "asc" ? "desc" : "asc");
}

export function getSortedNotes(notes: ReadonlyArray<NoteModel>): NoteModel[] {
	const multiplier = sortDir.value === "asc" ? 1 : -1;
	return notes.toSorted((a, b) => {
		if (a.pinnedAt && !b.pinnedAt) {
			return -1;
		}
		if (b.pinnedAt && !a.pinnedAt) {
			return 1;
		}
		if (a.pinnedAt && b.pinnedAt) {
			return b.pinnedAt.getTime() - a.pinnedAt.getTime();
		}
		return compareNotes(a, b, sortBy.value) * multiplier;
	});
}