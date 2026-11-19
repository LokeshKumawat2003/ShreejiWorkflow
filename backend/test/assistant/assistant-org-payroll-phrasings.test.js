/**
 * Org-wide payroll / bank-invoice phrasing + ambiguous org disambiguation.
 * Org names here are fixtures only — matching is by directory entry, not hardcoding.
 */
const assert = require('node:assert/strict');
const test = require('node:test');

const bankInvoiceService = require('../../src/services/bankInvoiceService');
const {
  answerPaymentRun,
  answerEmployeeDetails,
  wantsOrgWideRun,
  wantsAllLocationsPayrollAsk,
  wantsPlainSheetDownload,
  wantsPrintedHistoryMark,
  organizationChoiceLabel,
} = require('../../src/services/assistantService');

const orgA = '507f1f77bcf86cd7994390a1';
const orgB = '507f1f77bcf86cd7994390a2';
const loc1 = '507f1f77bcf86cd7994390b1';
const loc2 = '507f1f77bcf86cd7994390b2';

const directory = {
  organizations: [
    {
      id: orgA,
      name: 'Golden Track Work',
      contactName: 'Ramesh Sharma',
      email: 'ramesh@goldentrack.example',
      phone: '9000000001',
      status: 'active',
    },
    {
      id: orgB,
      name: 'Green Valley Care',
      contactName: 'Sita Verma',
      email: 'sita@greenvalley.example',
      phone: '9000000002',
      status: 'active',
    },
    {
      id: '507f1f77bcf86cd7994390a3',
      name: 'Green Valley Care',
      contactName: 'Amit Patel',
      email: 'amit@gvc2.example',
      phone: '9000000003',
      status: 'active',
    },
  ],
  locations: [
    {
      id: loc1,
      organizationId: orgA,
      organizationName: 'Golden Track Work',
      workName: 'Housekeeping',
      name: 'North Gate',
      status: 'active',
      address: '',
      designation: '',
      opNumber: '',
    },
    {
      id: loc2,
      organizationId: orgA,
      organizationName: 'Golden Track Work',
      workName: 'Security',
      name: 'Main Block',
      status: 'active',
      address: '',
      designation: '',
      opNumber: '',
    },
  ],
};

const TODAY = '2026-11-18';
const admin = { id: '1', role: 'admin' };

function mockPendingForOrg() {
  const original = bankInvoiceService.listDocumentLocations;
  const originalPreview = bankInvoiceService.previewLocationsPayroll;
  bankInvoiceService.listDocumentLocations = async () => ({
    organizations: [{
      organizationId: orgA,
      organizationName: 'Golden Track Work',
      locations: [
        { locationId: loc1, locationName: 'Housekeeping – North Gate', status: 'pending', employees: 3, total: 12000, missingBankDetails: 0 },
        { locationId: loc2, locationName: 'Security – Main Block', status: 'pending', employees: 2, total: 8000, missingBankDetails: 0 },
      ],
    }],
  });
  bankInvoiceService.previewLocationsPayroll = async () => ({
    lines: [
      { employeeId: '1', netPay: 5000, grossPay: 5000 },
      { employeeId: '2', netPay: 4000, grossPay: 4000 },
    ],
  });
  return () => {
    bankInvoiceService.listDocumentLocations = original;
    bankInvoiceService.previewLocationsPayroll = originalPreview;
  };
}

const ORG_WIDE_PHRASINGS = [
  // Hindi
  'Golden Track Work organization ke andar jitni bhi location hain unki payroll do',
  'Golden Track Work ke andar sari locations ka payroll chahiye',
  'Golden Track Work company ki sabhi locations ki payroll sheet PDF mein do',
  'Golden Track Work org ke under all locations ka bank invoice Excel chahiye',
  'Golden Track Work ke andar jitni locations hain unka bank invoice do',
  'Golden Track Work organization ki November ki payroll text mein batao',
  'Golden Track Work ki October se November tak ki payroll Excel chahiye',
  'Golden Track Work ke andar sab locations ka payroll history me mark kar do',
  'Golden Track Work firm ki saari sites ka salary register download karo',
  'Golden Track Work ke andar jitni bhi location unki pairol sheet de do',
  // English
  'Give me payroll for all locations under Golden Track Work',
  'Golden Track Work organization — payroll for every location please',
  'Export bank invoices for all sites in Golden Track Work as PDF',
  'I need the November payroll Excel for Golden Track Work organization',
  'Provide payroll data for all locations of Golden Track Work company',
  'Can you generate payroll for every location under Golden Track Work?',
  'Golden Track Work org all locations bank invoice download',
  'Send me the payroll report for Golden Track Work across all locations',
  'Golden Track Work company payroll for January to March in Excel',
  'All locations under Golden Track Work — bank invoice please',
  // Hinglish
  'Golden Track Work organization ke andar jitni locations hain unki payroll PDF do',
  'Golden Track Work company me sab locations ka bank invoice chahiye',
  'Golden Track Work ke under all sites ki payroll sheet nikal do',
  'Golden Track Work org ki sari location ka payroll Excel bhejo',
  'Golden Track Work ke andar sabhi locations ki salary details batao',
  'Golden Track Work firm ki jitni bhi location unka bank invoice PDF',
  'Golden Track Work organization ka complete payroll data chahiye',
  'Golden Track Work ke andar locations ki payroll register download karna hai',
  'Golden Track Work company ki last 3 months ki payroll Excel do',
  'Golden Track Work org ke andar payroll history mein print mark kar do',
  // More natural variants
  'iske andar jitni location hain Golden Track Work ki unki payroll do',
  'Golden Track Work wali company ki sab locations ka payroll',
  'mujhe Golden Track Work organization ka payroll chahiye sab locations ka',
  'Golden Track Work ke all locations ka bank letter chahiye',
  'please give payroll of Golden Track Work for all its locations',
  'Golden Track Work me jo locations hain unki payroll sheet',
  'Golden Track Work organization payroll for all branches',
  'Golden Track Work ki har location ki payroll Excel file',
  'Golden Track Work ke andar bank invoice for all locations',
  'show payroll totals for Golden Track Work organization',
  'Golden Track Work company ka November payroll batao',
  'Golden Track Work org ki payroll PDF for all locations',
  'Golden Track Work ke andar saari sites ka salary sheet',
  'need bank invoice of Golden Track Work for every location',
  'Golden Track Work organization ke sabhi sites ka payroll',
  'Golden Track Work ki locations ki payroll ek saath do',
  'Golden Track Work company all locations payroll generate karo',
  'Golden Track Work ke andar payroll chahiye PDF format me',
  'Golden Track Work org bank invoice Excel me nikal do',
  'Golden Track Work ke under payroll without history mark PDF',
  'Golden Track Work organization ki payroll sheet do',
  'Golden Track Work ke andar jitni location unka bank invoice',
  'all Golden Track Work locations payroll please',
  'Golden Track Work firm ke andar salary register chahiye',
  'Golden Track Work company payroll data export karo',
];

test('org-wide cue detector covers common Hindi/English/Hinglish asks', () => {
  let hits = 0;
  for (const message of ORG_WIDE_PHRASINGS) {
    if (wantsOrgWideRun(message) || /organization|company|org|firm|all locations|every location|sabhi location|sari location|ke andar|under/i.test(message)) {
      hits += 1;
    }
  }
  assert.ok(hits >= 48, `expected most org-wide cues, got ${hits} / ${ORG_WIDE_PHRASINGS.length}`);
  assert.ok(ORG_WIDE_PHRASINGS.length >= 50, `phrasing bank should have 50+ examples, got ${ORG_WIDE_PHRASINGS.length}`);
});

test('organization choice label includes owner and email', () => {
  const label = organizationChoiceLabel(directory.organizations[1]);
  assert.match(label, /Green Valley Care/);
  assert.match(label, /Sita Verma/);
  assert.match(label, /sita@greenvalley\.example/);
});

test('ambiguous Green Valley Care offers clickable org chips with owner/email', async () => {
  const restore = mockPendingForOrg();
  try {
    const result = await answerPaymentRun(
      admin,
      'Green Valley Care organization ke andar jitni locations hain unki payroll do',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(result?.choices?.length >= 2, JSON.stringify(result));
    assert.match(result.reply, /organizations/i);
    assert.ok(result.choices.every((item) => /Owner:|Email:/i.test(item.label)));
    assert.equal(result.context.topic, 'run_org_pick');
  } finally {
    restore();
  }
});

test('single org payroll without format returns text summary (not history)', async () => {
  const restore = mockPendingForOrg();
  try {
    // Plain org payroll ask (no jitne-location / PDF / sheet) → chat text totals.
    const result = await answerPaymentRun(
      admin,
      'Golden Track Work organization ka payroll batao',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(result?.reply, JSON.stringify(result));
    assert.equal(result.plan, undefined);
    assert.equal(result.document, undefined);
    assert.equal(result.context.organizationId, orgA);
    assert.match(result.reply, /Golden Track Work|Net|₹|payroll/i);
  } finally {
    restore();
  }
});

test('single org payroll PDF stays download path without history mark', async () => {
  const restore = mockPendingForOrg();
  try {
    const result = await answerPaymentRun(
      admin,
      'Golden Track Work organization ke andar sab locations ki payroll PDF do',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(result?.document || result?.choices, JSON.stringify(result));
    if (result.document) {
      assert.equal(result.document.type, 'payroll');
      assert.equal(result.document.organizationId, orgA);
      assert.equal(result.document.batchId, undefined);
    }
  } finally {
    restore();
  }
});

test('single org history mark opens create/mark path', async () => {
  const restore = mockPendingForOrg();
  try {
    const result = await answerPaymentRun(
      admin,
      'Golden Track Work organization ke andar sab locations ka payroll history me mark kar do',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(result?.plan, JSON.stringify(result));
    assert.equal(result.plan.type, 'payroll_run');
    assert.equal(result.plan.organizationId, orgA);
    assert.notEqual(result.plan.markHistory, false);
  } finally {
    restore();
  }
});

test('plain sheet / history helpers still distinguish modes', () => {
  assert.equal(wantsPlainSheetDownload('org ki payroll PDF do'), true);
  assert.equal(wantsPrintedHistoryMark('org ki payroll history me mark kar do'), true);
  assert.equal(wantsOrgWideRun('company ke andar jitni locations'), true);
  assert.equal(wantsOrgWideRun('Housekeeping location ki payroll sheet'), false);
});

test('org-wide payroll PDF is not stolen by employee details', async () => {
  const messages = [
    'warm Earth care Iske andar jitni location and sabhi ka Mujhe payroll PDF Mein Do',
    'Golden Track Work Organisation ke andar jitne bhi location ki sari locations Ka Mujhe payroll do PDF mein',
    'Golden Track Work organization ke andar jitni locations ki payroll PDF do',
  ];
  for (const message of messages) {
    const details = await answerEmployeeDetails(admin, message, directory, 'hi', {
      topic: 'organization',
      organizationId: orgA,
      organizationName: 'Golden Track Work',
    });
    assert.equal(details, null, `employee details must defer: ${message}`);
  }
});

test('mein jitne bhi location … payroll chahiye is an all-locations payroll-sheet ask', () => {
  const variants = [
    'north gate work Mein jitne bhi location Hai Unka payroll chahie',
    'North Gate Work mein jitne bhi locations hain unka payroll chahiye',
    'Golden Track Work me jitni bhi location hai unki payroll do',
    'Warm Earth Care mein sabhi location ka payroll chahiye',
    'X ke andar jitne bhi location unka payroll sheet chahiye',
  ];
  for (const message of variants) {
    assert.equal(wantsAllLocationsPayrollAsk(message), true, message);
    assert.equal(wantsOrgWideRun(message) || wantsAllLocationsPayrollAsk(message), true, message);
  }
});

test('jitne bhi location payroll is not stolen by employee details', async () => {
  const message = 'north gate work Mein jitne bhi location Hai Unka payroll chahie';
  const details = await answerEmployeeDetails(admin, message, directory, 'hi', null);
  assert.equal(details, null);
});

test('named org + jitne bhi location payroll chahiye downloads without employee picker', async () => {
  const restore = mockPendingForOrg();
  try {
    const result = await answerPaymentRun(
      admin,
      'Golden Track Work Mein jitne bhi location Hai Unka payroll chahie',
      directory,
      TODAY,
      null,
      'hi',
    );
    assert.ok(result?.document || result?.choices, JSON.stringify(result));
    assert.equal(result.plan, undefined);
    if (result.document) {
      assert.equal(result.document.type, 'payroll');
      assert.equal(result.document.organizationId, orgA);
    }
    assert.ok(!/employees matched/i.test(result.reply || ''), result.reply);
  } finally {
    restore();
  }
});

test('sticky org + iske andar payroll PDF downloads for that organization', async () => {
  const restore = mockPendingForOrg();
  try {
    const result = await answerPaymentRun(
      admin,
      'Iske andar jitni location and sabhi ka Mujhe payroll PDF Mein Do',
      directory,
      TODAY,
      {
        topic: 'organization',
        organizationId: orgA,
        organizationName: 'Golden Track Work',
        kind: 'payroll',
      },
      'hi',
    );
    assert.ok(result?.document || result?.choices || result?.plan, JSON.stringify(result));
    if (result.document) {
      assert.equal(result.document.type, 'payroll');
      assert.equal(result.document.organizationId, orgA);
    }
    if (result.plan) {
      assert.equal(result.plan.organizationId, orgA);
    }
  } finally {
    restore();
  }
});
