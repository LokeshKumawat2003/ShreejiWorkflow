const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { chat, deleteSession, getSession } = require('../services/assistantService');
const {
  submitFeedback,
  reviewFeedback,
  listFeedback,
} = require('../services/assistant/assistantFeedback');
const { getCircuitStatus, probeModelAvailability, getModelConfig } = require('../services/assistant/assistantModelClient');

const router = express.Router();

const assistantLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  key: (req) => `user:${req.user?.id}`,
  message: 'Too many assistant requests. Please wait a minute.',
});

const adminOnly = [requireAuth, requireRole('admin')];

router.post('/chat', ...adminOnly, assistantLimiter, async (req, res) => {
  res.json(await chat(req.user, req.body || {}));
});

router.get('/session/:id', ...adminOnly, async (req, res) => {
  res.json(await getSession(req.user, req.params.id));
});

router.delete('/session/:id', ...adminOnly, async (req, res) => {
  res.json(await deleteSession(req.user, req.params.id));
});

router.post('/feedback', ...adminOnly, assistantLimiter, async (req, res) => {
  res.json(await submitFeedback(req.user, req.body || {}));
});

router.get('/feedback', ...adminOnly, async (req, res) => {
  res.json(await listFeedback(req.user, { status: req.query.status }));
});

router.post('/feedback/:id/review', ...adminOnly, async (req, res) => {
  res.json(await reviewFeedback(req.user, req.params.id, req.body || {}));
});

router.get('/health', ...adminOnly, async (req, res) => {
  const circuit = getCircuitStatus();
  const config = getModelConfig();
  const probe = req.query.probe === '1'
    ? await probeModelAvailability()
    : null;
  res.json({
    success: true,
    model: {
      configured: Boolean(config.apiKey),
      baseUrl: config.baseUrl,
      modelName: config.model,
      available: probe ? probe.available : circuit.available && !circuit.providerActionRequired,
      circuitOpen: circuit.open,
      openUntil: circuit.openUntil,
      lastError: circuit.lastError,
      lastSuccessAt: circuit.lastSuccessAt,
      providerActionRequired: circuit.providerActionRequired || probe?.providerActionRequired === true,
      providerActionHint: (circuit.providerActionRequired || probe?.code === 'MODEL_BILLING')
        ? 'Add Ollama usage credits or an active plan at https://ollama.com/plans, then call /api/assistant/health?probe=1'
        : null,
      probe,
    },
  });
});

module.exports = router;
