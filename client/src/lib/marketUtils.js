const ORDER_1X2 = ['1', 'X', '2'];

export function ensure1X2Order(selections) {
  if (!selections || !Array.isArray(selections)) return selections || [];
  const has1X2Keys = selections.some((s) => ['1', 'X', '2'].includes(s?.key));
  if (!has1X2Keys) return selections;
  const keyMap = {};
  for (const s of selections) {
    keyMap[s.key] = s;
  }
  const ordered = [];
  for (const k of ORDER_1X2) {
    if (keyMap[k]) ordered.push(keyMap[k]);
  }
  for (const s of selections) {
    if (!ORDER_1X2.includes(s.key)) ordered.push(s);
  }
  return ordered;
}

export function sortOddsEntries(odds) {
  if (!odds) return [];
  const entries = Object.entries(odds);
  const has1X2 = entries.some(([k]) => ['1', 'X', '2'].includes(k));
  if (!has1X2) return entries;
  const keyMap = {};
  for (const [k, v] of entries) keyMap[k] = v;
  const ordered = [];
  for (const k of ORDER_1X2) {
    if (keyMap[k] !== undefined) ordered.push([k, keyMap[k]]);
  }
  for (const [k, v] of entries) {
    if (!ORDER_1X2.includes(k)) ordered.push([k, v]);
  }
  return ordered;
}
