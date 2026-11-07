require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');

const PASSWORD = '1234567890';
const ORGANIZATIONS = [
  {
    key: 'source',
    name: 'Gangtok Site Manager',
    organizationName: 'Gangtok Transfer Source Demo',
    email: 'kingkumawat82@gmail.com',
    phone: '+91 90000 00011',
    address: 'MG Marg, Gangtok, Sikkim',
    locations: [
      { opNumber: 'DEMO-TRANSFER-SRC-1', workName: 'Garden Maintenance', name: 'Gangtok Office Garden', address: 'Gangtok, Sikkim', designation: 'mali' },
    ],
  },
  {
    key: 'target',
    name: 'Namchi Site Manager',
    organizationName: 'Namchi Transfer Target Demo',
    email: 'lokeshkumawat2287@gmail.com',
    phone: '+91 90000 00012',
    address: 'Main Road, Namchi, Sikkim',
    locations: [
      { opNumber: 'DEMO-TRANSFER-TGT-1', workName: 'Park Maintenance', name: 'Namchi Central Park', address: 'Namchi, Sikkim', designation: 'mali' },
      { opNumber: 'DEMO-TRANSFER-TGT-2', workName: 'Site Security', name: 'Namchi Substation Gate', address: 'Namchi, Sikkim', designation: 'security-guard' },
    ],
  },
];
const DESIGNATIONS = [
  { code: 'mali', name: 'Mali' },
  { code: 'security-guard', name: 'Security Guard' },
];
const EMPLOYEES = [
  { name: 'Pawan Joshi', email: 'transfer.pawan.joshi@shreeji.local' },
  { name: 'Suman Tamang', email: 'transfer.suman.tamang@shreeji.local' },
  { name: 'Bikash Rai', email: 'transfer.bikash.rai@shreeji.local' },
  { name: 'Dawa Bhutia', email: 'transfer.dawa.bhutia@shreeji.local' },
];

async function upsertOrganization(org) {
  let organization = await User.findOne({ email: org.email });
  if (!organization) {
    organization = new User({ email: org.email, password: PASSWORD, role: 'organization' });
  }
  if (organization.role !== 'organization') throw new Error(`${org.email} already exists and is not an organization.`);
  Object.assign(organization, {
    password: PASSWORD,
    name: org.name,
    organizationName: org.organizationName,
    phone: org.phone,
    address: org.address,
    industry: 'Horticulture',
    status: 'active',
  });
  await organization.save();
  return organization;
}

async function seedTransferDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo transfer data cannot be seeded in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI before seeding demo transfer data.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const designationNames = {};
  for (const { code, name } of DESIGNATIONS) {
    const designation = await MasterData.findOneAndUpdate(
      { type: 'designation', code },
      { $setOnInsert: { type: 'designation', code, name, status: 'active' } },
      { returnDocument: 'after', upsert: true },
    ).lean();
    if (designation.status !== 'active') throw new Error(`Enable the "${designation.name}" designation in Settings → Master data first.`);
    designationNames[code] = designation.name;
  }

  const seeded = {};
  for (const org of ORGANIZATIONS) {
    const organization = await upsertOrganization(org);
    const locations = [];
    for (const location of org.locations) {
      locations.push(await Location.findOneAndUpdate(
        { organizationId: organization.id, opNumber: location.opNumber },
        {
          $set: {
            workName: location.workName,
            name: location.name,
            address: location.address,
            designation: designationNames[location.designation],
            status: 'active',
          },
          $setOnInsert: { organizationId: organization.id, opNumber: location.opNumber },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      ));
    }
    seeded[org.key] = { organization, locations };
  }

  const source = seeded.source;
  const sourceLocation = source.locations[0];
  for (const employee of EMPLOYEES) {
    await Employee.findOneAndUpdate(
      { email: employee.email },
      {
        $set: {
          organizationId: source.organization.id,
          name: employee.name,
          designation: designationNames.mali,
          skillCategory: 'Un-skilled',
          department: 'Horticulture',
          jobTitle: 'Mali',
          locationId: sourceLocation.id,
          locationAssignedAt: new Date(),
          dailySalary: 650,
          currency: 'INR',
          status: 'active',
        },
        $setOnInsert: { email: employee.email },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  console.log('Demo transfer data is ready.');
  for (const org of ORGANIZATIONS) {
    const { organization, locations } = seeded[org.key];
    console.log(`${org.key === 'source' ? 'Source' : 'Target'} organization: ${organization.organizationName} (${org.email} / ${PASSWORD})`);
    for (const location of locations) {
      console.log(`  Location: ${location.name} [${location.designation}] (${location.id})`);
    }
  }
  console.log(`Employees: ${EMPLOYEES.length} Mali employees at ${sourceLocation.name}`);
  console.log('Moving them to Namchi Central Park should succeed; Namchi Substation Gate should be rejected (designation mismatch).');
}

seedTransferDemo()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
