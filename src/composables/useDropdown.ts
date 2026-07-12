import { onMounted, onUnmounted, readonly, ref, type TemplateRef } from "vue";

export function useDropdown(trigger: TemplateRef<HTMLElement>, initialState: boolean = false) {
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
		if (triggerElement === target || triggerElement.contains(target)) {
			return;
		}
		show.value = false;
	}

	onMounted(() => {
		document.addEventListener("click", clickedOutside);
	});

	onUnmounted(() => {
		document.removeEventListener("click", clickedOutside);
	});

	return {
		show: readonly(show),
		toggle
	};
}