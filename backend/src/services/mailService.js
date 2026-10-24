const nodemailer = require('nodemailer');
const { httpError } = require('../utils/httpError');

function getMailTransport() {
	const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
	const port = Number(SMTP_PORT);
	if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
		throw httpError(503, 'Email sending is not configured.');
	}

	return nodemailer.createTransport({
		host: SMTP_HOST,
		port,
		secure: process.env.SMTP_SECURE === 'true',
		auth: { user: SMTP_USER, pass: SMTP_PASS },
	});
}

module.exports = { getMailTransport };
