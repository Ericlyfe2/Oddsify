import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { errorHandler } from '../src/middleware/error.js';
import { JWT } from '../src/config/env.js';

const TEST_USER = {
  id: 'test@oddsify.gh',
  email: 'test@oddsify.gh',
  role: 'user',
};

const API_PREFIX = '/api/bet';

async function createTestApp() {
  const app = express();
  app.use(express.json());
  const { createUser, getUserById } = await import('../src/db/users.js');
  const { default: betRouter } = await import('../src/routes/bet.js');

  // Ensure test user exists in the store with the right fields
  let _testUser = getUserById(TEST_USER.id);
  if (_testUser) {
    const { updateUser } = await import('../src/db/users.js');
    updateUser(TEST_USER.id, { emailVerified: true, balance: 100000, role: 'user' });
  } else {
    _testUser = createUser({ ...TEST_USER, passwordHash: 'test-hash', emailVerified: true, balance: 100000 });
  }

  // Minimal auth middleware for tests — sets req.user from JWT in header
  app.use((req, _res, next) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const claims = jwt.verify(auth.slice(7), JWT.secret, { issuer: JWT.issuer });
        const user = getUserById(claims.sub);
        if (user) req.user = user;
      } catch {
        // not authenticated
      }
    }
    next();
  });

  app.use(API_PREFIX, betRouter);

  // Error handler must be AFTER routes
  app.use(errorHandler);

  return app;
}

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, scope: 'user' },
    JWT.secret,
    { expiresIn: '1h', issuer: JWT.issuer },
  );
}

const VALID_MATCH = 'gh-adu-med';

describe('Booking Code Endpoint Integration', () => {
  let app;
  let server;
  let base;
  let token;

  before(async () => {
    app = await createTestApp();
    token = makeToken(TEST_USER);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        base = `http://127.0.0.1:${addr.port}${API_PREFIX}`;
        resolve();
      });
    });
  });

  after(() => {
    server?.close();
  });

  function fetchApi(path, opts = {}) {
    const { headers: extraHeaders, ...rest } = opts;
    return fetch(`${base}${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    });
  }

  describe('POST /book', () => {
    it('creates a booking code for a valid single selection', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 }],
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.match(body.bookingCode, /^[A-NP-Z]{2}[1-9]{5,6}$/);
      assert.equal(body.slip.kind, 'booked');
      assert.equal(body.slip.mode, 'single');
      assert.equal(body.slip.legs.length, 1);
    });

    it('creates a booking code for a multiple selection', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 },
            { matchId: 'gh-dre-bec', market: '1X2', outcome: '2', odds: 2.55 },
          ],
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.match(body.bookingCode, /^[A-NP-Z]{2}[1-9]{5,6}$/);
      assert.equal(body.slip.mode, 'multiple');
      assert.equal(body.slip.legs.length, 2);
    });

    it('rejects duplicate selections with 400', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 },
            { matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 },
          ],
        }),
      });
      assert.equal(res.status, 400);
    });

    it('rejects invalid match selections with 400', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { matchId: 'non-existent-match', market: '1X2', outcome: '1', odds: 2.0 },
          ],
        }),
      });
      assert.equal(res.status, 400);
    });
  });

  describe('GET /code/:code', () => {
    let bookedCode;

    before(async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 },
            { matchId: 'gh-dre-bec', market: '1X2', outcome: 'X', odds: 2.95 },
          ],
        }),
      });
      const body = await res.json();
      bookedCode = body.bookingCode;
    });

    it('looks up a valid booking code', async () => {
      const res = await fetchApi(`/code/${bookedCode}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.bet);
      assert.equal(body.bet.bookingCode, bookedCode);
      assert.equal(body.bet.legs.length, 2);
    });

    it('returns 404 for a non-existent code', async () => {
      const res = await fetchApi('/code/ZZ99999');
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.match(body.error, /not found/i);
    });

    it('returns 404 for a malformed code (handled by notFound)', async () => {
      const res = await fetchApi('/code/short');
      assert.equal(res.status, 404);
    });

    it('returns the same data on repeated lookups (persistence)', async () => {
      const res1 = await fetchApi(`/code/${bookedCode}`);
      const res2 = await fetchApi(`/code/${bookedCode}`);
      const body1 = await res1.json();
      const body2 = await res2.json();
      assert.deepEqual(body1.bet, body2.bet);
    });
  });

  describe('POST /place (booking code integration)', () => {
    it('generates a unique booking code on bet placement', async () => {
      const res = await fetchApi('/place', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'single',
          stake: 500,
          selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 }],
        }),
      });
      const body = await res.json();
      assert.equal(res.status, 201, JSON.stringify(body));
      assert.equal(body.ok, true);
      assert.match(body.bet.bookingCode, /^[A-NP-Z]{2}[1-9]{5,6}$/);
    });

    it('can look up a placed bet by its booking code', async () => {
      const res1 = await fetchApi('/place', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'single',
          stake: 500,
          selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: '2', odds: 2.55 }],
        }),
      });
      assert.equal(res1.status, 201);
      const placed = await res1.json();
      const code = placed.bet.bookingCode;

      const res2 = await fetchApi(`/code/${code}`);
      assert.equal(res2.status, 200);
      const lookup = await res2.json();
      assert.equal(lookup.bet.bookingCode, code);
      assert.equal(lookup.bet.stake, 500);
      assert.equal(lookup.bet.legs[0].outcome, '2');
    });

    it('generates unique codes for consecutive placements', async () => {
      const codes = new Set();
      for (let i = 0; i < 5; i++) {
        const res = await fetchApi('/place', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mode: 'single',
            stake: 500,
            selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: i % 2 === 0 ? '1' : '2', odds: 2.5 }],
          }),
        });
        const body = await res.json();
        assert.equal(res.status, 201);
        assert.ok(!codes.has(body.bet.bookingCode), `duplicate code: ${body.bet.bookingCode}`);
        codes.add(body.bet.bookingCode);
      }
      assert.equal(codes.size, 5);
    });

    it('requires auth for placing bets', async () => {
      const res = await fetchApi('/place', {
        method: 'POST',
        body: JSON.stringify({
          stake: 500,
          selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 }],
        }),
      });
      assert.equal(res.status, 401);
    });
  });

  describe('Full booking code lifecycle', () => {
    let bookedCode;

    it('1. User books a slip (no auth needed)', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [
            { matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 },
            { matchId: 'gh-dre-bec', market: '1X2', outcome: 'X', odds: 2.95 },
          ],
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      bookedCode = body.bookingCode;
      assert.ok(bookedCode);
    });

    it('2. Recipient can look up the code', async () => {
      const res = await fetchApi(`/code/${bookedCode}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.bet.bookingCode, bookedCode);
      assert.equal(body.bet.legs.length, 2);
    });

    it('3. Code remains valid after repeated lookups', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await fetchApi(`/code/${bookedCode}`);
        assert.equal(res.status, 200);
      }
    });

    it('4. Same booking code is not reused by the system', async () => {
      const res = await fetchApi('/book', {
        method: 'POST',
        body: JSON.stringify({
          selections: [{ matchId: VALID_MATCH, market: '1X2', outcome: '1', odds: 2.85 }],
        }),
      });
      const body = await res.json();
      assert.notEqual(body.bookingCode, bookedCode);
    });
  });
});
