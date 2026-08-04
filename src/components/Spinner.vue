<script setup lang="ts">
	const props = defineProps<{
		message?: string;
	}>();
</script>
<template>
	<div class="d-flex flex-column justify-content-center align-items-center">
		<div class="spinner-border" aria-hidden="true"></div>
		<div class="mt-3" role="status">{{ props.message || "Loading..." }}</div>
	</div>
</template>