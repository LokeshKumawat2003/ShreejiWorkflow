const mongoose = require('mongoose');

const MASTER_DATA_TYPES = ['designation', 'employmentType', 'skillCategory', 'workName'];

const masterDataSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: MASTER_DATA_TYPES, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    designations: { type: [{ type: String, trim: true, maxlength: 100 }], default: undefined },
  },
  { timestamps: true },
);

masterDataSchema.index({ type: 1, code: 1 }, { unique: true });

module.exports = mongoose.models.MasterData || mongoose.model('MasterData', masterDataSchema);
module.exports.MASTER_DATA_TYPES = MASTER_DATA_TYPES;
