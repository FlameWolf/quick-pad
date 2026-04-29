<script setup lang="ts">
	defineProps<{ selectedCount: number }>();
	defineEmits<{
		(e: "export"): void;
		(e: "cancel"): void;
	}>();
</script>

<template>
	<div class="selection-action-bar">
		<span class="fw-medium">{{ selectedCount }} selected</span>
		<div class="d-flex gap-2">
			<button class="btn btn-primary btn-sm" @click="$emit('export')">Export Selected</button>
			<button class="btn btn-outline-secondary btn-sm" @click="$emit('cancel')">Cancel</button>
		</div>
	</div>
</template>

<style>
	.selection-action-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
		background-color: var(--bs-body-bg);
		border-top: 1px solid var(--bs-border-color);
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
	}
</style>