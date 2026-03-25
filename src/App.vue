<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import "bootstrap-icons/font/bootstrap-icons.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterLink, RouterView } from "vue-router";
	import { useTheme } from "@/composables/useTheme";
	const { isDark } = useTheme();
</script>

<template>
	<BApp>
		<div class="position-absolute top-0 end-0 mt-1 me-1">
			<i class="bi" :class="{ 'bi-moon-stars-fill': isDark, 'bi-sun-fill': !isDark }"></i>
		</div>
		<h1>Hello App!</h1>
		<p><strong>Current route path:</strong> {{ $route.fullPath }}</p>
		<RouterLink to="/notes">Notes</RouterLink>
		<RouterLink to="/drive">Drive Demo</RouterLink>
		<main>
			<RouterView/>
		</main>
	</BApp>
</template>