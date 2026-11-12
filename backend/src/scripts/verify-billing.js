// Recomputes payroll, FORM XVII wage register, bank payments and client invoices for the last 24 months (or the
// number of months passed as the first argument) from raw
// attendance, Category of skill price history and Settings, and compares them with what the services return.
// Read-only, except one invoice that is saved for an unbilled old month and deleted again to test saving.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const ClientInvoice = require('../models/ClientInvoice');
const Employee = require('../models/Employee');
const InvoiceSetup = require('../models/InvoiceSetup');
const Location = require('../models/Location');
const MasterData = require('../models/MasterData');
const User = require('../models/User');
const payroll = require('../services/payrollService');
const invoices = require('../services/clientInvoiceService');
const { getInvoiceSettingsFor, getSettingsFor } = require('../services/documentSettingsService');

const r2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const failures = [];
let checks = 0;

function expect(label, actual, expected, tolerance = 0.005) {
  checks += 1;
  const ok = typeof expected === 'number' ? Math.abs(Number(actual) - expected) <= tolerance : actual === expected;
  if (!ok) failures.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

function lastMonths(count) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - count + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function sameText(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

/** The archived price period that holds `date`, the oldest one before that, or today's prices. */
function priceOn(skill, governmentType, area, date) {
  const pick = (rates) => (rates || []).find((rate) => sameText(rate.governmentType, governmentType) && sameText(rate.area, area))?.salary;
  const history = (skill.rateHistory || []).filter((period) => !(period.effectiveTo && period.effectiveTo <= period.effectiveFrom));
  if (!skill.effectiveFrom || date >= skill.effectiveFrom || history.length === 0) return pick(skill.rates);
  const period = history.find((entry) => (entry.effectiveFrom || '') <= date && (!entry.effectiveTo || date < entry.effectiveTo))
    || [...history].sort((left, right) => (left.effectiveFrom || '').localeCompare(right.effectiveFrom || ''))[0];
  return pick(period.rates);
}

function billedIn(item, month) {
  if (item.frequency === 'yearly') return month.slice(5, 7) === item.billMonth;
  if (item.frequency === 'once') return month === item.billMonth;
  return true;
}

async function verifyLocationMonth({ user, organization, location, month, skills, setup, wageRates, bankTotals }) {
  const tag = `${month} ${location.name}`;
  const { fromDate, toDate } = payroll.monthRange(month);
  const assigned = (await Employee.find({ organizationId: organization._id, locationId: location._id }).lean())
    .filter((employee) => sameText(employee.designation, location.designation));
  const records = (await Attendance.find({ employeeId: { $in: assigned.map((employee) => employee._id) }, date: { $gte: fromDate, $lte: toDate } }).lean())
    .filter((record) => {
      const employee = assigned.find((candidate) => String(candidate._id) === String(record.employeeId));
      return employee.status !== 'disabled' || !employee.disabledOn || record.date < employee.disabledOn;
    });
  // Blocked employees are listed only for periods in which they still have attendance.
  const employees = assigned.filter((employee) => employee.status !== 'disabled' || records.some((record) => String(record.employeeId) === String(employee._id)));

  const expected = new Map(employees.map((employee) => {
    const days = records.filter((record) => String(record.employeeId) === String(employee._id) && new Date(`${record.date}T00:00:00Z`).getUTCDay() !== 0);
    const count = (status) => days.filter((record) => record.status === status).length;
    const paidDays = Math.min(26, count('present') + count('half_day') * 0.5 + count('paid_leave'));
    const skill = skills.get(String(employee.skillCategory || '').trim().toLowerCase());
    const todayPrice = skill && priceOn(skill, organization.governmentType, organization.area, '9999-12-31');
    const thenPrice = skill && priceOn(skill, organization.governmentType, organization.area, toDate);
    const daily = skill && Number(employee.basicPay) === todayPrice ? r2(employee.dailySalary - todayPrice + thenPrice) : employee.dailySalary;
    return [String(employee._id), { employee, paidDays, present: count('present'), absent: count('absent'), daily }];
  }));

  const pay = await payroll.calculatePayroll(user, { organizationId: String(organization._id), locationId: String(location._id), fromDate, toDate });
  expect(`${tag} payroll employees`, pay.lines.length, employees.length);
  for (const line of pay.lines) {
    const row = expected.get(line.employeeId);
    expect(`${tag} ${line.employeeName} paid days`, line.paidDays, row.paidDays);
    expect(`${tag} ${line.employeeName} present`, line.presentDays, row.present);
    expect(`${tag} ${line.employeeName} absent`, line.absentDays, row.absent);
    expect(`${tag} ${line.employeeName} payroll daily wage`, line.dailySalary, row.daily);
    expect(`${tag} ${line.employeeName} gross pay`, line.grossPay, r2(row.daily * row.paidDays));
  }

  const register = await payroll.calculateWageRegister(user, { organizationId: String(organization._id), locationId: String(location._id), month });
  let net = 0;
  for (const line of register.rows) {
    const row = expected.get(line.employeeId);
    const wages = r2(row.daily * row.paidDays);
    const bonus = (wages * Number(wageRates.bonusRate)) / 100;
    const epf = row.employee.epfoApplicable ? (Math.min(wages, Number(wageRates.epfWageCeiling) || wages) * Number(wageRates.epfRate)) / 100 : 0;
    const esi = row.employee.esicApplicable ? (Math.min(wages, Number(wageRates.esiWageCeiling) || wages) * Number(wageRates.esiRate)) / 100 : 0;
    expect(`${tag} ${line.employeeName} register daily wage`, line.dailyWage, row.daily);
    expect(`${tag} ${line.employeeName} register wages`, line.wages, wages);
    expect(`${tag} ${line.employeeName} register bonus`, line.bonus, r2(bonus));
    expect(`${tag} ${line.employeeName} register EPF`, line.epf, Math.round(epf));
    expect(`${tag} ${line.employeeName} register ESI`, line.esi, Math.round(esi));
    expect(`${tag} ${line.employeeName} register net`, line.grossPayment, Math.round(wages + bonus - epf - esi));
    net += line.grossPayment;
  }
  expect(`${tag} register total net`, register.totals.grossPayment, net);
  bankTotals.set(month, (bankTotals.get(month) || 0) + net);

  const settings = await getInvoiceSettingsFor(month);
  const loading = (Number(settings.epfRate) + Number(settings.esicRate) + Number(settings.bonusRate)) / 100;
  const serviceCharge = Number(settings.serviceChargeRate || 0) / 100;
  const preview = await invoices.previewInvoice(user, String(organization._id), String(location._id), { month });
  const all = [...expected.values()];
  const working = all.filter((row) => row.paidDays > 0);
  const qtyType = setup?.labourQtyType || settings.labourQtyType || 'mandays';
  const monthDays = Math.max(1, Math.round(Number(settings.monthDays)) || 26);
  // Man-day weighted daily wage; with nobody working in the month every employee counts once.
  const wageOf = (rows) => {
    const busy = rows.filter((row) => row.paidDays > 0);
    const priced = (busy.length ? busy : rows).filter((row) => row.daily > 0);
    const weight = (row) => (busy.length ? row.paidDays : 1);
    const total = priced.reduce((sum, row) => sum + weight(row), 0);
    return total ? r2(priced.reduce((sum, row) => sum + row.daily * weight(row), 0) / total) : 0;
  };
  const categoryRows = working.length ? working : all;
  const labour = setup?.autoLabour === false ? [] : [...new Set(categoryRows.map((row) => row.employee.skillCategory).filter(Boolean))].sort().map((category) => {
    const group = all.filter((row) => row.employee.skillCategory === category);
    const busy = group.filter((row) => row.paidDays > 0);
    const manDays = busy.reduce((sum, row) => sum + row.paidDays, 0);
    const monthly = qtyType !== 'mandays';
    const qty = qtyType === 'manmonths' ? Math.round((manDays / monthDays + Number.EPSILON) * 1000) / 1000 : qtyType === 'persons' ? (manDays > 0 ? busy.length : 0) : r2(manDays);
    const rate = r2(wageOf(group) * (monthly ? monthDays : 1) * (1 + loading) * (1 + serviceCharge));
    return { qty, rate, amount: r2(qty * rate) };
  });
  const relievingRate = Number(settings.relievingRate || 0) / 100;
  const relieving = (setup?.items || [])
    .filter((item) => item.section === 'service' && item.rateSource === 'relieving' && billedIn(item, month))
    .map((item) => {
      const rate = r2(r2(wageOf(all) * (1 + loading) * (1 + serviceCharge)) * relievingRate);
      return { qty: item.defaultQty || 0, rate, amount: r2((item.defaultQty || 0) * rate) };
    });
  const supplyItems = setup ? setup.items : [{ section: 'supply', rate: 0, defaultQty: 0 }];
  const supply = supplyItems
    .filter((item) => item.section === 'supply' && billedIn(item, month))
    .map((item) => ({ qty: item.defaultQty || 0, rate: item.rate || 0, amount: r2((item.defaultQty || 0) * (item.rate || 0)) }));
  if (setup?.autoLabour !== false) {
    const lines = [...labour, ...relieving, ...supply];
    expect(`${tag} invoice line count`, preview.items.length, lines.length);
    preview.items.forEach((item, index) => {
      if (!lines[index]) return;
      expect(`${tag} invoice line ${index + 1} qty`, item.qty, lines[index].qty);
      expect(`${tag} invoice line ${index + 1} rate`, item.rate, lines[index].rate);
      expect(`${tag} invoice line ${index + 1} amount`, item.amount, lines[index].amount);
    });
  }
  const serviceTotal = r2(preview.items.filter((item) => item.section === 'service').reduce((sum, item) => sum + item.amount, 0));
  const supplyTotal = r2(preview.items.filter((item) => item.section === 'supply').reduce((sum, item) => sum + item.amount, 0));
  const gst = r2(serviceTotal * ((setup?.gstRate ?? 18) / 100));
  expect(`${tag} invoice service total`, preview.totals.serviceTotal, serviceTotal);
  expect(`${tag} invoice GST`, preview.totals.gstAmount, gst);
  expect(`${tag} invoice net payable`, preview.totals.netPayable, r2(serviceTotal + supplyTotal + gst));
  expect(`${tag} invoice man-days`, preview.attendance.totalManDays, r2(working.reduce((sum, row) => sum + row.paidDays, 0)));
  for (const line of preview.attendance.employees) {
    const row = expected.get(line.employeeId);
    expect(`${tag} ${line.name} breakdown daily wage`, line.dailySalary, row.daily);
    expect(`${tag} ${line.name} breakdown salary`, line.salary, r2(row.daily * row.paidDays));
  }
}

async function verifySavedInvoices() {
  const saved = await ClientInvoice.find({}).lean();
  expect('saved invoice numbers are unique', new Set(saved.map((invoice) => invoice.invoiceNumber)).size, saved.length);
  for (const invoice of saved) {
    invoice.items.forEach((item, index) => expect(`saved ${invoice.invoiceNumber} line ${index + 1} amount`, item.amount, r2(item.qty * item.rate)));
    const service = r2(invoice.items.filter((item) => item.section === 'service').reduce((sum, item) => sum + item.amount, 0));
    const supply = r2(invoice.items.filter((item) => item.section === 'supply').reduce((sum, item) => sum + item.amount, 0));
    expect(`saved ${invoice.invoiceNumber} net payable`, invoice.netPayable, r2(service + supply + r2((service * invoice.gstRate) / 100)));
  }
}

async function verifySaveRoundTrip(user, organization, locations, months) {
  for (const location of locations) {
    const billed = new Set((await ClientInvoice.find({ locationId: location._id }).select('month').lean()).map((invoice) => invoice.month));
    const month = months.find((candidate) => !billed.has(candidate));
    if (!month) continue;
    const ids = [String(organization._id), String(location._id)];
    const preview = await invoices.previewInvoice(user, ...ids, { month });
    const { invoice } = await invoices.saveInvoice(user, ...ids, month, { ...preview.suggested, items: preview.items });
    try {
      expect(`save ${month} ${location.name} net payable`, invoice.netPayable, preview.totals.netPayable);
      expect(`save ${month} ${location.name} rates`, JSON.stringify(invoice.items.map((item) => item.rate)), JSON.stringify(preview.items.map((item) => item.rate)));
      const reopened = await invoices.previewInvoice(user, ...ids, { month });
      expect(`reopened ${month} ${location.name} invoice`, reopened.invoice?.netPayable, invoice.netPayable);
    } finally {
      await invoices.deleteInvoice(user, ...ids, invoice.id);
    }
    return;
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before verifying billing.');
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ role: 'admin' }).lean();
  const user = { role: 'admin', id: String(admin._id), name: admin.name || 'Billing check' };
  const skills = new Map((await MasterData.find({ type: 'skillCategory' }).lean()).map((skill) => [skill.code, skill]));
  const setups = new Map((await InvoiceSetup.find({}).lean()).map((setup) => [String(setup.locationId), setup]));
  const months = lastMonths(Number(process.argv[2]) || 24);
  const bankTotals = new Map();
  const organizations = await User.find({ role: 'organization', governmentType: { $nin: ['', null] }, area: { $nin: ['', null] } }).lean();
  const allLocations = [];

  for (const organization of organizations) {
    const locations = await Location.find({ organizationId: organization._id }).lean();
    allLocations.push(...locations.map((location) => ({ location, organization })));
    for (const month of months) {
      const wageRates = await getSettingsFor('wageRegister', month);
      for (const location of locations) {
        await verifyLocationMonth({ user, organization, location, month, skills, setup: setups.get(String(location._id)), wageRates, bankTotals });
      }
    }
  }
  for (const month of months) {
    const bank = await payroll.calculateBankPayments(user, { month });
    expect(`${month} bank payment total`, bank.summary.total, bankTotals.get(month) || 0);
  }
  await verifySavedInvoices();
  if (allLocations.length) {
    await verifySaveRoundTrip(user, allLocations[0].organization, allLocations.filter((entry) => entry.organization === allLocations[0].organization).map((entry) => entry.location), months);
  }

  console.log(`Checked ${months[0]} to ${months.at(-1)}, ${allLocations.length} locations: ${checks} checks, ${failures.length} failures.`);
  if (failures.length) {
    const kinds = new Map();
    for (const failure of failures) {
      const kind = ['bank', 'saved', 'save', 'breakdown', 'invoice', 'register', 'payroll'].find((word) => failure.includes(word)) || 'other';
      kinds.set(kind, (kinds.get(kind) || 0) + 1);
    }
    console.log([...kinds].map(([kind, count]) => `${kind}: ${count}`).join(', '));
    console.log(failures.slice(0, 50).join('\n'));
  }
  await mongoose.disconnect();
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
