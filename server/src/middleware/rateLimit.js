import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/env.js';

const standardOpts = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again shortly.' },
};

const emailKey = (req) => `${ipKeyGenerator(req.ip)}|${(req.body?.email || '').toLowerCase()}`;

// Global rate limiter applied to all /api routes.
// 100 req/min per IP keeps abuse in check without breaking UX.
// Login is separately rate-limited below with a tighter window.
export const apiLimiter = rateLimit({
  ...standardOpts,
  windowMs: 60 * 1000,
  limit: RATE_LIMITS.globalMax,
  message: { error: 'Too many requests. Slow down.' },
  skip: (req) => req.path === '/api/health',
});

// Login is rate-limited with per-email keying so a single account/IP
// can't brute-force the password.
// Used for both user and admin login.
export const loginLimiter = rateLimit({
  ...standardOpts,
  windowMs: 15 * 60 * 1000,
  limit: RATE_LIMITS.loginMax,
  keyGenerator: emailKey,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
