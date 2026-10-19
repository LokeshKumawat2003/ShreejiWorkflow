const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/httpError');
const { normalizeEmail, publicUser } = require('../utils/user');
const { validateEmail } = require('../utils/validation');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw httpError(503, 'Authentication is not configured on this server.');
  }
  return secret;
}

function createToken(user) {
  return jwt.sign({ role: user.role }, getJwtSecret(), {
    subject: user.id,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

async function login(input) {
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';

  if (!email || !password) {
    throw httpError(400, 'Email and password are required.');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || user.status !== 'active' || !(await user.comparePassword(password))) {
    throw httpError(401, 'Invalid email or password.');
  }

  return { token: createToken(user), user: publicUser(user) };
}

module.exports = {
  createToken,
  getJwtSecret,
  login,
};