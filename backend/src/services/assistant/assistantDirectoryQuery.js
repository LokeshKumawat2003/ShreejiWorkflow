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
  compactName,
  similarEnough,
} = require('./assistantEntityResolver');
const {
  prepareMessageForIntent,
  classifyIntent: classifyNluIntent,
  hasConcept,
  isReferentialFollowUp,
  SYNONYM_GROUPS,
} = require('./assistantNlu');

const INTENTS = {
  ACTIVE_EMPLOYEE_COUNT: 'active_employee_count',
  ACTIVE_ORGANIZATION_COUNT: 'active_organization_count',
  ORGANIZATION_LIST: 'organization_list',
  ORGANIZATION_DETAILS: 'organization_details',
  ORGANIZATION_EMPLOYEE_COUNT: 'organization_employee_count',
  ORGANIZATION_EMPLOYEE_LIST: 'organization_employee_list',
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
  'how many', 'number of', 'number', 'numbers', 'count', 'total', 'kitne', 'kitni', 'kitna', 'kitne hain', 'kitni hain',
  'how much', 'kaam karte', 'kaam karte hain', 'kaam kar rahe', 'काम करते', 'काम कर रहे',
  'कितने', 'कितनी', 'कितना', 'कुल', 'संख्या',
  ...SYNONYM_GROUPS.count,
];
const LIST_WORDS = [
  'list', 'name', 'names', 'naam', 'kaun kaun', 'kon kon', 'which', 'batao', 'bata do', 'dikhao', 'details do', 'detail do',
  'show', 'display', 'नाम', 'लिस्ट', 'सूची', 'बताओ', 'दिखाओ', 'कौन कौन', 'कौन-कौन',
  ...SYNONYM_GROUPS.list,
];
const DETAIL_WORDS = [
  'detail', 'details', 'info', 'information', 'profile', 'bare me', 'baare', 'sab kuch', 'full details', 'full detail',
  'फुल डिटेल्स', 'फुल डिटेल',
  'डिटेल', 'डिटेल्स', 'जानकारी', 'विवरण', 'प्रोफाइल',
  ...SYNONYM_GROUPS.detail,
];
const ORG_CONTACT_WORDS = [
  'mobile', 'mobile number', 'phone', 'phone number', 'contact', 'contact number', 'email', 'e-mail', 'mail id', 'email id',
  'मोबाइल', 'मोबाइल नंबर', 'फोन', 'फोन नंबर', 'संपर्क', 'ईमेल', 'इमेल', 'मेल आईडी',
];
const ORG_WORDS = [
  'organization', 'organizations', 'organisation', 'organisations', 'org', 'orgs', 'client', 'clients',
  'company', 'companies', 'firm', 'firms', 'business', 'businesses',
  'companiyan', 'companyan', 'kampaniyan', 'campaniyan', 'kompaniyan',
  'ऑर्गेनाइजेशन', 'ऑर्गनाइजेशन', 'संगठन', 'क्लाइंट', 'कंपनी', 'कंपनियां', 'कंपनियाँ', 'कम्पनी', 'फर्म',
  ...SYNONYM_GROUPS.organization,
];
const LOCATION_WORDS = [
  'location', 'locations', 'site', 'sites', 'place', 'places', 'branch', 'branches',
  'लोकेशन', 'लोकेशंस', 'साइट', 'साइट्स', 'जगह',
  ...SYNONYM_GROUPS.location,
];
const EMPLOYEE_WORDS = [
  'employee', 'employees', 'employ', 'employs', 'emp', 'staff', 'worker', 'workers', 'employer', 'karmachari',
  'personnel', 'people', 'person', 'log', 'logon', 'logo',
  'एम्प्लॉई', 'एम्पलाई', 'एंपलॉयर', 'कर्मचारी', 'कर्मचारियों', 'कर्मचारिय', 'स्टाफ', 'वर्कर', 'लोग', 'लोगों',
  ...SYNONYM_GROUPS.employee,
];
const SWITCH_ORG_WORDS = [
  'another', 'other', 'different', 'dusri', 'dusra', 'doosri', 'doosra', 'kisi aur', 'kisi or', 'any other',
  'दूसरी', 'दूसरा', 'अन्य',
  ...(SYNONYM_GROUPS.switch_scope || []),
];
const EMPLOYEE_NAME_ASK_WORDS = [
  'naam', 'name', 'names', 'list', 'dikhao', 'kaun kaun', 'kon kon', 'who are', 'unke naam', 'unki naam', 'inke naam',
  'नाम', 'लिस्ट', 'सूची', 'कौन कौन', 'कौन-कौन', 'दिखाओ',
];
const ACTIVE_WORDS = [
  'active', 'activate', 'activated', 'activ', 'enabled', 'operational', 'running', 'working', 'live',
  'chalu', 'chal rahi', 'chal rahe', 'chal raha',
  'एक्टिव', 'ऐक्टिव', 'सक्रिय', 'चालू', 'चल रही', 'चल रहे', 'चल रहा',
  ...SYNONYM_GROUPS.active,
];
const FILLER_CHAT_WORDS = [
  'bhai', 'bro', 'yaar', 'yar', 'please', 'pls', 'plz', 'bas', 'toh', 'to', 'ab', 'abhi', 'only',
  'भाई', 'यार', 'प्लीज', 'बस', 'तो', 'अब', 'अभी',
];
const DISABLED_WORDS = [
  'disabled', 'inactive', 'deactive', 'deactivate', 'deactivated',
  'डीएक्टिव', 'इनएक्टिव', 'निष्क्रिय',
  ...SYNONYM_GROUPS.inactive,
];
const ATTENDANCE_WORDS = [
  'attendance', 'attendence', 'attorneys', 'attorney', 'hajiri', 'haziri', 'present', 'absent',
  'हाजिरी', 'अटेंडेंस', 'अटेंडन्स', 'एटर्नीज', 'एटर्नी', 'अटर्नीज', 'अटॉर्नीज', 'प्रेजेंट', 'एब्सेंट',
];
const MARK_ACTION_WORDS = [
  'mark', 'laga', 'lagao', 'laga do', 'lagado', 'mar', 'मार', 'मार्क', 'भर', 'fill', 'ful', 'full', 'फुल',
  'kar do', 'kardo', 'कर दो', 'लगा दो', 'मार कर', 'fill kar', 'ful kar', 'full kar', 'complete kar',
  'bhar do', 'भर दो', 'पूरी कर', 'पूरा कर',
];

function wantsAttendanceMarkAction(text) {
  if (!includesAny(text, ATTENDANCE_WORDS) && !includesAny(text, ['present', 'absent', 'प्रेजेंट', 'एब्सेंट', 'हाजिर'])) {
    return false;
  }
  if (includesAny(text, MARK_ACTION_WORDS)) return true;
  // "sari attendance ful kar do" / "attendance laga do as present"
  if (includesAny(text, ['kar do', 'kardo', 'karo', 'कर दो', 'करो', 'दे दो', 'do'])
    && includesAny(text, ['ful', 'full', 'fill', 'फुल', 'sari', 'saari', 'sab', 'sabhi', 'poori', 'puri', 'complete', 'सारी', 'सभी', 'पूरी', 'present', 'प्रेजेंट'])) {
    return true;
  }
  return false;
}
const PAYROLL_WORDS = ['payroll', 'salary', 'wage', 'पेरोल', 'सैलरी', 'वेतन', 'पगार'];
const DOCUMENT_WORDS = [
  'slip', 'register', 'pdf', 'excel', 'form xvi', 'form xvii', 'स्लिप', 'रजिस्टर',
  // Wage register / STT "veg sheet"
  'sheet', 'seat', 'wage', 'wages', 'veg', 'vegs', 'veggie', 'veggies', 'vej',
  'wage sheet', 'wages sheet', 'veg sheet', 'vegsheet', 'which sheet', 'wich sheet',
  'वेज', 'वेज शीट', 'वेजशीट', 'वेतन रजिस्टर', 'वेतन शीट',
];
const DOCUMENT_MAKE_WORDS = [
  'bana', 'banao', 'banado', 'nikal', 'nikalo', 'nikal do', 'generate', 'download', 'chahiye', 'chahie', 'do', 'de', 'dedo',
  'बना', 'बनाओ', 'निकाल', 'निकालो', 'निकाल दो', 'चाहिए', 'दो', 'दे',
];
const HOUSEKEEPING_WORDS = ['housekeeping', 'house keeping', 'हाउसकीपिंग', 'हाउस कीपिंग'];
const SECURITY_WORDS = [
  'security', 'security wali', 'सिक्योरिटी', 'सिक्यूरिटी', 'सेक्योरिटी', 'सिक्यूरिटी', 'सेक्यूरिटी',
];
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
  const pluralOrgs = /\borganisations\b|\borganizations\b|\borgs\b|\bcompanies\b|\bfirms\b|\bclients\b|\bcorporates\b|\bparties\b|\baccounts\b|\bbusinesses\b/i.test(text)
    || /कंपनियां|पार्टियां|क्लाइंट्स/.test(text);
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
    ...ORG_WORDS, ...ALL_ORG_SCOPE_WORDS, ...NAME_LIST_WORDS, ...LIST_WORDS, ...DETAIL_WORDS, ...ORG_CONTACT_WORDS,
    ...COUNT_WORDS, ...ACTIVE_WORDS, ...DISABLED_WORDS, ...LOCATION_WORDS, ...EMPLOYEE_WORDS,
    'ke', 'ki', 'ka', 'mein', 'me', 'do', 'de', 'the', 'of', 'and', 'or', 'for', 'with',
    'admin', 'block', 'wali', 'wala', 'wale', 'sorry', 'like', 'vagerah', 'vagairah', 'etc',
    'roster', 'dump', 'nikaal', 'nikal', 'headcount', 'ginti', 'manpower', 'workforce',
    'corporate', 'corporates', 'party', 'parties', 'account', 'accounts', 'unit', 'units', 'plant', 'plants',
    'bande', 'banda', 'live', 'alive', 'open', 'onboarded', 'card', 'chahiye', 'chahie', 'chahye',
    'के', 'की', 'का', 'में', 'मे', 'दो', 'दे', 'और', 'लाइक', 'वगैरह', 'चाहिए',
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

function classifyDirectoryIntent(message, { hasOrgMention = false, hasLocationMention = false, context = null } = {}) {
  const prepared = prepareMessageForIntent(message);
  const text = prepared.expanded || String(message || '');

  // NLU is consulted later as a fallback — never short-circuit department/named-org rules.

  // Wage-register / form documents before generic payroll word matches ("wage" alone).
  const wageRegisterDoc = includesAny(text, [
    'wage sheet', 'wages sheet', 'wage book', 'veg sheet', 'vegsheet', 'vegg sheet', 'which sheet', 'wich sheet',
    'form xvii', 'form xvi', 'form 17', 'वेज शीट', 'वेतन रजिस्टर', 'वेतन शीट',
  ]) || (includesAny(text, ['wage', 'wages', 'veg', 'vegg', 'vej', 'वेज'])
    && includesAny(text, ['sheet', 'seat', 'book', 'register', 'pdf', 'excel', 'शीट', 'रजिस्टर', 'बुक']));

  // Domain intents before generic document words ("sheet"/"register"/"pdf").
  if (wageRegisterDoc && !includesAny(text, COUNT_WORDS)) return INTENTS.DOCUMENT_GENERATION;
  // Attendance (including "kitni attendance") always defers to attendance handlers.
  if (includesAny(text, ATTENDANCE_WORDS)) return INTENTS.ATTENDANCE_QUERY;
  if (includesAny(text, PAYROLL_WORDS) && !includesAny(text, COUNT_WORDS) && !messageWantsEmployees(text)
    && !wageRegisterDoc) {
    return INTENTS.PAYROLL_QUERY;
  }
  if (includesAny(text, DOCUMENT_WORDS) && !includesAny(text, COUNT_WORDS)
    && !includesAny(text, ATTENDANCE_WORDS) && !includesAny(text, PAYROLL_WORDS)) {
    return INTENTS.DOCUMENT_GENERATION;
  }

  // Must win over any accidental org-entity match + "batao".
  if (isAllOrganizationsListQuery(text)) return INTENTS.ORGANIZATION_LIST;

  const wantsCount = includesAny(text, COUNT_WORDS) || hasConcept(text, 'count');
  const wantsList = includesAny(text, LIST_WORDS) || includesAny(text, DETAIL_WORDS) || hasConcept(text, 'list');
  const wantsOrg = includesAny(text, ORG_WORDS) || hasConcept(text, 'organization');
  const wantsLocation = includesAny(text, LOCATION_WORDS) || hasConcept(text, 'location');
  // Prefer messageWantsEmployees so "staff canteen" is not treated as an employee ask.
  const wantsEmployee = messageWantsEmployees(text);
  const wantsActive = (includesAny(text, ACTIVE_WORDS) || hasConcept(text, 'active'))
    && !includesAny(text, DISABLED_WORDS)
    && !hasConcept(text, 'inactive');
  const wantsInactive = includesAny(text, DISABLED_WORDS) || hasConcept(text, 'inactive');
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
  // Named location + employees names / list / details (no count) → location employee roster.
  // Prefer org employee list when a named org is also present ("Powergrid Khetri employees").
  // Do not steal org-profile asks that only contain "staff" inside a place name.
  if (hasLocationMention && wantsEmployee && !wantsCount && !hasOrgMention
    && !(wantsOrg && (includesAny(text, DETAIL_WORDS) || wantsOrganizationProfile(text)))
    && !includesAny(text, DOCUMENT_WORDS)
    && !includesAny(text, ATTENDANCE_WORDS)
    && !includesAny(text, PAYROLL_WORDS)) {
    return INTENTS.LOCATION_EMPLOYEE_COUNT;
  }
  // Named org + "active/inactive employees" → count. Bare "employees" / "employee details" → list.
  if (hasOrgMention && wantsEmployee && (wantsActive || wantsInactive) && !wantsCount && !wantsLocation
    && !includesAny(text, DOCUMENT_WORDS)
    && !includesAny(text, ATTENDANCE_WORDS)
    && !includesAny(text, PAYROLL_WORDS)) {
    return INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
  }
  // Named-org "headcount/kitne" without an employee word still means people at that org.
  if (hasOrgMention && wantsCount && !wantsEmployee && !wantsLocation && !wantsOrg
    && !includesAny(text, DOCUMENT_WORDS)
    && !includesAny(text, ATTENDANCE_WORDS)
    && !includesAny(text, PAYROLL_WORDS)) {
    return INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
  }
  if (hasOrgMention && wantsEmployee && !wantsCount && !wantsLocation
    && !includesAny(text, DOCUMENT_WORDS)
    && !includesAny(text, ATTENDANCE_WORDS)
    && !includesAny(text, PAYROLL_WORDS)) {
    return INTENTS.ORGANIZATION_EMPLOYEE_LIST;
  }

  // Specific named organization details — only when not an all-org list query.
  // Must win over accidental location hits from words like "block" in "Khatri admin block".
  // "mobile/email/naam vagerah" on a named org is still the org contact card, not an all-org name list.
  if (hasOrgMention && !wantsEmployee && !wantsCount && !wantsLocation
    && (includesAny(text, DETAIL_WORDS) || wantsOrgContactCard(text) || /\b(batao|बताओ|details?)\b/i.test(text))) {
    if (!includesAny(text, ALL_ORG_SCOPE_WORDS)
      && (wantsOrganizationProfile(text) || wantsOrgContactCard(text)
        || !includesAny(text, ['names', 'naam', 'नाम', 'list', 'लिस्ट']))) {
      return INTENTS.ORGANIZATION_DETAILS;
    }
  }
  // "Bhopal staff canteen organisation ki details" — org of the named site.
  if (wantsOrg && hasLocationMention && !wantsCount && (includesAny(text, DETAIL_WORDS) || wantsList || /\b(batao|बताओ|details?)\b/i.test(text))) {
    return INTENTS.ORGANIZATION_DETAILS;
  }
  // Named place + "location ki details/designation" beats a weak city→org match listing all sites.
  // Do not steal when the ask is about employees at that site.
  if (hasLocationMention && wantsLocation && !wantsEmployee
    && (wantsList || includesAny(text, DETAIL_WORDS) || includesAny(text, ['designation', 'destination', 'desination', 'address', 'status', 'पद', 'पता']))) {
    return INTENTS.LOCATION_DETAILS;
  }
  if (hasLocationMention && !hasOrgMention && !wantsOrg && !wantsEmployee && !wantsCount
    && (wantsList || includesAny(text, DETAIL_WORDS) || wantsLocation)) {
    return INTENTS.LOCATION_DETAILS;
  }
  // Org location list when no specific site was named (including bare "locations of X").
  if (hasOrgMention && wantsLocation && !wantsEmployee && !hasLocationMention
    && (wantsList || wantsCount || !includesAny(text, DETAIL_WORDS) || includesAny(text, LOCATION_WORDS))) {
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
  // Short "active orgs?" without an explicit count word.
  if (wantsOrg && wantsActive && !wantsEmployee && !wantsLocation && !leftoverName
    && words(prepared.normalized || text).length <= 4) {
    return INTENTS.ACTIVE_ORGANIZATION_COUNT;
  }
  if (wantsOrg && leftoverName && !includesAny(text, ALL_ORG_SCOPE_WORDS) && !wantsEmployee && !wantsCount
    && !includesAny(text, ['list', 'names', 'naam', 'roster', 'लिस्ट', 'नाम'])
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
  // Bare plural org ask ("orgs?", "clients?", "parties") → list.
  if (wantsOrg && !wantsEmployee && !wantsCount && !leftoverName
    && (/\b(organisations|organizations|orgs|companies|firms|clients|corporates|parties|accounts|businesses)\b/i.test(text)
      || /कंपनियां|पार्टियां|क्लाइंट्स/.test(text))) {
    return INTENTS.ORGANIZATION_LIST;
  }

  if (wantsEmployee && wantsCount && !hasOrgMention && !hasLocationMention) return INTENTS.ACTIVE_EMPLOYEE_COUNT;
  // Ultra-short staff/emp asks → dashboard employee count (use pre-expansion length).
  if (wantsEmployee && !wantsOrg && !hasOrgMention && !hasLocationMention && !wantsLocation
    && words(prepared.normalized || text).length <= 2) {
    return INTENTS.ACTIVE_EMPLOYEE_COUNT;
  }
  if (wantsLocation && wantsEmployee && wantsCount) return INTENTS.LOCATION_EMPLOYEE_COUNT;

  // Fallback: high-confidence NLU for synonym-heavy variants only.
  const nlu = classifyNluIntent(prepared, { hasOrgMention, hasLocationMention, context });
  if (!nlu.ambiguous && nlu.confidence >= 0.72) {
    if (nlu.intent === 'active_organization_count' || nlu.topIntent === 'active_organization_count') {
      return INTENTS.ACTIVE_ORGANIZATION_COUNT;
    }
    if ((nlu.intent === 'organization_list' || nlu.topIntent === 'organization_list')
      && !hasOrgMention
      && !leftoverName) {
      return INTENTS.ORGANIZATION_LIST;
    }
    if ((nlu.intent === 'organization_employee_count' || nlu.topIntent === 'organization_employee_count')
      && hasOrgMention
      && wantsEmployee
      && (wantsCount || wantsActive)) {
      return INTENTS.ORGANIZATION_EMPLOYEE_COUNT;
    }
    if ((nlu.intent === 'organization_employee_list' || nlu.topIntent === 'organization_employee_list')
      && hasOrgMention
      && wantsEmployee
      && !wantsCount) {
      return INTENTS.ORGANIZATION_EMPLOYEE_LIST;
    }
    if ((nlu.intent === 'location_employee_count' || nlu.topIntent === 'location_employee_count')
      && (hasLocationMention || wantsLocation)
      && wantsEmployee) {
      return INTENTS.LOCATION_EMPLOYEE_COUNT;
    }
  }

  return null;
}

function isDocumentGenerationAsk(message) {
  const text = String(message || '');
  if (!includesAny(text, DOCUMENT_WORDS)) return false;
  // "veg sheet" / "wage sheet" / "form xvii" alone is enough — do not answer as location details.
  if (includesAny(text, [
    'wage sheet', 'wages sheet', 'veg sheet', 'vegsheet', 'which sheet', 'wich sheet', 'veg seat', 'wage seat',
    'form xvii', 'form xvi', 'वेज शीट', 'वेजशीट', 'वेतन रजिस्टर', 'वेतन शीट',
  ])) return true;
  if (includesAny(text, ['veg', 'vegs', 'vej', 'veggie', 'veggies', 'wage', 'wages', 'वेज'])
    && includesAny(text, ['sheet', 'seat', 'register', 'शीट', 'रजिस्टर', ...DOCUMENT_MAKE_WORDS])) {
    return true;
  }
  return includesAny(text, DOCUMENT_MAKE_WORDS)
    || includesAny(text, ['pdf', 'excel', 'download', 'पीडीएफ', 'एक्सेल']);
}

function isDirectoryCandidate(message) {
  const prepared = prepareMessageForIntent(message);
  const text = prepared.expanded || String(message || '');
  if (!text.trim()) return false;
  // Document downloads (payroll / wage-veg sheet / attendance register) belong to legacy handlers.
  if (isDocumentGenerationAsk(text)) return false;
  if (includesAny(text, DOCUMENT_WORDS) && includesAny(text, DOCUMENT_MAKE_WORDS)) return false;
  return includesAny(text, COUNT_WORDS)
    || includesAny(text, LIST_WORDS)
    || includesAny(text, DETAIL_WORDS)
    || includesAny(text, ORG_WORDS)
    || includesAny(text, EMPLOYEE_WORDS)
    || includesAny(text, LOCATION_WORDS)
    || includesAny(text, HOUSEKEEPING_WORDS)
    || includesAny(text, SECURITY_WORDS)
    || includesAny(text, ATTENDANCE_WORDS)
    || isReferentialScopeFollowUp(text)
    || hasConcept(text, 'organization')
    || hasConcept(text, 'employee')
    || hasConcept(text, 'count')
    || Boolean(parseSelectionIndex(text));
}

function wantsEmployeeNames(text) {
  return includesAny(text, EMPLOYEE_NAME_ASK_WORDS)
    || (includesAny(text, NAME_LIST_WORDS) && messageWantsEmployees(text));
}

function wantsOrganizationProfile(text) {
  return includesAny(text, DETAIL_WORDS)
    || includesAny(text, ORG_CONTACT_WORDS)
    || includesAny(text, ['sab kuch', 'सब कुछ', 'full info', 'full details', 'फुल डिटेल्स', 'फुल डिटेल']);
}

function wantsOrgContactCard(text) {
  return includesAny(text, ORG_CONTACT_WORDS)
    || (includesAny(text, DETAIL_WORDS) && includesAny(text, ['naam', 'name', 'names', 'नाम', 'email', 'mobile', 'phone']));
}

function isOrganizationTopicContext(context) {
  if (!context?.organizationId) return false;
  return context.topic === 'organization'
    || context.topic === 'locations'
    || context.lastIntent === INTENTS.ORGANIZATION_DETAILS
    || context.lastIntent === INTENTS.ORGANIZATION_LOCATION_LIST
    || context.lastIntent === INTENTS.ORGANIZATION_EMPLOYEE_COUNT
    || context.lastIntent === INTENTS.ORGANIZATION_LIST;
}

function isStickyOrganizationDetailsFollowUp(message, context) {
  if (!isOrganizationTopicContext(context)) return false;
  if (messageWantsEmployees(message) && includesAny(message, COUNT_WORDS)) return false;
  if (wantsAttendanceMarkAction(message)
    || includesAny(message, ATTENDANCE_WORDS)
    || includesAny(message, DOCUMENT_WORDS)
    || includesAny(message, PAYROLL_WORDS)) {
    return false;
  }
  if (includesAny(message, HOUSEKEEPING_WORDS) || includesAny(message, SECURITY_WORDS)) return false;
  // Explicit location ask → leave for location handlers (even if "details" is also present).
  if (includesAny(message, LOCATION_WORDS) && !wantsOrgContactCard(message)) return false;
  if (!wantsOrganizationProfile(message) && !wantsOrgContactCard(message)) return false;
  const referential = isReferentialScopeFollowUp(message)
    || includesAny(message, ['uski', 'uska', 'uske', 'unki', 'unka', 'unke', 'उसकी', 'उसका', 'उसके', 'उनकी', 'उनका']);
  const shortAsk = words(message).length <= 12;
  return referential || shortAsk || wantsOrgContactCard(message);
}

async function buildOrganizationDetailsAnswer({
  organization,
  locations,
  lang,
}) {
  const orgLocations = locations.filter((item) => item.organizationId === organization.id);
  const activeLocations = orgLocations.filter((item) => item.status !== 'disabled');
  const counts = await countEmployees({ organizationId: organization.id });
  const locLines = activeLocations.slice(0, 20).map((item, index) => `${index + 1}. ${item.workName || item.name}`).join('\n');
  const contactName = organization.contactName || '';
  const email = organization.email || '';
  const phone = organization.phone || '';
  const address = organization.address || '';
  return {
    intent: INTENTS.ORGANIZATION_DETAILS,
    reply: [
      organization.name,
      contactName && contactName !== organization.name
        ? say(lang, `Contact name: ${contactName}`, `Contact name: ${contactName}`)
        : (contactName ? say(lang, `Name: ${contactName}`, `Name: ${contactName}`) : null),
      say(lang, `Mobile: ${phone || '—'}`, `Mobile: ${phone || '—'}`),
      say(lang, `Email: ${email || '—'}`, `Email: ${email || '—'}`),
      address ? say(lang, `Address: ${address}`, `Address: ${address}`) : null,
      say(lang, `Status: ${organization.status || 'active'}`, `Status: ${organization.status || 'active'}`),
      say(lang, `Active employees: ${counts.active} (कुल ${counts.total})`, `Active employees: ${counts.active} (total ${counts.total})`),
      say(lang, `Active locations: ${activeLocations.length}`, `Active locations: ${activeLocations.length}`),
      locLines ? `${say(lang, 'Locations:', 'Locations:')}\n${locLines}` : '',
    ].filter(Boolean).join('\n'),
    source: 'data',
    context: {
      lastIntent: INTENTS.ORGANIZATION_DETAILS,
      organizationId: organization.id,
      organizationName: organization.name,
      topic: 'organization',
      locationIds: activeLocations.map((item) => item.id),
      locationId: null,
      employeeId: null,
      employeeName: null,
      title: `${organization.name} locations`,
      items: activeLocations.map((item) => item.workName || item.name),
    },
    data: {
      intent: INTENTS.ORGANIZATION_DETAILS,
      organizationId: organization.id,
      organizationName: organization.name,
      contactName: contactName || null,
      email: email || null,
      phone: phone || null,
      activeEmployees: counts.active,
      totalEmployees: counts.total,
      activeLocations: activeLocations.length,
      locationIds: activeLocations.map((item) => item.id),
    },
  };
}

const REFERRING_SCOPE_WORDS = [
  'unke', 'unki', 'unka', 'uske', 'uski', 'uska', 'usmein', 'usme', 'ismein', 'isme', 'inme', 'inmein',
  'inke', 'inki', 'inka', 'inmein', 'unmein', 'wahi', 'vahi', 'dono', 'donon', 'both', 'same',
  'ye', 'yeh', 'woh', 'un',
  'is location', 'usi location', 'this location', 'that location', 'us location', 'in location',
  'उनके', 'उनकी', 'उनका', 'उसके', 'उसकी', 'उसमें', 'इसमें', 'इनमें', 'इनके', 'इनकी', 'इनका', 'दोनों', 'वही', 'ये', 'वो',
  'इस लोकेशन', 'उसी लोकेशन', 'उस लोकेशन', 'इस location', 'उसी location',
  ...SYNONYM_GROUPS.referential,
];

function isReferentialScopeFollowUp(text) {
  return includesAny(text, REFERRING_SCOPE_WORDS) || isReferentialFollowUp(text);
}

/** Leftover tokens after stripping topic words — e.g. "Ambala" in "Ambala employee ke naam". */
function leftoverSubjectTokens(message) {
  let text = String(message || '');
  const strip = [
    ...ORG_WORDS, ...ALL_ORG_SCOPE_WORDS, ...NAME_LIST_WORDS, ...LIST_WORDS, ...DETAIL_WORDS,
    ...COUNT_WORDS, ...ACTIVE_WORDS, ...DISABLED_WORDS, ...LOCATION_WORDS, ...EMPLOYEE_WORDS,
    ...HOUSEKEEPING_WORDS, ...SECURITY_WORDS, ...EMPLOYEE_NAME_ASK_WORDS, ...REFERRING_SCOPE_WORDS,
    'ke', 'ki', 'ka', 'mein', 'me', 'do', 'de', 'the', 'of', 'and', 'or', 'for', 'with', 'andar', 'inside',
    'wali', 'wala', 'wale', 'jitne', 'jitni', 'jitna', 'sari', 'log', 'logon', 'logo', 'people', 'employer', 'naya', 'new',
    'mujhe', 'mujh', 'mere', 'meri', 'hai', 'hain', 'ho', 'please', 'give', 'tell', 'show', 'their', 'them', 'those', 'now',
    'kaam', 'karte', 'kare', 'another', 'other', 'different',
    ...FILLER_CHAT_WORDS, ...SWITCH_ORG_WORDS,
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

async function listEmployeesForLocations(locationList, { limit = 40, withDetails = false } = {}) {
  const blocks = await Promise.all(locationList.map(async (location) => {
    const people = await Employee.find({
      organizationId: location.organizationId,
      locationId: location.id,
      status: { $ne: 'disabled' },
      ...(location.designation
        ? { designation: new RegExp(`^${String(location.designation).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        : {}),
    }).select(withDetails ? '_id name parentName designation status' : '_id name parentName')
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    const rows = people.map((item) => ({
      id: String(item._id),
      name: item.name || '',
      parentName: item.parentName || '',
      designation: item.designation || '',
      organizationId: location.organizationId,
      locationId: location.id,
    }));
    const names = rows.map((item) => item.name);
    const label = `${location.workName || location.name}${location.name && location.workName && location.name !== location.workName ? ` – ${location.name}` : ''}`;
    const formatLine = (item, index) => {
      const parent = item.parentName ? ` (S/O ${item.parentName})` : '';
      const role = withDetails && item.designation ? ` — ${item.designation}` : '';
      return `${index + 1}. ${item.name}${parent}${role}`;
    };
    return {
      location,
      label,
      names,
      people: rows,
      lines: rows.length
        ? rows.map((item, index) => formatLine(item, index)).join('\n')
        : null,
    };
  }));
  const allNames = blocks.flatMap((block) => block.names);
  const allPeople = blocks.flatMap((block) => block.people || []);
  return { blocks, allNames, allPeople };
}

async function listEmployeesForOrganization(organizationId, {
  status = 'active',
  withDetails = false,
  limit = 40,
} = {}) {
  const filter = {
    organizationId,
    ...(status === 'disabled'
      ? { status: 'disabled' }
      : status === 'all'
        ? {}
        : { status: { $ne: 'disabled' } }),
  };
  const people = await Employee.find(filter)
    .select(withDetails ? 'name designation status locationId parentName phone' : 'name designation status')
    .sort({ name: 1 })
    .limit(limit)
    .lean();
  return people;
}

function wantsSwitchOrganization(text) {
  return includesAny(text, SWITCH_ORG_WORDS)
    && (includesAny(text, ORG_WORDS) || hasConcept(text, 'organization') || hasConcept(text, 'switch_scope'));
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

function scorePendingOptionName(message, optionName) {
  const text = normalizeName(message);
  const name = normalizeName(optionName || '');
  if (!text || !name) return 0;
  if (text === name || compactName(text) === compactName(name)) return 100;
  if (name.includes(text) || text.includes(name)) return 90;
  const messageParts = words(text);
  const nameParts = words(name);
  if (nameParts.some((part) => messageParts.some((token) => similarEnough(token, part)))) return 80;
  if (includesAny(message, SECURITY_WORDS) && /security|सिक्योरिटी|सेक्योरिटी/i.test(optionName || '')) return 85;
  if (includesAny(message, HOUSEKEEPING_WORDS) && /housekeeping|हाउसकीपिंग/i.test(optionName || '')) return 85;
  return 0;
}

function resolvePendingSelection(message, context) {
  const pending = context?.pendingSelection;
  if (!pending?.options?.length) return null;
  const index = parseSelectionIndex(message);
  if (index) {
    const option = pending.options.find((item) => item.index === index);
    if (!option) return { error: true, index, options: pending.options };
    return { option, type: pending.type || context.pendingSelectionType };
  }

  // "सिक्योरिटी" / "Housekeeping" against the previous numbered list.
  if (words(message).length > 8) return null;
  const scored = pending.options
    .map((option) => ({ option, score: scorePendingOptionName(message, option.name) }))
    .filter((item) => item.score >= 80)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score < 95 && scored[0].score - scored[1].score < 10) {
    return { error: true, index: null, options: pending.options };
  }
  return { option: scored[0].option, type: pending.type || context.pendingSelectionType };
}

async function answerDirectoryQuery({
  user,
  message,
  directory,
  context = null,
  lang: preferredLang = null,
}) {
  if (user.role !== 'admin' && user.role !== 'organization') return null;
  const rawMessage = String(message || '').trim();
  if (!rawMessage) return null;
  const prepared = prepareMessageForIntent(rawMessage);
  // Entity resolve uses the user text; intent matching uses synonym-expanded text.
  const original = prepared.normalized || rawMessage;
  const matchText = prepared.expanded || original;
  const lang = preferredLang || detectLanguage(rawMessage);

  // Follow-up number / "ek number wali" against previous list.
  const pending = resolvePendingSelection(rawMessage, context);
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
      message: rawMessage,
    });
  }

  // "veg/wage sheet nikal kar do" must not become location details.
  if (isDocumentGenerationAsk(original) || wantsAttendanceMarkAction(original)) {
    return null;
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
  // Named location employee roster/details stay in directory ("Hurda Depot ke employees ki details").
  const earlyLocationHit = resolveLocations(original, locations);
  const namedLocationEmployeeAsk = Boolean(earlyLocationHit.matches.length || earlyLocationHit.ambiguous);
  // Named-org employee roster/details must stay in directory; person-profile asks have no org/location hit.
  if (looksLikePersonEmployeeQuery && !hasOrgMention && !includesAny(original, LOCATION_WORDS) && !namedLocationEmployeeAsk) {
    return null;
  }

  // "उसकी फुल डिटेल्स / mobile email" after an org answer — keep the sticky organization.
  if (isStickyOrganizationDetailsFollowUp(original, context) && !looksLikePersonEmployeeQuery) {
    const stickyOrg = organizations.find((item) => item.id === context.organizationId);
    if (stickyOrg) {
      return buildOrganizationDetailsAnswer({
        organization: stickyOrg,
        locations,
        lang,
      });
    }
  }

  // "another organization" / "dusri organization" — clear sticky org; do not reuse previous scope.
  if (wantsSwitchOrganization(matchText) && messageWantsEmployees(original) && !hasOrgMention) {
    return {
      intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
      reply: say(
        lang,
        'किस organization के employees चाहिए? नाम बताइए।',
        'Which organization\'s employees do you need? Please name the organization.',
      ),
      source: 'data',
      context: {
        lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
        topic: 'employees',
        organizationId: null,
        organizationName: null,
        organizationIds: null,
        locationId: null,
        locationIds: null,
        employeeStatusFilter: null,
      },
      data: { intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, needsOrganization: true, switchedScope: true },
    };
  }

  // "Inke naam / inmein employees / show their employees" — reuse sticky org scope.
  // Never steal location/document sticky asks ("ismein kitne", "donon locations", housekeeping naam).
  const stickyLocationScope = Boolean(context?.locationId || context?.locationIds?.length);
  const stickyOrgTopic = context
    && (context.topic === 'organizations'
      || context.topic === 'organization'
      || context.lastIntent === INTENTS.ACTIVE_ORGANIZATION_COUNT
      || context.lastIntent === INTENTS.ORGANIZATION_LIST
      || context.lastIntent === INTENTS.ORGANIZATION_DETAILS
      || context.lastIntent === INTENTS.ORGANIZATION_EMPLOYEE_COUNT
      || context.lastIntent === INTENTS.ORGANIZATION_EMPLOYEE_LIST
      || ((context.organizationId || context.organizationIds?.length)
        && context.topic === 'employees'
        && !stickyLocationScope));
  const orgScopeFollowUp = stickyOrgTopic
    && leftoverSubjectTokens(original).length === 0
    && !hasOrgMention
    && !wantsSwitchOrganization(matchText)
    && !includesAny(original, ALL_ORG_SCOPE_WORDS)
    && !includesAny(original, HOUSEKEEPING_WORDS)
    && !includesAny(original, SECURITY_WORDS)
    && words(original).length <= 12
    && (isReferentialScopeFollowUp(original)
      || includesAny(original, ['their', 'them', 'those']));
  if (orgScopeFollowUp) {
    const scopedIds = Array.isArray(context.organizationIds) && context.organizationIds.length
      ? context.organizationIds
      : (context.organizationId ? [context.organizationId] : null);
    const scopedOrgs = (scopedIds?.length
      ? organizations.filter((item) => scopedIds.includes(item.id))
      : organizations.filter((item) => (context.statusFilter === 'active'
        ? (item.status || 'active') !== 'disabled'
        : true)));
    const askNames = wantsEmployeeNames(original)
      || includesAny(original, NAME_LIST_WORDS)
      || includesAny(original, LIST_WORDS)
      || (isReferentialScopeFollowUp(original) && includesAny(original, ['naam', 'name', 'names', 'list', 'नाम', 'लिस्ट']));
    const askEmployees = messageWantsEmployees(original) || hasConcept(matchText, 'employee');
    const askCount = includesAny(original, COUNT_WORDS) || hasConcept(matchText, 'count');
    const askInactive = includesAny(original, DISABLED_WORDS) || hasConcept(matchText, 'inactive');
    const askDetails = includesAny(original, DETAIL_WORDS);
    if (askNames && !askEmployees
      && (context.topic === 'organizations'
        || context.lastIntent === INTENTS.ACTIVE_ORGANIZATION_COUNT
        || context.lastIntent === INTENTS.ORGANIZATION_LIST)) {
      const prior = Array.isArray(context.items) ? context.items.filter((item) => typeof item === 'string') : [];
      const names = prior.length ? prior : scopedOrgs.map((item) => item.name);
      if (names.length) {
        const lines = names.map((name, index) => `${index + 1}. ${name}`).join('\n');
        return {
          intent: INTENTS.ORGANIZATION_LIST,
          reply: say(
            lang,
            `${context.statusFilter === 'active' ? 'Active ' : ''}organizations (${names.length}):\n${lines}`,
            `${context.statusFilter === 'active' ? 'Active ' : ''}organizations (${names.length}):\n${lines}`,
          ),
          source: 'data',
          context: {
            ...context,
            lastIntent: INTENTS.ORGANIZATION_LIST,
            topic: 'organizations',
            statusFilter: context.statusFilter || 'active',
            organizationIds: scopedOrgs.map((item) => item.id),
            items: names,
          },
          data: { intent: INTENTS.ORGANIZATION_LIST, names, total: names.length },
        };
      }
    }

    // Location-sticky employee/count follow-ups belong to later location handlers.
    if (askEmployees && !stickyLocationScope) {
      if (askCount) {
        const orgIds = scopedOrgs.map((item) => item.id);
        if (orgIds.length) {
          const statusFilter = askInactive ? 'disabled' : 'active';
          const [matched, total] = await Promise.all([
            Employee.countDocuments({
              organizationId: { $in: orgIds },
              ...(statusFilter === 'disabled'
                ? { status: 'disabled' }
                : { status: { $ne: 'disabled' } }),
            }),
            Employee.countDocuments({ organizationId: { $in: orgIds } }),
          ]);
          return {
            intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
            reply: say(
              lang,
              `इन organizations में ${statusFilter === 'disabled' ? 'inactive' : 'active'} employees: ${matched} (कुल ${total}).`,
              `${statusFilter === 'disabled' ? 'Inactive' : 'Active'} employees in these organizations: ${matched} (total ${total}).`,
            ),
            source: 'data',
            context: {
              ...context,
              lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
              topic: 'employees',
              organizationIds: orgIds,
              organizationId: orgIds.length === 1 ? orgIds[0] : context.organizationId || null,
              statusFilter: context.statusFilter || 'active',
              employeeStatusFilter: statusFilter,
            },
            data: {
              intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT,
              active: statusFilter === 'active' ? matched : undefined,
              inactive: statusFilter === 'disabled' ? matched : undefined,
              total,
              organizationIds: orgIds,
              employeeStatusFilter: statusFilter,
            },
          };
        }
      } else if (scopedOrgs.length === 1 || context.organizationId) {
        const organization = scopedOrgs[0]
          || organizations.find((item) => item.id === context.organizationId);
        if (organization) {
          const people = await listEmployeesForOrganization(organization.id, {
            status: askInactive ? 'disabled' : 'active',
            withDetails: askDetails,
          });
          const lines = people.map((person, index) => {
            if (!askDetails) return `${index + 1}. ${person.name}`;
            const bits = [person.name, person.designation, person.status].filter(Boolean);
            return `${index + 1}. ${bits.join(' · ')}`;
          }).join('\n');
          return {
            intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
            reply: people.length
              ? say(
                lang,
                `${organization.name} के employees (${people.length}):\n${lines}`,
                `${organization.name} employees (${people.length}):\n${lines}`,
              )
              : say(
                lang,
                `${organization.name} में कोई ${askInactive ? 'inactive' : 'active'} employee नहीं मिला।`,
                `${organization.name} has no ${askInactive ? 'inactive' : 'active'} employees.`,
              ),
            source: 'data',
            context: {
              lastIntent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
              topic: 'employees',
              organizationId: organization.id,
              organizationName: organization.name,
              organizationIds: [organization.id],
              employeeStatusFilter: askInactive ? 'disabled' : 'active',
              items: people.map((person) => person.name),
            },
            data: {
              intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST,
              organizationId: organization.id,
              names: people.map((person) => person.name),
              total: people.length,
              employeeStatusFilter: askInactive ? 'disabled' : 'active',
            },
          };
        }
      }
    }
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
  // Never reuse a previous site when the user named a different organization/place.
  if ((!locResolve.matches.length && !locResolve.ambiguous) && context?.locationId) {
    const sticky = locations.find((item) => item.id === context.locationId);
    const namedDifferentOrg = Boolean(namedOrgId && sticky && sticky.organizationId !== namedOrgId)
      || (hasOrgMention && sticky && !orgResolve.matches.some((item) => item.id === sticky.organizationId));
    const freshSubject = leftoverSubjectTokens(original).length > 0 && !includesAny(original, [
      'uski', 'uska', 'uske', 'unki', 'unka', 'wahi', 'vahi', 'उसकी', 'उसका', 'उसके', 'वही', 'ismein', 'isme', 'इस',
    ]);
    const locationFollowUp = includesAny(original, LOCATION_WORDS)
      || includesAny(original, ['uski', 'uska', 'uske', 'unki', 'unka', 'wahi', 'vahi', 'उसकी', 'उसका', 'उसके', 'वही'])
      || words(original).length <= 6;
    // Employee-roster sticky ("unki details") must not become location profile details.
    const employeeRosterSticky = context?.topic === 'employees'
      || context?.lastIntent === INTENTS.LOCATION_EMPLOYEE_COUNT
      || context?.lastIntent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT;
    if (sticky && locationFollowUp && !namedDifferentOrg && !freshSubject && !employeeRosterSticky
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

  // Attendance / mark asks are owned by attendance handlers — never dump employee lists / org cards here.
  const attendanceOrMarkAsk = includesAny(original, ATTENDANCE_WORDS)
    || includesAny(original, ['अटेंडेंस', 'एटर्नीज', 'हाजिरी']);
  if (wantsAttendanceMarkAction(original)) {
    return null;
  }

  // "donon locations ke employee ke naam" — all sticky org locations, not only the last one.
  // Skip when a department keyword is present — housekeeping/security handlers own those asks.
  if (!attendanceOrMarkAsk
    && (includesAny(original, ['dono', 'donon', 'both', 'दोनों']) || includesAny(original, ALL_ORG_SCOPE_WORDS))
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

  // "unke naam / unki details" after employee count for sticky location(s).
  // Bare "name" is allowed only when very short and no new place/org leftover (never "Ambala employees").
  const bareNameFollowUp = wantsEmployeeNames(original)
    && words(original).length <= 3
    && leftoverSubject.length === 0
    && !messageWantsEmployees(original);
  const stickyEmployeeDetailsFollowUp = includesAny(original, DETAIL_WORDS)
    && (isReferentialScopeFollowUp(original) || words(original).length <= 6)
    && leftoverSubject.length === 0
    && !includesAny(original, COUNT_WORDS)
    && !includesAny(original, ATTENDANCE_WORDS);
  if ((wantsEmployeeNames(original) || stickyEmployeeDetailsFollowUp)
    && (isReferentialScopeFollowUp(original) || bareNameFollowUp || stickyEmployeeDetailsFollowUp)
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
      const { blocks, allNames, allPeople } = await listEmployeesForLocations(places, { withDetails: true });
      const pickHint = allPeople.length
        ? say(lang, '\nDetails के लिए नीचे से नाम चुनें।', '\nSelect a name below for details.')
        : '';
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      return {
        intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `Employees (${allNames.length}):\n${body}${pickHint}`,
          `Employees (${allNames.length}):\n${body}${pickHint}`,
        ),
        source: 'data',
        context: {
          ...context,
          lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          locationIds: places.map((item) => item.id),
          topic: 'employees',
          title: 'Employees',
          items: allNames,
          pendingSelectionType: allPeople.length ? 'employee' : null,
          pendingSelection: allPeople.length
            ? {
              type: 'employee',
              options: allPeople.slice(0, 12).map((item, index) => ({
                index: index + 1,
                id: item.id,
                name: item.name,
                parentName: item.parentName || '',
                organizationId: item.organizationId,
                locationId: item.locationId,
              })),
            }
            : null,
        },
        data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: allNames },
        choices: allPeople.slice(0, 12).map((item) => ({
          label: [
            item.name,
            item.parentName ? `S/O ${item.parentName}` : null,
            item.designation || null,
          ].filter(Boolean).join(' · '),
          plan: {
            type: 'directory_select',
            selectionType: 'employee',
            selectedId: item.id,
            resumeIntent: 'employee_details',
          },
        })),
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

  let intent = classifyDirectoryIntent(matchText, {
    hasOrgMention: effectiveHasOrgMention,
    hasLocationMention,
    context,
  });

  // Named org + "batao/details" without employee words → organization details.
  // Never override an all-organizations list/names request.
  if (!intent && hasLocationMention && includesAny(original, ORG_WORDS)
    && (includesAny(original, DETAIL_WORDS) || includesAny(original, LIST_WORDS))) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  // Org contact / full-details asks must stay on the organization, even when site addresses
  // also fuzzy-match multiple locations under that org ("Gail Vijaipur" / "BPCL Kochi").
  // Never steal attendance mark/fill ("full present", "ful kar do").
  const stickyEmployeeLocationTopic = context?.topic === 'employees'
    || context?.topic === 'location'
    || context?.lastIntent === INTENTS.LOCATION_EMPLOYEE_COUNT
    || context?.lastIntent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT;
  const prefersOrgProfile = !attendanceOrMarkAsk
    && (wantsOrganizationProfile(original) || wantsOrgContactCard(original)
      || (includesAny(original, ORG_WORDS) && includesAny(original, DETAIL_WORDS)))
    && !includesAny(original, LOCATION_WORDS)
    && !includesAny(original, HOUSEKEEPING_WORDS)
    && !includesAny(original, SECURITY_WORDS)
    && !messageWantsEmployees(original)
    && !stickyEmployeeLocationTopic
    && (strongOrg || hasOrgMention || context?.organizationId || includesAny(original, ORG_WORDS));
  if (prefersOrgProfile) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  // Bare "X organisation" (no details word) still means that org's profile.
  if (!intent && (strongOrg || effectiveHasOrgMention) && includesAny(original, ORG_WORDS)
    && !messageWantsEmployees(original) && !includesAny(original, COUNT_WORDS)
    && !includesAny(original, LOCATION_WORDS) && !isAllOrganizationsListQuery(original)) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }
  // Bare "सिक्योरिटी" after an org answer → that org's security location details.
  if (!intent && includesAny(original, SECURITY_WORDS) && !messageWantsEmployees(original)
    && !includesAny(original, COUNT_WORDS) && words(original).length <= 4
    && (hasLocationMention || context?.organizationId)) {
    intent = INTENTS.LOCATION_DETAILS;
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
  if (!intent && effectiveHasOrgMention && messageWantsEmployees(original) && !includesAny(original, COUNT_WORDS)
    && !includesAny(original, LOCATION_WORDS)) {
    intent = INTENTS.ORGANIZATION_EMPLOYEE_LIST;
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

  // Never ask "which location?" for an org profile / contact-card request.
  if ((intent === INTENTS.LOCATION_DETAILS || intent === INTENTS.LOCATION_EMPLOYEE_COUNT)
    && prefersOrgProfile
    && organization) {
    intent = INTENTS.ORGANIZATION_DETAILS;
  }

  if (intent === INTENTS.ACTIVE_ORGANIZATION_COUNT) {
    const wantsDisabled = includesAny(original, DISABLED_WORDS) || hasConcept(matchText, 'inactive');
    const matched = organizations.filter((item) => (
      wantsDisabled
        ? item.status === 'disabled'
        : (item.status || 'active') !== 'disabled'
    ));
    const total = organizations.length;
    const label = wantsDisabled ? 'Inactive' : 'Active';
    return {
      intent,
      reply: say(
        lang,
        `${label} organizations: ${matched.length} (कुल ${total}).`,
        `${label} organizations: ${matched.length} (total ${total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: intent,
        topic: 'organizations',
        statusFilter: wantsDisabled ? 'disabled' : 'active',
        organizationIds: matched.map((item) => item.id),
        items: matched.map((item) => item.name),
        title: `${label} organizations`,
      },
      data: {
        intent,
        active: wantsDisabled ? undefined : matched.length,
        inactive: wantsDisabled ? matched.length : undefined,
        total,
        statusFilter: wantsDisabled ? 'disabled' : 'active',
      },
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
    return buildOrganizationDetailsAnswer({ organization, locations, lang });
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
    const wantsDisabled = includesAny(original, DISABLED_WORDS) || hasConcept(matchText, 'inactive');
    const counts = await countEmployees({
      organizationId: organization.id,
      status: wantsDisabled ? 'disabled' : 'active',
    });
    const matched = wantsDisabled ? Math.max(0, counts.total - counts.active) : counts.active;
    return {
      intent,
      reply: say(
        lang,
        `${organization.name} में ${wantsDisabled ? 'inactive' : 'active'} employees: ${matched} (कुल employees: ${counts.total}).`,
        `${organization.name}: ${wantsDisabled ? 'inactive' : 'active'} employees = ${matched} (total employees = ${counts.total}).`,
      ),
      source: 'data',
      context: {
        lastIntent: intent,
        topic: 'employees',
        organizationId: organization.id,
        organizationName: organization.name,
        organizationIds: [organization.id],
        employeeStatusFilter: wantsDisabled ? 'disabled' : 'active',
      },
      data: {
        intent,
        organizationId: organization.id,
        organizationName: organization.name,
        active: counts.active,
        inactive: wantsDisabled ? matched : undefined,
        total: counts.total,
        employeeStatusFilter: wantsDisabled ? 'disabled' : 'active',
      },
    };
  }

  if (intent === INTENTS.ORGANIZATION_EMPLOYEE_LIST) {
    if (!organization) {
      return {
        intent,
        reply: say(
          lang,
          'किस organization के employees चाहिए? Organization का नाम बताइए।',
          'Which organization\'s employees do you need? Please name the organization.',
        ),
        source: 'data',
        data: { intent, needsOrganization: true },
      };
    }
    const wantsDisabled = includesAny(original, DISABLED_WORDS) || hasConcept(matchText, 'inactive');
    const withDetails = includesAny(original, DETAIL_WORDS) || hasConcept(matchText, 'detail');
    const people = await listEmployeesForOrganization(organization.id, {
      status: wantsDisabled ? 'disabled' : 'active',
      withDetails,
    });
    const lines = people.map((person, index) => {
      if (!withDetails) return `${index + 1}. ${person.name}`;
      const bits = [person.name, person.designation, person.status].filter(Boolean);
      return `${index + 1}. ${bits.join(' · ')}`;
    }).join('\n');
    return {
      intent,
      reply: people.length
        ? say(
          lang,
          `${organization.name} के ${withDetails ? 'employee details' : 'employees'} (${people.length}):\n${lines}`,
          `${organization.name} ${withDetails ? 'employee details' : 'employees'} (${people.length}):\n${lines}`,
        )
        : say(
          lang,
          `${organization.name} में कोई ${wantsDisabled ? 'inactive' : 'active'} employee नहीं मिला।`,
          `${organization.name} has no ${wantsDisabled ? 'inactive' : 'active'} employees.`,
        ),
      source: 'data',
      context: {
        lastIntent: intent,
        topic: 'employees',
        organizationId: organization.id,
        organizationName: organization.name,
        organizationIds: [organization.id],
        employeeStatusFilter: wantsDisabled ? 'disabled' : 'active',
        items: people.map((person) => person.name),
        title: `${organization.name} employees`,
      },
      data: {
        intent,
        organizationId: organization.id,
        organizationName: organization.name,
        names: people.map((person) => person.name),
        total: people.length,
        withDetails,
        employeeStatusFilter: wantsDisabled ? 'disabled' : 'active',
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
    const askEmployeeRoster = (wantsEmployeeNames(original) || includesAny(original, DETAIL_WORDS) || includesAny(original, LIST_WORDS))
      && !includesAny(original, COUNT_WORDS);
    if (askEmployeeRoster) {
      const wantDetails = includesAny(original, DETAIL_WORDS);
      const { blocks, allNames, allPeople } = await listEmployeesForLocations([location], { withDetails: true });
      const block = blocks[0];
      const pickHint = allPeople.length
        ? say(lang, '\nDetails के लिए नीचे से नाम चुनें।', '\nSelect a name below for details.')
        : '';
      return {
        intent,
        reply: block.names.length
          ? say(
            lang,
            `${employeeLabel} के employees (${allNames.length}):\n${block.lines}${pickHint}`,
            `${employeeLabel} employees (${allNames.length}):\n${block.lines}${pickHint}`,
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
          pendingSelectionType: allPeople.length ? 'employee' : null,
          pendingSelection: allPeople.length
            ? {
              type: 'employee',
              options: allPeople.slice(0, 12).map((item, index) => ({
                index: index + 1,
                id: item.id,
                name: item.name,
                parentName: item.parentName || '',
                organizationId: item.organizationId,
                locationId: item.locationId,
              })),
            }
            : null,
        },
        data: {
          intent,
          organizationId: location.organizationId,
          locationId: location.id,
          names: allNames,
          details: wantDetails,
        },
        choices: allPeople.slice(0, 12).map((item) => ({
          label: [
            item.name,
            item.parentName ? `S/O ${item.parentName}` : null,
            item.designation || null,
          ].filter(Boolean).join(' · '),
          plan: {
            type: 'directory_select',
            selectionType: 'employee',
            selectedId: item.id,
            resumeIntent: 'employee_details',
          },
        })),
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

  // Short follow-up: "unke naam / unki details" after an employee count for sticky location(s).
  const stickyRosterAsk = (wantsEmployeeNames(original) || includesAny(original, DETAIL_WORDS) || includesAny(original, LIST_WORDS))
    && !includesAny(original, ORG_WORDS)
    && !includesAny(original, ATTENDANCE_WORDS)
    && !includesAny(original, COUNT_WORDS)
    && words(original).length <= 10
    && (context?.locationIds?.length || context?.locationId)
    && leftoverSubject.length === 0
    && (context?.lastIntent === INTENTS.DEPARTMENT_EMPLOYEE_COUNT
      || context?.lastIntent === INTENTS.LOCATION_EMPLOYEE_COUNT
      || context?.topic === 'employees'
      || context?.topic === 'location');
  if (stickyRosterAsk) {
    const ids = context.locationIds?.length ? context.locationIds : [context.locationId];
    const places = locations.filter((item) => ids.includes(item.id));
    if (places.length) {
      const { blocks, allNames, allPeople } = await listEmployeesForLocations(places, { withDetails: true });
      const pickHint = allPeople.length
        ? say(lang, '\nDetails के लिए नीचे से नाम चुनें।', '\nSelect a name below for details.')
        : '';
      const body = blocks.map((block) => (
        block.names.length
          ? `${block.label}:\n${block.lines}`
          : `${block.label}: ${say(lang, 'कोई active employee नहीं।', 'No active employees.')}`
      )).join('\n\n');
      return {
        intent: INTENTS.LOCATION_EMPLOYEE_COUNT,
        reply: say(
          lang,
          `Employees (${allNames.length}):\n${body}${pickHint}`,
          `Employees (${allNames.length}):\n${body}${pickHint}`,
        ),
        source: 'data',
        context: {
          ...context,
          lastIntent: INTENTS.LOCATION_EMPLOYEE_COUNT,
          locationIds: places.map((item) => item.id),
          topic: 'employees',
          title: 'Employees',
          items: allNames,
          pendingSelectionType: allPeople.length ? 'employee' : null,
          pendingSelection: allPeople.length
            ? {
              type: 'employee',
              options: allPeople.slice(0, 12).map((item, index) => ({
                index: index + 1,
                id: item.id,
                name: item.name,
                parentName: item.parentName || '',
                organizationId: item.organizationId,
                locationId: item.locationId,
              })),
            }
            : null,
        },
        data: { intent: INTENTS.LOCATION_EMPLOYEE_COUNT, names: allNames },
        choices: allPeople.slice(0, 12).map((item) => ({
          label: [
            item.name,
            item.parentName ? `S/O ${item.parentName}` : null,
            item.designation || null,
          ].filter(Boolean).join(' · '),
          plan: {
            type: 'directory_select',
            selectionType: 'employee',
            selectedId: item.id,
            resumeIntent: 'employee_details',
          },
        })),
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
    const resume = context?.lastIntent || INTENTS.LOCATION_DETAILS;
    if (resume === INTENTS.LOCATION_DETAILS || includesAny(message, DETAIL_WORDS) || !includesAny(message, COUNT_WORDS)) {
      return answerDirectoryQuery({
        user,
        message: `${location.workName || location.name} location ki details`,
        directory,
        context: {
          organizationId: location.organizationId,
          organizationName: location.organizationName,
          locationId: location.id,
          locationName: location.workName || location.name,
        },
        lang,
      });
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
        locationIds: [location.id],
        topic: 'location',
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
  prepareMessageForIntent,
};
