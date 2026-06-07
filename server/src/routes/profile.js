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
  // Notification routing toggles surfaced on the Account screen.
  // All three default to true on the server when the user record
  // hasn't been touched; explicit boolean here lets the player opt
  // any channel off.
  commsPrefs: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
});

router.get('/', requireAuth, (req, res) => {
  res.json({ account: publicUser(req.user) });
});

router.patch('/', requireAuth, validate(profileSchema), (req, res) => {
  // Shallow merge isn't enough for the nested settings groups — sending
  // { responsibleGaming: { dailyDepositLimit: 100 } } would otherwise
  // wipe out the weekly/monthly entries. Merge nested groups against the
  // existing user record before persisting.
  const patch = { ...req.body };
  if (patch.responsibleGaming) {
    patch.responsibleGaming = {
      ...(req.user.responsibleGaming || {}),
      ...patch.responsibleGaming,
    };
  }
  if (patch.commsPrefs) {
    patch.commsPrefs = {
      ...(req.user.commsPrefs || {}),
      ...patch.commsPrefs,
    };
  }
  const updated = updateUser(req.user.id, patch);
  logActivity(req.user.id, { kind: 'profile_update' });
  res.json({ account: publicUser(updated) });
});

export default router;
