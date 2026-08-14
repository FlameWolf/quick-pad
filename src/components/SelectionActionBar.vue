<script setup lang="ts">
	import { useTemplateRef } from "vue";
	import { useDropdown } from "@/composables/useDropdown";
	import DisplayColourList from "@/components/DisplayColourList.vue";

	const props = defineProps<{
		selectedCount: number;
		actions: SelectionAction[];
		showColours?: boolean;
	}>();
	const emit = defineEmits<{
		(e: "action", key: SelectionAction["key"]): void;
		(e: "cancel"): void;
	}>();
	const dropupTrigger = useTemplateRef("dropup-trigger");
	const dropdown = useDropdown(dropupTrigger);
</script>

<template>
	<div class="selection-action-bar">
		<span class="fw-medium">{{ props.selectedCount }} selected</span>
		<div class="d-flex gap-2 flex-wrap">
			<div class="dropup">
				<DisplayColourList v-if="dropdown.show.value" class="dropdown-menu show mt-1"/>
				<button v-if="showColours" ref="dropup-trigger" class="btn btn-sm btn-outline-primary dropdown-toggle" @click="dropdown.toggle()">Apply Colour</button>
			</div>
			<button v-for="action in props.actions" :key="action.key" class="btn btn-sm" :class="`btn-${action.variant}`" @click="emit(`action`, action.key)">{{ action.label }}</button>
			<button class="btn btn-outline-secondary btn-sm" @click="emit(`cancel`)">Cancel</button>
		</div>
	</div>
</template>