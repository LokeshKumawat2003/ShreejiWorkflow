const mongoose = require('mongoose');

// Hand-filled attendance sheet; never counted as real attendance.
const attendanceSheetDraftSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    marks: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, minimize: false },
);

attendanceSheetDraftSchema.index({ organizationId: 1, locationId: 1, month: 1 }, { unique: true });

module.exports = mongoose.models.AttendanceSheetDraft || mongoose.model('AttendanceSheetDraft', attendanceSheetDraftSchema);
