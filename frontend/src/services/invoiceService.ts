import api from './api';
import type { InvoiceSettings } from './settingsService';

export type LabourQtySource = 'mandays' | 'manmonths' | 'persons';
export type QtySource = 'manual' | LabourQtySource;

export const LABOUR_QTY_OPTIONS: { value: LabourQtySource; label: string; hint: (days: string) => string }[] = [
	{ value: 'mandays', label: 'Man-days (MND)', hint: () => '1 qty = 1 person for 1 day. 5 people × 26 days = 130, rate per day.' },
	{ value: 'manmonths', label: 'Man-months (Month)', hint: (days) => `1 qty = ${days} paid days. 130 man-days = 5.000, rate per month.` },
	{ value: 'persons', label: 'Per person (No)', hint: () => '1 qty = 1 person for the whole month, any days. 5 people = 5, rate per month.' },
];
export type InvoiceSection = 'service' | 'supply';
export type RateSource = 'auto' | 'relieving' | 'fixed';

export type InvoiceSetupItem = {
	description: string;
	unit: string;
	rateSource: RateSource;
	explain: boolean;
	rate: number;
	qtySource: QtySource;
	skillCategory: string;
	defaultQty: number;
	section: InvoiceSection;
	/** yearly: billMonth is "MM"; once: billMonth is "YYYY-MM". */
	frequency: BillingFrequency;
	billMonth: string;
};

export type BillingFrequency = 'monthly' | 'yearly' | 'once';

export type InvoiceSetup = {
	saved: boolean;
	workTitle: string;
	vendorCode: string;
	loaNumber: string;
	loaDate: string;
	sapPo: string;
	billToNote: string;
	gstLabel: string;
	gstRate: number;
	firstRaBillNo: number;
	autoLabour: boolean;
	labourQtyType: LabourQtySource | '';
	items: InvoiceSetupItem[];
	defaultLabourQty: LabourQtySource;
	defaultVendorCode: string;
	defaultWorkTitle: string;
	defaultLoaNumber: string;
	defaultSapPo: string;
};

export type InvoiceSetupInput = Omit<InvoiceSetup, 'saved' | 'defaultLabourQty' | 'defaultVendorCode' | 'defaultWorkTitle' | 'defaultLoaNumber' | 'defaultSapPo'>;

export type InvoiceItem = {
	description: string;
	unit: string;
	qty: number;
	qtyDecimals: number;
	rate: number;
	amount: number;
	section: InvoiceSection;
	qtySource?: QtySource;
	skillCategory?: string;
	rateSource?: RateSource;
	rateDetail?: string;
};

export type InvoiceTotals = {
	serviceQty: number;
	serviceTotal: number;
	supplyTotal: number;
	grandTotal: number;
	gstAmount: number;
	netPayable: number;
};

export type InvoiceActivity = { action: 'save' | 'pdf' | 'excel' | 'print'; byName: string; at: string };

export type ClientInvoice = InvoiceTotals & {
	id: string;
	month: string;
	invoiceNumber: string;
	invoiceDate: string;
	raBillNo: number;
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
	activity: InvoiceActivity[];
	createdAt: string;
	updatedAt: string;
};

export type InvoicePeriod = { month: string; label: string; fromDate: string; toDate: string; daysInMonth: number };

export type InvoiceEmployeeBreakdown = {
	employeeId: string;
	name: string;
	designation: string;
	skillCategory: string;
	presentDays: number;
	halfDays: number;
	paidLeaveDays: number;
	otherLeaveDays: number;
	absentDays: number;
	paidDays: number;
	basicPay: number;
	dearnessAllowance: number;
	dailySalary: number;
	salary: number;
};

export type InvoicePreview = {
	period: InvoicePeriod;
	settings: InvoiceSettings;
	setup: InvoiceSetup;
	attendance: {
		categories: { skillCategory: string; employees: number; manDays: number; manMonths: number }[];
		totalManDays: number;
		employees: InvoiceEmployeeBreakdown[];
	};
	items: InvoiceItem[];
	totals: InvoiceTotals;
	suggested: { invoiceNumber: string; invoiceDate: string; raBillNo: number };
	invoice: ClientInvoice | null;
};

export type SaveInvoiceInput = {
	invoiceNumber: string;
	invoiceDate: string;
	raBillNo: number | '';
	items: InvoiceItem[];
};

function base(organizationId: string, locationId: string) {
	return `/organizations/${organizationId}/locations/${locationId}`;
}

export async function getInvoiceSetup(organizationId: string, locationId: string, signal?: AbortSignal) {
	const { data } = await api.get<{ setup: InvoiceSetup }>(`${base(organizationId, locationId)}/invoice-setup`, { signal });
	return data.setup;
}

export async function saveInvoiceSetup(organizationId: string, locationId: string, input: InvoiceSetupInput) {
	const { data } = await api.put<{ setup: InvoiceSetup }>(`${base(organizationId, locationId)}/invoice-setup`, input);
	return data.setup;
}

export async function getInvoicePreview(organizationId: string, locationId: string, month: string, signal?: AbortSignal) {
	const { data } = await api.get<InvoicePreview>(`${base(organizationId, locationId)}/invoices/preview`, { params: { month }, signal });
	return data;
}

export async function listInvoices(organizationId: string, locationId: string, signal?: AbortSignal) {
	const { data } = await api.get<{ invoices: ClientInvoice[] }>(`${base(organizationId, locationId)}/invoices`, { signal });
	return data.invoices;
}

export async function saveInvoice(organizationId: string, locationId: string, month: string, input: SaveInvoiceInput) {
	const { data } = await api.put<{ invoice: ClientInvoice }>(`${base(organizationId, locationId)}/invoices/${month}`, input);
	return data.invoice;
}

export async function logInvoiceActivity(organizationId: string, locationId: string, id: string, action: 'pdf' | 'excel' | 'print') {
	const { data } = await api.post<{ invoice: ClientInvoice }>(`${base(organizationId, locationId)}/invoices/${id}/activity`, { action });
	return data.invoice;
}

export async function deleteInvoice(organizationId: string, locationId: string, id: string) {
	await api.delete(`${base(organizationId, locationId)}/invoices/${id}`);
}
