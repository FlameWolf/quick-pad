import { readonly, ref } from "vue";

export function useToggle(initialState: boolean = false) {
	const show = ref(initialState);

	function toggle() {
		show.value = !show.value;
	}

	return {
		show: readonly(show),
		toggle
	};
}