import { ref, readonly } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import { debounce } from "@/library";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

const SYNC_FILENAME = "quick-pad-notes.json";
const LAST_SYNCED_KEY = "quick-pad-last-synced";
const AUTO_SYNC_KEY = "quick-pad-auto-sync";
const DEBOUNCE_MS = 5000;
const isSyncing = ref(false);
const lastSyncedAt = ref<Date | null>(loadLastSynced());
const syncError = ref<string | null>(null);
const autoSyncEnabled = ref<boolean>(loadAutoSync());
const lastSyncMessage = ref<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);

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

function noteEffectiveTime(note: NoteModel): number {
	return (note.modifiedAt ?? note.createdAt).getTime();
}

export function mergeNotesByModifiedAt(local: ReadonlyArray<NoteModel>, remote: ReadonlyArray<NoteModel>): NoteModel[] {
	const merged = new Map<string, NoteModel>();
	for (const note of local) {
		merged.set(note.id, note);
	}
	for (const remoteNote of remote) {
		const localNote = merged.get(remoteNote.id);
		if (!localNote || noteEffectiveTime(remoteNote) > noteEffectiveTime(localNote)) {
			remoteNote.updatedInRemote = true;
			merged.set(remoteNote.id, remoteNote);
		}
		if (localNote && noteEffectiveTime(localNote) > noteEffectiveTime(remoteNote)) {
			localNote.updatedInLocal = true;
		}
	}
	return Array.from(merged.values());
}

export function useNotesSync() {
	const { readJSON, writeJSON } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();

	async function readRemoteNotes(): Promise<NoteModel[]> {
		const data = await readJSON<NoteJSON[]>(SYNC_FILENAME);
		if (data && Array.isArray(data)) {
			return data.map(NoteModel.fromJSON);
		}
		return [];
	}

	async function saveToCloud(purged: Array<UUID> | undefined = undefined): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		syncError.value = null;
		try {
			const remoteNotes = (await readRemoteNotes()).filter(note => !purged?.includes(note.id));
			const merged = mergeNotesByModifiedAt(store.notes, remoteNotes);
			store.replaceMultple(merged.filter(note => note.updatedInRemote));
			store.purgeExpiredTrash();
			await writeJSON(
				SYNC_FILENAME,
				store.notes.map(n => n.toJSON())
			);
			const now = new Date();
			lastSyncedAt.value = now;
			persistLastSynced(now);
			lastSyncMessage.value = {
				text: "Notes saved to Drive",
				type: "success",
				timeStamp: Date.now()
			};
		} catch (e: any) {
			syncError.value = e?.message ?? "Failed to save";
			lastSyncMessage.value = {
				text: `Sync failed: ${syncError.value}`,
				type: "error",
				timeStamp: Date.now()
			};
		} finally {
			isSyncing.value = false;
		}
	}

	async function loadFromCloud(): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		syncError.value = null;
		try {
			const remoteNotes = await readRemoteNotes();
			if (remoteNotes.length === 0 && store.notes.length === 0) {
				lastSyncMessage.value = {
					text: "No notes found on Drive",
					type: "success",
					timeStamp: Date.now()
				};
				return;
			}
			const merged = mergeNotesByModifiedAt(store.notes, remoteNotes);
			store.replaceMultple(merged.filter(note => note.updatedInRemote));
			store.purgeExpiredTrash();
			const now = new Date();
			lastSyncedAt.value = now;
			persistLastSynced(now);
			lastSyncMessage.value = {
				text: remoteNotes.length === 0 ? "No notes found on Drive" : "Notes loaded from Drive",
				type: "success",
				timeStamp: Date.now()
			};
		} catch (e: any) {
			syncError.value = e?.message ?? "Failed to load";
			lastSyncMessage.value = {
				text: `Sync failed: ${syncError.value}`,
				type: "error",
				timeStamp: Date.now()
			};
		} finally {
			isSyncing.value = false;
		}
	}

	const requestSync = debounce((purged: Array<UUID> | undefined = undefined) => {
		if (isSignedIn.value && autoSyncEnabled.value) {
			saveToCloud(purged);
		}
	}, DEBOUNCE_MS);

	function setAutoSync(enabled: boolean) {
		autoSyncEnabled.value = enabled;
		persistAutoSync(enabled);
		if (!enabled) {
			requestSync.cancel();
		}
	}

	function dismissMessage() {
		lastSyncMessage.value = null;
	}

	return {
		isSyncing: readonly(isSyncing),
		lastSyncedAt: readonly(lastSyncedAt),
		syncError: readonly(syncError),
		autoSyncEnabled: readonly(autoSyncEnabled),
		lastSyncMessage: readonly(lastSyncMessage),
		saveToCloud,
		loadFromCloud,
		requestSync,
		setAutoSync,
		dismissMessage
	};
}