<script setup lang="ts">
	import { computed, ref, toValue, useTemplateRef, watch } from "vue";
	import { emptyString } from "@/constants/common";
	import { normaliseTag } from "@/utils/common";
	import { contains, equals } from "@/utils/text-analysis";
	import * as notesStore from "@/stores/notes";
	import { confirm } from "@/composables/useConfirmDialogue";
	import { useDropdown } from "@/composables/useDropdown";
	import { requestSync } from "@/composables/useNotesSync";
	import Icon from "@/components/Icon.vue";

	const props = defineProps<{
		activeTags?: string[];
		allowManage?: boolean;
		allowCreate?: boolean;
		allowDelete?: boolean;
		allowEdit?: boolean;
	}>();
	const emit = defineEmits<{
		selectionChanged: [tags: string[]];
	}>();
	const dropdownToggle = useTemplateRef("dropdown-toggle");
	const dropdownMenu = useTemplateRef("dropdown-menu");
	const searchText = ref(emptyString);
	const selectedTags = ref<string[]>(toValue(props.activeTags) ?? []);
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
		if (!searchText.value) {
			return true;
		}
		return notesStore.tags.value.some(tag => equals(tag, normaliseTag(searchText.value)));
	});

	function isTagSelected(tag: string) {
		return selectedTags.value.includes(tag);
	}

	function toggleTagSelection(tag: string) {
		if (isTagSelected(tag)) {
			selectedTags.value.splice(selectedTags.value.indexOf(tag), 1);
			return;
		}
		selectedTags.value.push(tag);
	}

	function toggleSelectAll() {
		if (!allSelected.value) {
			selectedTags.value = Array.from(filteredTags.value);
			return;
		}
		selectedTags.value = [];
	}

	function unselectTag(tag: string) {
		const index = selectedTags.value.indexOf(tag);
		if (index !== -1) {
			selectedTags.value.splice(index, 1);
		}
	}

	async function createTag(tag: string) {
		const normalised = normaliseTag(tag);
		await notesStore.createTag(normalised);
		selectedTags.value.push(normalised);
	}

	async function deleteTags(tags: string[]) {
		const hasMany = tags.length > 1;
		const suffix = hasMany ? "s" : emptyString;
		const ok = await confirm({
			title: `Delete selected tag${suffix} permanently?`,
			message: `The selected tag${suffix} will be deleted permanently. ${hasMany ? "They" : "It"} will also be removed from any notes that use ${hasMany ? "them" : "it"}.`,
			confirmText: "Delete Tags",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (ok) {
			tags.forEach(unselectTag);
			const affectedCount = await notesStore.deleteTags(tags.map(normaliseTag));
			if (affectedCount) {
				requestSync();
			}
		}
	}

	watch(
		selectedTags,
		tags => {
			emit("selectionChanged", tags);
		},
		{
			deep: true
		}
	);
</script>
<template>
	<div class="p-1 border rounded mb-3">
		<button v-if="props.allowEdit" ref="dropdown-toggle" class="btn btn-sm btn-outline-primary dropdown-toggle" @click="toggle">Tags</button>
		<label v-else>Tags:</label>
		<ul v-if="props.allowEdit && show" ref="dropdown-menu" class="dropdown-menu show p-2 mt-1">
			<template v-if="props.allowManage">
				<li>
					<label class="btn btn-sm btn-outline-primary">
						<input type="checkbox" :checked="allSelected" :disabled="!filteredTags.length" @change="toggleSelectAll"/>
						<span class="ms-2">{{ allSelected ? "Deselect All" : "Select All" }}</span>
					</label>
					<button v-if="props.allowDelete" class="btn btn-sm btn-outline-danger ms-2" :disabled="!selectedTags.length" @click="deleteTags(selectedTags)">Delete Selected</button>
				</li>
				<li><hr class="dropdown-divider"/></li>
			</template>
			<li :class="{ [`input-group`]: props.allowCreate }">
				<input v-model.trim="searchText" type="text" class="form-control form-control-sm" placeholder="Search"/>
				<button v-if="props.allowCreate" class="btn btn-sm btn-outline-primary" :disabled="hasExactMatch" @click="createTag(searchText)">
					<Icon type="plusLg"/>
				</button>
			</li>
			<li><hr class="dropdown-divider"/></li>
			<li v-for="tag in filteredTags">
				<label>
					<input type="checkbox" :checked="isTagSelected(tag)" @change="toggleTagSelection(tag)"/>
					<span class="ms-2">{{ tag }}</span>
				</label>
			</li>
		</ul>
		<div v-if="selectedTags.length" class="d-inline-flex flex-wrap gap-2 align-middle ms-3">
			<div v-for="tag in selectedTags" class="badge text-bg-secondary">
				<span>{{ tag }}</span>
				<button class="small btn-close ms-2" @click="unselectTag(tag)"></button>
			</div>
		</div>
	</div>
</template>