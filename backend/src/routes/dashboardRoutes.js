const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted.', user: req.user });
});

module.exports = router;