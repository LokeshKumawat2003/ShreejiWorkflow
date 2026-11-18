const mongoose = require('mongoose');
const AssistantSession = require('../../models/AssistantSession');
const { httpError } = require('../../utils/httpError');
const { preferLang, localizeAnswer, enrichMessageForRules } = require('../assistantLanguage');
const { registerAllTools } = require('./tools');
const { detectLanguageHeuristic } = require('./assistantIntent');
const { getActiveContext, mergeContext, isShortSubjectFollowUp } = require('./assistantContext');
const { answerMemoryQuestion } = require('./assistantMemory');
const { confirmPendingAction } = require('./assistantToolExecutor');
const { answerDirectoryQuery } = require('./assistantDirectoryQuery');
const { applyApprovedFeedback } = require('./assistantFeedback');
const { prepareMessageForIntent } = require('./assistantNlu');

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

  const startedAt = Date.now();
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
  const localized = localizeAnswer(response, lang);

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
  // Persist session without blocking the HTTP reply when the chat already has an id.
  const sessionId = session.isNew ? null : String(session._id);
  if (session.isNew) {
    await session.save();
  } else {
    session.save().catch((error) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`Assistant session save failed: ${error.message}`);
      }
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.info(`Assistant chat ${Date.now() - startedAt}ms source=${localized.source || 'unknown'}`);
  }

  return {
    success: true,
    ...localized,
    sessionId: sessionId || String(session._id),
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

  // Approved feedback overrides rules for the same question.
  try {
    const taught = await applyApprovedFeedback(user, message);
    if (taught?.reply) {
      return {
        reply: taught.reply,
        source: 'feedback',
        intent: taught.intent,
        execution: { status: 'completed', verified: true },
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`Assistant feedback apply failed: ${error.message}`);
    }
  }

  // Identity/greetings before directory/DB work.
  try {
    const { answerSmallTalk } = require('../assistantService');
    const smallTalk = answerSmallTalk(message, lang);
    if (smallTalk) {
      return {
        reply: smallTalk,
        source: 'rules',
        execution: { status: 'completed', verified: true },
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`Assistant small-talk check failed: ${error.message}`);
    }
  }

  // Deterministic directory queries before legacy so org counts stay fast and local.
  if (typeof loadDirectory === 'function') {
    try {
      const directory = await loadDirectory(user);
      // Reuse in respondLegacy — avoid a second full directory fetch / directory query on the same turn.
      state.preloadedDirectory = directory;
      state.directoryChecked = true;
      // Normalize + synonym-bridge before directory intent (no LLM).
      const nluPrepared = prepareMessageForIntent(message);
      const directoryMessage = enrichMessageForRules(nluPrepared.expanded || message);
      const directoryAnswer = await answerDirectoryQuery({
        user,
        message: directoryMessage,
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

      // "October ki chahiye" — reuse sticky document/location/employee before rules forget the subject.
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

  // Fast path only: no external LLM (Ollama/Gemini). Rules + data handlers reply immediately.
  const legacy = await respondLegacy(user, input, session, state);
  return {
    ...legacy,
    execution: legacy.execution || { status: 'completed', verified: true },
  };
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
