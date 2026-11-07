const { createTicket, listTickets, updateTicket } = require('../services/ticketService');

async function list(req, res) {
	return res.json(await listTickets(req.user, req.query));
}

async function create(req, res) {
	const ticket = await createTicket(req.user, req.body || {});
	return res.status(201).json({ ticket });
}

async function update(req, res) {
	const ticket = await updateTicket(req.user, req.params.ticketId, req.body || {});
	return res.json({ ticket });
}

module.exports = { create, list, update };
