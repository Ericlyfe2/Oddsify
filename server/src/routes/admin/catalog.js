import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, conflict } from '../../utils/httpError.js';
import * as T from '../../db/marketTemplates.js';

const router = Router();

router.get('/', requireAdmin, (req, res) => {
  const { sportId } = req.query;
  const templates = T.listTemplates({ sportId });
  res.json({ total: templates.length, templates });
});

router.get('/:id', requireAdmin, (req, res) => {
  const t = T.getTemplate(req.params.id);
  if (!t) throw notFound('Template not found');
  res.json({ template: t });
});

const upsertSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  sportId: z.array(z.string()).min(1),
  autoAttach: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  defaultEnabled: z.boolean().optional(),
  selectionSpec: z.object({
    type: z.enum(['fixed', 'correct_score_grid', 'combo']),
    outcomes: z.array(z.object({
      key: z.string(),
      label: z.string(),
    })).optional(),
    maxHome: z.number().int().optional(),
    maxAway: z.number().int().optional(),
    includeOther: z.boolean().optional(),
    baseMarkets: z.array(z.string()).optional(),
  }),
});

router.post('/', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(upsertSchema), (req, res) => {
  const existing = T.getTemplateByKey(req.body.key);
  if (existing) throw conflict('Template with that key already exists');
  const t = T.createTemplate(req.body);
  audit(req, { action: 'template.create', target: t.id, targetType: 'market_template' });
  res.status(201).json({ template: t });
});

router.patch('/:id', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(upsertSchema.partial()), (req, res) => {
  const t = T.updateTemplate(req.params.id, req.body);
  if (!t) throw notFound('Template not found');
  audit(req, { action: 'template.update', target: req.params.id, targetType: 'market_template' });
  res.json({ template: t });
});

router.delete('/:id', requireAdmin, requireRole('super_admin'), (req, res) => {
  const ok = T.deleteTemplate(req.params.id);
  if (!ok) throw notFound('Template not found');
  audit(req, { action: 'template.delete', target: req.params.id, targetType: 'market_template' });
  res.json({ ok: true });
});

export default router;
