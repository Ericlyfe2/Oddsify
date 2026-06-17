import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { legWon } from '../settlement.js';

describe('legWon — market grading', () => {
  // ── 1X2 (Match Winner)
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

  // ── Double Chance
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

  // ── Draw No Bet
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

  // ── Over/Under variants
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

  // ── BTTS
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

  // ── Correct Score
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

  // ── Asian Handicap
  describe('AH (Asian Handicap)', () => {
    it('AH1: Home wins by 2+ → H-1 wins', () => {
      assert.strictEqual(legWon({ market: 'AH1', outcome: 'H-1' }, 3, 1), true);
    });
    it('AH1: Home wins by 1 → H-1 loses', () => {
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

  // ── 1st Half markets
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

  // ── HT/FT
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

  // ── Combo: Result & BTTS
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

  // ── Combo: Result & O/U 2.5
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

  // ── Combo: BTTS & O/U 2.5
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

  // ── Unknown market → void
  describe('Unknown market', () => {
    it('Unknown market returns null (void)', () => {
      assert.strictEqual(legWon({ market: 'UNKNOWN', outcome: 'X' }, 1, 0), null);
    });
  });
});
