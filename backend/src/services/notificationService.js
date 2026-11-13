const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { httpError } = require('../utils/httpError');

const LIST_LIMIT = 20;

function scopeFor(user) {
	if (user.role === 'admin') return { audience: 'admin' };
	return { audience: 'organization', organizationId: new mongoose.Types.ObjectId(String(user.id)) };
}

function publicNotification(notification, userId) {
	const organization = notification.organizationId && typeof notification.organizationId === 'object' && notification.organizationId.email
		? notification.organizationId
		: null;
	return {
		id: String(notification._id),
		kind: notification.kind,
		title: notification.title,
		message: notification.message,
		ticketId: notification.ticketId ? String(notification.ticketId) : '',
		ticketNumber: notification.ticketNumber,
		organizationName: organization ? organization.organizationName || organization.name || organization.email : '',
		isRead: (notification.readBy || []).some((id) => String(id) === String(userId)),
		createdAt: notification.createdAt,
	};
}

/** Never lets a failed notification break the action that triggered it. */
async function notify(values) {
	try {
		await Notification.create(values);
	} catch (error) {
		console.error('Unable to create notification:', error.message);
	}
}

async function listNotifications(user) {
	const scope = scopeFor(user);
	const userId = new mongoose.Types.ObjectId(String(user.id));
	const [notifications, unreadCount] = await Promise.all([
		Notification.find(scope)
			.populate('organizationId', 'name organizationName email')
			.sort({ createdAt: -1, _id: -1 })
			.limit(LIST_LIMIT)
			.lean(),
		Notification.countDocuments({ ...scope, readBy: { $ne: userId } }),
	]);
	return { notifications: notifications.map((item) => publicNotification(item, user.id)), unreadCount };
}

async function markNotificationRead(user, notificationId) {
	if (!mongoose.isValidObjectId(notificationId)) throw httpError(400, 'Invalid notification id.');
	const result = await Notification.updateOne({ ...scopeFor(user), _id: notificationId }, { $addToSet: { readBy: user.id } });
	if (!result.matchedCount) throw httpError(404, 'Notification not found.');
	return listNotifications(user);
}

async function markAllNotificationsRead(user) {
	const userId = new mongoose.Types.ObjectId(String(user.id));
	await Notification.updateMany({ ...scopeFor(user), readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
	return listNotifications(user);
}

module.exports = { listNotifications, markAllNotificationsRead, markNotificationRead, notify };
