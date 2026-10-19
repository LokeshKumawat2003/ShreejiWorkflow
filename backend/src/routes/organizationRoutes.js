const express = require('express');
const mongoose = require('mongoose');
const { create, get, list, remove, update } = require('../controllers/organizationController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');

const router = express.Router();

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(httpError(503, 'The database is not available.'));
  }
  return next();
}

router.use(requireAuth, requireRole('admin'), requireDatabase);
router.get('/', list);
router.post('/', create);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;