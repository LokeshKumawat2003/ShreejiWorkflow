const DocumentSettings = require('../models/DocumentSettings');
const { httpError } = require('../utils/httpError');
const { deleteSignatureImage, isSignatureUrl } = require('./cloudinaryService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field rules per document; `default` is used until an admin saves the document. */
const DOCUMENT_FIELDS = {
	salarySlip: {
		companyName: { label: 'Company name', max: 120, required: true, default: 'M/S. SHREEJI CARETAKER COMPANY' },
		address: { label: 'Address', max: 250, default: '[Ragistt. Add.- N-33 , Govind Nager , R.H.B. Colony , Kankroli , Distt-Rajsamand ( Raj.)' },
		title: { label: 'Slip title', max: 60, required: true, default: 'Salary Slip' },
		signatoryLabel: { label: 'Signatory label', max: 60, default: 'Propritior/Manager:' },
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
	},
	wageRegister: {
		title: { label: 'Register title', max: 80, required: true, default: 'Register of wages' },
		formTitle: { label: 'Form reference', max: 120, default: '1(rule 78 (1) (a) (i) ) FORM XVII' },
		contractorName: { label: 'Name of contractor', max: 200, required: true, default: 'M/s.Shreeji Caretaker Company , kankroli , Distt- Rajsamand' },
		note: { label: 'Footer note', max: 300, default: 'Payment will be made as per central Govt. Minimum wages act. W.e.f-01-04-2026 ( "C" Class City )' },
		bonusRate: { label: 'Bonus rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '8.33' },
		epfRate: { label: 'EPF rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '12' },
		epfWageCeiling: { label: 'EPF wage ceiling', max: 12, number: { min: 0, max: 10000000 }, default: '15000' },
		esiRate: { label: 'ESI rate (%)', max: 10, number: { min: 0, max: 100 }, required: true, default: '0.75' },
		signatoryCompany: { label: 'Signatory company line', max: 120, default: 'FOR:-SHREEJI CARETAKER COMPANY' },
		signatoryTitle: { label: 'Signatory title', max: 60, default: 'Proprietor / Manager' },
		signatureImage: { label: 'Signature image', max: 500, cloudinaryImage: true, default: '' },
	},
};

const ROUTE_TYPES = { 'salary-slip': 'salarySlip', 'appointment-letter': 'appointmentLetter', 'wage-register': 'wageRegister' };

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
	return { ...values, updatedAt: document?.updatedAt || null };
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
		const value = raw.replace(/\r\n/g, '\n').trim();
		if (rule.required && !value) throw httpError(400, `${rule.label} is required.`);
		if (rule.cloudinaryImage && value && !isSignatureUrl(value)) throw httpError(400, `${rule.label} must be uploaded through the signature upload.`);
		if (value.length > rule.max) throw httpError(400, `${rule.label} must be ${rule.max} characters or fewer.`);
		if (rule.email && value && !EMAIL_PATTERN.test(value)) throw httpError(400, `Enter a valid ${rule.label.toLowerCase()}.`);
		if (rule.number && value) {
			const number = Number(value);
			if (!/^\d+(\.\d+)?$/.test(value) || number < rule.number.min || number > rule.number.max) {
				throw httpError(400, `${rule.label} must be a number between ${rule.number.min} and ${rule.number.max}.`);
			}
		}
		values[field] = rule.email ? value.toLowerCase() : value;
	});

	const imageFields = Object.keys(DOCUMENT_FIELDS[key]).filter((field) => DOCUMENT_FIELDS[key][field].cloudinaryImage);
	const previous = imageFields.length ? await DocumentSettings.findOne({ key }).lean() : null;

	const document = await DocumentSettings.findOneAndUpdate(
		{ key },
		{ $set: { values } },
		{ new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
	).lean();

	await Promise.all(imageFields
		.map((field) => previous?.values?.[field])
		.filter((url, index) => url && url !== values[imageFields[index]])
		.map(deleteSignatureImage));
	return publicSettings(key, document);
}

module.exports = { DOCUMENT_FIELDS, getDocumentSettings, updateDocumentSettings };
