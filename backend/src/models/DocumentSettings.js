const mongoose = require('mongoose');

const documentSettingsSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, enum: ['salarySlip', 'appointmentLetter', 'wageRegister', 'bankLetter', 'invoice'] },
		values: { type: mongoose.Schema.Types.Mixed, default: {} },
		// Earlier invoice / wage register rate values, each valid from `fromMonth` up to the month before `toMonth` (YYYY-MM).
		rateHistory: {
			type: [{
				_id: false,
				values: { type: mongoose.Schema.Types.Mixed, default: {} },
				fromMonth: { type: String, trim: true, maxlength: 7, default: '' },
				toMonth: { type: String, trim: true, maxlength: 7, required: true },
				changedAt: { type: Date, required: true },
			}],
			default: undefined,
		},
	},
	{ timestamps: true, minimize: false },
);

module.exports = mongoose.model('DocumentSettings', documentSettingsSchema);
