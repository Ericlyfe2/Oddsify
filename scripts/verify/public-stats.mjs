/**
 * Verification script for server/src/services/publicStats.js
 * Run with: node scripts/verify/public-stats.mjs
 */
import { initStores } from '../../server/src/db/store.js';
import { getPublicStats, _resetCacheForTests } from '../../server/src/services/publicStats.js';

let pass = 0,
  fail = 0;
const check = (c, m) => {
  if (c) {
    console.log('  PASS  ' + m);
    pass++;
  } else {
    console.error('  FAIL  ' + m);
    fail++;
  }
};

await initStores();
_resetCacheForTests();

const s = getPublicStats();
console.log('# computed stats:', s);

check(s && typeof s === 'object', 'returns object');
check(typeof s.totalBets === 'number', 'totalBets is number');
check(typeof s.totalPayoutsGhs === 'number', 'totalPayoutsGhs is number');
check(typeof s.activeUsers24h === 'number', 'activeUsers24h is number');
check(typeof s.liveMatches === 'number', 'liveMatches is number');
check(s.totalBets >= 0, 'totalBets non-negative');
check(s.totalPayoutsGhs >= 0, 'totalPayoutsGhs non-negative');
check(Number.isInteger(s.totalBets), 'totalBets integer');
check(Number.isInteger(s.totalPayoutsGhs), 'totalPayoutsGhs integer (floored)');

console.log('# cache identity');
const first = getPublicStats();
const second = getPublicStats();
check(first === second, 'cached payload is identity-equal within TTL');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
