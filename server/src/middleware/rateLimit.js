import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/env.js';

const standardOpts = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again shortly.' },
};

const emailKey = (req) => `${ipKeyGenerator(req.ip)}|${(req.body?.email || '').toLowerCase()}`;

// Global rate limiter applied to all /api routes.
// 500 req/min per IP — generous enough to handle concurrent SPA calls
// (fetchMe, matches, sports, recent-wins, public-stats, etc.) from multiple
// users sharing a Render proxy IP, without breaking UX.
// Login is separately rate-limited below with a tighter window.
export const apiLimiter = rateLimit({
  ...standardOpts,
  windowMs: 60 * 1000,
  limit: RATE_LIMITS.globalMax,
  message: { error: 'Too many requests. Slow down.' },
  skip: (req) => {
    const pub = ['/api/health', '/api/auth/config', '/api/settings/public'];
    return pub.includes(req.path);
  },
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

// Booking-code lookups: the format alphabet only has 25^2 * 9^5 ≈
// 14.7M combinations, and the global apiLimiter (100 req/min per IP)
// leaves enough headroom for casual enumeration. This tighter cap
// (30 req/min per IP) makes brute-forcing impractical without hurting
// real users who type a couple of codes by hand.
export const bookingLookupLimiter = rateLimit({
  ...standardOpts,
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: 'Too many booking-code lookups. Try again shortly.' },
});
