<script setup lang="ts">
	import { useNotesStore } from "@/stores/notes";
	import { useFileIO } from "@/composables/useFileIO";
	import { useNoteSelection } from "@/composables/useNoteSelection";
	import { useNoteSort, type SortField } from "@/composables/useNoteSort";
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { useNotesSync } from "@/composables/useNotesSync";
	import { computed, onMounted, watch } from "vue";
	import { emptyString } from "@/library";
	import SelectionActionBar, { type SelectionAction } from "@/components/SelectionActionBar.vue";
	import Toast from "@/components/Toast.vue";
	import type { UUID } from "crypto";

	type View = "active" | "archived" | "trash";

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
			case "archived":
				return "No archived notes";
			case "trash":
				return "Trash is empty";
			default:
				return "No notes yet";
		}
	});
	const selectionActions = computed<SelectionAction[]>(() => {
		if (view.value === "archived") {
			return [
				{ key: "export", label: "Export Selected", variant: "primary" },
				{ key: "unarchive", label: "Unarchive Selected", variant: "outline-primary" },
				{ key: "trash", label: "Delete Selected", variant: "outline-danger" }
			];
		}
		if (view.value === "trash") {
			return [
				{ key: "restore", label: "Restore Selected", variant: "outline-primary" },
				{ key: "permanent", label: "Delete Permanently", variant: "outline-danger" }
			];
		}
		return [
			{ key: "export", label: "Export Selected", variant: "primary" },
			{ key: "archive", label: "Archive Selected", variant: "outline-primary" },
			{ key: "trash", label: "Delete Selected", variant: "outline-danger" }
		];
	});

	function onSortFieldChange(e: Event) {
		setSortBy((e.target as HTMLSelectElement).value as SortField);
	}

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function formatImportErrors(): string {
		return [`Import failed for the following file`, importErrors.value?.length === 1 ? emptyString : "s", ":<hr/>", `<ul>${importErrors.value?.map(err => `<li>${err.fileName}: ${err.message}</li>`).join(emptyString)}</ul>`].join(emptyString);
	}

	function onTileClick(e: Event, noteId: UUID) {
		if (isSelectionMode.value) {
			e.preventDefault();
			toggleSelection(noteId);
		}
	}

	function toggleSelectAll() {
		if (allSelected.value) {
			clearSelection();
		} else {
			selectAll(sourceNotes.value.map(n => n.id));
		}
	}

	function getSelectedIds(): UUID[] {
		return sourceNotes.value.filter(n => isSelected(n.id)).map(n => n.id);
	}

	async function handleSelectionAction(key: string) {
		const ids = getSelectedIds();
		if (ids.length === 0) {
			return;
		}
		const noun = ids.length === 1 ? "note" : "notes";
		switch (key) {
			case "export": {
				const selected = sourceNotes.value.filter(n => isSelected(n.id));
				await exportNotes(selected);
				exitSelectionMode();
				break;
			}
			case "archive": {
				notesStore.archiveMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "unarchive": {
				notesStore.unarchiveMultiple(ids);
				requestSync();
				exitSelectionMode();
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
				notesStore.trashMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
			case "restore": {
				notesStore.restoreFromTrashMultiple(ids);
				requestSync();
				exitSelectionMode();
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
				notesStore.permanentlyDeleteMultiple(ids);
				requestSync();
				exitSelectionMode();
				break;
			}
		}
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
		notesStore.permanentlyDeleteMultiple(notesStore.trashedNotes.map(n => n.id));
		requestSync();
	}

	onMounted(() => {
		exitSelectionMode();
	});

	watch(view, () => {
		exitSelectionMode();
	});
</script>

<template>
	<div v-if="view !== 'active'" class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
		<h2 class="mb-0">{{ pageTitle }}</h2>
		<RouterLink to="/notes" class="btn btn-secondary btn-sm">
			<i class="bi bi-chevron-left"></i>
			<span>&#xA0;Back to Notes</span>
		</RouterLink>
	</div>
	<div v-if="!hasNotes" class="empty-state text-center py-5">
		<div class="text-muted mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
				<path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2 2H3a2 2 0 0 1-2-2h1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1H1a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1H3a2 2 0 0 1 2-2z"/>
				<path d="M1 6v-.5a.5.5 0 0 1 1 0V6h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V9h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
			</svg>
		</div>
		<p class="text-muted mb-3">{{ emptyMessage }}</p>
		<div v-if="view === 'active' && !isSearchMode" class="d-flex flex-column gap-2 align-items-center">
			<div class="d-flex gap-2 justify-content-center flex-wrap">
				<RouterLink to="/notes/new" class="btn btn-primary">Create a note</RouterLink>
				<button class="btn btn-outline-secondary" @click="importFiles">Import from files</button>
			</div>
			<div class="d-flex gap-3 justify-content-center flex-wrap">
				<RouterLink to="/notes/archive" class="btn btn-link btn-sm text-decoration-none"> <i class="bi bi-archive me-1" aria-hidden="true"></i>Archived </RouterLink>
				<RouterLink to="/notes/trash" class="btn btn-link btn-sm text-decoration-none"> <i class="bi bi-trash me-1" aria-hidden="true"></i>Trash </RouterLink>
			</div>
		</div>
	</div>
	<div v-else-if="notesStore.isLoading">
		<div class="d-flex flex-column justify-content-center align-items-center">
			<div class="spinner-border" aria-hidden="true"></div>
			<div class="mt-3" role="status">Loading notes...</div>
		</div>
	</div>
	<div v-else>
		<div class="d-flex gap-2 mb-3 justify-content-end flex-wrap">
			<template v-if="isSelectionMode">
				<button class="btn btn-outline-secondary btn-sm" @click="toggleSelectAll">{{ allSelected ? "Deselect All" : "Select All" }}</button>
				<button class="btn btn-outline-secondary btn-sm" @click="exitSelectionMode">Cancel</button>
			</template>
			<template v-else>
				<div class="d-flex gap-1 align-items-center sort-controls">
					<label for="sort-by-select" class="form-label text-muted small mb-0 me-1">Sort:</label>
					<select id="sort-by-select" class="form-select form-select-sm sort-select" :value="sortBy" @change="onSortFieldChange" aria-label="Sort notes by">
						<option value="modifiedAt">Updated</option>
						<option value="createdAt">Created</option>
						<option value="title">Title</option>
						<option value="sentenceCount">Sentences</option>
						<option value="wordCount">Words</option>
						<option value="characterCount">Characters</option>
					</select>
					<button class="btn btn-outline-secondary btn-sm" @click="toggleSortDirection" :aria-label="sortDirection === 'asc' ? 'Sort ascending, click to switch to descending' : 'Sort descending, click to switch to ascending'" :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'">
						<i class="bi" :class="sortDirection === 'asc' ? 'bi-sort-up' : 'bi-sort-down'" aria-hidden="true"></i>
					</button>
				</div>
				<button class="btn btn-outline-secondary btn-sm" @click="enterSelectionMode">Select</button>
				<template v-if="view === 'active'">
					<button class="btn btn-outline-secondary btn-sm" @click="importFiles">Import</button>
					<button class="btn btn-outline-secondary btn-sm" @click="exportAllNotes">Export All</button>
					<RouterLink to="/notes/archive" class="btn btn-outline-secondary btn-sm"> <i class="bi bi-archive me-1" aria-hidden="true"></i>Archived </RouterLink>
					<RouterLink to="/notes/trash" class="btn btn-outline-secondary btn-sm"> <i class="bi bi-trash me-1" aria-hidden="true"></i>Trash </RouterLink>
				</template>
				<template v-if="view === 'trash'">
					<button class="btn btn-outline-danger btn-sm" @click="handleEmptyTrash"><i class="bi bi-trash-fill me-1" aria-hidden="true"></i>Empty Trash</button>
				</template>
			</template>
		</div>
		<div class="notes-grid">
			<RouterLink v-if="view === 'active' && !isSelectionMode" to="/notes/new" class="card note-card new-note-card text-decoration-none">
				<div class="card-body d-flex align-items-center justify-content-center">
					<span class="fs-1 text-muted">+</span>
				</div>
			</RouterLink>
			<RouterLink v-for="note in sortedNotes" :key="note.id" :to="`/notes/${note.id}`" class="card note-card text-decoration-none position-relative" :class="{ selected: isSelectionMode && isSelected(note.id) }" @click="(e: MouseEvent) => onTileClick(e, note.id)">
				<div class="card-body d-flex flex-column">
					<input v-if="isSelectionMode" type="checkbox" class="form-check-input selection-checkbox" :checked="isSelected(note.id)" @click.stop.prevent="toggleSelection(note.id)"/>
					<div class="d-flex gap-1 mb-2">
						<div class="text-truncate">{{ note.title }}</div>
						<div class="badge align-self-center text-muted border ms-auto">{{ formatDate(note.modifiedAt ?? note.createdAt) }}</div>
					</div>
					<p class="card-text text-muted small overflow-hidden">{{ note.summary }}</p>
				</div>
				<div class="d-flex gap-1 bg-body small w-100 position-absolute bottom-0 px-2 py-2 border-top">
					<div class="badge text-bg-secondary" v-if="note.sentenceCount">{{ note.sentenceCount }} sentences</div>
					<div class="badge text-bg-secondary" v-if="note.wordCount">{{ note.wordCount }} words</div>
					<div class="badge text-bg-secondary" v-if="note.characterCount">{{ note.characterCount }} characters</div>
				</div>
			</RouterLink>
		</div>
		<SelectionActionBar v-if="isSelectionMode && selectedCount > 0" :selected-count="selectedCount" :actions="selectionActions" @action="handleSelectionAction" @cancel="exitSelectionMode"/>
	</div>
	<Toast v-if="importErrors?.length" :message="formatImportErrors()" type="error" :visible="!!importErrors.length" :timeStamp="Date.now()" @dismiss="dismissErrors"/>
</template>

<style>
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.75rem;
	}
	.sort-controls {
		margin-right: auto;
	}
	.sort-select {
		width: auto;
	}
	.note-card {
		height: 12rem;
		transition: box-shadow 0.15s ease;
		overflow: hidden;
	}
	.note-card:hover {
		box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.1);
	}
	.new-note-card {
		border-style: dashed;
		opacity: 0.7;
	}
	.new-note-card:hover {
		opacity: 1;
	}
	.note-card.selected {
		border-color: var(--bs-primary);
		background-color: var(--bs-primary-bg-subtle);
	}
	.selection-checkbox {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}
</style>