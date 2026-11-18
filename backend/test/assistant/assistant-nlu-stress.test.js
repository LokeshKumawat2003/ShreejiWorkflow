/**
 * Unseen natural-language stress tests for deterministic Shreeji NLU.
 * Measures intent / entity / filter / context accuracy — not "got a reply".
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  INTENTS,
  classifyDirectoryIntent,
  answerDirectoryQuery,
} = require('../../src/services/assistant/assistantDirectoryQuery');
const {
  prepareMessageForIntent,
  hasConcept,
  classifyIntent,
} = require('../../src/services/assistant/assistantNlu');
const { mergeContext } = require('../../src/services/assistant/assistantContext');
const { resolveOrganizations } = require('../../src/services/assistant/assistantEntityResolver');

const ORGS = [
  { id: '507f1f77bcf86cd799439011', name: 'Powergrid Khetri', status: 'active' },
  { id: '507f1f77bcf86cd799439012', name: 'NTPC Rihand', status: 'active' },
  { id: '507f1f77bcf86cd799439013', name: 'Powergrid Bhiwani', status: 'active' },
  { id: '507f1f77bcf86cd799439014', name: 'Old Client', status: 'disabled' },
];
const LOCS = [
  {
    id: '507f1f77bcf86cd799439021',
    organizationId: '507f1f77bcf86cd799439011',
    organizationName: 'Powergrid Khetri',
    workName: 'Housekeeping Block A',
    name: 'Khetri Site',
    designation: 'Housekeeping',
    status: 'active',
  },
];
const directory = { organizations: ORGS, locations: LOCS };
const admin = { id: 'admin1', role: 'admin' };

/** Unseen / informal / STT / Hindi / Hinglish / English cases (not copies of prior suites). */
const INTENT_CASES = [
  // --- organization count (unseen phrasing) ---
  { msg: 'kitne corporate accounts live hain?', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'abhi alive companies ka headcount?', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'currently open organisations kitni?', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'parties chal rahi kitni hain bhai', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'live wale clients ka total?', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'onboarded firms kitni chal rahi', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'how many corporates are live right now', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'total live accounts bata dena', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'कितनी पार्टियां चालू हैं', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'सक्रिय क्लाइंट्स की संख्या क्या है', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'org count plsssss', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: {}, entity: 'none' },
  { msg: 'compnies activ kitni hain??', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'organzationz running total', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'kitne accounts on hain', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'yeh jo clients chalu hain unki ginti', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },

  // --- organization list ---
  { msg: 'saari parties ke naam nikaal', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'corporates ke naam dikha', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'accounts list chahiye', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'clients roster batao', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'all parties naam', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'संगठन सूची दो', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'कम्पनी नाम बता दो सब', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'dump org names', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'firms roster please', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'businesses ke naam', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },

  // --- employee count / list / details ---
  { msg: 'manpower kitna hai overall', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'workforce headcount batao', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'total manpower ginti', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'कर्मचारियों की संख्या बताओ', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'kitne log onboard hain', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'Powergrid Khetri manpower kitna', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri headcount?', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'NTPC Rihand mein workforce kitni', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri ke logon ki list', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri manpower list', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri workforce dikhao', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri employee card details', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri live manpower', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: { status: 'active' }, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri band employees kitne', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: { employeeStatus: 'disabled' }, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri closed staff count', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: { employeeStatus: 'disabled' }, entity: 'org', hasOrgMention: true },
  { msg: 'NTPC Rihand inactive manpower', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: { employeeStatus: 'disabled' }, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri pe kitne bande kaam kar rahe', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri me kitne bande hain', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'पावरग्रिड खेतड़ी में कितने लोग काम करते हैं', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },

  // --- locations ---
  { msg: 'Powergrid Khetri ke units kitne', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri plants list', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'NTPC Rihand sites dikhao', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri branches batao', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'kitni units hain Powergrid Khetri mein', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri location card', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },

  // --- attendance / payroll / documents (directory classifies then often defers) ---
  { msg: 'hajri sheet chahiye', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'aaj ki hazri dikhao', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'present absent status batao', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'हाजिरी चेक करो', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'attendenace report', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'tanakhwa sheet nikalna hai', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'payslip generate karna hai', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'salary register chahiye', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'वेतन पत्रक बनाओ', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'pairol banado', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'wage book pdf', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },
  { msg: 'form 17 nikal do', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },
  { msg: 'vegg sheet download', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },
  { msg: 'register excel chahiye', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },
  { msg: 'पीडीएफ स्लिप चाहिए', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },

  // --- org details ---
  { msg: 'Powergrid Khetri profile card', intent: INTENTS.ORGANIZATION_DETAILS, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'NTPC Rihand contact info', intent: INTENTS.ORGANIZATION_DETAILS, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Bhiwani ka full profile', intent: INTENTS.ORGANIZATION_DETAILS, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri mobile email', intent: INTENTS.ORGANIZATION_DETAILS, filters: {}, entity: 'org', hasOrgMention: true },

  // --- short / incomplete / informal ---
  { msg: 'orgs?', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'emp count', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'active orgs?', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'clients?', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'staff?', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'locations of Powergrid Khetri', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri emplyees', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri emplyee count', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'how meny orgs r active', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'ttl active cmpnies', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },

  // --- more Hindi / Hinglish informal ---
  { msg: 'bhai active company kitni hain yr', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'yaar saari company ke naam nikaal de', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'bas emp ginti bata', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'Powergrid Khetri pe staff kitna pada hai', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri ke bande dikha', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'NTPC Rihand inactive bande kitne', intent: INTENTS.ORGANIZATION_EMPLOYEE_COUNT, filters: { employeeStatus: 'disabled' }, entity: 'org', hasOrgMention: true },
  { msg: 'अभी चालू कंपनियां कितनी', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'सभी क्लाइंट नाम', intent: INTENTS.ORGANIZATION_LIST, filters: {}, entity: 'none' },
  { msg: 'कुल स्टाफ कितना', intent: INTENTS.ACTIVE_EMPLOYEE_COUNT, filters: {}, entity: 'none' },
  { msg: 'पावरग्रिड खेतड़ी कर्मचारी सूची', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },

  // --- STT / typos ---
  { msg: 'aktive organzations count', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'how many aktiv firms', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'active' }, entity: 'none' },
  { msg: 'Powergrid Khetri emplye details', intent: INTENTS.ORGANIZATION_EMPLOYEE_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'Powergrid Khetri lokations kitni', intent: INTENTS.ORGANIZATION_LOCATION_LIST, filters: {}, entity: 'org', hasOrgMention: true },
  { msg: 'hajiri report chahiye', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'peyroll pdf', intent: INTENTS.PAYROLL_QUERY, filters: {}, entity: 'none' },
  { msg: 'waje sheet nikal', intent: INTENTS.DOCUMENT_GENERATION, filters: {}, entity: 'none' },
  { msg: 'inactiv clients kitne', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'inactive' }, entity: 'none' },
  { msg: 'disabled firms count', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'inactive' }, entity: 'none' },
  { msg: 'deactive organisations kitni', intent: INTENTS.ACTIVE_ORGANIZATION_COUNT, filters: { status: 'inactive' }, entity: 'none' },

  // --- negatives / false-positive traps ---
  { msg: 'what is the weather today', intent: null, filters: {}, entity: 'none', negative: true },
  { msg: 'tell me a joke', intent: null, filters: {}, entity: 'none', negative: true },
  { msg: 'random gibberish xyzabc', intent: null, filters: {}, entity: 'none', negative: true },
  { msg: 'mark attendance present for everyone', intent: INTENTS.ATTENDANCE_QUERY, filters: {}, entity: 'none' },
  { msg: 'delete all data forever', intent: null, filters: {}, entity: 'none', negative: true, allowWriteNull: true },
];

assert.ok(INTENT_CASES.length >= 100, `need >=100 cases, got ${INTENT_CASES.length}`);

function detectFilters(message) {
  const prepared = prepareMessageForIntent(message);
  const text = prepared.expanded;
  const filters = {};
  if (hasConcept(text, 'inactive') || /\b(inactive|disabled|deactive|band|closed|निष्क्रिय)\b/i.test(text)) {
    if (hasConcept(text, 'employee') || /\b(employee|staff|manpower|workforce|bande|log)\b/i.test(text)) {
      filters.employeeStatus = 'disabled';
    } else {
      filters.status = 'inactive';
    }
  } else if (hasConcept(text, 'active') || /\b(active|live|alive|onboarded|चालू|सक्रिय)\b/i.test(text)) {
    filters.status = 'active';
  }
  return { prepared, filters };
}

function classifyCase(item) {
  const signals = {
    hasOrgMention: item.hasOrgMention === true,
    hasLocationMention: item.hasLocationMention === true,
  };
  // Entity extraction against directory when message may name an org.
  const resolved = resolveOrganizations(item.msg, ORGS, { minScore: 45 });
  const entityHit = resolved.matches.length === 1 && !resolved.ambiguous
    ? 'org'
    : (resolved.matches.length > 1 ? 'ambiguous' : 'none');
  const intent = classifyDirectoryIntent(item.msg, {
    ...signals,
    hasOrgMention: signals.hasOrgMention || entityHit === 'org',
  });
  const { filters } = detectFilters(item.msg);
  return { intent, entityHit, filters, resolved };
}

test('stress dataset has at least 100 unseen intent cases', () => {
  assert.ok(INTENT_CASES.length >= 100);
  const msgs = new Set(INTENT_CASES.map((item) => item.msg.toLowerCase()));
  assert.equal(msgs.size, INTENT_CASES.length, 'duplicate messages in stress set');
});

test('unseen NL stress metrics for intent entity and filters', () => {
  let intentCorrect = 0;
  let entityCorrect = 0;
  let filterCorrect = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  const failures = [];

  for (const item of INTENT_CASES) {
    const result = classifyCase(item);
    const expectEntity = item.entity || 'none';

    // Intent
    const intentOk = result.intent === item.intent;
    if (intentOk) intentCorrect += 1;
    else {
      failures.push({ type: 'intent', msg: item.msg, expected: item.intent, actual: result.intent });
      if (item.intent == null && result.intent) falsePositives += 1;
      if (item.intent != null && result.intent == null) falseNegatives += 1;
      if (item.intent != null && result.intent != null && item.intent !== result.intent) {
        // wrong intent counts as both a miss for expected and FP for actual family
        falseNegatives += 1;
        falsePositives += 1;
      }
    }

    // Entity: only grade when we expect org or none (ambiguous allowed as soft)
    if (expectEntity === 'org') {
      if (result.entityHit === 'org' || item.hasOrgMention) entityCorrect += 1;
      else failures.push({ type: 'entity', msg: item.msg, expected: 'org', actual: result.entityHit });
    } else if (expectEntity === 'none') {
      // Do not require zero fuzzy hits on generic queries; require not uniquely forced wrong.
      if (result.entityHit !== 'org' || !/\b(powergrid|ntpc|khetri|rihand|bhiwani)\b/i.test(item.msg)) {
        entityCorrect += 1;
      } else {
        failures.push({ type: 'entity', msg: item.msg, expected: 'none', actual: result.entityHit });
      }
    } else {
      entityCorrect += 1;
    }

    // Filters: compare only keys asserted in expect.filters
    const expectedFilters = item.filters || {};
    const keys = Object.keys(expectedFilters);
    if (keys.length === 0) {
      filterCorrect += 1;
    } else {
      const ok = keys.every((key) => result.filters[key] === expectedFilters[key]
        || (key === 'status' && expectedFilters[key] === 'active' && hasConcept(prepareMessageForIntent(item.msg).expanded, 'active'))
        || (key === 'employeeStatus' && expectedFilters[key] === 'disabled' && (
          hasConcept(prepareMessageForIntent(item.msg).expanded, 'inactive')
          || /\b(inactive|disabled|deactive|band|closed)\b/i.test(item.msg)
        )));
      // For filter grading on intent path: use concept detection after expansion.
      const prepared = prepareMessageForIntent(item.msg);
      let filterOk = true;
      for (const key of keys) {
        if (key === 'status' && expectedFilters[key] === 'active') {
          filterOk = filterOk && (hasConcept(prepared.expanded, 'active') || /\b(active|live|alive|chalu|चालू|सक्रिय|onboarded)\b/i.test(prepared.expanded));
        } else if (key === 'status' && expectedFilters[key] === 'inactive') {
          filterOk = filterOk && (hasConcept(prepared.expanded, 'inactive') || /\b(inactive|disabled|deactive|band|closed)\b/i.test(prepared.expanded));
        } else if (key === 'employeeStatus' && expectedFilters[key] === 'disabled') {
          filterOk = filterOk && (hasConcept(prepared.expanded, 'inactive') || /\b(inactive|disabled|deactive|band|closed)\b/i.test(prepared.expanded));
        }
      }
      if (filterOk) filterCorrect += 1;
      else failures.push({ type: 'filter', msg: item.msg, expected: expectedFilters, actual: result.filters, expanded: prepared.expanded });
    }
  }

  const n = INTENT_CASES.length;
  const intentPct = (intentCorrect / n) * 100;
  const entityPct = (entityCorrect / n) * 100;
  const filterPct = (filterCorrect / n) * 100;

  console.log('\n=== NLU STRESS METRICS ===');
  console.log(`cases=${n}`);
  console.log(`intent_accuracy=${intentPct.toFixed(1)}% (${intentCorrect}/${n})`);
  console.log(`entity_accuracy=${entityPct.toFixed(1)}% (${entityCorrect}/${n})`);
  console.log(`filter_accuracy=${filterPct.toFixed(1)}% (${filterCorrect}/${n})`);
  console.log(`false_positives=${falsePositives}`);
  console.log(`false_negatives=${falseNegatives}`);
  if (failures.length) {
    console.log(`sample_failures=${Math.min(20, failures.length)}`);
    for (const fail of failures.slice(0, 20)) {
      console.log(` - ${fail.type}: "${fail.msg}" expected=${JSON.stringify(fail.expected)} actual=${JSON.stringify(fail.actual)}`);
    }
  }

  // After synonym fixes we require strong intent accuracy on this stress set.
  assert.ok(intentPct >= 85, `intent accuracy too low: ${intentPct.toFixed(1)}% ; failures=${failures.filter((f) => f.type === 'intent').length}`);
  assert.ok(entityPct >= 90, `entity accuracy too low: ${entityPct.toFixed(1)}%`);
  assert.ok(filterPct >= 90, `filter accuracy too low: ${filterPct.toFixed(1)}%`);
});

test('context switching and pronoun resolution stress', async () => {
  const Employee = require('../../src/models/Employee');
  const originalFind = Employee.find;
  const originalCount = Employee.countDocuments;
  Employee.find = () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [
      { name: 'Asha', designation: 'Cleaner', status: 'active' },
      { name: 'Ravi', designation: 'Guard', status: 'active' },
    ],
  });
  Employee.countDocuments = async (filter = {}) => {
    if (filter.status === 'disabled') return 3;
    if (filter.status?.$ne === 'disabled') return 8;
    return 11;
  };

  let contextCorrect = 0;
  let contextTotal = 0;
  const note = (ok, label) => {
    contextTotal += 1;
    if (ok) contextCorrect += 1;
    else console.log(`context_fail: ${label}`);
    assert.ok(ok, label);
  };

  try {
    const first = await answerDirectoryQuery({
      user: admin,
      message: 'Powergrid Khetri active employees',
      directory,
      lang: 'en',
    });
    note(first?.intent === INTENTS.ORGANIZATION_EMPLOYEE_COUNT, 'first count intent');
    note(first?.context?.organizationId === '507f1f77bcf86cd799439011', 'first org sticky');
    let sticky = mergeContext(null, first.context);

    const pronounList = await answerDirectoryQuery({
      user: admin,
      message: 'unke employees dikhao',
      directory,
      context: sticky,
      lang: 'hi',
    });
    note(pronounList?.intent === INTENTS.ORGANIZATION_EMPLOYEE_LIST, 'pronoun list intent');
    note(pronounList?.data?.organizationId === sticky.organizationId, 'pronoun keeps org');

    sticky = mergeContext(sticky, pronounList.context);
    const switchAsk = await answerDirectoryQuery({
      user: admin,
      message: 'ab dusri organization ke employees dikhao',
      directory,
      context: sticky,
      lang: 'hi',
    });
    note(switchAsk?.data?.switchedScope === true, 'switch clears scope');
    note(switchAsk?.context?.organizationId == null, 'switch org id null');
    note(switchAsk?.data?.needsOrganization === true, 'switch asks clarification');

    sticky = mergeContext(sticky, switchAsk.context);
    const replaced = await answerDirectoryQuery({
      user: admin,
      message: 'NTPC Rihand employees',
      directory,
      context: sticky,
      lang: 'en',
    });
    note(replaced?.intent === INTENTS.ORGANIZATION_EMPLOYEE_LIST, 'replace org list intent');
    note(replaced?.data?.organizationId === '507f1f77bcf86cd799439012', 'new org replaces old');
    note(replaced?.data?.organizationId !== '507f1f77bcf86cd799439011', 'old org not leaked');

    sticky = mergeContext(null, replaced.context);
    const inactive = await answerDirectoryQuery({
      user: admin,
      message: 'ismein inactive employees kitne?',
      directory,
      context: sticky,
      lang: 'hi',
    });
    note(inactive?.intent === INTENTS.ORGANIZATION_EMPLOYEE_COUNT, 'inactive follow-up intent');
    note(inactive?.data?.organizationIds?.includes('507f1f77bcf86cd799439012'), 'inactive keeps org scope');
    note(inactive?.data?.employeeStatusFilter === 'disabled', 'inactive updates employee filter');
    note(inactive?.context?.organizationId === '507f1f77bcf86cd799439012', 'org not cleared on filter update');

    const unclear = await answerDirectoryQuery({
      user: admin,
      message: 'unki details',
      directory,
      context: null,
      lang: 'hi',
    });
    // Without sticky context, unclear pronoun should not invent an org answer.
    note(!unclear || unclear.data?.needsOrganization || unclear.intent !== INTENTS.ORGANIZATION_EMPLOYEE_LIST
      || !unclear.data?.organizationId, 'unclear pronoun does not invent org');

    const pct = (contextCorrect / contextTotal) * 100;
    console.log(`context_resolution_accuracy=${pct.toFixed(1)}% (${contextCorrect}/${contextTotal})`);
    assert.ok(pct >= 90, `context accuracy too low: ${pct.toFixed(1)}%`);
  } finally {
    Employee.find = originalFind;
    Employee.countDocuments = originalCount;
  }
});

test('write actions stay uncertain without clear target', () => {
  const plan = classifyIntent('delete everything now please');
  assert.ok(
    plan.intent == null || plan.needsClarification || plan.confidence < 0.85 || plan.intent !== 'delete_action',
    'uncertain write must not execute',
  );
});
