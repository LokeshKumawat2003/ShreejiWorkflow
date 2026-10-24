import type { PayrollLine } from '../../../services/attendanceService';
import { loadDocumentSettings } from '../../../services/settingsService';
import { finishPdf, type PdfAction } from '../../../utils/pdfOutput';
import { fitInto, loadSignatureImage } from './wageRegisterExport';

/** Percentages, e.g. 8.33 for 8.33%. */
export type SalarySlipRates = {
  bonusRate: number;
  washingAllowanceRate: number;
  epfRate: number;
  epfWageCeiling: number;
  esiRate: number;
};

function rateOf(value: string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatRate(value: number) {
  return String(Number(value.toFixed(2)));
}

export type SalarySlip = {
  employeeName: string;
  designation: string;
  monthYear: string;
  basic: number;
  bonus: number;
  washingAllowance: number;
  conveyance: number;
  totalAddition: number;
  providentFund: number;
  esi: number;
  foodCharge: number;
  houseRent: number;
  totalDeduction: number;
  netSalary: number;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
};

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function belowHundred(value: number) {
  if (value < 20) return ONES[value];
  return [TENS[Math.floor(value / 10)], ONES[value % 10].toLowerCase()].filter(Boolean).join(' ');
}

function belowThousand(value: number) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

export function rupeesInWords(amount: number) {
  let value = Math.round(amount);
  if (value === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000);
  value %= 10000000;
  const lakh = Math.floor(value / 100000);
  value %= 100000;
  const thousand = Math.floor(value / 1000);
  value %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (value) parts.push(belowThousand(value));
  return parts.join(' ');
}

export function salaryMonthYear(fromDate: string, toDate: string) {
  const format = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${name.toUpperCase()}-${year}`;
  };
  const from = format(fromDate);
  const to = format(toDate);
  return from === to ? to : `${from} TO ${to}`;
}

/** Mirrors the wage register (FORM XVII) so a slip and the register show the same figures. */
export function buildSalarySlip(line: PayrollLine, monthYear: string, rates: SalarySlipRates): SalarySlip {
  const dailyWage = line.dailySalary > 0 ? line.dailySalary : round2((line.basicPay || 0) + (line.dearnessAllowance || 0));
  const basic = round2(dailyWage * line.paidDays);
  const bonus = round2(basic * (rates.bonusRate / 100));
  const washingAllowance = round2(basic * (rates.washingAllowanceRate / 100));
  const conveyance = 0;
  const totalAddition = round2(basic + bonus + washingAllowance + conveyance);
  const epfBase = rates.epfWageCeiling > 0 ? Math.min(basic, rates.epfWageCeiling) : basic;
  const providentFund = line.epfoApplicable ? Math.round(epfBase * (rates.epfRate / 100)) : 0;
  const esi = line.esicApplicable ? Math.round(basic * (rates.esiRate / 100)) : 0;
  const foodCharge = 0;
  const houseRent = 0;
  const totalDeduction = round2(providentFund + esi + foodCharge + houseRent);

  return {
    employeeName: line.employeeName,
    designation: line.designation || line.jobTitle || '',
    monthYear,
    basic,
    bonus,
    washingAllowance,
    conveyance,
    totalAddition,
    providentFund,
    esi,
    foodCharge,
    houseRent,
    totalDeduction,
    netSalary: round2(totalAddition - totalDeduction),
    bankName: line.bankName,
    bankAccountNumber: line.bankAccountNumber,
    ifscCode: line.bankRoutingCode,
  };
}

const PAGE_WIDTH = 210;
const SLIP_HEIGHT = 148.5;
const FRAME_X = 10;
const FRAME_WIDTH = PAGE_WIDTH - FRAME_X * 2;
const LEFT = 20;
const TABLE_WIDTH = PAGE_WIDTH - LEFT * 2;

export async function downloadSalarySlipsPdf(lines: PayrollLine[], fromDate: string, toDate: string, action: PdfAction = 'download') {
  const [{ jsPDF }, { default: autoTable }, company, register] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadDocumentSettings('salary-slip'),
    loadDocumentSettings('wage-register'),
  ]);
  const rates: SalarySlipRates = {
    bonusRate: rateOf(register.bonusRate),
    washingAllowanceRate: rateOf(company.washingAllowanceRate),
    epfRate: rateOf(register.epfRate),
    epfWageCeiling: rateOf(register.epfWageCeiling),
    esiRate: rateOf(register.esiRate),
  };
  const signature = await loadSignatureImage(company.signatureImage);
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  const monthYear = salaryMonthYear(fromDate, toDate);
  const money = (value: number) => value.toFixed(2);

  pdf.setFont('times', 'bold');
  let nameFontSize = 17;
  pdf.setFontSize(nameFontSize);
  while (nameFontSize > 11 && pdf.getTextWidth(company.companyName) > FRAME_WIDTH - 10) {
    nameFontSize -= 0.5;
    pdf.setFontSize(nameFontSize);
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const addressText = company.address.replace(/\s*\n\s*/g, ' ').trim();
  const addressLines: string[] = addressText ? pdf.splitTextToSize(addressText, FRAME_WIDTH - 10).slice(0, 2) : [];
  const shift = Math.max(0, addressLines.length - 1) * 3.6 - (addressLines.length === 0 ? 5 : 0);

  lines.forEach((line, index) => {
    const slot = index % 2;
    if (index > 0 && slot === 0) pdf.addPage();
    const top = slot * SLIP_HEIGHT;
    const slip = buildSalarySlip(line, monthYear, rates);

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.4);
    pdf.rect(FRAME_X, top + 8, FRAME_WIDTH, SLIP_HEIGHT - 16);

    pdf.setTextColor(0);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(nameFontSize);
    pdf.text(company.companyName, PAGE_WIDTH / 2, top + 19, { align: 'center' });
    if (addressLines.length > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text(addressLines, PAGE_WIDTH / 2, top + 25, { align: 'center', lineHeightFactor: 1.2 });
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.text(company.title, PAGE_WIDTH / 2, top + 31 + shift, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Employee Name:- SH. ${slip.employeeName.toUpperCase()}`, LEFT + 2, top + 39 + shift);
    pdf.text(`Designation:- ${slip.designation.toUpperCase()}`, LEFT + 2, top + 45 + shift);
    const formLines = [company.formNumber, company.ruleReference].map((text) => text.trim());
    const formWidth = Math.max(...formLines.map((text) => pdf.getTextWidth(text)));
    formLines.forEach((text, lineIndex) => {
      if (text) pdf.text(text, PAGE_WIDTH - LEFT - 2 - formWidth, top + 39 + shift + lineIndex * 6);
    });
    pdf.text(`Month & Year:- ${slip.monthYear}`, PAGE_WIDTH / 2, top + 52 + shift, { align: 'center' });

    autoTable(pdf, {
      startY: top + 55 + shift,
      margin: { left: LEFT, right: LEFT },
      tableWidth: TABLE_WIDTH,
      theme: 'grid',
      head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
      body: [
        ['Basic & DA', money(slip.basic), `Provident Fund@${formatRate(rates.epfRate)}%`, money(slip.providentFund)],
        [`Bonus @${formatRate(rates.bonusRate)}%`, money(slip.bonus), `E.S.I.@${formatRate(rates.esiRate)}%`, money(slip.esi)],
        [`Washing allowance@${formatRate(rates.washingAllowanceRate)}%`, money(slip.washingAllowance), 'Food Charge', String(slip.foodCharge)],
        ['Conveyance', money(slip.conveyance), 'House Rent', String(slip.houseRent)],
        ['Total Addition', money(slip.totalAddition), 'Total Deduction', money(slip.totalDeduction)],
        ['', '', 'NET Salary', money(slip.netSalary)],
      ],
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 },
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.25,
      },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 9.5 },
      columnStyles: {
        0: { cellWidth: TABLE_WIDTH * 0.3 },
        1: { cellWidth: TABLE_WIDTH * 0.2, halign: 'right' },
        2: { cellWidth: TABLE_WIDTH * 0.3 },
        3: { cellWidth: TABLE_WIDTH * 0.2, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 1 || data.column.index === 3)) data.cell.styles.halign = 'right';
        if (data.section === 'body' && data.row.index >= 4) data.cell.styles.fontStyle = 'bold';
      },
    });

    const tableEnd = (pdf as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? top + 100;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.text(`Rupees : ${rupeesInWords(slip.netSalary)} Rupees Only`, LEFT, tableEnd + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`Name of Bank:-${slip.bankName}`, LEFT + 2, tableEnd + 13);
    pdf.text(`Bank A/C No.:-${slip.bankAccountNumber}`, PAGE_WIDTH / 2 + 10, tableEnd + 15);
    pdf.text(`IFSC Code:-${slip.ifscCode}`, LEFT + 2, tableEnd + 19);

    const signY = top + SLIP_HEIGHT - 14;
    const signatoryWidth = company.signatoryLabel ? pdf.getTextWidth(company.signatoryLabel) + 2 : 0;
    if (company.signatoryLabel) pdf.text(company.signatoryLabel, PAGE_WIDTH / 2 + 10, signY);
    const lineStart = PAGE_WIDTH / 2 + 10 + signatoryWidth;
    if (signature) {
      const fitted = fitInto(signature, Math.min(40, PAGE_WIDTH - LEFT - lineStart), 14);
      const imageX = (lineStart + PAGE_WIDTH - LEFT) / 2 - fitted.width / 2;
      pdf.addImage(signature.dataUrl, signature.format.toUpperCase(), imageX, signY - fitted.height, fitted.width, fitted.height);
    }
    pdf.setLineWidth(0.2);
    pdf.line(lineStart, signY + 0.5, PAGE_WIDTH - LEFT, signY + 0.5);

    if (slot === 0 && index < lines.length - 1) {
      pdf.setLineDashPattern([1.5, 1.5], 0);
      pdf.setDrawColor(150);
      pdf.line(4, SLIP_HEIGHT, PAGE_WIDTH - 4, SLIP_HEIGHT);
      pdf.setLineDashPattern([], 0);
      pdf.setDrawColor(0);
    }
  });

  finishPdf(pdf, `salary-slips-${fromDate}-to-${toDate}.pdf`, action);
}
