<script setup lang="ts">
	import { computed, ref, useTemplateRef } from "vue";
	import { emptyString } from "@/constants/common";
	import { normaliseTag } from "@/utils/common";
	import { contains, equals } from "@/utils/text-analysis";
	import * as notesStore from "@/stores/notes";
	import { useDropdown } from "@/composables/useDropdown";
	import Icon from "@/components/Icon.vue";

	const props = defineProps<{ allowCreate: boolean }>();
	const emit = defineEmits<{
		tagCreated: [tag: string];
	}>();
	const dropdownToggle = useTemplateRef("dropdown-toggle");
	const dropdownMenu = useTemplateRef("dropdown-menu");
	const searchText = ref(emptyString);
	const selectedTags = ref<string[]>([]);
	const { show, toggle } = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});
	const filteredTags = computed(() => {
		if (!searchText.value) {
			return notesStore.tags.value;
		}
		return notesStore.tags.value.filter(tag => contains(tag, searchText.value));
	});
	const allSelected = computed(() => filteredTags.value.every(tag => selectedTags.value.includes(tag)));
	const hasExactMatch = computed(() => {
		if (!searchText) {
			return true;
		}
		return notesStore.tags.value.some(tag => equals(tag, normaliseTag(searchText.value)));
	});

	function toggleSelectAll() {
		if (!allSelected.value) {
			selectedTags.value = filteredTags.value;
			return;
		}
		selectedTags.value = [];
	}

	function removeTagFromFilter(tag: string) {
		const index = selectedTags.value.indexOf(tag);
		if (index !== -1) {
			selectedTags.value = selectedTags.value.toSpliced(index, 1);
		}
	}

	async function saveTag(tag: string) {
		await notesStore.saveTag(normaliseTag(tag));
	}

	async function deleteTag(tag: string) {
		await notesStore.deleteTag(normaliseTag(tag));
	}
</script>
<template>
	<div class="p-1 border rounded mb-3">
		<button ref="dropdown-toggle" class="btn btn-sm btn-outline-primary dropdown-toggle" @click="toggle">Tags</button>
		<ul v-if="show" ref="dropdown-menu" class="dropdown-menu show p-2">
			<li>
				<label>
					<input type="checkbox" :checked="allSelected" :disabled="!filteredTags.length" @change="toggleSelectAll"/>
					<span class="ms-2">{{ allSelected ? "Deselect All" : "Select All" }}</span>
				</label>
			</li>
			<li><hr class="dropdown-divider"/></li>
			<li>
				<div :class="{ [`input-group`]: allowCreate }">
					<input v-model.trim="searchText" type="text" class="form-control" placeholder="Search"/>
					<button v-if="allowCreate" class="btn btn-outline-primary" :disabled="hasExactMatch">
						<Icon type="plusLg"/>
					</button>
				</div>
			</li>
			<li><hr class="dropdown-divider"/></li>
			<li v-for="tag in filteredTags">
				<label>
					<input type="checkbox" :value="tag" v-model="selectedTags"/>
					<span class="ms-2">{{ tag }}</span>
				</label>
			</li>
		</ul>
		<div v-if="selectedTags.length" class="d-inline-flex flex-wrap gap-2 align-middle ms-3">
			<div v-for="tag in selectedTags" class="badge text-bg-secondary">
				<span>{{ tag }}</span>
				<button class="small btn-close ms-2" @click="removeTagFromFilter(tag)"></button>
			</div>
		</div>
	</div>
</template>