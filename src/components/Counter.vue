<script setup lang="ts">
	import { ref } from "vue";
	const count = ref(0);
</script>

<template>
	<div class="counter">
		<p>Counter: {{ count }}</p>
		<button class="btn btn-primary" @click="count++">Increment</button>
	</div>
</template>