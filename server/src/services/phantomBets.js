/**
 * Detects and reverses bets that were auto-settled against a "phantom"
 * simulated score — one generated before the fixture's real scheduled
 * kickoff (settlement.js historically mis-parsed day labels like "Tue 21
 * Jul" as "today"). A bet settled before its own match could have kicked
 * off is provably invalid, independent of whether the fixture itself has
 * since been repaired by the settlement engine's self-heal sweep.
 */
import { createStore } from '../db/store.js';
import { adminLookupFixture } from '../db/sportsAdmin.js';
import { scheduledKickoffTs } from './settlement.js';
import { getUserById, updateUser, logActivity } from '../db/users.js';
import { emitToUser } from './realtime.js';

const betsStore = createStore('bets', {});
const txStore = createStore('transactions', {});

function pushTx(userId, tx) {
  const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry = { id, userId, at: new Date().toISOString(), ...tx };
  const list = txStore.get(userId) || [];
  txStore.set(userId, [entry, ...list].slice(0, 500));
  return entry;
}

/** Returns fixture details if `bet` was settled before any of its legs'
 *  fixtures could genuinely have kicked off; otherwise null. */
function phantomReason(bet) {
  if (!['won', 'lost', 'void'].includes(bet.status)) return null;
  if (bet.settledBy !== 'auto') return null;
  if (!bet.settledAt) return null;
  const settledAtMs = new Date(bet.settledAt).getTime();
  if (!Number.isFinite(settledAtMs)) return null;

  for (const leg of bet.legsResolved || bet.legs || []) {
    const view = adminLookupFixture(leg.matchId);
    const fx = view?.match || view;
    if (!fx) continue; // fixture gone — can't verify, don't flag
    const ko = scheduledKickoffTs(fx);
    if (!ko) continue; // unknown kickoff — can't verify, don't flag
    if (settledAtMs < ko) {
      return { matchId: leg.matchId, home: fx.home, away: fx.away, scheduledKickoff: new Date(ko).toISOString() };
    }
  }
  return null;
}

/** List every currently phantom-settled bet, most recent first. */
export function findPhantomSettledBets() {
  const all = Object.values(betsStore.all() || {});
  const flagged = [];
  for (const bet of all) {
    const reason = phantomReason(bet);
    if (!reason) continue;
    flagged.push({
      id: bet.id,
      userId: bet.userId,
      status: bet.status,
      stake: bet.stake,
      creditPaid: Number(bet.settledReturn ?? bet.settledPayout ?? 0) || 0,
      settledAt: bet.settledAt,
      placedAt: bet.placedAt,
      fixture: reason,
    });
  }
  return flagged.sort((a, b) => (a.settledAt < b.settledAt ? 1 : -1));
}

/**
 * Reopen one phantom-settled bet: restore it to 'open' exactly as if the
 * fake result never happened, and claw back any credit that was wrongly
 * paid out (won/void). The clawback is floored at the user's current
 * balance so it never goes negative — any shortfall (money already spent
 * or withdrawn) is reported back for manual follow-up rather than forcing
 * a negative balance. Bets settled 'lost' moved no money, so nothing to
 * claw back there.
 */
export function reopenPhantomBet(betId) {
  const bet = betsStore.get(betId);
  if (!bet) return { betId, ok: false, error: 'Bet not found' };
  const reason = phantomReason(bet);
  if (!reason) return { betId, ok: false, error: 'Bet is not currently phantom-settled' };

  const user = getUserById(bet.userId);
  const creditPaid = Number(bet.settledReturn ?? bet.settledPayout ?? 0) || 0;
  let clawback = 0;
  let shortfall = 0;
  let balanceAfter = user?.balance ?? null;

  if (user && creditPaid > 0) {
    clawback = Number(Math.min(creditPaid, user.balance).toFixed(2));
    shortfall = Number((creditPaid - clawback).toFixed(2));
    if (clawback > 0) {
      const updated = updateUser(user.id, { balance: Number((user.balance - clawback).toFixed(2)) });
      balanceAfter = updated.balance;
      pushTx(user.id, {
        kind: 'phantom_bet_reversal',
        amount: -clawback,
        status: 'completed',
        balanceAfter,
        ref: bet.id,
        reason: `Reversing phantom settlement — fixture actually kicks off ${reason.scheduledKickoff}, bet was settled at ${bet.settledAt}`,
      });
      emitToUser(user.id, 'wallet:update', {
        balance: balanceAfter,
        delta: -clawback,
        reason: 'bet:phantom_reversal',
        ref: bet.id,
      });
    }
  }

  const {
    status: _status,
    settledAt: _settledAt,
    settledBy: _settledBy,
    settleReason: _settleReason,
    settledPayout: _settledPayout,
    settledReturn: _settledReturn,
    settledProfit: _settledProfit,
    legsResolved: _legsResolved,
    wonNotAcknowledged: _wonNotAcknowledged,
    ...rest
  } = bet;
  const reopened = { ...rest, status: 'open' };
  betsStore.set(bet.id, reopened);

  if (user) {
    logActivity(user.id, { kind: 'bet_phantom_reopened', betId: bet.id, clawback, shortfall });
  }
  emitToUser(bet.userId, 'bet:reopened', { betId: bet.id });

  return {
    betId,
    ok: true,
    userId: bet.userId,
    previousStatus: bet.status,
    creditPaid,
    clawback,
    shortfall,
    balanceAfter,
    fixture: reason,
  };
}
