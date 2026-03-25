import { ref, readonly } from "vue";
import { useGoogleDrive } from "./useGoogleDrive";
import { useNotesStore } from "@/stores/notes";
import { NoteModel } from "@/models/NoteModel";
import type { NoteJSON } from "@/models/NoteModel";

const SYNC_FILENAME = "quick-pad-notes.json";

export function useNotesSync() {
	const { readJSON, writeJSON } = useGoogleDrive();
	const isSyncing = ref(false);

	async function saveToCloud(): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		try {
			await writeJSON(SYNC_FILENAME, store.notes.map(n => n.toJSON()));
		} finally {
			isSyncing.value = false;
		}
	}

	async function loadFromCloud(): Promise<void> {
		const store = useNotesStore();
		isSyncing.value = true;
		try {
			const data = await readJSON<NoteJSON[]>(SYNC_FILENAME);
			if (data && Array.isArray(data)) {
				store.replaceAllNotes(data.map(NoteModel.fromJSON));
			}
		} finally {
			isSyncing.value = false;
		}
	}

	return {
		isSyncing: readonly(isSyncing),
		saveToCloud,
		loadFromCloud
	};
}