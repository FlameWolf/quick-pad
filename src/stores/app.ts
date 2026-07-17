import { readonly, ref } from "vue";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

const lastView = ref<View | null>();
const fontScaleFactor = ref<number>(getFontScaleFactor());

function getFontScaleFactor(): number {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
}

function setFontScaleFactor(factor: number) {
	if (factor < 0 || factor > 10) {
		return;
	}
	fontScaleFactor.value = factor;
	if (factor === 0) {
		localStorage.removeItem(FONT_SCALE_FACTOR);
		return;
	}
	localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
}

export function useAppStore() {
	return {
		lastView,
		fontScaleFactor: readonly(fontScaleFactor),
		setFontScaleFactor
	};
}