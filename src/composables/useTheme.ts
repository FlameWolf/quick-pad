import { ref, readonly, toValue } from "vue";

export enum Theme {
	Dark = "dark",
	Light = "light"
}

const activeTheme = ref(
	toValue(() => {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme === Theme.Dark || savedTheme === Theme.Light) {
			return savedTheme;
		}
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? Theme.Dark : Theme.Light;
	})
);

function applyTheme(newTheme: Theme) {
	activeTheme.value = newTheme;
	document.documentElement.setAttribute("data-bs-theme", newTheme);
	localStorage.setItem("theme", newTheme);
}

function toggleTheme() {
	applyTheme(activeTheme.value === Theme.Dark ? Theme.Light : Theme.Dark);
}

applyTheme(activeTheme.value);

export function useTheme() {
	return {
		activeTheme: readonly(activeTheme),
		toggleTheme
	};
}