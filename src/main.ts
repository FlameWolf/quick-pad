import { runMigration } from "./storage/migrate";
import { hydrateSortPrefs } from "./composables/useNoteSort";
import { hydrateSyncMetadata } from "./composables/useNotesSync";
import { hydrateAuthState } from "./composables/useGoogleAuth";
import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";
import router from "./router";
import { hydrateNotes } from "./stores/notes";
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