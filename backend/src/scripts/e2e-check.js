// End-to-end API check against the seeded three-year data (seed-three-years.js). Starts the API in-process and
// calls it over HTTP as the admin and as organization logins. Expected numbers are rebuilt from raw attendance and
// the seeded price / rate tables, not from the services. Every record the check creates or changes is restored.
// Run: node src/scripts/e2e-check.js
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const fs = require('node:fs');
const mongoose = require('mongoose');
const { createApp } = require('../app');
const Attendance = require('../models/Attendance');
const BankInvoiceBatch = require('../models/BankInvoiceBatch');
const ClientInvoice = require('../models/ClientInvoice');
const DocumentSettings = require('../models/DocumentSettings');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const { createToken } = require('../services/authService');

const ORG_PASSWORD = 'Shreeji@2026';
const PRICE_LEVELS = [
  ['', 0.55], ['2024-04-01', 0.6], ['2024-10-01', 0.66], ['2025-01-01', 0.71], ['2025-04-01', 0.76],
  ['2025-08-01', 0.82], ['2025-12-01', 0.88], ['2026-04-01', 0.94], ['2026-09-16', 1],
];
const WAGE_DEFAULT = { bonusRate: 8.33, epfRate: 12, epfWageCeiling: 25000, esiRate: 0.75, esiWageCeiling: 21000 };
const WAGE_LEVELS = [
  ['2023-12', 8.33, 12, 15000, 1.75, 21000], ['2024-04', 8.33, 12, 15000, 0.75, 21000], ['2024-10', 10, 12, 15000, 0.75, 21000],
  ['2025-04', 10, 12.5, 20000, 0.75, 21000], ['2025-07', 12, 12.5, 20000, 1, 25000], ['2025-10', 8.33, 13, 20000, 1, 25000],
  ['2026-01', 9, 13, 25000, 0.75, 25000], ['2026-04', 8.33, 12, 25000, 0.75, 21000], ['2026-08', 8.33, 12, 0, 0.75, 21000],
];
const INVOICE_DEFAULT = { epfRate: 13, esicRate: 3.25, bonusRate: 8.33, serviceChargeRate: 0, relievingRate: 16.6667, monthDays: 26 };
const INVOICE_LEVELS = [
  ['2023-12', 13, 4.75, 8.33, 0, 16.6667], ['2024-04', 13, 3.25, 8.33, 0, 16.6667], ['2024-09', 13, 3.25, 10, 2, 16.6667],
  ['2025-01', 13.5, 3.25, 10, 2, 16.6667], ['2025-04', 13.5, 3.25, 12, 3, 15], ['2025-10', 13, 3.25, 8.33, 3, 16.6667],
  ['2026-01', 13, 3.5, 9, 2.5, 16.6667], ['2026-06', 13, 3.25, 8.33, 0, 16.6667], ['2026-10', 13, 3.25, 8.33, 1.5, 16.6667],
];
const TEST_MONTHS = ['2023-12', '2024-03', '2024-05', '2024-10', '2025-01', '2025-04', '2025-07', '2025-10', '2026-01', '2026-04', '2026-08', '2026-10'];

const results = [];
let section = '';
const r2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const pad = (value) => String(value).padStart(2, '0');

function check(name, ok, detail = '') {
  results.push({ section, name, ok: Boolean(ok), detail: ok ? '' : String(detail) });
}
function near(actual, expected, tolerance = 0.011) {
  return Math.abs(Number(actual) - Number(expected)) <= tolerance;
}
function sameText(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}
function lastDay(month) {
  const [year, number] = month.split('-').map(Number);
  return `${month}-${pad(new Date(Date.UTC(year, number, 0)).getUTCDate())}`;
}
function todayIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
function shift(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function wageLevel(month) {
  const level = [...WAGE_LEVELS].reverse().find(([from]) => from <= month);
  if (!level) return WAGE_DEFAULT;
  const [, bonusRate, epfRate, epfWageCeiling, esiRate, esiWageCeiling] = level;
  return { bonusRate, epfRate, epfWageCeiling, esiRate, esiWageCeiling };
}
function invoiceLevel(month) {
  const level = [...INVOICE_LEVELS].reverse().find(([from]) => from <= month);
  if (!level) return INVOICE_DEFAULT;
  const [, epfRate, esicRate, bonusRate, serviceChargeRate, relievingRate] = level;
  return { epfRate, esicRate, bonusRate, serviceChargeRate, relievingRate, monthDays: 26 };
}

let http;
async function call(method, path, { cookie, body, query } = {}) {
  const url = new URL(`${http}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), origin: 'http://localhost:5173' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

async function login(email, password) {
  const response = await call('POST', '/auth/login', { body: { email, password } });
  const cookie = (response.headers.getSetCookie?.() || []).map((value) => value.split(';')[0]).find((value) => value.startsWith('accessToken='));
  return { status: response.status, cookie };
}

/** Everything the expected numbers need: org schedule, today's skill prices, employees and raw attendance. */
class Model {
  async load() {
    this.organizations = await User.find({ role: 'organization' }).sort({ email: 1 }).lean();
    this.locations = await Location.find({}).sort({ name: 1 }).lean();
    this.employees = await Employee.find({}).lean();
    this.skills = new Map((await MasterData.find({ type: 'skillCategory' }).lean()).map((skill) => [skill.code, skill]));
  }

  organization(id) {
    return this.organizations.find((organization) => String(organization._id) === String(id));
  }

  todayPrice(skillName, organization) {
    const skill = this.skills.get(String(skillName).toLowerCase());
    return (skill.rates || []).find((rate) => sameText(rate.governmentType, organization.governmentType) && sameText(rate.area, organization.area)).salary;
  }

  priceOn(skillName, organization, date) {
    const factor = [...PRICE_LEVELS].reverse().find(([from]) => from <= date)[1];
    const today = this.todayPrice(skillName, organization);
    return factor === 1 ? today : Math.round(today * factor);
  }

  dailyOn(employee, date) {
    const organization = this.organization(employee.organizationId);
    return r2(this.priceOn(employee.skillCategory, organization, date) + (employee.dearnessAllowance || 0) + (employee.otherAllowanceAmount || 0));
  }

  locationEmployees(location) {
    return this.employees.filter((employee) => String(employee.locationId) === String(location._id) && sameText(employee.designation, location.designation));
  }

  /** Paid days per employee: present 1, half day 0.5, paid leave 1, at most 26 in each month; nothing on or after a block. */
  async paidDays(location, fromDate, toDate) {
    const employees = this.locationEmployees(location);
    const records = await Attendance.find({ employeeId: { $in: employees.map(({ _id }) => _id) }, date: { $gte: fromDate, $lte: toDate } }).lean();
    const byEmployee = new Map();
    for (const employee of employees) byEmployee.set(String(employee._id), { employee, months: new Map(), present: 0, half: 0, has: false });
    for (const record of records) {
      const row = byEmployee.get(String(record.employeeId));
      if (row.employee.status === 'disabled' && row.employee.disabledOn && record.date >= row.employee.disabledOn) continue;
      row.has = true;
      const month = record.date.slice(0, 7);
      const value = { present: 1, half_day: 0.5, paid_leave: 1 }[record.status] || 0;
      row.months.set(month, (row.months.get(month) || 0) + value);
      if (record.status === 'present') row.present += 1;
      if (record.status === 'half_day') row.half += 1;
    }
    for (const row of byEmployee.values()) row.paid = r2([...row.months.values()].reduce((sum, days) => sum + Math.min(26, days), 0));
    return byEmployee;
  }
}

function expectedRow(daily, paid, employee, rates) {
  const wages = r2(daily * paid);
  const bonus = (wages * rates.bonusRate) / 100;
  const epfBase = rates.epfWageCeiling > 0 ? Math.min(wages, rates.epfWageCeiling) : wages;
  const esiBase = rates.esiWageCeiling > 0 ? Math.min(wages, rates.esiWageCeiling) : wages;
  const epf = employee.epfoApplicable ? (epfBase * rates.epfRate) / 100 : 0;
  const esi = employee.esicApplicable ? (esiBase * rates.esiRate) / 100 : 0;
  return { wages, bonus: r2(bonus), epf: Math.round(epf), esi: Math.round(esi), net: Math.round(wages + bonus - epf - esi) };
}

function ratesMatch(actual, expected) {
  return ['bonusRate', 'epfRate', 'epfWageCeiling', 'esiRate', 'esiWageCeiling'].every((field) => near(actual?.[field] || 0, expected[field] || 0, 0.0001));
}

async function testOldMonthRates(model, admin) {
  section = 'Old month rates (payroll, wage register, settings, invoice)';
  for (const [orgIndex, organization] of model.organizations.entries()) {
    const orgLocations = model.locations.filter((location) => String(location.organizationId) === String(organization._id));
    for (const [monthIndex, month] of TEST_MONTHS.entries()) {
      const location = orgLocations[(orgIndex + monthIndex) % orgLocations.length];
      const tag = `${month} ${organization.organizationName} / ${location.name}`;
      const fromDate = `${month}-01`;
      const toDate = lastDay(month);
      const rates = wageLevel(month);
      const ids = { organizationId: String(organization._id), locationId: String(location._id) };
      const expected = await model.paidDays(location, fromDate, toDate);

      const pay = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate, toDate } });
      check(`${tag}: payroll API answers`, pay.status === 200, pay.status);
      if (pay.status !== 200) continue;
      check(`${tag}: payroll uses that month's bonus/EPF/ESI`, ratesMatch(pay.data.rates, rates), JSON.stringify(pay.data.rates));
      let lineErrors = [];
      for (const line of pay.data.lines) {
        const row = expected.get(line.employeeId);
        const daily = model.dailyOn(row.employee, toDate);
        const want = expectedRow(daily, row.paid, row.employee, rates);
        if (!near(line.dailySalary, daily)) lineErrors.push(`${line.employeeName} daily ${line.dailySalary}≠${daily}`);
        if (!near(line.paidDays, row.paid)) lineErrors.push(`${line.employeeName} paid ${line.paidDays}≠${row.paid}`);
        if (!near(line.bonus, want.bonus) || line.epf !== want.epf || line.esi !== want.esi || line.netPay !== want.net) {
          lineErrors.push(`${line.employeeName} bonus/epf/esi/net ${line.bonus}/${line.epf}/${line.esi}/${line.netPay} ≠ ${want.bonus}/${want.epf}/${want.esi}/${want.net}`);
        }
      }
      const withAttendance = [...expected.values()].filter((row) => row.has).length;
      check(`${tag}: payroll lists every employee with attendance (${withAttendance})`, pay.data.lines.length === withAttendance, pay.data.lines.length);
      check(`${tag}: payroll daily wage = skill price of the month, paid days and deductions correct`, lineErrors.length === 0, lineErrors.slice(0, 3).join('; '));

      const register = await call('GET', '/attendance/wage-register', { cookie: admin, query: { ...ids, month } });
      check(`${tag}: wage register uses that month's rates`, register.status === 200 && ratesMatch(register.data.rates, rates), JSON.stringify(register.data.rates || register.data));
      if (register.status === 200) {
        lineErrors = [];
        for (const row of register.data.rows) {
          const model_ = expected.get(row.employeeId);
          const want = expectedRow(model.dailyOn(model_.employee, toDate), model_.paid, model_.employee, rates);
          if (row.grossPayment !== want.net || row.epf !== want.epf || row.esi !== want.esi || !near(row.bonus, want.bonus)) lineErrors.push(`${row.employeeName} ${row.bonus}/${row.epf}/${row.esi}/${row.grossPayment}≠${want.bonus}/${want.epf}/${want.esi}/${want.net}`);
        }
        check(`${tag}: FORM XVII rows (bonus, EPF, ESI, net)`, lineErrors.length === 0, lineErrors.slice(0, 3).join('; '));
      }
    }
  }

  for (const month of [...TEST_MONTHS, '2021-11']) {
    const wage = await call('GET', '/settings/documents/wage-register', { cookie: admin, query: { month } });
    const want = wageLevel(month);
    const got = wage.data.settings || {};
    check(`${month}: salary slip rates (Settings → wage register for the month)`, wage.status === 200 && ['bonusRate', 'epfRate', 'esiRate', 'esiWageCeiling'].every((field) => near(got[field], want[field], 0.0001)) && near(got.epfWageCeiling || 0, want.epfWageCeiling, 0.0001), JSON.stringify(got));
    const invoice = await call('GET', '/settings/documents/invoice', { cookie: admin, query: { month } });
    const wantInvoice = invoiceLevel(month);
    check(`${month}: invoice % for the month`, invoice.status === 200 && Object.keys(wantInvoice).every((field) => near(invoice.data.settings[field], wantInvoice[field], 0.0001)), JSON.stringify(invoice.data.settings));
  }

  section = 'Five-year-old month (before any data)';
  const [organization] = model.organizations;
  const location = model.locations.find((item) => String(item.organizationId) === String(organization._id));
  const ids = { organizationId: String(organization._id), locationId: String(location._id) };
  const old = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: '2021-11-01', toDate: '2021-11-30' } });
  check('Nov 2021 payroll answers with no employees paid', old.status === 200 && old.data.lines.length === 0, JSON.stringify(old.data).slice(0, 200));
  check('Nov 2021 payroll uses the rates valid before the first change (defaults), not today\'s', old.status === 200 && ratesMatch(old.data.rates, WAGE_DEFAULT), JSON.stringify(old.data.rates));
  const oldRegister = await call('GET', '/attendance/wage-register', { cookie: admin, query: { ...ids, month: '2021-11' } });
  check('Nov 2021 wage register answers', oldRegister.status === 200, oldRegister.status);
  const oldInvoice = await call('GET', `/organizations/${ids.organizationId}/locations/${ids.locationId}/invoices/preview`, { cookie: admin, query: { month: '2021-11' } });
  check('Nov 2021 invoice preview uses default % (before the first change)', oldInvoice.status === 200 && near(oldInvoice.data.settings.esicRate, 3.25) && near(oldInvoice.data.settings.serviceChargeRate, 0), JSON.stringify(oldInvoice.data.settings || oldInvoice.data).slice(0, 300));
}

async function testInvoices(model, admin) {
  section = 'Invoice preview uses the month\'s skill price and %';
  for (const [orgIndex, organization] of model.organizations.entries()) {
    const orgLocations = model.locations.filter((location) => String(location.organizationId) === String(organization._id));
    for (const [monthIndex, month] of ['2024-01', '2024-09', '2025-04', '2025-12', '2026-10'].entries()) {
      const location = orgLocations[(orgIndex * 2 + monthIndex) % orgLocations.length];
      const tag = `${month} ${organization.organizationName} / ${location.name}`;
      const rules = invoiceLevel(month);
      const preview = await call('GET', `/organizations/${organization._id}/locations/${location._id}/invoices/preview`, { cookie: admin, query: { month } });
      check(`${tag}: preview answers`, preview.status === 200, preview.status);
      if (preview.status !== 200) continue;
      check(`${tag}: invoice % are the month's`, Object.keys(rules).every((field) => near(preview.data.settings[field], rules[field], 0.0001)), JSON.stringify(preview.data.settings));
      const expected = await model.paidDays(location, `${month}-01`, lastDay(month));
      const working = [...expected.values()].filter((row) => row.paid > 0);
      const categories = [...new Set(working.map((row) => row.employee.skillCategory))].sort();
      const labour = preview.data.items.filter((item) => item.rateSource === 'auto' && item.section === 'service');
      const loading = (rules.epfRate + rules.esicRate + rules.bonusRate) / 100;
      const errors = [];
      categories.forEach((category, index) => {
        const group = working.filter((row) => row.employee.skillCategory === category);
        const manDays = group.reduce((sum, row) => sum + row.paid, 0);
        const wage = r2(group.reduce((sum, row) => sum + model.dailyOn(row.employee, lastDay(month)) * row.paid, 0) / manDays);
        const monthly = labour[index]?.qtySource !== 'mandays';
        const rate = r2(wage * (monthly ? 26 : 1) * (1 + loading) * (1 + rules.serviceChargeRate / 100));
        if (!labour[index] || !near(labour[index].rate, rate)) errors.push(`${category}: ${labour[index]?.rate} ≠ ${rate}`);
      });
      check(`${tag}: labour rate = month's wage × (1 + EPF + ESIC + bonus) × (1 + service)`, errors.length === 0 && labour.length === categories.length, errors.join('; ') || `${labour.length} lines for ${categories.length} categories`);
      const relieving = preview.data.items.find((item) => item.rateSource === 'relieving');
      if (relieving && working.length) {
        const manDays = working.reduce((sum, row) => sum + row.paid, 0);
        const wageAll = r2(working.reduce((sum, row) => sum + model.dailyOn(row.employee, lastDay(month)) * row.paid, 0) / manDays);
        const perDay = r2(wageAll * (1 + loading) * (1 + rules.serviceChargeRate / 100));
        const want = r2(perDay * rules.relievingRate / 100);
        check(`${tag}: relieving charge = ${rules.relievingRate}% of the month's per-day rate`, near(relieving.rate, want, 0.02), `${relieving.rate} vs ${want}`);
      }
      const yearly = preview.data.items.find((item) => item.description.startsWith('Annual tools'));
      const setupHasYearly = preview.data.setup.items.some((item) => item.frequency === 'yearly');
      if (setupHasYearly) check(`${tag}: yearly line only in April`, Boolean(yearly) === (month.slice(5) === '04'), yearly ? 'billed' : 'not billed');
    }
  }

  section = 'Saved invoices stay frozen';
  const saved = await ClientInvoice.find({}).lean();
  check('90 seeded invoices saved (Jun 2024, Jun 2025, Jun 2026 × 30 locations)', saved.length >= 90, saved.length);
  check('Invoice numbers are unique', new Set(saved.map((invoice) => invoice.invoiceNumber)).size === saved.length);
  const byFy = new Map();
  for (const invoice of saved) byFy.set(invoice.financialYear, [...(byFy.get(invoice.financialYear) || []), invoice.invoiceSeq]);
  for (const [fy, seqs] of byFy) {
    const sorted = [...seqs].sort((a, b) => a - b);
    check(`Financial year ${fy}: invoice numbers run 1..${sorted.length} without gaps`, sorted.every((seq, index) => seq === index + 1), sorted.join(','));
  }
  for (const invoice of saved.filter((_, index) => index % 6 === 0)) {
    const preview = await call('GET', `/organizations/${invoice.organizationId}/locations/${invoice.locationId}/invoices/preview`, { cookie: admin, query: { month: invoice.month } });
    check(`${invoice.invoiceNumber} (${invoice.month}): reopening shows the saved invoice unchanged`, preview.status === 200 && preview.data.invoice?.netPayable === invoice.netPayable && JSON.stringify(preview.data.invoice.items.map((item) => item.rate)) === JSON.stringify(invoice.items.map((item) => item.rate)), preview.data.invoice?.netPayable);
    const fresh = preview.data.items?.filter((item) => item.rateSource === 'auto').map((item) => item.rate) || [];
    const kept = invoice.items.filter((item) => item.section === 'service').slice(0, fresh.length).map((item) => item.rate);
    check(`${invoice.invoiceNumber} (${invoice.month}): saved labour rates equal that month's rates`, JSON.stringify(fresh) === JSON.stringify(kept), `${fresh} vs ${kept}`);
  }

  section = 'Invoice validations';
  const invoice = saved[0];
  const base = `/organizations/${invoice.organizationId}/locations/${invoice.locationId}/invoices`;
  check('Preview with an invalid month is refused', (await call('GET', `${base}/preview`, { cookie: admin, query: { month: '2025-13' } })).status === 400);
  const wrongLines = await call('PUT', `${base}/2025-02`, { cookie: admin, body: { invoiceDate: '2025-03-05', items: [{ description: 'x', qty: 1, rate: 1 }] } });
  check('Saving with lines that do not match the setup is refused (409)', wrongLines.status === 409, `${wrongLines.status} ${wrongLines.data.message}`);
  const preview = (await call('GET', `${base}/preview`, { cookie: admin, query: { month: '2025-02' } })).data;
  const duplicate = await call('PUT', `${base}/2025-02`, { cookie: admin, body: { invoiceDate: '2025-03-05', invoiceNumber: invoice.invoiceNumber, items: preview.items } });
  check('Saving with an invoice number already used is refused (409)', duplicate.status === 409, `${duplicate.status} ${duplicate.data.message}`);
  const noDate = await call('PUT', `${base}/2025-02`, { cookie: admin, body: { items: preview.items } });
  check('Saving without an invoice date is refused', noDate.status === 400, `${noDate.status} ${noDate.data.message}`);
  const badSetup = await call('PUT', `/organizations/${invoice.organizationId}/locations/${invoice.locationId}/invoice-setup`, { cookie: admin, body: { autoLabour: true, items: [{ description: 'Kit', section: 'supply', rateSource: 'fixed', rate: 10, defaultQty: 1, frequency: 'yearly', billMonth: '' }] } });
  check('Invoice setup: yearly line without a month is refused', badSetup.status === 400, `${badSetup.status} ${badSetup.data.message}`);
}

async function testBankAndPayrollRuns(model, admin) {
  section = 'Bank payment list = FORM XVII net of every location';
  for (const month of ['2024-04', '2025-07', '2026-10']) {
    const bank = await call('GET', '/attendance/bank-payments', { cookie: admin, query: { month } });
    check(`${month}: bank list answers`, bank.status === 200, bank.status);
    if (bank.status !== 200) continue;
    let registerTotal = 0;
    const amounts = new Map();
    for (const location of model.locations) {
      const register = await call('GET', '/attendance/wage-register', { cookie: admin, query: { organizationId: String(location.organizationId), locationId: String(location._id), month } });
      registerTotal += register.data.totals.grossPayment;
      for (const row of register.data.rows) if (row.grossPayment > 0) amounts.set(row.employeeId, row.grossPayment);
    }
    check(`${month}: bank total ${bank.data.summary.total} = sum of 30 wage registers ${registerTotal}`, bank.data.summary.total === registerTotal);
    const mismatched = bank.data.rows.filter((row) => amounts.get(row.employeeId) !== row.amount);
    check(`${month}: each bank row amount = the employee's register net`, mismatched.length === 0 && bank.data.rows.length === amounts.size, mismatched.slice(0, 3).map((row) => row.employeeName).join(', '));
    check(`${month}: every bank row has account, IFSC and bank`, bank.data.summary.missingBankDetails === 0, bank.data.summary.missingBankDetails);
  }

  section = 'Bank letters and payroll runs';
  const created = [];
  try {
    const locations = model.locations.slice(0, 2).map((location) => String(location._id));
    const noLocation = await call('POST', '/attendance/bank-invoice/batches', { cookie: admin, body: { month: '2025-07', locationIds: [], letterDate: '2025-08-02' } });
    check('Bank letter without locations is refused', noLocation.status === 400, noLocation.status);
    const badDate = await call('POST', '/attendance/bank-invoice/batches', { cookie: admin, body: { month: '2025-07', locationIds: locations, letterDate: '02-08-2025' } });
    check('Bank letter with an invalid letter date is refused', badDate.status === 400, badDate.status);
    const batch = await call('POST', '/attendance/bank-invoice/batches', { cookie: admin, body: { month: '2025-07', locationIds: locations, letterDate: '2025-08-02', format: 'pdf' } });
    check('Bank letter for Jul 2025 is created', batch.status === 201, `${batch.status} ${batch.data.message || ''}`);
    if (batch.status === 201) {
      created.push(batch.data.batch.id);
      const sum = batch.data.rows.reduce((total, row) => total + row.amount, 0);
      check('Bank letter total = sum of its rows', near(batch.data.batch.total, sum), `${batch.data.batch.total} vs ${sum}`);
      const again = await call('POST', '/attendance/bank-invoice/batches', { cookie: admin, body: { month: '2025-07', locationIds: locations, letterDate: '2025-08-02' } });
      check('Printing the same locations again is refused until cancelled (409)', again.status === 409, again.status);
      const cancelOne = await call('POST', `/attendance/bank-invoice/batches/${batch.data.batch.id}/cancel`, { cookie: admin, body: { locationId: locations[0] } });
      check('One location of the letter can be cancelled', cancelOne.status === 200 && cancelOne.data.batch.status === 'printed' && cancelOne.data.batch.locations.some((location) => location.status === 'cancelled'), JSON.stringify(cancelOne.data.batch?.locations?.map((location) => location.status)));
      const reprintCancelled = await call('POST', '/attendance/bank-invoice/batches', { cookie: admin, body: { month: '2025-07', locationIds: [locations[0]], letterDate: '2025-08-03' } });
      check('The cancelled location can be printed again', reprintCancelled.status === 201, reprintCancelled.status);
      if (reprintCancelled.status === 201) created.push(reprintCancelled.data.batch.id);
      const listed = await call('GET', '/attendance/bank-invoice/locations', { cookie: admin, query: { month: '2025-07' } });
      check('Bank letter location list shows the printed locations', listed.status === 200 && listed.data.summary.printed === 2, JSON.stringify(listed.data.summary));
    }
    const run = await call('POST', '/attendance/payroll-runs/batches', { cookie: admin, body: { month: '2024-04', locationIds: [locations[0]], format: 'excel' } });
    check('Payroll run for Apr 2024 is created', run.status === 201, `${run.status} ${run.data.message || ''}`);
    if (run.status === 201) {
      created.push(run.data.batch.id);
      check('Payroll run of Apr 2024 uses Apr 2024 bonus/EPF/ESI', ratesMatch(run.data.payroll.rates, wageLevel('2024-04')), JSON.stringify(run.data.payroll.rates));
    }
  } finally {
    await BankInvoiceBatch.deleteMany({ _id: { $in: created } });
  }
}

/** Changes made today must not reach old months; the changed settings and prices are restored afterwards. */
async function testChangesToday(model, admin) {
  section = 'A rate or price change today leaves old months alone';
  const organization = model.organizations[1];
  const location = model.locations.find((item) => String(item.organizationId) === String(organization._id));
  const ids = { organizationId: String(organization._id), locationId: String(location._id) };
  const thisMonth = todayIndia().slice(0, 7);
  const wageDoc = await DocumentSettings.findOne({ key: 'wageRegister' }).lean();
  const invoiceDoc = await DocumentSettings.findOne({ key: 'invoice' }).lean();
  const skill = await MasterData.findOne({ type: 'skillCategory', code: 'un-skilled' }).lean();
  const skillEmployees = await Employee.find({ skillCategory: /^un-skilled$/i }).select('basicPay dailySalary').lean();
  const savedInvoice = await ClientInvoice.findOne({ month: '2026-06' }).lean();
  try {
    const current = (await call('GET', '/settings/documents/wage-register', { cookie: admin })).data.settings;
    const { rateHistory, updatedAt, ...values } = current;
    const put = await call('PUT', '/settings/documents/wage-register', { cookie: admin, body: { ...values, bonusRate: '15', esiRate: '2', ratesEffectiveFrom: '' } });
    check('Admin changes the wage register bonus to 15% today', put.status === 200 && put.data.settings.ratesEffectiveFrom === thisMonth, `${put.status} ${put.data.settings?.ratesEffectiveFrom}`);
    const july = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: '2025-07-01', toDate: '2025-07-31' } });
    check('Jul 2025 payroll still uses 12% bonus / 1% ESI', ratesMatch(july.data.rates, wageLevel('2025-07')), JSON.stringify(july.data.rates));
    const october = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: '2026-10-01', toDate: '2026-10-31' } });
    check('Oct 2026 (last month) payroll still uses 8.33%', ratesMatch(october.data.rates, wageLevel('2026-10')), JSON.stringify(october.data.rates));
    const now = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: `${thisMonth}-01`, toDate: lastDay(thisMonth) } });
    check('This month\'s payroll uses the new 15% bonus', near(now.data.rates.bonusRate, 15) && near(now.data.rates.esiRate, 2), JSON.stringify(now.data.rates));
    const slipOld = await call('GET', '/settings/documents/wage-register', { cookie: admin, query: { month: '2025-07' } });
    check('Salary slip of Jul 2025 still gets 12% bonus', near(slipOld.data.settings.bonusRate, 12), slipOld.data.settings.bonusRate);

    const invoiceCurrent = (await call('GET', '/settings/documents/invoice', { cookie: admin })).data.settings;
    const { rateHistory: ih, updatedAt: iu, ...invoiceValues } = invoiceCurrent;
    await call('PUT', '/settings/documents/invoice', { cookie: admin, body: { ...invoiceValues, epfRate: '20', ratesEffectiveFrom: '' } });
    const oldPreview = await call('GET', `/organizations/${ids.organizationId}/locations/${ids.locationId}/invoices/preview`, { cookie: admin, query: { month: '2025-04' } });
    check('Apr 2025 invoice preview still uses EPF 13.5%', near(oldPreview.data.settings.epfRate, 13.5), oldPreview.data.settings.epfRate);
    const newPreview = await call('GET', `/organizations/${ids.organizationId}/locations/${ids.locationId}/invoices/preview`, { cookie: admin, query: { month: thisMonth } });
    check('This month\'s invoice preview uses EPF 20%', near(newPreview.data.settings.epfRate, 20), newPreview.data.settings.epfRate);

    const raised = skill.rates.map((rate) => ({ ...rate, salary: r2(rate.salary * 1.1) }));
    const patch = await call('PATCH', `/master-data/${skill._id}`, { cookie: admin, body: { rates: raised, timeZone: 'Asia/Kolkata' } });
    check('Admin raises the Un-skilled price by 10% today', patch.status === 200, `${patch.status} ${patch.data.message || ''}`);
    const employee = model.employees.find((item) => sameText(item.skillCategory, 'Un-skilled') && String(item.organizationId) === ids.organizationId && item.status === 'active');
    const empLocation = model.locations.find((item) => String(item._id) === String(employee.locationId));
    const empIds = { organizationId: ids.organizationId, locationId: String(empLocation._id) };
    const octPay = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...empIds, fromDate: '2026-10-01', toDate: '2026-10-31' } });
    const octLine = octPay.data.lines.find((line) => line.employeeId === String(employee._id));
    check(`Oct 2026 payroll of ${employee.name} keeps the old daily wage`, octLine && near(octLine.dailySalary, model.dailyOn(employee, '2026-10-31')), `${octLine?.dailySalary} vs ${model.dailyOn(employee, '2026-10-31')}`);
    const jan24 = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...empIds, fromDate: '2024-01-01', toDate: '2024-01-31' } });
    const janLine = jan24.data.lines.find((line) => line.employeeId === String(employee._id));
    check(`Jan 2024 payroll of ${employee.name} keeps the 2024 daily wage`, janLine && near(janLine.dailySalary, model.dailyOn(employee, '2024-01-31')), `${janLine?.dailySalary} vs ${model.dailyOn(employee, '2024-01-31')}`);
    const fresh = await call('GET', `/employees/${employee._id}`, { cookie: admin });
    const newBasic = raised.find((rate) => sameText(rate.governmentType, organization.governmentType) && sameText(rate.area, organization.area)).salary;
    check(`${employee.name}'s profile shows the new basic pay`, near(fresh.data.employee?.basicPay ?? fresh.data.basicPay, newBasic), JSON.stringify(fresh.data).slice(0, 150));
    const nowPay = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...empIds, fromDate: `${thisMonth}-01`, toDate: lastDay(thisMonth) } });
    const nowLine = nowPay.data.lines.find((line) => line.employeeId === String(employee._id));
    check(`This month's payroll of ${employee.name} uses the new price`, nowLine && near(nowLine.basicPay, newBasic), `${nowLine?.basicPay} vs ${newBasic}`);
    const reopened = await call('GET', `/organizations/${savedInvoice.organizationId}/locations/${savedInvoice.locationId}/invoices/preview`, { cookie: admin, query: { month: '2026-06' } });
    check('Saved Jun 2026 invoice is unchanged after the changes', reopened.data.invoice?.netPayable === savedInvoice.netPayable, `${reopened.data.invoice?.netPayable} vs ${savedInvoice.netPayable}`);
  } finally {
    await DocumentSettings.replaceOne({ _id: wageDoc._id }, wageDoc);
    await DocumentSettings.replaceOne({ _id: invoiceDoc._id }, invoiceDoc);
    await MasterData.replaceOne({ _id: skill._id }, skill);
    await Employee.bulkWrite(skillEmployees.map(({ _id, basicPay, dailySalary }) => ({ updateOne: { filter: { _id }, update: { $set: { basicPay, dailySalary } } } })));
  }

  section = 'Skill price changing in the middle of a month (16 Sep 2026)';
  const employee = model.employees.find((item) => item.status === 'active');
  const empLocation = model.locations.find((item) => String(item._id) === String(employee.locationId));
  const empIds = { organizationId: String(employee.organizationId), locationId: String(empLocation._id) };
  for (const [fromDate, toDate, label] of [['2026-09-01', '2026-09-15', '1–15 Sep (old price)'], ['2026-09-16', '2026-09-30', '16–30 Sep (new price)'], ['2026-09-01', '2026-09-30', 'whole Sep (price on the last day)']]) {
    const pay = await call('GET', '/attendance/payroll', { cookie: admin, query: { ...empIds, fromDate, toDate } });
    const line = pay.data.lines.find((item) => item.employeeId === String(employee._id));
    check(`${label}: daily wage ${model.dailyOn(employee, toDate)}`, line && near(line.dailySalary, model.dailyOn(employee, toDate)), line?.dailySalary);
  }
}

async function testAttendance(model, admin, orgCookies) {
  section = 'Attendance marking and rules';
  const today = todayIndia();
  const touched = [];
  const remember = async (employeeId, date) => {
    const existing = await Attendance.findOne({ employeeId, date }).lean();
    touched.push({ employeeId, date, existing });
  };
  const employee = model.employees.find((item) => item.status === 'active');
  const organizationId = String(employee.organizationId);
  const locationId = String(employee.locationId);
  try {
    await remember(employee._id, today);
    const present = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, locationId, date: today, status: 'present' } });
    check('Admin marks today present', present.status === 200 && present.data.attendance.status === 'present', `${present.status} ${present.data.message || ''}`);
    const half = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, locationId, date: today, status: 'half_day' } });
    check('Admin changes it to half day (no duplicate record)', half.status === 200 && (await Attendance.countDocuments({ employeeId: employee._id, date: today })) === 1, half.status);
    const listed = await call('GET', '/attendance', { cookie: admin, query: { organizationId, date: today } });
    check('Today\'s list shows the half day', listed.status === 200 && JSON.stringify(listed.data).includes(String(employee._id)), listed.status);
    const location = model.locations.find((item) => String(item._id) === locationId);
    const paid = await model.paidDays(location, `${today.slice(0, 7)}-01`, today);
    const pay = await call('GET', '/attendance/payroll', { cookie: admin, query: { organizationId, locationId, fromDate: `${today.slice(0, 7)}-01`, toDate: today } });
    const line = pay.data.lines.find((item) => item.employeeId === String(employee._id));
    check('Half day counts 0.5 paid day in payroll', line && near(line.paidDays, paid.get(String(employee._id)).paid), `${line?.paidDays} vs ${paid.get(String(employee._id)).paid}`);

    let sunday = today;
    while (new Date(`${sunday}T00:00:00Z`).getUTCDay() !== 0) sunday = shift(sunday, 1);
    const onSunday = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, date: shift(sunday, -7), status: 'present' } });
    check('Sunday cannot be marked', onSunday.status === 400, `${onSunday.status} ${onSunday.data.message}`);
    check('Unknown status is refused', (await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, date: today, status: 'late' } })).status === 400);
    check('Impossible date 2026-02-30 is refused', (await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, date: '2026-02-30', status: 'present' } })).status === 400);
    check('Admin must say which organization', (await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), date: today, status: 'present' } })).status === 400);
    const otherOrg = model.organizations.find((item) => String(item._id) !== organizationId);
    check('Employee of another organization is not found (404)', (await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId: String(otherOrg._id), date: today, status: 'present' } })).status === 404);

    const blocked = model.employees.find((item) => item.status === 'disabled');
    const blockedLoc = String(blocked.locationId);
    const afterBlock = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(blocked._id), organizationId: String(blocked.organizationId), locationId: blockedLoc, date: '2026-07-01', status: 'present' } });
    check(`Blocked employee (${blocked.name}, blocked ${blocked.disabledOn}) cannot get attendance after the block`, afterBlock.status === 400, `${afterBlock.status} ${afterBlock.data.message}`);
    const before = await Attendance.findOne({ employeeId: blocked._id, date: '2026-06-10' }).lean();
    await remember(blocked._id, '2026-06-10');
    const beforeBlock = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(blocked._id), organizationId: String(blocked.organizationId), locationId: blockedLoc, date: '2026-06-10', status: before?.status || 'present' } });
    check('Blocked employee can still be corrected before the block date', beforeBlock.status === 200, `${beforeBlock.status} ${beforeBlock.data.message}`);
    const blockedLocation = model.locations.find((item) => String(item._id) === blockedLoc);
    const julyPay = await call('GET', '/attendance/payroll', { cookie: admin, query: { organizationId: String(blocked.organizationId), locationId: blockedLoc, fromDate: '2026-07-01', toDate: '2026-07-31' } });
    check('Blocked employee is not paid for months after the block', julyPay.status === 200 && !julyPay.data.lines.some((item) => item.employeeId === String(blocked._id)));
    const junePay = await call('GET', '/attendance/payroll', { cookie: admin, query: { organizationId: String(blocked.organizationId), locationId: blockedLoc, fromDate: '2026-06-01', toDate: '2026-06-30' } });
    const juneExpected = (await model.paidDays(blockedLocation, '2026-06-01', '2026-06-30')).get(String(blocked._id)).paid;
    const juneLine = junePay.data.lines.find((item) => item.employeeId === String(blocked._id));
    check('Blocked employee is paid for June days before the block', juneLine && near(juneLine.paidDays, juneExpected), `${juneLine?.paidDays} vs ${juneExpected}`);

    const future = shift(today, 20);
    const futureDay = new Date(`${future}T00:00:00Z`).getUTCDay() === 0 ? shift(future, 1) : future;
    await remember(employee._id, futureDay);
    const futureMark = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(employee._id), organizationId, locationId, date: futureDay, status: 'present' } });
    check(`Admin cannot mark attendance for a future date (${futureDay})`, futureMark.status === 400, `${futureMark.status} — accepted`);
    const late = model.employees.find((item) => item.dateOfJoining === '2025-05-12' && item.status === 'active');
    await remember(late._id, '2024-02-01');
    const beforeJoin = await call('PUT', '/attendance', { cookie: admin, body: { employeeId: String(late._id), organizationId: String(late.organizationId), locationId: String(late.locationId), date: '2024-02-01', status: 'present' } });
    check(`Attendance before the joining date (${late.name} joined ${late.dateOfJoining}) is refused`, beforeJoin.status === 400, `${beforeJoin.status} — accepted`);

    section = 'Organization login';
    const org = model.organizations.find((item) => String(item._id) === organizationId);
    const orgCookie = orgCookies.get(organizationId);
    const orgEmployee = model.employees.find((item) => String(item.organizationId) === organizationId && item.status === 'active' && String(item._id) !== String(employee._id));
    await remember(orgEmployee._id, today);
    const orgMark = await call('PUT', '/attendance', { cookie: orgCookie, body: { employeeId: String(orgEmployee._id), date: today, status: 'present', timeZone: 'Asia/Kolkata' } });
    check(`${org.organizationName} marks today's attendance`, orgMark.status === 200, `${orgMark.status} ${orgMark.data.message || ''}`);
    let yesterday = shift(today, -1);
    if (new Date(`${yesterday}T00:00:00Z`).getUTCDay() === 0) yesterday = shift(yesterday, -1);
    const orgYesterday = await call('PUT', '/attendance', { cookie: orgCookie, body: { employeeId: String(orgEmployee._id), date: yesterday, status: 'absent', timeZone: 'Asia/Kolkata' } });
    check('Organization cannot change a past day', orgYesterday.status === 400, `${orgYesterday.status} ${orgYesterday.data.message}`);
    const foreign = model.employees.find((item) => String(item.organizationId) !== organizationId && item.status === 'active');
    check('Organization cannot mark another organization\'s employee', (await call('PUT', '/attendance', { cookie: orgCookie, body: { employeeId: String(foreign._id), date: today, status: 'present', timeZone: 'Asia/Kolkata' } })).status === 404);
    check('Organization cannot open the bank payment list (403)', (await call('GET', '/attendance/bank-payments', { cookie: orgCookie, query: { month: '2026-10' } })).status === 403);
    check('Organization cannot see another organization\'s locations (403)', (await call('GET', `/organizations/${foreign.organizationId}/locations`, { cookie: orgCookie })).status === 403);
    check('Organization cannot open invoices (admin only)', [403].includes((await call('GET', `/organizations/${organizationId}/locations/${locationId}/invoices/preview`, { cookie: orgCookie, query: { month: '2026-10' } })).status));
    check('Organization cannot change settings (403)', (await call('PUT', '/settings/documents/wage-register', { cookie: orgCookie, body: { bonusRate: '50' } })).status === 403);
    check('Organization cannot create accounts (403)', (await call('POST', '/auth/register', { cookie: orgCookie, body: { name: 'x', email: 'x@y.z', password: 'Password1!' } })).status === 403);
    check('Organization cannot edit an employee (403)', (await call('PATCH', `/employees/${orgEmployee._id}`, { cookie: orgCookie, body: { name: 'Changed' } })).status === 403);
    const orgRegister = await call('GET', '/attendance/wage-register', { cookie: orgCookie, query: { locationId, month: '2025-07' } });
    check('Organization sees its wage register with Jul 2025 rates', orgRegister.status === 200 && ratesMatch(orgRegister.data.rates, wageLevel('2025-07')), orgRegister.status);
    const orgPay = await call('GET', '/attendance/payroll', { cookie: orgCookie, query: { locationId, fromDate: '2025-07-01', toDate: '2025-07-31' } });
    check('Organization payroll hides full bank account numbers', orgPay.status === 200 && orgPay.data.lines.every((item) => !item.bankAccountNumber || item.bankAccountNumber.startsWith('****')), orgPay.data.lines?.[0]?.bankAccountNumber);
    const orgEmployeeView = await call('GET', `/employees/${orgEmployee._id}`, { cookie: orgCookie });
    check('Organization does not receive Aadhaar numbers', orgEmployeeView.status === 200 && !(orgEmployeeView.data.employee || orgEmployeeView.data).aadhaarNumber);

    section = 'Attendance register and 26-day cap';
    const fullMonth = '2024-05';
    for (const location of model.locations.slice(0, 6)) {
      const register = await call('GET', '/attendance/register', { cookie: admin, query: { organizationId: String(location.organizationId), locationId: String(location._id), month: fullMonth, timeZone: 'Asia/Kolkata' } });
      check(`${location.name} May 2024 register answers`, register.status === 200, register.status);
      if (register.status !== 200) continue;
      check(`${location.name}: no employee shows more than 26 days present`, register.data.rows.every((row) => row.totalPresent <= 26), register.data.rows.map((row) => row.totalPresent).join(','));
      const expected = await model.paidDays(location, `${fullMonth}-01`, lastDay(fullMonth));
      const errors = register.data.rows.filter((row) => {
        const raw = expected.get(row.employeeId);
        return row.totalPresent !== Math.min(26, raw.present + raw.half * 0.5);
      });
      check(`${location.name}: register totals = present + ½ half days`, errors.length === 0, errors.map((row) => row.name).join(', '));
    }
    const fullTimer = model.employees.find((item) => item.status === 'active');
    const fullLocation = model.locations.find((item) => String(item._id) === String(fullTimer.locationId));
    const rows = await model.paidDays(fullLocation, '2024-05-01', '2024-05-31');
    const capped = [...rows.values()].find((row) => row.present >= 27);
    if (capped) {
      const pay = await call('GET', '/attendance/payroll', { cookie: admin, query: { organizationId: String(fullLocation.organizationId), locationId: String(fullLocation._id), fromDate: '2024-05-01', toDate: '2024-05-31' } });
      const line = pay.data.lines.find((item) => item.employeeId === String(capped.employee._id));
      check(`${capped.employee.name}: 27 days present in May 2024 → paid 26`, line && line.presentDays === 27 && line.paidDays === 26, `${line?.presentDays} present, ${line?.paidDays} paid`);
      const quarter = await call('GET', '/attendance/payroll', { cookie: admin, query: { organizationId: String(fullLocation.organizationId), locationId: String(fullLocation._id), fromDate: '2024-04-01', toDate: '2024-06-30' } });
      const quarterLine = quarter.data.lines.find((item) => item.employeeId === String(capped.employee._id));
      const quarterExpected = (await model.paidDays(fullLocation, '2024-04-01', '2024-06-30')).get(String(capped.employee._id)).paid;
      check(`${capped.employee.name}: Apr–Jun 2024 payroll caps each month at 26 (${quarterExpected})`, quarterLine && near(quarterLine.paidDays, quarterExpected), quarterLine?.paidDays);
    }
  } finally {
    for (const { employeeId, date, existing } of touched.reverse()) {
      if (existing) await Attendance.replaceOne({ _id: existing._id }, existing, { upsert: true });
      else await Attendance.deleteOne({ employeeId, date });
    }
  }
}

async function testDashboard(model, admin, orgCookies) {
  section = 'Dashboard';
  const fromDate = '2026-10-01';
  const toDate = '2026-10-31';
  const summary = await call('GET', '/dashboard/summary', { cookie: admin, query: { fromDate, toDate, timeZone: 'Asia/Kolkata' } });
  check('Admin dashboard answers', summary.status === 200, summary.status);
  if (summary.status === 200) {
    const totals = summary.data.totals;
    const active = model.employees.filter((employee) => employee.status === 'active').length;
    check('Totals: 5 organizations, 30 locations', totals.organizations === 5 && totals.locations === 30 && totals.activeLocations === 30, JSON.stringify(totals));
    check(`Totals: ${model.employees.length} employees, ${active} active, 0 unassigned`, totals.employees === model.employees.length && totals.activeEmployees === active && totals.unassignedEmployees === 0, JSON.stringify(totals));
    const records = await Attendance.find({ date: { $gte: fromDate, $lte: toDate } }).select('status').lean();
    const count = (statuses) => records.filter((record) => statuses.includes(record.status)).length;
    const period = summary.data.period;
    check('October present / absent / half day counts match the records', period.present === count(['present']) && period.absent === count(['absent']) && period.halfDay === count(['half_day']), `${period.present}/${period.absent}/${period.halfDay} vs ${count(['present'])}/${count(['absent'])}/${count(['half_day'])}`);
    check('October leave and off counts match', period.leave === count(['leave', 'paid_leave', 'casual_leave', 'sick_leave']) && period.off === count(['weekly_off', 'holiday']), `${period.leave}/${period.off}`);
    const working = period.present + period.absent + period.halfDay + period.leave;
    check('Attendance rate = (present + ½ half) / working marks', near(period.attendanceRate, Math.round(((period.present + period.halfDay / 2) / working) * 1000) / 10, 0.05), period.attendanceRate);
    let paid = 0;
    let wages = 0;
    for (const location of model.locations) {
      for (const row of (await model.paidDays(location, fromDate, toDate)).values()) {
        if (!row.has) continue;
        paid += row.paid;
        wages += r2(model.dailyOn(row.employee, toDate) * row.paid);
      }
    }
    check(`Paid days in October = ${r2(paid)}`, near(period.paidDays, paid, 0.05), period.paidDays);
    check(`Wages in October = ${r2(wages)} (October skill prices)`, near(period.wages?.[0]?.total, wages, 0.5), JSON.stringify(period.wages));
    check('Trend has one point per day', summary.data.trend.length === 31, summary.data.trend.length);
    check('Breakdown by skill category covers all active employees', summary.data.bySkillCategory.reduce((sum, item) => sum + item.value, 0) === active, JSON.stringify(summary.data.bySkillCategory));
  }
  check('Dashboard range longer than 366 days is refused', (await call('GET', '/dashboard/summary', { cookie: admin, query: { fromDate: '2024-01-01', toDate: '2026-10-31' } })).status === 400);
  check('Dashboard start after end is refused', (await call('GET', '/dashboard/summary', { cookie: admin, query: { fromDate: '2026-10-31', toDate: '2026-10-01' } })).status === 400);
  check('Dashboard invalid date is refused', (await call('GET', '/dashboard/summary', { cookie: admin, query: { fromDate: '2026-02-31', toDate: '2026-03-01' } })).status === 400);
  check('Dashboard without login is refused (401)', (await call('GET', '/dashboard/summary')).status === 401);

  for (const organization of model.organizations) {
    const cookie = orgCookies.get(String(organization._id));
    const orgSummary = await call('GET', '/dashboard/summary', { cookie, query: { fromDate, toDate, timeZone: 'Asia/Kolkata' } });
    const own = model.employees.filter((employee) => String(employee.organizationId) === String(organization._id));
    const ok = orgSummary.status === 200
      && orgSummary.data.totals.locations === 6
      && orgSummary.data.totals.employees === own.length
      && orgSummary.data.totals.organizations === null
      && orgSummary.data.locations.length === 6
      && orgSummary.data.locations.reduce((sum, site) => sum + site.employees, 0) === own.filter((employee) => employee.status === 'active').length;
    check(`${organization.organizationName} dashboard shows only its 6 locations and ${own.length} employees`, ok, JSON.stringify(orgSummary.data.totals || orgSummary.data));
  }

  section = 'Lists';
  const organizations = await call('GET', '/organizations', { cookie: admin, query: { page: 1, limit: 10 } });
  check('Organization list: 5 organizations', organizations.status === 200 && organizations.data.stats.total === 5, JSON.stringify(organizations.data.stats));
  for (const organization of model.organizations.slice(0, 2)) {
    const locations = await call('GET', `/organizations/${organization._id}/locations`, { cookie: admin, query: { page: 1, limit: 10 } });
    check(`${organization.organizationName}: 6 locations, designations Mali/Supervisor/Sweeper/Security Guard only`, locations.status === 200 && locations.data.summary.total === 6 && locations.data.designations.every((name) => ['Mali', 'Supervisor', 'Sweeper', 'Security Guard'].includes(name)), JSON.stringify(locations.data.designations));
  }
  const employees = await call('GET', '/employees', { cookie: admin, query: { page: 1, limit: 100 } });
  check('Employee list answers with pagination', employees.status === 200 && (employees.data.pagination?.total ?? employees.data.employees?.length) === model.employees.length, JSON.stringify(employees.data.pagination));
  const incomplete = model.employees.filter((employee) => !employee.aadhaarNumber || !employee.bankAccountNumber || !employee.bankRoutingCode || !employee.uan || !employee.phone || !employee.dateOfBirth || !employee.parentName || !employee.address);
  check('Every employee has Aadhaar, bank, UAN, phone, DOB, parent name and address', incomplete.length === 0, incomplete.map((employee) => employee.name).join(', '));
  const masterDesignations = (await MasterData.find({ type: 'designation' }).lean()).map((item) => item.name);
  check('No new designation was added (still Cook, Mali, Supervisor, Security Guard, Sweeper)', masterDesignations.length === 5, masterDesignations.join(', '));
}

async function testValidations(model, admin) {
  section = 'Validations: employees';
  const organization = model.organizations[0];
  const location = model.locations.find((item) => String(item.organizationId) === String(organization._id) && item.designation === 'Mali');
  const valid = {
    organizationId: String(organization._id), locationId: String(location._id), name: 'Validation Test', email: 'validation.test@shreeji.local',
    designation: 'Mali', skillCategory: 'Un-skilled', employmentType: 'contractual', phone: '+91 98765 43210',
    aadhaarNumber: '234567890123', aadhaarConsent: true, bankName: 'SBI', bankBranch: 'Gangtok', bankAccountHolder: 'Validation Test', bankAccountNumber: '12345678901', bankRoutingCode: 'SBIN0001234',
  };
  const cases = [
    ['missing name', { name: '' }, 400],
    ['invalid email', { email: 'not-an-email' }, 400],
    ['11-digit Aadhaar', { aadhaarNumber: '23456789012' }, 400],
    ['Aadhaar without consent', { aadhaarConsent: false }, 400],
    ['only some bank details', { bankRoutingCode: '' }, 400],
    ['designation not matching the location', { designation: 'Sweeper' }, 400],
    ['negative DA', { dearnessAllowance: -5 }, 400],
    ['phone with letters', { phone: 'call me' }, 400],
    ['unknown skill category', { skillCategory: 'Expert' }, 400],
    ['disabled designation (Cook)', { designation: 'Cook', locationId: '' }, 400],
    ['invalid organization id', { organizationId: '123' }, 400],
  ];
  for (const [label, change, status] of cases) {
    const response = await call('POST', '/employees', { cookie: admin, body: { ...valid, ...change } });
    check(`Employee with ${label} is refused (${status})`, response.status === status, `${response.status} ${response.data.message || ''}`);
  }
  const existing = model.employees.find((employee) => String(employee.organizationId) === String(organization._id));
  const duplicate = await call('POST', '/employees', { cookie: admin, body: { ...valid, email: existing.email } });
  check('Employee with an email already used in the organization is refused (409)', duplicate.status === 409, duplicate.status);
  const created = await call('POST', '/employees', { cookie: admin, body: valid });
  check('A valid employee is created and gets the skill price as basic pay', created.status === 201 && near(created.data.employee.basicPay, model.todayPrice('Un-skilled', organization)), `${created.status} ${created.data.message || created.data.employee?.basicPay}`);
  if (created.status === 201) await call('DELETE', `/employees/${created.data.employee.id}`, { cookie: admin });

  section = 'Validations: organizations, locations, logins';
  const orgBase = { name: 'Test', organizationName: 'Test Org', email: 'test.org@shreeji.local', password: 'Password@1', governmentType: 'State', area: 'A - Inside city' };
  for (const [label, change] of [['short password', { password: 'abc' }], ['invalid email', { email: 'bad' }], ['area without government type', { governmentType: '' }], ['invalid website', { website: 'ftp://x' }], ['unknown government type', { governmentType: 'Federal' }]]) {
    const response = await call('POST', '/organizations', { cookie: admin, body: { ...orgBase, ...change } });
    check(`Organization with ${label} is refused`, response.status === 400, `${response.status} ${response.data.message || ''}`);
  }
  const dupOrg = await call('POST', '/organizations', { cookie: admin, body: { ...orgBase, email: organization.email } });
  check('Organization with an email already used is refused (409)', dupOrg.status === 409, dupOrg.status);
  const locBase = `/organizations/${organization._id}/locations`;
  check('Location without a work name is refused', (await call('POST', locBase, { cookie: admin, body: { name: 'X', designation: 'Mali' } })).status === 400);
  check('Location with a disabled designation (Cook) is refused', (await call('POST', locBase, { cookie: admin, body: { workName: 'Housekeeping', name: 'X', designation: 'Cook' } })).status === 400);
  const mismatch = await call('POST', locBase, { cookie: admin, body: { workName: 'Security', name: 'Mismatch test', designation: 'Mali' } });
  check('Location whose designation is not part of its work name (Security + Mali) is refused', mismatch.status === 400, `${mismatch.status} — accepted`);
  if (mismatch.status === 201) await Location.deleteOne({ _id: mismatch.data.location?.id || mismatch.data.id });
  const wrong = await login(organization.email, 'wrong-password');
  check('Login with a wrong password is refused (401)', wrong.status === 401, wrong.status);
  check('Creating accounts without login is refused (401)', (await call('POST', '/auth/register', { body: { name: 'x', email: 'x@y.z', password: 'Password1!' } })).status === 401);

  section = 'Validations: settings and master data';
  const current = (await call('GET', '/settings/documents/wage-register', { cookie: admin })).data.settings;
  const { rateHistory, updatedAt, ...values } = current;
  for (const [label, change] of [['bonus "abc"', { bonusRate: 'abc' }], ['EPF 150%', { epfRate: '150' }], ['month 2026-13', { ratesEffectiveFrom: '2026-13' }], ['negative ESI', { esiRate: '-1' }]]) {
    const response = await call('PUT', '/settings/documents/wage-register', { cookie: admin, body: { ...values, ...change } });
    check(`Wage register settings with ${label} are refused`, response.status === 400, `${response.status} ${response.data.message || ''}`);
  }
  check('Settings for an unknown document are refused', [400, 404].includes((await call('GET', '/settings/documents/unknown')).status) || (await call('GET', '/settings/documents/unknown', { cookie: admin })).status >= 400);
  const skill = await MasterData.findOne({ type: 'skillCategory', code: 'skilled' }).lean();
  const negative = await call('PATCH', `/master-data/${skill._id}`, { cookie: admin, body: { rates: [{ governmentType: 'State', area: 'A - Inside city', salary: -10 }] } });
  check('Negative skill price is refused', negative.status === 400, negative.status);
  const dupRate = await call('PATCH', `/master-data/${skill._id}`, { cookie: admin, body: { rates: [{ governmentType: 'State', area: 'A - Inside city', salary: 10 }, { governmentType: 'State', area: 'A - Inside city', salary: 20 }] } });
  check('Two prices for the same government type and area are refused', dupRate.status === 400, dupRate.status);
  const usedDelete = await call('DELETE', `/master-data/${skill._id}`, { cookie: admin });
  check('A skill category used by employees cannot be deleted (409)', usedDelete.status === 409, usedDelete.status);

  section = 'Validations: payroll';
  const ids = { organizationId: String(organization._id), locationId: String(location._id) };
  check('Payroll with an invalid date is refused', (await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: '2026-02-30', toDate: '2026-03-31' } })).status === 400);
  check('Payroll with start after end is refused', (await call('GET', '/attendance/payroll', { cookie: admin, query: { ...ids, fromDate: '2026-03-31', toDate: '2026-03-01' } })).status === 400);
  check('Wage register with an invalid month is refused', (await call('GET', '/attendance/wage-register', { cookie: admin, query: { ...ids, month: '2026-00' } })).status === 400);
  check('Bank list with an invalid month is refused', (await call('GET', '/attendance/bank-payments', { cookie: admin, query: { month: 'abc' } })).status === 400);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI first.');
  await mongoose.connect(process.env.MONGODB_URI);
  const server = createApp().listen(0);
  http = `http://127.0.0.1:${server.address().port}/api`;
  const started = Date.now();
  try {
    const adminDoc = await User.findOne({ role: 'admin', status: 'active' }).lean();
    const admin = `accessToken=${createToken({ id: String(adminDoc._id), role: 'admin' })}`;
    const model = new Model();
    await model.load();

    section = 'Logins';
    const orgCookies = new Map();
    for (const organization of model.organizations) {
      const result = await login(organization.email, ORG_PASSWORD);
      check(`${organization.organizationName} can log in`, result.status === 200 && result.cookie, result.status);
      orgCookies.set(String(organization._id), result.cookie);
    }

    for (const [name, run] of [
      ['old month rates', () => testOldMonthRates(model, admin)],
      ['invoices', () => testInvoices(model, admin)],
      ['bank', () => testBankAndPayrollRuns(model, admin)],
      ['changes today', () => testChangesToday(model, admin)],
      ['attendance', () => testAttendance(model, admin, orgCookies)],
      ['dashboard', () => testDashboard(model, admin, orgCookies)],
      ['validations', () => testValidations(model, admin)],
    ]) {
      const at = Date.now();
      try {
        await run();
      } catch (error) {
        check(`${name}: test crashed`, false, error.stack);
      }
      console.log(`  ${name} done in ${Math.round((Date.now() - at) / 1000)}s`);
    }
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  const sections = [...new Set(results.map((result) => result.section))];
  for (const name of sections) {
    const items = results.filter((result) => result.section === name);
    const failed = items.filter((result) => !result.ok);
    console.log(`\n${failed.length ? 'FAIL' : 'PASS'}  ${name}: ${items.length - failed.length}/${items.length}`);
    for (const result of failed) console.log(`   ✗ ${result.name}${result.detail ? ` — ${result.detail.slice(0, 300)}` : ''}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length} checks, ${results.length - failed} passed, ${failed} failed in ${Math.round((Date.now() - started) / 1000)}s`);
  fs.writeFileSync('e2e-results.json', JSON.stringify(results, null, 2));
  process.exitCode = failed ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
