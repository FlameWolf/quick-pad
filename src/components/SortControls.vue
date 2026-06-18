<script setup lang="ts">
	import { computed } from "vue";
	import Icon from "@/components/Icon.vue";
	import type { SortField, SortDirection } from "@/composables/useNoteSort";

	const props = defineProps<{ sortBy: SortField; sortDirection: SortDirection }>();
	const emit = defineEmits<{ changeField: [field: SortField]; toggleDirection: [] }>();
	const isAscending = computed(() => props.sortDirection === "asc");

	function onSortFieldChange(e: Event) {
		emit("changeField", (e.target as HTMLSelectElement).value as SortField);
	}
</script>
<template>
	<div class="d-flex gap-1 align-items-center sort-controls">
		<label for="sort-by-select" class="form-label text-muted small mb-0 me-1">Sort:</label>
		<select id="sort-by-select" class="form-select form-select-sm sort-select" :value="props.sortBy" @change="onSortFieldChange" aria-label="Sort notes by">
			<option value="modifiedAt">Updated</option>
			<option value="createdAt">Created</option>
			<option value="title">Title</option>
			<option value="sentenceCount">Sentences</option>
			<option value="wordCount">Words</option>
			<option value="characterCount">Characters</option>
		</select>
		<button class="btn btn-outline-secondary btn-sm" @click="emit(`toggleDirection`)" :aria-label="isAscending ? `Sort ascending, click to switch to descending` : `Sort descending, click to switch to ascending`" :title="isAscending ? `Ascending` : `Descending`">
			<Icon :type="isAscending ? `sortDown` : `sortUp`"/>
		</button>
	</div>
</template>
<style>
	.sort-controls {
		margin-right: auto;
	}
	.sort-select {
		width: auto;
	}
</style>