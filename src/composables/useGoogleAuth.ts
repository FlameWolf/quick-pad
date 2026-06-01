import { ref, readonly, computed, toRaw, watch } from "vue";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { CLIENT_ID, emptyString, EXPIRY_KEY, GSI_WAIT_MS, LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY, SCOPES, SESSION_KEY, TOKEN_KEY, TOKEN_REFRESH_BUFFER_MS, USER_KEY } from "@/library";

type UserInfo = {
	email: string;
	name: string;
};

let cachedToken: string | null = null;
let cachedExpiry: number = 0;
let cachedUser: UserInfo | null = null;
let tokenClient: any | null = null;
let gsiReadyPromise: Promise<boolean> | null = null;
const accessToken = ref<string | null>(null);
const tokenExpiresAt = ref(0);
const user = ref<UserInfo | null>(null);
const isReady = ref(false);
const isSignedIn = ref(false);

watch([accessToken, tokenExpiresAt], async ([token, expiresAt]) => {
	if (!token || !expiresAt) {
		await deleteKV(TOKEN_KEY);
		await deleteKV(EXPIRY_KEY);
		return;
	}
	if (token !== cachedToken || expiresAt !== cachedExpiry) {
		await setKV(TOKEN_KEY, token);
		await setKV(EXPIRY_KEY, expiresAt);
	}
});
watch(user, async info => {
	if (!info) {
		await deleteKV(USER_KEY);
		return;
	}
	if (info && (info.email !== cachedUser?.email || info.name !== cachedUser?.name)) {
		await setKV(USER_KEY, toRaw(info));
	}
});

export async function hydrateAuthState(): Promise<void> {
	cachedToken = (await getKV<string>(TOKEN_KEY)) ?? null;
	cachedExpiry = (await getKV<number>(EXPIRY_KEY)) ?? 0;
	const stored = await getKV<UserInfo>(USER_KEY);
	if (stored && typeof stored.email === "string" && typeof stored.name === "string") {
		cachedUser = {
			email: stored.email,
			name: stored.name
		};
	} else {
		cachedUser = null;
	}
}

function waitForGoogleIdentity(): Promise<boolean> {
	if (gsiReadyPromise) {
		return gsiReadyPromise;
	}
	gsiReadyPromise = new Promise(resolve => {
		if (typeof google !== "undefined" && google?.accounts?.oauth2) {
			resolve(true);
			return;
		}
		const start = Date.now();
		const interval = setInterval(() => {
			if (typeof google !== "undefined" && google?.accounts?.oauth2) {
				clearInterval(interval);
				resolve(true);
			} else if (Date.now() - start > GSI_WAIT_MS) {
				clearInterval(interval);
				resolve(false);
			}
		}, 100);
	});
	return gsiReadyPromise;
}

export function useGoogleAuth() {
	const isConfigured = computed(() => Boolean(CLIENT_ID));

	function initClient(): boolean {
		if (tokenClient) {
			return true;
		}
		if (!CLIENT_ID || typeof google === "undefined" || !google?.accounts?.oauth2) {
			return false;
		}
		tokenClient = google.accounts.oauth2.initTokenClient({
			client_id: CLIENT_ID,
			scope: SCOPES,
			callback: async (response: any) => {
				if (response.error) {
					await clearSession(user.value !== null);
					isReady.value = true;
					return;
				}
				accessToken.value = response.access_token;
				tokenExpiresAt.value = Date.now() + response.expires_in * 1000;
				await setKV(SESSION_KEY, true);
				if (!user.value) {
					await fetchUserInfo(response.access_token);
				}
				isSignedIn.value = true;
				isReady.value = true;
			}
		});
		return true;
	}

	function tryRestoreSession() {
		if (isReady.value) {
			return;
		}
		if (!CLIENT_ID) {
			isReady.value = true;
			return;
		}
		if (cachedToken && cachedExpiry && Date.now() < cachedExpiry - TOKEN_REFRESH_BUFFER_MS) {
			accessToken.value = cachedToken;
			tokenExpiresAt.value = cachedExpiry;
			user.value = cachedUser;
			isSignedIn.value = true;
		} else if (cachedUser) {
			user.value = cachedUser;
			isSignedIn.value = true;
		}
		isReady.value = true;
	}

	async function signIn() {
		if (!CLIENT_ID) {
			return;
		}
		const loaded = await waitForGoogleIdentity();
		if (!loaded || !initClient()) {
			return;
		}
		try {
			tokenClient!.requestAccessToken({ prompt: "consent" });
		} catch {
			console.log("Consent popup blocked or GSI not ready");
		}
	}

	async function signOut() {
		if (accessToken.value && typeof google !== "undefined" && google?.accounts?.oauth2) {
			google.accounts.oauth2.revoke(accessToken.value, async () => {
				await clearSession();
			});
		} else {
			await clearSession();
		}
	}

	async function clearSession(keepUser = false) {
		accessToken.value = null;
		tokenExpiresAt.value = 0;
		cachedToken = null;
		cachedExpiry = 0;
		if (!keepUser) {
			user.value = null;
			isSignedIn.value = false;
			cachedUser = null;
			await deleteKV(SESSION_KEY);
			await deleteKV(LAST_SYNCED_TO_CLOUD_KEY);
			await deleteKV(LAST_SYNCED_TO_LOCAL_KEY);
		}
	}

	async function fetchUserInfo(token: string) {
		try {
			const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			if (!res.ok) {
				return;
			}
			const data = await res.json();
			user.value = {
				email: data.email,
				name: data.name
			};
		} catch {}
	}

	async function getAccessToken(): Promise<string> {
		if (accessToken.value && Date.now() < tokenExpiresAt.value - TOKEN_REFRESH_BUFFER_MS) {
			return accessToken.value;
		}
		const loaded = await waitForGoogleIdentity();
		if (!loaded || !initClient()) {
			throw new Error("Google Sign-In is unavailable");
		}
		return new Promise((resolve, reject) => {
			const original = tokenClient!.callback;
			tokenClient!.callback = (response: any) => {
				tokenClient!.callback = original;
				original(response);
				if (response.error) {
					reject(new Error(response.error));
				} else {
					resolve(response.access_token);
				}
			};
			const params: { prompt: string; hint?: string } = { prompt: emptyString };
			if (user.value?.email) {
				params.hint = user.value.email;
			}
			tokenClient!.requestAccessToken(params);
		});
	}

	return {
		user: readonly(user),
		isReady: readonly(isReady),
		isSignedIn: readonly(isSignedIn),
		isConfigured,
		tryRestoreSession,
		signIn,
		signOut,
		getAccessToken
	};
}