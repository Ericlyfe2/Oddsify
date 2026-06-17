# Settlement Bridge + Real-time Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire catalog management pages to the player site so admin-created matches are bettable, result confirmation triggers immediate settlement, and all admin mutations emit real-time Socket.IO events.

**Architecture:** A bridge service (`catalogBridge.js`) translates catalog entities (from `matches.js`, `markets.js`, `results.js`) into the old `sportsAdmin.js` custom-fixture format that the player site, bet placement, and settlement engine already consume. Route handlers call the bridge after every catalog write. The settlement engine's `legWon()` function is extended to grade all catalog market types (Correct Score, DNB, 1st Half, HT/FT, combos).

**Tech Stack:** Node.js, Express, Socket.IO, KV store (Postgres/JSON)

---

## File Structure

| File | Responsibility |
|---|---|
| **CREATE** `server/src/services/catalogBridge.js` | Converts catalog matches/markets/selections → sportsAdmin custom fixtures; emits Socket.IO events |
| **MODIFY** `server/src/services/settlement.js` | Extend `legWon()` with CS, DNB, 1H*, HTFT, AH2, OU*, combo grading |
| **MODIFY** `server/src/routes/admin/management-matches.js` | Call bridge after create/update/status/cancel/archive |
| **MODIFY** `server/src/routes/admin/management-markets.js` | Call bridge after market status change, price update |
| **MODIFY** `server/src/routes/admin/management-results.js` | Call bridge on confirm + immediate `settleNow()` |
| **CREATE** `server/src/services/__tests__/legWon.test.js` | Unit tests for all market grading logic |
| **CREATE** `server/src/services/__tests__/catalogBridge.test.js` | Unit tests for catalog → sportsAdmin format conversion |

---

### Task 1: Extend `legWon()` with all market grading logic

This is the highest-risk code — grading determines payouts. We write tests first for every market type, then implement.

**Files:**
- Create: `server/src/services/__tests__/legWon.test.js`
- Modify: `server/src/services/settlement.js`

- [ ] **Step 1: Create the test directory**

```bash
mkdir -p server/src/services/__tests__
```

- [ ] **Step 2: Write failing tests for all market grading**

Create `server/src/services/__tests__/legWon.test.js`:

```js
/**
 * Unit tests for legWon() — the market grading function in the settlement engine.
 *
 * Each test verifies: given a bet leg { market, outcome } and a final score
 * { scoreHome, scoreAway }, does legWon return true/false/null (void)?
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// legWon is not currently exported. We'll extract and export it in Step 4.
// For now, the import will fail — that's the "failing test" step.
import { legWon } from '../settlement.js';

describe('legWon — market grading', () => {
  // ── 1X2 (Match Winner) ───────────────────────────
  describe('1X2', () => {
    it('Home win → outcome "1" wins', () => {
      assert.strictEqual(legWon({ market: '1X2', outcome: '1' }, 2, 1), true);
    });
    it('Home win → outcome "2" loses', () => {
      assert.strictEqual(legWon({ market: '1X2', outcome: '2' }, 2, 1), false);
    });
    it('Draw → outcome "X" wins', () => {
      assert.strictEqual(legWon({ market: '1X2', outcome: 'X' }, 1, 1), true);
    });
    it('Draw → outcome "1" loses', () => {
      assert.strictEqual(legWon({ market: '1X2', outcome: '1' }, 1, 1), false);
    });
    it('Away win → outcome "2" wins', () => {
      assert.strictEqual(legWon({ market: '1X2', outcome: '2' }, 0, 3), true);
    });
  });

  // ── Double Chance ────────────────────────────────
  describe('DC', () => {
    it('Home win → "1X" wins', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: '1X' }, 2, 0), true);
    });
    it('Draw → "1X" wins', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: '1X' }, 1, 1), true);
    });
    it('Away win → "1X" loses', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: '1X' }, 0, 1), false);
    });
    it('Home win → "X2" loses', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: 'X2' }, 2, 0), false);
    });
    it('Home win → "12" wins', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: '12' }, 2, 0), true);
    });
    it('Draw → "12" loses', () => {
      assert.strictEqual(legWon({ market: 'DC', outcome: '12' }, 1, 1), false);
    });
  });

  // ── Draw No Bet ──────────────────────────────────
  describe('DNB', () => {
    it('Home win → "1" wins', () => {
      assert.strictEqual(legWon({ market: 'DNB', outcome: '1' }, 2, 1), true);
    });
    it('Away win → "2" wins', () => {
      assert.strictEqual(legWon({ market: 'DNB', outcome: '2' }, 0, 1), true);
    });
    it('Draw → void (null)', () => {
      assert.strictEqual(legWon({ market: 'DNB', outcome: '1' }, 1, 1), null);
    });
    it('Draw → void for away too', () => {
      assert.strictEqual(legWon({ market: 'DNB', outcome: '2' }, 2, 2), null);
    });
  });

  // ── Over/Under variants ──────────────────────────
  describe('Over/Under', () => {
    it('OU25: 3 goals → Over wins', () => {
      assert.strictEqual(legWon({ market: 'OU25', outcome: 'Over' }, 2, 1), true);
    });
    it('OU25: 2 goals → Under wins', () => {
      assert.strictEqual(legWon({ market: 'OU25', outcome: 'Under' }, 1, 1), true);
    });
    it('OU15: 2 goals → Over wins', () => {
      assert.strictEqual(legWon({ market: 'OU15', outcome: 'Over' }, 1, 1), true);
    });
    it('OU15: 1 goal → Under wins', () => {
      assert.strictEqual(legWon({ market: 'OU15', outcome: 'Under' }, 1, 0), true);
    });
    it('OU05: 0 goals → Under wins', () => {
      assert.strictEqual(legWon({ market: 'OU05', outcome: 'Under' }, 0, 0), true);
    });
    it('OU05: 1 goal → Over wins', () => {
      assert.strictEqual(legWon({ market: 'OU05', outcome: 'Over' }, 1, 0), true);
    });
    it('OU35: 4 goals → Over wins', () => {
      assert.strictEqual(legWon({ market: 'OU35', outcome: 'Over' }, 2, 2), true);
    });
    it('OU35: 3 goals → Under wins', () => {
      assert.strictEqual(legWon({ market: 'OU35', outcome: 'Under' }, 2, 1), true);
    });
    it('OU45: 5 goals → Over wins', () => {
      assert.strictEqual(legWon({ market: 'OU45', outcome: 'Over' }, 3, 2), true);
    });
    it('OU45: 4 goals → Under wins', () => {
      assert.strictEqual(legWon({ market: 'OU45', outcome: 'Under' }, 2, 2), true);
    });
  });

  // ── BTTS ─────────────────────────────────────────
  describe('BTTS', () => {
    it('Both score → Yes wins', () => {
      assert.strictEqual(legWon({ market: 'BTTS', outcome: 'Yes' }, 1, 2), true);
    });
    it('One side 0 → No wins', () => {
      assert.strictEqual(legWon({ market: 'BTTS', outcome: 'No' }, 2, 0), true);
    });
    it('Both score → No loses', () => {
      assert.strictEqual(legWon({ market: 'BTTS', outcome: 'No' }, 1, 1), false);
    });
  });

  // ── Correct Score ────────────────────────────────
  describe('CS', () => {
    it('Exact score match wins', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: '2-1' }, 2, 1), true);
    });
    it('Wrong score loses', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: '2-1' }, 1, 1), false);
    });
    it('0-0 draw wins', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: '0-0' }, 0, 0), true);
    });
    it('Score outside grid → OTHER_HOME wins if home wins', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER_HOME' }, 8, 2), true);
    });
    it('Score outside grid → OTHER_AWAY wins if away wins', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER_AWAY' }, 1, 9), true);
    });
    it('Score outside grid → OTHER_DRAW wins if draw', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER_DRAW' }, 7, 7), true);
    });
    it('OTHER_HOME loses when away wins out of grid', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER_HOME' }, 1, 9), false);
    });
    it('Legacy OTHER bucket — home win out of grid', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER' }, 8, 2), true);
    });
    it('Legacy OTHER bucket — in-grid score loses', () => {
      assert.strictEqual(legWon({ market: 'CS', outcome: 'OTHER' }, 2, 1), false);
    });
  });

  // ── Asian Handicap ───────────────────────────────
  describe('AH (Asian Handicap)', () => {
    it('AH1: Home wins by 2+ → H-1 wins', () => {
      assert.strictEqual(legWon({ market: 'AH1', outcome: 'H-1' }, 3, 1), true);
    });
    it('AH1: Home wins by 1 → H-1 loses (push → lose in this model)', () => {
      assert.strictEqual(legWon({ market: 'AH1', outcome: 'H-1' }, 2, 1), false);
    });
    it('AH1: Draw → A+1 wins', () => {
      assert.strictEqual(legWon({ market: 'AH1', outcome: 'A+1' }, 1, 1), true);
    });
    it('AH2: Home wins by 3+ → H-2 wins', () => {
      assert.strictEqual(legWon({ market: 'AH2', outcome: 'H-2' }, 4, 1), true);
    });
    it('AH2: Home wins by 2 → H-2 loses', () => {
      assert.strictEqual(legWon({ market: 'AH2', outcome: 'H-2' }, 3, 1), false);
    });
    it('AH2: Away wins → A+2 wins', () => {
      assert.strictEqual(legWon({ market: 'AH2', outcome: 'A+2' }, 0, 1), true);
    });
  });

  // ── 1st Half markets ─────────────────────────────
  describe('1st Half markets', () => {
    it('1H1X2: HT home lead → "1" wins', () => {
      assert.strictEqual(legWon({ market: '1H1X2', outcome: '1' }, 2, 1, 1, 0), true);
    });
    it('1H1X2: HT draw → "X" wins', () => {
      assert.strictEqual(legWon({ market: '1H1X2', outcome: 'X' }, 2, 1, 1, 1), true);
    });
    it('1H1X2: no HT scores → void', () => {
      assert.strictEqual(legWon({ market: '1H1X2', outcome: '1' }, 2, 1, null, null), null);
    });
    it('1HOU05: 1 HT goal → Over wins', () => {
      assert.strictEqual(legWon({ market: '1HOU05', outcome: 'Over' }, 2, 1, 1, 0), true);
    });
    it('1HOU05: 0 HT goals → Under wins', () => {
      assert.strictEqual(legWon({ market: '1HOU05', outcome: 'Under' }, 1, 0, 0, 0), true);
    });
    it('1HOU05: no HT scores → void', () => {
      assert.strictEqual(legWon({ market: '1HOU05', outcome: 'Over' }, 2, 1, null, null), null);
    });
    it('1HBTTS: both HT > 0 → Yes wins', () => {
      assert.strictEqual(legWon({ market: '1HBTTS', outcome: 'Yes' }, 3, 2, 1, 1), true);
    });
    it('1HBTTS: one side 0 at HT → No wins', () => {
      assert.strictEqual(legWon({ market: '1HBTTS', outcome: 'No' }, 2, 1, 1, 0), true);
    });
    it('1HBTTS: no HT scores → void', () => {
      assert.strictEqual(legWon({ market: '1HBTTS', outcome: 'Yes' }, 2, 1, null, null), null);
    });
  });

  // ── HT/FT ────────────────────────────────────────
  describe('HTFT', () => {
    it('HT home lead, FT home win → "1/1" wins', () => {
      assert.strictEqual(legWon({ market: 'HTFT', outcome: '1/1' }, 3, 1, 1, 0), true);
    });
    it('HT draw, FT away win → "X/2" wins', () => {
      assert.strictEqual(legWon({ market: 'HTFT', outcome: 'X/2' }, 1, 2, 0, 0), true);
    });
    it('HT home lead, FT draw → "1/X" wins', () => {
      assert.strictEqual(legWon({ market: 'HTFT', outcome: '1/X' }, 1, 1, 1, 0), true);
    });
    it('Wrong combo loses', () => {
      assert.strictEqual(legWon({ market: 'HTFT', outcome: '1/1' }, 1, 2, 1, 0), false);
    });
    it('No HT scores → void', () => {
      assert.strictEqual(legWon({ market: 'HTFT', outcome: '1/1' }, 2, 0, null, null), null);
    });
  });

  // ── Combo markets ────────────────────────────────
  describe('WINBTTS (Result & BTTS)', () => {
    it('Home win + BTTS Yes → "1Y" wins', () => {
      assert.strictEqual(legWon({ market: 'WINBTTS', outcome: '1Y' }, 3, 1), true);
    });
    it('Home win + BTTS No → "1N" wins', () => {
      assert.strictEqual(legWon({ market: 'WINBTTS', outcome: '1N' }, 2, 0), true);
    });
    it('Draw + BTTS Yes → "XY" wins', () => {
      assert.strictEqual(legWon({ market: 'WINBTTS', outcome: 'XY' }, 1, 1), true);
    });
    it('Away win + BTTS No → "2N" wins', () => {
      assert.strictEqual(legWon({ market: 'WINBTTS', outcome: '2N' }, 0, 1), true);
    });
    it('Home win but wrong BTTS → "1Y" loses (no BTTS)', () => {
      assert.strictEqual(legWon({ market: 'WINBTTS', outcome: '1Y' }, 2, 0), false);
    });
  });

  describe('WINOU25 (Result & O/U 2.5)', () => {
    it('Home win + Over 2.5 → "1O" wins', () => {
      assert.strictEqual(legWon({ market: 'WINOU25', outcome: '1O' }, 3, 1), true);
    });
    it('Draw + Under 2.5 → "XU" wins', () => {
      assert.strictEqual(legWon({ market: 'WINOU25', outcome: 'XU' }, 1, 1), true);
    });
    it('Home win + Under 2.5 → "1U" wins', () => {
      assert.strictEqual(legWon({ market: 'WINOU25', outcome: '1U' }, 1, 0), true);
    });
    it('Away win + Over 2.5 → "2O" wins', () => {
      assert.strictEqual(legWon({ market: 'WINOU25', outcome: '2O' }, 1, 3), true);
    });
    it('Wrong result → "1O" loses', () => {
      assert.strictEqual(legWon({ market: 'WINOU25', outcome: '1O' }, 0, 1), false);
    });
  });

  describe('BTTSOU25 (BTTS & O/U 2.5)', () => {
    it('BTTS Yes + Over 2.5 → "YO" wins', () => {
      assert.strictEqual(legWon({ market: 'BTTSOU25', outcome: 'YO' }, 2, 1), true);
    });
    it('BTTS No + Under 2.5 → "NU" wins', () => {
      assert.strictEqual(legWon({ market: 'BTTSOU25', outcome: 'NU' }, 2, 0), true);
    });
    it('BTTS Yes + Under 2.5 → "YU" wins', () => {
      assert.strictEqual(legWon({ market: 'BTTSOU25', outcome: 'YU' }, 1, 1), true);
    });
    it('Wrong combo → "YO" loses when Under', () => {
      assert.strictEqual(legWon({ market: 'BTTSOU25', outcome: 'YO' }, 1, 1), false);
    });
  });

  // ── Unknown market → void ────────────────────────
  describe('Unknown market', () => {
    it('Unknown market returns null (void)', () => {
      assert.strictEqual(legWon({ market: 'UNKNOWN', outcome: 'X' }, 1, 0), null);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test server/src/services/__tests__/legWon.test.js`
Expected: FAIL because `legWon` is not exported from `settlement.js`.

- [ ] **Step 4: Extract and export `legWon`, then extend it**

In `server/src/services/settlement.js`, the existing `legWon` function is a file-scoped function (not exported). We need to:
1. Export it
2. Change its signature to accept HT scores: `legWon(leg, scoreHome, scoreAway, htHome, htAway)`
3. Add all missing market grading cases

Replace the entire `legWon` function (lines ~117–156) with:

```js
/**
 * Grade a single bet leg against the final (and half-time) score.
 * Returns: true = won, false = lost, null = void (refund stake).
 */
export function legWon(leg, scoreHome, scoreAway, htHome = null, htAway = null) {
  const m = String(leg.market || '').toUpperCase();
  const o = String(leg.outcome || '');
  const total = scoreHome + scoreAway;
  const homeWin = scoreHome > scoreAway;
  const awayWin = scoreAway > scoreHome;
  const draw = scoreHome === scoreAway;
  const btts = scoreHome > 0 && scoreAway > 0;
  const hasHT = htHome != null && htAway != null;

  // ── Match Winner (1X2) ──
  if (m === '1X2') {
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
    if (o === 'X') return draw;
  }

  // ── Money Line (no draw) ──
  if (m === 'ML') {
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
  }

  // ── Double Chance ──
  if (m === 'DC') {
    if (o === '1X') return homeWin || draw;
    if (o === 'X2') return awayWin || draw;
    if (o === '12') return homeWin || awayWin;
  }

  // ── Draw No Bet (void on draw) ──
  if (m === 'DNB') {
    if (draw) return null;
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
  }

  // ── Over/Under (all lines) ──
  const ouMatch = m.match(/^OU(\d)(\d)$/);
  if (ouMatch) {
    const line = parseInt(ouMatch[1], 10) + parseInt(ouMatch[2], 10) / 10;
    if (o === 'Over') return total > line;
    if (o === 'Under') return total < line;
  }

  // ── BTTS ──
  if (m === 'BTTS') {
    if (o === 'Yes') return btts;
    if (o === 'No') return !btts;
  }

  // ── Correct Score ──
  if (m === 'CS') {
    const actual = `${scoreHome}-${scoreAway}`;
    // Standard score outcomes (e.g. "2-1")
    if (/^\d+-\d+$/.test(o)) return o === actual;
    // "Any Other" buckets — scores outside the typical 0-6 grid
    const inGrid = scoreHome <= 6 && scoreAway <= 6;
    if (o === 'OTHER_HOME') return !inGrid && homeWin;
    if (o === 'OTHER_AWAY') return !inGrid && awayWin;
    if (o === 'OTHER_DRAW') return !inGrid && draw;
    // Legacy single "OTHER" bucket (old matchesData format)
    if (o === 'OTHER') return !inGrid;
  }

  // ── Asian Handicap ──
  const ahMatch = m.match(/^AH(\d)$/);
  if (ahMatch) {
    const hc = parseInt(ahMatch[1], 10);
    if (o === `H-${hc}`) return scoreHome - scoreAway > hc;
    if (o === `A+${hc}`) return scoreAway - scoreHome > -hc;
  }

  // ── Total Points (basketball) ──
  if (m === 'TP') {
    const line = leg.line || 220.5;
    if (o === 'Over') return total > line;
    if (o === 'Under') return total < line;
  }

  // ── Handicap (basketball) ──
  if (m === 'HCAP') {
    const hc = Number(leg.handicap || 0);
    if (o === '1H') return scoreHome - hc > scoreAway;
    if (o === '2H') return scoreAway + hc > scoreHome;
  }

  // ── 1st Half markets (require HT scores) ──
  if (m === '1H1X2') {
    if (!hasHT) return null;
    if (o === '1') return htHome > htAway;
    if (o === '2') return htAway > htHome;
    if (o === 'X') return htHome === htAway;
  }
  if (m === '1HOU05') {
    if (!hasHT) return null;
    const htTotal = htHome + htAway;
    if (o === 'Over') return htTotal > 0.5;
    if (o === 'Under') return htTotal < 0.5;
  }
  if (m === '1HBTTS') {
    if (!hasHT) return null;
    const htBtts = htHome > 0 && htAway > 0;
    if (o === 'Yes') return htBtts;
    if (o === 'No') return !htBtts;
  }

  // ── Half-Time / Full-Time ──
  if (m === 'HTFT') {
    if (!hasHT) return null;
    const htResult = htHome > htAway ? '1' : htHome < htAway ? '2' : 'X';
    const ftResult = homeWin ? '1' : awayWin ? '2' : 'X';
    return o === `${htResult}/${ftResult}`;
  }

  // ── Combo: Result & BTTS ──
  if (m === 'WINBTTS') {
    const resultPart = o.slice(0, -1); // '1', 'X', '2'
    const bttsPart = o.slice(-1);       // 'Y' or 'N'
    const resultWon = resultPart === '1' ? homeWin : resultPart === '2' ? awayWin : resultPart === 'X' ? draw : false;
    const bttsWon = bttsPart === 'Y' ? btts : !btts;
    return resultWon && bttsWon;
  }

  // ── Combo: Result & O/U 2.5 ──
  if (m === 'WINOU25') {
    const resultPart = o.slice(0, -1); // '1', 'X', '2'
    const ouPart = o.slice(-1);         // 'O' or 'U'
    const resultWon = resultPart === '1' ? homeWin : resultPart === '2' ? awayWin : resultPart === 'X' ? draw : false;
    const ouWon = ouPart === 'O' ? total > 2.5 : total < 2.5;
    return resultWon && ouWon;
  }

  // ── Combo: BTTS & O/U 2.5 ──
  if (m === 'BTTSOU25') {
    const bttsPart = o[0]; // 'Y' or 'N'
    const ouPart = o[1];   // 'O' or 'U'
    const bttsWon = bttsPart === 'Y' ? btts : !btts;
    const ouWon = ouPart === 'O' ? total > 2.5 : total < 2.5;
    return bttsWon && ouWon;
  }

  // Unknown market → void
  return null;
}
```

Also update the call site in `settleNow()` (around line ~193) to pass HT scores:

Find the line:
```js
const won = legWon(leg, res.scoreHome, res.scoreAway);
```

Replace with:
```js
const won = legWon(leg, res.scoreHome, res.scoreAway, res.htHomeScore ?? null, res.htAwayScore ?? null);
```

Note: the old `sportsAdmin` result objects don't have `htHomeScore`/`htAwayScore` — they'll be `undefined`, which defaults to `null` in the function signature, correctly voiding HT-dependent legs for old-format results.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test server/src/services/__tests__/legWon.test.js`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/__tests__/legWon.test.js server/src/services/settlement.js
git commit -m "feat: extend legWon() with all catalog market grading (CS, DNB, 1H, HTFT, combos)

Exports legWon() for testing. Adds grading for: Correct Score with
OTHER_HOME/AWAY/DRAW buckets, Draw No Bet (void on draw), 1st Half
markets (void when HT scores missing), HT/FT combos, all O/U lines
via regex, Asian Handicap lines, and WINBTTS/WINOU25/BTTSOU25 combos."
```

---

### Task 2: Create the catalog bridge service

**Files:**
- Create: `server/src/services/catalogBridge.js`

- [ ] **Step 1: Write the bridge module**

Create `server/src/services/catalogBridge.js`:

```js
/**
 * Catalog Bridge — syncs catalog entities (matches.js, markets.js, results.js)
 * into the sportsAdmin.js custom-fixture format consumed by the player site,
 * bet placement, and settlement engine.
 *
 * The catalog is authoritative; sportsAdmin is a read projection.
 */
import * as Markets from '../db/markets.js';
import * as Sports from '../db/sports.js';
import * as Leagues from '../db/leagues.js';
import * as Teams from '../db/teams.js';
import {
  addCustomFixture,
  deleteCustomFixture,
  addCustomLeague,
  patchOverride,
  setSuspension,
  clearSuspension,
  setOddsOverride,
  setResult as sportsAdminSetResult,
} from '../db/sportsAdmin.js';
import {
  emitAll,
  emitOddsTick,
  emitAdmin,
} from './realtime.js';

/**
 * Convert a catalog match + its markets/selections into the old fixture format
 * that sportsAdmin.js and the player site expect.
 */
function buildFixtureFromCatalog(match) {
  const sport = Sports.getSport(match.sportId);
  const league = Leagues.getLeague(match.leagueId);
  const homeTeam = Teams.getTeam(match.homeTeamId);
  const awayTeam = Teams.getTeam(match.awayTeamId);
  const sportKey = sport?.key || match.sportId || 'football';

  const startsAt = new Date(match.startsAt);
  const now = new Date();
  const isToday = startsAt.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = startsAt.toDateString() === tomorrow.toDateString();
  const hours = String(startsAt.getHours()).padStart(2, '0');
  const minutes = String(startsAt.getMinutes()).padStart(2, '0');

  let dayLabel;
  if (isToday) dayLabel = 'Today';
  else if (isTomorrow) dayLabel = 'Tomorrow';
  else {
    const diff = Math.ceil((startsAt - now) / 86_400_000);
    dayLabel = diff > 0 ? `In ${diff} days` : 'Today';
  }

  const catalogMarkets = Markets.listMarkets(match.id);
  const marketsObj = {};
  for (const mkt of catalogMarkets) {
    const selections = Markets.listSelections(mkt.id);
    marketsObj[mkt.key] = {
      name: mkt.name,
      suspended: mkt.status !== 'open',
      selections: selections.map((sel) => ({
        key: sel.outcomeKey,
        label: sel.label,
        odds: sel.price,
        suspended: !sel.active,
      })),
    };
  }

  return {
    id: match.id,
    home: homeTeam?.name || match.homeTeamName || 'Home',
    away: awayTeam?.name || match.awayTeamName || 'Away',
    kickoff: `${hours}:${minutes}`,
    day: dayLabel,
    sport: sportKey,
    leagueId: league?.id || match.leagueId,
    leagueName: league?.name || '',
    isLive: match.status === 'live',
    finished: match.status === 'settled' || match.status === 'cancelled',
    suspended: match.status === 'suspended' || match.status === 'cancelled',
    scoreHome: match.homeScore,
    scoreAway: match.awayScore,
    venue: match.venue || '',
    markets: marketsObj,
    moreMarkets: catalogMarkets.length,
    _catalogManaged: true,
  };
}

/**
 * Ensure a custom league exists in sportsAdmin for the catalog league.
 */
function ensureCustomLeague(leagueId, sportKey) {
  const league = Leagues.getLeague(leagueId);
  if (!league) return;
  addCustomLeague({
    id: leagueId,
    name: league.name,
    region: league.country || 'international',
    sport: sportKey,
    crest: {
      style: 'background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#fff',
      label: (league.name || '').slice(0, 3).toUpperCase(),
    },
    matches: [],
    admin: true,
  });
}

// ── Public bridge functions called from route handlers ──

export function bridgeMatchCreated(match) {
  const sport = Sports.getSport(match.sportId);
  const sportKey = sport?.key || match.sportId || 'football';
  ensureCustomLeague(match.leagueId, sportKey);
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:created', {
    matchId: match.id,
    sport: sportKey,
    leagueId: match.leagueId,
  });
  emitAdmin('match:created', { matchId: match.id, sport: sportKey });
}

export function bridgeMatchUpdated(match) {
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:updated', { matchId: match.id });
}

export function bridgeMatchStatusChanged(match) {
  if (match.status === 'suspended' || match.status === 'cancelled') {
    setSuspension(match.id, { all: true });
  } else {
    clearSuspension(match.id);
  }
  const fixture = buildFixtureFromCatalog(match);
  addCustomFixture(fixture);

  emitAll('match:statusChanged', {
    matchId: match.id,
    status: match.status,
  });
  emitAdmin('match:statusChanged', { matchId: match.id, status: match.status });
}

export function bridgeMarketStatusChanged(matchId, market) {
  const match = { id: matchId };
  const selections = Markets.listSelections(market.id);
  if (market.status === 'suspended' || market.status === 'disabled') {
    setSuspension(matchId, {
      markets: [market.key],
    });
  }

  emitAll('market:statusChanged', {
    matchId,
    marketId: market.id,
    marketKey: market.key,
    status: market.status,
  });
}

export function bridgeSelectionPriceChanged(matchId, market, selection) {
  setOddsOverride(matchId, market.key, selection.outcomeKey, selection.price);

  emitOddsTick({
    fixtureId: matchId,
    market: market.key,
    selections: Markets.listSelections(market.id).map((s) => ({
      key: s.outcomeKey,
      label: s.label,
      odds: s.price,
      direction: s.id === selection.id ? 'changed' : 'same',
    })),
  });
}

export function bridgeResultConfirmed(matchId, result) {
  sportsAdminSetResult(
    matchId,
    result.homeScore,
    result.awayScore,
    'manual',
  );

  emitAll('result:confirmed', { matchId });
  emitAdmin('result:confirmed', {
    matchId,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });
}

export function bridgeResultEntered(matchId, result) {
  emitAdmin('result:entered', {
    matchId,
    status: result.status,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/catalogBridge.js
git commit -m "feat: add catalogBridge service — syncs catalog to sportsAdmin + emits events"
```

---

### Task 3: Wire bridge into management-matches route

**Files:**
- Modify: `server/src/routes/admin/management-matches.js`

- [ ] **Step 1: Add bridge calls to the matches route**

At the top of `server/src/routes/admin/management-matches.js`, add the import:

```js
import { bridgeMatchCreated, bridgeMatchUpdated, bridgeMatchStatusChanged } from '../../services/catalogBridge.js';
```

Then modify three route handlers:

**POST `/` (create match)** — after line `res.status(201).json(...)`, add bridge call. Find:
```js
  audit(req, { action: 'match.create', target: m.id, targetType: 'match', meta: { sportId, marketsCreated: markets.length } });
  res.status(201).json({ match: m, markets: { count: markets.length, selections: selections.length } });
```

Replace with:
```js
  audit(req, { action: 'match.create', target: m.id, targetType: 'match', meta: { sportId, marketsCreated: markets.length } });
  bridgeMatchCreated(m);
  res.status(201).json({ match: m, markets: { count: markets.length, selections: selections.length } });
```

**PATCH `/:id` (update match)** — find:
```js
  audit(req, { action: 'match.update', target: req.params.id, targetType: 'match' });
  res.json({ match: m });
```

Replace with:
```js
  audit(req, { action: 'match.update', target: req.params.id, targetType: 'match' });
  bridgeMatchUpdated(m);
  res.json({ match: m });
```

**POST `/:id/status` (status transition)** — find:
```js
  audit(req, { action: `match.status.${req.body.status}`, target: req.params.id, targetType: 'match' });
  res.json({ match: updated });
```

Replace with:
```js
  audit(req, { action: `match.status.${req.body.status}`, target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(updated);
  res.json({ match: updated });
```

**POST `/:id/cancel`** — find:
```js
  audit(req, { action: 'match.cancel', target: req.params.id, targetType: 'match' });
  res.json({ match: m });
```

Replace with:
```js
  audit(req, { action: 'match.cancel', target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(m);
  res.json({ match: m });
```

**POST `/:id/archive`** — find:
```js
  audit(req, { action: 'match.archive', target: req.params.id, targetType: 'match' });
  res.json({ match: m });
```

Replace with:
```js
  audit(req, { action: 'match.archive', target: req.params.id, targetType: 'match' });
  bridgeMatchStatusChanged(m);
  res.json({ match: m });
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/admin/management-matches.js
git commit -m "feat: wire catalogBridge into match management routes"
```

---

### Task 4: Wire bridge into management-markets route

**Files:**
- Modify: `server/src/routes/admin/management-markets.js`

- [ ] **Step 1: Add bridge calls to the markets route**

At the top of `server/src/routes/admin/management-markets.js`, add:

```js
import { bridgeMarketStatusChanged, bridgeSelectionPriceChanged } from '../../services/catalogBridge.js';
```

**PATCH `/:matchId/:marketId` (market status/margin)** — find:
```js
  audit(req, { action: 'market.update', target: req.params.marketId, targetType: 'market' });
  res.json({ market: m });
```

Replace with:
```js
  audit(req, { action: 'market.update', target: req.params.marketId, targetType: 'market' });
  if (req.body.status) bridgeMarketStatusChanged(req.params.matchId, m);
  res.json({ market: m });
```

**PATCH `/:matchId/:marketId/selections/:selId` (price update)** — find:
```js
  audit(req, { action: 'selection.price.update', target: req.params.selId, targetType: 'selection' });
  res.json({ selection: s });
```

Replace with:
```js
  const market = Markets.getMarket(req.params.marketId);
  audit(req, { action: 'selection.price.update', target: req.params.selId, targetType: 'selection' });
  bridgeSelectionPriceChanged(req.params.matchId, market, s);
  res.json({ selection: s });
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/admin/management-markets.js
git commit -m "feat: wire catalogBridge into market management routes"
```

---

### Task 5: Wire bridge into management-results route + immediate settlement

**Files:**
- Modify: `server/src/routes/admin/management-results.js`

- [ ] **Step 1: Add bridge calls and immediate settlement**

At the top of `server/src/routes/admin/management-results.js`, add:

```js
import { bridgeResultEntered, bridgeResultConfirmed } from '../../services/catalogBridge.js';
import { settleNow } from '../../services/settlement.js';
```

**POST `/:matchId/enter` (enter provisional result)** — find:
```js
  audit(req, { action: 'result.enter', target: req.params.matchId, targetType: 'result', meta: { status: result.status } });
  res.status(201).json({ result });
```

Replace with:
```js
  audit(req, { action: 'result.enter', target: req.params.matchId, targetType: 'result', meta: { status: result.status } });
  bridgeResultEntered(req.params.matchId, result);
  res.status(201).json({ result });
```

**POST `/:matchId/confirm` (confirm result → triggers settlement)** — The existing handler has a bug: `confirmResult()` returns the record with `status: 'confirmed'` in both the "just confirmed" and "already was confirmed" cases, so the 409 check always throws. Fix by checking status *before* calling `confirmResult()`.

Replace the entire route handler body (the callback function) with:

```js
(req, res) => {
  const existing = Results.getResult(req.params.matchId);
  if (!existing) throw notFound('No result found for this match');
  if (existing.status === 'confirmed') throw conflict('Result is already confirmed');

  const result = Results.confirmResult(req.params.matchId, req.admin.id);
  audit(req, { action: 'result.confirm', target: req.params.matchId, targetType: 'result' });
  bridgeResultConfirmed(req.params.matchId, result);
  const settled = settleNow();
  res.json({ result, settlementTriggered: true, settled });
}
```

**POST `/:matchId/override` (override result)** — find:
```js
  audit(req, { action: 'result.override', target: req.params.matchId, targetType: 'result' });
  res.json({ result });
```

Replace with:
```js
  audit(req, { action: 'result.override', target: req.params.matchId, targetType: 'result' });
  bridgeResultEntered(req.params.matchId, result);
  res.json({ result });
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/admin/management-results.js
git commit -m "feat: wire catalogBridge + immediate settleNow() into results route"
```

---

### Task 6: Manual integration test

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd server && npm run dev
```

Verify in logs: `kv_store: using JSON files` or `using Postgres`, `Realtime: Socket.IO attached`, `auto-settle` sweep runs.

- [ ] **Step 2: Verify the bridge via curl (create sport → league → teams → match)**

```bash
# Login as admin (assumes seeded super_admin exists)
TOKEN=$(curl -s -X POST http://localhost:5000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@oddsify.com","password":"admin123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).accessToken))")

# Create a sport
curl -s -X POST http://localhost:5000/api/admin/management/sports \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Football","key":"football"}' | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).sport.id"

# Create teams
curl -s -X POST http://localhost:5000/api/admin/management/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Team A","sportId":"<SPORT_ID>"}'

curl -s -X POST http://localhost:5000/api/admin/management/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Team B","sportId":"<SPORT_ID>"}'

# Create league
curl -s -X POST http://localhost:5000/api/admin/management/leagues \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test League","sportId":"<SPORT_ID>","country":"GH"}'

# Create match (should auto-attach markets AND bridge to sportsAdmin)
curl -s -X POST http://localhost:5000/api/admin/management/matches \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"leagueId":"<LEAGUE_ID>","homeTeamId":"<TEAM_A_ID>","awayTeamId":"<TEAM_B_ID>","startTime":"2026-06-18T15:00:00Z","sportId":"<SPORT_ID>"}'
```

Verify: response includes `markets.count > 0`. Check server logs for `match:created` event emission.

- [ ] **Step 3: Verify match appears in player snapshot**

```bash
curl -s http://localhost:5000/api/odds?sport=football | node -p "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); d.leagues.map(l=>l.name+': '+l.matches.length+' matches').join(', ')"
```

Verify: the "Test League" appears with 1 match containing the auto-attached markets.

- [ ] **Step 4: Verify result confirmation triggers settlement**

```bash
# Enter provisional result
curl -s -X POST http://localhost:5000/api/admin/management/results/<MATCH_ID>/enter \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"homeScore":2,"awayScore":1,"reason":"Final whistle"}'

# Confirm result (should trigger immediate settlement)
curl -s -X POST http://localhost:5000/api/admin/management/results/<MATCH_ID>/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Verify: response includes `settlementTriggered: true` and `settled` object with win/loss counts.

- [ ] **Step 5: Commit nothing (verification only)**

All tasks complete.
