import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound, conflict } from '../../utils/httpError.js';
import * as Leagues from '../../db/leagues.js';

const router = Router();

const leagueSchema = z.object({
  name: z.string().min(1).max(100),
  sportId: z.string().min(1),
  country: z.string().optional(),
  logo: z.string().optional(),
});

router.get('/', requireAdmin, (req, res) => {
  const { sportId, status, search } = req.query;
  const leagues = Leagues.listLeagues({ sportId, status, search });
  res.json({ total: leagues.length, leagues });
});

router.get('/:id', requireAdmin, (req, res) => {
  const l = Leagues.getLeague(req.params.id);
  if (!l) throw notFound('League not found');
  res.json({ league: l });
});

router.post('/', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(leagueSchema), (req, res) => {
  const dup = Leagues.checkDuplicate(req.body.name, req.body.sportId, req.body.country);
  if (dup) throw conflict(dup.message);
  const l = Leagues.createLeague(req.body);
  audit(req, { action: 'league.create', target: l.id, targetType: 'league' });
  res.status(201).json({ league: l });
});

router.patch('/:id', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(leagueSchema.partial()), (req, res) => {
  const l = Leagues.updateLeague(req.params.id, req.body);
  if (!l) throw notFound('League not found');
  audit(req, { action: 'league.update', target: req.params.id, targetType: 'league' });
  res.json({ league: l });
});

router.post('/:id/archive', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const l = Leagues.archiveLeague(req.params.id);
  if (!l) throw notFound('League not found');
  audit(req, { action: 'league.archive', target: req.params.id, targetType: 'league' });
  res.json({ league: l });
});

router.post('/:id/restore', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const l = Leagues.restoreLeague(req.params.id);
  if (!l) throw notFound('League not found');
  audit(req, { action: 'league.restore', target: req.params.id, targetType: 'league' });
  res.json({ league: l });
});

export default router;
