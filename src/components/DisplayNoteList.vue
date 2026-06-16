<script setup lang="ts">
	import { useNotesStore } from "@/stores/notes";
	import { useFileIO } from "@/composables/useFileIO";
	import { useNoteSelection } from "@/composables/useNoteSelection";
	import { useNoteSort } from "@/composables/useNoteSort";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { computed, onMounted, watch } from "vue";
	import { emptyString } from "@/constants/common";
	import SelectionActionBar, { type SelectionAction } from "@/components/SelectionActionBar.vue";
	import Toast from "@/components/Toast.vue";
	import NoteCard from "@/components/NoteCard.vue";
	import EmptyState from "@/components/EmptyState.vue";
	import SortControls from "@/components/SortControls.vue";
	import type { NoteModel } from "@/models/NoteModel";
	import type { UUID } from "crypto";

	type View = "active" | "faved" | "archived" | "trash";

	const props = defineProps<{ view?: View }>();
	const view = computed<View>(() => props.view ?? "active");
	const notesStore = useNotesStore();
	const { importFiles, importErrors, dismissErrors, exportNotes, exportAllNotes } = useFileIO();
	const { isSelectionMode, selectedCount, enterSelectionMode, exitSelectionMode, toggleSelection, isSelected, selectAll, clearSelection } = useNoteSelection();
	const { sortBy, sortDirection, setSortBy, toggleSortDirection, getSortedNotes } = useNoteSort();
	const { confirm } = useConfirmDialog();
	const { requestSync } = useNotesSync();
	const isSearchMode = computed(() => !!notesStore.searchText);
	const sourceNotes = computed(() => {
		switch (view.value) {
			case "faved":
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
	const hasNotes = computed(() => sourceNotes.value.length > 0);
	const allSelected = computed(() => sourceNotes.value.length > 0 && selectedCount.value === sourceNotes.value.length);
	const pageTitle = computed(() => {
		if (view.value === "archived") {
			return "Archived";
		}
		if (view.value === "trash") {
			return "Trash";
		}
		return "Notes";
	});
	const emptyMessage = computed(() => {
		if (isSearchMode.value) {
			return `No results found for "${notesStore.searchText}"`;
		}
		switch (view.value) {
			case "faved":
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
		if(view.value === "trash") {
			return [
				{ key: "restore", label: "Restore Selected", variant: "outline-primary" },
				{ key: "permanent", label: "Delete Permanently", variant: "outline-danger" }
			];
		}
		const defaultActions: SelectionAction[] = [
			{ key: "export", label: "Export Selected", variant: "primary" },
			{ key: "archive", label: "Archive Selected", variant: "outline-primary" },
			{ key: "trash", label: "Delete Selected", variant: "outline-danger" }
		];
		switch (view.value) {
			case "faved": {
				defaultActions[1] = { key: "unfave", label: "Unfavourite Selected", variant: "outline-primary" };
				break;
			}
			case "archived": {
				defaultActions[1] = { key: "unarchive", label: "Unarchive Selected", variant: "outline-primary" };
				break;
			}
			default: {
				break;
			}
		}
		return defaultActions;
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

	async function handleSelectionAction(key: string) {
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

	onMounted(() => {
		exitSelectionMode();
	});

	watch(view, exitSelectionMode);
</script>

<template>
	<div v-if="view !== `active`" class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
		<h2 class="mb-0">{{ pageTitle }}</h2>
		<RouterLink to="/notes" class="btn btn-secondary btn-sm">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
				<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>
			</svg>
			<span>&#xA0;Back to Notes</span>
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
				<button class="btn btn-outline-secondary btn-sm" @click="toggleSelectAll">{{ allSelected ? "Deselect All" : "Select All" }}</button>
				<button class="btn btn-outline-secondary btn-sm" @click="exitSelectionMode">Cancel</button>
			</template>
			<template v-else>
				<SortControls :sort-by="sortBy" :sort-direction="sortDirection" @change-field="setSortBy" @toggle-direction="toggleSortDirection"/>
				<button class="btn btn-outline-secondary btn-sm" @click="enterSelectionMode">Select</button>
				<template v-if="view === `active`">
					<button class="btn btn-outline-secondary btn-sm" @click="handleImport">Import</button>
					<button class="btn btn-outline-secondary btn-sm" @click="exportAllNotes">Export All</button>
					<RouterLink to="/notes/archive" class="btn btn-outline-secondary btn-sm">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-archive me-1" viewBox="0 0 16 16">
							<path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5"/>
						</svg>
						<span>Archived</span>
					</RouterLink>
					<RouterLink to="/notes/trash" class="btn btn-outline-secondary btn-sm">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash me-1" viewBox="0 0 16 16">
							<path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
							<path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
						</svg>
						<span>Trash</span>
					</RouterLink>
				</template>
				<template v-if="view === `trash`">
					<button class="btn btn-outline-danger btn-sm" @click="handleEmptyTrash">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash-fill me-1" viewBox="0 0 16 16">
							<path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0"/>
						</svg>
						<span>Empty Trash</span>
					</button>
				</template>
			</template>
		</div>
		<div class="notes-grid">
			<RouterLink v-if="view === `active` && !isSelectionMode" to="/notes/new" class="card note-card new-note-card text-decoration-none">
				<div class="card-body d-flex align-items-center justify-content-center">
					<span class="fs-1 text-muted">+</span>
				</div>
			</RouterLink>
			<NoteCard v-for="note in sortedNotes" :key="note.id" :note="note" :selection-mode="isSelectionMode" :selected="isSelected(note.id)" @toggle-select="toggleSelection"/>
		</div>
		<SelectionActionBar v-if="isSelectionMode && selectedCount > 0" :selected-count="selectedCount" :actions="selectionActions" @action="handleSelectionAction" @cancel="exitSelectionMode"/>
	</template>
	<Toast v-if="importErrors?.length" :message="formatImportErrors()" type="error" :visible="!!importErrors.length" :timeStamp="Date.now()" @dismiss="dismissErrors"/>
</template>

<style>
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.75rem;
	}
	.new-note-card {
		border-style: dashed;
		opacity: 0.7;
	}
	.new-note-card:hover {
		opacity: 1;
	}
</style>