import { downloadSalarySlipsPdf } from '../../pages/Payroll/utils/salarySlipPdf';
import { exportWageRegisterExcel, exportWageRegisterPdf } from '../../pages/Payroll/utils/wageRegisterExport';
import { exportRegisterExcel, exportRegisterPdf } from '../../pages/Attendance/utils/attendanceRegisterExport';
import type { AssistantDocument } from '../../services/assistantService';
import { exportBankLetterExcel, exportBankLetterPdf, type BankLetterDetails } from '../../pages/BankInvoice/utils/bankLetterExport';
import {
  getAttendanceRegister,
  getBankInvoiceBatch,
  getBankInvoiceLocations,
  getBankPayments,
  getPayroll,
  getPayrollRun,
  getWageRegister,
  logBankInvoiceActivity,
  logPayrollRunActivity,
  type PayrollResponse,
} from '../../services/attendanceService';
import { exportPayrollRun } from '../../pages/Payroll/utils/payrollRunExport';
import { computeTotals } from '../../pages/Invoice/utils/invoiceDocument';
import { exportInvoiceExcel, exportInvoicePdf } from '../../pages/Invoice/utils/invoiceExport';
import { getInvoicePreview, logInvoiceActivity } from '../../services/invoiceService';
import { addRowsSheet, addTableSheet, createWorkbook, downloadWorkbook } from '../../utils/excelOutput';
import { finishPdf } from '../../utils/pdfOutput';

export class EmptyDocumentError extends Error {}

function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { fromDate: `${month}-01`, toDate: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';
}

async function payrollExcel(payroll: PayrollResponse, title: string, fileName: string) {
  const workbook = await createWorkbook();
  addTableSheet(workbook, 'Payroll', [
    { header: 'Employee', width: 24, value: (line) => line.employeeName },
    { header: 'Organization', width: 24, value: (line) => line.organizationName },
    { header: 'Designation', width: 18, value: (line) => line.designation || '' },
    { header: 'Bank name', width: 20, value: (line) => line.bankName },
    { header: 'Account number', width: 20, value: (line) => line.bankAccountNumber },
    { header: 'IFSC', width: 16, value: (line) => line.bankRoutingCode },
    { header: 'Daily wage', width: 14, value: (line) => line.dailyWage ?? line.dailySalary },
    { header: 'Present', width: 10, value: (line) => line.presentDays },
    { header: 'Half days', width: 10, value: (line) => line.halfDays ?? 0 },
    { header: 'Absent', width: 10, value: (line) => line.absentDays },
    { header: 'Paid days', width: 12, value: (line) => line.paidDays },
    { header: 'Overtime hours', width: 14, value: (line) => line.overtimeHours ?? 0 },
    { header: 'Wages', width: 14, value: (line) => line.wages ?? line.grossPay },
    { header: 'Bonus', width: 12, value: (line) => line.bonus ?? 0 },
    { header: 'Total wages', width: 14, value: (line) => line.totalWages ?? line.grossPay },
    { header: 'EPF', width: 10, value: (line) => line.epf ?? 0 },
    { header: 'ESI', width: 10, value: (line) => line.esi ?? 0 },
    { header: 'Net payable', width: 16, value: (line) => line.netPay ?? line.grossPay },
  ], payroll.lines);
  addRowsSheet(workbook, 'Totals', [
    ['Report', title],
    ['Pay period', `${payroll.fromDate} to ${payroll.toDate}`],
    ['Employees', payroll.summary.employees],
    [],
    ['Currency', 'Total payable'],
    ...(payroll.netTotals ?? payroll.totals).map(({ currency, total }) => [currency, total]),
  ], [24, 40]);
  await downloadWorkbook(workbook, fileName);
}

async function payrollPdf(payroll: PayrollResponse, title: string, fileName: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const money = (value: number | undefined) => (value ?? 0).toFixed(2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Pay period: ${payroll.fromDate} to ${payroll.toDate}   ·   Employees: ${payroll.summary.employees}`, pageWidth / 2, 20, { align: 'center' });

  const totals = payroll.lines.reduce((sum, line) => ({
    paidDays: sum.paidDays + line.paidDays,
    wages: sum.wages + (line.wages ?? line.grossPay),
    bonus: sum.bonus + (line.bonus ?? 0),
    epf: sum.epf + (line.epf ?? 0),
    esi: sum.esi + (line.esi ?? 0),
    net: sum.net + (line.netPay ?? line.grossPay),
  }), { paidDays: 0, wages: 0, bonus: 0, epf: 0, esi: 0, net: 0 });

  autoTable(doc, {
    startY: 25,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    head: [['S.no', 'Employee', 'Organization', 'Designation', 'Daily wage', 'Present', 'Absent', 'Paid days', 'Wages', 'Bonus', 'EPF', 'ESI', 'Net payable']],
    body: payroll.lines.map((line, index) => [
      String(index + 1),
      line.employeeName,
      line.organizationName,
      line.designation || '',
      money(line.dailyWage ?? line.dailySalary),
      String(line.presentDays),
      String(line.absentDays),
      String(line.paidDays),
      money(line.wages ?? line.grossPay),
      money(line.bonus),
      money(line.epf),
      money(line.esi),
      money(line.netPay ?? line.grossPay),
    ]),
    foot: [['', 'TOTAL', '', '', '', '', '', String(totals.paidDays), money(totals.wages), money(totals.bonus), money(totals.epf), money(totals.esi), money(totals.net)]],
    showFoot: 'lastPage',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, textColor: 20, lineColor: 120, lineWidth: 0.15 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [238, 242, 255], textColor: 20, fontStyle: 'bold' },
    columnStyles: Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((index) => [index, { halign: 'right' as const }])),
  });
  finishPdf(doc, fileName);
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function bankLetter(details: BankLetterDetails, format: AssistantDocument['format']) {
  if (format === 'excel') await exportBankLetterExcel(details);
  else await exportBankLetterPdf(details, 'download');
}

/** A saved batch is re-read so the letter matches the printed one; a single person's letter is not saved. */
async function downloadBankInvoice(document: AssistantDocument) {
  const { format, month, locationId, employeeIds, batchId, reprint } = document;
  if (batchId) {
    const result = await getBankInvoiceBatch(batchId);
    await bankLetter({
      letter: result.letter,
      reference: result.batch.reference,
      date: result.batch.letterDate,
      chequeNumber: result.batch.chequeNumber,
      rows: result.rows,
      month: result.month,
    }, format);
    if (reprint) await logBankInvoiceActivity(batchId, format);
    return;
  }
  if (!locationId) throw new Error('Location is required for this document.');
  const [payments, locations] = await Promise.all([getBankPayments({ month, locationIds: [locationId] }), getBankInvoiceLocations(month)]);
  const rows = payments.rows
    .filter((row) => !employeeIds || employeeIds.includes(row.employeeId))
    .map((row, index) => ({ ...row, serial: index + 1 }));
  if (rows.length === 0) throw new EmptyDocumentError('इस महीने कोई payment नहीं बनता।');
  await bankLetter({
    letter: payments.letter,
    reference: `${payments.referencePrefix} ${locations.nextReference}`,
    date: localToday(),
    chequeNumber: '',
    rows,
    month: payments.month,
  }, format);
}

/** Prints the saved invoice exactly as on the location's invoice page. */
async function downloadClientInvoice(document: AssistantDocument) {
  const { format, month, organizationId, locationId } = document;
  if (!organizationId || !locationId) throw new Error('Location is required for this document.');
  const preview = await getInvoicePreview(organizationId, locationId, month);
  const { invoice, setup, settings, period } = preview;
  if (!invoice) throw new EmptyDocumentError('यह invoice अभी save नहीं हुआ है।');
  const exportDocument = {
    settings,
    period,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    raBillNo: invoice.raBillNo,
    partyName: settings.partyName,
    vendorCode: setup.vendorCode || settings.vendorCode,
    workTitle: setup.workTitle || setup.defaultWorkTitle,
    loaNumber: setup.loaNumber || setup.defaultLoaNumber,
    loaDate: setup.loaDate,
    sapPo: setup.sapPo || setup.defaultSapPo,
    billToNote: setup.billToNote,
    gstLabel: setup.gstLabel,
    gstRate: setup.gstRate,
    items: invoice.items,
    ...computeTotals(invoice.items, setup.gstRate),
  };
  if (format === 'excel') await exportInvoiceExcel(exportDocument);
  else await exportInvoicePdf(exportDocument, 'download');
  await logInvoiceActivity(organizationId, locationId, invoice.id, format).catch(() => null);
}

/** Fetches the data for a document the assistant planned and downloads it with the dashboard's own exporters. */
export async function downloadAssistantDocument(document: AssistantDocument) {
  const { type, format, month, organizationId, locationId, employeeIds, title } = document;
  const { fromDate, toDate } = monthRange(month);

  if (type === 'bank_invoice') {
    await downloadBankInvoice(document);
    return;
  }

  if (type === 'client_invoice') {
    await downloadClientInvoice(document);
    return;
  }

  if (type === 'payroll_run') {
    if (!document.batchId) throw new Error('Payroll run not found.');
    const result = await getPayrollRun(document.batchId);
    if (result.payroll.lines.length === 0) throw new EmptyDocumentError('इस payroll में कोई employee नहीं है।');
    await exportPayrollRun(format, result.payroll, result.batch.reference);
    if (document.reprint) await logPayrollRunActivity(document.batchId, format);
    return;
  }

  if (type === 'salary_slip' || type === 'payroll') {
    const payroll = await getPayroll({
      fromDate,
      toDate,
      ...(organizationId ? { organizationId } : {}),
      ...(locationId && !employeeIds ? { locationId } : {}),
      ...(employeeIds ? { employeeIds } : {}),
    });
    if (payroll.lines.length === 0) throw new EmptyDocumentError('इस महीने के लिए कोई attendance/payroll data नहीं मिला।');
    const fileBase = `${type === 'salary_slip' ? 'salary-slips' : 'payroll'}-${slug(title.split(' · ')[1] ?? '')}-${month}`;
    if (type === 'salary_slip' && format === 'pdf') await downloadSalarySlipsPdf(payroll.lines, fromDate, toDate);
    else if (format === 'excel') await payrollExcel(payroll, title, `${fileBase}.xlsx`);
    else await payrollPdf(payroll, title, `${fileBase}.pdf`);
    return;
  }

  if (!organizationId || !locationId) throw new Error('Location is required for this document.');

  if (type === 'wage_register') {
    const register = await getWageRegister({ organizationId, locationId, month });
    if (register.rows.length === 0) throw new EmptyDocumentError('इस location पर इस महीने कोई wage data नहीं मिला।');
    if (format === 'excel') await exportWageRegisterExcel(register);
    else await exportWageRegisterPdf(register);
    return;
  }

  const register = await getAttendanceRegister({ organizationId, locationId, month });
  const rows = employeeIds ? register.rows.filter((row) => employeeIds.includes(row.employeeId)) : register.rows;
  if (rows.length === 0) throw new EmptyDocumentError('इस महीने का कोई attendance record नहीं मिला।');
  const filtered = employeeIds
    ? {
      ...register,
      rows: rows.map((row, index) => ({ ...row, serial: index + 1 })),
      totalMandays: rows.reduce((sum, row) => sum + row.totalPresent, 0),
    }
    : register;
  const options = employeeIds ? { filePrefix: `attendance-${slug(rows[0].name)}` } : {};
  if (format === 'excel') await exportRegisterExcel(filtered, options);
  else await exportRegisterPdf(filtered, 'download', options);
}
