import { openDB, type IDBPDatabase } from "idb";
import type { NoteJSON, NoteMetaJSON } from "@/models/NoteModel";
import { DB_NAME, DB_VERSION, NOTES_STORE, CONTENTS_STORE, KV_STORE } from "@/library";

interface NoteContentRecord {
	id: string;
	content: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			async upgrade(db, oldVersion, _newVersion, tx) {
				if (!db.objectStoreNames.contains(NOTES_STORE)) {
					db.createObjectStore(NOTES_STORE, { keyPath: "id" });
				}
				if (!db.objectStoreNames.contains(KV_STORE)) {
					db.createObjectStore(KV_STORE);
				}
				if (!db.objectStoreNames.contains(CONTENTS_STORE)) {
					db.createObjectStore(CONTENTS_STORE, { keyPath: "id" });
				}
				if (oldVersion > 0 && oldVersion < 2) {
					const notesStore = tx.objectStore(NOTES_STORE);
					const contentsStore = tx.objectStore(CONTENTS_STORE);
					let cursor = await notesStore.openCursor();
					while (cursor) {
						const { content, ...meta } = cursor.value as NoteJSON;
						contentsStore.put({ id: cursor.value.id, content: content ?? "" });
						cursor.update(meta);
						cursor = await cursor.continue();
					}
				}
			}
		});
	}
	return dbPromise;
}

export async function getAllNotes(): Promise<NoteMetaJSON[]> {
	const db = await getDB();
	return (await db.getAll(NOTES_STORE)) as NoteMetaJSON[];
}

export async function getNoteContent(id: string): Promise<string> {
	const db = await getDB();
	const record = (await db.get(CONTENTS_STORE, id)) as NoteContentRecord | undefined;
	return record?.content ?? "";
}

export async function getNoteRecord(id: string): Promise<NoteJSON | undefined> {
	const db = await getDB();
	const tx = db.transaction([NOTES_STORE, CONTENTS_STORE], "readonly");
	const [meta, contentRecord] = await Promise.all([tx.objectStore(NOTES_STORE).get(id) as Promise<NoteMetaJSON | undefined>, tx.objectStore(CONTENTS_STORE).get(id) as Promise<NoteContentRecord | undefined>, tx.done]);
	if (!meta) {
		return undefined;
	}
	return { ...meta, content: contentRecord?.content ?? "" };
}

export async function putNoteMeta(meta: NoteMetaJSON): Promise<void> {
	const db = await getDB();
	await db.put(NOTES_STORE, meta);
}

export async function putNotesMeta(metas: NoteMetaJSON[]): Promise<void> {
	if (metas.length === 0) {
		return;
	}
	const db = await getDB();
	const tx = db.transaction(NOTES_STORE, "readwrite");
	await Promise.all(metas.map(meta => tx.store.put(meta)).concat(tx.done as Promise<any>));
}

export async function putNoteFull(note: NoteJSON): Promise<void> {
	const { content, ...meta } = note;
	const db = await getDB();
	const tx = db.transaction([NOTES_STORE, CONTENTS_STORE], "readwrite");
	await Promise.all([tx.objectStore(NOTES_STORE).put(meta), tx.objectStore(CONTENTS_STORE).put({ id: note.id, content: content ?? "" }), tx.done]);
}

export async function deleteNote(id: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction([NOTES_STORE, CONTENTS_STORE], "readwrite");
	await Promise.all([tx.objectStore(NOTES_STORE).delete(id), tx.objectStore(CONTENTS_STORE).delete(id), tx.done]);
}

export async function deleteNotes(ids: string[]): Promise<void> {
	if (ids.length === 0) {
		return;
	}
	const db = await getDB();
	const tx = db.transaction([NOTES_STORE, CONTENTS_STORE], "readwrite");
	const ops: Promise<unknown>[] = [];
	for (const id of ids) {
		ops.push(tx.objectStore(NOTES_STORE).delete(id));
		ops.push(tx.objectStore(CONTENTS_STORE).delete(id));
	}
	ops.push(tx.done);
	await Promise.all(ops);
}

export async function getKV<T>(key: string): Promise<T | undefined> {
	const db = await getDB();
	return (await db.get(KV_STORE, key)) as T | undefined;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
	const db = await getDB();
	await db.put(KV_STORE, value as unknown, key);
}

export async function deleteKV(key: string): Promise<void> {
	const db = await getDB();
	await db.delete(KV_STORE, key);
}