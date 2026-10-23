const mongoose = require('mongoose');
const Location = require('../models/Location');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { resolveMasterValue } = require('./masterDataService');
const { escapeRegex } = require('../utils/validation');

function publicLocation(location) {
	const value = location.toObject ? location.toObject() : location;
	return {
		id: String(value._id || value.id),
		organizationId: String(value.organizationId?._id || value.organizationId),
		workName: value.workName || '',
		opNumber: value.opNumber || '',
		name: value.name,
		address: value.address || '',
		loaReference: value.loaReference || '',
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
	const loaReference = typeof input.loaReference === 'string' ? input.loaReference.trim() : '';
	const designation = typeof input.designation === 'string' ? input.designation : '';
	const status = input.status === undefined && !partial ? 'active' : input.status;

	for (const [key, value, maxLength, label] of [
		['workName', workName, 120, 'Work name'],
		['opNumber', opNumber, 50, 'OP number'],
		['name', name, 500, 'Location'],
		['address', address, 500, 'Address'],
		['loaReference', loaReference, 200, 'LOA / work order reference'],
	]) {
		if (partial && input[key] === undefined) continue;
		if (value.length > maxLength) throw httpError(400, `${label} must be ${maxLength} characters or fewer.`);
		fields[key] = value;
	}
	if (!partial || input.designation !== undefined) {
		const normalizedDesignation = designation.trim().replace(/\s+/g, ' ');
		if (!normalizedDesignation || normalizedDesignation.length > 100) {
			throw httpError(400, 'Select a valid designation.');
		}
		fields.designation = normalizedDesignation;
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

const LOCATION_PAGE_SIZE = 10;
const MAX_LOCATION_PAGE_SIZE = 100;

function positiveInteger(value, fallback) {
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

async function listLocations(user, organizationId, options = {}) {
	const resolvedOrganizationId = await resolveOrganizationId(user, organizationId);
	const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
	const status = ['active', 'disabled'].includes(options.status) ? options.status : 'all';
	const designation = typeof options.designation === 'string' ? options.designation.trim().slice(0, 100) : '';
	const limit = Math.min(positiveInteger(options.limit, LOCATION_PAGE_SIZE), MAX_LOCATION_PAGE_SIZE);
	const scope = { organizationId: resolvedOrganizationId };
	const filter = { ...scope };

	if (status !== 'all') filter.status = status;
	if (designation && designation.toLowerCase() !== 'all') filter.designation = new RegExp(`^${escapeRegex(designation)}$`, 'i');
	if (search) {
		const pattern = new RegExp(escapeRegex(search), 'i');
		filter.$or = [{ workName: pattern }, { opNumber: pattern }, { name: pattern }, { address: pattern }, { designation: pattern }];
	}

	const [total, scopeTotal, scopeActive, designations] = await Promise.all([
		Location.countDocuments(filter),
		Location.countDocuments(scope),
		Location.countDocuments({ ...scope, status: 'active' }),
		Location.distinct('designation', scope),
	]);
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const page = Math.min(positiveInteger(options.page, 1), totalPages);
	const locations = await Location.find(filter)
		.sort({ name: 1, _id: 1 })
		.skip((page - 1) * limit)
		.limit(limit);

	return {
		locations: locations.map(publicLocation),
		pagination: { page, limit, total, totalPages },
		summary: { total: scopeTotal, active: scopeActive, inactive: scopeTotal - scopeActive },
		designations: designations.filter(Boolean).sort(),
	};
}

async function createLocation(user, organizationId, input) {
	const resolvedOrganizationId = await resolveOrganizationId(user, organizationId);
	const fields = validateLocationInput(input);
	fields.designation = await resolveMasterValue('designation', fields.designation);
	const location = await Location.create({ ...fields, organizationId: resolvedOrganizationId });
	return publicLocation(location);
}

async function updateLocation(user, organizationId, locationId, input) {
	const { location } = await resolveLocation(user, organizationId, locationId);
	const fields = validateLocationInput(input, { partial: true });
	if (fields.designation !== undefined) {
		fields.designation = fields.designation.toLowerCase() === String(location.designation || '').toLowerCase()
			? location.designation
			: await resolveMasterValue('designation', fields.designation);
	}
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
