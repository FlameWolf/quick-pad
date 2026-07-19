import { computed, reactive, toRef } from "vue";
import { emptyString } from "@/constants/common";
import { FONT_SCALE_FACTOR } from "@/constants/ui";

interface AppState {
	lastView: View | null | undefined;
	fontScaleFactor: number;
}

const store = reactive<AppState>({
	lastView: null,
	fontScaleFactor: getFontScaleFactor()
});
export const lastView = toRef(store, "lastView");
export const fontScaleFactor = computed(() => store.fontScaleFactor);

function getFontScaleFactor(): number {
	const factor = parseInt(localStorage.getItem(FONT_SCALE_FACTOR) ?? emptyString);
	if (Number.isNaN(factor)) {
		return 0;
	}
	return factor;
}

export function setFontScaleFactor(factor: number) {
	if (factor < 0 || factor > 10) {
		return;
	}
	store.fontScaleFactor = factor;
	if (factor === 0) {
		localStorage.removeItem(FONT_SCALE_FACTOR);
		return;
	}
	localStorage.setItem(FONT_SCALE_FACTOR, factor.toString());
}