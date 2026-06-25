<script setup lang="ts">
	import { computed } from "vue";
	import { emptyString } from "@/constants/common";
	import Icon from "@/components/Icon.vue";
	import type { NoteModel } from "@/models/NoteModel";
	import type { UUID } from "crypto";

	const props = defineProps<{
		note: NoteModel;
		selectionMode: boolean;
		selected: boolean;
	}>();
	const emit = defineEmits<{ toggleSelect: [id: UUID] }>();
	const note = computed(() => props.note);

	function formatDate(date?: Date): string {
		if (!date) {
			return emptyString;
		}
		return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function onClick(e: MouseEvent) {
		if (props.selectionMode) {
			e.preventDefault();
			emit("toggleSelect", note.value.id);
		}
	}
</script>
<template>
	<RouterLink :to="`/notes/${note.id}`" class="card note-card text-decoration-none position-relative" :class="{ selected: props.selectionMode && props.selected }" @click.capture="onClick">
		<div class="d-flex gap-2 small position-absolute top-0 p-2 status-badge">
			<Icon v-if="note.pinnedAt" type="pinAngleFill"/>
			<Icon v-if="note.favedAt" type="starFill"/>
		</div>
		<div class="card-body d-flex flex-column">
			<input v-if="props.selectionMode" type="checkbox" class="form-check-input selection-checkbox rounded-circle" :checked="props.selected"/>
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