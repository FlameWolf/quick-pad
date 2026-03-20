<script setup lang="ts">
	import { useNotesStore } from "@/stores/notes";
	import { computed } from "vue";
	import type { UUID } from "crypto";
	import type { NoteModel } from "@/models/NoteModel";
	import { emptyString } from "@/library";
	const notes = useNotesStore();
	const props = defineProps<{
		id: UUID;
	}>();
	const note = computed(() => notes.getNote(props.id) as NoteModel);
</script>

<template>
	<div class="border rounded p-2 m-2">
		<h3>{{ note?.title ?? emptyString }}</h3>
		<p>{{ note?.content ?? emptyString }}</p>
	</div>
	<div class="d-flex gap-2">
		<div class="badge text-bg-secondary" v-if="note?.sentenceCount">{{ note?.sentenceCount }} sentences</div>
		<div class="badge text-bg-secondary" v-if="note?.wordCount">{{ note?.wordCount }} words</div>
		<div class="badge text-bg-secondary" v-if="note?.characterCount">{{ note?.characterCount }} characters</div>
	</div>
</template>