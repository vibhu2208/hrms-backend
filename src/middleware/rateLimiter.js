const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Rate limiter for forgot password endpoint
const forgotPasswordLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 3, // 3 requests per window
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Rate limit by email address to prevent email flooding
    return req.body.email || ipKeyGenerator(req);
  },
  skip: (req) => {
    // Skip rate limiting for successful requests (allow multiple attempts with different emails)
    return false;
  }
});

// Rate limiter for login endpoint (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP and email combination
    const email = req.body.email || '';
    return `${ipKeyGenerator(req)}:${email}`;
  }
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  forgotPasswordLimiter,
  loginLimiter,
  generalLimiter
};
