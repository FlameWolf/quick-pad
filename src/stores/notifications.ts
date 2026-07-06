import { ref, watch } from "vue";
import { defineStore } from "pinia";
import type { UUID } from "crypto";

export type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "danger";
	timeStamp: number;
	message: string;
};
export type NotificationList = Array<Notification>;

const notifications = ref<NotificationList>([]);

function createNotification(type: Notification["type"], message: string) {
	const notification = {
		id: crypto.randomUUID() as UUID,
		type,
		timeStamp: Date.now(),
		message
	};
	notifications.value.push(notification);
}

function deleteNotification(id: UUID) {
	const index = notifications.value.findIndex(notification => notification.id === id);
	if (index !== -1) {
		notifications.value.splice(index, 1);
	}
}

export const useNotificationsStore = defineStore("notifications", () => {
	function addNotification(type: Notification["type"], message: string) {
		const existingNotification = notifications.value.find(n => n.message === message && n.type === type);
		if (existingNotification) {
			deleteNotification(existingNotification.id);
			setTimeout(() => createNotification(type, message), 250);
			return;
		}
		createNotification(type, message);
	}

	function removeNotification(id: UUID) {
		deleteNotification(id);
	}

	watch(
		notifications,
		newNotifications => {
			newNotifications.forEach(notification => {
				if (notification.type !== "danger") {
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