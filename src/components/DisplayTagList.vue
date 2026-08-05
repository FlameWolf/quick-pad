<script setup lang="ts">
	import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
	import { useRouter } from "vue-router";
	import { emptyString } from "@/constants/common";
	import { areSetsEqual, normaliseTag, titleCase } from "@/utils/common";
	import { getTime } from "@/utils/dates";
	import { contains, equals, sort } from "@/utils/text-analysis";
	import * as notesStore from "@/stores/notes";
	import { confirm } from "@/composables/useConfirmDialogue";
	import { useDropdown } from "@/composables/useDropdown";
	import { exitSelectionMode, isSelecting, selectedCount, selectedIds } from "@/composables/useNoteSelection";
	import { requestSync } from "@/composables/useNotesSync";
	import { useTruncate } from "@/composables/useTruncate";
	import Icon from "@/components/Icon.vue";

	let syncingUp = false;
	let syncingDown = false;
	let lastSelected: string[] = [];
	const props = defineProps<{
		activeTags?: string[];
		allowCreate?: boolean;
		allowDelete?: boolean;
		allowEdit?: boolean;
		allowManage?: boolean;
		showFilterType?: boolean;
	}>();
	const emit = defineEmits<{
		selectionChanged: [tags: string[]];
	}>();
	const router = useRouter();
	const searchText = ref(emptyString);
	const selectedTags = ref<string[]>([]);
	const appElem = document.getElementById("app")!;
	const dropdownToggle = useTemplateRef("dropdown-toggle");
	const dropdownMenu = useTemplateRef("dropdown-menu");
	const dropdown = useDropdown(dropdownToggle, {
		autoClose: false,
		dropdown: dropdownMenu
	});
	const filteredTags = computed(() => sort(!searchText.value ? notesStore.tags.value : notesStore.tags.value.filter(tag => contains(tag, searchText.value))));
	const allSelected = computed(() => filteredTags.value.every(tag => selectedTags.value.includes(tag)));
	const hasExactMatch = computed(() => !searchText.value || notesStore.tags.value.some(tag => equals(tag, normaliseTag(searchText.value))));
	const enableActions = computed(() => !!(selectedCount.value && selectedTags.value.length));

	function syncState(direction: "up" | "down") {
		if (!props.allowEdit || isSelecting.value) {
			return;
		}
		if (areSetsEqual(new Set(selectedTags.value), notesStore.searchTags.value)) {
			return;
		}
		switch (direction) {
			case "up": {
				syncingUp = true;
				notesStore.setSearchTags(selectedTags.value);
				break;
			}
			case "down": {
				syncingDown = true;
				selectedTags.value = Array.from(notesStore.searchTags.value);
				break;
			}
		}
	}

	function adjustAppHeight() {
		appElem.removeAttribute("style");
		const menuElem = dropdownMenu.value;
		if (!menuElem) {
			return;
		}
		const bottom = menuElem.getBoundingClientRect().bottom + window.scrollY;
		if (bottom > appElem.offsetHeight) {
			appElem.style.minHeight = `${bottom + 16}px`;
		}
	}

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
		dropdown.toggle();
		const ok = await confirm({
			title: `Delete selected tag${suffix} permanently?`,
			message: `The selected tag${suffix} will be deleted permanently. ${hasMany ? "They" : "It"} will also be removed from any notes that use ${hasMany ? "them" : "it"}.`,
			confirmText: "Delete Tags",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (ok) {
			selectedTags.value = selectedTags.value.filter(tag => !tags.includes(tag));
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
		exitSelectionMode();
	}

	function addToSearchTags(tag: string) {
		if (props.allowEdit) {
			return;
		}
		notesStore.addSearchTag(tag);
		router.push("/");
	}

	useTruncate(useTemplateRef("tag-input"), searchText, 256);

	onMounted(() => {
		selectedTags.value = props.activeTags ?? [];
		window.addEventListener("resize", adjustAppHeight);
	});

	onBeforeUnmount(() => {
		window.removeEventListener("resize", adjustAppHeight);
	});

	watch([dropdown.show, filteredTags], () => setTimeout(adjustAppHeight));

	watch(isSelecting, (curr, prev) => {
		if (!prev) {
			lastSelected = Array.from(selectedTags.value);
		}
		if (!curr) {
			selectedTags.value = Array.from(lastSelected);
		}
	});

	watch(
		() => props.allowEdit,
		value => {
			if (!value) {
				selectedTags.value = props.activeTags ?? [];
			}
		}
	);

	watch(
		selectedTags,
		tags => {
			emit("selectionChanged", tags);
			if (!syncingDown && props.allowManage) {
				syncState("up");
			}
			syncingDown = false;
			setTimeout(adjustAppHeight);
		},
		{ deep: true }
	);

	watch(notesStore.searchTags, () => {
		if (!syncingUp) {
			syncState("down");
		}
		syncingUp = false;
	});
</script>
<template>
	<div class="d-flex flex-wrap gap-2 p-1 border rounded">
		<div class="dropdown">
			<button v-if="props.allowEdit" ref="dropdown-toggle" class="btn btn-sm btn-outline-secondary dropdown-toggle" @click="dropdown.toggle">Tags</button>
			<label v-else class="small border border-secondary rounded px-2 py-1">Tags</label>
			<ul v-if="props.allowEdit && dropdown.show.value" ref="dropdown-menu" class="dropdown-menu show tag-list mt-1 ms-n1">
				<template v-if="props.allowManage">
					<li class="dropdown-item d-flex flex-wrap gap-2">
						<label class="btn btn-sm btn-outline-secondary flex-grow-1">
							<input type="checkbox" class="form-check-input" :checked="allSelected" :disabled="!filteredTags.length" @change="toggleSelectAll"/>
							<span class="ms-2">{{ allSelected ? "Deselect All" : "Select All" }}</span>
						</label>
						<button v-if="props.allowDelete" class="btn btn-sm btn-outline-danger flex-grow-1" :disabled="!selectedTags.length" @click="deleteTags(selectedTags)">Delete Selected</button>
					</li>
					<li class="dropdown-divider"></li>
				</template>
				<li class="dropdown-item">
					<div class="flex-nowrap" :class="{ [`input-group`]: props.allowCreate }">
						<input ref="tag-input" v-model.trim="searchText" type="text" class="form-control form-control-sm" placeholder="Search"/>
						<button v-if="props.allowCreate" class="btn btn-sm btn-outline-secondary" :disabled="hasExactMatch" @click="createTag(searchText)">
							<Icon type="plusLg"/>
						</button>
					</div>
				</li>
				<li class="dropdown-divider"></li>
				<li v-for="tag in filteredTags">
					<label class="dropdown-item">
						<input type="checkbox" class="form-check-input" :checked="isTagSelected(tag)" @change="toggleTagSelection(tag)"/>
						<span class="text-wrap text-break ms-2">{{ tag }}</span>
					</label>
				</li>
			</ul>
		</div>
		<div v-if="selectedTags.length" class="d-flex flex-wrap gap-2">
			<component :is="props.allowEdit ? `div` : `a`" v-for="tag in selectedTags" class="badge align-self-center text-bg-secondary" :class="{ [`py-2`]: !props.allowEdit }" @click="addToSearchTags(tag)" v-bind="props.allowEdit ? {} : { [`role`]: `button` }">
				<span>{{ tag }}</span>
				<button v-if="props.allowEdit" class="small btn-close ms-2" @click="unselectTag(tag)"></button>
			</component>
		</div>
		<div v-if="props.showFilterType && selectedTags.length" class="input-group input-group-sm flex-nowrap w-auto ms-auto">
			<span class="input-group-text">Match:</span>
			<label class="btn btn-outline-secondary" :class="{ [`active`]: notesStore.tagFilter.value === `any` }">
				<input type="radio" class="btn-check" name="filter-type" @change="notesStore.setFilterType(`any`)"/>
				<span>Any</span>
			</label>
			<label class="btn btn-outline-secondary" :class="{ [`active`]: notesStore.tagFilter.value === `all` }">
				<input type="radio" class="btn-check" name="filter-type" @change="notesStore.setFilterType(`all`)"/>
				<span>All</span>
			</label>
		</div>
		<div v-if="isSelecting" class="d-flex gap-2 ms-auto">
			<button class="btn btn-sm btn-outline-primary" :disabled="!enableActions" @click="updateNoteTags(`add`)">Apply</button>
			<button class="btn btn-sm btn-outline-danger" :disabled="!enableActions" @click="updateNoteTags(`remove`)">Remove</button>
		</div>
	</div>
</template>