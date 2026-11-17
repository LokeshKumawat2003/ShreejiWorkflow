const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const bankInvoiceService = require('../../src/services/bankInvoiceService');
const { answerPaymentRun } = require('../../src/services/assistantService');

const locId = '507f1f77bcf86cd7994390f1';
const orgId = '507f1f77bcf86cd7994390f2';
const directory = {
  organizations: [{ id: orgId, name: 'BHEL Bhopal', status: 'active' }],
  locations: [{
    id: locId,
    organizationId: orgId,
    organizationName: 'BHEL Bhopal',
    workName: 'Housekeeping',
    name: 'Bhopal Staff Canteen',
    designation: 'Cleaner',
    status: 'active',
    address: '',
  }],
};

function mockPendingList() {
  const original = bankInvoiceService.listDocumentLocations;
  bankInvoiceService.listDocumentLocations = async () => ({
    organizations: [{
      organizationId: orgId,
      organizationName: 'BHEL Bhopal',
      locations: [{
        locationId: locId,
        locationName: 'Housekeeping – Bhopal Staff Canteen',
        status: 'pending',
        employees: 2,
        total: 37776,
      }],
    }],
  });
  return () => { bankInvoiceService.listDocumentLocations = original; };
}

test('bare bana after October run_status creates sticky payroll plan', async () => {
  const restore = mockPendingList();
  try {
    const result = await answerPaymentRun(
      { id: '1', role: 'admin' },
      'बना',
      directory,
      '2026-11-16',
      {
        topic: 'run_status',
        kind: 'payroll',
        month: '2026-10',
        locationIds: [locId],
        title: 'October में इन locations का payroll बन सकता है',
        items: ['Housekeeping – Bhopal Staff Canteen — 2 employees, ₹37,776'],
      },
      'hi',
    );
    assert.ok(result?.plan);
    assert.equal(result.plan.type, 'payroll_run');
    assert.equal(result.plan.month, '2026-10');
    assert.deepEqual(result.plan.locationIds, [locId]);
  } finally {
    restore();
  }
});

test('payroll banao after sticky October keeps October not November', async () => {
  const restore = mockPendingList();
  try {
    const result = await answerPaymentRun(
      { id: '1', role: 'admin' },
      'पैरोल बनाओ',
      directory,
      '2026-11-16',
      {
        topic: 'run_status',
        kind: 'payroll',
        month: '2026-10',
        locationIds: [locId],
      },
      'hi',
    );
    assert.ok(result?.plan);
    assert.equal(result.plan.month, '2026-10');
    assert.deepEqual(result.plan.locationIds, [locId]);
  } finally {
    restore();
  }
});

test('random location payroll banao previews a pending location plan', async () => {
  const restore = mockPendingList();
  const originalFind = Employee.find;
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [],
  });
  try {
    const result = await answerPaymentRun(
      { id: '1', role: 'admin' },
      'अक्टूबर का किसी भी लोकेशन का रैंडम का पेट्रोल बनाओ',
      directory,
      '2026-11-16',
      null,
      'hi',
    );
    assert.ok(result?.plan, `expected plan, got ${JSON.stringify(result)}`);
    assert.equal(result.plan.type, 'payroll_run');
    assert.equal(result.plan.month, '2026-10');
    assert.deepEqual(result.plan.locationIds, [locId]);
  } finally {
    Employee.find = originalFind;
    restore();
  }
});
