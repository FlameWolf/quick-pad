<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import { onMounted } from "vue";
	import { RouterView } from "vue-router";
	import { isNavigating } from "@/router";
	import { hydrateNotes, useNotesStore } from "@/stores/notes";
	import { hydrateAuthState } from "@/composables/useGoogleAuth";
	import { hydrateSortPrefs } from "@/composables/useNoteSort";
	import { hydrateSyncMetadata, useNotesSync } from "@/composables/useNotesSync";
	import { useNoteDraft } from "@/composables/useNoteDraft";
	import Toast from "@/components/Toast.vue";
	import ConfirmDialog from "@/components/ConfirmDialog.vue";
	import SearchBar from "@/components/SearchBar.vue";
	import SyncControls from "@/components/SyncControls.vue";
	import ThemeToggle from "@/components/ThemeToggle.vue";
	import ScrollButtons from "@/components/ScrollButtons.vue";
	import Icon from "@/components/Icon.vue";

	const notesStore = useNotesStore();
	const { lastSyncMessage, dismissMessage, requestSync } = useNotesSync();
	const { purgeStaleDrafts } = useNoteDraft();

	async function hydrateAll() {
		try {
			await Promise.all([hydrateSortPrefs(), hydrateSyncMetadata(), hydrateAuthState(), hydrateNotes()]);
			return true;
		} catch {
			return false;
		}
	}

	onMounted(async () => {
		if (await hydrateAll()) {
			const purgedIds = await notesStore.purgeExpiredTrash();
			if (purgedIds.length > 0) {
				requestSync(purgedIds);
			}
		}
		purgeStaleDrafts();
	});
</script>
<template>
	<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2 mb-4">
		<div class="container gap-2">
			<RouterLink to="/notes" class="navbar-brand">
				<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
			</RouterLink>
			<SearchBar/>
			<div class="d-flex align-items-center gap-2">
				<SyncControls/>
				<ThemeToggle/>
			</div>
		</div>
	</nav>
	<main class="flex-grow-1 container px-2 pb-4">
		<RouterView/>
	</main>
	<footer class="bg-body-tertiary border-top mt-4">
		<div class="d-flex flex-wrap justify-content-center align-items-center gap-3 small text-muted px-2 py-3">
			<span>QuickPad</span>
			<RouterLink to="/privacy" class="link-secondary text-decoration-none">Privacy Policy</RouterLink>
			<RouterLink to="/terms" class="link-secondary text-decoration-none">Terms of Service</RouterLink>
			<a target="_blank" href="https://github.com/FlameWolf/quick-pad" class="icon-link link-secondary text-decoration-none">
				<Icon type="codeSlash"/>
				<span>Source</span>
			</a>
		</div>
	</footer>
	<ScrollButtons/>
	<Toast v-if="lastSyncMessage" :message="lastSyncMessage.text" :type="lastSyncMessage.type" :timeStamp="lastSyncMessage.timeStamp" @dismiss="dismissMessage"/>
	<ConfirmDialog/>
	<div v-if="isNavigating" class="nav-overlay"></div>
</template>
<style>
	:root {
		--font-scale-factor: 0;
	}
	body {
		min-height: 100vh;
	}
	.container {
		max-width: unset;
		padding: unset;
	}
	.logo {
		height: 1.5rem;
		filter: invert(0.5);
	}
	.bi {
		vertical-align: -0.125rem;
		max-width: 0.875rem;
		max-height: 0.875rem;
	}
	.nav-overlay {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		cursor: wait;
	}
</style>