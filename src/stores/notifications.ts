import { ref } from "vue";
import { defineStore } from "pinia";
import type { UUID } from "crypto";

export type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "danger";
	timeStamp: number;
	message: string;
	removeTimer?: ReturnType<typeof setTimeout>;
};
export type NotificationList = Array<Notification>;

const maxNotifications = 5;
const notifications = ref<NotificationList>([]);

function createNotification(type: Notification["type"], message: string) {
	const notification: Notification = {
		id: crypto.randomUUID() as UUID,
		type,
		timeStamp: Date.now(),
		message
	};
	if (type !== "danger") {
		notification.removeTimer = setTimeout(() => {
			deleteNotification(notification.id);
		}, 5000);
	}
	if (notifications.value.length >= maxNotifications) {
		deleteNotification(notifications.value[0]!.id);
	}
	notifications.value.push(notification);
}

function deleteNotification(id: UUID) {
	const index = notifications.value.findIndex(n => n.id === id);
	if (index !== -1) {
		clearTimeout(notifications.value[index]!.removeTimer);
		notifications.value.splice(index, 1);
	}
}

export const useNotificationsStore = defineStore("notifications", () => {
	function addNotification(type: Notification["type"], message: string) {
		const existingNotification = notifications.value.find(n => n.message === message && n.type === type);
		if (!existingNotification) {
			createNotification(type, message);
			return;
		}
		deleteNotification(existingNotification.id);
		setTimeout(() => createNotification(type, message), 250);
	}

	function removeNotification(id: UUID) {
		deleteNotification(id);
	}

	return {
		notifications,
		addNotification,
		removeNotification
	};
});