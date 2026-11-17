const mongoose = require('mongoose');
const AssistantSession = require('../../models/AssistantSession');
const { httpError } = require('../../utils/httpError');
const { preferLang, localizeAnswer } = require('../assistantLanguage');
const { registerAllTools } = require('./tools');
const { understandIntent, detectLanguageHeuristic } = require('./assistantIntent');
const { getActiveContext, mergeContext, resolveFollowUpHints, isShortSubjectFollowUp } = require('./assistantContext');
const { answerMemoryQuestion, compactHistory } = require('./assistantMemory');
const { executeToolCall, confirmPendingAction } = require('./assistantToolExecutor');
const { getTool } = require('./assistantToolRegistry');
const {
  modelUnavailableReply,
  clarificationReply,
  unsupportedReply,
} = require('./assistantResponse');
const { approvedCorrectionHints } = require('./assistantFeedback');
const { getCircuitStatus } = require('./assistantModelClient');
const { answerDirectoryQuery } = require('./assistantDirectoryQuery');

const MAX_MESSAGE_LENGTH = 500;
const MAX_SESSION_MESSAGES = 200;
const AI_CONFIDENCE_THRESHOLD = 0.72;

registerAllTools();

function publicSessionMessage(item) {
  return {
    role: item.role,
    content: item.content,
    document: item.document || undefined,
  };
}

async function loadSession(user, sessionId) {
  if (sessionId) {
    if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, 'Invalid chat id.');
    const existing = await AssistantSession.findOne({ _id: sessionId, userId: user.id });
    if (!existing) throw httpError(404, 'Chat not found.');
    return existing;
  }
  return new AssistantSession({ userId: user.id, messages: [], actions: [], context: null });
}

async function getSession(user, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, 'Invalid chat id.');
  const session = await AssistantSession.findOne({ _id: sessionId, userId: user.id }).lean();
  if (!session) throw httpError(404, 'Chat not found.');
  return {
    sessionId: String(session._id),
    messages: session.messages.map(publicSessionMessage),
    expiresAt: session.expiresAt,
  };
}

async function deleteSession(user, sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) throw httpError(400, 'Invalid chat id.');
  await AssistantSession.deleteOne({ _id: sessionId, userId: user.id });
  return { deleted: true };
}

function say(lang, hi, en) {
  return lang === 'en' ? en : hi;
}

/**
 * Main chat entry for Shreeji AI 2.0.
 * Uses AI tool planning first; falls back to the proven legacy respond path.
 */
async function chat(user, input = {}, deps = {}) {
  if (user.role !== 'admin') throw httpError(403, 'Assistant is available to admin users only.');

  const respondLegacy = deps.respondLegacy;
  if (typeof respondLegacy !== 'function') {
    throw new Error('assistantOrchestrator.chat requires deps.respondLegacy');
  }

  const session = await loadSession(user, input.sessionId);
  const userText = typeof input.message === 'string' && input.message.trim()
    ? input.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : typeof input.label === 'string' ? input.label.trim().slice(0, 200) : '';

  const state = {};
  const answer = await handleTurn(user, input, session, state, {
    respondLegacy,
    loadDirectory: deps.loadDirectory,
  });
  const { context, ...response } = answer;

  const assistantTurns = session.messages.filter((item) => item.role === 'assistant').length;
  const lang = state.lang || preferLang(input.language, userText, detectLanguageHeuristic(userText));
  const localized = await localizeAnswer(response, lang);

  const followUpOnly = userText ? isShortSubjectFollowUp(userText) : false;
  if (context) {
    session.context = mergeContext(session.context, {
      ...context,
      // Keep the last substantive subject query; don't replace it with "October ki chahiye".
      query: followUpOnly
        ? (context.query || session.context?.query || null)
        : (context.query || state.message || userText),
      turn: assistantTurns,
      lang,
    });
  } else if (userText) {
    // Preserve sticky subject even when this reply did not emit a new context object.
    session.context = mergeContext(session.context, {
      turn: assistantTurns,
      lang,
      ...(followUpOnly ? {} : { query: userText }),
    });
  }

  if (userText) session.messages.push({ role: 'user', content: userText });
  session.messages.push({
    role: 'assistant',
    content: String(localized.reply || '').slice(0, 4000),
    document: localized.document || null,
  });
  if (session.messages.length > MAX_SESSION_MESSAGES) {
    session.messages.splice(0, session.messages.length - MAX_SESSION_MESSAGES);
  }

  const verifiedWrite = localized.execution?.verified === true
    && (input.plan?.confirm === true || input.confirmPendingActionId || localized.pendingAction?.status === 'executed');
  if (verifiedWrite && String(localized.reply || '').startsWith('✅')) {
    session.actions.push({ text: localized.reply.split('\n')[0].replace(/^✅\s*/, '').slice(0, 500) });
  } else if (input.plan?.confirm === true && String(localized.reply || '').startsWith('✅')) {
    session.actions.push({ text: localized.reply.split('\n')[0].replace(/^✅\s*/, '').slice(0, 500) });
  } else if (localized.document) {
    session.actions.push({
      text: say(lang, `Document तैयार किया: ${localized.document.title}`, `Document ready: ${localized.document.title}`).slice(0, 500),
    });
  }

  session.markModified('context');
  await session.save();

  return {
    success: true,
    ...localized,
    sessionId: String(session._id),
  };
}

async function handleTurn(user, input, session, state, { respondLegacy, loadDirectory } = {}) {
  const spoken = typeof input.message === 'string' ? input.message : '';
  const lang = preferLang(input.language, spoken, detectLanguageHeuristic(spoken));
  state.lang = lang;

  // Explicit pending-action confirmation API shape.
  if (input.confirmPendingActionId) {
    return confirmPendingAction({
      user,
      session,
      pendingActionId: input.confirmPendingActionId,
      lang,
      timeZone: input.timeZone,
      legacyRespond: respondLegacy,
      cancel: input.cancel === true,
    });
  }

  // Choice / plan path (compatibility with existing frontend).
  if (input.plan && typeof input.plan === 'object') {
    return handlePlan(user, input, session, state, { respondLegacy, lang });
  }

  let message = typeof input.message === 'string' ? input.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  if (!message) throw httpError(400, 'Type or speak what you need.');
  state.message = message;

  const context = getActiveContext(session);
  const followHints = resolveFollowUpHints(message, context);

  // Deterministic directory queries before AI/legacy so org counts work even during MODEL_BILLING.
  if (typeof loadDirectory === 'function') {
    try {
      const directory = await loadDirectory(user);
      const directoryAnswer = await answerDirectoryQuery({
        user,
        message,
        directory,
        context,
        lang,
      });
      if (directoryAnswer) {
        return {
          reply: directoryAnswer.reply,
          choices: directoryAnswer.choices,
          context: directoryAnswer.context,
          source: 'data',
          intent: directoryAnswer.intent,
          data: directoryAnswer.data,
          execution: { status: 'completed', verified: true },
        };
      }

      // "October ki chahiye" — reuse sticky document/location/employee before AI can forget the subject.
      if (context?.documentType || context?.query) {
        const { answerDocumentMonthFollowUp } = require('../assistantService');
        const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: input.timeZone || 'Asia/Kolkata' });
        const monthFollowUp = await answerDocumentMonthFollowUp(
          user,
          message,
          directory,
          todayIso,
          context,
        );
        if (monthFollowUp) {
          return {
            ...monthFollowUp,
            source: 'data',
            execution: { status: 'completed', verified: true },
          };
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`Assistant directory query failed: ${error.message}`);
      }
    }
  }

  // Memory after directory so names like "यादव" are not mistaken for "याद".
  const memory = answerMemoryQuestion(message, session, lang);
  if (memory) return { reply: memory, source: 'data', execution: { status: 'completed', verified: true } };

  // AI-first understanding — skip when the shared circuit is open so we don't hammer a billing/auth outage.
  const history = compactHistory(session.messages);
  const corrections = await approvedCorrectionHints(user, 5).catch(() => []);
  const directorySummary = corrections.length
    ? `Approved admin corrections (prompt hints only):\n${corrections.map((c) => `- ${c.request} => ${c.expected}`).join('\n')}`
    : '';

  let understood = { ok: false, plan: null, quiet: true, error: null };
  const circuit = getCircuitStatus();
  // Skip AI planning while billing/auth requires provider action, or while the circuit is hard-open.
  if (circuit.available && !circuit.providerActionRequired) {
    understood = await understandIntent({
      message,
      history,
      context: { ...(context || {}), ...followHints },
      role: user.role,
      directorySummary,
    });
  } else if (circuit.providerActionRequired || circuit.lastError === 'MODEL_BILLING') {
    understood = {
      ok: false,
      quiet: true,
      plan: null,
      error: {
        code: 'MODEL_BILLING',
        message: 'The AI service requires usage credits or an active Ollama plan. Legacy handlers are still available.',
        retryable: false,
        providerActionRequired: true,
      },
    };
  }

  if (understood.ok && understood.plan) {
    const plan = understood.plan;
    state.lang = preferLang(input.language, plan.language, lang);

    if (plan.requiresClarification) {
      return {
        reply: clarificationReply(plan.clarificationQuestion, state.lang),
        source: 'ai',
        intent: plan.intent,
        execution: { status: 'needs_clarification', verified: true },
      };
    }

    if (plan.intent === 'unsupported') {
      return {
        reply: unsupportedReply(state.lang),
        source: 'ai',
        intent: 'unsupported',
        execution: { status: 'unsupported', verified: true },
      };
    }

    if (plan.intent === 'general_question' && plan.reply && (!plan.tool || plan.confidence < AI_CONFIDENCE_THRESHOLD)) {
      return {
        reply: plan.reply,
        source: 'ai',
        intent: plan.intent,
        execution: { status: 'completed', verified: true },
      };
    }

    if (plan.tool && plan.confidence >= AI_CONFIDENCE_THRESHOLD && getTool(plan.tool)) {
      const args = {
        ...(plan.arguments || {}),
        ...followHints,
      };
      try {
        const toolResult = await executeToolCall({
          user,
          session,
          toolName: plan.tool,
          rawArgs: args,
          lang: state.lang,
          timeZone: input.timeZone,
          legacyRespond: respondLegacy,
        });
        return toolResult;
      } catch (error) {
        // Fall through to legacy for unexpected tool failures on non-mutating reads.
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Assistant tool ${plan.tool} failed, using legacy: ${error.message}`);
        }
      }
    }
  } else if (understood.error && !understood.quiet && understood.error.code !== 'MODEL_NOT_CONFIGURED') {
    // Do not invent answers when the model fails mid-flight after we preferred AI.
    // Still allow legacy deterministic handlers for known operational requests.
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`Assistant intent model issue (${understood.correlationId}): ${understood.error.code}`);
    }
  }

  // Proven legacy keyword + existing AI document path.
  try {
    const legacy = await respondLegacy(user, input, session, state);
    return {
      ...legacy,
      modelStatus: understood?.error?.code || (circuit.providerActionRequired ? 'MODEL_BILLING' : undefined),
      execution: legacy.execution || { status: 'completed', verified: true },
    };
  } catch (error) {
    if (understood?.error) {
      return {
        reply: modelUnavailableReply(understood.error, state.lang),
        success: false,
        source: 'ai',
        error: understood.error,
        execution: { status: 'failed', verified: true },
      };
    }
    throw error;
  }
}

async function handlePlan(user, input, session, state, { respondLegacy, lang }) {
  const { plan } = input;

  if (plan.type === 'cancel') {
    if (plan.pendingActionId) {
      return confirmPendingAction({
        user,
        session,
        pendingActionId: plan.pendingActionId,
        lang,
        timeZone: input.timeZone,
        legacyRespond: respondLegacy,
        cancel: true,
      });
    }
    return {
      reply: say(lang, 'ठीक है, कुछ नहीं बदला।', 'Okay, nothing was changed.'),
      source: 'plan',
      execution: { status: 'cancelled', verified: true },
    };
  }

  // Confirm via server-side pending action when present — do not trust confirm alone.
  if (plan.confirm === true && plan.pendingActionId) {
    return confirmPendingAction({
      user,
      session,
      pendingActionId: plan.pendingActionId,
      lang,
      timeZone: input.timeZone,
      legacyRespond: respondLegacy,
    });
  }

  // Legacy plan confirm without pendingActionId (backward compatible during migration).
  // Still goes through existing respondLegacy which validates inputs server-side.
  const legacy = await respondLegacy(user, input, session, state);
  return {
    ...legacy,
    execution: legacy.execution || {
      status: plan.confirm === true ? 'completed' : 'preview',
      verified: plan.confirm === true ? String(legacy.reply || '').startsWith('✅') || Boolean(legacy.document) : true,
    },
  };
}

module.exports = {
  chat,
  getSession,
  deleteSession,
  handleTurn,
  AI_CONFIDENCE_THRESHOLD,
};
