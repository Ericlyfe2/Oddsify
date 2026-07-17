import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest, notFound, conflict } from '../../utils/httpError.js';
import {
  compiledLeagues,
  adminListFixtures,
  adminLookupFixture,
  patchOverride,
  setOddsOverride,
  clearOddsOverride,
  setSuspension,
  clearSuspension,
  setResult,
  addCustomFixture,
  deleteCustomFixture,
  addCustomLeague,
  addMarketToFixture,
  removeMarketFromFixture,
  readSportsAdmin,
  findDuplicateFixture,
} from '../../db/sportsAdmin.js';
import { settleNow } from '../../services/settlement.js';
import { emitAdmin } from '../../services/realtime.js';

const router = Router();

router.get('/fixtures', requireAdmin, (req, res) => {
  const { sport, leagueId, status, q } = req.query;
  let rows = adminListFixtures();
  if (sport) rows = rows.filter((m) => m.sport === sport);
  if (leagueId) rows = rows.filter((m) => m.leagueId === leagueId);
  if (status === 'live') rows = rows.filter((m) => m.isLive);
  if (status === 'upcoming') rows = rows.filter((m) => !m.isLive && !m.finished);
  if (status === 'finished') rows = rows.filter((m) => m.finished);
  if (status === 'suspended') rows = rows.filter((m) => m.suspended);
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (m) =>
        m.id.toLowerCase().includes(needle) || `${m.home} ${m.away} ${m.leagueName}`.toLowerCase().includes(needle),
    );
  }
  res.json({ total: rows.length, fixtures: rows });
});

router.get('/fixtures/:id', requireAdmin, (req, res, next) => {
  const view = adminLookupFixture(req.params.id);
  if (!view) return next(notFound('Fixture not found'));
  res.json({
    fixture: {
      ...view.match,
      sport: view.sport?.id || view.sport,
      leagueId: view.league?.id,
      leagueName: view.league?.name,
    },
  });
});

router.get('/leagues', requireAdmin, (_req, res) => {
  const leagues = compiledLeagues().flatMap((sp) =>
    (sp.leagues || []).map((lg) => ({
      id: lg.id,
      name: lg.name,
      sport: sp.id,
      region: lg.region,
      matchCount: (lg.matches || []).length,
      admin: !!lg.admin,
    })),
  );
  res.json({ leagues });
});

const createLeagueSchema = z.object({
  name: z.string().min(2).max(100),
  sport: z.enum(['football', 'basketball', 'tennis']),
  region: z.string().default('admin'),
  countryMeta: z.string().optional(),
});

router.post(
  '/leagues',
  requireAdmin,
  requireRole('odds_manager'),
  validate(createLeagueSchema),
  (req, res) => {
    const { name, sport, region, countryMeta } = req.body;

    const existingLeagues = compiledLeagues().flatMap((sp) =>
      sp.id === sport ? (sp.leagues || []) : []
    );
    const duplicate = existingLeagues.find(
      (l) => l.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw conflict(`League "${name}" already exists in this sport.`);
    }

    const id = `cust-${Math.random().toString(36).slice(2, 8)}`;
    const lg = {
      id,
      sport,
      name,
      region,
      countryMeta: countryMeta || '',
      crest: {
        style: 'background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#fff',
        label: name.slice(0, 3).toUpperCase(),
      },
      matches: [],
      admin: true,
    };
    addCustomLeague(lg);
    audit(req, { action: 'sports.league.create', target: id, targetType: 'league', meta: { name } });
    emitAdmin('sports:league:created', { league: lg });
    res.status(201).json({ league: lg });
  },
);

const ODD_MIN = 1.01;
const ODD_MAX = 1000;

const oddsField = z.number().min(ODD_MIN, `Odds must be greater than ${ODD_MIN}`).max(ODD_MAX);

const extraMarketItem = z.object({
  market: z.string().min(1),
  type: z.enum(['overunder', 'yesno', 'dc', 'dnb', 'ah', 'cs']),
  over: oddsField.optional(),
  under: oddsField.optional(),
  yes: oddsField.optional(),
  no: oddsField.optional(),
  homeOdds: oddsField.optional(),
  awayOdds: oddsField.optional(),
  '1X': oddsField.optional(),
  X2: oddsField.optional(),
  '12': oddsField.optional(),
}).passthrough();

const createFixtureSchema = z.object({
  sport: z.enum(['football', 'basketball', 'tennis']),
  leagueId: z.string().min(1),
  home: z.string().min(1).max(100),
  away: z.string().min(1).max(100),
  kickoff: z.string().optional(),
  day: z.string().optional(),
  matchDate: z.string().optional(),
  venue: z.string().optional(),
  isLive: z.boolean().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  featured: z.boolean().optional(),
  scoreHome: z.number().optional(),
  scoreAway: z.number().optional(),
  odds: z.object({
    home: oddsField,
    draw: oddsField.optional(),
    away: oddsField,
  }),
  extraMarkets: z.array(extraMarketItem).optional(),
  correctScores: z.array(z.string()).optional(),
  playerSpecials: z.array(z.object({
    key: z.string(),
    label: z.string(),
    odds: oddsField,
  })).optional(),
});

router.post('/fixtures', requireAdmin, requireRole('odds_manager'), validate(createFixtureSchema), (req, res) => {
  const b = req.body;

  const trimmedHome = b.home.trim();
  const trimmedAway = b.away.trim();

  if (trimmedHome.toLowerCase() === trimmedAway.toLowerCase()) {
    throw badRequest('Home and Away teams cannot be identical.');
  }

  if (/[<>{}|\\^~`]/.test(trimmedHome) || /[<>{}|\\^~`]/.test(trimmedAway)) {
    throw badRequest('Team names contain invalid characters.');
  }

  if (b.odds.home < ODD_MIN || b.odds.away < ODD_MIN) {
    throw badRequest(`Odds must be greater than ${ODD_MIN}.`);
  }
  if (b.odds.draw !== undefined && b.odds.draw < ODD_MIN) {
    throw badRequest(`Draw odds must be greater than ${ODD_MIN}.`);
  }

  const duplicate = findDuplicateFixture(
    trimmedHome,
    trimmedAway,
    b.leagueId,
    b.matchDate || b.day || '',
    b.kickoff || '',
    b.sport
  );
  if (duplicate) {
    throw conflict('Fixture already exists. A match with these teams in this league already exists.');
  }

  const id = `adm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const markets = buildFixtureMarkets(b, trimmedHome, trimmedAway);
  const fx = {
    id,
    sport: b.sport,
    leagueId: b.leagueId,
    home: trimmedHome,
    away: trimmedAway,
    kickoff: b.kickoff || '',
    day: b.day || 'Today',
    isLive: !!b.isLive,
    status: b.status || (b.isLive ? 'live' : 'upcoming'),
    venue: b.venue || '',
    matchDate: b.matchDate || '',
    visibility: b.visibility || 'public',
    featured: !!b.featured,
    scoreHome: typeof b.scoreHome === 'number' ? b.scoreHome : undefined,
    scoreAway: typeof b.scoreAway === 'number' ? b.scoreAway : undefined,
    markets,
    moreMarkets: Object.keys(markets).length,
    adminCreated: true,
    createdAt: new Date().toISOString(),
  };
  addCustomFixture(fx);
  audit(req, {
    action: 'sports.fixture.create',
    target: id,
    targetType: 'fixture',
    meta: { home: trimmedHome, away: trimmedAway, leagueId: b.leagueId },
  });
  emitAdmin('sports:fixture:created', { fixture: fx });
  res.status(201).json({ fixture: fx });
});

// Correct Score covers 0-4 a side; settlement's Any-Other bucket starts at 5+.
const CS_GRID_MAX = 4;
// Scores whose true probability floors out at the price cap (~250.00) are folded
// into the Any-Other bucket instead of listed as their own row — several 0-4 grid
// cells price identically at the cap, so showing them individually is just noise.
const CS_CAP_P = 0.0036;

function csPoissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logFact = 0;
  for (let i = 2; i <= k; i++) logFact += Math.log(i);
  return Math.exp(-lambda + k * Math.log(lambda) - logFact);
}

// Book-style correct-score pricing: independent Poisson goal expectancies
// derived from the fixture's 1X2 odds (skew) and O/U 2.5 odds (goal total),
// 10% margin, with a low probability floor so longshots run up to ~250.
function buildCsPricer(odds1x2, ouMarket) {
  const rH = 1 / odds1x2.home;
  const rD = 1 / (odds1x2.draw ?? 3.2);
  const rA = 1 / odds1x2.away;
  const rSum = rH + rD + rA;
  const pHome = rH / rSum;
  const pAway = rA / rSum;

  let pOver = 0.5;
  if (ouMarket?.over && ouMarket?.under) {
    const rO = 1 / ouMarket.over;
    const rU = 1 / ouMarket.under;
    pOver = rO / (rO + rU);
  }

  const goalTotal = Math.max(1.4, Math.min(3.6, 2.0 + (pOver - 0.5) * 2.4));
  const skew = (pHome - pAway) * 1.8;
  const lambdaHome = Math.max(0.35, goalTotal / 2 + skew / 2);
  const lambdaAway = Math.max(0.35, goalTotal / 2 - skew / 2);

  const scoreProb = (h, a) => csPoissonPmf(h, lambdaHome) * csPoissonPmf(a, lambdaAway);

  // Off-grid mass (5+ a side), plus any on-grid cell that would price at the cap
  // anyway, per result bucket for the Any-Other selections.
  const other = { home: 0, draw: 0, away: 0 };
  for (let h = 0; h <= 9; h++) {
    for (let a = 0; a <= 9; a++) {
      const p = scoreProb(h, a);
      const onGrid = h <= CS_GRID_MAX && a <= CS_GRID_MAX;
      if (onGrid && p > CS_CAP_P) continue;
      if (h > a) other.home += p;
      else if (h === a) other.draw += p;
      else other.away += p;
    }
  }

  const price = (p) => {
    const q = Math.max(0.0036, Math.min(0.985, p)); // 1/0.0036 × 0.9 ≈ 250 top price
    return Math.max(ODD_MIN, Number(((1 / q) * 0.9).toFixed(2)));
  };

  return { scoreProb, other, price };
}

function buildFixtureMarkets(b, home, away) {
  const extra = b.extraMarkets || [];
  const fromExtra = {};

  for (const em of extra) {
    if (em.type === 'overunder') {
      const label = em.market === 'TP' ? 'Total Points' : `Over/Under ${em.market.replace('OU', '').replace(/^0/, '')}`;
      fromExtra[em.market] = {
        name: label,
        selections: [
          { key: 'Over', label: 'Over', odds: Math.max(em.over ?? 1.9, ODD_MIN) },
          { key: 'Under', label: 'Under', odds: Math.max(em.under ?? 1.9, ODD_MIN) },
        ],
      };
    } else if (em.type === 'yesno') {
      fromExtra[em.market] = {
        name: em.market === 'BTTS' ? 'Both Teams To Score' : em.market,
        selections: [
          { key: 'Yes', label: 'Yes', odds: Math.max(em.yes ?? 1.78, ODD_MIN) },
          { key: 'No', label: 'No', odds: Math.max(em.no ?? 1.98, ODD_MIN) },
        ],
      };
    } else if (em.type === 'dc') {
      fromExtra[em.market] = {
        name: 'Double Chance',
        selections: [
          { key: '1X', label: 'Home or Draw', odds: Math.max(em['1X'] ?? 1.25, ODD_MIN) },
          { key: 'X2', label: 'Draw or Away', odds: Math.max(em.X2 ?? 1.35, ODD_MIN) },
          { key: '12', label: 'Home or Away', odds: Math.max(em['12'] ?? 1.2, ODD_MIN) },
        ],
      };
    } else if (em.type === 'dnb') {
      fromExtra[em.market] = {
        name: 'Draw No Bet',
        selections: [
          { key: '1', label: `${home}`, odds: Math.max(em.homeOdds ?? 1.8, ODD_MIN) },
          { key: '2', label: `${away}`, odds: Math.max(em.awayOdds ?? 1.8, ODD_MIN) },
        ],
      };
    } else if (em.type === 'ah') {
      fromExtra[em.market] = {
        name: em.name || 'Asian Handicap',
        selections: [
          { key: 'H-1', label: `${home} -1`, odds: Math.max(em.homeOdds ?? 1.85, ODD_MIN) },
          { key: 'A+1', label: `${away} +1`, odds: Math.max(em.awayOdds ?? 1.85, ODD_MIN) },
        ],
      };
    } else if (em.type === 'cs') {
      const ou = extra.find((x) => x.type === 'overunder' && x.market === 'OU25');
      const pricer = buildCsPricer(b.odds, ou);
      const csSelections = [];
      // Any-Other-* selections are combined into a single straight-line "Other"
      // row (matching the live match feed) instead of one cell per column.
      let hasOther = false;
      for (const s of b.correctScores || []) {
        if (s === 'OTHER_HOME' || s === 'OTHER_AWAY' || s === 'OTHER_DRAW') {
          hasOther = true;
          continue;
        }
        const m = /^(\d+)-(\d+)$/.exec(s);
        if (!m) continue;
        const h = Number(m[1]);
        const a = Number(m[2]);
        // Scores past the grid would double-settle with the Any-Other buckets.
        if (h > CS_GRID_MAX || a > CS_GRID_MAX) continue;
        // Cap-priced cells are folded into the Any-Other bucket above, not listed here.
        if (pricer.scoreProb(h, a) <= CS_CAP_P) continue;
        csSelections.push({ key: `${h}-${a}`, label: `${h} - ${a}`, odds: pricer.price(pricer.scoreProb(h, a)) });
      }
      if (hasOther) {
        const otherP = pricer.other.home + pricer.other.draw + pricer.other.away;
        csSelections.push({ key: 'OTHER', label: 'Any Other Score', odds: pricer.price(otherP) });
      }
      if (csSelections.length >= 2) {
        fromExtra[em.market] = {
          name: 'Correct Score',
          selections: csSelections,
        };
      }
    }
  }

  if (b.sport === 'football') {
    return {
      '1X2': {
        name: 'Match Result',
        selections: [
          { key: '1', label: `${home} to win`, odds: Math.max(b.odds.home, ODD_MIN) },
          { key: 'X', label: 'Draw', odds: Math.max(b.odds.draw ?? 3.2, ODD_MIN) },
          { key: '2', label: `${away} to win`, odds: Math.max(b.odds.away, ODD_MIN) },
        ],
      },
      ...fromExtra,
    };
  }
  if (b.sport === 'basketball') {
    return {
      ML: {
        name: 'Money Line',
        selections: [
          { key: '1', label: `${home} to win`, odds: Math.max(b.odds.home, ODD_MIN) },
          { key: '2', label: `${away} to win`, odds: Math.max(b.odds.away, ODD_MIN) },
        ],
      },
      ...fromExtra,
    };
  }
  return {
    ML: {
      name: 'Match Winner',
      selections: [
        { key: '1', label: home, odds: Math.max(b.odds.home, ODD_MIN) },
        { key: '2', label: away, odds: Math.max(b.odds.away, ODD_MIN) },
      ],
    },
    ...fromExtra,
  };
}

router.patch(
  '/fixtures/:id',
  requireAdmin,
  requireRole('odds_manager'),
  validate(
    z.object({
      isLive: z.boolean().optional(),
      finished: z.boolean().optional(),
      kickoff: z.string().optional(),
      day: z.string().optional(),
      scoreHome: z.number().optional(),
      scoreAway: z.number().optional(),
      minute: z.string().optional(),
      status: z.string().optional(),
      fixed: z.boolean().optional(),
    }),
  ),
  (req, res, next) => {
    const view = adminLookupFixture(req.params.id);
    if (!view) return next(notFound('Fixture not found'));
    patchOverride(req.params.id, req.body);
    audit(req, { action: 'sports.fixture.patch', target: req.params.id, targetType: 'fixture', meta: req.body });
    const refreshed = adminLookupFixture(req.params.id);
    const result = { fixture: { ...refreshed.match, sport: refreshed.sport?.id, leagueId: refreshed.league?.id } };
    emitAdmin('sports:fixture:updated', result);
    res.json(result);
  },
);

router.delete('/fixtures/:id', requireAdmin, requireRole('odds_manager'), (req, res) => {
  deleteCustomFixture(req.params.id);
  audit(req, { action: 'sports.fixture.delete', target: req.params.id, targetType: 'fixture' });
  emitAdmin('sports:fixture:deleted', { id: req.params.id });
  res.json({ ok: true });
});

router.patch(
  '/fixtures/:id/odds',
  requireAdmin,
  requireRole('odds_manager'),
  validate(
    z.object({
      market: z.string(),
      key: z.string(),
      odds: z.number().min(ODD_MIN).max(ODD_MAX),
    }),
  ),
  (req, res, next) => {
    const view = adminLookupFixture(req.params.id);
    if (!view) return next(notFound('Fixture not found'));
    const m = view.match.markets?.[req.body.market];
    if (!m) return next(badRequest('Unknown market'));
    if (!m.selections?.some((s) => s.key === req.body.key)) return next(badRequest('Unknown selection'));
    setOddsOverride(req.params.id, req.body.market, req.body.key, req.body.odds);
    audit(req, { action: 'sports.odds.override', target: req.params.id, targetType: 'fixture', meta: req.body });
    emitAdmin('sports:odds:updated', { fixtureId: req.params.id, market: req.body.market, key: req.body.key, odds: req.body.odds });
    res.json({ ok: true });
  },
);

router.delete('/fixtures/:id/odds', requireAdmin, requireRole('odds_manager'), (req, res) => {
  clearOddsOverride(req.params.id);
  audit(req, { action: 'sports.odds.reset', target: req.params.id, targetType: 'fixture' });
  emitAdmin('sports:odds:reset', { fixtureId: req.params.id });
  res.json({ ok: true });
});

router.post(
  '/fixtures/:id/suspend',
  requireAdmin,
  requireRole('odds_manager'),
  validate(
    z.object({
      all: z.boolean().optional(),
      market: z.string().optional(),
      selection: z.string().optional(),
    }),
  ),
  (req, res) => {
    const cur = {};
    if (req.body.all) cur.all = true;
    if (req.body.market) cur.markets = [req.body.market];
    if (req.body.selection) cur.selections = [req.body.selection];
    setSuspension(req.params.id, cur);
    audit(req, {
      action: 'sports.suspend',
      target: req.params.id,
      targetType: 'fixture',
      severity: 'warning',
      meta: req.body,
    });
    emitAdmin('sports:suspend', { fixtureId: req.params.id, ...req.body });
    res.json({ ok: true });
  },
);

router.delete('/fixtures/:id/suspend', requireAdmin, requireRole('odds_manager'), (req, res) => {
  clearSuspension(req.params.id);
  audit(req, { action: 'sports.suspend.clear', target: req.params.id, targetType: 'fixture' });
  emitAdmin('sports:suspend:cleared', { fixtureId: req.params.id });
  res.json({ ok: true });
});

router.post(
  '/fixtures/:id/result',
  requireAdmin,
  requireRole('odds_manager'),
  validate(
    z.object({
      scoreHome: z.number().int().min(0).max(199),
      scoreAway: z.number().int().min(0).max(199),
      autoSettle: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res, next) => {
    const view = adminLookupFixture(req.params.id);
    if (!view) return next(notFound('Fixture not found'));
    setResult(req.params.id, req.body.scoreHome, req.body.scoreAway, 'manual');
    let settled = null;
    if (req.body.autoSettle !== false) settled = settleNow();
    audit(req, {
      action: 'sports.result',
      target: req.params.id,
      targetType: 'fixture',
      severity: 'warning',
      meta: { ...req.body, settled },
    });
    emitAdmin('sports:result', { fixtureId: req.params.id, scoreHome: req.body.scoreHome, scoreAway: req.body.scoreAway });
    res.json({ ok: true, settled });
  }),
);

router.post('/fixtures/:id/settle', requireAdmin, requireRole('odds_manager'), (req, res) => {
  const settled = settleNow();
  audit(req, { action: 'sports.settle', target: req.params.id, targetType: 'fixture', meta: settled });
  emitAdmin('sports:settled', { fixtureId: req.params.id });
  res.json({ ok: true, settled });
});

const addMarketSchema = z.object({
  marketKey: z.string().min(1),
  name: z.string().min(1).max(100),
  selections: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().optional(),
        odds: z.number().min(ODD_MIN).max(ODD_MAX),
      }),
    )
    .min(2, 'At least 2 selections required.'),
});

router.post(
  '/fixtures/:id/markets',
  requireAdmin,
  requireRole('odds_manager'),
  validate(addMarketSchema),
  (req, res, next) => {
    const { marketKey, name, selections } = req.body;
    const result = addMarketToFixture(req.params.id, marketKey, { name, selections });
    if (result === null) return next(notFound('Fixture not found or market already exists.'));
    audit(req, {
      action: 'sports.market.add',
      target: req.params.id,
      targetType: 'fixture',
      meta: { marketKey, name, selections: selections.length },
    });
    emitAdmin('sports:market:added', { fixtureId: req.params.id, marketKey, name });
    res.status(201).json({ ok: true, market: result });
  },
);

router.delete('/fixtures/:id/markets/:marketKey', requireAdmin, requireRole('odds_manager'), (req, res, next) => {
  const ok = removeMarketFromFixture(req.params.id, req.params.marketKey);
  if (!ok) return next(notFound('Fixture or market not found.'));
  audit(req, {
    action: 'sports.market.delete',
    target: req.params.id,
    targetType: 'fixture',
    meta: { marketKey: req.params.marketKey },
  });
  emitAdmin('sports:market:removed', { fixtureId: req.params.id, marketKey: req.params.marketKey });
  res.json({ ok: true });
});

const bulkFixtureSchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'mark-live', 'mark-upcoming', 'set-result']),
  fixtureIds: z.array(z.string()).min(1).max(100),
  payload: z
    .object({
      scoreHome: z.number().int().nonnegative().optional(),
      scoreAway: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

router.post(
  '/fixtures/bulk',
  requireAdmin,
  requireRole('odds_manager'),
  validate(bulkFixtureSchema),
  asyncHandler(async (req, res) => {
    const { action, fixtureIds, payload } = req.body;
    const results = [];

    for (const id of fixtureIds) {
      try {
        const view = adminLookupFixture(id);
        if (!view) {
          results.push({ fixtureId: id, status: 'error', error: 'Not found' });
          continue;
        }
        const fixture = view.match || view;
        const isCustom = fixture.source === 'custom' || fixture.adminCreated;

        if (action === 'suspend') {
          setSuspension(id, { all: true });
          results.push({ fixtureId: id, status: 'suspended' });
        } else if (action === 'unsuspend') {
          clearSuspension(id);
          results.push({ fixtureId: id, status: 'unsuspended' });
        } else if (action === 'mark-live') {
          patchOverride(id, { isLive: true, status: 'live', startedAt: fixture.startedAt || new Date().toISOString() });
          results.push({ fixtureId: id, status: 'marked-live' });
        } else if (action === 'mark-upcoming') {
          patchOverride(id, { isLive: false, status: 'upcoming' });
          results.push({ fixtureId: id, status: 'marked-upcoming' });
        } else if (action === 'set-result') {
          if (!isCustom) {
            results.push({ fixtureId: id, status: 'error', error: 'Can only set result on custom fixtures' });
            continue;
          }
          const sh = payload?.scoreHome ?? fixture.scoreHome ?? 0;
          const sa = payload?.scoreAway ?? fixture.scoreAway ?? 0;
          setResult(id, sh, sa);
          results.push({ fixtureId: id, status: 'result-set', scoreHome: sh, scoreAway: sa });
        }
      } catch (e) {
        results.push({ fixtureId: id, status: 'error', error: e.message });
      }
    }

    audit(req, {
      action: `sports.bulk.${action}`,
      target: `fixtures:${fixtureIds.length}`,
      targetType: 'fixture',
      severity: 'warning',
      meta: { count: fixtureIds.length },
    });
    emitAdmin('sports:bulk', { action, count: fixtureIds.length });
    res.json({ ok: true, results });
  }),
);

export default router;
