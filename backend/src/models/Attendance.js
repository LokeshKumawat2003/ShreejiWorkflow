const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../utils/attendanceStatus');

const attendanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['manual', 'upload'], default: 'manual' },
    sourceMark: { type: String, maxlength: 40, default: '' },
    uploadId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceUpload', default: null },
  },
  { timestamps: true },
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organizationId: 1, date: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
