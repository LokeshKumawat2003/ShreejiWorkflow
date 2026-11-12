// Wipes all business data (admin logins, Settings and master data stay) and creates one organization with
// one location per designation and 2-3 fully filled employees per location. Each location is named after one
// of the organization's work names (posts), which match the work name templates in master data.
// Run: node src/scripts/seed-one-organization.js --yes
// Or:  node src/scripts/seed-one-organization.js --add-missing   (keeps data, adds locations that do not exist yet)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Location = require('../models/Location');
const User = require('../models/User');
const { createOrganization, updateOrganization } = require('../services/organizationService');
const { createLocation } = require('../services/locationService');
const { createEmployee } = require('../services/employeeService');

const ORG_PASSWORD = 'Shreeji@2026';

const WIPED_COLLECTIONS = [
  'attendances', 'employees', 'locations', 'clientinvoices', 'invoicesetups', 'invoicebreakups',
  'bankinvoicebatches', 'tickets', 'counters', 'attendanceuploads', 'attendancesheetdrafts',
];

const ORGANIZATION = {
  organizationName: 'NHPC Teesta-V Power Station',
  name: 'R. K. Sinha',
  email: 'nhpc.teesta@shreeji.local',
  governmentType: 'Central',
  area: 'A - Inside city',
  phone: '+91 3592 246 101',
  address: 'Balutar, Singtam, East Sikkim 737134',
  industry: 'Hydro power',
  website: 'https://www.nhpcindia.com',
  posts: [
    { workName: 'Horticulture', designations: ['Mali', 'Head Mali', 'Gardener'] },
    { workName: 'Security', designations: ['Security Guard', 'Security Supervisor', 'Gunman'] },
    { workName: 'Housekeeping', designations: ['Sweeper', 'Cleaner', 'Housekeeping Supervisor'] },
    { workName: 'Colony Park Maintenance', designations: ['Supervisor', 'Park Attendant'] },
  ],
};

const LOCATIONS = [
  { workName: 'Horticulture', name: 'Power House Garden', designation: 'Mali', opNumber: '5200076101', employees: [
    { name: 'Ramesh Chettri', parent: 'Nar Bahadur Chettri', gender: 'M', skill: 'Semi-Skilled', dob: '1984-03-14', joined: '2021-04-01', type: 'contractual', bank: 0 },
    { name: 'Kamala Rai', parent: 'Dil Kumar Rai', gender: 'F', skill: 'Un-skilled', dob: '1990-07-22', joined: '2022-06-15', type: 'contractual', bank: 1 },
    { name: 'Bikash Tamang', parent: 'Man Bahadur Tamang', gender: 'M', skill: 'Un-skilled', dob: '1995-11-02', joined: '2025-05-12', type: 'fixed-term', bank: 2 },
  ] },
  { workName: 'Security', name: 'Main Gate', designation: 'Security Guard', opNumber: '5200076102', employees: [
    { name: 'Prakash Gurung', parent: 'Purna Bahadur Gurung', gender: 'M', skill: 'Skilled', dob: '1980-01-09', joined: '2020-02-03', type: 'regular', bank: 3 },
    { name: 'Deepak Subba', parent: 'Tika Ram Subba', gender: 'M', skill: 'Semi-Skilled', dob: '1988-05-30', joined: '2021-09-20', type: 'contractual', bank: 0 },
    { name: 'Sunita Limbu', parent: 'Hari Prasad Limbu', gender: 'F', skill: 'Un-skilled', dob: '1993-12-18', joined: '2023-01-10', type: 'contractual', bank: 4 },
  ] },
  { workName: 'Housekeeping', name: 'Admin Block', designation: 'Sweeper', opNumber: '5200076103', employees: [
    { name: 'Laxmi Sharma', parent: 'Ganga Ram Sharma', gender: 'F', skill: 'Un-skilled', dob: '1986-08-11', joined: '2022-03-01', type: 'contractual', bank: 5 },
    { name: 'Sanjay Thapa', parent: 'Lal Bahadur Thapa', gender: 'M', skill: 'Un-skilled', dob: '1991-02-25', joined: '2023-07-17', type: 'fixed-term', bank: 1 },
  ] },
  { workName: 'Colony Park Maintenance', name: 'Colony Park', designation: 'Supervisor', opNumber: '5200076104', employees: [
    { name: 'Pema Bhutia', parent: 'Dawa Bhutia', gender: 'M', skill: 'Skilled', dob: '1979-06-05', joined: '2019-11-11', type: 'regular', bank: 2 },
    { name: 'Sarita Pradhan', parent: 'Bhim Prasad Pradhan', gender: 'F', skill: 'Semi-Skilled', dob: '1987-10-19', joined: '2024-04-08', type: 'contractual', bank: 3 },
  ] },
  { workName: 'Horticulture', name: 'Nursery Block', designation: 'Head Mali', opNumber: '5200076105', employees: [
    { name: 'Ganesh Lepcha', parent: 'Sonam Lepcha', gender: 'M', skill: 'Skilled', dob: '1978-04-21', joined: '2018-08-01', type: 'regular', bank: 0 },
    { name: 'Diki Sherpa', parent: 'Ang Tshering Sherpa', gender: 'F', skill: 'Semi-Skilled', dob: '1985-09-13', joined: '2022-11-07', type: 'contractual', bank: 4 },
  ] },
  { workName: 'Horticulture', name: 'Dam Site Lawns', designation: 'Gardener', opNumber: '5200076106', employees: [
    { name: 'Hemant Dahal', parent: 'Krishna Prasad Dahal', gender: 'M', skill: 'Semi-Skilled', dob: '1989-01-27', joined: '2021-02-15', type: 'contractual', bank: 1 },
    { name: 'Usha Mangar', parent: 'Dhan Bahadur Mangar', gender: 'F', skill: 'Un-skilled', dob: '1994-06-08', joined: '2024-09-02', type: 'fixed-term', bank: 5 },
  ] },
  { workName: 'Security', name: 'Switchyard', designation: 'Security Supervisor', opNumber: '5200076107', employees: [
    { name: 'Rajesh Thapa', parent: 'Bal Bahadur Thapa', gender: 'M', skill: 'Skilled', dob: '1976-12-03', joined: '2017-05-22', type: 'regular', bank: 2 },
    { name: 'Kiran Rai', parent: 'Chandra Bahadur Rai', gender: 'M', skill: 'Skilled', dob: '1983-03-19', joined: '2020-10-12', type: 'contractual', bank: 3 },
  ] },
  { workName: 'Security', name: 'Explosives Magazine', designation: 'Gunman', opNumber: '5200076108', employees: [
    { name: 'Arjun Chettri', parent: 'Khadga Bahadur Chettri', gender: 'M', skill: 'Skilled', dob: '1981-07-29', joined: '2019-03-04', type: 'regular', bank: 0 },
    { name: 'Mingma Bhutia', parent: 'Karma Bhutia', gender: 'M', skill: 'Semi-Skilled', dob: '1990-02-14', joined: '2023-04-17', type: 'contractual', bank: 4 },
  ] },
  { workName: 'Housekeeping', name: 'Guest House', designation: 'Cleaner', opNumber: '5200076109', employees: [
    { name: 'Sabitri Gurung', parent: 'Tek Bahadur Gurung', gender: 'F', skill: 'Un-skilled', dob: '1992-10-01', joined: '2022-01-24', type: 'contractual', bank: 1 },
    { name: 'Nima Tamang', parent: 'Lhakpa Tamang', gender: 'M', skill: 'Un-skilled', dob: '1996-05-16', joined: '2025-02-10', type: 'fixed-term', bank: 5 },
  ] },
  { workName: 'Housekeeping', name: 'Township Office', designation: 'Housekeeping Supervisor', opNumber: '5200076110', employees: [
    { name: 'Sangeeta Sharma', parent: 'Bishnu Prasad Sharma', gender: 'F', skill: 'Skilled', dob: '1982-11-23', joined: '2019-07-08', type: 'regular', bank: 2 },
    { name: 'Rohit Pradhan', parent: 'Ratna Bahadur Pradhan', gender: 'M', skill: 'Semi-Skilled', dob: '1988-08-30', joined: '2023-10-03', type: 'contractual', bank: 3 },
  ] },
  { workName: 'Colony Park Maintenance', name: "Children's Park", designation: 'Park Attendant', opNumber: '5200076111', employees: [
    { name: 'Puja Subba', parent: 'Mani Kumar Subba', gender: 'F', skill: 'Un-skilled', dob: '1997-03-09', joined: '2024-06-17', type: 'contractual', bank: 0 },
    { name: 'Karma Limbu', parent: 'Pasang Limbu', gender: 'M', skill: 'Un-skilled', dob: '1993-09-25', joined: '2022-08-29', type: 'fixed-term', bank: 4 },
  ] },
];

const BANKS = [
  { name: 'State Bank of India', branch: 'Singtam', ifsc: 'SBIN0001234' },
  { name: 'Punjab National Bank', branch: 'MG Marg Gangtok', ifsc: 'PUNB0456700' },
  { name: 'HDFC Bank', branch: 'Rangpo', ifsc: 'HDFC0002345' },
  { name: 'Central Bank of India', branch: 'Gangtok', ifsc: 'CBIN0281234' },
  { name: 'Union Bank of India', branch: 'Majitar', ifsc: 'UBIN0534567' },
  { name: 'Bank of Baroda', branch: 'Rorathang', ifsc: 'BARB0RORATH' },
];

const pad = (value, length) => String(value).padStart(length, '0');

function employeeInput(organizationId, location, spec, serial) {
  const bank = BANKS[spec.bank];
  const [first, last] = spec.name.toLowerCase().split(' ');
  return {
    organizationId,
    locationId: location.id,
    name: spec.name,
    email: `${first}.${last}@shreeji.local`,
    phone: `+91 9${pad(733000000 + serial * 1137, 9)}`,
    dateOfBirth: spec.dob,
    parentName: spec.parent,
    aadhaarNumber: `${4 + (serial % 5)}${pad(28374651012 + serial * 7919, 11)}`,
    aadhaarConsent: true,
    establishmentLin: `SKGTK${pad(1045000 + serial, 7)}`,
    uan: `10${pad(1234567890 + serial * 3571, 10)}`,
    esicNumber: `31${pad(19283746 + serial * 911, 8)}`,
    designation: location.designation,
    employmentType: spec.type,
    skillCategory: spec.skill,
    dateOfJoining: spec.joined,
    dearnessAllowance: 25 + (serial % 3) * 15,
    otherAllowanceAmount: 15,
    otherAllowances: 'Washing allowance',
    epfoApplicable: true,
    esicApplicable: true,
    department: location.workName,
    jobTitle: location.designation,
    address: `Ward ${1 + (serial % 9)}, Singtam Bazaar, East Sikkim 737134`,
    duties: `${location.designation} duties at ${location.name}`,
    otherInformation: `${spec.gender === 'F' ? 'Female' : 'Male'} worker; emergency contact ${spec.parent}`,
    bankName: bank.name,
    bankBranch: bank.branch,
    bankAccountHolder: spec.name,
    bankAccountNumber: `3${pad(1402558000 + serial * 7331, 10)}`,
    bankRoutingCode: bank.ifsc,
    currency: 'INR',
  };
}

async function main() {
  const addMissing = process.argv.includes('--add-missing');
  if (!addMissing && !process.argv.includes('--yes')) {
    throw new Error('This deletes all data except admin logins, Settings and master data. Run with --yes, or --add-missing to only add locations that do not exist yet.');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data cannot be seeded in production.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding.');
  await mongoose.connect(process.env.MONGODB_URI);
  const adminDoc = await User.findOne({ role: 'admin', status: 'active' }).lean();
  if (!adminDoc) throw new Error('No active admin account found.');
  const admin = { role: 'admin', id: String(adminDoc._id), name: adminDoc.name, email: adminDoc.email };

  let organization;
  if (addMissing) {
    const existing = await User.findOne({ role: 'organization', email: ORGANIZATION.email }).lean();
    if (!existing) throw new Error(`${ORGANIZATION.email} does not exist. Run with --yes first.`);
    const { name, organizationName, email, posts } = ORGANIZATION;
    organization = await updateOrganization(String(existing._id), { name, organizationName, email, posts });
  } else {
    console.log('Cleaning the database');
    const db = mongoose.connection.db;
    for (const name of WIPED_COLLECTIONS) {
      if (await db.listCollections({ name }).hasNext()) console.log(`  ${name}: ${(await db.collection(name).deleteMany({})).deletedCount} removed`);
    }
    console.log(`  organization logins: ${(await User.deleteMany({ role: { $ne: 'admin' } })).deletedCount} removed (admin logins kept)`);
    ({ organization } = await createOrganization({ ...ORGANIZATION, password: ORG_PASSWORD }));
  }
  console.log(`\n${organization.organizationName} (login ${ORGANIZATION.email} / ${ORG_PASSWORD})`);
  const existingNames = new Set((await Location.find({ organizationId: organization.id }).select('name').lean()).map((location) => location.name));
  let serial = 0;
  let added = 0;
  for (const spec of LOCATIONS) {
    if (existingNames.has(spec.name)) {
      serial += spec.employees.length;
      continue;
    }
    added += 1;
    const location = await createLocation(admin, organization.id, {
      workName: spec.workName,
      name: spec.name,
      designation: spec.designation,
      address: `${spec.name}, ${ORGANIZATION.address}`,
      opNumber: spec.opNumber,
      loaReference: `GEMC-5116877874${pad(serial + 10, 2)}`,
    });
    console.log(`  ${spec.workName} → ${spec.name} (${spec.designation})`);
    for (const employee of spec.employees) {
      serial += 1;
      const created = await createEmployee(admin, employeeInput(organization.id, location, employee, serial));
      console.log(`    ${created.name} · ${employee.skill} · joined ${employee.joined} · ${BANKS[employee.bank].name}`);
    }
  }
  console.log(`\n${added} locations added; ${LOCATIONS.length} locations and ${serial} employees in the demo set`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
