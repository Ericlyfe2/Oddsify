/**
 * Verification script for server/src/services/recentWins.js
 * Run with: node scripts/verify/recent-wins.mjs
 * Exits non-zero on any failure.
 */
import { initStores } from '../../server/src/db/store.js';
import {
  maskPhone,
  buildSyntheticWin,
  getRecentWins,
  _resetCacheForTests,
} from '../../server/src/services/recentWins.js';

let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { console.log('  PASS  ' + msg); pass++; }
  else      { console.error('  FAIL  ' + msg); fail++; }
};

console.log('# maskPhone');
check(maskPhone('0241234567')      === '024•••567', '10-digit local phone');
check(maskPhone('+233241234567')   === '233•••567', 'intl format strips non-digits');
check(maskPhone('024-123-4567')    === '024•••567', 'dashed format strips non-digits');
check(maskPhone('')                === '•••••••',  'empty input fully masked');
check(maskPhone(null)              === '•••••••',  'null input fully masked');
check(maskPhone('12345')           === '•••••••',  'too short fully masked');

console.log('# buildSyntheticWin');
const w = buildSyntheticWin();
check(w.kind === 'synthetic',                           'kind tag is "synthetic"');
check(typeof w.id === 'string' && w.id.length > 0,      'has non-empty id');
check(typeof w.phoneMasked === 'string',                'phoneMasked is string');
check(w.phoneMasked.includes('•••'),                    'phoneMasked contains masking dots');
check(typeof w.amountGhs === 'number' && w.amountGhs >= 50, 'amount >= 50 GHS');
check(['single','multi'].includes(w.betType),           'valid betType');
check(w.legs >= 1 && w.legs <= 10,                      'leg count in [1, 10]');
check(typeof w.oddsTotal === 'number' && w.oddsTotal >= 1.4, 'oddsTotal >= 1.4');
check(typeof w.settledAt === 'string' && !isNaN(new Date(w.settledAt)), 'settledAt is parseable');

console.log('# synthetic amount distribution (1000 samples)');
const N = 1000;
const buckets = { under5k: 0, mid: 0, big: 0 };
for (let i = 0; i < N; i++) {
  const x = buildSyntheticWin();
  if (x.amountGhs < 5000) buckets.under5k++;
  else if (x.amountGhs < 50000) buckets.mid++;
  else buckets.big++;
}
console.log('  distribution:', buckets, '(target ~70/25/5)');
check(buckets.under5k > N * 0.60 && buckets.under5k < N * 0.80, '~70% under 5K');
check(buckets.mid     > N * 0.15 && buckets.mid     < N * 0.35, '~25% in 5K–50K');
check(buckets.big     > N * 0.01 && buckets.big     < N * 0.10, '~5% above 50K');

console.log('# getRecentWins (always 15)');
await initStores();
_resetCacheForTests();
const { wins } = getRecentWins();
check(Array.isArray(wins) && wins.length === 15,        'returns exactly 15 wins');
check(wins.every(x => typeof x.phoneMasked === 'string'), 'every item has phoneMasked');
check(wins.every(x => ['real','synthetic'].includes(x.kind)), 'every item has valid kind');

console.log('# cache hit returns same reference');
const first = getRecentWins();
const second = getRecentWins();
check(first === second, 'cached payload is identity-equal within TTL');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
