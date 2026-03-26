import { ref, computed } from "vue";
import type { UUID } from "crypto";

const selectedIds = ref(new Set<UUID>());
const isSelectionMode = ref(false);

export function useNoteSelection() {
	const selectedCount = computed(() => selectedIds.value.size);

	function enterSelectionMode() {
		isSelectionMode.value = true;
	}

	function exitSelectionMode() {
		selectedIds.value = new Set();
		isSelectionMode.value = false;
	}

	function toggleSelection(id: UUID) {
		const next = new Set(selectedIds.value);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds.value = next;
	}

	function isSelected(id: UUID): boolean {
		return selectedIds.value.has(id);
	}

	function selectAll(ids: UUID[]) {
		selectedIds.value = new Set(ids);
	}

	function clearSelection() {
		selectedIds.value = new Set();
	}

	return {
		isSelectionMode,
		selectedIds,
		selectedCount,
		enterSelectionMode,
		exitSelectionMode,
		toggleSelection,
		isSelected,
		selectAll,
		clearSelection
	};
}