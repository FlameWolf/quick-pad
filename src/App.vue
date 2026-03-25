<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import "bootstrap-icons/font/bootstrap-icons.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterView } from "vue-router";
	import { computed, onMounted, ref } from "vue";
	import { useTheme } from "@/composables/useTheme";
	import { useGoogleAuth } from "@/composables/useGoogleAuth";
	import { useNotesSync } from "@/composables/useNotesSync";
	import SyncToast from "@/components/SyncToast.vue";

	const { isDark } = useTheme();
	const { isSignedIn, isReady, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { isSyncing, lastSyncedAt, syncError, autoSyncEnabled, lastSyncMessage, saveToCloud, loadFromCloud, setAutoSync, dismissMessage } = useNotesSync();
	const showSyncMenu = ref(false);

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

	function handleToggleAutoSync() {
		setAutoSync(!autoSyncEnabled.value);
	}

	const lastSyncedLabel = computed(() => {
		if (!lastSyncedAt.value) {
			return null;
		}
		const diff = Date.now() - lastSyncedAt.value.getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return "just now";
		}
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `${hours}h ago`;
		}
		return lastSyncedAt.value.toLocaleDateString();
	});

	onMounted(() => {
		tryRestoreSession();
	});
</script>
<template>
	<BApp>
		<div class="position-absolute top-0 end-0 mt-1 me-1">
			<i class="bi" :class="{ 'bi-moon-stars-fill': isDark, 'bi-sun-fill': !isDark }"></i>
		</div>
		<nav class="navbar navbar-expand bg-body-tertiary border-bottom mb-4">
			<div class="container">
				<RouterLink to="/notes" class="navbar-brand fw-semibold">QuickPad</RouterLink>
				<div class="d-flex align-items-center gap-2">
					<template v-if="isReady">
						<template v-if="isSignedIn">
							<div class="position-relative">
								<button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" @click="toggleSyncMenu" :disabled="isSyncing" title="Google Drive Sync">
									<span v-if="isSyncing" class="spinner-border spinner-border-sm" role="status"></span>
									<span v-else-if="syncError" class="sync-icon text-warning" title="Sync error">&#9888;</span>
									<span v-else-if="lastSyncedAt" class="sync-icon text-success">&#10003;</span>
									<span v-else class="sync-icon">&#9729;</span>
									<span>{{ user?.name ?? "Sync" }}</span>
								</button>
								<div v-if="showSyncMenu" class="dropdown-menu show position-absolute end-0 mt-1" style="min-width: 220px; z-index: 1050">
									<div class="dropdown-header text-muted small px-3 py-1">{{ user?.email }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item d-flex align-items-center gap-2" @click="handleToggleAutoSync">
										<input type="checkbox" :checked="autoSyncEnabled" class="form-check-input m-0" @click.stop="handleToggleAutoSync"/>
										<span>Auto-sync</span>
									</button>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item" @click="handleSave">&#9650; Save to Drive</button>
									<button class="dropdown-item" @click="handleLoad">&#9660; Load from Drive</button>
									<div v-if="lastSyncedLabel" class="dropdown-header text-muted small px-3 py-1">Last synced: {{ lastSyncedLabel }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item text-danger" @click="handleSignOut">Sign out</button>
								</div>
							</div>
							<div v-if="showSyncMenu" class="position-fixed top-0 start-0 w-100 h-100" style="z-index: 1040" @click="closeSyncMenu"></div>
						</template>
						<button v-else class="btn btn-outline-primary btn-sm" @click="signIn">Sign in with Google</button>
					</template>
				</div>
			</div>
		</nav>
		<main class="container pb-4">
			<RouterView/>
		</main>
		<SyncToast v-if="lastSyncMessage" :message="lastSyncMessage.text" :type="lastSyncMessage.type" :visible="!!lastSyncMessage" @dismiss="dismissMessage"/>
	</BApp>
</template>
<style>
	body {
		min-height: 100vh;
	}
	.sync-icon {
		font-size: 0.875rem;
		line-height: 1;
	}
</style>