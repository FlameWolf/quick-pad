<script setup lang="ts">
	import { colours } from "@/constants/colours";
	import * as notesStore from "@/stores/notes";

	const props = defineProps<{
		filterMode?: boolean;
		selected?: Colour;
	}>();
	const emit = defineEmits<{
		selectionChanged: [colour: Colour];
	}>();

	function isActive(colour: Colour) {
		if (props.filterMode) {
			return notesStore.searchColours.value.has(colour);
		}
		return props.selected === colour;
	}
</script>
<template>
	<div class="d-flex flex-wrap gap-2 p-2 border rounded">
		<a v-for="colour in colours" class="colour-circle rounded-circle" :class="{ [`bg-${colour}`]: true, active: isActive(colour) }" @click="emit(`selectionChanged`, colour)" role="button" :aria-label="colour"></a>
	</div>
</template>