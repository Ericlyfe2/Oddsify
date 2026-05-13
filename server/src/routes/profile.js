import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateUser, publicUser, logActivity } from '../db/users.js';

const router = Router();

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  favouriteSports: z.array(z.string()).max(10).optional(),
  favouriteLeagues: z.array(z.string()).max(20).optional(),
  responsibleGaming: z.object({
    dailyDepositLimit:   z.number().nonnegative().optional(),
    weeklyDepositLimit:  z.number().nonnegative().optional(),
    monthlyDepositLimit: z.number().nonnegative().optional(),
    selfExcludedUntil:   z.string().nullable().optional(),
  }).optional(),
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
