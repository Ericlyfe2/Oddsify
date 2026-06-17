/**
 * Teams store — canonical team records.
 *
 * Teams are reusable across matches and linked to a sport. Using records
 * instead of free-text names strengthens deduplication: the same team in
 * two fixtures has the same ID.
 */
import crypto from 'crypto';
import { createStore } from './store.js';
import { normalize } from '../utils/dudupe.js';

const store = createStore('teams_catalog', {});

export function listTeams(opts = {}) {
  let all = Object.values(store.all() || {});
  if (opts.sportId) all = all.filter((t) => t.sportId === opts.sportId);
  if (opts.active !== undefined) all = all.filter((t) => t.active === opts.active);
  if (opts.search) {
    const q = String(opts.search).toLowerCase();
    all = all.filter((t) => t.name.toLowerCase().includes(q) || (t.shortName || '').toLowerCase().includes(q));
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export function getTeam(id) {
  return store.get(id) || null;
}

export function findTeamByName(name, sportId) {
  const norm = normalize(name);
  return listTeams({ sportId }).find((t) => normalize(t.name) === norm);
}

export function createTeam(input) {
  const id = `team-${crypto.randomBytes(4).toString('hex')}`;
  if (!input.name || !input.sportId) throw new Error('Team name and sportId required');
  if (findTeamByName(input.name, input.sportId)) throw new Error(`Team "${input.name}" already exists in this sport`);

  const rec = {
    id,
    name: String(input.name).trim(),
    shortName: String(input.shortName || input.name).trim().slice(0, 3).toUpperCase(),
    logo: input.logo || '',
    country: input.country || '',
    sportId: input.sportId,
    active: input.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.set(id, rec);
  return rec;
}

export function updateTeam(id, patch) {
  const cur = store.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return next;
}

export function archiveTeam(id) {
  return updateTeam(id, { active: false });
}
