const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, default: 'default' },
		name: { type: String, required: true, trim: true, maxlength: 120 },
		address: { type: String, trim: true, maxlength: 250, default: '' },
		registeredAddress: { type: String, trim: true, maxlength: 300, default: '' },
		phone: { type: String, trim: true, maxlength: 40, default: '' },
		email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
	},
	{ timestamps: true },
);

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);
