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
		const triggerElement = trigger.value;
		if (!triggerElement || !show.value) {
			return;
		}
		const target = event.target as Node;
		if (triggerElement.contains(target)) {
			return;
		}
		if (autoClose) {
			const protectedElement = dropdown?.value;
			if (!protectedElement || protectedElement.contains(target)) {
				return;
			}
			show.value = false;
		}
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