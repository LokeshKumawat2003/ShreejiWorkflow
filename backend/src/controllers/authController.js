const { login, register, requestPasswordReset, resetPassword } = require('../services/authService');

async function signIn(req, res) {
  const result = await login(req.body || {});
  return res.json(result);
}

async function signUp(req, res) {
  const result = await register(req.body || {});
  return res.status(201).json(result);
}

function currentUser(req, res) {
  return res.json({ user: req.user });
}

async function forgotPassword(req, res) {
  await requestPasswordReset(req.body || {});
  return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
}

async function resetPasswordWithToken(req, res) {
  await resetPassword(req.body || {});
  return res.json({ message: 'Your password has been reset. You can now sign in.' });
}

module.exports = { currentUser, forgotPassword, resetPasswordWithToken, signIn, signUp };
