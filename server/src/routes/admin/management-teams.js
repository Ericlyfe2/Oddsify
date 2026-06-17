import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound, conflict } from '../../utils/httpError.js';
import * as Teams from '../../db/teams.js';

const router = Router();

const teamSchema = z.object({
  name: z.string().min(1).max(100),
  shortName: z.string().max(10).optional(),
  logo: z.string().optional(),
  country: z.string().optional(),
  sportId: z.string().min(1),
  active: z.boolean().optional(),
});

router.get('/', requireAdmin, (req, res) => {
  const { sportId, search, active } = req.query;
  const teams = Teams.listTeams({ sportId, search, active: active !== undefined ? active === 'true' : undefined });
  res.json({ total: teams.length, teams });
});

router.get('/:id', requireAdmin, (req, res) => {
  const t = Teams.getTeam(req.params.id);
  if (!t) throw notFound('Team not found');
  res.json({ team: t });
});

router.post('/', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(teamSchema), (req, res) => {
  const existing = Teams.findTeamByName(req.body.name, req.body.sportId);
  if (existing) throw conflict('Team already exists in this sport');
  const t = Teams.createTeam(req.body);
  audit(req, { action: 'team.create', target: t.id, targetType: 'team' });
  res.status(201).json({ team: t });
});

router.patch('/:id', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(teamSchema.partial()), (req, res) => {
  const t = Teams.updateTeam(req.params.id, req.body);
  if (!t) throw notFound('Team not found');
  audit(req, { action: 'team.update', target: req.params.id, targetType: 'team' });
  res.json({ team: t });
});

router.post('/:id/archive', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const t = Teams.archiveTeam(req.params.id);
  if (!t) throw notFound('Team not found');
  audit(req, { action: 'team.archive', target: req.params.id, targetType: 'team' });
  res.json({ team: t });
});

export default router;
