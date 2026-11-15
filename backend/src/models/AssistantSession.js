const mongoose = require('mongoose');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const assistantSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: {
      type: [{
        _id: false,
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, default: '', maxlength: 4000 },
        document: { type: mongoose.Schema.Types.Mixed, default: null },
        at: { type: Date, default: Date.now },
      }],
      default: [],
    },
    // Things the assistant actually changed or prepared, for "what have you done so far".
    actions: { type: [{ _id: false, text: { type: String, maxlength: 500 }, at: { type: Date, default: Date.now } }], default: [] },
    // What the last answers were about (locations, month, topic) so follow-up questions can refer back to them.
    context: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + SESSION_TTL_MS) },
  },
  { timestamps: true, minimize: false },
);

// Every chat is deleted automatically 24 hours after it started.
assistantSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.AssistantSession || mongoose.model('AssistantSession', assistantSessionSchema);
