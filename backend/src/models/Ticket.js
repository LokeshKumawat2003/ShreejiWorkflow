const mongoose = require('mongoose');

const TICKET_TYPES = ['attendance', 'payroll', 'employee', 'location', 'account', 'technical', 'other'];
const TICKET_PRIORITIES = ['low', 'medium', 'high'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TICKET_TYPES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, default: 'medium' },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    adminResponse: { type: String, trim: true, maxlength: 2000, default: '' },
    respondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

module.exports = { Counter, Ticket, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES };
