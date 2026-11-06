const mongoose = require('mongoose');
const User = require('../models/User');
const { createToken, verifyToken } = require('../services/authService');
const { httpError } = require('../utils/httpError');
const { readAuthCookie, setAuthCookie } = require('../utils/authCookie');
const { publicUser } = require('../utils/user');

async function requireAuth(req, res, next) {
  const token = readAuthCookie(req);
  if (!token) {
    return next(httpError(401, 'Authentication is required.'));
  }

  try {
    const payload = verifyToken(token);
    if (mongooseDisconnected()) {
      throw httpError(503, 'The database is not available.');
    }
    if (!mongoose.isValidObjectId(payload.sub)) {
      throw httpError(401, 'Invalid or expired authentication token.');
    }

    const user = await User.findById(payload.sub).select('+passwordChangedAt');
    if (!user || user.status !== 'active') {
      throw httpError(401, 'Your account is unavailable. Please sign in again.');
    }
    if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw httpError(401, 'Your password was changed. Please sign in again.');
    }

    req.user = publicUser(user);
    req.rememberMe = payload.remember !== false;
    if (!req.rememberMe) {
      setAuthCookie(res, createToken(user, { rememberMe: false }), false);
    }
    return next();
  } catch (error) {
    if (error.statusCode) {
      return next(error);
    }
    return next(httpError(401, 'Invalid or expired authentication token.'));
  }
}

function mongooseDisconnected() {
  return mongoose.connection.readyState !== 1;
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(httpError(401, 'Authentication is required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, 'You do not have permission to access this resource.'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };