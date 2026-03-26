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
	const authTimedOut = ref(false);
	let readyTimeout: ReturnType<typeof setTimeout> | null = null;

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
		readyTimeout = setTimeout(() => {
			if (!isReady.value) {
				authTimedOut.value = true;
			}
		}, 6000);
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
									<span class="d-none d-md-inline">{{ user?.name ?? "Sync" }}</span>
								</button>
								<div v-if="showSyncMenu" class="dropdown-menu show sync-dropdown" style="z-index: 1050">
									<div class="dropdown-header text-muted small px-3 py-1">{{ user?.email }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item d-flex align-items-center gap-2" @click="handleToggleAutoSync">
										<input type="checkbox" :checked="autoSyncEnabled" class="form-check-input m-0" @click.stop="handleToggleAutoSync"/>
										<span>Auto-sync</span>
									</button>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item" @click="handleSave">&#9650; Save to Drive</button>
									<button class="dropdown-item sync-dropdown-item" @click="handleLoad">&#9660; Load from Drive</button>
									<div v-if="lastSyncedLabel" class="dropdown-header text-muted small px-3 py-1">Last synced: {{ lastSyncedLabel }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item text-danger" @click="handleSignOut">Sign out</button>
								</div>
							</div>
							<div v-if="showSyncMenu" class="position-fixed top-0 start-0 w-100 h-100" style="z-index: 1040" @click="closeSyncMenu"></div>
						</template>
						<button v-else class="btn btn-outline-primary btn-sm" @click="signIn">
							<i class="bi bi-google"></i>
							<span class="d-none d-sm-inline ms-1">Sign in with Google</span>
							<span class="d-sm-none ms-1">Sign in</span>
						</button>
					</template>
					<template v-else>
						<button v-if="authTimedOut" class="btn btn-outline-secondary btn-sm" disabled title="Google Sign-In library could not be loaded">
							<i class="bi bi-cloud-slash"></i>
							<span class="d-none d-sm-inline ms-1">Sign-in unavailable</span>
						</button>
						<button v-else class="btn btn-outline-secondary btn-sm" disabled>
							<span class="spinner-border spinner-border-sm" role="status"></span>
						</button>
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
	.sync-dropdown {
		position: absolute;
		top: 0;
		right: 0;
		margin-top: 0.25rem;
		min-width: 220px;
	}
	.sync-dropdown-item {
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	@media (max-width: 575.98px) {
		.sync-dropdown {
			position: fixed !important;
			left: 0.5rem;
			right: 0.5rem;
			top: auto;
			bottom: 0.5rem;
			min-width: auto;
			border-radius: 0.75rem;
			box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
		}
	}
</style>