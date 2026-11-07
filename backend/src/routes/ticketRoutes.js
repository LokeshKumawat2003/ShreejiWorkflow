const express = require('express');
const mongoose = require('mongoose');
const { create, list, update } = require('../controllers/ticketController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');

const router = express.Router();

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(httpError(503, 'The database is not available.'));
  }
  return next();
}

router.use(requireAuth, requireRole('admin', 'organization'), requireDatabase);
router.get('/', list);
router.post('/', requireRole('organization'), create);
router.patch('/:ticketId', update);

module.exports = router;
