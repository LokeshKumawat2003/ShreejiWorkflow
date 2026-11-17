const CONTEXT_TURNS = 6;

function isContextFresh(session) {
  if (!session?.context) return false;
  const assistantTurns = (session.messages || []).filter((item) => item.role === 'assistant').length;
  const turn = Number(session.context.turn);
  if (!Number.isFinite(turn)) return true;
  return assistantTurns - turn <= CONTEXT_TURNS;
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
  const merged = {
    ...(previous || {}),
    ...next,
    // Explicit null from a new subject answer clears the previous id (e.g. location doc after employee).
    employeeId: pickSticky(next, previous, 'employeeId'),
    employeeName: pickSticky(next, previous, 'employeeName'),
    // Prefer the org named on this turn; do not keep a stale org when a new one is set.
    organizationId: replacingOrg ? next.organizationId : pickSticky(next, previous, 'organizationId'),
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
  };

  if (Object.prototype.hasOwnProperty.call(next, 'locationIds')) {
    merged.locationIds = next.locationIds;
  } else if (replacingOrg) {
    // New org answer without locationIds clears previous org's location list.
    merged.locationIds = next.locationIds || null;
  }

  // Explicitly replace pending selection when a new list is returned; clear when omitted on a final answer.
  if (Object.prototype.hasOwnProperty.call(next, 'pendingSelection')) {
    merged.pendingSelection = next.pendingSelection;
    merged.pendingSelectionType = next.pendingSelectionType || next.pendingSelection?.type || null;
  } else if (next.topic && next.topic !== 'pending_selection') {
    merged.pendingSelection = null;
    merged.pendingSelectionType = null;
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
  if (context.locationId) hints.locationId = context.locationId;
  if (context.month) hints.month = context.month;
  if (context.documentType) hints.documentType = context.documentType;
  return hints;
}

/** Short follow-ups that should not replace the last substantive subject query. */
function isShortSubjectFollowUp(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const tokens = text.toLowerCase().match(/[a-z0-9\u0900-\u097F]+/gi) || [];
  if (tokens.length > 8) return false;
  return /\b(uski|uska|uske|unki|unka|unke|usko|same|wahi|vahi|chahiye|chahie|chahye|batao|bhejo|do|de)\b/i.test(text)
    || /(उसकी|उसका|उसके|उनकी|उनका|वही|चाहिए|बताओ)/.test(text)
    || /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\b/i.test(text);
}

module.exports = {
  CONTEXT_TURNS,
  isContextFresh,
  getActiveContext,
  mergeContext,
  resolveFollowUpHints,
  isShortSubjectFollowUp,
};
