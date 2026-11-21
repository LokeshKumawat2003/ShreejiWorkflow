/**
 * Location payroll-sheet / bank-invoice phrasing coverage.
 * Location name is an example only — matching uses the directory entry, not a hardcoded site.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const {
  parseType,
  parseFormat,
  parseMonth,
  parseMonthRange,
  wantsPlainSheetDownload,
  wantsPrintedHistoryMark,
  answerPaymentRun,
  interpretWithRules,
  resolvePlan,
} = require('../../src/services/assistantService');

const locId = '507f1f77bcf86cd7994390f1';
const orgId = '507f1f77bcf86cd7994390f2';
const directory = {
  organizations: [{ id: orgId, name: 'Demo Org', status: 'active' }],
  locations: [{
    id: locId,
    organizationId: orgId,
    organizationName: 'Demo Org',
    workName: 'Housekeeping',
    name: 'Sample Site Gate',
    designation: 'Cleaner',
    status: 'active',
    address: '',
  }],
};

const TODAY = '2026-11-18';
const CURRENT = '2026-11';

function mockNoEmployees() {
  const original = Employee.find;
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [],
  });
  return () => { Employee.find = original; };
}

const PLAIN_SHEET_ASKS = [
  'Housekeeping location ki October month ki Payroll Sheet chahiye',
  'Give me the payroll sheet for Housekeeping location for November',
  'Housekeeping location ki January se February tak ki payroll Excel chahiye',
  'Housekeeping site ki September month ki salary sheet de do',
  'I need the October payroll report for Housekeeping location',
  'Housekeeping ka November month ka salary register download karna hai',
  'Please provide the payroll Excel for all employees at Housekeeping from January to March',
  'Housekeeping location ka December month ka Payroll Excel nikalo',
  'Housekeeping site ki October se December tak ki salary sheet chahiye',
  'Can you export the November to December payroll data for Housekeeping',
  'Housekeeping location ki April se June tak ki salary details chahiye',
  'Housekeeping location ka January se November tak ka payroll register bhejo',
  'Housekeeping site ki February month ki sabhi employees ki Payroll Sheet chahiye',
  'Housekeeping ki March aur April month ki payroll excel file de do',
  'I want the complete salary sheet for Housekeeping location from June to October',
  'Housekeeping ke employees ki May month ki payroll Excel file nikal do',
  'Housekeeping location ka January se March tak ka pura salary record excel me chahiye',
  'Housekeeping site ki November month ki payroll sheet download karke do',
];

test('plain payroll sheet phrasings parse as payroll download (not history)', () => {
  for (const message of PLAIN_SHEET_ASKS) {
    assert.equal(parseType(message), 'payroll', message);
    assert.equal(wantsPlainSheetDownload(message), true, message);
    assert.equal(wantsPrintedHistoryMark(message), false, message);
  }
});

test('month range helpers cover multi-month and relative asks', () => {
  assert.deepEqual(parseMonthRange('January se February tak', CURRENT), ['2026-01', '2026-02']);
  assert.deepEqual(parseMonthRange('March aur April', CURRENT), ['2026-03', '2026-04']);
  assert.deepEqual(
    parseMonthRange('October se lekar abhi tak', CURRENT),
    ['2026-10', '2026-11'],
  );
  assert.deepEqual(
    parseMonthRange('पिछले तीन महीनों', CURRENT),
    ['2026-09', '2026-10', '2026-11'],
  );
  assert.deepEqual(
    parseMonthRange('last 3 months', CURRENT),
    ['2026-09', '2026-10', '2026-11'],
  );
  assert.equal(parseMonth('October month ki Payroll Sheet', CURRENT), '2026-10');
  assert.equal(parseFormat('payroll Excel chahiye'), 'excel');
});

test('history mark still wins over sheet words', () => {
  const message = 'Housekeeping location ki payroll sheet do aur histry mein mark kar do';
  assert.equal(wantsPlainSheetDownload(message), true);
  assert.equal(wantsPrintedHistoryMark(message), true);
});

test('location payroll sheet resolves to normal payroll document without history batch', async () => {
  const restore = mockNoEmployees();
  try {
    const message = 'Housekeeping location ki October month ki Payroll Sheet chahiye';
    const run = await answerPaymentRun({ id: '1', role: 'admin' }, message, directory, TODAY, null, 'hi');
    assert.equal(run, null, 'plain sheet must not open history payment-run');

    const draft = await interpretWithRules({ id: '1', role: 'admin' }, message, directory, TODAY);
    assert.equal(draft.type, 'payroll');
    assert.equal(draft.locationId, locId);
    assert.equal(draft.month, '2026-10');
    assert.equal(draft.employeeName, null);

    const plan = await resolvePlan({ id: '1', role: 'admin' }, draft, directory, { message, today: TODAY });
    assert.ok(plan.document, JSON.stringify(plan));
    assert.equal(plan.document.type, 'payroll');
    assert.equal(plan.document.locationId, locId);
    assert.equal(plan.document.month, '2026-10');
    assert.equal(plan.document.batchId, undefined);
  } finally {
    restore();
  }
});

test('multi-month payroll sheet offers month choices', async () => {
  const restore = mockNoEmployees();
  try {
    const message = 'Housekeeping location ki January se March tak ki payroll Excel chahiye';
    const draft = await interpretWithRules({ id: '1', role: 'admin' }, message, directory, TODAY);
    assert.equal(draft.type, 'payroll');
    assert.deepEqual(draft.months, ['2026-01', '2026-02', '2026-03']);
    assert.equal(draft.format, 'excel');

    const plan = await resolvePlan({ id: '1', role: 'admin' }, draft, directory, { message, today: TODAY });
    assert.equal(plan.document, undefined);
    assert.ok(plan.choices?.length >= 3, JSON.stringify(plan));
    assert.equal(plan.choices[0].plan.type, 'payroll');
    assert.equal(plan.choices[0].plan.format, 'excel');
    assert.equal(plan.choices[0].plan.locationId, locId);
  } finally {
    restore();
  }
});

test('bank invoice PDF stays normal download; history mark keeps create path', async () => {
  const bankInvoiceService = require('../../src/services/bankInvoiceService');
  const original = bankInvoiceService.listDocumentLocations;
  bankInvoiceService.listDocumentLocations = async () => ({
    organizations: [{
      organizationId: orgId,
      organizationName: 'Demo Org',
      locations: [{
        locationId: locId,
        locationName: 'Housekeeping – Sample Site Gate',
        status: 'pending',
        employees: 2,
        total: 1000,
      }],
    }],
  });
  const restoreEmp = mockNoEmployees();
  try {
    const plain = await answerPaymentRun(
      { id: '1', role: 'admin' },
      'Housekeeping location ka bank invoice PDF do',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(plain?.plan);
    assert.equal(plain.plan.markHistory, false);

    const marked = await answerPaymentRun(
      { id: '1', role: 'admin' },
      'Housekeeping location ka bank invoice history me mark kar do',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(marked?.plan);
    assert.notEqual(marked.plan.markHistory, false);
  } finally {
    bankInvoiceService.listDocumentLocations = original;
    restoreEmp();
  }
});
