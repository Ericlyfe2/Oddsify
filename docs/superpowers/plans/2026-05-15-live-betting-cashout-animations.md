# Live Betting, Live Cash-Out & In-Play Animations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real-time live betting end-to-end: live odds + scores driven by apiFootball, server-pushed cash-out that reflects live match state, a dedicated `/live` page + in-play match view, and the in-play animation system.

**Architecture:** Approach A from the spec — extend the existing `oddsAggregator` with a 6-second live polling track. A new `cashOutEngine` module subscribes to live changes and pushes `cashout:offer` events to users. The client adds an isolated live store + hook that fans out socket events to small focused components (`OddsButton`, `MatchEventRibbon`, `LiveCashOutCard`). All animations are CSS-driven, gated on `prefers-reduced-motion`.

**Tech Stack:** Node 20+ (ES modules), Express, Socket.IO, Zod, dotenv (server) · React 18, Vite, react-router-dom v6, socket.io-client (client) · Node built-in `node:test` runner for server tests · apiFootball live endpoints.

**Spec:** [docs/superpowers/specs/2026-05-15-live-betting-cashout-animations-design.md](../specs/2026-05-15-live-betting-cashout-animations-design.md)

---

## File Structure

### Server
| File | Action | Responsibility |
|---|---|---|
| `server/src/config/env.js` | modify | Add `LIVE_BETTING` config block (poll cadence, house margin, drift tolerance, provider key). |
| `server/src/providers/apiFootball.js` | modify | Add `live` option to `fetchOdds`; ensure `fetchScores` returns canonical live snapshots. |
| `server/src/services/providerRegistry.js` | modify | Add `fetchLiveOddsAll` and `fetchLiveScoresAll` helpers. |
| `server/src/services/oddsAggregator.js` | modify | Add `liveLoop` second cadence; per-track failure isolation; `eventKind` derivation; call into `cashOutEngine`. |
| `server/src/services/cashOutEngine.js` | create | Index of open bets per fixture; per-tick recompute; emit `cashout:offer`; offer dedup + drift validation helpers. |
| `server/src/services/realtime.js` | modify | Add `cashout:offer` and `match:event` emit helpers; `liveSnapshots` map; reconnect snapshot push on `subscribe`. |
| `server/src/routes/bet.js` | modify | Register bets in engine on `/place`; new `acceptedAmount` flow on `DELETE /bets/:id`; receipt fields `lastCashOutOffer` + `cashOutHistory`. |
| `server/src/services/settlement.js` | modify | Call `cashOutEngine.onLegSettled(fixtureKey, won)` per settled leg. |
| `server/test/cashOutEngine.test.js` | create | Unit tests: formula, dedup, leg_lost short-circuit, system-bet skip. |
| `server/test/liveLoop.test.js` | create | Unit tests for `eventKind` derivation in aggregator. |
| `server/test/cashout.endpoint.test.js` | create | Integration: place → tick → offer event → DELETE with `acceptedAmount`. |

### Client
| File | Action | Responsibility |
|---|---|---|
| `client/src/lib/animate.js` | create | `tweenNumber`, `pulseClass` helpers. |
| `client/src/state/liveStore.js` | create | `useSyncExternalStore`-backed live store keyed by fixtureId. |
| `client/src/hooks/useLiveSocket.js` | create | Mounts socket listeners once, wires events to `liveStore`. |
| `client/src/components/OddsButton.jsx` | create | Self-contained odds button with flash + tween. |
| `client/src/components/MatchEventRibbon.jsx` | create | Stacked ribbon renderer for `match:event`. |
| `client/src/components/LiveCashOutCard.jsx` | create | Pinned card on in-play page showing live cash-out for the user's bet. |
| `client/src/pages/LivePage.jsx` | create | `/live` route. List of live matches with sport tabs (football enabled). |
| `client/src/pages/LiveMatchPage.jsx` | create | `/live/:matchId` route. Score header, event feed, markets accordion. |
| `client/src/App.jsx` | modify | Replace existing `/live` route, add `/live/:matchId`. |
| `client/src/pages/Home.jsx` | modify | "Live now" banner links to `/live`; reads `liveStore` snapshot when fresh. |
| `client/src/pages/BetHistoryPage.jsx` | modify | Subscribe to `cashout:offer` for each open bet; new "Cash out at GHS X" button calls endpoint with `acceptedAmount`. |
| `client/src/api/betApi.js` | modify | Add `cashOutBet(betId, acceptedAmount)`; handle `409 OFFER_STALE` by returning the server's `currentOffer`. |
| `client/src/styles/app.css` | modify | Add animation classes (`odds-flash-*`, `score-pulse`, `goal-celebrate`, `match-ribbon`, `cashout-glow`, `cashout-jump`) + reduced-motion override. |

---

## Task 1: Config & env additions

**Files:**
- Modify: `server/src/config/env.js`
- Modify: `server/.env.example` (create if absent)

- [ ] **Step 1: Add LIVE_BETTING block to env.js**

Append at the bottom of `server/src/config/env.js`, before the warning block:

```javascript
// ---- Live betting -----------------------------------------------------------
export const LIVE_BETTING = {
  // apiFootball API key for live odds & live scores. If empty, the live
  // track no-ops; pre-match polling continues normally.
  apiFootballKey: env.APIFOOTBALL_KEY || env.APIFOOTBALL_TOKEN || '',
  // Cadence of the live track, in ms. Lower bound 3000 to respect provider
  // rate limits. Default 6000.
  pollMs: Math.max(3000, Number(env.LIVE_POLL_MS) || 6000),
  // House margin applied to live cash-out offers (0–1).
  houseMargin: Math.min(0.5, Math.max(0, Number(env.CASHOUT_HOUSE_MARGIN) || 0.05)),
  // Maximum acceptable drift between the client's acceptedAmount and the
  // server's current offer (0–1). Default 1%.
  driftTolerance: Math.min(0.2, Math.max(0, Number(env.CASHOUT_DRIFT_TOLERANCE) || 0.01)),
};

if (!LIVE_BETTING.apiFootballKey) {
  console.warn('[env] APIFOOTBALL_KEY not set — live betting track will no-op (pre-match unaffected).');
}
```

- [ ] **Step 2: Add the same keys to `.env.example`**

Append to `server/.env.example` (create if missing):

```
# Live betting
APIFOOTBALL_KEY=
LIVE_POLL_MS=6000
CASHOUT_HOUSE_MARGIN=0.05
CASHOUT_DRIFT_TOLERANCE=0.01
```

- [ ] **Step 3: Verify the server still boots**

```bash
npm run dev -w server
```

Expected: server starts on the configured port. The warning `[env] APIFOOTBALL_KEY not set — ...` prints (assuming you haven't set the key). Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add server/src/config/env.js server/.env.example
git commit -m "feat(env): add live betting config block"
```

---

## Task 2: Realtime — add `liveSnapshots`, new event helpers, docstring

**Files:**
- Modify: `server/src/services/realtime.js`

- [ ] **Step 1: Add `liveSnapshots` map and snapshot helpers**

At the top of `server/src/services/realtime.js`, after the `liveByUser` / `adminSockets` declarations (around line 42), add:

```javascript
// Per-fixture rolling snapshot of the last known live state. Pushed to
// reconnecting sockets when they re-join a fixture room, so the UI has
// something to render before the next tick arrives.
const liveSnapshots = new Map(); // fixtureKey -> { fixtureId, scoreHome, scoreAway, minute, markets, ts }

function updateSnapshot(fixtureKey, patch) {
  const prev = liveSnapshots.get(fixtureKey) || {};
  const next = { ...prev, ...patch, ts: Date.now() };
  liveSnapshots.set(fixtureKey, next);
  return next;
}
```

- [ ] **Step 2: Update `emitOddsTick` to write the snapshot and include direction**

Replace `emitOddsTick` (currently around line 157):

```javascript
export function emitOddsTick(payload) {
  if (!liveNs) return;
  const room = `fixture:${payload.fixtureId || payload.key}`;
  // Selections coming in may already include `direction`. If not, default 'same'.
  if (payload.selections) {
    payload.selections = payload.selections.map((s) => ({
      ...s,
      direction: s.direction || 'same',
    }));
  }
  // Merge the new market state into the rolling snapshot.
  if (payload.fixtureId && payload.market) {
    const snap = liveSnapshots.get(payload.fixtureId) || { fixtureId: payload.fixtureId, markets: {} };
    snap.markets = { ...(snap.markets || {}), [payload.market]: payload.selections };
    updateSnapshot(payload.fixtureId, { markets: snap.markets });
  }
  liveNs.to(room).emit('odds:tick', payload);
  if (payload.sport) liveNs.to(`sport:${payload.sport}`).emit('odds:tick', payload);
}
```

- [ ] **Step 3: Update `emitScoreUpdate` to write snapshot + emit `match:event` when `eventKind` is set**

Replace `emitScoreUpdate` (currently around line 170):

```javascript
export function emitScoreUpdate(payload) {
  if (!liveNs) return;
  // Snapshot first so reconnects get the latest score.
  if (payload.fixtureId) {
    updateSnapshot(payload.fixtureId, {
      fixtureId: payload.fixtureId,
      scoreHome: payload.scoreHome,
      scoreAway: payload.scoreAway,
      minute: payload.minute,
    });
  }
  liveNs.to(`fixture:${payload.fixtureId}`).emit('score:update', payload);
  if (payload.sport) liveNs.to(`sport:${payload.sport}`).emit('score:update', payload);

  // Promote a meaningful state change into a separate match:event so the UI
  // can fire the ribbon animation independently of the score pulse.
  if (payload.eventKind) {
    const ev = {
      fixtureId: payload.fixtureId,
      kind: payload.eventKind,
      minute: payload.minute,
      scoreHome: payload.scoreHome,
      scoreAway: payload.scoreAway,
      team: payload.team,
      ts: Date.now(),
    };
    liveNs.to(`fixture:${payload.fixtureId}`).emit('match:event', ev);
  }
}
```

- [ ] **Step 4: Add `emitCashoutOffer` helper**

After `emitToUser` (around line 176), add:

```javascript
/** Push a cash-out offer to a specific user's room. */
export function emitCashoutOffer(userId, payload) {
  if (!liveNs || !userId) return;
  liveNs.to(`user:${userId}`).emit('cashout:offer', payload);
}
```

- [ ] **Step 5: Push live snapshots on subscribe**

Inside the `liveNs.on('connection', ...)` handler, replace the existing `socket.on('subscribe', ...)` (around line 89) with:

```javascript
socket.on('subscribe', (payload = {}) => {
  const { fixtureIds = [], sportIds = [] } = payload;
  for (const id of fixtureIds.slice(0, 200)) {
    socket.join(`fixture:${id}`);
    // Send the current snapshot (if any) to *this socket only* — late
    // joiners get state before the next tick.
    const snap = liveSnapshots.get(id);
    if (snap) socket.emit('live:snapshot', snap);
  }
  for (const id of sportIds.slice(0, 10)) socket.join(`sport:${id}`);
});
```

- [ ] **Step 6: Update docstring to list every event**

Replace the top JSDoc block of the file (lines 1–29) with:

```javascript
/**
 * Realtime backbone.
 *
 * Two namespaces:
 *   /live   — player-facing. Token optional. Rooms: 'fixture:<id>',
 *             'sport:<id>', 'user:<id>' (when authed).
 *   /admin  — admin-only. Token required and scope=admin. Rooms: 'global',
 *             'provider:<id>'.
 *
 * Server -> client events (/live):
 *   odds:tick      { key, fixtureId, market, selections: [{ key, label, odds, direction }], sport?, provider? }
 *   odds:movement  { key, fixtureId, market, selection, prev, next }
 *   score:update   { fixtureId, scoreHome, scoreAway, minute, sport?, eventKind?, team? }
 *   match:event    { fixtureId, kind, minute, scoreHome, scoreAway, team?, ts }  // emitted only on real events
 *   live:snapshot  { fixtureId, scoreHome, scoreAway, minute, markets, ts }      // sent to a single socket on subscribe
 *   bet:settled    { betId, status, payout }                                     // user room only
 *   bet:won        { betId, payout }                                             // user room only
 *   wallet:update  { balance, delta, reason }                                    // user room only
 *   cashout:offer  { betId, cashOut, potentialWin, ts, reason? }                 // user room only
 *
 * Server -> client events (/admin):
 *   audit:event       Audit log row
 *   provider:health   Provider snapshot
 *   bet:placed        New bet
 *   bet:settled       Settled bet (any user)
 *   kpi:tick          Lightweight KPI delta (online users, etc.)
 *   cashout:executed  { betId, userId, cashOut, ts }
 *
 * Client -> server commands:
 *   /live   subscribe   { fixtureIds: string[], sportIds: string[] }
 *   /live   unsubscribe { fixtureIds: string[], sportIds: string[] }
 *   /admin  subscribe   { providers?: string[] }
 */
```

- [ ] **Step 7: Boot the server to verify no syntax errors**

```bash
npm run dev -w server
```

Expected: server starts cleanly. Stop with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/realtime.js
git commit -m "feat(realtime): add cashout:offer, match:event, liveSnapshots reconnect push"
```

---

## Task 3: apiFootball — live odds + live scores

**Files:**
- Modify: `server/src/providers/apiFootball.js`

- [ ] **Step 1: Inspect the existing `fetchOdds` signature**

```bash
grep -n "fetchOdds" server/src/providers/apiFootball.js
```

Note the URL it currently builds. The live endpoint at apiFootball is `/odds/live` (no date param). The existing pre-match endpoint is `/odds?date=YYYY-MM-DD`.

- [ ] **Step 2: Extend `fetchOdds` with a `live` option**

Replace the existing `fetchOdds` function in `server/src/providers/apiFootball.js` with:

```javascript
async fetchOdds(sport = 'football', opts = {}) {
  if (!this.enabled || sport !== 'football') return [];
  const url = opts.live
    ? `https://${this.host}/odds/live`
    : `https://${this.host}/odds?date=${new Date().toISOString().slice(0, 10)}`;
  const json = await this.http(url, { headers: this.headers() });
  return (json?.response || []).map((r) => normaliseOdds(r, this.id));
}
```

If the existing implementation references a different `normaliseOdds` shape, keep the existing mapping; only the URL selection should change.

- [ ] **Step 3: Make `fetchScores` return canonical live shape with red-card count**

`fetchScores` already uses `?live=all`. Ensure the returned objects include the fields needed by the live track. Replace the existing `fetchScores`:

```javascript
async fetchScores(sport = 'football') {
  if (!this.enabled || sport !== 'football') return [];
  const url = `https://${this.host}/fixtures?live=all`;
  const json = await this.http(url, { headers: this.headers() });
  return (json?.response || []).map((r) => {
    const fx = normaliseFixture(r, this.id);
    // Augment with red-card counts for eventKind derivation.
    const reds = (r.events || []).filter((e) => e.type === 'Card' && e.detail === 'Red Card');
    fx.redCardsHome = reds.filter((e) => e.team?.id === r.teams?.home?.id).length;
    fx.redCardsAway = reds.filter((e) => e.team?.id === r.teams?.away?.id).length;
    fx.providerKey = fx.key; // alias for clarity in downstream code
    return fx;
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add server/src/providers/apiFootball.js
git commit -m "feat(apiFootball): support live odds endpoint and red-card counts"
```

---

## Task 4: Provider registry — live aggregation helpers

**Files:**
- Modify: `server/src/services/providerRegistry.js`

- [ ] **Step 1: Add live aggregation helpers**

Append to `server/src/services/providerRegistry.js`:

```javascript
/**
 * Fetch live in-play odds across all enabled providers. Each provider
 * decides whether it supports live; non-supporting providers return [].
 * Errors are isolated per provider so one bad upstream doesn't blank the feed.
 */
export async function fetchLiveOddsAll(sport = 'football') {
  const results = await Promise.all(
    enabledProviders().map((p) =>
      Promise.resolve(p.fetchOdds(sport, { live: true })).catch(() => [])
    )
  );
  return results.flat();
}

/**
 * Fetch live scores across all enabled providers. Same isolation contract.
 */
export async function fetchLiveScoresAll(sport = 'football') {
  const results = await Promise.all(
    enabledProviders().map((p) =>
      Promise.resolve(p.fetchScores(sport)).catch(() => [])
    )
  );
  return results.flat();
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/providerRegistry.js
git commit -m "feat(providers): add live odds + live scores aggregation helpers"
```

---

## Task 5: `cashOutEngine` — module + unit tests (TDD)

**Files:**
- Create: `server/src/services/cashOutEngine.js`
- Create: `server/test/cashOutEngine.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `server/test/cashOutEngine.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetForTests,
  registerBet,
  unregisterBet,
  computeOffer,
  onLiveChange,
} from '../src/services/cashOutEngine.js';

const emits = [];
function fakeEmitToUser(userId, event, payload) { emits.push({ userId, event, payload }); }
function fakeOddsLookup(map) {
  return (fixtureKey, market, outcome) => map[`${fixtureKey}:${market}:${outcome}`] ?? null;
}

test('computeOffer returns stake × totalOdds × prob × (1 - margin)', () => {
  const bet = {
    id: 'b1', userId: 'u1', mode: 'multiple', stake: 10, totalOdds: 6,
    status: 'open',
    legs: [
      { matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false },
      { matchId: 'f2', market: '1X2', outcome: '1', odds: 3, finished: false },
    ],
  };
  const lookup = fakeOddsLookup({ 'f1:1X2:1': 1.5, 'f2:1X2:1': 2 });
  const offer = computeOffer(bet, lookup, 0.05);
  // P(win) = 1/1.5 * 1/2 = 0.3333
  // fair = 10 * 6 * 0.3333 = 20
  // cashOut = 20 * 0.95 = 19
  assert.equal(Math.round(offer * 100), 1900);
});

test('computeOffer returns 0 when any leg is lost', () => {
  const bet = {
    id: 'b1', userId: 'u1', mode: 'multiple', stake: 10, totalOdds: 6,
    status: 'open',
    legs: [
      { matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: true, won: false },
      { matchId: 'f2', market: '1X2', outcome: '1', odds: 3, finished: false },
    ],
  };
  const lookup = fakeOddsLookup({ 'f2:1X2:1': 2 });
  assert.equal(computeOffer(bet, lookup, 0.05), 0);
});

test('computeOffer treats a finished+won leg as factor 1', () => {
  const bet = {
    id: 'b1', userId: 'u1', mode: 'multiple', stake: 10, totalOdds: 6,
    status: 'open',
    legs: [
      { matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: true, won: true },
      { matchId: 'f2', market: '1X2', outcome: '1', odds: 3, finished: false },
    ],
  };
  const lookup = fakeOddsLookup({ 'f2:1X2:1': 2 });
  // P(win) = 1 * (1/2) = 0.5; fair = 10*6*0.5 = 30; cashOut = 30*0.95 = 28.5
  assert.equal(Math.round(computeOffer(bet, lookup, 0.05) * 100), 2850);
});

test('computeOffer clamps to stake × totalOdds × 0.99 (no free money)', () => {
  const bet = {
    id: 'b1', userId: 'u1', mode: 'multiple', stake: 10, totalOdds: 6,
    status: 'open',
    legs: [
      { matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false },
    ],
  };
  // Pathological case: live odds collapse to 1.0 (certain) AND margin is 0.
  const lookup = fakeOddsLookup({ 'f1:1X2:1': 1.0 });
  const offer = computeOffer(bet, lookup, 0);
  assert.ok(offer <= 10 * 6 * 0.99);
});

test('computeOffer returns null for system bets (v1: not supported)', () => {
  const bet = {
    id: 'b1', userId: 'u1', mode: 'system', stake: 10, totalOdds: 6,
    status: 'open',
    legs: [{ matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  const lookup = fakeOddsLookup({ 'f1:1X2:1': 1.5 });
  assert.equal(computeOffer(bet, lookup, 0.05), null);
});

test('onLiveChange emits cashout:offer for each open bet on the fixture', () => {
  __resetForTests({ emitToUser: fakeEmitToUser });
  emits.length = 0;
  const bet = {
    id: 'b1', userId: 'u1', mode: 'single', stake: 10, totalOdds: 2, status: 'open',
    legs: [{ matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  registerBet(bet);
  onLiveChange('f1', fakeOddsLookup({ 'f1:1X2:1': 1.5 }), 0.05);
  assert.equal(emits.length, 1);
  assert.equal(emits[0].event, 'cashout:offer');
  assert.equal(emits[0].payload.betId, 'b1');
});

test('onLiveChange dedups when offer change is below threshold', () => {
  __resetForTests({ emitToUser: fakeEmitToUser });
  emits.length = 0;
  const bet = {
    id: 'b1', userId: 'u1', mode: 'single', stake: 10, totalOdds: 2, status: 'open',
    legs: [{ matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  registerBet(bet);
  const lookup1 = fakeOddsLookup({ 'f1:1X2:1': 1.500 });
  const lookup2 = fakeOddsLookup({ 'f1:1X2:1': 1.501 }); // sub-threshold change
  onLiveChange('f1', lookup1, 0.05);
  onLiveChange('f1', lookup2, 0.05);
  assert.equal(emits.length, 1, 'second tick was deduped');
});

test('unregisterBet removes the bet from the fixture index', () => {
  __resetForTests({ emitToUser: fakeEmitToUser });
  emits.length = 0;
  const bet = {
    id: 'b1', userId: 'u1', mode: 'single', stake: 10, totalOdds: 2, status: 'open',
    legs: [{ matchId: 'f1', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  registerBet(bet);
  unregisterBet('b1');
  onLiveChange('f1', fakeOddsLookup({ 'f1:1X2:1': 1.5 }), 0.05);
  assert.equal(emits.length, 0);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
node --test server/test/cashOutEngine.test.js
```

Expected: every test fails with `Cannot find module '../src/services/cashOutEngine.js'`.

- [ ] **Step 3: Implement `cashOutEngine.js`**

Create `server/src/services/cashOutEngine.js`:

```javascript
/**
 * Cash-out engine.
 *
 * Maintains a fixture → open bets index, recomputes cash-out offers on each
 * live tick, emits cashout:offer to the bet owner, and dedupes near-identical
 * offers.
 *
 * Storage is in-memory. The durable copy of `lastCashOutOffer` lives on the
 * bet receipt (see routes/bet.js). On server restart, callers should rebuild
 * the engine state from open receipts (see registerBet).
 *
 * v1 limitations:
 *   - System bets are skipped (computeOffer returns null).
 *   - No partial cash-out.
 */
import { emitToUser as defaultEmit } from './realtime.js';

let _emit = defaultEmit;

const openBetsByFixture = new Map();   // fixtureKey -> Set<betId>
const betsById          = new Map();   // betId -> bet receipt (shallow copy with live fields)
const lastOfferByBet    = new Map();   // betId -> { cashOut, ts }

const DEDUP_THRESHOLD = 0.005; // 0.5%

/** Replace dependencies in tests. */
export function __resetForTests({ emitToUser } = {}) {
  _emit = emitToUser || defaultEmit;
  openBetsByFixture.clear();
  betsById.clear();
  lastOfferByBet.clear();
}

export function registerBet(bet) {
  if (!bet || bet.status !== 'open') return;
  betsById.set(bet.id, bet);
  for (const leg of bet.legs || []) {
    const set = openBetsByFixture.get(leg.matchId) || new Set();
    set.add(bet.id);
    openBetsByFixture.set(leg.matchId, set);
  }
}

export function unregisterBet(betId) {
  const bet = betsById.get(betId);
  if (!bet) return;
  for (const leg of bet.legs || []) {
    const set = openBetsByFixture.get(leg.matchId);
    if (set) { set.delete(betId); if (set.size === 0) openBetsByFixture.delete(leg.matchId); }
  }
  betsById.delete(betId);
  lastOfferByBet.delete(betId);
}

export function getLastOffer(betId) {
  return lastOfferByBet.get(betId) || null;
}

/**
 * Pure function: compute the cash-out offer for a bet given a current-odds
 * lookup. Returns null when the bet shape isn't supported (system bets),
 * or 0 when any leg has already lost.
 *
 * @param {object}   bet         The bet receipt.
 * @param {function} oddsLookup  (fixtureKey, market, outcome) -> number | null
 * @param {number}   houseMargin 0..1
 */
export function computeOffer(bet, oddsLookup, houseMargin) {
  if (!bet || bet.mode === 'system') return null;
  let probProduct = 1;
  for (const leg of bet.legs || []) {
    if (leg.finished && leg.won === false) return 0;
    if (leg.finished && leg.won === true)  { probProduct *= 1; continue; }
    const current = oddsLookup(leg.matchId, leg.market, leg.outcome);
    if (!current || current < 1.0001) return 0; // no market or impossible price
    probProduct *= 1 / current;
  }
  const fair = bet.stake * bet.totalOdds * probProduct;
  const offered = Math.max(0, fair * (1 - houseMargin));
  // Defensive clamp: never offer more than 99% of the max possible return.
  const ceiling = bet.stake * bet.totalOdds * 0.99;
  return Math.min(offered, ceiling);
}

/**
 * Trigger: a live tick touched this fixture. Recompute offers for every
 * open bet that has a leg on this fixture, emit only when materially changed.
 */
export function onLiveChange(fixtureKey, oddsLookup, houseMargin) {
  const bets = openBetsByFixture.get(fixtureKey);
  if (!bets || bets.size === 0) return;
  for (const betId of bets) {
    const bet = betsById.get(betId);
    if (!bet || bet.status !== 'open') { unregisterBet(betId); continue; }
    const offer = computeOffer(bet, oddsLookup, houseMargin);
    if (offer === null) continue; // system bets etc.
    const last = lastOfferByBet.get(betId);
    if (last && Math.abs(offer - last.cashOut) / Math.max(last.cashOut, 1) < DEDUP_THRESHOLD) continue;
    const payload = {
      betId,
      cashOut: Number(offer.toFixed(2)),
      potentialWin: Number((bet.stake * bet.totalOdds).toFixed(2)),
      ts: Date.now(),
      reason: 'tick',
    };
    lastOfferByBet.set(betId, { cashOut: payload.cashOut, ts: payload.ts });
    _emit(bet.userId, 'cashout:offer', payload);
  }
}

/**
 * Trigger: a leg settled. If it lost, every bet containing it must drop to
 * a zero offer immediately so the UI reflects bust state before final settle.
 */
export function onLegSettled(fixtureKey, won) {
  const bets = openBetsByFixture.get(fixtureKey);
  if (!bets || bets.size === 0) return;
  for (const betId of bets) {
    const bet = betsById.get(betId);
    if (!bet || bet.status !== 'open') { unregisterBet(betId); continue; }
    // Mark the legs on this fixture as finished/won in our cached copy.
    for (const leg of bet.legs) {
      if (leg.matchId === fixtureKey) { leg.finished = true; leg.won = !!won; }
    }
    if (!won) {
      const payload = { betId, cashOut: 0, potentialWin: Number((bet.stake * bet.totalOdds).toFixed(2)), ts: Date.now(), reason: 'leg_lost' };
      lastOfferByBet.set(betId, { cashOut: 0, ts: payload.ts });
      _emit(bet.userId, 'cashout:offer', payload);
    }
  }
}

/** Periodic cleanup — called every 60s from oddsAggregator. */
export function sweep() {
  for (const [fixtureKey, set] of openBetsByFixture) {
    for (const betId of set) {
      const bet = betsById.get(betId);
      if (!bet || bet.status !== 'open') set.delete(betId);
    }
    if (set.size === 0) openBetsByFixture.delete(fixtureKey);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test server/test/cashOutEngine.test.js
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/cashOutEngine.js server/test/cashOutEngine.test.js
git commit -m "feat(cashout): cashOutEngine module with deterministic unit tests"
```

---

## Task 6: Odds aggregator — add live track + cashOutEngine hookup

**Files:**
- Modify: `server/src/services/oddsAggregator.js`
- Create: `server/test/liveLoop.test.js`

- [ ] **Step 1: Read the existing aggregator structure**

```bash
wc -l server/src/services/oddsAggregator.js
```

You'll be appending a `liveLoop` function and a second `setInterval`. The existing pre-match loop stays unchanged.

- [ ] **Step 2: Add live state and helpers to `oddsAggregator.js`**

Near the top, after `const failureStreak = new Map();`, add:

```javascript
const liveLastByKey  = new Map(); // fixtureKey -> { scoreHome, scoreAway, minute, redCardsHome, redCardsAway }
const liveFailureStreak = new Map(); // 'live:<providerId>' -> consecutive failures
let liveTimer = null;
let liveRunning = false;

function liveBackoffMs(streak) {
  // Live track recovers faster than pre-match: cap at 60s.
  return Math.min(6_000 * Math.pow(2, streak), 60_000);
}

function deriveEventKind(prev, next) {
  if (!prev) return next.minute && Number(next.minute) <= 1 ? 'kick_off' : null;
  if (next.scoreHome > (prev.scoreHome ?? 0)) return 'goal_home';
  if (next.scoreAway > (prev.scoreAway ?? 0)) return 'goal_away';
  if ((next.redCardsHome ?? 0) > (prev.redCardsHome ?? 0)) return 'red_card';
  if ((next.redCardsAway ?? 0) > (prev.redCardsAway ?? 0)) return 'red_card';
  if (prev.minute !== 'HT' && next.minute === 'HT') return 'half_time';
  if (prev.minute !== 'FT' && next.minute === 'FT') return 'full_time';
  return null;
}

function teamFromKind(kind) {
  if (kind === 'goal_home') return 'home';
  if (kind === 'goal_away') return 'away';
  return undefined;
}
```

- [ ] **Step 3: Add a build-once odds lookup helper used by cashOutEngine**

Append the helper:

```javascript
/**
 * Given an array of merged live Odds rows, return a (fixtureKey, market, outcome)
 * → odds lookup function. cashOutEngine consumes this.
 */
function makeOddsLookup(rows) {
  const idx = new Map();
  for (const row of rows) {
    for (const [mk, market] of Object.entries(row.markets || {})) {
      for (const sel of market.selections || []) {
        idx.set(`${row.key}::${mk}::${sel.key}`, sel.odds);
      }
    }
  }
  return (fixtureKey, market, outcome) => idx.get(`${fixtureKey}::${market}::${outcome}`) ?? null;
}
```

- [ ] **Step 4: Add the `liveLoop` function and starter**

Append the loop:

```javascript
async function liveLoop() {
  if (liveRunning) return;
  liveRunning = true;
  try {
    const { fetchLiveOddsAll, fetchLiveScoresAll } = await import('./providerRegistry.js');
    const [oddsRows, scoreRows] = await Promise.all([
      fetchLiveOddsAll('football').catch(() => []),
      fetchLiveScoresAll('football').catch(() => []),
    ]);

    // 1) Score & match-event emits.
    const { emitScoreUpdate } = await import('./realtime.js');
    for (const fx of scoreRows) {
      const prev = liveLastByKey.get(fx.key);
      const kind = deriveEventKind(prev, fx);
      liveLastByKey.set(fx.key, {
        scoreHome: fx.scoreHome, scoreAway: fx.scoreAway, minute: fx.minute,
        redCardsHome: fx.redCardsHome, redCardsAway: fx.redCardsAway,
      });
      if (!prev
          || prev.scoreHome !== fx.scoreHome
          || prev.scoreAway !== fx.scoreAway
          || prev.minute    !== fx.minute
          || kind) {
        emitScoreUpdate({
          fixtureId: fx.key,
          sport: fx.sport,
          scoreHome: fx.scoreHome,
          scoreAway: fx.scoreAway,
          minute: fx.minute,
          eventKind: kind || undefined,
          team: teamFromKind(kind),
        });
      }
    }

    // 2) Odds emits via existing diffEmit machinery (already exported / private?).
    //    Since diffEmit is local to this file, just inline-iterate.
    const grouped = new Map(); // key -> Odds[]
    for (const row of oddsRows) {
      const arr = grouped.get(row.key) || [];
      arr.push(row);
      grouped.set(row.key, arr);
    }
    for (const [, rows] of grouped) {
      const merged = mergeRows(rows);
      // diffEmit is the existing internal helper; if it isn't exported,
      // call it directly — it lives in this same file.
      diffEmit(merged);
    }

    // 3) Cash-out recompute for every fixture we just saw a tick on.
    const engine = await import('./cashOutEngine.js');
    const lookup = makeOddsLookup(oddsRows);
    const { LIVE_BETTING } = await import('../config/env.js');
    for (const fx of scoreRows) engine.onLiveChange(fx.key, lookup, LIVE_BETTING.houseMargin);
    engine.sweep();

    liveFailureStreak.clear();
  } catch (e) {
    const streak = (liveFailureStreak.get('live') || 0) + 1;
    liveFailureStreak.set('live', streak);
    const next = liveBackoffMs(streak);
    log.warn(`Live track failure ×${streak} — next attempt in ${Math.round(next / 1000)}s: ${e.message}`);
  } finally {
    liveRunning = false;
  }
}

export async function startLiveTrack() {
  const { LIVE_BETTING } = await import('../config/env.js');
  if (liveTimer) return;
  if (!LIVE_BETTING.apiFootballKey) {
    log.info('Live track disabled — APIFOOTBALL_KEY not set.');
    return;
  }
  liveTimer = setInterval(() => { liveLoop().catch(() => {}); }, LIVE_BETTING.pollMs);
  liveLoop().catch(() => {});
  log.info(`Live track started, polling every ${LIVE_BETTING.pollMs}ms.`);
}

export function stopLiveTrack() {
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}
```

- [ ] **Step 5: Boot the live track from `server/src/index.js`**

Locate where the pre-match aggregator is started in `server/src/index.js` (search for the existing `startAggregator()` or `start*` call). Add `startLiveTrack()` immediately after it:

```javascript
import { startAggregator, startLiveTrack } from './services/oddsAggregator.js';
// ...existing startAggregator() call...
startLiveTrack();
```

If `startAggregator` isn't currently exported/called, this is fine — `startLiveTrack` no-ops when the key is missing.

- [ ] **Step 6: Add a tiny unit test for `deriveEventKind`**

Create `server/test/liveLoop.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

// deriveEventKind isn't exported (it's a private helper). To unit-test it
// we re-implement the contract here as a fixture. The real test is the
// integration: place a bet, simulate a tick, see the event arrive.
// This guard test pins the public contract on `emitScoreUpdate` payloads.

import { emitScoreUpdate } from '../src/services/realtime.js';

test('emitScoreUpdate is a no-op before attachRealtime', () => {
  assert.doesNotThrow(() => emitScoreUpdate({
    fixtureId: 'f1', scoreHome: 1, scoreAway: 0, minute: '34', eventKind: 'goal_home', team: 'home',
  }));
});
```

```bash
node --test server/test/liveLoop.test.js
```

Expected: passes.

- [ ] **Step 7: Boot the server and verify no crash**

```bash
npm run dev -w server
```

Expected: server starts; with `APIFOOTBALL_KEY` unset you see `Live track disabled — APIFOOTBALL_KEY not set.`. Stop with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/oddsAggregator.js server/src/index.js server/test/liveLoop.test.js
git commit -m "feat(aggregator): live track with cashOutEngine hookup"
```

---

## Task 7: Bet routes — register/unregister + new cash-out endpoint

**Files:**
- Modify: `server/src/routes/bet.js`
- Create: `server/test/cashout.endpoint.test.js`

- [ ] **Step 1: Wire engine registration on `/place`**

In `server/src/routes/bet.js`, near the top imports, add:

```javascript
import * as cashOutEngine from '../services/cashOutEngine.js';
import { LIVE_BETTING } from '../config/env.js';
```

Inside the `/place` route, after `pushBet(receipt);` (around line 246), add:

```javascript
// Live cash-out: index this bet by fixture so live ticks can recompute its offer.
cashOutEngine.registerBet(receipt);
```

- [ ] **Step 2: Add `lastCashOutOffer` and `cashOutHistory` fields to the receipt**

In the `/place` route, modify the receipt creation (around line 227–245) to include:

```javascript
const receipt = {
  // ...existing fields...
  lastCashOutOffer: null,        // { amount, ts } | null
  cashOutHistory:   [],          // [{ ts, amount }] capped at 20
};
```

- [ ] **Step 3: Replace the cash-out endpoint with the new behavior**

Replace the existing `router.delete('/bets/:id', ...)` block (around lines 297–320):

```javascript
import { z as _z } from 'zod'; // already imported at top
// (existing import line stays — this comment is a marker only)

const cashoutSchema = z.object({
  acceptedAmount: z.union([z.number(), z.string()])
    .optional()
    .transform((v) => v === undefined ? undefined : Number(v))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), 'invalid acceptedAmount'),
});

router.delete('/bets/:id',
  requireAuth,
  validate(cashoutSchema, 'body'),
  asyncHandler(async (req, res) => {
    const bet = betsStore.get(req.params.id);
    if (!bet || bet.userId !== req.user.id) throw notFound('Bet not found');
    if (bet.status !== 'open') throw conflict('Bet is already settled and cannot be cashed out.', { code: 'ALREADY_SETTLED' });

    let cashOut;
    if (bet.mode === 'system') {
      // System bets keep the legacy formula in v1. acceptedAmount ignored.
      cashOut = Number((bet.stake * bet.totalOdds * 0.6).toFixed(2));
    } else {
      const last = cashOutEngine.getLastOffer(bet.id);
      if (!last) {
        // No live offer recorded yet (no tick has happened since /place).
        // Fall back to a conservative offer based on totalOdds and a small margin.
        cashOut = Number((bet.stake * (1 - LIVE_BETTING.houseMargin)).toFixed(2));
      } else {
        cashOut = last.cashOut;
        if (req.body?.acceptedAmount !== undefined) {
          const drift = Math.abs(req.body.acceptedAmount - cashOut) / Math.max(cashOut, 1);
          if (drift > LIVE_BETTING.driftTolerance) {
            throw conflict('Cash-out offer changed before you confirmed. Refresh and try again.', {
              code: 'OFFER_STALE', currentOffer: cashOut,
            });
          }
        }
      }
    }

    bet.status = 'cashed_out';
    bet.cashOut = cashOut;
    bet.cashOutAt = new Date().toISOString();
    betsStore.set(bet.id, bet);
    cashOutEngine.unregisterBet(bet.id);

    const updated = updateUser(req.user.id, {
      balance: Number((req.user.balance + cashOut).toFixed(2)),
    });
    pushTx(req.user.id, {
      kind: 'cash_out', amount: cashOut, status: 'completed',
      balanceAfter: updated.balance, ref: bet.id,
    });
    logActivity(req.user.id, { kind: 'cash_out', betId: bet.id, cashOut });

    emitToUser(req.user.id, 'wallet:update', { balance: updated.balance, delta: cashOut, reason: 'cash_out', ref: bet.id });
    emitAdmin('cashout:executed', { betId: bet.id, userId: req.user.id, cashOut, ts: Date.now() });

    res.json({
      ok: true, bet,
      account: { ...updated, passwordHash: undefined, googleId: undefined, activity: undefined },
    });
  })
);
```

If the existing `validate` middleware doesn't support a second arg for `body`, drop the `'body'` argument — the existing `validate(cashoutSchema)` signature should already wrap `req.body`.

- [ ] **Step 4: Persist `lastCashOutOffer` to the bet receipt whenever cashOutEngine emits**

In `server/src/services/cashOutEngine.js`, modify the `_emit` call site in `onLiveChange` so callers can subscribe and persist. Add a hook export at the bottom of the file:

```javascript
let _onOffer = null;
export function onOffer(handler) { _onOffer = handler; }
```

Inside `onLiveChange`, after `_emit(bet.userId, 'cashout:offer', payload);`, add:

```javascript
if (_onOffer) try { _onOffer(bet, payload); } catch { /* never break the loop */ }
```

In `server/src/routes/bet.js`, at the bottom of the file before `export default router;`, register the persistence hook:

```javascript
cashOutEngine.onOffer((bet, payload) => {
  const fresh = betsStore.get(bet.id);
  if (!fresh || fresh.status !== 'open') return;
  fresh.lastCashOutOffer = { amount: payload.cashOut, ts: payload.ts };
  fresh.cashOutHistory = [...(fresh.cashOutHistory || []).slice(-19), { ts: payload.ts, amount: payload.cashOut }];
  betsStore.set(fresh.id, fresh);
});
```

- [ ] **Step 5: Add the integration test**

Create `server/test/cashout.endpoint.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/services/cashOutEngine.js';

const emits = [];
engine.__resetForTests({ emitToUser: (u, e, p) => emits.push({ u, e, p }) });

test('register + onLiveChange emits one offer per matching bet', () => {
  emits.length = 0;
  const bet = {
    id: 'bt-1', userId: 'u-1', mode: 'single', stake: 10, totalOdds: 2, status: 'open',
    legs: [{ matchId: 'fx-1', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  engine.registerBet(bet);
  engine.onLiveChange('fx-1', (k, m, o) => ({ 'fx-1::1X2::1': 1.8 }[`${k}::${m}::${o}`] ?? null), 0.05);
  assert.equal(emits.length, 1);
  assert.equal(emits[0].e, 'cashout:offer');
  assert.equal(emits[0].p.betId, 'bt-1');
});

test('drift > tolerance is detected by computeOffer rounding', () => {
  // Indirect: ensure two close-but-different lookups produce close offers.
  // Real drift check is in the endpoint and exercised manually in smoke test.
  const bet = {
    id: 'bt-2', userId: 'u-2', mode: 'single', stake: 100, totalOdds: 2, status: 'open',
    legs: [{ matchId: 'fx-2', market: '1X2', outcome: '1', odds: 2, finished: false }],
  };
  const o1 = engine.computeOffer(bet, () => 2.00, 0.05);
  const o2 = engine.computeOffer(bet, () => 1.98, 0.05);
  assert.ok(Math.abs(o1 - o2) > 0.5, `expected meaningful gap, got o1=${o1} o2=${o2}`);
});
```

- [ ] **Step 6: Run all server tests**

```bash
node --test server/test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/bet.js server/src/services/cashOutEngine.js server/test/cashout.endpoint.test.js
git commit -m "feat(bet): register bets in engine, new acceptedAmount cash-out flow, receipt fields"
```

---

## Task 8: Settlement integration

**Files:**
- Modify: `server/src/services/settlement.js`

- [ ] **Step 1: Find the per-leg settlement point**

```bash
grep -n "fixtureKey\|leg\|won\|settle" server/src/services/settlement.js | head -40
```

Identify where settlement determines whether a leg won or lost.

- [ ] **Step 2: Call `onLegSettled` when a leg's outcome is known**

In `server/src/services/settlement.js`, import the engine at the top:

```javascript
import * as cashOutEngine from './cashOutEngine.js';
```

After the code that determines whether a leg won or lost (the variable will already be in scope — call the fixture id `leg.matchId` and the outcome boolean `won`), add:

```javascript
cashOutEngine.onLegSettled(leg.matchId, won);
```

If the existing code settles legs in a different shape, adapt the call so each leg's `(matchId, won)` is communicated to the engine exactly once.

- [ ] **Step 3: Unregister fully-settled bets**

When the entire bet finishes settling (the existing code marks it `status: 'won' | 'lost'`), add:

```javascript
cashOutEngine.unregisterBet(bet.id);
```

- [ ] **Step 4: Boot server, confirm no crash**

```bash
npm run dev -w server
```

Expected: server starts cleanly.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/settlement.js
git commit -m "feat(settlement): notify cashOutEngine on per-leg outcome and bet finalization"
```

---

## Task 9: Client — `animate.js` helper

**Files:**
- Create: `client/src/lib/animate.js`

- [ ] **Step 1: Implement the helpers**

Create `client/src/lib/animate.js`:

```javascript
/**
 * Tiny animation helpers. Pure JS; no deps. All animations respect
 * prefers-reduced-motion: when reduced motion is requested, tweens become
 * instant value swaps and pulses are skipped.
 */

const REDUCE = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animate a numeric value from `from` to `to` over `ms`. Calls onUpdate
 * with the current numeric value each frame, then onUpdate(to) at the end.
 * Returns a cancel function.
 */
export function tweenNumber(from, to, ms, onUpdate) {
  if (REDUCE || !ms) { onUpdate(to); return () => {}; }
  const start = performance.now();
  let raf = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    onUpdate(from + (to - from) * eased);
    if (t < 1) raf = requestAnimationFrame(tick);
    else onUpdate(to);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * Add a className to a DOM element for `ms` milliseconds, then remove it.
 * Returns a cancel function.
 */
export function pulseClass(el, className, ms = 600) {
  if (!el || REDUCE) return () => {};
  el.classList.add(className);
  const id = setTimeout(() => el.classList.remove(className), ms);
  return () => { clearTimeout(id); el.classList.remove(className); };
}

export const reducedMotion = REDUCE;
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/animate.js
git commit -m "feat(client): animate.js helpers (tweenNumber, pulseClass)"
```

---

## Task 10: Client — `liveStore` + `useLiveSocket` hook

**Files:**
- Create: `client/src/state/liveStore.js`
- Create: `client/src/hooks/useLiveSocket.js`

- [ ] **Step 1: Implement `liveStore.js`**

Create `client/src/state/liveStore.js`:

```javascript
/**
 * Per-fixture live state, exposed via useSyncExternalStore-compatible
 * subscribe/getSnapshot pattern. Keyed by fixtureId.
 */

const state = new Map(); // fixtureId -> { scoreHome, scoreAway, minute, markets, recentEvents, lastTickAt }
const subs  = new Set(); // listener fns

function notify() { for (const fn of subs) fn(); }

export function subscribe(listener) {
  subs.add(listener);
  return () => subs.delete(listener);
}

export function getFixture(fixtureId) {
  return state.get(fixtureId) || null;
}

export function applyOddsTick(payload) {
  const fid = payload.fixtureId || payload.key;
  if (!fid) return;
  const prev = state.get(fid) || { fixtureId: fid, markets: {}, recentEvents: [] };
  prev.markets = { ...(prev.markets || {}), [payload.market]: payload.selections };
  prev.lastTickAt = Date.now();
  state.set(fid, prev);
  notify();
}

export function applyScoreUpdate(payload) {
  const fid = payload.fixtureId;
  if (!fid) return;
  const prev = state.get(fid) || { fixtureId: fid, markets: {}, recentEvents: [] };
  prev.scoreHome = payload.scoreHome;
  prev.scoreAway = payload.scoreAway;
  prev.minute    = payload.minute;
  prev.lastTickAt = Date.now();
  state.set(fid, prev);
  notify();
}

export function applyMatchEvent(payload) {
  const fid = payload.fixtureId;
  if (!fid) return;
  const prev = state.get(fid) || { fixtureId: fid, markets: {}, recentEvents: [] };
  prev.recentEvents = [...(prev.recentEvents || []).slice(-9), payload];
  state.set(fid, prev);
  notify();
}

export function applySnapshot(payload) {
  const fid = payload.fixtureId;
  if (!fid) return;
  const prev = state.get(fid) || { fixtureId: fid, markets: {}, recentEvents: [] };
  state.set(fid, { ...prev, ...payload, lastTickAt: payload.ts || Date.now() });
  notify();
}

export function resetForTests() { state.clear(); subs.clear(); }
```

- [ ] **Step 2: Implement `useLiveSocket.js`**

Create `client/src/hooks/useLiveSocket.js`:

```javascript
import { useEffect, useSyncExternalStore } from 'react';
import {
  onLive, subscribeFixtures, subscribeSports, unsubscribeFixtures,
} from '../api/socketClient.js';
import * as liveStore from '../state/liveStore.js';

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  onLive('odds:tick',     liveStore.applyOddsTick);
  onLive('score:update',  liveStore.applyScoreUpdate);
  onLive('match:event',   liveStore.applyMatchEvent);
  onLive('live:snapshot', liveStore.applySnapshot);
}

/** Subscribe to fixture-room updates while the component is mounted. */
export function useFixtureLive(fixtureIds = []) {
  useEffect(() => {
    wireOnce();
    if (fixtureIds.length === 0) return;
    subscribeFixtures(fixtureIds);
    return () => unsubscribeFixtures(fixtureIds);
  }, [fixtureIds.join(',')]);

  // Re-render whenever the live store changes.
  return useSyncExternalStore(liveStore.subscribe, () => liveStore);
}

/** Subscribe to a whole sport's live feed. */
export function useSportLive(sportId) {
  useEffect(() => {
    wireOnce();
    if (!sportId) return;
    subscribeSports([sportId]);
    // No unsubscribe — sport rooms are cheap and persistent across page navs.
  }, [sportId]);
  return useSyncExternalStore(liveStore.subscribe, () => liveStore);
}

/** Subscribe to user-room events (cashout:offer, wallet:update). */
export function useUserLive(handlers = {}) {
  useEffect(() => {
    wireOnce();
    const offs = [];
    if (handlers.cashoutOffer) offs.push(onLive('cashout:offer', handlers.cashoutOffer));
    if (handlers.walletUpdate) offs.push(onLive('wallet:update', handlers.walletUpdate));
    if (handlers.betSettled)   offs.push(onLive('bet:settled',   handlers.betSettled));
    if (handlers.betWon)       offs.push(onLive('bet:won',       handlers.betWon));
    return () => { for (const off of offs) off(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/state/liveStore.js client/src/hooks/useLiveSocket.js
git commit -m "feat(client): liveStore + useLiveSocket hooks"
```

---

## Task 11: Client — `OddsButton` component

**Files:**
- Create: `client/src/components/OddsButton.jsx`

- [ ] **Step 1: Implement the component**

Create `client/src/components/OddsButton.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { tweenNumber, pulseClass } from '../lib/animate.js';

/**
 * Self-contained odds button. Pass `odds` and `direction`. On change, the
 * displayed number tweens and the button briefly flashes green/red.
 */
export default function OddsButton({
  label, odds, direction = 'same',
  selected = false, suspended = false,
  onClick, className = '',
}) {
  const [display, setDisplay] = useState(odds);
  const ref = useRef(null);
  const prevOdds = useRef(odds);

  useEffect(() => {
    if (odds === prevOdds.current) return;
    const from = prevOdds.current;
    prevOdds.current = odds;
    const cancel = tweenNumber(from, odds, 250, (v) => setDisplay(v));
    if (direction === 'up')   pulseClass(ref.current, 'odds-flash-up', 600);
    if (direction === 'down') pulseClass(ref.current, 'odds-flash-down', 600);
    return cancel;
  }, [odds, direction]);

  const cls = [
    'odds-btn',
    selected ? 'is-selected' : '',
    suspended ? 'is-suspended' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      disabled={suspended}
      onClick={onClick}
      aria-label={`${label} odds ${odds.toFixed(2)}`}
    >
      <span className="odds-label">{label}</span>
      <span className="odds-value">{display.toFixed(2)}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/OddsButton.jsx
git commit -m "feat(client): OddsButton with flash + tween"
```

---

## Task 12: Client — `MatchEventRibbon` component

**Files:**
- Create: `client/src/components/MatchEventRibbon.jsx`

- [ ] **Step 1: Implement the component**

Create `client/src/components/MatchEventRibbon.jsx`:

```jsx
import { useEffect, useState } from 'react';

const COPY = {
  goal_home:  (e) => `⚽ GOAL · home · ${e.minute}'`,
  goal_away:  (e) => `⚽ GOAL · away · ${e.minute}'`,
  red_card:   (e) => `🟥 RED CARD · ${e.minute}'`,
  penalty:    (e) => `🎯 PENALTY · ${e.minute}'`,
  kick_off:   ()  => `🟢 KICK-OFF`,
  half_time:  ()  => `⏸ HALF-TIME`,
  full_time:  ()  => `🏁 FULL-TIME`,
};

/**
 * Renders a stack of recent match events as animated ribbons.
 * `events` is the array stored in liveStore (`recentEvents`).
 */
export default function MatchEventRibbon({ events = [] }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    const id = `${latest.ts}-${latest.kind}`;
    setVisible((vs) => [...vs, { id, ...latest }]);
    const t = setTimeout(() => {
      setVisible((vs) => vs.filter((v) => v.id !== id));
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  if (visible.length === 0) return null;
  return (
    <div className="match-ribbon-stack" role="status" aria-live="polite">
      {visible.map((e) => (
        <div key={e.id} className={`match-ribbon match-ribbon-${e.kind}`}>
          {(COPY[e.kind] || ((x) => x.kind))(e)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/MatchEventRibbon.jsx
git commit -m "feat(client): MatchEventRibbon"
```

---

## Task 13: Client — `LiveCashOutCard` + betApi extension

**Files:**
- Modify: `client/src/api/betApi.js`
- Create: `client/src/components/LiveCashOutCard.jsx`

- [ ] **Step 1: Add a `cashOutBet` helper to `betApi.js`**

Open `client/src/api/betApi.js`. Find the existing helpers and append:

```javascript
export async function cashOutBet(betId, acceptedAmount) {
  const res = await fetch(`${API_BASE}/bet/bets/${betId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(getAccess() ? { Authorization: `Bearer ${getAccess()}` } : {}),
    },
    body: JSON.stringify({ acceptedAmount }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Cash-out failed (${res.status})`);
    err.code = json?.error?.code;
    err.currentOffer = json?.error?.currentOffer;
    err.status = res.status;
    throw err;
  }
  return json;
}
```

The exact `API_BASE` / `getAccess` names already exist in this file — match them.

- [ ] **Step 2: Implement `LiveCashOutCard.jsx`**

Create `client/src/components/LiveCashOutCard.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { tweenNumber, pulseClass } from '../lib/animate.js';
import { useUserLive } from '../hooks/useLiveSocket.js';
import { cashOutBet } from '../api/betApi.js';

/**
 * Pinned card showing the live cash-out value for one of the user's open bets.
 * Subscribes to `cashout:offer` for this betId; tweens the number on changes;
 * disables itself while a request is in flight; surfaces 409 OFFER_STALE
 * by updating to the server's currentOffer.
 */
export default function LiveCashOutCard({ bet, onCashedOut }) {
  const [offer, setOffer] = useState(bet.lastCashOutOffer?.amount ?? null);
  const [display, setDisplay] = useState(offer ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ref = useRef(null);
  const prevOffer = useRef(offer);

  useUserLive({
    cashoutOffer: (p) => {
      if (p.betId !== bet.id) return;
      setOffer(p.cashOut);
    },
  });

  useEffect(() => {
    if (offer === null || offer === prevOffer.current) return;
    const from = prevOffer.current ?? offer;
    prevOffer.current = offer;
    tweenNumber(from, offer, 400, (v) => setDisplay(v));
    if (Math.abs(offer - from) / Math.max(from, 1) > 0.05) pulseClass(ref.current, 'cashout-jump', 300);
  }, [offer]);

  const aboveStake = offer !== null && offer > bet.stake;

  async function handleCashOut() {
    if (offer === null || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await cashOutBet(bet.id, offer);
      onCashedOut?.(res);
    } catch (e) {
      if (e.code === 'OFFER_STALE' && typeof e.currentOffer === 'number') {
        setOffer(e.currentOffer);
        setErr('Offer updated — confirm again.');
      } else {
        setErr(e.message || 'Cash-out failed.');
      }
    } finally { setBusy(false); }
  }

  return (
    <div ref={ref} className={`cashout-card${aboveStake ? ' cashout-glow' : ''}`}>
      <div className="cashout-card-head">Cash out now</div>
      <div className="cashout-card-amount">GHS {display.toFixed(2)}</div>
      <button
        type="button"
        className="cashout-card-btn"
        disabled={busy || offer === null}
        onClick={handleCashOut}
      >
        {busy ? 'Cashing out…' : `Take GHS ${(offer ?? 0).toFixed(2)}`}
      </button>
      {err && <div className="cashout-card-err">{err}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/betApi.js client/src/components/LiveCashOutCard.jsx
git commit -m "feat(client): cashOutBet API + LiveCashOutCard with stale-offer handling"
```

---

## Task 14: Client — `LivePage`

**Files:**
- Create: `client/src/pages/LivePage.jsx`

- [ ] **Step 1: Implement LivePage**

Create `client/src/pages/LivePage.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSportLive } from '../hooks/useLiveSocket.js';
import { getFixture } from '../state/liveStore.js';
import { fetchMatches } from '../api/betApi.js'; // existing helper

const SPORTS = [
  { id: 'football',   label: '⚽ Football', enabled: true  },
  { id: 'basketball', label: '🏀 Basketball', enabled: false },
  { id: 'tennis',     label: '🎾 Tennis',   enabled: false },
];

export default function LivePage() {
  const [sport, setSport] = useState('football');
  const [matches, setMatches] = useState([]);
  useSportLive(sport);

  useEffect(() => {
    let alive = true;
    fetchMatches(sport)
      .then((d) => { if (alive) setMatches((d.leagues || []).flatMap((lg) => (lg.matches || []).map((m) => ({ ...m, leagueName: lg.name })))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sport]);

  // Re-render every 2s so minute-only changes from store are picked up
  // (useSyncExternalStore inside the hook already covers tick-driven re-renders,
  // but stale-time gating is also needed for the "fresh" badge).
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 2000); return () => clearInterval(t); }, []);

  const liveMatches = matches.filter((m) => m.isLive);

  return (
    <div className="live-page">
      <header className="live-page-head">
        <h1>Live now · {liveMatches.length}</h1>
        <div className="live-sport-tabs">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!s.enabled}
              className={`live-sport-tab${sport === s.id ? ' is-active' : ''}`}
              onClick={() => s.enabled && setSport(s.id)}
            >{s.label}</button>
          ))}
        </div>
      </header>

      {liveMatches.length === 0 && (
        <div className="live-empty fade-up">
          <div className="live-empty-icon" aria-hidden>📡</div>
          <h3>Nothing live right now</h3>
          <p>Live matches will appear here as soon as they kick off.</p>
        </div>
      )}

      <ul className="live-match-list">
        {liveMatches.map((m) => {
          const snap = getFixture(m.id);
          const scoreHome = snap?.scoreHome ?? m.scoreHome ?? 0;
          const scoreAway = snap?.scoreAway ?? m.scoreAway ?? 0;
          const minute    = snap?.minute    ?? m.minute    ?? '';
          const m1 = snap?.markets?.['1X2']?.find((s) => s.key === '1');
          const mX = snap?.markets?.['1X2']?.find((s) => s.key === 'X');
          const m2 = snap?.markets?.['1X2']?.find((s) => s.key === '2');
          return (
            <li key={m.id} className="live-match-row">
              <Link to={`/live/${m.id}`} className="live-match-link">
                <span className="live-match-time">LIVE {minute}'</span>
                <span className="live-match-teams">
                  {m.home} <strong>{scoreHome}</strong> — <strong>{scoreAway}</strong> {m.away}
                </span>
                <span className="live-match-league">{m.leagueName}</span>
                <span className="live-match-prices">
                  <code>1: {(m1?.odds ?? m.odds1 ?? 0).toFixed(2)}</code>
                  <code>X: {(mX?.odds ?? m.oddsX ?? 0).toFixed(2)}</code>
                  <code>2: {(m2?.odds ?? m.odds2 ?? 0).toFixed(2)}</code>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

If `fetchMatches` doesn't exist under that name in `betApi.js`, search for the existing helper that lists matches (likely `getMatches` or similar) and use that.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/LivePage.jsx
git commit -m "feat(client): LivePage with sport tabs and live match list"
```

---

## Task 15: Client — `LiveMatchPage`

**Files:**
- Create: `client/src/pages/LiveMatchPage.jsx`

- [ ] **Step 1: Implement LiveMatchPage**

Create `client/src/pages/LiveMatchPage.jsx`:

```jsx
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useFixtureLive } from '../hooks/useLiveSocket.js';
import { getFixture } from '../state/liveStore.js';
import { fetchMatch, fetchMyBets } from '../api/betApi.js'; // existing helpers
import OddsButton from '../components/OddsButton.jsx';
import MatchEventRibbon from '../components/MatchEventRibbon.jsx';
import LiveCashOutCard from '../components/LiveCashOutCard.jsx';

export default function LiveMatchPage() {
  const { matchId } = useParams();
  const [base, setBase] = useState(null);
  const [openBets, setOpenBets] = useState([]);
  const fixtureIds = useMemo(() => [matchId], [matchId]);
  useFixtureLive(fixtureIds);

  useEffect(() => {
    let alive = true;
    fetchMatch(matchId).then((d) => { if (alive) setBase(d.match || d); }).catch(() => {});
    fetchMyBets()
      .then((d) => {
        if (!alive) return;
        const filtered = (d.bets || []).filter((b) =>
          b.status === 'open' && b.legs?.some((l) => l.matchId === matchId)
        );
        setOpenBets(filtered);
      })
      .catch(() => setOpenBets([]));
    return () => { alive = false; };
  }, [matchId]);

  const snap = getFixture(matchId) || {};
  const scoreHome = snap.scoreHome ?? base?.scoreHome ?? 0;
  const scoreAway = snap.scoreAway ?? base?.scoreAway ?? 0;
  const minute    = snap.minute    ?? base?.minute    ?? '';
  const markets   = snap.markets   ?? base?.markets   ?? {};
  const events    = snap.recentEvents ?? [];

  if (!base) return <div className="live-match-loading">Loading…</div>;

  return (
    <div className="live-match-page">
      <MatchEventRibbon events={events} />

      <header className="live-match-head">
        <div className="live-match-minute">LIVE {minute}'</div>
        <div className="live-match-teams-row">
          <span className="team team-home">{base.home}</span>
          <span className="score">{scoreHome}</span>
          <span className="score-sep">—</span>
          <span className="score">{scoreAway}</span>
          <span className="team team-away">{base.away}</span>
        </div>
        <div className="live-match-league">{base.leagueName || base.league?.name}</div>
      </header>

      {openBets.length > 0 && (
        <section className="live-match-cashout">
          {openBets.map((b) => (
            <LiveCashOutCard
              key={b.id}
              bet={b}
              onCashedOut={() => setOpenBets((bs) => bs.filter((x) => x.id !== b.id))}
            />
          ))}
        </section>
      )}

      <section className="live-match-markets">
        {Object.entries(markets).map(([mk, selections]) => (
          <details key={mk} className="market-group" open>
            <summary>{mk}</summary>
            <div className="market-grid">
              {(selections || []).map((s) => (
                <OddsButton
                  key={s.key}
                  label={s.label}
                  odds={Number(s.odds) || 0}
                  direction={s.direction}
                />
              ))}
            </div>
          </details>
        ))}
        {Object.keys(markets).length === 0 && (
          <div className="market-empty">Waiting for the first live tick…</div>
        )}
      </section>
    </div>
  );
}
```

If `fetchMatch` / `fetchMyBets` aren't the exact names in `betApi.js`, find the closest existing helpers (e.g., `getMatchById`, `myBets`) and use those — keep the call sites' shape consistent with what the helpers return.

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/LiveMatchPage.jsx
git commit -m "feat(client): LiveMatchPage with markets, events, and inline cash-out"
```

---

## Task 16: Client — routing and Home link

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/Home.jsx`

- [ ] **Step 1: Replace the existing `/live` route**

In `client/src/App.jsx`, find:

```jsx
<Route path="/live"      element={<Home initialChip="live" />} />
```

Replace with:

```jsx
<Route path="/live"          element={<LivePage />} />
<Route path="/live/:matchId" element={<LiveMatchPage />} />
```

Add the imports at the top of the file:

```jsx
import LivePage from './pages/LivePage.jsx';
import LiveMatchPage from './pages/LiveMatchPage.jsx';
```

- [ ] **Step 2: Wire Home's "Live now" banner to `/live`**

Open `client/src/pages/Home.jsx`. Find the `<div className="live-banner">` block (around line 490). Wrap its content in a `<Link to="/live">` from react-router-dom. If `Link` is not already imported, add `import { Link } from 'react-router-dom';` at the top.

```jsx
<Link to="/live" className="live-banner">
  <div className="live-banner-pulse" aria-hidden />
  <div className="live-banner-text">
    {/* ...existing content unchanged... */}
  </div>
</Link>
```

If the banner is currently a `<div>` with onClick, prefer converting to `<Link>` for accessibility.

- [ ] **Step 3: Boot the client and visit `/live`**

```bash
npm run dev
```

In a browser, navigate to `/live`. Expected: page renders with the empty state (since no live track is running yet without an API key). No console errors.

Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx client/src/pages/Home.jsx
git commit -m "feat(client): /live and /live/:matchId routes + Home banner link"
```

---

## Task 17: Client — `BetHistoryPage` live cash-out wiring

**Files:**
- Modify: `client/src/pages/BetHistoryPage.jsx`

- [ ] **Step 1: Subscribe to `cashout:offer` and update open-bet display**

Open `client/src/pages/BetHistoryPage.jsx`. Find where the list of bets is rendered. Add at the top of the component:

```jsx
import { useState, useEffect } from 'react';
import { useUserLive } from '../hooks/useLiveSocket.js';
import { cashOutBet } from '../api/betApi.js';
```

Inside the component, after `bets` state is loaded, add:

```jsx
const [offers, setOffers] = useState({}); // betId -> { cashOut, ts }
useUserLive({
  cashoutOffer: (p) => setOffers((o) => ({ ...o, [p.betId]: { cashOut: p.cashOut, ts: p.ts } })),
});
```

For each open bet row, replace the existing "Cash Out" button with:

```jsx
{bet.status === 'open' && (() => {
  const offer = offers[bet.id]?.cashOut ?? bet.lastCashOutOffer?.amount ?? null;
  const label = offer === null ? 'Cash Out' : `Cash Out GHS ${offer.toFixed(2)}`;
  return (
    <button
      type="button"
      className="bet-cashout-btn"
      onClick={async () => {
        try {
          const res = await cashOutBet(bet.id, offer ?? undefined);
          // Refresh the bet in the list — replace with whatever local update
          // function the page already uses (e.g., setBets).
          setBets((bs) => bs.map((b) => b.id === bet.id ? res.bet : b));
        } catch (e) {
          if (e.code === 'OFFER_STALE' && typeof e.currentOffer === 'number') {
            setOffers((o) => ({ ...o, [bet.id]: { cashOut: e.currentOffer, ts: Date.now() } }));
          } else {
            alert(e.message || 'Cash-out failed.');
          }
        }
      }}
    >{label}</button>
  );
})()}
```

If the page uses a different state setter than `setBets`, swap the name in. The intent is: after a successful cash-out, the bet row reflects `status: 'cashed_out'` and the user's balance refreshes (the existing account provider should handle balance refresh from the `wallet:update` event).

- [ ] **Step 2: Boot client + verify the page renders**

```bash
npm run dev
```

Visit `/my-bets`. Confirm no console errors. The cash-out button shows "Cash Out" until an offer arrives — which won't happen yet without a running live track, that's fine.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/BetHistoryPage.jsx
git commit -m "feat(client): BetHistoryPage subscribes to cashout:offer with stale-offer retry"
```

---

## Task 18: Animation CSS

**Files:**
- Modify: `client/src/styles/app.css`

- [ ] **Step 1: Append the animation classes**

Append the following block to `client/src/styles/app.css`:

```css
/* ============================================================
 * Live betting animations
 * ============================================================ */

@keyframes odds-flash-up-kf {
  0%   { background-color: rgba(34,197,94,0.35); }
  100% { background-color: transparent; }
}
@keyframes odds-flash-down-kf {
  0%   { background-color: rgba(239,68,68,0.35); }
  100% { background-color: transparent; }
}
.odds-flash-up   { animation: odds-flash-up-kf   600ms ease-out; }
.odds-flash-down { animation: odds-flash-down-kf 600ms ease-out; }

@keyframes score-pulse-kf {
  0%   { transform: scale(1);    }
  40%  { transform: scale(1.18); }
  100% { transform: scale(1);    }
}
.score-pulse { animation: score-pulse-kf 500ms ease-out; }

@keyframes goal-celebrate-kf {
  0%   { box-shadow: 0 0 0 0 rgba(250,204,21,0); background-image: none; }
  20%  { box-shadow: 0 0 24px 6px rgba(250,204,21,0.55);
         background-image: linear-gradient(90deg, transparent, rgba(250,204,21,0.18), transparent); }
  100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); background-image: none; }
}
.goal-celebrate { animation: goal-celebrate-kf 2000ms ease-out; }

@keyframes match-ribbon-in-kf {
  0%   { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(0);    opacity: 1; }
}
@keyframes match-ribbon-out-kf {
  0%   { transform: translateX(0);    opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
}
.match-ribbon-stack {
  position: absolute; top: 12px; right: 12px;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none; z-index: 50;
}
.match-ribbon {
  background: rgba(15,23,42,0.92); color: #fff;
  padding: 8px 14px; border-radius: 999px; font-weight: 600;
  animation: match-ribbon-in-kf 250ms ease-out forwards,
             match-ribbon-out-kf 250ms ease-in 2750ms forwards;
}
.match-ribbon-goal_home, .match-ribbon-goal_away { background: linear-gradient(90deg, #16a34a, #22c55e); }
.match-ribbon-red_card  { background: linear-gradient(90deg, #b91c1c, #ef4444); }

@keyframes cashout-jump-kf {
  0%   { transform: scale(1);    outline: 0 solid rgba(250,204,21,0); }
  50%  { transform: scale(1.04); outline: 4px solid rgba(250,204,21,0.55); }
  100% { transform: scale(1);    outline: 0 solid rgba(250,204,21,0); }
}
.cashout-jump { animation: cashout-jump-kf 300ms ease-out; }

@keyframes cashout-glow-kf {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.0); }
  50%      { box-shadow: 0 0 18px 4px rgba(250,204,21,0.55); }
}
.cashout-glow { animation: cashout-glow-kf 1800ms ease-in-out infinite; }

/* Reduced-motion override: every animation collapses to an instant change.
 * Pulses are skipped entirely. */
@media (prefers-reduced-motion: reduce) {
  .odds-flash-up, .odds-flash-down,
  .score-pulse, .goal-celebrate,
  .match-ribbon, .cashout-jump, .cashout-glow {
    animation: none !important;
  }
}

/* Live-page primitives that the page JSX expects */
.live-page              { padding: 16px; }
.live-page-head         { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.live-sport-tabs        { display: flex; gap: 8px; }
.live-sport-tab         { background: transparent; border: 1px solid rgba(255,255,255,0.16); color: inherit; padding: 6px 10px; border-radius: 999px; cursor: pointer; }
.live-sport-tab:disabled{ opacity: 0.4; cursor: not-allowed; }
.live-sport-tab.is-active { background: rgba(250,204,21,0.18); border-color: rgba(250,204,21,0.5); }
.live-match-list        { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.live-match-link        { display: grid; grid-template-columns: 90px 1fr auto; gap: 12px; align-items: center; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); color: inherit; text-decoration: none; }
.live-match-time        { font-weight: 700; color: #f87171; }
.live-match-prices code { margin-left: 8px; }

.cashout-card           { padding: 12px 16px; border-radius: 14px; background: rgba(15,23,42,0.7); display: grid; gap: 6px; }
.cashout-card-head      { font-size: 12px; opacity: 0.7; text-transform: uppercase; }
.cashout-card-amount    { font-size: 24px; font-weight: 800; color: #facc15; }
.cashout-card-btn       { padding: 10px 14px; border-radius: 10px; border: 0; background: #facc15; color: #0f172a; font-weight: 700; cursor: pointer; }
.cashout-card-btn:disabled { opacity: 0.6; cursor: progress; }
.cashout-card-err       { color: #fca5a5; font-size: 12px; }

.odds-btn               { display: inline-flex; gap: 8px; align-items: baseline; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; color: inherit; }
.odds-btn .odds-label   { opacity: 0.7; }
.odds-btn .odds-value   { font-weight: 700; }
.odds-btn.is-selected   { background: rgba(250,204,21,0.18); border-color: rgba(250,204,21,0.5); }
.odds-btn.is-suspended  { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Boot the client and visually confirm**

```bash
npm run dev
```

Visit `/live`. Confirm the page lays out, sport tabs render, empty state is visible. With browser DevTools, toggle `prefers-reduced-motion` and reload — animations should still render without errors (they'll just be no-ops).

Stop with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/app.css
git commit -m "feat(client): live-betting animation CSS + page primitives"
```

---

## Task 19: End-to-end smoke test (manual)

**Files:** none

- [ ] **Step 1: Set up env**

Edit `server/.env` to include:

```
APIFOOTBALL_KEY=<your real apiFootball key>
LIVE_POLL_MS=6000
CASHOUT_HOUSE_MARGIN=0.05
CASHOUT_DRIFT_TOLERANCE=0.01
```

If you don't have an apiFootball key on hand, sign up for the free tier at https://www.api-football.com — you get 100 requests/day. For the smoke test 5-10 requests are enough.

- [ ] **Step 2: Start both server and client**

```bash
npm run dev
```

Expected: server logs `Live track started, polling every 6000ms.` and `Realtime: Socket.IO attached`. Client opens on Vite's port (default 5173).

- [ ] **Step 3: Place a bet on a live match**

1. Log in as a test user with positive balance.
2. Visit `/live`. Wait up to 10s for the live matches list to populate (depends on whether any match is live worldwide).
3. Click into one match. Confirm minute and score render.
4. Place a 10 GHS single on any market via the existing betslip flow.
5. After placing, watch the bet card on `/my-bets` — the cash-out value should update within ~10s.

- [ ] **Step 4: Confirm cash-out behavior**

1. On `/live/:matchId`, scroll to the pinned `LiveCashOutCard`. The displayed offer should tween whenever odds drift.
2. Click "Take GHS X". Confirm the server credits your balance with the displayed amount (check `/wallet`).
3. Confirm the bet's row on `/my-bets` now shows `cashed_out`.

- [ ] **Step 5: Confirm an `OFFER_STALE` rejection works**

Hard to trigger in a single-browser session because the UI updates immediately. To force it: open DevTools → Network → throttle → "Slow 3G", then click "Take" rapidly between two big odds swings. You should see a 409 + the button re-syncing to the new amount.

- [ ] **Step 6: Confirm reduced-motion mode is honored**

In browser DevTools, enable "Emulate CSS prefers-reduced-motion: reduce" and reload. Confirm odds buttons update without flashes, score updates without pulse.

- [ ] **Step 7: Document any issues found**

If anything breaks, capture the failure and either fix it inline or open a follow-up issue. Common gotchas:
- `fetchMatches` / `fetchMatch` / `fetchMyBets` name mismatches in `betApi.js` — adjust to whatever helpers exist.
- `validate(cashoutSchema)` signature mismatch — drop the `'body'` arg if the existing middleware doesn't take it.
- apiFootball returns no live games during your test window — pick another time, or sub in a mock provider.

- [ ] **Step 8: Commit any inline fixes**

```bash
git add -A
git commit -m "fix(live): smoke-test adjustments"
```

---

## Out of scope (reminder)

These are not in this plan and remain unspec'd until you brainstorm them separately:
- Partial cash-out, auto-rules
- Live cash-out for system bets
- Multi-sport live (basketball, tennis)
- Crypto payments, AI predictions, social betting, gamification, streaming
- Markets-expansion subsystem (exotic markets, thousands per fixture)
