// A blocked employee keeps the work done before `disabledOn`; from that day on nothing new is recorded or counted.
// Employees blocked before `disabledOn` existed have no date, so they cannot receive any new attendance.
// Sunday is the weekly off: it is never marked and never counted.

function isSunday(date) {
	return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

function canMarkAttendanceOn(employee, date) {
	if (isSunday(date)) return false;
	if (employee?.status !== 'disabled') return true;
	return Boolean(employee.disabledOn) && date < employee.disabledOn;
}

function countsAttendanceOn(employee, date) {
	if (isSunday(date)) return false;
	if (employee?.status !== 'disabled' || !employee.disabledOn || !date) return true;
	return date < employee.disabledOn;
}

module.exports = { canMarkAttendanceOn, countsAttendanceOn, isSunday };
