import type { CellInput, RowInput } from 'jspdf-autotable';
import { createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';
import { finishPdf, type PdfAction } from '../../../utils/pdfOutput';
import { fitInto, loadSignatureImage } from '../../Payroll/utils/wageRegisterExport';
import { headerLines, invoiceFileName, TABLE_HEADINGS, tableRows, type InvoiceDocument } from './invoiceDocument';

export async function exportInvoicePdf(invoice: InvoiceDocument, action: PdfAction = 'download') {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 18;
	const center = pageWidth / 2;
	const header = headerLines(invoice);
	const { rows, summary, words } = tableRows(invoice);
	let y = 22;

	const underlined = (value: string, size: number) => {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(size);
		doc.text(value, center, y, { align: 'center' });
		const width = doc.getTextWidth(value);
		doc.setLineWidth(0.3);
		doc.line(center - width / 2, y + 1, center + width / 2, y + 1);
	};
	const leftLine = (value: string, size = 9.5) => {
		if (!value) return;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(size);
		const lines = doc.splitTextToSize(value, pageWidth - margin * 2) as string[];
		doc.text(lines, margin, y);
		y += lines.length * 4.6 + 3;
	};

	underlined(header.title, 12);
	y += 8;
	underlined(header.invoiceLine, 9.5);
	y += 9;
	leftLine(header.party);
	y += 2;
	leftLine(header.work);
	leftLine(header.loa, 10.5);
	leftLine(header.period, 10.5);

	const bodyRows: RowInput[] = rows.map((row) => {
		const style = row.isBold ? { fontStyle: 'bold' as const } : {};
		return [
			{ content: row.serial, styles: style },
			{ content: row.description, styles: style },
			{ content: row.unit, styles: style },
			{ content: row.qty, styles: style },
			{ content: row.rate, styles: style },
			{ content: row.amount, styles: style },
		];
	});
	summary.forEach((line, index) => {
		const cells: CellInput[] = [];
		if (index === 0) cells.push({ content: words, colSpan: 2, rowSpan: summary.length, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 9 } });
		cells.push({ content: line.label, colSpan: 3, styles: { halign: 'center', fontStyle: line.isFinal ? 'bold' : 'normal' } });
		cells.push({ content: line.amount, styles: { halign: 'right', fontStyle: 'bold' } });
		bodyRows.push(cells);
	});

	autoTable(doc, {
		startY: y,
		margin: { left: margin, right: margin },
		theme: 'grid',
		head: [TABLE_HEADINGS],
		body: bodyRows,
		styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.4, textColor: 20, lineColor: 20, lineWidth: 0.25, valign: 'middle', overflow: 'linebreak' },
		headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'normal', halign: 'center' },
		columnStyles: {
			0: { halign: 'center', cellWidth: 13 },
			1: { cellWidth: 72 },
			2: { halign: 'center', cellWidth: 18 },
			3: { halign: 'center', cellWidth: 18 },
			4: { halign: 'center', cellWidth: 24 },
			5: { halign: 'right', cellWidth: 29 },
		},
	});

	y = ((doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
	if (y + 45 > pageHeight - margin) {
		doc.addPage();
		y = margin + 6;
	}
	const right = pageWidth - margin;
	const { signatoryCompany, signatoryTitle, signatureImage } = invoice.settings;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	if (signatoryCompany) doc.text(signatoryCompany, right, y, { align: 'right' });
	const signature = await loadSignatureImage(signatureImage);
	if (signature) {
		const fitted = fitInto(signature, 40, 26);
		doc.addImage(signature.dataUrl, signature.format.toUpperCase(), right - fitted.width - 4, y + 2, fitted.width, fitted.height);
	}
	if (invoice.billToNote) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10);
		doc.text(invoice.billToNote, margin, y + 22);
	}
	if (signatoryTitle) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.text(signatoryTitle, right - 4, y + 30, { align: 'right' });
	}

	finishPdf(doc, invoiceFileName(invoice, 'pdf'), action);
}

export async function exportInvoiceExcel(invoice: InvoiceDocument) {
	const workbook = await createWorkbook();
	workbook.creator = invoice.settings.signatoryCompany || 'Invoice';
	const sheet = workbook.addWorksheet('Invoice breakup', {
		pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.6, right: 0.6, top: 0.7, bottom: 0.6, header: 0.3, footer: 0.3 } },
	});
	sheet.columns = [7, 50, 10, 10, 12, 15].map((width) => ({ width }));
	const lastColumn = 6;
	const header = headerLines(invoice);
	const { rows, summary, words } = tableRows(invoice);
	const font = (size: number, extra: Partial<import('exceljs').Font> = {}) => ({ name: 'Arial', size, ...extra });
	const thin = { style: 'thin' as const, color: { argb: 'FF1A1A1A' } };
	const border = { top: thin, left: thin, bottom: thin, right: thin };

	const line = (value: string, size: number, options: { bold?: boolean; underline?: boolean; align?: 'left' | 'center' } = {}) => {
		const row = sheet.addRow([]);
		sheet.mergeCells(row.number, 1, row.number, lastColumn);
		const cell = row.getCell(1);
		cell.value = value;
		cell.font = font(size, { bold: options.bold ?? true, underline: options.underline });
		cell.alignment = { horizontal: options.align ?? 'left', vertical: 'middle', wrapText: true };
		row.height = Math.max(18, Math.ceil(value.length / 90) * 15);
		return row;
	};

	line(header.title, 13, { underline: true, align: 'center' });
	sheet.addRow([]);
	line(header.invoiceLine, 10, { underline: true, align: 'center' });
	sheet.addRow([]);
	line(header.party, 10);
	sheet.addRow([]);
	line(header.work, 10);
	if (header.loa) line(header.loa, 11);
	line(header.period, 11);

	const headRow = sheet.addRow(TABLE_HEADINGS);
	headRow.eachCell((cell) => {
		cell.font = font(9);
		cell.border = border;
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
	});

	rows.forEach((item) => {
		const row = sheet.addRow([
			item.serial,
			item.description,
			item.unit,
			item.qty === '' ? '' : Number(item.qty),
			item.rate === '' ? '' : Number(item.rate),
			Number(item.amount),
		]);
		row.height = Math.max(18, item.description.split('\n').reduce((count, part) => count + Math.max(1, Math.ceil(part.length / 52)), 0) * 13);
		row.eachCell({ includeEmpty: true }, (cell, column) => {
			cell.font = font(9, { bold: item.isBold });
			cell.border = border;
			cell.alignment = { horizontal: column === 2 ? 'left' : column === 6 ? 'right' : 'center', vertical: 'middle', wrapText: column === 2 };
			if (column === 4 && item.qty !== '') cell.numFmt = item.qty.includes('.') ? `0.${'0'.repeat(item.qty.split('.')[1].length)}` : '0';
			if (column === 5 || column === 6) cell.numFmt = '0.00';
		});
	});

	const firstSummary = sheet.rowCount + 1;
	summary.forEach((item) => {
		const row = sheet.addRow(['', '', item.label, '', '', Number(item.amount)]);
		row.height = 20;
		sheet.mergeCells(row.number, 3, row.number, 5);
		[3, 6].forEach((column) => {
			const cell = row.getCell(column);
			cell.font = font(9, { bold: column === 6 || item.isFinal });
			cell.alignment = { horizontal: column === 6 ? 'right' : 'center', vertical: 'middle' };
			if (column === 6) cell.numFmt = '0.00';
		});
		for (let column = 1; column <= lastColumn; column += 1) row.getCell(column).border = border;
	});
	sheet.mergeCells(firstSummary, 1, firstSummary + summary.length - 1, 2);
	const wordsCell = sheet.getCell(firstSummary, 1);
	wordsCell.value = words;
	wordsCell.font = font(9, { bold: true });
	wordsCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
	wordsCell.border = border;

	sheet.addRow([]);
	const { signatoryCompany, signatoryTitle, signatureImage } = invoice.settings;
	const companyRow = sheet.addRow([]);
	sheet.mergeCells(companyRow.number, 4, companyRow.number, lastColumn);
	Object.assign(companyRow.getCell(4), { value: signatoryCompany, font: font(9), alignment: { horizontal: 'right' } });
	const signRows = [sheet.addRow([]), sheet.addRow([]), sheet.addRow([]), sheet.addRow([])];
	signRows.forEach((row) => { row.height = 18; });
	const signature = await loadSignatureImage(signatureImage);
	if (signature) {
		const fitted = fitInto(signature, 140, 90);
		const imageId = workbook.addImage({ base64: signature.dataUrl, extension: signature.format });
		sheet.addImage(imageId, { tl: { col: 4.2, row: signRows[0].number - 1 + 0.1 }, ext: fitted, editAs: 'oneCell' });
	}
	if (invoice.billToNote) {
		Object.assign(signRows[2].getCell(1), { value: invoice.billToNote, font: font(10, { bold: true }) });
	}
	const titleRow = sheet.addRow([]);
	sheet.mergeCells(titleRow.number, 4, titleRow.number, lastColumn);
	Object.assign(titleRow.getCell(4), { value: signatoryTitle, font: font(9), alignment: { horizontal: 'right' } });

	await downloadWorkbook(workbook, invoiceFileName(invoice, 'xlsx'));
}
