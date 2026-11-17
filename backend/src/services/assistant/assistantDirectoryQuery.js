/**
 * Deterministic directory intents for org/location/employee counts and lists.
 * Used by both AI-first orchestration and legacy fallback so ordinary DB queries
 * still work when the model is unavailable.
 */

const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const {
  resolveOrganizations,
  resolveLocations,
  findLocationsByKeyword,
  normalizeName,
} = require('./assistantEntityResolver');

const INTENTS = {
  ACTIVE_EMPLOYEE_COUNT: 'active_employee_count',
  ACTIVE_ORGANIZATION_COUNT: 'active_organization_count',
  ORGANIZATION_LIST: 'organization_list',
  ORGANIZATION_DETAILS: 'organization_details',
  ORGANIZATION_EMPLOYEE_COUNT: 'organization_employee_count',
  ORGANIZATION_LOCATION_LIST: 'organization_location_list',
  LOCATION_EMPLOYEE_COUNT: 'location_employee_count',
  LOCATION_DETAILS: 'location_details',
  DEPARTMENT_EMPLOYEE_COUNT: 'department_employee_count',
  EMPLOYEE_DETAILS: 'employee_details',
  DOCUMENT_GENERATION: 'document_generation',
  ATTENDANCE_QUERY: 'attendance_query',
  PAYROLL_QUERY: 'payroll_query',
};

const COUNT_WORDS = [
  'how many', 'number of', 'count', 'total', 'kitne', 'kitni', 'kitna', 'kitne hain', 'kitni hain',
  'कितने', 'कितनी', 'कितना', 'कुल',
];
const LIST_WORDS = [
  'list', 'name', 'names', 'naam', 'kaun kaun', 'kon kon', 'which', 'batao', 'bata do', 'dikhao', 'details do', 'detail do',
  'नाम', 'लिस्ट', 'सूची', 'बताओ', 'दिखाओ', 'कौन कौन', 'कौन-कौन',
];
const DETAIL_WORDS = [
  'detail', 'details', 'info', 'information', 'profile', 'bare me', 'baare', 'sab kuch', 'full details',
  'डिटेल', 'डिटेल्स', 'जानकारी', 'विवरण', 'प्रोफाइल',
];
const ORG_WORDS = [
  'organization', 'organizations', 'organisation', 'organisations', 'org', 'orgs', 'client', 'company', 'companies',
  'ऑर्गेनाइजेशन', 'ऑर्गनाइजेशन', 'संगठन', 'क्लाइंट', 'कंपनी', 'कंपनियां',
];
const LOCATION_WORDS = ['location', 'locations', 'site', 'sites', 'लोकेशन', 'लोकेशंस', 'साइट'];
const EMPLOYEE_WORDS = [
  'employee', 'employees', 'employ', 'employs', 'emp', 'staff', 'worker', 'workers', 'employer', 'karmachari',
  'एम्प्लॉई', 'एम्पलाई', 'एंपलॉयर', 'कर्मचारी', 'स्टाफ',
];
const EMPLOYEE_NAME_ASK_WORDS = [
  'naam', 'name', 'names', 'list', 'dikhao', 'kaun kaun', 'kon kon', 'who are', 'unke naam', 'unki naam',
  'नाम', 'लिस्ट', 'सूची', 'कौन कौन', 'कौन-कौन', 'दिखाओ',
];
const ACTIVE_WORDS = ['active', 'activate', 'activated', 'activ', 'enabled', 'एक्टिव', 'ऐक्टिव', 'सक्रिय'];
const FILLER_CHAT_WORDS = [
  'bhai', 'bro', 'yaar', 'yar', 'please', 'pls', 'plz', 'bas', 'toh', 'to', 'ab', 'abhi', 'only',
  'भाई', 'यार', 'प्लीज', 'बस', 'तो', 'अब', 'अभी',
];
const DISABLED_WORDS = ['disabled', 'inactive', 'deactive', 'डीएक्टिव', 'इनएक्टिव', 'निष्क्रिय'];
const ATTENDANCE_WORDS = ['attendance', 'hajiri', 'haziri', 'present', 'absent', 'हाजिरी', 'अटेंडेंस'];
const PAYROLL_WORDS = ['payroll', 'salary', 'wage', 'पेरोल', 'सैलरी', 'वेतन', 'पगार'];
const DOCUMENT_WORDS = ['slip', 'register', 'pdf', 'excel', 'form xvi', 'form xvii', 'स्लिप', 'रजिस्टर'];
const HOUSEKEEPING_WORDS = ['housekeeping', 'house keeping', 'हाउसकीपिंग', 'हाउस कीपिंग'];
const SECURITY_WORDS = ['security', 'security wali', 'सिक्योरिटी', 'सिक्यूरिटी', 'सेक्योरिटी'];
const ALL_ORG_SCOPE_WORDS = [
  'all', 'every', 'sari', 'saari', 'saare', 'sare', 'sabhi', 'sab', 'sara', 'saara', 'poori', 'puri', 'pura', 'entire',
  'सभी', 'सारी', 'सारे', 'सब', 'पूरी', 'पूरा',
];
const NAME_LIST_WORDS = [
  'naam', 'name', 'names', 'list', 'dikhao', 'dikha', 'dikhao', 'batao', 'bata', 'show', 'display',
  'नाम', 'लिस्ट', 'सूची', 'दिखाओ', 'बताओ',
];

const ORDINAL_WORDS = {
  1: ['1', 'one', 'first', 'pehla', 'pehli', 'pahla', 'pahli', 'ek', '1st', 'number 1', 'no 1', 'no. 1', 'पहला', 'पहली', 'एक'],
  2: ['2', 'two', 'second', 'dusra', 'dusri', '2nd', 'number 2', 'दूसरा', 'दूसरी', 'दो'],
  3: ['3', 'three', 'third', 'tisra', 'tisri', '3rd', 'number 3', 'तीसरा', 'तीसरी', 'तीन'],
  4: ['4', 'four', 'fourth', 'chautha', '4th', 'number 4', 'चौथा', 'चार'],
  5: ['5', 'five', 'fifth', '5th', 'number 5', 'पाँचवाँ', 'पांच'],
};

function includesAny(text, list) {
  const lower = String(text || '').toLowerCase();
  return list.some((word) => (/^[a-z0-9 .'-]+$/i.test(word)
    ? new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(lower)
    : lower.includes(String(word).toLowerCase())));
}

function words(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9\u0900-\u097F]+/gi) || [];
}

function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text || '')) return 'hi';
  if (/\b(kya|hai|hain|kitne|kitna|kitni|batao|mein|mere|saari|sabhi)\b/i.test(text || '')) return 'hinglish';
  return 'en';
}

function say(lang, hi, en) {
  return lang === 'en' ? en : hi;
}

function parseSelectionIndex(message) {
  const text = String(message || '').toLowerCase().trim();
  if (!text) return null;

  // "ek number wali", "number 1 wali", "1 number"
  const numberWali = text.match(/\b(?:ek|one|1|pehli|pehla|first)\s*(?:number|no\.?|#)?\s*(?:wali|wala|wale)?\b/i)
    || text.match(/\b(?:number|no\.?|#)\s*(1|one|ek)\b/i);
  if (numberWali) return 1;

  for (const [index, words] of Object.entries(ORDINAL_WORDS)) {
    if (includesAny(text, words)) return Number(index);
  }

  const onlyNumber = text.match(/^#?\s*(\d{1,2})\s*[.)]?$/);
  if (onlyNumber) return Number(onlyNumber[1]);

  const numbered = text.match(/\b(?:number|no\.?|#|option)\s*(\d{1,2})\b/i);
  if (numbered) return Number(numbered[1]);

  return null;
}

/** "sari organisation ke naam batao" / "list all organizations" — never a single-org details request. */
function isAllOrganizationsListQuery(message) {
  const text = String(message || '');
  if (!includesAny(text, ORG_WORDS)) return false;
  if (includesAny(text, EMPLOYEE_WORDS) || includesAny(text, LOCATION_WORDS) || includesAny(text, ATTENDANCE_WORDS)) {
    return false;
  }
  if (includesAny(text, COUNT_WORDS)) return false;

  const asksNamesOrList = includesAny(text, NAME_LIST_WORDS)
    || includesAny(text, LIST_WORDS)
    || includesAny(text, DETAIL_WORDS)
    || /\b(show|list|display|dikhao|batao|नाम|लिस्ट|सूची)\b/i.test(text);
  if (!asksNamesOrList) return false;

  // Explicit all/sari/sabhi/every — always all-org list.
  if (includesAny(text, ALL_ORG_SCOPE_WORDS)) return true;

  // Plural org forms without a leftover proper name → all-org list.
  // Do NOT treat singular "organisation"/"organization" alone as all-scope;
  // that false-routes "Khatri ... Organisation ki information" to the full list.
  const pluralOrgs = /\borganisations\b|\borganizations\b|\borgs\b|\bcompanies\b/i.test(text)
    || /कंपनियां/.test(text);
  const leftover = textForOrgEntityMatch(text);
  if (pluralOrgs) return !leftover;

  // Singular "organisation ke naam/list" with no leftover entity name → all-org list.
  if (!leftover && includesAny(text, ['naam', 'names', 'नाम', 'list', 'लिस्ट', 'सूची', ...NAME_LIST_WORDS])) {
    return true;
  }
  return false;
}

/** Remove topic filler so "organisation" does not false-match an org entity. */
function textForOrgEntityMatch(message) {
  let text = String(message || '');
  const strip = [
    ...ORG_WORDS, ...ALL_ORG_SCOPE_WORDS, ...NAME_LIST_WORDS, ...LIST_WORDS, ...DETAIL_WORDS,
    ...COUNT_WORDS, ...ACTIVE_WORDS, ...DISABLED_WORDS, ...LOCATION_WORDS, ...EMPLOYEE_WORDS,
    'ke', 'ki', 'ka', 'mein', 'me', 'do', 'de', 'the', 'of', 'and', 'or', 'for', 'with',
    'admin', 'block', 'wali', 'wala', 'wale', 'sorry',
    'के', 'की', 'का', 'में', 'मे', 'दो', 'दे', 'और',
  ];
  for (const word of strip) {
    const pattern = /^[a-z0-9 .'-]+$/i.test(word)
      ? new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'ig')
      : null;
    if (pattern) text = text.replace(pattern, ' ');
    else text = text.split(word).join(' ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** "staff canteen" is a place name; do not treat bare "staff" there as an employee ask. */
function messageWantsEmployees(text) {
  if (!includesAny(text, EMPLOYEE_WORDS)) return false;
  const stripped = String(text || '').replace(/\bstaff\s+canteen\b/gi, ' ');
  if (!includesAny(stripped, EMPLOYEE_WORDS)) return false;
  return true;
}

function classifyDirectoryIntent(message, { hasOrgMention = false, hasLocationMention = false } = {}) {
  const text = String(message || '');
  if (includesAny(text, DOCUMENT_WORDS) && !includesAny(text, COUNT_WORDS)) return INTENTS.DOCUMENT_GENERATION;
  if (includesAny(text, ATTENDANCE_WORDS) && !includesAny(text, COUNT_WORDS)) return INTENTS.ATTENDANCE_QUERY;
  if (includesAny(text, PAYROLL_WORDS) && !includesAny(text, COUNT_WORDS) && !messageWantsEmployees(text)) {
    return INTENTS.PAYROLL_QUERY;
  }

  // Must win over any accidental org-entity match + "batao".
  if (isAllOrganizationsListQuery(text)) return INTENTS.ORGANIZATION_LIST;

  const wantsCount = includesAny(text, COUNT_WORDS);
  const wantsList = includesAny(text, LIST_WORDS) || includesAny(text, DETAIL_WORDS);
  const wantsOrg = includesAny(text, ORG_WORDS);
  const wantsLocation = includesAny(text, LOCATION_WORDS);
  const wantsEmployee = messageWantsEmployees(text);
  const wantsActive = includesAny(text, ACTIVE_WORDS);
  const wantsHousekeeping = includesAny(text, HOUSEKEEPING_WORDS);

  const wantsSecurity = includesAny(text, SECURITY_WORDS);
  if (wantsHousekeeping && (wantsLocation || wantsEmployee || wantsCount)) {
    return wantsEmployee || wantsCount ? INTENTS.DEPARTMENT_EMPLOYEE_COUNT : INTENTS.LOCATION_EMPLOYEE_COUNT;
  }
  if (wantsSecurity && (wantsLocation || wantsEmployee || wantsCount || wantsList)) {
    return wantsEmployee || wantsCount ? INTENTS.DEPARTMENT_EMPLOYEE_COUNT : INTENTS.LOCATION_DETAILS;
  }

  // "kitni locations" is a location count/list, never an employee count (even if "staff canteen" appears).
  if (wantsLocation && wantsCount && !wantsEmployee) {
    if (hasOrgMention) return INTENTS.ORGANIZATION_LOCATION_LIST;
    if (hasLocationMention) return INTENTS.ORGANIZATION_LOCATION_LIST;
  }

  if ((hasOrgMention || wantsOrg) && wantsEmployee && wantsCount) return INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
  if (hasLocationMention && wantsEmployee && wantsCount) return INTENTS.LOCATION_EMPLOYEE_COUNT;

  // Specific named organization details — only when not an all-org list query.
  // Must win over accidental location hits from words like "block" in "Khatri admin block".
  if (hasOrgMention && !wantsEmployee && !wantsCount && (includesAny(text, DETAIL_WORDS) || /\b(batao|बताओ|details?)\b/i.test(text))) {
    // "X organisation ke naam" with a real org name still means that org's details only if no all-scope words.
    if (!includesAny(text, ALL_ORG_SCOPE_WORDS) && !includesAny(text, ['names', 'naam', 'नाम', 'list', 'लिस्ट'])) {
      return INTENTS.ORGANIZATION_DETAILS;
    }
  }
  // "Bhopal staff canteen organisation ki details" — org of the named site.
  if (wantsOrg && hasLocationMention && !wantsCount && (includesAny(text, DETAIL_WORDS) || wantsList || /\b(batao|बताओ|details?)\b/i.test(text))) {
    return INTENTS.ORGANIZATION_DETAILS;
  }
  // Named place + "location ki details/designation" beats a weak city→org match listing all sites.
  if (hasLocationMention && wantsLocation
    && (wantsList || includesAny(text, DETAIL_WORDS) || includesAny(text, ['designation', 'destination', 'desination', 'address', 'status', 'पद', 'पता']))) {
    return INTENTS.LOCATION_DETAILS;
  }
  if (hasLocationMention && !hasOrgMention && !wantsOrg && !wantsEmployee && !wantsCount
    && (wantsList || includesAny(text, DETAIL_WORDS) || wantsLocation)) {
    return INTENTS.LOCATION_DETAILS;
  }
  // Org location list only when no specific site was named.
  if (hasOrgMention && wantsLocation && (wantsList || wantsCount) && !hasLocationMention) {
    return INTENTS.ORGANIZATION_LOCATION_LIST;
  }
  if (hasOrgMention && wantsCount && wantsEmployee) return INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
  // Named org + names/list without all-scope → still prefer list of all when query is generic org topic.
  if (hasOrgMention && wantsList && !wantsEmployee && includesAny(text, ALL_ORG_SCOPE_WORDS)) {
    return INTENTS.ORGANIZATION_LIST;
  }
  if (hasOrgMention && wantsList && !wantsEmployee && !includesAny(text, ['naam', 'names', 'नाम', 'list', 'लिस्ट', ...ALL_ORG_SCOPE_WORDS])) {
    return INTENTS.ORGANIZATION_DETAILS;
  }

  if (wantsOrg && wantsCount && wantsActive) return INTENTS.ACTIVE_ORGANIZATION_COUNT;
  if (wantsOrg && wantsCount) return INTENTS.ACTIVE_ORGANIZATION_COUNT;

  // Leftover proper-name tokens (e.g. "Khatri") + org info → details, even before entity resolve.
  const leftoverName = textForOrgEntityMatch(text);
  if (wantsOrg && leftoverName && !includesAny(text, ALL_ORG_SCOPE_WORDS) && !wantsEmployee && !wantsCount
    && (includesAny(text, DETAIL_WORDS) || wantsList)) {
    return INTENTS.ORGANIZATION_DETAILS;
  }

  // Named org + info/details → that org's details, never the full org list.
  if (hasOrgMention && wantsOrg && includesAny(text, DETAIL_WORDS) && !includesAny(text, ALL_ORG_SCOPE_WORDS)) {
    return INTENTS.ORGANIZATION_DETAILS;
  }
  // Never dump the full org list when the user still named something specific.
  if (wantsOrg && leftoverName && !includesAny(text, ALL_ORG_SCOPE_WORDS)) {
    return hasOrgMention ? INTENTS.ORGANIZATION_DETAILS : null;
  }
  if (wantsOrg && (wantsList || includesAny(text, ['naam', 'names', 'नाम']))) return INTENTS.ORGANIZATION_LIST;
  if (wantsOrg && includesAny(text, DETAIL_WORDS)) return INTENTS.ORGANIZATION_LIST;

  if (wantsEmployee && wantsCount && !hasOrgMention && !hasLocationMention) return INTENTS.ACTIVE_EMPLOYEE_COUNT;
  if (wantsLocation && wantsEmployee && wantsCount) return INTENTS.LOCATION_EMPLOYEE_COUNT;

  return null;
}

function isDirectoryCandidate(message) {
  const text = String(message || '');
  if (!text.trim()) return false;
  if (includesAny(text, DOCUMENT_WORDS) && includesAny(text, ['bana', 'generate', 'download', 'pdf', 'excel', 'बना'])) return false;
  return includesAny(text, COUNT_WORDS)
    || includesAny(text, LIST_WORDS)
    || includesAny(text, DETAIL_WORDS)
    || includesAny(text, ORG_WORDS)
    || includesAny(text, EMPLOYEE_WORDS)
    || includesAny(text, LOCATION_WORDS)
    || includesAny(text, HOUSEKEEPING_WORDS)
    || Boolean(parseSelectionIndex(text));
}

function wantsEmployeeNames(text) {
  return includesAny(text, EMPLOYEE_NAME_ASK_WORDS)
    || (includesAny(text, NAME_LIST_WORDS) && messageWantsEmployees(text));
}

const REFERRING_SCOPE_WORDS = [
  'unke', 'unki', 'unka', 'uske', 'uski', 'uska', 'usmein', 'usme', 'ismein', 'isme', 'inme', 'inmein',
  'wahi', 'vahi', 'dono', 'donon', 'both', 'inmein', 'unmein',
  'उनके', 'उनकी', 'उनका', 'उसके', 'उसकी', 'उसमें', 'इसमें', 'इनमें', 'दोनों', 'वही',
];

function isReferentialScopeFollowUp(text) {
  return includesAny(text, REFERRING_SCOPE_WORDS);
}

/** Leftover tokens after stripping topic words — e.g. "Ambala" in "Ambala employee ke naam". */
function leftoverSubjectTokens(message) {
  let text = String(message || '');
  const strip = [
    ...ORG_WORDS, ...ALL_ORG_SCOPE_WORDS, ...NAME_LIST_WORDS, ...LIST_WORDS, ...DETAIL_WORDS,
    ...COUNT_WORDS, ...ACTIVE_WORDS, ...DISABLED_WORDS, ...LOCATION_WORDS, ...EMPLOYEE_WORDS,
    ...HOUSEKEEPING_WORDS, ...SECURITY_WORDS, ...EMPLOYEE_NAME_ASK_WORDS, ...REFERRING_SCOPE_WORDS,
    'ke', 'ki', 'ka', 'mein', 'me', 'do', 'de', 'the', 'of', 'and', 'or', 'for', 'with', 'andar', 'inside',
    'wali', 'wala', 'wale', 'jitne', 'jitni', 'jitna', 'sari', 'log', 'employer', 'naya', 'new',
    'mujhe', 'mujh', 'mere', 'meri', 'hai', 'hain', 'ho', 'please', 'give', 'tell',
    ...FILLER_CHAT_WORDS,
    'के', 'की', 'का', 'में', 'मे', 'दो', 'दे', 'और', 'अंदर', 'वाले', 'वाली', 'जितने', 'लोग',
    'मुझे', 'मेरे', 'है', 'हैं',
  ];
  for (const word of strip) {
    const pattern = /^[a-z0-9 .'-]+$/i.test(word)
      ? new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'ig')
      : null;
    if (pattern) text = text.replace(pattern, ' ');
    else text = text.split(word).join(' ');
  }
  return words(text.replace(/\s+/g, ' ').trim());
}

async function listEmployeesForLocations(locationList, { limit = 40 } = {}) {
  const blocks = [];
  const allNames = [];
  for (const location of locationList) {
    const people = await Employee.find({
      organizationId: location.organizationId,
      locationId: location.id,
      status: { $ne: 'disabled' },
      ...(location.designation
        ? { designation: new RegExp(`^${String(location.designation).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        : {}),
    }).select('name').sort({ name: 1 }).limit(limit).lean();
    const names = people.map((item) => item.name);
    allNames.push(...names);
    const label = `${location.workName || location.name}${location.name && location.workName && location.name !== location.workName ? ` – ${location.name}` : ''}`;
    blocks.push({
      location,
      label,
      names,
      lines: names.length
        ? names.map((name, index) => `${index + 1}. ${name}`).join('\n')
        : null,
    });
  }
  return { blocks, allNames };
}

async function countEmployees({ organizationId = null, locationId = null, status = 'active', department = null, designation = null }) {
  const filter = {};
  if (organizationId) filter.organizationId = organizationId;
  else filter.organizationId = { $ne: null };
  if (locationId) filter.locationId = locationId;
  if (status === 'active') filter.status = { $ne: 'disabled' };
  else if (status === 'disabled') filter.status = 'disabled';
  if (department) filter.department = new RegExp(department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (designation) filter.designation = new RegExp(`^${designation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

  const [active, total] = await Promise.all([
    Employee.countDocuments({ ...filter, status: { $ne: 'disabled' } }),
    Employee.countDocuments({
      ...(organizationId ? { organizationId } : { organizationId: { $ne: null } }),
      ...(locationId ? { locationId } : {}),
      ...(department ? { department: filter.department } : {}),
      ...(designation ? { designation: filter.designation } : {}),
    }),
  ]);
  return { active, total, filter };
}

function selectionContext(type, options, extras = {}) {
  return {
    topic: 'pending_selection',
    pendingSelectionType: type,
    pendingSelection: {
      type,
      options: options.map((item, index) => ({
        index: index + 1,
        id: item.id,
        name: item.name,
        organizationId: item.organizationId || null,
        locationId: item.locationId || null,
      })),
    },
    lastIntent: extras.lastIntent || null,
    organizationId: extras.organizationId || null,
    organizationName: extras.organizationName || null,
    locationId: extras.locationId || null,
    locationName: extras.locationName || null,
    ...extras,
  };
}

function resolvePendingSelection(message, context) {
  const pending = context?.pendingSelection;
  if (!pending?.options?.length) return null;
  const index = parseSelectionIndex(message);
  if (!index) return null;
  const option = pending.options.find((item) => item.index === index);
  if (!option) return { error: true, index, options: pending.options };
  return { option, type: pending.type || context.pendingSelectionType };
}

async function answerDirectoryQuery({
  user,
  message,
  directory,
  context = null,
  lang: preferredLang = null,
}) {
  if (user.role !== 'admin' && user.role !== 'organization') return null;
  const original = String(message || '').trim();
  if (!original) return null;
  const lang = preferredLang || detectLanguage(original);

  // Follow-up number / "ek number wali" against previous list.
  const pending = resolvePendingSelection(original, context);
  if (pending?.error) {
    return {
      intent: context?.lastIntent || 'clarification',
      reply: say(
        lang,
        `कृपया 1 से ${pending.options.length} के बीच एक नंबर चुनें।`,
        `Please choose a number between 1 and ${pending.options.length}.`,
      ),
      source: 'data',
      context,
      data: { intent: 'clarification' },
    };
  }
  if (pending?.option) {
    return executeSelectionFollowUp({
      user,
      selection: pending,
      context,
      directory,
      lang,
      message: original,
    });
  }

  // Scope org users to themselves.
  const organizations = user.role === 'admin'
    ? directory.organizations
    : directory.organizations.filter((item) => item.id === String(user.id));
  const locations = user.role === 'admin'
    ? directory.locations
    : directory.locations.filter((item) => item.organizationId === String(user.id));

  const shortBare = words(original).length <= 5;
  if (!isDirectoryCandidate(original) && !shortBare) return null;

  const entityText = textForOrgEntityMatch(original);
  const orgResolve = (entityText || shortBare)
    ? resolveOrganizations(entityText || original, organizations)
    : { matches: [], ambiguous: false };
  const hasOrgMention = orgResolve.matches.length > 0 || orgResolve.ambiguous;

  // Person employee-detail asks (name + father/details) must not become org counts via sticky context.
  const looksLikePersonEmployeeQuery = messageWantsEmployees(original)
    && !includesAny(original, COUNT_WORDS)
    && !includesAny(original, ALL_ORG_SCOPE_WORDS)
    && !includesAny(original, ORG_WORDS)
    && (
      includesAny(original, DETAIL_WORDS)
      || includesAny(original, ['father', 'parent', 'guardian', 'pita', 'पिता', 'पापा', 's/o', 'd/o', 'so', 'do'])
      || (entityText && entityText.split(/\s+/).filter(Boolean).length >= 2 && !hasOrgMention)
    );
  if (looksLikePersonEmployeeQuery && !includesAny(original, LOCATION_WORDS)) {
    return null;
  }

  const orgScore = orgResolve.scores?.[0]?.score || 0;
  const strongOrg = orgResolve.matches.length === 1 && !orgResolve.ambiguous && orgScore >= 70;
  const namedOrgId = strongOrg ? orgResolve.matches[0].id : null;
  // Keep sticky org for designation follow-ups ("security wali location") when no new org was named.
  // Do not let a weak city token (e.g. "Bhopal" → BHEL Bhopal) narrow location search.
  const locOrgScope = namedOrgId || (!hasOrgMention ? context?.organizationId : null) || null;
  let locResolve = resolveLocations(original, locations, { organizationId: locOrgScope });
  // If scoped search missed a clearly named site, search all locations.
  if ((!locResolve.matches.length && !locResolve.ambiguous) && locOrgScope) {
    const globalLoc = resolveLocations(original, locations);
    if (globalLoc.matches.length || globalLoc.ambiguous) locResolve = globalLoc;
  }
  if ((!locResolve.matches.length && !locResolve.ambiguous)
    && (includesAny(original, SECURITY_WORDS) || includesAny(original, HOUSEKEEPING_WORDS))) {
    const keyword = includesAny(original, SECURITY_WORDS) ? 'security' : 'housekeeping';
    const keyed = findLocationsByKeyword(keyword, locations, { organizationId: locOrgScope });
    if (keyed.length === 1) locResolve = { matches: keyed, ambiguous: false };
    else if (keyed.length > 1) locResolve = { matches: keyed, ambiguous: true };
  }
  // Sticky location for short follow-ups ("uski destination", "location ki designation").
  if ((!locResolve.matches.length && !locResolve.ambiguous) && context?.locationId) {
    const sticky = locations.find((item) => item.id === context.locationId);
    const locationFollowUp = includesAny(original, LOCATION_WORDS)
      || includesAny(original, ['uski', 'uska', 'uske', 'unki', 'unka', 'wahi', 'vahi', 'उसकी', 'उसका', 'उसके', 'वही'])
      || words(original).length <= 6;
    if (sticky && locationFollowUp
      && (includesAny(original, DETAIL_WORDS)
        || includesAny(original, ['designation', 'destination', 'desination', 'destignation', 'address', 'adress', 'status', 'पद', 'पता', 'एड्रेस']))) {
      locResolve = { matches: [sticky], ambiguous: false };
    }
  }
  const hasLocationMention = locResolve.matches.length > 0 || locResolve.ambiguous;
  // Weak org city match should not override a concrete location hit.
  const effectiveHasOrgMention = hasOrgMention && (strongOrg || !hasLocationMention);

  const leftoverSubject = leftoverSubjectTokens(original);
  const affirmativeContinue = /^(haan|han|haa|ha|yes|ok|okay|ji|sahi|ठीक|हाँ|हां|जी|सही)\b/i.test(String(original || '').trim())
    && words(original).length <= 5
    && includesAny(original, ['isi', 'isme', 'ismein', 'usme', 'usmein', 'yahi', 'wahi', 'ussi', 'same', 'इस', 'उसी', 'वही']);
  if (affirmativeContinue && context?.organizationId) {
    const places = (context.locationIds?.length
      ? locations.filter((item) => context.locationIds.includes(item.id))
      : locations.filter((item) => item.organizationId === context.organizationId && item.status !== 'disabled'));
    if (places.length) {
      const { blocks, allNames } = await listEmployeesForLocations(places);
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      return {
        intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `${context.organizationName || 'Organization'} के employees (${allNames.length}):\n${body}`,
          `${context.organizationName || 'Organization'} employees (${allNames.length}):\n${body}`,
        ),
        source: 'data',
        context: {
          ...context,
          lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
          locationIds: places.map((item) => item.id),
          topic: 'employees',
          items: allNames,
        },
        data: { intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, names: allNames },
      };
    }
  }

  const globalEmployeeAsk = messageWantsEmployees(original)
    && includesAny(original, ALL_ORG_SCOPE_WORDS)
    && !effectiveHasOrgMention
    && !hasLocationMention
    && leftoverSubject.length === 0;

  // "sabhi/sare employees" across dashboard — never reuse a sticky location list.
  if (globalEmployeeAsk) {
    const counts = await countEmployees({
      organizationId: user.role === 'admin' ? null : String(user.id),
    });
    if (wantsEmployeeNames(original) || includesAny(original, DETAIL_WORDS)) {
      return {
        intent: INTENTS.ACTIVE_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `सभी organizations में active employees: ${counts.active} (कुल ${counts.total}). पूरी list बहुत लंबी है — कोई organization या location का नाम बताइए, मैं उसी के employees दूँगी।`,
          `Active employees across all organizations: ${counts.active} (total ${counts.total}). The full list is too long — name an organization or location and I will list those employees.`,
        ),
        source: 'data',
        context: {
          lastIntent: INTENTS.ACTIVE_EMPLOYEE_COUNT,
          topic: 'employees',
          organizationId: null,
          locationId: null,
          locationIds: null,
          items: [],
        },
        data: { intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, active: counts.active, total: counts.total },
      };
    }
    return {
      intent: INTENTS.ACTIVE_EMPLOYEE_COUNT,
      reply: say(
        lang,
        `सभी organizations में active employees: ${counts.active} (कुल ${counts.total}).`,
        `Active employees across all organizations: ${counts.active} (total ${counts.total}).`,
      ),
      source: 'data',
      context: { lastIntent: INTENTS.ACTIVE_EMPLOYEE_COUNT, topic: 'employees', items: [] },
      data: { intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, active: counts.active, total: counts.total },
    };
  }

  // "ismein / bhai kitne active employee" — sticky location/org count after a document or prior answer.
  const stickyEmployeeCountAsk = includesAny(original, COUNT_WORDS) && messageWantsEmployees(original)
    && !hasLocationMention && leftoverSubject.length === 0
    && !includesAny(original, ALL_ORG_SCOPE_WORDS)
    && (context?.locationId || context?.locationIds?.length || context?.organizationId)
    && (
      isReferentialScopeFollowUp(original)
      || context?.topic === 'document'
      || context?.topic === 'employees'
      || context?.topic === 'location'
      || context?.documentType
      || (words(original).length <= 8 && !effectiveHasOrgMention)
    );
  if (stickyEmployeeCountAsk) {
    if (context.locationId || (context.locationIds?.length === 1)) {
      const id = context.locationId || context.locationIds[0];
      const place = locations.find((item) => item.id === id);
      if (place) {
        const counts = await countEmployees({
          organizationId: place.organizationId,
          locationId: place.id,
          designation: place.designation || null,
        });
        const label = `${place.workName || place.name}${place.name && place.workName && place.name !== place.workName ? ` – ${place.name}` : ''}`;
        return {
          intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          reply: say(
            lang,
            `${label} में active employees: ${counts.active} (कुल ${counts.total}).`,
            `${label}: active employees = ${counts.active} (total ${counts.total}).`,
          ),
          source: 'data',
          context: {
            ...context,
            lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
            organizationId: place.organizationId,
            locationId: place.id,
            locationIds: context.locationIds?.length ? context.locationIds : [place.id],
            topic: 'employees',
          },
          data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, active: counts.active, total: counts.total, locationId: place.id },
        };
      }
    }
    if (context.organizationId) {
      const counts = await countEmployees({ organizationId: context.organizationId });
      const orgName = context.organizationName
        || organizations.find((item) => item.id === context.organizationId)?.name
        || 'Organization';
      return {
        intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `${orgName} में active employees: ${counts.active} (कुल ${counts.total}).`,
          `${orgName}: active employees = ${counts.active} (total ${counts.total}).`,
        ),
        source: 'data',
        context: { ...context, lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, topic: 'employees' },
        data: { intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, active: counts.active, total: counts.total },
      };
    }
  }

  // "donon locations ke employee ke naam" — all sticky org locations, not only the last one.
  // Skip when a department keyword is present — housekeeping/security handlers own those asks.
  if ((includesAny(original, ['dono', 'donon', 'both', 'दोनों']) || includesAny(original, ALL_ORG_SCOPE_WORDS))
    && includesAny(original, LOCATION_WORDS)
    && (messageWantsEmployees(original) || wantsEmployeeNames(original))
    && !includesAny(original, HOUSEKEEPING_WORDS)
    && !includesAny(original, SECURITY_WORDS)
    && context?.organizationId
    && !strongOrg) {
    const places = locations.filter((item) => item.organizationId === context.organizationId && item.status !== 'disabled');
    if (places.length) {
      const askNames = wantsEmployeeNames(original) || includesAny(original, DETAIL_WORDS) || !includesAny(original, COUNT_WORDS);
      if (askNames) {
        const { blocks, allNames } = await listEmployeesForLocations(places);
        const body = blocks.map((block) => (
          block.names.length
            ? `${block.label}:\n${block.lines}`
            : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
        )).join('\n\n');
        return {
          intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
          reply: say(
            lang,
            `${context.organizationName || 'Organization'} की ${places.length} locations के employees (${allNames.length}):\n${body}`,
            `${context.organizationName || 'Organization'} employees across ${places.length} locations (${allNames.length}):\n${body}`,
          ),
          source: 'data',
          context: {
            lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
            organizationId: context.organizationId,
            organizationName: context.organizationName || null,
            locationIds: places.map((item) => item.id),
            locationId: null,
            topic: 'employees',
            title: 'Employees',
            items: allNames,
          },
          data: { intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, names: allNames, locationIds: places.map((item) => item.id) },
        };
      }
    }
  }

  // "unke naam batao" / bare "name" / "naam" after employee count for sticky location(s).
  // Bare "name" is allowed only when very short and no new place/org leftover (never "Ambala employees").
  const bareNameFollowUp = wantsEmployeeNames(original)
    && words(original).length <= 3
    && leftoverSubject.length === 0
    && !messageWantsEmployees(original);
  if (wantsEmployeeNames(original)
    && (isReferentialScopeFollowUp(original) || bareNameFollowUp)
    && !includesAny(original, LOCATION_WORDS) && !includesAny(original, ORG_WORDS)
    && !includesAny(original, HOUSEKEEPING_WORDS) && !includesAny(original, SECURITY_WORDS)
    && !includesAny(original, ALL_ORG_SCOPE_WORDS)
    && leftoverSubject.length === 0
    && words(original).length <= 8
    && (context?.locationIds?.length || context?.locationId)
    && (context?.lastIntent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT
      || context?.lastIntent === INTENTS.LOCATION_EMPLOYEE_COUNT
      || context?.lastIntent === INTENTS.ORGANIZATION_LOCATION_LIST
      || context?.topic === 'employees'
      || context?.topic === 'location')) {
    const ids = context.locationIds?.length ? context.locationIds : [context.locationId];
    const places = locations.filter((item) => ids.includes(item.id));
    if (places.length) {
      if (context.items?.length && context.topic === 'employees'
        && context.items.every((item) => typeof item === 'string')
        && !context.items.some((item) => /housekeeping|security|horticulture|location|–/i.test(item))) {
        const prior = context.items.filter(Boolean);
        return {
          intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          reply: say(
            lang,
            `Employees (${prior.length}):\n${prior.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
            `Employees (${prior.length}):\n${prior.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
          ),
          source: 'data',
          context: { ...context, items: prior, topic: 'employees' },
          data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: prior },
        };
      }
      const { blocks, allNames } = await listEmployeesForLocations(places);
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      return {
        intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `Employees (${allNames.length}):\n${body}`,
          `Employees (${allNames.length}):\n${body}`,
        ),
        source: 'data',
        context: {
          ...context,
          lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          locationIds: places.map((item) => item.id),
          topic: 'employees',
          title: 'Employees',
          items: allNames,
        },
        data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: allNames },
      };
    }
  }

  // "locations ke naam batao" after an org/location answer — reuse sticky scope, not the whole dashboard.
  const stickyLocationListAsk = !hasLocationMention && !effectiveHasOrgMention
    && includesAny(original, LOCATION_WORDS)
    && (includesAny(original, LIST_WORDS) || includesAny(original, ['naam', 'names', 'नाम', 'batao', 'बताओ']))
    && !messageWantsEmployees(original)
    && words(original).length <= 8
    && (context?.organizationId || context?.locationIds?.length || context?.locationId);
  if (stickyLocationListAsk) {
    const orgId = context.organizationId || null;
    // "donon locations" / org scope → all org locations; otherwise keep sticky ids.
    const useAllOrgLocations = includesAny(original, ['dono', 'donon', 'both', 'दोनों']) || includesAny(original, ALL_ORG_SCOPE_WORDS);
    const stickyIds = (!useAllOrgLocations && context.locationIds?.length)
      ? context.locationIds
      : ((!useAllOrgLocations && context.locationId) ? [context.locationId] : null);
    const list = (useAllOrgLocations || !stickyIds) && orgId
      ? locations.filter((item) => item.organizationId === orgId && item.status !== 'disabled')
      : stickyIds
        ? locations.filter((item) => stickyIds.includes(item.id) && item.status !== 'disabled')
        : locations.filter((item) => item.organizationId === orgId && item.status !== 'disabled');
    const orgName = context.organizationName
      || organizations.find((item) => item.id === orgId)?.name
      || '';
    const labeled = list.map((item, index) => {
      const site = item.name && item.workName && item.name !== item.workName ? ` – ${item.name}` : '';
      const label = user.role === 'admin'
        ? `${item.workName || item.name}${site} (${item.organizationName})`
        : `${item.workName || item.name}${site}`;
      return `${index + 1}. ${label}`;
    }).join('\n');
    return {
      intent: INTENTS.ORGANIZATION_LOCATION_LIST,
      reply: say(
        lang,
        `${orgName ? `${orgName} की ` : ''}${list.length} locations:\n${labeled}`,
        `${orgName ? `${orgName} has ` : ''}${list.length} locations:\n${labeled}`,
      ),
      source: 'data',
      context: {
        lastIntent: INTENTS.ORGANIZATION_LOCATION_LIST,
        organizationId: orgId,
        organizationName: orgName || null,
        locationIds: list.map((item) => item.id),
        topic: 'locations',
        title: `${orgName || 'These'} locations`,
        items: list.map((item) => {
          const site = item.name && item.workName && item.name !== item.workName ? ` – ${item.name}` : '';
          return `${item.workName || item.name}${site}`;
        }),
      },
      data: { intent: INTENTS.ORGANIZATION_LOCATION_LIST, organizationId: orgId, locationIds: list.map((item) => item.id) },
    };
  }

  let intent = classifyDirectoryIntent(original, {
    hasOrgMention: effectiveHasOrgMention,
    hasLocationMention,
  });

  // Named org + "batao/details" without employee words → organization details.
  // Never override an all-organizations list/names request.
  if (!intent && hasLocationMention && includesAny(original, ORG_WORDS)
    && (includesAny(original, DETAIL_WORDS) || includesAny(original, LIST_WORDS))) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  if (!intent && hasLocationMention
    && (includesAny(original, DETAIL_WORDS) || includesAny(original, LIST_WORDS) || includesAny(original, LOCATION_WORDS)
      || includesAny(original, ['designation', 'destination', 'desination', 'address', 'status', 'पद', 'पता']))) {
    intent = INTENTS.LOCATION_DETAILS;
  }
  if (!intent && effectiveHasOrgMention && !isAllOrganizationsListQuery(original)
    && !includesAny(original, EMPLOYEE_WORDS) && !includesAny(original, ATTENDANCE_WORDS)) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  if (!intent && effectiveHasOrgMention && shortBare && !includesAny(original, EMPLOYEE_WORDS) && !includesAny(original, ATTENDANCE_WORDS)) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  if (!intent && effectiveHasOrgMention && includesAny(original, EMPLOYEE_WORDS) && includesAny(original, COUNT_WORDS)) {
    intent = INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
  }
  if (!intent) return null;

  // Never treat ordinary org queries as documents.
  if (intent === INTENTS.DOCUMENT_GENERATION || intent === INTENTS.ATTENDANCE_QUERY || intent === INTENTS.PAYROLL_QUERY) {
    return null;
  }

  // All-org list/count intents must not stop on ambiguous single-name matching.
  // Location answers already have their site — do not ask which org.
  if (orgResolve.ambiguous
    && intent !== INTENTS.ORGANIZATION_LIST
    && intent !== INTENTS.ACTIVE_ORGANIZATION_COUNT
    && intent !== INTENTS.LOCATION_DETAILS
    && intent !== INTENTS.LOCATION_EMPLOYEE_COUNT) {
    const options = orgResolve.matches.slice(0, 12).map((item) => ({
      id: item.id,
      name: item.name,
      organizationId: item.id,
    }));
    const lines = options.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
    return {
      intent,
      reply: say(
        lang,
        `एक से अधिक organization मिल सकती हैं। कौन-सी चाहिए?\n${lines}`,
        `Multiple organizations matched. Which one did you mean?\n${lines}`,
      ),
      source: 'data',
      context: selectionContext('organization', options, { lastIntent: intent }),
      data: { intent, ambiguous: true, options },
      choices: options.map((item) => ({
        label: item.name,
        plan: {
          type: 'directory_select',
          selectionType: 'organization',
          selectedId: item.id,
          resumeIntent: intent,
        },
      })),
    };
  }

  // Prefer a strongly named org; otherwise use the org of a uniquely resolved location
  // ("Bhopal staff canteen organisation" / "… mein kitni locations").
  let organization = (strongOrg ? orgResolve.matches[0] : null)
    || (context?.organizationId ? organizations.find((item) => item.id === context.organizationId) : null)
    || null;
  if (!organization && locResolve.matches.length === 1 && !locResolve.ambiguous) {
    organization = organizations.find((item) => item.id === locResolve.matches[0].organizationId) || null;
  }
  if (!organization && orgResolve.matches.length === 1 && !orgResolve.ambiguous) {
    organization = orgResolve.matches[0];
  }

  if (intent === INTENTS.ACTIVE_ORGANIZATION_COUNT) {
    const active = organizations.filter((item) => (item.status || 'active') !== 'disabled');
    const total = organizations.length;
    return {
      intent,
      reply: say(
        lang,
        `Active organizations: ${active.length} (कुल ${total}).`,
        `Active organizations: ${active.length} (total ${total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: intent,
        topic: 'organizations',
        items: active.map((item) => item.name),
      },
      data: { intent, active: active.length, total },
    };
  }

  if (intent === INTENTS.ORGANIZATION_LIST) {
    const active = organizations.filter((item) => (item.status || 'active') !== 'disabled');
    if (active.length === 0) {
      return {
        intent,
        reply: say(lang, 'कोई active organization नहीं मिली।', 'No active organizations found.'),
        source: 'data',
        tool: 'organization.list',
        data: { intent, total: 0, names: [] },
      };
    }
    const lines = active.map((item, index) => {
      const status = item.status && item.status !== 'active' ? ` (${item.status})` : '';
      return `${index + 1}. ${item.name}${status}`;
    }).join('\n');
    return {
      intent,
      reply: say(
        lang,
        `सभी organizations (${active.length}):\n${lines}`,
        `All organizations (${active.length}):\n${lines}`,
      ),
      source: 'data',
      tool: 'organization.list',
      context: selectionContext('organization', active.map((item) => ({
        id: item.id,
        name: item.name,
        organizationId: item.id,
      })), { lastIntent: INTENTS.ORGANIZATION_DETAILS }),
      data: {
        intent,
        tool: 'organization.list',
        total: active.length,
        names: active.map((item) => item.name),
        organizationIds: active.map((item) => item.id),
      },
    };
  }

  if (intent === INTENTS.ORGANIZATION_DETAILS) {
    if (!organization) {
      return {
        intent,
        reply: say(lang, 'किस organization की details चाहिए? नाम बताइए।', 'Which organization details do you need? Please name it.'),
        source: 'data',
        data: { intent, needsOrganization: true },
      };
    }
    const orgLocations = locations.filter((item) => item.organizationId === organization.id);
    const activeLocations = orgLocations.filter((item) => item.status !== 'disabled');
    const counts = await countEmployees({ organizationId: organization.id });
    const locLines = activeLocations.slice(0, 20).map((item, index) => `${index + 1}. ${item.workName || item.name}`).join('\n');
    return {
      intent,
      reply: [
        `${organization.name}`,
        say(lang, `Status: ${organization.status || 'active'}`, `Status: ${organization.status || 'active'}`),
        say(lang, `Active employees: ${counts.active} (कुल ${counts.total})`, `Active employees: ${counts.active} (total ${counts.total})`),
        say(lang, `Active locations: ${activeLocations.length}`, `Active locations: ${activeLocations.length}`),
        locLines ? `${say(lang, 'Locations:', 'Locations:')}\n${locLines}` : '',
      ].filter(Boolean).join('\n'),
      source: 'data',
      context: {
        lastIntent: intent,
        organizationId: organization.id,
        organizationName: organization.name,
        topic: 'organization',
        locationIds: activeLocations.map((item) => item.id),
        title: `${organization.name} locations`,
        items: activeLocations.map((item) => item.workName || item.name),
      },
      data: {
        intent,
        organizationId: organization.id,
        organizationName: organization.name,
        activeEmployees: counts.active,
        totalEmployees: counts.total,
        activeLocations: activeLocations.length,
        locationIds: activeLocations.map((item) => item.id),
      },
    };
  }

  if (intent === INTENTS.ORGANIZATION_EMPLOYEE_COUNT) {
    if (!organization) {
      return {
        intent,
        reply: say(
          lang,
          'किस organization के employees गिनने हैं? Organization का नाम बताइए।',
          'Which organization\'s employees should I count? Please name the organization.',
        ),
        source: 'data',
        data: { intent, needsOrganization: true },
      };
    }
    const wantsDisabled = includesAny(original, DISABLED_WORDS);
    const counts = await countEmployees({
      organizationId: organization.id,
      status: wantsDisabled ? 'disabled' : 'active',
    });
    return {
      intent,
      reply: say(
        lang,
        `${organization.name} में ${wantsDisabled ? 'disabled' : 'active'} employees: ${wantsDisabled ? counts.total - counts.active : counts.active} (कुल employees: ${counts.total}).`,
        `${organization.name}: ${wantsDisabled ? 'disabled' : 'active'} employees = ${wantsDisabled ? counts.total - counts.active : counts.active} (total employees = ${counts.total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: intent,
        organizationId: organization.id,
        organizationName: organization.name,
      },
      data: {
        intent,
        organizationId: organization.id,
        organizationName: organization.name,
        active: counts.active,
        total: counts.total,
      },
    };
  }

  if (intent === INTENTS.ACTIVE_EMPLOYEE_COUNT) {
    const scopeOrgId = user.role === 'admin' ? null : String(user.id);
    const counts = await countEmployees({ organizationId: scopeOrgId });
    const scope = user.role === 'admin'
      ? say(lang, 'आपके dashboard में', 'Across your dashboard')
      : say(lang, 'आपकी organization में', 'In your organization');
    return {
      intent,
      reply: `${scope} active employees: ${counts.active} (कुल ${counts.total}).`,
      source: 'data',
      context: { lastIntent: intent, organizationId: scopeOrgId },
      data: { intent, active: counts.active, total: counts.total, organizationId: scopeOrgId },
    };
  }

  if (intent === INTENTS.ORGANIZATION_LOCATION_LIST) {
    // Named site + "kitni locations" → that place is one location (plus siblings in same org when useful).
    if (!organization && locResolve.matches.length === 1 && !locResolve.ambiguous) {
      organization = organizations.find((item) => item.id === locResolve.matches[0].organizationId) || null;
    }
    if (!organization) {
      return {
        intent,
        reply: say(lang, 'किस organization की locations चाहिए?', 'Which organization\'s locations do you need?'),
        source: 'data',
        data: { intent, needsOrganization: true },
      };
    }
    const list = locations.filter((item) => item.organizationId === organization.id && item.status !== 'disabled');
    if (list.length === 0) {
      return {
        intent,
        reply: say(lang, `${organization.name} में कोई active location नहीं है।`, `${organization.name} has no active locations.`),
        source: 'data',
        data: { intent, organizationId: organization.id, total: 0 },
      };
    }
    const options = list.map((item) => ({
      id: item.id,
      name: item.workName || item.name,
      organizationId: item.organizationId,
      locationId: item.id,
    }));
    const lines = list.map((item, index) => {
      const site = item.name && item.workName && item.name !== item.workName ? ` – ${item.name}` : '';
      return `${index + 1}. ${item.workName || item.name}${site}`;
    }).join('\n');
    const namedSite = locResolve.matches.length === 1 && !locResolve.ambiguous ? locResolve.matches[0] : null;
    const preface = namedSite
      ? say(
        lang,
        `"${namedSite.workName || namedSite.name}${namedSite.name && namedSite.workName && namedSite.name !== namedSite.workName ? ` – ${namedSite.name}` : ''}" ${organization.name} की location है। ${organization.name} में कुल ${list.length} active locations:\n${lines}`,
        `"${namedSite.workName || namedSite.name}${namedSite.name && namedSite.workName && namedSite.name !== namedSite.workName ? ` – ${namedSite.name}` : ''}" is a location under ${organization.name}. ${organization.name} has ${list.length} active locations:\n${lines}`,
      )
      : say(
        lang,
        `${organization.name} की ${options.length} locations:\n${lines}`,
        `${organization.name} has ${options.length} locations:\n${lines}`,
      );
    return {
      intent,
      reply: preface,
      source: 'data',
      context: {
        ...selectionContext('location', options, {
          lastIntent: INTENTS.ORGANIZATION_LOCATION_LIST,
          organizationId: organization.id,
          organizationName: organization.name,
        }),
        locationIds: options.map((item) => item.id),
        locationId: namedSite?.id || null,
        title: `${organization.name} locations`,
        items: list.map((item) => `${item.workName || item.name}${item.name && item.workName && item.name !== item.workName ? ` – ${item.name}` : ''}`),
        topic: 'locations',
      },
      data: { intent, organizationId: organization.id, locationIds: options.map((item) => item.id), total: list.length },
    };
  }

  if (intent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT
    || (includesAny(original, HOUSEKEEPING_WORDS) && (messageWantsEmployees(original) || wantsEmployeeNames(original)))
    || (includesAny(original, SECURITY_WORDS) && (messageWantsEmployees(original) || wantsEmployeeNames(original)))) {
    const orgId = organization?.id || context?.organizationId || null;
    const deptKeyword = includesAny(original, SECURITY_WORDS) ? 'security' : 'housekeeping';
    const deptLabel = deptKeyword === 'security' ? 'Security' : 'Housekeeping';
    const askNames = wantsEmployeeNames(original) || (includesAny(original, DETAIL_WORDS) && messageWantsEmployees(original));
    const askCountOnly = includesAny(original, COUNT_WORDS) && !wantsEmployeeNames(original);
    let matched = findLocationsByKeyword(deptKeyword, locations, { organizationId: orgId });
    // Prefer a specifically named site ("Kochi Admin Block") over every housekeeping location.
    if (locResolve.matches.length === 1 && !locResolve.ambiguous) {
      const named = locResolve.matches[0];
      const blob = normalizeName([named.workName, named.name, named.designation].filter(Boolean).join(' '));
      if (blob.includes(deptKeyword) || !orgId || named.organizationId === orgId) {
        matched = [named];
      }
    }
    // Sticky prior housekeeping/security locationIds when the user says "ismein / donon / unke naam".
    if (matched.length === 0 && context?.locationIds?.length) {
      matched = locations.filter((item) => context.locationIds.includes(item.id)
        && normalizeName([item.workName, item.name, item.designation].filter(Boolean).join(' ')).includes(deptKeyword));
    }
    if (matched.length === 0) {
      // Fall back to employee.department field across scope.
      const counts = await countEmployees({ organizationId: orgId, department: deptKeyword });
      if (counts.active === 0 && counts.total === 0) {
        return {
          intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
          reply: say(
            lang,
            `${deptLabel} से जुड़ी कोई location/employee नहीं मिली।`,
            `No ${deptLabel.toLowerCase()} locations/employees were found.`,
          ),
          source: 'data',
          data: { intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT, active: 0, total: 0, organizationId: orgId },
        };
      }
      return {
        intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `${deptLabel} department में active employees: ${counts.active} (कुल ${counts.total}).`,
          `${deptLabel} department active employees: ${counts.active} (total ${counts.total}).`,
        ),
        source: 'data',
        context: { lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT, organizationId: orgId },
        data: { intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT, active: counts.active, total: counts.total, organizationId: orgId },
      };
    }
    if (matched.length > 1 && !includesAny(original, ['sabhi', 'all', 'सभी', 'saari', 'saare', 'dono', 'donon', 'both', 'दोनों'])
      && !(askNames && orgId)) {
      const options = matched.map((item) => ({
        id: item.id,
        name: `${item.workName || item.name}${user.role === 'admin' ? ` (${item.organizationName})` : ''}`,
        organizationId: item.organizationId,
        locationId: item.id,
      }));
      const lines = options.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
      return {
        intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        reply: say(
          lang,
          askNames
            ? `${deptLabel} से जुड़ी ${options.length} locations मिलीं। किसके employees के नाम चाहिए?\n${lines}`
            : `${deptLabel} से जुड़ी ${options.length} locations मिलीं। किसकी employee count चाहिए?\n${lines}`,
          askNames
            ? `Found ${options.length} ${deptLabel.toLowerCase()} locations. Whose employee names do you need?\n${lines}`
            : `Found ${options.length} ${deptLabel.toLowerCase()} locations. Which one should I count?\n${lines}`,
        ),
        source: 'data',
        context: selectionContext('location', options, {
          lastIntent: askNames ? INTENTS.LOCATION_DETAILS : INTENTS.LOCATION_EMPLOYEE_COUNT,
          organizationId: orgId,
        }),
        data: { intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT, ambiguous: true, options },
        choices: options.map((item) => ({
          label: item.name,
          plan: {
            type: 'directory_select',
            selectionType: 'location',
            selectedId: item.id,
            resumeIntent: askNames ? INTENTS.LOCATION_DETAILS : INTENTS.LOCATION_EMPLOYEE_COUNT,
          },
        })),
      };
    }
    if (askNames && !askCountOnly) {
      const uniqueMatched = [];
      const seenLoc = new Set();
      for (const item of matched) {
        if (seenLoc.has(item.id)) continue;
        seenLoc.add(item.id);
        uniqueMatched.push(item);
      }
      matched = uniqueMatched;
      const { blocks, allNames } = await listEmployeesForLocations(matched);
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      const siblingIds = (orgId || matched[0]?.organizationId)
        ? locations.filter((item) => item.organizationId === (orgId || matched[0].organizationId) && item.status !== 'disabled').map((item) => item.id)
        : matched.map((item) => item.id);
      return {
        intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `${deptLabel} location(s) के employees (${allNames.length}):\n${body}`,
          `${deptLabel} location employee names (${allNames.length}):\n${body}`,
        ),
        source: 'data',
        context: {
          lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
          organizationId: orgId || matched[0]?.organizationId || null,
          organizationName: matched[0]?.organizationName || context?.organizationName || null,
          locationIds: siblingIds,
          locationId: matched.length === 1 ? matched[0].id : null,
          topic: 'employees',
          title: `${deptLabel} employees`,
          items: allNames,
        },
        data: {
          intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
          names: allNames,
          locationIds: matched.map((item) => item.id),
        },
      };
    }
    const totals = { active: 0, total: 0 };
    for (const location of matched) {
      const counts = await countEmployees({
        organizationId: location.organizationId,
        locationId: location.id,
        designation: location.designation || null,
      });
      totals.active += counts.active;
      totals.total += counts.total;
    }
    return {
      intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
      reply: say(
        lang,
        `${deptLabel} location(s) में active employees: ${totals.active} (कुल ${totals.total}).`,
        `${deptLabel} location(s): active employees = ${totals.active} (total ${totals.total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        organizationId: orgId || matched[0]?.organizationId || null,
        organizationName: matched[0]?.organizationName || context?.organizationName || null,
        locationIds: matched.map((item) => item.id),
        locationId: matched.length === 1 ? matched[0].id : null,
        topic: 'employees',
        title: `${deptLabel} employees`,
        items: [],
      },
      data: {
        intent: INTENTS.DEPARTMENT_EMPLOYEE_COUNT,
        active: totals.active,
        total: totals.total,
        locationIds: matched.map((item) => item.id),
      },
    };
  }

  if (intent === INTENTS.LOCATION_DETAILS || intent === INTENTS.LOCATION_EMPLOYEE_COUNT) {
    if (locResolve.ambiguous) {
      const options = locResolve.matches.slice(0, 12).map((item) => ({
        id: item.id,
        name: `${item.workName || item.name}${user.role === 'admin' ? ` (${item.organizationName})` : ''}`,
        organizationId: item.organizationId,
        locationId: item.id,
      }));
      const lines = options.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
      return {
        intent,
        reply: say(lang, `कौन-सी location?\n${lines}`, `Which location?\n${lines}`),
        source: 'data',
        context: selectionContext('location', options, {
          lastIntent: intent,
          organizationId: organization?.id || locOrgScope || null,
        }),
        data: { intent, ambiguous: true, options },
      };
    }
    const location = locResolve.matches[0];
    if (!location) {
      return {
        intent,
        reply: say(
          lang,
          intent === INTENTS.LOCATION_DETAILS ? 'किस location की details चाहिए?' : 'किस location की employee count चाहिए?',
          intent === INTENTS.LOCATION_DETAILS ? 'Which location details do you need?' : 'Which location\'s employee count do you need?',
        ),
        source: 'data',
        data: { intent, needsLocation: true },
      };
    }
    if (intent === INTENTS.LOCATION_DETAILS) {
      const fieldOnly = includesAny(original, ['designation', 'destination', 'desination', 'destignation', 'पद', 'पदनाम'])
        && !includesAny(original, DETAIL_WORDS)
        && !includesAny(original, COUNT_WORDS);
      const addressOnly = includesAny(original, ['address', 'adress', 'pata', 'पता', 'एड्रेस'])
        && !includesAny(original, DETAIL_WORDS)
        && !includesAny(original, COUNT_WORDS);
      const poOnly = includesAny(original, ['po number', 'po no', 'op number', 'op no', 'पीओ', 'पी ओ', 'po', 'op'])
        && !includesAny(original, DETAIL_WORDS)
        && !includesAny(original, COUNT_WORDS)
        && !addressOnly
        && !fieldOnly;
      const label = `${location.workName || location.name}${user.role === 'admin' ? ` (${location.organizationName})` : ''}`;
      if (fieldOnly) {
        return {
          intent,
          reply: say(
            lang,
            `${label}\nDesignation: ${location.designation || '—'}`,
            `${label}\nDesignation: ${location.designation || '—'}`,
          ),
          source: 'data',
          context: {
            lastIntent: intent,
            organizationId: location.organizationId,
            organizationName: location.organizationName,
            locationId: location.id,
            locationName: location.workName || location.name,
            locationIds: [location.id],
            topic: 'location',
            title: location.workName || location.name,
            items: [location.workName || location.name],
          },
          data: { intent, organizationId: location.organizationId, locationId: location.id, designation: location.designation || null },
        };
      }
      if (addressOnly) {
        return {
          intent,
          reply: say(
            lang,
            `${label}\nAddress: ${location.address || '—'}`,
            `${label}\nAddress: ${location.address || '—'}`,
          ),
          source: 'data',
          context: {
            lastIntent: intent,
            organizationId: location.organizationId,
            organizationName: location.organizationName,
            locationId: location.id,
            locationName: location.workName || location.name,
            locationIds: [location.id],
            topic: 'location',
          },
          data: { intent, locationId: location.id, address: location.address || null },
        };
      }
      if (poOnly) {
        return {
          intent,
          reply: say(
            lang,
            `${label}\nPO number: ${location.opNumber || '—'}`,
            `${label}\nPO number: ${location.opNumber || '—'}`,
          ),
          source: 'data',
          context: {
            lastIntent: intent,
            organizationId: location.organizationId,
            organizationName: location.organizationName,
            locationId: location.id,
            locationName: location.workName || location.name,
            locationIds: [location.id],
            topic: 'location',
          },
          data: { intent, locationId: location.id, opNumber: location.opNumber || null },
        };
      }
      const counts = await countEmployees({
        organizationId: location.organizationId,
        locationId: location.id,
        designation: location.designation || null,
      });
      const people = await Employee.find({
        organizationId: location.organizationId,
        locationId: location.id,
        status: { $ne: 'disabled' },
        ...(location.designation ? { designation: new RegExp(`^${String(location.designation).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } : {}),
      }).select('name').sort({ name: 1 }).limit(40).lean();
      const names = people.map((item) => item.name);
      const siblingIds = locations
        .filter((item) => item.organizationId === location.organizationId && item.status !== 'disabled')
        .map((item) => item.id);
      return {
        intent,
        reply: [
          label,
          `Status: ${location.status || 'active'}`,
          say(lang, `Designation: ${location.designation || '—'}`, `Designation: ${location.designation || '—'}`),
          location.opNumber ? say(lang, `PO number: ${location.opNumber}`, `PO number: ${location.opNumber}`) : null,
          location.address ? say(lang, `Address: ${location.address}`, `Address: ${location.address}`) : null,
          say(lang, `Active employees: ${counts.active} (कुल ${counts.total})`, `Active employees: ${counts.active} (total ${counts.total})`),
          names.length
            ? `${say(lang, 'Employees:', 'Employees:')}\n${names.map((name, index) => `${index + 1}. ${name}`).join('\n')}`
            : say(lang, 'कोई active employee नहीं।', 'No active employees.'),
        ].filter(Boolean).join('\n'),
        source: 'data',
        context: {
          lastIntent: intent,
          organizationId: location.organizationId,
          organizationName: location.organizationName,
          locationId: location.id,
          locationName: location.workName || location.name,
          // Keep sibling sites so "donon locations ke employees" still sees the whole org.
          locationIds: siblingIds.length ? siblingIds : [location.id],
          topic: 'location',
          title: location.workName || location.name,
          items: names.length ? names : [location.workName || location.name],
        },
        data: {
          intent,
          organizationId: location.organizationId,
          locationId: location.id,
          active: counts.active,
          total: counts.total,
          names,
          designation: location.designation || null,
        },
      };
    }
    const employeeLabel = `${location.workName || location.name}${location.name && location.workName && location.name !== location.workName ? ` – ${location.name}` : ''}`;
    if (wantsEmployeeNames(original) && !includesAny(original, COUNT_WORDS)) {
      const { blocks, allNames } = await listEmployeesForLocations([location]);
      const block = blocks[0];
      return {
        intent,
        reply: block.names.length
          ? say(
            lang,
            `${employeeLabel} के employees (${allNames.length}):\n${block.lines}`,
            `${employeeLabel} employees (${allNames.length}):\n${block.lines}`,
          )
          : say(lang, `${employeeLabel}: कोई active employee नहीं।`, `${employeeLabel}: no active employees.`),
        source: 'data',
        context: {
          lastIntent: intent,
          organizationId: location.organizationId,
          organizationName: location.organizationName,
          locationId: location.id,
          locationName: employeeLabel,
          locationIds: [location.id],
          topic: 'employees',
          title: `${employeeLabel} employees`,
          items: allNames,
        },
        data: {
          intent,
          organizationId: location.organizationId,
          locationId: location.id,
          names: allNames,
        },
      };
    }
    const counts = await countEmployees({
      organizationId: location.organizationId,
      locationId: location.id,
      designation: location.designation || null,
    });
    return {
      intent,
      reply: say(
        lang,
        `${employeeLabel} (${location.organizationName}) में active employees: ${counts.active} (कुल ${counts.total}).`,
        `${employeeLabel} (${location.organizationName}): active employees = ${counts.active} (total ${counts.total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: intent,
        organizationId: location.organizationId,
        organizationName: location.organizationName,
        locationId: location.id,
        locationName: employeeLabel,
        locationIds: [location.id],
        topic: 'employees',
        title: `${employeeLabel} employees`,
        items: [],
      },
      data: {
        intent,
        organizationId: location.organizationId,
        locationId: location.id,
        active: counts.active,
        total: counts.total,
      },
    };
  }

  // Short follow-up: "unke naam batao" after an employee count for sticky location(s).
  if (wantsEmployeeNames(original) && !includesAny(original, LOCATION_WORDS) && !includesAny(original, ORG_WORDS)
    && words(original).length <= 8
    && (context?.locationIds?.length || context?.locationId)
    && (context?.lastIntent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT
      || context?.lastIntent === INTENTS.LOCATION_EMPLOYEE_COUNT
      || context?.topic === 'employees'
      || context?.topic === 'location')) {
    const ids = context.locationIds?.length ? context.locationIds : [context.locationId];
    const places = locations.filter((item) => ids.includes(item.id));
    if (places.length) {
      const { blocks, allNames } = await listEmployeesForLocations(places);
      if (context.items?.length && context.topic === 'employees' && context.items.every((item) => typeof item === 'string')) {
        // Already have employee names from prior answer — just restate them.
        const prior = context.items.filter(Boolean);
        if (prior.length && !prior.some((item) => /housekeeping|security|horticulture|location/i.test(item))) {
          return {
            intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
            reply: say(
              lang,
              `Employees (${prior.length}):\n${prior.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
              `Employees (${prior.length}):\n${prior.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
            ),
            source: 'data',
            context: { ...context, items: prior, topic: 'employees' },
            data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: prior },
          };
        }
      }
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      return {
        intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `Employees (${allNames.length}):\n${body}`,
          `Employees (${allNames.length}):\n${body}`,
        ),
        source: 'data',
        context: {
          ...context,
          lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          locationIds: places.map((item) => item.id),
          topic: 'employees',
          title: 'Employees',
          items: allNames,
        },
        data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: allNames },
      };
    }
  }

  return null;
}

async function executeSelectionFollowUp({ user, selection, context, directory, lang, message }) {
  const { option, type } = selection;
  if (type === 'organization') {
    const organization = directory.organizations.find((item) => item.id === option.id);
    if (!organization) {
      return {
        intent: 'clarification',
        reply: say(lang, 'वह organization अब उपलब्ध नहीं है।', 'That organization is no longer available.'),
        source: 'data',
      };
    }
    const resume = context?.lastIntent || INTENTS.ORGANIZATION_DETAILS;
    if (resume === INTENTS.ORGANIZATION_EMPLOYEE_COUNT || includesAny(message, EMPLOYEE_WORDS) || includesAny(message, COUNT_WORDS)) {
      const counts = await countEmployees({ organizationId: organization.id });
      return {
        intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `${organization.name} में active employees: ${counts.active} (कुल ${counts.total}).`,
          `${organization.name}: active employees = ${counts.active} (total ${counts.total}).`,
        ),
        source: 'data',
        context: {
          lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
          organizationId: organization.id,
          organizationName: organization.name,
        },
        data: {
          intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
          organizationId: organization.id,
          active: counts.active,
          total: counts.total,
        },
      };
    }
    return answerDirectoryQuery({
      user,
      message: `${organization.name} details`,
      directory,
      context: { organizationId: organization.id, organizationName: organization.name },
      lang,
    });
  }

  if (type === 'location') {
    const location = directory.locations.find((item) => item.id === option.id || item.id === option.locationId);
    if (!location) {
      return {
        intent: 'clarification',
        reply: say(lang, 'वह location अब उपलब्ध नहीं है।', 'That location is no longer available.'),
        source: 'data',
      };
    }
    const counts = await countEmployees({
      organizationId: location.organizationId,
      locationId: location.id,
      designation: location.designation || null,
    });
    return {
      intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
      reply: say(
        lang,
        `${location.workName || location.name} में active employees: ${counts.active} (कुल ${counts.total}).`,
        `${location.workName || location.name}: active employees = ${counts.active} (total ${counts.total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        organizationId: location.organizationId,
        organizationName: location.organizationName,
        locationId: location.id,
        locationName: location.workName || location.name,
      },
      data: {
        intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        organizationId: location.organizationId,
        locationId: location.id,
        active: counts.active,
        total: counts.total,
      },
    };
  }

  if (type === 'employee') {
    const employee = await Employee.findById(option.id)
      .select('_id name parentName organizationId locationId designation status phone')
      .lean();
    if (!employee) {
      return {
        intent: 'clarification',
        reply: say(lang, 'वह employee अब उपलब्ध नहीं है।', 'That employee is no longer available.'),
        source: 'data',
      };
    }
    const place = directory.locations.find((item) => item.id === String(employee.locationId));
    const organization = directory.organizations.find((item) => item.id === String(employee.organizationId));
    const placeText = place ? (place.workName || place.name) : '';
    const role = [employee.designation, placeText].filter(Boolean).join(' · ');
    return {
      intent: INTENTS.EMPLOYEE_DETAILS,
      reply: [
        employee.name,
        employee.parentName ? say(lang, `पिता/अभिभावक: ${employee.parentName}`, `Parent / guardian: ${employee.parentName}`) : '',
        role ? `Role/location: ${role}` : '',
        organization ? `Organization: ${organization.name}` : '',
        `Status: ${employee.status || 'active'}`,
      ].filter(Boolean).join('\n'),
      source: 'data',
      context: {
        lastIntent: INTENTS.EMPLOYEE_DETAILS,
        topic: 'employee',
        employeeId: String(employee._id),
        employeeName: employee.name,
        organizationId: employee.organizationId ? String(employee.organizationId) : null,
        locationId: employee.locationId ? String(employee.locationId) : null,
      },
      data: {
        intent: INTENTS.EMPLOYEE_DETAILS,
        employeeId: String(employee._id),
        employeeName: employee.name,
      },
    };
  }

  return null;
}

async function handleDirectorySelectPlan(user, plan, directory, lang = 'hi') {
  if (!plan || plan.type !== 'directory_select') return null;
  const selectedId = plan.selectedId;
  if (!selectedId || !mongoose.isValidObjectId(selectedId)) return null;
  const fakeContext = {
    lastIntent: plan.resumeIntent || INTENTS.ORGANIZATION_DETAILS,
    pendingSelectionType: plan.selectionType,
    pendingSelection: {
      type: plan.selectionType,
      options: [{ index: 1, id: selectedId, locationId: selectedId, organizationId: selectedId, name: selectedId }],
    },
  };
  return executeSelectionFollowUp({
    user,
    selection: { option: fakeContext.pendingSelection.options[0], type: plan.selectionType },
    context: fakeContext,
    directory,
    lang,
    message: '',
  });
}

module.exports = {
  INTENTS,
  classifyDirectoryIntent,
  isAllOrganizationsListQuery,
  textForOrgEntityMatch,
  parseSelectionIndex,
  isDirectoryCandidate,
  answerDirectoryQuery,
  handleDirectorySelectPlan,
  countEmployees,
  resolvePendingSelection,
};
