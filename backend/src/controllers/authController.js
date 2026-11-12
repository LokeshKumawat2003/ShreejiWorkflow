const { login, register, requestPasswordReset, resetPassword } = require('../services/authService');
const { clearAuthCookie, setAuthCookie } = require('../utils/authCookie');

async function signIn(req, res) {
  const { token, user, rememberMe } = await login(req.body || {});
  setAuthCookie(res, token, rememberMe);
  return res.json({ user, rememberMe });
}

async function signUp(req, res) {
  const { user } = await register(req.body || {});
  return res.status(201).json({ user });
}

function signOut(req, res) {
  clearAuthCookie(res);
  return res.json({ message: 'Signed out.' });
}

function currentUser(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.json({ user: req.user, rememberMe: req.rememberMe });
}

async function forgotPassword(req, res) {
  await requestPasswordReset(req.body || {});
  return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
}

async function resetPasswordWithToken(req, res) {
  await resetPassword(req.body || {});
  return res.json({ message: 'Your password has been reset. You can now sign in.' });
}

module.exports = { currentUser, forgotPassword, resetPasswordWithToken, signIn, signOut, signUp };
