<script setup lang="ts">
	import { computed } from "vue";
	import { useNotificationsStore } from "@/stores/notifications";

	const notificationsStore = useNotificationsStore();
	const sortedNotifications = computed(() => {
		return notificationsStore.notifications.toSorted((a, b) => b.timeStamp - a.timeStamp);
	});
</script>
<template>
	<div class="d-flex flex-column gap-1 notification-list position-fixed end-0 bottom-0 me-1 mb-1">
		<template v-for="notification in sortedNotifications" :key="notification.id">
			<div class="alert fade show" :class="`alert-${notification.type}`" role="alert">
				<div class="d-flex">
					<div class="me-auto" v-html="notification.message"></div>
					<button class="btn-close ms-2" @click="notificationsStore.removeNotification(notification.id)" aria-label="Close"></button>
				</div>
			</div>
		</template>
	</div>
</template>