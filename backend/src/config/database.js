const mongoose = require('mongoose');

async function removeLegacyAttendanceIndex() {
  const Attendance = require('../models/Attendance');
  await Attendance.init();
  const indexes = await Attendance.collection.indexes();
  const legacyIndex = indexes.find(({ key, unique }) => (
    unique
    && key.employee === 1
    && key.date === 1
    && key.employeeId === undefined
  ));

  if (legacyIndex) await Attendance.collection.dropIndex(legacyIndex.name);
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return false;
  }

  await mongoose.connect(uri);
  await removeLegacyAttendanceIndex();
  return true;
}

module.exports = { connectDatabase };