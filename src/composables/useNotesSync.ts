import { ref, readonly, computed, watch } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import { getKV, setKV } from "@/storage/db";
import { AUTO_SYNC_KEY, debounce, DEBOUNCE_MS, emptyString, LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY, LEGACY_SYNC_FILENAME } from "@/library";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

const isSyncing = ref(false);
const lastSyncedToLocalAt = ref<Date | null>(null);
const lastSyncedToCloudAt = ref<Date | null>(null);
const autoSyncEnabled = ref<boolean>(true);
const lastSyncMessage = ref<{
	text: string;
	type: "success" | "error";
	timeStamp: number;
} | null>(null);
const syncError = ref<string | null>(null);
const pendingPurges = new Set<UUID>();

export async function hydrateSyncMetadata(): Promise<void> {
	const storedLocal = await getKV<string>(LAST_SYNCED_TO_LOCAL_KEY);
	const storedCloud = await getKV<string>(LAST_SYNCED_TO_CLOUD_KEY);
	const storedAutoSync = await getKV<boolean>(AUTO_SYNC_KEY);
	lastSyncedToLocalAt.value = storedLocal ? new Date(storedLocal) : null;
	lastSyncedToCloudAt.value = storedCloud ? new Date(storedCloud) : null;
	autoSyncEnabled.value = storedAutoSync === undefined ? true : storedAutoSync;
	watch(autoSyncEnabled, async flag => {
		await setKV(AUTO_SYNC_KEY, flag);
	});
	watch(lastSyncedToLocalAt, async date => {
		await setKV(LAST_SYNCED_TO_LOCAL_KEY, date?.toISOString());
	});
	watch(lastSyncedToCloudAt, async date => {
		await setKV(LAST_SYNCED_TO_CLOUD_KEY, date?.toISOString());
	});
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

	async function readRemoteNotes(force = false): Promise<NoteModel[]> {
		const files = await listFiles(store.fileNamePrefix, force ? null : lastSyncedToLocalAt.value);
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

	async function runPull(force = false) {
		const syncStartedAt = new Date();
		const remoteNotes = await readRemoteNotes(force);
		const changes = mergeNotesByModifiedAt(store.notes, remoteNotes);
		if (changes.length > 0) {
			await store.replaceMultiple(changes);
		}
		await purgeRemoteFiles(await store.purgeExpiredTrash());
		lastSyncedToLocalAt.value = syncStartedAt;
		return {
			remoteCount: remoteNotes.length,
			downloaded: changes.length
		};
	}

	async function runPush(purged: ReadonlyArray<UUID> = [], force = false) {
		const syncStartedAt = new Date();
		await purgeRemoteFiles(purged);
		const candidates = force ? store.notes : store.notes.filter(n => noteEffectiveTime(n) > (lastSyncedToCloudAt.value?.getTime() ?? 0));
		const results = await Promise.all(candidates.map(uploadNote));
		if (lastSyncedToLocalAt.value) {
			await deleteFromLegacy();
		}
		lastSyncedToCloudAt.value = syncStartedAt;
		return {
			conflicts: results.filter(r => r === "conflict").length
		};
	}

	async function doPullAndPush({ force = false as boolean, purged = [] as ReadonlyArray<UUID> } = {}) {
		if (isSyncing.value) {
			return;
		}
		isSyncing.value = true;
		syncError.value = null;
		try {
			const pullResult = await runPull(force);
			const pushResult = await runPush(purged, force);
			const empty = pullResult.remoteCount === 0 && store.notes.length === 0;
			const changes = pushResult.conflicts + pullResult.downloaded;
			lastSyncMessage.value = {
				text: empty ? "Nothing to sync" : `Notes synced${changes > 0 ? ` with ${changes} changes${changes > 1 ? "s" : emptyString} fetched from remote` : emptyString}`,
				type: "success",
				timeStamp: Date.now()
			};
		} catch (e: any) {
			syncError.value = e?.message ?? "Sync failed";
			lastSyncMessage.value = { text: `Sync failed: ${syncError.value}`, type: "error", timeStamp: Date.now() };
		} finally {
			isSyncing.value = false;
		}
	}

	async function purgeRemoteFiles(fileIdsToPurge: ReadonlyArray<UUID>) {
		fileIdsToPurge.forEach(Set.prototype.add, pendingPurges);
		if (pendingPurges.size > 0) {
			const purgeSnapshot = Array.from(pendingPurges);
			await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
			purgeSnapshot.forEach(Set.prototype.delete, pendingPurges);
		}
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
				if (remoteEffectiveTime > localEffectiveTime) {
					await store.replaceNote(remoteNote);
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
		try {
			await runPush(purged, false);
			return true;
		} catch (e: any) {
			return false;
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
				purged.forEach(Set.prototype.add, pendingPurges);
			}
			debouncedFlush();
		},
		{
			cancel() {
				debouncedFlush.cancel();
			}
		}
	);

	async function setAutoSync(enabled: boolean) {
		autoSyncEnabled.value = enabled;
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
		doPullAndPush,
		requestSync,
		setAutoSync,
		dismissMessage
	};
}