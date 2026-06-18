<script setup lang="ts">
	import { icons } from "@/constants/icons";

	const props = defineProps<{
		type: keyof typeof icons;
	}>();
</script>
<template>
	<template v-html="icons[props.type]"></template>
</template>