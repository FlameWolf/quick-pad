import { onBeforeUnmount, onMounted, readonly, ref, type TemplateRef } from "vue";

type DropdownOptions = {
	initialState?: boolean;
	autoClose?: boolean;
	dropdown?: TemplateRef<HTMLElement>;
};

export function useDropdown(trigger: TemplateRef<HTMLElement>, { initialState = false, autoClose = true, dropdown }: DropdownOptions = {}) {
	const show = ref(initialState);

	function toggle() {
		show.value = !show.value;
	}

	function clickedOutside(event: MouseEvent) {
		if (!trigger.value || !show.value) {
			return;
		}
		const target = event.target as Node;
		if (trigger.value.contains(target)) {
			return;
		}
		if (!autoClose && dropdown?.value?.contains(target)) {
			return;
		}
		show.value = false;
	}

	onMounted(() => {
		document.addEventListener("click", clickedOutside);
	});

	onBeforeUnmount(() => {
		document.removeEventListener("click", clickedOutside);
	});

	return {
		show: readonly(show),
		toggle
	};
}