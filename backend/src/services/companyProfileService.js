const CompanyProfile = require('../models/CompanyProfile');
const { httpError } = require('../utils/httpError');

const DEFAULT_COMPANY_PROFILE = {
	name: 'M/S. SHREEJI CARETAKER COMPANY',
	address: '[Ragistt. Add.- N-33 , Govind Nager , R.H.B. Colony , Kankroli , Distt-Rajsamand ( Raj.)',
	registeredAddress: 'N-33, GOVIND NAGAR, R.H.B. COLONY, KANKROLI\nDistt :-Rajsamand , Pin :-313342 ( Rajasthan )',
	phone: '9784785808',
	email: 'shreejicaretaker2007@gmail.com',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicProfile(profile) {
	const field = (key) => (profile ? profile[key] || '' : DEFAULT_COMPANY_PROFILE[key]);
	return {
		name: profile?.name || DEFAULT_COMPANY_PROFILE.name,
		address: field('address'),
		registeredAddress: field('registeredAddress'),
		phone: field('phone'),
		email: field('email'),
		updatedAt: profile?.updatedAt || null,
	};
}

function text(value) {
	return typeof value === 'string' ? value.trim() : '';
}

async function getCompanyProfile() {
	const profile = await CompanyProfile.findOne({ key: 'default' }).lean();
	return publicProfile(profile);
}

async function updateCompanyProfile(user, input = {}) {
	if (user.role !== 'admin') throw httpError(403, 'Only admins can update the company profile.');
	const name = text(input.name);
	const address = text(input.address);
	const registeredAddress = text(input.registeredAddress);
	const phone = text(input.phone);
	const email = text(input.email).toLowerCase();
	if (!name) throw httpError(400, 'Company name is required.');
	if (name.length > 120) throw httpError(400, 'Company name must be 120 characters or fewer.');
	if (address.length > 250) throw httpError(400, 'Address must be 250 characters or fewer.');
	if (registeredAddress.length > 300) throw httpError(400, 'Registered address must be 300 characters or fewer.');
	if (phone.length > 40) throw httpError(400, 'Phone must be 40 characters or fewer.');
	if (email && (email.length > 120 || !EMAIL_PATTERN.test(email))) throw httpError(400, 'Enter a valid company email.');

	const profile = await CompanyProfile.findOneAndUpdate(
		{ key: 'default' },
		{ $set: { name, address, registeredAddress, phone, email } },
		{ new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
	).lean();
	return publicProfile(profile);
}

module.exports = { DEFAULT_COMPANY_PROFILE, getCompanyProfile, updateCompanyProfile };
