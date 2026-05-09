<script setup lang="ts">
	import { useConfirmDialog } from "@/composables/useConfirmDialog";
	import { onBeforeUnmount, onMounted } from "vue";

	const { state, onConfirm, onCancel } = useConfirmDialog();

	function onKeydown(e: KeyboardEvent) {
		if (!state.value.visible) {
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		} else if (e.key === "Enter") {
			e.preventDefault();
			onConfirm();
		}
	}

	onMounted(() => {
		window.addEventListener("keydown", onKeydown);
	});

	onBeforeUnmount(() => {
		window.removeEventListener("keydown", onKeydown);
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

<style>
	.confirm-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1080;
	}
	.confirm-dialog {
		background-color: var(--bs-body-bg);
		color: var(--bs-body-color);
		border-radius: 0.75rem;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
		padding: 1.25rem;
		width: 100%;
		max-width: 28rem;
	}
	.confirm-title {
		margin: 0 0 0.75rem 0;
		font-weight: 600;
	}
	.confirm-message {
		margin: 0 0 1.25rem 0;
		color: var(--bs-secondary-color);
		white-space: pre-wrap;
	}
	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.confirm-fade-enter-active,
	.confirm-fade-leave-active {
		transition: opacity 0.15s ease;
	}
	.confirm-fade-enter-from,
	.confirm-fade-leave-to {
		opacity: 0;
	}
	.confirm-fade-enter-active .confirm-dialog,
	.confirm-fade-leave-active .confirm-dialog {
		transition: transform 0.15s ease;
	}
	.confirm-fade-enter-from .confirm-dialog,
	.confirm-fade-leave-to .confirm-dialog {
		transform: scale(0.96);
	}
</style>