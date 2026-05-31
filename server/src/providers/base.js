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
  constructor({
    id,
    label,
    enabled = false,
    sports = [],
    dailyBudget = Infinity,
    cooldownOn429Ms = 60 * 60_000,
    minCallIntervalMs = null,
  }) {
    this.id = id;
    this.label = label;
    this.enabled = !!enabled;
    this.sports = sports;
    this._lastSuccessAt = null;
    this._lastErrorAt = null;
    this._lastError = null;
    this._calls = 0;
    this._errors = 0;

    // ---- Free-plan safety: per-day budget + pacing + 429 cooldown ----
    // dailyBudget is a hard ceiling on calls per UTC day (api-football, the
    // odds api, and most quota'd providers reset at UTC 00:00). Once hit the
    // http() helper short-circuits with PROVIDER_BUDGET_EXHAUSTED — the call
    // never goes out, so the upstream's daily counter does not advance even
    // while we keep our schedule.
    //
    // minCallIntervalMs paces the calls across the day instead of letting
    // the scheduler burn the entire budget in the first 30 minutes. If not
    // supplied we derive it from the budget: 24h ÷ budget × 1.1 safety, so
    // a 90/day budget produces ~17.6 minutes between outbound calls. Calls
    // attempted inside that window are denied locally — no wire traffic.
    //
    // cooldownOn429Ms is the back-off window applied the moment a 429 (or
    // any "too many" status) comes back. We refuse outbound calls for the
    // window so the provider can recover and we stop spamming logs.
    this.dailyBudget = Number.isFinite(dailyBudget) && dailyBudget > 0 ? Math.floor(dailyBudget) : Infinity;
    this.cooldownOn429Ms = Math.max(0, Number(cooldownOn429Ms) || 0);
    if (Number.isFinite(minCallIntervalMs) && minCallIntervalMs >= 0) {
      this.minCallIntervalMs = Math.floor(minCallIntervalMs);
    } else if (Number.isFinite(this.dailyBudget)) {
      this.minCallIntervalMs = Math.ceil((86_400_000 / this.dailyBudget) * 1.1);
    } else {
      this.minCallIntervalMs = 0;
    }
    this._budgetDayKey = utcDayKey();
    this._budgetUsed = 0;
    this._budgetDenied = 0;
    this._cooldownUntil = 0; // epoch ms; 0 means not in cooldown
    this._lastCallAt = 0;    // epoch ms of last outbound attempt
  }

  async fetchFixtures(/* sport */) { return []; }
  async fetchOdds(/* sport */)     { return []; }
  async fetchScores(/* sport */)   { return []; }

  /** Resets the daily counter if we've rolled past UTC midnight. */
  _rolloverIfNewDay() {
    const today = utcDayKey();
    if (today !== this._budgetDayKey) {
      this._budgetDayKey = today;
      this._budgetUsed = 0;
      this._budgetDenied = 0;
    }
  }

  /** True if the provider should refuse calls right now. */
  _gateReason() {
    if (!this.enabled) return { code: 'PROVIDER_DISABLED', msg: `${this.id} disabled (no API key)` };
    if (Date.now() < this._cooldownUntil) {
      const ms = this._cooldownUntil - Date.now();
      return { code: 'PROVIDER_COOLDOWN', msg: `${this.id} in cooldown for ${Math.round(ms / 1000)}s after 429` };
    }
    this._rolloverIfNewDay();
    if (this._budgetUsed >= this.dailyBudget) {
      return { code: 'PROVIDER_BUDGET_EXHAUSTED', msg: `${this.id} hit daily budget (${this.dailyBudget})` };
    }
    if (this.minCallIntervalMs > 0 && this._lastCallAt > 0) {
      const since = Date.now() - this._lastCallAt;
      if (since < this.minCallIntervalMs) {
        const waitS = Math.round((this.minCallIntervalMs - since) / 1000);
        return { code: 'PROVIDER_PACED', msg: `${this.id} paced (next call in ${waitS}s)` };
      }
    }
    return null;
  }

  health() {
    this._rolloverIfNewDay();
    const cooldownRemainingMs = Math.max(0, this._cooldownUntil - Date.now());
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
      dailyBudget: Number.isFinite(this.dailyBudget) ? this.dailyBudget : null,
      budgetUsed: this._budgetUsed,
      budgetDenied: this._budgetDenied,
      cooldownRemainingMs,
      minCallIntervalMs: this.minCallIntervalMs || 0,
      nextCallInMs: this.minCallIntervalMs > 0 && this._lastCallAt > 0
        ? Math.max(0, this._lastCallAt + this.minCallIntervalMs - Date.now())
        : 0,
    };
  }

  /** Convenience wrapper for outbound fetch with logging + telemetry. */
  async http(endpoint, opts = {}) {
    const gate = this._gateReason();
    if (gate) {
      this._budgetDenied++;
      const err = new Error(gate.msg);
      err.code = gate.code;
      throw err;
    }
    const start = Date.now();
    let status = 0, error = null, payload = null;
    // Reserve the budget slot AND stamp the pacing clock BEFORE the request
    // so concurrent calls in the same tick can't both pass the gate. If the
    // upstream cuts us off with a 429 we still treat the slot as used (the
    // request reached them).
    this._budgetUsed++;
    this._lastCallAt = Date.now();
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
        // 429 — or anything the upstream tags as quota/rate — triggers the
        // cooldown so we stop generating no-op load.
        if (res.status === 429 || /quota|rate/i.test(String(error))) {
          this._cooldownUntil = Date.now() + this.cooldownOn429Ms;
        }
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

function utcDayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
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
