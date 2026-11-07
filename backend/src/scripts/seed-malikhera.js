require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');

const PASSWORD = '1234567890';
const ORGANIZATION = {
  name: 'Raj Kumar',
  organizationName: 'Malikhera',
  email: 'malikhera@shreeji.local',
  phone: '+91 90000 00021',
  address: 'Malikhera, Rajasthan',
};
const DESIGNATIONS = [
  { code: 'mali', name: 'Mali' },
  { code: 'security-guard', name: 'Security Guard' },
];
const LOCATIONS = [
  {
    opNumber: 'MALIKHERA-1',
    workName: 'Garden Maintenance',
    name: 'Malikhera Main Garden',
    address: 'Malikhera, Rajasthan',
    designation: 'mali',
    employees: [
      ['Ramesh Meena', 'Gopal Meena'],
      ['Suresh Gurjar', 'Mohan Gurjar'],
      ['Mahesh Kumawat', 'Shankar Kumawat'],
      ['Dinesh Salvi', 'Bhanwar Salvi'],
      ['Kailash Bheel', 'Hira Bheel'],
      ['Prakash Regar', 'Laxman Regar'],
    ],
  },
  {
    opNumber: 'MALIKHERA-2',
    workName: 'Park Maintenance',
    name: 'Malikhera Community Park',
    address: 'Malikhera, Rajasthan',
    designation: 'mali',
    employees: [
      ['Mukesh Jat', 'Ramlal Jat'],
      ['Naresh Paliwal', 'Kishan Paliwal'],
      ['Rajesh Sen', 'Bhagwan Sen'],
      ['Lokesh Prajapat', 'Narayan Prajapat'],
      ['Ganesh Mali', 'Devi Lal Mali'],
      ['Sohan Khatik', 'Madan Khatik'],
    ],
  },
  {
    opNumber: 'MALIKHERA-3',
    workName: 'Site Security',
    name: 'Malikhera Office Gate',
    address: 'Malikhera, Rajasthan',
    designation: 'security-guard',
    employees: [
      ['Vikram Singh Rathore', 'Bhim Singh Rathore'],
      ['Arjun Singh Chouhan', 'Ratan Singh Chouhan'],
      ['Bharat Singh Shekhawat', 'Jaswant Singh Shekhawat'],
      ['Mahendra Singh Rao', 'Gajendra Singh Rao'],
      ['Narendra Singh Panwar', 'Prithvi Singh Panwar'],
      ['Shyam Singh Jhala', 'Ummed Singh Jhala'],
    ],
  },
];

function emailFor(name) {
  return `malikhera.${name.toLowerCase().replace(/[^a-z]+/g, '.')}@shreeji.local`;
}

async function upsertOrganization() {
  let organization = await User.findOne({ email: ORGANIZATION.email });
  if (!organization) {
    organization = new User({ email: ORGANIZATION.email, password: PASSWORD, role: 'organization' });
  }
  if (organization.role !== 'organization') throw new Error(`${ORGANIZATION.email} already exists and is not an organization.`);
  Object.assign(organization, {
    name: ORGANIZATION.name,
    organizationName: ORGANIZATION.organizationName,
    phone: ORGANIZATION.phone,
    address: ORGANIZATION.address,
    industry: 'Horticulture',
    status: 'active',
  });
  await organization.save();
  return organization;
}

async function seedMalikhera() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data cannot be seeded in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI before seeding demo data.');
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

  const organization = await upsertOrganization();
  console.log(`Organization: ${organization.organizationName} · ${organization.name} (${ORGANIZATION.email} / ${PASSWORD})`);

  for (const location of LOCATIONS) {
    const designation = designationNames[location.designation];
    const saved = await Location.findOneAndUpdate(
      { organizationId: organization.id, opNumber: location.opNumber },
      {
        $set: {
          workName: location.workName,
          name: location.name,
          address: location.address,
          designation,
          status: 'active',
        },
        $setOnInsert: { organizationId: organization.id, opNumber: location.opNumber },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    for (const [name, parentName] of location.employees) {
      const email = emailFor(name);
      await Employee.findOneAndUpdate(
        { organizationId: organization.id, email },
        {
          $set: {
            name,
            parentName,
            designation,
            employmentType: 'contractual',
            skillCategory: 'Un-skilled',
            department: location.designation === 'mali' ? 'Horticulture' : 'Security',
            jobTitle: designation,
            locationId: saved.id,
            locationAssignedAt: new Date(),
            dailySalary: location.designation === 'mali' ? 650 : 700,
            currency: 'INR',
            status: 'active',
          },
          $setOnInsert: { organizationId: organization.id, email },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
    console.log(`  Location: ${saved.name} [${designation}] · ${location.employees.length} employees`);
  }
}

seedMalikhera()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
