/**
 * Referral engine unit tests — code generation, registration attach,
 * fraud blocking, qualifying-deposit rewards, idempotency, reversal.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createUser, getUserById, deleteUser, updateUser } from '../src/db/users.js';
import { createStore } from '../src/db/store.js';
import {
  ensureReferralCode,
  attachReferral,
  handleQualifyingDeposit,
  adminApprove,
  adminReject,
  adminReverse,
  referralSummary,
  REFERRAL_CODE_RE,
  lookupCodeOwner,
} from '../src/services/referrals.js';

const stamp = Date.now();
const REFERRER = `ref-referrer-${stamp}@test.local`;
const FRIEND = `ref-friend-${stamp}@test.local`;
const FRIEND2 = `ref-friend2-${stamp}@test.local`;
const SELF = `ref-self-${stamp}@test.local`;

const referralsStore = createStore('referrals', {});
const codesStore = createStore('referralCodes', {});
const txStore = createStore('transactions', {});

let referrer;
let code;

before(() => {
  referrer = createUser({ email: REFERRER, displayName: 'Kwame Tester', balance: 50, emailVerified: true });
  code = ensureReferralCode(referrer.id);
});

after(() => {
  for (const id of [REFERRER, FRIEND, FRIEND2, SELF]) {
    referralsStore.delete(id);
    txStore.delete(id);
    deleteUser(id);
  }
  codesStore.delete(code);
});

describe('referral codes', () => {
  test('generated code matches format and is registered', () => {
    assert.match(code, REFERRAL_CODE_RE);
    assert.equal(lookupCodeOwner(code), referrer.id);
  });

  test('ensureReferralCode is stable (no regeneration)', () => {
    assert.equal(ensureReferralCode(referrer.id), code);
  });
});

describe('attachReferral', () => {
  test('invalid / unknown codes are ignored without throwing', () => {
    const u = { id: FRIEND, displayName: 'Friend', emailVerified: true };
    assert.equal(attachReferral(u, 'NOPE'), null); // bad format
    assert.equal(attachReferral(u, 'ZZZZ999999'), null); // unknown
  });

  test('valid code creates a pending referral', () => {
    const friend = createUser({ email: FRIEND, displayName: 'Ama Friend', emailVerified: true });
    const rec = attachReferral(friend, code, { ip: '10.0.0.1' });
    assert.equal(rec.status, 'pending');
    assert.equal(rec.referrerId, referrer.id);
    assert.equal(getUserById(FRIEND).referredBy, referrer.id);
  });

  test('a user can only be referred once', () => {
    const friend = getUserById(FRIEND);
    assert.equal(attachReferral(friend, code), null);
  });

  test('self-referral is rejected', () => {
    // Simulate: account whose referral code is used on itself.
    const self = createUser({ email: SELF, displayName: 'Selfie', emailVerified: true });
    const selfCode = ensureReferralCode(self.id);
    const rec = attachReferral(self, selfCode);
    assert.equal(rec.status, 'rejected');
    assert.ok(rec.fraudReasons.includes('self_referral'));
    codesStore.delete(selfCode);
  });
});

describe('qualifying deposit & reward', () => {
  test('deposit below minimum does not reward', () => {
    assert.equal(handleQualifyingDeposit(FRIEND, 50), null);
    assert.equal(referralsStore.get(FRIEND).status, 'pending');
    assert.equal(getUserById(REFERRER).balance, 50);
  });

  test('qualifying deposit rewards the referrer exactly once', () => {
    const tx = handleQualifyingDeposit(FRIEND, 150);
    assert.ok(tx);
    assert.equal(tx.kind, 'referral_bonus');
    assert.equal(tx.amount, 10);
    assert.equal(getUserById(REFERRER).balance, 60); // 50 + 10
    assert.equal(referralsStore.get(FRIEND).status, 'rewarded');

    // Idempotency: a second approved deposit must NOT pay again.
    assert.equal(handleQualifyingDeposit(FRIEND, 500), null);
    assert.equal(getUserById(REFERRER).balance, 60);
  });

  test('summary reflects the rewarded referral', () => {
    const s = referralSummary(referrer.id);
    assert.equal(s.code, code);
    assert.ok(s.stats.total >= 1);
    assert.ok(s.stats.totalEarned >= 10);
    const row = s.history.find((h) => h.status === 'rewarded');
    assert.ok(row);
    assert.equal(row.rewardAmount, 10);
  });
});

describe('admin operations', () => {
  test('reject blocks a pending referral; rewarded ones need reverse', () => {
    const f2 = createUser({ email: FRIEND2, displayName: 'Yaw Two', emailVerified: true });
    attachReferral(f2, code, { ip: '10.0.0.2' });
    assert.equal(adminReject(FRIEND2, 'admin@test').ok, true);
    assert.equal(referralsStore.get(FRIEND2).status, 'rejected');
    // Rejected referral never pays.
    assert.equal(handleQualifyingDeposit(FRIEND2, 1000), null);
    // Rewarded record cannot be "rejected".
    assert.equal(adminReject(FRIEND, 'admin@test').error, 'already_rewarded_use_reverse');
  });

  test('reverse claws the reward back from the wallet', () => {
    const balBefore = getUserById(REFERRER).balance;
    const res = adminReverse(FRIEND, 'admin@test', 'fraud confirmed');
    assert.equal(res.ok, true);
    assert.equal(getUserById(REFERRER).balance, Number((balBefore - 10).toFixed(2)));
    assert.equal(referralsStore.get(FRIEND).status, 'reversed');
    // Cannot reverse twice.
    assert.equal(adminReverse(FRIEND, 'admin@test').error, 'not_rewarded');
  });

  test('approve pays a flagged referral that already deposited', () => {
    // Re-arm FRIEND2 as flagged with a recorded deposit.
    referralsStore.update(FRIEND2, (cur) => ({ ...cur, status: 'flagged', depositAmount: 200, rewardAmount: null }));
    updateUser(REFERRER, { balance: 100 });
    const res = adminApprove(FRIEND2, 'admin@test');
    assert.equal(res.rewarded, true);
    assert.equal(getUserById(REFERRER).balance, 110);
  });
});
