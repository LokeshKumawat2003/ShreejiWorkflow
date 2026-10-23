const mongoose = require('mongoose');

const documentSettingsSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, enum: ['salarySlip', 'appointmentLetter', 'wageRegister', 'bankLetter'] },
		values: { type: mongoose.Schema.Types.Mixed, default: {} },
	},
	{ timestamps: true, minimize: false },
);

module.exports = mongoose.model('DocumentSettings', documentSettingsSchema);
