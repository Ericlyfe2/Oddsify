import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/env.js';

const standardOpts = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again shortly.' },
};

const emailKey = (req) =>
  `${ipKeyGenerator(req.ip)}|${(req.body?.email || '').toLowerCase()}`;

// Login is the only rate-limited endpoint (user + admin login share it).
// Keyed by IP + submitted email so a single account/IP can't brute-force.
export const loginLimiter = rateLimit({
  ...standardOpts,
  windowMs: 15 * 60 * 1000,
  limit: RATE_LIMITS.loginMax,
  keyGenerator: emailKey,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
