/**
 * Language bridge for Shreeji Assistant.
 * - enrichMessageForRules: keeps the original text (so old Hindi rules still match)
 *   and silently appends English intent words so English rules match too.
 * - localizeAnswer: rewrites reply/choices into the user's preferred language
 *   without changing plans or document payloads.
 */

function includesAny(text, list) {
  const lower = String(text || '').toLowerCase();
  return list.some((word) => (/^[a-z ]+$/i.test(word)
    ? new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(lower)
    : lower.includes(String(word).toLowerCase())));
}

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(String(text || ''));
}

/** Hindi / Hinglish / STT variants → English tokens appended for rule matching. */
const INTENT_BRIDGES = [
  {
    add: ['payroll', 'generate'],
    when: [
      'पैरोल', 'पेरोल', 'पेरोल्', 'पेरॉल', 'पैरॉल', 'पेयरोल', 'petrol', 'पेट्रोल',
      'pahalvan', 'pahalwan', 'pehalvan', 'pehelwan', 'पहलवान',
      'pairon', 'pairol', 'pairo', 'payron', 'peiron', 'perol',
      'pairon seat', 'pairon sheet', 'pairol seat', 'payroll seat', 'petrol seat',
    ],
  },
  // STT: "wage sheet" → "veg sheet" / "which sheet" / "vej sheet"
  {
    add: ['wage', 'wages', 'sheet', 'generate'],
    when: [
      'veg sheet', 'vegsheet', 'veg seat', 'vej sheet', 'veggies sheet', 'veggie sheet',
      'which sheet', 'wich sheet', 'वेज शीट', 'वेज सीट', 'वेजशीट', 'वेज', 'वेतन सीट',
    ],
  },
  // Status only — do not force "locations" here; "डीएक्टिवेट एम्पलाई" must stay an employee query.
  { add: ['disabled', 'inactive'], when: ['डीएक्टिव', 'डीऐक्टिव', 'डिएक्टिव', 'डीएक्टिवेट', 'डिएक्टिवेट', 'आईएनएक्टिव', 'इनएक्टिव', 'इनऐक्टिव', 'निष्क्रिय', 'deactive', 'deactivate', 'deactivated', 'disabled', 'inactive', 'डिसेबल्ड', 'डिसेबल'] },
  { add: ['active'], when: ['एक्टिव', 'ऐक्टिव', 'सक्रिय', 'enabled', 'operational', 'running', 'working', 'chalu', 'chal rahi', 'chal rahe', 'chal raha', 'चालू', 'चल रही', 'चल रहे'] },
  { add: ['disabled', 'inactive', 'locations', 'list', 'names'], when: ['डीएक्टिव लोकेशन', 'डीएक्टिव location', 'disabled location', 'inactive location', 'disabled locations', 'inactive locations'] },
  { add: ['active', 'locations', 'list', 'names'], when: ['एक्टिव लोकेशन', 'एक्टिव location', 'active location', 'active locations'] },
  { add: ['organization', 'organizations', 'company', 'companies'], when: [
    'firm', 'firms', 'business', 'businesses', 'clients', 'corporate', 'corporates', 'party', 'parties', 'accounts',
    'companiyan', 'companyan', 'kampaniyan', 'campaniyan', 'kompaniyan',
    'फर्म', 'बिज़नेस', 'पार्टियां', 'अकाउंट', 'कंपनियां', 'कंपनियाँ',
  ] },
  { add: ['count', 'total', 'how many'], when: ['संख्या', 'number of', 'numbers', 'headcount', 'ginti', 'गिनती'] },
  { add: ['employee', 'employees'], when: ['manpower', 'workforce', 'bande', 'मैनपावर', 'बंदे'] },
  { add: ['active'], when: ['alive', 'live', 'onboarded', 'लाइव'] },
  { add: ['disabled', 'inactive'], when: ['band', 'closed', 'बंद'] },
  { add: ['location', 'locations'], when: ['unit', 'units', 'plant', 'plants', 'यूनिट', 'प्लांट'] },
  { add: ['list', 'names'], when: ['roster', 'dump', 'nikaal'] },
  { add: ['payroll', 'salary'], when: ['payslip', 'tanakhwa', 'तनख्वाह'] },
  { add: ['attendance'], when: ['हाजिरी', 'हाज़िरी', 'हाजरी', 'hajiri', 'haziri', 'hajri', 'अटेंडेंस', 'अटेंडन्स', 'एटर्नीज', 'एटर्नी', 'अटर्नीज', 'अटॉर्नीज', 'attorneys', 'attorney'] },
  { add: ['present'], when: ['उपस्थित', 'परसेंट', 'पर्सेंट', 'प्रसेंट', 'प्रजेंट', 'परेजेंट', 'प्रेजेंट'] },
  { add: ['absent'], when: ['अनुपस्थित', 'एब्सेंट', 'absant'] },
  { add: ['mark', 'attendance', 'present'], when: ['मार्क करके', 'मार्क कर दो', 'प्रजेंट मार्क', 'प्रेजेंट मार्क', 'हाजिरी लगा', 'attendance लगा'] },
  { add: ['salary'], when: ['सैलरी', 'सेलरी', 'वेतन', 'तनख्वाह', 'तनखा', 'पगार', 'pagar'] },
  { add: ['invoice', 'bill'], when: ['इनवॉइस', 'इनवोस', 'बिल'] },
  { add: ['bank', 'invoice', 'neft'], when: ['नेफ्ट', 'एनईएफटी'] },
  { add: ['bank', 'details'], when: ['बैंक डिटेल', 'बैंक डिटेल्स', 'बैंक डीटेल', 'खाता', 'आईएफएससी'] },
  // Full words only — stems like "एम्पल" were also matching "एम्पलाई/एंपलॉयर" and polluting name counts.
  // "एंपलॉयर/employer" is STT for employee; name extraction still strips these via nameJunk / NOT_PERSON_NAMES.
  { add: ['employee', 'employees', 'list', 'names'], when: ['एम्प्लॉई', 'एम्प्लोई', 'इम्प्लॉई', 'एम्पलाई', 'एंप्लॉई', 'एंपलॉयर', 'एम्पलॉयर', 'एम्प्लॉयर', 'कर्मचारी', 'स्टाफ', 'employees', 'employee', 'employer'] },
  { add: ['location', 'locations', 'list', 'names'], when: ['लोकेशन', 'लोकेशंस', 'लोकेशन्स', 'साइट', 'साइट्स'] },
  { add: ['organization', 'organizations'], when: ['ऑर्गेनाइजेशन', 'ऑर्गनाइजेशन', 'संगठन', 'क्लाइंट'] },
  { add: ['create', 'make', 'generate'], when: ['बना दो', 'बनाओ', 'बनाना', 'जनरेट', 'निकाल', 'निकालो', 'कर दो'] },
  { add: ['all'], when: ['सभी', 'सारे', 'सारी', 'सबका', 'सबकी', 'sabhi', 'saare'] },
  { add: ['both', 'locations'], when: ['दोनों', 'dono', 'donon'] },
  { add: ['what can you do'], when: ['क्या कर सकती', 'क्या क्या कर', 'क्या-क्या कर', 'क्या कर सकते'] },
  { add: ['who are you'], when: ['कौन हो', 'परिचय'] },
  { add: ['details', 'info'], when: ['who is', "who's", 'detailed', 'कौन है', 'कौन हैं', 'डिटेल', 'डिटेल्स', 'जानकारी'] },
  { add: ['uan', 'number'], when: ['यूएएन', 'यू एन', 'यूएन', 'un number', 'uan number'] },
  { add: ['address'], when: ['पता', 'एड्रेस', 'एडरेस', 'adress', 'addres'] },
  { add: ['joining', 'date'], when: ['जॉइनिंग', 'ज्वाइनिंग', 'जॉइन डेट', 'joining date'] },
  { add: ['mobile', 'number'], when: ['मोबाइल', 'फोन नंबर', 'फ़ोन'] },
  { add: ['aadhaar'], when: ['आधार', 'आधार कार्ड'] },
  { add: ['text', 'attendance'], when: ['टेक्स्ट में', 'टेक्स्ट मे', 'text में', 'text mein', 'in text', 'नॉर्मली टेक्स्ट', 'normal text'] },
  { add: ['subba'], when: ['सुबह', 'सुभ', 'सभा', 'सुब्बा', 'सुबा'] },
  { add: ['limbu'], when: ['नींबू', 'निम्बू', 'लिम्बू', 'लिम्बु'] },
  { add: ['uan', 'full form'], when: ['नीम का फुल', 'नीम फुल', 'uan full', 'यूएएन'] },
  { add: ['where', 'assign', 'location'], when: ['kahan', 'kaha', 'कहाँ', 'कहां', 'sign', 'assign', 'साइन', 'असाइन'] },
  { add: ['thank you'], when: ['धन्यवाद', 'शुक्रिया'] },
  { add: ['names', 'list', 'tell'], when: ['नाम बताओ', 'नाम बताइए', 'नाम बताएं', 'नाम दो', 'नाम दे', 'नाम दे दो', 'बताओ', 'बताइए'] },
  { add: ['random'], when: ['रैंडम', 'रेंडम', 'randomly', 'कोई भी', 'खुद से'] },
  { add: ['rest', 'remaining', 'days'], when: ['बाकी सब', 'बाकी दिन', 'बचे हुए', 'baki sab', 'baaki'] },
  // Confirmation of a prior payroll/bank prompt only — never bare "both locations" (employee follow-ups).
  { add: ['both', 'locations', 'payroll', 'generate'], when: ['yeah ok both', 'ok both', 'yeah ok both locations', 'ok both locations'] },
];

/** Longest-first phrase pairs: [hindi, english] */
const REPLY_PHRASES = [
  ['माफ़ कीजिए, मैं समझ नहीं पाई। आपको कौन-सा document चाहिए?', "Sorry, I didn't catch that. Which document do you need?"],
  ['इस chat में अभी तक database में कोई बदलाव नहीं किया।', 'No database changes have been made in this chat yet.'],
  ['आपने इस chat में ये पूछा:', 'You asked this in this chat:'],
  ['मैं HR, Payroll, Attendance और Document Management से जुड़े कामों में मदद कर सकती हूँ।', 'I can help with HR, Payroll, Attendance and Document Management.'],
  ['मैं HR, Payroll, Attendance और Document Management से जुड़े कामों में मदद कर सकती हूँ.', 'I can help with HR, Payroll, Attendance and Document Management.'],
  ['हाँ, मैं English और Hindi दोनों समझती हूँ। English में भी पूछ सकते हैं।', 'Yes, I understand English and Hindi. You can ask me in English too.'],
  ['मैं श्रीजी हूँ, Shreeji Caretaker की AI Assistant।', "I'm Shreeji, the AI Assistant of Shreeji Caretaker."],
  ['मेरा नाम श्रीजी है।', 'My name is Shreeji.'],
  ['मैं Shreeji Caretaker के लिए AI Assistant हूँ।', 'I am the AI Assistant for Shreeji Caretaker.'],
  ['मैं Shreeji Caretaker के लिए काम करती हूँ।', 'I work for Shreeji Caretaker.'],
  ['नमस्ते! 😊', 'Hello! 😊'],
  ['आपका स्वागत है! 😊', "You're welcome! 😊"],
  ['कोई disabled/inactive location नहीं है', 'there are no disabled/inactive locations'],
  ['disabled/inactive location नहीं है', 'no disabled/inactive locations'],
  ['आपके dashboard में ये', 'On your dashboard these'],
  ['आपके dashboard में', 'On your dashboard'],
  ['active employees हैं', 'active employees'],
  ['active employee है', 'active employee'],
  ['active locations हैं', 'active locations'],
  ['active location है', 'active location'],
  ['organizations हैं', 'organizations'],
  ['organization है', 'organization'],
  ['disabled/inactive locations हैं', 'disabled/inactive locations'],
  ['disabled location हैं', 'disabled locations'],
  ['का payroll बन सकता है', 'can get payroll'],
  ['का bank invoice बन सकता है', 'can get a bank invoice'],
  ['बन सकता है', 'can be created'],
  ['बन चुका है', 'is already done'],
  ['की details:', "'s details:"],
  ['पिता/अभिभावक', 'Parent / guardian'],
  ['EPF / ESIC लागू', 'EPF / ESIC applicable'],
  ['किसी location पर नहीं', 'Not assigned to any location'],
  ['अभी किसी location पर assign नहीं है', 'is not assigned to any location right now'],
  ['पर assign है', 'is assigned at'],
  ['इस नाम से', 'For this name,'],
  ['employees मिले:', 'employees matched:'],
  ['पूरा नाम बताइए।', 'Please give the full name.'],
  ['किस location का बनाना है?', 'Which location should I create it for?'],
  ['किस location की attendance बदलनी है?', 'Which location’s attendance should I change?'],
  ['कौन-सी तारीख़ों पर', 'which dates should be marked'],
  ['बाकी सभी working days', 'and the remaining working days will be'],
  ['Sunday नहीं बदलेंगे।', 'Sundays will not be changed.'],
  ['entries बदलेंगी', 'entries will change'],
  ['पहले से सही हैं', 'are already correct'],
  ['Confirm करें?', 'Confirm?'],
  ['बना दूँ?', 'Create it?'],
  ['ठीक है, कुछ नहीं बदला।', 'Okay, nothing was changed.'],
  ['मैं ये बना सकती हूँ:', 'I can create:'],
  ['जैसे पूछें:', 'For example:'],
  ['employees मिले — किसकी', 'employees matched — whose'],
  ['employees मिले — किसका', 'employees matched — whose'],
  ['locations मिलीं — किसका', 'locations matched — whose'],
  ['सभी pending locations एक साथ', 'All pending locations together'],
  ['ये सभी', 'All these'],
  ['locations एक साथ', 'locations together'],
  ['हाँ, attendance लगा दो', 'Yes, mark attendance'],
  ['हाँ, PDF (salary slips) बना दो', 'Yes, create PDF (salary slips)'],
  ['हाँ, PDF (salary slip) बना दो', 'Yes, create PDF (salary slip)'],
  ['हाँ, PDF बना दो', 'Yes, create PDF'],
  ['हाँ, Excel बना दो', 'Yes, create Excel'],
  ['नहीं, रहने दो', 'No, cancel'],
  ['Random 2 working days', 'Random 2 working days'],
  ['पिछले', 'Last'],
  ['working days', 'working days'],
  ['बनाने पर ये locations', 'Creating this will mark these locations'],
  ['बनाने पर यह location', 'Creating this will mark this location'],
  ['के लिए printed मार्क हो जाएँगी।', 'as printed.'],
  ['के लिए printed मार्क हो जाएगी।', 'as printed.'],
  ['Net payable', 'Net payable'],
  ['paid days', 'paid days'],
  ['यह Payroll history में', 'This will be saved in Payroll history under'],
  ['के नाम से जुड़ जाएगा।', '.'],
  ['कोई active employee नहीं है', 'there are no active employees'],
  ['कोई active location नहीं मिली', 'no active location was found'],
  ['सिर्फ़ admin login से', 'only from an admin login'],
  ['सवाल पूछे हैं — पहला था:', 'questions asked — the first was:'],
  ['इस chat में अभी तक कुछ नहीं हुआ।', 'Nothing has happened in this chat yet.'],
];

const CHOICE_PHRASES = REPLY_PHRASES.filter(([hi, en]) => hi.length <= 60 && en.length <= 60);

function preferLang(inputLanguage, message, fallbackLang = 'hi') {
  const selected = String(inputLanguage || '').trim().toLowerCase();
  if (selected.startsWith('en')) return 'en';
  if (selected.startsWith('hi')) return 'hi';
  return fallbackLang === 'en' || fallbackLang === 'hi' ? fallbackLang : 'hi';
}

/**
 * Keeps the user's text intact and appends English intent words.
 * Existing Hindi/English rules both keep working.
 */
// "डीएक्टिवेट".includes("एक्टिव") is true — do not treat deactivate as active.
const DEACTIVATE_MARKERS = [
  'डीएक्टिव', 'डीऐक्टिव', 'डिएक्टिव', 'डीएक्टिवेट', 'डिएक्टिवेट',
  'deactive', 'deactivate', 'deactivated', 'disabled', 'inactive', 'डिसेबल्ड', 'डिसेबल',
];

function enrichMessageForRules(message) {
  const text = String(message || '');
  if (!text.trim()) return text;
  const extras = [];
  const seen = new Set();
  const deactivated = includesAny(text, DEACTIVATE_MARKERS);
  for (const bridge of INTENT_BRIDGES) {
    if (!includesAny(text, bridge.when)) continue;
    // Skip bare "active" enrichment when the user said deactivate/disabled.
    if (deactivated && bridge.add.includes('active') && !bridge.add.includes('disabled')) continue;
    for (const token of bridge.add) {
      const key = token.toLowerCase();
      if (seen.has(key) || includesAny(text, [token])) continue;
      seen.add(key);
      extras.push(token);
    }
  }
  if (extras.length === 0) return text;
  return `${text} ${extras.join(' ')}`.slice(0, 2000);
}

function applyPhrases(text, lang) {
  let out = String(text || '');
  const pairs = [...REPLY_PHRASES].sort((left, right) => Math.max(right[0].length, right[1].length) - Math.max(left[0].length, left[1].length));
  for (const [hi, en] of pairs) {
    if (lang === 'en') {
      if (out.includes(hi)) out = out.split(hi).join(en);
    } else if (!hasDevanagari(out) && out.includes(en) && en.length >= 12) {
      // Skip mixed Hinglish replies — swapping "active employee" inside "active employees हैं" made "हैs हैं हैं".
      out = out.split(en).join(hi);
    }
  }
  if (lang === 'en') {
    out = out
      .replace(/हैs/g, 's')
      .replace(/\bemployee हैs\b/gi, 'employees')
      .replace(/\bemployees?\s+हैं(\s+हैं)*/gi, (match) => (/\bemployee\b/i.test(match) && !/employees/i.test(match) ? 'employees' : match.replace(/\s*हैं/g, '')))
      .replace(/\bहैं(\s+हैं)+/g, '')
      .replace(/\bहैं\./g, '.')
      .replace(/\bहै\./g, '.')
      .replace(/\s+हैं\b/g, '')
      .replace(/\s+है\b/g, '')
      .replace(/\s+का\s+/g, ' ')
      .replace(/\s+की\s+/g, ' ')
      .replace(/\s+के\s+/g, ' ')
      .replace(/\s+में\s+/g, ' ')
      .replace(/\s+पर\s+/g, ' at ')
      .replace(/\s+और\s+/g, ' and ')
      .replace(/।/g, '.')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .trim();
  }
  return out;
}

function applyChoicePhrases(label, lang) {
  let out = String(label || '');
  for (const [hi, en] of CHOICE_PHRASES) {
    if (lang === 'en' && out.includes(hi)) out = out.split(hi).join(en);
    if (lang === 'hi' && out.includes(en) && en.length >= 8) out = out.split(en).join(hi);
  }
  return out;
}

function localizeText(text, lang) {
  const original = String(text || '');
  if (!original) return original;
  // Phrase dictionary only — no external translate LLM (keeps replies fast).
  return applyPhrases(original, lang);
}

function localizeAnswer(answer, lang) {
  if (!answer || (lang !== 'en' && lang !== 'hi')) return answer;
  const reply = localizeText(answer.reply, lang);
  const choices = Array.isArray(answer.choices)
    ? answer.choices.map((choice) => ({
      ...choice,
      label: applyChoicePhrases(localizeText(choice.label, lang), lang),
    }))
    : answer.choices;
  return { ...answer, reply, ...(choices ? { choices } : {}) };
}

module.exports = {
  enrichMessageForRules,
  preferLang,
  localizeAnswer,
  localizeText,
  applyPhrases,
  INTENT_BRIDGES,
};
