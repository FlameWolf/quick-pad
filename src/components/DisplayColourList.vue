<script setup lang="ts">
	import { colours } from "@/constants/colours";
</script>
<template>
	<div class="d-flex flex-wrap gap-2 p-2 border rounded">
		<a v-for="colour in colours" class="colour-circle border rounded-circle" :class="`bg-${colour.name.toLowerCase()}`" role="button" :aria-description="colour.name"></a>
	</div>
</template>