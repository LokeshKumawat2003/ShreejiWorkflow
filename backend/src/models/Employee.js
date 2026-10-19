const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    department: { type: String, trim: true, maxlength: 100, default: '' },
    jobTitle: { type: String, trim: true, maxlength: 100, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    dailySalary: { type: Number, min: 0, max: 1000000000000, default: 0 },
    currency: { type: String, trim: true, uppercase: true, match: /^[A-Z]{3}$/, default: 'NRI' },
    bankName: { type: String, trim: true, maxlength: 120, default: '' },
    bankBranch: { type: String, trim: true, maxlength: 120, default: '' },
    bankAccountHolder: { type: String, trim: true, maxlength: 100, default: '' },
    bankAccountNumber: { type: String, trim: true, maxlength: 34, default: '' },
    bankRoutingCode: { type: String, trim: true, uppercase: true, maxlength: 20, default: '' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true },
);

employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);