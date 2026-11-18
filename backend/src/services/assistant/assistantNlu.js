/**
 * Deterministic NLU for Shreeji Assistant (no LLM).
 * Normalization → synonym expansion → weighted intent scoring.
 * Maps NL variants onto existing directory / write handlers.
 */

const FILLER_WORDS = new Set([
  'please', 'pls', 'plz', 'bhai', 'bro', 'yaar', 'yar', 'ji', 'sir', 'madam',
  'bas', 'toh', 'to', 'hi', 'hey', 'hello', 'ok', 'okay', 'only', 'just',
  'can', 'you', 'me', 'my', 'mere', 'meri', 'mera', 'mujhe', 'mujh',
  'the', 'a', 'an', 'of', 'for', 'with', 'from', 'into', 'onto',
  'प्लीज', 'भाई', 'यार', 'जी', 'बस', 'तो', 'मुझे', 'मेरे', 'मेरी', 'मेरा',
]);

const STT_CORRECTIONS = [
  // Extra vowels / doubled letters from STT (organiisation, organzation).
  [/organi+s+ation+s?/gi, 'organizations'],
  [/organi+s+ation/gi, 'organization'],
  [/organi+z+ation+s?/gi, 'organizations'],
  [/organi+z+ation/gi, 'organization'],
  [/organzationz/gi, 'organizations'],
  [/organ[sz]ations?\b/gi, 'organizations'],
  [/attendenace/gi, 'attendance'],
  [/companie+s|compnies|cmpnies/gi, 'companies'],
  // Roman Hindi plurals: companiyan / companyan / kampaniyan → companies
  [/companiyans?|companyans?|kampaniyans?|campaniyans?|kompaniyans?/gi, 'companies'],
  [/compny|compnay|comapny|kampany|campany/gi, 'company'],
  [/bussiness(?:es)?/gi, 'business'],
  [/emplye+s?|employe+s?/gi, 'employees'],
  [/employeer|employer/gi, 'employee'],
  [/loaction|lokation|locaton|lokations/gi, 'location'],
  [/attenden+ce|attendence/gi, 'attendance'],
  [/payrol+|pairol|pairon|peyroll/gi, 'payroll'],
  [/aktiv[e]?|aktive/gi, 'active'],
  [/inactiv[e]?/gi, 'inactive'],
  [/\bmeny\b/gi, 'many'],
  [/\bttl\b/gi, 'total'],
  [/waje\s*sheet|wage\s*book|vegg\s*sheet/gi, 'wage sheet'],
  [/form\s*17\b/gi, 'form xvii'],
  // Longer forms first so "chalu hain" does not become "activen".
  [/chal\s*rahi\s*hain|chal\s*rahe\s*hain|chal\s*rahi|chal\s*rahe|chal\s*raha/gi, 'active'],
  [/chalu\s*hain|chalu\s*hai|chalu/gi, 'active'],
];

/**
 * Canonical semantic groups. Synonyms map to a single concept tag.
 * Do not put entity proper names here.
 */
const SYNONYM_GROUPS = {
  organization: [
    'organization', 'organizations', 'organisation', 'organisations', 'org', 'orgs',
    'company', 'companies', 'firm', 'firms', 'client', 'clients', 'business', 'businesses',
    'corporate', 'corporates', 'account', 'accounts', 'party', 'parties', 'partyyan',
    'companiyan', 'companyan', 'kampaniyan', 'campaniyan', 'kompaniyan',
    'ऑर्गेनाइजेशन', 'ऑर्गनाइजेशन', 'संगठन', 'संगठनो', 'क्लाइंट', 'क्लाइंट्स',
    'कंपनी', 'कंपनियां', 'कंपनियाँ', 'कम्पनी', 'फर्म', 'पार्टी', 'पार्टियां', 'अकाउंट', 'अकाउंट्स',
  ],
  count: [
    'count', 'total', 'number', 'numbers', 'how many', 'howmuch', 'how much',
    'kitna', 'kitni', 'kitne', 'kitne hain', 'kitni hain', 'kitna hai',
    'kaam karte', 'kaam karte hain', 'kaam kar rahe', 'work there', 'working there',
    'headcount', 'ginti', 'manpower count',
    'कितने', 'कितनी', 'कितना', 'कुल', 'संख्या', 'संख्यां', 'काम करते', 'काम कर रहे', 'गिन्ती', 'गिनती',
  ],
  list: [
    'list', 'lists', 'names', 'name', 'naam', 'show', 'display', 'dikhao', 'dikha',
    'batao', 'bata', 'batana', 'tell', 'which', 'kaun kaun', 'kon kon',
    'roster', 'dump', 'nikaal', 'nikal',
    'नाम', 'लिस्ट', 'सूची', 'बताओ', 'दिखाओ', 'कौन कौन', 'कौन-कौन', 'रोस्टर',
  ],
  detail: [
    'detail', 'details', 'info', 'information', 'profile', 'about', 'bare me', 'baare',
    'sab kuch', 'full details', 'full detail', 'card', 'profile card',
    'डिटेल', 'डिटेल्स', 'जानकारी', 'विवरण', 'प्रोफाइल', 'फुल डिटेल्स', 'फुल डिटेल',
  ],
  active: [
    'active', 'activate', 'activated', 'activ', 'enabled', 'operational', 'running',
    'working', 'live', 'alive', 'open', 'onboarded', 'chalu', 'chal rahi', 'chal rahe', 'chal raha', 'on',
    'एक्टिव', 'ऐक्टिव', 'सक्रिय', 'चालू', 'चल रही', 'चल रहे', 'चल रहा', 'लाइव',
  ],
  inactive: [
    'inactive', 'disabled', 'deactive', 'deactivate', 'deactivated', 'off', 'band', 'closed',
    'डीएक्टिव', 'इनएक्टिव', 'निष्क्रिय', 'डिसेबल्ड', 'बंद',
  ],
  employee: [
    'employee', 'employees', 'employ', 'employs', 'emp', 'staff', 'worker', 'workers',
    'employer', 'karmachari', 'personnel', 'people', 'person', 'log', 'logon', 'logo',
    'manpower', 'workforce', 'bande', 'banda',
    'एम्प्लॉई', 'एम्पलाई', 'एंपलॉयर', 'कर्मचारी', 'कर्मचारियों', 'कर्मचारिय', 'स्टाफ', 'वर्कर', 'लोग', 'लोगों', 'बंदे', 'मैनपावर',
  ],
  location: [
    'location', 'locations', 'site', 'sites', 'place', 'places', 'branch', 'branches',
    'unit', 'units', 'plant', 'plants',
    'लोकेशन', 'लोकेशंस', 'साइट', 'साइट्स', 'जगह', 'यूनिट', 'प्लांट',
  ],
  attendance: [
    'attendance', 'attendence', 'hajiri', 'haziri', 'hajri', 'present', 'absent', 'hazri',
    'हाजिरी', 'हाज़िरी', 'हाजरी', 'अटेंडेंस', 'अटेंडन्स', 'प्रेजेंट', 'एब्सेंट',
  ],
  payroll: [
    'payroll', 'salary', 'wage', 'wages', 'payslip', 'tanakhwa', 'tanakha',
    'पेरोल', 'पैरोल', 'सैलरी', 'वेतन', 'पगार', 'तनख्वाह', 'पेस्लिप',
  ],
  document: [
    'document', 'documents', 'slip', 'register', 'pdf', 'excel', 'sheet', 'seat',
    'wage book', 'form xvii', 'form 17', 'vegg',
    'स्लिप', 'रजिस्टर', 'डॉक्यूमेंट', 'शीट',
  ],
  create: [
    'create', 'make', 'add', 'generate', 'bana', 'banao', 'banado', 'nikal', 'nikalo',
    'बना', 'बनाओ', 'बना दो', 'जनरेट', 'निकाल', 'निकालो', 'जोड़', 'ऐड',
  ],
  update: [
    'update', 'edit', 'change', 'modify', 'correct', 'badal', 'badlo', 'sudhar',
    'अपडेट', 'एडिट', 'चेंज', 'बदल', 'बदलो', 'सुधार',
  ],
  delete: [
    'delete', 'remove', 'hatao', 'hata', 'delete kar', 'हटाओ', 'हटा', 'डिलीट', 'हटा दो',
  ],
  search: [
    'search', 'find', 'lookup', 'dhundo', 'dhundho', 'khojo',
    'सर्च', 'ढूंढो', 'खोजो', 'find',
  ],
  referential: [
    'inke', 'inki', 'inka', 'unke', 'unki', 'unka', 'uske', 'uski', 'uska', 'usko',
    'inmein', 'inme', 'ismein', 'isme', 'usmein', 'usme', 'unmein', 'unme',
    'their', 'them', 'those', 'wahi', 'vahi', 'same', 'ye', 'yeh', 'woh', 'un', 'in',
    'dono', 'donon', 'both',
    'उनके', 'उनकी', 'उनका', 'उसके', 'उसकी', 'उसका', 'इनके', 'इनकी', 'इनका',
    'इसमें', 'इनमें', 'उसमें', 'वही', 'ये', 'वो', 'दोनों',
  ],
  switch_scope: [
    'another', 'other', 'different', 'new', 'dusri', 'dusra', 'doosri', 'doosra',
    'any other', 'kisi aur', 'kisi or',
    'दूसरी', 'दूसरा', 'अन्य', 'और',
  ],
};

const CONCEPT_CANONICAL = {
  organization: ['organization', 'organizations'],
  count: ['count', 'total', 'how many', 'kitne'],
  list: ['list', 'names', 'naam', 'batao'],
  detail: ['details', 'info'],
  active: ['active'],
  inactive: ['disabled', 'inactive'],
  employee: ['employee', 'employees'],
  location: ['location', 'locations'],
  attendance: ['attendance'],
  payroll: ['payroll', 'salary'],
  document: ['document', 'slip', 'pdf'],
  create: ['create', 'generate'],
  update: ['update', 'edit'],
  delete: ['delete', 'remove'],
  search: ['search', 'find'],
  referential: ['uski', 'unki', 'ismein', 'their'],
  switch_scope: ['another', 'different'],
};

/** Phrase weights for intent scoring (longer / more specific first). */
const INTENT_PHRASES = [
  { intent: 'active_organization_count', weight: 12, phrases: [
    'how many active organizations', 'how many active companies', 'kitni active organisation',
    'kitni active organization', 'active organizations kitne', 'active companies kitne',
    'active clients kitne', 'running organizations', 'firms chal rahi', 'chal rahi hain',
    'total running organizations', 'active orgs', 'सक्रिय संगठन', 'चालू कंपनी',
  ]},
  { intent: 'organization_list', weight: 11, phrases: [
    'organisation ke naam', 'organization names', 'list all organizations', 'sari organisation',
    'sabhi organizations', 'all companies', 'companies ke naam', 'orgs ke naam',
    'inke naam', 'unki naam', 'organizations list', 'सभी संगठन के नाम',
  ]},
  { intent: 'active_employee_count', weight: 11, phrases: [
    'how many employees', 'kitne employee', 'active employee kitna', 'total employees',
    'kitne staff', 'employees kitne', 'कितने कर्मचारी',
  ]},
  { intent: 'organization_employee_count', weight: 10, phrases: [
    'organization mein kitne employee', 'company mein kitne', 'org employees',
    'employees in organization', 'inmein employees', 'ismein employees',
    'kitne log kaam', 'log kaam karte', 'active employees',
  ]},
  { intent: 'organization_employee_list', weight: 10, phrases: [
    'show employees', 'employee list', 'employees batao', 'their employees',
    'employee details', 'employees dikhao', 'show their employees',
  ]},
  { intent: 'organization_details', weight: 9, phrases: [
    'organization details', 'org ki details', 'company information', 'organisation ki info',
  ]},
  { intent: 'organization_location_list', weight: 9, phrases: [
    'kitni locations', 'locations list', 'sites batao', 'organization locations',
  ]},
  { intent: 'location_employee_count', weight: 9, phrases: [
    'location mein kitne employee', 'site pe kitne', 'location employees',
    'location ke employees', 'site ke employees', 'depot mein kitne',
    'location ke employee ke naam', 'location employees ke naam',
    'employees ki details', 'employee ke naam batao', 'unke naam batao',
  ]},
  { intent: 'location_details', weight: 8, phrases: [
    'location details', 'site details', 'location ki details',
  ]},
  { intent: 'attendance_query', weight: 10, phrases: [
    'attendance', 'hajiri', 'mark present', 'mark absent', 'हाजिरी',
  ]},
  { intent: 'payroll_query', weight: 10, phrases: [
    'payroll', 'salary slip', 'wage sheet', 'पेरोल', 'सैलरी',
  ]},
  { intent: 'document_request', weight: 9, phrases: [
    'pdf banao', 'excel banao', 'register nikal', 'document chahiye',
  ]},
  { intent: 'create_action', weight: 8, phrases: [
    'create organization', 'naya employee', 'add location', 'banao organization',
  ]},
  { intent: 'update_action', weight: 8, phrases: [
    'update employee', 'edit salary', 'change status', 'badal do',
  ]},
  { intent: 'delete_action', weight: 8, phrases: [
    'delete employee', 'remove location', 'hatao', 'delete kar do',
  ]},
  { intent: 'search_query', weight: 7, phrases: [
    'search employee', 'find organization', 'dhundo', 'khojo',
  ]},
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesWordOrPhrase(text, phrase) {
  const needle = String(phrase || '').toLowerCase().trim();
  if (!needle) return false;
  const hay = String(text || '').toLowerCase();
  if (/^[a-z0-9 .'-]+$/i.test(needle)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i').test(hay);
  }
  return hay.includes(needle);
}

function hasConcept(text, concept) {
  const group = SYNONYM_GROUPS[concept];
  if (!group) return false;
  return group.some((item) => includesWordOrPhrase(text, item));
}

function conceptsIn(text) {
  const found = new Set();
  for (const concept of Object.keys(SYNONYM_GROUPS)) {
    if (hasConcept(text, concept)) found.add(concept);
  }
  return found;
}

/**
 * Safe normalization: punctuation/whitespace, STT fixes, repeated words, fillers.
 * Does not rewrite proper nouns or invent meaning.
 */
function normalizeAssistantText(message) {
  let text = String(message || '')
    .normalize('NFC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[?!.;,:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of STT_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }

  // Collapse immediate repeated tokens ("kitni kitni" → "kitni").
  const tokens = text.split(/\s+/).filter(Boolean);
  const deduped = [];
  for (const token of tokens) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === token.toLowerCase()) continue;
    deduped.push(token);
  }

  // Drop pure filler tokens unless the message would become empty.
  const withoutFiller = deduped.filter((token) => !FILLER_WORDS.has(token.toLowerCase()));
  const kept = withoutFiller.length > 0 ? withoutFiller : deduped;
  return kept.join(' ').trim();
}

/**
 * Appends canonical English tokens for matched synonym groups.
 * Original wording is preserved so Hindi rules still match.
 */
function expandWithSynonyms(message) {
  const text = String(message || '');
  if (!text.trim()) return text;
  // "staff canteen" is a place name — do not expand "staff" into employee tokens.
  const conceptText = text.replace(/\bstaff\s+canteen\b/gi, 'site_canteen');
  const extras = [];
  const seen = new Set();
  const inactive = hasConcept(conceptText, 'inactive');

  for (const [concept, canonicals] of Object.entries(CONCEPT_CANONICAL)) {
    if (!hasConcept(conceptText, concept)) continue;
    if (inactive && concept === 'active') continue;
    for (const token of canonicals) {
      const key = token.toLowerCase();
      if (seen.has(key) || includesWordOrPhrase(text, token)) continue;
      seen.add(key);
      extras.push(token);
    }
  }

  if (extras.length === 0) return text;
  return `${text} ${extras.join(' ')}`.slice(0, 2000);
}

function prepareMessageForIntent(message) {
  const normalized = normalizeAssistantText(message);
  const expanded = expandWithSynonyms(normalized);
  return {
    original: String(message || '').trim(),
    normalized,
    expanded,
    concepts: conceptsIn(expanded),
  };
}

function scorePhraseMatches(text, phrases, weight) {
  let score = 0;
  let hits = 0;
  for (const phrase of phrases) {
    if (includesWordOrPhrase(text, phrase)) {
      hits += 1;
      score += weight + Math.min(4, phrase.split(/\s+/).length);
    }
  }
  return { score, hits };
}

/**
 * Deterministic intent classifier with confidence.
 * Entity signals (hasOrgMention etc.) break ties and raise confidence.
 */
function classifyIntent(message, {
  hasOrgMention = false,
  hasLocationMention = false,
  context = null,
} = {}) {
  const prepared = typeof message === 'object' && message?.expanded
    ? message
    : prepareMessageForIntent(message);
  const text = prepared.expanded;
  const concepts = prepared.concepts;

  const scores = new Map();
  const bump = (intent, amount, reason) => {
    if (!intent || amount <= 0) return;
    const prev = scores.get(intent) || { score: 0, reasons: [] };
    prev.score += amount;
    prev.reasons.push(reason);
    scores.set(intent, prev);
  };

  for (const entry of INTENT_PHRASES) {
    const { score } = scorePhraseMatches(text, entry.phrases, entry.weight);
    if (score > 0) bump(entry.intent, score, `phrase:${entry.intent}`);
  }

  const wantsCount = concepts.has('count');
  const wantsList = concepts.has('list') || concepts.has('detail');
  const wantsOrg = concepts.has('organization');
  const wantsEmployee = concepts.has('employee');
  const wantsLocation = concepts.has('location');
  const wantsActive = concepts.has('active') && !concepts.has('inactive');
  const wantsAttendance = concepts.has('attendance');
  const wantsPayroll = concepts.has('payroll');
  const wantsDocument = concepts.has('document');
  const wantsCreate = concepts.has('create');
  const wantsUpdate = concepts.has('update');
  const wantsDelete = concepts.has('delete');
  const wantsSearch = concepts.has('search');
  const referential = concepts.has('referential');

  // Concept combination rules (canonical directory intents).
  if (wantsDocument && !wantsCount) bump('document_request', 14, 'concept:document');
  if (wantsAttendance && !wantsCount) bump('attendance_query', 14, 'concept:attendance');
  if (wantsPayroll && !wantsCount && !wantsEmployee) bump('payroll_query', 14, 'concept:payroll');

  if (wantsOrg && wantsCount) bump('active_organization_count', wantsActive ? 18 : 15, 'org+count');
  if (wantsOrg && wantsList && !wantsCount && !wantsEmployee && !hasOrgMention) {
    bump('organization_list', 14, 'org+list');
  }
  if ((hasOrgMention || wantsOrg) && wantsEmployee && wantsCount) {
    bump('organization_employee_count', 16, 'org+employee+count');
  }
  if (hasOrgMention && wantsEmployee && wantsActive && !wantsCount && !concepts.has('detail')) {
    bump('organization_employee_count', 15, 'named-org-active-employees');
  }
  if (hasOrgMention && wantsEmployee && !wantsCount && !(wantsActive && !concepts.has('detail'))) {
    bump('organization_employee_list', concepts.has('detail') ? 16 : 14, 'named-org-employee-list');
  }
  if (hasLocationMention && wantsEmployee && wantsCount) {
    bump('location_employee_count', 16, 'loc+employee+count');
  }
  if (hasLocationMention && wantsEmployee && !wantsCount
    && (wantsList || concepts.has('detail') || concepts.has('list'))) {
    bump('location_employee_count', 15, 'loc+employee+list');
  }
  if (wantsEmployee && wantsCount && !hasOrgMention && !hasLocationMention && !wantsOrg) {
    bump('active_employee_count', 14, 'employee+count');
  } else if (hasOrgMention && wantsEmployee && wantsCount) {
    // Named-org employee asks must beat generic "how many employees" phrases.
    bump('organization_employee_count', 8, 'named-org-employee-boost');
  }
  if (wantsLocation && wantsCount && !wantsEmployee) {
    bump('organization_location_list', 13, 'location+count');
  }
  if (hasOrgMention && wantsLocation && (wantsList || wantsCount)) {
    bump('organization_location_list', 14, 'named-org+locations');
  }
  if (hasOrgMention && !wantsEmployee && !wantsCount && (concepts.has('detail') || wantsList)) {
    bump('organization_details', 15, 'named-org+details');
  }
  if (hasLocationMention && !wantsEmployee && !wantsCount && (concepts.has('detail') || wantsLocation)) {
    bump('location_details', 14, 'named-loc+details');
  }
  if (wantsSearch && (wantsEmployee || wantsOrg || wantsLocation)) {
    bump('search_query', 12, 'search');
  }

  // Write actions — only when clear action verbs; never from weak/uncertain matches alone.
  if (wantsDelete && (wantsEmployee || wantsOrg || wantsLocation)) bump('delete_action', 12, 'delete');
  if (wantsUpdate && (wantsEmployee || wantsOrg || wantsLocation || wantsPayroll)) bump('update_action', 11, 'update');
  if (wantsCreate && (wantsEmployee || wantsOrg || wantsLocation || wantsDocument || wantsPayroll)) {
    bump('create_action', 11, 'create');
  }

  // Follow-up boosts from sticky context.
  if (referential && context) {
    if (context.topic === 'organizations' || context.lastIntent === 'active_organization_count') {
      if (wantsList || concepts.has('list')) bump('organization_list', 20, 'followup:org-names');
      if (wantsEmployee && wantsCount) bump('organization_employee_count', 18, 'followup:org-employees');
      if (wantsEmployee && !wantsCount) bump('organization_employee_list', 17, 'followup:org-employee-list');
    }
    if (context.topic === 'employees' || context.locationId || context.locationIds?.length) {
      if (wantsList) bump('location_employee_count', 16, 'followup:employee-names');
      if (wantsEmployee && wantsCount) bump('location_employee_count', 15, 'followup:employee-count');
    }
    if (context.organizationId && wantsEmployee && wantsCount) {
      bump('organization_employee_count', 16, 'followup:sticky-org-employees');
    }
    if (context.organizationId && wantsEmployee && !wantsCount) {
      bump('organization_employee_list', 16, 'followup:sticky-org-employee-list');
    }
  }
  if (concepts.has('switch_scope') && wantsEmployee) {
    bump('organization_employee_list', 8, 'switch-org-employee');
  }

  // Conflict: document/attendance/payroll should not steal plain count asks.
  if (wantsCount && wantsOrg) {
    scores.delete('document_request');
    scores.delete('attendance_query');
    scores.delete('payroll_query');
  }

  let best = null;
  let second = 0;
  for (const [intent, meta] of scores.entries()) {
    if (!best || meta.score > best.score) {
      second = best ? best.score : 0;
      best = { intent, ...meta };
    } else if (meta.score > second) {
      second = meta.score;
    }
  }

  if (!best || best.score < 8) {
    return {
      intent: null,
      confidence: 0,
      ambiguous: false,
      prepared,
      scores: Object.fromEntries([...scores.entries()].map(([k, v]) => [k, v.score])),
    };
  }

  const margin = best.score - second;
  const confidence = Math.min(0.99, 0.45 + best.score / 40 + Math.min(0.2, margin / 30));
  const ambiguous = second > 0 && margin < 4 && confidence < 0.75;
  const writeIntent = best.intent === 'create_action'
    || best.intent === 'update_action'
    || best.intent === 'delete_action';

  // Safety: never allow write from low confidence.
  if (writeIntent && confidence < 0.85) {
    return {
      intent: null,
      confidence,
      ambiguous: true,
      needsClarification: true,
      prepared,
      scores: Object.fromEntries([...scores.entries()].map(([k, v]) => [k, v.score])),
      reason: 'uncertain_write_action',
    };
  }

  return {
    intent: ambiguous ? null : best.intent,
    confidence,
    ambiguous,
    needsClarification: ambiguous,
    prepared,
    topIntent: best.intent,
    reasons: best.reasons,
    scores: Object.fromEntries([...scores.entries()].map(([k, v]) => [k, v.score])),
  };
}

function isReferentialFollowUp(message) {
  return hasConcept(message, 'referential');
}

module.exports = {
  SYNONYM_GROUPS,
  FILLER_WORDS,
  normalizeAssistantText,
  expandWithSynonyms,
  prepareMessageForIntent,
  classifyIntent,
  hasConcept,
  conceptsIn,
  includesWordOrPhrase,
  isReferentialFollowUp,
};
