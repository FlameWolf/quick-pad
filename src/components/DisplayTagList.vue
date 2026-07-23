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
	const selectedTags = ref<string[]>([]);
	const { show, toggle } = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});

	function removeTag(tag: string) {
		const index = selectedTags.value.indexOf(tag);
		if(index > -1) {
			selectedTags.value.splice(index, 1);
		}
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
					<input type="checkbox" :value="tag" v-model="selectedTags"/>
					<span class="ms-2">{{ tag }}</span>
				</label>
			</li>
		</ul>
		<div v-if="selectedTags.length" class="d-inline-flex flex-wrap gap-2 align-middle ms-3">
			<div v-for="tag in selectedTags" class="badge text-bg-secondary">
				<span>{{ tag }}</span>
				<button class="small btn-close ms-2" @click="removeTag(tag)"></button>
			</div>
		</div>
	</div>
</template>