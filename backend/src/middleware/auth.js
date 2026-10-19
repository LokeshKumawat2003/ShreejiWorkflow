const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getJwtSecret } = require('../services/authService');
const { httpError } = require('../utils/httpError');
const { publicUser } = require('../utils/user');

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(httpError(401, 'Authentication is required.'));
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (mongooseDisconnected()) {
      throw httpError(503, 'The database is not available.');
    }

    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw httpError(401, 'Your account is unavailable. Please sign in again.');
    }

    req.user = publicUser(user);
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