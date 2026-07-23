<script setup lang="ts">
	import { ref, useTemplateRef } from "vue";
	import * as notesStore from "@/stores/notes";
	import { useDropdown } from "@/composables/useDropdown";

	const props = defineProps<{ allowCreate: boolean }>();
	const emit = defineEmits<{
		tagAdded: [tag: string];
		tagRemoved: [tag: string];
	}>();
	const dropdownToggle = useTemplateRef("dropdown-toggle");
	const dropdownMenu = useTemplateRef("dropdown-menu");
	const selectedTags = ref<Set<string>>(new Set<string>());
	const { show, toggle } = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});

	function addTag(tag: string) {
		selectedTags.value.add(tag);
	}

	function removeTag(tag: string) {
		selectedTags.value.delete(tag);
	}

	function toggleSelection(tag: string) {
		if (selectedTags.value.has(tag)) {
			removeTag(tag);
			return;
		}
		addTag(tag);
	}
</script>
<template>
	<div class="p-1 border rounded mb-3">
		<button ref="dropdown-toggle" class="btn btn-outline-primary dropdown-toggle" @click="toggle">Tags</button>
		<ul v-if="show" ref="dropdown-menu" class="dropdown-menu show p-2">
			<li>
				<label>
					<input type="checkbox"/>
					<span class="ms-2">Select All</span>
				</label>
			</li>
			<li><hr class="dropdown-divider"/></li>
			<li>
				<input type="text" placeholder="Search"/>
			</li>
			<li><hr class="dropdown-divider"/></li>
			<li v-for="tag in notesStore.tags.value">
				<label>
					<input type="checkbox" @click="toggleSelection(tag)"/>
					<span class="ms-2">{{ tag }}</span>
				</label>
			</li>
			<li><a class="dropdown-item">Something else here</a></li>
		</ul>
	</div>
</template>