import { ref, readonly, computed } from "vue";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { emptyString } from "@/library";

let tokenClient: any | null = null;
let tokenExpiresAt = 0;
let gsiReadyPromise: Promise<boolean> | null = null;
const CLIENT_ID = import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID ?? emptyString;
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const SESSION_KEY = "google-session-hint";
const TOKEN_KEY = "google-access-token";
const EXPIRY_KEY = "google-token-expires-at";
const USER_KEY = "google-user-info";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GSI_WAIT_MS = 6000;
const accessToken = ref<string | null>(null);
const user = ref<{ email: string; name: string } | null>(null);
const isReady = ref(false);
const isSignedIn = ref(false);

let cachedToken: string | null = null;
let cachedExpiry = 0;
let cachedUser: { email: string; name: string } | null = null;

export async function hydrateAuthState(): Promise<void> {
	cachedToken = (await getKV<string>(TOKEN_KEY)) ?? null;
	cachedExpiry = (await getKV<number>(EXPIRY_KEY)) ?? 0;
	const stored = await getKV<{ email: unknown; name: unknown }>(USER_KEY);
	if (stored && typeof stored.email === "string" && typeof stored.name === "string") {
		cachedUser = { email: stored.email, name: stored.name };
	} else {
		cachedUser = null;
	}
}

function persistAuthState(token: string, expiresAt: number) {
	setKV(TOKEN_KEY, token);
	setKV(EXPIRY_KEY, expiresAt);
}

function persistUserInfo(info: { email: string; name: string } | null) {
	if (info) {
		setKV(USER_KEY, info);
	} else {
		deleteKV(USER_KEY);
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
					clearSession(user.value !== null);
					isReady.value = true;
					return;
				}
				tokenExpiresAt = Date.now() + response.expires_in * 1000;
				accessToken.value = response.access_token;
				setKV(SESSION_KEY, true);
				persistAuthState(response.access_token, tokenExpiresAt);
				if (!user.value) {
					await fetchUserInfo(response.access_token);
					persistUserInfo(user.value);
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
			tokenExpiresAt = cachedExpiry;
			accessToken.value = cachedToken;
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

	function signOut() {
		if (accessToken.value && typeof google !== "undefined" && google?.accounts?.oauth2) {
			google.accounts.oauth2.revoke(accessToken.value, () => {
				clearSession();
			});
		} else {
			clearSession();
		}
	}

	function clearSession(keepUser = false) {
		accessToken.value = null;
		tokenExpiresAt = 0;
		cachedToken = null;
		cachedExpiry = 0;
		deleteKV(TOKEN_KEY);
		deleteKV(EXPIRY_KEY);
		if (!keepUser) {
			user.value = null;
			isSignedIn.value = false;
			cachedUser = null;
			deleteKV(SESSION_KEY);
			deleteKV(USER_KEY);
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
		if (accessToken.value && Date.now() < tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
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