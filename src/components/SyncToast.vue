<script setup lang="ts">
	import { watch } from "vue";

	const props = defineProps<{
		message: string;
		type: "success" | "error";
		visible: boolean;
	}>();

	const emit = defineEmits<{
		dismiss: [];
	}>();

	watch(() => props.visible, (val) => {
		if (val && props.type === "success") {
			setTimeout(() => emit("dismiss"), 3000);
		}
	});
</script>

<template>
	<Transition name="toast-slide">
		<div v-if="visible" class="toast-container">
			<div class="toast-notification" :class="type">
				<span class="toast-icon">{{ type === "success" ? "&#10003;" : "&#9888;" }}</span>
				<span class="toast-text">{{ message }}</span>
				<button class="toast-close" @click="$emit('dismiss')">&times;</button>
			</div>
		</div>
	</Transition>
</template>

<style scoped>
	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 2000;
	}

	.toast-notification {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 360px;
	}

	.toast-notification.success {
		background-color: var(--bs-success-bg-subtle, #d1e7dd);
		color: var(--bs-success-text-emphasis, #0a3622);
		border: 1px solid var(--bs-success-border-subtle, #a3cfbb);
	}

	.toast-notification.error {
		background-color: var(--bs-danger-bg-subtle, #f8d7da);
		color: var(--bs-danger-text-emphasis, #58151c);
		border: 1px solid var(--bs-danger-border-subtle, #f1aeb5);
	}

	.toast-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}

	.toast-text {
		flex: 1;
	}

	.toast-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		color: inherit;
		opacity: 0.6;
		padding: 0 0.25rem;
	}

	.toast-close:hover {
		opacity: 1;
	}

	.toast-slide-enter-active,
	.toast-slide-leave-active {
		transition: all 0.3s ease;
	}

	.toast-slide-enter-from,
	.toast-slide-leave-to {
		transform: translateX(100%);
		opacity: 0;
	}
</style>
