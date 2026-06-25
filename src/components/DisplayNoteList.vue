<script setup lang="ts">
	import { computed, onMounted, watch } from "vue";
	import { onBeforeRouteLeave } from "vue-router";
	import { hydrateNotes, useNotesStore } from "@/stores/notes";
	import { useAppStore } from "@/stores/app";
	import { useFileIO } from "@/composables/useFileIO";
	import { useNoteSelection } from "@/composables/useNoteSelection";
	import { useNoteSort } from "@/composables/useNoteSort";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { emptyString } from "@/constants/common";
	import { bulkActions } from "@/constants/actions";
	import Icon from "@/components/Icon.vue";
	import SelectionActionBar from "@/components/SelectionActionBar.vue";
	import Toast from "@/components/Toast.vue";
	import NoteCard from "@/components/NoteCard.vue";
	import EmptyState from "@/components/EmptyState.vue";
	import SortControls from "@/components/SortControls.vue";
	import type { NoteModel } from "@/models/NoteModel";
	import type { UUID } from "crypto";

	type NoteSection = {
		key: string;
		notes: NoteModel[];
		divider?: string;
		showNewCard?: boolean;
	};

	const props = defineProps<{ view?: View }>();
	const view = computed<View>(() => props.view ?? "active");
	const notesStore = useNotesStore();
	const appStore = useAppStore();
	const { importFiles, importErrors, dismissErrors, exportNotes, exportAllNotes } = useFileIO();
	const { isSelectionMode, selectedCount, enterSelectionMode, exitSelectionMode, toggleSelection, isSelected, selectAll, clearSelection } = useNoteSelection();
	const { sortBy, sortDirection, setSortBy, toggleSortDirection, getSortedNotes } = useNoteSort();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isSearchMode = computed(() => !!notesStore.searchText);
	const sourceNotes = computed(() => {
		switch (view.value) {
			case "favourited":
				return notesStore.favedNotes;
			case "archived":
				return notesStore.archivedNotes;
			case "trash":
				return notesStore.trashedNotes;
			default:
				return notesStore.activeNotes;
		}
	});
	const sortedNotes = computed(() => getSortedNotes(sourceNotes.value));
	const noteSections = computed<NoteSection[]>(() => {
		if (view.value === "favourited") {
			const sections: NoteSection[] = [
				{
					key: "active",
					notes: sortedNotes.value.filter(n => !n.archivedAt)
				}
			];
			const archived = sortedNotes.value.filter(n => n.archivedAt);
			if (archived.length) {
				sections.push({
					key: "archived",
					notes: archived,
					divider: "ARCHIVE"
				});
			}
			return sections;
		}
		return [
			{
				key: "all",
				notes: sortedNotes.value,
				showNewCard: view.value === "active"
			}
		];
	});
	const hasNotes = computed(() => sourceNotes.value.length > 0);
	const allSelected = computed(() => sourceNotes.value.length > 0 && selectedCount.value === sourceNotes.value.length);
	const selectAllText = computed(() => (allSelected.value ? "Deselect All" : "Select All"));
	const pageTitle = computed(() => {
		switch (view.value) {
			case "favourited":
				return "Favourited";
			case "archived":
				return "Archived";
			case "trash":
				return "Trash";
			default:
				return "Notes";
		}
	});
	const emptyMessage = computed(() => {
		if (isSearchMode.value) {
			return `No results found for "${notesStore.searchText}"`;
		}
		switch (view.value) {
			case "favourited":
				return "No favourited notes";
			case "archived":
				return "No archived notes";
			case "trash":
				return "Trash is empty";
			default:
				return "No notes yet";
		}
	});
	const selectionActions = computed<SelectionAction[]>(() => {
		if (view.value === "trash") {
			return bulkActions.filter(action => action.key === "restore" || action.key === "permanent");
		}
		const actionKeys = new Set<SelectionAction["key"]>(["export", "trash"]);
		switch (view.value) {
			case "favourited": {
				actionKeys.add("unfave");
				break;
			}
			case "archived": {
				actionKeys.add("unarchive");
				break;
			}
			default: {
				actionKeys.add("fave");
				actionKeys.add("archive");
				break;
			}
		}
		return bulkActions.filter(action => actionKeys.has(action.key));
	});

	function formatImportErrors(): string {
		return [`Import failed for the following file`, importErrors.value?.length === 1 ? emptyString : "s", ":<hr/>", `<ul>${importErrors.value?.map(err => `<li>${err.fileName}: ${err.message}</li>`).join(emptyString)}</ul>`].join(emptyString);
	}

	function toggleSelectAll() {
		if (allSelected.value) {
			clearSelection();
		} else {
			selectAll(sourceNotes.value.map(n => n.id));
		}
	}

	function getSelectedNotes(): NoteModel[] {
		return sourceNotes.value.filter(n => isSelected(n.id));
	}

	function getSelectedIds(): UUID[] {
		return getSelectedNotes().map(n => n.id);
	}

	async function handleImport() {
		const importedCount = await importFiles();
		if (importedCount > 0) {
			requestSync();
		}
	}

	async function handleSelectionAction(key: SelectionAction["key"]) {
		const ids = getSelectedIds();
		if (ids.length === 0) {
			return;
		}
		let syncNotes = true;
		let purgeNotes = false;
		const noun = ids.length === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				await exportNotes(getSelectedNotes());
				syncNotes = false;
				break;
			}
			case "fave": {
				await notesStore.faveMultiple(ids);
				break;
			}
			case "unfave": {
				await notesStore.unfaveMultiple(ids);
				break;
			}
			case "archive": {
				await notesStore.archiveMultiple(ids);
				break;
			}
			case "unarchive": {
				await notesStore.unarchiveMultiple(ids);
				break;
			}
			case "trash": {
				const ok = await confirm({
					title: `Move ${ids.length} ${noun} to Trash?`,
					message: `${ids.length === 1 ? "This note" : "These notes"} can be restored from Trash within 30 days.`,
					confirmText: "Move to Trash",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				await notesStore.trashMultiple(ids);
				break;
			}
			case "restore": {
				await notesStore.restoreFromTrashMultiple(ids);
				break;
			}
			case "permanent": {
				const ok = await confirm({
					title: `Permanently delete ${ids.length} ${noun}?`,
					message: "This action cannot be undone.",
					confirmText: "Delete Permanently",
					cancelText: "Cancel",
					variant: "danger"
				});
				if (!ok) {
					return;
				}
				await notesStore.permanentlyDeleteMultiple(ids);
				purgeNotes = true;
				break;
			}
		}
		if (syncNotes) {
			requestSync(purgeNotes ? ids : undefined);
		}
		exitSelectionMode();
	}

	async function handleEmptyTrash() {
		const count = notesStore.trashedNotes.length;
		if (count === 0) {
			return;
		}
		const ok = await confirm({
			title: "Empty Trash?",
			message: `${count} ${count === 1 ? "note" : "notes"} will be permanently deleted. This cannot be undone.`,
			confirmText: "Empty Trash",
			cancelText: "Cancel",
			variant: "danger"
		});
		if (!ok) {
			return;
		}
		const trashedNoteIds = notesStore.trashedNotes.map(n => n.id);
		await notesStore.permanentlyDeleteMultiple(trashedNoteIds);
		requestSync(trashedNoteIds);
	}

	onMounted(async () => {
		await hydrateNotes();
		const purgedIds = await notesStore.purgeExpiredTrash();
		if (purgedIds.length > 0) {
			requestSync(purgedIds);
		}
		exitSelectionMode();
	});

	onBeforeRouteLeave(() => {
		appStore.setLastView(view.value);
	});

	watch(view, exitSelectionMode);
</script>

<template>
	<div v-if="view !== `active`" class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
		<h2 class="mb-0">{{ pageTitle }}</h2>
		<RouterLink to="/notes" class="btn btn-secondary btn-sm">
			<Icon type="chevronLeft"/>
			<span class="ms-2">Back to Notes</span>
		</RouterLink>
	</div>
	<template v-if="notesStore.isLoading || notesStore.isSearching">
		<div class="d-flex flex-column justify-content-center align-items-center">
			<div class="spinner-border" aria-hidden="true"></div>
			<div class="mt-3" role="status">{{ notesStore.isSearching ? "Searching..." : "Loading notes..." }}</div>
		</div>
	</template>
	<EmptyState v-else-if="!hasNotes" :message="emptyMessage" :show-actions="view === `active` && !isSearchMode" @import="handleImport"/>
	<template v-else>
		<div class="d-flex gap-2 mb-3 justify-content-end flex-wrap">
			<template v-if="isSelectionMode">
				<button class="btn btn-outline-secondary btn-sm" @click="toggleSelectAll" :title="selectAllText" :aria-label="selectAllText">
					<Icon :type="allSelected ? `list` : `listCheck`"/>
					<span class="d-none d-sm-inline ms-2">{{ selectAllText }}</span>
				</button>
				<button class="btn btn-outline-secondary btn-sm" @click="exitSelectionMode" title="Cancel" aria-label="Cancel">
					<Icon type="xCircle"/>
					<span class="d-none d-sm-inline ms-2">Cancel</span>
				</button>
			</template>
			<template v-else>
				<SortControls :sort-by="sortBy" :sort-direction="sortDirection" @change-field="setSortBy" @toggle-direction="toggleSortDirection"/>
				<button class="btn btn-outline-secondary btn-sm" @click="enterSelectionMode" title="Select" aria-label="Select">
					<Icon type="check2Square"/>
					<span class="d-none d-sm-inline ms-2">Select</span>
				</button>
				<template v-if="view === `active`">
					<button class="btn btn-outline-secondary btn-sm" @click="handleImport" title="Import" aria-label="Import">
						<Icon type="boxArrowDownRight"/>
						<span class="d-none d-sm-inline ms-2">Import</span>
					</button>
					<button class="btn btn-outline-secondary btn-sm" @click="exportAllNotes" title="Export All" aria-label="Export All">
						<Icon type="boxArrowUpRight"/>
						<span class="d-none d-sm-inline ms-2">Export All</span>
					</button>
					<RouterLink to="/notes/favourite" class="btn btn-outline-secondary btn-sm" title="Favourited" aria-label="Favourited">
						<Icon type="star"/>
						<span class="d-none d-sm-inline ms-2">Favourited</span>
					</RouterLink>
					<RouterLink to="/notes/archive" class="btn btn-outline-secondary btn-sm" title="Archived" aria-label="Archived">
						<Icon type="archive"/>
						<span class="d-none d-sm-inline ms-2">Archived</span>
					</RouterLink>
					<RouterLink to="/notes/trash" class="btn btn-outline-secondary btn-sm" title="Trash" aria-label="Trash">
						<Icon type="trash"/>
						<span class="d-none d-sm-inline ms-2">Trash</span>
					</RouterLink>
				</template>
				<template v-if="view === `trash`">
					<button class="btn btn-outline-danger btn-sm" @click="handleEmptyTrash" title="Empty Trash" aria-label="Empty Trash">
						<Icon type="trashFill"/>
						<span class="d-none d-sm-inline ms-2">Empty Trash</span>
					</button>
				</template>
			</template>
		</div>
		<template v-for="section in noteSections" :key="section.key">
			<div v-if="section.divider" class="d-flex align-items-center my-4">
				<div class="flex-grow-1 border-bottom"></div>
				<span class="px-3 text-muted small">{{ section.divider }}</span>
				<div class="flex-grow-1 border-bottom"></div>
			</div>
			<div class="notes-grid">
				<RouterLink v-if="section.showNewCard && !isSelectionMode" to="/notes/new" class="card note-card new-note-card text-decoration-none">
					<div class="card-body d-flex align-items-center justify-content-center">
						<span class="fs-1 text-muted">+</span>
					</div>
				</RouterLink>
				<NoteCard v-for="note in section.notes" :key="note.id" :note="note" :selection-mode="isSelectionMode" :selected="isSelected(note.id)" @toggle-select="toggleSelection"/>
			</div>
		</template>
		<SelectionActionBar v-if="isSelectionMode && selectedCount > 0" :selected-count="selectedCount" :actions="selectionActions" @action="handleSelectionAction" @cancel="exitSelectionMode"/>
	</template>
	<Toast v-if="importErrors?.length" :message="formatImportErrors()" type="error" :timeStamp="Date.now()" @dismiss="dismissErrors"/>
</template>