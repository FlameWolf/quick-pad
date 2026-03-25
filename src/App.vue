<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterView } from "vue-router";
	import { onMounted, ref } from "vue";
	import { useTheme } from "@/composables/useTheme";
	import { useGoogleAuth } from "@/composables/useGoogleAuth";
	import { useNotesSync } from "@/composables/useNotesSync";

	useTheme();

	const { isSignedIn, isReady, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { isSyncing, saveToCloud, loadFromCloud } = useNotesSync();
	const showSyncMenu = ref(false);

	onMounted(() => {
		tryRestoreSession();
	});

	function toggleSyncMenu() {
		showSyncMenu.value = !showSyncMenu.value;
	}

	function closeSyncMenu() {
		showSyncMenu.value = false;
	}

	async function handleSave() {
		closeSyncMenu();
		await saveToCloud();
	}

	async function handleLoad() {
		closeSyncMenu();
		await loadFromCloud();
	}

	function handleSignOut() {
		closeSyncMenu();
		signOut();
	}
</script>

<template>
	<BApp>
		<nav class="navbar navbar-expand bg-body-tertiary border-bottom mb-4">
			<div class="container">
				<RouterLink to="/notes" class="navbar-brand fw-semibold">QuickPad</RouterLink>
				<div class="d-flex align-items-center gap-2">
					<template v-if="isReady">
						<template v-if="isSignedIn">
							<div class="position-relative">
								<button
									class="btn btn-outline-secondary btn-sm"
									@click="toggleSyncMenu"
									:disabled="isSyncing"
									title="Google Drive Sync"
								>
									<template v-if="isSyncing">Syncing...</template>
									<template v-else>&#9729; {{ user?.name ?? "Sync" }}</template>
								</button>
								<div
									v-if="showSyncMenu"
									class="dropdown-menu show position-absolute end-0 mt-1"
									style="min-width: 180px;"
								>
									<button class="dropdown-item" @click="handleSave">Save to Drive</button>
									<button class="dropdown-item" @click="handleLoad">Load from Drive</button>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item text-danger" @click="handleSignOut">Sign out</button>
								</div>
							</div>
							<div v-if="showSyncMenu" class="position-fixed top-0 start-0 w-100 h-100" style="z-index: 1000;" @click="closeSyncMenu"></div>
						</template>
						<button v-else class="btn btn-outline-primary btn-sm" @click="signIn">
							Sign in with Google
						</button>
					</template>
				</div>
			</div>
		</nav>
		<main class="container pb-4">
			<RouterView />
		</main>
	</BApp>
</template>

<style>
	body {
		min-height: 100vh;
	}
</style>
