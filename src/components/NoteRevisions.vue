<script setup lang="ts">
	import { onMounted, ref } from "vue";
	import { emptyString } from "@/constants/common";
	import { getRevisionContent, listRevisions, listRevisionsById } from "@/composables/useGoogleDrive";
	import { getFileName } from "@/composables/useNotesSync";
	import Spinner from "@/components/Spinner.vue";
	import type { UUID } from "node:crypto";
	import type { NoteModel } from "@/models/NoteModel";

	type RevisionListResponse = Awaited<ReturnType<typeof listRevisions>>;

	const props = defineProps<{
		noteId: UUID;
	}>();
	const isLoading = ref(true);
	const revisions = ref<RevisionListResponse>();

	async function loadMoreRevisions() {
		isLoading.value = true;
		{
			const { fileId, pageToken } = revisions.value!;
			const moreRevisions = await listRevisionsById(fileId!, pageToken);
			revisions.value!.revisionList.push(...moreRevisions.revisionList);
			revisions.value!.pageToken = moreRevisions.pageToken;
		}
		isLoading.value = false;
	}

	async function downloadRevision(revisionId: string) {
		const { fileId } = revisions.value!;
		const note = (await getRevisionContent(fileId!, revisionId)) as NoteModel;
		const content = `${note.title}\n\n${note.content}${note.tags?.length ? `\n\nTags: ${note.tags.join(", ")}` : emptyString}`;
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${getFileName(props.noteId)}-revision-${revisionId}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	onMounted(async () => {
		revisions.value = await listRevisions(getFileName(props.noteId));
		isLoading.value = false;
	});
</script>
<template>
	<Spinner v-if="isLoading" message="Loading revisions..." />
	<template v-else-if="!revisions?.revisionList.length">
		<p>No revisions found</p>
	</template>
	<div v-else class="d-flex flex-column gap-2 flex-wrap">
		<div v-for="revision in revisions?.revisionList" :key="revision.id">
			<div class="badge">Modified Time: {{ revision.modifiedTime }}</div>
			<div class="badge">Size: {{ revision.size }}</div>
			<button class="btn btn-sm btn-outline-secondary" @click="downloadRevision(revision.id)">Download</button>
			<button class="btn btn-sm btn-outline-secondary">Restore</button>
		</div>
	</div>
	<div class="d-flex justify-content-center">
		<button class="btn btn-outline-primary" :disabled="!revisions?.pageToken" @click="loadMoreRevisions">Load more</button>
	</div>
</template>