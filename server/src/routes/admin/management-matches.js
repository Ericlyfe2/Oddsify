import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound, conflict, badRequest } from '../../utils/httpError.js';
import * as Matches from '../../db/matches.js';
import * as Leagues from '../../db/leagues.js';
import * as Sports from '../../db/sports.js';
import { getAutoAttachTemplates } from '../../db/marketTemplates.js';
import { autoAttachMarkets } from '../../db/markets.js';
import { bridgeMatchCreated, bridgeMatchUpdated, bridgeMatchStatusChanged } from '../../services/catalogBridge.js';

const router = Router();

const matchSchema = z.object({
  leagueId: z.string().min(1),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  startTime: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  sportId: z.string().min(1).optional(),
  status: z.enum(['scheduled', 'draft']).optional(),
  round: z.string().optional(),
  venue: z.string().optional(),
  externalRef: z.string().optional(),
});

router.get('/', requireAdmin, (req, res) => {
  const { leagueId, sportId, status, dateFrom, dateTo } = req.query;
  const matches = Matches.listMatches({ leagueId, sportId, status, dateFrom, dateTo });
  res.json({ total: matches.length, matches });
});

router.get('/:id', requireAdmin, (req, res) => {
  const m = Matches.getMatch(req.params.id);
  if (!m) throw notFound('Match not found');
  res.json({ match: m });
});

router.post('/', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(matchSchema), (req, res) => {
  const { startTime, ...rest } = req.body;
  const input = { ...rest, startsAt: startTime };

  const dup = Matches.findDuplicate(input.leagueId, input.homeTeamId, input.awayTeamId, input.startsAt);
  if (dup) throw conflict(dup.message);

  const m = Matches.createMatch(input);

  const league = Leagues.getLeague(req.body.leagueId);
  const sportId = req.body.sportId || league?.sportId || '';
  const sport = Sports.getSport(sportId);
  const sportKey = sport?.key || sportId;
  const templates = getAutoAttachTemplates(sportKey);
  const { markets, selections } = autoAttachMarkets(m.id, sportId, templates);

  audit(req, { action: 'match.create', target: m.id, targetType: 'match', meta: { sportId, marketsCreated: markets.length } });
  bridgeMatchCreated(m);
  res.status(201).json({ match: m, markets: { count: markets.length, selections: selections.length } });
});

router.patch('/:id', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(matchSchema.partial()), (req, res) => {
  const m = Matches.updateMatch(req.params.id, req.body);
  if (!m) throw notFound('Match not found');
  audit(req, { action: 'match.update', target: req.params.id, targetType: 'match' });
  bridgeMatchUpdated(m);
  res.json({ match: m });
});

const STATUS_TRANSITIONS = {
  draft: ['scheduled'],
  scheduled: ['live', 'cancelled'],
  live: ['suspended', 'settled'],
  suspended: ['live', 'cancelled', 'settled'],
  cancelled: ['archived'],
  settled: ['archived'],
};

router.post('/:id/status', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(z.object({
  status: z.string().min(1),
  reason: z.string().optional(),
})), (req, res) => {
  const m = Matches.getMatch(req.params.id);
  if (!m) throw notFound('Match not found');

  const allowed = STATUS_TRANSITIONS[m.status];
  if (!allowed || !allowed.includes(req.body.status)) {
    throw badRequest(`Cannot transition from ${m.status} to ${req.body.status}. Allowed: ${(allowed || ['none']).join(', ')}`);
  }

  const updated = Matches.updateMatch(req.params.id, { status: req.body.status });
  audit(req, { action: `match.status.${req.body.status}`, target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(updated);
  res.json({ match: updated });
});

router.post('/:id/cancel', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(z.object({
  reason: z.string().min(1),
})), (req, res) => {
  const m = Matches.cancelMatch(req.params.id, req.body.reason);
  if (!m) throw notFound('Match not found');
  audit(req, { action: 'match.cancel', target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(m);
  res.json({ match: m });
});

router.post('/:id/archive', requireAdmin, requireRole('odds_manager', 'super_admin'), (req, res) => {
  const m = Matches.archiveMatch(req.params.id);
  if (!m) throw notFound('Match not found');
  audit(req, { action: 'match.archive', target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(m);
  res.json({ match: m });
});

export default router;
