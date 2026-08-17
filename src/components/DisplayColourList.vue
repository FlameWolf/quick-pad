<script setup lang="ts">
	import { colours } from "@/constants/colours";

	const emit = defineEmits<{
		selectionChanged: [colour: Colour];
	}>();
</script>
<template>
	<div class="d-flex flex-wrap gap-2 p-2 border rounded">
		<a class="colour-circle rounded-circle bg-none" @click="emit(`selectionChanged`, `None`)" role="button" aria-label="None"></a>
		<a v-for="colour in colours" class="colour-circle rounded-circle" :class="`bg-${colour.toLowerCase()}`" @click="emit(`selectionChanged`, colour)" role="button" :aria-label="colour"></a>
	</div>
</template>