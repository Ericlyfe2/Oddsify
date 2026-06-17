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

/**
 * Generate the correct-score selection grid for a market.
 */
function generateCorrectScoreGrid(template) {
  const maxHome = template.selectionSpec?.maxHome ?? 6;
  const maxAway = template.selectionSpec?.maxAway ?? 6;
  const includeOther = template.selectionSpec?.includeOther !== false;
  const selections = [];
  let sortOrder = 0;

  for (let h = 0; h <= maxHome; h++) {
    for (let a = 0; a <= maxAway; a++) {
      selections.push({ key: `${h}-${a}`, label: `${h} - ${a}`, sortOrder: sortOrder++ });
    }
  }

  if (includeOther) {
    selections.push({ key: 'OTHER_HOME', label: 'Any Other Home Win', sortOrder: sortOrder++ });
    selections.push({ key: 'OTHER_AWAY', label: 'Any Other Away Win', sortOrder: sortOrder++ });
    selections.push({ key: 'OTHER_DRAW', label: 'Any Other Draw', sortOrder: sortOrder++ });
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
      const sel = createSelection(market.id, def);
      if (sel) selections.push(sel);
    }
  }

  return { markets, selections };
}

export function autoAttachSelections(marketId, template) {
  const outcomeDefs = generateSelections(template);
  return outcomeDefs.map((def) => createSelection(marketId, def)).filter(Boolean);
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
