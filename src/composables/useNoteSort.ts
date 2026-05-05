import { ref, readonly } from "vue";
import type { NoteModel } from "@/models/NoteModel";

export type SortField = "createdAt" | "modifiedAt" | "title" | "characterCount";
export type SortDirection = "asc" | "desc";

const SORT_BY_KEY = "quick-pad-sort-by";
const SORT_DIRECTION_KEY = "quick-pad-sort-direction";
const SORT_FIELDS: ReadonlyArray<SortField> = ["createdAt", "modifiedAt", "title", "characterCount"];
const SORT_DIRECTIONS: ReadonlyArray<SortDirection> = ["asc", "desc"];

function loadSortBy(): SortField {
	const raw = localStorage.getItem(SORT_BY_KEY);
	return SORT_FIELDS.includes(raw as SortField) ? (raw as SortField) : "modifiedAt";
}

function loadSortDirection(): SortDirection {
	const raw = localStorage.getItem(SORT_DIRECTION_KEY);
	return SORT_DIRECTIONS.includes(raw as SortDirection) ? (raw as SortDirection) : "desc";
}

const sortBy = ref<SortField>(loadSortBy());
const sortDirection = ref<SortDirection>(loadSortDirection());

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
		case "characterCount":
			return a.characterCount - b.characterCount;
	}
}

export function useNoteSort() {
	function setSortBy(field: SortField) {
		sortBy.value = field;
		localStorage.setItem(SORT_BY_KEY, field);
	}

	function setSortDirection(direction: SortDirection) {
		sortDirection.value = direction;
		localStorage.setItem(SORT_DIRECTION_KEY, direction);
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