<script setup lang="ts">
	import { computed, onMounted } from "vue";
	import { activeTheme, applyTheme, Theme, toggleTheme } from "@/composables/useTheme";
	import Icon from "@/components/Icon.vue";

	const isDark = computed(() => activeTheme.value === Theme.Dark);

	onMounted(() => {
		applyTheme(activeTheme.value);
	});
</script>
<template>
	<button class="btn btn-secondary btn-sm" @click="toggleTheme" :aria-label="`Switch to ${isDark ? Theme.Light : Theme.Dark} theme`">
		<Icon :type="isDark ? `moonStarsFill` : `sunFill`"/>
	</button>
</template>