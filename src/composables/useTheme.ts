import { ref, readonly, onUnmounted } from "vue";

const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = ref(mediaQuery.matches);

function applyTheme(dark: boolean) {
	document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");
}

function handleChange(e: MediaQueryListEvent) {
	isDark.value = e.matches;
	applyTheme(e.matches);
}

let listening = false;

export function useTheme() {
	if (!listening) {
		applyTheme(isDark.value);
		mediaQuery.addEventListener("change", handleChange);
		listening = true;
	}

	return {
		isDark: readonly(isDark)
	};
}
