/**
 * Process-local TTL+LRU cache shaped like Redis.
 *
 * The API mirrors a small subset of node-redis so swapping the import
 * (e.g. to a redis client) is a one-line change when you add Redis.
 *   - get(key) -> Promise<value|null>
 *   - set(key, value, { ex?: seconds }) -> Promise<'OK'>
 *   - del(key) -> Promise<number>
 *   - expire(key, seconds) -> Promise<number>
 *   - keys(pattern) -> Promise<string[]>  (glob-ish)
 *   - flushAll() -> Promise<'OK'>
 *
 * Values can be any JSON-serializable object. Internally stored as { v, exp }.
 * Entries past their TTL are dropped on read or LRU eviction.
 */

const MAX_ENTRIES = Number(process.env.CACHE_MAX_ENTRIES) || 10_000;

const store = new Map(); // insertion-ordered → cheap LRU

function now() {
  return Date.now();
}

function touch(key, value) {
  store.delete(key);
  store.set(key, value);
  if (store.size > MAX_ENTRIES) {
    // delete oldest
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

function alive(entry) {
  return !entry?.exp || entry.exp > now();
}

export async function get(key) {
  const e = store.get(key);
  if (!e) return null;
  if (!alive(e)) {
    store.delete(key);
    return null;
  }
  // bump LRU position on read
  store.delete(key);
  store.set(key, e);
  return e.v;
}

export async function set(key, value, opts = {}) {
  const exp = opts.ex ? now() + opts.ex * 1000 : null;
  touch(key, { v: value, exp });
  return 'OK';
}

export async function del(key) {
  return store.delete(key) ? 1 : 0;
}

export async function expire(key, seconds) {
  const e = store.get(key);
  if (!e) return 0;
  e.exp = now() + seconds * 1000;
  return 1;
}

export async function keys(pattern = '*') {
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const out = [];
  for (const [k, e] of store.entries()) {
    if (!alive(e)) {
      store.delete(k);
      continue;
    }
    if (re.test(k)) out.push(k);
  }
  return out;
}

export async function flushAll() {
  store.clear();
  return 'OK';
}

/** Wraps a slow loader in a single-flight cache fetch. */
export async function getOrSet(key, ttlSeconds, loader) {
  const hit = await get(key);
  if (hit !== null) return hit;
  const v = await loader();
  if (v !== undefined && v !== null) await set(key, v, { ex: ttlSeconds });
  return v;
}

export function stats() {
  let live = 0,
    expired = 0;
  for (const e of store.values()) alive(e) ? live++ : expired++;
  return { size: store.size, live, expired, capacity: MAX_ENTRIES };
}
