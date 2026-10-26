import type { DataValidation } from 'exceljs';
import { listMasterData } from '../../../services/masterDataService';
import { addRowsSheet, createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';

type TemplateColumn = {
  header: string;
  width: number;
  help: string;
  example: string;
  required?: boolean;
  text?: boolean;
  number?: boolean;
  list?: string;
};

const YES_NO = 'YesNo';
const STATUS = 'Status';
const CURRENCY = 'Currency';
const FILL_ROWS = 500;

// Header text is matched by backend/src/services/employeeImportService.js ("*" and "(...)" are ignored).
const COLUMNS: TemplateColumn[] = [
  { header: 'Name of employee *', width: 26, required: true, help: 'Full name of the employee.', example: 'Ramesh Kumar' },
  { header: 'Email *', width: 28, required: true, help: 'Must be unique for each employee in the same organization.', example: 'ramesh.kumar@example.com' },
  { header: 'Phone number', width: 18, text: true, help: 'At least 7 digits. Country code is optional.', example: '+91 98765 43210' },
  { header: "Father's / Mother's name", width: 24, help: 'Shown on the attendance and wage registers.', example: 'Suresh Kumar' },
  { header: 'Date of birth (DD-MM-YYYY)', width: 18, text: true, help: 'Day-month-year, for example 15-08-1990.', example: '15-08-1990' },
  { header: 'Home address', width: 32, help: 'Street, city, district, postal code.', example: '12 MG Road, Ahmedabad 380001' },
  { header: 'Designation', width: 18, list: 'designation', help: 'Pick from the dropdown. The list comes from Settings > Master data.', example: 'Cook' },
  { header: 'Type of employment', width: 22, list: 'employmentType', help: 'Pick from the dropdown.', example: 'Regular' },
  { header: 'Category of skill', width: 18, list: 'skillCategory', help: 'Pick from the dropdown.', example: 'Skilled' },
  { header: 'Date of joining (DD-MM-YYYY)', width: 18, text: true, help: 'Day-month-year, for example 01-04-2026.', example: '01-04-2026' },
  { header: 'Account status', width: 14, list: STATUS, help: 'Active or Inactive. Leave blank for Active.', example: 'Active' },
  { header: 'Wages / Basic pay', width: 16, number: true, help: 'Daily amount in numbers only. Leave blank for 0.', example: '450' },
  { header: 'Dearness allowance', width: 16, number: true, help: 'Daily amount in numbers only. Daily salary = Basic pay + Dearness allowance.', example: '50' },
  { header: 'Currency', width: 10, list: CURRENCY, help: 'Leave blank for INR.', example: 'INR' },
  { header: 'Other allowances (including accommodation)', width: 30, help: 'Free text.', example: 'Accommodation provided' },
  { header: 'Aadhaar consent (Yes/No)', width: 16, list: YES_NO, help: 'Must be Yes before an Aadhaar number can be saved.', example: 'Yes' },
  { header: 'Aadhaar number', width: 16, text: true, help: '12 digits. Leave blank if consent is No.', example: '123412341234' },
  { header: 'Establishment LIN', width: 18, text: true, help: 'Optional.', example: '' },
  { header: 'UAN (if available)', width: 16, text: true, help: 'Optional PF Universal Account Number.', example: '' },
  { header: 'ESIC insurance number', width: 20, text: true, help: 'Optional.', example: '' },
  { header: 'EPFO applicable (Yes/No)', width: 16, list: YES_NO, help: 'Yes if provident fund deductions apply. Blank means No.', example: 'No' },
  { header: 'ESIC applicable (Yes/No)', width: 16, list: YES_NO, help: 'Yes if state insurance deductions apply. Blank means No.', example: 'No' },
  { header: 'Bank name', width: 20, help: 'Fill all five bank columns, or leave all five blank.', example: 'State Bank of India' },
  { header: 'Branch', width: 18, help: 'Bank branch.', example: 'Navrangpura' },
  { header: 'Account holder', width: 22, help: 'Name on the bank account.', example: 'Ramesh Kumar' },
  { header: 'Account number', width: 20, text: true, help: '4 to 34 letters or digits.', example: '00112233445566' },
  { header: 'IFSC / routing code', width: 16, text: true, help: '3 to 20 letters or digits.', example: 'SBIN0001234' },
  { header: 'Broad nature of duties', width: 28, help: 'Optional.', example: '' },
  { header: 'Maternity benefits (women employees)', width: 28, help: 'Optional.', example: '' },
  { header: 'Any other information', width: 28, help: 'Optional.', example: '' },
];

// A second, minimal example: only the commonly used columns are filled in.
const MINIMAL_EXAMPLE: Record<string, string> = {
  'Name of employee *': 'Sunita Patel',
  'Email *': 'sunita.patel@example.com',
  'Phone number': '9876501234',
  "Father's / Mother's name": 'Mahesh Patel',
  'Date of joining (DD-MM-YYYY)': '15-04-2026',
  'Account status': 'Active',
  'Wages / Basic pay': '400',
  'Aadhaar consent (Yes/No)': 'No',
};

function exampleValue(column: TemplateColumn, raw: string, lists: Record<string, string[]>, choice: number) {
  const options = column.list ? lists[column.list] : undefined;
  let value = raw;
  if (options && (column.list === 'designation' || column.list === 'employmentType' || column.list === 'skillCategory')) {
    value = options.includes(raw) ? raw : options[Math.min(choice, options.length - 1)] || '';
  }
  if (column.number && value) return Number(value);
  return value;
}

function columnName(index: number) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

export async function downloadEmployeeImportTemplate() {
  const [items, workbook] = await Promise.all([listMasterData({ status: 'active' }), createWorkbook()]);
  const lists: Record<string, string[]> = {
    designation: items.filter((item) => item.type === 'designation').map((item) => item.name),
    employmentType: items.filter((item) => item.type === 'employmentType').map((item) => item.name),
    skillCategory: items.filter((item) => item.type === 'skillCategory').map((item) => item.name),
    [STATUS]: ['Active', 'Inactive'],
    [YES_NO]: ['Yes', 'No'],
    [CURRENCY]: ['INR', 'NPR', 'USD', 'AED', 'EUR', 'GBP'],
  };

  const sheet = workbook.addWorksheet('Employees', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMNS.map(({ header, width }) => ({ header, width }));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  headerRow.height = 32;

  const examples = [
    COLUMNS.map((column) => exampleValue(column, column.example, lists, 0)),
    COLUMNS.map((column) => exampleValue(column, MINIMAL_EXAMPLE[column.header] || '', lists, 1)),
  ];
  examples.forEach((values) => {
    const row = sheet.addRow(values);
    row.font = { italic: true, color: { argb: 'FF718096' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  });

  const help = addRowsSheet(workbook, 'Help', [
    ['How to fill this employee Excel file'],
    [],
    ['1. Rows 2 and 3 of the "Employees" sheet (yellow, grey text) are EXAMPLES that show how to fill the sheet.'],
    ['   Ramesh Kumar has every column filled in. Sunita Patel has only the common columns, which is also fine.'],
    ['   Example rows use an @example.com email and are ignored on upload. You can keep them or delete them.'],
    ['2. Add your employees below the examples, one employee per row. Do not change or move the header row.'],
    ['3. Columns with a red header (marked *) are required. All other columns can be left blank.'],
    ['4. Use the dropdowns for Designation, Type of employment, Category of skill, Account status, Currency and Yes/No columns.'],
    ['5. Write dates as DD-MM-YYYY, for example 15-08-1990.'],
    ['6. Save the file, then go to Employees > Import from Excel and upload it.'],
    ['7. Rows with mistakes are skipped and listed with the reason. Fix only those rows and upload again. Rows already added will show "already exists".'],
    [`8. Up to ${FILL_ROWS} employees per file.`],
    [],
    ['Column', 'Required', 'What to enter', 'Example'],
    ...COLUMNS.map((column) => [column.header, column.required ? 'Yes' : 'No', column.help, column.example]),
  ], [40, 10, 70, 28]);
  help.getCell('A1').font = { bold: true, size: 14 };
  help.getRow(14).font = { bold: true };
  help.getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  const listNames = Object.keys(lists);
  const listSheet = workbook.addWorksheet('Lists');
  listNames.forEach((name, index) => {
    listSheet.getColumn(index + 1).width = 24;
    listSheet.getCell(1, index + 1).value = name;
    listSheet.getCell(1, index + 1).font = { bold: true };
    lists[name].forEach((value, row) => {
      listSheet.getCell(row + 2, index + 1).value = value;
    });
  });

  COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column.required ? 'FFC0392B' : 'FF2B6CB0' } };
    cell.note = column.help;
    if (column.text) sheet.getColumn(index + 1).numFmt = '@';

    if (!column.list) return;
    const values = lists[column.list];
    if (values.length === 0) return;
    const listColumn = columnName(listNames.indexOf(column.list));
    const validation: DataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Lists!$${listColumn}$2:$${listColumn}$${values.length + 1}`],
      showErrorMessage: true,
      errorTitle: column.header,
      error: 'Pick a value from the dropdown list.',
    };
    for (let row = 2; row <= FILL_ROWS + 1; row += 1) {
      sheet.getCell(row, index + 1).dataValidation = validation;
    }
  });

  await downloadWorkbook(workbook, 'employee-import-template.xlsx');
}
