<script setup lang="ts">
	import { onMounted } from "vue";
	import { useGoogleAuth } from "@/composables/useGoogleAuth";
	import { useGoogleDrive } from "@/composables/useGoogleDrive";

	const { user, isReady, isSignedIn, tryRestoreSession, signIn, signOut } = useGoogleAuth();
	const { readJSON, writeJSON } = useGoogleDrive();

	async function loadData() {
		const data = await readJSON("app-data.json");
		console.log("Loaded:", data);
	}

	async function saveData() {
		await writeJSON("app-data.json", { notes: ["hello"], lastSync: new Date().toISOString() });
	}

	onMounted(() => {
		tryRestoreSession();
	});
</script>

<template>
	<div v-if="!isReady">Restoring session…</div>
	<div v-else-if="!isSignedIn">
		<button @click="signIn">Sign in with Google</button>
	</div>
	<div v-else>
		<p>Hello, {{ user?.name }}</p>
		<button @click="loadData">Load from Drive</button>
		<button @click="saveData">Save to Drive</button>
		<button @click="signOut">Sign out</button>
	</div>
</template>