// Create Pirana organization + one Mali location + 3 employees (Un-skilled, Semi-Skilled, High Skilled).
// Uses a direct Mongo host (no SRV) so it works when Node DNS SRV lookup fails.
// Run: node src/scripts/seed-pirana.js
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const MasterData = require('../models/MasterData');
const Location = require('../models/Location');
const { createOrganization } = require('../services/organizationService');
const { createLocation } = require('../services/locationService');
const { createEmployee } = require('../services/employeeService');

const ORG_PASSWORD = 'Pirana@2026';
const SHARD_HOSTS = [
  'ac-syu0bkq-shard-00-00.3dismc1.mongodb.net',
  'ac-syu0bkq-shard-00-01.3dismc1.mongodb.net',
  'ac-syu0bkq-shard-00-02.3dismc1.mongodb.net',
];

function atlasUserPass() {
  const uri = process.env.MONGODB_URI || '';
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/([^:/?#]+):([^@/?#]+)@/);
  if (!match) throw new Error('Set MONGODB_URI with username and password.');
  return { user: decodeURIComponent(match[1]), pass: decodeURIComponent(match[2]) };
}

function directUri(host) {
  const { user, pass } = atlasUserPass();
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:27017/?ssl=true&authSource=admin&directConnection=true`;
}

const ORGANIZATION = {
  organizationName: 'Pirana',
  name: 'Ramesh Patel',
  email: 'pirana@shreeji.local',
  governmentType: 'Central',
  area: 'A - Inside city',
  phone: '+91 98250 44101',
  address: 'Pirana, Ahmedabad, Gujarat 382425',
  industry: 'Horticulture',
  website: 'https://pirana.local',
  posts: [{ workName: 'Horticulture', designations: ['Mali'] }],
  password: ORG_PASSWORD,
};

const LOCATION = {
  workName: 'Horticulture',
  name: 'Pirana Garden Site',
  designation: 'Mali',
  address: 'Pirana Garden, Pirana, Ahmedabad, Gujarat 382425',
  opNumber: 'PIRANA-MALI-01',
  loaReference: 'GEMC-PIRANA-MALI-2026-01',
};

const BANKS = [
  { name: 'State Bank of India', branch: 'Pirana', ifsc: 'SBIN0007788' },
  { name: 'HDFC Bank', branch: 'Narol Ahmedabad', ifsc: 'HDFC0002456' },
  { name: 'Bank of Baroda', branch: 'Vatva', ifsc: 'BARB0VATVAA' },
];

const EMPLOYEES = [
  {
    name: 'Suresh Mali',
    parentName: 'Kanhaiya Lal Mali',
    gender: 'Male',
    skill: 'Un-skilled',
    dob: '1994-05-12',
    joined: '2024-02-01',
    type: 'contractual',
    bank: 0,
    phone: '+91 98765 41001',
    aadhaar: '482937165042',
    email: 'suresh.mali.pirana@shreeji.local',
  },
  {
    name: 'Mahesh Gardener',
    parentName: 'Babulal Gardener',
    gender: 'Male',
    skill: 'Semi-Skilled',
    dob: '1988-09-21',
    joined: '2022-07-15',
    type: 'contractual',
    bank: 1,
    phone: '+91 98765 41002',
    aadhaar: '593826471053',
    email: 'mahesh.gardener.pirana@shreeji.local',
  },
  {
    name: 'Vikram Headmali',
    parentName: 'Shankar Headmali',
    gender: 'Male',
    skill: 'High Skilled',
    dob: '1982-01-08',
    joined: '2020-04-10',
    type: 'regular',
    bank: 2,
    phone: '+91 98765 41003',
    aadhaar: '674819352064',
    email: 'vikram.headmali.pirana@shreeji.local',
  },
];

function employeeInput(organizationId, locationId, spec, serial) {
  const bank = BANKS[spec.bank];
  return {
    organizationId,
    locationId,
    name: spec.name,
    email: spec.email,
    phone: spec.phone,
    dateOfBirth: spec.dob,
    parentName: spec.parentName,
    aadhaarNumber: spec.aadhaar,
    aadhaarConsent: true,
    establishmentLin: `GJAMD${String(2201000 + serial).padStart(7, '0')}`,
    uan: `10${String(5566778890 + serial * 17).padStart(10, '0')}`,
    esicNumber: `37${String(44556600 + serial * 13).padStart(8, '0')}`,
    designation: 'Mali',
    employmentType: spec.type,
    skillCategory: spec.skill,
    dateOfJoining: spec.joined,
    dearnessAllowance: 20 + serial * 10,
    otherAllowanceAmount: 15,
    otherAllowances: 'Washing allowance',
    epfoApplicable: true,
    esicApplicable: true,
    department: 'Horticulture',
    jobTitle: 'Mali',
    address: `House ${10 + serial}, Pirana Village, Ahmedabad, Gujarat 382425`,
    duties: 'Garden maintenance, watering, pruning and site upkeep at Pirana Garden Site',
    otherInformation: `${spec.gender} worker; emergency contact ${spec.parentName}`,
    bankName: bank.name,
    bankBranch: bank.branch,
    bankAccountHolder: spec.name,
    bankAccountNumber: `3${String(1402558000 + serial * 7331).padStart(10, '0')}`,
    bankRoutingCode: bank.ifsc,
    currency: 'INR',
  };
}

async function connect() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data cannot be seeded in production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding.');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    return;
  } catch (error) {
    console.warn(`SRV URI failed (${error.message}); trying shard hosts for a writable primary.`);
  }

  let lastError;
  for (const host of SHARD_HOSTS) {
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
      await mongoose.connect(directUri(host), { serverSelectionTimeoutMS: 15000 });
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (hello.isWritablePrimary || hello.ismaster) {
        console.warn(`Connected to primary via ${host} (set ${hello.setName || 'unknown'}).`);
        return;
      }
      console.warn(`${host} is not primary (primary=${hello.primary || 'unknown'}).`);
      await mongoose.disconnect();
    } catch (error) {
      lastError = error;
      console.warn(`${host}: ${error.message}`);
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
  }
  throw lastError || new Error('Could not reach a writable MongoDB primary.');
}

function skillCode(name) {
  // masterDataService.codeFor keeps spaces for skillCategory (unlike employmentType).
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

async function templateSkillRates() {
  const skilled = await MasterData.findOne({ type: 'skillCategory', code: 'skilled' }).lean();
  if (skilled?.rates?.length) return skilled.rates.map(({ governmentType, area, salary }) => ({ governmentType, area, salary }));
  const any = await MasterData.findOne({ type: 'skillCategory', 'rates.0': { $exists: true } }).lean();
  return (any?.rates || []).map(({ governmentType, area, salary }) => ({ governmentType, area, salary: Math.round((salary || 0) * 1.1) }));
}

async function ensureSkillCategories(names) {
  const templateRates = await templateSkillRates();
  for (const name of names) {
    const code = skillCode(name);
    let existing = await MasterData.findOne({ type: 'skillCategory', code });
    if (!existing) {
      existing = await MasterData.findOne({
        type: 'skillCategory',
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
    }
    // Fix earlier seed that stored hyphenated codes (resolveMasterValue looks up by spaced code).
    if (!existing) {
      const hyphen = code.replace(/\s+/g, '-');
      existing = await MasterData.findOne({ type: 'skillCategory', code: hyphen });
    }
    if (existing) {
      let dirty = false;
      if (existing.status !== 'active') {
        existing.status = 'active';
        dirty = true;
      }
      if (existing.code !== code) {
        existing.code = code;
        dirty = true;
      }
      if ((!existing.rates || existing.rates.length === 0) && templateRates.length) {
        existing.rates = templateRates.map((rate) => ({
          ...rate,
          salary: name.toLowerCase().includes('high') ? Math.round(rate.salary * 1.15) : rate.salary,
        }));
        dirty = true;
        console.log(`  added rates for skill category: ${name}`);
      }
      if (dirty) await existing.save();
      continue;
    }
    await MasterData.create({
      type: 'skillCategory',
      code,
      name,
      status: 'active',
      rates: templateRates.map((rate) => ({
        ...rate,
        salary: name.toLowerCase().includes('high') ? Math.round(rate.salary * 1.15) : rate.salary,
      })),
    });
    console.log(`  created skill category: ${name}`);
  }
}

async function pickMasterName(type, preferred, fallbackIncludes) {
  const active = await MasterData.find({ type, status: 'active' }).select('name').lean();
  const names = active.map((item) => item.name);
  const exact = names.find((name) => preferred.some((p) => name.toLowerCase() === p.toLowerCase()));
  if (exact) return exact;
  const loose = names.find((name) =>
    fallbackIncludes.some((part) => name.toLowerCase().includes(part.toLowerCase())),
  );
  if (loose) return loose;
  if (names[0]) return names[0];
  throw new Error(`No active master data for ${type}. Add it in Settings → Master data.`);
}

async function resolveWorkAndDesignation() {
  const works = await MasterData.find({ type: 'workName', status: 'active' }).select('name designations').lean();
  const withMali = works.find((work) =>
    (work.designations || []).some((d) => String(d).toLowerCase() === 'mali'),
  );
  if (!withMali) {
    throw new Error('No active work name has designation "Mali". Enable Horticulture / Mali in Settings → Master data.');
  }
  const mali = (withMali.designations || []).find((d) => String(d).toLowerCase() === 'mali');
  return { workName: withMali.name, designation: mali };
}

async function main() {
  await connect();
  console.log(`Connected to db: ${mongoose.connection.name}`);

  const adminDoc = await User.findOne({ role: 'admin', status: 'active' }).lean();
  if (!adminDoc) throw new Error('No active admin account found.');
  const admin = { role: 'admin', id: String(adminDoc._id), name: adminDoc.name, email: adminDoc.email };

  const { workName, designation } = await resolveWorkAndDesignation();
  ORGANIZATION.posts = [{ workName, designations: [designation] }];
  LOCATION.workName = workName;
  LOCATION.designation = designation;

  const governmentType = await pickMasterName(
    'governmentType',
    ['Central', 'Central Government'],
    ['central'],
  );
  const area = await pickMasterName(
    'area',
    ['A - Inside city', 'A', 'Area A'],
    ['inside', 'a -'],
  );
  ORGANIZATION.governmentType = governmentType;
  ORGANIZATION.area = area;

  const skillNames = ['Un-skilled', 'Semi-Skilled', 'High Skilled', 'Skilled'];
  await ensureSkillCategories(skillNames);

  const activeSkills = await MasterData.find({ type: 'skillCategory', status: 'active' }).select('name').lean();
  const skillMap = new Map(activeSkills.map((item) => [item.name.toLowerCase(), item.name]));
  const resolveSkill = (wanted) => {
    if (skillMap.has(wanted.toLowerCase())) return skillMap.get(wanted.toLowerCase());
    if (wanted.toLowerCase() === 'high skilled' && skillMap.has('skilled')) return skillMap.get('skilled');
    throw new Error(`Skill category "${wanted}" is not available.`);
  };
  for (const employee of EMPLOYEES) {
    employee.skill = resolveSkill(employee.skill);
  }

  let organizationUser = await User.findOne({ role: 'organization', email: ORGANIZATION.email });
  let organization;
  if (organizationUser) {
    organization = {
      id: String(organizationUser._id),
      organizationName: organizationUser.organizationName,
      email: organizationUser.email,
      posts: organizationUser.posts,
    };
    console.log(`Organization already exists: ${organization.organizationName} (${organization.email})`);
    // Ensure Mali post exists
    const posts = Array.isArray(organizationUser.posts) ? [...organizationUser.posts] : [];
    const hort = posts.find((p) => String(p.workName).toLowerCase() === workName.toLowerCase());
    if (!hort) {
      posts.push({ workName, designations: [designation] });
      organizationUser.posts = posts;
      await organizationUser.save();
    } else if (!(hort.designations || []).some((d) => String(d).toLowerCase() === designation.toLowerCase())) {
      hort.designations = [...(hort.designations || []), designation];
      organizationUser.posts = posts;
      await organizationUser.save();
    }
  } else {
    ({ organization } = await createOrganization(ORGANIZATION));
    console.log(`Created organization: ${organization.organizationName}`);
  }
  console.log(`  login: ${ORGANIZATION.email} / ${ORG_PASSWORD}`);
  console.log(`  work: ${workName} → ${designation}`);
  console.log(`  government/area: ${governmentType} / ${area}`);

  let location = await Location.findOne({
    organizationId: organization.id,
    opNumber: LOCATION.opNumber,
  });
  if (location) {
    location = {
      id: String(location._id),
      name: location.name,
      designation: location.designation,
      workName: location.workName,
      opNumber: location.opNumber,
    };
    console.log(`Location already exists: ${location.name} (${location.designation})`);
  } else {
    location = await createLocation(admin, organization.id, LOCATION);
    console.log(`Created location: ${location.name} · designation ${location.designation}`);
  }

  const Employee = require('../models/Employee');
  const created = [];
  for (let i = 0; i < EMPLOYEES.length; i += 1) {
    const spec = EMPLOYEES[i];
    const input = employeeInput(organization.id, location.id, spec, i + 1);
    input.designation = designation;
    input.jobTitle = designation;

    const existing = await Employee.findOne({ organizationId: organization.id, email: spec.email }).lean();
    if (existing) {
      console.log(`  employee exists: ${existing.name} · ${existing.skillCategory}`);
      created.push({
        id: String(existing._id),
        name: existing.name,
        skillCategory: existing.skillCategory,
        designation: existing.designation,
        email: existing.email,
        phone: existing.phone,
        aadhaarNumber: existing.aadhaarNumber,
        bankName: existing.bankName,
        bankBranch: existing.bankBranch,
        bankAccountHolder: existing.bankAccountHolder,
        bankAccountNumber: existing.bankAccountNumber,
        bankRoutingCode: existing.bankRoutingCode,
        parentName: existing.parentName,
        dateOfBirth: existing.dateOfBirth,
        dateOfJoining: existing.dateOfJoining,
        address: existing.address,
        employmentType: existing.employmentType,
        uan: existing.uan,
        esicNumber: existing.esicNumber,
        establishmentLin: existing.establishmentLin,
        bank: { name: existing.bankName, branch: existing.bankBranch, ifsc: existing.bankRoutingCode },
      });
      continue;
    }

    try {
      const employee = await createEmployee(admin, input);
      created.push({
        ...employee,
        skillCategory: input.skillCategory,
        bank: BANKS[spec.bank],
        aadhaarNumber: input.aadhaarNumber,
        bankAccountNumber: input.bankAccountNumber,
        bankRoutingCode: input.bankRoutingCode,
        uan: input.uan,
        esicNumber: input.esicNumber,
        establishmentLin: input.establishmentLin,
        parentName: input.parentName,
        phone: input.phone,
        email: input.email,
        dateOfBirth: input.dateOfBirth,
        dateOfJoining: input.dateOfJoining,
        address: input.address,
        employmentType: input.employmentType,
        bankName: input.bankName,
        bankBranch: input.bankBranch,
        bankAccountHolder: input.bankAccountHolder,
      });
      console.log(`  employee: ${employee.name} · ${input.skillCategory}`);
    } catch (error) {
      if (error.code === 11000 || error.statusCode === 409 || /already|duplicate/i.test(String(error.message || ''))) {
        console.log(`  employee race/exists, reloading: ${spec.name}`);
        const again = await Employee.findOne({ organizationId: organization.id, email: spec.email }).lean();
        if (again) {
          created.push({
            id: String(again._id),
            name: again.name,
            skillCategory: again.skillCategory,
            designation: again.designation,
            email: again.email,
            phone: again.phone,
            aadhaarNumber: again.aadhaarNumber,
            bankName: again.bankName,
            bankBranch: again.bankBranch,
            bankAccountHolder: again.bankAccountHolder,
            bankAccountNumber: again.bankAccountNumber,
            bankRoutingCode: again.bankRoutingCode,
            parentName: again.parentName,
            dateOfBirth: again.dateOfBirth,
            dateOfJoining: again.dateOfJoining,
            address: again.address,
            employmentType: again.employmentType,
            uan: again.uan,
            esicNumber: again.esicNumber,
            establishmentLin: again.establishmentLin,
            bank: { name: again.bankName, branch: again.bankBranch, ifsc: again.bankRoutingCode },
          });
          continue;
        }
      }
      throw error;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({
    organization: {
      id: organization.id,
      organizationName: ORGANIZATION.organizationName,
      contactName: ORGANIZATION.name,
      email: ORGANIZATION.email,
      password: ORG_PASSWORD,
      phone: ORGANIZATION.phone,
      address: ORGANIZATION.address,
      governmentType,
      area,
    },
    location: {
      id: location.id,
      name: location.name || LOCATION.name,
      workName,
      designation,
      opNumber: LOCATION.opNumber,
      address: LOCATION.address,
    },
    employees: created.map((e) => ({
      id: e.id,
      name: e.name,
      parentName: e.parentName,
      designation: e.designation || designation,
      skillCategory: e.skillCategory,
      employmentType: e.employmentType,
      email: e.email,
      phone: e.phone,
      dateOfBirth: e.dateOfBirth,
      dateOfJoining: e.dateOfJoining,
      address: e.address,
      aadhaarNumber: e.aadhaarNumber,
      uan: e.uan,
      esicNumber: e.esicNumber,
      establishmentLin: e.establishmentLin,
      bankName: e.bankName || e.bank?.name,
      bankBranch: e.bankBranch || e.bank?.branch,
      bankAccountHolder: e.bankAccountHolder || e.name,
      bankAccountNumber: e.bankAccountNumber,
      ifsc: e.bankRoutingCode || e.bank?.ifsc,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
