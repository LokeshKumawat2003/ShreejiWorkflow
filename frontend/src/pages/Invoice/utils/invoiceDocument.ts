import type { InvoiceItem, InvoicePeriod, InvoiceTotals } from '../../../services/invoiceService';
import type { InvoiceSettings } from '../../../services/settingsService';
import { rupeesInWords } from '../../Payroll/utils/salarySlipPdf';

/** Everything printed on one invoice breakup, whether saved or still a draft. */
export type InvoiceDocument = InvoiceTotals & {
	settings: InvoiceSettings;
	period: InvoicePeriod;
	invoiceNumber: string;
	invoiceDate: string;
	raBillNo: number | '';
	partyName: string;
	vendorCode: string;
	workTitle: string;
	loaNumber: string;
	loaDate: string;
	sapPo: string;
	billToNote: string;
	gstLabel: string;
	gstRate: number;
	items: InvoiceItem[];
};

export type InvoiceTableRow = {
	serial: string;
	description: string;
	unit: string;
	qty: string;
	rate: string;
	amount: string;
	isTotal: boolean;
	isBold: boolean;
};

export type InvoiceSummaryRow = { label: string; amount: string; isFinal: boolean };

export const TABLE_HEADINGS = ['S.NO.', 'DESCRIPTION OF WORK', 'UNIT', 'QTY.', 'RATE', 'AMOUNT'];

function round(value: number, decimals = 2) {
	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function money(value: number) {
	return round(value).toFixed(2);
}

export function quantity(value: number, decimals: number) {
	return round(value, decimals).toFixed(decimals);
}

/** yyyy-mm-dd → dd-mm-yyyy */
export function dmy(value: string) {
	const [year, month, day] = value.split('-');
	return year && month && day ? `${day}-${month}-${year}` : value;
}

export function amountInWords(value: number) {
	const total = round(value);
	const rupees = Math.floor(total);
	const paise = Math.round((total - rupees) * 100);
	return `${rupeesInWords(rupees)} Rupees${paise ? ` & ${rupeesInWords(paise)} Paise` : ''} Only`;
}

/** EPF, ESIC, bonus, overhead and service charge rows repeat the man-days, so only the wage row counts toward the total quantity. */
function isLabourQty(item: InvoiceItem) {
	return !item.component || item.component === 'wage';
}

export function computeTotals(items: InvoiceItem[], gstRate: number): InvoiceTotals {
	const service = items.filter((item) => item.section === 'service');
	const supply = items.filter((item) => item.section === 'supply');
	const serviceTotal = round(service.reduce((sum, item) => sum + item.amount, 0));
	const supplyTotal = round(supply.reduce((sum, item) => sum + item.amount, 0));
	const grandTotal = round(serviceTotal + supplyTotal);
	// Worked in paise so an exact half paisa (e.g. 18% of 454599.25 = 81827.865) rounds up instead of drifting down.
	const gstAmount = Math.round((Math.round(serviceTotal * 100) * gstRate) / 100) / 100;
	return {
		serviceQty: round(service.filter(isLabourQty).reduce((sum, item) => sum + item.qty, 0), 3),
		serviceTotal,
		supplyTotal,
		grandTotal,
		gstAmount,
		netPayable: round(grandTotal + gstAmount),
	};
}

export function headerLines(doc: InvoiceDocument) {
	const loa = [
		doc.loaNumber ? `LOA-${doc.loaNumber}` : '',
		doc.loaDate ? `Dated-${dmy(doc.loaDate)}` : '',
		doc.sapPo ? `( SAP PO-${doc.sapPo} )` : '',
	].filter(Boolean).join(' ');
	return {
		title: doc.settings.title,
		invoiceLine: `Invoice No. ${doc.invoiceNumber} Dated-${dmy(doc.invoiceDate)}${doc.raBillNo !== '' ? ` ( RA BILL NO.- ${doc.raBillNo} )` : ''}`,
		party: `Name of Party :- ${doc.partyName}${doc.vendorCode ? ` Vendor Code:- ${doc.vendorCode}` : ''}`,
		work: `NAME OF WORK :- ${doc.workTitle}`,
		loa,
		period: `Period:- Month of ${doc.period.label} ( ${doc.period.fromDate} to ${doc.period.toDate} )`,
	};
}

export function tableRows(doc: InvoiceDocument) {
	const service = doc.items.filter((item) => item.section === 'service');
	const supply = doc.items.filter((item) => item.section === 'supply');
	const itemRow = (item: InvoiceItem, serial: number): InvoiceTableRow => ({
		serial: String(serial),
		description: item.description,
		unit: item.unit,
		qty: quantity(item.qty, item.qtyDecimals),
		rate: money(item.rate),
		amount: money(item.amount),
		isTotal: false,
		isBold: item.component === 'wage',
	});
	const itemised = service.some((item) => item.component);
	const rows = service.map((item, index) => itemRow(item, index + 1));
	const totalSerial = service.length + 1;
	const qtyDecimals = Math.max(0, ...service.filter(isLabourQty).map((item) => item.qtyDecimals));
	rows.push({
		serial: String(totalSerial),
		description: itemised ? `Total Wages Service GST Part ( S.No. 1 To ${service.length} )` : `Grand Total Service Part S.No. 1 to ${service.length}`,
		unit: '',
		qty: quantity(doc.serviceQty, qtyDecimals),
		rate: '',
		amount: money(doc.serviceTotal),
		isTotal: true,
		isBold: true,
	});
	supply.forEach((item, index) => rows.push(itemRow(item, totalSerial + 1 + index)));
	const lastSerial = totalSerial + supply.length;

	const summary: InvoiceSummaryRow[] = itemised ? [
		{ label: 'TOTAL', amount: money(doc.grandTotal), isFinal: false },
		{ label: `${doc.gstLabel} @${Number(doc.gstRate)}% On item No.${totalSerial}`, amount: money(doc.gstAmount), isFinal: false },
		{ label: 'NET PAYABLE AMOUNT', amount: money(doc.netPayable), isFinal: true },
	] : [
		{ label: `Total S.No. 1 to ${lastSerial}`, amount: money(doc.grandTotal), isFinal: false },
		{ label: `${doc.gstLabel}@${Number(doc.gstRate)}% On S.No. ${totalSerial}`, amount: money(doc.gstAmount), isFinal: false },
		{ label: 'Total Payable Amount', amount: money(doc.netPayable), isFinal: true },
	];
	return { rows, summary, words: `RS. IN WORDS:- ${amountInWords(doc.netPayable)}` };
}

export function invoiceFileName(doc: InvoiceDocument, extension: string) {
	const safe = doc.invoiceNumber.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
	return `invoice-breakup-${safe || doc.period.month}.${extension}`;
}
