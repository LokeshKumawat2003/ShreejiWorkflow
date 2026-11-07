const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { isSunday } = require('../utils/employeeStatus');
const { currentDateInTimeZone } = require('./attendanceService');
const { calculatePayroll } = require('./payrollService');

const { httpError } = require('../utils/httpError');

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 366;
const BREAKDOWN_LIMIT = 6;
const NOT_MARKED_LIMIT = 8;

// Dashboard groups: every leave type counts as leave, weekly offs and holidays as off; unknown legacy statuses as absent.
const STATUS_GROUP = {
	present: 'present',
	absent: 'absent',
	half_day: 'halfDay',
	leave: 'leave',
	paid_leave: 'leave',
	casual_leave: 'leave',
	sick_leave: 'leave',
	weekly_off: 'off',
	holiday: 'off',
};

function emptyCounts() {
	return { present: 0, absent: 0, halfDay: 0, leave: 0, off: 0 };
}

function addStatus(counts, status, amount = 1) {
	counts[STATUS_GROUP[status] || 'absent'] += amount;
}

function markedCount(counts) {
	return counts.present + counts.absent + counts.halfDay + counts.leave + counts.off;
}

// Present (half days count half) out of the marked working days; offs and holidays are not working days.
function attendanceRate(counts) {
	const workingMarks = counts.present + counts.absent + counts.halfDay + counts.leave;
	return workingMarks ? Math.round(((counts.present + counts.halfDay * 0.5) / workingMarks) * 1000) / 10 : null;
}

function shiftDate(date, days) {
	const value = new Date(`${date}T00:00:00.000Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

function daysBetween(fromDate, toDate) {
	return Math.round((new Date(`${toDate}T00:00:00.000Z`) - new Date(`${fromDate}T00:00:00.000Z`)) / 86400000) + 1;
}

function isValidDate(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function resolvePeriod(options, today) {
	const toDate = options.toDate || today;
	const fromDate = options.fromDate || shiftDate(toDate, -(DEFAULT_PERIOD_DAYS - 1));
	if (!isValidDate(fromDate) || !isValidDate(toDate)) throw httpError(400, 'Enter a valid dashboard date range.');
	if (fromDate > toDate) throw httpError(400, 'The start date must be on or before the end date.');
	if (daysBetween(fromDate, toDate) > MAX_PERIOD_DAYS) throw httpError(400, `Choose a date range of ${MAX_PERIOD_DAYS} days or fewer.`);
	return { fromDate, toDate };
}

function periodDateFilter(fromDate, toDate, today) {
	return { $or: [{ date: { $gte: fromDate, $lte: toDate } }, { date: today }] };
}

async function groupEmployees(match, field) {
	const rows = await Employee.aggregate([
		{ $match: match },
		{ $group: { _id: { $ifNull: [`$${field}`, ''] }, count: { $sum: 1 } } },
		{ $sort: { count: -1, _id: 1 } },
	]);
	const named = rows.filter((row) => row._id);
	const unnamed = rows.filter((row) => !row._id).reduce((sum, row) => sum + row.count, 0);
	const top = named.slice(0, BREAKDOWN_LIMIT).map((row) => ({ name: row._id, value: row.count }));
	const other = named.slice(BREAKDOWN_LIMIT).reduce((sum, row) => sum + row.count, 0) + unnamed;
	return other ? [...top, { name: 'Other / not set', value: other }] : top;
}

/** Per-site view for an organization: employees are placed by location and matching designation, as on the attendance pages. */
async function locationBreakdown(organizationId, today, fromDate, toDate) {
	const [locations, employees, records] = await Promise.all([
		Location.find({ organizationId }).sort({ name: 1 }).lean(),
		Employee.find({ organizationId, status: 'active' }).select('name designation locationId').sort({ name: 1 }).lean(),
		Attendance.find({ organizationId, ...periodDateFilter(fromDate, toDate, today) }).select('employeeId date status').lean(),
	]);
	const todayStatus = new Map();
	const monthByEmployee = new Map();
	for (const record of records) {
		const key = String(record.employeeId);
		if (record.date === today) todayStatus.set(key, record.status);
		if (record.date < fromDate || record.date > toDate) continue;
		if (!monthByEmployee.has(key)) monthByEmployee.set(key, emptyCounts());
		addStatus(monthByEmployee.get(key), record.status);
	}

	const locationFor = (employee) => locations.find((location) => (
		String(location._id) === String(employee.locationId)
		&& String(location.designation || '').toLowerCase() === String(employee.designation || '').toLowerCase()
	));
	const sites = locations.map((location) => ({
		id: String(location._id),
		name: location.workName,
		place: location.name,
		designation: location.designation,
		status: location.status,
		employees: 0,
		today: { ...emptyCounts(), notMarked: 0 },
		month: emptyCounts(),
	}));
	const sitesById = new Map(sites.map((site) => [site.id, site]));
	const notMarked = [];
	const sunday = isSunday(today);

	for (const employee of employees) {
		const key = String(employee._id);
		const location = locationFor(employee);
		const site = location ? sitesById.get(String(location._id)) : null;
		const status = todayStatus.get(key);
		if (site) {
			site.employees += 1;
			if (status) addStatus(site.today, status);
			else if (!sunday) site.today.notMarked += 1;
			const month = monthByEmployee.get(key);
			if (month) Object.keys(month).forEach((group) => { site.month[group] += month[group]; });
		}
		if (!status && !sunday) {
			notMarked.push({ id: key, name: employee.name, designation: employee.designation || '', locationName: site?.name || 'Not placed at a location' });
		}
	}

	return {
		locations: sites.map(({ month, ...site }) => ({ ...site, periodRate: attendanceRate(month) })),
		notMarkedToday: notMarked.slice(0, NOT_MARKED_LIMIT),
	};
}

async function getDashboardSummary(user, options = {}) {
	const isAdmin = user.role === 'admin';
	const today = currentDateInTimeZone(options.timeZone || 'UTC');
	const { fromDate, toDate } = resolvePeriod(options, today);
	const orgScope = isAdmin ? {} : { organizationId: new mongoose.Types.ObjectId(user.id) };
	const activeEmployeeMatch = { ...orgScope, status: 'active' };

	const [
		organizations,
		locations,
		activeLocations,
		employees,
		activeEmployees,
		unassignedEmployees,
		attendanceRows,
		byDesignation,
		bySkillCategory,
		recentEmployees,
		payroll,
		sites,
	] = await Promise.all([
		isAdmin ? User.countDocuments({ role: 'organization' }) : Promise.resolve(null),
		Location.countDocuments(orgScope),
		Location.countDocuments({ ...orgScope, status: 'active' }),
		Employee.countDocuments(orgScope),
		Employee.countDocuments(activeEmployeeMatch),
		isAdmin ? Employee.countDocuments({ organizationId: null }) : Promise.resolve(null),
		Attendance.aggregate([
			{ $match: { ...orgScope, ...periodDateFilter(fromDate, toDate, today) } },
			{ $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
		]),
		groupEmployees(activeEmployeeMatch, 'designation'),
		groupEmployees(activeEmployeeMatch, 'skillCategory'),
		Employee.find(orgScope)
			.sort({ createdAt: -1, _id: -1 })
			.limit(5)
			.populate('organizationId', 'organizationName')
			.select('name designation skillCategory status createdAt organizationId')
			.lean(),
		isAdmin ? calculatePayroll(user, { fromDate, toDate, attendanceOnly: true }) : Promise.resolve(null),
		isAdmin ? Promise.resolve(null) : locationBreakdown(orgScope.organizationId, today, fromDate, toDate),
	]);

	const countsByDate = new Map();
	const period = emptyCounts();
	for (const row of attendanceRows) {
		if (!countsByDate.has(row._id.date)) countsByDate.set(row._id.date, emptyCounts());
		addStatus(countsByDate.get(row._id.date), row._id.status, row.count);
		if (row._id.date >= fromDate && row._id.date <= toDate) addStatus(period, row._id.status, row.count);
	}

	const trend = Array.from({ length: daysBetween(fromDate, toDate) }, (_, index) => {
		const date = shiftDate(fromDate, index);
		return { date, ...(countsByDate.get(date) || emptyCounts()) };
	});
	const todayCounts = countsByDate.get(today) || emptyCounts();
	const todaySunday = isSunday(today);

	return {
		date: today,
		totals: {
			organizations,
			locations,
			activeLocations,
			employees,
			activeEmployees,
			unassignedEmployees,
		},
		today: {
			...todayCounts,
			isSunday: todaySunday,
			notMarked: todaySunday ? 0 : Math.max(activeEmployees - markedCount(todayCounts), 0),
		},
		trend,
		period: {
			fromDate,
			toDate,
			...period,
			attendanceRate: attendanceRate(period),
			paidDays: payroll ? payroll.summary.paidDays : null,
			wages: payroll ? payroll.totals : null,
		},
		locations: sites?.locations || null,
		notMarkedToday: sites?.notMarkedToday || null,
		byDesignation,
		bySkillCategory,
		recentEmployees: recentEmployees.map((employee) => ({
			id: String(employee._id),
			name: employee.name,
			designation: employee.designation || '',
			skillCategory: employee.skillCategory || '',
			status: employee.status,
			organizationName: employee.organizationId?.organizationName || '',
			createdAt: employee.createdAt,
		})),
	};
}

module.exports = { getDashboardSummary };
