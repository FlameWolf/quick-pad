<script setup lang="ts">
	export interface SelectionAction {
		key: string;
		label: string;
		variant: "primary" | "danger" | "outline-primary" | "outline-secondary" | "outline-danger";
	}

	const props = defineProps<{
		selectedCount: number;
		actions: SelectionAction[];
	}>();
	const emit = defineEmits<{
		(e: "action", key: string): void;
		(e: "cancel"): void;
	}>();
</script>

<template>
	<div class="selection-action-bar">
		<span class="fw-medium">{{ props.selectedCount }} selected</span>
		<div class="d-flex gap-2 flex-wrap">
			<button v-for="action in props.actions" :key="action.key" type="button" class="btn btn-sm" :class="`btn-${action.variant}`" @click="emit(`action`, action.key)">{{ action.label }}</button>
			<button type="button" class="btn btn-outline-secondary btn-sm" @click="emit(`cancel`)">Cancel</button>
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
		background-color: var(--bs-body-bg);
		border-top: 1pt solid var(--bs-border-color);
		filter: drop-shadow(0 0 0.5rem var(--bs-body-color));
	}
</style>