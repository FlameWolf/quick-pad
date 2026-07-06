import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { UUID } from "crypto";

export type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "error";
	timeStamp: number;
	message: string;
};
export type NotificationList = Array<Notification>;

const notifications = ref<NotificationList>([]);

function createNotification(type: Notification["type"], message: string): Notification {
	return {
		id: crypto.randomUUID() as UUID,
		type,
		timeStamp: Date.now(),
		message
	};
}

export const useNotificationsStore = defineStore("notifications", () => {
	function addNotification(type: Notification["type"], message: string) {
		const notification = createNotification(type, message);
		notifications.value.push(notification);
		return notification.id;
	}

	function removeNotification(id: UUID) {
		notifications.value = notifications.value.filter(notification => notification.id !== id);
	}

	watch(
		notifications,
		newNotifications => {
			newNotifications.forEach(notification => {
				if (notification.type !== "error") {
					setTimeout(() => {
						removeNotification(notification.id);
					}, 5000);
				}
			});
		},
		{ deep: true }
	);

	return {
		notifications,
		addNotification,
		removeNotification
	};
});