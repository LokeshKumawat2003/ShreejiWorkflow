// Saved attendance statuses. "Not marked" is the absence of a record and "needs review" exists only in upload previews.
const ATTENDANCE_STATUSES = [
	'present',
	'absent',
	'half_day',
	'leave',
	'paid_leave',
	'casual_leave',
	'sick_leave',
	'weekly_off',
	'holiday',
];

const STATUS_CODES = {
	present: 'P',
	absent: 'A',
	half_day: 'HD',
	leave: 'L',
	paid_leave: 'PL',
	casual_leave: 'CL',
	sick_leave: 'SL',
	weekly_off: 'WO',
	holiday: 'H',
};

// Days paid in payroll: a half day pays half; only paid leave is paid among leaves.
const PAID_DAY_VALUE = { present: 1, half_day: 0.5, paid_leave: 1 };

// A month counts at most 26 working / paid days, even when it has 27 days other than Sundays.
const MAX_MONTH_WORKING_DAYS = 26;

const NON_WORKING_STATUSES = new Set(['weekly_off', 'holiday']);

function isAttendanceStatus(value) {
	return ATTENDANCE_STATUSES.includes(value);
}

function round2(value) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Totals for one employee over one month. `calendarDays` are the countable (non-Sunday) days in the month;
 * days marked weekly off or holiday are taken out of the working days. Working and paid days stop at
 * MAX_MONTH_WORKING_DAYS.
 */
function summarizeAttendance(statuses, calendarDays) {
	const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, 0]));
	for (const status of statuses) {
		if (counts[status] !== undefined) counts[status] += 1;
	}
	const nonWorking = counts.weekly_off + counts.holiday;
	const workingDays = Math.min(MAX_MONTH_WORKING_DAYS, Math.max(0, calendarDays - nonWorking));
	const attended = Math.min(MAX_MONTH_WORKING_DAYS, counts.present + counts.half_day * 0.5);
	const paidDays = Math.min(MAX_MONTH_WORKING_DAYS, statuses.reduce((sum, status) => sum + (PAID_DAY_VALUE[status] || 0), 0));
	return {
		workingDays,
		presentDays: counts.present,
		absentDays: counts.absent,
		halfDays: counts.half_day,
		paidLeaves: counts.paid_leave,
		otherLeaves: counts.leave + counts.casual_leave + counts.sick_leave,
		casualLeaves: counts.casual_leave,
		sickLeaves: counts.sick_leave,
		weeklyOffs: counts.weekly_off,
		holidays: counts.holiday,
		paidDays: round2(paidDays),
		attendancePercentage: workingDays > 0 ? round2((attended / workingDays) * 100) : 0,
	};
}

module.exports = {
	ATTENDANCE_STATUSES,
	MAX_MONTH_WORKING_DAYS,
	NON_WORKING_STATUSES,
	PAID_DAY_VALUE,
	STATUS_CODES,
	isAttendanceStatus,
	summarizeAttendance,
};
