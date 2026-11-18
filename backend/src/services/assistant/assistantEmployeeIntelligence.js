/**
 * Employee Intelligence 3.0 — field registry, sticky employee groups, dynamic retrieval.
 * Reuses Employee schema fields and existing masking rules (admin = full, else last-4).
 */

const mongoose = require('mongoose');
const Employee = require('../../models/Employee');

const EMPLOYEE_FIELD_REGISTRY = [
  {
    id: 'name',
    db: 'name',
    labelHi: 'Employee Name',
    labelEn: 'Employee Name',
    words: ['name', 'names', 'naam', 'employee name', 'नाम'],
    sensitive: false,
    alwaysIncludeWithProfile: true,
  },
  {
    id: 'phone',
    db: 'phone',
    labelHi: 'Mobile Number',
    labelEn: 'Mobile Number',
    words: [
      'mobile', 'mobile number', 'phone', 'phone number', 'contact', 'contact number', 'cell', 'mob', 'whatsapp',
      'मोबाइल', 'मोबाइल नंबर', 'मोबाइल नम्बर', 'फोन', 'फोन नंबर', 'फ़ोन', 'संपर्क',
    ],
    sensitive: true,
  },
  {
    id: 'email',
    db: 'email',
    labelHi: 'Email',
    labelEn: 'Email',
    words: ['email', 'e-mail', 'mail id', 'email id', 'ईमेल', 'इमेल', 'मेल आईडी'],
    sensitive: false,
  },
  {
    id: 'parent',
    db: 'parentName',
    labelHi: 'पिता/अभिभावक',
    labelEn: 'Parent / guardian',
    words: ['father', 'parent', 'guardian', 'pita', 'पिता', 'पापा', 'अभिभावक', 'father name', 'parent name'],
    sensitive: false,
  },
  {
    id: 'designation',
    db: 'designation',
    labelHi: 'Designation',
    labelEn: 'Designation',
    words: ['designation', 'destination', 'desination', 'role', 'post', 'job title', 'पद', 'पदनाम'],
    sensitive: false,
  },
  {
    id: 'address',
    db: 'address',
    labelHi: 'Address',
    labelEn: 'Address',
    words: ['address', 'adress', 'addres', 'pata', 'पता', 'एड्रेस', 'एडरेस'],
    sensitive: false,
  },
  {
    id: 'doj',
    db: 'dateOfJoining',
    labelHi: 'Date of joining',
    labelEn: 'Date of joining',
    words: ['joining date', 'date of joining', 'doj', 'join date', 'जॉइनिंग', 'ज्वाइनिंग', 'जॉइन डेट'],
    sensitive: false,
  },
  {
    id: 'dob',
    db: 'dateOfBirth',
    labelHi: 'Date of birth',
    labelEn: 'Date of birth',
    words: ['date of birth', 'dob', 'birthday', 'जन्म', 'जन्म तिथि'],
    sensitive: false,
  },
  {
    id: 'department',
    db: 'department',
    labelHi: 'Department',
    labelEn: 'Department',
    words: ['department', 'dept', 'विभाग'],
    sensitive: false,
  },
  {
    id: 'status',
    db: 'status',
    labelHi: 'Status',
    labelEn: 'Status',
    words: ['status', 'स्टेटस', 'स्थिति'],
    sensitive: false,
  },
  {
    id: 'uan',
    db: 'uan',
    labelHi: 'UAN',
    labelEn: 'UAN',
    words: ['uan', 'uan number', 'यूएएन'],
    sensitive: true,
  },
  {
    id: 'esic',
    db: 'esicNumber',
    labelHi: 'ESIC',
    labelEn: 'ESIC',
    words: ['esic', 'esi', 'esic number', 'ईएसआईसी'],
    sensitive: true,
  },
  {
    id: 'aadhaar',
    db: 'aadhaarNumber',
    labelHi: 'Aadhaar',
    labelEn: 'Aadhaar',
    words: ['aadhaar', 'aadhar', 'adhar', 'आधार'],
    sensitive: true,
  },
  {
    id: 'bankName',
    db: 'bankName',
    labelHi: 'Bank name',
    labelEn: 'Bank name',
    words: ['bank name', 'bank', 'बैंक', 'बैंक का नाम'],
    sensitive: false,
    bank: true,
  },
  {
    id: 'bankAccountHolder',
    db: 'bankAccountHolder',
    labelHi: 'Account holder',
    labelEn: 'Account holder',
    words: ['account holder', 'account name', 'अकाउंट होल्डर'],
    sensitive: false,
    bank: true,
  },
  {
    id: 'account',
    db: 'bankAccountNumber',
    labelHi: 'Account number',
    labelEn: 'Account number',
    words: ['account number', 'account no', 'bank account', 'खाता नंबर', 'अकाउंट नंबर'],
    sensitive: true,
    bank: true,
  },
  {
    id: 'ifsc',
    db: 'bankRoutingCode',
    labelHi: 'IFSC',
    labelEn: 'IFSC',
    words: ['ifsc', 'ifsc code', 'आईएफएससी'],
    sensitive: false,
    bank: true,
  },
  {
    id: 'bankBranch',
    db: 'bankBranch',
    labelHi: 'Bank branch',
    labelEn: 'Bank branch',
    words: ['bank branch', 'branch', 'ब्रांच'],
    sensitive: false,
    bank: true,
  },
];

const PROFILE_FIELD_IDS = [
  'name', 'parent', 'phone', 'email', 'designation', 'department', 'address', 'doj', 'dob', 'status',
  'uan', 'esic', 'aadhaar', 'bankName', 'bankAccountHolder', 'account', 'ifsc', 'bankBranch',
];

const FIELD_NUMBER_PREFIXES = [
  'mobile', 'phone', 'contact', 'account', 'aadhaar', 'aadhar', 'uan', 'esic', 'ifsc',
  'मोबाइल', 'फोन', 'अकाउंट', 'खाता', 'आधार',
];

const GROUP_ALL_WORDS = [
  'charon', 'chaaron', 'charo', 'chaaro', 'sabhi', 'sab', 'sare', 'saare', 'sari', 'saari', 'all', 'every',
  'teeno', 'teenon', 'dono', 'donon', 'both',
  'चारों', 'चारो', 'तीनों', 'दोनों', 'सभी', 'सब', 'सारे', 'सारी',
];

const FIRST_PAIR_WORDS = ['pehle', 'pehli', 'pehla', 'first', 'पहले', 'पहली', 'पहला'];
const REST_WORDS = ['baaki', 'baki', 'remaining', 'rest', 'other', 'बाकी', 'बचे'];

function includesAny(text, list) {
  const lower = String(text || '').toLowerCase();
  return list.some((word) => (/^[a-z0-9 .'-]+$/i.test(word)
    ? new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower)
    : lower.includes(String(word).toLowerCase())));
}

function maskSensitive(value) {
  if (value == null || value === '') return value ?? '';
  const raw = String(value).replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.length <= 4) return '****';
  return `**** ${raw.slice(-4)}`;
}

function canViewUnmasked(user) {
  return user?.role === 'admin';
}

function messageWantsEmployeeCount(text) {
  const raw = String(text || '');
  // "mobile number" / "account number" are field asks — never employee counts
  // (also guards synonym-expanded text that injects "how many/kitne" from "number").
  if (includesAny(raw, ['number', 'numbers', 'नंबर', 'नम्बर', 'no', 'no.'])
    && includesAny(raw, FIELD_NUMBER_PREFIXES)) {
    return false;
  }
  if (includesAny(raw, ['how many', 'kitne', 'kitni', 'kitna', 'कितने', 'कितनी', 'कितना', 'count', 'total', 'संख्या', 'number of', 'headcount'])) {
    return true;
  }
  if (includesAny(raw, ['number', 'numbers', 'नंबर', 'नम्बर'])) {
    return true;
  }
  return false;
}

function parseRequestedEmployeeFields(message) {
  const text = String(message || '');
  const wantsComplete = includesAny(text, [
    'complete', 'full details', 'full detail', 'full profile', 'complete details', 'complete profile',
    'sab kuch', 'all details', 'all available', 'सभी डिटेल', 'फुल डिटेल्स', 'फुल डिटेल', 'पूरी डिटेल्स', 'पूरा प्रोफाइल',
  ]) || (includesAny(text, ['details', 'detail', 'profile', 'डिटेल', 'डिटेल्स', 'प्रोफाइल'])
    && !EMPLOYEE_FIELD_REGISTRY.some((field) => field.id !== 'name' && includesAny(text, field.words)));

  const wantsBankBundle = includesAny(text, [
    'bank detail', 'bank details', 'bank info', 'बैंक डिटेल', 'बैंक डिटेल्स', 'बैंक जानकारी',
  ]);

  const ranked = [];
  for (const field of EMPLOYEE_FIELD_REGISTRY) {
    const hit = (field.words || [])
      .filter((word) => includesAny(text, [word]))
      .sort((a, b) => String(b).length - String(a).length)[0];
    if (hit) ranked.push({ field, score: String(hit).length });
  }
  ranked.sort((a, b) => b.score - a.score);
  const seen = new Set();
  let fields = ranked.map((item) => item.field).filter((field) => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });

  if (wantsBankBundle) {
    for (const id of ['bankName', 'bankAccountHolder', 'account', 'ifsc', 'bankBranch']) {
      const field = EMPLOYEE_FIELD_REGISTRY.find((item) => item.id === id);
      if (field && !seen.has(id)) {
        fields.push(field);
        seen.add(id);
      }
    }
  }

  const wantsNames = includesAny(text, ['naam', 'name', 'names', 'नाम', 'list', 'लिस्ट']);
  if (wantsNames && !seen.has('name')) {
    fields = [EMPLOYEE_FIELD_REGISTRY.find((item) => item.id === 'name'), ...fields].filter(Boolean);
  }

  if (wantsComplete || (fields.length === 0 && includesAny(text, ['details', 'detail', 'profile', 'डिटेल', 'डिटेल्स']))) {
    return {
      fields: PROFILE_FIELD_IDS.map((id) => EMPLOYEE_FIELD_REGISTRY.find((item) => item.id === id)).filter(Boolean),
      complete: true,
      wantsNames,
    };
  }

  if (fields.length === 0 && wantsNames) {
    return { fields: [EMPLOYEE_FIELD_REGISTRY.find((item) => item.id === 'name')], complete: false, wantsNames: true };
  }

  // Always show name alongside other requested fields for group tables.
  if (fields.length > 0 && !fields.some((field) => field.id === 'name')) {
    fields = [EMPLOYEE_FIELD_REGISTRY.find((item) => item.id === 'name'), ...fields].filter(Boolean);
  }

  return { fields, complete: false, wantsNames };
}

function parseEmployeeGroupQuantifier(message, groupSize = 0) {
  const text = String(message || '');
  if (includesAny(text, REST_WORDS)) return { mode: 'rest', count: null };
  if (includesAny(text, FIRST_PAIR_WORDS) && includesAny(text, ['dono', 'donon', 'both', 'दोनों', 'do', 'two', '2'])) {
    return { mode: 'first', count: 2 };
  }
  if (includesAny(text, ['pehle teen', 'first three', 'पहले तीन', 'teeno', 'teenon', 'तीनों'])) {
    return { mode: 'first', count: 3 };
  }
  if (includesAny(text, ['charon', 'chaaron', 'charo', 'chaaro', 'चारों', 'चारो', 'all four', 'four employees'])) {
    return { mode: 'all', count: groupSize || 4 };
  }
  if (includesAny(text, ['dono', 'donon', 'both', 'दोनों'])) {
    if (groupSize === 2) return { mode: 'all', count: 2 };
    if (groupSize > 2) return { mode: 'ambiguous_both', count: 2 };
    return { mode: 'first', count: 2 };
  }
  if (includesAny(text, GROUP_ALL_WORDS) || includesAny(text, ['unke', 'unki', 'unka', 'inke', 'inki', 'inka', 'inmein', 'usmein', 'उनके', 'उनकी', 'इनके', 'इनकी'])) {
    return { mode: 'all', count: groupSize || null };
  }
  return { mode: 'all', count: groupSize || null };
}

function buildEmployeeQueryGroup({
  source = 'organization',
  organizationId = null,
  organizationName = null,
  locationId = null,
  locationIds = null,
  employeeIds = null,
  count = null,
  status = 'active',
  lastQueryType = 'employee_count',
  members = null,
} = {}) {
  return {
    source,
    organizationId: organizationId || null,
    organizationName: organizationName || null,
    locationId: locationId || null,
    locationIds: Array.isArray(locationIds) ? locationIds : null,
    employeeIds: Array.isArray(employeeIds) ? employeeIds.map(String) : [],
    count: count != null ? count : (Array.isArray(employeeIds) ? employeeIds.length : null),
    filters: { status: status || 'active' },
    lastQueryType,
    members: Array.isArray(members) ? members : null,
  };
}

function authorizeFields(fields, user) {
  const unmasked = canViewUnmasked(user);
  return (fields || []).map((field) => {
    if (field.bank && field.sensitive && !unmasked) {
      return { ...field, denied: true };
    }
    if (field.sensitive && !unmasked) {
      return { ...field, mask: true };
    }
    return { ...field, mask: false, denied: false };
  });
}

function scopeFilter(user) {
  return user.role === 'admin'
    ? { organizationId: { $ne: null } }
    : { organizationId: new mongoose.Types.ObjectId(user.id) };
}

async function retrieveEmployeesForQuery(user, {
  organizationId = null,
  locationId = null,
  locationIds = null,
  employeeIds = null,
  status = 'active',
  limit = 80,
} = {}) {
  const filter = { ...scopeFilter(user) };
  if (status === 'active') filter.status = { $ne: 'disabled' };
  else if (status === 'disabled') filter.status = 'disabled';

  if (Array.isArray(employeeIds) && employeeIds.length) {
    filter._id = { $in: employeeIds.filter((id) => mongoose.isValidObjectId(id)) };
  } else {
    if (organizationId) filter.organizationId = organizationId;
    if (locationId) filter.locationId = locationId;
    else if (Array.isArray(locationIds) && locationIds.length) {
      filter.locationId = { $in: locationIds };
    }
  }

  const select = EMPLOYEE_FIELD_REGISTRY.map((field) => field.db).concat(['organizationId', 'locationId', 'status']).join(' ');
  const rows = await Employee.find(filter)
    .select(select)
    .sort({ name: 1 })
    .limit(limit)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    name: row.name || '',
    parentName: row.parentName || '',
    phone: row.phone || '',
    email: row.email || '',
    designation: row.designation || '',
    address: row.address || '',
    dateOfJoining: row.dateOfJoining || '',
    dateOfBirth: row.dateOfBirth || '',
    department: row.department || '',
    status: row.status || 'active',
    uan: row.uan || '',
    esicNumber: row.esicNumber || '',
    aadhaarNumber: row.aadhaarNumber || '',
    bankName: row.bankName || '',
    bankBranch: row.bankBranch || '',
    bankAccountHolder: row.bankAccountHolder || '',
    bankAccountNumber: row.bankAccountNumber || '',
    bankRoutingCode: row.bankRoutingCode || '',
    organizationId: row.organizationId ? String(row.organizationId) : null,
    locationId: row.locationId ? String(row.locationId) : null,
  }));
}

function applyQuantifier(employees, quantifier) {
  if (!Array.isArray(employees) || employees.length === 0) return { employees: [], ambiguous: false };
  if (!quantifier || quantifier.mode === 'all') {
    return { employees, ambiguous: false };
  }
  if (quantifier.mode === 'first') {
    return { employees: employees.slice(0, quantifier.count || 2), ambiguous: false };
  }
  if (quantifier.mode === 'rest') {
    return { employees: employees.slice(2), ambiguous: false };
  }
  if (quantifier.mode === 'ambiguous_both') {
    return { employees, ambiguous: true, needCount: 2 };
  }
  return { employees, ambiguous: false };
}

function fieldDisplayValue(field, employee, user) {
  if (field.denied) return 'Not authorized';
  const raw = employee[field.db] ?? employee[field.id] ?? '';
  if (raw === '' || raw == null) return 'Not available';
  if (field.mask || (field.sensitive && !canViewUnmasked(user))) return maskSensitive(raw) || 'Not available';
  return String(raw);
}

function formatEmployeeFieldReply({
  title,
  employees,
  fields,
  lang = 'hi',
  user = null,
  complete = false,
}) {
  const authorized = authorizeFields(fields, user).filter((field) => !field.denied || field.id === 'name');
  if (!employees.length) {
    return lang === 'en'
      ? `${title}\nNo employees found.`
      : `${title}\nकोई employee नहीं मिला।`;
  }

  if (complete || authorized.length > 5) {
    const sections = employees.map((employee, index) => {
      const lines = authorized.map((field) => {
        const label = lang === 'en' ? field.labelEn : field.labelHi;
        return `${label}: ${fieldDisplayValue(field, employee, user)}`;
      });
      return `${index + 1}. ${employee.name}\n${lines.join('\n')}`;
    });
    return `${title} (${employees.length})\n\n${sections.join('\n\n')}`;
  }

  const headers = authorized.map((field) => (lang === 'en' ? field.labelEn : field.labelHi));
  const headerLine = `| ${headers.join(' | ')} |`;
  const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rows = employees.map((employee) => (
    `| ${authorized.map((field) => fieldDisplayValue(field, employee, user)).join(' | ')} |`
  ));
  return `${title} (${employees.length})\n\n${headerLine}\n${sepLine}\n${rows.join('\n')}`;
}

function isStickyEmployeeFieldFollowUp(message, context) {
  if (!context) return false;
  // Require an employee query group / employee topic — bare org profile context is not enough
  // (so "uska mobile" after organization details stays an org contact card).
  const hasGroup = Boolean(
    context.employeeQueryGroup?.organizationId
    || context.employeeQueryGroup?.locationId
    || context.employeeQueryGroup?.employeeIds?.length
    || context.employeeIds?.length
    || ((context.topic === 'employees' || context.lastIntent === 'organization_employee_count'
      || context.lastIntent === 'location_employee_count'
      || context.lastIntent === 'organization_employee_list'
      || context.lastIntent === 'department_employee_count')
      && (context.organizationId || context.locationId || context.locationIds?.length)),
  );
  if (!hasGroup) return false;

  const text = String(message || '');
  const parsed = parseRequestedEmployeeFields(text);
  if (messageWantsEmployeeCount(text) && !parsed.fields.some((field) => field.id !== 'name') && !parsed.complete) {
    return false;
  }

  // Names-only roster asks ("unke naam", "donon employ ke naam") stay on existing list handlers.
  // When parseRequestedEmployeeFields expands "details" into a full profile field list, ignore that
  // expansion for sticky detection — require an explicit complete/employee-profile ask instead.
  const hasConcreteField = !parsed.complete && parsed.fields.some((field) => field.id !== 'name');
  const employeeCue = includesAny(text, [
    'employee', 'employees', 'employ', 'karmachari', 'staff', 'एम्प्लॉई', 'एम्पलाई', 'कर्मचारी',
  ]);
  const completeEmployeeAsk = parsed.complete && (
    includesAny(text, [
      'complete', 'full details', 'full detail', 'full profile', 'complete details', 'complete profile',
      'sab kuch', 'all details', 'all available', 'सभी डिटेल', 'फुल डिटेल्स', 'फुल डिटेल', 'पूरी डिटेल्स', 'पूरा प्रोफाइल',
    ])
    || (includesAny(text, ['details', 'detail', 'profile', 'डिटेल', 'डिटेल्स', 'प्रोफाइल']) && employeeCue)
  );
  // "donon ki details" / "unki details" without employee words → location/person handlers, not fields.
  if (!hasConcreteField && !completeEmployeeAsk) return false;

  const referential = includesAny(text, [
    'unke', 'unki', 'unka', 'inke', 'inki', 'inka', 'uske', 'uski', 'charon', 'chaaron', 'sabhi', 'sare', 'dono', 'donon',
    'उनके', 'उनकी', 'इनके', 'इनकी', 'चारों', 'सभी', 'सारे', 'दोनों',
  ]) || includesAny(text, GROUP_ALL_WORDS);

  // With an active employee group, bare field asks ("sirf mobile number chahiye") are follow-ups.
  return (employeeCue || referential || Boolean(context.employeeQueryGroup) || context.topic === 'employees');
}

module.exports = {
  EMPLOYEE_FIELD_REGISTRY,
  PROFILE_FIELD_IDS,
  FIELD_NUMBER_PREFIXES,
  messageWantsEmployeeCount,
  parseRequestedEmployeeFields,
  parseEmployeeGroupQuantifier,
  buildEmployeeQueryGroup,
  authorizeFields,
  retrieveEmployeesForQuery,
  applyQuantifier,
  formatEmployeeFieldReply,
  isStickyEmployeeFieldFollowUp,
  fieldDisplayValue,
  canViewUnmasked,
  maskSensitive,
};
