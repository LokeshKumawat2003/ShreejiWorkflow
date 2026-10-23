import { getAttendanceRegister, type AttendanceRegister } from '../../../services/attendanceService';

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
  const [register, XLSX] = await Promise.all([
    getAttendanceRegister({ ...scope, month }),
    import('xlsx'),
  ]);
  const days = Array.from({ length: register.daysInMonth }, (_, index) => index + 1);
  const headerIndex = 5;
  const firstDay = columnName(4);
  const lastDay = columnName(3 + days.length);
  const aoa: (string | number)[][] = [
    ['Register of Attendance (Form XVI)'],
    [`Period: ${register.periodLabel}`],
    [siteLine(register)],
    ['P = Present, A = Absent. Days already saved are filled in; fill the blank days and upload this file.'],
    [],
    ['S.no', 'Name of Employees', "Father's name", 'Category', ...days, 'Total Present'],
    ...register.rows.map((row) => [row.serial, row.name, row.parentName, row.skillCategory, ...row.days, row.totalPresent]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  register.rows.forEach((row, index) => {
    const excelRow = headerIndex + 2 + index;
    sheet[XLSX.utils.encode_cell({ r: headerIndex + 1 + index, c: 4 + days.length })] = {
      t: 'n',
      v: row.totalPresent,
      f: `COUNTIF(${firstDay}${excelRow}:${lastDay}${excelRow},"P")`,
    };
  });
  sheet['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 20 }, { wch: 13 }, ...days.map(() => ({ wch: 4 })), { wch: 13 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  XLSX.writeFile(workbook, `attendance-${fileSlug(register)}-${month}.xlsx`);
}

export async function downloadDayUploadSheet(scope: SheetScope, date: string) {
  const [register, XLSX] = await Promise.all([
    getAttendanceRegister({ ...scope, month: date.slice(0, 7) }),
    import('xlsx'),
  ]);
  const dayIndex = Number(date.slice(8, 10)) - 1;
  const [year, month, day] = date.split('-');
  const aoa: (string | number)[][] = [
    ['Daily Attendance Sheet'],
    [`Period: ${register.periodLabel}`],
    [`Date: ${day}-${month}-${year}`],
    [siteLine(register)],
    ['P = Present, A = Absent. Fill the Status column and upload this file.'],
    [],
    ['S.no', 'Name of Employees', "Father's name", 'Category', 'Status'],
    ...register.rows.map((row) => [row.serial, row.name, row.parentName, row.skillCategory, row.days[dayIndex] || '']),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 20 }, { wch: 13 }, { wch: 10 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  XLSX.writeFile(workbook, `attendance-${fileSlug(register)}-${date}.xlsx`);
}
