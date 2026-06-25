import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest } from '../utils/httpError.js';
import { parseIdentifier } from '../lib/phone.js';
import { findByEmail, findUserByPhone } from '../db/users.js';
import { issueOtp, checkOtp, consumeOtp, hasPending } from '../services/otp.js';
import { log } from '../utils/logger.js';

const router = Router();

const phoneSchema = z.object({
  phone: z.string().min(1, 'Phone number is required.'),
  country: z.string().optional(),
});

const verifySchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(4).max(8),
  purpose: z.enum(['register', 'reset', 'login']).optional().default('login'),
  country: z.string().optional(),
});

router.post(
  '/send',
  validate(phoneSchema),
  asyncHandler(async (req, res) => {
    const { phone: rawPhone, country: countryCode } = req.body;
    const parsed = parseIdentifier(rawPhone, countryCode);
    if (parsed.error) throw badRequest(parsed.error.message);
    const normalizedPhone = parsed.value;

    if (hasPending(normalizedPhone, 'login') || hasPending(normalizedPhone, 'register')) {
      const existing = await issueOtp(normalizedPhone, 'login').catch(() => null);
      if (existing) {
        res.json(existing);
        return;
      }
    }

    const result = await issueOtp(normalizedPhone, 'login');
    log.info(`OTP sent to ${normalizedPhone}`);
    res.json(result);
  }),
);

router.post(
  '/verify',
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const { phone: rawPhone, code, purpose, country: countryCode } = req.body;
    const parsed = parseIdentifier(rawPhone, countryCode);
    if (parsed.error) throw badRequest(parsed.error.message);
    const normalizedPhone = parsed.value;

    checkOtp(normalizedPhone, purpose, code);
    consumeOtp(normalizedPhone, purpose);
    log.info(`OTP verified for ${normalizedPhone} (${purpose})`);
    res.json({ ok: true, verified: true });
  }),
);

export default router;
