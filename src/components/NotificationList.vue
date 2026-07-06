<script setup lang="ts">
	import { computed } from "vue";
	import { useNotificationsStore } from "@/stores/notifications";

	const notificationsStore = useNotificationsStore();
	const sortedNotifications = computed(() => {
		return notificationsStore.notifications.toSorted((a, b) => b.timeStamp - a.timeStamp);
	});
</script>
<template>
	<div class="notification-list">
		<div v-for="notification in sortedNotifications" :key="notification.id" class="notification-item">
			<p>{{ notification.message }}</p>
			<button @click="notificationsStore.removeNotification(notification.id)">Dismiss</button>
		</div>
	</div>
</template>
<style>
	.notification-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		inset: 0;
		right: 1rem;
		bottom: 1rem;
	}
</style>