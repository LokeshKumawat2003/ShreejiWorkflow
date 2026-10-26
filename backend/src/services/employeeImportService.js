const MasterData = require('../models/MasterData');
const { httpError } = require('../utils/httpError');
const { createEmployee } = require('./employeeService');

const MAX_ROWS = 500;

// Labels must match the template headers built in frontend/src/pages/Employees/utils/employeeImportTemplate.ts
// ("*" markers and "(...)" hints are ignored when matching).
const COLUMNS = [
	{ field: 'name', label: 'Name of employee' },
	{ field: 'email', label: 'Email' },
	{ field: 'phone', label: 'Phone number' },
	{ field: 'parentName', label: "Father's / Mother's name" },
	{ field: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
	{ field: 'address', label: 'Home address' },
	{ field: 'designation', label: 'Designation' },
	{ field: 'employmentType', label: 'Type of employment' },
	{ field: 'skillCategory', label: 'Category of skill' },
	{ field: 'dateOfJoining', label: 'Date of joining', kind: 'date' },
	{ field: 'status', label: 'Account status', kind: 'status' },
	{ field: 'basicPay', label: 'Wages / Basic pay', kind: 'amount' },
	{ field: 'dearnessAllowance', label: 'Dearness allowance', kind: 'amount' },
	{ field: 'currency', label: 'Currency' },
	{ field: 'otherAllowances', label: 'Other allowances' },
	{ field: 'aadhaarConsent', label: 'Aadhaar consent', kind: 'boolean' },
	{ field: 'aadhaarNumber', label: 'Aadhaar number' },
	{ field: 'establishmentLin', label: 'Establishment LIN' },
	{ field: 'uan', label: 'UAN' },
	{ field: 'esicNumber', label: 'ESIC insurance number' },
	{ field: 'epfoApplicable', label: 'EPFO applicable', kind: 'boolean' },
	{ field: 'esicApplicable', label: 'ESIC applicable', kind: 'boolean' },
	{ field: 'bankName', label: 'Bank name' },
	{ field: 'bankBranch', label: 'Branch' },
	{ field: 'bankAccountHolder', label: 'Account holder' },
	{ field: 'bankAccountNumber', label: 'Account number' },
	{ field: 'bankRoutingCode', label: 'IFSC / routing code' },
	{ field: 'duties', label: 'Broad nature of duties' },
	{ field: 'maternityBenefits', label: 'Maternity benefits' },
	{ field: 'otherInformation', label: 'Any other information' },
];

function headerKey(value) {
	return String(value ?? '')
		.replace(/\(.*?\)/g, '')
		.replace(/\*/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

const COLUMN_BY_KEY = new Map(COLUMNS.map((column) => [headerKey(column.label), column]));

function cellString(value) {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

function parseDate(value, label) {
	if (value === '' || value === null || value === undefined) return '';
	if (typeof value === 'number') {
		const XLSX = require('xlsx');
		const parts = XLSX.SSF.parse_date_code(value);
		if (!parts) throw httpError(400, `${label}: not a valid date.`);
		return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
	}
	const text = cellString(value);
	let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
	let date = match ? { y: match[1], m: match[2], d: match[3] } : null;
	if (!date) {
		match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
		if (match) date = { y: match[3], m: match[2], d: match[1] };
	}
	if (!date) throw httpError(400, `${label}: write the date as DD-MM-YYYY.`);
	const iso = `${date.y}-${date.m.padStart(2, '0')}-${date.d.padStart(2, '0')}`;
	const check = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) {
		throw httpError(400, `${label}: ${text} is not a real date.`);
	}
	return iso;
}

function parseBoolean(value, label) {
	const text = cellString(value).toLowerCase();
	if (!text) return false;
	if (['yes', 'y', 'true', '1'].includes(text)) return true;
	if (['no', 'n', 'false', '0'].includes(text)) return false;
	throw httpError(400, `${label}: write Yes or No.`);
}

function parseAmount(value, label) {
	if (value === '' || value === null || value === undefined) return 0;
	const amount = typeof value === 'number' ? value : Number(cellString(value).replace(/,/g, ''));
	if (!Number.isFinite(amount)) throw httpError(400, `${label}: write a number, for example 450 or 450.50.`);
	return amount;
}

function parseStatus(value, label) {
	const text = cellString(value).toLowerCase();
	if (!text || text === 'active') return 'active';
	if (['inactive', 'disabled'].includes(text)) return 'disabled';
	throw httpError(400, `${label}: write Active or Inactive.`);
}

function readWorkbookRows(buffer) {
	const XLSX = require('xlsx');
	let workbook;
	try {
		workbook = XLSX.read(buffer, { type: 'buffer' });
	} catch {
		throw httpError(400, 'Unable to read this file. Upload the Excel template (.xlsx).');
	}
	const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'employees') || workbook.SheetNames[0];
	if (!sheetName) throw httpError(400, 'The Excel file is empty.');
	const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true, blankrows: true });

	const headerIndex = matrix.slice(0, 10).findIndex((row) => (row || []).some((cell) => COLUMN_BY_KEY.get(headerKey(cell))?.field === 'name'));
	if (headerIndex < 0) {
		throw httpError(400, 'Could not find the "Name of employee" header. Use the downloaded employee template.');
	}
	const columns = matrix[headerIndex].map((cell) => COLUMN_BY_KEY.get(headerKey(cell)) || null);
	if (!columns.some((column) => column?.field === 'email')) {
		throw httpError(400, 'Could not find the "Email" header. Use the downloaded employee template.');
	}

	const rows = [];
	matrix.slice(headerIndex + 1).forEach((cells, offset) => {
		const values = {};
		columns.forEach((column, index) => {
			if (column) values[column.field] = (cells || [])[index];
		});
		if (Object.values(values).every((value) => cellString(value) === '')) return;
		if (/@example\.com$/i.test(cellString(values.email))) return;
		rows.push({ rowNumber: headerIndex + offset + 2, values });
	});
	return rows;
}

function toEmployeeInput(values, employmentTypeCodes) {
	const input = {};
	for (const column of COLUMNS) {
		const raw = values[column.field];
		if (column.kind === 'date') input[column.field] = parseDate(raw, column.label);
		else if (column.kind === 'boolean') input[column.field] = parseBoolean(raw, column.label);
		else if (column.kind === 'amount') input[column.field] = parseAmount(raw, column.label);
		else if (column.kind === 'status') input[column.field] = parseStatus(raw, column.label);
		else input[column.field] = cellString(raw);
	}
	input.currency = input.currency || 'INR';
	input.aadhaarNumber = input.aadhaarNumber.replace(/\s/g, '');
	input.bankRoutingCode = input.bankRoutingCode.toUpperCase();
	const employmentType = input.employmentType.toLowerCase();
	input.employmentType = employmentTypeCodes.get(employmentType) || employmentType;
	input.dailySalary = Math.round((input.basicPay + input.dearnessAllowance) * 100) / 100;
	return input;
}

function rowErrorMessage(error) {
	if (error?.code === 11000) return 'An employee with this email already exists.';
	if (error?.statusCode) return error.message;
	if (error?.name === 'ValidationError') return Object.values(error.errors || {})[0]?.message || error.message;
	return 'Unable to save this row.';
}

async function importEmployees(user, file, body = {}) {
	if (user.role !== 'admin') throw httpError(403, 'Only administrators can import employees.');
	if (!file?.buffer?.length) throw httpError(400, 'Choose the filled employee Excel file to upload.');

	const rows = readWorkbookRows(file.buffer);
	if (rows.length === 0) {
		throw httpError(400, 'No employee rows were found. Add your employees below the header; example rows with an @example.com email are ignored.');
	}
	if (rows.length > MAX_ROWS) throw httpError(400, `Upload at most ${MAX_ROWS} employees per file.`);

	const employmentTypes = await MasterData.find({ type: 'employmentType' }).select('name code').lean();
	const employmentTypeCodes = new Map();
	for (const item of employmentTypes) {
		employmentTypeCodes.set(item.code.toLowerCase(), item.code);
		employmentTypeCodes.set(item.name.trim().toLowerCase(), item.code);
	}

	const organizationId = typeof body.organizationId === 'string' && body.organizationId ? body.organizationId : undefined;
	const created = [];
	const failed = [];
	for (const { rowNumber, values } of rows) {
		const name = cellString(values.name);
		try {
			const input = toEmployeeInput(values, employmentTypeCodes);
			const employee = await createEmployee(user, { ...input, organizationId, timeZone: body.timeZone });
			created.push({ row: rowNumber, id: employee.id, name: employee.name });
		} catch (error) {
			failed.push({ row: rowNumber, name, message: rowErrorMessage(error) });
		}
	}

	return { total: rows.length, created: created.length, failed };
}

module.exports = { importEmployees };
