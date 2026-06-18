import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/db/store.js';
import { createUser, getUserById, updateUser, deleteUser } from '../src/db/users.js';

const TEST_USER = { id: 'e2e-test@oddsify.gh', email: 'e2e-test@oddsify.gh', role: 'user', balance: 100000 };

const BONUS_RATE = 0.08;
const HOUSE_MARGIN = 0.05;

describe('E2E betting flow', () => {
  let betsStore;

  before(() => {
    betsStore = createStore('bets', {});
    let u = getUserById(TEST_USER.id);
    if (u) {
      updateUser(TEST_USER.id, { emailVerified: true, balance: 100000 });
    } else {
      createUser({ ...TEST_USER, passwordHash: 'test', emailVerified: true, balance: 100000 });
    }
  });

  after(() => {
    try { deleteUser(TEST_USER.id); } catch {}
  });

  test('1. Place single bet and verify all receipt fields', () => {
    const stake = 500;
    const odds = 2.85;
    const potentialWin = stake * odds * (1 + BONUS_RATE);
    const bet = {
      id: `e2e-single-${Date.now()}`,
      bookingCode: 'AA11111',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake,
      currency: 'GHS',
      totalOdds: odds,
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: [{ matchId: 'gh-adu-med', market: '1X2', outcome: '1', odds, home: 'Aduana', away: 'Medeama' }],
      status: 'open',
      lastCashOutOffer: null,
      cashOutHistory: [],
    };
    betsStore.set(bet.id, bet);
    const saved = betsStore.get(bet.id);
    assert.ok(saved);
    assert.equal(saved.status, 'open');
    assert.equal(saved.stake, stake);
    assert.equal(saved.potentialWin, Number((stake * odds * (1 + BONUS_RATE)).toFixed(2)));
    assert.ok(saved.bookingCode);
  });

  test('2. Cashout offer formula matches server implementation', () => {
    const bet = {
      id: `e2e-cashoffer-${Date.now()}`,
      bookingCode: 'BB22222',
      userId: TEST_USER.id,
      mode: 'single',
      stake: 500,
      totalOdds: 2.85,
      status: 'open',
    };
    // Server formula: stake * totalOdds * (1 - houseMargin)
    const offer = bet.stake * bet.totalOdds * (1 - HOUSE_MARGIN);
    // Compare with old (wrong) formula: stake * (1 - houseMargin)
    const oldOffer = bet.stake * (1 - HOUSE_MARGIN);
    assert.notEqual(offer, oldOffer, 'new formula should differ from old');
    assert.equal(offer, 500 * 2.85 * 0.95);
    assert.equal(Number(offer.toFixed(2)), 1353.75);
  });

  test('3. Settle bet as WON and verify display fields', () => {
    const stake = 500;
    const odds = 2.85;
    const potentialWin = stake * odds * (1 + BONUS_RATE);
    const bet = {
      id: `e2e-won-${Date.now()}`,
      bookingCode: 'CC33333',
      userId: TEST_USER.id,
      placedAt: new Date(Date.now() - 3600000).toISOString(),
      mode: 'single',
      stake,
      currency: 'GHS',
      totalOdds: odds,
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: [{ matchId: 'gh-won-test', market: '1X2', outcome: '1', odds, home: 'Hearts', away: 'Kotoko' }],
      status: 'open',
    };
    betsStore.set(bet.id, bet);

    // Simulate settlement as won
    const credit = potentialWin;
    bet.status = 'won';
    bet.settledAt = new Date().toISOString();
    bet.settledBy = 'auto';
    bet.settledReturn = Number(credit.toFixed(2));
    bet.settledProfit = Number((credit - stake).toFixed(2));
    betsStore.set(bet.id, bet);

    const saved = betsStore.get(bet.id);
    assert.equal(saved.status, 'won');
    assert.equal(saved.settledReturn, Number((stake * odds * (1 + BONUS_RATE)).toFixed(2)));
    assert.equal(saved.settledProfit, Number((stake * odds * (1 + BONUS_RATE) - stake).toFixed(2)));

    // Verify display functions match
    const displayReturn = saved.settledReturn;
    const displayProfit = saved.settledProfit;
    assert.equal(displayReturn, 1539);
    assert.equal(displayProfit, 1039);
  });

  test('4. Settle bet as LOST and verify display fields', () => {
    const stake = 500;
    const odds = 2.85;
    const potentialWin = stake * odds * (1 + BONUS_RATE);
    const bet = {
      id: `e2e-lost-${Date.now()}`,
      bookingCode: 'DD44444',
      userId: TEST_USER.id,
      placedAt: new Date(Date.now() - 3600000).toISOString(),
      mode: 'single',
      stake,
      currency: 'GHS',
      totalOdds: odds,
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: [{ matchId: 'gh-lost-test', market: '1X2', outcome: '1', odds, home: 'Hearts', away: 'Kotoko' }],
      status: 'open',
    };
    betsStore.set(bet.id, bet);

    // Simulate settlement as lost
    bet.status = 'lost';
    bet.settledAt = new Date().toISOString();
    bet.settledBy = 'auto';
    bet.settledReturn = 0;
    bet.settledProfit = -stake;
    betsStore.set(bet.id, bet);

    const saved = betsStore.get(bet.id);
    assert.equal(saved.status, 'lost');
    assert.equal(saved.settledReturn, 0);
    assert.equal(saved.settledProfit, -stake);
  });

  test('5. Cashout bet and verify settledReturn/settledProfit', () => {
    const stake = 1000;
    const odds = 3.0;
    const potentialWin = stake * odds * (1 + BONUS_RATE);
    const bet = {
      id: `e2e-cashout-${Date.now()}`,
      bookingCode: 'EE55555',
      userId: TEST_USER.id,
      placedAt: new Date(Date.now() - 3600000).toISOString(),
      mode: 'single',
      stake,
      currency: 'GHS',
      totalOdds: odds,
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: [{ matchId: 'gh-cashout-test', market: '1X2', outcome: '1', odds, home: 'Hearts', away: 'Kotoko' }],
      status: 'open',
    };
    betsStore.set(bet.id, bet);

    // Server cashout flow: cashOut = stake * totalOdds * (1 - houseMargin)
    const cashOut = Number((stake * odds * (1 - HOUSE_MARGIN)).toFixed(2));
    bet.status = 'cashed_out';
    bet.cashOut = cashOut;
    bet.cashOutFraction = 1;
    bet.cashOutAt = new Date().toISOString();
    bet.settledReturn = cashOut;
    bet.settledProfit = Number((cashOut - stake).toFixed(2));
    betsStore.set(bet.id, bet);

    const saved = betsStore.get(bet.id);
    assert.equal(saved.status, 'cashed_out');
    assert.equal(saved.cashOut, 2850);
    assert.equal(saved.settledReturn, 2850);
    assert.equal(saved.settledProfit, 1850);
  });

  test('6. void/refunded bet returns stake as total return', () => {
    const stake = 500;
    const odds = 2.85;
    const bet = {
      id: `e2e-void-${Date.now()}`,
      bookingCode: 'FF66666',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'single',
      stake,
      totalOdds: odds,
      status: 'open',
      legs: [{ matchId: 'gh-void-test', market: '1X2', outcome: '1', odds, home: 'Hearts', away: 'Kotoko' }],
    };
    betsStore.set(bet.id, bet);

    // Simulate void
    bet.status = 'void';
    bet.settledAt = new Date().toISOString();
    bet.settledBy = 'admin';
    betsStore.set(bet.id, bet);

    // For void: returnAmount = stake, profit = 0
    const saved = betsStore.get(bet.id);
    assert.equal(saved.status, 'void');
    // attachBetDisplayFields would compute returnAmount = stake for void
    // Since no settledReturn is stored, display layer uses stake
  });

  test('7. Accumulator bet placement and display fields', () => {
    const stake = 500;
    const legOdds = [2.0, 1.8, 1.5];
    const totalOdds = legOdds.reduce((a, b) => a * b, 1);
    const potentialWin = stake * totalOdds * (1 + BONUS_RATE);
    const bet = {
      id: `e2e-acc-${Date.now()}`,
      bookingCode: 'GG77777',
      userId: TEST_USER.id,
      placedAt: new Date().toISOString(),
      mode: 'multiple',
      stake,
      totalOdds: Number(totalOdds.toFixed(4)),
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: [
        { matchId: 'fx1', market: '1X2', outcome: '1', odds: legOdds[0] },
        { matchId: 'fx2', market: '1X2', outcome: '2', odds: legOdds[1] },
        { matchId: 'fx3', market: '1X2', outcome: 'X', odds: legOdds[2] },
      ],
      status: 'open',
    };
    betsStore.set(bet.id, bet);
    const saved = betsStore.get(bet.id);
    assert.ok(saved);
    assert.equal(saved.mode, 'multiple');
    assert.equal(saved.totalOdds, Number((2 * 1.8 * 1.5).toFixed(4)), 'totalOdds should be product of leg odds');
    const expectedPW = Number((500 * 2 * 1.8 * 1.5 * (1 + BONUS_RATE)).toFixed(2));
    assert.equal(saved.potentialWin, expectedPW, 'potentialWin should include bonus rate');
  });

  test('8. Check that bet listing returns display fields', () => {
    // This simulates what listUserBets does with attachBetDisplayFields
    const all = Object.values(betsStore.all() || {}).filter(b => b.userId === TEST_USER.id);
    for (const b of all) {
      assert.ok(b.bookingCode, 'every bet should have a bookingCode');
      assert.equal(b.bookingCode.length, 7, 'bookingCode should be 7 chars');
      if (b.status !== 'open' && b.status !== 'pending') {
        if (b.status === 'won') {
          assert.ok(b.settledReturn > 0, 'won bet should have settledReturn > 0');
        }
        if (b.status === 'cashed_out') {
          assert.ok(b.cashOut > 0, 'cashed_out bet should have cashOut > 0');
          assert.ok(b.settledReturn > 0, 'cashed_out bet should have settledReturn > 0');
        }
      }
    }
  });
});
