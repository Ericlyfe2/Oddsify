/**
 * Server mirror of client/src/lib/systemBets.js — kept in sync so the
 * payout the slip previews matches what settlement actually credits.
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

function combinations(items, k) {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  if (items.length === k) return [items.slice()];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

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
