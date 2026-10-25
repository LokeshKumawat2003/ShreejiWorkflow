import type { AttendanceRegister, AttendanceRegisterRow } from '../../../services/attendanceService';
import { addRowsSheet, createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';
import { finishPdf, type PdfAction } from '../../../utils/pdfOutput';

const TITLE = 'Register of Attendance';
const SUBTITLE = '(rule 78 (1) (a) (i)) FORM XVI';

function workLine(register: AttendanceRegister) {
  const { workName, name } = register.location;
  return [workName, name].filter(Boolean).join(' at ').toUpperCase();
}

function contractorLine(register: AttendanceRegister) {
  return `Name of Contractor :- ${register.contractor.name}, ${register.contractor.address}`;
}

function loaLine(register: AttendanceRegister) {
  return `PO No :- ${register.location.opNumber || '—'}`;
}

function siteLine(register: AttendanceRegister) {
  return `Site Name :- ${(register.location.address || register.location.name || '—').toUpperCase()}`;
}

function periodLine(register: AttendanceRegister) {
  return `Period :- ${register.periodLabel}`;
}

function parentLine(row: AttendanceRegisterRow) {
  return row.parentName ? `S/O. ${row.parentName.toUpperCase()}` : '';
}

function fileBaseName(register: AttendanceRegister) {
  const slug = (register.location.name || 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `attendance-register-${slug || 'location'}-${register.month}`;
}

function dayNumbers(register: AttendanceRegister) {
  return Array.from({ length: register.daysInMonth }, (_, index) => index + 1);
}

export async function exportRegisterPdf(register: AttendanceRegister, action: PdfAction = 'download') {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 8;
  const days = dayNumbers(register);

  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text(TITLE, pageWidth / 2, 12, { align: 'center' });
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(SUBTITLE, pageWidth / 2, 17, { align: 'center' });
  document.setFont('helvetica', 'bold');
  document.setFontSize(10);
  const work = workLine(register);
  if (work) {
    document.text(work, pageWidth / 2, 23, { align: 'center' });
    const workWidth = document.getTextWidth(work);
    document.line(pageWidth / 2 - workWidth / 2, 24, pageWidth / 2 + workWidth / 2, 24);
  }
  document.setFontSize(9);
  document.text(contractorLine(register), margin, 30);
  document.text(periodLine(register), pageWidth - margin, 30, { align: 'right' });
  document.text(loaLine(register), margin, 35);
  document.text(siteLine(register), pageWidth - margin, 35, { align: 'right' });

  const fixedWidth = 8 + 44 + 18 + 13;
  const dayWidth = (pageWidth - margin * 2 - fixedWidth) / days.length;
  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' }> = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 44, halign: 'left' },
    2: { cellWidth: 18, halign: 'center' },
  };
  days.forEach((_, index) => {
    columnStyles[3 + index] = { cellWidth: dayWidth, halign: 'center' };
  });
  columnStyles[3 + days.length] = { cellWidth: 13, halign: 'center' };

  autoTable(document, {
    startY: 39,
    margin: { left: margin, right: margin },
    head: [['S.no', 'Name of Employees', 'category', ...days.map(String), 'TOTAL\nPRESENT']],
    body: [
      ...register.rows.map((row) => [
        String(row.serial),
        [row.name.toUpperCase(), parentLine(row)].filter(Boolean).join('\n'),
        row.skillCategory,
        ...row.days,
        String(row.totalPresent),
      ]),
      [
        {
          content: 'Total Mandays',
          colSpan: 3 + days.length,
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        { content: String(register.totalMandays), styles: { fontStyle: 'bold', halign: 'center' } },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1,
      lineColor: [60, 60, 60],
      lineWidth: 0.15,
      textColor: [20, 20, 20],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [20, 20, 20],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles,
    didParseCell(data) {
      if (data.section !== 'body') return;
      const value = String(data.cell.raw ?? '');
      if (value === 'A') data.cell.styles.textColor = [200, 30, 30];
    },
  });

  const tableEnd = (document as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  let footerY = tableEnd + 18;
  if (footerY > pageHeight - 12) {
    document.addPage();
    footerY = 30;
  }
  document.setFont('helvetica', 'bold');
  document.setFontSize(9);
  document.text(`FOR:- ${register.contractor.signatory}`, margin + 4, footerY);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text('MANAGER/PROPRIETOR', margin + 4, footerY + 5);

  finishPdf(document, `${fileBaseName(register)}.pdf`, action);
}

export async function exportRegisterExcel(register: AttendanceRegister) {
  const workbook = await createWorkbook();
  const days = dayNumbers(register);
  const lastColumn = 3 + days.length;
  const splitColumn = Math.max(4, lastColumn - 12);
  const blankRow = () => Array.from({ length: lastColumn + 1 }, () => '' as string | number);

  function splitRow(left: string, right: string) {
    const row = blankRow();
    row[0] = left;
    row[splitColumn] = right;
    return row;
  }

  function singleRow(text: string) {
    const row = blankRow();
    row[0] = text;
    return row;
  }

  const header = ['S.no', 'Name of Employees', 'category', ...days, 'TOTAL PRESENT'];
  const body = register.rows.map((row) => [
    row.serial,
    [row.name.toUpperCase(), parentLine(row)].filter(Boolean).join(' '),
    row.skillCategory,
    ...row.days,
    row.totalPresent,
  ]);
  const totalRow = blankRow();
  totalRow[1] = 'Total Mandays';
  totalRow[lastColumn] = register.totalMandays;

  const headerIndex = 6;
  const totalIndex = headerIndex + 1 + body.length;
  const aoa = [
    singleRow(TITLE),
    singleRow(SUBTITLE),
    singleRow(workLine(register)),
    splitRow(contractorLine(register), periodLine(register)),
    splitRow(loaLine(register), siteLine(register)),
    blankRow(),
    header,
    ...body,
    totalRow,
    blankRow(),
    blankRow(),
    singleRow(`FOR:- ${register.contractor.signatory}`),
    singleRow('MANAGER/PROPRIETOR'),
  ];

  const sheet = addRowsSheet(workbook, 'Form XVI', aoa, [5, 38, 13, ...days.map(() => 3.5), 9]);
  const merge = (row: number, startColumn: number, endColumn: number) => {
    sheet.mergeCells(row + 1, startColumn + 1, row + 1, endColumn + 1);
  };
  merge(0, 0, lastColumn);
  merge(1, 0, lastColumn);
  merge(2, 0, lastColumn);
  merge(3, 0, splitColumn - 1);
  merge(3, splitColumn, lastColumn);
  merge(4, 0, splitColumn - 1);
  merge(4, splitColumn, lastColumn);
  merge(totalIndex, 1, lastColumn - 1);

  await downloadWorkbook(workbook, `${fileBaseName(register)}.xlsx`);
}
