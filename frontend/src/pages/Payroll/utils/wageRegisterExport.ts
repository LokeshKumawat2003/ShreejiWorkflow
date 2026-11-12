import type { WageRegisterResponse, WageRegisterRow } from '../../../services/attendanceService';
import { createWorkbook, downloadWorkbook } from '../../../utils/excelOutput';
import { finishPdf, type PdfAction } from '../../../utils/pdfOutput';

export function formatRegisterNumber(value: number, decimals: 'auto' | 0 | 2 = 'auto') {
	if (decimals === 0) return String(Math.round(value));
	if (decimals === 2) return value.toFixed(2);
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatRate(value: number) {
	return String(Number(value.toFixed(2)));
}

type RegisterColumn = {
	title: string;
	letter: string;
	/** Excel column width and number formats for employee rows and the total row. */
	width: number;
	format: string;
	totalFormat: string;
	text: (row: WageRegisterRow) => string;
	value: (row: WageRegisterRow) => string | number;
	totalText: string;
	totalValue: string | number;
};

/** FORM XVII columns; the two overtime columns appear only when someone on the register has overtime. */
function registerColumns(register: WageRegisterResponse): RegisterColumn[] {
	const { bonusRate, epfRate, esiRate } = register.rates;
	const { totals } = register;
	const amount = (field: 'wages' | 'bonus' | 'totalWages' | 'epf' | 'esi' | 'grossPayment' | 'dailyWage', decimals: 'auto' | 0 | 2, totalDecimals: 'auto' | 0) => ({
		text: (row: WageRegisterRow) => formatRegisterNumber(row[field], decimals),
		value: (row: WageRegisterRow) => row[field],
		totalText: field === 'dailyWage' ? '' : formatRegisterNumber(totals[field], totalDecimals),
		totalValue: field === 'dailyWage' ? '' : totals[field],
	});
	const columns: RegisterColumn[] = [
		{ title: 'S.no.', letter: 'A', width: 7, format: '0', totalFormat: '@', text: (row) => String(row.serial), value: (row) => row.serial, totalText: '', totalValue: '' },
		{ title: 'Name of Employees', letter: 'B', width: 32, format: '@', totalFormat: '@', text: registerEmployeeName, value: registerEmployeeName, totalText: 'TOTAL', totalValue: 'TOTAL' },
		{ title: 'POST', letter: 'C', width: 14, format: '@', totalFormat: '@', text: (row) => row.post, value: (row) => row.post, totalText: '', totalValue: '' },
		{
			title: 'WORKING DAYS', letter: 'D', width: 10, format: '0', totalFormat: '0',
			text: (row) => String(row.workingDays), value: (row) => row.workingDays, totalText: String(totals.workingDays), totalValue: totals.workingDays,
		},
		{ title: 'WAGES (BASIC +DA)', letter: 'E', width: 12, format: 'General', totalFormat: '@', ...amount('dailyWage', 'auto', 'auto') },
		{ title: 'WAGES', letter: 'F', width: 11, format: 'General', totalFormat: 'General', ...amount('wages', 'auto', 'auto') },
	];
	if (totals.overtimeHours) {
		columns.push(
			{
				title: 'O.T. HOURS', letter: 'G', width: 9, format: 'General', totalFormat: 'General',
				text: (row) => (row.overtimeHours ? formatRegisterNumber(row.overtimeHours) : ''),
				value: (row) => row.overtimeHours || '',
				totalText: formatRegisterNumber(totals.overtimeHours),
				totalValue: totals.overtimeHours,
			},
			{
				title: 'O.T. WAGES', letter: 'G1', width: 11, format: '0.00', totalFormat: '0.00',
				text: (row) => (row.overtimeWages ? formatRegisterNumber(row.overtimeWages, 2) : ''),
				value: (row) => row.overtimeWages || '',
				totalText: formatRegisterNumber(totals.overtimeWages ?? 0, 2),
				totalValue: totals.overtimeWages ?? 0,
			},
		);
	}
	columns.push(
		{ title: `BONUS@${formatRate(bonusRate)}%`, letter: 'H', width: 13, format: '0.00', totalFormat: '0', ...amount('bonus', 2, 0) },
		{ title: 'TOTAL WAGES', letter: 'J', width: 13, format: '0.00', totalFormat: '0', ...amount('totalWages', 2, 0) },
		{ title: `DEDUCTION EPF${formatRate(epfRate)}%`, letter: 'K', width: 13, format: '0', totalFormat: '0', ...amount('epf', 0, 0) },
		{ title: `DEDUCTION ESI@${formatRate(esiRate)}%`, letter: 'L', width: 13, format: '0', totalFormat: '0', ...amount('esi', 0, 0) },
		{ title: 'GROSS PAYMENT IN RS.', letter: 'N', width: 14, format: '0', totalFormat: '0', ...amount('grossPayment', 0, 0) },
	);
	return columns;
}

export function registerEmployeeName(row: WageRegisterRow) {
	const name = row.employeeName.toUpperCase();
	return row.showParentName ? `${name}\nS/O. ${row.parentName.toUpperCase()}` : name;
}

export function registerContractLine(register: WageRegisterResponse) {
	const { workName, address } = register.header;
	return [workName, address].filter(Boolean).join(' at ');
}

export function registerPoLine(register: WageRegisterResponse) {
	const poNumber = register.header.opNumber.trim();
	return poNumber ? `PO No.- ${poNumber}` : '';
}

type SignatureImage = { dataUrl: string; format: 'png' | 'jpeg'; width: number; height: number };

function readAsDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function imageSize(dataUrl: string) {
	return new Promise<{ width: number; height: number } | null>((resolve) => {
		const image = new Image();
		image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
		image.onerror = () => resolve(null);
		image.src = dataUrl;
	});
}

/** Downloads the Cloudinary e-sign so it can be embedded; the export still works without it. */
export async function loadSignatureImage(url: string): Promise<SignatureImage | null> {
	if (!url) return null;
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const blob = await response.blob();
		const format = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpeg' : null;
		if (!format) return null;
		const dataUrl = await readAsDataUrl(blob);
		const size = await imageSize(dataUrl);
		return size ? { dataUrl, format, ...size } : null;
	} catch {
		return null;
	}
}

export function fitInto(size: { width: number; height: number }, maxWidth: number, maxHeight: number) {
	const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
	return { width: size.width * scale, height: size.height * scale };
}

function hasSignatureBlock(register: WageRegisterResponse) {
	const { signatoryCompany, signatoryTitle, signatureImage } = register.header;
	return Boolean(signatoryCompany?.trim() || signatoryTitle?.trim() || signatureImage);
}

function fileName(register: WageRegisterResponse, extension: string) {
	const site = (register.header.workName || 'location').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
	return `wage-register-${site}-${register.month}.${extension}`;
}

export async function exportWageRegisterPdf(register: WageRegisterResponse, action: PdfAction = 'download') {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
	const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
	const pageWidth = doc.internal.pageSize.getWidth();
	const margin = 12;
	const center = pageWidth / 2;
	let y = 14;

	const underlined = (text: string, x: number, top: number, size: number) => {
		doc.setFontSize(size);
		doc.text(text, x, top, { align: 'center' });
		const width = doc.getTextWidth(text);
		doc.setLineWidth(0.3);
		doc.line(x - width / 2, top + 1, x + width / 2, top + 1);
	};

	doc.setFont('helvetica', 'bold');
	underlined(register.header.title, center, y, 15);
	y += 6;
	if (register.header.formTitle) {
		doc.setFontSize(11);
		doc.text(register.header.formTitle, center, y, { align: 'center' });
		y += 6;
	}
	const contractLine = registerContractLine(register);
	if (contractLine) {
		const lines = doc.splitTextToSize(contractLine, pageWidth - margin * 2 - 40) as string[];
		lines.forEach((line) => {
			underlined(line, center, y, 10);
			y += 5;
		});
	}
	y += 1;
	doc.setFontSize(9.5);
	doc.text(`Name of Contractor :- ${register.header.contractorName}`, margin, y);
	doc.text(`Period- ${register.periodLabel}`, pageWidth - margin, y, { align: 'right' });
	y += 5;
	const poLine = registerPoLine(register);
	if (poLine) {
		doc.text(poLine, margin, y);
		y += 3;
	}

	const columns = registerColumns(register);
	autoTable(doc, {
		startY: y + 1,
		margin: { left: margin, right: margin },
		theme: 'grid',
		head: [
			columns.map((column) => column.title),
			columns.map((column) => column.letter),
		],
		body: register.rows.map((row) => columns.map((column) => column.text(row))),
		foot: [columns.map((column) => column.totalText)],
		showFoot: 'lastPage',
		styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, textColor: 20, lineColor: 20, lineWidth: 0.2, valign: 'middle' },
		headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
		footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center' },
		columnStyles: Object.fromEntries(columns.map((_, index) => [
			index,
			index === 0 ? { halign: 'center' as const, cellWidth: 12 } : index === 1 ? { cellWidth: 52 } : index === 2 ? { halign: 'center' as const, cellWidth: 26 } : { halign: 'center' as const },
		])),
	});

	const pageHeight = doc.internal.pageSize.getHeight();
	let cursor = ((doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;
	if (register.header.note) {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		const noteLines = doc.splitTextToSize(`Note:-${register.header.note}`, pageWidth - margin * 2) as string[];
		doc.text(noteLines, margin, cursor);
		cursor += noteLines.length * 4;
	}

	if (hasSignatureBlock(register)) {
		const { signatoryCompany, signatoryTitle, signatureImage } = register.header;
		const blockHeight = 32;
		if (cursor + blockHeight > pageHeight - margin) {
			doc.addPage();
			cursor = margin + 4;
		}
		const blockCenter = margin + 55;
		const imageTop = cursor + 2;
		const signature = await loadSignatureImage(signatureImage);
		if (signature) {
			const fitted = fitInto(signature, 50, 16);
			doc.addImage(signature.dataUrl, signature.format.toUpperCase(), blockCenter - fitted.width / 2, imageTop + 16 - fitted.height, fitted.width, fitted.height);
		}
		let lineY = imageTop + 22;
		doc.setFontSize(9.5);
		if (signatoryCompany?.trim()) {
			doc.setFont('helvetica', 'bold');
			doc.text(signatoryCompany.trim(), blockCenter, lineY, { align: 'center' });
			lineY += 5;
		}
		if (signatoryTitle?.trim()) {
			doc.setFont('helvetica', 'normal');
			doc.text(signatoryTitle.trim(), blockCenter, lineY, { align: 'center' });
		}
	}
	finishPdf(doc, fileName(register, 'pdf'), action);
}

export async function exportWageRegisterExcel(register: WageRegisterResponse) {
	const columns = registerColumns(register);
	const lastColumn = columns.length;
	const workbook = await createWorkbook();
	workbook.creator = register.header.contractorName;
	const sheet = workbook.addWorksheet('FORM XVII', {
		pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
	});
	sheet.columns = columns.map(({ width }) => ({ width }));

	const font = (size: number, extra: Partial<import('exceljs').Font> = {}) => ({ name: 'Times New Roman', size, ...extra });
	const thin = { style: 'thin' as const, color: { argb: 'FF1A1A1A' } };
	const border = { top: thin, left: thin, bottom: thin, right: thin };

	const banner = (text: string, size: number, options: { underline?: boolean; align?: 'left' | 'center' | 'right'; from?: number; to?: number } = {}) => {
		const row = sheet.addRow([]);
		const from = options.from ?? 1;
		const to = options.to ?? lastColumn;
		sheet.mergeCells(row.number, from, row.number, to);
		const cell = row.getCell(from);
		cell.value = text;
		cell.font = font(size, { bold: true, underline: options.underline });
		cell.alignment = { horizontal: options.align ?? 'center', vertical: 'middle', wrapText: true };
		return row;
	};

	banner(register.header.title, 16, { underline: true }).height = 24;
	if (register.header.formTitle) banner(register.header.formTitle, 12);
	const contractLine = registerContractLine(register);
	if (contractLine) banner(contractLine, 11, { underline: true }).height = 20;

	const infoRow = sheet.addRow([]);
	sheet.mergeCells(infoRow.number, 1, infoRow.number, lastColumn - 3);
	sheet.mergeCells(infoRow.number, lastColumn - 2, infoRow.number, lastColumn);
	Object.assign(infoRow.getCell(1), {
		value: `Name of Contractor :- ${register.header.contractorName}`,
		font: font(11, { bold: true }),
		alignment: { horizontal: 'left', vertical: 'middle' },
	});
	Object.assign(infoRow.getCell(lastColumn - 2), {
		value: `Period- ${register.periodLabel}`,
		font: font(11, { bold: true }),
		alignment: { horizontal: 'right', vertical: 'middle' },
	});
	const poLine = registerPoLine(register);
	if (poLine) banner(poLine, 11, { align: 'left' });

	const headingRow = sheet.addRow(columns.map((column) => column.title));
	headingRow.height = 34;
	const letterRow = sheet.addRow(columns.map((column) => column.letter));
	[headingRow, letterRow].forEach((row) => row.eachCell((cell) => {
		cell.font = font(row === headingRow ? 9.5 : 10, { bold: true });
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		cell.border = border;
	}));

	register.rows.forEach((item) => {
		const row = sheet.addRow(columns.map((column) => column.value(item)));
		row.height = item.showParentName ? 30 : 18;
		row.eachCell({ includeEmpty: true }, (cell, column) => {
			cell.font = font(10.5);
			cell.border = border;
			cell.numFmt = columns[column - 1]?.format ?? 'General';
			cell.alignment = { horizontal: column === 2 ? 'left' : 'center', vertical: 'middle', wrapText: column === 2 };
		});
	});

	const totalRow = sheet.addRow(columns.map((column) => column.totalValue));
	totalRow.height = 20;
	totalRow.eachCell({ includeEmpty: true }, (cell, column) => {
		cell.font = font(10.5, { bold: true });
		cell.border = border;
		cell.numFmt = columns[column - 1]?.totalFormat ?? 'General';
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
	});

	if (register.header.note) {
		sheet.addRow([]);
		const noteRow = banner(`Note:-${register.header.note}`, 10, { align: 'left' });
		noteRow.getCell(1).font = font(10);
	}

	if (hasSignatureBlock(register)) {
		const { signatoryCompany, signatoryTitle, signatureImage } = register.header;
		sheet.addRow([]);
		const signRows = [sheet.addRow([]), sheet.addRow([]), sheet.addRow([])];
		signRows.forEach((row) => { row.height = 20; });
		const signature = await loadSignatureImage(signatureImage);
		if (signature) {
			const fitted = fitInto(signature, 220, 72);
			const imageId = workbook.addImage({ base64: signature.dataUrl, extension: signature.format });
			sheet.addImage(imageId, { tl: { col: 1.15, row: signRows[0].number - 1 + 0.1 }, ext: fitted, editAs: 'oneCell' });
		}
		const signLine = (text: string, bold: boolean) => {
			const row = sheet.addRow([]);
			sheet.mergeCells(row.number, 2, row.number, 3);
			const cell = row.getCell(2);
			cell.value = text;
			cell.font = font(11, { bold });
			cell.alignment = { horizontal: 'center', vertical: 'middle' };
		};
		if (signatoryCompany?.trim()) signLine(signatoryCompany.trim(), true);
		if (signatoryTitle?.trim()) signLine(signatoryTitle.trim(), false);
	}

	sheet.pageSetup.printTitlesRow = `${headingRow.number}:${letterRow.number}`;

	await downloadWorkbook(workbook, fileName(register, 'xlsx'));
}
