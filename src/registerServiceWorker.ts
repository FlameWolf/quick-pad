import { logError } from "@/utils/logger";

export function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) {
		return;
	}
	if (!import.meta.env.PROD) {
		return;
	}
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch(error => {
			logError("Service worker registration failed", error);
		});
	});
}