// Seeds fresh demo data on a clean DB (admin login stays).
// - Minimal master data (Area C only — no "Inside city")
// - 20 new organizations, 50 place-name locations, easy employee names
// Location names are places (Malikhera style), never designation words.
// Run: node src/scripts/seed-fresh-sites.js --yes
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const { createOrganization } = require('../services/organizationService');
const { createLocation } = require('../services/locationService');
const { createEmployee } = require('../services/employeeService');

const ORG_PASSWORD = 'Shreeji@2026';
const AREA = 'C';
const GOVERNMENT_TYPE = 'State';

const WORK_POSTS = [
  { workName: 'Garden Work', designations: ['Mali', 'Gardener'] },
  { workName: 'Park Care', designations: ['Helper', 'Supervisor'] },
  { workName: 'Campus Care', designations: ['Worker', 'Helper'] },
  { workName: 'Field Work', designations: ['Worker', 'Mali'] },
];

const DESIGNATIONS = ['Mali', 'Gardener', 'Helper', 'Supervisor', 'Worker'];
const EMPLOYMENT_TYPES = ['contractual', 'regular', 'fixed-term'];
const SKILLS = [
  { name: 'Un-skilled', salary: 520 },
  { name: 'Semi-Skilled', salary: 610 },
  { name: 'Skilled', salary: 720 },
];

// Place-style location names (not designations).
const PLACE_NAMES = [
  'Malikhera', 'Kekri', 'Nasirabad', 'Beawar', 'Gulabpura', 'Asind', 'Shahpura', 'Banera', 'Mandal', 'Gangapur',
  'Hurda', 'Raipur', 'Bijainagar', 'Masuda', 'Pisangan', 'Pushkar', 'Pushkar Road', 'Sarwar', 'Todaraisingh', 'Deoli',
  'Uniara', 'Niwai', 'Tonk Road', 'Malpura', 'Phagi', 'Dudu', 'Jobner', 'Sambhar', 'Phulera', 'Renwal',
  'Kishangarh', 'Madanganj', 'Roopangarh', 'Saradhana', 'Peesangan', 'Naseerabad Camp', 'Bandanwara', 'Bhinay', 'Sarwar Gate', 'Kekri Yard',
  'Malikhera Depot', 'Beawar Camp', 'Shahpura Yard', 'Mandal Camp', 'Hurda Depot', 'Raipur Camp', 'Masuda Yard', 'Pushkar Camp', 'Niwai Depot', 'Jobner Yard',
];

const ORGANIZATIONS = [
  { organizationName: 'Green Valley Care', name: 'Amit Sharma', email: 'green.valley@shreeji.local', town: 'Ajmer', industry: 'Facility care' },
  { organizationName: 'Sunrise Field Services', name: 'Ravi Meena', email: 'sunrise.field@shreeji.local', town: 'Kekri', industry: 'Field services' },
  { organizationName: 'Riverbank Works', name: 'Suman Yadav', email: 'riverbank.works@shreeji.local', town: 'Beawar', industry: 'Site care' },
  { organizationName: 'Plain View Support', name: 'Neha Gupta', email: 'plain.view@shreeji.local', town: 'Nasirabad', industry: 'Campus support' },
  { organizationName: 'Open Sky Maintenance', name: 'Vikas Rathore', email: 'open.sky@shreeji.local', town: 'Shahpura', industry: 'Maintenance' },
  { organizationName: 'Bright Path Services', name: 'Pooja Jain', email: 'bright.path@shreeji.local', town: 'Mandal', industry: 'Site services' },
  { organizationName: 'Calm Ground Care', name: 'Manoj Kumawat', email: 'calm.ground@shreeji.local', town: 'Hurda', industry: 'Ground care' },
  { organizationName: 'North Gate Works', name: 'Anita Singh', email: 'north.gate@shreeji.local', town: 'Raipur', industry: 'Works' },
  { organizationName: 'Soft Leaf Services', name: 'Deepak Verma', email: 'soft.leaf@shreeji.local', town: 'Masuda', industry: 'Garden care' },
  { organizationName: 'Clear Field Support', name: 'Kiran Choudhary', email: 'clear.field@shreeji.local', town: 'Pisangan', industry: 'Field support' },
  { organizationName: 'Warm Earth Care', name: 'Suresh Gurjar', email: 'warm.earth@shreeji.local', town: 'Pushkar', industry: 'Land care' },
  { organizationName: 'Blue Ridge Services', name: 'Meena Sharma', email: 'blue.ridge@shreeji.local', town: 'Sarwar', industry: 'Site care' },
  { organizationName: 'Golden Track Works', name: 'Rohit Saini', email: 'golden.track@shreeji.local', town: 'Deoli', industry: 'Track care' },
  { organizationName: 'Quiet Lane Support', name: 'Seema Rathi', email: 'quiet.lane@shreeji.local', town: 'Niwai', industry: 'Lane care' },
  { organizationName: 'Silver Oak Care', name: 'Anil Jat', email: 'silver.oak@shreeji.local', town: 'Malpura', industry: 'Tree care' },
  { organizationName: 'Fresh Plot Services', name: 'Kavita Meena', email: 'fresh.plot@shreeji.local', town: 'Phagi', industry: 'Plot care' },
  { organizationName: 'Wide Road Works', name: 'Rajesh Salvi', email: 'wide.road@shreeji.local', town: 'Dudu', industry: 'Roadside care' },
  { organizationName: 'Happy Yard Care', name: 'Nisha Kumawat', email: 'happy.yard@shreeji.local', town: 'Jobner', industry: 'Yard care' },
  { organizationName: 'Simple Site Services', name: 'Gopal Regar', email: 'simple.site@shreeji.local', town: 'Phulera', industry: 'Site services' },
  { organizationName: 'True Ground Support', name: 'Lata Sharma', email: 'true.ground@shreeji.local', town: 'Kishangarh', industry: 'Ground support' },
];

const FIRST_NAMES = [
  'Ram', 'Shyam', 'Mohan', 'Sohan', 'Ramesh', 'Suresh', 'Mahesh', 'Naresh', 'Mukesh', 'Rajesh',
  'Sunita', 'Geeta', 'Seema', 'Rekha', 'Anita', 'Kavita', 'Pooja', 'Neha', 'Meena', 'Lata',
  'Vikas', 'Amit', 'Rohit', 'Anil', 'Deepak', 'Manoj', 'Kiran', 'Nisha', 'Gopal', 'Lalit',
];
const LAST_NAMES = [
  'Sharma', 'Meena', 'Yadav', 'Gurjar', 'Kumawat', 'Singh', 'Verma', 'Jain', 'Saini', 'Rathi',
  'Jat', 'Salvi', 'Regar', 'Choudhary', 'Prajapat', 'Mali', 'Khatik', 'Bheel', 'Sen', 'Paliwal',
];
const PARENT_FIRST = [
  'Ramlal', 'Babulal', 'Kishan', 'Bhagwan', 'Narayan', 'Shankar', 'Madan', 'Hira', 'Devi Lal', 'Gopal',
];

const BANKS = [
  { name: 'State Bank of India', branch: 'Ajmer Main', ifsc: 'SBIN0001201' },
  { name: 'Punjab National Bank', branch: 'Kekri', ifsc: 'PUNB0123400' },
  { name: 'HDFC Bank', branch: 'Beawar', ifsc: 'HDFC0003456' },
  { name: 'Bank of Baroda', branch: 'Nasirabad', ifsc: 'BARB0NASIRA' },
];

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

async function upsertMaster({ type, name, designations, rates }) {
  const code = type === 'employmentType' ? name.toLowerCase().replace(/\s+/g, '-') : name.toLowerCase();
  const existing = await MasterData.findOne({ type, code });
  if (existing) {
    existing.name = name;
    existing.status = 'active';
    if (designations) existing.designations = designations;
    if (rates) existing.rates = rates;
    await existing.save();
    return existing;
  }
  return MasterData.create({
    type,
    code,
    name,
    status: 'active',
    ...(designations ? { designations } : {}),
    ...(rates ? { rates } : {}),
  });
}

async function ensureMasterData() {
  console.log('Master data');
  await upsertMaster({ type: 'governmentType', name: GOVERNMENT_TYPE });
  await upsertMaster({ type: 'area', name: AREA });
  console.log(`  government/area: ${GOVERNMENT_TYPE} / ${AREA}`);

  for (const name of DESIGNATIONS) {
    await upsertMaster({ type: 'designation', name });
  }
  for (const name of EMPLOYMENT_TYPES) {
    await upsertMaster({ type: 'employmentType', name });
  }
  for (const post of WORK_POSTS) {
    await upsertMaster({ type: 'workName', name: post.workName, designations: post.designations });
    console.log(`  work: ${post.workName} → ${post.designations.join(', ')}`);
  }
  for (const skill of SKILLS) {
    await upsertMaster({
      type: 'skillCategory',
      name: skill.name,
      rates: [{ governmentType: GOVERNMENT_TYPE, area: AREA, salary: skill.salary }],
    });
    console.log(`  skill: ${skill.name} = ${skill.salary}`);
  }
}

function assignLocations() {
  // 10 orgs get 3 locations, 10 get 2 → 50 total.
  const counts = ORGANIZATIONS.map((_, index) => (index < 10 ? 3 : 2));
  let offset = 0;
  return ORGANIZATIONS.map((org, orgIndex) => {
    const count = counts[orgIndex];
    const places = PLACE_NAMES.slice(offset, offset + count);
    offset += count;
    return {
      ...org,
      places: places.map((place, placeIndex) => {
        const post = WORK_POSTS[(orgIndex + placeIndex) % WORK_POSTS.length];
        const designation = post.designations[placeIndex % post.designations.length];
        return {
          name: place,
          workName: post.workName,
          designation,
          opNumber: `52008${pad(orgIndex + 1, 2)}${pad(placeIndex + 1, 2)}`,
        };
      }),
    };
  });
}

function employeePair(serial) {
  const first = FIRST_NAMES[serial % FIRST_NAMES.length];
  const last = LAST_NAMES[(serial * 3) % LAST_NAMES.length];
  const parentFirst = PARENT_FIRST[serial % PARENT_FIRST.length];
  const parentLast = LAST_NAMES[(serial * 5) % LAST_NAMES.length];
  return {
    name: `${first} ${last}`,
    parent: `${parentFirst} ${parentLast}`,
    skill: SKILLS[serial % SKILLS.length].name,
    type: EMPLOYMENT_TYPES[serial % EMPLOYMENT_TYPES.length],
    bank: BANKS[serial % BANKS.length],
  };
}

function employeeInput(organizationId, location, spec, serial) {
  const emailName = slug(spec.name);
  return {
    organizationId,
    locationId: location.id,
    name: spec.name,
    email: `${emailName}.${serial}@shreeji.local`,
    phone: `+91 9${pad(640000000 + serial * 1373, 9)}`,
    dateOfBirth: `${1978 + (serial % 20)}-${pad((serial % 12) + 1, 2)}-${pad((serial % 28) + 1, 2)}`,
    parentName: spec.parent,
    aadhaarNumber: `${4 + (serial % 5)}${pad(51000000000 + serial * 7919, 11)}`,
    aadhaarConsent: true,
    establishmentLin: `RJFRS${pad(2000000 + serial, 7)}`,
    uan: `10${pad(2000000000 + serial * 3571, 10)}`,
    esicNumber: `08${pad(30000000 + serial * 911, 8)}`,
    designation: location.designation,
    employmentType: spec.type,
    skillCategory: spec.skill,
    dateOfJoining: `2024-${pad((serial % 12) + 1, 2)}-${pad((serial % 27) + 1, 2)}`,
    dearnessAllowance: 20 + (serial % 4) * 10,
    otherAllowanceAmount: 10,
    otherAllowances: 'Washing allowance',
    epfoApplicable: true,
    esicApplicable: true,
    department: location.workName,
    jobTitle: location.designation,
    address: `${location.name}, Rajasthan`,
    duties: `${location.designation} work at ${location.name}`,
    otherInformation: `Parent/guardian: ${spec.parent}`,
    bankName: spec.bank.name,
    bankBranch: spec.bank.branch,
    bankAccountHolder: spec.name,
    bankAccountNumber: `3${pad(2200000000 + serial * 7331, 10)}`,
    bankRoutingCode: spec.bank.ifsc,
    currency: 'INR',
  };
}

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('This adds 20 organizations, 50 locations and employees. Run with --yes.');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data cannot be seeded in production.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding.');

  await mongoose.connect(process.env.MONGODB_URI);
  const adminDoc = await User.findOne({ role: 'admin', status: 'active' }).lean();
  if (!adminDoc) throw new Error('No active admin account found.');
  const admin = { role: 'admin', id: String(adminDoc._id), name: adminDoc.name, email: adminDoc.email };

  const existingOrgs = await User.countDocuments({ role: 'organization' });
  if (existingOrgs > 0) {
    throw new Error(`Found ${existingOrgs} organizations already. Clean the DB first, then run again.`);
  }

  await ensureMasterData();

  const plans = assignLocations();
  if (PLACE_NAMES.length < 50) throw new Error('Need 50 place names.');
  let locationCount = 0;
  let employeeCount = 0;
  let serial = 0;

  console.log('\nOrganizations, locations, employees');
  for (const [orgIndex, plan] of plans.entries()) {
    const { organization } = await createOrganization({
      name: plan.name,
      organizationName: plan.organizationName,
      email: plan.email,
      password: ORG_PASSWORD,
      phone: `+91 90000 ${pad(10000 + orgIndex, 5)}`,
      address: `${plan.town}, Rajasthan`,
      industry: plan.industry,
      governmentType: GOVERNMENT_TYPE,
      area: AREA,
      posts: WORK_POSTS,
    });
    console.log(`\n${organization.organizationName} (${plan.email} / ${ORG_PASSWORD})`);

    for (const place of plan.places) {
      const location = await createLocation(admin, organization.id, {
        workName: place.workName,
        name: place.name,
        designation: place.designation,
        address: `${place.name}, ${plan.town}, Rajasthan`,
        opNumber: place.opNumber,
        loaReference: `GEMC-${pad(700000000000 + orgIndex * 100 + locationCount, 12)}`,
      });
      locationCount += 1;
      console.log(`  ${place.name} · ${place.workName} · ${place.designation}`);

      // Two easy-to-read employees per location.
      for (let i = 0; i < 2; i += 1) {
        serial += 1;
        const spec = employeePair(serial);
        const created = await createEmployee(admin, employeeInput(organization.id, location, spec, serial));
        employeeCount += 1;
        console.log(`    ${created.name}`);
      }
    }
  }

  console.log(`\nDone: ${plans.length} organizations, ${locationCount} locations, ${employeeCount} employees`);
  console.log(`All org logins use password: ${ORG_PASSWORD}`);
  console.log(`Salary schedule: ${GOVERNMENT_TYPE} · Area ${AREA}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
