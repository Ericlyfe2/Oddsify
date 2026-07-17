/**
 * Markets & Selections store.
 *
 * Markets are generated from templates when a match is created (auto-attach),
 * or added individually by an admin. Each market belongs to a match and has
 * one or more selections (the individual bettable outcomes).
 *
 * Statuses: open | suspended | disabled | settled
 */
import crypto from 'crypto';
import { createStore } from './store.js';
import { listTemplates } from './marketTemplates.js';

const marketStore = createStore('markets_data', {});
const selectionStore = createStore('selections_data', {});

/* ── Markets ─────────────────────────────────────────────── */

export function listMarkets(matchId) {
  return Object.values(marketStore.all() || {})
    .filter((m) => m.matchId === matchId)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function getMarket(id) {
  return marketStore.get(id) || null;
}

export function findMarket(matchId, key) {
  return listMarkets(matchId).find((m) => m.key === key) || null;
}

export function createMarket(matchId, template, opts = {}) {
  const existing = findMarket(matchId, template.key);
  if (existing) return existing;

  const id = `mkt-${crypto.randomBytes(4).toString('hex')}`;
  const rec = {
    id,
    matchId,
    templateId: template.id || `tmpl-${template.key}`,
    key: template.key,
    name: template.name || template.key,
    status: 'open',
    sortOrder: template.sortOrder ?? 99,
    marginPct: opts.marginPct ?? 0.06,
    availabilityWindow: opts.availabilityWindow || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  marketStore.set(id, rec);
  return rec;
}

export function updateMarket(id, patch) {
  const cur = marketStore.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  marketStore.set(id, next);
  return next;
}

export function suspendMarket(id) {
  return updateMarket(id, { status: 'suspended' });
}

export function enableMarket(id) {
  return updateMarket(id, { status: 'open' });
}

export function disableMarket(id) {
  return updateMarket(id, { status: 'disabled' });
}

/* ── Selections ──────────────────────────────────────────── */

export function listSelections(marketId) {
  return Object.values(selectionStore.all() || {})
    .filter((s) => s.marketId === marketId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getSelection(id) {
  return selectionStore.get(id) || null;
}

export function findSelection(marketId, outcomeKey) {
  return listSelections(marketId).find((s) => s.outcomeKey === outcomeKey) || null;
}

export function createSelection(marketId, outcome, price = 2.0) {
  const existing = findSelection(marketId, outcome.key);
  if (existing) return existing;

  const id = `sel-${crypto.randomBytes(4).toString('hex')}`;
  const rec = {
    id,
    marketId,
    outcomeKey: outcome.key,
    label: outcome.label || outcome.key,
    price: Number(price),
    active: true,
    isWinner: null,
    sortOrder: outcome.sortOrder ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  selectionStore.set(id, rec);
  return rec;
}

export function updateSelection(id, patch) {
  const cur = selectionStore.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  selectionStore.set(id, next);
  return next;
}

export function setSelectionPrice(id, price) {
  return updateSelection(id, { price: Number(price) });
}

export function suspendSelection(id) {
  return updateSelection(id, { active: false });
}

export function enableSelection(id) {
  return updateSelection(id, { active: true });
}

export function markSelectionWinner(id, isWinner) {
  return updateSelection(id, { isWinner });
}

/* ── Auto-attach (generate markets from templates) ──────── */

/** k! for small k (correct-score grids never need more than ~8). */
function factorial(k) {
  let out = 1;
  for (let i = 2; i <= k; i++) out *= i;
  return out;
}

/** Poisson P(X = k) for mean lambda. */
function poissonProb(lambda, k) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/** Convert a raw probability into a priced-in odds figure with house margin. */
function probToOdds(prob, marginPct = 0.12) {
  const safeProb = Math.max(prob, 0.0025);
  const fairOdds = 1 / safeProb;
  const priced = fairOdds * (1 - marginPct);
  return Math.max(1.05, Math.min(999, Math.round(priced * 100) / 100));
}

/**
 * Generate the correct-score selection grid for a market, with realistic,
 * distinct odds per scoreline instead of every cell defaulting to the same
 * flat price. Uses independent-Poisson expected goals for home/away (typical
 * for a competitive match) so likely scorelines (1-0, 1-1, 2-1) price short
 * and unlikely ones (4-4) price long.
 */
function generateCorrectScoreGrid(template) {
  const maxHome = template.selectionSpec?.maxHome ?? 4;
  const maxAway = template.selectionSpec?.maxAway ?? 4;
  const includeOther = template.selectionSpec?.includeOther !== false;
  const lambdaHome = template.selectionSpec?.lambdaHome ?? 1.35;
  const lambdaAway = template.selectionSpec?.lambdaAway ?? 1.1;
  const selections = [];
  let sortOrder = 0;
  let coveredProb = 0;

  for (let h = 0; h <= maxHome; h++) {
    for (let a = 0; a <= maxAway; a++) {
      const prob = poissonProb(lambdaHome, h) * poissonProb(lambdaAway, a);
      coveredProb += prob;
      selections.push({ key: `${h}-${a}`, label: `${h} - ${a}`, sortOrder: sortOrder++, price: probToOdds(prob) });
    }
  }

  if (includeOther) {
    // Remaining probability mass outside the grid, split across the three
    // "any other" buckets roughly in proportion to how draws/home/away wins
    // typically distribute in the long tail.
    const remaining = Math.max(0, 1 - coveredProb);
    selections.push({ key: 'OTHER_HOME', label: 'Any Other Home Win', sortOrder: sortOrder++, price: probToOdds(remaining * 0.45) });
    selections.push({ key: 'OTHER_AWAY', label: 'Any Other Away Win', sortOrder: sortOrder++, price: probToOdds(remaining * 0.4) });
    selections.push({ key: 'OTHER_DRAW', label: 'Any Other Draw', sortOrder: sortOrder++, price: probToOdds(remaining * 0.15) });
  }

  return selections;
}

/**
 * Auto-generate selections for a market based on its template's specification.
 */
function generateSelections(template) {
  const spec = template.selectionSpec || {};

  if (spec.type === 'fixed') {
    return (spec.outcomes || []).map((o, i) => ({ ...o, sortOrder: i }));
  }

  if (spec.type === 'correct_score_grid') {
    return generateCorrectScoreGrid(template);
  }

  if (spec.type === 'combo') {
    const baseKeys = spec.baseMarkets || [];
    const allTmpls = Object.values(listTemplates());
    const bases = baseKeys.map((k) => allTmpls.find((t) => t.key === k)).filter(Boolean);

    if (bases.length < 2) return [];
    const [a, b] = bases;
    const aOutcomes = a.selectionSpec?.outcomes || [];
    const bOutcomes = b.selectionSpec?.outcomes || [];
    const selections = [];
    let idx = 0;
    for (const oa of aOutcomes) {
      for (const ob of bOutcomes) {
        selections.push({
          key: `${oa.key}_${ob.key}`,
          label: `${oa.label} & ${ob.label}`,
          sortOrder: idx++,
        });
      }
    }
    return selections;
  }

  return [];
}

/**
 * Auto-attach markets for a newly created match. Generates markets from every
 * auto-attach template matching the match's sport, then generates selections
 * for each market.
 */
export function autoAttachMarkets(matchId, sportId, templates) {
  const markets = [];
  const selections = [];

  for (const tmpl of templates) {
    const market = createMarket(matchId, tmpl);
    if (!market) continue;
    markets.push(market);

    const outcomeDefs = generateSelections(tmpl);
    for (const def of outcomeDefs) {
      const sel = createSelection(market.id, def, def.price ?? 2.0);
      if (sel) selections.push(sel);
    }
  }

  return { markets, selections };
}

export function autoAttachSelections(marketId, template) {
  const outcomeDefs = generateSelections(template);
  return outcomeDefs.map((def) => createSelection(marketId, def, def.price ?? 2.0)).filter(Boolean);
}

/**
 * Generate selections from a template spec. Public for route handlers.
 */
export function generateSelectionsFromSpec(spec) {
  if (spec.type === 'fixed') {
    return (spec.outcomes || []).map((o, i) => ({ ...o, sortOrder: i }));
  }
  if (spec.type === 'correct_score_grid') {
    return generateCorrectScoreGrid({ selectionSpec: spec });
  }
  if (spec.type === 'combo') {
    return []; // combo combo markets need external market references
  }
  return [];
}
