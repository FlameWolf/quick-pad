<script setup lang="ts">
	import { useNotesStore } from "@/stores/notes";
	import { useFileIO } from "@/composables/useFileIO";
	import { computed } from "vue";
	const noteStore = useNotesStore();
	const { importFiles, exportAllNotes } = useFileIO();
	const hasNotes = computed(() => noteStore.notes.length > 0);

	function formatDate(date?: Date): string {
		if (!date) return "";
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}
</script>

<template>
	<div v-if="!hasNotes" class="empty-state text-center py-5">
		<div class="text-muted mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
				<path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2 2H3a2 2 0 0 1-2-2h1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1H1a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1H3a2 2 0 0 1 2-2z"/>
				<path d="M1 6v-.5a.5.5 0 0 1 1 0V6h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V9h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
			</svg>
		</div>
		<p class="text-muted mb-3">No notes yet</p>
		<div class="d-flex gap-2 justify-content-center">
			<RouterLink to="/notes/new" class="btn btn-primary">Create your first note</RouterLink>
			<button class="btn btn-outline-secondary" @click="importFiles">Import from files</button>
		</div>
	</div>

	<div v-else>
		<div class="d-flex gap-2 mb-3 justify-content-end">
			<button class="btn btn-outline-secondary btn-sm" @click="importFiles">Import</button>
			<button class="btn btn-outline-secondary btn-sm" @click="exportAllNotes">Export All</button>
		</div>
		<div class="notes-grid">
		<RouterLink to="/notes/new" class="card note-card new-note-card text-decoration-none">
			<div class="card-body d-flex align-items-center justify-content-center">
				<span class="fs-1 text-muted">+</span>
			</div>
		</RouterLink>

		<RouterLink
			v-for="note in noteStore.notes"
			:key="note.id"
			:to="`/notes/${note.id}`"
			class="card note-card text-decoration-none"
		>
			<div class="card-body d-flex flex-column">
				<h6 class="card-title text-truncate mb-1">{{ note.title }}</h6>
				<small class="text-muted mb-2">{{ formatDate(note.modifiedAt ?? note.createdAt) }}</small>
				<p class="card-text text-muted small flex-grow-1 overflow-hidden">{{ note.summary }}</p>
			</div>
		</RouterLink>
		</div>
	</div>
</template>

<style scoped>
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.note-card {
		height: 160px;
		transition: box-shadow 0.15s ease, transform 0.15s ease;
		overflow: hidden;
	}

	.note-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.new-note-card {
		border-style: dashed;
		opacity: 0.7;
	}

	.new-note-card:hover {
		opacity: 1;
	}

	.card-text {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
