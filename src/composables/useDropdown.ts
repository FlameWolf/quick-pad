import { onMounted, onUnmounted, readonly, ref, type TemplateRef } from "vue";

const listenerOptions: AddEventListenerOptions = { capture: true };

export function useDropdown(trigger: TemplateRef<HTMLElement>, dropdown: TemplateRef<HTMLElement>, initialState: boolean = false) {
	const show = ref(initialState);

	function toggle() {
		show.value = !show.value;
	}

	function clickedOutside(event: MouseEvent) {
		const triggerElement = trigger.value;
		const dropdownElement = dropdown.value;
		if (!triggerElement || !dropdownElement || !show.value) {
			return;
		}
		const target = event.target as Node;
		if (triggerElement === target || triggerElement.contains(target)) {
			return;
		}
		if (!dropdownElement.contains(target)) {
			event.preventDefault();
			event.stopPropagation();
		}
		show.value = false;
	}

	onMounted(() => {
		document.addEventListener("click", clickedOutside, listenerOptions);
	});

	onUnmounted(() => {
		document.removeEventListener("click", clickedOutside, listenerOptions);
	});

	return {
		show: readonly(show),
		toggle
	};
}