const express = require('express');
const {
  currentUser,
  forgotPassword,
  resetPasswordWithToken,
  signIn,
  signUp,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');
const mongoose = require('mongoose');

const router = express.Router();

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(httpError(503, 'The database is not available.'));
  }
  return next();
}

router.post('/login', requireDatabase, signIn);
router.post('/register', requireDatabase, signUp);
router.post('/forgot-password', requireDatabase, forgotPassword);
router.post('/reset-password', requireDatabase, resetPasswordWithToken);
router.get('/me', requireAuth, currentUser);

module.exports = router;