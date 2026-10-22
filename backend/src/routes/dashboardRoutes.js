const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getDashboardSummary } = require('../services/dashboardService');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted.', user: req.user });
});

router.get('/summary', requireAuth, requireRole('admin', 'organization'), async (req, res) => {
  res.json(await getDashboardSummary(req.user, req.query));
});

module.exports = router;
