import { useGoogleAuth } from "./useGoogleAuth";

interface DriveFile {
	id: string;
	name: string;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export function useGoogleDrive() {
	const { getAccessToken } = useGoogleAuth();

	async function headers() {
		const token = await getAccessToken();
		return {
			Authorization: `Bearer ${token}`
		};
	}

	async function listFiles(namePrefix?: string): Promise<DriveFile[]> {
		const baseQ = "'appDataFolder' in parents and trashed=false";
		const files: DriveFile[] = [];
		let pageToken: string | undefined;
		do {
			const params = new URLSearchParams({
				spaces: "appDataFolder",
				q: namePrefix ? `${baseQ} and name contains '${namePrefix}'` : baseQ,
				fields: "files(id, name), nextPageToken",
				pageSize: "1000"
			});
			if (pageToken) {
				params.set("pageToken", pageToken);
			}
			const res = await fetch(`${DRIVE_API}?${params}`, {
				headers: await headers()
			});
			const data = await res.json();
			if (Array.isArray(data.files)) {
				files.push(...data.files);
			}
			pageToken = data.nextPageToken;
		} while (pageToken);
		return namePrefix ? files.filter(f => f.name.startsWith(namePrefix)) : files;
	}

	async function findFile(name: string): Promise<string | null> {
		const params = new URLSearchParams({
			spaces: "appDataFolder",
			q: encodeURIComponent(`name='${name}' and 'appDataFolder' in parents and trashed=false`),
			fields: "files(id, name)"
		});
		const res = await fetch(`${DRIVE_API}?${params}`, {
			headers: await headers()
		});
		const data = await res.json();
		return data.files?.[0]?.id ?? null;
	}

	async function readJSON<T = unknown>(filename: string): Promise<T | null> {
		const fileId = await findFile(filename);
		if (!fileId) {
			return null;
		}
		const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
			headers: await headers()
		});
		return res.json();
	}

	async function writeJSON(filename: string, data: unknown): Promise<void> {
		const body = JSON.stringify(data);
		const existingId = await findFile(filename);
		if (existingId) {
			await fetch(`${UPLOAD_API}/${existingId}?uploadType=media`, {
				method: "PATCH",
				headers: { ...(await headers()), "Content-Type": "application/json" },
				body
			});
		} else {
			const metadata = {
				name: filename,
				parents: ["appDataFolder"],
				mimeType: "application/json"
			};
			const form = new FormData();
			form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
			form.append("file", new Blob([body], { type: "application/json" }));
			await fetch(`${UPLOAD_API}?uploadType=multipart`, {
				method: "POST",
				headers: await headers(),
				body: form
			});
		}
	}

	async function deleteFileById(fileId: string): Promise<void> {
		await fetch(`${DRIVE_API}/${fileId}`, {
			method: "DELETE",
			headers: await headers()
		});
	}

	async function deleteFile(filename: string): Promise<boolean> {
		const fileId = await findFile(filename);
		if (!fileId) {
			return false;
		}
		await deleteFileById(fileId);
		return true;
	}

	return { listFiles, findFile, readJSON, writeJSON, deleteFile };
}