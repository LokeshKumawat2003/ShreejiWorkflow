const mongoose = require('mongoose');

const MASTER_DATA_TYPES = ['designation', 'employmentType', 'skillCategory', 'workName', 'governmentType', 'area'];

const rateSchema = new mongoose.Schema({
  governmentType: { type: String, required: true, trim: true, maxlength: 100 },
  area: { type: String, required: true, trim: true, maxlength: 100 },
  salary: { type: Number, required: true, min: 0, max: 1000000000000 },
}, { _id: false });

const masterDataSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: MASTER_DATA_TYPES, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    designations: { type: [{ type: String, trim: true, maxlength: 100 }], default: undefined },
    rates: { type: [rateSchema], default: undefined },
    effectiveFrom: { type: String, trim: true, maxlength: 10, default: undefined },
    effectiveTo: { type: String, trim: true, maxlength: 10, default: undefined },
    // Earlier salary rates of a category of skill, each closed with the date the rates were changed.
    rateHistory: {
      type: [{
        _id: false,
        rates: { type: [rateSchema], default: [] },
        effectiveFrom: { type: String, trim: true, maxlength: 10, default: '' },
        effectiveTo: { type: String, trim: true, maxlength: 10, default: '' },
        changedAt: { type: Date, required: true },
      }],
      default: undefined,
    },
  },
  { timestamps: true },
);

masterDataSchema.index({ type: 1, code: 1 }, { unique: true });

module.exports = mongoose.models.MasterData || mongoose.model('MasterData', masterDataSchema);
module.exports.MASTER_DATA_TYPES = MASTER_DATA_TYPES;
