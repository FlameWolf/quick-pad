<script setup lang="ts">
	const props = defineProps<{
		selectedCount: number;
		actions: SelectionAction[];
	}>();
	const emit = defineEmits<{
		(e: "action", key: SelectionAction["key"]): void;
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