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

const ORG_ALIASES = [
  { alias: 'powergrid', forms: ['power grid', 'powergrid', 'pgcil', 'पावरग्रिड', 'पावर ग्रिड'] },
  { alias: 'ntpc', forms: ['ntpc', 'एनटीपीसी'] },
  // Hindi/STT often hears GAIL as "गली" / "gail".
  { alias: 'gail', forms: ['gail', 'गेल', 'गली', 'gayl', 'gael'] },
  { alias: 'bhel', forms: ['bhel', 'भेल', 'भ्ेल', 'behel', 'bhael'] },
];

function transliterate(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[\u0900-\u097F]/g, (char) => DEVANAGARI[char] ?? '');
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

function similarEnough(a, b) {
  const left = compactName(a);
  const right = compactName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) >= 5;
  }
  const skLeft = skeleton(left);
  const skRight = skeleton(right);
  if (skLeft && skLeft === skRight && skLeft.length >= 3) return true;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen < 5) return false;
  const distance = levenshtein(left, right);
  return distance <= Math.max(1, Math.floor(maxLen * 0.2));
}

function expandAliases(text) {
  let value = normalizeName(text);
  for (const entry of ORG_ALIASES) {
    for (const form of entry.forms) {
      if (value.includes(normalizeName(form))) value += ` ${entry.alias}`;
    }
  }
  return value;
}

/** Filler tokens that must not drive fuzzy org matches (e.g. junk name "of organisation the name"). */
const ORG_NAME_STOPWORDS = new Set([
  'of', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'name', 'names', 'naam',
  'organisation', 'organization', 'organisations', 'organizations', 'org', 'orgs',
  'company', 'companies', 'client', 'clients', 'firm',
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

function resolveOrganizations(message, organizations, { minScore = 45 } = {}) {
  const fuseBoosts = fuseOrganizationBoost(message, organizations);
  const scored = (organizations || [])
    .map((organization) => {
      const base = scoreOrganization(message, organization);
      const boost = fuseBoosts.get(organization.id) || 0;
      // Fuse may assist spelling but cannot invent a match from near-zero base scores.
      const score = base >= 40 ? base + boost : base;
      return { organization, score };
    })
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score);

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
  'admin', 'block', 'gate', 'post', 'staff', 'worker', 'location', 'locations', 'site', 'sites',
]);

/** Common STT / spacing variants for site tokens (switch yard ↔ switchyard, silchar ↔ switchyard). */
const LOCATION_TOKEN_ALIASES = [
  { canonical: 'switchyard', forms: ['switchyard', 'switch yard', 'switch yeard', 'swichyard', 'silchar', 'switchyar', 'switch year'] },
  // Horticulture sites: "lawn" often becomes "loan" in STT.
  { canonical: 'lawn', forms: ['lawn', 'loan', 'laun', 'lown', 'laan'] },
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

function scoreLocation(message, location) {
  const hay = expandLocationHay(message);
  const hayWords = words(hay);
  const hayCompact = compactName(hay);
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
    } else if (hayWords.some((word) => similarEnough(word, work))) {
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
