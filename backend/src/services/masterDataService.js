const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');
const { recalculateEmployeeSalaries } = require('./salaryService');

const { MASTER_DATA_TYPES } = MasterData;
const MASTER_DATA_PAGE_SIZE = 10;

const TYPE_LABELS = {
	designation: 'designation',
	employmentType: 'type of employment',
	skillCategory: 'category of skill',
	workName: 'work name',
	governmentType: 'government type',
	area: 'area',
};

const DEFAULT_GOVERNMENT_TYPES = [
	{ type: 'governmentType', name: 'State', code: 'state' },
	{ type: 'governmentType', name: 'Central', code: 'central' },
];

const DEFAULT_AREAS = [
	{ type: 'area', name: 'A - Inside city', code: 'a - inside city' },
	{ type: 'area', name: 'B - Mid city', code: 'b - mid city' },
	{ type: 'area', name: 'C - Out of city', code: 'c - out of city' },
];

const MAX_WORK_NAME_DESIGNATIONS = 100;

// Employees store the name for designation and skill category, organizations the government type and area names
// (locations store the designation code), so those codes must stay equal to the lowercased name.
// Employment type stores the code itself.
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

function publicRates(rates) {
	return (rates || []).map(({ governmentType, area, salary }) => ({ governmentType, area, salary }));
}

function publicMasterData(item, usageCount) {
	const value = item.toObject ? item.toObject() : item;
	return {
		id: String(value._id || value.id),
		type: value.type,
		name: value.name,
		code: value.code,
		status: value.status,
		...(value.type === 'workName' ? { designations: [...(value.designations || [])] } : {}),
		...(value.type === 'skillCategory'
			? {
				rates: publicRates(value.rates),
				effectiveFrom: value.effectiveFrom || '',
				effectiveTo: value.effectiveTo || '',
				rateHistory: (value.rateHistory || []).map((entry) => ({
					rates: publicRates(entry.rates),
					effectiveFrom: entry.effectiveFrom || '',
					effectiveTo: entry.effectiveTo || '',
					changedAt: entry.changedAt,
				})),
			}
			: {}),
		...(usageCount === undefined ? {} : { usageCount }),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
	};
}

function requireAdmin(user) {
	if (user.role !== 'admin') throw httpError(403, 'Only administrators can manage master data.');
}

async function insertDefaults(items) {
	try {
		await MasterData.insertMany(items, { ordered: false });
	} catch (error) {
		if (error.code !== 11000 && !error.writeErrors) throw error;
	}
}

async function ensureDefaultMasterData() {
	if (await MasterData.estimatedDocumentCount() === 0) await insertDefaults(DEFAULT_MASTER_DATA);
	if (!await MasterData.exists({ type: 'governmentType' })) await insertDefaults(DEFAULT_GOVERNMENT_TYPES);
	if (!await MasterData.exists({ type: 'area' })) await insertDefaults(DEFAULT_AREAS);
}

async function countUsage(item) {
	const namePattern = new RegExp(`^${escapeRegex(item.name)}$`, 'i');
	if (item.type === 'designation') {
		const [employees, locations, organizations, workNames] = await Promise.all([
			Employee.countDocuments({ designation: namePattern }),
			Location.countDocuments({ designation: namePattern }),
			User.countDocuments({ role: 'organization', 'posts.designations': namePattern }),
			MasterData.countDocuments({ type: 'workName', designations: namePattern }),
		]);
		return employees + locations + organizations + workNames;
	}
	if (item.type === 'workName') return User.countDocuments({ role: 'organization', 'posts.workName': namePattern });
	if (item.type === 'skillCategory') return Employee.countDocuments({ skillCategory: namePattern });
	if (item.type === 'governmentType' || item.type === 'area') {
		const [organizations, skillCategories] = await Promise.all([
			User.countDocuments({ role: 'organization', [item.type]: namePattern }),
			MasterData.countDocuments({ type: 'skillCategory', [`rates.${item.type}`]: namePattern }),
		]);
		return organizations + skillCategories;
	}
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

function validateSalary(value, label) {
	const salary = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	if (typeof salary !== 'number' || !Number.isFinite(salary) || salary < 0 || salary > 1_000_000_000_000
		|| Math.abs(Math.round(salary * 100) / 100 - salary) > 1e-8) {
		throw httpError(400, `Enter a valid non-negative salary for ${label}, with at most two decimal places.`);
	}
	return salary;
}

async function validateRates(value, current = []) {
	if (!Array.isArray(value)) throw httpError(400, 'Rates must be a list.');
	// Government types and areas already priced on this skill stay valid even if disabled later.
	const existing = {
		governmentType: new Map(current.map(({ governmentType }) => [governmentType.toLowerCase(), governmentType])),
		area: new Map(current.map(({ area }) => [String(area || '').toLowerCase(), area])),
	};
	const resolve = async (type, entry) => {
		const name = normalizeName(entry?.[type]);
		if (!name) throw httpError(400, `Every rate needs a ${TYPE_LABELS[type]}.`);
		return existing[type].get(name.toLowerCase()) || resolveMasterValue(type, name);
	};
	const rates = [];
	for (const entry of value) {
		const governmentType = await resolve('governmentType', entry);
		const area = await resolve('area', entry);
		const label = `${governmentType} · ${area}`;
		if (rates.some((rate) => rate.governmentType.toLowerCase() === governmentType.toLowerCase() && rate.area.toLowerCase() === area.toLowerCase())) {
			throw httpError(400, `${label} has more than one rate.`);
		}
		rates.push({ governmentType, area, salary: validateSalary(entry.salary, label) });
	}
	if (rates.length === 0) throw httpError(400, 'Enter the salary for at least one government type and area.');
	return rates;
}

function validateDate(value, label) {
	if (value === undefined || value === null || value === '') return '';
	const text = typeof value === 'string' ? value.trim() : '';
	const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : null;
	if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
		throw httpError(400, `${label} must be a valid date (YYYY-MM-DD).`);
	}
	return text;
}

/** Validates the editable validity period of a category of skill; either end can be left open. */
function validateDateRange(input, current = {}) {
	const effectiveFrom = input.effectiveFrom !== undefined ? validateDate(input.effectiveFrom, 'Valid from') : current.effectiveFrom || '';
	const effectiveTo = input.effectiveTo !== undefined ? validateDate(input.effectiveTo, 'Valid to') : current.effectiveTo || '';
	if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
		throw httpError(400, 'Valid to must be on or after Valid from.');
	}
	return { effectiveFrom, effectiveTo };
}

function todayIn(timeZone) {
	try {
		return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'Asia/Kolkata' }).format(new Date());
	} catch {
		return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
	}
}

function rateSignature(rates) {
	return (rates || [])
		.map(({ governmentType, area, salary }) => `${governmentType.toLowerCase()}|${area.toLowerCase()}|${salary}`)
		.sort()
		.join(';');
}

/**
 * Archives the current salaries of a category of skill, ending on the day they were changed (or on the new
 * start date when the admin set one), and starts the new rates today unless the admin edited the dates.
 */
function archiveRates(item, dateRange, datesEdited, timeZone) {
	const today = todayIn(timeZone);
	const effectiveTo = datesEdited && dateRange.effectiveFrom ? dateRange.effectiveFrom : today;
	// Rates replaced from a date on or before their own start never applied, so they are not kept as a period.
	const neverApplied = item.effectiveFrom && effectiveTo <= item.effectiveFrom;
	if (item.rates?.length && !neverApplied) {
		item.rateHistory = [
			...(item.rateHistory || []),
			{
				rates: item.rates.map(({ governmentType, area, salary }) => ({ governmentType, area, salary })),
				effectiveFrom: item.effectiveFrom || '',
				effectiveTo,
				changedAt: new Date(),
			},
		];
	}
	if (!datesEdited) {
		item.effectiveFrom = today;
		item.effectiveTo = '';
	}
}

async function validateWorkNameDesignations(value, current = []) {
	if (!Array.isArray(value)) throw httpError(400, 'Designations must be a list.');
	if (value.length > MAX_WORK_NAME_DESIGNATIONS) throw httpError(400, `A work name can have at most ${MAX_WORK_NAME_DESIGNATIONS} designations.`);
	const existing = new Map(current.map((name) => [name.toLowerCase(), name]));
	const designations = [];
	for (const entry of value) {
		const name = normalizeName(entry);
		if (!name) continue;
		// Designations already on this work name stay valid even if disabled later.
		const resolved = existing.get(name.toLowerCase()) || await resolveMasterValue('designation', name);
		if (!designations.some((item) => item.toLowerCase() === resolved.toLowerCase())) designations.push(resolved);
	}
	if (designations.length === 0) throw httpError(400, 'Select at least one designation for this work name.');
	return designations;
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
	const designations = type === 'workName' ? await validateWorkNameDesignations(input.designations ?? []) : undefined;
	const rates = type === 'skillCategory' ? await validateRates(input.rates ?? []) : undefined;
	const dateRange = type === 'skillCategory' ? validateDateRange(input) : undefined;
	const item = await MasterData.create({
		type,
		name,
		code,
		status,
		...(designations ? { designations } : {}),
		...(rates ? { rates } : {}),
		...(dateRange || {}),
	});
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
	if (item.type === 'workName' && input.designations !== undefined) {
		item.designations = await validateWorkNameDesignations(input.designations, item.designations || []);
	}
	let ratesChanged = false;
	if (item.type === 'skillCategory') {
		const dateRange = validateDateRange(input, item);
		const datesEdited = dateRange.effectiveFrom !== (item.effectiveFrom || '') || dateRange.effectiveTo !== (item.effectiveTo || '');
		if (input.rates !== undefined) {
			const nextRates = await validateRates(input.rates, item.rates || []);
			ratesChanged = rateSignature(item.rates) !== rateSignature(nextRates);
			if (ratesChanged) archiveRates(item, dateRange, datesEdited, input.timeZone);
			item.rates = nextRates;
		}
		if (!ratesChanged || datesEdited) Object.assign(item, dateRange);
	}
	await item.save();
	if (ratesChanged) await recalculateEmployeeSalaries({ skillCategory: new RegExp(`^${escapeRegex(item.name)}$`, 'i') });
	if (usageCount > 0 && item.name !== previousName && item.type !== 'employmentType') {
		const previousPattern = new RegExp(`^${escapeRegex(previousName)}$`, 'i');
		if (item.type === 'workName') {
			await User.updateMany(
				{ role: 'organization', 'posts.workName': previousPattern },
				{ $set: { 'posts.$[post].workName': item.name } },
				{ arrayFilters: [{ 'post.workName': previousPattern }] },
			);
		} else if (item.type === 'governmentType' || item.type === 'area') {
			await User.updateMany({ role: 'organization', [item.type]: previousPattern }, { $set: { [item.type]: item.name } });
		} else {
			await Employee.updateMany({ [item.type]: previousPattern }, { $set: { [item.type]: item.name } });
		}
		if (item.type === 'designation') {
			await Location.updateMany({ designation: previousPattern }, { $set: { designation: item.name } });
			await User.updateMany(
				{ role: 'organization', 'posts.designations': previousPattern },
				{ $set: { 'posts.$[].designations.$[designation]': item.name } },
				{ arrayFilters: [{ designation: previousPattern }] },
			);
			await MasterData.updateMany(
				{ type: 'workName', designations: previousPattern },
				{ $set: { 'designations.$[designation]': item.name } },
				{ arrayFilters: [{ designation: previousPattern }] },
			);
		}
		if (item.type === 'governmentType' || item.type === 'area') {
			await MasterData.updateMany(
				{ type: 'skillCategory', [`rates.${item.type}`]: previousPattern },
				{ $set: { [`rates.$[rate].${item.type}`]: item.name } },
				{ arrayFilters: [{ [`rate.${item.type}`]: previousPattern }] },
			);
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

async function findWorkName(value) {
	return MasterData.findOne({ type: 'workName', code: codeFor('workName', normalizeName(value)) }).lean();
}

module.exports = {
	createMasterData,
	deleteMasterData,
	ensureDefaultMasterData,
	findWorkName,
	listMasterData,
	resolveMasterValue,
	updateMasterData,
};
