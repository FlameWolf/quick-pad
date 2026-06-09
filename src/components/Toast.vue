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
			if (val && props.type === "success") {
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
					<svg v-if="type === `success`" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2" viewBox="0 0 16 16">
						<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
					</svg>
					<svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle" viewBox="0 0 16 16">
						<path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z"/>
						<path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
					</svg>
				</span>
				<span class="toast-text" v-html="message"></span>
				<button class="btn-close align-self-start ms-auto" @click="$emit('dismiss')"></button>
			</div>
		</div>
	</Transition>
</template>

<style>
	.toast-container {
		max-width: 80vw;
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
		max-height: 25vh;
		overflow-y: scroll;
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