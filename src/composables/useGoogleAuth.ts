import { ref, readonly, computed, toRaw, watch } from "vue";
import { deleteKV, getKV, setKV } from "@/storage/db";
import { AUTH_SIGNOUT_URL, AUTH_START_URL, AUTH_TOKEN_URL, CLIENT_ID, EXPIRY_KEY, SESSION_KEY, TOKEN_KEY, TOKEN_REFRESH_BUFFER_MS, USER_KEY } from "@/constants/auth";
import { LAST_SYNCED_TO_CLOUD_KEY, LAST_SYNCED_TO_LOCAL_KEY } from "@/constants/sync";

type UserInfo = {
	email: string;
	name: string;
};

let cachedToken: string | null = null;
let cachedExpiry: number = 0;
let cachedUser: UserInfo | null = null;
let refreshInFlight: Promise<string> | null = null;
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
	cachedToken = (await getKV(TOKEN_KEY)) ?? null;
	cachedExpiry = (await getKV(EXPIRY_KEY)) ?? 0;
	const stored = await getKV(USER_KEY);
	if (stored && typeof stored.email === "string" && typeof stored.name === "string") {
		cachedUser = {
			email: stored.email,
			name: stored.name
		};
	} else {
		cachedUser = null;
	}
}

export function useGoogleAuth() {
	const isConfigured = computed(() => Boolean(CLIENT_ID));

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

	async function refreshFromServer(): Promise<string> {
		if (refreshInFlight) {
			return refreshInFlight;
		}
		refreshInFlight = (async () => {
			try {
				const res = await fetch(AUTH_TOKEN_URL, {
					method: "GET",
					credentials: "include",
					headers: { Accept: "application/json" }
				});
				if (res.status === 401) {
					await clearSession(false);
					throw new Error("Your Google session has expired. Please sign in again.");
				}
				if (!res.ok) {
					throw new Error(`Could not refresh the Google session (status ${res.status}).`);
				}
				const data = (await res.json()) as { access_token: string; expires_in: number; user?: UserInfo | null };
				accessToken.value = data.access_token;
				tokenExpiresAt.value = Date.now() + (data.expires_in || 3600) * 1000;
				if (data.user) {
					user.value = data.user;
				}
				await setKV(SESSION_KEY, true);
				isSignedIn.value = true;
				return data.access_token;
			} finally {
				refreshInFlight = null;
			}
		})();
		return refreshInFlight;
	}

	async function getAccessToken(): Promise<string> {
		const token = accessToken.value;
		if (token && Date.now() < tokenExpiresAt.value - TOKEN_REFRESH_BUFFER_MS) {
			return token;
		}
		return refreshFromServer();
	}

	function signIn(): Promise<void> {
		if (!CLIENT_ID) {
			return Promise.resolve();
		}
		return new Promise<void>(resolve => {
			const width = 500;
			const height = 600;
			const left = window.screenX + Math.max(0, Math.round((window.outerWidth - width) / 2));
			const top = window.screenY + Math.max(0, Math.round((window.outerHeight - height) / 2));
			const popup = window.open(AUTH_START_URL, "qp-google-auth", `width=${width},height=${height},left=${left},top=${top}`);
			let settled = false;
			let pollTimer: ReturnType<typeof setInterval> | null = null;
			function cleanup() {
				window.removeEventListener("message", onMessage);
				if (pollTimer) {
					clearInterval(pollTimer);
					pollTimer = null;
				}
			}
			function finish() {
				if (settled) {
					return;
				}
				settled = true;
				cleanup();
				resolve();
			}
			async function onMessage(event: MessageEvent) {
				if (event.origin !== window.location.origin || !event.data || event.data.type !== "qp-auth") {
					return;
				}
				if (event.data.ok) {
					if (event.data.user) {
						user.value = event.data.user;
					}
					await setKV(SESSION_KEY, true);
					isSignedIn.value = true;
					try {
						await refreshFromServer();
					} catch (err) {
						console.warn("Failed to refresh access token after sign-in", err);
					}
				}
				finish();
			}
			window.addEventListener("message", onMessage);
			if (!popup) {
				console.warn("Sign-in popup was blocked by the browser.");
				finish();
				return;
			}
			pollTimer = setInterval(() => {
				if (popup.closed) {
					finish();
				}
			}, 500);
		});
	}

	async function signOut() {
		try {
			await fetch(AUTH_SIGNOUT_URL, { method: "POST", credentials: "include" });
		} catch (err) {
			console.warn("Failed to notify the server of sign-out", err);
		}
		await clearSession();
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