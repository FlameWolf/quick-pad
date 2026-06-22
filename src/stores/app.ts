import { ref } from "vue";
import { defineStore } from "pinia";

export const useAppStore = defineStore("app", () => {
	const lastView = ref<View | null>();
	const fontScaleFactor = ref<number>(0);

	function setLastView(view: View | null) {
		lastView.value = view;
	}

	function setFontScaleFactor(factor: number) {
		if (factor < 0 || factor > 10) {
			return;
		}
		fontScaleFactor.value = factor;
	}

	return {
		lastView,
		fontScaleFactor,
		setLastView,
		setFontScaleFactor
	};
});