/**
 * Auto-settlement engine.
 *  - Runs every SETTLE_INTERVAL_MS.
 *  - For every fixture, ensures a final score exists (manual or simulated).
 *  - For every open bet whose ALL legs reference fixtures with final scores,
 *    resolves each leg, marks the bet won/lost/void, credits the wallet,
 *    pushes a transaction, fires an audit event, and (on win) sets
 *    wonNotAcknowledged so the storefront trophy modal can fire.
 *
 *  Simulated scores are only generated when the fixture's kickoff has
 *  elapsed by more than SIM_AFTER_MS. This lets admins set a manual score
 *  first if they want to. Real sportsbooks would replace this with a live
 *  results feed.
 */
import crypto from 'crypto';
import { createStore } from '../db/store.js';
import { getResult, setResult, adminLookupFixture, adminListFixtures } from '../db/sportsAdmin.js';
import { recordAudit } from '../db/audit.js';
import { updateUser, getUserById, logActivity } from '../db/users.js';
import { log } from '../utils/logger.js';
import { emitToUser, emitAdmin, emitScoreUpdate } from './realtime.js';

const betsStore = createStore('bets', {});
const txStore = createStore('transactions', {});

const SETTLE_INTERVAL_MS = 10_000;
const SIM_AFTER_MS = 110 * 60 * 1000; // ~110 minutes after kickoff
const MATCH_DURATION_MS = 105 * 60 * 1000;
const SIM_SETTLE_WAIT_MS = 2 * 60 * 1000; // 2 minutes after simulated result, settle automatically

let timer = null;

/* ------------ score simulation ------------ */

const FOOTBALL_SCORES = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 0],
  [0, 2],
  [2, 2],
  [3, 1],
  [1, 3],
  [3, 0],
  [0, 0],
  [3, 2],
  [2, 3],
  [0, 3],
  [4, 0],
];
const BASKET_TOTALS = [210, 218, 222, 226, 230, 234];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function simulateScore(sport, match) {
  if (sport === 'basketball' || sport === 'ml') {
    const total = rand(BASKET_TOTALS);
    const home = Math.round(total * (0.45 + Math.random() * 0.1));
    return [home, total - home];
  }
  if (sport === 'tennis') {
    // 0–2 sets totals
    return Math.random() < 0.55 ? [2, Math.random() < 0.5 ? 0 : 1] : [Math.random() < 0.5 ? 0 : 1, 2];
  }
  // football default — bias to lower scores by sorting
  const pick = rand(FOOTBALL_SCORES);
  return Math.random() < 0.5 ? pick : [pick[1], pick[0]];
}

/** Parse a fixture's kickoff into a timestamp; falls back to "in the past" for fixtures already marked live. */
function kickoffTs(match) {
  if (match.finishedAt) return new Date(match.finishedAt).getTime();
  if (match.isLive) {
    // Estimate elapsed time from match.minute (e.g., "56'", "45+2'", "HT").
    // Without this, an isLive match would be SIM_AFTER_MS old on first sweep
    // and auto-settle instantly — closing the market and breaking /bet/place
    // for every live fixture (returns 409 MARKET_CLOSED).
    const minNum = parseInt(String(match.minute || '').replace(/[^\d]/g, ''), 10);
    const elapsedMs = Number.isFinite(minNum) && minNum > 0 ? minNum * 60_000 : 0;
    return Date.now() - elapsedMs;
  }
  if (!match.kickoff) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [hh = '0', mm = '0'] = String(match.kickoff).split(':');
  let base = new Date(today.getTime() + Number(hh) * 3600_000 + Number(mm) * 60_000);
  const dayLow = String(match.day || '').toLowerCase();
  if (dayLow === 'tomorrow') base = new Date(base.getTime() + 86_400_000);
  else if (dayLow.startsWith('in ')) {
    const n = parseInt(dayLow.replace(/[^0-9]/g, ''), 10) || 0;
    base = new Date(base.getTime() + n * 86_400_000);
  }
  return base.getTime();
}

/** Ensure a final score exists for a fixture; returns the result row or null. */
const resultsStore = createStore('sports_admin', {});

function ensureResult(match, sport) {
  const existing = getResult(match.id);
  if (existing) return existing;
  if (match.finished) {
    setResult(match.id, match.scoreHome ?? 0, match.scoreAway ?? 0, 'feed');
    return getResult(match.id);
  }
  const ko = kickoffTs(match);
  if (!ko) return null;
  if (Date.now() - ko < SIM_AFTER_MS) return null;
  const [h, a] = simulateScore(sport, match);
  setResult(match.id, h, a, 'simulated');
  // Tag the simulated result with a creation timestamp so settleNow can
  // apply the SIM_SETTLE_WAIT_MS grace period before auto-settling.
  const cur = resultsStore.get('results') || {};
  if (cur[match.id]) {
    cur[match.id].settledAt = new Date().toISOString();
    resultsStore.set('results', cur);
  }
  return getResult(match.id);
}

/* ------------ leg resolvers ------------ */

export function legWon(leg, scoreHome, scoreAway, htHome = null, htAway = null) {
  const m = String(leg.market || '').toUpperCase();
  const o = String(leg.outcome || '');
  const total = scoreHome + scoreAway;
  const homeWin = scoreHome > scoreAway;
  const awayWin = scoreAway > scoreHome;
  const draw = scoreHome === scoreAway;
  const btts = scoreHome > 0 && scoreAway > 0;
  const hasHT = htHome != null && htAway != null;

  if (m === '1X2') {
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
    if (o === 'X') return draw;
  }

  if (m === 'ML') {
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
  }

  if (m === 'DC') {
    if (o === '1X') return homeWin || draw;
    if (o === 'X2') return awayWin || draw;
    if (o === '12') return homeWin || awayWin;
  }

  if (m === 'DNB') {
    if (draw) return null;
    if (o === '1') return homeWin;
    if (o === '2') return awayWin;
  }

  const ouMatch = m.match(/^OU(\d)(\d)$/);
  if (ouMatch) {
    const line = parseInt(ouMatch[1], 10) + parseInt(ouMatch[2], 10) / 10;
    if (o === 'Over') return total > line;
    if (o === 'Under') return total < line;
  }

  if (m === 'BTTS') {
    if (o === 'Yes') return btts;
    if (o === 'No') return !btts;
  }

  if (m === 'CS') {
    const actual = `${scoreHome}-${scoreAway}`;
    if (/^\d+-\d+$/.test(o)) return o === actual;
    const inGrid = scoreHome <= 6 && scoreAway <= 6;
    if (o === 'OTHER_HOME') return !inGrid && homeWin;
    if (o === 'OTHER_AWAY') return !inGrid && awayWin;
    if (o === 'OTHER_DRAW') return !inGrid && draw;
    if (o === 'OTHER') return !inGrid;
  }

  const ahMatch = m.match(/^AH(\d)$/);
  if (ahMatch) {
    const hc = parseInt(ahMatch[1], 10);
    if (o === `H-${hc}`) return scoreHome - scoreAway > hc;
    if (o === `A+${hc}`) return scoreAway - scoreHome > -hc;
  }

  if (m === 'TP') {
    const line = leg.line || 220.5;
    if (o === 'Over') return total > line;
    if (o === 'Under') return total < line;
  }

  if (m === 'HCAP') {
    const hc = Number(leg.handicap || 0);
    if (o === '1H') return scoreHome - hc > scoreAway;
    if (o === '2H') return scoreAway + hc > scoreHome;
  }

  if (m === '1H1X2') {
    if (!hasHT) return null;
    if (o === '1') return htHome > htAway;
    if (o === '2') return htAway > htHome;
    if (o === 'X') return htHome === htAway;
  }
  if (m === '1HOU05') {
    if (!hasHT) return null;
    const htTotal = htHome + htAway;
    if (o === 'Over') return htTotal > 0.5;
    if (o === 'Under') return htTotal < 0.5;
  }
  if (m === '1HBTTS') {
    if (!hasHT) return null;
    const htBtts = htHome > 0 && htAway > 0;
    if (o === 'Yes') return htBtts;
    if (o === 'No') return !htBtts;
  }

  if (m === 'HTFT') {
    if (!hasHT) return null;
    const htResult = htHome > htAway ? '1' : htHome < htAway ? '2' : 'X';
    const ftResult = homeWin ? '1' : awayWin ? '2' : 'X';
    return o === `${htResult}/${ftResult}`;
  }

  if (m === 'WINBTTS') {
    const resultPart = o.slice(0, -1);
    const bttsPart = o.slice(-1);
    const resultWon = resultPart === '1' ? homeWin : resultPart === '2' ? awayWin : resultPart === 'X' ? draw : false;
    const bttsWon = bttsPart === 'Y' ? btts : !btts;
    return resultWon && bttsWon;
  }

  if (m === 'WINOU25') {
    const resultPart = o.slice(0, -1);
    const ouPart = o.slice(-1);
    const resultWon = resultPart === '1' ? homeWin : resultPart === '2' ? awayWin : resultPart === 'X' ? draw : false;
    const ouWon = ouPart === 'O' ? total > 2.5 : total < 2.5;
    return resultWon && ouWon;
  }

  if (m === 'BTTSOU25') {
    const bttsPart = o[0];
    const ouPart = o[1];
    const bttsWon = bttsPart === 'Y' ? btts : !btts;
    const ouWon = ouPart === 'O' ? total > 2.5 : total < 2.5;
    return bttsWon && ouWon;
  }

  return null;
}

/* ------------ main tick ------------ */

function pushTx(userId, tx) {
  const id = `tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const entry = { id, userId, at: new Date().toISOString(), ...tx };
  const list = txStore.get(userId) || [];
  txStore.set(userId, [entry, ...list].slice(0, 500));
  return entry;
}

export function settleNow() {
  const fixtures = adminListFixtures();
  // Pre-warm results for fixtures that are due
  for (const fx of fixtures) {
    ensureResult(fx, fx.sport);
  }

  const open = Object.values(betsStore.all() || {}).filter((b) => b.status === 'open');
  let settledWins = 0,
    settledLoss = 0,
    settledVoid = 0;
  for (const bet of open) {
    let allReady = true;
    const legResults = [];
    for (const leg of bet.legs || []) {
      const view = adminLookupFixture(leg.matchId);
      const sport = view?.sport?.id || view?.sport || 'football';
      const res = view ? ensureResult(view.match, sport) : null;
      // Auto-simulated results settle after a grace period so admins have
      // time to override them. Manual or feed results settle immediately.
      if (res && res.source === 'simulated') {
        const simulatedAt = res.settledAt ? new Date(res.settledAt).getTime() : Date.now();
        if (Date.now() - simulatedAt < SIM_SETTLE_WAIT_MS) {
          allReady = false;
          break;
        }
      } else if (!res || (res.source !== 'manual' && res.source !== 'feed')) {
        allReady = false;
        break;
      }
      const won = legWon(leg, res.scoreHome, res.scoreAway, res.htHomeScore ?? null, res.htAwayScore ?? null);
      legResults.push({ leg, res, won });
    }
    if (!allReady) continue;

    const anyVoid = legResults.some((r) => r.won === null);
    const allWon = legResults.every((r) => r.won === true);
    const status = anyVoid && legResults.every((r) => r.won !== false) ? 'void' : allWon ? 'won' : 'lost';

    const user = getUserById(bet.userId);
    let credit = 0;
    if (status === 'won') credit = bet.potentialWin;
    if (status === 'void') credit = bet.stake;
    const updated = {
      ...bet,
      status,
      settledAt: new Date().toISOString(),
      settledBy: 'auto',
      settledReturn: credit,
      settledProfit: Number((credit - bet.stake).toFixed(2)),
      legsResolved: legResults.map((r) => ({
        matchId: r.leg.matchId,
        market: r.leg.market,
        outcome: r.leg.outcome,
        won: r.won,
        scoreHome: r.res.scoreHome,
        scoreAway: r.res.scoreAway,
      })),
      ...(status === 'won' ? { wonNotAcknowledged: true } : {}),
    };
    betsStore.set(bet.id, updated);

    if (user && credit > 0) {
      const nextUser = updateUser(user.id, { balance: Number((user.balance + credit).toFixed(2)) });
      pushTx(user.id, {
        kind: status === 'won' ? 'bet_won' : 'bet_void_refund',
        amount: credit,
        status: 'completed',
        balanceAfter: nextUser.balance,
        ref: bet.id,
      });
      logActivity(user.id, { kind: `bet_${status}`, betId: bet.id, credit });
      emitToUser(user.id, 'wallet:update', {
        balance: nextUser.balance,
        delta: credit,
        reason: `bet:${status}`,
        ref: bet.id,
      });
    }
    // Push the leg results out as score updates for any clients watching the fixture
    for (const r of legResults) {
      emitScoreUpdate({
        fixtureId: r.leg.matchId,
        scoreHome: r.res.scoreHome,
        scoreAway: r.res.scoreAway,
        finished: true,
      });
    }
    emitToUser(bet.userId, 'bet:settled', { betId: bet.id, status, payout: credit });
    if (status === 'won') emitToUser(bet.userId, 'bet:won', { betId: bet.id, payout: credit, stake: bet.stake });
    emitAdmin('bet:settled', { betId: bet.id, status, userId: bet.userId, stake: bet.stake, credit });

    recordAudit({
      action: `bet.auto-settle.${status}`,
      target: bet.id,
      targetType: 'bet',
      severity: status === 'won' ? 'info' : 'info',
      meta: { stake: bet.stake, credit, legs: legResults.length, userId: bet.userId },
    });

    if (status === 'won') settledWins++;
    if (status === 'lost') settledLoss++;
    if (status === 'void') settledVoid++;
  }
  return { settledWins, settledLoss, settledVoid };
}

export function startSettlementLoop() {
  if (timer) return;
  // first sweep on boot
  try {
    settleNow();
  } catch (e) {
    log.error('settle initial', e?.message);
  }
  timer = setInterval(() => {
    try {
      const r = settleNow();
      if (r.settledWins + r.settledLoss + r.settledVoid > 0) {
        log.info(`auto-settle ${r.settledWins}w / ${r.settledLoss}l / ${r.settledVoid}v`);
      }
    } catch (e) {
      log.error('settle tick', e?.message || e);
    }
  }, SETTLE_INTERVAL_MS);
}

export function stopSettlementLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}
