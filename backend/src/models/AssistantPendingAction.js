const mongoose = require('mongoose');

const PENDING_TTL_MS = 15 * 60 * 1000;

const assistantPendingActionSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssistantSession', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toolName: { type: String, required: true, maxlength: 120 },
    arguments: { type: mongoose.Schema.Types.Mixed, required: true },
    previewSummary: { type: String, required: true, maxlength: 2000 },
    legacyPlan: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['pending', 'executed', 'cancelled', 'expired', 'failed'],
      default: 'pending',
      index: true,
    },
    executionResult: { type: mongoose.Schema.Types.Mixed, default: null },
    idempotencyKey: { type: String, required: true, unique: true, maxlength: 120 },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + PENDING_TTL_MS) },
    executedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

assistantPendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.AssistantPendingAction
  || mongoose.model('AssistantPendingAction', assistantPendingActionSchema);
module.exports.PENDING_TTL_MS = PENDING_TTL_MS;
