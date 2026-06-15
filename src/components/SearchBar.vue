<script setup lang="ts">
	import { computed, useTemplateRef } from "vue";
	import { useNotesStore } from "@/stores/notes";
	import { listViewRoutes } from "@/router";
	import { debounce } from "@/utils/timing";
	import { emptyString } from "@/constants/common";

	const notesStore = useNotesStore();
	const searchInput = useTemplateRef("search-input");
	const isSearchMode = computed(() => !!notesStore.searchText);
	const debouncedSearch = debounce(() => {
		notesStore.searchText = searchInput.value?.value?.trim() ?? emptyString;
	}, 300);

	function clearSearch() {
		debouncedSearch.cancel();
		notesStore.searchText = emptyString;
		searchInput.value!.value = emptyString;
	}
</script>
<template>
	<div class="me-auto position-relative">
		<input type="text" class="form-control pe-5" placeholder="Search" aria-label="Search notes" ref="search-input" :disabled="!listViewRoutes.includes($route.path)" @input="debouncedSearch"/>
		<button v-if="isSearchMode" class="btn-close small position-absolute top-50 end-0 translate-middle-y me-2" @click="clearSearch" aria-label="Clear search"></button>
	</div>
</template>