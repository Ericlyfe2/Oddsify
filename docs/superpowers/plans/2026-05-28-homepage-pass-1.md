# Homepage Pass 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `WinnerTicker`, `StatsStrip`, `QuickBetStrip`, and a complete brand-artifact set (manifest + favicon set + 1200×630 OG image) to the Oddsify homepage without changing the existing Vite/React/Express stack or the existing black-and-gold color tokens.

**Architecture:** Two new public server endpoints (`/api/bet/recent-wins`, `/api/stats/public`), both 30s in-memory cached. Three new client components mounted in [client/src/pages/Home.jsx](../../../client/src/pages/Home.jsx), sourcing from those endpoints (plus the already-loaded matches array for `QuickBetStrip`). Two new Node build scripts under repo-root `scripts/` generate brand artifacts during `npm run build` via a root `prebuild` hook.

**Tech Stack:** Express 4 + ESM JS server, Vite 5 + React 18 + JS client, [`sharp`](https://www.npmjs.com/package/sharp) `^0.33.0` for image generation. No test framework added — verification is done via small Node verification scripts (`scripts/verify/*.mjs`) for pure server functions and manual browser smokes for client components, matching the existing codebase's pattern.

**Spec:** [docs/superpowers/specs/2026-05-28-homepage-pass-1-design.md](../specs/2026-05-28-homepage-pass-1-design.md)

---

## File map

**New files (10):**
- `server/src/services/recentWins.js` — recent-wins data builder (real + synthetic backfill, masking, caching)
- `server/src/services/publicStats.js` — stats aggregator + cache
- `server/src/routes/stats.js` — `GET /public` route
- `client/src/hooks/useVisibilityPolling.js` — fetch-on-visible hook reused by ticker + stats
- `client/src/components/odd/WinnerTicker.jsx` — replaces `OddPayoutTicker` (kept as alias)
- `client/src/components/odd/StatsStrip.jsx` — 4 animated counters
- `client/src/components/odd/QuickBetStrip.jsx` — horizontal 1-tap odds strip
- `client/public/manifest.json` — PWA manifest
- `scripts/build-favicons.mjs` — generates 7 PNG icons from `client/public/favicon.svg`
- `scripts/build-og-image.mjs` — generates 1200×630 `client/public/og-image.png`
- `scripts/verify/recent-wins.mjs` — verification script for the wins service
- `scripts/verify/public-stats.mjs` — verification script for the stats service

**Modified files (10):**
- `server/src/db/seedDemo.js` — `export` FIRST + LAST arrays
- `server/src/services/oddsAggregator.js` — add `getLiveCount()` accessor
- `server/src/routes/bet.js` — wire `GET /recent-wins` route
- `server/src/index.js` — mount stats router
- `client/src/api/betApi.js` — add `fetchRecentWins`, `fetchPublicStats`
- `client/src/pages/Home.jsx` — restructure section order, pass props for QuickBetStrip
- `client/src/components/odd/primitives.jsx` — make `OddPayoutTicker` an alias for `WinnerTicker`
- `client/index.html` — multi-size icons, manifest link, og:image swap, og:image dimensions
- `package.json` (root) — `sharp` devDep + `prebuild` script
- `.claude/settings.local.json` — purge the one stray `stakepoint` token from a Bash permission pattern

---

## Phase A — Server endpoints (Tasks 1–7)

### Task 1: Export `FIRST` and `LAST` from seedDemo for reuse

**Files:**
- Modify: `server/src/db/seedDemo.js:16-17`

- [ ] **Step 1: Add `export` keyword to both `const FIRST` and `const LAST`.**

Current lines 16–17:
```js
const FIRST = ['Akua', 'Kwame', 'Yaw', 'Esi', 'Kojo', 'Ama', 'Kofi', 'Adwoa', 'Fiifi', 'Abena', 'Selasi', 'Mawuli', 'Dela', 'Naa', 'Nana', 'Kwabena', 'Kweku', 'Sefa', 'Efua', 'Kobby'];
const LAST  = ['Mensah', 'Owusu', 'Asare', 'Boateng', 'Appiah', 'Adjei', 'Annan', 'Tetteh', 'Quartey', 'Ofori', 'Sarpong', 'Yeboah', 'Frimpong', 'Otoo', 'Mireku', 'Dadzie', 'Acheampong', 'Nkrumah'];
```

Replace with:
```js
export const FIRST = ['Akua', 'Kwame', 'Yaw', 'Esi', 'Kojo', 'Ama', 'Kofi', 'Adwoa', 'Fiifi', 'Abena', 'Selasi', 'Mawuli', 'Dela', 'Naa', 'Nana', 'Kwabena', 'Kweku', 'Sefa', 'Efua', 'Kobby'];
export const LAST  = ['Mensah', 'Owusu', 'Asare', 'Boateng', 'Appiah', 'Adjei', 'Annan', 'Tetteh', 'Quartey', 'Ofori', 'Sarpong', 'Yeboah', 'Frimpong', 'Otoo', 'Mireku', 'Dadzie', 'Acheampong', 'Nkrumah'];
```

- [ ] **Step 2: Verify both exports exist.**

Run:
```bash
grep -n "^export const \(FIRST\|LAST\)" server/src/db/seedDemo.js
```
Expected: two lines printed, one for FIRST and one for LAST.

- [ ] **Step 3: Verify seed still imports the unexported references correctly (it does, because export const stays a binding in scope).**

Run:
```bash
node -e "import('./server/src/db/seedDemo.js').then(m => console.log('FIRST has', m.FIRST.length, 'names; LAST has', m.LAST.length))"
```
Expected: `FIRST has 20 names; LAST has 18`

- [ ] **Step 4: Commit.**

```bash
git add server/src/db/seedDemo.js
git commit -m "chore(seed): export FIRST/LAST name arrays for reuse"
```

---

### Task 2: Expose `getLiveCount()` from `oddsAggregator`

**Files:**
- Modify: `server/src/services/oddsAggregator.js` (append after `stopLiveTrack`, around line 347)

- [ ] **Step 1: Append the accessor.**

Append at end of file:
```js
/**
 * Number of fixtures currently tracked as live by the aggregator.
 * Backed by the existing `liveLastByKey` Map; read by /api/stats/public.
 */
export function getLiveCount() {
  return liveLastByKey.size;
}
```

- [ ] **Step 2: Smoke-verify the export.**

Run:
```bash
node -e "import('./server/src/services/oddsAggregator.js').then(m => console.log('getLiveCount type:', typeof m.getLiveCount, 'value:', m.getLiveCount()))"
```
Expected: `getLiveCount type: function value: 0` (zero because the aggregator hasn't been started in this short-lived process).

- [ ] **Step 3: Commit.**

```bash
git add server/src/services/oddsAggregator.js
git commit -m "feat(odds): expose getLiveCount() for public stats"
```

---

### Task 3: Build the `recentWins` service

**Files:**
- Create: `server/src/services/recentWins.js`
- Create: `scripts/verify/recent-wins.mjs`

- [ ] **Step 1: Write the verification script (the "failing test").**

Create `scripts/verify/recent-wins.mjs`:
```js
/**
 * Verification script for server/src/services/recentWins.js
 * Run with: node scripts/verify/recent-wins.mjs
 * Exits non-zero on any failure.
 */
import { initStores } from '../../server/src/db/store.js';
import {
  maskPhone,
  buildSyntheticWin,
  getRecentWins,
  _resetCacheForTests,
} from '../../server/src/services/recentWins.js';

let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { console.log('  PASS  ' + msg); pass++; }
  else      { console.error('  FAIL  ' + msg); fail++; }
};

console.log('# maskPhone');
check(maskPhone('0241234567')      === '024•••567', '10-digit local phone');
check(maskPhone('+233241234567')   === '233•••567', 'intl format strips non-digits');
check(maskPhone('024-123-4567')    === '024•••567', 'dashed format strips non-digits');
check(maskPhone('')                === '•••••••',  'empty input fully masked');
check(maskPhone(null)              === '•••••••',  'null input fully masked');
check(maskPhone('12345')           === '•••••••',  'too short fully masked');

console.log('# buildSyntheticWin');
const w = buildSyntheticWin();
check(w.kind === 'synthetic',                           'kind tag is "synthetic"');
check(typeof w.id === 'string' && w.id.length > 0,      'has non-empty id');
check(typeof w.phoneMasked === 'string',                'phoneMasked is string');
check(w.phoneMasked.includes('•••'),                    'phoneMasked contains masking dots');
check(typeof w.amountGhs === 'number' && w.amountGhs >= 50, 'amount >= 50 GHS');
check(['single','multi'].includes(w.betType),           'valid betType');
check(w.legs >= 1 && w.legs <= 10,                      'leg count in [1, 10]');
check(typeof w.oddsTotal === 'number' && w.oddsTotal >= 1.4, 'oddsTotal >= 1.4');
check(typeof w.settledAt === 'string' && !isNaN(new Date(w.settledAt)), 'settledAt is parseable');

console.log('# synthetic amount distribution (1000 samples)');
const N = 1000;
const buckets = { under5k: 0, mid: 0, big: 0 };
for (let i = 0; i < N; i++) {
  const x = buildSyntheticWin();
  if (x.amountGhs < 5000) buckets.under5k++;
  else if (x.amountGhs < 50000) buckets.mid++;
  else buckets.big++;
}
console.log('  distribution:', buckets, '(target ~70/25/5)');
check(buckets.under5k > N * 0.60 && buckets.under5k < N * 0.80, '~70% under 5K');
check(buckets.mid     > N * 0.15 && buckets.mid     < N * 0.35, '~25% in 5K–50K');
check(buckets.big     > N * 0.01 && buckets.big     < N * 0.10, '~5% above 50K');

console.log('# getRecentWins (always 15)');
await initStores();
_resetCacheForTests();
const { wins } = getRecentWins();
check(Array.isArray(wins) && wins.length === 15,        'returns exactly 15 wins');
check(wins.every(x => typeof x.phoneMasked === 'string'), 'every item has phoneMasked');
check(wins.every(x => ['real','synthetic'].includes(x.kind)), 'every item has valid kind');

console.log('# cache hit returns same reference');
const first = getRecentWins();
const second = getRecentWins();
check(first === second, 'cached payload is identity-equal within TTL');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run the verification to watch it fail with module-not-found.**

Run:
```bash
node scripts/verify/recent-wins.mjs
```
Expected: error containing `Cannot find module` and the path `server/src/services/recentWins.js`.

- [ ] **Step 3: Implement the service.**

Create `server/src/services/recentWins.js`:
```js
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
```

- [ ] **Step 4: Run the verification to watch it pass.**

Run:
```bash
node scripts/verify/recent-wins.mjs
```
Expected: every line starts with `PASS`, final line `N passed, 0 failed`, exit code 0.

- [ ] **Step 5: Commit.**

```bash
git add server/src/services/recentWins.js scripts/verify/recent-wins.mjs
git commit -m "feat(stats): recent-wins service with synthetic backfill"
```

---

### Task 4: Wire `GET /api/bet/recent-wins`

**Files:**
- Modify: `server/src/routes/bet.js` (add import near top + route handler after existing `GET /code/:code`)

- [ ] **Step 1: Add the import.**

Find the existing imports near the top of [server/src/routes/bet.js](../../../server/src/routes/bet.js) and add this line below the other relative imports:
```js
import { getRecentWins } from '../services/recentWins.js';
```

- [ ] **Step 2: Add the route.**

After the existing `router.get('/code/:code', …)` block (around line 202–206), insert:
```js
/**
 * Public ticker feed — up to 15 recent winning bets, real-first with
 * synthetic backfill so the homepage band always feels active.
 */
router.get('/recent-wins', (_req, res) => {
  res.json(getRecentWins());
});
```

- [ ] **Step 3: Boot the dev server (or assume already running).**

Run in a separate terminal:
```bash
npm run dev
```
Wait for `Oddsify API listening on http://127.0.0.1:4000`.

- [ ] **Step 4: Smoke the endpoint.**

```bash
curl -sS http://127.0.0.1:4000/api/bet/recent-wins | jq '.wins | length'
```
Expected: `15`

```bash
curl -sS http://127.0.0.1:4000/api/bet/recent-wins | jq '.wins[0]'
```
Expected: an object with keys `id, phoneMasked, amountGhs, betType, legs, oddsTotal, settledAt, kind`.

- [ ] **Step 5: Commit.**

```bash
git add server/src/routes/bet.js
git commit -m "feat(api): GET /api/bet/recent-wins for winner ticker"
```

---

### Task 5: Build the `publicStats` service

**Files:**
- Create: `server/src/services/publicStats.js`
- Create: `scripts/verify/public-stats.mjs`

- [ ] **Step 1: Write the verification script.**

Create `scripts/verify/public-stats.mjs`:
```js
/**
 * Verification script for server/src/services/publicStats.js
 * Run with: node scripts/verify/public-stats.mjs
 */
import { initStores } from '../../server/src/db/store.js';
import { getPublicStats, _resetCacheForTests } from '../../server/src/services/publicStats.js';

let pass = 0, fail = 0;
const check = (c, m) => {
  if (c) { console.log('  PASS  ' + m); pass++; }
  else   { console.error('  FAIL  ' + m); fail++; }
};

await initStores();
_resetCacheForTests();

const s = getPublicStats();
console.log('# computed stats:', s);

check(s && typeof s === 'object',                       'returns object');
check(typeof s.totalBets === 'number',                  'totalBets is number');
check(typeof s.totalPayoutsGhs === 'number',            'totalPayoutsGhs is number');
check(typeof s.activeUsers24h === 'number',             'activeUsers24h is number');
check(typeof s.liveMatches === 'number',                'liveMatches is number');
check(s.totalBets >= 0,                                 'totalBets non-negative');
check(s.totalPayoutsGhs >= 0,                           'totalPayoutsGhs non-negative');
check(Number.isInteger(s.totalBets),                    'totalBets integer');
check(Number.isInteger(s.totalPayoutsGhs),              'totalPayoutsGhs integer (floored)');

console.log('# cache identity');
const first  = getPublicStats();
const second = getPublicStats();
check(first === second, 'cached payload is identity-equal within TTL');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run verification (expect failure: module not found).**

```bash
node scripts/verify/public-stats.mjs
```
Expected: `Cannot find module` error for `publicStats.js`.

- [ ] **Step 3: Implement the service.**

Create `server/src/services/publicStats.js`:
```js
/**
 * Public stats payload for the homepage StatsStrip.
 *
 * - totalBets:        count of all bets in the store (all-time)
 * - totalPayoutsGhs:  floored sum of payouts on won + cashed_out bets
 * - activeUsers24h:   distinct user IDs with a bet or tx in last 24h
 * - liveMatches:      count of fixtures currently live in the aggregator
 *
 * 30s in-memory cache. Public, no auth.
 */
import { createStore } from '../db/store.js';
import { getLiveCount } from './oddsAggregator.js';

const betsStore = createStore('bets', {});
const txStore   = createStore('transactions', {});

const CACHE_TTL_MS = 30_000;
const TWENTY_FOUR_HRS_MS = 24 * 60 * 60 * 1000;

let _cache = { value: null, expiresAt: 0 };

export function getPublicStats() {
  const now = Date.now();
  if (_cache.value && _cache.expiresAt > now) return _cache.value;

  const bets = Object.values(betsStore.all() || {});
  const txs  = Object.values(txStore.all() || {});

  let totalPayoutsGhs = 0;
  const active = new Set();
  const cutoff = now - TWENTY_FOUR_HRS_MS;

  for (const bet of bets) {
    if (bet.status === 'won' || bet.status === 'cashed_out') {
      totalPayoutsGhs += Number(bet.payout) || 0;
    }
    const placedAt = bet.placedAt ? new Date(bet.placedAt).getTime() : 0;
    if (bet.userId && placedAt > cutoff) active.add(bet.userId);
  }
  for (const tx of txs) {
    const createdAt = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
    if (tx.userId && createdAt > cutoff) active.add(tx.userId);
  }

  const value = {
    totalBets:       bets.length,
    totalPayoutsGhs: Math.floor(totalPayoutsGhs),
    activeUsers24h:  active.size,
    liveMatches:     getLiveCount(),
  };
  _cache = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/** Internal: clear cache so verification scripts are deterministic. */
export function _resetCacheForTests() { _cache = { value: null, expiresAt: 0 }; }
```

- [ ] **Step 4: Run verification (expect pass).**

```bash
node scripts/verify/public-stats.mjs
```
Expected: every line starts with `PASS`, final summary `N passed, 0 failed`, exit code 0.

- [ ] **Step 5: Commit.**

```bash
git add server/src/services/publicStats.js scripts/verify/public-stats.mjs
git commit -m "feat(stats): public-stats aggregator with 30s cache"
```

---

### Task 6: Wire `GET /api/stats/public`

**Files:**
- Create: `server/src/routes/stats.js`
- Modify: `server/src/index.js` (import + mount)

- [ ] **Step 1: Create the router.**

Create `server/src/routes/stats.js`:
```js
import { Router } from 'express';
import { getPublicStats } from '../services/publicStats.js';

const router = Router();

/**
 * Public stats payload for the homepage StatsStrip. Cached 30s upstream.
 */
router.get('/public', (_req, res) => {
  res.json(getPublicStats());
});

export default router;
```

- [ ] **Step 2: Mount the router in `server/src/index.js`.**

Find the import block (top of file, around lines 14–30) and add:
```js
import statsRouter from './routes/stats.js';
```

Find the `app.use('/api/auth', authRouter);` block (around lines 87–104) and add this line near the other public mounts (above the admin block):
```js
app.use('/api/stats', statsRouter);
```

The order matters only that `app.use('/api', notFoundHandler)` (around line 106) stays AFTER all `/api/*` mounts.

- [ ] **Step 3: Restart dev server (node --watch picks this up automatically).**

Confirm `npm run dev` is still running. If it crashed, restart it. Wait for `Oddsify API listening`.

- [ ] **Step 4: Smoke the endpoint.**

```bash
curl -sS http://127.0.0.1:4000/api/stats/public | jq
```
Expected: `{ "totalBets": N, "totalPayoutsGhs": N, "activeUsers24h": N, "liveMatches": N }` — all four keys present, all numbers.

- [ ] **Step 5: Commit.**

```bash
git add server/src/routes/stats.js server/src/index.js
git commit -m "feat(api): GET /api/stats/public for homepage StatsStrip"
```

---

### Task 7: Stakepoint sweep

**Files:**
- Modify: `.claude/settings.local.json:24`

The audit found exactly one remaining `stakepoint` token — inside a Bash permission allowlist pattern in the user's local Claude settings. It's not user-facing brand text, but the spec asks to purge any reference.

- [ ] **Step 1: Open the file and find the line.**

```bash
grep -n "stakepoint" .claude/settings.local.json
```
Expected: one line like:
```
24:      "Bash(xargs grep -lE \"Oddsify|stakepoint|From:|noreply|no-reply\")",
```

- [ ] **Step 2: Remove the `stakepoint|` token from the pattern.**

Use Edit to change the matched line. Before:
```json
      "Bash(xargs grep -lE \"Oddsify|stakepoint|From:|noreply|no-reply\")",
```
After:
```json
      "Bash(xargs grep -lE \"Oddsify|From:|noreply|no-reply\")",
```

- [ ] **Step 3: Verify zero matches across the repo.**

```bash
grep -rn "stakepoint" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.html" --include="*.yaml" --include="*.yml" --include="*.css" --include="*.svg" 2>/dev/null | grep -v node_modules | grep -v "docs/superpowers/specs/2026-05-28" | grep -v "docs/superpowers/plans/2026-05-28"
```
Expected: no output (zero matches outside the spec/plan files themselves, which mention "stakepoint" in their changelogs).

- [ ] **Step 4: Commit.**

```bash
git add .claude/settings.local.json
git commit -m "chore(brand): purge final stakepoint token from local settings allowlist"
```

---

## Phase B — Client components (Tasks 8–13)

### Task 8: Add client API helpers

**Files:**
- Modify: `client/src/api/betApi.js` (add two exports near other `/* meta */` exports)

- [ ] **Step 1: Add the two exports.**

In [client/src/api/betApi.js](../../../client/src/api/betApi.js), find the `/* meta */` block (around line 88–91) and add the two new lines below the existing `fetchHealth` / `fetchAuthConfig` / `fetchSports`:
```js
/* meta */
export const fetchHealth        = () => get('/health');
export const fetchAuthConfig    = () => get('/auth/config');
export const fetchSports        = () => get('/bet/sports');
export const fetchRecentWins    = () => get('/bet/recent-wins');
export const fetchPublicStats   = () => get('/stats/public');
```

- [ ] **Step 2: Smoke from the browser console.**

Confirm `npm run dev` is still up. Open `http://localhost:5173/` and run in DevTools Console:
```js
(await import('/src/api/betApi.js')).fetchRecentWins().then(console.log)
```
Expected: `{ wins: [ {…}×15 ] }`.

```js
(await import('/src/api/betApi.js')).fetchPublicStats().then(console.log)
```
Expected: object with 4 numeric keys.

- [ ] **Step 3: Commit.**

```bash
git add client/src/api/betApi.js
git commit -m "feat(api-client): fetchRecentWins + fetchPublicStats helpers"
```

---

### Task 9: Build the `useVisibilityPolling` hook

**Files:**
- Create: `client/src/hooks/useVisibilityPolling.js`

- [ ] **Step 1: Create the file.**

```js
/**
 * Poll an async fetcher on a fixed interval — but only while the
 * Page Visibility API reports the document is visible. Pauses on
 * hide; immediate re-fetch + resume on show.
 *
 * Returns { data, error, loading } in the React-hook idiom.
 */
import { useEffect, useRef, useState } from 'react';

export function useVisibilityPolling(fetcher, intervalMs, deps = []) {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef              = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNow() {
      try {
        const v = await fetcher();
        if (!cancelled) { setData(v); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    function start() {
      if (timerRef.current) return;
      fetchNow();
      timerRef.current = setInterval(fetchNow, intervalMs);
    }

    function stop() {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }

    function onVis() {
      if (document.visibilityState === 'visible') { fetchNow(); start(); }
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading };
}
```

- [ ] **Step 2: Verify the file imports cleanly (no runtime errors).**

Run:
```bash
node -e "import('./client/src/hooks/useVisibilityPolling.js').then(m => console.log('exports:', Object.keys(m)))"
```
Expected: `exports: [ 'useVisibilityPolling' ]`.

- [ ] **Step 3: Commit.**

```bash
git add client/src/hooks/useVisibilityPolling.js
git commit -m "feat(hooks): useVisibilityPolling — fetch only while tab visible"
```

---

### Task 10: Build the `WinnerTicker` component

**Files:**
- Create: `client/src/components/odd/WinnerTicker.jsx`

- [ ] **Step 1: Create the component file.**

```jsx
/**
 * WinnerTicker — replaces OddPayoutTicker.
 *
 * Mobile (<768px): vertical stack of 3 items, auto-rotates every 4s.
 * Desktop (>=768px): horizontal marquee using existing `odd-marquee` keyframe.
 * Tap to expand (mobile): reveals stake/odds row.
 *
 * Data: GET /api/bet/recent-wins (15 items, real + synthetic).
 * Polling: 60s, paused when tab hidden, immediate re-fetch on regain.
 * Respects prefers-reduced-motion: no auto-rotate, no marquee, static list.
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchRecentWins } from '../../api/betApi.js';
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling.js';
import { T, fmtCedi } from './tokens.js';

const ROTATE_MS = 4000;
const POLL_MS   = 60_000;

function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)          return 'just now';
  if (ms < 60 * 60_000)     return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / (60 * 60_000))}h ago`;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function WinRow({ item, expanded, onToggle }) {
  const typeLabel = item.betType === 'multi' ? `Multi (${item.legs} legs)` : 'Single';
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%',
        textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer',
        padding: '4px 0', color: '#fff',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 12, letterSpacing: 0.2, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: T.greenBright, flexShrink: 0,
        }} />
        <span style={{ color: '#fff' }}>📞 {item.phoneMasked}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ color: T.greenBright, fontWeight: 700 }}>GHS {fmtCedi(item.amountGhs)}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ opacity: 0.85 }}>{typeLabel}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span style={{ opacity: 0.5 }}>{relTime(item.settledAt)}</span>
      </span>
      {expanded && (
        <span style={{
          fontSize: 11, color: T.inkSoft, marginTop: 4, marginLeft: 14,
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        }}>
          Stake — · Odds @{item.oddsTotal.toFixed(2)}
        </span>
      )}
    </button>
  );
}

export default function WinnerTicker() {
  const { data } = useVisibilityPolling(fetchRecentWins, POLL_MS, []);
  const items = data?.wins || [];
  const reduce = useMemo(prefersReducedMotion, []);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (reduce || items.length === 0) return;
    const id = setInterval(
      () => setPage((p) => (p + 1) % Math.max(1, items.length)),
      ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [reduce, items.length]);

  const visibleMobile = useMemo(() => {
    if (items.length === 0) return [];
    if (items.length <= 3)  return items;
    const out = [];
    for (let i = 0; i < 3; i++) out.push(items[(page + i) % items.length]);
    return out;
  }, [items, page]);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recent winners"
      style={{
        background: T.greenMid, color: '#dff3e3',
        padding: '8px 16px', overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Mobile: vertical 3-item stack */}
      <div className="winner-ticker-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleMobile.map((it) => (
          <WinRow
            key={it.id}
            item={it}
            expanded={expandedId === it.id}
            onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
          />
        ))}
      </div>

      {/* Desktop: horizontal marquee */}
      <div
        className="winner-ticker-desktop"
        style={{
          display: 'none', whiteSpace: 'nowrap',
          animation: reduce ? 'none' : 'odd-marquee 60s linear infinite',
        }}
      >
        {[...items, ...items].map((it, i) => (
          <span key={`${it.id}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 48,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: T.greenBright }} />
            <span style={{ color: '#fff' }}>📞 {it.phoneMasked}</span>
            <span style={{ color: T.greenBright, fontWeight: 700 }}>GHS {fmtCedi(it.amountGhs)}</span>
            <span style={{ opacity: 0.85 }}>{it.betType === 'multi' ? `Multi (${it.legs} legs)` : 'Single'}</span>
            <span style={{ opacity: 0.5 }}>{relTime(it.settledAt)}</span>
          </span>
        ))}
      </div>

      {/* Layout switch handled by CSS so it works without JS re-render on resize. */}
      <style>{`
        @media (min-width: 768px) {
          .winner-ticker-mobile  { display: none !important; }
          .winner-ticker-desktop { display: block !important; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit (we'll mount it next).**

```bash
git add client/src/components/odd/WinnerTicker.jsx
git commit -m "feat(home): WinnerTicker component with mobile rotate + desktop marquee"
```

---

### Task 11: Mount WinnerTicker in Home + deprecate-alias `OddPayoutTicker`

**Files:**
- Modify: `client/src/pages/Home.jsx`
- Modify: `client/src/components/odd/primitives.jsx`

- [ ] **Step 1: Replace OddPayoutTicker import and JSX in Home.jsx.**

In [client/src/pages/Home.jsx](../../../client/src/pages/Home.jsx), change the imports block (lines 16–21) from:
```js
import {
  T,
  OddTopHeader, OddPayoutTicker, OddPromoBanner, OddCategoryGrid,
  OddLeagueRow, OddMatchCard, OddsifyWordmark, OddIcon,
} from '../components/odd/primitives.jsx';
```
to:
```js
import {
  T,
  OddTopHeader, OddPromoBanner, OddCategoryGrid,
  OddLeagueRow, OddMatchCard, OddsifyWordmark, OddIcon,
} from '../components/odd/primitives.jsx';
import WinnerTicker from '../components/odd/WinnerTicker.jsx';
```

In the return JSX (around line 69), change:
```jsx
      <OddPayoutTicker />
```
to:
```jsx
      <WinnerTicker />
```

- [ ] **Step 2: Add the deprecate-alias in primitives.jsx.**

In [client/src/components/odd/primitives.jsx](../../../client/src/components/odd/primitives.jsx), find the existing `export function OddPayoutTicker` block (around lines 235–260). REPLACE the entire `export function OddPayoutTicker(...) { ... }` body with:

```jsx
/* ─── Payout marquee — deprecated alias, prefer WinnerTicker.
   Kept for one release so any external import path keeps working. ─ */
export { default as OddPayoutTicker } from './WinnerTicker.jsx';
```

Also delete the now-orphaned `const TICKER_ITEMS = [ ... ];` block (lines 228–234) — `WinnerTicker` doesn't use it.

- [ ] **Step 3: Manual smoke — load Home and visually verify.**

Make sure dev server is running, then open `http://localhost:5173/` and check:
- [ ] Top of homepage shows a band of 3 stacked winner rows (mobile) OR a horizontal marquee (desktop)
- [ ] Items contain `📞 0XX•••XXX`, `GHS X,XXX`, `Single` or `Multi (N legs)`, `Nm ago`
- [ ] No console errors
- [ ] Tap a row on mobile → expand row appears with `Stake — · Odds @X.XX`

Toggle DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", reload. Verify:
- [ ] Mobile ticker stops rotating
- [ ] Desktop ticker stops scrolling (static text)

- [ ] **Step 4: Commit.**

```bash
git add client/src/pages/Home.jsx client/src/components/odd/primitives.jsx
git commit -m "feat(home): mount WinnerTicker; deprecate OddPayoutTicker to alias"
```

---

### Task 12: Build and mount `StatsStrip`

**Files:**
- Create: `client/src/components/odd/StatsStrip.jsx`
- Modify: `client/src/pages/Home.jsx` (import + mount)

- [ ] **Step 1: Create the component.**

Create `client/src/components/odd/StatsStrip.jsx`:
```jsx
/**
 * StatsStrip — 4 animated counters on the homepage.
 *
 * Numbers count up from 0 to value on first scroll-into-view (1.5s, ease-out
 * cubic). Subsequent re-fetches snap to the new value without re-animating
 * (avoids the perpetually-counting "casino tackiness" the spec warns about).
 * `prefers-reduced-motion` skips the animation entirely.
 *
 * Data: GET /api/stats/public, re-fetched every 60s while visible.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchPublicStats } from '../../api/betApi.js';
import { useVisibilityPolling } from '../../hooks/useVisibilityPolling.js';
import { T, fmtCedi } from './tokens.js';

const POLL_MS = 60_000;
const ANIM_MS = 1500;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function CountUp({ value, format = (n) => n.toLocaleString('en-GH') }) {
  // If reduce-motion is on, mount already showing the final value and mark
  // "already animated" so subsequent value updates snap instead of animating.
  const reduce = prefersReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const animatedRef = useRef(reduce);

  useEffect(() => {
    if (animatedRef.current) { setDisplay(value); return; }
    const start = performance.now();
    let rafId = null;
    function frame(now) {
      const t = Math.min(1, (now - start) / ANIM_MS);
      setDisplay(Math.round(value * easeOutCubic(t)));
      if (t < 1) rafId = requestAnimationFrame(frame);
      else animatedRef.current = true;
    }
    rafId = requestAnimationFrame(frame);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
  }, [value]);

  return <>{format(display)}</>;
}

function StatCard({ label, value, sublabel, format, pulse }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
        color: T.inkSoft, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {pulse && (
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: T.danger, animation: 'odd-pulse 1.4s ease-in-out infinite',
          }} />
        )}
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700, color: T.ink,
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums',
      }}>
        {value == null
          ? '—'
          : <CountUp value={value} format={format} />}
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: T.inkSoft }}>{sublabel}</div>
      )}
    </div>
  );
}

export default function StatsStrip() {
  const { data } = useVisibilityPolling(fetchPublicStats, POLL_MS, []);
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  // Until BOTH data is loaded AND we're in view, pass undefined values so
  // each StatCard renders an "—". This avoids the placeholder-0 → real-value
  // transition that would otherwise hide the animation behind a stale ref.
  const v = (data && inView) ? data : {};

  return (
    <div ref={ref} role="region" aria-label="Site statistics" style={{
      padding: '16px',
      display: 'grid', gap: 10,
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    }} className="stats-strip">
      <StatCard label="Bets placed"    value={v.totalBets} />
      <StatCard label="GHS paid out"   value={v.totalPayoutsGhs} format={(n) => `GHS ${fmtCedi(n)}`} />
      <StatCard label="Players online" value={v.activeUsers24h} sublabel="Today" />
      <StatCard label="Live matches"   value={v.liveMatches} pulse={(v.liveMatches ?? 0) > 0} />
      <style>{`
        @media (min-width: 768px) {
          .stats-strip { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Mount in Home.jsx.**

In [client/src/pages/Home.jsx](../../../client/src/pages/Home.jsx), add import below the existing WinnerTicker import:
```js
import StatsStrip   from '../components/odd/StatsStrip.jsx';
```

In the return JSX, insert `<StatsStrip />` **between** the "Featured upcoming" `<MatchList />` (around line 99) and the footer block (around line 101). After modification:
```jsx
      <SectionHeader title="Featured upcoming" action="More →" onAction={() => navigate('/sports')} />
      <MatchList loading={loading} err={err} matches={upcoming}
        picks={picks} onPick={togglePick}
        emptyLabel="Nothing scheduled yet." />

      <StatsStrip />

      <div style={{ padding: '24px 16px 60px', textAlign: 'center' }}>
        <OddsifyWordmark size={18} color={T.ink} accent={T.greenBright} />
        ...
```

- [ ] **Step 3: Manual smoke.**

Reload `http://localhost:5173/`. Without scrolling all the way down yet, observe:
- [ ] 4 stat cards exist at the bottom of the page, each showing `—` (em-dash) for their number — the placeholder state, before the IntersectionObserver fires

Scroll the StatsStrip into view (or scroll to bottom). Verify:
- [ ] Numbers count up from 0 (~1.5s ease-out) — should only animate once per page load
- [ ] Final values: "Bets placed" = total bets count from seed; "GHS paid out" formatted as `GHS 1,234,567.00`; "Players online" with `Today` sublabel; "Live matches" with `liveMatches` count
- [ ] If `liveMatches > 0`, the "Live matches" card has a pulsing red dot next to its label
- [ ] Scrolling away and back does NOT re-trigger the animation (numbers stay put)
- [ ] Mobile (360px): cards are 2×2 grid; desktop (≥768px): single row of 4
- [ ] No console errors

Then toggle DevTools → Rendering → "Emulate prefers-reduced-motion: reduce", reload. Verify:
- [ ] Cards render with final values immediately on scroll-into-view, no count-up animation
- [ ] Pulsing dot on "Live matches" still works (CSS animation, not JS)

- [ ] **Step 4: Commit.**

```bash
git add client/src/components/odd/StatsStrip.jsx client/src/pages/Home.jsx
git commit -m "feat(home): StatsStrip with count-up + IntersectionObserver"
```

---

### Task 13: Build and mount `QuickBetStrip`

**Files:**
- Create: `client/src/components/odd/QuickBetStrip.jsx`
- Modify: `client/src/pages/Home.jsx`

- [ ] **Step 1: Inspect a match object's shape so the strip can call togglePick correctly.**

Run:
```bash
curl -sS "http://127.0.0.1:4000/api/bet/matches?sport=football" | jq '.leagues[0].matches[0] | { id, home: .home.name, away: .away.name, kickoff, isLive, markets: (.markets | keys) }'
```
Expected: object with `id`, `home`, `away`, `kickoff`, `isLive: false`, `markets` array containing `"1X2"` (or similar). Note exact field names — adjust the component if `markets` is nested differently.

Also check the existing `togglePick` selection shape: look at how `OddMatchCard` calls it. Run:
```bash
grep -nE "togglePick|onPick" client/src/components/odd/primitives.jsx | head -20
```
Use the same shape in QuickBetStrip.

- [ ] **Step 2: Create the component.**

Create `client/src/components/odd/QuickBetStrip.jsx`:
```jsx
/**
 * QuickBetStrip — horizontal scroll of the next 6 football kickoffs.
 * Each card shows team names + kickoff badge + three 1X2 odds buttons
 * that add the selection to the bet slip via the existing onPick callback.
 *
 * Pure-presentational: consumes matches + picks + onPick props from Home,
 * no fetch of its own.
 */
import { T } from './tokens.js';

function relativeKickoff(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0)               return 'Started';
  if (ms < 60_000)          return 'in <1m';
  if (ms < 60 * 60_000)     return `in ${Math.floor(ms / 60_000)}m`;
  if (ms < 24 * 60 * 60_000) {
    const h = Math.floor(ms / (60 * 60_000));
    return `in ${h}h`;
  }
  return new Date(iso).toLocaleString('en-GH', {
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** Extract 1X2 outcomes from a match object, tolerant of multiple market shapes. */
function get1X2(match) {
  const markets = match.markets || {};
  const m = markets['1X2'] || markets.h2h || markets.win || null;
  if (!m) return null;
  // Common shape: { '1': 1.85, 'X': 3.40, '2': 4.20 } or an array of { outcome, odds }
  if (Array.isArray(m)) {
    const map = {};
    for (const row of m) map[row.outcome] = Number(row.odds);
    return map['1'] && map['2'] ? { '1': map['1'], 'X': map['X'], '2': map['2'] } : null;
  }
  if (m['1'] && m['2']) return { '1': Number(m['1']), 'X': Number(m['X']), '2': Number(m['2']) };
  return null;
}

function OddsBtn({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, height: 52,
        background: active ? T.greenSoft : T.surfaceAlt,
        border: active ? `2px solid ${T.greenBright}` : `1px solid ${T.line}`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, cursor: 'pointer', padding: 0,
      }}
      aria-label={`${label} at odds ${value}`}
    >
      <span style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700 }}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 700, color: active ? T.greenBright : T.ink,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {Number(value).toFixed(2)}
      </span>
    </button>
  );
}

function MatchCard({ match, picks, onPick }) {
  const odds = get1X2(match);
  if (!odds) return null;
  const isActive = (out) => (picks || []).some(
    (p) => p.matchId === match.id && p.market === '1X2' && p.outcome === out,
  );
  const click = (out) => onPick?.({
    matchId: match.id,
    market: '1X2',
    outcome: out,
    odds: odds[out],
    home: match.home?.name || match.home,
    away: match.away?.name || match.away,
  });
  return (
    <article
      style={{
        flex: '0 0 280px', width: 280, height: 144, scrollSnapAlign: 'start',
        background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12,
        padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
      aria-label={`${match.home?.name || match.home} vs ${match.away?.name || match.away}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {match.home?.name || match.home} <span style={{ opacity: 0.5 }}>vs</span> {match.away?.name || match.away}
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft }}>{relativeKickoff(match.kickoff)}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <OddsBtn label="1" value={odds['1']} active={isActive('1')} onClick={() => click('1')} />
        <OddsBtn label="X" value={odds['X']} active={isActive('X')} onClick={() => click('X')} />
        <OddsBtn label="2" value={odds['2']} active={isActive('2')} onClick={() => click('2')} />
      </div>
    </article>
  );
}

function Skeletons() {
  return (
    <div className="odd-pane" style={{ display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          flex: '0 0 280px', width: 280, height: 144, borderRadius: 12,
          background: T.surface, border: `1px solid ${T.line}`, opacity: 0.5 + i * 0.15,
        }} />
      ))}
    </div>
  );
}

export default function QuickBetStrip({ matches, loading, picks, onPick }) {
  if (loading) return <Skeletons />;
  const quick = (matches || []).filter((m) => !m.isLive).slice(0, 6);
  const valid = quick.filter((m) => get1X2(m));
  if (valid.length === 0) return null;
  return (
    <div
      className="odd-pane"
      role="region"
      aria-label="Quick bet — next kickoffs"
      style={{
        display: 'flex', gap: 10, padding: '6px 16px 12px', overflowX: 'auto',
        scrollSnapType: 'x mandatory',
      }}
    >
      {valid.map((m) => (
        <MatchCard key={m.id} match={m} picks={picks} onPick={onPick} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount in Home.jsx (between OddPromoBanner and OddCategoryGrid).**

Add import:
```js
import QuickBetStrip from '../components/odd/QuickBetStrip.jsx';
```

In the JSX, insert `<QuickBetStrip … />` between `<OddPromoBanner />` and `<OddCategoryGrid />`:
```jsx
      <OddPromoBanner onAction={() => navigate('/promos')} />
      <QuickBetStrip matches={matches} loading={loading} picks={picks} onPick={togglePick} />
      <OddCategoryGrid ... />
```

- [ ] **Step 4: Manual smoke.**

Reload `http://localhost:5173/`. Verify:
- [ ] A horizontal-scrolling row of up to 6 cards appears between the promo banner and the categories grid
- [ ] Each card has team names, a kickoff badge ("in 23m" / "Today 19:30"), and three odds buttons
- [ ] Tapping an odds button opens the bet slip with the selection (or adds it if slip is already open)
- [ ] Tapping the same odds button again removes it (slip behavior)
- [ ] Active button has a gold border + soft gold background
- [ ] Cards align cleanly with snap-scrolling on mobile
- [ ] No console errors

If `get1X2` returns null for every match (because market shape differs from what's coded), the strip will hide itself. In that case, inspect a real match object via the curl in Step 1 and adjust `get1X2` to match the actual shape — common alternates are nested under `markets.football_1x2` or similar.

- [ ] **Step 5: Commit.**

```bash
git add client/src/components/odd/QuickBetStrip.jsx client/src/pages/Home.jsx
git commit -m "feat(home): QuickBetStrip — horizontal next-6 with one-tap 1X2 odds"
```

---

## Phase C — Brand artifacts (Tasks 14–17)

### Task 14: Install `sharp` and wire root `prebuild` script

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install sharp at the workspace root.**

Run from repo root:
```bash
npm install --save-dev sharp@^0.33.0
```
Expected: `added N packages`. No errors. If sharp's native binary fails to install on Windows, set `npm config set sharp_binary_host "https://npmmirror.com/mirrors/sharp"` and retry.

- [ ] **Step 2: Verify import works.**

```bash
node -e "import('sharp').then(s => console.log('sharp version:', s.default.versions))"
```
Expected: prints sharp + libvips version map.

- [ ] **Step 3: Add the prebuild script.**

Edit root `package.json`. Find the `"scripts"` block (currently lines 8–12):
```json
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w client",
    "start": "npm run start -w server"
  },
```

Add a `prebuild` line so it becomes:
```json
  "scripts": {
    "dev": "concurrently -n api,web -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "prebuild": "node scripts/build-favicons.mjs && node scripts/build-og-image.mjs",
    "build": "npm run build -w client",
    "start": "npm run start -w server"
  },
```

- [ ] **Step 4: Commit.**

```bash
git add package.json package-lock.json
git commit -m "build: add sharp devDep + prebuild script for brand artifacts"
```

---

### Task 15: Generate the favicon set + write the PWA manifest

**Files:**
- Create: `scripts/build-favicons.mjs`
- Create: `client/public/manifest.json`

- [ ] **Step 1: Write the favicon generator.**

Create `scripts/build-favicons.mjs`:
```js
/**
 * Generate the favicon size set from client/public/favicon.svg using sharp.
 * Idempotent — re-running produces identical bytes given the same input SVG.
 *
 * Outputs to client/public/:
 *   favicon-16.png, favicon-32.png, favicon-48.png
 *   apple-touch-icon-180.png
 *   icon-192.png, icon-512.png
 *   maskable-icon-512.png   (with 10% safe-zone padding on each side)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'client', 'public');

const SRC = resolve(PUBLIC, 'favicon.svg');
const svg = readFileSync(SRC);

const SIZES = [
  { name: 'favicon-16.png',          size: 16  },
  { name: 'favicon-32.png',          size: 32  },
  { name: 'favicon-48.png',          size: 48  },
  { name: 'apple-touch-icon-180.png',size: 180 },
  { name: 'icon-192.png',            size: 192 },
  { name: 'icon-512.png',            size: 512 },
];

async function renderSquare(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderMaskable(size = 512) {
  // 80% safe zone → 10% padding on each side. Background is opaque #0a0a0a
  // (Android requires the maskable variant to fill the canvas).
  const inner = Math.round(size * 0.8);
  const innerPng = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
  })
    .composite([{ input: innerPng, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  for (const { name, size } of SIZES) {
    const buf = await renderSquare(size);
    writeFileSync(resolve(PUBLIC, name), buf);
    console.log(`wrote ${name} (${buf.length} bytes)`);
  }
  const maskable = await renderMaskable(512);
  writeFileSync(resolve(PUBLIC, 'maskable-icon-512.png'), maskable);
  console.log(`wrote maskable-icon-512.png (${maskable.length} bytes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the generator.**

```bash
node scripts/build-favicons.mjs
```
Expected: 7 lines `wrote XXX.png (N bytes)`. Exit code 0.

- [ ] **Step 3: Verify the files exist.**

```bash
ls -la client/public/ | grep -E "\.png$|favicon\.svg$"
```
Expected: 7 PNG files plus the source favicon.svg.

- [ ] **Step 4: Write the manifest.**

Create `client/public/manifest.json`:
```json
{
  "name": "Oddsify — Premium Sports Betting",
  "short_name": "Oddsify",
  "description": "Sharper odds across 30+ leagues, live & pre-match. Instant MoMo, Vodafone Cash & card deposits.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "icons": [
    { "src": "/icon-192.png",          "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png",          "sizes": "512x512", "type": "image/png" },
    { "src": "/maskable-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 5: Commit.**

```bash
git add scripts/build-favicons.mjs client/public/manifest.json client/public/*.png
git commit -m "feat(brand): generate favicon size set + PWA manifest"
```

---

### Task 16: Generate the OG image

**Files:**
- Create: `scripts/build-og-image.mjs`

- [ ] **Step 1: Write the generator.**

Create `scripts/build-og-image.mjs`:
```js
/**
 * Generate client/public/og-image.png (1200×630) for link previews.
 * Pure SVG → PNG via sharp. No external font files required — uses the
 * generic `sans-serif` family that resvg falls back to on any system.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'client', 'public', 'og-image.png');

const W = 1200, H = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g" cx="80%" cy="100%" r="80%">
      <stop offset="0%"  stop-color="#e8b94a" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="#e8b94a" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#e8b94a" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>

  <!-- Wordmark: O in gold, rest in cream, plus a small gold dot at baseline -->
  <g font-family="sans-serif" font-weight="800" letter-spacing="-4">
    <text x="80" y="350" font-size="180" fill="#e8b94a">O</text>
    <text x="200" y="350" font-size="180" fill="#f3e9cf">ddsify</text>
    <circle cx="640" cy="345" r="14" fill="#e8b94a"/>
  </g>

  <!-- Tagline -->
  <text x="80" y="420" font-family="sans-serif" font-weight="500" font-size="32" fill="#9c9277">
    Premium Sports Betting · Ghana
  </text>

  <!-- 18+ chip bottom-left -->
  <g transform="translate(80, 530)">
    <rect width="84" height="40" rx="20" fill="#161513" stroke="#e8b94a" stroke-opacity="0.5"/>
    <text x="42" y="27" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="16" fill="#e8b94a">18+</text>
  </g>

  <!-- License caption bottom-right -->
  <text x="${W - 80}" y="555" text-anchor="end" font-family="sans-serif" font-size="18" fill="#5f5848">
    Licensed · Gaming Commission of Ghana
  </text>
</svg>`;

async function main() {
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(OUT, buf);
  console.log(`wrote og-image.png (${buf.length} bytes, ${W}×${H})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the generator.**

```bash
node scripts/build-og-image.mjs
```
Expected: one line `wrote og-image.png (N bytes, 1200×630)`. Exit code 0.

- [ ] **Step 3: Verify visually.**

```bash
ls -la client/public/og-image.png
```
Then open the file in any image viewer or:
```bash
open client/public/og-image.png  # macOS
start client/public/og-image.png # Windows
```
Verify the image looks intentional: black bg, gold "O" + cream "ddsify" wordmark + tagline + 18+ chip. Fonts may be a generic sans-serif (DejaVu / Liberation / etc. depending on system). That's acceptable for Pass 1.

- [ ] **Step 4: Commit.**

```bash
git add scripts/build-og-image.mjs client/public/og-image.png
git commit -m "feat(brand): generate 1200x630 OG image for link previews"
```

---

### Task 17: Update HTML metadata

**Files:**
- Modify: `client/index.html`

- [ ] **Step 1: Replace the icon + manifest + OG image lines.**

In [client/index.html](../../../client/index.html), find the existing `<link rel="icon"…>`, `<link rel="apple-touch-icon"…>`, and `<meta property="og:image"…>` lines.

Replace this existing block:
```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
```
with:
```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png" />
    <link rel="manifest" href="/manifest.json" />
```

Find:
```html
    <meta property="og:image" content="/apple-touch-icon.svg" />
```
Replace with:
```html
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:image" content="/og-image.png" />
```

- [ ] **Step 2: Smoke test the dev server picks up the new files.**

In a browser, visit:
- `http://localhost:5173/manifest.json` → expect JSON manifest
- `http://localhost:5173/icon-192.png` → expect 192×192 PNG
- `http://localhost:5173/og-image.png` → expect 1200×630 OG image

- [ ] **Step 3: Production build smoke.**

```bash
npm run build
ls client/dist/ | grep -E "manifest\.json|favicon-|icon-|og-image|maskable"
```
Expected: all 9 generated files copied into `client/dist/`. The `prebuild` ran via the root script chain.

- [ ] **Step 4: Commit.**

```bash
git add client/index.html
git commit -m "feat(brand): wire manifest + multi-size favicons + 1200x630 og:image"
```

---

## Phase D — Verification (Task 18)

### Task 18: Cross-cutting smoke + Lighthouse + cross-viewport check

**Files:** none modified. Verification only.

- [ ] **Step 1: Re-run both service verification scripts.**

```bash
node scripts/verify/recent-wins.mjs
node scripts/verify/public-stats.mjs
```
Expected: both exit with `0 failed`.

- [ ] **Step 2: Curl all four new public surfaces with the dev server up.**

```bash
curl -sS http://127.0.0.1:4000/api/bet/recent-wins | jq '.wins | length'   # 15
curl -sS http://127.0.0.1:4000/api/stats/public | jq                       # 4 keys
curl -sS http://localhost:5173/manifest.json | jq '.name'                  # "Oddsify — Premium Sports Betting"
curl -sS -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" http://localhost:5173/og-image.png  # 200 image/png N
```

- [ ] **Step 3: Manual cross-viewport check.**

Open `http://localhost:5173/`. In Chrome DevTools → Device Toolbar, switch through:
- [ ] iPhone SE (375×667): WinnerTicker stacks vertically, StatsStrip is 2×2 grid, QuickBetStrip is horizontally scrollable
- [ ] iPad (768×1024): WinnerTicker becomes desktop marquee, StatsStrip stays 2×2 (≥768px shifts to 4-up)
- [ ] Desktop 1280×800: StatsStrip is 4-in-a-row, all sections aligned

- [ ] **Step 4: Reduce-motion check.**

In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" → reduce. Reload. Verify:
- [ ] WinnerTicker: no rotation on mobile, no marquee on desktop, static visible items
- [ ] StatsStrip: cards render with final values, no count-up animation
- [ ] No layout shift compared with the default state

- [ ] **Step 5: Lighthouse mobile audit.**

In Chrome DevTools → Lighthouse → Mobile, "Performance, Accessibility, Best Practices, SEO, PWA" → Analyze. Record:
- [ ] Performance score (target: no regression vs baseline)
- [ ] PWA: should now show "Installable" because manifest + icons are wired
- [ ] No new accessibility errors related to the three new components

If any score regressed, identify the cause (most likely candidates: new fetches on first paint blocking LCP — mitigation: defer the WinnerTicker fetch until after first paint via `requestIdleCallback`).

- [ ] **Step 6: Final stakepoint sweep.**

```bash
grep -rn "stakepoint" \
  --include="*.js" --include="*.jsx" --include="*.json" \
  --include="*.md" --include="*.html" --include="*.css" \
  --include="*.yaml" --include="*.yml" --include="*.svg" \
  2>/dev/null | grep -v node_modules | grep -v "docs/superpowers/specs/" | grep -v "docs/superpowers/plans/"
```
Expected: no output.

- [ ] **Step 7: Confirm clean working tree + final summary commit if anything was tweaked during verification.**

```bash
git status
git log --oneline -20
```
Expected: clean tree, ~17 commits added for this chunk in chronological order.

---

## Acceptance gates (final pass)

Mirror of the spec's acceptance gates. Tick when verified:

- [ ] `npm run dev` boots cleanly, no new console errors on homepage load.
- [ ] WinnerTicker shows ≥10 items; rotates on mobile, marquees on desktop.
- [ ] StatsStrip 4 cards visible, numbers > 0 (demo seed populates), count-up animates on first scroll into view.
- [ ] QuickBetStrip shows up to 6 football matches; tapping odds adds to slip; active state reflects slip.
- [ ] `curl /api/bet/recent-wins` returns valid JSON, `wins.length > 0`.
- [ ] `curl /api/stats/public` returns all 4 keys.
- [ ] `client/dist/manifest.json` + favicon PNGs + `og-image.png` present after build.
- [ ] `<link rel="manifest">` resolves at deploy.
- [ ] `grep -rn stakepoint` outside spec/plan files = zero.
- [ ] Lighthouse mobile: no regression vs baseline; PWA score improves.
- [ ] Tested at 360px, 768px, 1280px.
- [ ] `prefers-reduced-motion` honored.

---

## Total commits expected

17 commits across the four phases (one per task). If any task ends up doing more than its scope, split the commit; if any commit is amended for cleanup, that's fine but `git log --oneline` should stay readable and one-line-summarizable.
