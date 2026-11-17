require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../src/models/Employee');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await Employee.find({
    name: /^Amit\b/i,
    organizationId: { $ne: null },
    status: { $ne: 'disabled' },
  }).select('name parentName organizationId').lean();
  console.log('Amit rows', rows.length);
  const by = new Map();
  for (const row of rows) {
    const key = `${row.name}|${row.parentName || ''}`;
    by.set(key, (by.get(key) || 0) + 1);
    console.log('-', row.name, '| parent:', row.parentName || '-', '| org:', String(row.organizationId));
  }
  console.log('unique name+parent', by.size);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
