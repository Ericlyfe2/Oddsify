/**
 * Recent-wins ticker feed.
 *
 * Returns up to 15 items per request:
 *   - real wins (status='won', settled in last 24h) first, sorted by amount desc
 *   - synthetic backfill for any remainder so the ticker always feels active
 *
 * Phone numbers are masked client-safe (first 3 + last 3 digits, middle = •••).
 * Cached in-memory for 30s to absorb polling traffic.
 */
import { createStore } from '../db/store.js';
import { FIRST, LAST } from '../db/seedDemo.js';

const betsStore  = createStore('bets', {});
const usersStore = createStore('users', {});

const GH_PREFIXES = ['024', '054', '055', '057', '027', '026', '020', '050'];
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

const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick    = (arr)    => arr[Math.floor(Math.random() * arr.length)];

/** Random Ghana-format phone (3-digit prefix + 7 random digits = 10 digits total). */
function fakeGhanaPhone() {
  let rest = '';
  for (let i = 0; i < 7; i++) rest += String(Math.floor(Math.random() * 10));
  return pick(GH_PREFIXES) + rest;
}

/** Weighted amount per spec: 70% under 5K, 25% 5K–50K, 5% 50K–250K. */
function weightedAmountGhs() {
  const r = Math.random();
  if (r < 0.70) return randInt(50, 5000);
  if (r < 0.95) return randInt(5000, 50000);
  return randInt(50000, 250000);
}

/** One synthetic item matching the API contract. Exported for unit checks. */
export function buildSyntheticWin(now = Date.now()) {
  const isMulti = Math.random() < 0.60;
  const legs    = isMulti ? randInt(2, 10) : 1;
  // Geometric: 1.5–2.1 per leg compounded, clipped to [3, 200].
  const odds = isMulti
    ? Math.max(3, Math.min(200, Math.pow(1.5 + Math.random() * 0.6, legs)))
    : 1.45 + Math.random() * 7.05;
  // Touch FIRST/LAST so future variations (e.g. display name) can extend.
  void FIRST; void LAST;
  return {
    id: `wt-synth-${Math.random().toString(36).slice(2, 10)}`,
    phoneMasked: maskPhone(fakeGhanaPhone()),
    amountGhs: weightedAmountGhs(),
    betType: isMulti ? 'multi' : 'single',
    legs,
    oddsTotal: Math.round(odds * 100) / 100,
    settledAt: new Date(now - randInt(0, 6 * 60 * 60 * 1000)).toISOString(),
    kind: 'synthetic',
  };
}

/** Up to 15 real wins from the last 24h, biggest amounts first. */
function getRealWins(now) {
  const cutoff = now - TWENTY_FOUR_HRS_MS;
  const users  = usersStore.all() || {};
  const wins   = [];

  for (const bet of Object.values(betsStore.all() || {})) {
    if (bet.status !== 'won') continue;
    const settledAt = bet.settledAt || bet.placedAt;
    if (!settledAt || new Date(settledAt).getTime() < cutoff) continue;
    const user = users[bet.userId] || {};
    wins.push({
      id: `wt-real-${bet.id}`,
      phoneMasked: maskPhone(user.phone),
      amountGhs: Math.floor(Number(bet.payout) || 0),
      betType: (bet.picks?.length || 1) > 1 ? 'multi' : 'single',
      legs: bet.picks?.length || 1,
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

  const real = getRealWins(now);
  const backfill = TARGET_COUNT - real.length;
  const synthetic = [];
  for (let i = 0; i < backfill; i++) synthetic.push(buildSyntheticWin(now));

  const value = { wins: [...real, ...synthetic] };
  _cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Internal: clear cache so verification scripts are deterministic. */
export function _resetCacheForTests() { _cache = { value: null, expiresAt: 0 }; }
