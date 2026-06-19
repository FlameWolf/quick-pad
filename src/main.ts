import { ensurePersistentStorage } from "@/storage/persistence.ts";
import { registerServiceWorker } from "@/registerServiceWorker";
import { runMigration } from "@/storage/migrate";
import { hydrateSortPrefs } from "@/composables/useNoteSort";
import { hydrateSyncMetadata } from "@/composables/useNotesSync";
import { hydrateAuthState } from "@/composables/useGoogleAuth";
import { createApp } from "vue";
import App from "@/App.vue";
import { createPinia } from "pinia";
import router from "@/router";
import { hydrateNotes } from "@/stores/notes";

ensurePersistentStorage().then(success => {
	if (!success) {
		console.warn("Persistent storage request denied. Browser may automatically clear locally saved notes based on storage quotas and eviction criteria.");
	}
});
registerServiceWorker();
await runMigration();
await Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState()]);
(function () {
	const app = createApp(App);
	app.use(createPinia());
	app.use(router);
	app.mount("#app");
})();
await hydrateNotes();