<script setup lang="ts">
	import { onMounted, watch } from "vue";

	let dismissTimeout: NodeJS.Timeout | null = null;
	const props = defineProps<{
		message: string;
		type: "success" | "error";
		visible: boolean;
		timeStamp: number;
	}>();
	const emit = defineEmits<{
		dismiss: [];
	}>();

	function clearDismissTimeout() {
		if (dismissTimeout) {
			clearTimeout(dismissTimeout);
			dismissTimeout = null;
		}
	}

	function resetDismissTimeout() {
		clearDismissTimeout();
		dismissTimeout = setTimeout(() => emit("dismiss"), 5000);
	}

	watch(
		() => props.timeStamp,
		val => {
			if (val) {
				resetDismissTimeout();
			}
		}
	);

	onMounted(() => {
		resetDismissTimeout();
	});
</script>

<template>
	<Transition name="toast-slide">
		<div v-if="visible" class="toast-container">
			<div class="toast-notification rounded" :class="type">
				<span class="toast-icon">
					<i v-if="type === `success`" class="bi bi-check2"></i>
					<i v-else class="bi bi-exclamation-triangle"></i>
				</span>
				<span class="toast-text" v-html="message"></span>
				<button class="btn-close align-self-start ms-auto" @click="$emit('dismiss')"></button>
			</div>
		</div>
	</Transition>
</template>

<style>
	.toast-container {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		pointer-events: all;
	}
	.toast-notification {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		filter: drop-shadow(0 0 0.75rem var(--bs-body-color));
	}
	.toast-notification.success {
		background-color: var(--bs-success-bg-subtle, #d1e7dd);
		color: var(--bs-success-text-emphasis, #0a3622);
		border: 1pt solid var(--bs-success-border-subtle, #a3cfbb);
	}
	.toast-notification.error {
		background-color: var(--bs-danger-bg-subtle, #f8d7da);
		color: var(--bs-danger-text-emphasis, #58151c);
		border: 1pt solid var(--bs-danger-border-subtle, #f1aeb5);
	}
	.toast-icon {
		font-size: 1rem;
		flex-shrink: 0;
	}
	.toast-text {
		flex: 1;
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