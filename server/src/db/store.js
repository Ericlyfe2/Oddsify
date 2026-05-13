/**
 * Atomic JSON file store. One in-memory state per file, debounced writes,
 * tmp+rename for crash safety. Designed so it can be swapped for SQLite/Postgres
 * later without callers needing to change.
 */
import fs from 'fs';
import path from 'path';
import { PATHS } from '../config/env.js';

if (!fs.existsSync(PATHS.data)) fs.mkdirSync(PATHS.data, { recursive: true });

const stores = new Map();

function load(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function persistSync(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function createStore(name, fallback = {}) {
  if (stores.has(name)) return stores.get(name);
  const file = path.join(PATHS.data, `${name}.json`);
  const state = { data: load(file, fallback), file, dirty: false, timer: null };

  const flush = () => {
    if (!state.dirty) return;
    state.dirty = false;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    persistSync(state.file, state.data);
  };

  const markDirty = () => {
    state.dirty = true;
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      flush();
    }, 50);
  };

  const api = {
    all() { return state.data; },
    get(k) { return state.data[k]; },
    set(k, v) { state.data[k] = v; markDirty(); return v; },
    delete(k) { delete state.data[k]; markDirty(); },
    update(k, fn) { state.data[k] = fn(state.data[k]); markDirty(); return state.data[k]; },
    list() { return Object.values(state.data); },
    flush,
  };

  stores.set(name, api);
  return api;
}

// Flush every store on graceful shutdown to avoid losing the last-50ms of writes.
function flushAll() { for (const s of stores.values()) s.flush(); }
process.on('SIGINT',  () => { flushAll(); process.exit(0); });
process.on('SIGTERM', () => { flushAll(); process.exit(0); });
process.on('beforeExit', flushAll);
