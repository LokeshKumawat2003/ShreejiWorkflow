const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    unit: { type: String, trim: true, maxlength: 20, default: '' },
    qty: { type: Number, min: 0, default: 0 },
    qtyDecimals: { type: Number, min: 0, max: 3, default: 2 },
    rate: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    section: { type: String, enum: ['service', 'supply'], default: 'service' },
  },
  { _id: false },
);

const activitySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['save', 'pdf', 'excel', 'print'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const clientInvoiceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 60 },
    financialYear: { type: String, required: true },
    invoiceSeq: { type: Number, default: 0 },
    invoiceDate: { type: String, required: true },
    raBillNo: { type: Number, min: 0, default: 1 },
    partyName: { type: String, default: '' },
    vendorCode: { type: String, default: '' },
    workTitle: { type: String, default: '' },
    loaNumber: { type: String, default: '' },
    loaDate: { type: String, default: '' },
    sapPo: { type: String, default: '' },
    billToNote: { type: String, default: '' },
    gstLabel: { type: String, default: 'IGST' },
    gstRate: { type: Number, default: 18 },
    items: { type: [invoiceItemSchema], default: [] },
    serviceTotal: { type: Number, default: 0 },
    serviceQty: { type: Number, default: 0 },
    supplyTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: true },
);

clientInvoiceSchema.index({ locationId: 1, month: 1 }, { unique: true });
clientInvoiceSchema.index({ financialYear: 1, invoiceSeq: -1 });

module.exports = mongoose.models.ClientInvoice || mongoose.model('ClientInvoice', clientInvoiceSchema);
