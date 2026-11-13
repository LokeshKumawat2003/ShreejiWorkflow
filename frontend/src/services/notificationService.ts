import api from './api';

export type AppNotification = {
	id: string;
	kind: 'ticket_created' | 'ticket_updated';
	title: string;
	message: string;
	ticketId: string;
	ticketNumber: string;
	organizationName: string;
	isRead: boolean;
	createdAt: string;
};

export type NotificationList = { notifications: AppNotification[]; unreadCount: number };

export async function listNotifications(signal?: AbortSignal) {
	const { data } = await api.get<NotificationList>('/notifications', { signal });
	return data;
}

export async function markNotificationRead(id: string) {
	const { data } = await api.post<NotificationList>(`/notifications/${id}/read`);
	return data;
}

export async function markAllNotificationsRead() {
	const { data } = await api.post<NotificationList>('/notifications/read-all');
	return data;
}
