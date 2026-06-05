/**
 * System-bet definitions and combinatorial math, shared by the bet slip
 * (preview) and the server (placement + settlement).
 *
 * A system bet is one wager that is mechanically decomposed into many
 * sub-bets ("lines").  e.g. a "Trixie" on 3 selections is 4 lines:
 * three doubles and one treble.  Stake-per-line × total-lines = stake
 * actually deducted from the wallet.
 *
 * Each entry below mirrors the standard UK sportsbook definition.
 */

export const SYSTEM_TYPES = {
  trixie: {
    label: 'Trixie',
    selections: 3,
    totalLines: 4,
    lines: [
      { k: 2, count: 3 },
      { k: 3, count: 1 },
    ],
  },
  patent: {
    label: 'Patent',
    selections: 3,
    totalLines: 7,
    lines: [
      { k: 1, count: 3 },
      { k: 2, count: 3 },
      { k: 3, count: 1 },
    ],
  },
  yankee: {
    label: 'Yankee',
    selections: 4,
    totalLines: 11,
    lines: [
      { k: 2, count: 6 },
      { k: 3, count: 4 },
      { k: 4, count: 1 },
    ],
  },
  lucky15: {
    label: 'Lucky 15',
    selections: 4,
    totalLines: 15,
    lines: [
      { k: 1, count: 4 },
      { k: 2, count: 6 },
      { k: 3, count: 4 },
      { k: 4, count: 1 },
    ],
  },
  lucky31: {
    label: 'Lucky 31',
    selections: 5,
    totalLines: 31,
    lines: [
      { k: 1, count: 5 },
      { k: 2, count: 10 },
      { k: 3, count: 10 },
      { k: 4, count: 5 },
      { k: 5, count: 1 },
    ],
  },
  heinz: {
    label: 'Heinz',
    selections: 6,
    totalLines: 57,
    lines: [
      { k: 2, count: 15 },
      { k: 3, count: 20 },
      { k: 4, count: 15 },
      { k: 5, count: 6 },
      { k: 6, count: 1 },
    ],
  },
  superheinz: {
    label: 'Super Heinz',
    selections: 7,
    totalLines: 120,
    lines: [
      { k: 2, count: 21 },
      { k: 3, count: 35 },
      { k: 4, count: 35 },
      { k: 5, count: 21 },
      { k: 6, count: 7 },
      { k: 7, count: 1 },
    ],
  },
  goliath: {
    label: 'Goliath',
    selections: 8,
    totalLines: 247,
    lines: [
      { k: 2, count: 28 },
      { k: 3, count: 56 },
      { k: 4, count: 70 },
      { k: 5, count: 56 },
      { k: 6, count: 28 },
      { k: 7, count: 8 },
      { k: 8, count: 1 },
    ],
  },
};

/** Which system types are usable given N selections currently on the slip. */
export function eligibleSystemTypes(selectionCount) {
  return Object.entries(SYSTEM_TYPES)
    .filter(([, def]) => def.selections === selectionCount)
    .map(([key, def]) => ({ key, ...def }));
}

/** Pick a sensible default system type for the current selection count. */
export function defaultSystemType(selectionCount) {
  const elig = eligibleSystemTypes(selectionCount);
  if (!elig.length) return null;
  // Prefer "lucky/heinz/goliath" family which includes all singles+combos
  return elig.find((e) => /lucky|heinz|goliath|patent/.test(e.key))?.key || elig[0].key;
}

/** All combinations of size k drawn from items (order doesn't matter). */
function combinations(items, k) {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  if (items.length === k) return [items.slice()];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

/**
 * Maximum potential return if every selection wins.  Sums stake × product-of-odds
 * for every line in the system.  Stake is the per-line stake, not the total.
 */
export function maxSystemReturn(odds, systemKey, stakePerLine) {
  const def = SYSTEM_TYPES[systemKey];
  if (!def || odds.length !== def.selections) return 0;
  let total = 0;
  for (const group of def.lines) {
    for (const combo of combinations(odds, group.k)) {
      total += stakePerLine * combo.reduce((a, b) => a * b, 1);
    }
  }
  return total;
}
