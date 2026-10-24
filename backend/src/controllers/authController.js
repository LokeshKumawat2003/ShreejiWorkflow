const { login, register } = require('../services/authService');

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

module.exports = { currentUser, signIn, signUp };
