const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { getMailTransport } = require('./mailService');

function safeFilePart(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee';
}

async function deliverMail(transporter, message) {
	try {
		await transporter.sendMail(message);
	} catch (error) {
		console.error('Appointment letter email delivery failed.', {
			code: error.code,
			command: error.command,
			responseCode: error.responseCode,
		});
		throw httpError(502, 'Email delivery failed. Check SMTP authentication and sender authorization.');
	}
}

async function sendAppointmentLetterEmail(user, { employeeId, locationId, file }) {
	if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Invalid employee id.');
	if (!mongoose.isValidObjectId(locationId)) throw httpError(400, 'Invalid location id.');
	if (!file?.buffer) throw httpError(400, 'An appointment letter PDF is required.');

	const locationFilter = { _id: locationId };
	if (user.role === 'organization') locationFilter.organizationId = user.id;
	const location = await Location.findOne(locationFilter).select('name organizationId');
	if (!location) throw httpError(404, 'Location not found.');

	const employee = await Employee.findOne({
		_id: employeeId,
		organizationId: location.organizationId,
		locationId: location._id,
	}).select('name email');
	if (!employee) throw httpError(404, 'Employee is not assigned to this location.');

	const transporter = getMailTransport();
	await deliverMail(transporter, {
		from: process.env.MAIL_FROM,
		to: employee.email,
		subject: `Appointment Letter - ${location.name}`,
		text: `Dear ${employee.name},\n\nPlease find your appointment letter attached.\n\nShreeji Caretaker Company`,
		attachments: [{
			filename: `appointment-letter-${safeFilePart(employee.name)}.pdf`,
			content: file.buffer,
			contentType: 'application/pdf',
		}],
	});
	return { sent: true };
}

async function sendOrganizationAppointmentLettersEmail(user, { locationId, file }) {
	if (!mongoose.isValidObjectId(locationId)) throw httpError(400, 'Invalid location id.');
	if (!file?.buffer) throw httpError(400, 'Appointment letter PDF is required.');

	const locationFilter = { _id: locationId };
	if (user.role === 'organization') locationFilter.organizationId = user.id;
	const location = await Location.findOne(locationFilter).select('name organizationId');
	if (!location) throw httpError(404, 'Location not found.');

	const organization = await User.findOne({ _id: location.organizationId, role: 'organization' }).select('email organizationName');
	if (!organization) throw httpError(404, 'Organization not found.');

	const transporter = getMailTransport();
	await deliverMail(transporter, {
		from: process.env.MAIL_FROM,
		to: organization.email,
		subject: `Appointment Letters - ${location.name}`,
		text: `Hello ${organization.organizationName},\n\nPlease find the appointment letters for ${location.name} attached.\n\nShreeji Caretaker Company`,
		attachments: [{
			filename: `appointment-letters-${safeFilePart(location.name)}.pdf`,
			content: file.buffer,
			contentType: 'application/pdf',
		}],
	});
	return { sent: true };
}

module.exports = { sendAppointmentLetterEmail, sendOrganizationAppointmentLettersEmail };