import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* ── Inline versions of the ordering utilities (mirrors client/src/lib/marketUtils.js) ── */

const ORDER_1X2 = ['1', 'X', '2'];

function ensure1X2Order(selections) {
  if (!selections || !Array.isArray(selections)) return selections || [];
  const has1X2Keys = selections.some((s) => ['1', 'X', '2'].includes(s?.key));
  if (!has1X2Keys) return selections;
  const keyMap = {};
  for (const s of selections) keyMap[s.key] = s;
  const ordered = [];
  for (const k of ORDER_1X2) {
    if (keyMap[k]) ordered.push(keyMap[k]);
  }
  for (const s of selections) {
    if (!ORDER_1X2.includes(s.key)) ordered.push(s);
  }
  return ordered;
}

function sortOddsEntries(odds) {
  if (!odds) return [];
  const entries = Object.entries(odds);
  const has1X2 = entries.some(([k]) => ['1', 'X', '2'].includes(k));
  if (!has1X2) return entries;
  const keyMap = {};
  for (const [k, v] of entries) keyMap[k] = v;
  const ordered = [];
  for (const k of ORDER_1X2) {
    if (keyMap[k] !== undefined) ordered.push([k, keyMap[k]]);
  }
  for (const [k, v] of entries) {
    if (!ORDER_1X2.includes(k)) ordered.push([k, v]);
  }
  return ordered;
}

/* ── Tests ── */

describe('Market ordering utilities', () => {

  describe('ensure1X2Order (selections array)', () => {

    it('should return selections in 1, X, 2 order when input is 1, 2, X', () => {
      const input = [
        { key: '1', label: 'Home', odds: 1.85 },
        { key: '2', label: 'Away', odds: 4.20 },
        { key: 'X', label: 'Draw', odds: 3.60 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[0].key, '1');
      assert.equal(result[1].key, 'X');
      assert.equal(result[2].key, '2');
    });

    it('should return selections in 1, X, 2 order when input is 2, X, 1', () => {
      const input = [
        { key: '2', label: 'Away', odds: 4.20 },
        { key: 'X', label: 'Draw', odds: 3.60 },
        { key: '1', label: 'Home', odds: 1.85 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[0].key, '1');
      assert.equal(result[1].key, 'X');
      assert.equal(result[2].key, '2');
    });

    it('should return selections in 1, X, 2 order when input is X, 2, 1', () => {
      const input = [
        { key: 'X', label: 'Draw', odds: 3.60 },
        { key: '2', label: 'Away', odds: 4.20 },
        { key: '1', label: 'Home', odds: 1.85 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[0].key, '1');
      assert.equal(result[1].key, 'X');
      assert.equal(result[2].key, '2');
    });

    it('should keep Draw (X) in the middle always', () => {
      const input = [
        { key: '2', label: 'Away', odds: 4.20 },
        { key: '1', label: 'Home', odds: 1.85 },
        { key: 'X', label: 'Draw', odds: 3.60 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[1].key, 'X');
    });

    it('should preserve non-1X2 selections after the ordered ones', () => {
      const input = [
        { key: '2', label: 'Away', odds: 4.20 },
        { key: 'YES', label: 'Yes', odds: 2.0 },
        { key: '1', label: 'Home', odds: 1.85 },
        { key: 'X', label: 'Draw', odds: 3.60 },
        { key: 'NO', label: 'No', odds: 1.80 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[0].key, '1');
      assert.equal(result[1].key, 'X');
      assert.equal(result[2].key, '2');
      // Non-1X2 keys come after
      assert.equal(result[3].key, 'YES');
      assert.equal(result[4].key, 'NO');
    });

    it('should handle empty arrays', () => {
      assert.deepEqual(ensure1X2Order([]), []);
    });

    it('should handle null/undefined', () => {
      assert.deepEqual(ensure1X2Order(null), []);
      assert.deepEqual(ensure1X2Order(undefined), []);
    });

    it('should not reorder non-1X2 markets', () => {
      const input = [
        { key: 'Over', odds: 2.0 },
        { key: 'Under', odds: 1.8 },
      ];
      const result = ensure1X2Order(input);
      assert.equal(result[0].key, 'Over');
      assert.equal(result[1].key, 'Under');
    });

  });

  describe('sortOddsEntries (odds map)', () => {

    it('should return odds entries in 1, X, 2 order', () => {
      const odds = { '2': 4.20, '1': 1.85, 'X': 3.60 };
      const entries = sortOddsEntries(odds);
      assert.equal(entries[0][0], '1');
      assert.equal(entries[1][0], 'X');
      assert.equal(entries[2][0], '2');
    });

    it('should keep Draw (X) as the middle entry', () => {
      const odds = { '2': 4.20, '1': 1.85, 'X': 3.60 };
      const entries = sortOddsEntries(odds);
      assert.equal(entries[1][0], 'X');
      assert.equal(entries[1][1], 3.60);
    });

    it('should handle empty odds', () => {
      assert.deepEqual(sortOddsEntries({}), []);
    });

    it('should handle null odds', () => {
      assert.deepEqual(sortOddsEntries(null), []);
    });

    it('should not reorder non-1X2 market odds', () => {
      const odds = { Over: 2.0, Under: 1.8 };
      const entries = sortOddsEntries(odds);
      assert.equal(entries[0][0], 'Over');
      assert.equal(entries[1][0], 'Under');
    });

  });

});
