const mongoose = require('mongoose');

const FEEDBACK_TYPES = [
  'correct_answer',
  'incorrect_answer',
  'wrong_intent',
  'missing_details',
  'wrong_calculation',
  'failed_action',
  'irrelevant_response',
  'language_issue',
];

const assistantFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssistantSession', default: null, index: true },
    type: { type: String, enum: FEEDBACK_TYPES, required: true },
    originalRequest: { type: String, default: '', maxlength: 2000 },
    assistantResponse: { type: String, default: '', maxlength: 4000 },
    detectedIntent: { type: String, default: '', maxlength: 200 },
    toolName: { type: String, default: '', maxlength: 120 },
    correction: { type: String, default: '', maxlength: 2000 },
    expectedBehaviour: { type: String, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true, minimize: false },
);

module.exports = mongoose.models.AssistantFeedback
  || mongoose.model('AssistantFeedback', assistantFeedbackSchema);
module.exports.FEEDBACK_TYPES = FEEDBACK_TYPES;
