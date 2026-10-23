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

const DEMO_PASSWORD = 'DemoOrg123';
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'fixtures', 'demo');
const EMPLOYEE_COUNT = 86;

const DESIGNATIONS = ['Mali', 'Security Guard', 'Housekeeping', 'Electrician', 'Cook', 'Plumber'];
const SKILLS = [
	{ name: 'Skilled', dailySalary: 781, basicPay: 690, dearnessAllowance: 91 },
	{ name: 'Semi-Skilled', dailySalary: 650, basicPay: 575, dearnessAllowance: 75 },
	{ name: 'Un-skilled', dailySalary: 556, basicPay: 492, dearnessAllowance: 64 },
];
const EMPLOYMENT_TYPES = ['regular', 'fixed-term', 'contractual'];

const ORGANIZATIONS = [
	{
		key: 'powergrid',
		name: 'Rajesh Sharma',
		organizationName: 'Powergrid Corporation - Rangpo',
		phone: '+91 94340 11001',
		address: '400/220 KV Substation, Rangpo, East Sikkim - 737132',
		industry: 'Power transmission',
		website: 'https://www.powergrid.in',
		about: 'Substation maintenance and horticulture contracts.',
		locations: [
			{ workName: 'AMC Contract for Horticulture Work', opNumber: 'PG-RNG-01', name: 'Rangpo S/S', address: '400/220 KV, RANGPO S/S, Powergrid, SIKKIM', designation: 'Mali', loa: 'LOA- GEMC-511687787412439 Dtd. 16-09-2025 ( PGCIL SAP PO-5200076637 )' },
			{ workName: 'Security Services', opNumber: 'PG-RNG-02', name: 'Rangpo Colony', address: 'Powergrid Township, Rangpo, Sikkim', designation: 'Security Guard', loa: 'LOA- GEMC-511687787412440 Dtd. 01-10-2025' },
		],
	},
	{
		key: 'nhpc',
		name: 'Anita Gurung',
		organizationName: 'NHPC Teesta-V Power Station',
		phone: '+91 94340 22002',
		address: 'Balutar, Singtam, East Sikkim - 737134',
		industry: 'Hydro power',
		website: 'https://www.nhpcindia.com',
		about: 'Hydro power station facility management.',
		locations: [
			{ workName: 'Housekeeping of Power House', opNumber: 'NH-TV-01', name: 'Balutar Power House', address: 'Teesta-V Power House, Balutar, Sikkim', designation: 'Housekeeping', loa: 'LOA- NHPC/TV/HK/2025/114 Dtd. 05-08-2025' },
			{ workName: 'Electrical Maintenance', opNumber: 'NH-TV-02', name: 'Dikchu Dam Site', address: 'Dikchu Dam, North Sikkim', designation: 'Electrician', loa: 'LOA- NHPC/TV/EM/2025/121 Dtd. 20-08-2025' },
		],
	},
	{
		key: 'jktyre',
		name: 'Mahesh Paliwal',
		organizationName: 'JK Tyre & Industries - Kankroli',
		phone: '+91 97847 33003',
		address: 'Jaynagar, Kankroli, Rajsamand (Raj.) - 313342',
		industry: 'Manufacturing',
		website: 'https://www.jktyre.com',
		about: 'Plant canteen and utility contracts.',
		locations: [
			{ workName: 'Canteen Services', opNumber: 'JK-KNK-01', name: 'Plant Canteen', address: 'JK Tyre Plant, Kankroli, Rajsamand', designation: 'Cook', loa: 'WO- JKT/KNK/CAN/2025/045 Dtd. 12-07-2025' },
			{ workName: 'Plumbing & Water Works', opNumber: 'JK-KNK-02', name: 'Utility Block', address: 'JK Tyre Utility Block, Kankroli', designation: 'Plumber', loa: 'WO- JKT/KNK/PLB/2025/052 Dtd. 18-07-2025' },
		],
	},
	{
		key: 'rajsamand',
		name: 'Sunita Joshi',
		organizationName: 'Nagar Parishad Rajsamand',
		phone: '+91 97847 44004',
		address: 'Nagar Parishad Bhawan, Rajnagar, Rajsamand - 313326',
		industry: 'Municipal services',
		website: '',
		about: 'Public garden and office maintenance.',
		locations: [
			{ workName: 'Garden Maintenance', opNumber: 'NP-RSM-01', name: 'Rajsamand Lake Garden', address: 'Nau Chowki Pal, Rajsamand Lake', designation: 'Mali', loa: 'WO- NP/RSM/GDN/2025/09 Dtd. 02-06-2025' },
			{ workName: 'Office Security', opNumber: 'NP-RSM-02', name: 'Parishad Office', address: 'Nagar Parishad Bhawan, Rajnagar', designation: 'Security Guard', loa: 'WO- NP/RSM/SEC/2025/11 Dtd. 10-06-2025' },
		],
	},
];

const FIRST_NAMES = [
	'Nehpal', 'Pawan', 'Sanjay', 'Ashish', 'Santosh', 'Prithavipal', 'Hament', 'Gambu', 'Sarvan', 'Dhan', 'Krishna', 'Surendra',
	'Natwar', 'Akash', 'Avinash', 'Yovraj', 'Pralad', 'Gobinda', 'Mani', 'Om', 'Aita', 'Anil', 'Ramesh', 'Mahesh', 'Dinesh',
	'Kailash', 'Bhagwati', 'Laxman', 'Shankar', 'Devi', 'Kamla', 'Geeta', 'Sita', 'Puja', 'Rekha', 'Vikram', 'Rohit', 'Bharat',
	'Kishan', 'Mohan',
];
const LAST_NAMES = [
	'Singh', 'Kumar', 'Nautiyal', 'Yadav', 'Mandal', 'Pal', 'Bahadur', 'Gond', 'Gurunath', 'Subhash', 'Ramchandra', 'Chettri',
	'Rai', 'Subba', 'Tamang', 'Gurung', 'Paliwal', 'Kumawat', 'Sharma', 'Joshi', 'Meena', 'Gujar', 'Salvi', 'Sen',
];
const PARENT_NAMES = ['Nar Bahadur', 'Dutt Ram', 'Hari Singh', 'Mohan Lal', 'Bhanwar Lal', 'Ganesh Ram', 'Shyam Lal', 'Kishan Lal', 'Prem Singh', 'Ratan Lal'];
const BANKS = [
	{ name: 'STATE BANK OF INDIA', ifsc: 'SBIN0011411', branch: 'Kankroli' },
	{ name: 'PUNJAB NATIONAL BANK', ifsc: 'PUNB0409100', branch: 'J.K. Mode, Kankroli' },
	{ name: 'BANK OF BARODA', ifsc: 'BARB0RAJSAM', branch: 'Rajsamand' },
	{ name: 'HDFC BANK', ifsc: 'HDFC0002100', branch: 'Rajsamand' },
	{ name: 'ICICI BANK', ifsc: 'ICIC0003473', branch: 'Gangtok' },
	{ name: 'UNION BANK OF INDIA', ifsc: 'UBIN0534943', branch: 'Singtam' },
	{ name: 'UCO BANK', ifsc: 'UCBA0000377', branch: 'Rangpo' },
	{ name: 'IDBI BANK', ifsc: 'IBKL0000104', branch: 'Udaipur' },
	{ name: 'KOTAK MAHINDRA BANK', ifsc: 'KKBK0000205', branch: 'Udaipur' },
	{ name: 'BANK OF INDIA', ifsc: 'BKID0009610', branch: 'Nathdwara' },
];

function random(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
}

const rand = random(20261023);
const pick = (items) => items[Math.floor(rand() * items.length)];
const digits = (length) => Array.from({ length }, (_, index) => (index === 0 ? 1 + Math.floor(rand() * 9) : Math.floor(rand() * 10))).join('');
const pad = (value) => String(value).padStart(2, '0');
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function slug(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

function buildEmployees(locations) {
	const employees = [];
	const usedNames = new Set();
	const uniqueName = (first) => {
		let name = `${first} ${pick(LAST_NAMES)}`;
		while (usedNames.has(name)) name = `${first} ${pick(LAST_NAMES)}`;
		usedNames.add(name);
		return name;
	};
	for (let index = 0; index < EMPLOYEE_COUNT; index += 1) {
		const location = locations[index % locations.length];
		const duplicate = index === 9 || index === 17;
		const name = duplicate ? employees[index - 8].name : uniqueName(FIRST_NAMES[index % FIRST_NAMES.length]);
		const skill = SKILLS[index % 7 === 0 ? 0 : index % 3 === 0 ? 1 : 2];
		const bank = pick(BANKS);
		const female = /^(Devi|Kamla|Geeta|Sita|Puja|Rekha|Om)\b/.test(name);
		const birthYear = 1972 + Math.floor(rand() * 30);
		const joinYear = 2018 + Math.floor(rand() * 8);
		employees.push({
			organizationId: location.organizationId,
			locationId: location._id,
			locationAssignedAt: new Date(),
			name,
			email: `demo.employee.${index + 1}@shreeji.local`,
			dateOfBirth: `${birthYear}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
			parentName: duplicate ? PARENT_NAMES[(index + 3) % PARENT_NAMES.length] : PARENT_NAMES[index % PARENT_NAMES.length],
			aadhaarNumber: digits(12),
			aadhaarConsent: true,
			establishmentLin: `LIN${digits(10)}`,
			uan: digits(12),
			esicNumber: digits(10),
			designation: location.designationName,
			employmentType: EMPLOYMENT_TYPES[index % EMPLOYMENT_TYPES.length],
			skillCategory: skill.name,
			dateOfJoining: `${joinYear}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
			basicPay: skill.basicPay,
			dearnessAllowance: skill.dearnessAllowance,
			otherAllowances: index % 4 === 0 ? 'Washing allowance Rs. 200 / month' : 'Nil',
			epfoApplicable: index % 9 !== 0,
			esicApplicable: index % 11 !== 0,
			duties: `${location.designationName} duties at ${location.name} as assigned by the site in-charge.`,
			maternityBenefits: female ? 'As per Maternity Benefit Act, 1961' : 'Not applicable',
			otherInformation: `Emergency contact: ${digits(10)}`,
			department: location.workName,
			jobTitle: `${skill.name} ${location.designationName}`,
			phone: `+91 ${digits(5)} ${digits(5)}`,
			address: `${1 + Math.floor(rand() * 200)}, Ward ${1 + Math.floor(rand() * 30)}, ${location.address}`,
			dailySalary: skill.dailySalary,
			currency: 'INR',
			bankName: bank.name,
			bankBranch: bank.branch,
			bankAccountHolder: name.toUpperCase(),
			bankAccountNumber: digits(11 + Math.floor(rand() * 5)),
			bankRoutingCode: bank.ifsc,
			status: 'active',
		});
	}
	return employees;
}

/** Deterministic attendance: about 1 in 9 days absent, Sundays mostly off. */
function mark(employeeIndex, dateIso) {
	const date = new Date(`${dateIso}T00:00:00Z`);
	const day = date.getUTCDate();
	if (date.getUTCDay() === 0 && (employeeIndex + day) % 3 !== 0) return 'A';
	return (employeeIndex * 7 + day * 3) % 9 === 0 ? 'A' : 'P';
}

function monthDays(year, month) {
	const count = new Date(year, month, 0).getDate();
	return Array.from({ length: count }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`);
}

function sheetName(employee) {
	return employee.name.toUpperCase();
}

function writeMonthlyExcel(filePath, location, organization, rows, year, month, lastDay) {
	const days = monthDays(year, month);
	const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
	const header = ['S.no', 'Name of Employees', "Father's name", 'Category', ...days.map((_, index) => index + 1), 'Total Present'];
	const body = rows.map(({ employee, index }, rowIndex) => {
		const marks = days.map((date, dayIndex) => (dayIndex + 1 > lastDay ? '' : mark(index, date)));
		return [rowIndex + 1, sheetName(employee), employee.parentName.toUpperCase(), employee.skillCategory, ...marks, marks.filter((value) => value === 'P').length];
	});
	const sheet = XLSX.utils.aoa_to_sheet([
		['Register of Attendance (Form XVI)'],
		[`Period: ${label}`],
		[`Organization: ${organization.organizationName}`],
		[`Site: ${location.workName} at ${location.address}`],
		[],
		header,
		...body,
	]);
	sheet['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 18 }, { wch: 13 }, ...days.map(() => ({ wch: 4 })), { wch: 13 }];
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
	XLSX.writeFile(workbook, filePath);
}

function writeDailyExcel(filePath, location, organization, rows, dateIso) {
	const sheet = XLSX.utils.aoa_to_sheet([
		['Daily Attendance'],
		[`Organization: ${organization.organizationName}`],
		[`Site: ${location.workName}`],
		[`Date: ${dateIso}`],
		[],
		['S.no', 'Name of Employees', "Father's name", 'Category', 'Status'],
		...rows.map(({ employee, index }, rowIndex) => [rowIndex + 1, sheetName(employee), employee.parentName.toUpperCase(), employee.skillCategory, mark(index, dateIso)]),
	]);
	sheet['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 18 }, { wch: 13 }, { wch: 8 }];
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
	XLSX.writeFile(workbook, filePath);
}

function loadJsPdf() {
	const candidates = [
		path.join(__dirname, '..', '..', 'node_modules', 'jspdf'),
		path.join(__dirname, '..', '..', '..', 'frontend', 'node_modules', 'jspdf'),
	];
	for (const candidate of candidates) {
		try {
			return require(candidate).jsPDF;
		} catch {
			// try the next location
		}
	}
	return null;
}

function writeDailyPdf(jsPDF, filePath, location, organization, rows, dateIso) {
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const [year, month, day] = dateIso.split('-');
	const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, 1));
	let y = 16;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(14);
	doc.text('Daily Attendance Sheet', 105, y, { align: 'center' });
	y += 7;
	doc.setFontSize(10);
	doc.text(`${organization.organizationName} - ${location.workName}`, 105, y, { align: 'center' });
	y += 5;
	doc.setFont('helvetica', 'normal');
	doc.text(`Period: ${label}    Date: ${day}-${month}-${year}`, 105, y, { align: 'center' });
	y += 10;
	doc.setFontSize(10);
	rows.forEach(({ employee, index }, rowIndex) => {
		if (y > 280) {
			doc.addPage();
			y = 16;
		}
		const name = employee.name.toUpperCase();
		const line = `${rowIndex + 1}. ${name} S/O ${employee.parentName.toUpperCase()}`;
		doc.text(`${line.padEnd(48, ' ')}  ${employee.skillCategory.padEnd(14, ' ')}  ${mark(index, dateIso)}`, 14, y);
		y += 6.5;
	});
	fs.writeFileSync(filePath, Buffer.from(doc.output('arraybuffer')));
}

async function upsertMasterData() {
	for (const name of DESIGNATIONS) {
		await MasterData.updateOne(
			{ type: 'designation', code: name.toLowerCase() },
			{ $setOnInsert: { type: 'designation', code: name.toLowerCase(), name, status: 'active' } },
			{ upsert: true },
		);
	}
	for (const skill of SKILLS) {
		await MasterData.updateOne(
			{ type: 'skillCategory', code: skill.name.toLowerCase() },
			{ $setOnInsert: { type: 'skillCategory', code: skill.name.toLowerCase(), name: skill.name, status: 'active' } },
			{ upsert: true },
		);
	}
	const typeNames = { regular: 'Regular', 'fixed-term': 'Fixed-term employment', contractual: 'Contractual' };
	for (const code of EMPLOYMENT_TYPES) {
		await MasterData.updateOne(
			{ type: 'employmentType', code },
			{ $setOnInsert: { type: 'employmentType', code, name: typeNames[code], status: 'active' } },
			{ upsert: true },
		);
	}
}

async function seed() {
	if (process.env.NODE_ENV === 'production') throw new Error('Demo data cannot be seeded in production.');
	if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding demo data.');
	await mongoose.connect(process.env.MONGODB_URI);

	const admin = await User.findOne({ role: 'admin', status: 'active' });
	if (!admin) throw new Error('Create an admin account first (npm run seed:admin).');
	await upsertMasterData();

	const organizations = [];
	const locations = [];
	for (const definition of ORGANIZATIONS) {
		const email = `${definition.key}.demo@shreeji.local`;
		let organization = await User.findOne({ email });
		if (!organization) organization = new User({ email, password: DEMO_PASSWORD, role: 'organization' });
		Object.assign(organization, {
			name: definition.name,
			organizationName: definition.organizationName,
			phone: definition.phone,
			address: definition.address,
			industry: definition.industry,
			website: definition.website,
			about: definition.about,
			status: 'active',
		});
		await organization.save();
		organizations.push(organization);

		for (const site of definition.locations) {
			const location = await Location.findOneAndUpdate(
				{ organizationId: organization._id, opNumber: site.opNumber },
				{
					$set: {
						workName: site.workName,
						name: site.name,
						address: site.address,
						loaReference: site.loa,
						designation: site.designation.toLowerCase(),
						status: 'active',
					},
					$setOnInsert: { organizationId: organization._id, opNumber: site.opNumber },
				},
				{ returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
			).lean();
			locations.push({ ...location, designationName: site.designation, organization });
		}
	}

	const previousDemo = await Employee.find({
		organizationId: { $in: organizations.map((organization) => organization._id) },
		email: /^demo\.employee\.\d+@shreeji\.local$/,
	}, { _id: 1 }).lean();
	if (previousDemo.length) {
		const ids = previousDemo.map((employee) => employee._id);
		await Attendance.deleteMany({ employeeId: { $in: ids } });
		await Employee.deleteMany({ _id: { $in: ids } });
	}

	const employees = buildEmployees(locations);
	const saved = [];
	for (const employee of employees) {
		const record = await Employee.findOneAndUpdate(
			{ organizationId: employee.organizationId, email: employee.email },
			{ $set: employee },
			{ returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true },
		).lean();
		saved.push(record);
	}

	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth() + 1;
	const previous = new Date(year, month - 2, 1);
	const todayIso = isoDate(today);
	const dates = [
		...monthDays(previous.getFullYear(), previous.getMonth() + 1),
		...monthDays(year, month).filter((date) => date < todayIso),
	];
	const operations = [];
	saved.forEach((employee, index) => {
		for (const date of dates) {
			operations.push({
				updateOne: {
					filter: { employeeId: employee._id, date },
					update: {
						$set: { organizationId: employee.organizationId, status: mark(index, date) === 'P' ? 'present' : 'absent', markedBy: admin._id },
						$setOnInsert: { employeeId: employee._id, date },
					},
					upsert: true,
				},
			});
		}
	});
	for (let start = 0; start < operations.length; start += 1000) {
		await Attendance.bulkWrite(operations.slice(start, start + 1000), { ordered: false });
	}

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	const jsPDF = loadJsPdf();
	const files = [];
	for (const location of locations) {
		const rows = saved
			.map((employee, index) => ({ employee, index }))
			.filter(({ employee }) => String(employee.locationId) === String(location._id));
		const base = `${slug(location.organization.organizationName)}-${slug(location.workName)}`.replace(/\./g, '-');
		const monthly = path.join(OUTPUT_DIR, `${base}-month-${year}-${pad(month)}.xlsx`);
		const dailyExcel = path.join(OUTPUT_DIR, `${base}-day-${todayIso}.xlsx`);
		writeMonthlyExcel(monthly, location, location.organization, rows, year, month, today.getDate());
		writeDailyExcel(dailyExcel, location, location.organization, rows, todayIso);
		files.push(monthly, dailyExcel);
		if (jsPDF) {
			const dailyPdf = path.join(OUTPUT_DIR, `${base}-day-${todayIso}.pdf`);
			writeDailyPdf(jsPDF, dailyPdf, location, location.organization, rows, todayIso);
			files.push(dailyPdf);
		}
	}

	console.log('Full demo data is ready.');
	console.log(`Organizations: ${organizations.length} (login: <key>.demo@shreeji.local / ${DEMO_PASSWORD})`);
	organizations.forEach((organization) => console.log(`  - ${organization.organizationName}: ${organization.email}`));
	console.log(`Locations: ${locations.length}`);
	console.log(`Employees: ${saved.length} (all fields and bank details filled)`);
	console.log(`Attendance records: ${operations.length} (${dates[0]} to ${dates[dates.length - 1]})`);
	console.log(`Upload files (${files.length}) in ${OUTPUT_DIR}`);
	if (!jsPDF) console.log('jsPDF not found, so PDF sheets were skipped (run npm install in frontend).');
}

seed()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => {
		if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
	});
