import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound, conflict } from '../../utils/httpError.js';
import * as Sports from '../../db/sports.js';

const router = Router();

const sportSchema = z.object({
  name: z.string().min(1).max(60),
  key: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

router.get('/', requireAdmin, (req, res) => {
  const sports = Sports.listSports();
  res.json({ total: sports.length, sports });
});

router.get('/:id', requireAdmin, (req, res) => {
  const s = Sports.getSport(req.params.id);
  if (!s) throw notFound('Sport not found');
  res.json({ sport: s });
});

router.post('/', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(sportSchema), (req, res) => {
  const existing = Sports.findSportByKey(req.body.key || req.body.name);
  if (existing) throw conflict('Sport with that key already exists');
  const s = Sports.createSport(req.body);
  audit(req, { action: 'sport.create', target: s.id, targetType: 'sport' });
  res.status(201).json({ sport: s });
});

router.patch('/:id', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(sportSchema.partial()), (req, res) => {
  const s = Sports.updateSport(req.params.id, req.body);
  if (!s) throw notFound('Sport not found');
  audit(req, { action: 'sport.update', target: req.params.id, targetType: 'sport' });
  res.json({ sport: s });
});

router.post('/:id/archive', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const s = Sports.archiveSport(req.params.id);
  if (!s) throw notFound('Sport not found');
  audit(req, { action: 'sport.archive', target: req.params.id, targetType: 'sport' });
  res.json({ sport: s });
});

router.post('/:id/restore', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const s = Sports.restoreSport(req.params.id);
  if (!s) throw notFound('Sport not found');
  audit(req, { action: 'sport.restore', target: req.params.id, targetType: 'sport' });
  res.json({ sport: s });
});

export default router;
