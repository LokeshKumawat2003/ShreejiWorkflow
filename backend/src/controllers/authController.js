const { login } = require('../services/authService');

async function signIn(req, res) {
  const result = await login(req.body || {});
  return res.json(result);
}

function currentUser(req, res) {
  return res.json({ user: req.user });
}

module.exports = { currentUser, signIn };