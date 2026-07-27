<script setup lang="ts">
	import { computed, ref, useTemplateRef, watch } from "vue";
	import { emptyString } from "@/constants/common";
	import { normaliseTag, titleCase } from "@/utils/common";
	import { getTime } from "@/utils/dates";
	import { contains, equals } from "@/utils/text-analysis";
	import * as notesStore from "@/stores/notes";
	import { confirm } from "@/composables/useConfirmDialogue";
	import { useDropdown } from "@/composables/useDropdown";
	import { isSelecting, selectedCount, selectedIds } from "@/composables/useNoteSelection";
	import { requestSync } from "@/composables/useNotesSync";
	import Icon from "@/components/Icon.vue";

	let lastSelected: string[] = [];
	const props = defineProps<{
		activeTags?: string[];
		allowCreate?: boolean;
		allowDelete?: boolean;
		allowEdit?: boolean;
		allowManage?: boolean;
	}>();
	const emit = defineEmits<{
		selectionChanged: [tags: string[]];
	}>();
	const dropdownToggle = useTemplateRef("dropdown-toggle");
	const dropdownMenu = useTemplateRef("dropdown-menu");
	const searchText = ref(emptyString);
	const selectedTags = ref(props.activeTags ?? []);
	const shouldEmit = ref(true);
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
	const enableActions = computed(() => !!(selectedCount.value && selectedTags.value.length));

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

	async function updateNoteTags(action: "add" | "remove") {
		const now = Date.now();
		const isAdding = action === "add";
		const ok = await confirm({
			title: `${titleCase(action)} tags`,
			message: `The selected tags will be ${isAdding ? "added" : "removed"} ${isAdding ? "to" : "from"} the selected notes. Do you want to proceed?`,
			confirmText: "Confirm",
			cancelText: "Cancel",
			variant: "warning"
		});
		if (!ok) {
			return;
		}
		switch (action) {
			case "add": {
				notesStore.addTagsMultiple(Array.from(selectedIds.value), selectedTags.value);
				break;
			}
			case "remove": {
				notesStore.removeTagsMultiple(Array.from(selectedIds.value), selectedTags.value);
				break;
			}
		}
		if (notesStore.notes.value.some(note => selectedIds.value.has(note.id) && getTime(note.stateChangedAt) > now)) {
			requestSync();
		}
	}

	watch(
		selectedTags,
		tags => {
			if (shouldEmit.value) {
				emit("selectionChanged", tags);
			}
			shouldEmit.value = true;
		},
		{ deep: true }
	);

	watch(isSelecting, (curr, prev) => {
		if (prev === false) {
			lastSelected = Array.from(selectedTags.value);
		}
		if (curr === false) {
			selectedTags.value = Array.from(lastSelected);
		}
		emit("selectionChanged", selectedTags.value);
	});

	watch(
		() => props.activeTags,
		tags => {
			shouldEmit.value = false;
			selectedTags.value = tags ?? [];
		},
		{ deep: true }
	);
</script>
<template>
	<div class="d-flex p-1 border rounded">
		<div class="dropdown">
			<button v-if="props.allowEdit" ref="dropdown-toggle" class="btn btn-sm btn-outline-primary dropdown-toggle" @click="toggle">Tags</button>
			<label v-else class="small border border-primary rounded px-2 py-1">Tags</label>
			<ul v-if="props.allowEdit && show" ref="dropdown-menu" class="dropdown-menu show mt-1 ms-n1">
				<template v-if="props.allowManage">
					<li class="dropdown-item">
						<label class="btn btn-sm btn-outline-primary">
							<input type="checkbox" :checked="allSelected" :disabled="!filteredTags.length" @change="toggleSelectAll"/>
							<span class="ms-2">{{ allSelected ? "Deselect All" : "Select All" }}</span>
						</label>
						<button v-if="props.allowDelete" class="btn btn-sm btn-outline-danger ms-2" :disabled="!selectedTags.length" @click="deleteTags(selectedTags)">Delete Selected</button>
					</li>
					<li class="dropdown-divider"></li>
				</template>
				<li class="dropdown-item" :class="{ [`input-group`]: props.allowCreate }">
					<input v-model.trim="searchText" type="text" class="form-control form-control-sm" placeholder="Search"/>
					<button v-if="props.allowCreate" class="btn btn-sm btn-outline-primary" :disabled="hasExactMatch" @click="createTag(searchText)">
						<Icon type="plusLg"/>
					</button>
				</li>
				<li class="dropdown-divider"></li>
				<li v-for="tag in filteredTags">
					<label class="dropdown-item">
						<input type="checkbox" :checked="isTagSelected(tag)" @change="toggleTagSelection(tag)"/>
						<span class="ms-2">{{ tag }}</span>
					</label>
				</li>
			</ul>
		</div>
		<div v-if="selectedTags.length" class="d-flex flex-wrap gap-2 ms-2">
			<div v-for="tag in selectedTags" class="badge align-self-center text-bg-secondary" :class="{ [`py-2`]: !props.allowEdit }">
				<span>{{ tag }}</span>
				<button v-if="props.allowEdit" class="small btn-close ms-2" @click="unselectTag(tag)"></button>
			</div>
		</div>
		<div v-if="props.allowManage && isSelecting" class="d-flex gap-2 ms-auto">
			<button class="btn btn-sm btn-primary" :disabled="!enableActions" @click="updateNoteTags(`add`)">Apply</button>
			<button class="btn btn-sm btn-primary" :disabled="!enableActions" @click="updateNoteTags(`remove`)">Remove</button>
		</div>
	</div>
</template>