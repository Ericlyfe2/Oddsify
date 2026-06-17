# Settlement Bridge + Real-time Events Design

**Date:** 2026-06-17
**Status:** Approved
**Scope:** Wire catalog management pages to the player site via a bridge layer, emit real-time events on admin mutations, and extend the settlement engine to grade all catalog market types.

---

## Problem

Two parallel fixture systems exist and don't communicate:

1. **Old system** (`matchesData.js` + `sportsAdmin.js`): Static fixture data with admin overrides. Used by the settlement engine, bet placement, player-facing site, and odds feed. Markets are inline objects on the match.

2. **New system** (`matches.js` + `leagues.js` + `teams.js` + `markets.js` + `results.js`): Normalized catalog with dedupe, state machine, separate market/selection entities. Used by the management pages but disconnected from the player side and settlement.

**Result:** Creating a match in the management pages doesn't make it visible to players. Entering a result doesn't trigger settlement. Admin mutations don't emit real-time events.

## Approach: Bridge Pattern

The catalog (management system) becomes the **authoritative source** for admin-created content. A bridge layer syncs catalog writes into the old `sportsAdmin.js` custom fixtures format so the existing settlement engine, player site, and bet placement work without modification.

### Why not full migration?

Full migration would touch bet placement, player site rendering, and the odds feed — massive blast radius. The bridge delivers the same business value (admin creates match → players can bet → admin enters result → bets settle → users see outcomes) with minimal risk to existing working flows.

---

## Design

### 1. Bridge Layer (`server/src/services/catalogBridge.js`)

Called from management route handlers immediately after catalog writes succeed.

#### Catalog → sportsAdmin mapping

| Catalog action | Bridge effect |
|---|---|
| `createMatch()` + auto-attached markets | `addCustomFixture()` with inline `markets` in old format |
| `updateMatch()` (field edits, status change) | `patchOverride()` on the custom fixture |
| Match suspended/cancelled | `setSuspension()` on the fixture |
| `updateSelection()` (price change) | `setOddsOverride()` on the fixture's market |
| Market suspended/disabled | `setSuspension()` with market key |
| `confirmResult()` | `sportsAdmin.setResult()` → settlement loop picks up |

#### Data format mapping

```
Catalog Selection { id, marketId, outcomeKey, label, price }
  → Old Selection { key: outcomeKey, label, odds: price }

Catalog Market { id, matchId, key, name, status, selections[] }
  → Old Market  { name, selections: [...mapped], suspended: status !== 'open' }

Catalog Match { id, homeTeamName, awayTeamName, startsAt, sportId, leagueId }
  → Old Fixture { id, home, away, kickoff, day, isLive, sport, leagueId, markets }
```

The bridge converts `startsAt` (ISO datetime) to `kickoff` (HH:MM) + `day` (Today/Tomorrow/date) for the old format.

### 2. Real-time Event Emission

Emit Socket.IO events from management route handlers after the bridge sync.

| Route | Event | Namespace | Payload |
|---|---|---|---|
| `POST /management/matches` | `match:created` | `/live` (broadcast) | `{ matchId, sport, leagueId }` |
| `POST /management/matches/:id/status` | `match:statusChanged` | `/live` (broadcast) | `{ matchId, status, reason }` |
| `PATCH /management/markets/:matchId/:marketId` (price) | `odds:tick` | `/live` (fixture room) | standard odds tick payload |
| `PATCH /management/markets/:matchId/:marketId` (status) | `market:suspended` / `market:enabled` | `/live` (fixture room) | `{ marketId, matchId, status }` |
| `POST /management/results/:matchId/enter` | `result:entered` | `/admin` only | `{ matchId, status: 'provisional' }` |
| `POST /management/results/:matchId/confirm` | `result:confirmed` | `/live` (broadcast) | `{ matchId }` |

Player clients receive lightweight events (IDs + status) and refresh data via the existing odds snapshot endpoint. No heavy payload in events.

### 3. Settlement Integration

**No changes to settlement loop structure.** The bridge writes results into `sportsAdmin.setResult()` which the 30s `settleNow()` loop already polls.

**Enhancement:** Call `settleNow()` immediately after `confirmResult()` for near-instant settlement instead of waiting up to 30s.

**New market grading in `legWon()`:**

| Market | Grading logic |
|---|---|
| `CS` (Correct Score) | Exact `H-A` cell wins. If actual score exceeds grid, the matching "Any Other" bucket wins (OTHER_HOME if home>away, OTHER_AWAY if away>home, OTHER_DRAW if tied). |
| `DNB` (Draw No Bet) | Home `1` wins if home>away, Away `2` wins if away>home. **Void on draw** (refund stake). |
| `1H1X2` (1st Half Winner) | Same as 1X2 but using `htHomeScore`/`htAwayScore` from the result. Void if HT scores not available. |
| `1HOU05` (1st Half O/U 0.5) | `htHome + htAway > 0.5` → Over. Void if HT scores missing. |
| `1HBTTS` (1st Half BTTS) | `htHome > 0 && htAway > 0` → Yes. Void if HT scores missing. |
| `HTFT` (Half-Time/Full-Time) | Outcome key is `HT/FT` (e.g. `1/X`). First char = HT result, second = FT result. Both must match. Void if HT scores missing. |
| `AH2` (Asian Handicap ±2) | Same as AH1 but with handicap=2. `Home -2` wins if `home - 2 > away`. |
| `WINBTTS` (Result & BTTS combo) | Key format `1X2key_BTTSkey`. Both components must be true. |
| `WINOU25` (Result & O/U 2.5 combo) | Key format `1X2key_OUkey`. Both components must be true. |
| `BTTSOU25` (BTTS & O/U 2.5 combo) | Key format `BTTSkey_OUkey`. Both components must be true. |

### 4. Files Changed

| File | Change type |
|---|---|
| **NEW** `server/src/services/catalogBridge.js` | Bridge: catalog → sportsAdmin sync + event emission |
| `server/src/routes/admin/management-matches.js` | Call bridge after create/update/status/cancel/archive |
| `server/src/routes/admin/management-markets.js` | Call bridge after market status + price changes |
| `server/src/routes/admin/management-results.js` | Call bridge + `settleNow()` after confirm |
| `server/src/services/settlement.js` | Extend `legWon()` with CS, DNB, 1H*, HTFT, AH2, combo grading |

### 5. Testing Requirements

1. Create match in management → fixture appears in player site snapshot (`buildPublicSnapshot`)
2. Change selection price → `odds:tick` event fires to fixture room
3. Suspend market → `market:suspended` event fires; player bet slip rejects bets on that market
4. Enter result (provisional) → no settlement happens
5. Confirm result → `settleNow()` runs immediately, open bets grade correctly, wallets credit
6. Correct Score grading: exact match wins, OTHER_HOME/AWAY/DRAW buckets work for out-of-grid scores
7. DNB voids on draw (stake refunded)
8. 1H markets void when HT scores are null
9. Combo markets: both components must pass
10. Duplicate match creation still blocked with 409

---

## Out of Scope (future phases)

- Full migration to catalog system (replacing sportsAdmin entirely)
- Pagination on management pages
- Responsive/mobile polish
- Bulk actions UI
- Withdrawal approval workflow
- UI hardening (prompt() → modals, skeleton loaders)
