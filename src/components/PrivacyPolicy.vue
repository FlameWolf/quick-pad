<script setup lang="ts">
	import LegalPage from "@/components/LegalPage.vue";
	import { privacyEffectiveDate, privacyIntro, privacySections } from "@/content/privacy";
</script>

<template>
	<LegalPage title="Privacy Policy" :effective-date="privacyEffectiveDate" :intro="privacyIntro" :sections="privacySections"/>
</template>