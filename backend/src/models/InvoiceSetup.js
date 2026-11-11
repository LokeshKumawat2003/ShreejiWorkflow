const mongoose = require('mongoose');

const setupItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    unit: { type: String, trim: true, maxlength: 20, default: 'MND' },
    rateSource: { type: String, enum: ['auto', 'relieving', 'fixed'], default: 'auto' },
    explain: { type: Boolean, default: true },
    rate: { type: Number, min: 0, default: 0 },
    qtySource: { type: String, enum: ['manual', 'mandays', 'manmonths', 'persons'], default: 'mandays' },
    skillCategory: { type: String, trim: true, maxlength: 60, default: '' },
    defaultQty: { type: Number, min: 0, default: 0 },
    section: { type: String, enum: ['service', 'supply'], default: 'service' },
    frequency: { type: String, enum: ['monthly', 'yearly', 'once'], default: 'monthly' },
    billMonth: { type: String, trim: true, maxlength: 7, default: '' },
  },
  { _id: false },
);

const invoiceSetupSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, unique: true },
    workTitle: { type: String, trim: true, maxlength: 300, default: '' },
    vendorCode: { type: String, trim: true, maxlength: 40, default: '' },
    loaNumber: { type: String, trim: true, maxlength: 120, default: '' },
    loaDate: { type: String, trim: true, maxlength: 10, default: '' },
    sapPo: { type: String, trim: true, maxlength: 60, default: '' },
    billToNote: { type: String, trim: true, maxlength: 200, default: '' },
    gstLabel: { type: String, trim: true, maxlength: 20, default: 'IGST' },
    gstRate: { type: Number, min: 0, max: 100, default: 18 },
    firstRaBillNo: { type: Number, min: 1, default: 1 },
    autoLabour: { type: Boolean, default: true },
    labourQtyType: { type: String, enum: ['', 'mandays', 'manmonths', 'persons'], default: '' },
    items: { type: [setupItemSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.models.InvoiceSetup || mongoose.model('InvoiceSetup', invoiceSetupSchema);
