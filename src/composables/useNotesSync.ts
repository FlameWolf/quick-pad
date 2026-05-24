import { ref, readonly, computed } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import { debounce, emptyString } from "@/library";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

const LEGACY_SYNC_FILENAME = "quick-pad-notes.json";
const LAST_SYNCED_TO_LOCAL_KEY = "quick-pad-last-synced-to-local";
const LAST_SYNCED_TO_CLOUD_KEY = "quick-pad-last-synced-to-cloud";
const AUTO_SYNC_KEY = "quick-pad-auto-sync";
const PENDING_PURGES_KEY = "quick-pad-pending-purges";
const DEBOUNCE_MS = 3000;
const isSyncing = ref(false);
const lastSyncedToLocalAt = ref<Date | null>(loadLastSyncedToLocal());
const lastSyncedToCloudAt = ref<Date | null>(loadLastSyncedToCloud());
const autoSyncEnabled = ref<boolean>(loadAutoSync());
const lastSyncMessage = ref<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);
const syncError = ref<string | null>(null);
const pendingPurges = loadPendingPurges();

function loadLastSyncedToLocal(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_TO_LOCAL_KEY);
	return raw ? new Date(raw) : null;
}

function loadLastSyncedToCloud(): Date | null {
	const raw = localStorage.getItem(LAST_SYNCED_TO_CLOUD_KEY);
	return raw ? new Date(raw) : null;
}

function loadAutoSync(): boolean {
	const raw = localStorage.getItem(AUTO_SYNC_KEY);
	return raw === null ? true : raw === "true";
}

function persistAutoSync(val: boolean) {
	localStorage.setItem(AUTO_SYNC_KEY, String(val));
}

function persistLastSyncedToLocal(date: Date) {
	localStorage.setItem(LAST_SYNCED_TO_LOCAL_KEY, date.toISOString());
}

function persistLastSyncedToCloud(date: Date) {
	localStorage.setItem(LAST_SYNCED_TO_CLOUD_KEY, date.toISOString());
}

function loadPendingPurges(): Set<UUID> {
	try {
		const raw = localStorage.getItem(PENDING_PURGES_KEY);
		const ids: UUID[] = raw ? JSON.parse(raw) : [];
		return new Set(ids);
	} catch {
		return new Set();
	}
}

function persistPendingPurges(set: Set<UUID>) {
	if (set.size === 0) {
		localStorage.removeItem(PENDING_PURGES_KEY);
		return;
	}
	localStorage.setItem(PENDING_PURGES_KEY, JSON.stringify(Array.from(set)));
}

function noteEffectiveTime(note: NoteModel): number {
	return Math.max(note.createdAt.getTime(), note.modifiedAt?.getTime() ?? 0, note.archivedAt?.getTime() ?? 0, note.deletedAt?.getTime() ?? 0, note.purgedAt?.getTime() ?? 0, note.stateChangedAt?.getTime() ?? 0);
}

export function mergeNotesByModifiedAt(local: ReadonlyArray<NoteModel>, remote: ReadonlyArray<NoteModel>): NoteModel[] {
	const localMap = new Map<string, NoteModel>(local.map(note => [note.id, note]));
	const changes: NoteModel[] = [];
	for (const remoteNote of remote) {
		const localNote = localMap.get(remoteNote.id);
		if (!localNote || noteEffectiveTime(remoteNote) > noteEffectiveTime(localNote)) {
			changes.push(remoteNote);
		}
	}
	return changes;
}

export function useNotesSync() {
	const store = useNotesStore();
	const { listFiles, findFile, readJSON, readJSONById, writeJSONById, writeJSON, deleteFile } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();
	const getFileName = (id: UUID) => `${store.fileNamePrefix}${id}.json`;

	async function migrateFromLegacy(): Promise<NoteModel[]> {
		try {
			const data = await readJSON<NoteJSON[]>(LEGACY_SYNC_FILENAME);
			if (data && Array.isArray(data)) {
				return data.map(NoteModel.fromJSON);
			}
		} catch {
			void 0;
		}
		return [];
	}

	async function deleteFromLegacy() {
		try {
			await deleteFile(LEGACY_SYNC_FILENAME);
		} catch {
			void 0;
		}
	}

	async function readRemoteNotes(): Promise<NoteModel[]> {
		const files = await listFiles(store.fileNamePrefix);
		const notes: NoteModel[] = [];
		await Promise.all(
			files.map(async file => {
				try {
					const data = await readJSONById<NoteJSON>(file.id);
					if (data) {
						notes.push(NoteModel.fromJSON(data));
					}
				} catch (err) {
					console.warn(`Failed to read note file ${file.name}:`, err);
				}
			})
		);
		return notes.concat(await migrateFromLegacy());
	}

	async function uploadNote(note: NoteModel): Promise<"uploaded" | "conflict"> {
		const fileName = getFileName(note.id);
		const remoteFile = await findFile(fileName);
		if (remoteFile) {
			const remoteJSON = await readJSONById<NoteJSON>(remoteFile.id);
			if (remoteJSON) {
				const remoteNote = NoteModel.fromJSON(remoteJSON);
				const remoteEffectiveTime = noteEffectiveTime(remoteNote);
				const localEffectiveTime = noteEffectiveTime(note);
				if (localEffectiveTime > remoteEffectiveTime) {
					await writeJSONById(remoteFile.id, note.toJSON());
					return "uploaded";
				}
				if (remoteEffectiveTime > remoteEffectiveTime) {
					store.replaceNote(remoteNote);
					return "conflict";
				}
			}
		} else {
			await writeJSON(fileName, note.toJSON());
		}
		return "uploaded";
	}

	async function saveToCloud(purged: ReadonlyArray<UUID> = []): Promise<boolean> {
		if (isSyncing.value) {
			return false;
		}
		isSyncing.value = true;
		syncError.value = null;
		let conflictCount = 0;
		if (purged.length > 0) {
			for (const id of purged) {
				pendingPurges.add(id);
			}
			persistPendingPurges(pendingPurges);
		}
		const purgeSnapshot = Array.from(pendingPurges);
		try {
			const syncStartedAt = new Date();
			await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
			purgeSnapshot.forEach(id => pendingPurges.delete(id));
			persistPendingPurges(pendingPurges);
			const dirtyNotes = store.notes.filter(note => noteEffectiveTime(note) > (lastSyncedToCloudAt.value?.getTime() ?? 0));
			const uploadResults = await Promise.all(dirtyNotes.map(uploadNote));
			conflictCount = uploadResults.filter(result => result === "conflict").length;
			if (lastSyncedToLocalAt.value) {
				await deleteFromLegacy();
			}
			lastSyncedToCloudAt.value = syncStartedAt;
			persistLastSyncedToCloud(syncStartedAt);
			lastSyncMessage.value = {
				text: `Notes saved to Drive${conflictCount > 0 ? ` with ${conflictCount} conflict${conflictCount > 1 ? "s" : emptyString} resolved` : emptyString}`,
				type: "success",
				timeStamp: Date.now()
			};
			return true;
		} catch (e: any) {
			syncError.value = e?.message ?? "Failed to save";
			lastSyncMessage.value = {
				text: `Sync failed: ${syncError.value}`,
				type: "error",
				timeStamp: Date.now()
			};
			return false;
		} finally {
			isSyncing.value = false;
		}
	}

	async function loadFromCloud(): Promise<void> {
		if (isSyncing.value) {
			return;
		}
		isSyncing.value = true;
		syncError.value = null;
		try {
			const syncStartedAt = new Date();
			const remoteNotes = await readRemoteNotes();
			if (remoteNotes.length === 0 && store.notes.length === 0) {
				lastSyncMessage.value = {
					text: "No notes found on Drive",
					type: "success",
					timeStamp: Date.now()
				};
				return;
			}
			const changes = mergeNotesByModifiedAt(store.notes, remoteNotes);
			if (changes.length > 0) {
				store.replaceMultiple(changes);
			}
			const expiredIds = store.purgeExpiredTrash();
			if (expiredIds.length > 0) {
				for (const id of expiredIds) {
					pendingPurges.add(id);
				}
				persistPendingPurges(pendingPurges);
				await Promise.all(expiredIds.map(getFileName).map(deleteFile));
				expiredIds.forEach(id => pendingPurges.delete(id));
				persistPendingPurges(pendingPurges);
			}
			lastSyncedToLocalAt.value = syncStartedAt;
			persistLastSyncedToLocal(syncStartedAt);
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

	const debouncedFlush = debounce(() => {
		if (isSignedIn.value && autoSyncEnabled.value) {
			saveToCloud();
		}
	}, DEBOUNCE_MS);

	const requestSync = Object.assign(
		function (purged: ReadonlyArray<UUID> = []) {
			if (purged.length > 0) {
				for (const id of purged) {
					pendingPurges.add(id);
				}
				persistPendingPurges(pendingPurges);
			}
			debouncedFlush();
		},
		{
			cancel() {
				debouncedFlush.cancel();
			}
		}
	);

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
		lastSyncedAt: computed(() => {
			const max = Math.max(lastSyncedToLocalAt.value?.getTime() ?? 0, lastSyncedToCloudAt.value?.getTime() ?? 0);
			return max > 0 ? new Date(max) : null;
		}),
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