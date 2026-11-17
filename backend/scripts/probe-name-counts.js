require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../src/models/Employee');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const all = await Employee.find({ organizationId: { $ne: null } })
    .select('name parentName status')
    .lean();
  const active = all.filter((e) => e.status !== 'disabled');

  function list(label, pred) {
    const hits = active.filter(pred);
    console.log(`\n${label}: ${hits.length}`);
    hits.forEach((h) => console.log(`  - ${h.name} (${h.status})`));
  }

  list('Rahul Sharma exact', (e) => /^rahul\s+sharma$/i.test(String(e.name).trim()));
  list('starts with Rahul', (e) => /^rahul\b/i.test(e.name));
  list('contains Rahul', (e) => /\brahul\b/i.test(e.name));
  list('ends with Sharma', (e) => /\bsharma\b/i.test(e.name));
  list('starts with Amit', (e) => /^amit\b/i.test(e.name));
  list('Amit Yadav exact', (e) => /^amit\s+yadav$/i.test(String(e.name).trim()));
  list('Amit Reddy exact', (e) => /^amit\s+reddy$/i.test(String(e.name).trim()));
  list('Amit Iyer/Ayyar/Iyyer', (e) => /^amit\s+(iyer|ayyar|iyyer|ayer)$/i.test(String(e.name).trim()));
  list('starts with Anil', (e) => /^anil\b/i.test(e.name));
  list('Anil Malik exact', (e) => /^anil\s+malik$/i.test(String(e.name).trim()));

  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
