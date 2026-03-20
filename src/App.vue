<script setup lang="ts">
	import "bootstrap/dist/css/bootstrap.min.css";
	import { BApp } from "bootstrap-vue-next/components";
	import { RouterLink, RouterView } from "vue-router";
</script>

<template>
	<BApp>
		<h1>Hello App!</h1>
		<p><strong>Current route path:</strong> {{ $route.fullPath }}</p>
		<ul class="nav">
			<li class="nav-item">
				<RouterLink class="nav-link" to="/">Go to Home</RouterLink>
			</li>
			<li class="nav-item">
				<RouterLink class="nav-link" to="/Counter">Go to Counter</RouterLink>
			</li>
		</ul>
		<main>
			<RouterView />
		</main>
	</BApp>
</template>