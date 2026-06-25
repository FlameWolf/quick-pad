<script setup lang="ts">
	import "@/styles.css";
	import { onMounted } from "vue";
	import { RouterView } from "vue-router";
	import { isNavigating } from "@/router";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { useNoteDraft } from "@/composables/useNoteDraft";
	import Toast from "@/components/Toast.vue";
	import ConfirmDialog from "@/components/ConfirmDialog.vue";
	import SearchBar from "@/components/SearchBar.vue";
	import SyncControls from "@/components/SyncControls.vue";
	import ThemeToggle from "@/components/ThemeToggle.vue";
	import ScrollButtons from "@/components/ScrollButtons.vue";
	import Icon from "@/components/Icon.vue";

	const { lastSyncMessage, dismissMessage } = useNotesSync();
	const { purgeStaleDrafts } = useNoteDraft();

	onMounted(() => {
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