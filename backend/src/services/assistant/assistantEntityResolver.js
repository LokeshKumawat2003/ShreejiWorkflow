/**
 * Reliable organization / location entity resolution for Shreeji AI 2.0.
 * Uses exact → normalized → case-insensitive → skeleton → safe fuzzy matching.
 * Fuse.js is a spelling assist only — never the sole decision maker.
 * Never silently picks among ambiguous candidates.
 */

const Fuse = require('fuse.js');

const DEVANAGARI = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ँ': 'n', '्': '', '़': '',
};

const DEVANAGARI_CONSONANTS = new Set([
  'क', 'ख', 'ग', 'घ', 'च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड', 'ढ', 'ण',
  'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह',
]);
const DEVANAGARI_MATRAS = new Set(['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', 'ँ', '़']);

const ORG_ALIASES = [
  { alias: 'powergrid', forms: ['power grid', 'powergrid', 'pgcil', 'पावरग्रिड', 'पावर ग्रिड'] },
  { alias: 'ntpc', forms: ['ntpc', 'एनटीपीसी'] },
  // Hindi/STT often hears GAIL as "गली" / "gail".
  { alias: 'gail', forms: ['gail', 'गेल', 'गली', 'gayl', 'gael'] },
  { alias: 'bhel', forms: ['bhel', 'भेल', 'भ्ेल', 'behel', 'bhael'] },
];

/** Hindi / STT spellings of common English org/site tokens. */
const TOKEN_PHONETIC_ALIASES = [
  { canonical: 'white', forms: ['white', 'whait', 'whaita', 'vhait', 'vhaait', 'whit', 'waite'] },
  { canonical: 'road', forms: ['road', 'rod', 'roda', 'rode', 'raad'] },
  { canonical: 'work', forms: ['work', 'works', 'vark', 'varka', 'vrk', 'wrk', 'werk'] },
  { canonical: 'gate', forms: ['gate', 'gat', 'gata', 'gait'] },
  { canonical: 'north', forms: ['north', 'north', 'nort'] },
  { canonical: 'organization', forms: [
    'organization', 'organisation', 'argenaijeshn', 'argenaijeshana', 'orgenaijeshn',
    'organaijeshn', 'orgnaizeshn',
  ] },
];

/**
 * Devanagari → Latin with inherent 'a' and व्ह → wh (so व्हाइट रोड वर्क ≈ white road work).
 */
function transliterate(text) {
  const input = String(text || '').normalize('NFC');
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    const next2 = input[i + 2];
    // व् + ह → wh (white / when / …)
    if (ch === 'व' && next === '्' && next2 === 'ह') {
      out += 'wh';
      i += 2;
      continue;
    }
    if (/[\u0900-\u097F]/.test(ch)) {
      out += DEVANAGARI[ch] ?? '';
      if (DEVANAGARI_CONSONANTS.has(ch)) {
        if (next === '्') continue;
        if (DEVANAGARI_MATRAS.has(next)) continue;
        out += 'a';
      }
      continue;
    }
    out += ch;
  }
  return out;
}

function normalizeName(text) {
  return transliterate(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactName(text) {
  return normalizeName(text).replace(/\s+/g, '');
}

function skeleton(text) {
  return compactName(text)
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
  return normalizeName(text).split(/\s+/).filter(Boolean);
}

function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i += 1) {
    let prev = i + 1;
    for (let j = 0; j < right.length; j += 1) {
      const cur = left[i] === right[j] ? row[j] : Math.min(row[j], row[j + 1], prev) + 1;
      row[j] = prev;
      prev = cur;
    }
    row[right.length] = prev;
  }
  return row[right.length];
}

function phoneticCanonical(token) {
  const compact = compactName(token);
  if (!compact) return '';
  for (const entry of TOKEN_PHONETIC_ALIASES) {
    if (entry.forms.some((form) => compactName(form) === compact || similarEnoughRaw(form, compact))) {
      return entry.canonical;
    }
  }
  return compact;
}

/** Raw similarity without phonetic expansion (avoids recursion). */
function similarEnoughRaw(a, b) {
  const left = compactName(a);
  const right = compactName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // Drop trailing schwa from Hindi transliteration (roda ≈ road, varka ≈ vark).
  const leftStem = left.endsWith('a') && left.length >= 4 ? left.slice(0, -1) : left;
  const rightStem = right.endsWith('a') && right.length >= 4 ? right.slice(0, -1) : right;
  if (leftStem === rightStem) return true;
  if (left.includes(right) || right.includes(left) || leftStem.includes(rightStem) || rightStem.includes(leftStem)) {
    return Math.min(leftStem.length, rightStem.length) >= 4;
  }
  const skLeft = skeleton(leftStem);
  const skRight = skeleton(rightStem);
  if (skLeft && skLeft === skRight && skLeft.length >= 3) return true;
  const maxLen = Math.max(leftStem.length, rightStem.length);
  if (maxLen < 4) return false;
  const distance = levenshtein(leftStem, rightStem);
  return distance <= Math.max(1, Math.floor(maxLen * 0.25));
}

function similarEnough(a, b) {
  if (similarEnoughRaw(a, b)) return true;
  const leftCanon = phoneticCanonical(a);
  const rightCanon = phoneticCanonical(b);
  if (leftCanon && rightCanon && leftCanon === rightCanon) return true;
  return false;
}

function expandAliases(text) {
  let value = normalizeName(text);
  for (const entry of ORG_ALIASES) {
    for (const form of entry.forms) {
      if (value.includes(normalizeName(form))) value += ` ${entry.alias}`;
    }
  }
  // Expand phonetic Hindi/STT tokens (व्हाइट → white, रोड → road, वर्क → work).
  const parts = value.split(/\s+/).filter(Boolean);
  const extras = [];
  for (const part of parts) {
    const canon = phoneticCanonical(part);
    if (canon && canon !== part) extras.push(canon);
  }
  if (extras.length) value = `${value} ${extras.join(' ')}`;
  return value;
}

/** Filler tokens that must not drive fuzzy org matches (e.g. junk name "of organisation the name"). */
const ORG_NAME_STOPWORDS = new Set([
  'of', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'name', 'names', 'naam',
  'organisation', 'organization', 'organisations', 'organizations', 'org', 'orgs',
  'company', 'companies', 'client', 'clients', 'firm',
  'argenaijeshn', 'argenaijeshana', 'orgenaijeshn', 'organaijeshn',
  'hai', 'hain', 'mein', 'me', 'ki', 'ke', 'ka', 'men',
]);

/** Query tokens that must never pick a location by themselves ("लोकेशंस" → lokeshns ≈ lokesh). */
const LOCATION_QUERY_NOISE = new Set([
  'location', 'locations', 'lokeshns', 'lokeshnsa', 'lokeshans', 'lokation', 'lokations',
  'site', 'sites', 'place', 'places', 'branch', 'branches',
  'kitni', 'kitne', 'kitna', 'how', 'many', 'count', 'total', 'number', 'numbers',
  'organization', 'organisation', 'organizations', 'organisations', 'org', 'company', 'companies',
  'argenaijeshn', 'argenaijeshana', 'active', 'inactive', 'disabled',
  'hai', 'hain', 'mein', 'me', 'ki', 'ke', 'ka', 'men', 'wali', 'wala',
]);

function significantOrgWords(name) {
  return words(name).filter((word) => word.length >= 3 && !ORG_NAME_STOPWORDS.has(word));
}

function scoreOrganization(message, organization) {
  const hay = expandAliases(message);
  const name = organization.name || '';
  const normName = normalizeName(name);
  const compact = compactName(name);
  const hayCompact = compactName(hay);
  if (!normName) return 0;

  if (normalizeName(hay) === normName || hayCompact === compact) return 100;
  if (hay.includes(normName) || hayCompact.includes(compact)) return 90;
  // Query is a prefix/substring of the org name (e.g. "Powergrid" vs "Powergrid Khetri") — strong but not unique.
  if (compact.length >= 8 && compact.includes(hayCompact) && hayCompact.length >= 6) return 70;

  // Ignore stopword-only org labels for fuzzy matching (still allow exact/contains above).
  const nameWords = significantOrgWords(name);
  if (nameWords.length === 0) return 0;

  const hayWords = words(hay).filter((word) => !ORG_NAME_STOPWORDS.has(word));
  let matched = 0;
  for (const part of nameWords) {
    if (hayWords.some((word) => similarEnough(word, part)) || hayCompact.includes(compactName(part))) matched += 1;
  }
  if (nameWords.length > 0 && matched === nameWords.length) return 80 + matched;
  if (matched >= 2) return 60 + matched;
  if (matched === 1 && nameWords.length === 1) return 55;
  // Shared first token across multiple orgs should stay mid-score so ambiguity detection can fire.
  // Extra place words in the query (canteen/staff/site) that are not in the org name keep this weak.
  if (matched === 1 && nameWords.length > 1) {
    const extra = hayWords.filter((word) => word.length >= 4
      && !nameWords.some((part) => similarEnough(word, part))
      && !ORG_NAME_STOPWORDS.has(word));
    if (extra.length >= 2) return 40;
    return 52;
  }

  if (similarEnough(hay, name)) return 50;
  const skName = skeleton(nameWords.join(' '));
  const skHay = skeleton(hayWords.join(' '));
  if (skName.length >= 4 && skHay.includes(skName)) return 45;
  return 0;
}

function scoreOrganizationOwner(message, organization) {
  const owner = String(organization.contactName || '').trim();
  if (!owner || owner === organization.name) return 0;
  const hay = expandAliases(message);
  const hayWords = words(hay).filter((word) => word.length >= 3 && !ORG_NAME_STOPWORDS.has(word));
  const ownerWords = significantOrgWords(owner);
  if (!ownerWords.length || !hayWords.length) return 0;
  let matched = 0;
  for (const part of ownerWords) {
    if (hayWords.some((word) => similarEnough(word, part))) matched += 1;
  }
  if (matched === 0) return 0;
  if (matched === ownerWords.length) return 40 + matched;
  if (matched >= 2) return 30 + matched;
  return ownerWords.length === 1 ? 28 : 18;
}

/** Fuse spelling assist — high threshold; ignored when multiple near-ties remain. */
function fuseOrganizationBoost(message, organizations) {
  const list = (organizations || []).filter((item) => item?.name);
  if (!list.length) return new Map();
  const fuse = new Fuse(list, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.28,
    ignoreLocation: true,
    minMatchCharLength: 4,
  });
  const hay = normalizeName(message);
  if (hay.length < 4) return new Map();
  const hits = fuse.search(hay).slice(0, 5);
  const boosts = new Map();
  for (const hit of hits) {
    // Fuse score 0 = perfect; reject weak hits.
    if (hit.score == null || hit.score > 0.28) continue;
    const boost = Math.round((1 - hit.score) * 20);
    if (boost >= 10) boosts.set(hit.item.id, Math.min(18, boost));
  }
  // Ambiguity guard: near-equal Fuse hits cancel each other.
  const values = [...boosts.values()].sort((a, b) => b - a);
  if (values.length >= 2 && values[0] - values[1] < 3) return new Map();
  return boosts;
}

/**
 * Progressive org resolve:
 * 1) match spoken org name tokens
 * 2) if many, narrow by 2nd spoken word
 * 3) if still many, match owner/contactName
 * Never silently picks among remaining ties — caller shows choice chips.
 */
function resolveOrganizations(message, organizations, { minScore = 45 } = {}) {
  const fuseBoosts = fuseOrganizationBoost(message, organizations);
  let scored = (organizations || [])
    .map((organization) => {
      const base = scoreOrganization(message, organization);
      const boost = fuseBoosts.get(organization.id) || 0;
      // Fuse may assist spelling but cannot invent a match from near-zero base scores.
      const score = base >= 40 ? base + boost : base;
      return { organization, score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score);

  const queryTokens = significantOrgWords(message);

  // Step 1–2: progressive name-token narrowing (1st word, then 2nd).
  if (scored.length > 1 && queryTokens.length >= 1) {
    const byFirst = scored.filter((item) => {
      const nameWords = significantOrgWords(item.organization.name);
      return nameWords[0] && similarEnough(nameWords[0], queryTokens[0]);
    });
    if (byFirst.length >= 1) scored = byFirst;

    if (scored.length > 1 && queryTokens.length >= 2) {
      const bySecond = scored.filter((item) => {
        const nameWords = significantOrgWords(item.organization.name);
        return nameWords.some((part, index) => index > 0 && similarEnough(part, queryTokens[1]))
          || nameWords.slice(0, 2).some((part) => similarEnough(part, queryTokens[1]));
      });
      if (bySecond.length >= 1) scored = bySecond;
    }
  }

  // Step 3: owner / contact name when still ambiguous.
  if (scored.length > 1) {
    const withOwner = scored
      .map((item) => ({
        ...item,
        ownerScore: scoreOrganizationOwner(message, item.organization),
        score: item.score + scoreOrganizationOwner(message, item.organization),
      }))
      .filter((item) => item.ownerScore > 0)
      .sort((a, b) => b.score - a.score);
    if (withOwner.length === 1) {
      return {
        matches: [withOwner[0].organization],
        ambiguous: false,
        scores: [{ id: withOwner[0].organization.id, name: withOwner[0].organization.name, score: withOwner[0].score }],
      };
    }
    if (withOwner.length > 1) {
      scored = withOwner;
    }
  }

  if (scored.length === 0) return { matches: [], ambiguous: false };
  const best = scored[0].score;
  const top = scored.filter((item) => item.score >= best - 5 && item.score >= minScore);
  if (top.length > 1 && top[0].score < 90) {
    return {
      matches: top.map((item) => item.organization),
      ambiguous: true,
      scores: top.map((item) => ({ id: item.organization.id, name: item.organization.name, score: item.score })),
    };
  }
  return {
    matches: [top[0].organization],
    ambiguous: false,
    scores: [{ id: top[0].organization.id, name: top[0].organization.name, score: top[0].score }],
  };
}

/** Department / role tokens that alone must not uniquely pick a location. */
const GENERIC_LOCATION_TOKENS = new Set([
  'housekeeping', 'security', 'horticulture', 'cleaner', 'sweeper', 'guard', 'supervisor',
  'admin', 'block', 'gate', 'post', 'staff', 'worker', 'workers', 'work', 'works',
  'location', 'locations', 'site', 'sites', 'road', 'roads',
  // Shared org/site suffixes — "Green Valley Care" must not match location "Park Care".
  'care', 'services', 'service', 'private', 'limited', 'ltd', 'pvt', 'company', 'corp', 'group',
]);

/** Common STT / spacing variants for site tokens (switch yard ↔ switchyard, silchar ↔ switchyard). */
const LOCATION_TOKEN_ALIASES = [
  { canonical: 'switchyard', forms: ['switchyard', 'switch yard', 'switch yeard', 'swichyard', 'silchar', 'switchyar', 'switch year'] },
  // Horticulture sites: "lawn" often becomes "loan" in STT.
  { canonical: 'lawn', forms: ['lawn', 'loan', 'laun', 'lown', 'laan'] },
  // "Park Care" often becomes "Parker" in speech-to-text.
  { canonical: 'park', forms: ['park', 'parker', 'parkar', 'parkers', 'parc'] },
];

function expandLocationHay(text) {
  let value = normalizeName(text);
  for (const entry of LOCATION_TOKEN_ALIASES) {
    for (const form of entry.forms) {
      const norm = normalizeName(form);
      if (!norm) continue;
      if (value.includes(norm) || compactName(value).includes(compactName(norm))) {
        value += ` ${entry.canonical}`;
      }
    }
  }
  // Join split compounds already present as adjacent words ("switch yard" → also keep joined).
  const parts = words(value);
  for (let i = 0; i + 1 < parts.length; i += 1) {
    value += ` ${parts[i]}${parts[i + 1]}`;
  }
  return value;
}

function tokenMatches(hayWords, hayCompact, part) {
  const target = normalizeName(part);
  if (!target) return false;
  if (hayWords.some((word) => similarEnough(word, target))) return true;
  if (hayCompact.includes(compactName(target)) || compactName(target).includes(hayCompact)) {
    return Math.min(hayCompact.length, compactName(target).length) >= 5;
  }
  // Alias forms (silchar ≈ switchyard).
  for (const entry of LOCATION_TOKEN_ALIASES) {
    const forms = entry.forms.map(normalizeName);
    if (forms.includes(target) || target === entry.canonical) {
      if (forms.some((form) => hayWords.some((word) => similarEnough(word, form)) || hayCompact.includes(compactName(form)))) {
        return true;
      }
    }
  }
  return false;
}

/** PO / OP numbers keep digits; strip separators so "PO-42" ≈ "po42" / "42". */
function normalizePo(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function messagePoTokens(message) {
  return String(message || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizePo)
    .filter((token) => token.length >= 3 && /[0-9]/.test(token));
}

function stripLocationQueryNoise(message) {
  const parts = words(expandAliases(message)).filter((word) => {
    if (LOCATION_QUERY_NOISE.has(word)) return false;
    const canon = phoneticCanonical(word);
    if (LOCATION_QUERY_NOISE.has(canon)) return false;
    // Transliterated "लोकेशंस" / "locations" often becomes lokesh* — never treat as a site name.
    if (/^lokesh/.test(word) && word.length <= 10) return false;
    return true;
  });
  return parts.join(' ');
}

function scoreLocation(message, location) {
  // Strip "kitni locations / लोकेशंस / organization" so they never match a site named "lokesh".
  const cleaned = stripLocationQueryNoise(message);
  const hay = expandLocationHay(cleaned);
  const hayWords = words(hay).filter((word) => !LOCATION_QUERY_NOISE.has(word) && !(/^lokesh/.test(word) && word.length <= 10));
  const hayCompact = compactName(hayWords.join(' '));
  const name = normalizeName(location.name || '');
  const work = normalizeName(location.workName || '');
  const designation = normalizeName(location.designation || '');
  const address = normalizeName(location.address || '');
  const op = normalizePo(location.opNumber || '');
  let score = 0;

  // PO / OP number is a unique admin handle — treat like an exact site id.
  if (op.length >= 3) {
    const hayPo = normalizePo(message);
    const tokens = messagePoTokens(message);
    if (hayPo.includes(op) || tokens.some((token) => token === op)) {
      score = Math.max(score, 100);
    } else if (tokens.some((token) => token.length >= 5 && (op.includes(token) || token.includes(op)))) {
      score = Math.max(score, 94);
    }
  }

  // Exact / contained site name is strongest ("Bhopal Staff Canteen").
  if (name) {
    if (hay === name || hayCompact === compactName(name)) score = Math.max(score, 100);
    else if (hay.includes(name) || hayCompact.includes(compactName(name))) score = Math.max(score, 95);
    else if (similarEnough(hay, name)) score = Math.max(score, 70);
  }

  const nameParts = words(name).filter((word) => word.length >= 4);
  const distinctiveNameParts = nameParts.filter((word) => !GENERIC_LOCATION_TOKENS.has(word));
  const nameHits = nameParts.filter((part) => tokenMatches(hayWords, hayCompact, part));
  const distinctiveHits = distinctiveNameParts.filter((part) => tokenMatches(hayWords, hayCompact, part));
  // Multi-token site names need all distinctive parts ("Haridwar Colony Lawn").
  // A lone city token must not score ~91 and tie a more specific site ("Haridwar Gate").
  if (distinctiveNameParts.length >= 2 && distinctiveHits.length === distinctiveNameParts.length) {
    score = Math.max(score, 90 + distinctiveHits.length);
  } else if (distinctiveHits.length >= 2) {
    score = Math.max(score, 82 + distinctiveHits.length);
  } else if (distinctiveHits.length === 1) {
    score = Math.max(score, distinctiveNameParts.length <= 1 && distinctiveNameParts[0]?.length >= 6 ? 62 : 58);
  } else if (nameParts.length && nameHits.length === nameParts.length) {
    score = Math.max(score, 72);
  }

  // workName / designation alone are weak — "cleaner" must not tie every Cleaner post at 85.
  // Distinctive multi-word work names ("Housekeeping Block A") are strong when all parts hit.
  if (work) {
    const workParts = words(work).filter((word) => word.length >= 3);
    const distinctiveWorkParts = workParts.filter((word) => !GENERIC_LOCATION_TOKENS.has(word));
    const workHits = distinctiveWorkParts.filter((part) => tokenMatches(hayWords, hayCompact, part));
    if (hay === work || compactName(hay) === compactName(work)) {
      score = Math.max(score, GENERIC_LOCATION_TOKENS.has(work) ? 45 : 88);
    } else if (hay.includes(work)) {
      score = Math.max(score, GENERIC_LOCATION_TOKENS.has(work) ? 42 : 86);
    } else if (distinctiveWorkParts.length >= 2 && workHits.length === distinctiveWorkParts.length) {
      score = Math.max(score, 90);
    } else if (distinctiveWorkParts.length === 1 && workHits.length === 1 && distinctiveWorkParts[0].length >= 5) {
      score = Math.max(score, 72);
    } else if (workParts.length === 1 && hayWords.some((word) => similarEnough(word, work))) {
      // Only single-token workNames may match a lone query token ("Security", not "Field Work" via "work").
      score = Math.max(score, GENERIC_LOCATION_TOKENS.has(work) ? 42 : 68);
    }
  }
  if (designation) {
    const desHit = hay.includes(designation) || hayWords.some((word) => similarEnough(word, designation));
    if (desHit) {
      score = Math.max(score, GENERIC_LOCATION_TOKENS.has(designation) || designation.length <= 12 ? 38 : 55);
    }
  }
  if (address) {
    const addrCompact = compactName(address);
    if (addrCompact.length >= 8 && (hayCompact.includes(addrCompact) || hay.includes(address))) {
      score = Math.max(score, 95);
    } else {
      const addrParts = words(address).filter((word) => word.length >= 4 && !GENERIC_LOCATION_TOKENS.has(word));
      const addrHits = addrParts.filter((part) => tokenMatches(hayWords, hayCompact, part));
      if (addrHits.length >= 3) score = Math.max(score, 90);
      else if (addrHits.length >= 2) score = Math.max(score, 82);
      else if (addrHits.length === 1 && addrParts[0].length >= 6) score = Math.max(score, 68);
      else if (addrHits.length === 1) score = Math.max(score, 50);
    }
  }

  // All distinctive site tokens + role/department → strong match (not a single shared word like "canteen").
  if (distinctiveNameParts.length > 0
    && distinctiveHits.length === distinctiveNameParts.length
    && (hay.includes(designation) || hay.includes(work))) {
    score = Math.max(score, 92);
  }
  return score;
}

function resolveLocations(message, locations, { organizationId = null, minScore = 40 } = {}) {
  const scope = organizationId
    ? (locations || []).filter((item) => item.organizationId === organizationId)
    : (locations || []);
  const scored = scope
    .map((location) => ({ location, score: scoreLocation(message, location) }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { matches: [], ambiguous: false };
  const best = scored[0].score;
  // Full site-name containment (≥95) wins alone over partial canteen/role ties.
  if (best >= 95) {
    const exactish = scored.filter((item) => item.score >= 95);
    if (exactish.length === 1) return { matches: [exactish[0].location], ambiguous: false };
    if (exactish.length > 1) return { matches: exactish.map((item) => item.location), ambiguous: true };
  }
  // Prefer a clear site-name winner over a pack of weak department/designation ties.
  if (best >= 80) {
    const strong = scored.filter((item) => item.score >= best - 3 && item.score >= 80);
    if (strong.length === 1) return { matches: [strong[0].location], ambiguous: false };
    if (strong.length > 1) {
      return { matches: strong.map((item) => item.location), ambiguous: true };
    }
  }
  const top = scored.filter((item) => item.score >= best - 5);
  if (top.length > 1 && top[0].score < 90) {
    return { matches: top.map((item) => item.location), ambiguous: true };
  }
  return { matches: [top[0].location], ambiguous: false };
}

function findLocationsByKeyword(keyword, locations, { organizationId = null } = {}) {
  const needle = normalizeName(keyword);
  if (!needle) return [];
  return (locations || []).filter((location) => {
    if (organizationId && location.organizationId !== organizationId) return false;
    const blob = normalizeName([
      location.workName,
      location.name,
      location.designation,
      location.address,
      location.opNumber,
    ].filter(Boolean).join(' '));
    const op = normalizePo(location.opNumber || '');
    const needlePo = normalizePo(keyword);
    if (op && needlePo && (op === needlePo || op.includes(needlePo) || needlePo.includes(op))) return true;
    return blob.includes(needle) || similarEnough(blob, needle) || words(blob).some((word) => similarEnough(word, needle));
  });
}

module.exports = {
  normalizeName,
  compactName,
  skeleton,
  similarEnough,
  resolveOrganizations,
  resolveLocations,
  findLocationsByKeyword,
  scoreOrganization,
  scoreLocation,
  normalizePo,
};
