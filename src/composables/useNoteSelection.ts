import { ref, computed, readonly } from "vue";
import type { UUID } from "crypto";

const selecting = ref(false);
const selectedNoteIds = ref(new Set<UUID>());
const selectedNoteCount = computed(() => selectedNoteIds.value.size);
export const isSelecting = readonly(selecting);
export const selectedIds = readonly(selectedNoteIds);
export const selectedCount = readonly(selectedNoteCount);

export function enterSelectionMode() {
	selecting.value = true;
}

export function exitSelectionMode() {
	selectedNoteIds.value = new Set();
	selecting.value = false;
}

export function toggleSelection(id: UUID) {
	const next = new Set(selectedNoteIds.value);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	selectedNoteIds.value = next;
}

export function isSelected(id: UUID): boolean {
	return selectedNoteIds.value.has(id);
}

export function selectAll(ids: UUID[]) {
	selectedNoteIds.value = new Set(ids);
}

export function clearSelection() {
	selectedNoteIds.value = new Set();
}