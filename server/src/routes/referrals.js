import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  referralSummary,
  recordClick,
  lookupCodeOwner,
  REFERRAL_CODE_RE,
} from '../services/referrals.js';
import { getUserById } from '../db/users.js';

const router = Router();

/** Refer & Earn dashboard payload (code is lazily minted here for legacy users). */
router.get('/me', requireAuth, (req, res) => {
  const origin = req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || 'https://oddsify.com';
  res.json(referralSummary(req.user.id, origin.replace(/\/$/, '')));
});

/** Public: count a landing-page click on a referral link. */
router.post(
  '/click',
  validate(z.object({ code: z.string().trim().max(20) })),
  asyncHandler(async (req, res) => {
    const ok = recordClick(req.body.code, { ip: req.ip, userAgent: req.get('user-agent') });
    res.json({ ok });
  }),
);

/** Public: validate a code before registration (shows "Invited by …"). */
router.get('/validate/:code', (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return res.json({ valid: false });
  const ownerId = lookupCodeOwner(code);
  if (!ownerId) return res.json({ valid: false });
  const owner = getUserById(ownerId);
  const name = owner?.displayName || 'an Oddsify member';
  res.json({ valid: true, referrerName: name.split(' ')[0] });
});

export default router;
