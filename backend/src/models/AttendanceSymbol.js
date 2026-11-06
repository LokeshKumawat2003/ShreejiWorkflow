const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../utils/attendanceStatus');

// Admin-defined register marks; `symbol` is stored normalised (upper case, no dots or extra spaces).
const attendanceSymbolSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true, maxlength: 20 },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AttendanceSymbol || mongoose.model('AttendanceSymbol', attendanceSymbolSchema);
