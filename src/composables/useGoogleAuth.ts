import { emptyString } from "@/library";
import { ref, readonly, computed } from "vue";

let tokenClient: any | null = null;
let tokenExpiresAt = 0;
let gsiReadyPromise: Promise<boolean> | null = null;
const CLIENT_ID = import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID ?? emptyString;
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const SESSION_KEY = "google_session_hint";
const TOKEN_KEY = "google_access_token";
const EXPIRY_KEY = "google_token_expires_at";
const USER_KEY = "google_user_info";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const GSI_WAIT_MS = 6000;
const accessToken = ref<string | null>(null);
const user = ref<{ email: string; name: string } | null>(null);
const isReady = ref(false);
const isSignedIn = ref(false);

function persistAuthState(token: string, expiresAt: number) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(EXPIRY_KEY, String(expiresAt));
}

function persistUserInfo(info: { email: string; name: string } | null) {
	if (info) {
		localStorage.setItem(USER_KEY, JSON.stringify(info));
	} else {
		localStorage.removeItem(USER_KEY);
	}
}

function loadStoredUser(): { email: string; name: string } | null {
	const raw = localStorage.getItem(USER_KEY);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed.email === "string" && typeof parsed.name === "string") {
			return {
				email: parsed.email,
				name: parsed.name
			};
		}
	} catch {}
	return null;
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
					clearSession();
					isReady.value = true;
					return;
				}
				accessToken.value = response.access_token;
				tokenExpiresAt = Date.now() + response.expires_in * 1000;
				localStorage.setItem(SESSION_KEY, "true");
				persistAuthState(response.access_token, tokenExpiresAt);
				await fetchUserInfo(response.access_token);
				persistUserInfo(user.value);
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
		const storedToken = localStorage.getItem(TOKEN_KEY);
		const storedExpiryRaw = localStorage.getItem(EXPIRY_KEY);
		const storedExpiry = storedExpiryRaw ? Number(storedExpiryRaw) : 0;
		if (storedToken && storedExpiry && Date.now() < storedExpiry - TOKEN_REFRESH_BUFFER_MS) {
			accessToken.value = storedToken;
			tokenExpiresAt = storedExpiry;
			user.value = loadStoredUser();
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

	function clearSession() {
		accessToken.value = null;
		user.value = null;
		isSignedIn.value = false;
		tokenExpiresAt = 0;
		localStorage.removeItem(SESSION_KEY);
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(EXPIRY_KEY);
		localStorage.removeItem(USER_KEY);
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
			tokenClient!.requestAccessToken({ prompt: emptyString });
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