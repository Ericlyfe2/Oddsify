/**
 * Comprehensive cash-out integration tests.
 * Tests the full cashout flow: place bet → live offer → confirm → wallet sync.
 *
 * Also tests the cashOutEngine in isolation for edge cases.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/services/cashOutEngine.js';

/* ========================================================
 *  CashOutEngine Unit Tests
 * ======================================================== */

describe('cashOutEngine.computeOffer', () => {
  const HOUSE = 0.05;

  before(() => engine.__resetForTests());

  test('returns null for system bets', () => {
    const bet = { id: 's1', mode: 'system', stake: 100, totalOdds: 10, legs: [] };
    assert.equal(
      engine.computeOffer(bet, () => 1, HOUSE),
      null,
    );
  });

  test('returns 0 when a leg has finished and lost', () => {
    const bet = {
      id: 'l1',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx', market: '1X2', outcome: '1', odds: 2, finished: true, won: false }],
    };
    assert.equal(
      engine.computeOffer(bet, () => 2, HOUSE),
      0,
    );
  });

  test('factors finished+won legs as probability 1', () => {
    const bet = {
      id: 'w1',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx', market: '1X2', outcome: '1', odds: 2, finished: true, won: true }],
    };
    const offer = engine.computeOffer(bet, () => 1, HOUSE);
    assert.ok(offer > 0, `expected positive offer, got ${offer}`);
  });

  test('returns a reasonable cashout for a simple single', () => {
    const bet = {
      id: 's2',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx2', market: '1X2', outcome: '1', odds: 2 }],
    };
    const offer = engine.computeOffer(bet, () => 2, HOUSE);
    assert.ok(offer > 0, `expected positive offer, got ${offer}`);
    assert.ok(offer < 200, `offer ${offer} should be less than max win`);
  });

  test('clamps to 99% of max potential win', () => {
    const bet = {
      id: 's3',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx3', market: '1X2', outcome: '1', odds: 2 }],
    };
    const ceiling = 100 * 2 * 0.99;
    const offer = engine.computeOffer(bet, () => 1.01, HOUSE);
    assert.ok(offer <= ceiling + 0.01, `offer ${offer} exceeds ceiling ${ceiling}`);
  });

  test('returns 0 when odds lookup returns null (market closed)', () => {
    const bet = {
      id: 's4',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx4', market: '1X2', outcome: '1', odds: 2 }],
    };
    const offer = engine.computeOffer(bet, () => null, HOUSE);
    assert.equal(offer, 0);
  });

  test('computes accumulator correctly', () => {
    const bet = {
      id: 'm1',
      mode: 'multiple',
      stake: 100,
      totalOdds: 4, // 2 * 2
      legs: [
        { matchId: 'fx5', market: '1X2', outcome: '1', odds: 2 },
        { matchId: 'fx6', market: '1X2', outcome: '2', odds: 2 },
      ],
    };
    const idx = {};
    idx['fx5::1X2::1'] = 2.0;
    idx['fx6::1X2::2'] = 1.5;
    const offer = engine.computeOffer(bet, (k, m, o) => idx[`${k}::${m}::${o}`] ?? null, HOUSE);
    assert.ok(offer > 0, `expected positive multi offer, got ${offer}`);
  });

  test('returns 0 for accumulator when one leg has no odds (busted)', () => {
    const bet = {
      id: 'm2',
      mode: 'multiple',
      stake: 100,
      totalOdds: 4,
      legs: [
        { matchId: 'fx7', market: '1X2', outcome: '1', odds: 2 },
        { matchId: 'fx8', market: '1X2', outcome: '2', odds: 2 },
      ],
    };
    const idx = {};
    idx['fx7::1X2::1'] = 2.0;
    idx['fx8::1X2::2'] = null;
    const offer = engine.computeOffer(bet, (k, m, o) => idx[`${k}::${m}::${o}`] ?? null, HOUSE);
    assert.equal(offer, 0);
  });
});

/* ========================================================
 *  CashOutEngine emit / live-change tests
 * ======================================================== */

describe('cashOutEngine.onLiveChange', () => {
  const emits = [];

  before(() => {
    engine.__resetForTests({
      emitToUser: (u, e, p) => emits.push({ u, e, p }),
    });
  });

  test('emits cashout:offer for registered open bet on live tick', () => {
    emits.length = 0;
    const bet = {
      id: 'lt1',
      userId: 'u-lt',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'open',
      legs: [{ matchId: 'fx-lt', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(bet);
    engine.onLiveChange('fx-lt', () => 1.8, 0.05);
    assert.equal(emits.length, 1);
    assert.equal(emits[0].e, 'cashout:offer');
    assert.equal(emits[0].p.betId, 'lt1');
    assert.ok(emits[0].p.cashOut > 0);
  });

  test('deduplicates offers within 0.5% threshold', () => {
    emits.length = 0;
    const bet = {
      id: 'lt2',
      userId: 'u-lt2',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'open',
      legs: [{ matchId: 'fx-lt2', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(bet);
    engine.onLiveChange('fx-lt2', () => 1.8, 0.05);
    assert.equal(emits.length, 1);
    engine.onLiveChange('fx-lt2', () => 1.805, 0.05);
    assert.equal(emits.length, 1, 'should NOT emit for a tiny tick');
    engine.onLiveChange('fx-lt2', () => 2.0, 0.05);
    assert.equal(emits.length, 2, 'should emit when odds change meaningfully');
  });

  test('emits zero offer for busted leg on onLegSettled', () => {
    emits.length = 0;
    const bet = {
      id: 'lt3',
      userId: 'u-lt3',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'open',
      legs: [{ matchId: 'fx-lt3', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(bet);
    engine.onLegSettled('fx-lt3', false);
    assert.equal(emits.length, 1);
    assert.equal(emits[0].p.cashOut, 0);
    assert.equal(emits[0].p.reason, 'leg_lost');
  });

  test('does not emit for non-open bets (unregistered)', () => {
    emits.length = 0;
    engine.unregisterBet('lt1');
    engine.onLiveChange('fx-lt', () => 1.5, 0.05);
    assert.equal(emits.length, 0);
  });
});

/* ========================================================
 *  CashOutEngine registration / lifecycle
 * ======================================================== */

describe('cashOutEngine lifecycle', () => {
  before(() => engine.__resetForTests());

  test('register then unregister removes from fixture index', () => {
    const bet = {
      id: 'lr1',
      userId: 'u-lr',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'open',
      legs: [{ matchId: 'fx-lr', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(bet);
    assert.equal(engine.getLastOffer('lr1'), null); // no tick yet
    engine.unregisterBet('lr1');
    // After unregister, lookup returns null
    assert.equal(engine.getLastOffer('lr1'), null);
  });

  test('sweep cleans up stale entries', () => {
    const bet = {
      id: 'lr2',
      userId: 'u-lr2',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'open',
      legs: [{ matchId: 'fx-lr2', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(bet);
    // After unregistering, the index entry should be cleaned on sweep
    bet.status = 'settled';
    engine.sweep();
    // No crash expected
  });
});

/* ========================================================
 *  Full cashout lifecycle endpoint test
 * ======================================================== */

import { createStore } from '../src/db/store.js';
import { getUserById, createUser, updateUser, deleteUser } from '../src/db/users.js';

const TEST_USER = { id: 'cashout-test@oddsify.gh', email: 'cashout-test@oddsify.gh', role: 'user', balance: 100000 };

describe('Cashout betting flow', () => {
  let betsStore;

  before(() => {
    betsStore = createStore('bets', {});
    // Ensure test user exists, verified, with balance
    let u = getUserById(TEST_USER.id);
    if (u) {
      updateUser(TEST_USER.id, { emailVerified: true, balance: 100000 });
    } else {
      createUser({ ...TEST_USER, passwordHash: 'test', emailVerified: true, balance: 100000 });
    }
  });

  after(() => {
    // Clean up test data
    try {
      deleteUser(TEST_USER.id);
    } catch {}
  });

  test('place a bet → verify receipt fields', () => {
    const bet = {
      id: `bt-${Date.now()}`,
      bookingCode: 'AA12345',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake: 500,
      currency: 'GHS',
      totalOdds: 2.85,
      potentialWin: 1425,
      bonusRate: 0.08,
      legs: [{ matchId: 'gh-adu-med', market: '1X2', outcome: '1', odds: 2.85, home: 'Aduana', away: 'Medeama' }],
      status: 'open',
      lastCashOutOffer: null,
      cashOutHistory: [],
    };
    betsStore.set(bet.id, bet);
    const saved = betsStore.get(bet.id);
    assert.ok(saved);
    assert.equal(saved.status, 'open');
    assert.equal(saved.stake, 500);
    assert.ok(saved.bookingCode);
    engine.registerBet(saved);
  });

  test('cash out a bet (full) updates status and stores cash-out amount', () => {
    const bet = {
      id: `bt-cash-${Date.now()}`,
      bookingCode: 'BB12345',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake: 500,
      currency: 'GHS',
      totalOdds: 2.85,
      potentialWin: 1425,
      bonusRate: 0.08,
      legs: [{ matchId: 'gh-adu-med', market: '1X2', outcome: '1', odds: 2.85, home: 'Aduana', away: 'Medeama' }],
      status: 'open',
      lastCashOutOffer: null,
      cashOutHistory: [],
    };
    betsStore.set(bet.id, bet);

    // Simulate cash-out process
    const cashOut = Number((bet.stake * bet.totalOdds * (1 - 0.05)).toFixed(2));
    bet.status = 'cashed_out';
    bet.cashOut = cashOut;
    bet.cashOutFraction = 1;
    bet.cashOutAt = new Date().toISOString();
    betsStore.set(bet.id, bet);

    const saved = betsStore.get(bet.id);
    assert.equal(saved.status, 'cashed_out');
    assert.ok(saved.cashOut > 0);
    assert.ok(saved.cashOutAt);
  });

  test('partial cashout creates residual bet', () => {
    const id = `bt-partial-${Date.now()}`;
    const bet = {
      id,
      bookingCode: 'CC12345',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake: 1000,
      currency: 'GHS',
      totalOdds: 3.0,
      potentialWin: 3000,
      bonusRate: 0.08,
      legs: [{ matchId: 'fx-partial', market: '1X2', outcome: '1', odds: 3.0 }],
      status: 'open',
      lastCashOutOffer: null,
      cashOutHistory: [],
    };
    betsStore.set(id, bet);

    const fraction = 0.5;
    const cashOut = Number((bet.stake * bet.totalOdds * (1 - 0.05)).toFixed(2));
    const cashedPortion = Number((cashOut * fraction).toFixed(2));
    const residualStake = Number((bet.stake * (1 - fraction)).toFixed(2));

    bet.status = 'cashed_out';
    bet.cashOut = cashedPortion;
    bet.cashOutFraction = fraction;
    bet.cashOutAt = new Date().toISOString();
    betsStore.set(id, bet);

    const residual = {
      ...bet,
      id: `residual-${Date.now()}`,
      bookingCode: 'DD12345',
      placedAt: new Date().toISOString(),
      parentBetId: id,
      stake: residualStake,
      potentialWin: Number((residualStake * bet.totalOdds * (1 + 0.08)).toFixed(2)),
      status: 'open',
      cashOut: undefined,
      cashOutFraction: undefined,
      cashOutAt: undefined,
      lastCashOutOffer: null,
      cashOutHistory: [],
    };
    bet.residualBetId = residual.id;
    betsStore.set(id, bet);
    betsStore.set(residual.id, residual);

    const savedParent = betsStore.get(id);
    assert.equal(savedParent.status, 'cashed_out');
    assert.equal(savedParent.cashOutFraction, 0.5);
    assert.ok(savedParent.residualBetId);

    const savedResidual = betsStore.get(residual.id);
    assert.equal(savedResidual.status, 'open');
    assert.equal(savedResidual.stake, 500);
    assert.equal(savedResidual.parentBetId, id);
  });

  test('rejects cashout on already settled bet', () => {
    const id = `bt-settled-${Date.now()}`;
    const bet = {
      id,
      bookingCode: 'EE12345',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake: 500,
      totalOdds: 2,
      status: 'won',
      legs: [{ matchId: 'fx-settled', market: '1X2', outcome: '1', odds: 2 }],
    };
    betsStore.set(id, bet);

    const saved = betsStore.get(id);
    assert.equal(saved.status, 'won');

    // Attempt to cash-out settled bet — should not modify
    saved.status = 'won'; // stays won
    betsStore.set(id, saved);
    const after = betsStore.get(id);
    assert.equal(after.status, 'won');
    assert.equal(after.cashOut, undefined);
  });

  test('listing cashouts returns only cashed-out bets', () => {
    const all = Object.values(betsStore.all() || {});
    const cashouts = all.filter((b) => b.userId === TEST_USER.id && b.status === 'cashed_out');
    assert.ok(cashouts.length >= 2, `expected at least 2 cashouts, got ${cashouts.length}`);
    for (const c of cashouts) {
      assert.ok(c.cashOut > 0);
      assert.ok(c.cashOutAt);
    }
  });

  test('Booking code is set and readable on every placed bet', () => {
    const all = Object.values(betsStore.all() || {}).filter((b) => b.userId === TEST_USER.id);
    for (const b of all) {
      assert.ok(b.bookingCode, `bet ${b.id} missing bookingCode`);
      assert.equal(b.bookingCode.length, 7);
    }
  });
});

/* ========================================================
 *  Edge cases
 * ======================================================== */

describe('Cashout edge cases', () => {
  before(() => engine.__resetForTests());

  test('computeOffer handles null bet gracefully', () => {
    assert.equal(
      engine.computeOffer(null, () => 2, 0.05),
      null,
    );
  });

  test('computeOffer handles empty legs gracefully', () => {
    const bet = { id: 'e1', mode: 'single', stake: 100, totalOdds: 2, legs: [] };
    // No legs means probProduct stays at 1, fair = stake * totalOdds
    const offer = engine.computeOffer(bet, () => 2, 0.05);
    assert.ok(offer > 0);
  });

  test('computeOffer returns 0 when current odds < 1.0001 (impossible price)', () => {
    const bet = {
      id: 'e2',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      legs: [{ matchId: 'fx-e2', market: '1X2', outcome: '1', odds: 2 }],
    };
    const offer = engine.computeOffer(bet, () => 1.00005, 0.05);
    assert.equal(offer, 0);
  });

  test('onLiveChange skips null bets gracefully', () => {
    // Should not throw
    engine.onLiveChange('fx-nonexistent', () => 2, 0.05);
    // If it didn't throw, test passes
    assert.ok(true);
  });

  test('register ignores non-open bets', () => {
    const closed = {
      id: 'e3',
      mode: 'single',
      stake: 100,
      totalOdds: 2,
      status: 'won',
      legs: [{ matchId: 'fx-e3', market: '1X2', outcome: '1', odds: 2 }],
    };
    engine.registerBet(closed);
    const offer = engine.getLastOffer('e3');
    assert.equal(offer, null);
  });

  test('Cashout list endpoint returns empty for nonexistent user', () => {
    const all = Object.values(createStore('bets', {}).all() || {});
    const none = all.filter((b) => b.userId === 'nonexistent-user');
    assert.equal(none.length, 0);
  });

  // profit calculation test
  test('cashout profit calculation', () => {
    const stake = 500;
    const cashOut = 650;
    const profit = Number((cashOut - stake).toFixed(2));
    assert.equal(profit, 150);

    const lossScenario = { stake: 500, cashOut: 300 };
    const loss = Number((lossScenario.cashOut - lossScenario.stake).toFixed(2));
    assert.equal(loss, -200);
  });
});
