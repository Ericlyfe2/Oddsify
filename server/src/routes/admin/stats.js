/**
 * Deeper analytics aggregations.
 *  /summary      — high-level KPIs over a window
 *  /top-players  — biggest stakers, biggest winners, riskiest losers
 *  /sports       — stake / win-rate / hold % per sport
 *  /cohorts      — weekly signup retention matrix
 *  /funnel       — signup → verified → first deposit → first bet → second bet
 */
import { Router } from 'express';
import { createStore } from '../../db/store.js';
import { allUsers, getUserById } from '../../db/users.js';
import { requireAdmin } from '../../middleware/adminAuth.js';

const router = Router();

const betsStore = createStore('bets', {});
const txStore = createStore('transactions', {});

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const dayKey = (d) => startOfDay(d).toISOString().slice(0, 10);
const weekStart = (d) => {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
};

function flatTx() {
  return Object.values(txStore.all() || {}).flat();
}

router.get('/summary', requireAdmin, (req, res) => {
  const windowDays = Math.min(Number(req.query.window) || 30, 180);
  const since = Date.now() - windowDays * DAY;
  const bets = Object.values(betsStore.all() || {}).filter((b) => new Date(b.placedAt).getTime() > since);
  const tx = flatTx().filter((t) => new Date(t.at).getTime() > since);
  const users = allUsers().filter((u) => u.role !== 'admin');

  const stake = bets.reduce((s, b) => s + (b.stake || 0), 0);
  const payouts =
    bets.filter((b) => b.status === 'won').reduce((s, b) => s + (b.potentialWin || 0), 0) +
    bets.filter((b) => b.status === 'cashed_out').reduce((s, b) => s + (b.cashOut || 0), 0);
  const ggr = stake - payouts;
  const hold = stake > 0 ? ggr / stake : 0;
  const playerCount = new Set(bets.map((b) => b.userId)).size;
  const newSignups = users.filter((u) => new Date(u.createdAt).getTime() > since).length;
  const arpu = playerCount > 0 ? ggr / playerCount : 0;

  const deposits = tx.filter((t) => t.kind === 'deposit').reduce((s, t) => s + (t.amount || 0), 0);
  const withdraws = tx.filter((t) => t.kind === 'withdraw').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const settled = bets.filter((b) => ['won', 'lost', 'void', 'cashed_out'].includes(b.status)).length;
  const settleRate = bets.length > 0 ? settled / bets.length : 0;

  res.json({
    windowDays,
    stake: round2(stake),
    payouts: round2(payouts),
    ggr: round2(ggr),
    hold: Number((hold * 100).toFixed(2)),
    playerCount,
    arpu: round2(arpu),
    newSignups,
    deposits: round2(deposits),
    withdraws: round2(withdraws),
    netDeposits: round2(deposits - withdraws),
    settleRate: Number((settleRate * 100).toFixed(1)),
  });
});

router.get('/top-players', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 100);
  const allBets = Object.values(betsStore.all() || {});
  const byUser = new Map();
  for (const b of allBets) {
    const cur = byUser.get(b.userId) || { stake: 0, win: 0, loss: 0, bets: 0 };
    cur.bets++;
    cur.stake += b.stake || 0;
    if (b.status === 'won') cur.win += b.potentialWin - b.stake;
    if (b.status === 'lost') cur.loss += b.stake;
    if (b.status === 'cashed_out') cur.win += (b.cashOut || 0) - b.stake;
    byUser.set(b.userId, cur);
  }
  const rows = Array.from(byUser.entries()).map(([userId, s]) => {
    const u = getUserById(userId);
    return {
      userId,
      email: u?.email,
      displayName: u?.displayName,
      stake: round2(s.stake),
      net: round2(s.win - s.loss),
      bets: s.bets,
    };
  });
  res.json({
    topStakers: [...rows].sort((a, b) => b.stake - a.stake).slice(0, limit),
    topWinners: [...rows].sort((a, b) => b.net - a.net).slice(0, limit),
    topLosers: [...rows].sort((a, b) => a.net - b.net).slice(0, limit),
  });
});

router.get('/sports', requireAdmin, (_req, res) => {
  const bets = Object.values(betsStore.all() || {});
  const by = new Map();
  for (const b of bets) {
    for (const leg of b.legs || []) {
      const sp = (leg.sport || 'football').toLowerCase();
      const cur = by.get(sp) || { stake: 0, win: 0, bets: 0, won: 0, lost: 0 };
      cur.bets++;
      cur.stake += (b.stake || 0) / Math.max((b.legs || []).length, 1);
      if (b.status === 'won') {
        cur.win += b.potentialWin / Math.max((b.legs || []).length, 1);
        cur.won++;
      }
      if (b.status === 'lost') cur.lost++;
      by.set(sp, cur);
    }
  }
  res.json({
    sports: Array.from(by.entries()).map(([sport, s]) => ({
      sport,
      bets: s.bets,
      stake: round2(s.stake),
      payouts: round2(s.win),
      ggr: round2(s.stake - s.win),
      holdPct: s.stake > 0 ? Number((((s.stake - s.win) / s.stake) * 100).toFixed(2)) : 0,
      winRate: s.won + s.lost > 0 ? Number(((s.won / (s.won + s.lost)) * 100).toFixed(1)) : 0,
    })),
  });
});

router.get('/cohorts', requireAdmin, (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 8, 26);
  const users = allUsers().filter((u) => u.role !== 'admin');
  const bets = Object.values(betsStore.all() || {});
  const cohorts = new Map();
  for (const u of users) {
    const w = weekStart(new Date(u.createdAt));
    const key = w.toISOString().slice(0, 10);
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(u);
  }
  const keys = Array.from(cohorts.keys()).sort().slice(-weeks);
  const matrix = keys.map((k) => {
    const cohort = cohorts.get(k);
    const cohortStart = new Date(k).getTime();
    const row = { week: k, size: cohort.length, retention: [] };
    for (let i = 0; i < weeks; i++) {
      const winStart = cohortStart + i * WEEK;
      const winEnd = winStart + WEEK;
      const active = cohort.filter((u) =>
        bets.some(
          (b) =>
            b.userId === u.id && new Date(b.placedAt).getTime() >= winStart && new Date(b.placedAt).getTime() < winEnd,
        ),
      ).length;
      row.retention.push({
        week: i,
        active,
        pct: cohort.length ? Number(((active / cohort.length) * 100).toFixed(1)) : 0,
      });
    }
    return row;
  });
  res.json({ cohorts: matrix });
});

router.get('/funnel', requireAdmin, (_req, res) => {
  const users = allUsers().filter((u) => u.role !== 'admin');
  const bets = Object.values(betsStore.all() || {});
  const tx = flatTx();
  const verified = users.filter((u) => u.emailVerified);
  const deposited = new Set(tx.filter((t) => t.kind === 'deposit').map((t) => t.userId));
  const firstBet = new Set(bets.map((b) => b.userId));
  const repeatBet = new Set();
  const counts = new Map();
  for (const b of bets) {
    const c = (counts.get(b.userId) || 0) + 1;
    counts.set(b.userId, c);
    if (c >= 2) repeatBet.add(b.userId);
  }
  res.json({
    funnel: [
      { stage: 'Signed up', value: users.length },
      { stage: 'Email verified', value: verified.length },
      { stage: 'First deposit', value: deposited.size },
      { stage: 'First bet', value: firstBet.size },
      { stage: 'Repeat bettor', value: repeatBet.size },
    ],
  });
});

router.get('/daily', requireAdmin, (req, res) => {
  const windowDays = Math.min(Number(req.query.window) || 30, 90);
  const today = startOfDay(new Date()).getTime();
  const days = Array.from({ length: windowDays }, (_, i) => dayKey(new Date(today - (windowDays - 1 - i) * DAY)));
  const users = allUsers().filter((u) => u.role !== 'admin');
  const bets = Object.values(betsStore.all() || {});
  const series = days.map((d) => {
    const dayBets = bets.filter((b) => dayKey(b.placedAt) === d);
    const dau = new Set(dayBets.map((b) => b.userId)).size;
    const newSignups = users.filter((u) => dayKey(u.createdAt) === d).length;
    return { date: d, dau, newSignups, bets: dayBets.length };
  });
  res.json({ series });
});

function round2(n) {
  return Number((Number(n) || 0).toFixed(2));
}

export default router;
