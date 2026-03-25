import { ref, readonly, watch } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import type { NoteJSON } from "@/models/NoteModel";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let watcherStop: (() => void) | null = null;
const SYNC_FILENAME = "quick-pad-notes.json";
const LAST_SYNCED_KEY = "quick-pad-last-synced";
const AUTO_SYNC_KEY = "quick-pad-auto-sync";
const DEBOUNCE_MS = 3000;
const isSyncing = ref(false);
const lastSyncedAt = ref<Date | null>(loadLastSynced());
const syncError = ref<string | null>(null);
const autoSyncEnabled = ref<boolean>(loadAutoSync());
const lastSyncMessage = ref<{ text: string; type: "success" | "error" } | null>(null);

function loadLastSynced(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_KEY);
	return raw ? new Date(raw) : null;
}

function loadAutoSync(): boolean {
	const raw = localStorage.getItem(AUTO_SYNC_KEY);
	return raw === null ? true : raw === "true";
}

function persistAutoSync(val: boolean) {
	localStorage.setItem(AUTO_SYNC_KEY, String(val));
}

function persistLastSynced(date: Date) {
	localStorage.setItem(LAST_SYNCED_KEY, date.toISOString());
}

export function useNotesSync() {
	const { readJSON, writeJSON } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();

	async function saveToCloud(): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		syncError.value = null;
		try {
			await writeJSON(
				SYNC_FILENAME,
				store.notes.map(n => n.toJSON())
			);
			const now = new Date();
			lastSyncedAt.value = now;
			persistLastSynced(now);
			lastSyncMessage.value = { text: "Notes saved to Drive", type: "success" };
		} catch (e: any) {
			syncError.value = e?.message ?? "Failed to save";
			lastSyncMessage.value = { text: `Sync failed: ${syncError.value}`, type: "error" };
		} finally {
			isSyncing.value = false;
		}
	}

	async function loadFromCloud(): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		syncError.value = null;
		try {
			const data = await readJSON<NoteJSON[]>(SYNC_FILENAME);
			if (data && Array.isArray(data)) {
				store.replaceAllNotes(data.map(NoteModel.fromJSON));
				const now = new Date();
				lastSyncedAt.value = now;
				persistLastSynced(now);
				lastSyncMessage.value = { text: "Notes loaded from Drive", type: "success" };
			} else {
				lastSyncMessage.value = { text: "No notes found on Drive", type: "success" };
			}
		} catch (e: any) {
			syncError.value = e?.message ?? "Failed to load";
			lastSyncMessage.value = { text: `Sync failed: ${syncError.value}`, type: "error" };
		} finally {
			isSyncing.value = false;
		}
	}

	function setAutoSync(enabled: boolean) {
		autoSyncEnabled.value = enabled;
		persistAutoSync(enabled);
		if (enabled && isSignedIn.value) {
			startAutoSync();
		} else {
			stopAutoSync();
		}
	}

	function startAutoSync() {
		if (watcherStop) {
			return;
		}
		const store = useNotesStore();
		watcherStop = watch(
			() => store.notes,
			() => {
				if (!isSignedIn.value || !autoSyncEnabled.value) {
					return;
				}
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					saveToCloud();
				}, DEBOUNCE_MS);
			},
			{ deep: true }
		);
	}

	function stopAutoSync() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (watcherStop) {
			watcherStop();
			watcherStop = null;
		}
	}

	function dismissMessage() {
		lastSyncMessage.value = null;
	}

	watch(
		isSignedIn,
		signedIn => {
			if (signedIn && autoSyncEnabled.value) {
				startAutoSync();
			} else {
				stopAutoSync();
			}
		},
		{ immediate: true }
	);

	return {
		isSyncing: readonly(isSyncing),
		lastSyncedAt: readonly(lastSyncedAt),
		syncError: readonly(syncError),
		autoSyncEnabled: readonly(autoSyncEnabled),
		lastSyncMessage: readonly(lastSyncMessage),
		saveToCloud,
		loadFromCloud,
		setAutoSync,
		dismissMessage
	};
}