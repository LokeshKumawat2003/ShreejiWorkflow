/**
 * Conversation context for Shreeji Assistant 2.0.
 * Sticky entity IDs survive for the life of the session (TTL), not a short turn window.
 * Topic switches and explicit org changes clear / replace stale fields via mergeContext.
 */

/** Soft hint for callers that still check turn distance; session TTL is the real lifecycle. */
const CONTEXT_TURNS = 80;

const CORRECTION_WORDS = [
  'nahi', 'nahin', 'nahe', 'no', 'wrong', 'galat', 'matlab', 'meant', 'i meant', 'mera matlab',
  'dusri', 'dusra', 'doosri', 'doosra', 'another', 'other', 'not that', 'not this',
  'नहीं', 'नही', 'गलत', 'मतलब', 'दूसरी', 'दूसरा', 'मेरा मतलब',
];

const TOPIC_SWITCH_ORG_WORDS = [
  'another organization', 'dusri organization', 'dusri organisation', 'doosri organization',
  'another org', 'different organization', 'kisi aur organization', 'any other organization',
  'दूसरी organization', 'दूसरी ऑर्गेनाइजेशन', 'अन्य organization',
];

function isContextFresh(session) {
  if (!session?.context) return false;
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) return false;
  // Keep sticky context for the whole session; mergeContext handles topic switches.
  return true;
}

function getActiveContext(session) {
  return isContextFresh(session) ? session.context : null;
}

function pickSticky(next, previous, key) {
  if (Object.prototype.hasOwnProperty.call(next, key)) return next[key] || null;
  return previous?.[key] || null;
}

function mergeContext(previous, next) {
  if (!next) return previous || null;
  const replacingOrg = Object.prototype.hasOwnProperty.call(next, 'organizationId') && next.organizationId;
  const replacingDocument = Object.prototype.hasOwnProperty.call(next, 'documentType') && next.documentType;
  const replacingLocation = Object.prototype.hasOwnProperty.call(next, 'locationId') && next.locationId;

  const merged = {
    ...(previous || {}),
    ...next,
    // Explicit null from a new subject answer clears the previous id (e.g. location doc after employee).
    employeeId: pickSticky(next, previous, 'employeeId'),
    employeeName: pickSticky(next, previous, 'employeeName'),
    // Prefer the org named on this turn; do not keep a stale org when a new one is set.
    // Updating a location must not erase its parent organization when the answer omits org.
    organizationId: replacingOrg
      ? next.organizationId
      : pickSticky(next, previous, 'organizationId'),
    organizationName: replacingOrg
      ? (next.organizationName || null)
      : pickSticky(next, previous, 'organizationName'),
    locationId: pickSticky(next, previous, 'locationId'),
    locationName: pickSticky(next, previous, 'locationName'),
    month: pickSticky(next, previous, 'month'),
    lastIntent: next.lastIntent || previous?.lastIntent || null,
    pendingActionId: next.pendingActionId || null,
    // Keep the last substantive subject query for "October ki chahiye" style follow-ups.
    query: next.query || previous?.query || null,
    documentType: replacingDocument ? next.documentType : pickSticky(next, previous, 'documentType'),
    format: pickSticky(next, previous, 'format'),
    // Preserve list filters for pronoun follow-ups ("inke naam", "inmein employees").
    statusFilter: Object.prototype.hasOwnProperty.call(next, 'statusFilter')
      ? (next.statusFilter || null)
      : (previous?.statusFilter || null),
    employeeStatusFilter: Object.prototype.hasOwnProperty.call(next, 'employeeStatusFilter')
      ? (next.employeeStatusFilter || null)
      : (previous?.employeeStatusFilter || null),
    title: Object.prototype.hasOwnProperty.call(next, 'title')
      ? (next.title || null)
      : (previous?.title || null),
    items: Object.prototype.hasOwnProperty.call(next, 'items')
      ? next.items
      : (previous?.items || null),
    // Structured multi-entity groups for "donon / sabhi" follow-ups.
    employeeGroup: Object.prototype.hasOwnProperty.call(next, 'employeeGroup')
      ? next.employeeGroup
      : (previous?.employeeGroup || null),
    employeeIds: Object.prototype.hasOwnProperty.call(next, 'employeeIds')
      ? next.employeeIds
      : (previous?.employeeIds || null),
    employeeQueryGroup: Object.prototype.hasOwnProperty.call(next, 'employeeQueryGroup')
      ? next.employeeQueryGroup
      : (previous?.employeeQueryGroup || null),
    locationGroup: Object.prototype.hasOwnProperty.call(next, 'locationGroup')
      ? next.locationGroup
      : (previous?.locationGroup || null),
    topic: next.topic || previous?.topic || null,
    lang: next.lang || previous?.lang || null,
    contextConfidence: next.contextConfidence != null
      ? next.contextConfidence
      : (previous?.contextConfidence != null ? previous.contextConfidence : 0.9),
  };

  // Explicit null organizationId clears sticky org (e.g. "another organization").
  if (Object.prototype.hasOwnProperty.call(next, 'organizationId') && next.organizationId == null) {
    merged.organizationId = null;
    merged.organizationName = null;
  }

  if (Object.prototype.hasOwnProperty.call(next, 'locationIds')) {
    merged.locationIds = next.locationIds;
  } else if (replacingOrg) {
    // New org answer without locationIds clears previous org's location list.
    merged.locationIds = next.locationIds || null;
  }

  if (Object.prototype.hasOwnProperty.call(next, 'organizationIds')) {
    merged.organizationIds = next.organizationIds;
  } else if (replacingOrg) {
    merged.organizationIds = next.organizationIds || null;
  }

  // Explicitly replace pending selection when a new list is returned; clear when omitted on a final answer.
  if (Object.prototype.hasOwnProperty.call(next, 'pendingSelection')) {
    merged.pendingSelection = next.pendingSelection;
    merged.pendingSelectionType = next.pendingSelectionType || next.pendingSelection?.type || null;
  } else if (next.topic && next.topic !== 'pending_selection') {
    merged.pendingSelection = null;
    merged.pendingSelectionType = null;
  }

  // Location change under same org: clear employee sticky so old person does not leak.
  if (replacingLocation && previous?.locationId && next.locationId !== previous.locationId) {
    if (!Object.prototype.hasOwnProperty.call(next, 'employeeId')) {
      merged.employeeId = null;
      merged.employeeName = null;
    }
  }

  return merged;
}

function resolveFollowUpHints(message, context) {
  if (!context) return {};
  // Always expose sticky subject ids so short follow-ups ("October ki chahiye", "uski details")
  // can reuse the active organization / location / employee / document.
  const hints = {};
  if (context.employeeId) hints.employeeId = context.employeeId;
  if (context.employeeName) hints.employeeName = context.employeeName;
  if (context.organizationId) hints.organizationId = context.organizationId;
  if (context.organizationName) hints.organizationName = context.organizationName;
  if (context.locationId) hints.locationId = context.locationId;
  if (context.locationName) hints.locationName = context.locationName;
  if (Array.isArray(context.locationIds) && context.locationIds.length) {
    hints.locationIds = context.locationIds;
  }
  if (context.month) hints.month = context.month;
  if (context.documentType) hints.documentType = context.documentType;
  if (context.lastIntent) hints.lastIntent = context.lastIntent;
  if (context.topic) hints.topic = context.topic;
  return hints;
}

/** Short follow-ups that should not replace the last substantive subject query. */
function isShortSubjectFollowUp(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const tokens = text.toLowerCase().match(/[a-z0-9\u0900-\u097F]+/gi) || [];
  if (tokens.length > 8) return false;
  return /\b(uski|uska|uske|unki|unka|unke|usko|inke|inki|inka|inmein|ismein|same|wahi|vahi|chahiye|chahie|chahye|batao|bhejo|do|de)\b/i.test(text)
    || /(उसकी|उसका|उसके|उनकी|उनका|इनके|इनकी|इनका|वही|चाहिए|बताओ)/.test(text)
    || /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\b/i.test(text);
}

function isCorrectionFollowUp(message) {
  const text = String(message || '');
  if (!text.trim()) return false;
  const lower = text.toLowerCase();
  return CORRECTION_WORDS.some((word) => {
    if (/^[a-z ]+$/i.test(word)) {
      return new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(lower);
    }
    return lower.includes(String(word).toLowerCase());
  });
}

function isExplicitOrganizationSwitch(message) {
  const text = String(message || '').toLowerCase();
  return TOPIC_SWITCH_ORG_WORDS.some((phrase) => text.includes(phrase.toLowerCase()));
}

/**
 * Lightweight response validation — org scope + multi-entity group size.
 * Returns { ok, reason } without mutating the answer.
 */
function validateAnswerAgainstContext(answer, context = null, request = null) {
  if (!answer) return { ok: true, reason: null };
  if (context?.organizationId) {
    const dataOrg = answer.data?.organizationId || answer.context?.organizationId || null;
    const dataLocOrg = answer.context?.organizationId || null;
    const intent = answer.intent || answer.data?.intent || '';
    const locationIntents = new Set([
      'location_details',
      'location_employee_count',
      'department_employee_count',
    ]);
    if (locationIntents.has(intent)) {
      const resolvedOrg = dataOrg || dataLocOrg;
      if (resolvedOrg && String(resolvedOrg) !== String(context.organizationId)) {
        return {
          ok: false,
          reason: 'cross_org_location',
          expectedOrganizationId: String(context.organizationId),
          actualOrganizationId: String(resolvedOrg),
        };
      }
    }
  }

  const wantsMulti = Boolean(request?.expectsMultiple);
  if (wantsMulti) {
    const returnedIds = answer.data?.locationIds
      || answer.context?.locationIds
      || answer.data?.employeeIds
      || answer.context?.employeeIds
      || null;
    const count = Array.isArray(returnedIds) ? returnedIds.length : (answer.data?.locationId || answer.data?.employeeId ? 1 : 0);
    if (count === 1 && !answer.data?.ambiguous && !answer.data?.needsClarification) {
      return { ok: false, reason: 'single_entity_for_multi_request', count };
    }
  }
  return { ok: true, reason: null };
}

function expectsMultipleEntities(message) {
  const text = String(message || '').toLowerCase();
  return /\b(dono|donon|donno|both|sabhi|sare|saare|sari|all|every)\b/i.test(text)
    || /(दोनों|सभी|सारे|सारी)/.test(text);
}

module.exports = {
  CONTEXT_TURNS,
  CORRECTION_WORDS,
  isContextFresh,
  getActiveContext,
  mergeContext,
  resolveFollowUpHints,
  isShortSubjectFollowUp,
  isCorrectionFollowUp,
  isExplicitOrganizationSwitch,
  validateAnswerAgainstContext,
  expectsMultipleEntities,
};
