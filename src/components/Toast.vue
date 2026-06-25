<script setup lang="ts">
	import { onUnmounted, watch } from "vue";
	import Icon from "@/components/Icon.vue";

	export type ToastDetails = {
		type: "success" | "error";
		timeStamp: number;
		message: string;
	};

	let dismissTimeout: NodeJS.Timeout | null = null;
	const props = defineProps<ToastDetails>();
	const emit = defineEmits<{
		dismiss: [];
	}>();

	function clearDismissTimeout() {
		if (dismissTimeout) {
			clearTimeout(dismissTimeout);
			dismissTimeout = null;
		}
	}

	function setDismissTimeout() {
		dismissTimeout = setTimeout(() => emit("dismiss"), 5000);
	}

	watch(
		() => props.timeStamp,
		() => {
			clearDismissTimeout();
			if (props.type === "success") {
				setDismissTimeout();
			}
		},
		{ immediate: true }
	);

	onUnmounted(() => {
		clearDismissTimeout();
	});
</script>

<template>
	<Transition name="toast-slide">
		<div class="toast-container">
			<div class="toast-notification rounded" :class="props.type">
				<span class="toast-icon">
					<Icon :type="props.type === `success` ? `check2` : `exclamationTriangle`"/>
				</span>
				<span class="toast-text" v-html="props.message"></span>
				<button class="btn-close align-self-start ms-auto" @click="$emit(`dismiss`)"></button>
			</div>
		</div>
	</Transition>
</template>