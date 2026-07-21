<script setup lang="ts">
	import { privacyEffectiveDate, privacyIntro, privacySections } from "@/content/privacy";
	import LegalPage from "@/components/LegalPage.vue";
</script>

<template>
	<LegalPage title="Privacy Policy" :effective-date="privacyEffectiveDate" :intro="privacyIntro" :sections="privacySections"/>
</template>