<script setup lang="ts">
	import { emptyString } from "@/constants/common";
	import type { NoteModel } from "@/models/NoteModel";
	import type { UUID } from "crypto";

	const props = defineProps<{ note: NoteModel; selectionMode: boolean; selected: boolean }>();
	const emit = defineEmits<{ toggleSelect: [id: UUID] }>();

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function onClick(e: MouseEvent) {
		if (props.selectionMode) {
			e.preventDefault();
			emit("toggleSelect", props.note.id);
		}
	}
</script>
<template>
	<RouterLink :to="`/notes/${note.id}`" class="card note-card text-decoration-none position-relative" :class="{ selected: selectionMode && selected }" @click.capture="onClick">
		<div class="d-flex gap-2 small position-absolute top-0 p-2 status-badge">
			<svg v-if="note.pinnedAt" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pin-angle-fill" viewBox="0 0 16 16">
				<path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
			</svg>
			<svg v-if="note.favedAt" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-star-fill" viewBox="0 0 16 16">
				<path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
			</svg>
		</div>
		<div class="card-body d-flex flex-column">
			<input v-if="selectionMode" type="checkbox" class="form-check-input selection-checkbox rounded-circle" :checked="selected"/>
			<div class="d-flex gap-1 mb-2">
				<div class="text-truncate">{{ note.title }}</div>
				<div class="badge align-self-center text-muted border ms-auto">{{ formatDate(note.modifiedAt ?? note.createdAt) }}</div>
			</div>
			<p class="card-text text-muted small overflow-hidden">{{ note.summary }}</p>
		</div>
		<div class="d-flex gap-1 small w-100 position-absolute bottom-0 px-2 py-2 border-top">
			<div class="badge text-bg-secondary" v-if="note.sentenceCount">{{ note.sentenceCount }} sentences</div>
			<div class="badge text-bg-secondary" v-if="note.wordCount">{{ note.wordCount }} words</div>
			<div class="badge text-bg-secondary" v-if="note.characterCount">{{ note.characterCount }} characters</div>
		</div>
	</RouterLink>
</template>
<style>
	.note-card {
		height: 12rem;
		transition: box-shadow 0.15s ease;
		overflow: hidden;
	}
	.note-card:hover {
		filter: drop-shadow(0 0 0.75rem var(--bs-body-color));
	}
	.note-card.selected {
		border-color: var(--bs-primary);
		background-color: var(--bs-primary-bg-subtle);
	}
	.status-badge {
		background-color: rgb(from var(--bs-body-bg) r g b / 0.75);
		border-bottom-right-radius: 0.5rem;
	}
	.selection-checkbox {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		pointer-events: none;
	}
</style>