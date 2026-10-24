const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createOrganization } = require('./organizationService');
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

function isValidAdminSignupCode(code) {
  const expected = process.env.ADMIN_SIGNUP_CODE;
  if (!expected) {
    throw httpError(403, 'Admin registration is disabled on this server.');
  }
  if (typeof code !== 'string' || !code) return false;

  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  const actualHash = crypto.createHash('sha256').update(code).digest();
  return crypto.timingSafeEqual(expectedHash, actualHash);
}

async function registerAdmin(input) {
  if (!isValidAdminSignupCode(input.adminCode)) {
    throw httpError(403, 'Invalid admin signup code.');
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';

  if (!name || !email || !password) {
    throw httpError(400, 'Name, email, and password are required.');
  }
  if (name.length > 100 || email.length > 254) {
    throw httpError(400, 'One or more fields exceed the maximum length.');
  }
  if (!validateEmail(email)) {
    throw httpError(400, 'Enter a valid email address.');
  }
  if (password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters long.');
  }

  const admin = await User.create({ name, email, password, role: 'admin', status: 'active' });
  return publicUser(admin);
}

async function register(input) {
  let user;
  if (input.role === 'admin') {
    user = await registerAdmin(input);
  } else if (input.role === 'organization') {
    ({ organization: user } = await createOrganization({ ...input, status: 'active' }));
  } else {
    throw httpError(400, 'Role must be organization or admin.');
  }

  return { token: createToken(user), user };
}

module.exports = {
  createToken,
  getJwtSecret,
  login,
  register,
};