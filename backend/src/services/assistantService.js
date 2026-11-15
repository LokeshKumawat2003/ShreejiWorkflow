const mongoose = require('mongoose');
const AssistantSession = require('../models/AssistantSession');
const { previewInvoice, saveInvoice } = require('./clientInvoiceService');
const Employee = require('../models/Employee');
const Location = require('../models/Location');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { escapeRegex } = require('../utils/validation');
const { ATTENDANCE_STATUSES, MAX_MONTH_WORKING_DAYS, STATUS_CODES } = require('../utils/attendanceStatus');
const Attendance = require('../models/Attendance');
const { getSettingsFor } = require('./documentSettingsService');
const { bulkMarkAttendance, getAttendanceRegister, markAttendance } = require('./attendanceService');
const { createDocumentBatch, listDocumentLocations, previewLocationsPayroll } = require('./bankInvoiceService');
const { calculateBankPayments, wageRates, wageRegisterRow } = require('./payrollService');

const DOCUMENT_TYPES = ['salary_slip', 'payroll', 'wage_register', 'attendance_register'];
const DOCUMENT_LABELS = {
  salary_slip: 'Salary slip',
  payroll: 'Payroll',
  wage_register: 'Wage register (FORM XVII)',
  attendance_register: 'Attendance register (FORM XVI)',
};
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY = 6;
const MAX_CHOICES = 12;
const MODEL_TIMEOUT_MS = 25_000;
const MODEL_PAUSE_MS = 5 * 60 * 1000;
let modelPausedUntil = 0;

const MONTHS = [
  ['january', 'jan', 'janvari', 'janwari', 'जनवरी'],
  ['february', 'feb', 'farvari', 'farwari', 'फरवरी', 'फ़रवरी'],
  ['march', 'mar', 'march', 'मार्च'],
  ['april', 'apr', 'aprail', 'अप्रैल', 'अप्रेल'],
  ['may', 'मई'],
  ['june', 'jun', 'जून'],
  ['july', 'jul', 'julai', 'जुलाई'],
  ['august', 'aug', 'agast', 'अगस्त'],
  ['september', 'sep', 'sept', 'sitambar', 'सितंबर', 'सितम्बर'],
  ['october', 'oct', 'aktubar', 'october', 'अक्टूबर', 'अक्तूबर'],
  ['november', 'nov', 'navambar', 'नवंबर', 'नवम्बर'],
  ['december', 'dec', 'disambar', 'दिसंबर', 'दिसम्बर'],
];

const TYPE_KEYWORDS = [
  ['salary_slip', ['slip', 'slips', 'स्लिप', 'पर्ची', 'parchi', 'payslip']],
  ['attendance_register', ['attendance', 'अटेंडेंस', 'अटेंडन्स', 'हाजिरी', 'हाज़िरी', 'उपस्थिति', 'hajiri', 'haziri', 'form xvi', 'musterroll', 'muster']],
  ['wage_register', ['wage', 'wages', 'veggies', 'veggie', 'वेज', 'वेजेस', 'वेजस', 'वेजिस', 'वेजीज', 'वेतन रजिस्टर', 'form xvii', 'xvii']],
  ['payroll', ['payroll', 'payrol', 'payrole', 'पेरोल', 'पे रोल', 'पैरोल', 'पै रोल', 'पेरॉल', 'पैरॉल', 'पेयरोल', 'पे-रोल', 'पेरौल', 'पैरौल', 'पेट्रोल', 'पैट्रोल', 'petrol', 'salary', 'सैलरी', 'सेलरी', 'तनख्वाह', 'तनखा', 'वेतन', 'tankhwah', 'pagar', 'पगार']],
];

const EXCEL_WORDS = ['excel', 'xlsx', 'xls', 'spreadsheet', 'एक्सेल', 'एक्सल', 'exel'];
const PDF_WORDS = ['pdf', 'पीडीएफ', 'पीडीऍफ़'];
const ALL_WORDS = ['all', 'every', 'sabhi', 'sabki', 'sab', 'sare', 'saare', 'सभी', 'सब', 'सारे', 'सबकी', 'सबका', 'सारी', 'पूरे', 'सारे एम्पलाइज', 'सभी एम्पलाई', 'all employees', 'every employee'];
const LAST_MONTH_WORDS = ['last month', 'previous month', 'pichle mahine', 'pichhle mahine', 'pichla mahina', 'पिछले महीने', 'पिछला महीना', 'पिछले मंथ', 'लास्ट मंथ'];
const THIS_MONTH_WORDS = ['this month', 'current month', 'is mahine', 'iss mahine', 'is month', 'इस महीने', 'इस मंथ', 'यह महीना', 'चालू महीने'];

const DEVANAGARI = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h', 'ड़': 'r', 'ढ़': 'rh', 'क़': 'k', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'फ़': 'f',
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
  'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '', '़': '',
};

function transliterate(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/ड़/g, 'r')
    .replace(/ढ़/g, 'rh')
    .replace(/[\u0900-\u097F]/g, (char) => DEVANAGARI[char] ?? '');
}

/** Consonant skeleton so "Malikhera", "Mali Khera" and "मालीखेड़ा" compare equal. */
function skeleton(text) {
  return transliterate(text)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/h/g, '')
    .replace(/x/g, 'ks')
    .replace(/[cq]/g, 'k')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/[dr]/g, 'r')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
}

function words(text) {
  return String(text || '').toLowerCase().split(/[\s,.;:!?()/\\|"'`\-–—]+/).filter(Boolean);
}

/** Skeletons of every single word and every pair of adjacent words in the text. */
function messageKeys(text) {
  const list = words(text);
  const keys = new Set();
  list.forEach((word, index) => {
    keys.add(skeleton(word));
    if (index + 1 < list.length) keys.add(skeleton(word + list[index + 1]));
  });
  keys.delete('');
  return keys;
}

function includesAny(text, list) {
  const lower = String(text || '').toLowerCase();
  return list.some((word) => (/^[a-z ]+$/.test(word)
    ? new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(lower)
    : lower.includes(word)));
}

// Romanized Hindi / Hinglish cues — if these show up, keep replies in Hindi.
const HINGLISH_MARKERS = [
  'kya', 'hai', 'ho', 'hain', 'mein', 'main', 'mujhe', 'mujh', 'mera', 'meri', 'tum', 'tumhara', 'aap', 'aapka',
  'bana', 'banao', 'banado', 'batao', 'batana', 'karo', 'kar do', 'de do', 'laga', 'lagao', 'nikal',
  'kitne', 'kitni', 'kitna', 'sabhi', 'sare', 'saare', 'sari', 'dono', 'donon', 'baki', 'baaki',
  'petrol', 'pairol', 'pairo', 'hajiri', 'haziri', 'sakti', 'sakte', 'samajhte', 'samajhti', 'samajh',
  'ka', 'ki', 'ke', 'ko', 'se', 'par', 'wala', 'wali', 'wale', 'karna', 'chahiye', 'nahi', 'nahin',
];

/** True when the user is writing in English (not Devanagari / Hinglish). */
function prefersEnglish(text) {
  const raw = String(text || '');
  if (!raw.trim()) return false;
  if (/[\u0900-\u097F]/.test(raw)) return false;
  if (includesAny(raw, HINGLISH_MARKERS)) return false;
  return /[a-zA-Z]/.test(raw);
}

function messageLang(text, session = null) {
  if (prefersEnglish(text)) return 'en';
  if (String(text || '').trim() && (/[\u0900-\u097F]/.test(text) || includesAny(text, HINGLISH_MARKERS))) return 'hi';
  return session?.context?.lang === 'en' ? 'en' : 'hi';
}

const {
  enrichMessageForRules,
  preferLang,
  localizeAnswer,
} = require('./assistantLanguage');

function say(lang, hi, en) {
  return lang === 'en' ? en : hi;
}

function todayIn(timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function parseMonth(text, currentMonth) {
  const lower = String(text || '').toLowerCase();
  const iso = lower.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}`;
  const numeric = lower.match(/\b(0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (numeric) return `${numeric[2]}-${numeric[1].padStart(2, '0')}`;
  if (includesAny(lower, LAST_MONTH_WORDS)) return shiftMonth(currentMonth, -1);

  const tokens = words(lower);
  const monthIndex = MONTHS.findIndex((names) => names.some((name) => (
    /^[a-z]+$/.test(name) ? tokens.includes(name) && !(name === 'may' && tokens.includes('i')) : lower.includes(name)
  )));
  if (monthIndex >= 0) {
    const year = lower.match(/\b(20\d{2})\b/);
    const [currentYear, currentMonthNumber] = currentMonth.split('-').map(Number);
    const resolvedYear = year ? Number(year[1]) : monthIndex + 1 > currentMonthNumber ? currentYear - 1 : currentYear;
    return `${resolvedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
  }
  if (includesAny(lower, THIS_MONTH_WORDS)) return currentMonth;
  return null;
}

function parseType(text) {
  const lower = String(text || '').toLowerCase();
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (includesAny(lower, keywords)) return type;
  }
  return null;
}

function parseFormat(text) {
  if (includesAny(text, EXCEL_WORDS)) return 'excel';
  if (includesAny(text, PDF_WORDS)) return 'pdf';
  return null;
}

function locationLabel(location) {
  const site = location.name.split(',')[0].trim();
  return [location.workName, site !== location.workName && site].filter(Boolean).join(' – ');
}

async function loadDirectory(user) {
  const organizationFilter = user.role === 'admin' ? { role: 'organization' } : { _id: user.id, role: 'organization' };
  const [organizations, locations] = await Promise.all([
    User.find(organizationFilter).select('_id organizationName name email').lean(),
    Location.find(user.role === 'admin' ? {} : { organizationId: user.id })
      .select('_id organizationId workName name address designation status')
      .lean(),
  ]);
  const organizationNames = new Map(organizations.map((organization) => [
    String(organization._id),
    organization.organizationName || organization.name || organization.email,
  ]));
  return {
    organizations: organizations.map((organization) => ({ id: String(organization._id), name: organizationNames.get(String(organization._id)) })),
    locations: locations
      .filter((location) => organizationNames.has(String(location.organizationId)))
      .map((location) => ({
        id: String(location._id),
        organizationId: String(location.organizationId),
        organizationName: organizationNames.get(String(location.organizationId)),
        workName: location.workName || '',
        name: location.name || '',
        address: location.address || '',
        designation: location.designation || '',
        status: location.status || 'active',
      })),
  };
}

const COMMON_WORDS = new Set([
  'sabhi', 'saare', 'sabka', 'sabki', 'bana', 'bani', 'banao', 'bane', 'karo', 'kardo', 'karke', 'karna', 'wala', 'wali', 'wale', 'mujhe', 'mera', 'meri',
  'unka', 'unki', 'uska', 'uski', 'iska', 'iski', 'abhi', 'kaun', 'kaise', 'kuch', 'yaha', 'vaha', 'bhai', 'bata', 'batao', 'dena', 'dijiye', 'chahiye',
  'invoice', 'slip', 'sheet', 'month', 'mahina', 'mahine', 'total', 'paid', 'days', 'ki', 'hai', 'please', 'pura', 'poora', 'puri', 'poori',
  'सभी', 'सारे', 'सबका', 'सबकी', 'बना', 'बनी', 'बनाओ', 'करो', 'करके', 'करना', 'वाला', 'वाली', 'वाले', 'मुझे', 'मेरा', 'मेरी', 'उनका', 'उसका', 'इसका',
  'अभी', 'कौन', 'कैसे', 'कुछ', 'बताओ', 'देना', 'दीजिए', 'चाहिए', 'महीने', 'महीना', 'पूरा', 'पूरी', 'पूरे',
]);

/** Best-scoring entries whose name words appear in the text; several entries tie when the text is ambiguous. */
function bestMatches(text, entries, namesOf, { shortNames = false } = {}) {
  const keys = messageKeys(text);
  // Person names can have two-letter skeletons ("Puja" → "pj"); those only match a whole, uncommon word of 4+ letters.
  const shortKeys = shortNames
    ? new Set(words(text).filter((word) => [...word].length >= 4 && !COMMON_WORDS.has(word)).map(skeleton).filter((key) => key.length === 2))
    : new Set();
  let best = [];
  let bestScore = 0;
  for (const entry of entries) {
    let score = 0;
    for (const name of namesOf(entry)) {
      const whole = skeleton(name);
      if (whole.length >= 3 && keys.has(whole)) score = Math.max(score, whole.length * 2);
      const parts = words(name).map((word) => [skeleton(word), [...word].length]);
      const matched = parts
        .filter(([part, letters]) => (part.length >= 3 ? keys.has(part) : part.length === 2 && letters >= 4 && shortKeys.has(part)))
        .map(([part]) => part);
      score = Math.max(score, matched.reduce((sum, part) => sum + part.length, 0));
    }
    if (score === 0) continue;
    if (score > bestScore) {
      best = [entry];
      bestScore = score;
    } else if (score === bestScore) {
      best.push(entry);
    }
  }
  return best;
}

function matchLocations(text, directory, organizationId) {
  const scope = organizationId ? directory.locations.filter((location) => location.organizationId === organizationId) : directory.locations;
  // Email-like names ("x@shreeji.local") would match everyday words such as "सारे डेज" ≈ "shreeji".
  const plain = (value) => String(value || '').replace(/\S*@\S*/g, ' ');
  return bestMatches(text, scope, (location) => [location.workName, location.name, location.address.split(',')[0]].map(plain));
}

function matchOrganizations(text, directory) {
  return bestMatches(text, directory.organizations, (organization) => [organization.name]);
}

async function findEmployees(user, text, { organizationId, locationId, exactName } = {}) {
  const filter = { organizationId: { $ne: null } };
  if (user.role !== 'admin') filter.organizationId = user.id;
  else if (organizationId) filter.organizationId = organizationId;
  if (locationId) filter.locationId = locationId;
  const employees = await Employee.find(filter)
    .select('_id name parentName organizationId locationId designation status')
    .limit(5000)
    .lean();
  const entries = employees.map((employee) => ({
    id: String(employee._id),
    name: employee.name,
    parentName: employee.parentName || '',
    organizationId: employee.organizationId ? String(employee.organizationId) : '',
    locationId: employee.locationId ? String(employee.locationId) : '',
    designation: employee.designation || '',
    status: employee.status,
  }));
  if (exactName) {
    const target = skeleton(exactName);
    const exact = entries.filter((employee) => skeleton(employee.name) === target);
    if (exact.length > 0) return exact;
  }
  return bestMatches(text, entries, (employee) => [employee.name], { shortNames: true });
}

const SYSTEM_PROMPT = `# SHREEJI AI – STRICT RESPONSE RULES

You are Shreeji (श्रीजी), the AI Assistant of Shreeji Caretaker. You speak as a woman.
Reply in the same language the user used: English → English, Hindi/Hinglish/Devanagari → Hindi ("करती हूँ", "सकती हूँ").
Never call yourself ChatGPT, Ollama, OpenAI, Gemini, DeepSeek or any other AI brand, and never change the company name.

## Identity answers (use intent "chat", reply exactly; match the user's language)
- "Who are you?" → "I'm Shreeji, the AI Assistant of Shreeji Caretaker."
- "तुम कौन हो?" → "मैं श्रीजी हूँ, Shreeji Caretaker की AI Assistant।"
- "What is your name?" → "My name is Shreeji."
- "तुम्हारा नाम क्या है?" → "मेरा नाम श्रीजी है।"
- "Who are you working for?" → "I am the AI Assistant for Shreeji Caretaker."
- "तुम किस कंपनी के लिए काम करती हो?" → "मैं Shreeji Caretaker के लिए काम करती हूँ।"

## Strict short answer rule
- Answer ONLY what the user asks, as short as possible while fully answering it. One sentence when one sentence is enough.
- Never give a full introduction, list capabilities, explain what you can do, add examples, greetings, conclusions, suggestions or promotional lines unless the user asks.
- Do not repeat your introduction or the user's question.

## Examples
User: Hi → Hello! 😊
User: नमस्ते → नमस्ते! 😊
User: Who are you? → I'm Shreeji, the AI Assistant of Shreeji Caretaker.
User: तुम्हारा नाम क्या है? → मेरा नाम श्रीजी है।
User: Can you create a salary slip? → Yes, I can help you create a Salary Slip.   (intent "chat": a yes/no question about ability, not a request)
User: Could you generate the payroll of all employees? → intent "document", type "payroll", employeeName null (this is a request, not a yes/no ability question)
User: तुम क्या-क्या कर सकती हो? → मैं HR, Payroll, Attendance और Document Management से जुड़े कामों में मदद कर सकती हूँ।
User: What can you do for me? → I can help with HR, Payroll, Attendance and Document Management.
User: Thanks → You're welcome! 😊

## Other rules
- Understand Hindi, English and Hinglish (often via speech-to-text, so words may be misspelled or in Devanagari). "pahalvan" / "petrol" often mean payroll.
- Never claim an action is completed; the dashboard confirms downloads itself.
- Never invent employee information, attendance, salary or document records. Only use the organizations and locations listed below.
- Ask a short question when a request is incomplete or ambiguous. You cannot change the database.

## Task
Understand which document the user wants and reply ONLY with one JSON object, no markdown.

Documents you can produce:
- "salary_slip": salary slips for one employee or all employees (PDF; Excel gives a payroll sheet of those people).
- "payroll": payroll sheet with wages, bonus, EPF, ESI and net pay per employee.
- "wage_register": the FORM XVII wage register of one location ("wages sheet"; speech-to-text often writes it as "veggies sheet").
- "attendance_register": the FORM XVI attendance register / attendance history of one location for a month (optionally one employee).

JSON shape:
{
  "intent": "document" | "chat",
  "type": "salary_slip" | "payroll" | "wage_register" | "attendance_register" | null,
  "month": "YYYY-MM" | null,
  "format": "pdf" | "excel" | null,
  "organizationId": string | null,   // only an id from the ORGANIZATIONS list
  "locationId": string | null,       // only an id from the LOCATIONS list
  "employeeName": string | null,     // a person's name exactly as the user said it, null for all employees
  "reply": string                    // the shortest complete answer, following the strict rules above
}

Rules:
- Resolve relative months ("this month", "is mahine", "pichle mahine", "October") against TODAY. A month name without a year means the most recent such month that is not in the future.
- Match location and organization names loosely (spelling, Devanagari, spaces). Leave them null when the user did not mention one.
- Use "chat" only for greetings or questions that are not a document request; answer them in "reply" using the DATA SUMMARY.
- Questions like "how many organizations / locations / employees" or "which organizations do I have" are "chat": answer in one short sentence from the ORGANIZATIONS and LOCATIONS lists and the DATA SUMMARY, e.g. "आपके dashboard में 2 organizations हैं।"
- Never invent ids, numbers or names.`;

function directoryPrompt(directory, today) {
  const organizations = directory.organizations.slice(0, 200).map((organization) => `${organization.id} | ${organization.name}`).join('\n');
  const locations = directory.locations.slice(0, 400)
    .map((location) => `${location.id} | ${location.workName} | ${location.name} | org: ${location.organizationName}`)
    .join('\n');
  return `TODAY: ${today}\n\nORGANIZATIONS (id | name):\n${organizations || '(none)'}\n\nLOCATIONS (id | work name | site | organization):\n${locations || '(none)'}`;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function askModel(message, history, directory, today, summary) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) return { error: 'OLLAMA_API_KEY is not set.' };
  if (Date.now() < modelPausedUntil) return { error: 'Model paused after a billing or auth error.', quiet: true };
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'deepseek-v4.1-flash';
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: `${directoryPrompt(directory, today)}\n\nDATA SUMMARY:\n${summary}` },
          ...history,
          { role: 'user', content: message },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if ([401, 402, 403].includes(response.status)) modelPausedUntil = Date.now() + MODEL_PAUSE_MS;
      return { error: `Ollama ${response.status}: ${body.slice(0, 200)}` };
    }
    const data = await response.json();
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '');
    return parsed ? { result: parsed } : { error: 'The model did not return JSON.' };
  } catch (error) {
    return { error: error.name === 'TimeoutError' ? 'The model timed out.' : error.message };
  }
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-MAX_HISTORY)
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

async function dataSummary(user, directory) {
  const match = user.role === 'admin' ? { organizationId: { $ne: null } } : { organizationId: new mongoose.Types.ObjectId(user.id) };
  const counts = await Employee.aggregate([
    { $match: { ...match, status: { $ne: 'disabled' } } },
    { $group: { _id: '$locationId', count: { $sum: 1 } } },
  ]);
  const byLocation = new Map(counts.map((row) => [String(row._id), row.count]));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const lines = directory.locations.slice(0, 150).map((location) => `${location.workName} (${location.organizationName}): ${byLocation.get(location.id) || 0} active employees`);
  return `Organizations: ${directory.organizations.length}. Locations: ${directory.locations.length}. Active employees: ${total}.\n${lines.join('\n')}`;
}

function choice(label, plan) {
  return { label, plan };
}

/** Short replies used when the model is unavailable; checked in order, so "who are you working for" wins over "who are you". */
const SMALL_TALK = [
  {
    words: ['working for', 'work for'],
    reply: 'मैं Shreeji Caretaker के लिए AI Assistant हूँ।',
    replyEn: 'I am the AI Assistant for Shreeji Caretaker.',
  },
  {
    words: ['which company', 'your company', 'company name', 'company ka naam', 'kis company', 'kis kampani', 'kampani', 'किस कंपनी', 'किस कम्पनी', 'कंपनी', 'कम्पनी'],
    reply: 'मैं Shreeji Caretaker के लिए काम करती हूँ।',
    replyEn: 'I work for Shreeji Caretaker.',
  },
  {
    words: ['your name', 'naam kya', 'nam kya', 'tumhara naam', 'aapka naam', 'apka naam', 'tera naam', 'नाम क्या', 'तुम्हारा नाम', 'आपका नाम', 'तेरा नाम'],
    reply: 'मेरा नाम श्रीजी है।',
    replyEn: 'My name is Shreeji.',
  },
  {
    words: ['who are you', 'introduce', 'about you', 'kaun ho', 'kon ho', 'kaun hai', 'parichay', 'कौन हो', 'कौन है', 'कौन हैं', 'परिचय'],
    reply: 'मैं श्रीजी हूँ, Shreeji Caretaker की AI Assistant।',
    replyEn: "I'm Shreeji, the AI Assistant of Shreeji Caretaker.",
  },
  {
    words: [
      'english samajhte', 'english samajhti', 'english samajh', 'speak english', 'understand english', 'know english',
      'english mein', 'in english', 'angrezi', 'अंग्रेजी', 'इंग्लिश',
    ],
    reply: 'हाँ, मैं English और Hindi दोनों समझती हूँ। English में भी पूछ सकते हैं।',
    replyEn: 'Yes, I understand English and Hindi. You can ask me in English too.',
  },
  {
    words: ['what can you do', 'what all can you do', 'kya kar sakti', 'kya kya kar', 'kya-kya kar', 'क्या कर सकती', 'क्या-क्या कर', 'क्या क्या कर'],
    reply: 'मैं HR, Payroll, Attendance और Document Management से जुड़े कामों में मदद कर सकती हूँ।',
    replyEn: 'I can help with HR, Payroll, Attendance and Document Management.',
  },
  {
    words: ['thanks', 'thank you', 'thank u', 'thx', 'shukriya', 'dhanyavad', 'dhanyawad', 'धन्यवाद', 'शुक्रिया', 'थैंक्स', 'थैंक यू'],
    reply: 'आपका स्वागत है! 😊',
    replyEn: "You're welcome! 😊",
  },
  {
    words: ['hello', 'hi', 'hey', 'hii', 'namaste', 'namaskar', 'नमस्ते', 'नमस्कार', 'हेलो', 'हैलो', 'हाय', 'राम राम', 'जय श्री कृष्ण'],
    reply: 'नमस्ते! 😊',
    replyEn: 'Hello! 😊',
  },
];

const ABILITY_WORDS = ['can you', 'could you', 'are you able', 'sakti ho', 'sakte ho', 'sakti hai', 'सकती हो', 'सकते हो', 'सकती हैं', 'सकती है'];
const HELP_REPLY_HI = 'माफ़ कीजिए, मैं समझ नहीं पाई। आपको कौन-सा document चाहिए?';
const HELP_REPLY_EN = "Sorry, I didn't catch that. Which document do you need?";
const HELP_REPLY = HELP_REPLY_HI;

function helpReply(lang) {
  return say(lang, HELP_REPLY_HI, HELP_REPLY_EN);
}

function smallTalkReply(entry, lang) {
  return say(lang, entry.reply, entry.replyEn || entry.reply);
}

const COUNT_WORDS = ['how many', 'number of', 'count', 'total', 'kitne', 'kitni', 'kitna', 'कितने', 'कितनी', 'कितना', 'कुल'];
const LIST_WORDS = ['which', 'list', 'names', 'name of', 'kaun kaun', 'kon kon', 'kaun-kaun', 'naam batao', 'कौन कौन', 'कौन-कौन', 'कौन से', 'कौनसे', 'नाम बताओ', 'नाम बताइए', 'नाम बताएं', 'लिस्ट', 'सूची'];
const DATA_TOPICS = [
  // "एंपलॉयर/employer" is common STT for "employee" — keep as topic words, never as person names.
  ['employee', ['employee', 'employees', 'employer', 'staff', 'worker', 'workers', 'karmachari', 'एम्प्लॉई', 'एम्प्लोई', 'इम्प्लॉई', 'एंप्लॉई', 'एम्पलाई', 'एम्प्लॉय', 'एंपलॉयर', 'एम्पलॉयर', 'एम्प्लॉयर', 'एम्पल', 'एंपल', 'एम्प्ल', 'एंप्ल', 'इम्पल', 'इंपल', 'इम्प्ल', 'कर्मचारी', 'स्टाफ', 'वर्कर', 'लोग']],
  ['location', ['location', 'locations', 'site', 'sites', 'लोकेशन', 'लोकेशंस', 'लोकेशन्स', 'साइट', 'साइट्स']],
  ['organization', ['organization', 'organizations', 'organisation', 'organisations', 'org', 'orgs', 'client', 'clients', 'company', 'companies', 'ऑर्गेनाइजेशन', 'ऑर्गनाइजेशन', 'ऑर्गेनाइज़ेशन', 'आर्गेनाइजेशन', 'ऑर्गेनाइजेशंस', 'संगठन', 'क्लाइंट', 'कंपनियां', 'कंपनियाँ', 'कंपनी']],
];
const MAX_LISTED = 15;
const MAX_EMPLOYEE_LIST = 50;

function counted(count, noun, lang = 'hi') {
  const word = count === 1 ? noun : `${noun}s`;
  // Avoid "employee है" / "employees हैं" — localizeAnswer used to turn those into "हैs हैं हैं".
  if (lang === 'en') return `${count} ${word}`;
  return `${count} ${word}`;
}

const NOT_PERSON_NAMES = new Set([
  'employee', 'employees', 'employer', 'staff', 'worker', 'workers', 'list', 'names', 'name', 'naam',
  'एम्प्लॉई', 'एम्प्लोई', 'एम्पलाई', 'एंप्लॉई', 'एंपलॉयर', 'एम्पलॉयर', 'एम्प्लॉयर', 'कर्मचारी', 'स्टाफ', 'नाम',
]);

function isNameToken(word) {
  if (!word || COMMON_WORDS.has(word) || NOT_PERSON_NAMES.has(word) || NOT_PERSON_NAMES.has(word.toLowerCase())) return false;
  if (DATA_TOPICS[0][1].some((stem) => word === stem || (stem.length >= 4 && word.includes(stem)))) return false;
  const key = skeleton(word);
  // "पूजा" → pj, "सुबह/Subba" → sb — two-letter skeletons still count as names.
  return key.length >= 2 || [...word].length >= 2;
}

/** Person names only — skips d→r so "Dahal" does not equal "Rahul". */
function personSkeleton(text) {
  return transliterate(text)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/h/g, '')
    .replace(/x/g, 'ks')
    .replace(/[cq]/g, 'k')
    .replace(/w/g, 'v')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '');
}

// Speech/typing variants that should compare equal to the real surname.
const NAME_ALIASES = new Map([
  [personSkeleton('सुबह'), personSkeleton('subba')],
  [personSkeleton('सुभ'), personSkeleton('subba')],
  [personSkeleton('सभा'), personSkeleton('subba')],
  [personSkeleton('सुबा'), personSkeleton('subba')],
  [personSkeleton('सुब्बा'), personSkeleton('subba')],
  [personSkeleton('नींबू'), personSkeleton('limbu')],
  [personSkeleton('निम्बू'), personSkeleton('limbu')],
  [personSkeleton('निम्बु'), personSkeleton('limbu')],
  [personSkeleton('लिम्बू'), personSkeleton('limbu')],
]);

function nameKey(word) {
  const key = personSkeleton(word);
  return NAME_ALIASES.get(key) || key;
}

function personMessageKeys(text) {
  const list = words(text);
  const keys = new Set();
  list.forEach((word, index) => {
    keys.add(nameKey(word));
    if (index + 1 < list.length) keys.add(nameKey(word + list[index + 1]));
  });
  keys.delete('');
  return keys;
}

function listText(names) {
  const shown = names.slice(0, MAX_LISTED).join(', ');
  return names.length > MAX_LISTED ? `${shown} (+${names.length - MAX_LISTED} और)` : shown;
}

const ATTENDANCE_WORDS = ['attendance', 'attendence', 'atendance', 'hajiri', 'haziri', 'hajri', 'अटेंडेंस', 'अटेंडन्स', 'अटेंडेन्स', 'हाजिरी', 'हाज़िरी', 'हाजरी', 'उपस्थिति'];
const PENDING_WORDS = [
  'pending', 'baki', 'baaki', 'remaining', 'not marked', 'unmarked', 'marked', 'complete', 'completed', 'done',
  'lagi ya nahi', 'lagai ya nahi', 'lagi hai ya nahi', 'nahi lagi', 'nahi lagai', 'lagni', 'lagana', 'lagani', 'puri', 'poori', 'mark hui', 'kitne ki', 'kitni ki',
  'पेंडिंग', 'बाकी', 'बाक़ी', 'बकाया', 'लगी या नहीं', 'लगाई या नहीं', 'लगी है या नहीं', 'नहीं लगी', 'नहीं लगाई', 'नहीं लगा', 'लगनी', 'लगाना', 'लगानी', 'पूरी', 'मार्क', 'हुई या नहीं', 'कितने की', 'कितनी की',
];
const DONE_WORDS = [
  'lag chuki', 'lag gayi', 'lag gai', 'lag gyi', 'lagi hai', 'lag chuka', 'ho chuki', 'ho gayi', 'ho gai', 'completed', 'complete', 'done', 'marked',
  'लग चुकी', 'लग गई', 'लग गयी', 'लगी है', 'लगा दी', 'लगाई जा चुकी', 'लग चुका', 'हो चुकी', 'हो गई', 'हो गयी', 'पूरी हो', 'पूरी लग', 'कंप्लीट',
];
const NOT_DONE_WORDS = ['pending', 'baki', 'baaki', 'remaining', 'unmarked', 'not marked', 'nahi', 'nahin', 'पेंडिंग', 'बाकी', 'बाक़ी', 'बकाया', 'नहीं'];
const WHICH_LOCATION_WORDS = ['kis kis', 'kin', 'kaun si', 'kon si', 'kaun kaun', 'which', 'kahan', 'kaha', 'status', 'किस किस', 'किस-किस', 'किन', 'कौन सी', 'कौन-सी', 'कौनसी', 'कौन कौन', 'कहाँ', 'कहां', 'स्टेटस'];
const DOCUMENT_REQUEST_WORDS = ['register', 'sheet', 'report', 'download', 'chahiye', 'रजिस्टर', 'शीट', 'रिपोर्ट', 'डाउनलोड', 'चाहिए'];
const STATUS_CONCURRENCY = 8;

function isSundayDate(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * Unmarked working (non-Sunday) days per register. Today is counted separately because the day's attendance is
 * usually marked in the evening, so a location is "complete" when everything up to yesterday is marked.
 */
function pendingFor(register, today) {
  const todayIndex = register.month === today.slice(0, 7) ? Number(today.slice(8, 10)) - 1 : -1;
  const employees = [];
  let days = 0;
  let todayMissing = 0;
  for (const row of register.rows) {
    let missing = 0;
    row.days.slice(0, row.workingDays).forEach((mark, index) => {
      if (mark !== '' || isSundayDate(`${register.month}-${String(index + 1).padStart(2, '0')}`)) return;
      if (index === todayIndex) todayMissing += 1;
      else missing += 1;
    });
    if (missing > 0) {
      employees.push(row.name);
      days += missing;
    }
  }
  return { employees, days, todayMissing, total: register.rows.length };
}

/** "Which locations have / haven't marked this month's attendance", answered from the attendance registers. */
async function answerAttendanceStatus(user, message, directory, today, timeZone, out = {}) {
  if (!includesAny(message, ATTENDANCE_WORDS) || parseFormat(message)) return null;
  const asksPending = includesAny(message, PENDING_WORDS);
  const asksDone = includesAny(message, DONE_WORDS);
  const asksWhich = includesAny(message, WHICH_LOCATION_WORDS) && !includesAny(message, DOCUMENT_REQUEST_WORDS);
  if (!asksPending && !asksDone && !asksWhich) return null;
  const wantsDone = asksDone && !includesAny(message, NOT_DONE_WORDS);

  const currentMonth = today.slice(0, 7);
  let month = parseMonth(message, currentMonth) || currentMonth;
  if (month > currentMonth) month = currentMonth;
  const isCurrentMonth = month === currentMonth;
  const period = `${monthLabel(month)}${isCurrentMonth ? ' (कल तक)' : ''}`;

  let organization = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) [organization] = organizations;
  }
  const matchedLocations = matchLocations(message, directory, organization?.id);
  const single = matchedLocations.length === 1 ? matchedLocations[0] : null;
  const locations = single
    ? [single]
    : (matchedLocations.length > 1 ? matchedLocations : directory.locations)
      .filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id));
  if (locations.length === 0) return 'कोई active location नहीं मिली।';

  const results = [];
  for (let index = 0; index < locations.length; index += STATUS_CONCURRENCY) {
    const batch = locations.slice(index, index + STATUS_CONCURRENCY);
    results.push(...await Promise.all(batch.map(async (location) => {
      const register = await getAttendanceRegister(user, { organizationId: location.organizationId, locationId: location.id, month, timeZone });
      return { location, ...pendingFor(register, today) };
    })));
  }

  if (single) {
    const [result] = results;
    const name = locationLabel(single);
    if (result.total === 0) return `${name} पर कोई employee नहीं है।`;
    const todayNote = result.todayMissing ? `\nआज की attendance अभी ${result.todayMissing} employees की नहीं लगी है।` : '';
    if (result.employees.length === 0) return `${name} पर ${period} की attendance पूरी लग चुकी है। ✅${todayNote}`;
    return `${name} पर ${period} की attendance बाकी है: ${result.total} में से ${result.employees.length} employees की कुल ${result.days} दिन की (${listText(result.employees)})।${todayNote}`;
  }

  const showOrganization = user.role === 'admin' && !organization;
  const label = (result) => `${locationLabel(result.location)}${showOrganization ? ` (${result.location.organizationName})` : ''}`;
  const staffed = results.filter((result) => result.total > 0);
  const pending = staffed.filter((result) => result.employees.length > 0);
  const done = staffed.filter((result) => result.employees.length === 0);
  const scope = organization ? `${organization.name} की ` : '';
  const focus = wantsDone ? done : pending;
  out.context = {
    topic: 'attendance_status',
    month,
    locationIds: focus.map((result) => result.location.id),
    title: `${period} की attendance इन ${plural(focus.length, 'location')} पर ${wantsDone ? 'पूरी लग चुकी है' : 'बाकी है'}`,
    items: focus.map((result) => (wantsDone
      ? label(result)
      : `${label(result)} — ${result.employees.length}/${result.total} employees, ${result.days} दिन (${listText(result.employees)})`)),
  };
  const notes = [
    results.length > staffed.length ? `${results.length - staffed.length} locations पर कोई employee नहीं है।` : '',
    isCurrentMonth && staffed.some((result) => result.todayMissing) ? `आज की attendance अभी ${staffed.filter((result) => result.todayMissing).length} locations पर नहीं लगी है।` : '',
  ].filter(Boolean);
  const footer = notes.length ? `\n(${notes.join(' ')})` : '';
  const bullets = (list, line) => {
    const shown = list.slice(0, MAX_LISTED).map((result) => `• ${line(result)}`).join('\n');
    return list.length > MAX_LISTED ? `${shown}\n(+${list.length - MAX_LISTED} और)` : shown;
  };
  if (staffed.length === 0) return `${scope}किसी भी location पर कोई employee नहीं है।`;

  if (wantsDone) {
    if (done.length === 0) return `${scope}किसी भी location पर ${period} की attendance पूरी नहीं लगी है; ${staffed.length} में से ${pending.length} locations पर बाकी है।${footer}`;
    const rest = pending.length ? `\n${pending.length} location${pending.length === 1 ? '' : 's'} पर अभी बाकी है।` : '';
    return `${scope}${staffed.length} में से ${done.length} location${done.length === 1 ? '' : 's'} पर ${period} की attendance पूरी लग चुकी है: ✅\n${bullets(done, label)}${rest}${footer}`;
  }

  if (pending.length === 0) return `${scope}सभी ${staffed.length} locations पर ${period} की attendance पूरी लग चुकी है। ✅${footer}`;
  return `${scope}${staffed.length} में से ${pending.length} location${pending.length === 1 ? '' : 's'} पर ${period} की attendance बाकी है:\n${bullets(pending, (result) => `${label(result)} — ${result.employees.length}/${result.total} employees, ${result.days} दिन`)}${footer}`;
}

const MARK_WORDS = [
  'laga do', 'lagado', 'laga de', 'laga dijiye', 'laga dena', 'lagao', 'lagwa do', 'laga ke de', 'lagake de',
  'mark kar do', 'mark kardo', 'mark karo', 'mark kar de', 'mark karke', 'mark karke de', 'mark karke do', 'mark kar ke',
  'fill kar do', 'bhar do', 'present kar do', 'absent kar do', 'mark all', 'mark attendance', 'mark the attendance', 'fill attendance',
  'लगा दो', 'लगा दे', 'लगा दें', 'लगा दीजिए', 'लगा देना', 'लगाओ', 'लगवा दो', 'लगा के दे', 'लगाकर दे', 'लगा करके',
  'मार्क कर दो', 'मार्क करो', 'मार्क कर दें', 'मार्क करके', 'मार्क कर के', 'मार्क करके दे', 'मार्क करके दो',
  'भर दो', 'प्रेजेंट कर दो', 'प्रेजेंट लगा', 'प्रजेंट मार्क', 'प्रेजेंट मार्क', 'एब्सेंट कर दो', 'करके दे दो', 'कर के दे दो',
];
const ABSENT_WORDS = ['absent', 'apsent', 'abcent', 'एब्सेंट', 'ऐब्सेंट', 'एबसेंट', 'अबसेंट', 'अब्सेंट', 'अपसेंट', 'एपसेंट', 'गैरहाजिर', 'गैरहाज़िर', 'अनुपस्थित', 'gairhajir'];
const STATUS_WORDS = [
  ['paid_leave', ['paid leave', 'pl', 'पेड लीव', 'पेड छुट्टी']],
  ['casual_leave', ['casual leave', 'cl', 'कैजुअल लीव', 'कैज़ुअल लीव', 'कैजुअल']],
  ['sick_leave', ['sick leave', 'sl', 'सिक लीव', 'बीमारी की छुट्टी']],
  ['half_day', ['half day', 'halfday', 'half', 'हाफ डे', 'हाफ', 'आधा दिन', 'आधे दिन']],
  ['weekly_off', ['weekly off', 'week off', 'weekoff', 'वीकली ऑफ', 'वीक ऑफ']],
  ['holiday', ['holiday', 'हॉलिडे', 'होलीडे', 'हॉलीडे', 'अवकाश']],
  ['leave', ['leave', 'chhutti', 'chutti', 'लीव', 'छुट्टी']],
  ['absent', ABSENT_WORDS],
  ['present', ['present', 'prasent', 'parsent', 'persent', 'परसेंट', 'पर्सेंट', 'प्रसेंट', 'परेजेंट', 'प्रेजेंट', 'प्रेज़ेंट', 'प्रजेंट', 'परजेंट', 'प्रेसेंट', 'हाजिर लगा', 'हाज़िर लगा']],
];
const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  leave: 'Leave',
  paid_leave: 'Paid Leave',
  casual_leave: 'Casual Leave',
  sick_leave: 'Sick Leave',
  weekly_off: 'Weekly Off',
  holiday: 'Holiday',
};
const CODE_STATUS = Object.fromEntries(Object.entries(STATUS_CODES).map(([status, code]) => [code, status]));
const VERB_WORDS = [
  'karo', 'kar do', 'kardo', 'kar de', 'kar dijiye', 'kr do', 'krdo', 'kro', 'set', 'make', 'mark', 'laga', 'lagao', 'lga do',
  'करो', 'कर दो', 'कर दें', 'कर दे', 'कर दीजिए', 'करना', 'कीजिए', 'लगा', 'लगाओ', 'मार्क', 'सेट',
];
const EDIT_WORDS = ['edit', 'change', 'update', 'correct', 'badal', 'badlo', 'sudhar', 'एडिट', 'चेंज', 'अपडेट', 'बदल', 'बदलो', 'सुधार', 'सही कर'];
const FULL_MONTH_WORDS = ['पूरे महीने', 'पूरा महीना', 'पूरे मंथ', 'poore mahine', 'pure mahine', 'pura mahina', 'poora mahina', 'full month', 'whole month', 'entire month'];
const DATE_ANCHORS = ['तारीख', 'तारीख़', 'तारिख', 'तारीक', 'तिथि', 'tarikh', 'tareekh', 'tarik', 'tareek', 'date', 'dates'];
const RANGE_JOINERS = ['से', 'se', 'to', 'till', 'tak', 'तक'];
const LIST_JOINERS = ['और', 'aur', 'and', ',', 'व'];
const DAY_WORDS = ['दिन', 'दिनों', 'din', 'day', 'days'];
const NUMBER_WORDS = {
  'एक': 1, ek: 1, one: 1, 'दो': 2, two: 2, 'तीन': 3, teen: 3, three: 3, 'चार': 4, char: 4, chaar: 4, four: 4,
  'पांच': 5, 'पाँच': 5, panch: 5, paanch: 5, five: 5, 'छह': 6, 'छः': 6, chhe: 6, six: 6, 'सात': 7, saat: 7, seven: 7,
  'आठ': 8, aath: 8, eight: 8, 'नौ': 9, nau: 9, nine: 9, 'दस': 10, das: 10, ten: 10,
};
const MAX_EDIT_LINES = 10;

function parseStatus(text) {
  return STATUS_WORDS.find(([, list]) => includesAny(text, list))?.[0] || null;
}

function dayLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function weekdayLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function shiftDate(date, delta) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dateTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(/(\d)\s*[-–]\s*(\d)/g, '$1 se $2')
    .replace(/,/g, ' , ')
    .split(/[\s?!.()"'।]+/)
    .filter(Boolean);
}

function dayNumber(token) {
  const match = token.match(/^(\d{1,2})(st|nd|rd|th|वीं|वी|वां)?$/);
  const value = match ? Number(match[1]) : 0;
  return value >= 1 && value <= 31 ? value : 0;
}

function isMonthToken(token) {
  return MONTHS.some((names) => names.includes(token));
}

/** Days of the month named in the text: "5 तारीख", "5, 6 और 7 nov", "5 से 10 तारीख", "आज", "कल". */
function parseDates(text, month, today) {
  const tokens = dateTokens(text);
  const dates = new Set();
  if (tokens.some((token) => ['आज', 'aaj', 'today'].includes(token))) dates.add(today);
  if (tokens.some((token) => ['कल', 'kal', 'yesterday'].includes(token))) dates.add(shiftDate(today, -1));
  if (tokens.some((token) => ['परसों', 'parso', 'parson'].includes(token))) dates.add(shiftDate(today, -2));

  const lastDay = daysInMonth(month);
  const readRun = (run) => {
    let rangeStart = 0;
    let previous = 0;
    for (const token of run) {
      if (RANGE_JOINERS.includes(token)) {
        rangeStart = previous;
        continue;
      }
      const day = dayNumber(token);
      if (!day) continue;
      const from = rangeStart && rangeStart < day ? rangeStart + 1 : day;
      for (let value = from; value <= day && value <= lastDay; value += 1) dates.add(`${month}-${String(value).padStart(2, '0')}`);
      previous = day;
      rangeStart = 0;
    }
  };
  const partOfRun = (token) => dayNumber(token) || RANGE_JOINERS.includes(token) || LIST_JOINERS.includes(token);
  tokens.forEach((token, index) => {
    if (!DATE_ANCHORS.includes(token) && !isMonthToken(token)) return;
    let start = index;
    while (start > 0 && partOfRun(tokens[start - 1])) start -= 1;
    if (start < index) {
      readRun(tokens.slice(start, index));
      return;
    }
    let end = index + 1;
    while (end < tokens.length && partOfRun(tokens[end])) end += 1;
    readRun(tokens.slice(index + 1, end));
  });
  return [...dates].sort();
}

/** "एक absent", "2 दिन leave" — how many days the user wants changed when no dates are named. */
function parseCount(text) {
  const tokens = dateTokens(text);
  // "दे दो present" (enrich) / "मार्क करके दे दो" — imperative "do", not the number 2.
  const doVerbs = new Set(['de', 'दे', 'kar', 'कर', 'karke', 'करके', 'laga', 'लगा', 'lagao', 'लगाओ', 'mark', 'मार्क', 'bhar', 'भर', 'fill']);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const prev = tokens[index - 1] || '';
    if (['do', 'doh', 'दो'].includes(token) && doVerbs.has(prev)) continue;
    // "do" is also "give/do it" (laga do), so it only counts right before "din"/a status.
    const value = dayNumber(token) || NUMBER_WORDS[token] || (['do', 'doh'].includes(token) ? 2 : 0);
    if (value && (DAY_WORDS.includes(tokens[index + 1]) || parseStatus(tokens[index + 1]))) return value;
  }
  return null;
}

/** Unmarked working days of a location's register that can be filled; organizations may only mark today. */
async function fillableEntries(user, plan, today, timeZone) {
  const register = await getAttendanceRegister(user, { organizationId: plan.organizationId, locationId: plan.locationId, month: plan.month, timeZone });
  const onlyToday = user.role !== 'admin';
  const entries = [];
  const employees = new Set();
  for (const row of register.rows) {
    if (plan.employeeId && row.employeeId !== plan.employeeId) continue;
    if (row.employeeStatus === 'disabled') continue;
    row.days.slice(0, row.workingDays).forEach((mark, index) => {
      const date = `${plan.month}-${String(index + 1).padStart(2, '0')}`;
      if (mark !== '' || isSundayDate(date) || date > today || (onlyToday && date !== today)) return;
      entries.push({ employeeId: row.employeeId, date, status: plan.status });
      employees.add(row.employeeId);
    });
  }
  return { entries, employees: employees.size, names: register.rows.filter((row) => employees.has(row.employeeId)).map((row) => row.name) };
}

function markPlanFrom(user, location, month, status, employee) {
  return {
    type: 'mark_attendance',
    organizationId: location.organizationId,
    locationId: location.id,
    month,
    status,
    employeeId: employee?.id || null,
  };
}

/** Asks for confirmation before filling the empty attendance days of a location. */
async function previewMarkAttendance(user, plan, directory, today, timeZone) {
  const location = directory.locations.find((item) => item.id === plan.locationId && item.organizationId === plan.organizationId);
  if (!location) throw httpError(404, 'Location not found.');
  const currentMonth = today.slice(0, 7);
  if (user.role !== 'admin' && plan.month !== currentMonth) return { reply: 'Organization login से सिर्फ़ आज की attendance लगाई जा सकती है।' };
  const { entries, employees, names } = await fillableEntries(user, plan, today, timeZone);
  const name = locationLabel(location);
  if (entries.length === 0) {
    return { reply: user.role === 'admin' ? `${name} पर ${monthLabel(plan.month)} की कोई खाली attendance नहीं है।` : `${name} पर आज की attendance पहले से लगी है।` };
  }
  const dates = [...new Set(entries.map((entry) => entry.date))].sort();
  const range = dates.length === 1 ? dayLabel(dates[0]) : `${dayLabel(dates[0])} – ${dayLabel(dates[dates.length - 1])}`;
  const who = plan.employeeId ? names[0] : `${employees} employees`;
  return {
    reply: `${name} पर ${who} के ${entries.length} खाली दिन (${range}, Sunday छोड़कर) ${STATUS_LABELS[plan.status]} मार्क होंगे। पहले से लगी attendance नहीं बदलेगी। Confirm करें?`,
    choices: [
      { label: `हाँ, ${STATUS_LABELS[plan.status]} लगा दो`, plan: { ...plan, confirm: true } },
      { label: 'नहीं, रहने दो', plan: { type: 'cancel' } },
    ],
  };
}

async function confirmMarkAttendance(user, plan, directory, today, timeZone) {
  const location = directory.locations.find((item) => item.id === plan.locationId && item.organizationId === plan.organizationId);
  if (!location) throw httpError(404, 'Location not found.');
  const { entries, employees } = await fillableEntries(user, plan, today, timeZone);
  if (entries.length === 0) return { reply: 'कोई खाली attendance नहीं बची है।' };
  let saved = 0;
  let skipped = 0;
  if (user.role === 'admin') {
    const result = await bulkMarkAttendance(user, { organizationId: plan.organizationId, locationId: plan.locationId, timeZone, entries });
    saved = result.saved + result.updated;
    skipped = result.skippedDuplicates + result.skippedInvalid + result.skippedBlocked + (result.skippedOverLimit || 0);
  } else {
    for (const entry of entries) {
      try {
        await markAttendance(user, { ...entry, locationId: plan.locationId, timeZone });
        saved += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  if (saved === 0) return { reply: `कोई attendance नहीं लगी (${skipped} entries नियमों की वजह से छोड़ी गईं)।` };
  const skippedNote = skipped ? ` ${skipped} entries छोड़ी गईं (joining date, block या महीने की limit की वजह से)।` : '';
  return { reply: `✅ ${locationLabel(location)} पर ${employees} employees की ${saved} दिन की attendance ${STATUS_LABELS[plan.status]} मार्क हो गई।${skippedNote}` };
}

/** Preview / confirm Present (etc.) fill across several matched locations at once. */
async function previewMarkAttendanceBatch(user, plan, directory, today, timeZone) {
  const places = (plan.locations || [])
    .map((item) => directory.locations.find((location) => location.id === item.locationId && location.organizationId === item.organizationId))
    .filter(Boolean);
  if (places.length === 0) throw httpError(404, 'Location not found.');
  const currentMonth = today.slice(0, 7);
  if (user.role !== 'admin' && plan.month !== currentMonth) {
    return { reply: 'Organization login से सिर्फ़ आज की attendance लगाई जा सकती है।' };
  }
  const rows = [];
  let totalEntries = 0;
  let totalEmployees = 0;
  for (const location of places) {
    const single = { organizationId: location.organizationId, locationId: location.id, month: plan.month, status: plan.status };
    const { entries, employees } = await fillableEntries(user, single, today, timeZone);
    if (entries.length === 0) continue;
    totalEntries += entries.length;
    totalEmployees += employees;
    rows.push(`• ${locationLabel(location)} — ${employees} employees, ${entries.length} खाली दिन`);
  }
  if (totalEntries === 0) {
    return { reply: `इन ${places.length} locations पर ${monthLabel(plan.month)} की कोई खाली attendance नहीं है।` };
  }
  return {
    reply: `${places.length} locations पर ${monthLabel(plan.month)}: ${totalEmployees} employees के ${totalEntries} खाली दिन ${STATUS_LABELS[plan.status]} मार्क होंगे। पहले से लगी attendance नहीं बदलेगी।\n${rows.join('\n')}\nConfirm करें?`,
    choices: [
      { label: `हाँ, सभी पर ${STATUS_LABELS[plan.status]} लगा दो`, plan: { ...plan, confirm: true } },
      { label: 'नहीं, रहने दो', plan: { type: 'cancel' } },
    ],
  };
}

async function confirmMarkAttendanceBatch(user, plan, directory, today, timeZone) {
  const places = (plan.locations || [])
    .map((item) => directory.locations.find((location) => location.id === item.locationId && location.organizationId === item.organizationId))
    .filter(Boolean);
  if (places.length === 0) throw httpError(404, 'Location not found.');
  let saved = 0;
  let skipped = 0;
  let touched = 0;
  for (const location of places) {
    const single = { organizationId: location.organizationId, locationId: location.id, month: plan.month, status: plan.status };
    const { entries } = await fillableEntries(user, single, today, timeZone);
    if (entries.length === 0) continue;
    touched += 1;
    if (user.role === 'admin') {
      const result = await bulkMarkAttendance(user, { organizationId: location.organizationId, locationId: location.id, timeZone, entries });
      saved += result.saved + result.updated;
      skipped += result.skippedDuplicates + result.skippedInvalid + result.skippedBlocked + (result.skippedOverLimit || 0);
    } else {
      for (const entry of entries) {
        try {
          await markAttendance(user, { ...entry, locationId: location.id, timeZone });
          saved += 1;
        } catch {
          skipped += 1;
        }
      }
    }
  }
  if (saved === 0) return { reply: `कोई attendance नहीं लगी${skipped ? ` (${skipped} entries छोड़ी गईं)` : ''}।` };
  const skippedNote = skipped ? ` ${skipped} entries छोड़ी गईं।` : '';
  return { reply: `✅ ${touched} locations पर ${saved} दिन की attendance ${STATUS_LABELS[plan.status]} मार्क हो गई।${skippedNote}` };
}

const PLURAL_LOCATION_WORDS = ['locations', 'लोकेशंस', 'लोकेशन्स', 'sites', 'साइट्स', 'सारी लोकेशन', 'सभी लोकेशन', 'wali locations', 'वाली लोकेशन', 'वाली लोकेशंस'];

/** "Mark everyone's attendance at <location> for <month>" — previews first; nothing is saved until the user confirms. */
async function answerMarkAttendance(user, message, directory, today) {
  const hasMark = includesAny(message, MARK_WORDS)
    || (parseStatus(message) && includesAny(message, ALL_WORDS) && includesAny(message, ['mark', 'मार्क', 'लगा', 'करो', 'कर दो', 'दे दो']));
  if (!hasMark || !(includesAny(message, ATTENDANCE_WORDS) || parseStatus(message))) return null;
  if (parseFormat(message) || includesAny(message, DOCUMENT_REQUEST_WORDS)) return null;
  const currentMonth = today.slice(0, 7);
  let month = parseMonth(message, currentMonth) || currentMonth;
  if (month > currentMonth) month = currentMonth;
  const status = parseStatus(message) || 'present';

  let organization = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) [organization] = organizations;
  }
  let matches = matchLocations(message, directory, organization?.id).filter((item) => item.status !== 'disabled');
  // "पिराना … वाली लोकेशंस" with no site name hit → all active locations of that organization.
  if (matches.length === 0 && organization) {
    matches = directory.locations.filter((item) => item.status !== 'disabled' && item.organizationId === organization.id);
  }
  const wantsAllPlaces = matches.length > 1 && (
    includesAny(message, PLURAL_LOCATION_WORDS)
    || (includesAny(message, ALL_WORDS) && includesAny(message, DATA_TOPICS[1][1]))
  );
  if (matches.length !== 1) {
    const options = (matches.length > 1 ? matches : directory.locations.filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id)))
      .slice(0, MAX_CHOICES);
    if (options.length === 0) return { reply: 'कोई active location नहीं मिली।' };
    if (wantsAllPlaces && matches.length > 1) {
      return {
        reply: `${matches.length} locations मिलीं — ${monthLabel(month)} की attendance ${STATUS_LABELS[status]} किन पर लगानी है?`,
        choices: [
          ...matches.slice(0, MAX_CHOICES - 1).map((item) => ({
            label: user.role === 'admin' ? `${locationLabel(item)} · ${item.organizationName}` : locationLabel(item),
            plan: markPlanFrom(user, item, month, status),
          })),
          {
            label: `ये सभी ${matches.length} locations`,
            plan: {
              type: 'mark_attendance_batch',
              month,
              status,
              locations: matches.map((item) => ({ organizationId: item.organizationId, locationId: item.id })),
            },
          },
        ],
      };
    }
    return {
      reply: `किस location पर ${monthLabel(month)} की attendance ${STATUS_LABELS[status]} लगानी है?`,
      choices: options.map((item) => ({
        label: user.role === 'admin' ? `${locationLabel(item)} · ${item.organizationName}` : locationLabel(item),
        plan: markPlanFrom(user, item, month, status),
      })),
    };
  }
  const [location] = matches;

  let employee = null;
  if (!includesAny(message, ALL_WORDS)) {
    const locationKeys = new Set([location.workName, location.name].flatMap(words).map(skeleton));
    const text = words(message).filter((word) => !locationKeys.has(skeleton(word))).join(' ');
    const employees = await findEmployees(user, text, { organizationId: location.organizationId, locationId: location.id });
    if (employees.length === 1) [employee] = employees;
  }
  return { location, plan: markPlanFrom(user, location, month, status, employee) };
}

function editPlanFrom(location, month, fields = {}) {
  return {
    type: 'edit_attendance',
    organizationId: location.organizationId,
    locationId: location.id,
    month,
    employeeId: fields.employeeId || null,
    status: fields.status || null,
    dates: fields.dates || [],
    count: fields.count || null,
    restStatus: fields.restStatus || null,
  };
}

const REST_WORDS = [
  'baki sab', 'baaki sab', 'baki sare', 'baaki sare', 'baki sari', 'baki din', 'baaki din', 'baki ke din', 'bache din', 'bache hue',
  'rest of', 'rest days', 'remaining days', 'other days',
  'बाकी सब', 'बाक़ी सब', 'बाकी सारे', 'बाकी सारी', 'बाकी के', 'बाकी दिन', 'बाक़ी दिन', 'बचे हुए', 'बचे दिन', 'बाकी में',
];

const SUBSET_WORDS = [
  'unmen se', 'unme se', 'unmein se', 'unmain se', 'inmen se', 'inme se', 'inmein se', 'usme se', 'usmen se', 'usmein se', 'jinme se', 'of them', 'out of them', 'among them',
  'उनमें से', 'उनमे से', 'उनमें सें', 'इनमें से', 'इनमे से', 'उसमें से', 'उसमे से', 'जिनमें से',
];
const RANDOM_WORDS = ['random', 'randomly', 'rendom', 'रैंडम', 'रेंडम', 'रैंडमली', 'रेंडमली', 'koi bhi', 'kisi bhi', 'कोई भी', 'किसी भी', 'khud se', 'खुद से', 'apne aap', 'अपने आप', 'tum hi', 'तुम ही', 'aap hi', 'आप ही'];

function firstIndexOf(lower, phrases) {
  let at = -1;
  for (const phrase of phrases) {
    const index = lower.indexOf(phrase);
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  return at;
}

/**
 * "3 absent और बाकी सब present" / "सारी present, उनमें से 2 absent" → the part naming the few days,
 * and the status for every other working day.
 */
function splitRest(message) {
  const lower = message.toLowerCase();
  const subsetAt = firstIndexOf(lower, SUBSET_WORDS);
  if (subsetAt >= 0) {
    const before = message.slice(0, subsetAt);
    const restStatus = includesAny(before, PRESENT_WORDS) ? 'present' : parseStatus(before);
    if (restStatus) return { primary: message.slice(subsetAt), restStatus };
  }
  const at = firstIndexOf(lower, REST_WORDS);
  if (at < 0) return { primary: message, restStatus: null };
  const after = message.slice(at);
  return { primary: message.slice(0, at), restStatus: includesAny(after, PRESENT_WORDS) ? 'present' : parseStatus(after) || 'present' };
}

function randomDates(dates, count) {
  const pool = [...dates];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  return pool.slice(0, count).sort();
}

/** Working days of the month up to today (Sundays left as they are). */
function workingDatesOf(month, today) {
  const lastDay = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(month);
  const dates = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    if (!isSundayDate(date) && date <= today) dates.push(date);
  }
  return dates;
}

function statusText(code) {
  return code ? STATUS_LABELS[CODE_STATUS[code]] || code : 'खाली';
}

/** Register rows the plan targets, plus each target date's allowed/skipped state. */
async function editTargets(user, plan, today, timeZone) {
  const register = await getAttendanceRegister(user, { organizationId: plan.organizationId, locationId: plan.locationId, month: plan.month, timeZone });
  const rows = register.rows.filter((row) => row.employeeStatus !== 'disabled' && (!plan.employeeId || row.employeeId === plan.employeeId));
  const valid = [];
  const skipped = [];
  for (const date of plan.dates) {
    if (isSundayDate(date) || date > today || (user.role !== 'admin' && date !== today)) skipped.push(date);
    else valid.push(date);
  }
  const named = new Set(valid);
  const targets = plan.restStatus ? workingDatesOf(plan.month, today) : valid;
  const statusOn = (date) => (named.has(date) ? plan.status : plan.restStatus);
  const changes = [];
  let unchanged = 0;
  for (const row of rows) {
    for (const date of targets) {
      const status = statusOn(date);
      const current = row.days[Number(date.slice(8, 10)) - 1] || '';
      if (current === STATUS_CODES[status]) unchanged += 1;
      else changes.push({ employeeId: row.employeeId, name: row.name, date, current, status });
    }
  }
  return { rows, valid, skipped, changes, unchanged, targets };
}

/** Shows what will change (old → new) and asks before saving; asks for the status or dates first when missing. */
async function previewEditAttendance(user, requested, directory, today, timeZone) {
  // Organizations can only change today, so "बाकी सब दिन" does not apply to them.
  const plan = requested.restStatus && user.role !== 'admin' ? { ...requested, restStatus: null } : requested;
  const restNote = plan.restStatus ? ` (बाकी सभी working days ${STATUS_LABELS[plan.restStatus]} होंगे)` : '';
  const location = directory.locations.find((item) => item.id === plan.locationId && item.organizationId === plan.organizationId);
  if (!location) throw httpError(404, 'Location not found.');
  const place = locationLabel(location);
  const register = await getAttendanceRegister(user, { organizationId: plan.organizationId, locationId: plan.locationId, month: plan.month, timeZone });
  const rows = register.rows.filter((row) => row.employeeStatus !== 'disabled' && (!plan.employeeId || row.employeeId === plan.employeeId));
  if (rows.length === 0) {
    return { reply: plan.employeeId ? `यह employee ${place} के attendance register में नहीं है।` : `${place} पर कोई active employee नहीं है।` };
  }
  const who = plan.employeeId ? rows[0].name : `${place} के सभी ${rows.length} employees`;

  if (!plan.status) {
    return {
      reply: `${who} की attendance में क्या लगाना है?`,
      choices: Object.keys(STATUS_LABELS).filter((status) => status !== 'weekly_off').map((status) => ({ label: STATUS_LABELS[status], plan: { ...plan, status } })),
    };
  }

  if (plan.dates.length === 0) {
    if (user.role !== 'admin') return previewEditAttendance(user, { ...plan, month: today.slice(0, 7), dates: [today] }, directory, today, timeZone);
    const lastDay = plan.month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(plan.month);
    const recent = [];
    for (let day = lastDay; day >= 1 && recent.length < Math.max(MAX_CHOICES - 1, plan.count || 1); day -= 1) {
      const date = `${plan.month}-${String(day).padStart(2, '0')}`;
      if (!isSundayDate(date)) recent.push(date);
    }
    if (recent.length === 0) return { reply: `${monthLabel(plan.month)} में कोई working day नहीं है।` };
    const count = Math.min(plan.count || 1, recent.length);
    // The next message may just be dates or "random", so the pending plan is remembered.
    const context = { topic: 'edit_dates', plan: { ...plan, count } };
    const randomChoice = {
      label: `Random ${count} working ${count === 1 ? 'day' : 'days'}`,
      plan: { ...plan, dates: randomDates(workingDatesOf(plan.month, today), count) },
    };
    if (count > 1) {
      const lastDays = recent.slice(0, count).sort();
      return {
        reply: `${who} की ${monthLabel(plan.month)} की कौन-सी ${count} तारीख़ों पर ${STATUS_LABELS[plan.status]} लगाना है${restNote}? तारीख़ें लिखिए (जैसे "5, 6 तारीख") या चुनिए:`,
        choices: [
          { label: `पिछले ${count} working days (${dayLabel(lastDays[0])} – ${dayLabel(lastDays[lastDays.length - 1])})`, plan: { ...plan, dates: lastDays } },
          randomChoice,
        ],
        context,
      };
    }
    const current = (date) => (plan.employeeId ? ` · अभी ${statusText(rows[0].days[Number(date.slice(8, 10)) - 1])}` : '');
    return {
      reply: `${who} की ${monthLabel(plan.month)} की किस तारीख की attendance ${STATUS_LABELS[plan.status]} करनी है${restNote}? चुनिए या तारीख लिखिए:`,
      choices: [
        ...recent.slice(0, MAX_CHOICES - 2).map((date) => ({ label: `${weekdayLabel(date)}${current(date)}`, plan: { ...plan, dates: [date] } })),
        randomChoice,
      ],
      context,
    };
  }

  const { valid, skipped, changes, unchanged, targets } = await editTargets(user, plan, today, timeZone);
  const skippedNote = skipped.length
    ? `\n(${skipped.map(dayLabel).join(', ')} छोड़ी गई${user.role === 'admin' ? ' — Sunday या आगे की तारीख' : ' — organization login से सिर्फ़ आज की attendance बदल सकती है'}।)`
    : '';
  if (valid.length === 0) return { reply: `इन तारीख़ों पर attendance नहीं बदली जा सकती।${skippedNote}` };
  if (changes.length === 0) {
    return { reply: `${who} की इन तारीख़ों पर पहले से यही attendance लगी है।${skippedNote}` };
  }

  let summary;
  if (plan.restStatus) {
    const restDays = targets.length - valid.length;
    summary = [
      `${who} (${place}) की ${monthLabel(plan.month)} की attendance:`,
      `• ${STATUS_LABELS[plan.status]}: ${valid.length} दिन (${valid.map(dayLabel).join(', ')})`,
      `• ${STATUS_LABELS[plan.restStatus]}: बाकी ${restDays} working days`,
      `Sunday नहीं बदलेंगे। ${changes.length} entries बदलेंगी${unchanged ? `, ${unchanged} पहले से सही हैं` : ''}।`,
    ].join('\n');
  } else if (plan.employeeId) {
    const lines = changes.slice(0, MAX_EDIT_LINES).map((change) => `• ${weekdayLabel(change.date)}: ${statusText(change.current)} → ${STATUS_LABELS[plan.status]}`);
    if (changes.length > MAX_EDIT_LINES) lines.push(`(+${changes.length - MAX_EDIT_LINES} और)`);
    summary = `${who} (${place}) की attendance बदलेगी:\n${lines.join('\n')}`;
  } else {
    const range = valid.length === 1 ? dayLabel(valid[0]) : `${valid.length} दिन, ${dayLabel(valid[0])} – ${dayLabel(valid[valid.length - 1])}`;
    summary = `${who} की ${range} की attendance ${STATUS_LABELS[plan.status]} होगी (${changes.length} बदलाव${unchanged ? `, ${unchanged} पहले से ${STATUS_LABELS[plan.status]}` : ''})।`;
  }
  return {
    reply: `${summary}${skippedNote}\nConfirm करें?`,
    choices: [
      { label: plan.restStatus ? 'हाँ, attendance लगा दो' : `हाँ, ${STATUS_LABELS[plan.status]} कर दो`, plan: { ...plan, dates: valid, confirm: true } },
      { label: 'नहीं, रहने दो', plan: { type: 'cancel' } },
    ],
  };
}

async function confirmEditAttendance(user, requested, directory, today, timeZone) {
  const plan = requested.restStatus && user.role !== 'admin' ? { ...requested, restStatus: null } : requested;
  const location = directory.locations.find((item) => item.id === plan.locationId && item.organizationId === plan.organizationId);
  if (!location) throw httpError(404, 'Location not found.');
  if (!plan.status || plan.dates.length === 0) return previewEditAttendance(user, plan, directory, today, timeZone);
  const { rows, changes } = await editTargets(user, plan, today, timeZone);
  if (changes.length === 0) return { reply: `कुछ बदलना नहीं था — पहले से ${STATUS_LABELS[plan.status]} लगी है।` };
  let saved = 0;
  let skipped = 0;
  const entries = changes.map(({ employeeId, date, status }) => ({ employeeId, date, status, replace: true }));
  if (user.role === 'admin') {
    const result = await bulkMarkAttendance(user, { organizationId: plan.organizationId, locationId: plan.locationId, timeZone, entries });
    saved = result.saved + result.updated;
    skipped = result.skippedDuplicates + result.skippedInvalid + result.skippedBlocked + (result.skippedOverLimit || 0);
  } else {
    for (const entry of entries) {
      try {
        await markAttendance(user, { ...entry, locationId: plan.locationId, timeZone });
        saved += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  const who = plan.employeeId ? rows[0]?.name || 'Employee' : `${locationLabel(location)} के employees`;
  const skippedNote = skipped ? ` ${skipped} entries छोड़ी गईं (joining date, block या महीने की 26 दिन की limit की वजह से)।` : '';
  if (saved === 0) return { reply: `कोई attendance नहीं बदली।${skippedNote}` };
  if (plan.restStatus && user.role === 'admin') {
    const named = changes.filter((change) => change.status === plan.status).length;
    return { reply: `✅ ${who} की ${monthLabel(plan.month)} की attendance लग गई: ${saved} entries बदलीं (${STATUS_LABELS[plan.status]} ${named}, ${STATUS_LABELS[plan.restStatus]} ${changes.length - named})।${skippedNote}` };
  }
  return { reply: `✅ ${who} की ${saved} entries ${STATUS_LABELS[plan.status]} कर दी गईं।${skippedNote}` };
}

/**
 * "Puja Subba की 5 तारीख absent कर दो", "Children's Park पर कल सबकी holiday लगा दो" — changes specific days.
 * Requests without an employee, dates or a count fall through to the fill-empty-days flow.
 */
async function answerEditAttendance(user, message, directory, today) {
  if (parseFormat(message) || includesAny(message, DOCUMENT_REQUEST_WORDS)) return null;
  const { primary, restStatus } = splitRest(message);
  const status = parseStatus(primary) || (restStatus ? null : parseStatus(message));
  const hasAttendance = includesAny(message, ATTENDANCE_WORDS);
  const hasVerb = includesAny(message, VERB_WORDS) || includesAny(message, MARK_WORDS);
  if (!(status && hasVerb) && !(hasAttendance && includesAny(message, EDIT_WORDS))) return null;

  const currentMonth = today.slice(0, 7);
  const relative = parseDates(message.replace(/\d/g, ''), currentMonth, today);
  let month = parseMonth(message, currentMonth) || relative[0]?.slice(0, 7) || currentMonth;
  if (month > currentMonth) month = currentMonth;
  const fullMonth = includesAny(message, FULL_MONTH_WORDS);
  let dates = parseDates(message, month, today).filter((date) => date.startsWith(month));
  if (fullMonth && dates.length === 0) {
    const lastDay = month === currentMonth ? Number(today.slice(8, 10)) : daysInMonth(month);
    dates = Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  }
  const count = dates.length ? null : parseCount(primary);

  let organization = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) [organization] = organizations;
  }
  const locations = matchLocations(message, directory, organization?.id).filter((item) => item.status !== 'disabled');
  let location = locations.length === 1 ? locations[0] : null;

  // "बाकी सब present" is about days, not "all employees".
  const withoutMonthPhrase = FULL_MONTH_WORDS.reduce((text, phrase) => text.replace(phrase, ' '), primary.toLowerCase());
  let employees = [];
  if (!includesAny(withoutMonthPhrase, ALL_WORDS)) {
    const locationKeys = location ? new Set([location.workName, location.name].flatMap(words).map(skeleton)) : new Set();
    const text = words(message).filter((word) => !locationKeys.has(skeleton(word))).join(' ');
    employees = await findEmployees(user, text, { organizationId: location?.organizationId || organization?.id, locationId: location?.id });
    employees = employees.filter((employee) => employee.status !== 'disabled');
    // Attendance needs a location, so unplaced namesakes are not worth asking about.
    const placed = employees.filter((employee) => directory.locations.some((item) => item.id === employee.locationId));
    if (placed.length > 0) employees = placed;
  }

  // "अक्टूबर … सारे employees की present मार्क" → fill-empty mark flow, not "N random days" edit.
  if (employees.length === 0 && dates.length === 0 && !count) return null;
  if (employees.length === 0 && !dates.length && count && includesAny(message, ALL_WORDS) && includesAny(message, MARK_WORDS)) {
    return null;
  }

  if (employees.length > 1) {
    return {
      reply: `${employees.length} employees मिले — किसकी attendance बदलनी है?`,
      choices: employees.slice(0, MAX_CHOICES).map((employee) => {
        const place = directory.locations.find((item) => item.id === employee.locationId);
        return place && {
          label: [employee.name, employee.parentName && `S/O ${employee.parentName}`, locationLabel(place)].filter(Boolean).join(' · '),
          plan: editPlanFrom(place, month, { employeeId: employee.id, status, dates, count, restStatus }),
        };
      }).filter(Boolean),
    };
  }
  const [employee] = employees;
  if (employee) {
    location = directory.locations.find((item) => item.id === employee.locationId) || null;
    if (!location) return { reply: `${employee.name} किसी location पर नहीं है, इसलिए attendance नहीं बदली जा सकती।` };
  }
  if (!location) {
    const options = directory.locations
      .filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id))
      .slice(0, MAX_CHOICES);
    if (options.length === 0) return { reply: 'कोई active location नहीं मिली।' };
    return {
      reply: 'किस location की attendance बदलनी है?',
      choices: options.map((item) => ({
        label: user.role === 'admin' ? `${locationLabel(item)} · ${item.organizationName}` : locationLabel(item),
        plan: editPlanFrom(item, month, { status, dates, count, restStatus }),
      })),
    };
  }
  return { plan: editPlanFrom(location, month, { employeeId: employee?.id, status, dates, count, restStatus }) };
}

const BANK_WORDS = ['bank', 'neft', 'बैंक', 'बेंक', 'एनईएफटी', 'नेफ्ट'];
const BANK_DETAIL_WORDS = [
  'bank detail', 'bank details', 'bank info', 'account detail', 'account details', 'account number', 'ifsc', 'bank account',
  'बैंक डिटेल', 'बैंक डिटेल्स', 'बैंक डीटेल', 'बैंक डीटेल्स', 'बैंक डिटेल्स', 'बैंक जानकारी', 'खाता', 'खाता नंबर', 'अकाउंट', 'आईएफएससी', 'आई एफ एस सी',
];
const PAYROLL_WORDS = [
  'payroll', 'pay roll', 'payrol', 'payrole', 'pay role', 'pairol', 'pairoll', 'perol', 'peroll', 'payarol', 'payerol',
  'पेरोल', 'पे रोल', 'पेरोल्', 'पैरोल', 'पै रोल', 'पेरॉल', 'पैरॉल', 'पेयरोल', 'पेय रोल', 'पे-रोल', 'पेरौल', 'पैरौल',
  // Voice typing often hears "payroll" as petrol / pahalvan / pehelwan.
  'petrol', 'पेट्रोल', 'पैट्रोल', 'pahalvan', 'pahalwan', 'pehalvan', 'pehelwan', 'pehalwan', 'पहलवान', 'पहलवान',
];
const BOTH_WORDS = [
  'both', 'both locations', 'both location', 'dono', 'donon', 'donno', 'dono locations', 'dono location', 'dono lokesh',
  'दोनों', 'दोनोंो', 'दोनों लोकेशन', 'दोनों लोकेशंस', 'दोनों लोकेशन्स', 'दोनों location', 'दोनों locations',
];
const SALARY_WORDS = ['salary', 'salery', 'सैलरी', 'सेलरी', 'वेतन', 'तनख्वाह', 'तनखा', 'tankhwah', 'pagar', 'पगार', 'net pay', 'नेट पे'];
const AMOUNT_WORDS = [
  'kitni', 'kitna', 'kitne', 'कितनी', 'कितना', 'कितने', 'total', 'कुल', 'amount', 'how much', 'राशि', 'टोटल',
  'calculate', 'calculation', 'hisab', 'hisaab', 'कैलकुलेट', 'कैलकुलेशन', 'हिसाब', 'गणना',
];
const RUN_STATUS_WORDS = ['pending', 'baki', 'baaki', 'printed', 'ban chuka', 'ban gaya', 'bana hai', 'exported', 'बाकी', 'बाक़ी', 'पेंडिंग', 'प्रिंट', 'बन चुका', 'बन चुकी', 'बन गया', 'बना है', 'बनी है', 'निकल चुका', 'निकल गया'];
const MAX_RUN_LOCATIONS = 50;
const RUN_KINDS = {
  bank: { type: 'bank_invoice', label: 'Bank invoice', lower: 'bank invoice', thing: 'letter' },
  payroll: { type: 'payroll_run', label: 'Payroll', lower: 'payroll', thing: 'payroll' },
};

const CAN_BE_MADE_WORDS = ['ban sakta', 'ban sakti', 'ban sakte', 'bana sakte', 'bana sakti', 'बन सकता', 'बन सकती', 'बन सकते', 'बना सकते', 'बना सकती', 'बनना है', 'बनाना बाकी', 'banana baki', 'bana sakta', 'ban sake', 'bana sake', 'बना सकता', 'बन सके', 'बना सके', 'बना सकूं', 'बना सकूँ'];
const ORGANIZATION_WORDS = DATA_TOPICS.find(([topic]) => topic === 'organization')[1];

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Bank letter or payroll run, from the words used; salary only counts as payroll in amount questions. */
function asksBankDetails(message) {
  return includesAny(message, BANK_DETAIL_WORDS)
    || (includesAny(message, BANK_WORDS) && includesAny(message, DETAIL_WORDS));
}

function runKindOf(message) {
  if (asksBankDetails(message)) return null;
  if (includesAny(message, BANK_WORDS)) return 'bank';
  if (parseType(message) === 'salary_slip') return null;
  if (includesAny(message, PAYROLL_WORDS)) return 'payroll';
  if (includesAny(message, SALARY_WORDS) && includesAny(message, AMOUNT_WORDS)) return 'payroll';
  return null;
}

/** "How many organizations / which locations can still get a bank invoice / payroll" — pending = has payments, not printed. */
function runStatusReply(kind, data, directory, month, { organization, locations, byOrganization }, out = {}) {
  const { lower } = RUN_KINDS[kind];
  const period = monthLabel(month);
  const ids = locations.length ? new Set(locations.map((item) => item.id)) : null;
  const groups = data.organizations
    .filter((group) => !organization || group.organizationId === organization.id)
    .map((group) => ({ ...group, locations: group.locations.filter((item) => !ids || ids.has(item.locationId)) }))
    .filter((group) => group.locations.length > 0);
  const pendingOf = (group) => group.locations.filter((item) => item.status === 'pending' && item.employees > 0);
  const printedOf = (group) => group.locations.filter((item) => item.status === 'printed');
  const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
  const ready = groups.flatMap(pendingOf);
  out.context = {
    topic: 'run_status',
    kind,
    month,
    locationIds: ready.map((item) => item.locationId),
    title: `${period} में इन ${plural(ready.length, 'location')} का ${lower} बन सकता है`,
    items: ready.map((item) => `${bankLocationName(item, directory)} — ${people(item.employees)}, ${rupees(item.total)}`),
  };

  if (byOrganization) {
    const ready = groups.filter((group) => pendingOf(group).length > 0);
    const done = groups.filter((group) => pendingOf(group).length === 0 && printedOf(group).length > 0);
    const doneText = done.length ? `\n${plural(done.length, 'organization')} का पूरा बन चुका है (${listText(done.map((group) => group.organizationName))})।` : '';
    if (ready.length === 0) return `अभी किसी organization का ${period} का ${lower} बाकी नहीं है।${doneText}`;
    const lines = ready.map((group) => {
      const list = pendingOf(group);
      return `• ${group.organizationName} — ${plural(list.length, 'location')}, ${people(sum(list, 'employees'))}, ${rupees(sum(list, 'total'))}`;
    });
    return `अभी ${plural(ready.length, 'organization')} का ${period} का ${lower} बन सकता है:\n${lines.join('\n')}${doneText}`;
  }

  const pending = groups.flatMap(pendingOf);
  const printed = groups.flatMap(printedOf);
  if (locations.length === 1) {
    const name = locationLabel(locations[0]);
    if (printed.length) return `${name} का ${period} का ${lower} बन चुका है (${printed[0].reference})।`;
    if (pending.length) return `${name} का ${period} का ${lower} अभी नहीं बना — ${people(pending[0].employees)}, ${rupees(pending[0].total)}। बनाना हो तो कहिए "${name} का ${lower} बना दो"।`;
    return `${name} पर ${period} में कोई payment नहीं बनता।`;
  }
  const scope = organization ? `${organization.name} में ` : '';
  const pendingText = pending.length
    ? `${scope}${plural(pending.length, 'location')} का ${lower} बन सकता है:\n${pending.slice(0, MAX_LISTED).map((item) => `• ${bankLocationName(item, directory)} — ${people(item.employees)}, ${rupees(item.total)}`).join('\n')}`
    : `${scope}किसी location का ${lower} बाकी नहीं है।`;
  const printedText = printed.length
    ? `\n${plural(printed.length, 'location')} का बन चुका है (${listText(printed.map((item) => `${bankLocationName(item, directory)} – ${item.reference}`))})।`
    : '';
  return `${period}: ${pendingText}${printedText}`;
}

function people(count) {
  return `${count} employee${count === 1 ? '' : 's'}`;
}

function rupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function runPlan(kind, month, format, fields = {}) {
  return {
    type: RUN_KINDS[kind].type,
    month,
    format,
    organizationId: fields.organizationId || null,
    locationIds: fields.locationIds || [],
    employeeId: fields.employeeId || null,
    batchId: fields.batchId || null,
  };
}

function bankLocationName(location, directory) {
  const known = directory.locations.find((item) => item.id === location.locationId);
  return known ? locationLabel(known) : location.locationName;
}

/** Net payroll figures for one person or a scope of locations, read from the same payroll the Payroll page exports. */
async function payrollAmountReply(user, directory, month, { employee, locations, organization }) {
  const period = monthLabel(month);
  const scopeLocations = (employee
    ? [directory.locations.find((item) => item.id === employee.locationId)]
    : locations.length ? locations : directory.locations.filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id)))
    .filter(Boolean)
    .slice(0, 500);
  if (scopeLocations.length === 0) return 'कोई location नहीं मिली।';
  const payroll = await previewLocationsPayroll(user, { month, locationIds: scopeLocations.map((item) => item.id) });
  const money = (line, key, fallback) => line[key] ?? line[fallback] ?? 0;
  if (employee) {
    const line = payroll.lines.find((item) => String(item.employeeId) === employee.id);
    if (!line) return `${employee.name} का ${period} में कोई payroll नहीं बनता (attendance नहीं है)।`;
    return [
      `${employee.name} · ${period}`,
      `Paid days: ${line.paidDays} (Present ${line.presentDays}${line.halfDays ? `, Half day ${line.halfDays}` : ''}, Absent ${line.absentDays})`,
      `Wages: ${rupees(money(line, 'wages', 'grossPay'))} · Bonus: ${rupees(line.bonus)}`,
      `EPF: ${rupees(line.epf)} · ESI: ${rupees(line.esi)}`,
      `Net payable: ${rupees(money(line, 'netPay', 'grossPay'))}`,
    ].join('\n');
  }
  const scope = locations.length === 1 ? locationLabel(locations[0]) : organization ? organization.name : locations.length ? plural(locations.length, 'location') : 'सभी locations';
  if (payroll.lines.length === 0) return `${scope} पर ${period} में कोई payroll नहीं बनता।`;
  const total = (key, fallback) => payroll.lines.reduce((sum, line) => sum + money(line, key, fallback), 0);
  return `${scope} · ${period}\n${people(payroll.lines.length)} · Total wages ${rupees(total('totalWages', 'grossPay'))}\nEPF ${rupees(total('epf'))} · ESI ${rupees(total('esi'))}\nNet payable: ${rupees(total('netPay', 'grossPay'))}`;
}

const IF_WORDS = ['agar', 'if', 'maan lo', 'man lo', 'suppose', 'अगर', 'मान लो', 'मान लीजिए', 'यदि'];
const ALL_DAYS_WORDS = ['sare', 'sari', 'saare', 'saari', 'all', 'full', 'pura', 'poora', 'pure', 'poore', 'सारे', 'सारी', 'सारा', 'पूरे', 'पूरा', 'पूरी', 'फुल', 'हर दिन', 'रोज़', 'रोज'];
const PRESENT_WORDS = STATUS_WORDS.find(([status]) => status === 'present')[1];

/** "अगर पूरे महीने present रहे तो salary कितनी" — a what-if, not about the saved attendance. */
function asksFullMonth(message) {
  return includesAny(message, PRESENT_WORDS) && (includesAny(message, IF_WORDS) || includesAny(message, ALL_DAYS_WORDS) || includesAny(message, FULL_MONTH_WORDS));
}

function payableDaysIn(month) {
  let days = 0;
  for (let day = 1; day <= daysInMonth(month); day += 1) {
    if (new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00Z`).getUTCDay() !== 0) days += 1;
  }
  return Math.min(MAX_MONTH_WORKING_DAYS, days);
}

/** Salary for a full month present, worked with the same rates and formula as the FORM XVII register; overtime is left out. */
async function fullMonthSalaryReply(employeeId, month) {
  const [employee, settings] = await Promise.all([
    Employee.findById(employeeId).select('name dailySalary basicPay dearnessAllowance epfoApplicable esicApplicable').lean(),
    getSettingsFor('wageRegister', month),
  ]);
  if (!employee) return 'Employee नहीं मिला।';
  const paidDays = payableDaysIn(month);
  const row = wageRegisterRow({
    dailySalary: Number(employee.dailySalary) || 0,
    basicPay: Number(employee.basicPay) || 0,
    dearnessAllowance: Number(employee.dearnessAllowance) || 0,
    epfoApplicable: Boolean(employee.epfoApplicable),
    esicApplicable: Boolean(employee.esicApplicable),
    paidDays,
    overtimeHours: 0,
  }, wageRates(settings));
  if (!row.dailyWage) return `${employee.name} की daily wage set नहीं है, इसलिए salary नहीं निकल सकती।`;
  return [
    `अगर ${employee.name} ${monthLabel(month)} में पूरे महीने present रहें:`,
    `Paid days: ${paidDays} (Sunday छोड़कर; एक महीने में ${MAX_MONTH_WORKING_DAYS} से ज़्यादा नहीं गिने जाते)`,
    `Wages: ${rupees(row.dailyWage)} × ${paidDays} = ${rupees(row.wages)}`,
    `Bonus: ${rupees(row.bonus)} · Total: ${rupees(row.totalWages)}`,
    `EPF: ${rupees(row.epf)} · ESI: ${rupees(row.esi)}`,
    `Net payable: ${rupees(row.grossPayment)} (overtime अलग से जुड़ेगा)`,
  ].join('\n');
}

const TIMES_WORDS = ['baar', 'bar', 'times', 'din', 'dino', 'days', 'day', 'बार', 'दिन', 'दिनों', 'डेज', 'डे'];

/** "पूजा कितने दिन present रही November में" — one employee's saved attendance counted by status. */
async function answerEmployeeAttendance(user, message, directory, today) {
  const status = includesAny(message, PRESENT_WORDS) ? 'present' : parseStatus(message);
  if (!status && !includesAny(message, ATTENDANCE_WORDS)) return null;
  if (!includesAny(message, COUNT_WORDS) && !includesAny(message, TIMES_WORDS) && !includesAny(message, ['kab', 'कब', 'which dates', 'तारीख'])) return null;
  if (includesAny(message, MARK_WORDS) || includesAny(message, EDIT_WORDS) || parseType(message) || runKindOf(message)) return null;
  const employees = (await findEmployees(user, message)).filter((item) => item.locationId || item.organizationId);
  if (employees.length === 0) return null;
  const currentMonth = today.slice(0, 7);
  const named = parseMonth(message, currentMonth) || currentMonth;
  const month = named > currentMonth ? currentMonth : named;
  if (employees.length > 1) {
    return {
      reply: `${employees.length} employees मिले — किसकी ${monthLabel(month)} की attendance बताऊँ?`,
      choices: employees.slice(0, MAX_CHOICES).map((employee) => {
        const place = directory.locations.find((item) => item.id === employee.locationId);
        return choice(
          [employee.name, employee.parentName && `S/O ${employee.parentName}`, place && locationLabel(place)].filter(Boolean).join(' · '),
          { type: 'employee_attendance', month, employeeId: employee.id, status: status || null },
        );
      }),
    };
  }
  return { reply: await employeeAttendanceReply(employees[0].id, month, status, today) };
}

async function employeeAttendanceReply(employeeId, month, status, today) {
  const employee = await Employee.findById(employeeId).select('name').lean();
  if (!employee) return 'Employee नहीं मिला।';
  const lastDay = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const records = await Attendance.find({ employeeId, date: { $gte: `${month}-01`, $lte: lastDay } }).select('date status').sort({ date: 1 }).lean();
  const period = monthLabel(month);
  if (records.length === 0) return `${employee.name} की ${period} की कोई attendance नहीं लगी है।`;
  const counts = new Map();
  for (const record of records) counts.set(record.status, (counts.get(record.status) || 0) + 1);
  const until = month === today.slice(0, 7) ? today : lastDay;
  const elapsed = Number(until.slice(8, 10));
  const unmarked = Math.max(0, elapsed - records.length);
  const breakdown = ATTENDANCE_STATUSES.filter((item) => counts.get(item)).map((item) => `${STATUS_LABELS[item]} ${counts.get(item)}`).join(' · ');
  const lines = [];
  if (status) {
    const dates = records.filter((record) => record.status === status).map((record) => Number(record.date.slice(8, 10)));
    lines.push(`${employee.name} · ${period} में ${STATUS_LABELS[status]}: ${dates.length} दिन${dates.length ? ` (तारीख: ${dates.join(', ')})` : ''}`);
  } else {
    lines.push(`${employee.name} की ${period} की attendance:`);
  }
  lines.push(`पूरा हिसाब: ${breakdown}${unmarked ? ` · ${unmarked} दिन attendance नहीं लगी` : ''}`);
  return lines.join('\n');
}

/**
 * Bank letter (NEFT request) or payroll run for a person, location(s) or organization, plus status and amount questions.
 * Nothing is saved until the user confirms.
 */
async function answerPaymentRun(user, message, directory, today, context = null, lang = 'hi') {
  const kind = runKindOf(message);
  if (!kind) return null;
  const { label, lower } = RUN_KINDS[kind];
  if (user.role !== 'admin') {
    return kind === 'bank'
      ? { reply: say(lang, 'Bank invoice सिर्फ़ admin login से बनता है।', 'Bank invoices can only be created from an admin login.') }
      : null;
  }
  const currentMonth = today.slice(0, 7);
  let month = parseMonth(message, currentMonth) || currentMonth;
  if (month > currentMonth) month = currentMonth;
  const format = parseFormat(message) || 'pdf';
  const plan = (fields, planFormat = format) => runPlan(kind, month, planFormat, fields);

  const organizations = matchOrganizations(message, directory);
  const organization = organizations.length === 1 ? organizations[0] : null;
  const locations = matchLocations(message, directory, organization?.id).filter((item) => item.status !== 'disabled');

  // "दोनों लोकेशंस" / "both" after "किस location का बनाना है?" uses the pending list we just showed.
  if (context?.locationIds?.length && (includesAny(message, BOTH_WORDS) || includesAny(message, REFERENCE_WORDS)
    || (includesAny(message, ALL_WORDS) && includesAny(message, DATA_TOPICS[1][1])))) {
    return { plan: plan({ locationIds: context.locationIds.slice(0, MAX_RUN_LOCATIONS) }) };
  }

  const asksStatus = [RUN_STATUS_WORDS, WHICH_LOCATION_WORDS, LIST_WORDS, CAN_BE_MADE_WORDS].some((list) => includesAny(message, list))
    || (includesAny(message, COUNT_WORDS) && (kind === 'bank' || includesAny(message, ORGANIZATION_WORDS) || includesAny(message, DATA_TOPICS[1][1])));
  if (asksStatus) {
    const data = await listDocumentLocations(user, { month }, kind);
    const byOrganization = !organization && locations.length === 0 && includesAny(message, ORGANIZATION_WORDS);
    const out = {};
    const reply = runStatusReply(kind, data, directory, month, { organization, locations, byOrganization }, out);
    return { reply, context: out.context };
  }

  let employees = [];
  // In "अगर सारे दिन present हो" the "सारे" is about days, not "all employees".
  if (!includesAny(message, ALL_WORDS) || asksFullMonth(message)) {
    const placeKeys = new Set([...locations.flatMap((item) => [item.workName, item.name]), organization?.name || '']
      .flatMap(words).map(skeleton));
    const text = words(message).filter((word) => !placeKeys.has(skeleton(word))).join(' ');
    employees = (await findEmployees(user, text, {
      organizationId: organization?.id,
      locationId: locations.length === 1 ? locations[0].id : undefined,
    })).filter((employee) => employee.status !== 'disabled' && employee.locationId);
  }

  // "Could you generate payroll for all?" is a request; plain "can you make payroll?" is ability-only.
  const asksAbilityOnly = includesAny(message, ABILITY_WORDS) && !includesAny(message, MAKE_WORDS) && !includesAny(message, ALL_WORDS);
  const specific = employees.length || locations.length || organization || parseMonth(message, currentMonth);
  if (!specific && asksAbilityOnly) {
    return {
      reply: say(lang, `हाँ, मैं ${label} बनाने में मदद कर सकती हूँ।`, `Yes, I can help you create ${label}.`),
    };
  }

  if (kind === 'payroll' && includesAny(message, AMOUNT_WORDS)) {
    const full = asksFullMonth(message);
    if (employees.length === 1 && full) return { reply: await fullMonthSalaryReply(employees[0].id, month) };
    if (employees.length <= 1) {
      return { reply: await payrollAmountReply(user, directory, month, { employee: employees[0], locations, organization }) };
    }
    return {
      reply: say(
        lang,
        `${employees.length} employees मिले — किसकी ${monthLabel(month)} की ${full ? 'पूरे महीने present वाली ' : ''}salary बताऊँ?`,
        `${employees.length} employees matched — whose ${monthLabel(month)}${full ? ' full-month present ' : ' '}salary should I show?`,
      ),
      choices: employees.slice(0, MAX_CHOICES).map((employee) => {
        const place = directory.locations.find((item) => item.id === employee.locationId);
        return choice(
          [employee.name, employee.parentName && `S/O ${employee.parentName}`, place && locationLabel(place)].filter(Boolean).join(' · '),
          { type: 'salary_amount', month, employeeId: employee.id, ...(full ? { full: true } : {}) },
        );
      }),
    };
  }

  if (employees.length > 1) {
    return {
      reply: say(lang, `${employees.length} employees मिले — किसका ${lower} चाहिए?`, `${employees.length} employees matched — whose ${lower} do you need?`),
      choices: employees.slice(0, MAX_CHOICES).map((employee) => {
        const place = directory.locations.find((item) => item.id === employee.locationId);
        return choice(
          [employee.name, employee.parentName && `S/O ${employee.parentName}`, place && locationLabel(place)].filter(Boolean).join(' · '),
          plan({ employeeId: employee.id }),
        );
      }),
    };
  }
  if (employees.length === 1) return { plan: plan({ employeeId: employees[0].id }) };
  if (locations.length === 1) return { plan: plan({ locationIds: [locations[0].id] }) };
  if (locations.length > 1) {
    return {
      reply: say(lang, `${locations.length} locations मिलीं — किसका ${lower} चाहिए?`, `${locations.length} locations matched — whose ${lower} do you need?`),
      choices: [
        ...locations.slice(0, MAX_CHOICES - 1).map((item) => choice(`${locationLabel(item)} · ${item.organizationName}`, plan({ locationIds: [item.id] }))),
        choice(
          say(lang, `ये सभी ${locations.length} locations एक साथ`, `All ${locations.length} locations together`),
          plan({ locationIds: locations.map((item) => item.id) }),
        ),
      ],
      context: { topic: 'run_pick', kind, month, locationIds: locations.map((item) => item.id) },
    };
  }
  if (organization) return { plan: plan({ organizationId: organization.id }) };

  const data = await listDocumentLocations(user, { month }, kind);
  const all = data.organizations.flatMap((group) => group.locations);
  const pending = all.filter((item) => item.status === 'pending' && item.employees > 0);
  const printed = all.filter((item) => item.status === 'printed');
  if (pending.length === 0) {
    return {
      reply: printed.length
        ? say(lang, `${monthLabel(month)} में सभी locations का ${lower} बन चुका है।`, `${lower} for all locations in ${monthLabel(month)} is already done.`)
        : say(lang, `${monthLabel(month)} में किसी location पर payment नहीं बनता।`, `No ${lower} payments are due for any location in ${monthLabel(month)}.`),
    };
  }
  if (includesAny(message, BOTH_WORDS) || (includesAny(message, ALL_WORDS) && includesAny(message, DATA_TOPICS[1][1]))) {
    return { plan: plan({ locationIds: pending.slice(0, MAX_RUN_LOCATIONS).map((item) => item.locationId) }) };
  }
  const pendingIds = pending.slice(0, MAX_RUN_LOCATIONS).map((item) => item.locationId);
  return {
    reply: say(lang, `${monthLabel(month)} का ${lower} किस location का बनाना है?`, `Which location's ${lower} should I create for ${monthLabel(month)}?`),
    choices: [
      ...pending.slice(0, MAX_CHOICES - 1).map((item) => choice(`${bankLocationName(item, directory)} · ${people(item.employees)} · ${rupees(item.total)}`, plan({ locationIds: [item.locationId] }))),
      ...(pending.length > 1 ? [choice(
        say(lang, `सभी ${pending.length} pending locations एक साथ`, `All ${pending.length} pending locations together`),
        plan({ locationIds: pendingIds }),
      )] : []),
    ],
    context: { topic: 'run_pick', kind, month, locationIds: pendingIds },
  };
}

function runDocument(kind, plan, title, fields = {}) {
  return {
    type: RUN_KINDS[kind].type,
    format: plan.format,
    month: plan.month,
    organizationId: fields.organizationId || null,
    locationId: fields.locationId || null,
    employeeIds: fields.employeeIds || null,
    batchId: fields.batchId || null,
    reprint: Boolean(fields.reprint),
    title,
  };
}

async function previewPaymentRun(kind, user, plan, directory, lang = 'hi') {
  const { label, lower, thing } = RUN_KINDS[kind];
  const period = monthLabel(plan.month);
  if (plan.batchId) {
    return {
      reply: say(lang, `पहले से बना ${thing} तैयार है। नीचे से PDF या Excel download करें।`, `A saved ${thing} is ready. Download the PDF or Excel below.`),
      document: runDocument(kind, plan, `${label} · ${period}`, { batchId: plan.batchId, reprint: true }),
    };
  }

  if (plan.employeeId) {
    const employee = await Employee.findOne({ _id: plan.employeeId, organizationId: { $ne: null } }).select('_id name organizationId locationId').lean();
    if (!employee?.locationId) throw httpError(404, 'Employee not found.');
    if (kind === 'payroll') {
      const payroll = await previewLocationsPayroll(user, { month: plan.month, locationIds: [String(employee.locationId)] });
      const line = payroll.lines.find((item) => String(item.employeeId) === String(employee._id));
      if (!line) {
        return {
          reply: say(
            lang,
            `${employee.name} का ${period} में कोई payroll नहीं बनता (attendance नहीं है)।`,
            `${employee.name} has no payroll for ${period} (no attendance).`,
          ),
        };
      }
      const runPlanFields = { locationIds: [String(employee.locationId)], employeeId: String(employee._id) };
      return {
        reply: say(
          lang,
          `Payroll · ${employee.name} · ${period}\n${line.paidDays} paid days · Net payable ${rupees(line.netPay ?? line.grossPay)}\nयह Payroll history में ${employee.name} के नाम से जुड़ जाएगा। बना दूँ?`,
          `Payroll · ${employee.name} · ${period}\n${line.paidDays} paid days · Net payable ${rupees(line.netPay ?? line.grossPay)}\nThis will be saved in Payroll history under ${employee.name}. Create it?`,
        ),
        choices: [
          choice(say(lang, 'हाँ, PDF (salary slip) बना दो', 'Yes, create PDF (salary slip)'), { ...runPlan(kind, plan.month, 'pdf', runPlanFields), confirm: true }),
          choice(say(lang, 'हाँ, Excel बना दो', 'Yes, create Excel'), { ...runPlan(kind, plan.month, 'excel', runPlanFields), confirm: true }),
          choice(say(lang, 'नहीं, रहने दो', 'No, cancel'), { type: 'cancel' }),
        ],
      };
    }
    const payments = await calculateBankPayments(user, { month: plan.month, locationIds: [String(employee.locationId)] });
    const row = payments.rows.find((item) => item.employeeId === String(employee._id));
    if (!row) {
      return {
        reply: say(
          lang,
          `${employee.name} का ${period} में कोई payment नहीं बनता (wage register में present days नहीं हैं)।`,
          `${employee.name} has no bank payment for ${period} (no present days on the wage register).`,
        ),
      };
    }
    const warning = row.missingBankDetails
      ? say(lang, '\n⚠️ इनकी bank details (account / IFSC / bank) अधूरी हैं — letter में खाली दिखेंगी।', '\n⚠️ Their bank details (account / IFSC / bank) are incomplete — they will appear blank in the letter.')
      : '';
    return {
      reply: say(
        lang,
        `${employee.name} का bank invoice (${period}, ${rupees(row.amount)}) तैयार है। नीचे से PDF या Excel download करें — यह printed history में नहीं जुड़ेगा।${warning}`,
        `${employee.name}'s bank invoice (${period}, ${rupees(row.amount)}) is ready. Download PDF or Excel below — this will not be added to printed history.${warning}`,
      ),
      document: runDocument(kind, plan, `Bank invoice · ${employee.name} · ${period}`, {
        organizationId: String(employee.organizationId),
        locationId: String(employee.locationId),
        employeeIds: [String(employee._id)],
      }),
    };
  }

  const data = await listDocumentLocations(user, { month: plan.month }, kind);
  const all = data.organizations.flatMap((group) => group.locations.map((item) => ({ ...item, organizationId: group.organizationId })));
  const targets = plan.locationIds.length
    ? all.filter((item) => plan.locationIds.includes(item.locationId))
    : all.filter((item) => item.organizationId === plan.organizationId);
  if (targets.length === 0) {
    return { reply: say(lang, `${period} में इन locations का कोई ${lower} data नहीं मिला।`, `No ${lower} data found for these locations in ${period}.`) };
  }
  const pending = targets.filter((item) => item.status === 'pending' && item.employees > 0);
  const printed = targets.filter((item) => item.status === 'printed');
  const empty = targets.filter((item) => item.status === 'pending' && item.employees === 0);
  const name = (item) => bankLocationName(item, directory);

  if (pending.length === 0) {
    if (printed.length === 0) {
      return {
        reply: say(
          lang,
          `${listText(empty.map(name))} पर ${period} में कोई payment नहीं बनता (wage register में present days नहीं हैं)।`,
          `No payment is due at ${listText(empty.map(name))} for ${period} (no present days on the wage register).`,
        ),
      };
    }
    const batches = [...new Map(printed.map((item) => [item.batchId, item])).values()];
    if (batches.length === 1) {
      const [item] = batches;
      return {
        reply: say(
          lang,
          `${listText(printed.map(name))} का ${period} का ${lower} पहले से बन चुका है (${item.reference})। वही ${thing} नीचे से download कर सकते हैं।`,
          `${lower} for ${listText(printed.map(name))} in ${period} is already done (${item.reference}). You can download that ${thing} below.`,
        ),
        document: runDocument(kind, plan, `${label} · ${item.reference} · ${period}`, { batchId: item.batchId, reprint: true }),
      };
    }
    return {
      reply: say(lang, `इनका ${period} का ${lower} पहले से बन चुका है। कौन-सा download करना है?`, `Their ${period} ${lower} is already done. Which one should I download?`),
      choices: batches.slice(0, MAX_CHOICES).map((item) => choice(`${item.reference} · ${name(item)}`, runPlan(kind, plan.month, plan.format, { batchId: item.batchId }))),
    };
  }

  let employees = pending.reduce((sum, item) => sum + item.employees, 0);
  let total = pending.reduce((sum, item) => sum + item.total, 0);
  if (kind === 'payroll') {
    const payroll = await previewLocationsPayroll(user, { month: plan.month, locationIds: pending.map((item) => item.locationId) });
    employees = payroll.lines.length;
    total = payroll.lines.reduce((sum, line) => sum + (line.netPay ?? line.grossPay), 0);
  }
  const missing = kind === 'bank' ? pending.reduce((sum, item) => sum + item.missingBankDetails, 0) : 0;
  const notes = [
    missing ? say(lang, `${missing} employees की bank details अधूरी हैं, वे letter में नहीं आएँगे।`, `${missing} employees have incomplete bank details and will be left out of the letter.`) : '',
    printed.length ? say(lang, `${listText(printed.map((item) => `${name(item)} (${item.reference})`))} का पहले से बन चुका है।`, `${listText(printed.map((item) => `${name(item)} (${item.reference})`))} is already done.`) : '',
    empty.length ? say(lang, `${listText(empty.map(name))} पर कोई payment नहीं।`, `No payment at ${listText(empty.map(name))}.`) : '',
  ].filter(Boolean).join(' ');
  const locationIds = pending.map((item) => item.locationId);
  return {
    reply: say(
      lang,
      `${label} · ${period}\n${listText(pending.map(name))}\n${people(employees)} · ${kind === 'payroll' ? 'Net payable' : 'कुल'} ${rupees(total)}${notes ? `\n${notes}` : ''}\nबनाने पर ${pending.length === 1 ? 'यह location' : 'ये locations'} ${period} के लिए printed मार्क हो ${pending.length === 1 ? 'जाएगी' : 'जाएँगी'}। बना दूँ?`,
      `${label} · ${period}\n${listText(pending.map(name))}\n${people(employees)} · ${kind === 'payroll' ? 'Net payable' : 'Total'} ${rupees(total)}${notes ? `\n${notes}` : ''}\nCreating this will mark ${pending.length === 1 ? 'this location' : 'these locations'} as printed for ${period}. Create it?`,
    ),
    choices: [
      choice(
        say(lang, kind === 'payroll' ? 'हाँ, PDF (salary slips) बना दो' : 'हाँ, PDF बना दो', kind === 'payroll' ? 'Yes, create PDF (salary slips)' : 'Yes, create PDF'),
        { ...runPlan(kind, plan.month, 'pdf', { locationIds }), confirm: true },
      ),
      choice(say(lang, 'हाँ, Excel बना दो', 'Yes, create Excel'), { ...runPlan(kind, plan.month, 'excel', { locationIds }), confirm: true }),
      choice(say(lang, 'नहीं, रहने दो', 'No, cancel'), { type: 'cancel' }),
    ],
  };
}

async function confirmPaymentRun(kind, user, plan, directory, today, lang = 'hi') {
  const { label } = RUN_KINDS[kind];
  if (plan.locationIds.length === 0) return previewPaymentRun(kind, user, plan, directory, lang);
  try {
    const body = kind === 'bank'
      ? { month: plan.month, locationIds: plan.locationIds, letterDate: today, referenceNumber: '', chequeNumber: '', skipMissing: true, format: plan.format }
      : { month: plan.month, locationIds: plan.locationIds, format: plan.format, ...(plan.employeeId ? { employeeIds: [plan.employeeId] } : {}) };
    const { batch } = await createDocumentBatch(user, body, kind);
    const note = kind === 'bank'
      ? say(lang, ' (Cheque number Bank Invoice page से reprint करते समय जोड़ सकते हैं।)', ' (You can add the cheque number when reprinting from the Bank Invoice page.)')
      : batch.partial
        ? say(lang, ' (सिर्फ़ चुने हुए employee का — location pending ही रहेगी।)', ' (Only the selected employee — the location stays pending.)')
        : '';
    return {
      reply: say(
        lang,
        `✅ ${label} ${batch.reference} बन गया — ${people(batch.employees)}, कुल ${rupees(batch.total)}। नीचे से PDF या Excel download करें।${note}`,
        `✅ ${label} ${batch.reference} is ready — ${people(batch.employees)}, total ${rupees(batch.total)}. Download the PDF or Excel below.${note}`,
      ),
      document: runDocument(kind, plan, `${label} · ${batch.reference} · ${monthLabel(plan.month)}`, { batchId: batch.id }),
    };
  } catch (error) {
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return { reply: say(lang, `${label} नहीं बना: ${error.message}`, `${label} was not created: ${error.message}`) };
    }
    throw error;
  }
}

function runPlanFromInput(kind, plan, today) {
  if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
  const locationIds = Array.isArray(plan.locationIds) ? [...new Set(plan.locationIds.map(String))].slice(0, MAX_RUN_LOCATIONS) : [];
  const ids = [plan.organizationId, plan.employeeId, plan.batchId, ...locationIds].filter(Boolean);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw httpError(400, 'Invalid id.');
  return runPlan(kind, plan.month, plan.format === 'excel' ? 'excel' : 'pdf', {
    organizationId: plan.organizationId ? String(plan.organizationId) : null,
    locationIds,
    employeeId: plan.employeeId ? String(plan.employeeId) : null,
    batchId: plan.batchId ? String(plan.batchId) : null,
  });
}

function editPlanFromInput(plan, today) {
  if (!mongoose.isValidObjectId(plan.locationId) || !mongoose.isValidObjectId(plan.organizationId)) throw httpError(400, 'Invalid location.');
  if (plan.employeeId && !mongoose.isValidObjectId(plan.employeeId)) throw httpError(400, 'Invalid employee id.');
  if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
  const dates = Array.isArray(plan.dates) ? plan.dates.slice(0, 31) : [];
  if (dates.some((date) => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(plan.month)
    || Number(date.slice(8, 10)) < 1 || Number(date.slice(8, 10)) > daysInMonth(plan.month))) {
    throw httpError(400, 'Select valid dates.');
  }
  const count = Number.isInteger(plan.count) && plan.count >= 1 && plan.count <= 31 ? plan.count : null;
  return {
    restStatus: ATTENDANCE_STATUSES.includes(plan.restStatus) ? plan.restStatus : null,
    type: 'edit_attendance',
    organizationId: String(plan.organizationId),
    locationId: String(plan.locationId),
    month: plan.month,
    employeeId: plan.employeeId ? String(plan.employeeId) : null,
    status: ATTENDANCE_STATUSES.includes(plan.status) ? plan.status : null,
    dates: [...new Set(dates)].sort(),
    count,
  };
}

/** Short answers to "how many / which organizations, locations or employees", read from the user's own data. */
// Speech often turns "employee assign" into "एंपलॉयर साइन" / "जिम एम्पलाई साइन", so stems are matched too.
const STAFF_WORDS = ['assign', 'assigned', 'असाइन', 'साइन', 'एंपल', 'एम्पल', 'एंप्ल', 'एम्प्ल', 'इम्पल', 'इंप्ल', 'स्टाफ', 'staff', 'employee', 'employees', 'karmachari', 'कर्मचारी', 'worker', 'workers', 'वर्कर'];
const EMPTY_WORDS = ['nahi', 'nahin', 'nai', 'नहीं', 'नही', 'bina', 'बिना', 'khali', 'khaali', 'खाली', 'empty', 'without', 'unassigned', 'zero', 'जीरो'];

/** "किन locations में employees assign हैं / नहीं हैं" — locations split by whether they have active employees. */
async function answerLocationStaffing(user, message, directory) {
  if (!includesAny(message, DATA_TOPICS[1][1]) || !includesAny(message, STAFF_WORDS)) return null;
  if (runKindOf(message) || parseType(message) || includesAny(message, ATTENDANCE_WORDS)) return null;
  if (matchLocations(message, directory).length) return null;

  let organization = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) [organization] = organizations;
  }
  const active = directory.locations.filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id));
  if (active.length === 0) return { reply: 'कोई active location नहीं मिली।' };

  const employees = await Employee.find({
    organizationId: user.role === 'admin' ? { $ne: null } : user.id,
    locationId: { $in: active.map((item) => item.id) },
    status: { $ne: 'disabled' },
  }).select('name designation locationId').sort({ name: 1 }).lean();
  const designations = new Map(active.map((item) => [item.id, String(item.designation || '').toLowerCase()]));
  const byLocation = new Map();
  const misplaced = [];
  for (const employee of employees) {
    const key = String(employee.locationId);
    // Same placement rule as the dashboard and attendance pages: location and designation must both match.
    if (designations.get(key) !== String(employee.designation || '').toLowerCase()) {
      misplaced.push(employee.name);
      continue;
    }
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push(employee.name);
  }

  const name = (item) => (user.role === 'admin' && !organization ? `${locationLabel(item)} (${item.organizationName})` : locationLabel(item));
  const staffed = active.filter((item) => byLocation.has(item.id));
  const empty = active.filter((item) => !byLocation.has(item.id));
  const scope = organization ? `${organization.name} की` : 'आपकी';
  const bullet = (lines) => {
    const shown = lines.slice(0, MAX_LISTED).map((line) => `• ${line}`).join('\n');
    return lines.length > MAX_LISTED ? `${shown}\n(+${lines.length - MAX_LISTED} और)` : shown;
  };
  const misplacedNote = misplaced.length
    ? `\nध्यान दें: ${misplaced.slice(0, MAX_LISTED).join(', ')} की designation उनकी location के post से match नहीं करती, इसलिए वे किसी location पर गिने नहीं गए।`
    : '';

  if (includesAny(message, EMPTY_WORDS)) {
    const items = empty.map(name);
    const reply = (empty.length
      ? `${scope} ${active.length} active locations में से ${plural(empty.length, 'location')} पर कोई employee assign नहीं है:\n${bullet(items)}`
      : `${scope} सभी ${plural(active.length, 'active location')} पर employees assign हैं।`) + misplacedNote;
    return {
      reply,
      context: { topic: 'locations', locationIds: empty.map((item) => item.id), title: `इन ${plural(empty.length, 'location')} पर कोई employee assign नहीं है`, items },
    };
  }

  const items = staffed.map((item) => {
    const names = byLocation.get(item.id);
    return `${name(item)} — ${people(names.length)}: ${names.slice(0, MAX_LISTED).join(', ')}${names.length > MAX_LISTED ? ` (+${names.length - MAX_LISTED} और)` : ''}`;
  });
  const reply = (staffed.length
    ? `${scope} ${active.length} active locations में से ${plural(staffed.length, 'location')} पर employees assign हैं:\n${bullet(items)}${empty.length ? `\nबाकी ${plural(empty.length, 'location')} पर अभी कोई employee नहीं है।` : ''}`
    : `${scope} किसी भी active location पर अभी कोई employee assign नहीं है।`) + misplacedNote;
  return {
    reply,
    context: { topic: 'locations', locationIds: staffed.map((item) => item.id), title: `इन ${plural(staffed.length, 'location')} पर employees assign हैं`, items },
  };
}

async function answerDataQuestion(user, message, directory, out = {}, lang = 'hi') {
  if (includesAny(message, ['work for', 'working for', 'काम करती', 'काम करते', 'kaam karti', 'kam karti'])) return null;
  let wantsCount = includesAny(message, COUNT_WORDS);
  let wantsList = includesAny(message, LIST_WORDS);
  const topic = DATA_TOPICS.find(([, list]) => includesAny(message, list))?.[0];
  // Bare "एंपलॉयर" / "employees" (no person name) → active employee count.
  if (!wantsCount && !wantsList && topic === 'employee') {
    const bareBits = words(employeeSearchText(message)).filter(isNameToken);
    if (bareBits.length === 0) wantsCount = true;
  }
  if (!wantsCount && !wantsList) return null;
  if (!topic) return null;

  let organization = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) [organization] = organizations;
  }
  const locations = topic === 'organization' ? [] : matchLocations(message, directory, organization?.id);
  const location = locations.length === 1 ? locations[0] : null;
  const scope = location ? `${locationLabel(location)} पर` : organization ? `${organization.name} में` : 'आपके dashboard में';

  if (topic === 'organization') {
    const names = directory.organizations.map((item) => item.name);
    if (wantsList && names.length) return `आपके dashboard में ${counted(names.length, 'organization')}: ${listText(names)}।`;
    return `आपके dashboard में ${counted(names.length, 'organization')}।`;
  }

  if (topic === 'location') {
    const list = directory.locations.filter((item) => !organization || item.organizationId === organization.id);
    const active = list.filter((item) => item.status !== 'disabled');
    const disabled = list.filter((item) => item.status === 'disabled');
    const wantsDisabled = includesAny(message, DISABLED_STATUS_WORDS);
    const named = (item) => (user.role === 'admin' ? `${locationLabel(item)} (${item.organizationName})` : locationLabel(item));
    if (wantsDisabled) {
      out.context = {
        topic: 'locations',
        locationIds: disabled.map((item) => item.id),
        title: `${scope} ये ${plural(disabled.length, 'disabled location')} हैं`,
        items: disabled.map(named),
      };
      if (disabled.length === 0) {
        return `${scope} कोई disabled/inactive location नहीं है${active.length ? ` (${counted(active.length, 'active location')})` : ''}।`;
      }
      const base = `${scope} ${counted(disabled.length, 'disabled/inactive location')}`;
      return wantsList ? `${base}: ${listText(disabled.map(locationLabel))}।` : `${base}।`;
    }
    const base = `${scope} ${counted(active.length, 'active location')}${disabled.length ? ` (${disabled.length} disabled)` : ''}`;
    out.context = {
      topic: 'locations',
      locationIds: active.map((item) => item.id),
      title: `${scope} ये ${plural(active.length, 'active location')} हैं`,
      items: active.map(named),
    };
    return wantsList && active.length ? `${base}: ${listText(active.map(locationLabel))}।` : `${base}।`;
  }

  const filter = { status: { $ne: 'disabled' } };
  if (user.role !== 'admin') filter.organizationId = user.id;
  else if (organization) filter.organizationId = organization.id;
  else filter.organizationId = { $ne: null };
  if (location) {
    filter.organizationId = location.organizationId;
    filter.locationId = location.id;
    filter.designation = new RegExp(`^${escapeRegex(location.designation)}$`, 'i');
  }
  // "दीपक शर्मा नाम के कितने employee" — every name part must match (AND), ignore enrich junk.
  const nameJunk = new Set([
    'employee', 'employees', 'list', 'names', 'staff', 'worker', 'workers', 'generate', 'payroll', 'invoice', 'neft',
    'employer', 'ampalyer', 'ampler', 'एंपलॉयर', 'एम्पलॉयर', 'एम्प्लॉयर', 'एम्प्लॉई', 'एम्पलाई', 'कर्मचारी',
  ]);
  const nameBits = words(employeeSearchText(message))
    .filter(isNameToken)
    .filter((word) => !nameJunk.has(word) && !nameJunk.has(word.toLowerCase()) && !DATA_TOPICS[0][1].some((stem) => word.includes(stem) || stem.includes(word)));
  if (nameBits.length > 0 && !location) {
    const label = nameBits.join(' ');
    const matches = (await findEmployees(user, label)).filter((item) => item.status !== 'disabled');
    const bitMatches = (item, bit) => personMessageKeys(item.name).has(nameKey(bit));
    // "दीपक शर्मा" → must match Deepak AND Sharma, not Deepak OR Sharma.
    const list = matches.filter((item) => nameBits.every((bit) => bitMatches(item, bit)));
    if (list.length === 0) {
      return say(lang, `${scope} "${label}" नाम का कोई employee नहीं मिला।`, `${scope} no employee named "${label}" was found.`);
    }
    const places = new Map(directory.locations.map((item) => [item.id, item]));
    const lines = list.slice(0, MAX_EMPLOYEE_LIST).map((item, index) => {
      const place = places.get(item.locationId);
      const details = [item.designation, place && locationLabel(place)].filter(Boolean).join(', ');
      return `${index + 1}. ${item.name}${details ? ` — ${details}` : ''}`;
    });
    return say(
      lang,
      `${scope} "${label}" नाम के ${list.length} employee:\n${lines.join('\n')}`,
      `${scope} ${list.length} employee${list.length === 1 ? '' : 's'} named "${label}":\n${lines.join('\n')}`,
    );
  }
  if (wantsList) {
    const [employees, total] = await Promise.all([
      Employee.find(filter).select('name designation locationId').sort({ name: 1 }).limit(MAX_EMPLOYEE_LIST).lean(),
      Employee.countDocuments(filter),
    ]);
    if (total === 0) return `${scope} कोई active employee नहीं है।`;
    const places = new Map(directory.locations.map((item) => [item.id, item]));
    const lines = employees.map((item, index) => {
      const place = places.get(String(item.locationId));
      const details = [item.designation, !location && place && locationLabel(place)].filter(Boolean).join(', ');
      return `${index + 1}. ${item.name}${details ? ` — ${details}` : ''}`;
    });
    const more = total > employees.length ? `\n(+${total - employees.length} और — पूरी list के लिए Employees page देखें)` : '';
    return `${scope} ${counted(total, 'active employee')}:\n${lines.join('\n')}${more}`;
  }
  const total = await Employee.countDocuments(filter);
  return `${scope} ${counted(total, 'active employee')}।`;
}
const ABILITY_LABELS = {
  salary_slip: 'Salary Slip',
  payroll: 'Payroll',
  wage_register: 'Wages Sheet',
  attendance_register: 'Attendance Register',
};

/**
 * Turns a request into a document plan the dashboard can download, asking the user to pick when a
 * location or employee is ambiguous. Each data endpoint still enforces its own access rules.
 */
async function resolvePlan(user, draft, directory, { message = '', today }) {
  const currentMonth = today.slice(0, 7);
  const type = DOCUMENT_TYPES.includes(draft.type) ? draft.type : null;
  if (!type) return { reply: helpReply(messageLang(message)) };
  const format = draft.format === 'excel' ? 'excel' : 'pdf';
  let month = isMonth(draft.month) ? draft.month : currentMonth;
  if (month > currentMonth) month = currentMonth;

  const knownOrganization = directory.organizations.find((organization) => organization.id === draft.organizationId);
  let organizationId = user.role === 'admin' ? knownOrganization?.id || null : String(user.id);
  let location = directory.locations.find((item) => item.id === draft.locationId
    && (!organizationId || item.organizationId === organizationId)) || null;
  if (location) organizationId = location.organizationId;

  let employee = null;
  if (draft.employeeId) {
    if (!mongoose.isValidObjectId(draft.employeeId)) throw httpError(400, 'Invalid employee id.');
    const record = await Employee.findOne({
      _id: draft.employeeId,
      ...(user.role === 'admin' ? { organizationId: { $ne: null } } : { organizationId: user.id }),
    }).select('_id name organizationId locationId').lean();
    if (!record) throw httpError(404, 'Employee not found.');
    employee = {
      id: String(record._id),
      name: record.name,
      organizationId: String(record.organizationId),
      locationId: record.locationId ? String(record.locationId) : '',
    };
  } else if (draft.employeeName) {
    const matches = await findEmployees(user, draft.employeeName, {
      organizationId,
      locationId: location?.id,
      exactName: draft.employeeName,
    });
    if (matches.length === 0) {
      return { reply: `"${draft.employeeName}" नाम का कोई employee ${location ? `${location.workName} पर ` : ''}नहीं मिला। पूरा नाम दोबारा बताइए।` };
    }
    if (matches.length > 1) {
      return {
        reply: `"${draft.employeeName}" नाम के ${matches.length} employees मिले — किसका ${DOCUMENT_LABELS[type].toLowerCase()} चाहिए?`,
        choices: matches.slice(0, MAX_CHOICES).map((match) => {
          const place = directory.locations.find((item) => item.id === match.locationId);
          const label = [match.name, match.parentName && `S/O ${match.parentName}`, place && locationLabel(place)].filter(Boolean).join(' · ');
          return choice(label, { type, format, month, organizationId: match.organizationId, locationId: location?.id || null, employeeId: match.id });
        }),
      };
    }
    [employee] = matches;
  }

  if (employee) {
    organizationId = employee.organizationId || organizationId;
    if (!location && employee.locationId) location = directory.locations.find((item) => item.id === employee.locationId) || null;
  }

  const needsLocation = type === 'wage_register' || type === 'attendance_register';
  if (needsLocation && !location) {
    const candidates = directory.locations.filter((item) => (!organizationId || item.organizationId === organizationId) && item.status !== 'disabled');
    if (candidates.length === 1) {
      [location] = candidates;
      organizationId = location.organizationId;
    } else if (candidates.length === 0) {
      return { reply: 'इस organization में अभी कोई location नहीं है।' };
    } else {
      const narrowed = message ? matchLocations(message, directory, organizationId) : [];
      const options = (narrowed.length > 1 ? narrowed : candidates).slice(0, MAX_CHOICES);
      return {
        reply: `${DOCUMENT_LABELS[type]} (${monthLabel(month)}) किस location का चाहिए?`,
        choices: options.map((item) => choice(
          user.role === 'admin' ? `${locationLabel(item)} · ${item.organizationName}` : locationLabel(item),
          { type, format, month, organizationId: item.organizationId, locationId: item.id, employeeId: employee?.id || null },
        )),
      };
    }
  }

  const organization = directory.organizations.find((item) => item.id === organizationId);
  const scopeLabel = employee
    ? employee.name
    : location
      ? locationLabel(location)
      : organization && user.role === 'admin'
        ? organization.name
        : 'सभी employees';
  const title = `${DOCUMENT_LABELS[type]} · ${scopeLabel} · ${monthLabel(month)}`;
  return {
    reply: `${title} — तैयार है। नीचे से PDF या Excel download करें।`,
    document: {
      type,
      format,
      month,
      organizationId: organizationId || null,
      locationId: location?.id || null,
      employeeIds: employee ? [employee.id] : null,
      title,
    },
  };
}

/** Rule-based understanding used when the model is unavailable. */
async function interpretWithRules(user, message, directory, today) {
  const type = parseType(message);
  if (!type) return { type: null };
  let organizationId = null;
  if (user.role === 'admin') {
    const organizations = matchOrganizations(message, directory);
    if (organizations.length === 1) organizationId = organizations[0].id;
  }
  const locations = matchLocations(message, directory, organizationId);
  const locationId = locations.length === 1 ? locations[0].id : null;

  let employeeName = null;
  if (!includesAny(message, ALL_WORDS) && (type === 'salary_slip' || type === 'attendance_register' || type === 'payroll')) {
    const location = directory.locations.find((item) => item.id === locationId);
    const locationKeys = location ? new Set([location.workName, location.name].flatMap(words).map(skeleton)) : new Set();
    const text = words(message).filter((word) => !locationKeys.has(skeleton(word))).join(' ');
    const employees = await findEmployees(user, text, { organizationId: organizationId || location?.organizationId, locationId });
    if (employees.length === 1) employeeName = employees[0].name;
  }
  return {
    type,
    month: parseMonth(message, today.slice(0, 7)),
    format: parseFormat(message),
    organizationId,
    locationId,
    employeeName,
  };
}

const REFERENCE_WORDS = [
  'ye', 'yeh', 'wo', 'woh', 'vo', 'un', 'unka', 'unki', 'unke', 'uska', 'uski', 'uske', 'iska', 'iski', 'iske', 'inka', 'inki', 'inke', 'in sab',
  'those', 'these', 'them', 'they', 'his', 'her', 'their', 'upar', 'wahi', 'vahi',
  'ये', 'यह', 'वो', 'वह', 'उन', 'उनका', 'उनकी', 'उनके', 'उसका', 'उसकी', 'उसके', 'इसका', 'इसकी', 'इसके', 'इन', 'इनका', 'इनकी', 'इनके', 'ऊपर', 'वही', 'उपर',
];
const MAKE_WORDS = [
  'bana', 'banaa', 'banao', 'bana do', 'banado', 'banana', 'nikal', 'nikalo', 'nikal do', 'create', 'make', 'generate', 'chahiye', 'kar do', 'karo', 'de do',
  'बना', 'बनाओ', 'बना दो', 'बनाना', 'निकाल', 'निकालो', 'निकाल दो', 'चाहिए', 'कर दो', 'करो', 'दे दो', 'क्रिएट', 'जनरेट',
];
const TELL_WORDS = ['batao', 'batana', 'bataiye', 'bata do', 'btao', 'detail', 'details', 'naam', 'names', 'show', 'बताओ', 'बताना', 'बताइए', 'बता दो', 'डिटेल', 'नाम', 'दिखाओ'];
const DISABLED_STATUS_WORDS = [
  'disabled', 'inactive', 'deactive', 'deactivated', 'deactivate', 'disable', 'in active', 'de active',
  'डीएक्टिव', 'डीऐक्टिव', 'डिएक्टिव', 'डीएक्टिवेट', 'डिएक्टिवेट', 'इनएक्टिव', 'इनऐक्टिव', 'आईएनएक्टिव', 'आईनएक्टिव', 'इनेक्टिव', 'निष्क्रिय', 'डिसेबल्ड', 'डिसेबल',
];
const ACTIVE_STATUS_WORDS = ['active', 'enabled', 'एक्टिव', 'ऐक्टिव', 'सक्रिय', 'इनेबल्ड'];
const FRESH_SCOPE_WORDS = [
  'dashboard', 'डैशबोर्ड', 'total', 'टोटल', 'कुल', 'all', 'sabhi', 'sab', 'सभी', 'सब', 'सारी', 'सारे', 'kitni', 'kitne', 'कितनी', 'कितने',
  ...DISABLED_STATUS_WORDS, ...ACTIVE_STATUS_WORDS,
];
const MEMORY_QUESTION_WORDS = ['sawal', 'swal', 'savaal', 'question', 'message', 'msg', 'pucha', 'puchha', 'poocha', 'puchi', 'baat', 'सवाल', 'मैसेज', 'पूछा', 'पूछी', 'बात', 'क्वेश्चन'];
const FIRST_WORDS = ['pehla', 'pahla', 'pehli', 'pahli', 'first', 'sabse pehle', 'पहला', 'पहली', 'सबसे पहले'];
const PREVIOUS_WORDS = ['pichla', 'pichhla', 'pichli', 'last', 'previous', 'abhi wala', 'पिछला', 'पिछली', 'आखिरी', 'अभी वाला'];
// Past actions only — "क्या क्या कर सकती हो" is capability, not "what did you do".
const DONE_SO_FAR_WORDS = [
  'kya kya kiya', 'kya kiya', 'kya kya kiye', 'kya kya hua', 'kya kya ho gaya', 'what have you done', 'what did you do', 'what did we do',
  'ab tak kya', 'ab tak kuch',
  'क्या-क्या किया', 'क्या क्या किया', 'क्या किया', 'क्या-क्या किये', 'क्या क्या किये', 'अब तक क्या', 'क्या-क्या हुआ', 'क्या क्या हुआ',
];
const CAPABILITY_QUESTION_WORDS = [
  'sakti', 'sakte', 'sakta', 'sako', 'can you', 'could you', 'what can you', 'kar sakti', 'kar sakte', 'kar sakta',
  'सकती', 'सकते', 'सकता', 'सको', 'कर सकती', 'कर सकते', 'कर सकता',
];
const MAX_SESSION_MESSAGES = 200;
const CONTEXT_TURNS = 3;

function numberIn(text) {
  for (const token of dateTokens(text)) {
    const value = dayNumber(token) || NUMBER_WORDS[token];
    if (value) return value;
  }
  return null;
}

/** "पहला सवाल क्या था", "पिछला सवाल", "अब तक क्या-क्या किया" — answered from this chat's saved history. */
function answerMemory(message, session) {
  const asked = session.messages.filter((item) => item.role === 'user');
  // "तुम क्या क्या कर सकती हो" must not be treated as "अब तक क्या किया".
  if (includesAny(message, DONE_SO_FAR_WORDS) && !includesAny(message, CAPABILITY_QUESTION_WORDS)) {
    if (session.actions.length === 0) {
      return asked.length
        ? `इस chat में अभी तक database में कोई बदलाव नहीं किया। आपने ${asked.length} सवाल पूछे हैं — पहला था: "${asked[0].content}"`
        : 'इस chat में अभी तक कुछ नहीं हुआ।';
    }
    const lines = session.actions.slice(-MAX_LISTED).map((action, index) => `${index + 1}. ${action.text}`);
    return `इस chat में अब तक:\n${lines.join('\n')}`;
  }
  if (!includesAny(message, MEMORY_QUESTION_WORDS)) return null;
  const answerTo = (index) => {
    const position = session.messages.indexOf(asked[index]);
    const reply = session.messages.slice(position + 1).find((item) => item.role === 'assistant');
    if (!reply) return '';
    return `\nमेरा जवाब था: ${reply.content.length > 400 ? `${reply.content.slice(0, 400)}…` : reply.content}`;
  };
  if (includesAny(message, FIRST_WORDS)) {
    return asked.length ? `आपका पहला सवाल था: "${asked[0].content}"${answerTo(0)}` : 'यह इस chat का पहला सवाल है।';
  }
  if (includesAny(message, PREVIOUS_WORDS)) {
    return asked.length ? `आपका पिछला सवाल था: "${asked[asked.length - 1].content}"${answerTo(asked.length - 1)}` : 'इस chat में इससे पहले कोई सवाल नहीं है।';
  }
  if (includesAny(message, ['kya kya', 'क्या-क्या', 'क्या क्या', 'sab', 'सब', 'list'])) {
    if (asked.length === 0) return 'इस chat में इससे पहले कोई सवाल नहीं है।';
    return `आपने इस chat में ये पूछा:\n${asked.slice(-MAX_LISTED).map((item, index) => `${index + 1}. ${item.content}`).join('\n')}`;
  }
  return null;
}

/** Follow-ups like "कौन-कौन सी दो location हैं?" or "उनके employees बताओ" answered from the previous answer's subject. */
async function answerFromContext(user, message, directory, context) {
  if (!context?.items?.length) return null;
  if (runKindOf(message) || parseType(message) || parseStatus(message) || includesAny(message, ATTENDANCE_WORDS)) return null;
  // "डीएक्टिव / inactive locations" is a new list request, not a repeat of the last answer.
  if (includesAny(message, DISABLED_STATUS_WORDS) || includesAny(message, ACTIVE_STATUS_WORDS)) return null;
  if (matchLocations(message, directory).length || matchOrganizations(message, directory).length) return null;
  const refersBack = includesAny(message, REFERENCE_WORDS) || numberIn(message) === context.items.length;
  const asksDetail = includesAny(message, LIST_WORDS) || includesAny(message, WHICH_LOCATION_WORDS) || includesAny(message, TELL_WORDS);
  if (!refersBack && !(asksDetail && !includesAny(message, FRESH_SCOPE_WORDS))) return null;

  if (includesAny(message, DATA_TOPICS[0][1]) && context.locationIds?.length) {
    const places = directory.locations.filter((item) => context.locationIds.includes(item.id));
    const lines = await Promise.all(places.slice(0, MAX_LISTED).map(async (place) => {
      const employees = await Employee.find({
        organizationId: place.organizationId,
        locationId: place.id,
        status: { $ne: 'disabled' },
        ...(place.designation ? { designation: new RegExp(`^${escapeRegex(place.designation)}$`, 'i') } : {}),
      }).select('name').sort({ name: 1 }).limit(MAX_LISTED).lean();
      return `• ${locationLabel(place)}: ${employees.length ? employees.map((item) => item.name).join(', ') : 'कोई active employee नहीं'}`;
    }));
    return { reply: `इन locations के employees:\n${lines.join('\n')}`, context };
  }
  if (context.items.length === 0) return { reply: 'पिछले जवाब में कोई location नहीं थी।', context };
  const shown = context.items.slice(0, MAX_LISTED).map((item) => `• ${item}`).join('\n');
  const more = context.items.length > MAX_LISTED ? `\n(+${context.items.length - MAX_LISTED} और)` : '';
  return { reply: `${context.title}:\n${shown}${more}`, context };
}

const DETAIL_WORDS = [
  'detail', 'details', 'detailed', 'info', 'information', 'profile', 'bio', 'data', 'jankari', 'jaankari', 'bare me', 'bare mein', 'baare me', 'sab kuch',
  'about', 'who is', "who's", 'who is she', 'who is he', 'tell me about', 'full info', 'full details',
  'डिटेल', 'डिटेल्स', 'डीटेल', 'जानकारी', 'प्रोफाइल', 'प्रोफ़ाइल', 'बारे में', 'सब कुछ', 'डेटा', 'डाटा', 'विवरण', 'इन्फो', 'कौन है', 'कौन हैं',
];
const AVAILABLE_WORDS = [
  'available', 'availabe', 'availability', 'on duty', 'free hai', 'उपलब्ध', 'अवेलेबल', 'अवेलबल', 'अवैलेबल', 'अवेलेबले',
];
const WHEREABOUTS_WORDS = [
  'where', 'kahan', 'kaha', 'which location', 'kis location', 'kaun si location', 'kaun si loc', 'where assigned', 'where assign',
  'कहाँ', 'कहां', 'किस location', 'कौन सी location', 'कौनसी location', 'कहाँ असाइन', 'कहां असाइन', 'कहाँ साइन', 'कहां साइन',
];
const DETAIL_NOISE_WORDS = new Set([
  ...COMMON_WORDS,
  'generate', 'generated', 'create', 'make', 'detailed', 'detail', 'details', 'info', 'information', 'profile', 'about',
  'please', 'give', 'tell', 'who', 'whom', 'where', 'kahan', 'kaha', 'sign', 'assign', 'assigned', 'posted', 'waqt', 'what',
  'new', 'she', 'he', 'her', 'his', 'the', 'a', 'an', 'for', 'me', 'my', 'do', 'kar', 'hai', 'ho', 'hain', 'number', 'no',
  'जनरेट', 'बनाओ', 'बताओ', 'डिटेल', 'जानकारी', 'साइन', 'असाइन', 'कहाँ', 'कहां', 'नंबर', 'नम्बर', 'नंबर',
]);

/** Any one employee field an admin (or that employee's organization) can ask for, in Hindi or English. */
const EMPLOYEE_FIELDS = [
  { id: 'aadhaar', hi: 'Aadhaar', en: 'Aadhaar', mask: true, words: ['aadhaar', 'aadhar', 'adhar', 'aadhaar number', 'aadhar number', 'आधार', 'आधार नंबर', 'आधार नम्बर', 'आधार कार्ड', 'आधार कार्ड नंबर'] },
  { id: 'phone', hi: 'Mobile', en: 'Mobile', words: ['mobile', 'mobile number', 'phone', 'phone number', 'contact', 'contact number', 'cell', 'मोबाइल', 'मोबाइल नंबर', 'मोबाइल नम्बर', 'फोन', 'फोन नंबर', 'फ़ोन', 'संपर्क'] },
  { id: 'email', hi: 'Email', en: 'Email', words: ['email', 'e-mail', 'mail id', 'ईमेल', 'इमेल', 'मेल'] },
  { id: 'uan', hi: 'UAN', en: 'UAN', words: ['uan', 'यूएएन', 'यू एन'] },
  { id: 'esic', hi: 'ESIC no.', en: 'ESIC no.', words: ['esic', 'esi number', 'esi no', 'ईएसआईसी', 'ईएसआई'] },
  { id: 'ifsc', hi: 'IFSC', en: 'IFSC', words: ['ifsc', 'ifsc code', 'आईएफएससी', 'आई एफ एस सी'] },
  { id: 'account', hi: 'Account', en: 'Account', mask: true, words: ['account number', 'account no', 'bank account', 'खाता नंबर', 'खाता नम्बर', 'अकाउंट नंबर', 'अकाउंट'] },
  { id: 'bank', hi: 'Bank', en: 'Bank', words: ['bank name', 'bank branch', 'बैंक का नाम', 'बैंक नेम'] },
  { id: 'designation', hi: 'Designation', en: 'Designation', words: ['designation', 'destination', 'desination', 'destignation', 'job title', 'post', 'पद', 'पदनाम', 'डेजिग्नेशन', 'पोस्ट'] },
  { id: 'skill', hi: 'Skill', en: 'Skill', words: ['skill', 'skill category', 'स्किल'] },
  { id: 'dob', hi: 'Date of birth', en: 'Date of birth', words: ['date of birth', 'dob', 'birthday', 'जन्म', 'जन्म तारीख', 'जन्म तिथि'] },
  { id: 'doj', hi: 'Date of joining', en: 'Date of joining', words: ['date of joining', 'joining date', 'doj', 'जॉइनिंग', 'ज्वाइनिंग', 'जॉइन'] },
  { id: 'address', hi: 'Address', en: 'Address', words: ['address', 'pata', 'पता', 'एड्रेस'] },
  { id: 'parent', hi: 'पिता/अभिभावक', en: 'Parent / guardian', words: ['father', 'parent', 'guardian', 'pita', 'पिता', 'अभिभावक', 'पापा'] },
  { id: 'wage', hi: 'Daily wage', en: 'Daily wage', words: ['daily wage', 'daily salary', 'दिहाड़ी', 'दैनिक वेतन', 'डेली वेज'] },
  { id: 'basic', hi: 'Basic + DA', en: 'Basic + DA', words: ['basic pay', 'basic', 'dearness', 'बेसिक', 'डीए'] },
  { id: 'epf', hi: 'EPF / ESIC लागू', en: 'EPF / ESIC applicable', words: ['epf', 'epfo', 'pf', 'पीएफ', 'ईपीएफ'] },
  { id: 'status', hi: 'Status', en: 'Status', words: ['status', 'active hai', 'disabled hai', 'स्टेटस'] },
  { id: 'organization', hi: 'Organization', en: 'Organization', words: ['organisation', 'organization', 'company name', 'ऑर्गेनाइजेशन', 'कंपनी का नाम'] },
];

function askedEmployeeFields(message) {
  const found = EMPLOYEE_FIELDS.filter((field) => includesAny(message, field.words));
  if (found.length > 0) return found;
  const bareNumber = includesAny(message, ['number', 'no.', 'नंबर', 'नम्बर', 'नंबर'])
    && !includesAny(message, ['how many', 'kitne', 'kitni', 'कितने', 'कितनी', 'account', 'aadhaar', 'aadhar', 'आधार']);
  return bareNumber ? EMPLOYEE_FIELDS.filter((field) => field.id === 'phone') : [];
}

function masked(value, keep = 4) {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) return '';
  return text.length <= keep ? text : `${'X'.repeat(text.length - keep)}${text.slice(-keep)}`;
}

function shortDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('-') : value || '';
}

function employeeSearchText(message) {
  const skip = new Set(DETAIL_NOISE_WORDS);
  for (const field of EMPLOYEE_FIELDS) {
    for (const phrase of field.words) phrase.split(/\s+/).forEach((part) => skip.add(part));
  }
  for (const phrase of [...BANK_DETAIL_WORDS, ...AVAILABLE_WORDS, ...COUNT_WORDS, ...FULL_FORM_WORDS]) {
    phrase.split(/\s+/).forEach((part) => skip.add(part));
  }
  [
    'kya', 'क्या', 'hai', 'ho', 'hain', 'है', 'हैं', 'हो', 'invoice', 'neft', 'bill', 'info',
    'naam', 'name', 'नाम', 'full', 'form', 'फॉर्म', 'फुल', 'employee', 'employees', 'list', 'names',
    'एम्पलाई', 'एम्प्लॉई', 'कर्मचारी', 'का', 'की', 'के', 'को', 'से', 'में', 'पर',
  ].forEach((part) => skip.add(part));
  return words(message).filter((word) => !skip.has(word) && !/^\d+$/.test(word)).join(' ');
}

function employeeFieldValue(field, employee, placeText, organizationName, lang) {
  const yes = (value) => (lang === 'en' ? (value ? 'Yes' : 'No') : (value ? 'हाँ' : 'नहीं'));
  const show = (value, mask) => (mask ? masked(value) : value);
  const values = {
    aadhaar: show(employee.aadhaarNumber, true),
    phone: employee.phone,
    email: employee.email,
    uan: employee.uan,
    esic: employee.esicNumber,
    ifsc: employee.bankRoutingCode,
    account: show(employee.bankAccountNumber, true),
    bank: [employee.bankName, employee.bankBranch].filter(Boolean).join(', '),
    designation: employee.designation,
    skill: employee.skillCategory,
    dob: shortDate(employee.dateOfBirth),
    doj: shortDate(employee.dateOfJoining),
    address: employee.address,
    parent: employee.parentName,
    wage: employee.dailySalary ? rupees(employee.dailySalary) : '',
    basic: employee.basicPay || employee.dearnessAllowance ? `${rupees(employee.basicPay)} + ${rupees(employee.dearnessAllowance)}` : '',
    epf: `${yes(employee.epfoApplicable)} / ${yes(employee.esicApplicable)}`,
    status: employee.status === 'active' ? 'Active' : 'Disabled',
    organization: organizationName || '',
    location: placeText,
  };
  return values[field.id] || '';
}

function aboutEmployee(employee, payload) {
  return {
    ...payload,
    context: { topic: 'employee', employeeId: String(employee._id), employeeName: employee.name },
  };
}

const ACRONYM_FORMS = [
  { words: ['uan', 'यूएएन', 'युएएन', 'यू एन', 'नीम'], fullHi: 'Universal Account Number (EPF का UAN)', fullEn: 'Universal Account Number (EPF UAN)' },
  { words: ['esic', 'esi', 'ईएसआईसी', 'ईएसआई'], fullHi: 'Employees\' State Insurance Corporation', fullEn: 'Employees\' State Insurance Corporation' },
  { words: ['epf', 'epfo', 'ईपीएफ', 'पीएफ'], fullHi: 'Employees\' Provident Fund', fullEn: 'Employees\' Provident Fund' },
  { words: ['ifsc', 'आईएफएससी'], fullHi: 'Indian Financial System Code', fullEn: 'Indian Financial System Code' },
  { words: ['neft', 'नेफ्ट', 'एनईएफटी'], fullHi: 'National Electronic Funds Transfer', fullEn: 'National Electronic Funds Transfer' },
  { words: ['aadhaar', 'aadhar', 'आधार'], fullHi: 'आधार (UIDAI का unique ID)', fullEn: 'Aadhaar (UIDAI unique ID)' },
];
const FULL_FORM_WORDS = ['full form', 'fullform', 'ful form', 'फुल फॉर्म', 'फुलफॉर्म', 'फुल फ़ॉर्म', 'पूरा नाम', 'पूरा फॉर्म', 'matlab kya', 'मतलब क्या', 'expand', 'stands for'];

function answerAcronym(message, lang = 'hi') {
  if (!includesAny(message, FULL_FORM_WORDS) && !includesAny(message, ['uan kya', 'esic kya', 'epf kya', 'ifsc kya', 'neft kya'])) return null;
  const hit = ACRONYM_FORMS.find((item) => includesAny(message, item.words));
  if (!hit) return null;
  const short = hit.words.find((word) => /^[a-z]/i.test(word)) || hit.words[0];
  return {
    reply: say(lang, `${short.toUpperCase()} का full form: ${hit.fullHi}।`, `${short.toUpperCase()} stands for ${hit.fullEn}.`),
  };
}

/** "Sunita who is" / "details do" / "kahan assign hai" — one employee’s record or location. */
async function answerEmployeeDetails(user, message, directory, lang = 'hi', memory = null) {
  const fields = askedEmployeeFields(message);
  const wantsDetails = includesAny(message, DETAIL_WORDS);
  const wantsFull = wantsDetails && fields.length === 0;
  const wantsWhere = fields.some((field) => field.id === 'location') || (includesAny(message, WHEREABOUTS_WORDS)
    && (includesAny(message, STAFF_WORDS) || includesAny(message, ['work', 'works', 'working', 'posted', 'based', 'hai', 'है', 'ho'])));
  const wantsBank = asksBankDetails(message) && !fields.some((field) => ['ifsc', 'account', 'bank'].includes(field.id));
  const wantsAvailable = includesAny(message, AVAILABLE_WORDS);
  const search = employeeSearchText(message);
  const nameBits = words(search).filter(isNameToken);
  const named = nameBits.length > 0;
  const bareName = named && words(message).length <= 5 && !fields.length && !wantsDetails && !wantsWhere && !wantsBank && !wantsAvailable
    && !includesAny(message, COUNT_WORDS) && !runKindOf(message) && !parseType(message);
  if (fields.length === 0 && !wantsDetails && !wantsWhere && !wantsBank && !wantsAvailable && !bareName) return null;
  if (fields.length === 0 && !wantsBank && !bareName && (includesAny(message, ATTENDANCE_WORDS) || includesAny(message, INVOICE_WORDS))) return null;
  if (runKindOf(message) && fields.length === 0 && !wantsDetails && !wantsWhere && !wantsBank && !wantsAvailable && !bareName) return null;
  const asksFollowUp = !named && (fields.length > 0 || wantsBank || wantsDetails || wantsWhere || wantsAvailable || includesAny(message, REFERENCE_WORDS));
  let matches = [];
  // A new name always wins over the previous employee in memory.
  if (named) matches = await findEmployees(user, search);
  else if (asksFollowUp && memory?.employeeId && mongoose.isValidObjectId(memory.employeeId)) {
    const remembered = await Employee.findById(memory.employeeId).select('_id organizationId').lean();
    const allowed = remembered && (user.role === 'admin' || String(remembered.organizationId) === String(user.id));
    if (allowed) matches = [{ id: String(remembered._id), name: memory.employeeName || '' }];
  }
  if (matches.length === 0 && asksFollowUp && (fields.length || wantsBank || wantsDetails || wantsAvailable)) {
    return { reply: say(lang, 'किस employee के बारे में?', 'Which employee?') };
  }
  if (matches.length === 0) return null;
  const covers = (employee) => nameBits.every((word) => {
    const key = nameKey(word);
    if (key.length < 2) return true;
    return personMessageKeys(employee.name).has(key);
  });
  const exact = named ? matches.filter(covers) : matches;
  if (named && wantsAvailable && includesAny(message, COUNT_WORDS)) {
    const active = (exact.length ? exact : matches).filter((item) => item.status !== 'disabled');
    const label = nameBits.join(' ');
    return {
      reply: say(
        lang,
        active.length
          ? `"${label}" नाम के ${active.length} employee available हैं${active.length <= 5 ? `: ${active.map((item) => item.name).join(', ')}` : ''}।`
          : `"${label}" नाम का कोई active employee available नहीं है।`,
        active.length
          ? `${active.length} employee${active.length === 1 ? '' : 's'} named "${label}" ${active.length === 1 ? 'is' : 'are'} available${active.length <= 5 ? `: ${active.map((item) => item.name).join(', ')}` : ''}.`
          : `No active employee named "${label}" is available.`,
      ),
    };
  }
  if (named && wantsAvailable && exact.length === 0) {
    const near = matches.slice(0, 3).map((item) => item.name).join(', ');
    return {
      reply: say(
        lang,
        near
          ? `${search} नाम का कोई employee नहीं है। पास का नाम: ${near}।`
          : `${search} नाम का कोई employee नहीं मिला।`,
        near
          ? `No employee is named ${search}. Closest: ${near}.`
          : `No employee named ${search} was found.`,
      ),
    };
  }
  if (named && exact.length > 0) matches = exact;
  if (matches.length > 1) {
    const names = matches.slice(0, MAX_LISTED).map((item) => item.name);
    return {
      reply: say(
        lang,
        `इस नाम से ${matches.length} employees मिले: ${listText(names)}। पूरा नाम बताइए।`,
        `${matches.length} employees match this name: ${listText(names)}. Please give the full name.`,
      ),
    };
  }
  const employee = await Employee.findById(matches[0].id).lean();
  if (!employee) return null;
  const place = directory.locations.find((item) => item.id === String(employee.locationId));
  const organization = directory.organizations.find((item) => item.id === String(employee.organizationId));
  const placeText = place ? locationLabel(place) : say(lang, 'किसी location पर नहीं', 'Not assigned to any location');
  const organizationName = user.role === 'admin' ? organization?.name || '' : '';
  if (bareName) {
    const role = [employee.designation, placeText].filter(Boolean).join(' · ');
    return aboutEmployee(employee, {
      reply: say(
        lang,
        `${employee.name}${role ? ` — ${role}` : ''} · ${employee.status === 'active' ? 'Active' : 'Disabled'}। और क्या जानना है (phone, bank, aadhaar…)?`,
        `${employee.name}${role ? ` — ${role}` : ''} · ${employee.status === 'active' ? 'Active' : 'Disabled'}. What else do you need (phone, bank, aadhaar…)?`,
      ),
    });
  }
  if (wantsAvailable && fields.length === 0 && !wantsFull) {
    const active = employee.status === 'active';
    const role = [employee.designation, placeText].filter(Boolean).join(' · ');
    return aboutEmployee(employee, {
      reply: active
        ? say(lang, `हाँ, ${employee.name} available है${role ? ` — ${role}` : ''}।`, `Yes, ${employee.name} is available${role ? ` — ${role}` : ''}.`)
        : say(lang, `नहीं, ${employee.name} अभी disabled है, available नहीं है।`, `No, ${employee.name} is disabled and not available.`),
    });
  }
  if (fields.length > 0 && !wantsFull) {
    const lines = fields.map((field) => {
      const value = field.id === 'location' ? placeText : employeeFieldValue(field, employee, placeText, organizationName, lang);
      const label = say(lang, field.hi, field.en);
      return value
        ? `• ${label}: ${value}`
        : `• ${label}: ${say(lang, 'record में नहीं है', 'not on the record')}`;
    });
    const hidden = fields.some((field) => field.mask)
      ? say(lang, '\n(पूरा नंबर Employees page पर देखें।)', '\n(See the full number on the Employees page.)')
      : '';
    return aboutEmployee(employee, { reply: `${employee.name}\n${lines.join('\n')}${hidden}` });
  }
  if (wantsWhere && !wantsDetails && !wantsBank) {
    return aboutEmployee(employee, {
      reply: place
        ? say(
          lang,
          `${employee.name} ${placeText} पर assign ${employee.status === 'active' ? 'है' : 'थी/था (अभी disabled)'}।`,
          employee.status === 'active'
            ? `${employee.name} is assigned at ${placeText}.`
            : `${employee.name} was assigned at ${placeText} and is now disabled.`,
        )
        : say(lang, `${employee.name} अभी किसी location पर assign नहीं है।`, `${employee.name} is not assigned to any location right now.`),
    });
  }
  const yes = (value) => (lang === 'en' ? (value ? 'Yes' : 'No') : (value ? 'हाँ' : 'नहीं'));
  if (wantsBank) {
    const bankRows = [
      ['Bank', [employee.bankName, employee.bankBranch].filter(Boolean).join(', ')],
      [say(lang, 'Account', 'Account'), masked(employee.bankAccountNumber)],
      ['IFSC', employee.bankRoutingCode],
      [say(lang, 'Account name', 'Account name'), employee.bankAccountHolder || employee.name],
    ].filter(([, value]) => value);
    const missing = bankRows.length === 0
      ? say(lang, `${employee.name} की bank details employees record में नहीं हैं।`, `${employee.name} has no bank details on the employee record.`)
      : say(
        lang,
        `${employee.name} की bank details:\n${bankRows.map(([label, value]) => `• ${label}: ${value}`).join('\n')}\n(पूरा account number Employees page पर देखें।)`,
        `${employee.name}'s bank details:\n${bankRows.map(([label, value]) => `• ${label}: ${value}`).join('\n')}\n(See the full account number on the Employees page.)`,
      );
    return aboutEmployee(employee, { reply: missing });
  }
  const rows = [
    [say(lang, 'पिता/अभिभावक', 'Parent / guardian'), employee.parentName],
    ['Designation', employee.designation],
    ['Skill', employee.skillCategory],
    ['Employment type', employee.employmentType],
    ['Organization', user.role === 'admin' ? organization?.name : ''],
    ['Location', placeText],
    ['Status', employee.status === 'active' ? 'Active' : `Disabled${employee.disabledOn ? ` (${shortDate(employee.disabledOn)} से)` : ''}`],
    ['Phone', employee.phone],
    ['Email', employee.email],
    ['Date of birth', shortDate(employee.dateOfBirth)],
    ['Date of joining', shortDate(employee.dateOfJoining)],
    ['Daily wage', employee.dailySalary ? rupees(employee.dailySalary) : ''],
    ['Basic + DA', employee.basicPay || employee.dearnessAllowance ? `${rupees(employee.basicPay)} + ${rupees(employee.dearnessAllowance)}` : ''],
    ['Other allowance', employee.otherAllowanceAmount ? rupees(employee.otherAllowanceAmount) : ''],
    [say(lang, 'EPF / ESIC लागू', 'EPF / ESIC applicable'), `${yes(employee.epfoApplicable)} / ${yes(employee.esicApplicable)}`],
    ['UAN', employee.uan],
    ['ESIC no.', employee.esicNumber],
    ['Aadhaar', masked(employee.aadhaarNumber)],
    ['Bank', [employee.bankName, employee.bankBranch].filter(Boolean).join(', ')],
    ['Account', masked(employee.bankAccountNumber)],
    ['IFSC', employee.bankRoutingCode],
    ['Address', employee.address],
  ].filter(([, value]) => value);
  return aboutEmployee(employee, {
    reply: say(
      lang,
      `${employee.name} की details:\n${rows.map(([label, value]) => `• ${label}: ${value}`).join('\n')}\n(Aadhaar और account number पूरे Employees page पर देखें।)`,
      `${employee.name}'s details:\n${rows.map(([label, value]) => `• ${label}: ${value}`).join('\n')}\n(See the full Aadhaar and account number on the Employees page.)`,
    ),
  });
}

const INVOICE_WORDS = [
  'invoice', 'invoices', 'invoce', 'envoice', 'invoise', 'bill', 'billing', 'tax invoice',
  'इनवॉइस', 'इनवॉयस', 'इन्वॉइस', 'इन्वॉयस', 'इनवाइस', 'इन्वाइस', 'इनवॉइसेस', 'इनवॉइज़', 'बिल', 'बिलिंग',
];
const MAX_INVOICE_CHOICES = 12;

function invoicePlan(month, location, format, confirm = false) {
  return {
    type: 'client_invoice',
    format: format || 'pdf',
    month,
    organizationId: location.organizationId,
    locationId: location.id,
    ...(confirm ? { confirm: true } : {}),
  };
}

function invoiceDocument(plan, location) {
  return {
    type: 'client_invoice',
    format: plan.format || 'pdf',
    month: plan.month,
    organizationId: plan.organizationId,
    locationId: plan.locationId,
    employeeIds: null,
    title: `Invoice · ${locationLabel(location)} · ${monthLabel(plan.month)}`,
  };
}

/** "Colony Park का invoice बना दो" — the client invoice (bill) of one location; a bank invoice says "bank". */
function answerClientInvoice(user, message, directory, today, context) {
  if (!includesAny(message, INVOICE_WORDS) || includesAny(message, BANK_WORDS)) return null;
  if (user.role !== 'admin') return { reply: 'Invoice सिर्फ़ admin login से बनता है।' };
  const currentMonth = today.slice(0, 7);
  // Like the invoice page, the last finished month is billed unless a month is named.
  const namedMonth = parseMonth(message, currentMonth);
  const month = namedMonth || shiftMonth(currentMonth, -1);
  if (month > currentMonth) return { reply: 'आने वाले महीने का invoice नहीं बन सकता।' };
  const format = parseFormat(message);

  let organization = null;
  const organizations = matchOrganizations(message, directory);
  if (organizations.length === 1) [organization] = organizations;
  let locations = matchLocations(message, directory, organization?.id);
  if (locations.length === 0 && context?.locationIds?.length && includesAny(message, REFERENCE_WORDS)) {
    locations = directory.locations.filter((item) => context.locationIds.includes(item.id));
  }
  if (locations.length === 1) return { plan: invoicePlan(month, locations[0], format), fallbackMonth: namedMonth ? null : currentMonth };

  const pool = locations.length
    ? locations
    : directory.locations.filter((item) => item.status !== 'disabled' && (!organization || item.organizationId === organization.id));
  if (pool.length === 0) return { reply: 'कोई active location नहीं मिली।' };
  const more = pool.length > MAX_INVOICE_CHOICES ? `\n(${pool.length - MAX_INVOICE_CHOICES} और हैं — location का नाम लिखकर बताएँ।)` : '';
  return {
    reply: `${monthLabel(month)} का invoice किस location का बनाना है? (दूसरा महीना चाहिए तो उसका नाम भी लिखें)${more}`,
    choices: pool.slice(0, MAX_INVOICE_CHOICES).map((item) => choice(
      user.role === 'admin' && !organization ? `${locationLabel(item)} (${item.organizationName})` : locationLabel(item),
      { ...invoicePlan(month, item, format), ...(namedMonth ? {} : { latest: true }) },
    )),
  };
}

function invoiceLocation(plan, directory) {
  const location = directory.locations.find((item) => item.id === plan.locationId && item.organizationId === plan.organizationId);
  if (!location) throw httpError(400, 'Invalid location.');
  return location;
}

/** With no month named, an empty last month falls back to the current month. */
async function previewClientInvoice(user, requested, directory, fallbackMonth = null) {
  const location = invoiceLocation(requested, directory);
  let plan = requested;
  let preview = await previewInvoice(user, plan.organizationId, plan.locationId, { month: plan.month });
  if (fallbackMonth && fallbackMonth !== plan.month && !preview.invoice && preview.totals.netPayable <= 0) {
    const next = await previewInvoice(user, plan.organizationId, plan.locationId, { month: fallbackMonth });
    if (next.invoice || next.totals.netPayable > 0) {
      plan = { ...plan, month: fallbackMonth };
      preview = next;
    }
  }
  const period = monthLabel(plan.month);
  if (preview.invoice) {
    return {
      reply: `${locationLabel(location)} का ${period} का invoice पहले से saved है — ${preview.invoice.invoiceNumber}, Net payable ${rupees(preview.invoice.netPayable)}। नीचे से PDF या Excel download करें।`,
      document: invoiceDocument(plan, location),
    };
  }
  const { totals, attendance, suggested } = preview;
  if (preview.items.length === 0 || totals.netPayable <= 0) {
    return { reply: `${locationLabel(location)} पर ${period} की कोई billable attendance नहीं है, इसलिए invoice नहीं बन सकता।` };
  }
  return {
    reply: [
      `Invoice · ${period}`,
      locationLabel(location),
      `Invoice no. ${suggested.invoiceNumber} · RA bill ${suggested.raBillNo}`,
      `${attendance.totalManDays} man-days · Total ${rupees(totals.grandTotal)} + GST ${rupees(totals.gstAmount)} = Net payable ${rupees(totals.netPayable)}`,
      'Save करने पर यह invoice number इस्तेमाल हो जाएगा। Save करके बना दूँ?',
    ].join('\n'),
    choices: [
      choice('हाँ, save करके PDF दो', invoicePlan(plan.month, location, 'pdf', true)),
      choice('हाँ, save करके Excel दो', invoicePlan(plan.month, location, 'excel', true)),
      choice('नहीं, रहने दो', { type: 'cancel' }),
    ],
  };
}

async function confirmClientInvoice(user, plan, directory) {
  const location = invoiceLocation(plan, directory);
  const preview = await previewInvoice(user, plan.organizationId, plan.locationId, { month: plan.month });
  if (preview.invoice) return previewClientInvoice(user, plan, directory);
  if (preview.items.length === 0 || preview.totals.netPayable <= 0) {
    return { reply: `${locationLabel(location)} पर ${monthLabel(plan.month)} की कोई billable attendance नहीं है, इसलिए invoice नहीं बना।` };
  }
  try {
    const { invoice } = await saveInvoice(user, plan.organizationId, plan.locationId, plan.month, {
      invoiceNumber: preview.suggested.invoiceNumber,
      invoiceDate: preview.suggested.invoiceDate,
      raBillNo: preview.suggested.raBillNo,
      items: preview.items,
    });
    return {
      reply: `✅ Invoice ${invoice.invoiceNumber} save हो गया — ${locationLabel(location)}, ${monthLabel(plan.month)}, Net payable ${rupees(invoice.netPayable)}। नीचे से PDF या Excel download करें।`,
      document: invoiceDocument(plan, location),
    };
  } catch (error) {
    if (error.statusCode >= 400 && error.statusCode < 500) return { reply: `Invoice save नहीं हुआ: ${error.message}` };
    throw error;
  }
}

/** The question without its month words, so another month can be put in its place. */
function withoutMonth(text) {
  const monthNames = [...MONTHS.flat(), ...LAST_MONTH_WORDS, ...THIS_MONTH_WORDS];
  let rest = ` ${String(text || '').toLowerCase()} `;
  for (const name of monthNames.sort((left, right) => right.length - left.length)) {
    rest = /^[a-z ]+$/.test(name)
      ? rest.replace(new RegExp(`(^|[^a-z])${name}(?=[^a-z]|$)`, 'g'), '$1 ')
      : rest.split(name).join(' ');
  }
  return rest.replace(/\b20\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function whatCanBeMade(user, lang = 'hi') {
  if (lang === 'en') {
    const lines = [
      '• Salary slip',
      '• Wages sheet (FORM XVII)',
      '• Attendance register (FORM XVI)',
      ...(user.role === 'admin'
        ? ['• Payroll (one location / organization / one employee)', '• Bank invoice (NEFT letter)', '• Location invoice (bill)', '• Mark and edit attendance']
        : ['• Payroll', '• Mark today’s attendance']),
    ];
    return `I can create:\n${lines.join('\n')}\nTry: "Which locations can get October payroll?" or "Children's Park November wages sheet".`;
  }
  const lines = [
    '• Salary slip',
    '• Wages sheet (FORM XVII)',
    '• Attendance register (FORM XVI)',
    ...(user.role === 'admin'
      ? ['• Payroll (location / organization / किसी एक employee का)', '• Bank invoice (NEFT letter)', '• Location का invoice (bill)', '• Attendance लगाना और edit करना']
      : ['• Payroll', '• आज की attendance लगाना']),
  ];
  return `मैं ये बना सकती हूँ:\n${lines.join('\n')}\nजैसे पूछें: "October का payroll किन locations का बन सकता है?" या "Children's Park की November की wages sheet"।`;
}

async function loadSession(user, sessionId) {
  if (sessionId && mongoose.isValidObjectId(sessionId)) {
    const session = await AssistantSession.findOne({ _id: sessionId, userId: user.id });
    if (session) return session;
  }
  return new AssistantSession({ userId: user.id });
}

function publicSessionMessage(item) {
  return { role: item.role, content: item.content, ...(item.document ? { document: item.document } : {}) };
}

async function getSession(user, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, 'Invalid chat id.');
  const session = await AssistantSession.findOne({ _id: sessionId, userId: user.id }).lean();
  if (!session) throw httpError(404, 'Chat not found.');
  return { sessionId: String(session._id), messages: session.messages.map(publicSessionMessage), expiresAt: session.expiresAt };
}

async function deleteSession(user, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, 'Invalid chat id.');
  await AssistantSession.deleteOne({ _id: sessionId, userId: user.id });
  return { deleted: true };
}

/** One chat turn: answers from this chat's saved memory (24 h), then stores the question, answer and anything done. */
async function chat(user, input = {}) {
  const session = await loadSession(user, input.sessionId);
  const userText = typeof input.message === 'string' && input.message.trim()
    ? input.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : typeof input.label === 'string' ? input.label.trim().slice(0, 200) : '';
  const state = {};
  const { context, ...response } = await respond(user, input, session, state);

  const assistantTurns = session.messages.filter((item) => item.role === 'assistant').length;
  const lang = state.lang || preferLang(input.language, userText, messageLang(userText, session));
  const localized = await localizeAnswer(response, lang);
  if (context) {
    session.context = {
      ...context,
      employeeId: context.employeeId || session.context?.employeeId || null,
      employeeName: context.employeeName || session.context?.employeeName || null,
      query: state.message || userText,
      turn: assistantTurns,
      lang,
    };
  }
  else if (userText) session.context = { ...(session.context || {}), lang };
  if (userText) session.messages.push({ role: 'user', content: userText });
  session.messages.push({ role: 'assistant', content: String(localized.reply || '').slice(0, 4000), document: localized.document || null });
  if (session.messages.length > MAX_SESSION_MESSAGES) session.messages.splice(0, session.messages.length - MAX_SESSION_MESSAGES);
  if (input.plan?.confirm === true && String(localized.reply || '').startsWith('✅')) {
    session.actions.push({ text: localized.reply.split('\n')[0].replace(/^✅\s*/, '').slice(0, 500) });
  } else if (localized.document) {
    session.actions.push({ text: say(lang, `Document तैयार किया: ${localized.document.title}`, `Document ready: ${localized.document.title}`).slice(0, 500) });
  }
  session.markModified('context');
  await session.save();
  return { ...localized, sessionId: String(session._id) };
}

async function respond(user, input, session, state = {}) {
  const today = todayIn(input.timeZone);
  const directory = await loadDirectory(user);
  const assistantTurns = session.messages.filter((item) => item.role === 'assistant').length;
  const context = session.context && assistantTurns - session.context.turn <= CONTEXT_TURNS ? session.context : null;
  const spoken = typeof input.message === 'string' ? input.message : '';
  const lang = preferLang(input.language, spoken, messageLang(spoken, session));
  state.lang = lang;

  if (input.plan && typeof input.plan === 'object') {
    const { plan } = input;
    if (plan.type === 'cancel') {
      return { reply: say(lang, 'ठीक है, कुछ नहीं बदला।', 'Okay, nothing was changed.'), source: 'plan' };
    }
    if (plan.type === 'mark_attendance') {
      if (!mongoose.isValidObjectId(plan.locationId) || !mongoose.isValidObjectId(plan.organizationId)) throw httpError(400, 'Invalid location.');
      if (plan.employeeId && !mongoose.isValidObjectId(plan.employeeId)) throw httpError(400, 'Invalid employee id.');
      if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
      const markPlan = {
        type: 'mark_attendance',
        organizationId: String(plan.organizationId),
        locationId: String(plan.locationId),
        month: plan.month,
        status: ATTENDANCE_STATUSES.includes(plan.status) ? plan.status : 'present',
        employeeId: plan.employeeId ? String(plan.employeeId) : null,
      };
      const answer = plan.confirm === true
        ? await confirmMarkAttendance(user, markPlan, directory, today, input.timeZone)
        : await previewMarkAttendance(user, markPlan, directory, today, input.timeZone);
      return { ...answer, source: 'plan' };
    }
    if (plan.type === 'mark_attendance_batch') {
      if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
      const locations = (Array.isArray(plan.locations) ? plan.locations : [])
        .filter((item) => item && mongoose.isValidObjectId(item.locationId) && mongoose.isValidObjectId(item.organizationId))
        .map((item) => ({ organizationId: String(item.organizationId), locationId: String(item.locationId) }));
      if (locations.length === 0) throw httpError(400, 'Invalid location.');
      const batchPlan = {
        type: 'mark_attendance_batch',
        month: plan.month,
        status: ATTENDANCE_STATUSES.includes(plan.status) ? plan.status : 'present',
        locations,
      };
      const answer = plan.confirm === true
        ? await confirmMarkAttendanceBatch(user, batchPlan, directory, today, input.timeZone)
        : await previewMarkAttendanceBatch(user, batchPlan, directory, today, input.timeZone);
      return { ...answer, source: 'plan' };
    }
    if (plan.type === 'bank_invoice' || plan.type === 'payroll_run') {
      const kind = plan.type === 'payroll_run' ? 'payroll' : 'bank';
      if (user.role !== 'admin') {
        return {
          reply: say(lang, `${RUN_KINDS[kind].label} सिर्फ़ admin login से बनता है।`, `${RUN_KINDS[kind].label} can only be created from an admin login.`),
          source: 'plan',
        };
      }
      const run = runPlanFromInput(kind, plan, today);
      const answer = plan.confirm === true
        ? await confirmPaymentRun(kind, user, run, directory, today, lang)
        : await previewPaymentRun(kind, user, run, directory, lang);
      return { ...answer, source: 'plan' };
    }
    if (plan.type === 'employee_attendance') {
      if (!mongoose.isValidObjectId(plan.employeeId)) throw httpError(400, 'Invalid employee id.');
      if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
      const scope = user.role === 'admin' ? { organizationId: { $ne: null } } : { organizationId: user.id };
      const employee = await Employee.exists({ _id: plan.employeeId, ...scope });
      if (!employee) throw httpError(404, 'Employee not found.');
      const status = ATTENDANCE_STATUSES.includes(plan.status) ? plan.status : null;
      return { reply: await employeeAttendanceReply(plan.employeeId, plan.month, status, today), source: 'plan' };
    }
    if (plan.type === 'salary_amount') {
      if (user.role !== 'admin') return { reply: 'Salary का हिसाब सिर्फ़ admin login से मिलता है।', source: 'plan' };
      if (!mongoose.isValidObjectId(plan.employeeId)) throw httpError(400, 'Invalid employee id.');
      if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
      const employee = await Employee.findOne({ _id: plan.employeeId, organizationId: { $ne: null } }).select('name locationId').lean();
      if (!employee) throw httpError(404, 'Employee not found.');
      if (plan.full === true) return { reply: await fullMonthSalaryReply(employee._id, plan.month), source: 'plan' };
      const entry = { id: String(employee._id), name: employee.name, locationId: employee.locationId ? String(employee.locationId) : '' };
      return { reply: await payrollAmountReply(user, directory, plan.month, { employee: entry, locations: [], organization: null }), source: 'plan' };
    }
    if (plan.type === 'client_invoice') {
      if (user.role !== 'admin') return { reply: 'Invoice सिर्फ़ admin login से बनता है।', source: 'plan' };
      if (!mongoose.isValidObjectId(plan.locationId) || !mongoose.isValidObjectId(plan.organizationId)) throw httpError(400, 'Invalid location.');
      if (!isMonth(plan.month) || plan.month > today.slice(0, 7)) throw httpError(400, 'Select a valid month.');
      const invoice = {
        month: plan.month,
        organizationId: String(plan.organizationId),
        locationId: String(plan.locationId),
        format: plan.format === 'excel' ? 'excel' : 'pdf',
      };
      const answer = plan.confirm === true
        ? await confirmClientInvoice(user, invoice, directory)
        : await previewClientInvoice(user, invoice, directory, plan.latest === true ? today.slice(0, 7) : null);
      return { ...answer, source: 'plan' };
    }
    if (plan.type === 'edit_attendance') {
      const editPlan = editPlanFromInput(plan, today);
      const answer = plan.confirm === true
        ? await confirmEditAttendance(user, editPlan, directory, today, input.timeZone)
        : await previewEditAttendance(user, editPlan, directory, today, input.timeZone);
      return { ...answer, source: 'plan' };
    }
    return { ...(await resolvePlan(user, plan, directory, { today })), source: 'plan' };
  }

  let message = typeof input.message === 'string' ? input.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  if (!message) throw httpError(400, 'Type or speak what you need.');
  const history = sanitizeHistory(session.messages.map((item) => ({ role: item.role, content: item.content })));
  // Keep the user's words for memory/context; enrich a copy so Hindi + English rules both match.
  const originalMessage = message;
  message = enrichMessageForRules(message);

  const memory = answerMemory(originalMessage, session);
  if (memory) return { reply: memory, source: 'data' };

  // "aur September ka" / "October ki organisation" repeats the previous question for another month.
  if (context?.query && words(message).length <= 5 && parseMonth(message, today.slice(0, 7))
    && !runKindOf(message) && !parseType(message) && !includesAny(message, ATTENDANCE_WORDS) && !parseStatus(message)
    && matchLocations(message, directory).length === 0) {
    message = `${withoutMonth(context.query)} ${message}`;
  }

  if (includesAny(message, CAN_BE_MADE_WORDS) && includesAny(message, ['kya', 'kya kya', 'what', 'क्या', 'क्या-क्या'])
    && !includesAny(message, COUNT_WORDS) && !includesAny(message, LIST_WORDS)
    && !runKindOf(message) && !parseType(message) && !includesAny(message, ATTENDANCE_WORDS)
    && !DATA_TOPICS.some(([, list]) => includesAny(message, list)) && matchLocations(message, directory).length === 0) {
    return { reply: whatCanBeMade(user, lang), source: 'data' };
  }

  // A bare location name ("Children's Park") continues the previous request, or asks what is needed there.
  const lone = words(message).length <= 4 && !parseType(message) && !includesAny(message, ATTENDANCE_WORDS) && !runKindOf(message) && !includesAny(message, INVOICE_WORDS)
    ? matchLocations(message, directory)
    : [];
  if (lone.length > 0) {
    const previous = [...history].reverse().find((item) => item.role === 'user')?.content || '';
    if (parseType(previous) || includesAny(previous, ATTENDANCE_WORDS) || runKindOf(previous)) {
      message = `${previous} ${message}`;
    } else if (lone.length === 1) {
      const [location] = lone;
      const month = today.slice(0, 7);
      const isAdmin = user.role === 'admin';
      return {
        reply: `${locationLabel(location)} के लिए क्या चाहिए?`,
        choices: [
          ...['attendance_register', 'wage_register', 'salary_slip', ...(isAdmin ? [] : ['payroll'])].map((type) => ({
            label: `${ABILITY_LABELS[type]} (${monthLabel(month)})`,
            plan: { type, format: 'pdf', month, organizationId: location.organizationId, locationId: location.id },
          })),
          ...(isAdmin
            ? [
              { label: `Payroll (${monthLabel(month)})`, plan: runPlan('payroll', month, 'pdf', { locationIds: [location.id] }) },
              { label: `Bank Invoice (${monthLabel(month)})`, plan: runPlan('bank', month, 'pdf', { locationIds: [location.id] }) },
            ]
            : []),
        ],
        source: 'rules',
      };
    }
  }

  // Answer to "किस तारीख पर…?": dates ("5, 6 तारीख") or "randomly लगा दो".
  if (context?.topic === 'edit_dates' && context.plan && words(message).length <= 8 && !parseStatus(message) && !parseType(message) && !runKindOf(message)) {
    const pending = editPlanFromInput(context.plan, today);
    const dates = includesAny(message, RANDOM_WORDS)
      ? randomDates(workingDatesOf(pending.month, today), pending.count || 1)
      : parseDates(`${message} tarikh`, pending.month, today).filter((date) => date.startsWith(pending.month));
    if (dates.length > 0) {
      const answer = await previewEditAttendance(user, { ...pending, dates }, directory, today, input.timeZone);
      return { ...answer, context: answer.context || { topic: 'edit_done' }, source: 'data' };
    }
  }

  // Only dates ("5 तारीख", "कल") continue the last attendance change request.
  if (words(message).length <= 6 && !parseStatus(message) && parseDates(message, today.slice(0, 7), today).length > 0) {
    const previous = [...history].reverse().find((item) => item.role === 'user' && parseStatus(item.content))?.content;
    if (previous) message = `${previous} ${message}`;
  }

  state.message = originalMessage;
  const acronym = answerAcronym(message, lang);
  if (acronym) return { ...acronym, source: 'data' };

  const employeeDetails = await answerEmployeeDetails(user, message, directory, lang, session.context);
  if (employeeDetails) return { ...employeeDetails, source: 'data' };

  const staffing = await answerLocationStaffing(user, message, directory);
  if (staffing) return { ...staffing, source: 'data' };

  // "Colony Park वाले का बना दो" right after "किन locations का payroll बन सकता है" means that kind of run.
  if (context?.topic === 'run_status' && !runKindOf(message) && !parseType(message) && !includesAny(message, INVOICE_WORDS)
    && !includesAny(message, DETAIL_WORDS) && !includesAny(message, WHEREABOUTS_WORDS)
    && includesAny(message, MAKE_WORDS)) {
    const named = matchLocations(message, directory).filter((item) => context.locationIds.includes(item.id));
    if (named.length > 0 || includesAny(message, REFERENCE_WORDS)) message = `${message} ${RUN_KINDS[context.kind].lower}`;
  }

  const followUp = await answerFromContext(user, message, directory, context);
  if (followUp) return { ...followUp, source: 'data' };

  const invoiceRequest = answerClientInvoice(user, message, directory, today, context);
  if (invoiceRequest) {
    if (!invoiceRequest.plan) return { ...invoiceRequest, source: 'data' };
    return { ...(await previewClientInvoice(user, invoiceRequest.plan, directory, invoiceRequest.fallbackMonth)), source: 'data' };
  }

  const runRequest = await answerPaymentRun(user, message, directory, today, context, lang);
  if (runRequest) {
    if (!runRequest.plan) return { ...runRequest, source: 'data' };
    const kind = runRequest.plan.type === 'payroll_run' ? 'payroll' : 'bank';
    return { ...(await previewPaymentRun(kind, user, runRequest.plan, directory, lang)), source: 'data' };
  }

  const employeeAttendance = await answerEmployeeAttendance(user, message, directory, today);
  if (employeeAttendance) return { ...employeeAttendance, source: 'data' };

  const editRequest = await answerEditAttendance(user, message, directory, today);
  if (editRequest) {
    if (!editRequest.plan) return { ...editRequest, source: 'data' };
    return { ...(await previewEditAttendance(user, editRequest.plan, directory, today, input.timeZone)), source: 'data' };
  }

  const markRequest = await answerMarkAttendance(user, message, directory, today);
  if (markRequest) {
    if (!markRequest.plan) return { ...markRequest, source: 'data' };
    return { ...(await previewMarkAttendance(user, markRequest.plan, directory, today, input.timeZone)), source: 'data' };
  }

  const out = {};
  const attendanceAnswer = await answerAttendanceStatus(user, message, directory, today, input.timeZone, out);
  if (attendanceAnswer) return { reply: attendanceAnswer, context: out.context, source: 'data' };
  if (!parseType(message)) {
    // Use the raw user text so enrich tokens ("employee list names") do not pollute name searches.
    const dataAnswer = await answerDataQuestion(user, originalMessage, directory, out, lang);
    if (dataAnswer) return { reply: dataAnswer, context: out.context, source: 'data' };
  }

  const summary = await dataSummary(user, directory);
  const { result, error, quiet } = await askModel(message, history, directory, today, summary);
  if (result) {
    if (result.intent === 'chat' || !DOCUMENT_TYPES.includes(result.type)) {
      const reply = typeof result.reply === 'string' && result.reply.trim() ? result.reply.trim().slice(0, 1000) : helpReply(lang);
      return { reply, source: 'ai' };
    }
    const draft = {
      ...result,
      format: result.format || parseFormat(message),
      employeeName: typeof result.employeeName === 'string' && result.employeeName.trim() ? result.employeeName.trim().slice(0, 100) : null,
    };
    return { ...(await resolvePlan(user, draft, directory, { message, today })), source: 'ai' };
  }

  if (!quiet && process.env.NODE_ENV !== 'test') console.warn(`Assistant model unavailable, using rules: ${error}`);
  const draft = await interpretWithRules(user, message, directory, today);
  if (!draft.type) {
    const smallTalk = SMALL_TALK.find(({ words: list }) => includesAny(message, list));
    if (smallTalk) return { reply: smallTalkReply(smallTalk, lang), source: 'rules' };
    return { reply: helpReply(lang), source: 'rules' };
  }
  if (includesAny(message, ABILITY_WORDS) && !includesAny(message, MAKE_WORDS) && !includesAny(message, ALL_WORDS)
    && !draft.month && !draft.locationId && !draft.organizationId && !draft.employeeName && !draft.format) {
    return {
      reply: say(lang, `हाँ, मैं ${ABILITY_LABELS[draft.type]} बनाने में मदद कर सकती हूँ।`, `Yes, I can help you create ${ABILITY_LABELS[draft.type]}.`),
      source: 'rules',
    };
  }
  return { ...(await resolvePlan(user, draft, directory, { message, today })), source: 'rules' };
}

module.exports = { chat, deleteSession, getSession, parseCount, parseDates, parseFormat, parseMonth, parseStatus, parseType, skeleton };
