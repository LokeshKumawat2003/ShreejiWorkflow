const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { currentDateInTimeZone } = require('./attendanceService');

const TREND_DAYS = 7;
const BREAKDOWN_LIMIT = 6;

function shiftDate(date, days) {
	const value = new Date(`${date}T00:00:00.000Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
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

async function getDashboardSummary(user, options = {}) {
	const isAdmin = user.role === 'admin';
	const today = currentDateInTimeZone(options.timeZone || 'UTC');
	const fromDate = shiftDate(today, -(TREND_DAYS - 1));
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
	] = await Promise.all([
		isAdmin ? User.countDocuments({ role: 'organization' }) : Promise.resolve(null),
		Location.countDocuments(orgScope),
		Location.countDocuments({ ...orgScope, status: 'active' }),
		Employee.countDocuments(orgScope),
		Employee.countDocuments(activeEmployeeMatch),
		isAdmin ? Employee.countDocuments({ organizationId: null }) : Promise.resolve(null),
		Attendance.aggregate([
			{ $match: { ...orgScope, date: { $gte: fromDate, $lte: today } } },
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
	]);

	const trend = Array.from({ length: TREND_DAYS }, (_, index) => {
		const date = shiftDate(fromDate, index);
		const count = (status) => attendanceRows.find((row) => row._id.date === date && row._id.status === status)?.count || 0;
		return { date, present: count('present'), absent: count('absent') };
	});
	const todayPoint = trend[trend.length - 1];

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
			present: todayPoint.present,
			absent: todayPoint.absent,
			notMarked: Math.max(activeEmployees - todayPoint.present - todayPoint.absent, 0),
		},
		trend,
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
