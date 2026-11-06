const mongoose = require('mongoose');

// The original register file, kept so saved attendance can be checked against what was uploaded.
const attendanceUploadSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    fileName: { type: String, maxlength: 255, default: '' },
    mimeType: { type: String, maxlength: 120, default: '' },
    size: { type: Number, default: 0 },
    file: { type: Buffer, required: true, select: false },
    status: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
    savedCount: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

attendanceUploadSchema.index({ organizationId: 1, locationId: 1, month: 1, createdAt: -1 });

module.exports = mongoose.models.AttendanceUpload || mongoose.model('AttendanceUpload', attendanceUploadSchema);
