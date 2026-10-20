const mongoose = require('mongoose');
const Location = require('../models/Location');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');

function publicLocation(location) {
	const value = location.toObject ? location.toObject() : location;
	return {
		id: String(value._id || value.id),
		organizationId: String(value.organizationId?._id || value.organizationId),
		workName: value.workName || '',
		opNumber: value.opNumber || '',
		name: value.name,
		address: value.address || '',
		designation: value.designation || '',
		status: value.status,
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	};
}

async function resolveOrganizationId(user, organizationId) {
	if (!mongoose.isValidObjectId(organizationId)) throw httpError(400, 'Invalid organization id.');
	if (user.role !== 'admin') {
		if (String(user.id) !== String(organizationId)) {
			throw httpError(403, 'You do not have access to this organization.');
		}
		return organizationId;
	}

	const organization = await User.findOne({ _id: organizationId, role: 'organization' });
	if (!organization) throw httpError(404, 'Organization not found.');
	return organization.id;
}

function validateLocationInput(input = {}, { partial = false } = {}) {
	const fields = {};
	const workName = typeof input.workName === 'string' ? input.workName.trim() : '';
	const opNumber = typeof input.opNumber === 'string' ? input.opNumber.trim() : '';
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const address = typeof input.address === 'string' ? input.address.trim() : '';
	const designation = typeof input.designation === 'string' ? input.designation : '';
	const status = input.status === undefined && !partial ? 'active' : input.status;

	for (const [key, value, maxLength, label] of [
		['workName', workName, 120, 'Work name'],
		['opNumber', opNumber, 50, 'OP number'],
		['name', name, 500, 'Location'],
		['address', address, 500, 'Address'],
	]) {
		if (partial && input[key] === undefined) continue;
		if (value.length > maxLength) throw httpError(400, `${label} must be ${maxLength} characters or fewer.`);
		fields[key] = value;
	}
	if (!partial || input.designation !== undefined) {
		if (!['cook', 'event', 'plumber'].includes(designation)) {
			throw httpError(400, 'Select a valid designation.');
		}
		fields.designation = designation;
	}
	if (!partial || input.status !== undefined) {
		if (!['active', 'disabled'].includes(status)) throw httpError(400, 'Status must be active or disabled.');
		fields.status = status;
	}
	if ((!partial || input.workName !== undefined) && !fields.workName) throw httpError(400, 'Work name is required.');
	if ((!partial || input.name !== undefined) && !fields.name) throw httpError(400, 'Location is required.');
	return fields;
}

async function resolveLocation(user, organizationId, locationId) {
	const resolvedOrganizationId = await resolveOrganizationId(user, organizationId);
	if (!mongoose.isValidObjectId(locationId)) throw httpError(400, 'Invalid location id.');
	const location = await Location.findOne({ _id: locationId, organizationId: resolvedOrganizationId });
	if (!location) throw httpError(404, 'Location not found.');
	return { location, organizationId: resolvedOrganizationId };
}

async function listLocations(user, organizationId) {
	const resolvedOrganizationId = await resolveOrganizationId(user, organizationId);
	const locations = await Location.find({ organizationId: resolvedOrganizationId }).sort({ name: 1, _id: 1 });
	return locations.map(publicLocation);
}

async function createLocation(user, organizationId, input) {
	const resolvedOrganizationId = await resolveOrganizationId(user, organizationId);
	const fields = validateLocationInput(input);
	const location = await Location.create({ ...fields, organizationId: resolvedOrganizationId });
	return publicLocation(location);
}

async function updateLocation(user, organizationId, locationId, input) {
	const { location } = await resolveLocation(user, organizationId, locationId);
	const fields = validateLocationInput(input, { partial: true });
	Object.assign(location, fields);
	await location.save();
	return publicLocation(location);
}

async function deleteLocation(user, organizationId, locationId) {
	const { location } = await resolveLocation(user, organizationId, locationId);
	await Employee.updateMany(
		{ organizationId: location.organizationId, locationId: location._id },
		{ $set: { locationId: null, locationAssignedAt: null } },
	);
	await location.deleteOne();
	return publicLocation(location);
}

module.exports = { createLocation, deleteLocation, listLocations, updateLocation, validateLocationInput };
