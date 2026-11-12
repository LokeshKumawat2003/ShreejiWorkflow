const mongoose = require('mongoose');

/** Overtime hours (work beyond the normal hours of a day) entered by hand on an employee's monthly wage register. */
const overtimeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    hours: { type: Number, required: true, min: 0, max: 400 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

overtimeSchema.index({ employeeId: 1, month: 1 }, { unique: true });
overtimeSchema.index({ organizationId: 1, month: 1 });

module.exports = mongoose.models.Overtime || mongoose.model('Overtime', overtimeSchema);
