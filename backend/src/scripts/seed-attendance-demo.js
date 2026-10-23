require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');

const DEMO_ORG_EMAIL = 'rangpo-demo@shreeji.local';
const DEMO_ORG_PASSWORD = 'DemoOrg123';
const EMPLOYEES = [
  { name: 'Prakash Chettri', parentName: '', skillCategory: 'Skilled', statusToken: 'P' },
  { name: 'Gobinda Chettri', parentName: '', skillCategory: 'Semi-Skilled', statusToken: 'P' },
  { name: 'Ram Bahadur Chettri', parentName: 'Nar Bahadur', skillCategory: 'Un-skilled', statusToken: 'A' },
  { name: 'Mani Kumar Chettri', parentName: '', skillCategory: 'Un-skilled', statusToken: 'P' },
  { name: 'Om Kumari Rai', parentName: '', skillCategory: 'Un-skilled', statusToken: 'A' },
  { name: 'Ram Bahadur Chettri', parentName: 'Dutt Ram', skillCategory: 'Un-skilled', statusToken: 'P' },
  { name: 'Ajit Rai Subba', parentName: '', skillCategory: 'Un-skilled', statusToken: 'P' },
  { name: 'Anil Chettri', parentName: '', skillCategory: 'Un-skilled', statusToken: 'A' },
];

function localDate() {
  const date = new Date();
  return {
    year: date.getFullYear(),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: date.getDate(),
    iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
  };
}

function emailFor(employee, index) {
  const parent = employee.parentName ? employee.parentName.replace(/\s+/g, '').toLowerCase() : String(index + 1);
  return `demo.${employee.name.replace(/\s+/g, '.').toLowerCase()}.${parent}@shreeji.local`;
}

function demoMark(employeeIndex, day, today) {
  if (day > today.day) return '';
  if (day === today.day) return EMPLOYEES[employeeIndex]?.statusToken || 'P';
  return (employeeIndex * 3 + day) % 7 === 0 ? 'A' : 'P';
}

function writeAttendanceSheet(filePath, today) {
  const daysInMonth = new Date(today.year, Number(today.month), 0).getDate();
  const periodLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(today.year, Number(today.month) - 1, 1));
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const header = ['S.no', 'Name of Employees', "Father's name", 'category', ...days, 'Total Present'];
  const rows = [...EMPLOYEES, { name: 'Unknown Worker', parentName: '', skillCategory: 'Un-skilled' }]
    .map((employee, index) => {
      const marks = days.map((day) => demoMark(index, day, today));
      return [
        index + 1,
        employee.name,
        employee.parentName,
        employee.skillCategory,
        ...marks,
        marks.filter((mark) => mark === 'P').length,
      ];
    });

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Register of Attendance (Form XVI) - Demo'],
    [`Period: ${periodLabel}`],
    ['Site: Rangpo SIS Powergrid'],
    ['P = Present, A = Absent, blank = not yet recorded. Set the attendance date in the app to choose which day column is imported.'],
    [],
    header,
    ...rows,
  ]);
  sheet['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 16 }, { wch: 13 }, ...days.map(() => ({ wch: 4 })), { wch: 13 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  XLSX.writeFile(workbook, filePath);
}

async function seedAttendanceDemo() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo attendance data cannot be seeded in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI before seeding demo attendance data.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const today = localDate();

  let organization = await User.findOne({ email: DEMO_ORG_EMAIL });
  if (!organization) {
    organization = await User.create({
      name: 'Rangpo Site Manager',
      organizationName: 'Rangpo Horticulture Demo',
      email: DEMO_ORG_EMAIL,
      password: DEMO_ORG_PASSWORD,
      phone: '+91 90000 00001',
      address: 'Rangpo SIS, Powergrid, Sikkim',
      industry: 'Horticulture',
      role: 'organization',
      status: 'active',
    });
  } else {
    organization.name = 'Rangpo Site Manager';
    organization.organizationName = 'Rangpo Horticulture Demo';
    organization.phone = '+91 90000 00001';
    organization.address = 'Rangpo SIS, Powergrid, Sikkim';
    organization.industry = 'Horticulture';
    organization.status = 'active';
    await organization.save();
  }

  const designation = await MasterData.findOneAndUpdate(
    { type: 'designation', code: 'event' },
    { $setOnInsert: { type: 'designation', code: 'event', name: 'Event', status: 'active' } },
    { returnDocument: 'after', upsert: true },
  ).lean();
  if (designation.status !== 'active') throw new Error('Enable the "Event" designation in Settings → Master data first.');

  const location = await Location.findOneAndUpdate(
    { organizationId: organization.id, opNumber: 'DEMO-RANGPO-16' },
    {
      $set: {
        workName: 'AMC Horticulture Work',
        name: 'Rangpo SIS Powergrid',
        address: 'Rangpo, Sikkim',
        designation: designation.name,
        status: 'active',
      },
      $setOnInsert: { organizationId: organization.id, opNumber: 'DEMO-RANGPO-16' },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  for (const [index, employee] of EMPLOYEES.entries()) {
    const email = emailFor(employee, index);
    await Employee.findOneAndUpdate(
      { organizationId: organization.id, email },
      {
        $set: {
          name: employee.name,
          parentName: employee.parentName,
          skillCategory: employee.skillCategory,
          designation: designation.name,
          department: 'Horticulture',
          jobTitle: employee.skillCategory,
          locationId: location.id,
          locationAssignedAt: new Date(),
          dailySalary: 650,
          currency: 'INR',
          status: 'active',
        },
        $setOnInsert: {
          organizationId: organization.id,
          email,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  const admin = await User.findOne({ role: 'admin', status: 'active' });
  if (!admin) throw new Error('Create an admin account before seeding demo attendance.');

  let marked = 0;
  for (const [index, employee] of EMPLOYEES.entries()) {
    const record = await Employee.findOne({ organizationId: organization.id, email: emailFor(employee, index) });
    if (!record) continue;
    await Attendance.updateOne(
      { employeeId: record._id, date: today.iso },
      {
        $set: {
          organizationId: organization.id,
          status: employee.statusToken === 'A' ? 'absent' : 'present',
          markedBy: admin._id,
        },
        $setOnInsert: { employeeId: record._id, date: today.iso },
      },
      { upsert: true },
    );
    marked += 1;
  }

  const sheetPath = path.join(__dirname, '..', '..', 'fixtures', `demo-attendance-${today.iso}.xlsx`);
  const publicSamplePath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'examples', 'sample-attendance.xlsx');
  writeAttendanceSheet(sheetPath, today);
  writeAttendanceSheet(publicSamplePath, today);

  console.log('Demo attendance data is ready.');
  console.log(`Organization: Rangpo Horticulture Demo (${DEMO_ORG_EMAIL} / ${DEMO_ORG_PASSWORD})`);
  console.log(`Location: ${location.name} (${location.id})`);
  console.log(`Employees: ${EMPLOYEES.length} (includes two Ram Bahadur Chettri records with different father names)`);
  console.log(`Attendance marked: ${marked} records for ${today.iso}`);
  console.log(`Upload sheet: ${sheetPath}`);
}

seedAttendanceDemo()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
