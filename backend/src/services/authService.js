const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getMailTransport } = require('./mailService');
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
    expiresIn: process.env.JWT_EXPIRES_IN || '5y',
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

async function registerAdmin(input) {
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

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function requestPasswordReset(input) {
  const email = normalizeEmail(input.email);
  if (!email || !validateEmail(email)) {
    throw httpError(400, 'Enter a valid email address.');
  }

  const user = await User.findOne({ email, status: 'active' });
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;
  const displayName = user.organizationName || user.name;

  try {
    await getMailTransport().sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: 'Reset your Shreeji workflow password',
      text: `Hello ${displayName},\n\nWe received a request to reset your password. Open the link below to choose a new password. This link expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\nShreeji Caretaker Company`,
      html: `<p>Hello ${escapeHtml(displayName)},</p>
<p>We received a request to reset your password. Click the button below to choose a new password. This link expires in 30 minutes.</p>
<p><a href="${resetUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">Reset password</a></p>
<p>Or copy this link into your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, you can ignore this email.</p>
<p>Shreeji Caretaker Company</p>`,
    });
  } catch (error) {
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    if (error.statusCode) throw error;
    console.error('Password reset email delivery failed.', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
    });
    throw httpError(502, 'Could not send the reset email. Please try again later.');
  }
}

async function resetPassword(input) {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!token) {
    throw httpError(400, 'Reset link is invalid or has expired.');
  }
  if (password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters long.');
  }

  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpires: { $gt: new Date() },
    status: 'active',
  });
  if (!user) {
    throw httpError(400, 'Reset link is invalid or has expired.');
  }

  user.password = password;
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

module.exports = {
  createToken,
  getJwtSecret,
  login,
  register,
  requestPasswordReset,
  resetPassword,
};