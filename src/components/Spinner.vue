<script setup lang="ts">
	const { showMessage = true, ...props } = defineProps<{
		message?: string;
		minimal?: boolean;
		showMessage?: boolean;
		tag?: string;
	}>();
</script>
<template>
	<template v-if="!props.minimal">
		<div class="d-flex flex-column justify-content-center" :class="{ [showMessage ? `align-items-center` : `py-3`]: true }">
			<div class="spinner-border" aria-hidden="true" :aria-label="showMessage ? undefined : props.message"></div>
			<div v-if="showMessage" class="mt-3" role="status">{{ props.message ?? "Loading..." }}</div>
		</div>
	</template>
	<component v-else :is="props.tag ?? `div`" class="spinner-border spinner-border-sm" role="status"></component>
</template>