<script setup lang="ts">
	import { computed } from "vue";
	import Icon from "@/components/Icon.vue";

	const props = defineProps<{
		title: string;
		effectiveDate: string;
		intro: string;
		sections: LegalSection[];
	}>();
	const introParagraphs = computed(() => props.intro.split("\n\n"));
</script>

<template>
	<div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
		<h2 class="mb-0">{{ title }}</h2>
		<RouterLink to="/notes" class="btn btn-secondary btn-sm">
			<Icon type="chevronLeft"/>
			<span class="ms-2">Back to Notes</span>
		</RouterLink>
	</div>
	<article class="legal-content mx-auto">
		<p class="text-muted small mb-4">Last updated: {{ effectiveDate }}</p>
		<p v-for="(paragraph, index) in introParagraphs" :key="`intro-${index}`">{{ paragraph }}</p>
		<section v-for="section in sections" :key="section.heading" class="mt-4">
			<h3 class="h5 mb-3">{{ section.heading }}</h3>
			<template v-for="(block, index) in section.blocks" :key="index">
				<p v-if="block.type === `paragraph`" v-html="block.text"></p>
				<ul v-else class="mb-3">
					<li v-for="(item, itemIndex) in block.items" :key="itemIndex" class="mb-1" v-html="item"></li>
				</ul>
			</template>
		</section>
	</article>
</template>

<style>
	.legal-content {
		overflow-wrap: break-word;
		max-width: 48rem;
	}
	.legal-content :is(h3) {
		font-weight: 600;
	}
</style>