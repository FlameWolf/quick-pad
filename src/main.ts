import { ensurePersistentStorage } from "@/storage/persistence.ts";
import { runMigration } from "@/storage/migrate";
import { registerServiceWorker } from "@/registerServiceWorker";
import { createApp } from "vue";
import router from "@/router";
import App from "@/App.vue";

ensurePersistentStorage().then(success => {
	if (!success) {
		console.warn("Persistent storage request denied. Browser may automatically clear locally saved notes based on storage quotas and eviction criteria.");
	}
});
registerServiceWorker();
await runMigration();
(function () {
	const app = createApp(App);
	app.use(router);
	app.mount("#app");
})();