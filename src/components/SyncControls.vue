<script setup lang="ts">
	import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
	import { hydrateAuthState, useGoogleAuth } from "@/composables/useGoogleAuth";
	import { hydrateSyncMetadata, useNotesSync } from "@/composables/useNotesSync";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import Icon from "@/components/Icon.vue";

	let readyTimeout: ReturnType<typeof setTimeout> | null = null;
	const { isSignedIn, isReady, isConfigured, user, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { isSyncing, lastSyncedAt, syncError, autoSyncEnabled, doPullAndPush, setAutoSync } = useNotesSync();
	const { confirm } = useConfirmDialog();
	const showSyncMenu = ref(false);
	const authTimedOut = ref(false);

	function toggleSyncMenu() {
		showSyncMenu.value = !showSyncMenu.value;
	}

	function closeSyncMenu() {
		showSyncMenu.value = false;
	}

	async function handleSync(force = false) {
		closeSyncMenu();
		if (!force) {
			await doPullAndPush();
			return;
		}
		const ok = await confirm({
			title: "Force Sync",
			message: "This will pull and push all notes from cloud and local. It might take more time and use more data than a normal sync. Are you sure you want to continue?",
			confirmText: "Yes",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (ok) {
			await doPullAndPush({ force: true });
		}
	}

	async function handleSignOut() {
		closeSyncMenu();
		await signOut();
	}

	async function handleToggleAutoSync() {
		await setAutoSync(!autoSyncEnabled.value);
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
				await doPullAndPush();
			}
		},
		{ immediate: true }
	);

	onMounted(async () => {
		if (isConfigured.value) {
			readyTimeout = setTimeout(() => {
				if (!isReady.value) {
					authTimedOut.value = true;
				}
			}, 6000);
		}
		await hydrateAuthState();
		await hydrateSyncMetadata();
		tryRestoreSession();
	});

	onBeforeUnmount(() => {
		if (readyTimeout) {
			clearTimeout(readyTimeout);
		}
	});
</script>
<template>
	<template v-if="isConfigured">
		<template v-if="isReady">
			<template v-if="isSignedIn">
				<div class="position-relative">
					<button class="d-flex flex-nowrap btn btn-outline-secondary btn-sm" @click="toggleSyncMenu" :disabled="isSyncing" :title="syncError ? `Sync error: ${syncError}` : `Google Drive Sync`" aria-label="Google Drive Sync">
						<span v-if="isSyncing">
							<div class="spinner-border spinner-border-sm" role="status"></div>
						</span>
						<span v-else-if="syncError" class="text-warning">
							<Icon type="exclamationTriangle"/>
						</span>
						<span v-else-if="lastSyncedAt" class="text-success">
							<Icon type="check2"/>
						</span>
						<span v-else>
							<Icon type="cloud"/>
						</span>
						<span class="d-none d-md-inline ms-2">{{ user?.name ?? "Sync" }}</span>
					</button>
					<div v-if="showSyncMenu" class="dropdown-menu show sync-dropdown">
						<div class="dropdown-header text-muted small px-3 py-1 text-truncate">{{ user?.email }}</div>
						<div class="dropdown-divider"></div>
						<label class="dropdown-item sync-dropdown-item d-flex align-items-center gap-2 mb-0">
							<input type="checkbox" :checked="autoSyncEnabled" class="form-check-input m-0" @change="handleToggleAutoSync"/>
							<span>Auto-sync</span>
						</label>
						<div class="dropdown-divider"></div>
						<button class="dropdown-item sync-dropdown-item" @click="handleSync(false)" :disabled="isSyncing">
							<Icon type="arrowRepeat"/>
							<span class="ms-2">Sync</span>
						</button>
						<button class="dropdown-item sync-dropdown-item" @click="handleSync(true)" :disabled="isSyncing">
							<Icon type="lightningCharge"/>
							<span class="ms-2">Force Sync</span>
						</button>
						<div v-if="lastSyncedLabel" class="dropdown-header text-muted small px-3 py-1">Last synced: {{ lastSyncedLabel }}</div>
						<div class="dropdown-divider"></div>
						<button class="dropdown-item sync-dropdown-item text-danger" @click="handleSignOut">
							<Icon type="boxArrowRight"/>
							<span class="ms-2">Sign out</span>
						</button>
					</div>
				</div>
				<div v-if="showSyncMenu" class="sync-backdrop" @click="closeSyncMenu"></div>
			</template>
			<template v-else>
				<button class="btn btn-outline-primary btn-sm" @click="signIn" aria-label="Sign in with Google">
					<Icon type="google"/>
				</button>
			</template>
		</template>
		<template v-else>
			<button v-if="authTimedOut" class="btn btn-outline-secondary btn-sm" disabled title="Google Sign-In library could not be loaded" aria-label="Sign-in unavailable">
				<Icon type="cloudSlash"/>
				<span class="d-none d-sm-inline ms-2">Sign-in unavailable</span>
			</button>
			<button v-else class="btn btn-outline-secondary btn-sm" disabled aria-label="Initialising Google Sign-In">
				<span class="spinner-border spinner-border-sm" role="status"></span>
			</button>
		</template>
	</template>
</template>