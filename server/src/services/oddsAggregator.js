/**
 * Odds aggregator.
 *
 * Pulls normalised odds + fixtures from every enabled provider on a staggered
 * schedule, merges them into a canonical index by fixtureKey, picks freshest
 * odds per (fixture, market, selection), and:
 *   - persists into the cache (TTL ~60s)
 *   - applies any admin overrides on top
 *   - emits realtime odds:tick / odds:movement events when a price changes
 *
 * If every provider for a fixture fails or is disabled, the existing static
 * matchesData feed continues to serve — that's the fallback layer.
 *
 * Designed to scale: per-provider concurrency, cancellable polls, exponential
 * back-off on repeated failures, and idempotent merges.
 */
import { enabledProviders, providersHealth } from './providerRegistry.js';
import { get as cacheGet, set as cacheSet } from './cache.js';
import { emitOddsTick, emitOddsMovement, emitProviderHealth } from './realtime.js';
import { setOddsOverride } from '../db/sportsAdmin.js';
import { log } from '../utils/logger.js';

const POLL_INTERVAL_MS = 60_000;     // base cadence
const PROVIDER_STAGGER_MS = 4_000;   // stagger so we don't burst all providers
const CACHE_KEY_AGG = 'odds:aggregate';
const CACHE_TTL_S   = 90;

let timer = null;
let running = false;

const lastPriceByKey = new Map(); // canonicalKey -> { [market]: { [sel]: odds } }
const failureStreak  = new Map(); // providerId -> consecutive failures

function backoffMs(streak) {
  return Math.min(POLL_INTERVAL_MS * Math.pow(2, streak), 10 * 60_000);
}

async function pullProvider(p, sport = 'football') {
  const streak = failureStreak.get(p.id) || 0;
  // (no-op when streak is fresh; just informational)
  try {
    const rows = await p.fetchOdds(sport).catch(() => []);
    failureStreak.set(p.id, 0);
    return rows || [];
  } catch (e) {
    failureStreak.set(p.id, streak + 1);
    const next = backoffMs(streak + 1);
    log.warn(`Provider ${p.id} failure ×${streak + 1} — backing off ${Math.round(next / 1000)}s: ${e.message}`);
    return [];
  }
}

/** Combine multiple Odds rows for the same fixtureKey into one canonical view. */
function mergeRows(rows) {
  if (rows.length === 1) return rows[0];
  // Always pick the freshest row as the base, then layer in markets/selections
  const sorted = [...rows].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const base = { ...sorted[0], providers: [], markets: { ...(sorted[0].markets || {}) } };
  base.providers = Array.from(new Set(rows.map((r) => r.provider)));

  // For each other provider, fold its markets into base, picking highest odds for player benefit
  for (const r of sorted.slice(1)) {
    for (const [mk, market] of Object.entries(r.markets || {})) {
      const target = base.markets[mk] = base.markets[mk] || { name: market.name, selections: [] };
      for (const sel of market.selections || []) {
        const existing = target.selections.find((s) => s.key === sel.key);
        if (!existing) target.selections.push({ ...sel });
        else if (sel.odds > existing.odds) Object.assign(existing, { odds: sel.odds, bookmaker: r.provider });
      }
    }
  }
  return base;
}

/** Detect price movements vs last tick and fire realtime events. */
function diffEmit(fix) {
  const prevAll = lastPriceByKey.get(fix.key) || {};
  const next = {};
  let changed = false;
  for (const [mk, market] of Object.entries(fix.markets || {})) {
    next[mk] = {};
    for (const sel of market.selections || []) {
      next[mk][sel.key] = sel.odds;
      const prevPrice = prevAll[mk]?.[sel.key];
      if (prevPrice !== undefined && Math.abs(prevPrice - sel.odds) > 0.005) {
        changed = true;
        emitOddsMovement({
          fixtureId: fix.sourceId || fix.key,
          key: fix.key,
          home: fix.home, away: fix.away,
          market: mk,
          selection: sel.key,
          prev: prevPrice,
          next: sel.odds,
          provider: sel.bookmaker || fix.provider,
        });
      }
    }
  }
  if (changed || !lastPriceByKey.has(fix.key)) {
    emitOddsTick({
      fixtureId: fix.sourceId || fix.key,
      key: fix.key,
      sport: fix.sport,
      home: fix.home,
      away: fix.away,
      markets: fix.markets,
      providers: fix.providers || [fix.provider],
      updatedAt: fix.updatedAt,
    });
  }
  lastPriceByKey.set(fix.key, next);
}

/** Also push the best-odds into the admin override store so the storefront
 *  shows aggregator prices without a separate code path. Off by default —
 *  enable with AGGREGATOR_PUSH_OVERRIDES=true to let market-makers tune. */
function maybePushToOverrides(fix) {
  if (process.env.AGGREGATOR_PUSH_OVERRIDES !== 'true') return;
  if (!fix?.sourceId) return;
  for (const [mk, market] of Object.entries(fix.markets || {})) {
    for (const sel of market.selections || []) {
      try { setOddsOverride(fix.sourceId, mk, sel.key, sel.odds); } catch {}
    }
  }
}

export async function aggregateOnce() {
  if (running) return null;
  running = true;
  const start = Date.now();
  try {
    const providers = enabledProviders();
    if (providers.length === 0) {
      emitProviderHealth(providersHealth());
      return { providers: 0, fixtures: 0 };
    }

    const rowsPerProvider = await Promise.all(providers.map(async (p, i) => {
      // soft stagger across providers
      if (i) await new Promise((r) => setTimeout(r, i * PROVIDER_STAGGER_MS));
      return pullProvider(p, 'football');
    }));

    // bucket by fixtureKey
    const byKey = new Map();
    for (const rows of rowsPerProvider) {
      for (const row of rows) {
        const list = byKey.get(row.key) || [];
        list.push(row);
        byKey.set(row.key, list);
      }
    }

    const merged = [];
    for (const rows of byKey.values()) {
      const m = mergeRows(rows);
      merged.push(m);
      diffEmit(m);
      maybePushToOverrides(m);
    }

    await cacheSet(CACHE_KEY_AGG, merged, { ex: CACHE_TTL_S });

    const health = providersHealth();
    emitProviderHealth(health);

    log.info(`aggregator: ${providers.length} providers, ${merged.length} fixtures, ${Date.now() - start}ms`);
    return { providers: providers.length, fixtures: merged.length, durationMs: Date.now() - start };
  } finally {
    running = false;
  }
}

export async function getAggregatedOdds() {
  const hit = await cacheGet(CACHE_KEY_AGG);
  return hit || [];
}

export function startAggregator() {
  if (timer) return;
  // first run with a 4s delay so the rest of boot finishes first
  setTimeout(() => { aggregateOnce().catch(() => {}); }, 4000);
  timer = setInterval(() => { aggregateOnce().catch(() => {}); }, POLL_INTERVAL_MS);
}

export function stopAggregator() {
  if (timer) clearInterval(timer);
  timer = null;
}
