const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');

const { MASTER_DATA_TYPES } = MasterData;
const MASTER_DATA_PAGE_SIZE = 10;

const TYPE_LABELS = {
	designation: 'designation',
	employmentType: 'type of employment',
	skillCategory: 'category of skill',
};

// Employees store the name for designation and skill category (locations store the designation code),
// so those codes must stay equal to the lowercased name. Employment type stores the code itself.
const DEFAULT_MASTER_DATA = [
	{ type: 'designation', name: 'Cook', code: 'cook' },
	{ type: 'designation', name: 'Plumber', code: 'plumber' },
	{ type: 'designation', name: 'Event', code: 'event' },
	{ type: 'employmentType', name: 'Regular', code: 'regular' },
	{ type: 'employmentType', name: 'Fixed-term employment', code: 'fixed-term' },
	{ type: 'employmentType', name: 'Contractual', code: 'contractual' },
	{ type: 'skillCategory', name: 'Skilled', code: 'skilled' },
	{ type: 'skillCategory', name: 'Semi-Skilled', code: 'semi-skilled' },
	{ type: 'skillCategory', name: 'Un-skilled', code: 'un-skilled' },
];

function normalizeName(value) {
	return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function codeFor(type, name) {
	const lower = name.toLowerCase();
	return type === 'employmentType' ? lower.replace(/\s+/g, '-') : lower;
}

function publicMasterData(item, usageCount) {
	const value = item.toObject ? item.toObject() : item;
	return {
		id: String(value._id || value.id),
		type: value.type,
		name: value.name,
		code: value.code,
		status: value.status,
		...(usageCount === undefined ? {} : { usageCount }),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	};
}

function requireAdmin(user) {
	if (user.role !== 'admin') throw httpError(403, 'Only administrators can manage master data.');
}

async function ensureDefaultMasterData() {
	if (await MasterData.estimatedDocumentCount() > 0) return;
	try {
		await MasterData.insertMany(DEFAULT_MASTER_DATA, { ordered: false });
	} catch (error) {
		if (error.code !== 11000 && !error.writeErrors) throw error;
	}
}

async function countUsage(item) {
	const namePattern = new RegExp(`^${escapeRegex(item.name)}$`, 'i');
	if (item.type === 'designation') {
		const [employees, locations] = await Promise.all([
			Employee.countDocuments({ designation: namePattern }),
			Location.countDocuments({ designation: namePattern }),
		]);
		return employees + locations;
	}
	if (item.type === 'skillCategory') return Employee.countDocuments({ skillCategory: namePattern });
	return Employee.countDocuments({ employmentType: item.code });
}

function validateType(type) {
	if (!MASTER_DATA_TYPES.includes(type)) throw httpError(400, 'Select a valid master data type.');
	return type;
}

function validateName(value) {
	const name = normalizeName(value);
	if (!name) throw httpError(400, 'Name is required.');
	if (name.length > 100) throw httpError(400, 'Name must be 100 characters or fewer.');
	return name;
}

function validateStatus(value) {
	if (!['active', 'disabled'].includes(value)) throw httpError(400, 'Status must be active or disabled.');
	return value;
}

async function listMasterData(user, options = {}) {
	await ensureDefaultMasterData();
	const filter = {};
	if (options.type) filter.type = validateType(options.type);
	if (user.role !== 'admin' || options.status === 'active') filter.status = 'active';
	else if (options.status === 'disabled') filter.status = 'disabled';
	const search = normalizeName(options.search).slice(0, 100);
	if (search) filter.name = new RegExp(escapeRegex(search), 'i');

	let pagination;
	let query = MasterData.find(filter).sort({ type: 1, name: 1, _id: 1 });
	if (options.page !== undefined) {
		const requestedLimit = Number(options.limit);
		const limit = Math.min(Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : MASTER_DATA_PAGE_SIZE, 100);
		const total = await MasterData.countDocuments(filter);
		const totalPages = Math.max(1, Math.ceil(total / limit));
		const requestedPage = Number(options.page);
		const page = Math.min(Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1, totalPages);
		query = query.skip((page - 1) * limit).limit(limit);
		pagination = { page, limit, total, totalPages };
	}

	const items = await query.lean();
	const counts = user.role === 'admin' && options.includeUsage === 'true'
		? await Promise.all(items.map(countUsage))
		: [];
	const publicItems = items.map((item, index) => publicMasterData(item, counts[index]));
	return pagination ? { items: publicItems, pagination } : publicItems;
}

async function findItem(id) {
	if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid master data id.');
	const item = await MasterData.findById(id);
	if (!item) throw httpError(404, 'Master data entry not found.');
	return item;
}

async function createMasterData(user, input = {}) {
	requireAdmin(user);
	const type = validateType(input.type);
	const name = validateName(input.name);
	const status = input.status === undefined ? 'active' : validateStatus(input.status);
	const code = codeFor(type, name);
	if (await MasterData.exists({ type, code })) {
		throw httpError(409, `This ${TYPE_LABELS[type]} already exists.`);
	}
	const item = await MasterData.create({ type, name, code, status });
	return publicMasterData(item, 0);
}

async function updateMasterData(user, id, input = {}) {
	requireAdmin(user);
	const item = await findItem(id);
	const usageCount = await countUsage(item);
	const previousName = item.name;

	if (input.name !== undefined) {
		const name = validateName(input.name);
		if (name !== item.name) {
			const nextCode = item.type === 'employmentType' ? item.code : codeFor(item.type, name);
			if (nextCode !== item.code && usageCount > 0) {
				throw httpError(409, `This ${TYPE_LABELS[item.type]} is used by ${usageCount} record${usageCount === 1 ? '' : 's'}, so only letter case can be changed. Disable it and add a new one instead.`);
			}
			if (nextCode !== item.code && await MasterData.exists({ type: item.type, code: nextCode, _id: { $ne: item._id } })) {
				throw httpError(409, `This ${TYPE_LABELS[item.type]} already exists.`);
			}
			item.name = name;
			item.code = nextCode;
		}
	}
	if (input.status !== undefined) item.status = validateStatus(input.status);
	await item.save();
	if (usageCount > 0 && item.name !== previousName && item.type !== 'employmentType') {
		const previousPattern = new RegExp(`^${escapeRegex(previousName)}$`, 'i');
		await Employee.updateMany({ [item.type]: previousPattern }, { $set: { [item.type]: item.name } });
		if (item.type === 'designation') {
			await Location.updateMany({ designation: previousPattern }, { $set: { designation: item.name } });
		}
	}
	return publicMasterData(item, usageCount);
}

async function deleteMasterData(user, id) {
	requireAdmin(user);
	const item = await findItem(id);
	const usageCount = await countUsage(item);
	if (usageCount > 0) {
		throw httpError(409, `This ${TYPE_LABELS[item.type]} is used by ${usageCount} record${usageCount === 1 ? '' : 's'}. Disable it instead of deleting.`);
	}
	await item.deleteOne();
	return publicMasterData(item, 0);
}

/**
 * Resolves a submitted value to its master data entry and returns the value to store:
 * the code for employment type and location designations, otherwise the display name.
 */
async function resolveMasterValue(type, value, { store = 'name' } = {}) {
	const code = codeFor(type, normalizeName(value));
	const item = await MasterData.findOne({ type, code }).lean();
	if (!item) throw httpError(400, `Select a valid ${TYPE_LABELS[type]} from Settings → Master data.`);
	if (item.status === 'disabled') throw httpError(400, `The ${TYPE_LABELS[type]} "${item.name}" is disabled in Settings → Master data.`);
	return store === 'code' ? item.code : item.name;
}

module.exports = {
	createMasterData,
	deleteMasterData,
	ensureDefaultMasterData,
	listMasterData,
	resolveMasterValue,
	updateMasterData,
};
