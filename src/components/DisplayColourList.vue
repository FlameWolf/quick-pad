<script setup lang="ts">
	import { colours } from "@/constants/colours";

	const emit = defineEmits<{
		selectionChanged: [colour: string];
	}>();
</script>
<template>
	<div class="d-flex flex-wrap gap-2 p-2 border rounded">
		<a v-for="colour in colours" class="colour-circle border rounded-circle" :class="`bg-${colour.name.toLowerCase()}`" @click="emit(`selectionChanged`, colour.name)" role="button" :aria-label="colour.name"></a>
	</div>
</template>