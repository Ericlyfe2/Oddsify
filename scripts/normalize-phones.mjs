import { createStore } from '../server/src/db/store.js';
import { normalizePhone, isE164, detectCountryFromPhone } from '../server/src/lib/phone.js';
import { log } from '../server/src/utils/logger.js';
import { initStores } from '../server/src/db/store.js';

async function migrate() {
  await initStores();

  const users = createStore('users', {});
  const all = users.list();
  const migrations = [];
  const duplicates = [];
  const seen = new Map();

  for (const u of all) {
    if (u.email.includes('@')) continue;

    const original = u.email;

    if (isE164(original)) {
      if (seen.has(original)) {
        log.warn(`duplicate E.164: "${original}" (users: ${seen.get(original)}, ${u.id})`);
        duplicates.push({ id: u.id, email: original });
      } else {
        seen.set(original, u.id);
      }
      continue;
    }

    const detected = detectCountryFromPhone(original);
    const country = detected || u.country || 'GH';
    const normalized = normalizePhone(original, country);

    if (!normalized) {
      log.warn(`cannot normalize: "${original}" (country: ${country})`);
      continue;
    }

    if (normalized === original) {
      seen.set(normalized, u.id);
      continue;
    }

    if (seen.has(normalized)) {
      log.warn(`duplicate after normalization: "${original}" -> "${normalized}" conflicts with ${seen.get(normalized)}`);
      duplicates.push({ id: u.id, email: original, normalized, conflictsWith: seen.get(normalized) });
      continue;
    }

    const newId = normalized.toLowerCase();
    if (users.get(newId)) {
      log.warn(`key "${newId}" already exists, cannot migrate "${original}"`);
      duplicates.push({ id: u.id, email: original, normalized, keyExists: true });
      continue;
    }

    log.info(`migrating: "${original}" -> "${normalized}" (id: ${u.id} -> ${newId})`);
    const updated = users.update(u.id, (cur) => ({ ...cur, email: normalized, id: newId }));
    users.delete(u.id);
    users.set(newId, updated);
    seen.set(normalized, newId);
    migrations.push({ from: u.id, to: newId, original, normalized });
  }

  if (migrations.length > 0) {
    const migStore = createStore('migrations', {});
    const existing = migStore.all();
    migStore.set(`phone-normalize-${Date.now()}`, {
      at: new Date().toISOString(),
      migrations,
      duplicates,
    });
  }

  log.info(`\nMigration complete:`);
  log.info(`  migrated: ${migrations.length}`);
  log.info(`  duplicates/skipped: ${duplicates.length}`);

  if (duplicates.length > 0) {
    log.info(`\nDuplicates to resolve manually:`);
    duplicates.forEach((d) => log.info(`  ${d.id} (${d.email})`));
  }
}

migrate().catch((e) => {
  log.error('Migration failed:', e);
  process.exit(1);
});
