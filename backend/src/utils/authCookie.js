const jwt = require('jsonwebtoken');

const AUTH_COOKIE_NAME = 'accessToken';

function baseCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')).toLowerCase();
  return {
    httpOnly: true,
    // Browsers reject SameSite=None cookies that are not Secure.
    secure: isProduction || sameSite === 'none' || process.env.COOKIE_SECURE === 'true',
    sameSite,
    path: '/api',
  };
}

function setAuthCookie(res, token, rememberMe = true) {
  const options = baseCookieOptions();
  if (rememberMe) {
    const { exp } = jwt.decode(token) || {};
    if (typeof exp === 'number') {
      options.maxAge = Math.max(exp * 1000 - Date.now(), 0);
    }
  }
  res.cookie(AUTH_COOKIE_NAME, token, options);
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
}

function readAuthCookie(req) {
  const header = req.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === AUTH_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

module.exports = { AUTH_COOKIE_NAME, clearAuthCookie, readAuthCookie, setAuthCookie };
