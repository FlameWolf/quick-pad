<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import { RouterView } from "vue-router";
	import { onMounted } from "vue";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { useNotesStore } from "@/stores/notes";
	import { isNavigating } from "@/router";
	import Toast from "@/components/Toast.vue";
	import ConfirmDialog from "@/components/ConfirmDialog.vue";
	import SearchBar from "@/components/SearchBar.vue";
	import SyncControls from "@/components/SyncControls.vue";
	import ThemeToggle from "@/components/ThemeToggle.vue";
	import ScrollButtons from "@/components/ScrollButtons.vue";

	const notesStore = useNotesStore();
	const { lastSyncMessage, dismissMessage, requestSync } = useNotesSync();

	onMounted(async () => {
		const purgedIds = await notesStore.purgeExpiredTrash();
		if (purgedIds.length > 0) {
			requestSync(purgedIds);
		}
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
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-code-slash" viewBox="0 0 16 16">
					<path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0m6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0"/>
				</svg>
				<span>Source</span>
			</a>
		</div>
	</footer>
	<ScrollButtons/>
	<Toast v-if="lastSyncMessage" :message="lastSyncMessage.text" :type="lastSyncMessage.type" :visible="!!lastSyncMessage" :timeStamp="lastSyncMessage.timeStamp" @dismiss="dismissMessage"/>
	<ConfirmDialog/>
	<div v-if="isNavigating" class="nav-overlay"></div>
</template>
<style>
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