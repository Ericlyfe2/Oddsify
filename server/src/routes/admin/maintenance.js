/**
 * One-off data-repair tooling for admins.
 *   GET  /phantom-bets              list bets settled before their fixture's real kickoff
 *   POST /phantom-bets/:id/reopen   reopen one, clawing back any wrongly-paid credit
 *   POST /phantom-bets/reopen-all   reopen every currently-flagged bet
 *
 * See services/phantomBets.js for the detection + reversal logic and the
 * settlement.js commit that fixed the underlying kickoff-parsing bug.
 */
import { Router } from 'express';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { notFound, conflict } from '../../utils/httpError.js';
import { getUserById } from '../../db/users.js';
import { findPhantomSettledBets, reopenPhantomBet } from '../../services/phantomBets.js';

const router = Router();

router.get('/phantom-bets', requireAdmin, requireRole('finance_admin'), (_req, res) => {
  const rows = findPhantomSettledBets().map((r) => {
    const u = getUserById(r.userId);
    return { ...r, user: u ? { id: u.id, email: u.email, displayName: u.displayName } : null };
  });
  res.json({ total: rows.length, bets: rows });
});

router.post('/phantom-bets/:id/reopen', requireAdmin, requireRole('finance_admin'), (req, res, next) => {
  const result = reopenPhantomBet(req.params.id);
  if (!result.ok) {
    return next(result.error === 'Bet not found' ? notFound(result.error) : conflict(result.error));
  }
  audit(req, {
    action: 'bet.phantom_reversal',
    target: req.params.id,
    targetType: 'bet',
    severity: 'critical',
    meta: result,
  });
  res.json(result);
});

router.post('/phantom-bets/reopen-all', requireAdmin, requireRole('finance_admin'), (req, res) => {
  const flagged = findPhantomSettledBets();
  const results = flagged.map((r) => reopenPhantomBet(r.id));
  audit(req, {
    action: 'bet.phantom_reversal.bulk',
    targetType: 'bet',
    severity: 'critical',
    meta: { count: results.length, results },
  });
  res.json({ ok: true, count: results.length, results });
});

export default router;
