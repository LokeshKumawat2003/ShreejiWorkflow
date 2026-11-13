const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // 'admin' notifications are shared by every admin; 'organization' ones belong to organizationId.
    audience: { type: String, enum: ['admin', 'organization'], required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['ticket_created', 'ticket_updated'], required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    ticketNumber: { type: String, default: '' },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, default: '', maxlength: 300 },
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);

notificationSchema.index({ audience: 1, organizationId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
