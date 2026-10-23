import type { BankPaymentRow } from '../../../services/attendanceService';
import type { BankLetterSettings } from '../../../services/settingsService';
import { fitInto, loadSignatureImage } from '../../Payroll/utils/wageRegisterExport';

export type BankLetterDetails = {
	letter: BankLetterSettings;
	reference: string;
	date: string;
	chequeNumber: string;
	rows: BankPaymentRow[];
	month: string;
};

export function bankLetterSubject(letter: Pick<BankLetterSettings, 'subject' | 'accountNumber'>) {
	return letter.subject.replace(/\{account\}/gi, letter.accountNumber);
}

/** yyyy-mm-dd → dd-mm-yyyy, as printed on the letter. */
export function formatLetterDate(value: string) {
	const [year, month, day] = value.split('-');
	return year && month && day ? `${day}-${month}-${year}` : value;
}

function letterCells(row: BankPaymentRow, index: number) {
	return [
		String(index + 1),
		row.employeeName.toUpperCase(),
		row.accountNumber,
		row.ifsc.toUpperCase(),
		row.bankName.toUpperCase(),
		String(row.amount),
	];
}

function letterTotal(rows: BankPaymentRow[]) {
	return rows.reduce((sum, row) => sum + row.amount, 0);
}

function fileName(details: BankLetterDetails, extension: string) {
	return `bank-payment-letter-${details.month}.${extension}`;
}

function addressLines(letter: BankLetterSettings) {
	const lines = letter.address.split('\n').map((line) => line.trim()).filter(Boolean);
	if (letter.phone) {
		if (lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} Mob:-${letter.phone}`;
		else lines.push(`Mob:-${letter.phone}`);
	}
	return lines;
}

function signatureLines(letter: BankLetterSettings) {
	return [
		letter.signatoryName ? `( ${letter.signatoryName} )` : '',
		letter.signatoryCompany,
		letter.signatoryTitle,
		letter.signatoryPhone ? `Mob.${letter.signatoryPhone}` : '',
	].filter(Boolean);
}

export async function exportBankLetterPdf(details: BankLetterDetails) {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
	const { letter } = details;
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 14;
	const center = pageWidth / 2;
	let y = 18;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(19);
	doc.text(letter.companyName, center, y, { align: 'center' });
	y += 6.5;
	doc.setFontSize(10.5);
	addressLines(letter).forEach((line) => {
		doc.text(doc.splitTextToSize(line, pageWidth - margin * 2) as string[], center, y, { align: 'center' });
		y += 5;
	});
	if (letter.email) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.text(`Mail to -${letter.email}`, center, y, { align: 'center' });
		y += 3;
	}
	doc.setLineWidth(0.5);
	doc.setLineDashPattern([1.2, 0.8], 0);
	doc.line(margin, y, pageWidth - margin, y);
	doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
	doc.setLineDashPattern([], 0);
	y += 7;

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9.5);
	doc.text(`Ref:- ${details.reference}`, margin, y);
	const dateText = `Date-${formatLetterDate(details.date)}`;
	doc.text(dateText, pageWidth - margin, y, { align: 'right' });
	doc.setLineWidth(0.25);
	doc.line(pageWidth - margin - doc.getTextWidth(dateText), y + 1, pageWidth - margin, y + 1);
	y += 6;

	['To,', ...letter.recipient.split('\n').map((line) => line.trim()).filter(Boolean)].forEach((line) => {
		doc.text(line, margin, y);
		y += 4.6;
	});
	y += 2;
	const subject = doc.splitTextToSize(`Sub :- ${bankLetterSubject(letter)}`, pageWidth - margin * 2) as string[];
	doc.text(subject, margin, y);
	y += subject.length * 4.6;

	autoTable(doc, {
		startY: y,
		margin: { left: margin, right: margin },
		theme: 'grid',
		body: details.rows.map(letterCells),
		foot: [['', '', '', '', 'TOTAL', String(letterTotal(details.rows))]],
		showFoot: 'lastPage',
		styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.4, textColor: 20, lineColor: 20, lineWidth: 0.2, valign: 'middle' },
		footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold' },
		columnStyles: {
			0: { halign: 'center', cellWidth: 10 },
			1: { cellWidth: 46 },
			2: { cellWidth: 36 },
			3: { cellWidth: 28 },
			4: { cellWidth: 42 },
			5: { halign: 'right' },
		},
		didParseCell: (data) => {
			if (data.section === 'foot' && data.column.index < 4) data.cell.styles.lineWidth = 0;
			if (data.section === 'foot' && data.column.index === 5) data.cell.styles.halign = 'right';
		},
	});

	y = ((doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
	if (y + 60 > pageHeight - margin) {
		doc.addPage();
		y = margin + 6;
	}
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9.5);
	if (details.chequeNumber.trim()) {
		doc.text(`CH. NO-${details.chequeNumber.trim()}`, margin + 10, y);
		y += 5;
	}
	doc.setFont('helvetica', 'normal');
	if (letter.requestLine) {
		doc.text(letter.requestLine, margin, y);
		y += 9;
	}
	if (letter.closing) {
		doc.text(letter.closing, margin, y);
		y += 4;
	}

	const signature = await loadSignatureImage(letter.signatureImage);
	if (signature) {
		const fitted = fitInto(signature, 45, 16);
		doc.addImage(signature.dataUrl, signature.format.toUpperCase(), margin, y + 1, fitted.width, fitted.height);
		y += 18;
	} else {
		y += 14;
	}
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	signatureLines(letter).forEach((line) => {
		doc.text(line, margin, y);
		y += 4.6;
	});

	doc.save(fileName(details, 'pdf'));
}

export async function exportBankLetterExcel(details: BankLetterDetails) {
	const { default: ExcelJS } = await import('exceljs');
	const { letter } = details;
	const workbook = new ExcelJS.Workbook();
	workbook.creator = letter.companyName;
	const sheet = workbook.addWorksheet('Bank letter', {
		pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
	});
	sheet.columns = [6, 26, 20, 16, 26, 12].map((width) => ({ width }));
	const lastColumn = 6;
	const font = (size: number, extra: Partial<import('exceljs').Font> = {}) => ({ name: 'Arial', size, ...extra });
	const thin = { style: 'thin' as const, color: { argb: 'FF1A1A1A' } };
	const border = { top: thin, left: thin, bottom: thin, right: thin };

	const line = (text: string, size: number, options: { bold?: boolean; align?: 'left' | 'center' | 'right'; underline?: boolean; from?: number; to?: number } = {}) => {
		const row = sheet.addRow([]);
		const from = options.from ?? 1;
		sheet.mergeCells(row.number, from, row.number, options.to ?? lastColumn);
		const cell = row.getCell(from);
		cell.value = text;
		cell.font = font(size, { bold: options.bold, underline: options.underline });
		cell.alignment = { horizontal: options.align ?? 'left', vertical: 'middle', wrapText: true };
		return row;
	};

	line(letter.companyName, 18, { bold: true, align: 'center' }).height = 28;
	addressLines(letter).forEach((text) => line(text, 10.5, { bold: true, align: 'center' }));
	if (letter.email) line(`Mail to -${letter.email}`, 9, { align: 'center' });
	const rule = sheet.addRow([]);
	for (let column = 1; column <= lastColumn; column += 1) rule.getCell(column).border = { bottom: { style: 'double', color: { argb: 'FF1A1A1A' } } };
	sheet.addRow([]);

	const refRow = sheet.addRow([]);
	sheet.mergeCells(refRow.number, 1, refRow.number, 4);
	sheet.mergeCells(refRow.number, 5, refRow.number, lastColumn);
	Object.assign(refRow.getCell(1), { value: `Ref:- ${details.reference}`, font: font(10, { bold: true }) });
	Object.assign(refRow.getCell(5), { value: `Date-${formatLetterDate(details.date)}`, font: font(10, { bold: true, underline: true }), alignment: { horizontal: 'right' } });

	['To,', ...letter.recipient.split('\n').map((text) => text.trim()).filter(Boolean)].forEach((text) => line(text, 10, { bold: true }));
	line(`Sub :- ${bankLetterSubject(letter)}`, 10, { bold: true }).height = 30;

	details.rows.forEach((item, index) => {
		const row = sheet.addRow([index + 1, item.employeeName.toUpperCase(), item.accountNumber, item.ifsc.toUpperCase(), item.bankName.toUpperCase(), item.amount]);
		row.eachCell({ includeEmpty: true }, (cell, column) => {
			cell.font = font(10);
			cell.border = border;
			cell.numFmt = column === 3 ? '@' : column === 6 ? '0' : 'General';
			cell.alignment = { horizontal: column === 1 ? 'center' : column === 6 ? 'right' : 'left', vertical: 'middle' };
		});
	});
	const totalRow = sheet.addRow(['', '', '', '', 'TOTAL', letterTotal(details.rows)]);
	[5, 6].forEach((column) => {
		const cell = totalRow.getCell(column);
		cell.font = font(10, { bold: true });
		cell.border = border;
		cell.alignment = { horizontal: column === 6 ? 'right' : 'left', vertical: 'middle' };
	});

	sheet.addRow([]);
	if (details.chequeNumber.trim()) line(`CH. NO-${details.chequeNumber.trim()}`, 10, { bold: true });
	if (letter.requestLine) line(letter.requestLine, 10);
	sheet.addRow([]);
	if (letter.closing) line(letter.closing, 10);

	const signRows = [sheet.addRow([]), sheet.addRow([]), sheet.addRow([])];
	signRows.forEach((row) => { row.height = 18; });
	const signature = await loadSignatureImage(letter.signatureImage);
	if (signature) {
		const fitted = fitInto(signature, 200, 64);
		const imageId = workbook.addImage({ base64: signature.dataUrl, extension: signature.format });
		sheet.addImage(imageId, { tl: { col: 0.1, row: signRows[0].number - 1 + 0.1 }, ext: fitted, editAs: 'oneCell' });
	}
	signatureLines(letter).forEach((text) => line(text, 10, { bold: true }));

	const buffer = await workbook.xlsx.writeBuffer();
	const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName(details, 'xlsx');
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
