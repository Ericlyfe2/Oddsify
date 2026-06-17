/**
 * Market template catalog — defines which markets are available per sport.
 *
 * Each template specifies how selections are generated (`selectionSpec`),
 * whether markets auto-attach when a match is created, and the sort order.
 *
 * Built-in templates cover: 1X2, Double Chance, BTTS, O/U (multiple lines),
 * Correct Score (grid), Draw No Bet, Asian Handicap, HT/FT, 1st Half markets,
 * Money Line, Total Points, Handicap, and combo markets.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const store = createStore('market_templates', {});

const BUILTIN_TEMPLATES = [
  // ── Football ────────────────────────────────────────────
  { key: '1X2', name: 'Match Winner', sportId: ['football'], autoAttach: true, sortOrder: 1,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1', label: 'Home' }, { key: 'X', label: 'Draw' }, { key: '2', label: 'Away' }] } },
  { key: 'DC', name: 'Double Chance', sportId: ['football'], autoAttach: true, sortOrder: 2,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1X', label: 'Home or Draw' }, { key: '12', label: 'Home or Away' }, { key: 'X2', label: 'Draw or Away' }] } },
  { key: 'BTTS', name: 'Both Teams To Score', sportId: ['football'], autoAttach: true, sortOrder: 3,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Yes', label: 'Yes' }, { key: 'No', label: 'No' }] } },
  { key: 'OU05', name: 'Total Goals (O/U 0.5)', sportId: ['football'], autoAttach: false, sortOrder: 4,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 0.5' }, { key: 'Under', label: 'Under 0.5' }] } },
  { key: 'OU15', name: 'Total Goals (O/U 1.5)', sportId: ['football'], autoAttach: true, sortOrder: 5,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 1.5' }, { key: 'Under', label: 'Under 1.5' }] } },
  { key: 'OU25', name: 'Total Goals (O/U 2.5)', sportId: ['football'], autoAttach: true, sortOrder: 6,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 2.5' }, { key: 'Under', label: 'Under 2.5' }] } },
  { key: 'OU35', name: 'Total Goals (O/U 3.5)', sportId: ['football'], autoAttach: true, sortOrder: 7,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 3.5' }, { key: 'Under', label: 'Under 3.5' }] } },
  { key: 'OU45', name: 'Total Goals (O/U 4.5)', sportId: ['football'], autoAttach: false, sortOrder: 8,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 4.5' }, { key: 'Under', label: 'Under 4.5' }] } },
  { key: 'DNB', name: 'Draw No Bet', sportId: ['football'], autoAttach: true, sortOrder: 9,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1', label: 'Home' }, { key: '2', label: 'Away' }] } },
  { key: 'AH1', name: 'Asian Handicap (±1)', sportId: ['football'], autoAttach: true, sortOrder: 10,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'H-1', label: 'Home -1' }, { key: 'A+1', label: 'Away +1' }] } },
  { key: 'AH2', name: 'Asian Handicap (±2)', sportId: ['football'], autoAttach: false, sortOrder: 11,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'H-2', label: 'Home -2' }, { key: 'A+2', label: 'Away +2' }] } },
  { key: '1H1X2', name: '1st Half Winner', sportId: ['football'], autoAttach: true, sortOrder: 12,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1', label: 'Home' }, { key: 'X', label: 'Draw' }, { key: '2', label: 'Away' }] } },
  { key: '1HOU05', name: '1st Half Goals (O/U 0.5)', sportId: ['football'], autoAttach: true, sortOrder: 13,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 0.5' }, { key: 'Under', label: 'Under 0.5' }] } },
  { key: '1HBTTS', name: '1st Half BTTS', sportId: ['football'], autoAttach: true, sortOrder: 14,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Yes', label: 'Yes' }, { key: 'No', label: 'No' }] } },
  { key: 'HTFT', name: 'Half-Time / Full-Time', sportId: ['football'], autoAttach: true, sortOrder: 15,
    selectionSpec: { type: 'fixed', outcomes: [
      { key: '1/1', label: 'Home / Home' }, { key: '1/X', label: 'Home / Draw' }, { key: '1/2', label: 'Home / Away' },
      { key: 'X/1', label: 'Draw / Home' }, { key: 'X/X', label: 'Draw / Draw' }, { key: 'X/2', label: 'Draw / Away' },
      { key: '2/1', label: 'Away / Home' }, { key: '2/X', label: 'Away / Draw' }, { key: '2/2', label: 'Away / Away' },
    ] } },
  { key: 'WINBTTS', name: 'Result & Both Teams To Score', sportId: ['football'], autoAttach: true, sortOrder: 16,
    selectionSpec: { type: 'combo', baseMarkets: ['1X2', 'BTTS'] } },
  { key: 'WINOU25', name: 'Result & Total Goals (2.5)', sportId: ['football'], autoAttach: true, sortOrder: 17,
    selectionSpec: { type: 'combo', baseMarkets: ['1X2', 'OU25'] } },
  { key: 'BTTSOU25', name: 'BTTS & Total Goals (2.5)', sportId: ['football'], autoAttach: true, sortOrder: 18,
    selectionSpec: { type: 'combo', baseMarkets: ['BTTS', 'OU25'] } },
  { key: 'CS', name: 'Correct Score', sportId: ['football'], autoAttach: true, sortOrder: 19,
    selectionSpec: { type: 'correct_score_grid', maxHome: 6, maxAway: 6, includeOther: true } },

  // ── Basketball ──────────────────────────────────────────
  { key: 'ML', name: 'Money Line', sportId: ['basketball'], autoAttach: true, sortOrder: 1,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1', label: 'Home' }, { key: '2', label: 'Away' }] } },
  { key: 'TP', name: 'Total Points', sportId: ['basketball'], autoAttach: true, sortOrder: 2,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over' }, { key: 'Under', label: 'Under' }] } },
  { key: 'HCAP', name: 'Handicap', sportId: ['basketball'], autoAttach: true, sortOrder: 3,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1H', label: 'Home' }, { key: '2H', label: 'Away' }] } },

  // ── Tennis ──────────────────────────────────────────────
  { key: 'ML', name: 'Match Winner', sportId: ['tennis'], autoAttach: true, sortOrder: 1,
    selectionSpec: { type: 'fixed', outcomes: [{ key: '1', label: 'Player 1' }, { key: '2', label: 'Player 2' }] } },
  { key: 'SETS', name: 'Total Sets', sportId: ['tennis'], autoAttach: true, sortOrder: 2,
    selectionSpec: { type: 'fixed', outcomes: [{ key: 'Over', label: 'Over 2.5' }, { key: 'Under', label: 'Under 2.5' }] } },
];

/**
 * Ensure built-in templates exist in the store. Called on boot.
 */
export function seedTemplates() {
  const existing = Object.values(store.all() || {});
  const existingKeys = new Set(existing.map((t) => t.key));
  let count = 0;

  for (const tmpl of BUILTIN_TEMPLATES) {
    if (existingKeys.has(tmpl.key)) continue;
    const id = `tmpl-${tmpl.key}`;
    const rec = {
      id,
      ...tmpl,
      defaultEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.set(id, rec);
    count++;
  }
  return count;
}

export function listTemplates(opts = {}) {
  let all = Object.values(store.all() || {});
  if (opts.sportId) all = all.filter((t) => t.sportId.includes(opts.sportId));
  return all.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

export function getTemplate(id) {
  return store.get(id) || null;
}

export function getTemplateByKey(key) {
  return Object.values(store.all() || {}).find((t) => t.key === key) || null;
}

export function getAutoAttachTemplates(sportId) {
  return listTemplates({ sportId }).filter((t) => t.autoAttach && t.defaultEnabled);
}

export function createTemplate(input) {
  const id = `tmpl-${input.key}`;
  const rec = {
    id,
    key: input.key,
    name: input.name,
    sportId: input.sportId,
    autoAttach: input.autoAttach ?? false,
    sortOrder: input.sortOrder ?? 99,
    defaultEnabled: input.defaultEnabled ?? true,
    selectionSpec: input.selectionSpec,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}

export function updateTemplate(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return next;
}

export function deleteTemplate(id) {
  const cur = store.get(id);
  if (!cur) return false;
  store.delete(id);
  return true;
}
