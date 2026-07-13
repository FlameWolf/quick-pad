<script setup lang="ts">
	import { icons } from "@/content/icons";
	import { camelToKebab } from "@/utils/common";

	const props = defineProps<{
		type: keyof typeof icons;
	}>();
</script>
<template>
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" :class="`bi bi-${camelToKebab(props.type)}`" v-html="icons[props.type]"></svg>
</template>