import { Router } from 'express';
import { z } from 'zod';
import {
  SPORTS,
  CASINO_GAMES,
  VIRTUAL_LEAGUES,
  JACKPOT_GAME,
  PROMOTIONS,
  getMatchById,
  getOddsSnapshot,
  getSport,
  lookupSelection,
  buildSeedSelections,
  ensureFreshLeagues,
  BONUS_RATE,
  CURRENCY,
} from '../matchesData.js';
import { adminLookupSelection, adminLookupFixture, buildPublicSnapshot } from '../db/sportsAdmin.js';
import { listActivePromotions } from '../db/promotions.js';
import { oddsApiStatus } from '../services/oddsApi.js';
import { getRecentWins } from '../services/recentWins.js';
import { createStore } from '../db/store.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bookingLookupLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, conflict, gone, notFound, unauthorized } from '../utils/httpError.js';
import { updateUser, logActivity } from '../db/users.js';
import { pushTx } from './wallet.js';
import { emitAdmin, emitToUser } from '../services/realtime.js';
import { SYSTEM_TYPES, maxSystemReturn } from '../lib/systemBets.js';
import * as cashOutEngine from '../services/cashOutEngine.js';
import { LIVE_BETTING } from '../config/env.js';
import { log } from '../utils/logger.js';
import { mintUniqueBookingCode } from '../lib/bookingCode.js';

const router = Router();

function uniqueBookingCode() {
  // Build the in-use set from both placed-bet codes and standalone
  // booked-slip codes so the same namespace is never reused.
  const taken = new Set(
    Object.values(betsStore.all() || {})
      .map((b) => b.bookingCode)
      .filter(Boolean),
  );
  for (const code of Object.keys(bookedSlipsStore.all() || {})) taken.add(code);
  return mintUniqueBookingCode({ existingCodes: taken });
}

const betsStore = createStore('bets', {}); // { betId: receipt }
const bookedSlipsStore = createStore('booked_slips', {}); // { code: bookedSlip }
const jackpotStore = createStore('jackpot_entries', {});

function pushBet(receipt) {
  betsStore.set(receipt.id, receipt);
}
function listUserBets(userId) {
  return Object.values(betsStore.all())
    .filter((b) => b.userId === userId)
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1))
    .map(attachBetDisplayFields)
    .map(attachCashoutOffer);
}

/** Attach computed display fields for every bet so the client never sees 0.00 or blank values. */
function attachBetDisplayFields(bet) {
  const stake = Number(bet.stake || 0);
  const odds = Number(bet.totalOdds || 1);
  const potentialWin = Number(bet.potentialWin || stake * odds);
  const cashOut = Number(bet.cashOut || 0);
  const settledReturn = bet.settledReturn != null ? Number(bet.settledReturn) : null;
  const settledProfit = bet.settledProfit != null ? Number(bet.settledProfit) : null;
  const settled = bet.status !== 'open' && bet.status !== 'pending';

  let returnAmount = 0;
  let profit = 0;

  if (settledReturn != null) {
    returnAmount = settledReturn;
    profit = settledProfit != null ? settledProfit : returnAmount - stake;
  } else if (bet.status === 'won') {
    returnAmount = potentialWin;
    profit = returnAmount - stake;
  } else if (bet.status === 'cashed_out') {
    returnAmount = cashOut;
    profit = returnAmount - stake;
  } else if (bet.status === 'void' || bet.status === 'refunded') {
    returnAmount = stake;
    profit = 0;
  } else if (settled) {
    returnAmount = 0;
    profit = -stake;
  } else {
    returnAmount = null;
    profit = null;
  }

  return {
    ...bet,
    computedReturn: returnAmount != null ? Number(Number(returnAmount).toFixed(2)) : null,
    computedProfit: profit != null ? Number(Number(profit).toFixed(2)) : null,
    displayStake: stake,
    displayOdds: odds,
    displayPotentialWin: potentialWin,
    displayCashOut: cashOut,
    displayReturn: settledReturn != null ? Number(Number(settledReturn).toFixed(2)) : (returnAmount != null ? Number(Number(returnAmount).toFixed(2)) : null),
    displayProfit: settledProfit != null ? Number(Number(settledProfit).toFixed(2)) : (profit != null ? Number(Number(profit).toFixed(2)) : null),
  };
}

/** Attach the cash-out display value consistent with what the server would offer. */
function attachCashoutOffer(bet) {
  if (bet.status !== 'open') return bet;
  if (bet.lastCashOutOffer?.amount != null) return { ...bet, cashoutOffer: bet.lastCashOutOffer?.amount };
  const cashoutOffer =
    bet.mode === 'system'
      ? Number((bet.stake * 0.6).toFixed(2))
      : Number((bet.stake * (1 - LIVE_BETTING.houseMargin)).toFixed(2));
  return { ...bet, cashoutOffer };
}

/* ------------ schemas ------------ */
const placeSchema = z.object({
  mode: z.enum(['single', 'multiple', 'system']).default('multiple'),
  // For single/multiple this is the total stake. For system it's the
  // STAKE PER LINE — total stake is line-count × this value.
  stake: z.union([z.number(), z.string()]).transform((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a valid stake amount.');
    return n;
  }),
  // System-bet metadata — required when mode === 'system'.
  systemType: z.string().optional(),
  selections: z
    .array(
      z.object({
        matchId: z.string().min(1),
        market: z.string().default('1X2'),
        outcome: z.string().min(1),
        odds: z.union([z.number(), z.string()]).transform((v) => Number(v)),
      }),
    )
    .min(1, 'Add at least one selection.'),
});

const jackpotEnterSchema = z.object({
  picks: z.record(z.string(), z.string()),
});

const cashoutSchema = z.object({
  acceptedAmount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), 'invalid acceptedAmount'),
  // Partial cash-out: a fraction in (0, 1) of the stake to cash out now.
  // The remaining (1 - fraction) of the stake stays in play on a residual
  // ticket. Omit or set to 1 for a full cash-out.
  fraction: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 1), 'fraction must be in (0, 1]'),
});

/* ------------ public meta ------------ */

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'oddsify-betting-api', oddsApi: oddsApiStatus() });
});

router.get('/sports', (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString(),
    sports: SPORTS.map((s) => ({
      id: s.id,
      name: s.name,
      leagueCount: s.leagues.length,
      matchCount: s.leagues.reduce((n, l) => n + l.matches.length, 0),
    })),
  });
});

router.get(
  '/matches',
  asyncHandler(async (req, res) => {
    const sport = String(req.query.sport || 'football').toLowerCase();
    if (!getSport(sport)) throw notFound(`Unknown sport "${sport}"`);
    await ensureFreshLeagues(sport);
    res.json({
      updatedAt: new Date().toISOString(),
      currency: CURRENCY,
      ...buildPublicSnapshot(sport, buildSeedSelections),
    });
  }),
);

router.get(
  '/matches/:matchId',
  asyncHandler(async (req, res) => {
    await ensureFreshLeagues('football');
    const row = adminLookupFixture(req.params.matchId);
    if (!row) throw notFound('Match not found');
    res.json({
      updatedAt: new Date().toISOString(),
      currency: CURRENCY,
      sport: row.sport?.id || row.sport,
      league: {
        id: row.league.id,
        name: row.league.name,
        region: row.league.region,
        countryMeta: row.league.countryMeta,
        crest: row.league.crest,
      },
      match: row.match,
    });
  }),
);

router.get(
  '/leagues',
  asyncHandler(async (req, res) => {
    const sport = String(req.query.sport || 'football').toLowerCase();
    const sp = getSport(sport);
    if (!sp) throw notFound(`Unknown sport "${sport}"`);
    await ensureFreshLeagues(sport);
    res.json({
      updatedAt: new Date().toISOString(),
      sport: sp.id,
      leagues: sp.leagues.map((lg) => ({
        id: lg.id,
        name: lg.name,
        region: lg.region,
        countryMeta: lg.countryMeta,
        crest: lg.crest,
        matchCount: lg.matches.length,
      })),
    });
  }),
);

router.get(
  '/leagues/:leagueId/matches',
  asyncHandler(async (req, res) => {
    await ensureFreshLeagues('football');
    for (const sp of SPORTS) {
      const lg = sp.leagues.find((l) => l.id === req.params.leagueId);
      if (lg) {
        return res.json({
          updatedAt: new Date().toISOString(),
          currency: CURRENCY,
          sport: sp.id,
          league: { id: lg.id, name: lg.name, region: lg.region, countryMeta: lg.countryMeta, crest: lg.crest },
          matches: lg.matches,
        });
      }
    }
    throw notFound('League not found');
  }),
);

/* ------------ authenticated bet operations ------------ */

// Booked slips expire 30 days after creation. After that the lookup
// returns HTTP 410 so the client can show the "expired" toast instead
// of a generic "not found." Placed-bet codes never expire — they're
// permanent records of money having changed hands.
const BOOKED_SLIP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

router.get('/code/:code', bookingLookupLimiter, (req, res, next) => {
  const code = String(req.params.code || '').toUpperCase();
  log.info(`booking_code_lookup code=${code} ip=${req.ip}`);

  const bet = Object.values(betsStore.all()).find((b) => b.bookingCode === code);
  if (bet) {
    const { userId, ...publicBet } = bet;
    return res.json({ bet: publicBet });
  }
  // Fall back to booked-but-not-placed slips so a code shared before payment
  // can still be looked up by the recipient.
  const slip = bookedSlipsStore.get(code);
  if (slip) {
    // Expiration check (graceful — never throws on legacy rows that
    // pre-date this field).
    const createdAt = slip.createdAt ? new Date(slip.createdAt).getTime() : null;
    if (createdAt && Date.now() - createdAt > BOOKED_SLIP_TTL_MS) {
      return next(gone('This booking code has expired.'));
    }
    const { createdBy, createdIp, ...publicSlip } = slip;
    return res.json({ bet: publicSlip });
  }
  return next(notFound('Booking code not found.'));
});

// Booking-only schema. No stake (the recipient sets that when they place
// the slip). No system/mode rules — both single and multi slips can be
// shared. Selections are validated the same way as /place.
const bookSchema = z.object({
  selections: z
    .array(
      z.object({
        matchId: z.string().min(1),
        market: z.string().default('1X2'),
        outcome: z.string().min(1),
        odds: z.union([z.number(), z.string()]).transform((v) => Number(v)),
      }),
    )
    .min(1, 'Add at least one selection.'),
});

/**
 * Generate a booking code for a slip without placing the bet. No auth, no
 * stake, no balance deduction. The code can be shared and later resolved
 * via GET /code/:code.
 */
router.post(
  '/book',
  optionalAuth,
  validate(bookSchema),
  asyncHandler(async (req, res) => {
    const { selections } = req.body;
    const seen = new Set();
    const normalized = [];
    for (const sel of selections) {
      const dedupe = `${sel.matchId}:${sel.market}:${sel.outcome}`;
      if (seen.has(dedupe)) throw badRequest(`Duplicate selection ${sel.market} ${sel.outcome}.`);
      seen.add(dedupe);
      const found = adminLookupSelection({ matchId: sel.matchId, market: sel.market, outcome: sel.outcome });
      if (!found) {
        throw badRequest(`Invalid selection ${sel.market} ${sel.outcome} for match ${sel.matchId}.`);
      }
      normalized.push({
        matchId: sel.matchId,
        market: sel.market,
        outcome: sel.outcome,
        odds: found.selection.odds,
        home: found.row.match.home,
        away: found.row.match.away,
        marketName: found.row.match.markets?.[sel.market]?.name || sel.market,
      });
    }

    const code = uniqueBookingCode();
    const totalOdds = normalized.length === 1 ? normalized[0].odds : normalized.reduce((acc, s) => acc * s.odds, 1);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + BOOKED_SLIP_TTL_MS);
    const slip = {
      bookingCode: code,
      kind: 'booked',
      status: 'booked',
      placedAt: null,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      currency: CURRENCY,
      mode: normalized.length === 1 ? 'single' : 'multiple',
      totalOdds: Number(totalOdds.toFixed(4)),
      legs: normalized,
      createdBy: req.user?.id || null,
      createdIp: req.ip,
    };
    bookedSlipsStore.set(code, slip);
    log.info(`booking_code_created code=${code} by=${req.user?.id || 'anon'} legs=${normalized.length}`);
    const { createdBy, createdIp, ...publicSlip } = slip;
    res.status(201).json({ ok: true, bookingCode: code, slip: publicSlip });
  }),
);

/**
 * Public ticker feed — up to 15 real winning bets from the last 24h,
 * sorted by amount desc. The client hides the ticker if the list is empty.
 */
router.get('/recent-wins', (_req, res) => {
  res.json(getRecentWins());
});

router.post(
  '/place',
  requireAuth,
  validate(placeSchema),
  asyncHandler(async (req, res) => {
    const { mode, stake, selections, systemType } = req.body;
    const user = req.user;

    const seen = new Set();
    const normalized = [];
    for (const sel of selections) {
      const dedupe = `${sel.matchId}:${sel.market}:${sel.outcome}`;
      if (seen.has(dedupe))
        return res.json({ success: false, error: `Duplicate selection ${sel.market} ${sel.outcome}.` });
      seen.add(dedupe);
      const found = adminLookupSelection({ matchId: sel.matchId, market: sel.market, outcome: sel.outcome });
      if (!found)
        return res.json({
          success: false,
          error: `Invalid selection ${sel.market} ${sel.outcome} for match ${sel.matchId}.`,
        });
      const fxView = found.row?.match || found.row;
      // Only block placement when the market is *actually* closed:
      //   - admin has explicitly suspended the fixture, or
      //   - the fixture has a real authoritative result (manual or feed).
      // Auto-simulated demo results (finalSource === 'simulated') should not
      // block bets — the engine will settle them on the next tick using the
      // same simulated score, so the user still gets a booking code now.
      const hasRealResult = fxView?.finished && (fxView.finalSource === 'feed' || fxView.finalSource === 'manual');
      if (hasRealResult || fxView?.suspended) {
        return res.json({
          success: false,
          error: 'Market closed — fixture is no longer available.',
          code: 'MARKET_CLOSED',
        });
      }
      if (found.market?.suspended || found.selection?.suspended) {
        return res.json({
          success: false,
          error: 'Selection suspended — refresh and try a different market.',
          code: 'SELECTION_SUSPENDED',
        });
      }
      const serverOdds = found.selection.odds;
      // Live odds drift constantly. Only reject when the price *dropped*
      // by more than 15%, which would meaningfully hurt the player.
      // Anything else: silently accept the server's current odds.
      const clientOdds = Number.isFinite(sel.odds) ? sel.odds : serverOdds;
      const droppedTooMuch = serverOdds < clientOdds * 0.85;
      if (droppedTooMuch) {
        return res.json({
          success: false,
          error: 'Odds dropped significantly — refresh the fixture list.',
          code: 'ODDS_CHANGED',
          matchId: sel.matchId,
          market: sel.market,
          outcome: sel.outcome,
          expectedOdds: serverOdds,
        });
      }
      normalized.push({
        matchId: sel.matchId,
        market: sel.market,
        outcome: sel.outcome,
        odds: serverOdds,
        home: found.row.match.home,
        away: found.row.match.away,
        marketName: found.row.match.markets?.[sel.market]?.name || sel.market,
      });
    }
    if (mode === 'single' && normalized.length > 1)
      return res.json({ success: false, error: 'Single mode allows only one selection.' });
    if (mode === 'multiple' && normalized.length < 2)
      return res.json({ success: false, error: 'Multiple bets need at least two selections.' });

    // Compute totals based on the bet mode.
    let totalOdds,
      totalStake,
      potentialWin,
      systemDef = null,
      linesCount = null,
      stakePerLine = null;

    if (mode === 'system') {
      const key = String(systemType || '').toLowerCase();
      systemDef = SYSTEM_TYPES[key];
      if (!systemDef)
        return res.json({
          success: false,
          error: `Unknown system type "${systemType}". Pick one of: ${Object.keys(SYSTEM_TYPES).join(', ')}.`,
        });
      if (normalized.length !== systemDef.selections) {
        return res.json({
          success: false,
          error: `${systemDef.label} needs exactly ${systemDef.selections} selections (you have ${normalized.length}).`,
        });
      }
      stakePerLine = Number(stake);
      linesCount = systemDef.totalLines;
      totalStake = Number((stakePerLine * linesCount).toFixed(2));
      // For system bets, "totalOdds" doesn't really exist; we expose the
      // max return divided by total stake as a rough headline number so
      // the bet history list has something useful to show.
      potentialWin = Number(
        maxSystemReturn(
          normalized.map((s) => s.odds),
          key,
          stakePerLine,
        ).toFixed(2),
      );
      totalOdds = Number((potentialWin / totalStake).toFixed(4));
    } else {
      totalStake = Number(stake);
      totalOdds = mode === 'single' ? normalized[0].odds : normalized.reduce((acc, s) => acc * s.odds, 1);
      potentialWin = totalStake * totalOdds * (1 + BONUS_RATE);
    }

    if (totalStake < 300) {
      return res.json({
        success: false,
        error: `Minimum stake is GHS 300. This ticket requires only GHS ${totalStake.toFixed(2)}.`,
      });
    }
    if (totalStake > user.balance) {
      return res.json({
        success: false,
        error: `Insufficient balance. This ticket requires GHS ${totalStake.toFixed(2)} (your balance is GHS ${user.balance.toFixed(2)}).`,
      });
    }

    const id = `bv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const bookingCode = uniqueBookingCode();
    const receipt = {
      id,
      bookingCode,
      userId: user.id,
      placedAt: new Date().toISOString(),
      mode,
      stake: Number(totalStake.toFixed(2)),
      currency: CURRENCY,
      totalOdds: Number(totalOdds.toFixed(4)),
      potentialWin: Number(potentialWin.toFixed(2)),
      bonusRate: BONUS_RATE,
      legs: normalized,
      status: 'open',
      lastCashOutOffer: null,
      cashOutHistory: [],
      ...(mode === 'system' && {
        systemType: systemType.toLowerCase(),
        systemLabel: systemDef.label,
        linesCount,
        stakePerLine,
      }),
    };
    pushBet(receipt);

    // Index this bet so live ticks can recompute its cash-out offer.
    cashOutEngine.registerBet(receipt);

    const updated = updateUser(user.id, { balance: Number((user.balance - totalStake).toFixed(2)) });
    pushTx(user.id, {
      kind: 'bet_placed',
      amount: -totalStake,
      status: 'completed',
      balanceAfter: updated.balance,
      ref: id,
    });
    logActivity(user.id, { kind: 'bet_placed', betId: id, stake: totalStake });

    // Realtime: notify the player's other tabs/devices and the admin observability dashboard.
    emitToUser(user.id, 'wallet:update', {
      balance: updated.balance,
      delta: -totalStake,
      reason: 'bet:placed',
      ref: id,
    });
    emitAdmin('bet:placed', { betId: id, userId: user.id, stake: totalStake, mode, legs: normalized.length });

    res.status(201).json({
      ok: true,
      bet: receipt,
      account: { ...updated, passwordHash: undefined, googleId: undefined, activity: undefined },
    });
  }),
);

router.get('/history', requireAuth, (req, res) => {
  res.json({ bets: listUserBets(req.user.id) });
});

// IMPORTANT: this literal route must come BEFORE /bets/:id or Express will
// match "unacknowledged" as an id.
router.get('/bets/unacknowledged', requireAuth, (req, res) => {
  const wins = Object.values(betsStore.all() || {}).filter((b) => b.userId === req.user.id && b.wonNotAcknowledged);
  res.json({ bets: wins });
});

router.post('/bets/:id/ack', requireAuth, (req, res, next) => {
  const bet = betsStore.get(req.params.id);
  if (!bet || bet.userId !== req.user.id) return next(notFound('Bet not found'));
  if (bet.wonNotAcknowledged) {
    bet.wonNotAcknowledged = false;
    bet.acknowledgedAt = new Date().toISOString();
    betsStore.set(bet.id, bet);
  }
  res.json({ ok: true, bet });
});

router.get('/bets/:id', requireAuth, (req, res, next) => {
  const bet = betsStore.get(req.params.id);
  if (!bet || bet.userId !== req.user.id) return next(notFound('Bet not found'));
  res.json({ bet });
});

/* ── Cashout-specific endpoints ── */

/** GET /bets/cashouts — list all cashouts for the current user. */
router.get('/bets/cashouts', requireAuth, (req, res) => {
  const userCashouts = Object.values(betsStore.all() || {})
    .filter((b) => b.userId === req.user.id && (b.status === 'cashed_out' || b.cashOut != null))
    .sort((a, b) => (a.cashOutAt < b.cashOutAt ? 1 : -1))
    .map((b) => ({
      id: b.id,
      bookingCode: b.bookingCode,
      betId: b.parentBetId || b.id,
      cashOut: b.cashOut,
      cashOutFraction: b.cashOutFraction,
      cashOutAt: b.cashOutAt,
      stake: b.stake,
      totalOdds: b.totalOdds,
      potentialWin: b.potentialWin,
      profit: Number(((b.cashOut || 0) - b.stake).toFixed(2)),
      mode: b.mode,
      legs: b.legs?.length || 0,
      residualBetId: b.residualBetId || null,
    }));
  res.json({ cashouts: userCashouts });
});

/** GET /bets/:id/offer — current cash-out offer for a specific bet (real-time). */
router.get('/bets/:id/offer', requireAuth, (req, res, next) => {
  const bet = betsStore.get(req.params.id);
  if (!bet || bet.userId !== req.user.id) return next(notFound('Bet not found'));
  if (bet.status !== 'open') {
    return res.json({ eligible: false, reason: 'Bet is already settled.' });
  }
  const last = cashOutEngine.getLastOffer(bet.id);
  if (last && last.cashOut > 0) {
    return res.json({ eligible: true, cashOut: last.cashOut, ts: last.ts });
  }
  const fallback = Number((bet.stake * (1 - LIVE_BETTING.houseMargin)).toFixed(2));
  if (fallback > 0) {
    return res.json({ eligible: true, cashOut: fallback, ts: Date.now(), estimated: true });
  }
  res.json({ eligible: false, reason: 'Cash-out not currently available.' });
});

router.delete(
  '/bets/:id',
  requireAuth,
  validate(cashoutSchema),
  asyncHandler(async (req, res) => {
    const bet = betsStore.get(req.params.id);
    if (!bet || bet.userId !== req.user.id) throw notFound('Bet not found');
    if (bet.status !== 'open')
      throw conflict('Bet is already settled and cannot be cashed out.', { code: 'ALREADY_SETTLED' });

    let cashOut;
    if (bet.mode === 'system') {
      // System bets keep the legacy formula in v1. acceptedAmount ignored.
      cashOut = Number((bet.stake * bet.totalOdds * 0.6).toFixed(2));
    } else {
      const last = cashOutEngine.getLastOffer(bet.id);
      if (last) {
        if (last.cashOut === 0) {
          throw conflict(
            'This bet has busted — cash-out is no longer available. The natural settlement will run shortly.',
            { code: 'OFFER_ZERO' },
          );
        }
        cashOut = last.cashOut;
      } else {
        // No live offer recorded yet (no tick has happened since /place).
        // Fall back to a conservative offer based on stake and the house margin.
        cashOut = Number((bet.stake * (1 - LIVE_BETTING.houseMargin)).toFixed(2));
      }
      // Validate drift in both paths when client provided acceptedAmount.
      if (req.body?.acceptedAmount !== undefined) {
        const drift =
          cashOut > 0
            ? Math.abs(req.body.acceptedAmount - cashOut) / cashOut
            : Math.abs(req.body.acceptedAmount - cashOut);
        if (drift > LIVE_BETTING.driftTolerance) {
          throw conflict('Cash-out offer changed before you confirmed. Refresh and try again.', {
            code: 'OFFER_STALE',
            currentOffer: cashOut,
          });
        }
      }
    }

    // Partial cash-out: cash out only `fraction` of the stake; leave the rest
    // running on a fresh residual ticket. System bets keep the v1 behaviour
    // (full cash-out only) — partial only applies to single/multiple.
    const rawFraction = req.body?.fraction;
    const fraction =
      bet.mode !== 'system' && rawFraction !== undefined && rawFraction > 0 && rawFraction < 1
        ? Number(rawFraction)
        : 1;
    const cashedPortion = Number((cashOut * fraction).toFixed(2));
    const residualStake = Number((bet.stake * (1 - fraction)).toFixed(2));

    if (fraction < 1 && residualStake < 1) {
      // Avoid creating a ticket so small it can't be cashed out again.
      throw conflict('Remaining stake would be too small. Cash out fully or pick a smaller fraction.', {
        code: 'RESIDUAL_TOO_SMALL',
      });
    }

    bet.status = 'cashed_out';
    bet.cashOut = cashedPortion;
    bet.cashOutFraction = fraction;
    bet.cashOutAt = new Date().toISOString();
    bet.settledReturn = cashedPortion;
    bet.settledProfit = Number((cashedPortion - bet.stake).toFixed(2));
    betsStore.set(bet.id, bet);
    cashOutEngine.unregisterBet(bet.id);

    let residual = null;
    if (fraction < 1) {
      // Create a residual ticket that carries the remaining stake at the
      // original odds. Same legs, fresh id and booking code.
      const newId = `bv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      residual = {
        ...bet,
        id: newId,
        bookingCode: uniqueBookingCode(),
        placedAt: new Date().toISOString(),
        parentBetId: bet.id,
        stake: residualStake,
        potentialWin: Number((residualStake * bet.totalOdds * (1 + BONUS_RATE)).toFixed(2)),
        status: 'open',
        cashOut: undefined,
        cashOutFraction: undefined,
        cashOutAt: undefined,
        lastCashOutOffer: null,
        cashOutHistory: [],
      };
      bet.residualBetId = newId;
      betsStore.set(bet.id, bet);
      pushBet(residual);
      cashOutEngine.registerBet(residual);
    }

    const updated = updateUser(req.user.id, {
      balance: Number((req.user.balance + cashedPortion).toFixed(2)),
    });
    pushTx(req.user.id, {
      kind: fraction < 1 ? 'cash_out_partial' : 'cash_out',
      amount: cashedPortion,
      status: 'completed',
      balanceAfter: updated.balance,
      ref: bet.id,
    });
    logActivity(req.user.id, { kind: 'cash_out', betId: bet.id, cashOut: cashedPortion, fraction });

    emitToUser(req.user.id, 'wallet:update', {
      balance: updated.balance,
      delta: cashedPortion,
      reason: 'cash_out',
      ref: bet.id,
    });
    emitAdmin('cashout:executed', {
      betId: bet.id,
      userId: req.user.id,
      cashOut: cashedPortion,
      fraction,
      ts: Date.now(),
    });

    res.json({
      ok: true,
      bet,
      residual,
      account: { ...updated, passwordHash: undefined, googleId: undefined, activity: undefined },
    });
  }),
);

/* ------------ casino, virtuals, jackpot, promos ------------ */

router.get('/casino/games', (req, res) => {
  const cat = String(req.query.category || '').toLowerCase();
  const list = cat ? CASINO_GAMES.filter((g) => g.category.toLowerCase() === cat) : CASINO_GAMES;
  res.json({ games: list });
});

router.get('/virtuals', (_req, res) => res.json({ leagues: VIRTUAL_LEAGUES }));

router.get('/jackpot', (_req, res) => res.json({ jackpot: JACKPOT_GAME }));

router.post(
  '/jackpot/enter',
  requireAuth,
  validate(jackpotEnterSchema),
  asyncHandler(async (req, res) => {
    const { picks } = req.body;
    const user = req.user;
    if (user.balance < JACKPOT_GAME.entryFee) throw badRequest('Insufficient balance for jackpot entry.');
    const missing = JACKPOT_GAME.legs.filter((l) => !picks[l.id]);
    if (missing.length) throw badRequest(`Pick missing for ${missing.length} leg(s).`);
    for (const leg of JACKPOT_GAME.legs) {
      if (!leg.outcomes.includes(picks[leg.id])) {
        throw badRequest(`Invalid pick "${picks[leg.id]}" for ${leg.fixture}.`);
      }
    }
    const id = `jp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      userId: user.id,
      placedAt: new Date().toISOString(),
      fee: JACKPOT_GAME.entryFee,
      currency: CURRENCY,
      picks,
      drawsIn: JACKPOT_GAME.drawsIn,
    };
    jackpotStore.set(id, entry);
    const updated = updateUser(user.id, {
      balance: Number((user.balance - JACKPOT_GAME.entryFee).toFixed(2)),
    });
    pushTx(user.id, {
      kind: 'jackpot_entry',
      amount: -JACKPOT_GAME.entryFee,
      status: 'completed',
      balanceAfter: updated.balance,
      ref: id,
    });
    logActivity(user.id, { kind: 'jackpot_entry', entryId: id });
    res.status(201).json({
      ok: true,
      entry,
      account: { ...updated, passwordHash: undefined, googleId: undefined, activity: undefined },
    });
  }),
);

router.get('/promos', (_req, res) => {
  const fromStore = listActivePromotions();
  res.json({ promotions: fromStore.length ? fromStore : PROMOTIONS });
});

cashOutEngine.onOffer((bet, payload) => {
  const fresh = betsStore.get(bet.id);
  if (!fresh || fresh.status !== 'open') return;
  fresh.lastCashOutOffer = { amount: payload.cashOut, ts: payload.ts };
  fresh.cashOutHistory = [...(fresh.cashOutHistory || []).slice(-19), { ts: payload.ts, amount: payload.cashOut }];
  betsStore.set(fresh.id, fresh);
});

export default router;
