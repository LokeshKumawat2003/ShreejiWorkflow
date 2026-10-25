const { httpError } = require('../utils/httpError');

const CLEANUP_INTERVAL_MS = 60 * 1000;

function createRateLimiter({ windowMs, max, key, message, skipSuccessfulRequests = false }) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [bucket, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(bucket);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanup.unref();

  function limiter(req, res, next) {
    const bucket = key(req);
    if (!bucket) return next();

    const now = Date.now();
    let entry = hits.get(bucket);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(bucket, entry);
    }

    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(httpError(429, message));
    }

    entry.count += 1;
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400 && hits.get(bucket) === entry && entry.count > 0) {
          entry.count -= 1;
        }
      });
    }
    return next();
  }

  limiter.reset = () => hits.clear();
  return limiter;
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function bodyEmail(req) {
  const email = req.body?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : '';
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const LOGIN_MESSAGE = 'Too many sign-in attempts. Please try again later.';
const RESET_MESSAGE = 'Too many password reset requests. Please try again later.';

const loginLimiters = [
  createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    max: 30,
    key: (req) => `ip:${clientIp(req)}`,
    message: LOGIN_MESSAGE,
  }),
  createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    max: 5,
    key: (req) => {
      const email = bodyEmail(req);
      return email && `email:${email}`;
    },
    message: LOGIN_MESSAGE,
    skipSuccessfulRequests: true,
  }),
];

const forgotPasswordLimiters = [
  createRateLimiter({
    windowMs: ONE_HOUR,
    max: 10,
    key: (req) => `ip:${clientIp(req)}`,
    message: RESET_MESSAGE,
  }),
  createRateLimiter({
    windowMs: ONE_HOUR,
    max: 3,
    key: (req) => {
      const email = bodyEmail(req);
      return email && `email:${email}`;
    },
    message: RESET_MESSAGE,
  }),
];

const resetPasswordLimiters = [
  createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    max: 10,
    key: (req) => `ip:${clientIp(req)}`,
    message: RESET_MESSAGE,
  }),
];

function resetAuthRateLimits() {
  [...loginLimiters, ...forgotPasswordLimiters, ...resetPasswordLimiters].forEach((limiter) => limiter.reset());
}

module.exports = {
  createRateLimiter,
  forgotPasswordLimiters,
  loginLimiters,
  resetAuthRateLimits,
  resetPasswordLimiters,
};
