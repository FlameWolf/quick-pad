<script setup lang="ts">
	import { useTheme } from "@/composables/useTheme";
	import Icon from "@/components/Icon.vue";

	const { isDark, applyTheme } = useTheme();

	function toggleTheme() {
		isDark.value = !isDark.value;
		applyTheme(isDark.value);
	}
</script>
<template>
	<button class="btn btn-secondary btn-sm" @click="toggleTheme" :aria-label="isDark ? `Switch to light theme` : `Switch to dark theme`">
		<Icon :type="isDark ? `moonStarsFill` : `sunFill`"/>
	</button>
</template>