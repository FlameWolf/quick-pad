import { ref } from "vue";
import { defineStore } from "pinia";

export const useAppStore = defineStore("app", () => {
	const lastView = ref<View | null>();
	const fontScaleFactor = ref<number>(0);

	function setLastView(view: View | null) {
		lastView.value = view;
	}

	function setFontcaleFactor(factor: number) {
		fontScaleFactor.value = factor;
	}

	return {
		lastView,
		fontScaleFactor,
		setLastView,
		setFontcaleFactor
	};
});