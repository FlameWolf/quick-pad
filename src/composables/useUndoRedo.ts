import { ref, computed, type Ref, type ComputedRef } from "vue";

const MAX_HISTORY = 100;

export interface UndoRedo<T> {
	current: Ref<T>;
	push: (value: T) => void;
	undo: () => void;
	redo: () => void;
	canUndo: ComputedRef<boolean>;
	canRedo: ComputedRef<boolean>;
}

export function useUndoRedo<T>(initial: T): UndoRedo<T> {
	const current = ref<T>(initial) as Ref<T>;
	const past = ref<T[]>([]) as Ref<T[]>;
	const future = ref<T[]>([]) as Ref<T[]>;
	const canUndo = computed(() => past.value.length > 0);
	const canRedo = computed(() => future.value.length > 0);

	function push(value: T) {
		if (value === current.value) {
			return;
		}
		past.value.push(current.value);
		if (past.value.length > MAX_HISTORY) {
			past.value.shift();
		}
		current.value = value;
		future.value = [];
	}

	function undo() {
		if (past.value.length === 0) {
			return;
		}
		future.value.push(current.value);
		current.value = past.value.pop()!;
	}

	function redo() {
		if (future.value.length === 0) {
			return;
		}
		past.value.push(current.value);
		current.value = future.value.pop()!;
	}

	return { current, push, undo, redo, canUndo, canRedo };
}