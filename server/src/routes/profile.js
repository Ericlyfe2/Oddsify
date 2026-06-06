import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUser, publicUser, logActivity } from '../db/users.js';
import { validatePhone, sanitizePhone } from '../lib/phone.js';
import { log } from '../utils/logger.js';

const router = Router();

// Strict E.164 only — same rules as the auth identifier. Empty string is
// allowed so the user can clear their stored number; anything else must
// match the spec or it's rejected with the user-facing error message.
const phoneSchema = z.string().transform((raw, ctx) => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const err = validatePhone(trimmed);
  if (err) {
    log.warn(`phone validation failure (profile update): ${err.code} — input "${trimmed}"`);
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
    return z.NEVER;
  }
  return sanitizePhone(trimmed);
});

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  phone: phoneSchema.optional(),
  favouriteSports: z.array(z.string()).max(10).optional(),
  favouriteLeagues: z.array(z.string()).max(20).optional(),
  responsibleGaming: z
    .object({
      dailyDepositLimit: z.number().nonnegative().optional(),
      weeklyDepositLimit: z.number().nonnegative().optional(),
      monthlyDepositLimit: z.number().nonnegative().optional(),
      selfExcludedUntil: z.string().nullable().optional(),
    })
    .optional(),
});

router.get('/', requireAuth, (req, res) => {
  res.json({ account: publicUser(req.user) });
});

router.patch('/', requireAuth, validate(profileSchema), (req, res) => {
  const updated = updateUser(req.user.id, req.body);
  logActivity(req.user.id, { kind: 'profile_update' });
  res.json({ account: publicUser(updated) });
});

export default router;
