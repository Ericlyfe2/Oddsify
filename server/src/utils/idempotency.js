/**
 * Idempotency key middleware.
 *
 * Write endpoints that accept an `Idempotency-Key` header (or `idempotencyKey`
 * in the request body) will return the previously-stored response for that key
 * instead of re-executing. This prevents double-charges, duplicate match
 * creation, etc. on network retries or double-clicks.
 *
 * The idempotency store is backed by the same KV store pattern and has a TTL.
 * After the TTL expires, the same key may be reused.
 *
 * Usage:
 *   router.post('/matches', idempotent({ ttlMs: 86_400_000 }), asyncHandler(async (req, res) => {
 *     // ... create match ...
 *     res.status(201).json(match);
 *   }));
 */
import crypto from 'crypto';
import { createStore } from '../db/store.js';

const store = createStore('idempotency', {});

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function extractKey(req) {
  return (
    req.headers['idempotency-key'] ||
    req.headers['Idempotency-Key'] ||
    req.body?.idempotencyKey ||
    null
  );
}

export function idempotent({ ttlMs = DEFAULT_TTL_MS } = {}) {
  return (req, res, next) => {
    const key = extractKey(req);
    if (!key) return next();

    const normalized = String(key).trim();
    if (!normalized) return next();

    const existing = store.get(normalized);
    if (existing) {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < ttlMs) {
        return res.status(existing.status).json(existing.body);
      }
      store.delete(normalized);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      store.set(normalized, {
        status: res.statusCode,
        body,
        createdAt: new Date().toISOString(),
      });
      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Generate an idempotency key on the client side. Deterministic from request
 * properties so retries of the same operation produce the same key.
 */
export function makeIdempotencyKey(prefix, ...parts) {
  const hash = crypto.createHash('sha256').update(parts.map(String).join('|')).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}
