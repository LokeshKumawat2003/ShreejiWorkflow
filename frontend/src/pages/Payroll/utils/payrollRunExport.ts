import type { LocationsPayrollResponse } from '../../../services/attendanceService';
import { addRowsSheet, addTableSheet, createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';
import { downloadSalarySlipsPdf } from './salarySlipPdf';

export type PayrollExportKind = 'pdf' | 'excel' | 'print';

async function exportExcel(payroll: LocationsPayrollResponse, reference: string) {
  const workbook = await createWorkbook();
  const payPeriod = `${payroll.fromDate} to ${payroll.toDate}`;
  addTableSheet(workbook, 'Payroll', [
    { header: 'Employee', width: 24, value: (line) => line.employeeName },
    { header: 'Organization', width: 24, value: (line) => line.organizationName },
    { header: 'Location', width: 24, value: (line) => line.locationName || '' },
    { header: 'Designation', width: 18, value: (line) => line.designation || '' },
    { header: 'Bank name', width: 20, value: (line) => line.bankName },
    { header: 'Branch', width: 18, value: (line) => line.bankBranch },
    { header: 'Account holder', width: 24, value: (line) => line.bankAccountHolder },
    { header: 'Account number', width: 20, value: (line) => line.bankAccountNumber },
    { header: 'IFSC', width: 16, value: (line) => line.bankRoutingCode },
    { header: 'Daily wage', width: 14, value: (line) => line.dailyWage ?? line.dailySalary },
    { header: 'Present', width: 10, value: (line) => line.presentDays },
    { header: 'Half days', width: 10, value: (line) => line.halfDays ?? 0 },
    { header: 'Absent', width: 10, value: (line) => line.absentDays },
    { header: 'Paid days', width: 12, value: (line) => line.paidDays },
    { header: 'Wages', width: 14, value: (line) => line.wages ?? line.grossPay },
    { header: 'Bonus', width: 12, value: (line) => line.bonus ?? 0 },
    { header: 'Total wages', width: 14, value: (line) => line.totalWages ?? line.grossPay },
    { header: 'EPF', width: 10, value: (line) => line.epf ?? 0 },
    { header: 'ESI', width: 10, value: (line) => line.esi ?? 0 },
    { header: 'Net payable', width: 16, value: (line) => line.netPay ?? line.grossPay },
  ], payroll.lines);

  addRowsSheet(workbook, 'Totals', [
    ['Reference', reference],
    ['Pay period', payPeriod],
    ['Employees', payroll.summary.employees],
    [],
    ['Currency', 'Total payable'],
    ...(payroll.netTotals ?? payroll.totals).map(({ currency, total }) => [currency, total]),
  ], [24, 30]);
  await downloadWorkbook(workbook, `payroll-${payroll.month}.xlsx`);
}

/** Excel payroll sheet, or salary slips as PDF / print. */
export async function exportPayrollRun(kind: PayrollExportKind, payroll: LocationsPayrollResponse, reference: string) {
  if (kind === 'excel') await exportExcel(payroll, reference);
  else await downloadSalarySlipsPdf(payroll.lines, payroll.fromDate, payroll.toDate, kind === 'print' ? 'print' : 'download');
}
