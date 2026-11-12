// Wipes all business data (admin logins and master data stay) and builds three years of demo data:
// 5 organizations x 6 locations x 5-6 employees with full details, attendance from Dec 2023 to yesterday,
// 8 Category of skill price revisions, and 8 dated revisions of the invoice and wage register rates.
// Run: node src/scripts/seed-three-years.js --yes
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const { createOrganization } = require('../services/organizationService');
const { createLocation } = require('../services/locationService');
const { createEmployee } = require('../services/employeeService');
const { updateMasterData } = require('../services/masterDataService');
const { getDocumentSettings, updateDocumentSettings } = require('../services/documentSettingsService');
const { previewInvoice, saveInvoice, saveInvoiceSetup } = require('../services/clientInvoiceService');

const START_DATE = '2023-12-01';
const ORG_PASSWORD = 'Shreeji@2026';

const WIPED_COLLECTIONS = [
  'attendances', 'employees', 'locations', 'clientinvoices', 'invoicesetups', 'invoicebreakups',
  'bankinvoicebatches', 'tickets', 'counters', 'attendanceuploads', 'attendancesheetdrafts', 'documentsettings',
];

/** Share of today's Category of skill price, and the date each level starts. The last level is today's price. */
const PRICE_LEVELS = [
  { from: '', factor: 0.55 },
  { from: '2024-04-01', factor: 0.6 },
  { from: '2024-10-01', factor: 0.66 },
  { from: '2025-01-01', factor: 0.71 },
  { from: '2025-04-01', factor: 0.76 },
  { from: '2025-08-01', factor: 0.82 },
  { from: '2025-12-01', factor: 0.88 },
  { from: '2026-04-01', factor: 0.94 },
  { from: '2026-09-16', factor: 1 },
];

const WAGE_RATE_LEVELS = [
  { from: '2023-12', bonusRate: '8.33', epfRate: '12', epfWageCeiling: '15000', esiRate: '1.75', esiWageCeiling: '21000' },
  { from: '2024-04', bonusRate: '8.33', epfRate: '12', epfWageCeiling: '15000', esiRate: '0.75', esiWageCeiling: '21000' },
  { from: '2024-10', bonusRate: '10', epfRate: '12', epfWageCeiling: '15000', esiRate: '0.75', esiWageCeiling: '21000' },
  { from: '2025-04', bonusRate: '10', epfRate: '12.5', epfWageCeiling: '20000', esiRate: '0.75', esiWageCeiling: '21000' },
  { from: '2025-07', bonusRate: '12', epfRate: '12.5', epfWageCeiling: '20000', esiRate: '1', esiWageCeiling: '25000' },
  { from: '2025-10', bonusRate: '8.33', epfRate: '13', epfWageCeiling: '20000', esiRate: '1', esiWageCeiling: '25000' },
  { from: '2026-01', bonusRate: '9', epfRate: '13', epfWageCeiling: '25000', esiRate: '0.75', esiWageCeiling: '25000' },
  { from: '2026-04', bonusRate: '8.33', epfRate: '12', epfWageCeiling: '25000', esiRate: '0.75', esiWageCeiling: '21000' },
  { from: '2026-08', bonusRate: '8.33', epfRate: '12', epfWageCeiling: '', esiRate: '0.75', esiWageCeiling: '21000' },
];

const INVOICE_RATE_LEVELS = [
  { from: '2023-12', epfRate: '13', esicRate: '4.75', bonusRate: '8.33', serviceChargeRate: '0', relievingRate: '16.6667', monthDays: '26' },
  { from: '2024-04', epfRate: '13', esicRate: '3.25', bonusRate: '8.33', serviceChargeRate: '0', relievingRate: '16.6667', monthDays: '26' },
  { from: '2024-09', epfRate: '13', esicRate: '3.25', bonusRate: '10', serviceChargeRate: '2', relievingRate: '16.6667', monthDays: '26' },
  { from: '2025-01', epfRate: '13.5', esicRate: '3.25', bonusRate: '10', serviceChargeRate: '2', relievingRate: '16.6667', monthDays: '26' },
  { from: '2025-04', epfRate: '13.5', esicRate: '3.25', bonusRate: '12', serviceChargeRate: '3', relievingRate: '15', monthDays: '26' },
  { from: '2025-10', epfRate: '13', esicRate: '3.25', bonusRate: '8.33', serviceChargeRate: '3', relievingRate: '16.6667', monthDays: '26' },
  { from: '2026-01', epfRate: '13', esicRate: '3.5', bonusRate: '9', serviceChargeRate: '2.5', relievingRate: '16.6667', monthDays: '26' },
  { from: '2026-06', epfRate: '13', esicRate: '3.25', bonusRate: '8.33', serviceChargeRate: '0', relievingRate: '16.6667', monthDays: '26' },
  { from: '2026-10', epfRate: '13', esicRate: '3.25', bonusRate: '8.33', serviceChargeRate: '1.5', relievingRate: '16.6667', monthDays: '26' },
];

const POSTS = [
  { workName: 'Horticulture', designations: ['Mali', 'Supervisor'] },
  { workName: 'Housekeeping', designations: ['Sweeper'] },
  { workName: 'Security', designations: ['Security Guard'] },
];

const WORK_OF = { Mali: 'Horticulture', Supervisor: 'Horticulture', Sweeper: 'Housekeeping', 'Security Guard': 'Security' };
const SKILLS_OF = {
  Mali: ['Semi-Skilled', 'Un-skilled', 'Un-skilled'],
  Supervisor: ['Skilled', 'Skilled', 'Semi-Skilled'],
  Sweeper: ['Un-skilled'],
  'Security Guard': ['Semi-Skilled', 'Skilled', 'Un-skilled'],
};

const ORGANIZATIONS = [
  {
    organizationName: 'NHPC Teesta-V Power Station', name: 'R. K. Sinha', email: 'nhpc.teesta@shreeji.local', governmentType: 'Central', area: 'A - Inside city',
    phone: '+91 3592 246 101', address: 'Balutar, Singtam, East Sikkim 737134', industry: 'Hydro power', website: 'https://www.nhpcindia.com',
    town: 'Singtam',
    locations: [
      ['Power House Garden', 'Mali'], ['Colony Park', 'Mali'], ['Dam Site Lawns', 'Supervisor'],
      ['Admin Block', 'Sweeper'], ['Main Gate', 'Security Guard'], ['Switchyard', 'Security Guard'],
    ],
  },
  {
    organizationName: 'Powergrid Rangpo Substation', name: 'Anil Pradhan', email: 'powergrid.rangpo@shreeji.local', governmentType: 'Central', area: 'B - Mid city',
    phone: '+91 3592 240 552', address: '400/220 kV GIS, Rangpo, East Sikkim 737132', industry: 'Power transmission', website: 'https://www.powergrid.in',
    town: 'Rangpo',
    locations: [
      ['400 kV Yard', 'Mali'], ['Township Garden', 'Mali'], ['Control Room', 'Sweeper'],
      ['Guest House', 'Sweeper'], ['Store Gate', 'Security Guard'], ['Horticulture Office', 'Supervisor'],
    ],
  },
  {
    organizationName: 'Sikkim Power Department', name: 'Pema Bhutia', email: 'power.dept@shreeji.local', governmentType: 'State', area: 'A - Inside city',
    phone: '+91 3592 202 244', address: 'Kazi Road, Gangtok, Sikkim 737101', industry: 'Government department', website: 'https://power.sikkim.gov.in',
    town: 'Gangtok',
    locations: [
      ['Secretariat Lawns', 'Mali'], ['Kazi Road Office', 'Sweeper'], ['Tadong Store', 'Security Guard'],
      ['Chief Engineer Office', 'Sweeper'], ['Rose Garden', 'Supervisor'], ['Ridge Park', 'Mali'],
    ],
  },
  {
    organizationName: 'Sikkim PWD Namchi Division', name: 'Dawa Tamang', email: 'pwd.namchi@shreeji.local', governmentType: 'State', area: 'B - Mid city',
    phone: '+91 3595 263 118', address: 'Division Office, Namchi, South Sikkim 737126', industry: 'Public works', website: '',
    town: 'Namchi',
    locations: [
      ['Char Dham Gardens', 'Mali'], ['Samdruptse Road Camp', 'Security Guard'], ['Division Office', 'Sweeper'],
      ['Circuit House', 'Supervisor'], ['Rock Garden', 'Mali'], ['Stadium Complex', 'Security Guard'],
    ],
  },
  {
    organizationName: 'Rural Development Office Jorethang', name: 'Sarita Rai', email: 'rdd.jorethang@shreeji.local', governmentType: 'State', area: 'C - Out of city',
    phone: '+91 3595 276 040', address: 'Block Office, Jorethang, South Sikkim 737121', industry: 'Government department', website: '',
    town: 'Jorethang',
    locations: [
      ['Block Office', 'Sweeper'], ['Melli Nursery', 'Mali'], ['Reshi Check Post', 'Security Guard'],
      ['Training Centre', 'Supervisor'], ['Jorethang Bazaar Park', 'Mali'], ['Godown', 'Security Guard'],
    ],
  },
];

const BANKS = [
  { name: 'State Bank of India', ifsc: 'SBIN000', branches: ['Gangtok Main', 'Rangpo', 'Namchi', 'Singtam', 'Jorethang'] },
  { name: 'Punjab National Bank', ifsc: 'PUNB0', branches: ['MG Marg', 'Jorethang', 'Melli'] },
  { name: 'HDFC Bank', ifsc: 'HDFC000', branches: ['Gangtok', 'Siliguri', 'Rangpo'] },
  { name: 'Central Bank of India', ifsc: 'CBIN028', branches: ['Gangtok', 'Namchi'] },
  { name: 'Union Bank of India', ifsc: 'UBIN053', branches: ['Gangtok', 'Majitar'] },
  { name: 'Bank of Baroda', ifsc: 'BARB0', branches: ['Gangtok', 'Rorathang'] },
];

const FIRST_NAMES = ['Ramesh', 'Suresh', 'Bikash', 'Anita', 'Sunita', 'Prakash', 'Deepak', 'Kamala', 'Sanjay', 'Pema', 'Tashi', 'Dawa', 'Binod', 'Sarita', 'Manoj', 'Laxmi', 'Rajesh', 'Nima', 'Sangeeta', 'Kiran', 'Ganesh', 'Mingma', 'Sabitri', 'Rohit', 'Puja', 'Arjun', 'Diki', 'Hemant', 'Usha', 'Karma'];
const LAST_NAMES = ['Chettri', 'Rai', 'Tamang', 'Sharma', 'Gurung', 'Subba', 'Pradhan', 'Lepcha', 'Bhutia', 'Limbu', 'Thapa', 'Sherpa', 'Mangar', 'Dahal'];
const PARENT_NAMES = ['Nar Bahadur', 'Dutt Ram', 'Dil Kumar', 'Man Bahadur', 'Hari Prasad', 'Ganga Ram', 'Purna Bahadur', 'Tika Ram', 'Lal Bahadur', 'Bhim Prasad'];
const EMPLOYMENT_TYPES = ['contractual', 'contractual', 'fixed-term', 'regular'];

const HOLIDAYS = new Set([
  '2024-01-26', '2024-03-25', '2024-08-15', '2024-10-02', '2024-10-12', '2024-11-01',
  '2025-01-26', '2025-03-14', '2025-08-15', '2025-10-02', '2025-10-21',
  '2026-01-26', '2026-03-04', '2026-08-15', '2026-10-02', '2026-10-20',
]);

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const pad = (value) => String(value).padStart(2, '0');

function digits(random, length, firstMin = 1) {
  let text = String(firstMin + Math.floor(random() * (10 - firstMin)));
  while (text.length < length) text += String(Math.floor(random() * 10));
  return text;
}

function yesterdayInIndia() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function workDates(fromDate, toDate) {
  const dates = [];
  for (let date = new Date(`${fromDate}T00:00:00Z`); date.toISOString().slice(0, 10) <= toDate; date.setUTCDate(date.getUTCDate() + 1)) {
    if (date.getUTCDay() !== 0) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * full: present every working day (27-day months test the 26-day cap); steady: present with a few half days;
 * halfday: many half days; mixed: every status, including leaves and absences.
 */
function statusFor(profile, random, date) {
  if (HOLIDAYS.has(date)) return 'holiday';
  const roll = random();
  if (profile === 'full') return 'present';
  if (profile === 'steady') return roll < 0.88 ? 'present' : roll < 0.95 ? 'half_day' : roll < 0.98 ? 'paid_leave' : 'absent';
  if (profile === 'halfday') return roll < 0.55 ? 'present' : roll < 0.9 ? 'half_day' : roll < 0.95 ? 'absent' : 'casual_leave';
  if (roll < 0.6) return 'present';
  if (roll < 0.7) return 'half_day';
  if (roll < 0.78) return 'absent';
  if (roll < 0.83) return 'paid_leave';
  if (roll < 0.87) return 'casual_leave';
  if (roll < 0.91) return 'sick_leave';
  if (roll < 0.94) return 'leave';
  return 'weekly_off';
}

const PROFILES = ['full', 'steady', 'mixed', 'halfday', 'steady', 'mixed'];

function scaledRates(rates, factor) {
  return rates.map(({ governmentType, area, salary }) => ({
    governmentType,
    area,
    salary: factor === 1 ? salary : Math.round(salary * factor),
  }));
}

async function wipe(db) {
  for (const name of WIPED_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext();
    if (exists) console.log(`  ${name}: ${(await db.collection(name).deleteMany({})).deletedCount} removed`);
  }
  const organizations = await User.deleteMany({ role: { $ne: 'admin' } });
  console.log(`  organization logins: ${organizations.deletedCount} removed (admin logins kept)`);
}

async function seedSkillPrices(admin) {
  const skills = await MasterData.find({ type: 'skillCategory' }).lean();
  for (const skill of skills) {
    const today = skill.rates || [];
    await MasterData.updateOne(
      { _id: skill._id },
      { $set: { rates: scaledRates(today, PRICE_LEVELS[0].factor), effectiveFrom: '' }, $unset: { rateHistory: 1, effectiveTo: 1 } },
    );
    for (const level of PRICE_LEVELS.slice(1)) {
      await updateMasterData(admin, String(skill._id), { rates: scaledRates(today, level.factor), effectiveFrom: level.from });
    }
    console.log(`  ${skill.name}: ${PRICE_LEVELS.length} price levels, today's price from ${PRICE_LEVELS.at(-1).from}`);
  }
}

async function seedRateSettings(admin, type, levels) {
  const { rateHistory, updatedAt, ...base } = await getDocumentSettings(type);
  for (const { from, ...rates } of levels) {
    await updateDocumentSettings(admin, type, { ...base, ...rates, ratesEffectiveFrom: from });
  }
  const saved = await getDocumentSettings(type);
  console.log(`  ${type}: ${saved.rateHistory.length} earlier periods, current from ${saved.ratesEffectiveFrom}`);
}

function employeeInput(organization, location, index, random) {
  const first = pick(random, FIRST_NAMES);
  const last = pick(random, LAST_NAMES);
  const name = `${first} ${last}`;
  const bank = pick(random, BANKS);
  const joinedLate = index === 5;
  const dateOfJoining = joinedLate ? '2025-05-12' : `${2019 + Math.floor(random() * 4)}-${pad(1 + Math.floor(random() * 12))}-${pad(1 + Math.floor(random() * 27))}`;
  const allowance = index % 3 === 2 ? pick(random, [25, 40, 60]) : 0;
  return {
    organizationId: String(organization._id),
    locationId: location.id,
    name,
    email: `${first}.${last}.${location.id.slice(-5)}.${index + 1}@shreeji.local`.toLowerCase(),
    phone: `+91 ${digits(random, 5, 6)} ${digits(random, 5)}`,
    dateOfBirth: `${1972 + Math.floor(random() * 28)}-${pad(1 + Math.floor(random() * 12))}-${pad(1 + Math.floor(random() * 28))}`,
    parentName: `${pick(random, PARENT_NAMES)} ${last}`,
    aadhaarNumber: digits(random, 12, 2),
    aadhaarConsent: true,
    establishmentLin: `SKGTK${digits(random, 7)}`,
    uan: digits(random, 12),
    esicNumber: digits(random, 10),
    designation: location.designation,
    employmentType: pick(random, EMPLOYMENT_TYPES),
    skillCategory: pick(random, SKILLS_OF[location.designation]),
    dateOfJoining,
    dearnessAllowance: allowance,
    otherAllowanceAmount: index % 4 === 3 ? 15 : 0,
    otherAllowances: index % 4 === 3 ? 'Washing allowance' : '',
    epfoApplicable: random() < 0.85,
    esicApplicable: random() < 0.75,
    department: location.workName,
    jobTitle: location.designation,
    address: `Ward ${1 + Math.floor(random() * 12)}, ${organization.town}, Sikkim`,
    duties: `${location.designation} duties at ${location.name}`,
    otherInformation: joinedLate ? 'Joined mid-contract' : '',
    bankName: bank.name,
    bankBranch: pick(random, bank.branches),
    bankAccountHolder: name,
    bankAccountNumber: digits(random, 11 + Math.floor(random() * 4)),
    bankRoutingCode: `${bank.ifsc}${digits(random, 11 - bank.ifsc.length)}`,
    currency: 'INR',
  };
}

function invoiceSetupFor(location, index) {
  const qtyTypes = ['', 'mandays', 'manmonths', 'persons', 'mandays', 'manmonths'];
  const items = [
    { description: 'Uniform and safety shoes reimbursement', unit: 'No', section: 'supply', rateSource: 'fixed', rate: 450, defaultQty: 2, frequency: 'monthly' },
  ];
  if (index % 2 === 0) items.push({ description: 'Annual tools and equipment', unit: 'Set', section: 'supply', rateSource: 'fixed', rate: 3500, defaultQty: 1, frequency: 'yearly', billMonth: '04' });
  if (index % 3 === 1) items.push({ description: 'Relieving charges', unit: 'MND', section: 'service', rateSource: 'relieving', defaultQty: 4, frequency: 'monthly' });
  if (index === 3) items.push({ description: 'One time site clearance', unit: 'Job', section: 'supply', rateSource: 'fixed', rate: 12000, defaultQty: 1, frequency: 'once', billMonth: '2025-01' });
  return {
    workTitle: '',
    vendorCode: `21000${digits(seededRandom(location.id), 5)}`,
    loaNumber: location.loaReference,
    loaDate: '2023-11-20',
    sapPo: location.opNumber,
    gstLabel: index % 2 ? 'CGST+SGST' : 'IGST',
    gstRate: index === 4 ? 12 : 18,
    firstRaBillNo: 1 + index,
    autoLabour: true,
    labourQtyType: qtyTypes[index],
    items,
  };
}

async function seedAttendance(admin, employees, lastDate) {
  const counts = {};
  let batch = [];
  let inserted = 0;
  const flush = async () => {
    if (!batch.length) return;
    inserted += (await Attendance.insertMany(batch, { ordered: false })).length;
    batch = [];
  };
  for (const [index, employee] of employees.entries()) {
    const profile = PROFILES[index % PROFILES.length];
    const random = seededRandom(`attendance-${employee.email}`);
    const from = employee.dateOfJoining > START_DATE ? employee.dateOfJoining : START_DATE;
    const until = employee.disabledOn ? workDates(from, lastDate).filter((date) => date < employee.disabledOn) : workDates(from, lastDate);
    for (const date of until) {
      const status = statusFor(profile, random, date);
      counts[status] = (counts[status] || 0) + 1;
      batch.push({ employeeId: employee._id, organizationId: employee.organizationId, date, status, markedBy: admin.id, source: 'manual', sourceMark: 'seed-3y' });
      if (batch.length >= 5000) await flush();
    }
  }
  await flush();
  return { inserted, counts };
}

async function main() {
  if (!process.argv.includes('--yes')) throw new Error('This deletes all data except admin logins and master data. Run with --yes.');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data cannot be seeded in production.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding.');
  await mongoose.connect(process.env.MONGODB_URI);
  const adminDoc = await User.findOne({ role: 'admin', status: 'active' }).lean();
  if (!adminDoc) throw new Error('No active admin account found.');
  const admin = { role: 'admin', id: String(adminDoc._id), name: adminDoc.name, email: adminDoc.email };

  console.log('Cleaning the database');
  await wipe(mongoose.connection.db);

  console.log('Category of skill prices');
  await seedSkillPrices(admin);

  console.log('Invoice and wage register rates');
  await seedRateSettings(admin, 'wage-register', WAGE_RATE_LEVELS);
  await seedRateSettings(admin, 'invoice', INVOICE_RATE_LEVELS);

  console.log('Organizations, locations and employees');
  const lastDate = yesterdayInIndia();
  const employees = [];
  for (const [orgIndex, spec] of ORGANIZATIONS.entries()) {
    const { locations, town, ...input } = spec;
    const { organization } = await createOrganization({ ...input, password: ORG_PASSWORD, posts: POSTS });
    const organizationDoc = { _id: organization.id, town };
    for (const [locIndex, [name, designation]] of locations.entries()) {
      const location = await createLocation(admin, organization.id, {
        workName: WORK_OF[designation],
        name,
        designation,
        address: `${name}, ${spec.address}`,
        opNumber: `52000${orgIndex + 1}${pad(locIndex + 1)}${digits(seededRandom(name), 3)}`,
        loaReference: `GEMC-${digits(seededRandom(`${spec.email}${name}`), 12)}`,
      });
      await saveInvoiceSetup(admin, organization.id, location.id, invoiceSetupFor(location, locIndex));
      const count = 5 + ((orgIndex + locIndex) % 2);
      for (let index = 0; index < count; index += 1) {
        const random = seededRandom(`${spec.email}-${name}-${index}`);
        const created = await createEmployee(admin, employeeInput(organizationDoc, location, index, random));
        employees.push(created);
      }
    }
    console.log(`  ${organization.organizationName} (${spec.governmentType} · ${spec.area}): 6 locations`);
  }

  // Assigned on their joining date, and one employee per organization blocked on 15 Jun 2026.
  const blocked = [];
  for (const [index, employee] of employees.entries()) {
    const assignedAt = new Date(`${employee.dateOfJoining > START_DATE ? employee.dateOfJoining : START_DATE}T00:00:00Z`);
    const block = index % 33 === 7;
    await Employee.updateOne(
      { _id: employee.id },
      { $set: { locationAssignedAt: assignedAt, ...(block ? { status: 'disabled', disabledOn: '2026-06-15' } : {}) } },
    );
    if (block) blocked.push(employee.name);
  }
  const employeeDocs = await Employee.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  console.log(`  ${employeeDocs.length} employees, blocked on 2026-06-15: ${blocked.join(', ')}`);

  console.log(`Attendance ${START_DATE} to ${lastDate} (Sundays are weekly off and not stored)`);
  const { inserted, counts } = await seedAttendance(admin, employeeDocs, lastDate);
  console.log(`  ${inserted} records: ${Object.entries(counts).map(([status, total]) => `${status} ${total}`).join(', ')}`);

  console.log('Saved invoices for Jun 2024, Jun 2025 and Jun 2026 (stay frozen at the rates of their month)');
  const organizations = await User.find({ role: 'organization' }).lean();
  let invoiceCount = 0;
  for (const month of ['2024-06', '2025-06', '2026-06']) {
    const [year, monthNumber] = month.split('-').map(Number);
    const invoiceDate = `${monthNumber === 12 ? year + 1 : year}-${pad(monthNumber === 12 ? 1 : monthNumber + 1)}-05`;
    for (const organization of organizations) {
      const locations = await mongoose.model('Location').find({ organizationId: organization._id }).sort({ name: 1 }).lean();
      for (const location of locations) {
        const ids = [String(organization._id), String(location._id)];
        const preview = await previewInvoice(admin, ...ids, { month });
        await saveInvoice(admin, ...ids, month, { invoiceDate, raBillNo: '', items: preview.items });
        invoiceCount += 1;
      }
    }
  }
  console.log(`  ${invoiceCount} invoices saved`);
  console.log(`Organization logins: ${ORGANIZATIONS.map(({ email }) => email).join(', ')} (password ${ORG_PASSWORD})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
