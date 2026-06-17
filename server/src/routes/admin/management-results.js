import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound, conflict, badRequest } from '../../utils/httpError.js';
import * as Matches from '../../db/matches.js';
import * as Results from '../../db/results.js';
import { bridgeResultEntered, bridgeResultConfirmed } from '../../services/catalogBridge.js';
import { settleNow } from '../../services/settlement.js';

const router = Router();

const resultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  htHomeScore: z.number().int().min(0).optional(),
  htAwayScore: z.number().int().min(0).optional(),
  reason: z.string().min(1),
  extra: z.record(z.any()).optional(),
});

router.get('/', requireAdmin, (req, res) => {
  const { status, matchId } = req.query;
  if (matchId) {
    const r = Results.getResult(matchId);
    return res.json({ result: r });
  }
  const results = Results.listResults({ status });
  res.json({ total: results.length, results });
});

router.get('/:matchId/history', requireAdmin, (req, res) => {
  const history = Results.getResultHistory(req.params.matchId);
  res.json({ history });
});

router.post('/:matchId/enter', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(resultSchema), (req, res) => {
  const match = Matches.getMatch(req.params.matchId);
  if (!match) throw notFound('Match not found');

  const result = Results.enterResult(req.params.matchId, req.body, req.admin.id);
  audit(req, { action: 'result.enter', target: req.params.matchId, targetType: 'result', meta: { status: result.status } });
  bridgeResultEntered(req.params.matchId, result);
  res.status(201).json({ result });
});

router.post('/:matchId/confirm', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(z.object({
  reason: z.string().min(1).optional(),
})), (req, res) => {
  const existing = Results.getResult(req.params.matchId);
  if (!existing) throw notFound('No result found for this match');
  if (existing.status === 'confirmed') throw conflict('Result is already confirmed');

  const result = Results.confirmResult(req.params.matchId, req.admin.id);
  audit(req, { action: 'result.confirm', target: req.params.matchId, targetType: 'result' });
  bridgeResultConfirmed(req.params.matchId, result);
  const settled = settleNow();
  res.json({ result, settlementTriggered: true, settled });
});

router.post('/:matchId/override', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(resultSchema), (req, res) => {
  const result = Results.overrideResult(req.params.matchId, req.body, req.admin.id);
  if (!result) throw notFound('Match not found');
  audit(req, { action: 'result.override', target: req.params.matchId, targetType: 'result' });
  bridgeResultEntered(req.params.matchId, result);
  res.json({ result });
});

export default router;
