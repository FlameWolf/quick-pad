import { readonly, ref } from "vue";
import type { UUID } from "crypto";

type Notification = {
	id: UUID;
	type: "success" | "info" | "warning" | "danger";
	timeStamp: number;
	message: string;
	removeTimer?: ReturnType<typeof setTimeout>;
};
type NotificationList = Array<Notification>;

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
			deleteNotification(notification);
		}, 5000);
	}
	if (notifications.value.length >= 5) {
		deleteNotification(notifications.value[0]!);
	}
	notifications.value.push(notification);
}

function deleteNotification(notification: Notification) {
	clearTimeout(notification.removeTimer);
	notifications.value.splice(notifications.value.indexOf(notification), 1);
}

function addNotification(type: Notification["type"], message: string) {
	const existingNotification = notifications.value.find(n => n.message === message && n.type === type);
	if (!existingNotification) {
		createNotification(type, message);
		return;
	}
	deleteNotification(existingNotification);
	setTimeout(() => createNotification(type, message), 250);
}

function removeNotification(id: UUID) {
	const notification = notifications.value.find(n => n.id === id);
	if (notification) {
		deleteNotification(notification);
	}
}

export function useNotificationsStore() {
	return {
		notifications: readonly(notifications),
		addNotification,
		removeNotification
	};
}