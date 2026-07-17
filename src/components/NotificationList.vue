<script setup lang="ts">
	import { computed } from "vue";
	import { notifications, removeNotification } from "@/stores/notifications";

	const sortedNotifications = computed(() => {
		return notifications.value.toSorted((a, b) => b.timeStamp - a.timeStamp);
	});
</script>
<template>
	<div class="d-flex flex-column gap-2 notification-list position-fixed end-0 bottom-0 me-2 mb-2">
		<template v-for="notification in sortedNotifications" :key="notification.id">
			<div class="alert m-0 ms-auto" :class="`alert-${notification.type}`" role="alert">
				<div class="d-flex">
					<div v-html="notification.message"></div>
					<button class="btn-close ms-2" @click="removeNotification(notification.id)" aria-label="Close"></button>
				</div>
			</div>
		</template>
	</div>
</template>