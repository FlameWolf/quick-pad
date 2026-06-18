<script setup lang="ts">
	import Icon from "@/components/Icon.vue";

	function scrollToPosition(position: "top" | "bottom") {
		const element = document.documentElement;
		if (position === "top") {
			element.scrollTo({ top: 0, behavior: "smooth" });
		} else if (position === "bottom") {
			element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
		}
	}
</script>
<template>
	<div class="d-flex flex-column gap-1 position-fixed bottom-0 end-0 opacity-75 mb-2 me-2">
		<button class="btn btn-secondary btn-sm" @click="scrollToPosition(`top`)" aria-label="Scroll to top">
			<Icon type="chevronUp"/>
		</button>
		<button class="btn btn-secondary btn-sm" @click="scrollToPosition(`bottom`)" aria-label="Scroll to bottom">
			<Icon type="chevronDown"/>
		</button>
	</div>
</template>