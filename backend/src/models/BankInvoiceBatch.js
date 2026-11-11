const mongoose = require('mongoose');

const batchLocationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    organizationName: { type: String, default: '' },
    locationName: { type: String, default: '' },
    employees: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const batchActivitySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['pdf', 'excel', 'print', 'cancel'], required: true },
    reprint: { type: Boolean, default: false },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

// One printed bank letter; its locations count as printed for the month until the batch is cancelled.
const bankInvoiceBatchSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    reference: { type: String, default: '' },
    referenceNumber: { type: String, default: '' },
    letterDate: { type: String, required: true },
    chequeNumber: { type: String, default: '' },
    skipMissing: { type: Boolean, default: true },
    format: { type: String, enum: ['pdf', 'excel', 'print'], default: 'pdf' },
    status: { type: String, enum: ['printed', 'cancelled'], default: 'printed' },
    locations: { type: [batchLocationSchema], default: [] },
    employees: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledAt: { type: Date, default: null },
    activity: { type: [batchActivitySchema], default: [] },
  },
  { timestamps: true },
);

bankInvoiceBatchSchema.index({ month: 1, 'locations.locationId': 1, status: 1 });

module.exports = mongoose.models.BankInvoiceBatch || mongoose.model('BankInvoiceBatch', bankInvoiceBatchSchema);
