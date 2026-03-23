import { ref } from "vue";

declare global {
	interface Window {
		google: any;
	}
}

const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

export function useGoogleDrive() {
	const accessToken = ref<string | null>(null);
	const isAuthorized = ref(false);
	let tokenClient: any = null;

	function initGoogleAuth() {
		if (!window.google?.accounts?.oauth2) {
			throw new Error("Google Identity Services not loaded.");
		}
		tokenClient = window.google.accounts.oauth2.initTokenClient({
			client_id: import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID,
			scope: SCOPES,
			callback: (resp: any) => {
				if (resp.error) {
					console.error(resp);
					return;
				}
				accessToken.value = resp.access_token;
				isAuthorized.value = true;
			}
		});
	}

	async function signIn() {
		if (!tokenClient) {
			initGoogleAuth();
		}
		return new Promise<void>((resolve, reject) => {
			tokenClient.callback = (resp: any) => {
				if (resp.error) {
					reject(resp);
					return;
				}
				accessToken.value = resp.access_token;
				isAuthorized.value = true;
				resolve();
			};
			tokenClient.requestAccessToken({ prompt: "consent" });
		});
	}

	async function ensureSignedIn() {
		if (!accessToken.value) {
			await signIn();
		}
	}

	async function listAppDataFiles() {
		await ensureSignedIn();
		const url = "https://www.googleapis.com/drive/v3/files" + "?spaces=appDataFolder" + "&fields=files(id,name,modifiedTime,size)" + "&pageSize=100";
		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken.value}`
			}
		});
		if (!res.ok) {
			throw new Error(await res.text());
		}
		return await res.json();
	}

	async function readFileContent(fileId: string) {
		await ensureSignedIn();
		const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
			headers: {
				Authorization: `Bearer ${accessToken.value}`
			}
		});
		if (!res.ok) {
			throw new Error(await res.text());
		}
		return await res.text();
	}

	async function findFileByName(fileName: string) {
		await ensureSignedIn();
		const q = encodeURIComponent(`name='${fileName.replace(/'/g, "\\'")}' and 'appDataFolder' in parents and trashed=false`);
		const url = `https://www.googleapis.com/drive/v3/files` + `?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken.value}`
			}
		});
		if (!res.ok) {
			throw new Error(await res.text());
		}
		const data = await res.json();
		return data.files?.[0] ?? null;
	}

	async function saveJsonToAppData(fileName: string, data: unknown) {
		await ensureSignedIn();
		const existing = await findFileByName(fileName);
		const json = JSON.stringify(data, null, 2);
		const metadata = {
			name: fileName,
			parents: ["appDataFolder"],
			mimeType: "application/json"
		};
		const form = new FormData();
		form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
		form.append("file", new Blob([json], { type: "application/json" }));
		const method = existing ? "PATCH" : "POST";
		const endpoint = existing ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
		const res = await fetch(endpoint, {
			method,
			headers: {
				Authorization: `Bearer ${accessToken.value}`
			},
			body: form
		});
		if (!res.ok) {
			throw new Error(await res.text());
		}
		return await res.json();
	}

	async function loadJsonFromAppData<T = unknown>(fileName: string): Promise<T | null> {
		const existing = await findFileByName(fileName);
		if (!existing) {
			return null;
		}
		const text = await readFileContent(existing.id);
		return JSON.parse(text) as T;
	}

	return {
		isAuthorized,
		signIn,
		listAppDataFiles,
		saveJsonToAppData,
		loadJsonFromAppData
	};
}