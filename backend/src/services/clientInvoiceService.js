const mongoose = require('mongoose');
const ClientInvoice = require('../models/ClientInvoice');
const InvoiceSetup = require('../models/InvoiceSetup');
const Location = require('../models/Location');
const { httpError } = require('../utils/httpError');
const { getDocumentSettings, getInvoiceSettingsFor } = require('./documentSettingsService');
const { calculatePayroll, monthRange } = require('./payrollService');

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const QTY_SOURCES = new Set(['manual', 'mandays', 'manmonths', 'persons']);
const LABOUR_QTY_SOURCES = new Set(['mandays', 'manmonths', 'persons']);
const LABOUR_LINE = {
  mandays: { unit: 'MND', description: '{count} no. {category} Manpower @{wage} Per day' },
  manmonths: { unit: 'Month', description: '{count} no. {category} Manpower @{wage} X {days} days' },
  persons: { unit: 'No', description: '{count} no. {category} Manpower @{wage} X {days} days' },
};
const RATE_SOURCES = new Set(['auto', 'relieving', 'fixed']);
const SECTIONS = new Set(['service', 'supply']);
const FREQUENCIES = new Set(['monthly', 'yearly', 'once']);
const MAX_ITEMS = 30;

function requireAdmin(user) {
  if (user.role !== 'admin') throw httpError(403, 'Only admins can manage invoices.');
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function text(value, label, max) {
  const result = typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
  if (result.length > max) throw httpError(400, `${label} must be ${max} characters or fewer.`);
  return result;
}

function number(value, label, { min = 0, max = 100000000, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max) throw httpError(400, `${label} must be a number between ${min} and ${max}.`);
  return result;
}

function isoDate(value, label, { required = false } = {}) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) {
    if (required) throw httpError(400, `${label} is required.`);
    return '';
  }
  const date = new Date(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
    throw httpError(400, `Enter a valid ${label.toLowerCase()}.`);
  }
  return result;
}

function qtyDecimalsFor(item) {
  if (item.qtySource === 'manmonths') return 3;
  if (item.qtySource === 'persons' || /^no\.?$/i.test(item.unit || '')) return 0;
  return 2;
}

async function findLocation(organizationId, locationId) {
  if (!mongoose.isValidObjectId(organizationId) || !mongoose.isValidObjectId(locationId)) throw httpError(400, 'Invalid location.');
  const location = await Location.findOne({ _id: locationId, organizationId }).lean();
  if (!location) throw httpError(404, 'Location not found for this organization.');
  return location;
}

function defaultItems(categories, qtySource = 'mandays') {
  const service = (categories.length ? categories : ['']).map((category) => ({
    ...LABOUR_LINE[qtySource],
    rateSource: 'auto',
    explain: true,
    rate: 0,
    qtySource,
    skillCategory: category,
    defaultQty: 0,
    section: 'service',
  }));
  return [
    ...service,
    { description: 'Uniforms Charge Rembersment', unit: 'No', rateSource: 'fixed', explain: false, rate: 0, qtySource: 'manual', skillCategory: '', defaultQty: 0, section: 'supply' },
  ];
}

/** Labour (service) lines are always priced from wages; only supply lines may carry a fixed amount. */
function rateSourceOf(item) {
  const source = RATE_SOURCES.has(item.rateSource) ? item.rateSource : 'auto';
  return source === 'fixed' && item.section !== 'supply' ? 'auto' : source;
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

/** Contract loadings from Settings → Invoice, applied on top of the employees' wages. */
function rateRules(settings) {
  const epf = percent(settings.epfRate);
  const esic = percent(settings.esicRate);
  const bonus = percent(settings.bonusRate);
  const service = percent(settings.serviceChargeRate);
  return {
    epf,
    esic,
    bonus,
    service,
    loading: (epf + esic + bonus) / 100,
    serviceCharge: service / 100,
    relieving: percent(settings.relievingRate) / 100,
    monthDays: Math.max(1, Math.round(percent(settings.monthDays)) || 26),
  };
}

function dailyWageOf(line) {
  return line.dailySalary > 0 ? line.dailySalary : (line.basicPay || 0) + (line.dearnessAllowance || 0);
}

/** Employees, man-days and the man-day weighted daily wage for one skill category (blank = everyone). */
function groupStats(lines, skillCategory) {
  const wanted = (skillCategory || '').trim().toLowerCase();
  const group = lines.filter((line) => !wanted || (line.skillCategory || '').trim().toLowerCase() === wanted);
  const working = group.filter((line) => line.paidDays > 0);
  const manDays = working.reduce((sum, line) => sum + line.paidDays, 0);
  const priced = (working.length ? working : group).filter((line) => dailyWageOf(line) > 0);
  const weight = (line) => (working.length ? line.paidDays : 1);
  const totalWeight = priced.reduce((sum, line) => sum + weight(line), 0);
  const wage = totalWeight ? round(priced.reduce((sum, line) => sum + dailyWageOf(line) * weight(line), 0) / totalWeight) : 0;
  const designations = new Map();
  for (const line of working.length ? working : group) {
    if (line.designation) designations.set(line.designation, (designations.get(line.designation) || 0) + 1);
  }
  const designation = [...designations.entries()].sort((left, right) => right[1] - left[1]).map(([name]) => name).join(' & ');
  return { count: working.length || group.length, manDays, wage, designation };
}

function isMonthly(item) {
  return item.qtySource === 'manmonths' || item.qtySource === 'persons' || /month/i.test(item.unit || '');
}

function autoRate(item, stats, rules) {
  const days = isMonthly(item) ? rules.monthDays : 1;
  const wages = stats.wage * days;
  const withStatutory = wages * (1 + rules.loading);
  return { wages: round(wages), rate: round(withStatutory * (1 + rules.serviceCharge)) };
}

function rateDetail(source, item, stats, rules, auto) {
  if (source === 'fixed') return 'Fixed rate from setup';
  if (!stats.wage) return 'No daily wage on these employees — set it on the employee or skill category';
  const base = isMonthly(item) ? `${stats.wage.toFixed(2)} × ${rules.monthDays} days = ${auto.wages.toFixed(2)}` : stats.wage.toFixed(2);
  const parts = [`EPF ${rules.epf}%`, `ESIC ${rules.esic}%`, `Bonus ${rules.bonus}%`, rules.service ? `Service ${rules.service}%` : ''].filter(Boolean).join(' + ');
  const detail = `${base} + ${parts}`;
  return source === 'relieving' ? `${round(rules.relieving * 100, 4)}% of (${detail})` : detail;
}

function statutoryText(rules) {
  return [`EPF@${rules.epf}%`, `ESIC@${rules.esic}%`, `Bonus@${rules.bonus}%`, rules.service ? `Service charge@${rules.service}%` : ''].filter(Boolean).join(', ');
}

/** Bracketed working printed under the description, e.g. "(Supervisor & Cook @781.00= 20306/- PM, EPF@13%, ...)". */
function explanation(source, item, stats, rules, auto) {
  if (source !== 'auto' || !stats.wage) return '';
  const who = stats.designation || item.skillCategory || 'Manpower';
  if (isMonthly(item)) return `(${who} @${stats.wage.toFixed(2)}= ${Math.round(auto.wages)}/- PM, ${statutoryText(rules)})`;
  return `(${who} @${stats.wage.toFixed(2)} Per day, ${statutoryText(rules)})`;
}

function fillDescription(description, stats, rules, item) {
  const monthly = round(stats.wage * rules.monthDays);
  return description
    .replace(/\{count\}/gi, String(stats.count))
    .replace(/\{category\}\s*/gi, item.skillCategory ? `${item.skillCategory} ` : '')
    .replace(/\{statutory\}/gi, statutoryText(rules))
    .replace(/\{mandays\}/gi, String(round(stats.manDays)))
    .replace(/\{designation\}/gi, stats.designation || '')
    .replace(/\{wage\}/gi, stats.wage.toFixed(2))
    .replace(/\{days\}/gi, String(rules.monthDays))
    .replace(/\{monthly\}/gi, String(Math.round(monthly)))
    .replace(/\{epf\}/gi, String(rules.epf))
    .replace(/\{esic\}/gi, String(rules.esic))
    .replace(/\{bonus\}/gi, String(rules.bonus))
    .replace(/\{unit\}/gi, item.unit || '');
}

function publicSetup(setup, location, settings) {
  return {
    saved: Boolean(setup._id),
    workTitle: setup.workTitle || '',
    vendorCode: setup.vendorCode || '',
    loaNumber: setup.loaNumber || '',
    loaDate: setup.loaDate || '',
    sapPo: setup.sapPo || '',
    billToNote: setup.billToNote || '',
    gstLabel: setup.gstLabel || 'IGST',
    gstRate: setup.gstRate ?? 18,
    firstRaBillNo: setup.firstRaBillNo || 1,
    items: (setup.items || []).map((item) => ({
      description: item.description,
      unit: item.unit || '',
      rateSource: rateSourceOf(item),
      explain: item.explain !== false,
      rate: item.rate || 0,
      qtySource: item.qtySource || 'manual',
      skillCategory: item.skillCategory || '',
      defaultQty: item.defaultQty || 0,
      section: item.section || 'service',
      frequency: item.frequency || 'monthly',
      billMonth: item.billMonth || '',
    })),
    autoLabour: setup.autoLabour !== false,
    labourQtyType: LABOUR_QTY_SOURCES.has(setup.labourQtyType) ? setup.labourQtyType : '',
    defaultLabourQty: labourQtyDefault(settings),
    defaultVendorCode: settings.vendorCode,
    defaultWorkTitle: [location.workName, location.name].filter(Boolean).join(' at '),
    defaultLoaNumber: location.loaReference || '',
    defaultSapPo: location.opNumber || '',
  };
}

async function loadSetup(location) {
  const saved = await InvoiceSetup.findOne({ locationId: location._id }).lean();
  if (saved) return saved;
  return {
    workTitle: '',
    vendorCode: '',
    loaNumber: '',
    loaDate: '',
    sapPo: '',
    billToNote: '',
    gstLabel: 'IGST',
    gstRate: 18,
    firstRaBillNo: 1,
    autoLabour: true,
    labourQtyType: '',
    items: defaultItems([]).filter((item) => item.section === 'supply'),
  };
}

async function locationLines(location, month) {
  const { fromDate, toDate } = monthRange(month);
  const payroll = await calculatePayroll({ role: 'admin' }, {
    organizationId: String(location.organizationId),
    locationId: String(location._id),
    fromDate,
    toDate,
  });
  return payroll.lines;
}

async function getInvoiceSetup(user, organizationId, locationId) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  const [setup, settings] = await Promise.all([loadSetup(location), getDocumentSettings('invoice')]);
  return { setup: publicSetup(setup, location, settings) };
}

function billingOf(item, label) {
  const frequency = FREQUENCIES.has(item.frequency) ? item.frequency : 'monthly';
  const billMonth = String(item.billMonth || '').trim();
  if (frequency === 'yearly' && !/^(0[1-9]|1[0-2])$/.test(billMonth)) throw httpError(400, `${label}: choose the month it is billed every year.`);
  if (frequency === 'once' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(billMonth)) throw httpError(400, `${label}: choose the month it is billed once.`);
  return { frequency, billMonth: frequency === 'monthly' ? '' : billMonth };
}

function parseSetupItems(items, autoLabour) {
  if (!Array.isArray(items)) throw httpError(400, 'Invoice lines are missing.');
  if (!autoLabour && items.length === 0) throw httpError(400, 'Add at least one invoice line.');
  if (items.length > MAX_ITEMS) throw httpError(400, `Use ${MAX_ITEMS} invoice lines or fewer.`);
  return items.map((item, index) => {
    const label = `Line ${index + 1}`;
    const description = text(item?.description, `${label} description`, 300);
    if (!description) throw httpError(400, `${label} needs a description.`);
    const qtySource = QTY_SOURCES.has(item.qtySource) ? item.qtySource : 'manual';
    const section = SECTIONS.has(item.section) ? item.section : 'service';
    const rateSource = rateSourceOf({ rateSource: item.rateSource, section });
    return {
      description,
      unit: text(item.unit, `${label} unit`, 20),
      rateSource,
      explain: item.explain !== false,
      rate: rateSource === 'fixed' ? round(number(item.rate, `${label} rate`)) : 0,
      qtySource,
      skillCategory: qtySource === 'manual' ? '' : text(item.skillCategory, `${label} skill category`, 60),
      defaultQty: round(number(item.defaultQty, `${label} quantity`), 3),
      section: SECTIONS.has(item.section) ? item.section : 'service',
      ...billingOf(item, label),
    };
  });
}

async function saveInvoiceSetup(user, organizationId, locationId, input = {}) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  const values = {
    organizationId: location.organizationId,
    locationId: location._id,
    workTitle: text(input.workTitle, 'Name of work', 300),
    vendorCode: text(input.vendorCode, 'Vendor code', 40),
    loaNumber: text(input.loaNumber, 'LOA number', 120),
    loaDate: isoDate(input.loaDate, 'LOA date'),
    sapPo: text(input.sapPo, 'SAP PO', 60),
    billToNote: text(input.billToNote, 'Footer note', 200),
    gstLabel: text(input.gstLabel, 'Tax label', 20) || 'IGST',
    gstRate: round(number(input.gstRate, 'Tax rate', { max: 100, fallback: 18 })),
    firstRaBillNo: Math.round(number(input.firstRaBillNo, 'First RA bill number', { min: 1, max: 100000, fallback: 1 })),
    autoLabour: input.autoLabour !== false,
    labourQtyType: LABOUR_QTY_SOURCES.has(input.labourQtyType) ? input.labourQtyType : '',
    items: parseSetupItems(input.items, input.autoLabour !== false),
  };
  const setup = await InvoiceSetup.findOneAndUpdate({ locationId: location._id }, { $set: values }, { new: true, upsert: true, runValidators: true }).lean();
  const settings = await getDocumentSettings('invoice');
  return { setup: publicSetup(setup, location, settings) };
}

function periodOf(month) {
  const { year, monthNumber, fromDate, toDate } = monthRange(month);
  const dmy = (value) => value.split('-').reverse().join('-');
  return {
    month,
    label: `${MONTH_NAMES[monthNumber - 1]}-${year}`,
    fromDate: dmy(fromDate),
    toDate: dmy(toDate),
    daysInMonth: Number(toDate.slice(-2)),
  };
}

function financialYearOf(isoValue) {
  const [year, month] = isoValue.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

async function nextInvoiceSeq(financialYear, settings, excludeId) {
  const filter = { financialYear };
  if (excludeId) filter._id = { $ne: excludeId };
  const last = await ClientInvoice.findOne(filter).sort({ invoiceSeq: -1 }).select('invoiceSeq').lean();
  const start = Math.max(1, Math.round(Number(settings.startNumber) || 1));
  return last && last.invoiceSeq >= start ? last.invoiceSeq + 1 : start;
}

async function nextRaBillNo(location, setup, excludeId) {
  const filter = { locationId: location._id };
  if (excludeId) filter._id = { $ne: excludeId };
  const last = await ClientInvoice.findOne(filter).sort({ raBillNo: -1 }).select('raBillNo').lean();
  const first = setup.firstRaBillNo || 1;
  return last && last.raBillNo >= first ? last.raBillNo + 1 : first;
}

function computeTotals(items, gstRate) {
  const service = items.filter((item) => item.section === 'service');
  const supply = items.filter((item) => item.section === 'supply');
  const serviceTotal = round(service.reduce((sum, item) => sum + item.amount, 0));
  const supplyTotal = round(supply.reduce((sum, item) => sum + item.amount, 0));
  const grandTotal = round(serviceTotal + supplyTotal);
  const gstAmount = round(serviceTotal * (gstRate / 100));
  return {
    serviceQty: round(service.reduce((sum, item) => sum + item.qty, 0), 3),
    serviceTotal,
    supplyTotal,
    grandTotal,
    gstAmount,
    netPayable: round(grandTotal + gstAmount),
  };
}

function sortedItems(items) {
  return [...items.filter((item) => item.section === 'service'), ...items.filter((item) => item.section === 'supply')];
}

function publicInvoice(invoice) {
  return {
    id: String(invoice._id),
    month: invoice.month,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    raBillNo: invoice.raBillNo,
    partyName: invoice.partyName,
    vendorCode: invoice.vendorCode,
    workTitle: invoice.workTitle,
    loaNumber: invoice.loaNumber,
    loaDate: invoice.loaDate,
    sapPo: invoice.sapPo,
    billToNote: invoice.billToNote,
    gstLabel: invoice.gstLabel,
    gstRate: invoice.gstRate,
    items: invoice.items.map((item) => ({
      description: item.description,
      unit: item.unit,
      qty: item.qty,
      qtyDecimals: item.qtyDecimals,
      rate: item.rate,
      amount: item.amount,
      section: item.section,
    })),
    serviceQty: invoice.serviceQty,
    serviceTotal: invoice.serviceTotal,
    supplyTotal: invoice.supplyTotal,
    grandTotal: invoice.grandTotal,
    gstAmount: invoice.gstAmount,
    netPayable: invoice.netPayable,
    activity: (invoice.activity || []).map((entry) => ({ action: entry.action, byName: entry.byName, at: entry.at })),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function attendanceSummary(lines, monthDays) {
  const byCategory = new Map();
  for (const line of lines) {
    const key = line.skillCategory || 'Not set';
    const entry = byCategory.get(key) || { skillCategory: key, employees: 0, manDays: 0 };
    entry.employees += line.paidDays > 0 ? 1 : 0;
    entry.manDays += line.paidDays;
    byCategory.set(key, entry);
  }
  const categories = [...byCategory.values()].map((entry) => ({
    ...entry,
    manDays: round(entry.manDays),
    manMonths: round(entry.manDays / monthDays, 3),
  }));
  const totalManDays = round(lines.reduce((sum, line) => sum + line.paidDays, 0));
  return { categories, totalManDays, employees: lines.map(employeeBreakdown) };
}

/** Daily wage is the one valid in the invoice month, so the salary matches the labour rate billed. */
function employeeBreakdown(line) {
  return {
    employeeId: line.employeeId,
    name: line.employeeName,
    designation: line.designation || '',
    skillCategory: line.skillCategory || '',
    presentDays: line.presentDays || 0,
    halfDays: line.halfDays || 0,
    paidLeaveDays: line.paidLeaveDays || 0,
    otherLeaveDays: line.otherLeaveDays || 0,
    absentDays: line.absentDays || 0,
    paidDays: line.paidDays || 0,
    basicPay: line.basicPay || 0,
    dearnessAllowance: line.dearnessAllowance || 0,
    dailySalary: line.dailySalary || 0,
    salary: round((line.dailySalary || 0) * (line.paidDays || 0)),
  };
}

function categoriesOf(lines) {
  const working = lines.filter((line) => line.paidDays > 0);
  return [...new Set((working.length ? working : lines).map((line) => line.skillCategory).filter(Boolean))].sort();
}

/** With auto labour on, one labour line per skill category working this month replaces the typed labour lines. */
function labourQtyDefault(settings) {
  return LABOUR_QTY_SOURCES.has(settings.labourQtyType) ? settings.labourQtyType : 'mandays';
}

/** Yearly lines bill in their month every year ("MM"); one-time lines bill only in their "YYYY-MM". */
function billedIn(item, month) {
  if (item.frequency === 'yearly') return month.slice(5, 7) === item.billMonth;
  if (item.frequency === 'once') return month === item.billMonth;
  return true;
}

function effectiveItems(setup, lines, settings, month) {
  const typed = (setup.items || []).filter((item) => billedIn(item, month));
  if (setup.autoLabour === false) return typed;
  const qtySource = LABOUR_QTY_SOURCES.has(setup.labourQtyType) ? setup.labourQtyType : labourQtyDefault(settings);
  const generated = defaultItems(categoriesOf(lines), qtySource).filter((item) => item.section === 'service');
  const kept = typed
    .filter((item) => !(item.section !== 'supply' && rateSourceOf(item) === 'auto'))
    .map((item) => ({ ...item, qtySource: 'manual', rateSource: item.section === 'supply' ? 'fixed' : 'relieving' }));
  return [...generated, ...kept];
}

function contractOf(setup, location, settings) {
  return {
    workTitle: setup.workTitle || [location.workName, location.name].filter(Boolean).join(' at '),
    vendorCode: setup.vendorCode || settings.vendorCode || '',
    loaNumber: setup.loaNumber || location.loaReference || '',
    sapPo: setup.sapPo || location.opNumber || '',
  };
}

/** Man-days: 1 qty = 1 person for 1 day. Man-months: 1 qty = {monthDays} paid days. Persons: 1 qty = 1 person for the month. */
function quantityOf(item, stats, rules) {
  if (item.qtySource === 'mandays') return round(stats.manDays);
  if (item.qtySource === 'manmonths') return round(stats.manDays / rules.monthDays, 3);
  if (item.qtySource === 'persons') return stats.manDays > 0 ? stats.count : 0;
  return item.defaultQty || 0;
}

function computedItems(setup, lines, settings, month) {
  const rules = rateRules(settings);
  return sortedItems(effectiveItems(setup, lines, settings, month).map((item) => {
    const stats = groupStats(lines, item.skillCategory || '');
    const qty = quantityOf(item, stats, rules);
    const source = rateSourceOf(item);
    const auto = autoRate(item, stats, rules);
    const rate = source === 'fixed' ? item.rate || 0 : source === 'relieving' ? round(auto.rate * rules.relieving) : auto.rate;
    const working = item.explain === false ? '' : explanation(source, item, stats, rules, auto);
    return {
      description: [fillDescription(item.description, stats, rules, item), working].filter(Boolean).join('\n'),
      unit: item.unit || '',
      qty,
      qtyDecimals: qtyDecimalsFor(item),
      rate,
      amount: round(qty * rate),
      section: item.section || 'service',
      qtySource: item.qtySource || 'manual',
      skillCategory: item.skillCategory || '',
      rateSource: source,
      rateDetail: rateDetail(source, item, stats, rules, auto),
    };
  }));
}

async function previewInvoice(user, organizationId, locationId, query = {}) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  const period = periodOf(query.month);
  const [setup, settings, lines, saved] = await Promise.all([
    loadSetup(location),
    getInvoiceSettingsFor(query.month),
    locationLines(location, query.month),
    ClientInvoice.findOne({ locationId: location._id, month: query.month }).lean(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const financialYear = financialYearOf(today);
  const [seq, raBillNo] = saved ? [saved.invoiceSeq, saved.raBillNo] : await Promise.all([
    nextInvoiceSeq(financialYear, settings),
    nextRaBillNo(location, setup),
  ]);
  const items = computedItems(setup, lines, settings, period.month);
  return {
    period,
    settings,
    setup: publicSetup(setup, location, settings),
    attendance: attendanceSummary(lines, rateRules(settings).monthDays),
    items,
    totals: computeTotals(items, setup.gstRate ?? 18),
    suggested: {
      invoiceNumber: saved ? saved.invoiceNumber : `${settings.invoicePrefix}/${financialYear}/${seq}`,
      invoiceDate: saved ? saved.invoiceDate : today,
      raBillNo,
    },
    invoice: saved ? publicInvoice(saved) : null,
  };
}

function parseInvoiceItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'The invoice needs at least one line.');
  if (items.length > MAX_ITEMS) throw httpError(400, `Use ${MAX_ITEMS} invoice lines or fewer.`);
  return sortedItems(items.map((item, index) => {
    const label = `Line ${index + 1}`;
    const description = text(item?.description, `${label} description`, 300);
    if (!description) throw httpError(400, `${label} needs a description.`);
    const qty = round(number(item.qty, `${label} quantity`), 3);
    const rate = round(number(item.rate, `${label} rate`));
    return {
      description,
      unit: text(item.unit, `${label} unit`, 20),
      qty,
      qtyDecimals: Math.min(3, Math.max(0, Math.round(number(item.qtyDecimals, `${label} decimals`, { max: 3, fallback: 2 })))),
      rate,
      amount: round(qty * rate),
      section: SECTIONS.has(item.section) ? item.section : 'service',
    };
  }));
}

function activityEntry(user, action) {
  return { action, by: user.id, byName: user.name || user.email || '', at: new Date() };
}

async function saveInvoice(user, organizationId, locationId, month, input = {}) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  periodOf(month);
  const [setup, settings, existing] = await Promise.all([
    loadSetup(location),
    getInvoiceSettingsFor(month),
    ClientInvoice.findOne({ locationId: location._id, month }),
  ]);

  const invoiceDate = isoDate(input.invoiceDate, 'Invoice date', { required: true });
  const financialYear = financialYearOf(invoiceDate);
  let invoiceNumber = text(input.invoiceNumber, 'Invoice number', 60);
  let invoiceSeq;
  if (invoiceNumber) {
    const trailing = invoiceNumber.match(/(\d+)\s*$/);
    invoiceSeq = trailing ? Number(trailing[1]) : 0;
  } else {
    invoiceSeq = await nextInvoiceSeq(financialYear, settings, existing?._id);
    invoiceNumber = `${settings.invoicePrefix}/${financialYear}/${invoiceSeq}`;
  }
  const clash = await ClientInvoice.findOne({ invoiceNumber, _id: { $ne: existing?._id } }).select('month locationId').lean();
  if (clash) throw httpError(409, `Invoice number ${invoiceNumber} is already used by another invoice.`);

  const raBillNo = input.raBillNo === undefined || input.raBillNo === ''
    ? await nextRaBillNo(location, setup, existing?._id)
    : Math.round(number(input.raBillNo, 'RA bill number', { min: 0, max: 100000 }));
  const lines = await locationLines(location, month);
  const computed = computedItems(setup, lines, settings, month);
  const submitted = parseInvoiceItems(input.items);
  if (submitted.length !== computed.length) throw httpError(409, 'The invoice setup has changed. Press "Refill from attendance" and save again.');
  const items = submitted.map((item, index) => {
    const source = computed[index];
    const alreadyBilled = existing?.items?.[index]?.rate === item.rate;
    const rate = source.rateSource === 'fixed' || alreadyBilled ? item.rate : source.rate;
    return { ...item, section: source.section, rate, amount: round(item.qty * rate) };
  });
  const gstRate = setup.gstRate ?? 18;

  const values = {
    organizationId: location.organizationId,
    locationId: location._id,
    month,
    invoiceNumber,
    financialYear,
    invoiceSeq,
    invoiceDate,
    raBillNo,
    partyName: settings.partyName,
    ...contractOf(setup, location, settings),
    loaDate: setup.loaDate,
    billToNote: setup.billToNote,
    gstLabel: setup.gstLabel || 'IGST',
    gstRate,
    items,
    ...computeTotals(items, gstRate),
  };

  const invoice = existing || new ClientInvoice({ createdBy: user.id });
  invoice.set(values);
  invoice.activity.push(activityEntry(user, 'save'));
  try {
    await invoice.save();
  } catch (error) {
    if (error?.code === 11000) throw httpError(409, 'An invoice for this month was just saved. Reload and try again.');
    throw error;
  }
  return { invoice: publicInvoice(invoice.toObject()) };
}

async function listInvoices(user, organizationId, locationId) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  const invoices = await ClientInvoice.find({ locationId: location._id }).sort({ month: -1 }).lean();
  return { invoices: invoices.map(publicInvoice) };
}

async function findInvoice(location, id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid invoice id.');
  const invoice = await ClientInvoice.findOne({ _id: id, locationId: location._id });
  if (!invoice) throw httpError(404, 'Invoice not found.');
  return invoice;
}

async function logInvoiceActivity(user, organizationId, locationId, id, input = {}) {
  requireAdmin(user);
  if (!['pdf', 'excel', 'print'].includes(input.action)) throw httpError(400, 'Unknown invoice action.');
  const location = await findLocation(organizationId, locationId);
  const invoice = await findInvoice(location, id);
  invoice.activity.push(activityEntry(user, input.action));
  await invoice.save();
  return { invoice: publicInvoice(invoice.toObject()) };
}

async function deleteInvoice(user, organizationId, locationId, id) {
  requireAdmin(user);
  const location = await findLocation(organizationId, locationId);
  const invoice = await findInvoice(location, id);
  await invoice.deleteOne();
  return { invoice: publicInvoice(invoice.toObject()) };
}

module.exports = {
  deleteInvoice,
  getInvoiceSetup,
  listInvoices,
  logInvoiceActivity,
  previewInvoice,
  saveInvoice,
  saveInvoiceSetup,
};
