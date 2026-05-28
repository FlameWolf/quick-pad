import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { runMigration } from "./storage/migrate";
import { hydrateNotes } from "./stores/notes";
import { hydrateSortPrefs } from "./composables/useNoteSort";
import { hydrateSyncMetadata } from "./composables/useNotesSync";
import { hydrateAuthState } from "./composables/useGoogleAuth";
import { registerServiceWorker } from "./registerServiceWorker";

await runMigration();
await Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState()]);
(function () {
	const app = createApp(App);
	app.use(createPinia());
	app.use(router);
	app.mount("#app");
})();
await hydrateNotes();
registerServiceWorker();