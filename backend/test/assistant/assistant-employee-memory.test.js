const assert = require('node:assert/strict');
const test = require('node:test');

const { answerMemoryQuestion } = require('../../src/services/assistant/assistantMemory');
const { resolveOrganizations } = require('../../src/services/assistant/assistantEntityResolver');
const { enrichMessageForRules } = require('../../src/services/assistantLanguage');
const {
  mergeContext,
  isShortSubjectFollowUp,
} = require('../../src/services/assistant/assistantContext');
const {
  answerEmployeeDetails,
  answerSalaryAmount,
  asksSalaryAmount,
  extractParentNameFilter,
  askedEmployeeFields,
  answerDocumentMonthFollowUp,
} = require('../../src/services/assistantService');
const Employee = require('../../src/models/Employee');
const bankInvoiceService = require('../../src/services/bankInvoiceService');

test('kitne Name hai counts employees with that name', async () => {
  const orgId = '507f1f77bcf86cd799439011';
  const orgId2 = '507f1f77bcf86cd799439012';
  const locId = '507f1f77bcf86cd799439022';
  const directory = {
    organizations: [
      { id: orgId, name: 'NTPC Solapur', status: 'active' },
      { id: orgId2, name: 'Powergrid Khetri', status: 'active' },
    ],
    locations: [{
      id: locId, organizationId: orgId, organizationName: 'NTPC Solapur',
      workName: 'Horticulture', name: 'Garden', designation: 'Mali', status: 'active', address: '',
    }],
  };
  const rows = [
    { _id: '507f1f77bcf86cd7994390a1', name: 'Amit Yadav', parentName: 'Ram Sharma', organizationId: orgId, locationId: locId, designation: 'Mali', status: 'active' },
    { _id: '507f1f77bcf86cd7994390a2', name: 'Amit Yadav', parentName: 'Ram Sharma', organizationId: orgId2, locationId: locId, designation: 'Guard', status: 'active' },
    { _id: '507f1f77bcf86cd7994390a3', name: 'Amit Reddy', parentName: 'Gopal', organizationId: orgId, locationId: locId, designation: 'Mali', status: 'active' },
    { _id: '507f1f77bcf86cd7994390a4', name: 'Amit Iyer', parentName: 'Gopal Joshi', organizationId: orgId, locationId: locId, designation: 'Security', status: 'active' },
    { _id: '507f1f77bcf86cd7994390a5', name: 'Rajesh Sharma', parentName: '', organizationId: orgId, locationId: locId, designation: 'Security', status: 'active' },
    { _id: '507f1f77bcf86cd7994390a6', name: 'Ram Sharma', parentName: '', organizationId: orgId, locationId: locId, designation: 'Mali', status: 'active' },
  ];
  const originalFind = Employee.find;
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => rows,
  });
  try {
    const amitYadav = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Amit Yadav hai',
      directory,
      'hi',
      null,
    );
    assert.ok(amitYadav);
    assert.match(amitYadav.reply, /2 employee/i);
    assert.doesNotMatch(amitYadav.reply, /Reddy|Iyer|Which document|didn't catch/i);

    const amit = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Amit hai',
      directory,
      'hi',
      null,
    );
    assert.ok(amit);
    assert.match(amit.reply, /4 employee/i);
    assert.ok(Array.isArray(amit.choices));
    assert.equal(amit.choices.length, 4);
    assert.equal(amit.choices[0].plan.type, 'directory_select');
    assert.equal(amit.choices[0].plan.selectionType, 'employee');
    assert.ok(amit.choices.every((choice) => choice.plan.selectedId));

    const reddy = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Amit Reddy hai',
      directory,
      'hi',
      null,
    );
    assert.ok(reddy);
    assert.match(reddy.reply, /1 employee/i);
    assert.doesNotMatch(reddy.reply, /Iyer/i);
    assert.equal(reddy.choices?.length, 1);
    assert.equal(reddy.choices[0].plan.selectedId, '507f1f77bcf86cd7994390a3');

    const ayyar = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Amit Ayyar Hain',
      directory,
      'hi',
      null,
    );
    assert.ok(ayyar);
    assert.match(ayyar.reply, /1 employee|Amit Iyer/i);
    assert.doesNotMatch(ayyar.reply, /Reddy/i);

    const rahul = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Rahul Sharma hai',
      directory,
      'hi',
      null,
    );
    assert.ok(rahul);
    assert.match(rahul.reply, /नहीं मिला|No employee|0 employee|कोई employee नहीं/i);
    assert.doesNotMatch(rahul.reply, /Rajesh Sharma|Ram Sharma/i);

    const ram = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'kitne Ram Sharma hai',
      directory,
      'hi',
      null,
    );
    assert.ok(ram);
    assert.match(ram.reply, /1 employee/i);
    assert.doesNotMatch(ram.reply, /Rajesh Sharma|Which document|didn't catch|माफ़/i);
  } finally {
    Employee.find = originalFind;
  }
});

test('name-count choice opens employee details from memory', async () => {
  const orgId = '507f1f77bcf86cd799439011';
  const locId = '507f1f77bcf86cd799439022';
  const directory = {
    organizations: [{ id: orgId, name: 'NTPC Solapur', status: 'active' }],
    locations: [{
      id: locId, organizationId: orgId, organizationName: 'NTPC Solapur',
      workName: 'Horticulture', name: 'Garden', designation: 'Mali', status: 'active', address: '',
    }],
  };
  const employeeId = '507f1f77bcf86cd7994390a4';
  const originalFindById = Employee.findById;
  Employee.findById = (id) => ({
    select() { return this; },
    lean: async () => ({
      _id: employeeId,
      name: 'Amit Iyer',
      parentName: 'Gopal Joshi',
      organizationId: orgId,
      locationId: locId,
      designation: 'Security',
      status: 'active',
      phone: '9999999999',
    }),
  });
  try {
    const details = await answerEmployeeDetails(
      { id: '1', role: 'admin' },
      'details',
      directory,
      'en',
      { topic: 'employee', employeeId },
    );
    assert.ok(details);
    assert.match(details.reply, /Amit Iyer/i);
    assert.match(details.reply, /details|Parent|Phone|Security/i);
    assert.equal(details.context?.employeeId, employeeId);
  } finally {
    Employee.findById = originalFindById;
  }
});

test('yadav employee details is not a memory question', () => {
  const replies = [
    'अमित यादव एम्पलाई की डिटेल्स दो',
    'अमित यादव एम्पलाई डीटेल्स',
    'Amit Yadav employee ki details do',
  ];
  for (const message of replies) {
    assert.equal(
      answerMemoryQuestion(message, { actions: [] }, 'hi'),
      null,
      `Memory must not match: ${message}`,
    );
  }
});

test('explicit memory phrases still match', () => {
  const reply = answerMemoryQuestion('अब तक क्या किया', { actions: [] }, 'hi');
  assert.match(reply, /database में कोई बदलाव नहीं/);
  assert.match(answerMemoryQuestion('what have you done', { actions: [] }, 'en'), /No database changes/);
});

test('stopword-only organization names score zero for fuzzy naam queries', () => {
  const result = resolveOrganizations('naam batao', [
    { id: '1', name: 'of organisation the name', status: 'active' },
    { id: '2', name: 'HPCL Mumbai', status: 'active' },
  ]);
  assert.ok(!result.matches.some((item) => item.name === 'of organisation the name'));
});

test('both locations employee details enrich does not inject payroll', () => {
  const enriched = enrichMessageForRules('both locations ki employee ki details do');
  assert.doesNotMatch(enriched, /\bpayroll\b/i);
  assert.match(enriched, /employee/i);
});

test('uske mobile and aadhar card reuse remembered employee', async () => {
  const employeeId = '507f1f77bcf86cd799439077';
  const directory = {
    organizations: [{ id: '507f1f77bcf86cd799439011', name: 'SAIL Bhilai', status: 'active' }],
    locations: [{
      id: '507f1f77bcf86cd799439022',
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'SAIL Bhilai',
      workName: 'Security',
      name: 'Gate',
      designation: 'Security',
      status: 'active',
      address: '',
    }],
  };
  const memory = { topic: 'employee', employeeId, employeeName: 'Amit Iyer' };
  const user = { id: '1', role: 'admin' };
  const doc = {
    _id: employeeId,
    name: 'Amit Iyer',
    parentName: 'Gopal Joshi',
    phone: '9876543210',
    aadhaarNumber: '123456789012',
    organizationId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439022',
    designation: 'Security Supervisor',
    status: 'active',
    bankName: 'HDFC',
    bankBranch: 'Town',
    bankAccountNumber: '1234560536',
    bankRoutingCode: 'HDFC0003120',
    bankAccountHolder: 'Amit Iyer',
  };

  const originalFindById = Employee.findById;
  const originalFind = Employee.find;
  Employee.findById = (id) => {
    const hit = String(id) === employeeId ? doc : null;
    const api = {
      select() { return api; },
      lean: async () => hit,
    };
    return api;
  };
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [],
  });

  try {
    const mobile = await answerEmployeeDetails(user, 'Uske mobile number do', directory, 'en', memory);
    assert.ok(mobile);
    assert.match(mobile.reply, /9876543210|Mobile/i);
    assert.doesNotMatch(mobile.reply, /Which document/i);
    assert.doesNotMatch(mobile.reply, /match this name/i);

    const aadhaar = await answerEmployeeDetails(user, 'Uske Aadhar Card details', directory, 'en', memory);
    assert.ok(aadhaar);
    assert.match(aadhaar.reply, /Aadhaar.*123456789012/i);
    assert.doesNotMatch(aadhaar.reply, /XXXXXXXX|Employees page/i);
    assert.doesNotMatch(aadhaar.reply, /Choudhary/i);
    assert.doesNotMatch(aadhaar.reply, /match this name/i);
  } finally {
    Employee.findById = originalFindById;
    Employee.find = originalFind;
  }
});

test('son of parent filter and salary batao are amount not payroll pdf', () => {
  assert.equal(extractParentNameFilter('Amit Ayyar son of Gopal Joshi Uske salary batao'), 'Gopal Joshi');
  assert.equal(extractParentNameFilter('Amit Reddy (S/O Gopal Mehta)'), 'Gopal Mehta');
  assert.equal(asksSalaryAmount('Amit Ayyar son of Gopal Joshi uski salary details batao'), true);
  assert.equal(asksSalaryAmount('salary batao'), true);
  assert.equal(asksSalaryAmount('generate payroll pdf'), false);
});

test('single employee field phrases map to the right field ids', () => {
  const cases = [
    ['Uske UN number batao', 'uan'],
    ['uski uan number do', 'uan'],
    ['uske adress batao', 'address'],
    ['uska address do', 'address'],
    ['uski joining date batao', 'doj'],
    ['date of birth batao', 'dob'],
    ['uska mobile number', 'phone'],
    ['uski email id', 'email'],
    ['uska ifsc code', 'ifsc'],
    ['uski aadhaar card', 'aadhaar'],
    ['uska designation', 'designation'],
    ['uski location batao', 'location'],
    ['uska daily wage', 'wage'],
    ['father name batao', 'parent'],
  ];
  for (const [message, fieldId] of cases) {
    const fields = askedEmployeeFields(message);
    assert.ok(fields.some((field) => field.id === fieldId), `${message} → ${fieldId}, got ${fields.map((f) => f.id).join(',')}`);
  }
});

test('uan and address typos are recognized as employee fields', async () => {
  const employeeId = '507f1f77bcf86cd799439077';
  const directory = {
    organizations: [{ id: '507f1f77bcf86cd799439011', name: 'SAIL Burnpur', status: 'active' }],
    locations: [{
      id: '507f1f77bcf86cd799439022',
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'SAIL Burnpur',
      workName: 'Housekeeping',
      name: 'Admin',
      designation: 'Sweeper',
      status: 'active',
      address: '',
    }],
  };
  const memory = { topic: 'employee', employeeId, employeeName: 'Amit Reddy' };
  const user = { id: '1', role: 'admin' };
  const doc = {
    _id: employeeId,
    name: 'Amit Reddy',
    parentName: 'Gopal Mehta',
    phone: '9700007809',
    uan: '101000203547',
    address: 'Quarter 18, Burnpur',
    aadhaarNumber: '',
    organizationId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439022',
    designation: 'Sweeper',
    status: 'active',
  };
  const originalFindById = Employee.findById;
  const originalFind = Employee.find;
  Employee.findById = (id) => {
    const hit = String(id) === employeeId ? doc : null;
    const api = { select() { return api; }, lean: async () => hit };
    return api;
  };
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [],
  });
  try {
    const uan = await answerEmployeeDetails(user, 'Uske UN number batao', directory, 'en', memory);
    assert.ok(uan);
    assert.match(uan.reply, /101000203547|UAN/i);
    assert.doesNotMatch(uan.reply, /9700007809|Mobile/i);

    const address = await answerEmployeeDetails(user, 'Uske adress batao', directory, 'en', memory);
    assert.ok(address);
    assert.match(address.reply, /Quarter 18|Address/i);
    assert.doesNotMatch(address.reply, /Which document/i);
  } finally {
    Employee.findById = originalFindById;
    Employee.find = originalFind;
  }
});

test('named employee details prefer sticky location match', async () => {
  const stickyLoc = '507f1f77bcf86cd7994390d1';
  const otherLoc = '507f1f77bcf86cd7994390d2';
  const stickyEmp = '507f1f77bcf86cd7994390d3';
  const otherEmp = '507f1f77bcf86cd7994390d4';
  const orgSticky = '507f1f77bcf86cd7994390d5';
  const orgOther = '507f1f77bcf86cd7994390d6';
  const directory = {
    organizations: [
      { id: orgSticky, name: 'BHEL Bhopal', status: 'active' },
      { id: orgOther, name: 'Powergrid Bhiwani', status: 'active' },
    ],
    locations: [
      {
        id: stickyLoc, organizationId: orgSticky, organizationName: 'BHEL Bhopal',
        workName: 'Housekeeping', name: 'Bhopal Staff Canteen', designation: 'Cleaner', status: 'active', address: '',
      },
      {
        id: otherLoc, organizationId: orgOther, organizationName: 'Powergrid Bhiwani',
        workName: 'Security', name: 'Bhiwani Switchyard Post', designation: 'Security', status: 'active', address: '',
      },
    ],
  };
  const user = { id: '1', role: 'admin' };
  const originalFind = Employee.find;
  const originalFindById = Employee.findById;
  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => ([
      {
        _id: stickyEmp, name: 'Rakesh Nair', parentName: 'Ram', organizationId: orgSticky, locationId: stickyLoc,
        designation: 'Cleaner', status: 'active', phone: '9000000001',
      },
      {
        _id: otherEmp, name: 'Rakesh Nair', parentName: 'Shyam Singh', organizationId: orgOther, locationId: otherLoc,
        designation: 'Security Supervisor', status: 'active', phone: '9700000959',
      },
    ]),
  });
  Employee.findById = (id) => {
    const docs = {
      [stickyEmp]: {
        _id: stickyEmp, name: 'Rakesh Nair', parentName: 'Ram', organizationId: orgSticky, locationId: stickyLoc,
        designation: 'Cleaner', status: 'active', phone: '9000000001', skill: '', employmentType: 'contractual',
        email: '', dateOfBirth: null, dateOfJoining: null, dailyWage: 0, basic: 0, da: 0, otherAllowance: 0,
        epfApplicable: true, esicApplicable: true, uan: '', esicNumber: '', aadhaarNumber: '', bankName: '',
        bankBranch: '', bankAccountNumber: '', bankRoutingCode: '', bankAccountHolder: '', address: '',
      },
    };
    const hit = docs[String(id)] || null;
    const api = { select() { return api; }, lean: async () => hit };
    return api;
  };
  try {
    const result = await answerEmployeeDetails(
      user,
      'Rakesh Nair ki employee details do',
      directory,
      'en',
      {
        organizationId: orgSticky,
        locationId: stickyLoc,
        locationIds: [stickyLoc],
        topic: 'employees',
        items: ['Manoj Iyer', 'Rakesh Nair'],
      },
    );
    assert.ok(result);
    assert.match(result.reply, /Cleaner|Bhopal Staff Canteen|9000000001/i);
    assert.doesNotMatch(result.reply, /Bhiwani|Security Supervisor|9700000959/i);
  } finally {
    Employee.find = originalFind;
    Employee.findById = originalFindById;
  }
});

test('document subject sticks across merge and short month follow-ups', () => {
  const previous = {
    topic: 'document',
    documentType: 'attendance_register',
    format: 'pdf',
    month: '2026-11',
    organizationId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439033',
    locationName: 'Housekeeping – Bhopal Staff Canteen',
    employeeId: null,
    query: 'Bhopal staff canteen mein cleaner ki attendance do mujhe',
    turn: 2,
  };
  const merged = mergeContext(previous, { turn: 3, lang: 'hi' });
  assert.equal(merged.documentType, 'attendance_register');
  assert.equal(merged.locationId, '507f1f77bcf86cd799439033');
  assert.equal(merged.query, previous.query);
  assert.equal(isShortSubjectFollowUp('October ki chahie Mujhe'), true);
  assert.equal(isShortSubjectFollowUp('uski details batao'), true);
});

test('October ki chahiye replays sticky attendance register', async () => {
  const locationId = '507f1f77bcf86cd799439033';
  const organizationId = '507f1f77bcf86cd799439011';
  const directory = {
    organizations: [{ id: organizationId, name: 'Cleaner Org', status: 'active' }],
    locations: [{
      id: locationId,
      organizationId,
      organizationName: 'Cleaner Org',
      workName: 'Housekeeping',
      name: 'Bhopal Staff Canteen',
      designation: 'Cleaner',
      status: 'active',
      address: '',
    }],
  };
  const context = {
    topic: 'document',
    documentType: 'attendance_register',
    format: 'pdf',
    month: '2026-11',
    organizationId,
    locationId,
    locationName: 'Housekeeping – Bhopal Staff Canteen',
    employeeId: null,
    query: 'Bhopal staff canteen mein cleaner ki attendance do mujhe',
  };
  const user = { id: '1', role: 'admin' };
  const result = await answerDocumentMonthFollowUp(
    user,
    'October ki chahie Mujhe',
    directory,
    '2026-11-16',
    context,
  );
  assert.ok(result);
  assert.ok(result.document);
  assert.equal(result.document.type, 'attendance_register');
  assert.equal(result.document.month, '2026-10');
  assert.equal(result.document.locationId, locationId);
  assert.match(result.reply, /October 2026|FORM XVI|Bhopal Staff Canteen/i);
  assert.doesNotMatch(result.reply, /Which document|didn't catch/i);
});

test('named employee salary batao returns text amount not document', async () => {
  const employeeId = '507f1f77bcf86cd799439077';
  const directory = {
    organizations: [{ id: '507f1f77bcf86cd799439011', name: 'SAIL Bhilai', status: 'active' }],
    locations: [{
      id: '507f1f77bcf86cd799439022',
      organizationId: '507f1f77bcf86cd799439011',
      organizationName: 'SAIL Bhilai',
      workName: 'Security',
      name: 'Gate',
      designation: 'Security',
      status: 'active',
      address: '',
    }],
  };
  const user = { id: '1', role: 'admin' };
  const originalFind = Employee.find;
  const originalPreview = bankInvoiceService.previewLocationsPayroll;

  Employee.find = () => ({
    select() { return this; },
    limit() { return this; },
    lean: async () => [{
      _id: employeeId,
      name: 'Amit Iyer',
      parentName: 'Gopal Joshi',
      organizationId: '507f1f77bcf86cd799439011',
      locationId: '507f1f77bcf86cd799439022',
      designation: 'Security Supervisor',
      status: 'active',
    }],
  });
  bankInvoiceService.previewLocationsPayroll = async () => ({
    lines: [{
      employeeId,
      paidDays: 20,
      presentDays: 20,
      halfDays: 0,
      absentDays: 0,
      wages: 10000,
      grossPay: 10000,
      bonus: 0,
      epf: 100,
      esi: 50,
      netPay: 9850,
    }],
  });

  try {
    const result = await answerSalaryAmount(
      user,
      'Amit Ayyar son of Gopal Joshi Uske salary batao',
      directory,
      '2026-11-16',
      { employeeId, employeeName: 'Amit Iyer' },
      'en',
    );
    assert.ok(result);
    assert.match(result.reply, /Amit Iyer|Net payable|9850|9,850/i);
    assert.equal(result.plan, undefined);
    assert.doesNotMatch(result.reply, /IOCL Mathura|download|PDF|Excel/i);
  } finally {
    Employee.find = originalFind;
    bankInvoiceService.previewLocationsPayroll = originalPreview;
  }
});
