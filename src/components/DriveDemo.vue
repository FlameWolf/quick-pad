<script setup lang="ts">
	import { ref } from "vue";
	import { useGoogleDrive } from "../composables/useGoogleDrive";
	const { isAuthorized, signIn, saveJsonToAppData, loadJsonFromAppData, listAppDataFiles } = useGoogleDrive();
	const output = ref("");
	async function handleLogin() {
		await signIn();
		output.value = "Signed in.";
	}
	async function saveSample() {
		const payload = {
			theme: "dark",
			lastProjectId: 42,
			savedAt: new Date().toISOString()
		};
		const result = await saveJsonToAppData("my-app-state.json", payload);
		output.value = `Saved. File ID: ${result.id}`;
	}
	async function loadSample() {
		const data = await loadJsonFromAppData("my-app-state.json");
		output.value = JSON.stringify(data, null, 2);
	}
	async function listFiles() {
		const data = await listAppDataFiles();
		output.value = JSON.stringify(data, null, 2);
	}
</script>

<template>
	<div>
		<button @click="handleLogin">Connect Google Drive</button>
		<button @click="saveSample" :disabled="!isAuthorized">Save App State</button>
		<button @click="loadSample" :disabled="!isAuthorized">Load App State</button>
		<button @click="listFiles" :disabled="!isAuthorized">List AppData Files</button>
		<pre>{{ output }}</pre>
	</div>
</template>