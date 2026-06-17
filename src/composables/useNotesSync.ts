import { ref, readonly, computed, watch } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useGoogleAuth } from "./useGoogleAuth";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { getTime } from "@/utils/dates";
import { debounce } from "@/utils/timing";
import { emptyString } from "@/constants/common";
import { AUTO_SYNC_KEY, DEBOUNCE_MS, LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY } from "@/constants/sync";
import type { NoteJSON } from "@/models/NoteModel";
import type { UUID } from "crypto";

enum NoteUploadResult {
	Uploaded = "uploaded",
	Conflict = "conflict"
}

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
	const storedLocal = await getKV(LAST_SYNCED_TO_LOCAL_KEY);
	const storedCloud = await getKV(LAST_SYNCED_TO_CLOUD_KEY);
	const storedAutoSync = await getKV(AUTO_SYNC_KEY);
	lastSyncedToLocalAt.value = storedLocal ? new Date(storedLocal) : null;
	lastSyncedToCloudAt.value = storedCloud ? new Date(storedCloud) : null;
	autoSyncEnabled.value = storedAutoSync === undefined ? true : storedAutoSync;
	watch(autoSyncEnabled, async flag => {
		await setKV(AUTO_SYNC_KEY, flag);
	});
	watch(lastSyncedToLocalAt, async date => {
		if (date) {
			await setKV(LAST_SYNCED_TO_LOCAL_KEY, date.toISOString());
		} else {
			await deleteKV(LAST_SYNCED_TO_LOCAL_KEY);
		}
	});
	watch(lastSyncedToCloudAt, async date => {
		if (date) {
			await setKV(LAST_SYNCED_TO_CLOUD_KEY, date.toISOString());
		} else {
			await deleteKV(LAST_SYNCED_TO_CLOUD_KEY);
		}
	});
}

function noteEffectiveTime(note: NoteModel): number {
	return Math.max(note.createdAt.getTime(), getTime(note.modifiedAt), getTime(note.favedAt), getTime(note.pinnedAt), getTime(note.archivedAt), getTime(note.deletedAt), getTime(note.stateChangedAt));
}

function modifiedAtRemote(remote: NoteModel, local: NoteModel): boolean {
	const remoteEffectiveTime = noteEffectiveTime(remote);
	const localEffectiveTime = noteEffectiveTime(local);
	if (remoteEffectiveTime > localEffectiveTime) {
		return true;
	}
	if (remoteEffectiveTime === localEffectiveTime) {
		return remote.createdAt.getTime() !== local.createdAt.getTime() || getTime(remote.modifiedAt) !== getTime(local.modifiedAt) || getTime(remote.favedAt) !== getTime(local.favedAt) || getTime(remote.pinnedAt) !== getTime(local.pinnedAt) || getTime(remote.archivedAt) !== getTime(local.archivedAt) || getTime(remote.deletedAt) !== getTime(local.deletedAt) || getTime(remote.stateChangedAt) !== getTime(local.stateChangedAt);
	}
	return false;
}

export function mergeNotesByModifiedAt(local: ReadonlyArray<NoteModel>, remote: ReadonlyArray<NoteModel>): NoteModel[] {
	const localMap = new Map<string, NoteModel>(local.map(note => [note.id, note]));
	const changes: NoteModel[] = [];
	for (const remoteNote of remote) {
		const localNote = localMap.get(remoteNote.id);
		if (!localNote || modifiedAtRemote(remoteNote, localNote)) {
			changes.push(remoteNote);
		}
	}
	return changes;
}

export function useNotesSync() {
	const store = useNotesStore();
	const { listFiles, findFile, readJSONById, writeJSONById, writeJSON, deleteFile } = useGoogleDrive();
	const { isSignedIn } = useGoogleAuth();
	const getFileName = (id: UUID) => `${store.fileNamePrefix}${id}.json`;

	async function readRemoteNotes(force = false, token?: string): Promise<{ token: string | undefined; notes: NoteModel[] }> {
		const { pageToken, fileList } = await listFiles(store.fileNamePrefix, force ? null : lastSyncedToLocalAt.value, token);
		const notes: NoteModel[] = [];
		await Promise.all(
			fileList.map(async file => {
				try {
					const data = await readJSONById<NoteJSON>(file.id);
					if (data) {
						notes.push(NoteModel.fromJSON(data));
					}
				} catch (err) {
					console.warn(`Failed to read note file ${file.name}`, err);
				}
			})
		);
		return { token: pageToken, notes };
	}

	async function purgeRemoteFiles(fileIdsToPurge: ReadonlyArray<UUID>) {
		fileIdsToPurge.forEach(Set.prototype.add, pendingPurges);
		if (pendingPurges.size > 0) {
			const purgeSnapshot = Array.from(pendingPurges);
			await Promise.all(purgeSnapshot.map(getFileName).map(deleteFile));
			purgeSnapshot.forEach(Set.prototype.delete, pendingPurges);
		}
	}

	async function buildUploadPayload(note: NoteModel): Promise<NoteJSON> {
		const content = await store.getNoteContent(note.id);
		return Object.assign(note.toJSON(), {
			content: content ?? emptyString
		});
	}

	async function uploadNote(note: NoteModel): Promise<NoteUploadResult> {
		const fileName = getFileName(note.id);
		const remoteFile = await findFile(fileName);
		if (remoteFile) {
			const remoteJSON = await readJSONById<NoteJSON>(remoteFile.id);
			if (remoteJSON) {
				const remoteNote = NoteModel.fromJSON(remoteJSON);
				if (modifiedAtRemote(remoteNote, note)) {
					await store.replaceNote(remoteNote);
					return NoteUploadResult.Conflict;
				}
				await writeJSONById(remoteFile.id, await buildUploadPayload(note));
				return NoteUploadResult.Uploaded;
			}
		} else {
			await writeJSON(fileName, await buildUploadPayload(note));
		}
		return NoteUploadResult.Uploaded;
	}

	async function runPull(force = false) {
		let pageToken: string | undefined;
		let remoteNotes: NoteModel[];
		let remoteCount: number = 0;
		let downloaded: number = 0;
		const syncStartedAt = new Date();
		do {
			({ token: pageToken, notes: remoteNotes } = await readRemoteNotes(force, pageToken));
			const readCount = remoteNotes.length;
			if (readCount === 0) {
				continue;
			}
			remoteCount += readCount;
			const changes = mergeNotesByModifiedAt(store.notes, remoteNotes);
			const changeCount = changes.length;
			if (changeCount > 0) {
				await store.replaceMultiple(changes);
				downloaded += changeCount;
			}
			lastSyncMessage.value = {
				text: `Fetching remote notes (${remoteCount} loaded)`,
				type: "success",
				timeStamp: Date.now()
			};
		} while (pageToken);
		await purgeRemoteFiles(await store.purgeExpiredTrash());
		lastSyncedToLocalAt.value = syncStartedAt;
		return { remoteCount, downloaded };
	}

	async function runPush(purged: ReadonlyArray<UUID> = [], force = false) {
		const syncStartedAt = new Date();
		await purgeRemoteFiles(purged);
		const candidates = force ? store.notes : store.notes.filter(n => noteEffectiveTime(n) > (lastSyncedToCloudAt.value?.getTime() ?? 0));
		const results = await Promise.all(candidates.map(uploadNote));
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
				text: empty ? "Nothing to sync" : `Synced${changes > 0 ? ` (pulled ${changes} change${changes > 1 ? "s" : emptyString} from cloud)` : emptyString}`,
				type: "success",
				timeStamp: Date.now()
			};
		} catch (err: any) {
			syncError.value = err?.message ?? "Sync failed";
			lastSyncMessage.value = { text: `Sync failed: ${syncError.value}`, type: "error", timeStamp: Date.now() };
		} finally {
			isSyncing.value = false;
		}
	}

	async function saveToCloud(purged: ReadonlyArray<UUID> = []) {
		if (isSyncing.value) {
			return;
		}
		try {
			isSyncing.value = true;
			await runPush(purged, false);
		} finally {
			isSyncing.value = false;
		}
	}

	const debouncedFlush = debounce(() => {
		if (isSignedIn.value && autoSyncEnabled.value) {
			saveToCloud()
				.then(() => {
					lastSyncMessage.value = {
						text: "Synced to cloud",
						type: "success",
						timeStamp: Date.now()
					};
				})
				.catch(() => {
					lastSyncMessage.value = {
						text: "Sync failed",
						type: "error",
						timeStamp: Date.now()
					};
				});
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
		doPullAndPush,
		requestSync,
		setAutoSync,
		dismissMessage
	};
}