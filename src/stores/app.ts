import { ref, watch } from "vue";
import { defineStore } from "pinia";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

function getFontScaleFactor(): number {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
}

export const useAppStore = defineStore("app", () => {
	const lastView = ref<View | null>();
	const fontScaleFactor = ref<number>(getFontScaleFactor());

	function setLastView(view: View | null) {
		lastView.value = view;
	}

	function setFontScaleFactor(factor: number) {
		if (factor < 0 || factor > 10) {
			return;
		}
		fontScaleFactor.value = factor;
	}

	watch(fontScaleFactor, factor => {
		if (factor === 0) {
			localStorage.removeItem(FONT_SCALE_FACTOR);
			return;
		}
		localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
	});

	return {
		lastView,
		fontScaleFactor,
		setLastView,
		setFontScaleFactor
	};
});