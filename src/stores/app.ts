import { ref } from "vue";
import { defineStore } from "pinia";

export const useAppStore = defineStore("app", () => {
	const lastView = ref<View | null>();

	function setLastView(view: View | null) {
		lastView.value = view;
	}

	return {
		lastView,
		setLastView
	};
});