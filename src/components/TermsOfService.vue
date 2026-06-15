<script setup lang="ts">
	import LegalPage from "@/components/LegalPage.vue";
	import { termsEffectiveDate, termsIntro, termsSections } from "@/content/terms";
</script>

<template>
	<LegalPage title="Terms of Service" :effective-date="termsEffectiveDate" :intro="termsIntro" :sections="termsSections"/>
</template>