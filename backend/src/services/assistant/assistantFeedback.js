const AssistantFeedback = require('../../models/AssistantFeedback');
const { FEEDBACK_TYPES } = require('../../models/AssistantFeedback');
const { httpError } = require('../../utils/httpError');
const mongoose = require('mongoose');

const FEEDBACK_CACHE_TTL_MS = Number(process.env.ASSISTANT_FEEDBACK_CACHE_MS) || 45_000;
const approvedFeedbackCache = new Map();

function assertAdmin(user) {
  if (!user || user.role !== 'admin') throw httpError(403, 'Assistant feedback is admin-only.');
}

function clearApprovedFeedbackCache(userId = null) {
  if (userId) approvedFeedbackCache.delete(String(userId));
  else approvedFeedbackCache.clear();
}

function normalizeFeedbackText(text) {
  return String(text || '')
    .toLowerCase()
    // Keep letters (incl. Devanagari) — only strip common punctuation/symbols.
    .replace(/[?؟！!.,，。;；:：'"“”‘’`()[\]{}<>|…\-–—_/\\@#$%^&*+=~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function feedbackTokens(text) {
  return normalizeFeedbackText(text).split(' ').filter((part) => part.length >= 2);
}

/** Pull a usable reply from expectedBehaviour / correction text. */
function replyFromApprovedFeedback(row) {
  const expected = String(row.expectedBehaviour || row.expected || '').trim();
  const correction = String(row.correction || '').trim();
  const source = expected || correction;
  if (!source) return null;

  const jawabQuoted = source.match(
    /(?:जवाब|reply|answer|say|bolo|बोलो)\s*[:\-–]?\s*[“”"']([^“”"']{2,800})[“”"']/i,
  );
  if (jawabQuoted) return jawabQuoted[1].trim().slice(0, 1000);

  const quoted = source.match(/[“”"']([^“”"']{2,800})[“”"']/);
  if (quoted && /(?:जवाब|reply|answer|say|तो)\b/i.test(source)) {
    return quoted[1].trim().slice(0, 1000);
  }

  const jawabPlain = source.match(/(?:जवाब|reply|answer)\s*[:\-–]\s*(.+)$/i);
  if (jawabPlain) return jawabPlain[1].replace(/^["'“”]|["'“”]$/g, '').trim().slice(0, 1000);

  // Instructional notes are not spoken replies.
  if (/^(when|अगर|जब|should|expected|reply should|incorrect|wrong|गलत)/i.test(source)) {
    if (correction && !/^(when|अगर|जब|should|incorrect|wrong|गलत)/i.test(correction)) {
      return correction.slice(0, 1000);
    }
    return null;
  }

  return source.slice(0, 1000);
}

function scoreFeedbackMatch(message, originalRequest) {
  const left = normalizeFeedbackText(message);
  const right = normalizeFeedbackText(originalRequest);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return shorter / longer >= 0.7 ? 0.92 : 0.75;
  }
  const a = new Set(feedbackTokens(left));
  const b = new Set(feedbackTokens(right));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  const coverage = overlap / Math.max(a.size, b.size);
  const recall = overlap / b.size;
  if (recall >= 0.85 && coverage >= 0.6) return 0.88;
  if (recall >= 0.7 && coverage >= 0.5) return 0.8;
  return 0;
}

async function loadApprovedFeedbackRows(user, limit = 40) {
  if (!user?.id || user.role !== 'admin') return [];
  const key = String(user.id);
  const hit = approvedFeedbackCache.get(key);
  if (hit && Date.now() - hit.at < FEEDBACK_CACHE_TTL_MS) return hit.rows;

  const rows = await AssistantFeedback.find({
    userId: user.id,
    status: 'approved',
    type: { $ne: 'correct_answer' },
  })
    .sort({ reviewedAt: -1, updatedAt: -1 })
    .limit(limit)
    .select('originalRequest expectedBehaviour correction type reviewedAt')
    .lean();

  approvedFeedbackCache.set(key, { at: Date.now(), rows });
  return rows;
}

/**
 * Apply approved feedback on the rules path: if this message matches a saved
 * originalRequest, return the expected reply immediately.
 */
async function applyApprovedFeedback(user, message) {
  const rows = await loadApprovedFeedbackRows(user);
  if (!rows.length) return null;

  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreFeedbackMatch(message, row.originalRequest);
    if (score < 0.8 || score < bestScore) continue;
    const reply = replyFromApprovedFeedback(row);
    if (!reply) continue;
    best = {
      reply,
      source: 'feedback',
      intent: 'approved_feedback',
      feedbackType: row.type,
      score,
    };
    bestScore = score;
  }
  return best;
}

async function submitFeedback(user, input = {}) {
  assertAdmin(user);
  const type = FEEDBACK_TYPES.includes(input.type) ? input.type : null;
  if (!type) throw httpError(400, 'Invalid feedback type.');

  const doc = await AssistantFeedback.create({
    userId: user.id,
    sessionId: mongoose.isValidObjectId(input.sessionId) ? input.sessionId : null,
    type,
    originalRequest: String(input.originalRequest || '').slice(0, 2000),
    assistantResponse: String(input.assistantResponse || '').slice(0, 4000),
    detectedIntent: String(input.detectedIntent || '').slice(0, 200),
    toolName: String(input.toolName || '').slice(0, 120),
    correction: String(input.correction || '').slice(0, 2000),
    expectedBehaviour: String(input.expectedBehaviour || '').slice(0, 2000),
    status: 'pending',
  });

  return {
    success: true,
    feedback: {
      id: String(doc._id),
      type: doc.type,
      status: doc.status,
      createdAt: doc.createdAt,
    },
  };
}

async function reviewFeedback(user, feedbackId, { status, reviewNote } = {}) {
  assertAdmin(user);
  if (!mongoose.isValidObjectId(feedbackId)) throw httpError(400, 'Invalid feedback id.');
  if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'Status must be approved or rejected.');

  const doc = await AssistantFeedback.findOne({ _id: feedbackId, userId: user.id });
  if (!doc) throw httpError(404, 'Feedback not found.');
  doc.status = status;
  doc.reviewedAt = new Date();
  doc.reviewNote = String(reviewNote || '').slice(0, 1000);
  await doc.save();
  clearApprovedFeedbackCache(user.id);
  return {
    success: true,
    feedback: {
      id: String(doc._id),
      type: doc.type,
      status: doc.status,
      reviewedAt: doc.reviewedAt,
    },
  };
}

async function listFeedback(user, { status } = {}) {
  assertAdmin(user);
  const filter = { userId: user.id };
  if (status && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
  const items = await AssistantFeedback.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const [total, pending, approved, rejected] = await Promise.all([
    AssistantFeedback.countDocuments({ userId: user.id }),
    AssistantFeedback.countDocuments({ userId: user.id, status: 'pending' }),
    AssistantFeedback.countDocuments({ userId: user.id, status: 'approved' }),
    AssistantFeedback.countDocuments({ userId: user.id, status: 'rejected' }),
  ]);

  const typeCounts = await AssistantFeedback.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(user.id) } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return {
    success: true,
    summary: {
      total,
      pending,
      approved,
      rejected,
      repeatedErrors: typeCounts.slice(0, 8).map((row) => ({ type: row._id, count: row.count })),
    },
    items: items.map((item) => ({
      id: String(item._id),
      type: item.type,
      status: item.status,
      originalRequest: item.originalRequest,
      assistantResponse: item.assistantResponse,
      correction: item.correction,
      expectedBehaviour: item.expectedBehaviour,
      detectedIntent: item.detectedIntent,
      toolName: item.toolName,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt,
    })),
  };
}

/**
 * Approved corrections as compact hints (legacy AI prompt path + UI).
 */
async function approvedCorrectionHints(user, limit = 8) {
  const rows = await loadApprovedFeedbackRows(user, limit);
  return rows.map((row) => ({
    type: row.type,
    request: row.originalRequest,
    expected: row.expectedBehaviour || row.correction,
  }));
}

module.exports = {
  submitFeedback,
  reviewFeedback,
  listFeedback,
  approvedCorrectionHints,
  applyApprovedFeedback,
  replyFromApprovedFeedback,
  scoreFeedbackMatch,
  normalizeFeedbackText,
  clearApprovedFeedbackCache,
  FEEDBACK_TYPES,
};
