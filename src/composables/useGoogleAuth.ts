import { emptyString } from "@/library";
import { ref, readonly } from "vue";

let tokenClient: any | null = null;
let tokenExpiresAt = 0;
const CLIENT_ID = import.meta.env.VITE_GOOG_OAUTH_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
const SESSION_KEY = "google_session_hint";
const accessToken = ref<string | null>(null);
const user = ref<{ email: string; name: string } | null>(null);
const isReady = ref(false);
const isSignedIn = ref(false);

export function useGoogleAuth() {
	function initClient() {
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
				await fetchUserInfo(response.access_token);
				isSignedIn.value = true;
				isReady.value = true;
			}
		});
	}

	async function tryRestoreSession() {
		if (isReady.value) {
			return;
		}
		try {
			if (!tokenClient) {
				initClient();
			}
		} catch {
			isReady.value = true;
			return;
		}
		const hadSession = localStorage.getItem(SESSION_KEY);
		if (hadSession) {
			const timeout = setTimeout(() => {
				if (!isReady.value) {
					isReady.value = true;
				}
			}, 5000);
			const originalCallback = tokenClient!.callback;
			tokenClient!.callback = (response: any) => {
				clearTimeout(timeout);
				originalCallback(response);
			};
			tokenClient!.requestAccessToken({ prompt: emptyString });
		} else {
			isReady.value = true;
		}
	}

	function signIn() {
		if (!tokenClient) {
			initClient();
		}
		tokenClient!.requestAccessToken({ prompt: "consent" });
	}

	function signOut() {
		if (accessToken.value) {
			google.accounts.oauth2.revoke(accessToken.value, () => {
				clearSession();
			});
		}
	}

	function clearSession() {
		accessToken.value = null;
		user.value = null;
		isSignedIn.value = false;
		tokenExpiresAt = 0;
		localStorage.removeItem(SESSION_KEY);
	}

	async function fetchUserInfo(token: string) {
		const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
		const data = await res.json();
		user.value = {
			email: data.email,
			name: data.name
		};
	}

	async function getValidToken(): Promise<string> {
		if (accessToken.value && Date.now() < tokenExpiresAt - 60_000) {
			return accessToken.value;
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
		accessToken: readonly(accessToken),
		user: readonly(user),
		isReady: readonly(isReady),
		isSignedIn: readonly(isSignedIn),
		tryRestoreSession,
		signIn,
		signOut,
		getValidToken
	};
}