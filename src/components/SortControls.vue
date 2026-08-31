<script setup lang="ts">
	import { computed, onMounted } from "vue";
	import { hydrateSortPrefs, type SortField, type SortOrder } from "@/composables/useNoteSort";
	import Icon from "@/components/Icon.vue";

	const props = defineProps<{ sortField: SortField; sortOrder: SortOrder }>();
	const emit = defineEmits<{ changeField: [field: SortField]; toggleDirection: [] }>();
	const isAscending = computed(() => props.sortOrder === "asc");

	function onSortFieldChange(e: Event) {
		emit("changeField", (e.target as HTMLSelectElement).value as SortField);
	}

	onMounted(async () => {
		await hydrateSortPrefs();
	});
</script>
<template>
	<div class="d-flex gap-1 align-items-center sort-controls">
		<label for="sort-by-select" class="form-label text-muted small mb-0 me-1">Sort:</label>
		<select id="sort-by-select" class="form-select form-select-sm sort-select" :value="props.sortField" @change="onSortFieldChange" aria-label="Sort notes by">
			<option value="modifiedAt">Updated</option>
			<option value="createdAt">Created</option>
			<option value="colour">Colour</option>
			<option value="title">Title</option>
			<option value="sentenceCount">Sentences</option>
			<option value="wordCount">Words</option>
			<option value="characterCount">Characters</option>
		</select>
		<button class="btn btn-outline-secondary btn-sm" @click="emit(`toggleDirection`)" :title="isAscending ? `Ascending` : `Descending`" :aria-label="isAscending ? `Sort ascending, click to switch to descending` : `Sort descending, click to switch to ascending`">
			<Icon :type="isAscending ? `sortDown` : `sortUp`"/>
		</button>
	</div>
</template>