const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { normalizeEmail } = require('../utils/user');
const { escapeRegex, validateEmail } = require('../utils/validation');

const PAGE_SIZE = 10;
const BANK_FIELDS = [
	'bankName',
	'bankBranch',
	'bankAccountHolder',
	'bankAccountNumber',
	'bankRoutingCode',
];

function publicEmployee(employee) {
	const value = employee.toObject ? employee.toObject() : employee;
	const organization = value.organizationId?.organizationName ? value.organizationId : null;
	const organizationId = organization?._id || value.organizationId;

	return {
		id: String(value._id || value.id),
		organizationId: organizationId ? String(organizationId) : '',
		organizationName: organization?.organizationName || value.organizationName || '',
		name: value.name,
		email: value.email,
		department: value.department || '',
		jobTitle: value.jobTitle || '',
		phone: value.phone || '',
		address: value.address || '',
		dailySalary: value.dailySalary ?? 0,
		currency: value.currency || 'NRI',
		bankName: value.bankName || '',
		bankBranch: value.bankBranch || '',
		bankAccountHolder: value.bankAccountHolder || '',
		bankAccountNumber: value.bankAccountNumber || '',
		bankRoutingCode: value.bankRoutingCode || '',
		status: value.status,
		createdAt: value.createdAt,
	};
}

function organizationScope(user) {
	return user.role === 'admin' ? {} : { organizationId: user.id };
}

async function resolveOrganizationId(user, input) {
	if (user.role !== 'admin') return user.id;
	const organizationId = typeof input.organizationId === 'string' ? input.organizationId : '';
	if (!organizationId) return null;
	if (!mongoose.isValidObjectId(organizationId)) throw httpError(400, 'Invalid organization id.');
	const organization = await User.findOne({ _id: organizationId, role: 'organization' });
	if (!organization) throw httpError(404, 'Organization not found.');
	return organization.id;
}

function validateEmployeeInput(input, { partial = false } = {}) {
	const fields = {};
	const name = typeof input.name === 'string' ? input.name.trim() : '';
	const email = normalizeEmail(input.email);
	if (!partial || input.name !== undefined) fields.name = name;
	if (!partial || input.email !== undefined) fields.email = email;

	const textFields = [
		['department', 100],
		['jobTitle', 100],
		['phone', 30],
		['address', 500],
		['bankName', 120],
		['bankBranch', 120],
		['bankAccountHolder', 100],
		['bankAccountNumber', 34],
		['bankRoutingCode', 20],
	];

	for (const [field, maxLength] of textFields) {
		if (!partial || input[field] !== undefined) {
			const value = typeof input[field] === 'string' ? input[field].trim() : '';
			if (value.length > maxLength) {
				throw httpError(400, `${field} must be ${maxLength} characters or fewer.`);
			}
			fields[field] = field === 'bankRoutingCode' ? value.toUpperCase() : value;
		}
	}
	if (!partial || input.dailySalary !== undefined) {
		const dailySalary = input.dailySalary === undefined ? 0 : Number(input.dailySalary);
		if (!Number.isFinite(dailySalary) || dailySalary < 0 || dailySalary > 1_000_000_000_000) {
			throw httpError(400, 'Daily salary must be a valid non-negative amount.');
		}
		if (Math.abs(Math.round(dailySalary * 100) / 100 - dailySalary) > 1e-8) {
			throw httpError(400, 'Daily salary can have at most two decimal places.');
		}
		fields.dailySalary = dailySalary;
	}
	if (!partial || input.currency !== undefined) {
		const currency = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : 'NRI';
		if (!/^[A-Z]{3}$/.test(currency)) throw httpError(400, 'Currency must be a three-letter code.');
		fields.currency = currency;
	}
	if (input.status !== undefined) fields.status = input.status;

	if ((!partial || fields.name !== undefined) && !fields.name) {
		throw httpError(400, 'Employee name is required.');
	}
	if (fields.name && fields.name.length > 100) {
		throw httpError(400, 'Employee name must be 100 characters or fewer.');
	}
	if ((!partial || fields.email !== undefined) && !fields.email) {
		throw httpError(400, 'Employee email is required.');
	}
	if (fields.email && (fields.email.length > 254 || !validateEmail(fields.email))) {
		throw httpError(400, 'Enter a valid employee email address.');
	}
	if (fields.phone && (!/^\+?[0-9().\s-]{7,30}$/.test(fields.phone) || (fields.phone.match(/\d/g) || []).length < 7)) {
		throw httpError(400, 'Enter a valid phone number.');
	}
	if (fields.bankAccountNumber && !/^[A-Za-z0-9 -]{4,34}$/.test(fields.bankAccountNumber)) {
		throw httpError(400, 'Account number must be 4-34 letters or digits.');
	}
	if (fields.bankRoutingCode && !/^[A-Za-z0-9 -]{3,20}$/.test(fields.bankRoutingCode)) {
		throw httpError(400, 'Routing code must be 3-20 letters or digits.');
	}

	const bankFieldsIncluded = !partial || BANK_FIELDS.some((field) => input[field] !== undefined);
	if (bankFieldsIncluded) {
		const hasAnyBankValue = BANK_FIELDS.some((field) => Boolean(fields[field]));
		if (hasAnyBankValue && BANK_FIELDS.some((field) => !fields[field])) {
			throw httpError(400, 'Complete all bank details or leave them all blank.');
		}
	}
	if (fields.status !== undefined && !['active', 'disabled'].includes(fields.status)) {
		throw httpError(400, 'Status must be active or disabled.');
	}

	return fields;
}

async function listEmployees(user, options = {}) {
	const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
	const status = ['active', 'disabled'].includes(options.status) ? options.status : 'all';
	const sortOrder = ['name-asc', 'name-desc', 'newest', 'oldest'].includes(options.sort)
		? options.sort
		: 'name-asc';
	const requestedPage = Number(options.page);
	const pageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const requestedLimit = Number(options.limit);
	const limit = Math.min(Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : PAGE_SIZE, PAGE_SIZE);
	const filter = organizationScope(user);

	if (user.role === 'admin' && options.organizationId) {
		if (!mongoose.isValidObjectId(options.organizationId)) throw httpError(400, 'Invalid organization id.');
		filter.organizationId = options.organizationId;
	}
	if (user.role === 'admin' && (options.unassigned === 'true' || options.unassigned === true)) {
		filter.organizationId = null;
	}
	if (user.role === 'admin' && !options.unassigned && (options.assignedOnly === 'true' || options.assignedOnly === true)) {
		filter.organizationId = { $ne: null };
	}
	const activeOnly = user.role === 'organization'
		|| options.activeOnly === 'true'
		|| options.activeOnly === true
		|| options.unassigned === 'true'
		|| options.unassigned === true;
	if (activeOnly) filter.status = 'active';
	else if (status !== 'all') filter.status = status;

	if (search) {
		const pattern = new RegExp(escapeRegex(search), 'i');
		filter.$or = [
			{ name: pattern },
			{ email: pattern },
			{ department: pattern },
			{ jobTitle: pattern },
		];
		if (user.role === 'admin') {
			const matchingOrganizations = await User.find({ role: 'organization', organizationName: pattern }).distinct('_id');
			filter.$or.push({ organizationId: { $in: matchingOrganizations } });
		}
	}

	const total = await Employee.countDocuments(filter);
	const totalPages = Math.max(1, Math.ceil(total / limit));
	const page = Math.min(pageNumber, totalPages);
	const sort = {
		'name-asc': { name: 1, _id: 1 },
		'name-desc': { name: -1, _id: -1 },
		newest: { createdAt: -1, _id: -1 },
		oldest: { createdAt: 1, _id: 1 },
	}[sortOrder];
	const employees = await Employee.find(filter)
		.populate('organizationId', 'organizationName')
		.sort(sort)
		.skip((page - 1) * limit)
		.limit(limit);

	return {
		employees: employees.map(publicEmployee),
		pagination: { page, limit, total, totalPages },
	};
}

async function createEmployee(user, input = {}) {
	const fields = validateEmployeeInput(input);
	const organizationId = await resolveOrganizationId(user, input);
	const employee = await Employee.create({ ...fields, organizationId });
	await employee.populate('organizationId', 'organizationName');
	return publicEmployee(employee);
}

async function getEmployee(user, id) {
	if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid employee id.');
	const filter = { _id: id, ...organizationScope(user) };
	if (user.role === 'organization') filter.status = 'active';
	const employee = await Employee.findOne(filter).populate('organizationId', 'organizationName');
	if (!employee) throw httpError(404, 'Employee not found.');
	return publicEmployee(employee);
}

async function updateEmployee(user, id, input = {}) {
	if (user.role !== 'admin') throw httpError(403, 'Only administrators can edit employees.');
	if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid employee id.');
	const fields = validateEmployeeInput(input, { partial: true });
	if (input.organizationId !== undefined) {
		if (!mongoose.isValidObjectId(input.organizationId)) throw httpError(400, 'Invalid organization id.');
		const organization = await User.findOne({ _id: input.organizationId, role: 'organization' });
		if (!organization) throw httpError(404, 'Organization not found.');
		fields.organizationId = organization.id;
	}
	const employee = await Employee.findOneAndUpdate(
		{ _id: id },
		{ $set: fields },
		{ new: true, runValidators: true },
	).populate('organizationId', 'organizationName');
	if (!employee) throw httpError(404, 'Employee not found.');
	return publicEmployee(employee);
}

async function assignEmployees(user, input = {}) {
	if (user.role !== 'admin') throw httpError(403, 'Only administrators can assign employees.');
	const organizationId = typeof input.organizationId === 'string' ? input.organizationId : '';
	if (!mongoose.isValidObjectId(organizationId)) throw httpError(400, 'Invalid organization id.');
	const employeeIds = Array.isArray(input.employeeIds) ? [...new Set(input.employeeIds)] : [];
	if (employeeIds.length === 0 || employeeIds.length > 100 || employeeIds.some((id) => !mongoose.isValidObjectId(id))) {
		throw httpError(400, 'Select between 1 and 100 valid employees.');
	}

	const organization = await User.findOne({ _id: organizationId, role: 'organization' });
	if (!organization) throw httpError(404, 'Organization not found.');
	const employeeFilter = {
		_id: { $in: employeeIds },
		status: 'active',
		$or: [{ organizationId: null }, { organizationId: { $exists: false } }],
	};
	const employees = await Employee.find(employeeFilter);
	if (employees.length !== employeeIds.length) {
		throw httpError(409, 'One or more selected employees are no longer unassigned.');
	}

	const emailSet = new Set(employees.map(({ email }) => email));
	if (emailSet.size !== employees.length) throw httpError(409, 'Selected employees contain duplicate email addresses.');
	const existingEmployees = await Employee.countDocuments({ organizationId, email: { $in: [...emailSet] } });
	if (existingEmployees > 0) {
		throw httpError(409, 'An employee with one of these email addresses already belongs to this organization.');
	}

	await Employee.updateMany(employeeFilter, { $set: { organizationId } });
	const assigned = await Employee.find({ _id: { $in: employeeIds } }).populate('organizationId', 'organizationName');
	return assigned.map(publicEmployee);
}

async function unassignEmployees(user, input = {}) {
	let organizationId;
	if (user.role === 'admin') {
		organizationId = typeof input.organizationId === 'string' ? input.organizationId : '';
		if (!mongoose.isValidObjectId(organizationId)) throw httpError(400, 'Invalid organization id.');
	} else {
		organizationId = user.id;
	}

	const employeeIds = Array.isArray(input.employeeIds) ? [...new Set(input.employeeIds)] : [];
	if (employeeIds.length === 0 || employeeIds.length > 100 || employeeIds.some((id) => !mongoose.isValidObjectId(id))) {
		throw httpError(400, 'Select between 1 and 100 valid employees.');
	}
	const employeeFilter = { _id: { $in: employeeIds }, organizationId };
	const employees = await Employee.find(employeeFilter);
	if (employees.length !== employeeIds.length) throw httpError(404, 'One or more employees do not belong to this organization.');
	await Employee.updateMany(employeeFilter, { $set: { organizationId: null } });
	return employees.map((employee) => publicEmployee({ ...employee.toObject(), organizationId: null }));
}

async function deleteEmployee(user, id) {
	if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid employee id.');
	const filter = { _id: id, ...organizationScope(user) };
	if (user.role === 'organization') filter.status = 'active';
	const employee = await Employee.findOneAndDelete(filter);
	if (!employee) throw httpError(404, 'Employee not found.');
	await Attendance.deleteMany({ employeeId: employee._id });
	return publicEmployee(employee);
}

module.exports = {
	assignEmployees,
	createEmployee,
	deleteEmployee,
	getEmployee,
	listEmployees,
	unassignEmployees,
	updateEmployee,
};
