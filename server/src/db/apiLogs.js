/**
 * Rolling log of every outbound call to an external provider.
 * Capped at MAX_ENTRIES. Used by the admin Providers page.
 */
import crypto from 'crypto';

const MAX_ENTRIES = 2000;
const logs = []; // newest first

export function recordApiCall({ provider, endpoint, status, latencyMs, error, meta }) {
  const row = {
    id: crypto.randomBytes(4).toString('hex'),
    at: new Date().toISOString(),
    provider,
    endpoint,
    status: Number(status) || 0,
    latencyMs: Math.round(Number(latencyMs) || 0),
    error: error ? String(error).slice(0, 300) : null,
    meta: meta || {},
  };
  logs.unshift(row);
  if (logs.length > MAX_ENTRIES) logs.length = MAX_ENTRIES;
  return row;
}

export function listApiLogs({ provider, limit = 100, since } = {}) {
  let rows = logs;
  if (provider) rows = rows.filter((l) => l.provider === provider);
  if (since) rows = rows.filter((l) => new Date(l.at).getTime() >= Number(since));
  return rows.slice(0, Math.min(limit, MAX_ENTRIES));
}

export function summariseApiCalls() {
  const windows = { '1m': 60_000, '5m': 5 * 60_000, '1h': 60 * 60_000 };
  const buckets = {};
  for (const w of Object.keys(windows)) buckets[w] = {};
  const now = Date.now();
  for (const l of logs) {
    const age = now - new Date(l.at).getTime();
    for (const [w, ms] of Object.entries(windows)) {
      if (age <= ms) {
        const p = (buckets[w][l.provider] = buckets[w][l.provider] || { calls: 0, errors: 0, totalLatency: 0 });
        p.calls++;
        p.totalLatency += l.latencyMs;
        if (l.status >= 400 || l.error) p.errors++;
      }
    }
  }
  const out = {};
  for (const [w, providers] of Object.entries(buckets)) {
    out[w] = Object.fromEntries(
      Object.entries(providers).map(([k, v]) => [
        k,
        {
          calls: v.calls,
          errors: v.errors,
          avgLatency: v.calls > 0 ? Math.round(v.totalLatency / v.calls) : 0,
          successPct: v.calls > 0 ? Number((((v.calls - v.errors) / v.calls) * 100).toFixed(1)) : 100,
        },
      ]),
    );
  }
  return out;
}
