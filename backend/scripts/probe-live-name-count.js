require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../src/models/Employee');
const Location = require('../src/models/Location');
const User = require('../src/models/User');
const { answerEmployeeDetails } = require('../src/services/assistantService');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const orgs = await User.find({ role: 'organization' }).select('_id name').lean();
  const locs = await Location.find().select('_id organizationId workName name designation status address').lean();
  const orgMap = new Map(orgs.map((o) => [String(o._id), o.name]));
  const directory = {
    organizations: orgs.map((o) => ({ id: String(o._id), name: o.name, status: 'active' })),
    locations: locs.map((l) => ({
      id: String(l._id),
      organizationId: String(l.organizationId),
      organizationName: orgMap.get(String(l.organizationId)) || '',
      workName: l.workName || '',
      name: l.name || '',
      designation: l.designation || '',
      status: l.status || 'active',
      address: l.address || '',
    })),
  };
  const user = { id: '1', role: 'admin' };
  for (const msg of [
    'kitne Rahul Sharma hai',
    'kitne Amit hai',
    'kitne Amit Yadav hai',
    'kitne Amit Reddy hai',
    'kitne Amit Ayyar Hain',
    'kitne Anil hai',
    'kitne Anil Malik Hain',
  ]) {
    const r = await answerEmployeeDetails(user, msg, directory, 'en', null);
    const line = (r?.reply || 'null').split('\n')[0];
    console.log(`\n${msg}\n→ ${line}`);
  }
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
