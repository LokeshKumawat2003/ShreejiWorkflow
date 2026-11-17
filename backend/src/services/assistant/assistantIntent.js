const { chatCompletions } = require('./assistantModelClient');
const { toolCatalogForPrompt } = require('./assistantToolRegistry');
const { validatePlanContract } = require('./assistantValidation');
const { enrichMessageForRules } = require('../assistantLanguage');

const INTENT_SYSTEM = `You are the planning brain for Shreeji AI, an Admin assistant for Shreeji Workflow.
Return ONLY valid JSON with this shape:
{
  "intent": "general_question|database_read|database_search|database_aggregation|employee_information|attendance_information|payroll_information|document_request|write_action|edit_action|delete_action|follow_up|clarification|unsupported",
  "language": "hi|en|hinglish",
  "confidence": 0.0-1.0,
  "tool": "exact tool name from catalog or null",
  "arguments": {},
  "requiresClarification": false,
  "clarificationQuestion": null,
  "reply": "optional short direct reply for general_question only"
}

Rules:
- Never invent employee names, amounts, counts, or statuses.
- Prefer a tool from the catalog when the admin asks for data or an action.
- Distinguish HOW-TO questions from action instructions. "Attendance kaise mark karte hain?" is general_question, not attendance.mark.
- Use conversation context for pronouns like uski/uska/uski salary.
- If required IDs/month/location are missing and cannot be inferred, set requiresClarification=true.
- Write/edit tools must only be chosen for clear instructions to change data.
- language must match the admin's message (Hindi/English/Hinglish).`;

function detectLanguageHeuristic(text) {
  const value = String(text || '');
  if (/[\u0900-\u097F]/.test(value)) return 'hi';
  // Avoid bare English words like "do"/"ka" colliding with Hinglish markers.
  const hinglish = /\b(kya|hai|hain|kitne|kitna|kitni|batao|batana|karo|karte|kar|bana|banao|banado|mujhe|mujh|mera|meri|sabhi|saare|sare|sari|chahiye|nahi|nahin|kaise|kahan|uski|uska|ki|ke|ka)\b/i.test(value);
  if (hinglish) return 'hinglish';
  return 'en';
}

function buildContextBlock(context) {
  if (!context || typeof context !== 'object') return 'No prior context.';
  const bits = [
    context.organizationId ? `organizationId=${context.organizationId}` : null,
    context.locationId ? `locationId=${context.locationId}` : null,
    context.employeeId ? `employeeId=${context.employeeId}` : null,
    context.employeeName ? `employeeName=${context.employeeName}` : null,
    context.month ? `month=${context.month}` : null,
    context.previousTool ? `previousTool=${context.previousTool}` : null,
    context.topic ? `topic=${context.topic}` : null,
    context.query ? `previousQuery=${String(context.query).slice(0, 200)}` : null,
  ].filter(Boolean);
  return bits.join('\n') || 'No prior context.';
}

/**
 * AI-first intent understanding with structured tool proposal.
 * Falls back to null plan when model is unavailable — orchestrator then uses legacy rules.
 */
async function understandIntent({
  message,
  history = [],
  context = null,
  role = 'admin',
  directorySummary = '',
}) {
  const language = detectLanguageHeuristic(message);
  const enriched = enrichMessageForRules(message);
  const tools = toolCatalogForPrompt(role);

  const response = await chatCompletions({
    temperature: 0,
    json: true,
    timeoutMs: 25_000,
    messages: [
      { role: 'system', content: INTENT_SYSTEM },
      {
        role: 'system',
        content: `TOOL CATALOG:\n${JSON.stringify(tools)}\n\nCONTEXT:\n${buildContextBlock(context)}\n\nDIRECTORY SUMMARY:\n${directorySummary || '(none)'}`,
      },
      ...history.slice(-6).map((item) => ({
        role: item.role,
        content: String(item.content || '').slice(0, 500),
      })),
      { role: 'user', content: enriched.slice(0, 500) },
    ],
  });

  if (!response.ok) {
    return {
      ok: false,
      language,
      error: response.error,
      quiet: response.quiet,
      correlationId: response.correlationId,
      plan: null,
    };
  }

  if (!response.parsed) {
    return {
      ok: false,
      language,
      error: { code: 'MODEL_BAD_JSON', message: 'The AI returned invalid JSON.', retryable: true },
      correlationId: response.correlationId,
      plan: null,
    };
  }

  const validated = validatePlanContract(response.parsed);
  if (!validated.ok) {
    return {
      ok: false,
      language,
      error: { code: 'MODEL_BAD_PLAN', message: 'The AI plan failed validation.', retryable: true },
      correlationId: response.correlationId,
      plan: null,
    };
  }

  const plan = validated.value;
  if (!plan.language) plan.language = language;

  // Reject unknown / unsafe tools — backend decides what is permitted.
  if (plan.tool) {
    const allowlisted = tools.some((tool) => tool.name === plan.tool);
    const looksUnsafe = /[;`$]|db\.|mongo|shell|eval|require\(|process\.|child_process/i.test(plan.tool);
    if (!allowlisted || looksUnsafe) {
      plan.tool = null;
      if (!plan.requiresClarification && plan.intent !== 'general_question') {
        plan.requiresClarification = true;
        plan.clarificationQuestion = plan.language === 'en'
          ? 'I understood the request but need a supported action. Can you rephrase?'
          : 'मैंने समझा, लेकिन इसके लिए कोई supported action नहीं मिला। थोड़ा और साफ़ बताएँ?';
      }
    }
  }

  return {
    ok: true,
    language: plan.language,
    correlationId: response.correlationId,
    plan,
  };
}

module.exports = {
  understandIntent,
  detectLanguageHeuristic,
  buildContextBlock,
};
