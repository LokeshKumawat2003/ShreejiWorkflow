const nodemailer = require('nodemailer');
const { httpError } = require('../utils/httpError');

let cached = null;

function getMailTransport() {
	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
	const port = Number(SMTP_PORT);
	if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
		throw httpError(503, 'Email sending is not configured.');
	}

	const secure = process.env.SMTP_SECURE === 'true';
	const key = [SMTP_HOST, port, secure, SMTP_USER, SMTP_PASS].join('|');
	if (cached && cached.key === key && cached.factory === nodemailer.createTransport) return cached.transport;

	cached?.transport.close?.();
	const transport = nodemailer.createTransport({
		host: SMTP_HOST,
		port,
		secure,
		auth: { user: SMTP_USER, pass: SMTP_PASS },
		pool: true,
		maxConnections: 3,
	});
	cached = { key, factory: nodemailer.createTransport, transport };
	return transport;
}

module.exports = { getMailTransport };
