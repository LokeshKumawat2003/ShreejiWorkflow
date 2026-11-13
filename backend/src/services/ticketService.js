const mongoose = require('mongoose');
const User = require('../models/User');
const { Counter, Ticket, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } = require('../models/Ticket');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');
const { notify } = require('./notificationService');

const STATUS_LABELS = { open: 'open', in_progress: 'in progress', resolved: 'resolved', closed: 'closed' };
const TICKET_PAGE_SIZE = 10;
const MAX_TICKET_PAGE_SIZE = 100;

function publicTicket(ticket) {
	const value = ticket.toObject ? ticket.toObject() : ticket;
	const organization = value.organizationId && typeof value.organizationId === 'object' && value.organizationId.email
		? value.organizationId
		: null;
	return {
		id: String(value._id || value.id),
		ticketNumber: value.ticketNumber,
		organizationId: String(organization?._id || value.organizationId),
		organizationName: organization ? organization.organizationName || organization.name || organization.email : '',
		type: value.type,
		priority: value.priority,
		subject: value.subject,
		message: value.message,
		status: value.status,
		adminResponse: value.adminResponse || '',
		respondedAt: value.respondedAt,
		resolvedAt: value.resolvedAt,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	};
}

function positiveInteger(value, fallback) {
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function trimmed(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function validateTicketInput(input = {}) {
	const type = trimmed(input.type);
	const priority = input.priority === undefined ? 'medium' : trimmed(input.priority);
	const subject = trimmed(input.subject);
	const message = trimmed(input.message);

	if (!TICKET_TYPES.includes(type)) throw httpError(400, 'Select a valid issue type.');
	if (!TICKET_PRIORITIES.includes(priority)) throw httpError(400, 'Select a valid priority.');
	if (!subject) throw httpError(400, 'Subject is required.');
	if (subject.length > 150) throw httpError(400, 'Subject must be 150 characters or fewer.');
	if (!message) throw httpError(400, 'Message is required.');
	if (message.length > 2000) throw httpError(400, 'Message must be 2000 characters or fewer.');
	return { type, priority, subject, message };
}

async function nextTicketNumber() {
	const counter = await Counter.findOneAndUpdate(
		{ _id: 'ticket' },
		{ $inc: { sequence: 1 } },
		{ returnDocument: 'after', upsert: true },
	);
	return `TKT-${String(counter.sequence).padStart(5, '0')}`;
}

async function listTickets(user, options = {}) {
	const scope = user.role === 'admin' ? {} : { organizationId: new mongoose.Types.ObjectId(String(user.id)) };
	if (user.role === 'admin' && options.organizationId) {
		if (!mongoose.isValidObjectId(options.organizationId)) throw httpError(400, 'Invalid organization id.');
		scope.organizationId = new mongoose.Types.ObjectId(String(options.organizationId));
	}

	const filter = { ...scope };
	if (TICKET_STATUSES.includes(options.status)) filter.status = options.status;
	if (TICKET_TYPES.includes(options.type)) filter.type = options.type;
	const search = trimmed(options.search).slice(0, 100);
	if (search) {
		const pattern = new RegExp(escapeRegex(search), 'i');
		filter.$or = [{ ticketNumber: pattern }, { subject: pattern }, { message: pattern }];
	}

	const limit = Math.min(positiveInteger(options.limit, TICKET_PAGE_SIZE), MAX_TICKET_PAGE_SIZE);
	const [total, statusCounts] = await Promise.all([
		Ticket.countDocuments(filter),
		Ticket.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
	]);
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const page = Math.min(positiveInteger(options.page, 1), totalPages);
	const tickets = await Ticket.find(filter)
		.populate('organizationId', 'name organizationName email')
		.sort({ createdAt: -1, _id: -1 })
		.skip((page - 1) * limit)
		.limit(limit);

	const summary = { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
	for (const { _id: status, count } of statusCounts) {
		summary[status] = count;
		summary.total += count;
	}

	return {
		tickets: tickets.map(publicTicket),
		pagination: { page, limit, total, totalPages },
		summary,
	};
}

async function createTicket(user, input) {
	if (user.role !== 'organization') throw httpError(403, 'Only organizations can report issues.');
	const fields = validateTicketInput(input);
	const ticket = await Ticket.create({ ...fields, organizationId: user.id, ticketNumber: await nextTicketNumber() });
	const organization = await User.findById(user.id).select('name organizationName email');
	const organizationName = organization?.organizationName || organization?.name || organization?.email || 'An organization';
	await notify({
		audience: 'admin',
		organizationId: user.id,
		kind: 'ticket_created',
		ticketId: ticket._id,
		ticketNumber: ticket.ticketNumber,
		title: `${organizationName} reported an issue`,
		message: ticket.subject.slice(0, 300),
	});
	return publicTicket({ ...ticket.toObject(), organizationId: organization || ticket.organizationId });
}

async function updateTicket(user, ticketId, input = {}) {
	if (!mongoose.isValidObjectId(ticketId)) throw httpError(400, 'Invalid ticket id.');
	const ticket = await Ticket.findOne(user.role === 'admin' ? { _id: ticketId } : { _id: ticketId, organizationId: user.id });
	if (!ticket) throw httpError(404, 'Ticket not found.');

	if (user.role !== 'admin') {
		if (input.status !== 'closed' || Object.keys(input).some((key) => key !== 'status')) {
			throw httpError(403, 'You can only close your own ticket.');
		}
	}

	let statusChanged = false;
	let replied = false;
	if (input.status !== undefined) {
		if (!TICKET_STATUSES.includes(input.status)) throw httpError(400, 'Select a valid status.');
		if (input.status !== ticket.status) {
			ticket.status = input.status;
			ticket.resolvedAt = ['resolved', 'closed'].includes(input.status) ? new Date() : null;
			statusChanged = true;
		}
	}
	if (input.adminResponse !== undefined) {
		const response = trimmed(input.adminResponse);
		if (response.length > 2000) throw httpError(400, 'Response must be 2000 characters or fewer.');
		if (response !== ticket.adminResponse) {
			ticket.adminResponse = response;
			ticket.respondedAt = response ? new Date() : null;
			replied = Boolean(response);
		}
	}

	await ticket.save();
	if (user.role === 'admin' && (statusChanged || replied)) {
		await notify({
			audience: 'organization',
			organizationId: ticket.organizationId,
			kind: 'ticket_updated',
			ticketId: ticket._id,
			ticketNumber: ticket.ticketNumber,
			title: replied ? 'Admin replied to your issue' : `Your issue is now ${STATUS_LABELS[ticket.status] || ticket.status}`,
			message: (replied ? ticket.adminResponse : ticket.subject).slice(0, 300),
		});
	}
	await ticket.populate('organizationId', 'name organizationName email');
	return publicTicket(ticket);
}

module.exports = { createTicket, listTickets, updateTicket, validateTicketInput };
