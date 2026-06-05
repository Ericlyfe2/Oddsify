/**
 * Promotion CRUD for the admin panel.
 * Only super_admin (no allowed list) can mutate; everyone with admin can read.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound } from '../../utils/httpError.js';
import {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '../../db/promotions.js';

const router = Router();

const promoSchema = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().max(500).optional(),
  badge: z.string().trim().max(20).optional(),
  cta: z.string().trim().max(40).optional(),
  accent: z
    .string()
    .regex(/^#?[0-9a-f]{3,8}$/i)
    .optional(),
  image: z.string().max(400).optional(),
  eligibility: z.enum(['all', 'new', 'vip', 'mobile']).optional(),
  minDeposit: z.number().nonnegative().max(1_000_000).optional(),
  bonusRate: z.number().nonnegative().max(5).optional(),
  capPerUser: z.number().nonnegative().max(1_000_000).optional().nullable(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});

router.get('/', requireAdmin, (_req, res) => {
  res.json({ promotions: listPromotions() });
});

router.get('/:id', requireAdmin, (req, res, next) => {
  const p = getPromotion(req.params.id);
  if (!p) return next(notFound('Promotion not found'));
  res.json({ promotion: p });
});

router.post('/', requireAdmin, requireRole(), validate(promoSchema), (req, res) => {
  const p = createPromotion(req.body);
  audit(req, { action: 'promo.create', target: p.id, targetType: 'promotion', meta: { title: p.title } });
  res.status(201).json({ promotion: p });
});

router.patch('/:id', requireAdmin, requireRole(), validate(promoSchema.partial()), (req, res, next) => {
  const updated = updatePromotion(req.params.id, req.body);
  if (!updated) return next(notFound('Promotion not found'));
  audit(req, { action: 'promo.update', target: updated.id, targetType: 'promotion' });
  res.json({ promotion: updated });
});

router.delete('/:id', requireAdmin, requireRole(), (req, res, next) => {
  if (!deletePromotion(req.params.id)) return next(notFound('Promotion not found'));
  audit(req, { action: 'promo.delete', target: req.params.id, targetType: 'promotion', severity: 'warning' });
  res.json({ ok: true });
});

export default router;
