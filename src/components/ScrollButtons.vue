<script setup lang="ts">
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
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-up" viewBox="0 0 16 16">
				<path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z"/>
			</svg>
		</button>
		<button class="btn btn-secondary btn-sm" @click="scrollToPosition(`bottom`)" aria-label="Scroll to bottom">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-down" viewBox="0 0 16 16">
				<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
			</svg>
		</button>
	</div>
</template>