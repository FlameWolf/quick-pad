<script setup lang="ts">
	import { computed } from "vue";
	import { Theme, useTheme } from "@/composables/useTheme";
	import Icon from "@/components/Icon.vue";

	const { activeTheme, toggleTheme } = useTheme();
	const isDark = computed(() => activeTheme.value === Theme.Dark);
</script>
<template>
	<button class="btn btn-secondary btn-sm" @click="toggleTheme" :aria-label="`Switch to ${isDark ? Theme.Light : Theme.Dark} theme`">
		<Icon :type="isDark ? `moonStarsFill` : `sunFill`"/>
	</button>
</template>