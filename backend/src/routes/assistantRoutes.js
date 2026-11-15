const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { chat, deleteSession, getSession } = require('../services/assistantService');

const router = express.Router();

const assistantLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  key: (req) => `user:${req.user?.id}`,
  message: 'Too many assistant requests. Please wait a minute.',
});

router.post('/chat', requireAuth, requireRole('admin', 'organization'), assistantLimiter, async (req, res) => {
  res.json(await chat(req.user, req.body || {}));
});

router.get('/session/:id', requireAuth, requireRole('admin', 'organization'), async (req, res) => {
  res.json(await getSession(req.user, req.params.id));
});

router.delete('/session/:id', requireAuth, requireRole('admin', 'organization'), async (req, res) => {
  res.json(await deleteSession(req.user, req.params.id));
});

module.exports = router;
