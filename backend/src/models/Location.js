const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workName: { type: String, required: true, trim: true, maxlength: 120 },
    opNumber: { type: String, trim: true, maxlength: 50, default: '' },
    name: { type: String, required: true, trim: true, maxlength: 500 },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    designation: { type: String, required: true, enum: ['cook', 'event', 'plumber'] },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true },
);

module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);