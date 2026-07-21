<script setup lang="ts">
	import { termsEffectiveDate, termsIntro, termsSections } from "@/content/terms";
	import LegalPage from "@/components/LegalPage.vue";
</script>

<template>
	<LegalPage title="Terms of Service" :effective-date="termsEffectiveDate" :intro="termsIntro" :sections="termsSections"/>
</template>