const assert = require('node:assert/strict');
const test = require('node:test');

const Employee = require('../../src/models/Employee');
const bankInvoiceService = require('../../src/services/bankInvoiceService');
const {
  answerPaymentRun,
  previewPaymentRun,
  wantsPlainSheetDownload,
  wantsPrintedHistoryMark,
} = require('../../src/services/assistantService');

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

test('plain payroll PDF/sheet is not a history-mark payment run', () => {
  assert.equal(wantsPlainSheetDownload('Housekeeping ki payroll PDF do'), true);
  assert.equal(wantsPrintedHistoryMark('Housekeeping ki payroll PDF do'), false);
  assert.equal(wantsPrintedHistoryMark('payroll history me mark kar do'), true);
  assert.equal(wantsPlainSheetDownload('wage sheet download'), true);
});

test('payroll PDF defers to normal document download (no history batch)', async () => {
  const result = await answerPaymentRun(
    { id: '1', role: 'admin' },
    'Housekeeping ki October payroll PDF do',
    directory,
    '2026-11-16',
    null,
    'hi',
  );
  assert.equal(result, null);
});

test('payroll sheet defers to normal document download (no history batch)', async () => {
  const result = await answerPaymentRun(
    { id: '1', role: 'admin' },
    'Housekeeping ki petrol sheet do',
    directory,
    '2026-11-16',
    null,
    'hi',
  );
  assert.equal(result, null);
});

test('bank invoice PDF plans a download without history mark', async () => {
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
      'Housekeeping ka bank invoice PDF do',
      directory,
      '2026-11-16',
      null,
      'hi',
    );
    assert.ok(result?.plan, `expected plan, got ${JSON.stringify(result)}`);
    assert.equal(result.plan.type, 'bank_invoice');
    assert.equal(result.plan.markHistory, false);
    assert.deepEqual(result.plan.locationIds, [locId]);

    const preview = await previewPaymentRun('bank', { id: '1', role: 'admin' }, result.plan, directory, 'hi');
    assert.ok(preview.document, `expected document, got ${JSON.stringify(preview)}`);
    assert.equal(preview.document.type, 'bank_invoice');
    assert.equal(preview.document.batchId, null);
    assert.equal(preview.document.locationId, locId);
    assert.match(preview.reply, /history|मार्क नहीं/i);
  } finally {
    Employee.find = originalFind;
    restore();
  }
});

test('bank invoice history mark keeps create/mark path', async () => {
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
      'Housekeeping ka bank invoice history me mark kar do',
      directory,
      '2026-11-16',
      null,
      'hi',
    );
    assert.ok(result?.plan, `expected plan, got ${JSON.stringify(result)}`);
    assert.equal(result.plan.type, 'bank_invoice');
    assert.notEqual(result.plan.markHistory, false);
  } finally {
    Employee.find = originalFind;
    restore();
  }
});

test('STT histry / print mark count as printed-history asks', () => {
  assert.equal(wantsPrintedHistoryMark('histry mein mark kar do'), true);
  assert.equal(wantsPrintedHistoryMark('histry mein print mark kar do'), true);
  assert.equal(wantsPrintedHistoryMark('print mark kar do'), true);
  assert.equal(wantsPlainSheetDownload('payroll seat do'), true);
});

test('location payroll seat + histry mark creates history run not employee picker', async () => {
  const restore = mockPendingList();
  const originalFind = Employee.find;
  let findCalled = false;
  Employee.find = () => {
    findCalled = true;
    return {
      select() { return this; },
      limit() { return this; },
      lean: async () => [{ _id: '507f1f77bcf86cd7994390f3', name: 'Meena', locationId: locId, status: 'active' }],
    };
  };
  try {
    for (const message of [
      'Housekeeping location ki payroll seat do aur histry mein mark kar do',
      'Housekeeping location ki pairol do mujhe November manth ki aur histry mein print mark kar do',
      'Housekeeping location ki mujhe payroll sheet do aur histry mein print mark kar do',
    ]) {
      findCalled = false;
      const result = await answerPaymentRun(
        { id: '1', role: 'admin' },
        message,
        directory,
        '2026-11-16',
        null,
        'hi',
      );
      assert.ok(result?.plan, `expected plan for: ${message} → ${JSON.stringify(result)}`);
      assert.equal(result.plan.type, 'payroll_run', message);
      assert.deepEqual(result.plan.locationIds, [locId], message);
      assert.equal(result.plan.employeeId, null, message);
      assert.notEqual(result.plan.markHistory, false, message);
      assert.equal(findCalled, false, `must not fuzzy-search employees for: ${message}`);
    }
  } finally {
    Employee.find = originalFind;
    restore();
  }
});
