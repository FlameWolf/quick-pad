<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import "bootstrap-icons/font/bootstrap-icons.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterView } from "vue-router";
	import { computed, onMounted, onBeforeUnmount, ref, watch, useTemplateRef } from "vue";
	import { useTheme } from "@/composables/useTheme";
	import { useGoogleAuth } from "@/composables/useGoogleAuth";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { useNotesStore } from "@/stores/notes";
	import { listViewRoutes } from "@/router";
	import { debounce, emptyString } from "@/library";
	import Toast from "@/components/Toast.vue";
	import ConfirmDialog from "@/components/ConfirmDialog.vue";

	let readyTimeout: ReturnType<typeof setTimeout> | null = null;
	const { isDark, applyTheme } = useTheme();
	const { isSignedIn, isReady, isConfigured, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { isSyncing, lastSyncedAt, syncError, autoSyncEnabled, lastSyncMessage, saveToCloud, loadFromCloud, setAutoSync, dismissMessage, requestSync } = useNotesSync();
	const notesStore = useNotesStore();
	const searchInput = useTemplateRef("search-input");
	const showSyncMenu = ref(false);
	const authTimedOut = ref(false);
	const isSearchMode = computed(() => !!notesStore.searchText);

	function toggleTheme() {
		isDark.value = !isDark.value;
		applyTheme(isDark.value);
	}

	const debouncedSearch = debounce(() => {
		notesStore.searchText = searchInput.value?.value?.trim() ?? emptyString;
	}, 300);

	function clearSearch() {
		debouncedSearch.cancel();
		notesStore.searchText = emptyString;
		searchInput.value!.value = emptyString;
	}

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

	function scrollToPosition(position: "top" | "bottom") {
		const element = document.documentElement;
		if (position === "top") {
			element.scrollTo({ top: 0, behavior: "smooth" });
		} else if (position === "bottom") {
			element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
		}
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

	watch(
		isSignedIn,
		async signedIn => {
			if (signedIn && autoSyncEnabled.value) {
				await loadFromCloud();
				await saveToCloud();
			}
		},
		{ immediate: true }
	);

	onMounted(() => {
		const purgedIds = notesStore.purgeExpiredTrash();
		if (purgedIds.length > 0) {
			requestSync(purgedIds);
		}
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
		<nav class="navbar navbar-expand bg-body-tertiary border-bottom px-2 mb-4">
			<div class="container gap-2">
				<RouterLink to="/notes" class="navbar-brand">
					<img class="logo" src="/logo.svg" alt="QuickPad Logo"/>
				</RouterLink>
				<div class="me-auto position-relative">
					<input type="text" class="form-control pe-5" placeholder="Search" ref="search-input" :disabled="!listViewRoutes.includes($route.path)" @input="debouncedSearch"/>
					<button v-if="isSearchMode" class="btn-close small position-absolute top-50 end-0 translate-middle-y me-2" @click="clearSearch"></button>
				</div>
				<div class="d-flex align-items-center gap-2">
					<template v-if="!isConfigured">
						<!-- Sync not configured — keep UI quiet so the app works in local-only mode -->
					</template>
					<template v-else-if="isReady">
						<template v-if="isSignedIn">
							<div class="position-relative">
								<button class="d-flex flex-nowrap btn btn-outline-secondary btn-sm" @click="toggleSyncMenu" :disabled="isSyncing" :title="syncError ? `Sync error: ${syncError}` : 'Google Drive Sync'" aria-label="Google Drive Sync">
									<span v-if="isSyncing">
										<i class="spinner-border spinner-border-sm" role="status"></i>
									</span>
									<span v-else-if="syncError" class="text-warning">
										<i class="bi bi-exclamation-triangle"></i>
									</span>
									<span v-else-if="lastSyncedAt" class="text-success">
										<i class="bi bi-check2"></i>
									</span>
									<span v-else>
										<i class="bi bi-cloud"></i>
									</span>
									<span class="d-none d-md-inline">
										<span>&#xA0;</span>
										<span>{{ user?.name ?? "Sync" }}</span>
									</span>
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
										<span>Save to Drive</span>
									</button>
									<button class="dropdown-item sync-dropdown-item" @click="handleLoad" :disabled="isSyncing">
										<i class="bi bi-cloud-download me-2" aria-hidden="true"></i>
										<span>Load from Drive</span>
									</button>
									<div v-if="lastSyncedLabel" class="dropdown-header text-muted small px-3 py-1">Last synced: {{ lastSyncedLabel }}</div>
									<div class="dropdown-divider"></div>
									<button class="dropdown-item sync-dropdown-item text-danger" @click="handleSignOut">
										<i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>
										<span>Sign out</span>
									</button>
								</div>
							</div>
							<div v-if="showSyncMenu" class="sync-backdrop" @click="closeSyncMenu"></div>
						</template>
						<template v-else>
							<button class="btn btn-outline-primary btn-sm" @click="signIn" aria-label="Sign in with Google">
								<i class="bi bi-google" aria-hidden="true"></i>
							</button>
						</template>
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
					<button class="btn btn-secondary btn-sm">
						<i class="bi" :class="{ 'bi-moon-stars-fill': isDark, 'bi-sun-fill': !isDark }" @click="toggleTheme"></i>
					</button>
				</div>
			</div>
		</nav>
		<main class="container px-2 pb-4">
			<RouterView/>
			<div class="d-flex flex-column gap-1 position-fixed bottom-0 end-0 opacity-75 mb-2 me-2">
				<button class="btn btn-secondary btn-sm" @click="scrollToPosition(`top`)">
					<i class="bi bi-chevron-up"></i>
				</button>
				<button class="btn btn-secondary btn-sm" @click="scrollToPosition('bottom')">
					<i class="bi bi-chevron-down"></i>
				</button>
			</div>
		</main>
		<Toast v-if="lastSyncMessage" :message="lastSyncMessage.text" :type="lastSyncMessage.type" :visible="!!lastSyncMessage" :timeStamp="lastSyncMessage.timeStamp" @dismiss="dismissMessage"/>
		<ConfirmDialog/>
	</BApp>
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
	.sync-dropdown {
		position: absolute;
		top: calc(100% + 0.25rem);
		right: 0;
	}
	.sync-dropdown-item {
		min-height: 2.5rem;
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
		background: transparent;
	}
</style>