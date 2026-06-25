<script setup lang="ts">
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { onBeforeUnmount, onMounted } from "vue";

	const { state, onConfirm, onCancel } = useConfirmDialog();
	const handlers: Record<string, (() => void) | undefined> = {
		Escape: onCancel,
		Enter: onConfirm
	};

	function onKeyDown(e: KeyboardEvent) {
		if (!(e.key in handlers && state.value.visible)) {
			return;
		}
		e.preventDefault();
		handlers[e.key]?.();
	}

	onMounted(() => {
		window.addEventListener("keydown", onKeyDown);
	});

	onBeforeUnmount(() => {
		window.removeEventListener("keydown", onKeyDown);
	});
</script>

<template>
	<Transition name="confirm-fade">
		<div v-if="state.visible" class="confirm-overlay" @click.self="onCancel">
			<div class="confirm-dialog" role="dialog" aria-modal="true" :aria-labelledby="`confirm-title`">
				<h5 id="confirm-title" class="confirm-title">{{ state.title }}</h5>
				<p class="confirm-message">{{ state.message }}</p>
				<div class="confirm-actions">
					<button type="button" class="btn btn-outline-secondary" @click="onCancel">{{ state.cancelText }}</button>
					<button type="button" class="btn" :class="`btn-${state.variant}`" @click="onConfirm" autofocus>{{ state.confirmText }}</button>
				</div>
			</div>
		</div>
	</Transition>
</template>