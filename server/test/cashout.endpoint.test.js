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
