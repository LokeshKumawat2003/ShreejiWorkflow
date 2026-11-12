const DocumentSettings = require('../models/DocumentSettings');
const { httpError } = require('../utils/httpError');
const { deleteSignatureImage, isSignatureUrl } = require('./cloudinaryService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Values that price an invoice or a wage register; earlier values are kept so old months use old rates. */
const RATE_FIELDS = {
	invoice: ['epfRate', 'esicRate', 'bonusRate', 'serviceChargeRate', 'relievingRate', 'monthDays'],
	wageRegister: ['bonusRate', 'epfRate', 'epfWageCeiling', 'esiRate', 'esiWageCeiling', 'overtimeHoursPerDay', 'overtimeRateMultiplier'],
};

/** Field rules per document; `default` is used until an admin saves the document. */
const DOCUMENT_FIELDS = {
	salarySlip: {
		companyName: { label: 'Company name', max: 120, required: true, default: 'M/S. SHREEJI CARETAKER COMPANY' },
		address: { label: 'Address', max: 250, default: '[Ragistt. Add.- N-33 , Govind Nager , R.H.B. Colony , Kankroli , Distt-Rajsamand ( Raj.)]' },
		title: { label: 'Slip title', max: 60, required: true, default: 'Salary Slip' },
		formNumber: { label: 'Form number', max: 40, default: 'FORM - VIII-C' },
		ruleReference: { label: 'Rule reference', max: 60, default: '(See rule 156)' },
		washingAllowanceRate: { label: 'Washing allowance rate (%)', max: 10, number: { min: 0, max: 100 }, default: '0' },
		signatoryLabel: { label: 'Signatory label', max: 60, default: 'Propritior/Manager:' },
		signatureImage: { label: 'Signature image', max: 500, cloudinaryImage: true, default: '' },
	},
	appointmentLetter: {
		companyName: { label: 'Company name', max: 120, required: true, default: 'M/s. SHREEJI CARETAKER COMPANY' },
		registeredAddress: { label: 'Registered address', max: 300, default: 'N-33, GOVIND NAGAR, R.H.B. COLONY, KANKROLI\nDistt :-Rajsamand , Pin :-313342 ( Rajasthan )' },
		phone: { label: 'Mobile number', max: 40, default: '9784785808' },
		email: { label: 'Company email', max: 120, email: true, default: 'shreejicaretaker2007@gmail.com' },
		refPrefix: { label: 'Reference prefix', max: 60, default: 'SCC/Appointment/' },
		title: { label: 'Letter title', max: 60, required: true, default: 'APPOINTMENT LETTER' },
		shortName: { label: 'Company name in letter body', max: 120, required: true, default: 'Shreeji Caretaker Company' },
		salaryText: { label: 'Salary text', max: 200, default: 'As per Central Govt. minimum Wage Act. ("C" Class City)' },
		workingHours: { label: 'Working hours', max: 120, default: '8 Hrs. as per requirement' },
		leavePolicy: { label: 'Leave policy', max: 120, default: 'Weekly off & Govt. Holidays' },
		terms: {
			label: 'Terms and conditions',
			max: 1500,
			default: [
				'Please sign the duly copy of the appointment letter signifying your acceptance.',
				'We welcome you to your and look forward to fruitful collaboration.',
				'This appointment letter is valid on Consent of terms & condition by employer.',
			].join('\n'),
		},
		closing: { label: 'Closing line', max: 60, default: 'With best Wishes,' },
		signatoryTitle: { label: 'Signatory title', max: 60, default: 'Authorized signatory' },
		signatureImage: { label: 'Signature image', max: 500, cloudinaryImage: true, default: '' },
	},
	wageRegister: {
		title: { label: 'Register title', max: 80, required: true, default: 'Register of wages' },
		formTitle: { label: 'Form reference', max: 120, default: '1(rule 78 (1) (a) (i) ) FORM XVII' },
		contractorName: { label: 'Name of contractor', max: 200, required: true, default: 'M/s.Shreeji Caretaker Company , kankroli , Distt- Rajsamand' },
		note: { label: 'Footer note', max: 300, default: 'Payment will be made as per central Govt. Minimum wages act. W.e.f-01-04-2026 ( "C" Class City )' },
		bonusRate: { label: 'Bonus rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '8.33' },
		epfRate: { label: 'EPF rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '12' },
		epfWageCeiling: { label: 'EPF wage ceiling', max: 12, number: { min: 0, max: 10000000 }, default: '25000' },
		esiRate: { label: 'ESI rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '0.75' },
		esiWageCeiling: { label: 'ESI wage ceiling', max: 12, number: { min: 0, max: 10000000 }, default: '21000' },
		overtimeHoursPerDay: { label: 'Normal working hours in a day', max: 5, number: { min: 1, max: 24 }, blankUsesDefault: true, default: '8' },
		overtimeRateMultiplier: { label: 'Overtime rate (times the hourly wage)', max: 5, number: { min: 0, max: 10 }, blankUsesDefault: true, default: '2' },
		ratesEffectiveFrom: { label: 'Rates effective from', max: 7, month: true, default: '' },
		signatoryCompany: { label: 'Signatory company line', max: 120, default: 'FOR:-SHREEJI CARETAKER COMPANY' },
		signatoryTitle: { label: 'Signatory title', max: 60, default: 'Proprietor / Manager' },
		signatureImage: { label: 'Signature image', max: 500, cloudinaryImage: true, default: '' },
	},
	bankLetter: {
		companyName: { label: 'Company name', max: 120, required: true, default: 'M/s. SHREEJI CARETAKER COMPANY' },
		address: {
			label: 'Address',
			max: 300,
			default: 'Address:-N-33 , GOVIND NAGAR , R.H.B. COLONY, KANKROLI ,\nDISTT. RAJSAMAND ( RAJ. ) Pin:-313342',
		},
		phone: { label: 'Mobile', max: 30, default: '9784785808' },
		email: { label: 'Email', max: 254, email: true, default: 'shreejicaretaker2007@gmail.com' },
		refPrefix: { label: 'Reference prefix', max: 60, required: true, default: 'SCC/PNB-NEFT' },
		recipient: {
			label: 'Bank address',
			max: 400,
			required: true,
			default: 'The Branch Manager\nPanjab National Bank\nJ.K. Made , Kankroli\nDistt-Rajsamand ( Raj )',
		},
		accountNumber: { label: 'Current account number', max: 34, required: true, default: '409100C100000077' },
		subject: {
			label: 'Subject',
			max: 300,
			required: true,
			default: 'Request for making Payment to our Employees by debiting to our Current Account No. {account} at Your Branch',
		},
		requestLine: { label: 'Request line', max: 200, default: 'You are Requested to make a Payment an earliest please' },
		closing: { label: 'Closing', max: 60, default: 'Thanking You ,' },
		signatoryName: { label: 'Signatory name', max: 100, default: 'Prahlad Singh Solanki' },
		signatoryCompany: { label: 'Signatory company', max: 120, default: 'M/S. Shreeji Caretaker Co.' },
		signatoryTitle: { label: 'Signatory title', max: 60, default: 'Proprietor' },
		signatoryPhone: { label: 'Signatory mobile', max: 30, default: '9784785808' },
		signatureImage: { label: 'Signature image', max: 500, cloudinaryImage: true, default: '' },
	},
	invoice: {
		title: { label: 'Invoice title', max: 60, required: true, default: 'INVOICE BREAKUP' },
		partyName: { label: 'Name of party', max: 200, required: true, default: 'M/s. Shreeji Caretaker Company, Kankroli, Distt- Rajsamand (Raj.)' },
		vendorCode: { label: 'Vendor code', max: 40, default: '2100020771' },
		invoicePrefix: { label: 'Invoice number prefix', max: 30, required: true, default: 'AMC' },
		startNumber: { label: 'First invoice number of the year', max: 8, number: { min: 1, max: 9999999 }, default: '1' },
		epfRate: { label: 'EPF on wages (%)', max: 10, number: { min: 0, max: 100 }, default: '13' },
		esicRate: { label: 'ESIC on wages (%)', max: 10, number: { min: 0, max: 100 }, default: '3.25' },
		bonusRate: { label: 'Bonus on wages (%)', max: 10, number: { min: 0, max: 100 }, default: '8.33' },
		serviceChargeRate: { label: 'Service charge (%)', max: 10, number: { min: 0, max: 100 }, default: '0' },
		relievingRate: { label: 'Relieving charge (% of rate)', max: 10, number: { min: 0, max: 100 }, default: '16.6667' },
		monthDays: { label: 'Paid days in a month', max: 3, number: { min: 1, max: 31 }, default: '26' },
		labourQtyType: { label: 'Labour quantity type', max: 20, options: ['mandays', 'manmonths', 'persons'], default: 'mandays' },
		ratesEffectiveFrom: { label: 'Rates effective from', max: 7, month: true, default: '' },
		signatoryCompany: { label: 'Signatory company line', max: 120, default: 'For:-M/S.Shreeji Caretaker company' },
		signatoryTitle: { label: 'Signatory title', max: 60, default: 'Proprietor / manager' },
		signatureImage: { label: 'Signature / stamp image', max: 500, cloudinaryImage: true, default: '' },
	},
};

const ROUTE_TYPES = {
	'salary-slip': 'salarySlip',
	'appointment-letter': 'appointmentLetter',
	'wage-register': 'wageRegister',
	'bank-letter': 'bankLetter',
	invoice: 'invoice',
};

function resolveType(type) {
	const key = ROUTE_TYPES[type] || (DOCUMENT_FIELDS[type] ? type : null);
	if (!key) throw httpError(404, 'Unknown document type.');
	return key;
}

function defaultsFor(key) {
	return Object.fromEntries(Object.entries(DOCUMENT_FIELDS[key]).map(([field, rule]) => [field, rule.default]));
}

function publicSettings(key, document) {
	const saved = document?.values || {};
	const values = defaultsFor(key);
	Object.keys(values).forEach((field) => {
		if (typeof saved[field] === 'string') values[field] = saved[field];
	});
	const history = RATE_FIELDS[key]
		? { rateHistory: (document?.rateHistory || []).map(({ values: old, fromMonth, toMonth, changedAt }) => ({ values: old, fromMonth, toMonth, changedAt })) }
		: {};
	return { ...values, ...history, updatedAt: document?.updatedAt || null };
}

function currentMonth() {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
}

/** Document settings with the rate values that were valid in `month` (YYYY-MM). */
async function getSettingsFor(type, month) {
	const key = resolveType(type);
	const document = await DocumentSettings.findOne({ key }).lean();
	const { rateHistory = [], ...current } = publicSettings(key, document);
	if (!RATE_FIELDS[key] || !MONTH_PATTERN.test(month || '')) return current;
	if (!current.ratesEffectiveFrom || month >= current.ratesEffectiveFrom || !rateHistory.length) return current;
	const covering = [...rateHistory].reverse().find((period) => (period.fromMonth || '') <= month && month < period.toMonth);
	const oldest = [...rateHistory].sort((left, right) => (left.fromMonth || '').localeCompare(right.fromMonth || ''))[0];
	const period = covering || oldest;
	// An overtime rate missing from a period was never saved before it, so it held its default.
	const old = Object.fromEntries(RATE_FIELDS[key]
		.filter((field) => typeof period.values?.[field] === 'string' || DOCUMENT_FIELDS[key][field].blankUsesDefault)
		.map((field) => [field, typeof period.values?.[field] === 'string' ? period.values[field] : DOCUMENT_FIELDS[key][field].default]));
	return { ...current, ...old };
}

function getInvoiceSettingsFor(month) {
	return getSettingsFor('invoice', month);
}

/** Archives the rate values being replaced and dates the new ones (this month unless the admin chose one). */
function rateHistoryFor(key, previous, values) {
	const fields = RATE_FIELDS[key];
	const before = publicSettings(key, previous);
	const changed = fields.some((field) => before[field] !== values[field]);
	if (!changed) {
		if (!values.ratesEffectiveFrom && previous?.rateHistory?.length) values.ratesEffectiveFrom = before.ratesEffectiveFrom;
		return previous?.rateHistory;
	}
	const chosen = values.ratesEffectiveFrom !== before.ratesEffectiveFrom ? values.ratesEffectiveFrom : '';
	values.ratesEffectiveFrom = chosen || currentMonth();
	// Rates replaced from a month on or before their own start never applied, so they are not kept as a period.
	if (before.ratesEffectiveFrom && values.ratesEffectiveFrom <= before.ratesEffectiveFrom) return previous?.rateHistory || [];
	// Rates that were never saved held their default, which getSettingsFor assumes for periods without them.
	const archived = fields.filter((field) => !DOCUMENT_FIELDS[key][field].blankUsesDefault || typeof previous?.values?.[field] === 'string');
	return [
		...(previous?.rateHistory || []),
		{
			values: Object.fromEntries(archived.map((field) => [field, before[field]])),
			fromMonth: before.ratesEffectiveFrom || '',
			toMonth: values.ratesEffectiveFrom,
			changedAt: new Date(),
		},
	];
}

async function getDocumentSettings(type) {
	const key = resolveType(type);
	const document = await DocumentSettings.findOne({ key }).lean();
	return publicSettings(key, document);
}

async function updateDocumentSettings(user, type, input = {}) {
	if (user.role !== 'admin') throw httpError(403, 'Only admins can update document settings.');
	const key = resolveType(type);
	const values = {};

	Object.entries(DOCUMENT_FIELDS[key]).forEach(([field, rule]) => {
		const raw = typeof input[field] === 'string' ? input[field] : '';
		const value = raw.replace(/\r\n/g, '\n').trim() || (rule.blankUsesDefault ? rule.default : '');
		if (rule.required && !value) throw httpError(400, `${rule.label} is required.`);
		if (rule.cloudinaryImage && value && !isSignatureUrl(value)) throw httpError(400, `${rule.label} must be uploaded through the signature upload.`);
		if (value.length > rule.max) throw httpError(400, `${rule.label} must be ${rule.max} characters or fewer.`);
		if (rule.email && value && !EMAIL_PATTERN.test(value)) throw httpError(400, `Enter a valid ${rule.label.toLowerCase()}.`);
		if (rule.options && value && !rule.options.includes(value)) throw httpError(400, `Choose a valid ${rule.label.toLowerCase()}.`);
		if (rule.month && value && !MONTH_PATTERN.test(value)) throw httpError(400, `${rule.label} must be a month (YYYY-MM).`);
		if (rule.number && value) {
			const number = Number(value);
			if (!/^\d+(\.\d+)?$/.test(value) || number < rule.number.min || number > rule.number.max) {
				throw httpError(400, `${rule.label} must be a number between ${rule.number.min} and ${rule.number.max}.`);
			}
		}
		values[field] = rule.email ? value.toLowerCase() : value;
	});

	const imageFields = Object.keys(DOCUMENT_FIELDS[key]).filter((field) => DOCUMENT_FIELDS[key][field].cloudinaryImage);
	const previous = imageFields.length || RATE_FIELDS[key] ? await DocumentSettings.findOne({ key }).lean() : null;
	const rateHistory = RATE_FIELDS[key] ? rateHistoryFor(key, previous, values) : undefined;

	const document = await DocumentSettings.findOneAndUpdate(
		{ key },
		{ $set: { values, ...(rateHistory ? { rateHistory } : {}) } },
		{ returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
	).lean();

	const replaced = imageFields
		.map((field) => previous?.values?.[field])
		.filter((url, index) => url && url !== values[imageFields[index]]);
	if (replaced.length) {
		const others = await DocumentSettings.find({ key: { $ne: key } }).lean();
		const stillUsed = new Set(others.flatMap((other) => Object.values(other.values || {})));
		await Promise.all(replaced.filter((url) => !stillUsed.has(url)).map(deleteSignatureImage));
	}
	return publicSettings(key, document);
}

module.exports = { DOCUMENT_FIELDS, getDocumentSettings, getInvoiceSettingsFor, getSettingsFor, updateDocumentSettings };
