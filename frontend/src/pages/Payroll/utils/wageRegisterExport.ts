import type { WageRegisterResponse, WageRegisterRow } from '../../../services/attendanceService';

export function formatRegisterNumber(value: number, decimals: 'auto' | 0 | 2 = 'auto') {
	if (decimals === 0) return String(Math.round(value));
	if (decimals === 2) return value.toFixed(2);
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatRate(value: number) {
	return String(Number(value.toFixed(2)));
}

export function registerHeadings(register: WageRegisterResponse) {
	const { bonusRate, epfRate, esiRate } = register.rates;
	return [
		{ key: 'serial', title: 'S.no.', letter: 'A' },
		{ key: 'name', title: 'Name of Employees', letter: 'B' },
		{ key: 'post', title: 'POST', letter: 'C' },
		{ key: 'workingDays', title: 'WORKING DAYS', letter: 'D' },
		{ key: 'dailyWage', title: 'WAGES (BASIC +DA)', letter: 'E' },
		{ key: 'wages', title: 'WAGES', letter: 'F' },
		{ key: 'bonus', title: `BONUS@${formatRate(bonusRate)}%`, letter: 'H' },
		{ key: 'totalWages', title: 'TOTAL WAGES', letter: 'J' },
		{ key: 'epf', title: `DEDUCTION EPF${formatRate(epfRate)}%`, letter: 'K' },
		{ key: 'esi', title: `DEDUCTION ESI@${formatRate(esiRate)}%`, letter: 'L' },
		{ key: 'grossPayment', title: 'GROSS PAYMENT IN RS.', letter: 'N' },
	] as const;
}

export function registerEmployeeName(row: WageRegisterRow) {
	const name = row.employeeName.toUpperCase();
	return row.showParentName ? `${name}\nS/O. ${row.parentName.toUpperCase()}` : name;
}

export function registerContractLine(register: WageRegisterResponse) {
	const { workName, address } = register.header;
	return [workName, address].filter(Boolean).join(' at ');
}

function rowCells(row: WageRegisterRow) {
	return [
		String(row.serial),
		registerEmployeeName(row),
		row.post,
		String(row.workingDays),
		formatRegisterNumber(row.dailyWage),
		formatRegisterNumber(row.wages),
		formatRegisterNumber(row.bonus, 2),
		formatRegisterNumber(row.totalWages, 2),
		formatRegisterNumber(row.epf, 0),
		formatRegisterNumber(row.esi, 0),
		formatRegisterNumber(row.grossPayment, 0),
	];
}

function totalCells(register: WageRegisterResponse) {
	const { totals } = register;
	return [
		'',
		'TOTAL',
		'',
		String(totals.workingDays),
		'',
		formatRegisterNumber(totals.wages),
		formatRegisterNumber(totals.bonus, 0),
		formatRegisterNumber(totals.totalWages, 0),
		formatRegisterNumber(totals.epf, 0),
		formatRegisterNumber(totals.esi, 0),
		formatRegisterNumber(totals.grossPayment, 0),
	];
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

export async function exportWageRegisterPdf(register: WageRegisterResponse) {
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
	if (register.header.loaReference) {
		doc.text(register.header.loaReference, margin, y);
		y += 3;
	}

	const headings = registerHeadings(register);
	autoTable(doc, {
		startY: y + 1,
		margin: { left: margin, right: margin },
		theme: 'grid',
		head: [
			headings.map((heading) => heading.title),
			headings.map((heading) => heading.letter),
		],
		body: register.rows.map(rowCells),
		foot: [totalCells(register)],
		showFoot: 'lastPage',
		styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, textColor: 20, lineColor: 20, lineWidth: 0.2, valign: 'middle' },
		headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
		footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center' },
		columnStyles: {
			0: { halign: 'center', cellWidth: 12 },
			1: { cellWidth: 52 },
			2: { halign: 'center', cellWidth: 26 },
			3: { halign: 'center' },
			4: { halign: 'center' },
			5: { halign: 'center' },
			6: { halign: 'center' },
			7: { halign: 'center' },
			8: { halign: 'center' },
			9: { halign: 'center' },
			10: { halign: 'center' },
		},
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
	doc.save(fileName(register, 'pdf'));
}

const COLUMN_WIDTHS = [7, 32, 14, 10, 12, 11, 13, 13, 13, 13, 14];
const NUMBER_FORMATS = ['0', '@', '@', '0', 'General', 'General', '0.00', '0.00', '0', '0', '0'];
const TOTAL_NUMBER_FORMATS = ['@', '@', '@', '0', '@', 'General', '0', '0', '0', '0', '0'];

export async function exportWageRegisterExcel(register: WageRegisterResponse) {
	const { default: ExcelJS } = await import('exceljs');
	const headings = registerHeadings(register);
	const lastColumn = headings.length;
	const workbook = new ExcelJS.Workbook();
	workbook.creator = register.header.contractorName;
	const sheet = workbook.addWorksheet('FORM XVII', {
		pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
	});
	sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));

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
	if (register.header.loaReference) banner(register.header.loaReference, 11, { align: 'left' });

	const headingRow = sheet.addRow(headings.map((heading) => heading.title));
	headingRow.height = 34;
	const letterRow = sheet.addRow(headings.map((heading) => heading.letter));
	[headingRow, letterRow].forEach((row) => row.eachCell((cell) => {
		cell.font = font(row === headingRow ? 9.5 : 10, { bold: true });
		cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		cell.border = border;
	}));

	register.rows.forEach((item) => {
		const row = sheet.addRow([
			item.serial,
			registerEmployeeName(item),
			item.post,
			item.workingDays,
			item.dailyWage,
			item.wages,
			item.bonus,
			item.totalWages,
			item.epf,
			item.esi,
			item.grossPayment,
		]);
		row.height = item.showParentName ? 30 : 18;
		row.eachCell({ includeEmpty: true }, (cell, column) => {
			cell.font = font(10.5);
			cell.border = border;
			cell.numFmt = NUMBER_FORMATS[column - 1];
			cell.alignment = { horizontal: column === 2 ? 'left' : 'center', vertical: 'middle', wrapText: column === 2 };
		});
	});

	const { totals } = register;
	const totalRow = sheet.addRow(['', 'TOTAL', '', totals.workingDays, '', totals.wages, totals.bonus, totals.totalWages, totals.epf, totals.esi, totals.grossPayment]);
	totalRow.height = 20;
	totalRow.eachCell({ includeEmpty: true }, (cell, column) => {
		cell.font = font(10.5, { bold: true });
		cell.border = border;
		cell.numFmt = TOTAL_NUMBER_FORMATS[column - 1];
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

	const buffer = await workbook.xlsx.writeBuffer();
	const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName(register, 'xlsx');
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
