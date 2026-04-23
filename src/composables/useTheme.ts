import { ref, readonly } from "vue";

const isListening = ref(false);
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = ref(mediaQuery.matches);

function applyTheme(dark: boolean) {
	document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
}

function handleChange(e: MediaQueryListEvent) {
	isDark.value = e.matches;
	applyTheme(e.matches);
}

export function useTheme() {
	if (!isListening.value) {
		applyTheme(isDark.value);
		mediaQuery.addEventListener("change", handleChange);
		isListening.value = true;
	}

	return {
		isDark: readonly(isDark)
	};
}