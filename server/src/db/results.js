/**
 * Results & Settlement stores.
 *
 * `Result` is the single source of truth for grading bets. Every result write
 * is immutable and audited — store previous result, new result, admin ID,
 * timestamp, and a mandatory reason.
 *
 * Lifecycle: provisional → confirmed → (corrected → re-confirmed)
 * A confirmed result triggers the settlement engine.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const resultStore = createStore('results_data', {});
const settlementStore = createStore('settlements_data', {});
const resultHistoryStore = createStore('result_history', { entries: [] });

/* ── Results ─────────────────────────────────────────────── */

export function getResult(matchId) {
  return resultStore.get(matchId) || null;
}

export function listResults(opts = {}) {
  let all = Object.values(resultStore.all() || {});
  if (opts.status) all = all.filter((r) => r.status === opts.status);
  return all.sort((a, b) => new Date(b.enteredAt || 0) - new Date(a.enteredAt || 0));
}

/**
 * Enter a result (provisional). If a result already exists, the old value
 * is recorded in the history before overwriting.
 */
export function enterResult(matchId, input, adminId) {
  const existing = resultStore.get(matchId);

  const id = existing?.id || `res-${crypto.randomBytes(4).toString('hex')}`;
  const rec = {
    id,
    matchId,
    homeScore: Number(input.homeScore),
    awayScore: Number(input.awayScore),
    htHomeScore: input.htHomeScore != null ? Number(input.htHomeScore) : null,
    htAwayScore: input.htAwayScore != null ? Number(input.htAwayScore) : null,
    extra: input.extra || {},
    source: input.source || 'manual',
    status: 'provisional',
    enteredBy: adminId,
    confirmedBy: null,
    confirmedAt: null,
    reason: input.reason || '',
    enteredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Record the change in immutable history if there's a previous result
  if (existing) {
    const history = resultHistoryStore.get('entries') || [];
    resultHistoryStore.set('entries', [
      {
        id: `rh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        matchId,
        previousResult: { ...existing },
        newResult: { ...rec },
        changedBy: adminId,
        reason: input.reason || 'result correction',
        changedAt: new Date().toISOString(),
      },
      ...history,
    ].slice(0, 10000));
  }

  resultStore.set(matchId, rec);
  return rec;
}

/**
 * Confirm a provisional result — this triggers settlement.
 */
export function confirmResult(matchId, adminId) {
  const cur = resultStore.get(matchId);
  if (!cur) return null;
  if (cur.status === 'confirmed') return cur;

  const next = {
    ...cur,
    status: 'confirmed',
    confirmedBy: adminId,
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  resultStore.set(matchId, next);
  return next;
}

/**
 * Override a confirmed result (requires reason). Records the change in
 * immutable history, resets to provisional, and returns the new record.
 */
export function overrideResult(matchId, input, adminId) {
  const existing = resultStore.get(matchId);
  if (!existing) return enterResult(matchId, input, adminId);

  historyStoreChange(matchId, existing);
  const next = {
    ...existing,
    homeScore: Number(input.homeScore),
    awayScore: Number(input.awayScore),
    htHomeScore: input.htHomeScore != null ? Number(input.htHomeScore) : existing.htHomeScore,
    htAwayScore: input.htAwayScore != null ? Number(input.htAwayScore) : existing.htAwayScore,
    extra: input.extra || existing.extra,
    status: 'provisional',
    confirmedBy: null,
    confirmedAt: null,
    reason: input.reason || 'result override',
    enteredBy: adminId,
    updatedAt: new Date().toISOString(),
  };
  resultStore.set(matchId, next);
  return next;
}

/* ── Settlement Records ──────────────────────────────────── */

export function recordSettlement(entry) {
  const id = `stl-${crypto.randomBytes(4).toString('hex')}`;
  const rec = {
    id,
    betId: entry.betId,
    matchId: entry.matchId,
    selectionId: entry.selectionId || null,
    outcome: entry.outcome,
    payout: Number(entry.payout || 0),
    settledBy: entry.settledBy || 'system',
    settledAt: new Date().toISOString(),
    reversedBy: null,
    reversedAt: null,
    createdAt: new Date().toISOString(),
  };
  settlementStore.set(id, rec);
  return rec;
}

export function listSettlements(betId) {
  return Object.values(settlementStore.all() || {}).filter((s) => s.betId === betId);
}

export function listMatchSettlements(matchId) {
  return Object.values(settlementStore.all() || {}).filter((s) => s.matchId === matchId);
}

export function reverseSettlement(id, adminId, reason) {
  const cur = settlementStore.get(id);
  if (!cur) return null;
  const next = {
    ...cur,
    reversedBy: adminId,
    reversedAt: new Date().toISOString(),
    reversalReason: reason,
  };
  settlementStore.set(id, next);
  return next;
}

/* ── Helpers ─────────────────────────────────────────────── */

function historyStoreChange(matchId, previousResult) {
  const history = resultHistoryStore.get('entries') || [];
  resultHistoryStore.set('entries', [
    {
      id: `rh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      matchId,
      previousResult: { ...previousResult },
      changedAt: new Date().toISOString(),
    },
    ...history,
  ].slice(0, 10000));
}

export function getResultHistory(matchId) {
  return (resultHistoryStore.get('entries') || []).filter((h) => h.matchId === matchId);
}
