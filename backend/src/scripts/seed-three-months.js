require('dotenv').config();
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { escapeRegex } = require('../utils/validation');

// Fills every location with three months of mixed attendance and completes missing employee details.
// Safe to run again: attendance that already exists is never overwritten and only empty employee fields are filled.

const MONTHS = ['2026-09', '2026-10', '2026-11'];
const MIN_EMPLOYEES_PER_LOCATION = 5;
const HOLIDAYS = new Set(['2026-10-02', '2026-10-20', '2026-11-09']);

const BANKS = [
  { name: 'State Bank of India', ifscPrefix: 'SBIN000', branches: ['Gangtok Main', 'Rangpo', 'Namchi', 'Singtam'] },
  { name: 'Punjab National Bank', ifscPrefix: 'PUNB0', branches: ['MG Marg', 'Jorethang', 'Melli'] },
  { name: 'HDFC Bank', ifscPrefix: 'HDFC000', branches: ['Gangtok', 'Siliguri', 'Rangpo'] },
  { name: 'Central Bank of India', ifscPrefix: 'CBIN028', branches: ['Gangtok', 'Namchi'] },
  { name: 'Union Bank of India', ifscPrefix: 'UBIN053', branches: ['Gangtok', 'Majitar'] },
  { name: 'Bank of Baroda', ifscPrefix: 'BARB0', branches: ['Gangtok', 'Rorathang'] },
];

const FIRST_NAMES = ['Ramesh', 'Suresh', 'Bikash', 'Anita', 'Sunita', 'Prakash', 'Deepak', 'Kamala', 'Sanjay', 'Pema', 'Tashi', 'Dawa', 'Binod', 'Sarita', 'Manoj', 'Laxmi', 'Rajesh', 'Nima', 'Sangeeta', 'Kiran'];
const LAST_NAMES = ['Chettri', 'Rai', 'Tamang', 'Sharma', 'Gurung', 'Subba', 'Pradhan', 'Lepcha', 'Bhutia', 'Limbu', 'Thapa', 'Sherpa'];
const PARENT_NAMES = ['Nar Bahadur', 'Dutt Ram', 'Dil Kumar', 'Man Bahadur', 'Hari Prasad', 'Ganga Ram', 'Purna Bahadur', 'Tika Ram'];
const TOWNS = ['Gangtok', 'Rangpo', 'Namchi', 'Singtam', 'Jorethang', 'Melli', 'Majitar', 'Rorathang'];

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

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function digits(random, length) {
  let text = String(1 + Math.floor(random() * 9));
  while (text.length < length) text += String(Math.floor(random() * 10));
  return text;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function datesUpTo(lastDate) {
  const dates = [];
  for (const month of MONTHS) {
    const [year, monthNumber] = month.split('-').map(Number);
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    for (let day = 1; day <= days; day += 1) {
      const date = `${month}-${pad(day)}`;
      if (date > lastDate) return dates;
      if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
      dates.push(date);
    }
  }
  return dates;
}

/** Fills only the fields that are empty, so real data entered in the app is kept. */
function missingDetails(employee) {
  const random = seededRandom(`details-${employee._id}`);
  const bank = pick(random, BANKS);
  const town = pick(random, TOWNS);
  const values = {
    parentName: pick(random, PARENT_NAMES),
    dateOfBirth: `${1975 + Math.floor(random() * 25)}-${pad(1 + Math.floor(random() * 12))}-${pad(1 + Math.floor(random() * 28))}`,
    aadhaarNumber: digits(random, 12),
    aadhaarConsent: true,
    uan: digits(random, 12),
    esicNumber: digits(random, 10),
    dateOfJoining: `${2022 + Math.floor(random() * 4)}-${pad(1 + Math.floor(random() * 12))}-01`,
    skillCategory: pick(random, ['Skilled', 'Semi-Skilled', 'Un-skilled', 'Un-skilled']),
    employmentType: 'contract',
    phone: `+91 ${digits(random, 5)} ${digits(random, 5)}`,
    address: `Ward ${1 + Math.floor(random() * 12)}, ${town}, Sikkim`,
    bankName: bank.name,
    bankBranch: pick(random, bank.branches),
    bankAccountHolder: employee.name,
    bankAccountNumber: digits(random, 11 + Math.floor(random() * 4)),
    bankRoutingCode: `${bank.ifscPrefix}${digits(random, 11 - bank.ifscPrefix.length)}`,
  };

  const update = {};
  for (const [field, value] of Object.entries(values)) {
    const current = employee[field];
    if (current === undefined || current === null || current === '' || current === false) update[field] = value;
  }
  if (!(Number(employee.dailySalary) > 0)) {
    const basic = Number(employee.basicPay) > 0 ? Number(employee.basicPay) : pick(random, [520, 580, 650, 720]);
    update.basicPay = basic;
    update.dailySalary = Math.round((basic + (Number(employee.dearnessAllowance) || 0) + (Number(employee.otherAllowanceAmount) || 0)) * 100) / 100;
  }
  if (!employee.currency || employee.currency === 'NRI') update.currency = 'INR';
  if (employee.epfoApplicable === undefined || employee.epfoApplicable === false) update.epfoApplicable = random() < 0.8;
  if (employee.esicApplicable === undefined || employee.esicApplicable === false) update.esicApplicable = random() < 0.7;
  return update;
}

/**
 * Each employee gets one pattern: full attendance, mostly present with half days, or a mix of every status.
 * Holidays apply to everyone.
 */
function statusFor(profile, random, date) {
  if (HOLIDAYS.has(date)) return 'holiday';
  const roll = random();
  if (profile === 'full') return 'present';
  if (profile === 'half') return roll < 0.25 ? 'half_day' : roll < 0.3 ? 'absent' : 'present';
  if (roll < 0.58) return 'present';
  if (roll < 0.70) return 'half_day';
  if (roll < 0.78) return 'absent';
  if (roll < 0.83) return 'paid_leave';
  if (roll < 0.88) return 'casual_leave';
  if (roll < 0.92) return 'sick_leave';
  if (roll < 0.96) return 'leave';
  return 'weekly_off';
}

const PROFILES = ['full', 'half', 'mixed', 'mixed', 'half', 'full'];

async function createDummyEmployees(location, count, startIndex) {
  const created = [];
  for (let index = 0; index < count; index += 1) {
    const random = seededRandom(`new-${location._id}-${startIndex + index}`);
    const name = `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
    const email = `demo.${name.replace(/\s+/g, '.').toLowerCase()}.${String(location._id).slice(-6)}.${startIndex + index + 1}@shreeji.local`;
    const employee = await Employee.findOneAndUpdate(
      { organizationId: location.organizationId, email },
      {
        $setOnInsert: {
          organizationId: location.organizationId,
          email,
          name,
          designation: location.designation,
          department: location.workName || '',
          jobTitle: location.designation,
          locationId: location._id,
          locationAssignedAt: new Date('2026-08-01T00:00:00Z'),
          status: 'active',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    created.push(employee);
  }
  return created;
}

async function seedThreeMonths() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data cannot be seeded in production.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding demo data.');
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: 'admin', status: 'active' });
  if (!admin) throw new Error('Create an admin account before seeding attendance.');

  const organizations = await User.find({ role: 'organization' }).select('_id organizationName').lean();
  const organizationIds = organizations.map(({ _id }) => _id);
  const locations = await Location.find({ organizationId: { $in: organizationIds }, status: 'active' }).lean();
  const dates = datesUpTo(todayIso());

  let createdEmployees = 0;
  for (const location of locations) {
    const designationPattern = new RegExp(`^${escapeRegex(location.designation)}$`, 'i');
    const count = await Employee.countDocuments({ organizationId: location.organizationId, locationId: location._id, designation: designationPattern, status: 'active' });
    if (count < MIN_EMPLOYEES_PER_LOCATION) {
      const created = await createDummyEmployees(location, MIN_EMPLOYEES_PER_LOCATION - count, count);
      createdEmployees += created.length;
    }
  }

  const employees = await Employee.find({}).lean();
  let updatedEmployees = 0;
  const detailWrites = [];
  for (const employee of employees) {
    const update = missingDetails(employee);
    if (Object.keys(update).length === 0) continue;
    updatedEmployees += 1;
    detailWrites.push({ updateOne: { filter: { _id: employee._id }, update: { $set: update } } });
  }
  if (detailWrites.length > 0) await Employee.bulkWrite(detailWrites, { ordered: false });

  const counts = {};
  let inserted = 0;
  for (const location of locations) {
    const designationPattern = new RegExp(`^${escapeRegex(location.designation)}$`, 'i');
    const locationEmployees = await Employee.find({
      organizationId: location.organizationId,
      locationId: location._id,
      designation: designationPattern,
      status: 'active',
    }).sort({ createdAt: 1 }).lean();

    const writes = [];
    locationEmployees.forEach((employee, index) => {
      const profile = PROFILES[index % PROFILES.length];
      const random = seededRandom(`attendance-${employee._id}`);
      for (const date of dates) {
        const status = statusFor(profile, random, date);
        counts[status] = (counts[status] || 0) + 1;
        writes.push({
          updateOne: {
            filter: { employeeId: employee._id, date },
            update: {
              $setOnInsert: {
                employeeId: employee._id,
                date,
                organizationId: location.organizationId,
                status,
                markedBy: admin._id,
                source: 'manual',
                sourceMark: 'demo-seed',
              },
            },
            upsert: true,
          },
        });
      }
    });
    if (writes.length === 0) continue;
    const result = await Attendance.bulkWrite(writes, { ordered: false });
    inserted += result.upsertedCount || 0;
    console.log(`  ${location.workName || location.name}: ${locationEmployees.length} employees`);
  }

  console.log('Three months of demo attendance are ready.');
  console.log(`Months: ${MONTHS.join(', ')} (up to ${dates[dates.length - 1] || '—'}, Sundays skipped)`);
  console.log(`Locations: ${locations.length} across ${organizations.length} organizations`);
  console.log(`New dummy employees: ${createdEmployees}`);
  console.log(`Employees with details filled in: ${updatedEmployees}`);
  console.log(`New attendance records: ${inserted} (existing records were kept)`);
  console.log(`Status mix planned: ${Object.entries(counts).map(([status, total]) => `${status} ${total}`).join(', ')}`);
}

seedThreeMonths()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
