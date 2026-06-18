<script setup lang="ts">
	import { icons } from "@/constants/icons";

	const props = defineProps<{
		type: keyof typeof icons;
	}>();

	function camelToKebab(input: string) {
		return input
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
			.toLowerCase();
	}
</script>
<template>
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" :class="`bi bi-${camelToKebab(props.type)}`" v-html="icons[props.type]"></svg>
</template>