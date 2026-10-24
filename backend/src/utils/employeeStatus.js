// A blocked employee keeps the work done before `disabledOn`; from that day on nothing new is recorded or counted.
// Employees blocked before `disabledOn` existed have no date, so they cannot receive any new attendance.

function canMarkAttendanceOn(employee, date) {
	if (employee?.status !== 'disabled') return true;
	return Boolean(employee.disabledOn) && date < employee.disabledOn;
}

function countsAttendanceOn(employee, date) {
	if (employee?.status !== 'disabled' || !employee.disabledOn || !date) return true;
	return date < employee.disabledOn;
}

module.exports = { canMarkAttendanceOn, countsAttendanceOn };
