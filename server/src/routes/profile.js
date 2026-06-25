import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUser, publicUser, logActivity } from '../db/users.js';
import { normalizePhone } from '../lib/phone.js';
import { log } from '../utils/logger.js';

const router = Router();

const phoneSchema = z.string().transform((raw, ctx) => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const normalized = normalizePhone(trimmed);
  if (!normalized) {
    log.warn(`phone normalization failure (profile update): input masked`);
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number.' });
    return z.NEVER;
  }
  return normalized;
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
