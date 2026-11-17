const AssistantFeedback = require('../../models/AssistantFeedback');
const { FEEDBACK_TYPES } = require('../../models/AssistantFeedback');
const { httpError } = require('../../utils/httpError');
const mongoose = require('mongoose');

function assertAdmin(user) {
  if (!user || user.role !== 'admin') throw httpError(403, 'Assistant feedback is admin-only.');
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
 * Approved corrections become prompt hints only — never auto-edit business logic.
 */
async function approvedCorrectionHints(user, limit = 8) {
  if (!user || user.role !== 'admin') return [];
  const rows = await AssistantFeedback.find({ userId: user.id, status: 'approved' })
    .sort({ reviewedAt: -1 })
    .limit(limit)
    .select('originalRequest expectedBehaviour correction type')
    .lean();
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
  FEEDBACK_TYPES,
};
