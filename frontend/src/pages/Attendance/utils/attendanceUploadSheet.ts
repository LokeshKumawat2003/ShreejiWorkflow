import { getAttendanceRegister, type AttendanceRegister } from '../../../services/attendanceService';
import { addRowsSheet, createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';

type SheetScope = { organizationId: string; locationId: string };

function siteLine(register: AttendanceRegister) {
  const { workName, name } = register.location;
  return `Site: ${[register.organizationName, workName, name].filter(Boolean).join(' - ')}`;
}

function fileSlug(register: AttendanceRegister) {
  const slug = (register.location.workName || register.location.name || 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return slug || 'location';
}

function columnName(index: number) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

export async function downloadMonthUploadSheet(scope: SheetScope, month: string) {
  const [register, workbook] = await Promise.all([
    getAttendanceRegister({ ...scope, month }),
    createWorkbook(),
  ]);
  const days = Array.from({ length: register.daysInMonth }, (_, index) => index + 1);
  const firstDataRow = 7;
  const totalColumn = 5 + days.length;
  const firstDay = columnName(4);
  const lastDay = columnName(3 + days.length);
  const sheet = addRowsSheet(workbook, 'Attendance', [
    ['Register of Attendance (Form XVI)'],
    [`Period: ${register.periodLabel}`],
    [siteLine(register)],
    ['P = Present, A = Absent. Days already saved are filled in; fill the blank days and upload this file.'],
    [],
    ['S.no', 'Name of Employees', "Father's name", 'Category', ...days, 'Total Present'],
    ...register.rows.map((row) => [row.serial, row.name, row.parentName, row.skillCategory, ...row.days]),
  ], [6, 26, 20, 13, ...days.map(() => 4), 13]);
  register.rows.forEach((row, index) => {
    const excelRow = firstDataRow + index;
    sheet.getCell(excelRow, totalColumn).value = {
      formula: `COUNTIF(${firstDay}${excelRow}:${lastDay}${excelRow},"P")`,
      result: row.totalPresent,
    };
  });

  await downloadWorkbook(workbook, `attendance-${fileSlug(register)}-${month}.xlsx`);
}

export async function downloadDayUploadSheet(scope: SheetScope, date: string) {
  const [register, workbook] = await Promise.all([
    getAttendanceRegister({ ...scope, month: date.slice(0, 7) }),
    createWorkbook(),
  ]);
  const dayIndex = Number(date.slice(8, 10)) - 1;
  const [year, month, day] = date.split('-');
  addRowsSheet(workbook, 'Attendance', [
    ['Daily Attendance Sheet'],
    [`Period: ${register.periodLabel}`],
    [`Date: ${day}-${month}-${year}`],
    [siteLine(register)],
    ['P = Present, A = Absent. Fill the Status column and upload this file.'],
    [],
    ['S.no', 'Name of Employees', "Father's name", 'Category', 'Status'],
    ...register.rows.map((row) => [row.serial, row.name, row.parentName, row.skillCategory, row.days[dayIndex] || '']),
  ], [6, 26, 20, 13, 10]);

  await downloadWorkbook(workbook, `attendance-${fileSlug(register)}-${date}.xlsx`);
}
