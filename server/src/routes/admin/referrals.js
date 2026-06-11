import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest } from '../../utils/httpError.js';
import { adminList, adminStats, adminApprove, adminReject, adminReverse } from '../../services/referrals.js';
import { getUserById } from '../../db/users.js';

const router = Router();

router.get('/', requireAdmin, (req, res) => {
  const { status, search } = req.query;
  const list = adminList({ status, search }).map((r) => ({
    ...r,
    referrer: (({ displayName, email } = {}) => ({ displayName, email }))(getUserById(r.referrerId) || {}),
  }));
  res.json({ referrals: list });
});

router.get('/stats', requireAdmin, (_req, res) => {
  res.json(adminStats());
});

const reasonSchema = z.object({ reason: z.string().max(500).optional() });

router.post(
  '/:referredId/approve',
  requireAdmin,
  requireRole('finance_admin'),
  asyncHandler(async (req, res) => {
    const result = adminApprove(req.params.referredId, req.admin?.email || req.admin?.id);
    if (result.error) throw badRequest(`Cannot approve: ${result.error}`);
    audit(req, { action: 'referral.approve', target: req.params.referredId, targetType: 'user', meta: result });
    res.json(result);
  }),
);

router.post(
  '/:referredId/reject',
  requireAdmin,
  requireRole('finance_admin'),
  validate(reasonSchema),
  asyncHandler(async (req, res) => {
    const result = adminReject(req.params.referredId, req.admin?.email || req.admin?.id, req.body?.reason);
    if (result.error) throw badRequest(`Cannot reject: ${result.error}`);
    audit(req, {
      action: 'referral.reject',
      target: req.params.referredId,
      targetType: 'user',
      severity: 'warning',
      meta: { reason: req.body?.reason },
    });
    res.json(result);
  }),
);

router.post(
  '/:referredId/reverse',
  requireAdmin,
  requireRole('finance_admin'),
  validate(reasonSchema),
  asyncHandler(async (req, res) => {
    const result = adminReverse(req.params.referredId, req.admin?.email || req.admin?.id, req.body?.reason);
    if (result.error) throw badRequest(`Cannot reverse: ${result.error}`);
    audit(req, {
      action: 'referral.reverse',
      target: req.params.referredId,
      targetType: 'user',
      severity: 'warning',
      meta: { reason: req.body?.reason },
    });
    res.json(result);
  }),
);

export default router;
