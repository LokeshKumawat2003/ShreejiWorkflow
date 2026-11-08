const dns = require('dns');
const mongoose = require('mongoose');

// mongodb+srv needs SRV lookups, which fail when Node falls back to a loopback resolver (common on Windows).
function ensureSrvResolvable(uri) {
  if (!uri.startsWith('mongodb+srv://')) return;
  const servers = dns.getServers();
  const onlyLoopback = servers.length === 0 || servers.every((s) => s.startsWith('127.') || s === '::1');
  if (onlyLoopback) dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1').split(','));
}

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

  ensureSrvResolvable(uri);
  await mongoose.connect(uri);
  await removeLegacyAttendanceIndex();
  return true;
}

module.exports = { connectDatabase };