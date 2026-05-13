/**
 * Base provider. Concrete providers extend this and implement the methods
 * relevant to them. All providers must normalise their data into the unified
 * shape below so the aggregator can merge them.
 *
 * Unified types
 * -------------
 * Fixture = {
 *   key: string,            // canonical key used for dedup (sport|home-vs-away|date)
 *   sourceId: string,       // id within this provider
 *   sport: 'football' | 'basketball' | 'tennis',
 *   league: { id, name, country? },
 *   home: string,
 *   away: string,
 *   kickoff: string (ISO),
 *   status: 'upcoming' | 'live' | 'finished',
 *   scoreHome?: number,
 *   scoreAway?: number,
 *   minute?: string,
 *   updatedAt: string (ISO),
 *   provider: string,
 * }
 *
 * Odds = {
 *   key: string,            // same canonical key as the Fixture
 *   provider: string,
 *   bookmaker?: string,
 *   markets: {
 *     [marketKey: '1X2' | 'OU25' | 'BTTS' | ...]: {
 *       name: string,
 *       selections: [{ key: '1' | 'X' | '2' | 'Over' | ..., label: string, odds: number }]
 *     }
 *   },
 *   updatedAt: string (ISO),
 * }
 */
import { recordApiCall } from '../db/apiLogs.js';

export class Provider {
  constructor({ id, label, enabled = false, sports = [] }) {
    this.id = id;
    this.label = label;
    this.enabled = !!enabled;
    this.sports = sports;
    this._lastSuccessAt = null;
    this._lastErrorAt = null;
    this._lastError = null;
    this._calls = 0;
    this._errors = 0;
  }

  async fetchFixtures(/* sport */) { return []; }
  async fetchOdds(/* sport */)     { return []; }
  async fetchScores(/* sport */)   { return []; }

  health() {
    return {
      id: this.id,
      label: this.label,
      enabled: this.enabled,
      sports: this.sports,
      lastSuccessAt: this._lastSuccessAt,
      lastErrorAt: this._lastErrorAt,
      lastError: this._lastError,
      calls: this._calls,
      errors: this._errors,
      successPct: this._calls > 0
        ? Number((((this._calls - this._errors) / this._calls) * 100).toFixed(1))
        : 100,
    };
  }

  /** Convenience wrapper for outbound fetch with logging + telemetry. */
  async http(endpoint, opts = {}) {
    if (!this.enabled) {
      const err = new Error(`${this.id} disabled (no API key)`);
      err.code = 'PROVIDER_DISABLED';
      throw err;
    }
    const start = Date.now();
    let status = 0, error = null, payload = null;
    try {
      const ctrl = new AbortController();
      const timeoutMs = opts.timeoutMs ?? 8000;
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(endpoint, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
      status = res.status;
      const text = await res.text();
      payload = text ? safeParse(text) : null;
      if (!res.ok) {
        error = payload?.message || payload?.error || res.statusText || `HTTP ${res.status}`;
        const e = new Error(error);
        e.status = res.status;
        e.body = payload;
        throw e;
      }
      this._lastSuccessAt = new Date().toISOString();
      return payload;
    } catch (e) {
      error = error || e.message || String(e);
      this._lastErrorAt = new Date().toISOString();
      this._lastError = error;
      this._errors++;
      throw e;
    } finally {
      this._calls++;
      recordApiCall({
        provider: this.id,
        endpoint: scrubUrl(endpoint),
        status,
        latencyMs: Date.now() - start,
        error,
      });
    }
  }
}

function safeParse(t) { try { return JSON.parse(t); } catch { return t; } }

/** Remove any apiKey query/header from logs. */
function scrubUrl(u) {
  try {
    const url = new URL(u);
    for (const k of ['apiKey', 'api_key', 'token', 'key']) url.searchParams.delete(k);
    return url.toString();
  } catch { return String(u); }
}

/** Canonical key used for fixture dedup across providers. */
export function fixtureKey(sport, home, away, kickoffIso) {
  const day = (kickoffIso || '').slice(0, 10);
  return [
    String(sport || '').toLowerCase(),
    norm(home),
    'vs',
    norm(away),
    day,
  ].join('|');
}

export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|ac|sc|club|football|the)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
