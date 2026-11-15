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
  { add: ['payroll', 'generate'], when: ['पैरोल', 'पेरोल', 'पेरोल्', 'पेरॉल', 'पैरॉल', 'पेयरोल', 'petrol', 'पेट्रोल', 'pahalvan', 'pahalwan', 'pehalvan', 'pehelwan', 'पहलवान'] },
  { add: ['disabled', 'inactive', 'locations', 'list', 'names'], when: ['डीएक्टिव', 'डीऐक्टिव', 'डिएक्टिव', 'आईएनएक्टिव', 'इनएक्टिव', 'इनऐक्टिव', 'निष्क्रिय', 'deactive', 'deactivate', 'disabled', 'inactive', 'डिसेबल्ड'] },
  { add: ['active', 'locations', 'list', 'names'], when: ['एक्टिव', 'ऐक्टिव', 'सक्रिय', 'enabled'] },
  { add: ['attendance'], when: ['हाजिरी', 'हाज़िरी', 'हाजरी', 'hajiri', 'haziri', 'hajri', 'अटेंडेंस', 'अटेंडन्स'] },
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
  { add: ['details', 'info'], when: ['who is', "who's", 'detailed', 'कौन है', 'कौन हैं', 'डिटेल', 'जानकारी'] },
  { add: ['subba'], when: ['सुबह', 'सुभ', 'सभा', 'सुब्बा', 'सुबा'] },
  { add: ['limbu'], when: ['नींबू', 'निम्बू', 'लिम्बू', 'लिम्बु'] },
  { add: ['uan', 'full form'], when: ['नीम का फुल', 'नीम फुल', 'uan full', 'यूएएन'] },
  { add: ['where', 'assign', 'location'], when: ['kahan', 'kaha', 'कहाँ', 'कहां', 'sign', 'assign', 'साइन', 'असाइन'] },
  { add: ['thank you'], when: ['धन्यवाद', 'शुक्रिया'] },
  { add: ['names', 'list', 'tell'], when: ['नाम बताओ', 'नाम बताइए', 'नाम बताएं', 'बताओ', 'बताइए'] },
  { add: ['random'], when: ['रैंडम', 'रेंडम', 'randomly', 'कोई भी', 'खुद से'] },
  { add: ['rest', 'remaining', 'days'], when: ['बाकी सब', 'बाकी दिन', 'बचे हुए', 'baki sab', 'baaki'] },
  { add: ['both', 'locations', 'payroll', 'generate'], when: ['yeah ok both', 'ok both', 'both location', 'both locations'] },
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
  ['(Aadhaar और account number पूरे Employees page पर देखें।)', '(See full Aadhaar and account number on the Employees page.)'],
  ['(Aadhaar और account number पूरे Employees page पर देखें.)', '(See full Aadhaar and account number on the Employees page.)'],
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
function enrichMessageForRules(message) {
  const text = String(message || '');
  if (!text.trim()) return text;
  const extras = [];
  const seen = new Set();
  for (const bridge of INTENT_BRIDGES) {
    if (!includesAny(text, bridge.when)) continue;
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

function needsLocalization(text, lang) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (lang === 'en') return hasDevanagari(value);
  if (lang === 'hi') return !hasDevanagari(value) && /[A-Za-z]{4,}/.test(value);
  return false;
}

async function translateWithOllama(text, lang) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey || !text) return null;
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'deepseek-v4.1-flash';
  const target = lang === 'en' ? 'English' : 'Hindi';
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Translate the assistant reply into ${target}. Keep names, amounts, dates, IDs, and document titles unchanged. Return only the translated text.`,
          },
          { role: 'user', content: text.slice(0, 3500) },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const translated = String(data?.choices?.[0]?.message?.content || '').trim();
    return translated || null;
  } catch {
    return null;
  }
}

async function localizeText(text, lang) {
  const original = String(text || '');
  if (!original) return original;
  let out = applyPhrases(original, lang);
  if (needsLocalization(out, lang) && process.env.ASSISTANT_TRANSLATE !== '0') {
    const translated = await translateWithOllama(out, lang);
    if (translated) out = translated;
  }
  return out;
}

async function localizeAnswer(answer, lang) {
  if (!answer || (lang !== 'en' && lang !== 'hi')) return answer;
  const reply = await localizeText(answer.reply, lang);
  const choices = Array.isArray(answer.choices)
    ? await Promise.all(answer.choices.map(async (choice) => ({
      ...choice,
      label: applyChoicePhrases(await localizeText(choice.label, lang), lang),
    })))
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
