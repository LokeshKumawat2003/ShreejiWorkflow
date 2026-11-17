const crypto = require('crypto');
const AssistantPendingAction = require('../../models/AssistantPendingAction');
const { getTool } = require('./assistantToolRegistry');
const { sanitizeToolArguments } = require('./assistantValidation');
const { httpError } = require('../../utils/httpError');

function ensureToolAllowed(tool, user) {
  if (!tool) throw httpError(400, 'Unknown assistant tool.');
  if (!tool.roles.includes('*') && !tool.roles.includes(user.role)) {
    throw httpError(403, 'This assistant tool is not available for your role.');
  }
}

async function createPendingAction({ user, session, tool, args, previewSummary, legacyPlan }) {
  const idempotencyKey = crypto
    .createHash('sha256')
    .update([
      String(session._id),
      String(user.id),
      tool.name,
      JSON.stringify(args),
      String(Date.now()).slice(0, 8),
    ].join('|'))
    .digest('hex')
    .slice(0, 40);

  const pending = await AssistantPendingAction.create({
    sessionId: session._id,
    userId: user.id,
    toolName: tool.name,
    arguments: args,
    previewSummary: String(previewSummary || '').slice(0, 2000),
    legacyPlan: legacyPlan || null,
    idempotencyKey: `${idempotencyKey}-${crypto.randomBytes(4).toString('hex')}`,
  });

  return pending;
}

/**
 * Validate and execute a registered tool.
 * Mutating tools create a pending action and return a confirmation payload unless confirmPending is provided.
 */
async function executeToolCall({
  user,
  session,
  toolName,
  rawArgs = {},
  lang = 'hi',
  timeZone = 'Asia/Kolkata',
  confirmPending = null,
  legacyRespond = null,
}) {
  const tool = getTool(toolName);
  ensureToolAllowed(tool, user);

  const validated = sanitizeToolArguments(tool.inputSchema, rawArgs);
  if (!validated.ok) {
    return {
      success: false,
      reply: lang === 'en'
        ? `I need clearer details: ${validated.errors.join('; ')}`
        : `कुछ जानकारी अधूरी है: ${validated.errors.join('; ')}`,
      source: 'validation',
      execution: { status: 'failed', verified: false, errors: validated.errors },
    };
  }

  if (tool.validate) {
    const extra = await tool.validate({ user, args: validated.value });
    if (extra && extra.ok === false) {
      return {
        success: false,
        reply: extra.message || (lang === 'en' ? 'Those parameters are not valid.' : 'ये पैरामीटर सही नहीं हैं।'),
        source: 'validation',
        execution: { status: 'failed', verified: false },
      };
    }
  }

  // Confirmation of a previously created pending action.
  if (confirmPending) {
    return confirmPendingAction({
      user,
      session,
      pendingActionId: confirmPending,
      lang,
      timeZone,
      legacyRespond,
    });
  }

  const result = await tool.execute({
    user,
    session,
    args: validated.value,
    lang,
    timeZone,
  });

  // Mutating / confirmation-required tools: build preview via legacy plan path, store pending action.
  if (tool.requiresConfirmation && result?.legacyPlan && legacyRespond) {
    const preview = await legacyRespond(
      user,
      { plan: { ...result.legacyPlan, confirm: false }, timeZone },
      session,
      { lang },
    );
    const pending = await createPendingAction({
      user,
      session,
      tool,
      args: validated.value,
      previewSummary: preview.reply || tool.description,
      legacyPlan: result.legacyPlan,
    });

    const confirmLabel = lang === 'en' ? 'Confirm' : 'हाँ, Confirm करें';
    const cancelLabel = lang === 'en' ? 'Cancel' : 'रद्द करें';

    return {
      success: true,
      reply: preview.reply,
      choices: [
        ...(preview.choices || []).filter((c) => c?.plan?.type !== 'cancel' && c?.plan?.confirm !== true),
        { label: confirmLabel, plan: { type: result.legacyPlan.type, confirm: true, pendingActionId: String(pending._id) } },
        { label: cancelLabel, plan: { type: 'cancel', pendingActionId: String(pending._id) } },
      ],
      document: preview.document || null,
      source: 'tool',
      intent: tool.name,
      pendingAction: {
        id: String(pending._id),
        toolName: tool.name,
        summary: pending.previewSummary,
        expiresAt: pending.expiresAt,
      },
      data: result,
      execution: { status: 'awaiting_confirmation', verified: false },
    };
  }

  // Non-mutating legacy document plans.
  if (result?.legacyPlan && legacyRespond) {
    const resolved = await legacyRespond(user, { plan: result.legacyPlan, timeZone }, session, { lang });
    return {
      success: true,
      reply: resolved.reply,
      choices: resolved.choices,
      document: resolved.document || null,
      context: resolved.context,
      source: 'tool',
      intent: tool.name,
      data: result,
      execution: { status: 'completed', verified: true },
    };
  }

  const reply = tool.formatResult
    ? tool.formatResult(result, lang)
    : (lang === 'en' ? 'Done.' : 'हो गया।');

  return {
    success: true,
    reply,
    source: 'tool',
    intent: tool.name,
    data: result,
    context: {
      topic: tool.name,
      previousTool: tool.name,
      previousResultRef: {
        tool: tool.name,
        at: new Date().toISOString(),
        summary: String(reply).slice(0, 300),
      },
    },
    execution: { status: 'completed', verified: true },
  };
}

async function confirmPendingAction({
  user,
  session,
  pendingActionId,
  lang,
  timeZone,
  legacyRespond,
  cancel = false,
}) {
  if (!pendingActionId) throw httpError(400, 'Missing pending action id.');
  const pending = await AssistantPendingAction.findOne({
    _id: pendingActionId,
    userId: user.id,
    sessionId: session._id,
  });
  if (!pending) throw httpError(404, 'Pending action not found.');

  if (pending.status === 'executed') {
    return {
      success: true,
      reply: lang === 'en'
        ? 'This action was already completed. No duplicate change was made.'
        : 'यह कार्रवाई पहले ही पूरी हो चुकी है। दोबारा बदलाव नहीं किया गया।',
      source: 'pending_action',
      pendingAction: { id: String(pending._id), status: pending.status },
      execution: { status: 'already_executed', verified: true },
      document: pending.executionResult?.document || null,
    };
  }

  if (pending.status !== 'pending') {
    throw httpError(409, `Pending action is ${pending.status}.`);
  }

  if (pending.expiresAt && pending.expiresAt.getTime() < Date.now()) {
    pending.status = 'expired';
    await pending.save();
    throw httpError(410, 'This confirmation has expired. Please request the action again.');
  }

  if (cancel) {
    pending.status = 'cancelled';
    await pending.save();
    return {
      success: true,
      reply: lang === 'en' ? 'Okay, nothing was changed.' : 'ठीक है, कुछ नहीं बदला।',
      source: 'pending_action',
      execution: { status: 'cancelled', verified: true },
    };
  }

  const tool = getTool(pending.toolName);
  ensureToolAllowed(tool, user);

  // Revalidate stored arguments before execution.
  const validated = sanitizeToolArguments(tool.inputSchema, pending.arguments || {});
  if (!validated.ok) {
    pending.status = 'failed';
    pending.executionResult = { errors: validated.errors };
    await pending.save();
    return {
      success: false,
      reply: lang === 'en'
        ? 'The saved action is no longer valid. Please try again.'
        : 'सेव की गई कार्रवाई अब मान्य नहीं है। कृपया फिर से कोशिश करें।',
      source: 'pending_action',
      execution: { status: 'failed', verified: false },
    };
  }

  if (!pending.legacyPlan || !legacyRespond) {
    pending.status = 'failed';
    await pending.save();
    throw httpError(500, 'Pending action has no executable plan.');
  }

  // Lock then execute — prevents duplicate execution under concurrent confirms.
  const locked = await AssistantPendingAction.findOneAndUpdate(
    { _id: pending._id, status: 'pending', userId: user.id, sessionId: session._id },
    { $set: { status: 'executed', executedAt: new Date() } },
    { new: true },
  );
  if (!locked) {
    return {
      success: true,
      reply: lang === 'en'
        ? 'This action was already processed.'
        : 'यह कार्रवाई पहले ही प्रोसेस हो चुकी है।',
      source: 'pending_action',
      execution: { status: 'already_executed', verified: true },
    };
  }

  try {
    const answer = await legacyRespond(
      user,
      { plan: { ...pending.legacyPlan, confirm: true }, timeZone },
      session,
      { lang },
    );
    locked.executionResult = {
      reply: answer.reply,
      document: answer.document || null,
      verified: String(answer.reply || '').startsWith('✅') || Boolean(answer.document),
    };
    await locked.save();

    return {
      success: true,
      reply: answer.reply,
      document: answer.document || null,
      choices: answer.choices,
      context: answer.context,
      source: 'pending_action',
      intent: pending.toolName,
      pendingAction: { id: String(locked._id), status: 'executed' },
      execution: {
        status: 'completed',
        verified: locked.executionResult.verified === true,
      },
    };
  } catch (error) {
    locked.status = 'failed';
    locked.executionResult = { error: error.message };
    await locked.save();
    throw error;
  }
}

module.exports = {
  executeToolCall,
  confirmPendingAction,
  createPendingAction,
};
