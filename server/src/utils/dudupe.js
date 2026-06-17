/**
 * Deduplication utilities for matches and leagues.
 *
 * `normalize(str)` — lowercases, trims, strips accents/punctuation, collapses
 * whitespace to a single space. Used for team names, league names, etc.
 *
 * `dedupeHash(parts...)` — SHA-1 hex of the concatenated normalized inputs.
 * Used as a UNIQUE constraint key on matches.
 *
 * `findDuplicate(existing, query)` — searches a list of records for an exact
 * normalized match or a near-duplicate (fuzzy time window).
 */
import crypto from 'crypto';

const ACCENT_MAP = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ç': 'c', 'ñ': 'n', 'ß': 'ss',
  'æ': 'ae', 'œ': 'oe',
};

export function normalize(str) {
  if (!str) return '';
  let s = String(str).trim().toLowerCase();
  s = s.replace(/[^a-z0-9\s-]/g, (ch) => ACCENT_MAP[ch] || '');
  s = s.replace(/[-_]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function dedupeHash(...parts) {
  const input = parts.map((p) => normalize(String(p ?? ''))).join('|');
  return crypto.createHash('sha1').update(input).digest('hex');
}

export function findDuplicate(records, query, { normalizeKey, timeField, timeWindowMs } = {}) {
  const qNorm = normalize(String(query ?? ''));
  const exact = records.find((r) => {
    const key = normalizeKey ? normalize(r[normalizeKey]) : normalize(String(r));
    return key === qNorm;
  });
  if (exact) return { type: 'exact', record: exact };

  if (timeField && timeWindowMs) {
    const qTime = new Date(query).getTime();
    const near = records.find((r) => {
      const t = new Date(r[timeField]).getTime();
      return Number.isFinite(t) && Number.isFinite(qTime) && Math.abs(t - qTime) <= timeWindowMs;
    });
    if (near) return { type: 'near', record: near };
  }

  return null;
}
