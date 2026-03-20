<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import DisplayNoteList from "@/components/DisplayNoteList.vue";
	import { RouterLink, RouterView } from "vue-router";
</script>

<template>
	<BApp>
		<h1>Hello App!</h1>
		<p><strong>Current route path:</strong> {{ $route.fullPath }}</p>
		<RouterLink to="/Notes">Notes</RouterLink>
		<main>
			<RouterView />
		</main>
	</BApp>
</template>