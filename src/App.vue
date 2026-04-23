<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import "bootstrap-icons/font/bootstrap-icons.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterView } from "vue-router";
	import { computed, onMounted, onBeforeUnmount, ref } from "vue";
	import { useTheme } from "@/composables/useTheme";
	import { useGoogleAuth } from "@/composables/useGoogleAuth";
	import { useNotesSync } from "@/composables/useNotesSync";
	import SyncToast from "@/components/SyncToast.vue";

	const { isDark } = useTheme();
	const { isSignedIn, isReady, isConfigured, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
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
		if (isConfigured.value) {
			readyTimeout = setTimeout(() => {
				if (!isReady.value) {
					authTimedOut.value = true;
				}
			}, 6000);
		}
		tryRestoreSession();
	});

	onBeforeUnmount(() => {
		if (readyTimeout) {
			clearTimeout(readyTimeout);
		}
	});
</script>
<template>
	<BApp>
		<div class="d-none position-absolute top-0 end-0 mt-1 me-1" aria-hidden="true">
			<i class="bi" :class="{ 'bi-moon-stars-fill': isDark, 'bi-sun-fill': !isDark }"></i>
		</div>
		<nav class="navbar navbar-expand bg-body-tertiary border-bottom mb-4">
			<div class="container">
				<RouterLink to="/notes" class="navbar-brand fw-semibold">QuickPad</RouterLink>
				<div class="d-flex align-items-center gap-2">
					<template v-if="!isConfigured">
						<!-- Sync not configured — keep UI quiet so the app works in local-only mode -->
					</template>
					<template v-else-if="isReady">
						<template v-if="isSignedIn">
							<div class="position-relative">
								<button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" @click="toggleSyncMenu" :disabled="isSyncing" :title="syncError ? `Sync error: ${syncError}` : 'Google Drive Sync'" aria-label="Google Drive Sync">
									<span v-if="isSyncing" class="spinner-border spinner-border-sm" role="status"></span>
									<span v-else-if="syncError" class="sync-icon text-warning">&#9888;</span>
									<span v-else-if="lastSyncedAt" class="sync-icon text-success">&#10003;</span>
									<span v-else class="sync-icon">&#9729;</span>
									<span class="d-none d-md-inline">{{ user?.name ?? "Sync" }}</span>
								</button>
								<div v-if="showSyncMenu" class="dropdown-menu show sync-dropdown">
									<div class="dropdown-header text-muted small px-3 py-1 text-truncate">{{ user?.email }}</div>
									<div class="dropdown-divider"></div>
									<label class="dropdown-item sync-dropdown-item d-flex align-items-center gap-2 mb-0">
										<input type="checkbox" :checked="autoSyncEnabled" class="form-check-input m-0" @change="handleToggleAutoSync"/>
										<span>Auto-sync</span>
									</label>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item" @click="handleSave" :disabled="isSyncing">
										<i class="bi bi-cloud-upload me-2" aria-hidden="true"></i>
										Save to Drive
									</button>
									<button class="dropdown-item sync-dropdown-item" @click="handleLoad" :disabled="isSyncing">
										<i class="bi bi-cloud-download me-2" aria-hidden="true"></i>
										Load from Drive
									</button>
									<div v-if="lastSyncedLabel" class="dropdown-header text-muted small px-3 py-1">Last synced: {{ lastSyncedLabel }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item text-danger" @click="handleSignOut">
										<i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>
										Sign out
									</button>
								</div>
							</div>
							<div v-if="showSyncMenu" class="sync-backdrop" @click="closeSyncMenu"></div>
						</template>
						<button v-else class="btn btn-outline-primary btn-sm" @click="signIn" aria-label="Sign in with Google">
							<i class="bi bi-google" aria-hidden="true"></i>
							<span class="d-none d-sm-inline ms-1">Sign in with Google</span>
							<span class="d-sm-none ms-1">Sign in</span>
						</button>
					</template>
					<template v-else>
						<button v-if="authTimedOut" class="btn btn-outline-secondary btn-sm" disabled title="Google Sign-In library could not be loaded">
							<i class="bi bi-cloud-slash" aria-hidden="true"></i>
							<span class="d-none d-sm-inline ms-1">Sign-in unavailable</span>
						</button>
						<button v-else class="btn btn-outline-secondary btn-sm" disabled aria-label="Initialising Google Sign-In">
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
		top: calc(100% + 0.25rem);
		right: 0;
		min-width: 240px;
		max-width: calc(100vw - 1rem);
		z-index: 1050;
	}
	.sync-dropdown-item {
		min-height: 44px;
		display: flex;
		align-items: center;
		white-space: normal;
	}
	.sync-dropdown-item:disabled {
		opacity: 0.6;
	}
	.sync-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1040;
		background: transparent;
	}
	@media (max-width: 575.98px) {
		.sync-dropdown {
			position: fixed !important;
			left: 0.5rem;
			right: 0.5rem;
			top: auto;
			bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
			min-width: auto;
			max-width: none;
			border-radius: 0.75rem;
			box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
		}
	}
</style>