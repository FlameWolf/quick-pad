import { ref, readonly, watch } from "vue";
import { getKV, setKV } from "@/storage/db";
import type { NoteModel } from "@/models/NoteModel";

export type SortField = "createdAt" | "modifiedAt" | "title" | "sentenceCount" | "wordCount" | "characterCount";
export type SortDirection = "asc" | "desc";

const SORT_BY_KEY = "sort-by";
const SORT_DIRECTION_KEY = "sort-direction";
const SORT_FIELDS: ReadonlyArray<SortField> = ["createdAt", "modifiedAt", "title", "characterCount"];
const SORT_DIRECTIONS: ReadonlyArray<SortDirection> = ["asc", "desc"];
const sortBy = ref<SortField>("modifiedAt");
const sortDirection = ref<SortDirection>("desc");

watch(sortBy, async field => {
	await setKV(SORT_BY_KEY, field);
});
watch(sortDirection, async direction => {
	await setKV(SORT_DIRECTION_KEY, direction);
});

export async function hydrateSortPrefs(): Promise<void> {
	const storedBy = await getKV<string>(SORT_BY_KEY);
	if (SORT_FIELDS.includes(storedBy as SortField)) {
		sortBy.value = storedBy as SortField;
	}
	const storedDir = await getKV<string>(SORT_DIRECTION_KEY);
	if (SORT_DIRECTIONS.includes(storedDir as SortDirection)) {
		sortDirection.value = storedDir as SortDirection;
	}
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

export function useNoteSort() {
	function setSortBy(field: SortField) {
		sortBy.value = field;
	}

	function setSortDirection(direction: SortDirection) {
		sortDirection.value = direction;
	}

	function toggleSortDirection() {
		setSortDirection(sortDirection.value === "asc" ? "desc" : "asc");
	}

	function getSortedNotes(notes: ReadonlyArray<NoteModel>): NoteModel[] {
		const multiplier = sortDirection.value === "asc" ? 1 : -1;
		return [...notes].sort((a, b) => compareNotes(a, b, sortBy.value) * multiplier);
	}

	return {
		sortBy: readonly(sortBy),
		sortDirection: readonly(sortDirection),
		setSortBy,
		setSortDirection,
		toggleSortDirection,
		getSortedNotes
	};
}