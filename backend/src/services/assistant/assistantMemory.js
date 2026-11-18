/**
 * Lightweight conversation memory helpers for follow-ups and "what have you done".
 */

const MEMORY_QUESTION_WORDS = [
  'what have you done', 'what did you do', 'yaad hai', 'yaad rakho', 'remember', 'memory',
  'क्या किया', 'क्या-क्या किया', 'अब तक', 'so far', 'done so far',
];

/** Short tokens that must not substring-match inside names (याद ⊂ यादव). */
const MEMORY_BOUNDARY_WORDS = ['yaad', 'याद'];

function includesAny(text, list) {
  const lower = String(text || '').toLowerCase();
  return list.some((word) => lower.includes(String(word).toLowerCase()));
}

function includesBoundaryWord(text, list) {
  const raw = String(text || '');
  return list.some((word) => {
    const token = String(word);
    if (/[\u0900-\u097F]/.test(token)) {
      return new RegExp(`(^|[^\\u0900-\\u097F])${token}([^\\u0900-\\u097F]|$)`).test(raw);
    }
    return new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(raw);
  });
}

function answerMemoryQuestion(message, session, lang = 'hi') {
  if (!includesAny(message, MEMORY_QUESTION_WORDS) && !includesBoundaryWord(message, MEMORY_BOUNDARY_WORDS)) {
    return null;
  }
  const actions = Array.isArray(session?.actions) ? session.actions : [];
  if (actions.length === 0) {
    return lang === 'en'
      ? 'No database changes have been made in this chat yet.'
      : 'इस chat में अभी तक database में कोई बदलाव नहीं किया।';
  }
  const lines = actions.slice(-12).map((item, index) => `${index + 1}. ${item.text}`);
  return lang === 'en'
    ? `In this chat so far:\n${lines.join('\n')}`
    : `इस chat में अब तक:\n${lines.join('\n')}`;
}

function compactHistory(messages, limit = 6) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-limit)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 500) }));
}

/**
 * Compact summary of sticky entities for long sessions (100–200 messages).
 * Preserves IDs so older message text can be trimmed without losing scope.
 */
function summarizeConversationContext(context, messages = []) {
  if (!context && (!messages || !messages.length)) return null;
  const recent = compactHistory(messages, 8);
  return {
    organizationId: context?.organizationId || null,
    organizationName: context?.organizationName || null,
    locationId: context?.locationId || null,
    locationName: context?.locationName || null,
    locationIds: Array.isArray(context?.locationIds) ? context.locationIds : null,
    employeeId: context?.employeeId || null,
    employeeName: context?.employeeName || null,
    lastIntent: context?.lastIntent || null,
    topic: context?.topic || null,
    lang: context?.lang || null,
    documentType: context?.documentType || null,
    month: context?.month || null,
    recentTurns: recent.length,
    recent: recent.map((item) => `${item.role}: ${item.content.slice(0, 120)}`),
  };
}

module.exports = {
  answerMemoryQuestion,
  compactHistory,
  summarizeConversationContext,
  MEMORY_QUESTION_WORDS,
  includesBoundaryWord,
};
