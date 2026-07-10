import { onMounted, onUnmounted, readonly, ref, type TemplateRef } from "vue";

export function useDropdown(dropdownRoot: TemplateRef<HTMLElement>, initialState: boolean = false) {
	const show = ref(initialState);

	function toggle() {
		show.value = !show.value;
	}

	function clickedOutside(event: MouseEvent) {
		const rootElement = dropdownRoot.value;
		if (!rootElement) {
			return;
		}
		if (!rootElement.contains(event.target as Node)) {
			show.value = false;
		}
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