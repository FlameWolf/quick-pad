<script setup lang="ts">
	import "@/styles.css";
	import { onMounted } from "vue";
	import { RouterView } from "vue-router";
	import { currentColour } from "@/stores/app";
	import { isLoading, hydrateNotes } from "@/stores/notes";
	import { isNavigating } from "@/router";
	import { purgeStaleDrafts } from "@/composables/useNoteDraft";
	import Icon from "@/components/Icon.vue";
	import SearchBar from "@/components/SearchBar.vue";
	import SyncControls from "@/components/SyncControls.vue";
	import ThemeToggle from "@/components/ThemeToggle.vue";
	import ScrollButtons from "@/components/ScrollButtons.vue";
	import NotificationList from "@/components/NotificationList.vue";
	import ConfirmDialogue from "@/components/ConfirmDialogue.vue";

	onMounted(async () => {
		await hydrateNotes();
		purgeStaleDrafts();
	});
</script>
<template>
	<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2">
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
	<main class="flex-grow-1 container px-2 py-4" :class="{ [`bg-${currentColour}`]: !!currentColour }">
		<div v-if="isLoading" class="d-flex flex-column justify-content-center align-items-center">
			<div class="spinner-border" aria-hidden="true"></div>
			<div class="mt-3" role="status">Loading notes...</div>
		</div>
		<RouterView v-else/>
	</main>
	<footer class="bg-body-tertiary border-top">
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
	<NotificationList/>
	<ConfirmDialogue/>
	<div v-if="isNavigating" class="nav-overlay"></div>
</template>