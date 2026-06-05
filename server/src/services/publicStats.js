/**
 * Public stats payload for the homepage StatsStrip.
 *
 * - totalBets:        count of all bets in the store (all-time)
 * - totalPayoutsGhs:  floored sum of payouts on won + cashed_out bets
 *                     (reads bet.settledPayout, falls back to bet.potentialWin)
 * - activeUsers24h:   distinct user IDs with a bet or tx in last 24h
 * - liveMatches:      count of fixtures currently live in the aggregator
 *
 * 30s in-memory cache. Public, no auth.
 */
import { createStore } from '../db/store.js';
import { getLiveCount } from './oddsAggregator.js';

const betsStore = createStore('bets', {});
const txStore = createStore('transactions', {});

const CACHE_TTL_MS = 30_000;
const TWENTY_FOUR_HRS_MS = 24 * 60 * 60 * 1000;

let _cache = { value: null, expiresAt: 0 };

export function getPublicStats() {
  const now = Date.now();
  if (_cache.value && _cache.expiresAt > now) return _cache.value;

  const bets = Object.values(betsStore.all() || {});
  const txs = Object.values(txStore.all() || {});

  let totalPayoutsGhs = 0;
  const active = new Set();
  const cutoff = now - TWENTY_FOUR_HRS_MS;

  for (const bet of bets) {
    if (bet.status === 'won' || bet.status === 'cashed_out') {
      totalPayoutsGhs += Number(bet.settledPayout ?? bet.potentialWin) || 0;
    }
    const placedAt = bet.placedAt ? new Date(bet.placedAt).getTime() : 0;
    if (bet.userId && placedAt > cutoff) active.add(bet.userId);
  }
  for (const tx of txs) {
    const createdAt = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
    if (tx.userId && createdAt > cutoff) active.add(tx.userId);
  }

  const value = {
    totalBets: bets.length,
    totalPayoutsGhs: Math.floor(totalPayoutsGhs),
    activeUsers24h: active.size,
    liveMatches: getLiveCount(),
  };
  _cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Internal: clear cache so verification scripts are deterministic. */
export function _resetCacheForTests() {
  _cache = { value: null, expiresAt: 0 };
}
