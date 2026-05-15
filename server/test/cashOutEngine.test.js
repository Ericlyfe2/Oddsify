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
