/**
 * Recent-wins ticker feed.
 *
 * Returns up to 15 real wins (status='won', settled in last 24h) sorted
 * by amount desc. If no real wins exist yet, returns an empty list — the
 * client hides the ticker. No synthetic / "demo feel" backfill: the
 * marquee only shows traffic that actually happened.
 *
 * Phone numbers are masked client-safe (first 3 + last 3 digits, middle = •••).
 * Cached in-memory for 30s to absorb polling traffic.
 */
import { createStore } from '../db/store.js';

const betsStore = createStore('bets', {});
const usersStore = createStore('users', {});

const TARGET_COUNT = 15;
const CACHE_TTL_MS = 30_000;
const TWENTY_FOUR_HRS_MS = 24 * 60 * 60 * 1000;

let _cache = { value: null, expiresAt: 0 };

/** Mask a Ghana phone as "024•••671" (first 3 + last 3 digits). */
export function maskPhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length < 6) return '•••••••';
  return `${digits.slice(0, 3)}•••${digits.slice(-3)}`;
}

/** Up to 15 real wins from the last 24h, biggest amounts first. */
function getRealWins(now) {
  const cutoff = now - TWENTY_FOUR_HRS_MS;
  const users = usersStore.all() || {};
  const wins = [];

  for (const bet of Object.values(betsStore.all() || {})) {
    if (bet.status !== 'won') continue;
    const settledAt = bet.settledAt || bet.placedAt;
    if (!settledAt || new Date(settledAt).getTime() < cutoff) continue;
    const user = users[bet.userId] || {};
    wins.push({
      id: `wt-real-${bet.id}`,
      phoneMasked: maskPhone(user.phone),
      amountGhs: Math.floor(Number(bet.settledPayout ?? bet.potentialWin) || 0),
      betType: (bet.legs?.length || 1) > 1 ? 'multi' : 'single',
      legs: bet.legs?.length || 1,
      oddsTotal: Math.round((Number(bet.totalOdds) || 0) * 100) / 100,
      settledAt: new Date(settledAt).toISOString(),
      kind: 'real',
    });
  }
  return wins.sort((a, b) => b.amountGhs - a.amountGhs).slice(0, TARGET_COUNT);
}

/** Cached payload for GET /api/bet/recent-wins. */
export function getRecentWins() {
  const now = Date.now();
  if (_cache.value && _cache.expiresAt > now) return _cache.value;
  const value = { wins: getRealWins(now) };
  _cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Internal: clear cache so verification scripts are deterministic. */
export function _resetCacheForTests() {
  _cache = { value: null, expiresAt: 0 };
}
