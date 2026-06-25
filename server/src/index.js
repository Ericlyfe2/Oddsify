import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { isProd, PORT, GOOGLE, SMTP, CORS_ORIGINS, CORS_ALLOW_VERCEL } from './config/env.js';
import { buildOriginAllowlist } from './utils/corsOrigin.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { log } from './utils/logger.js';
import { metricsMiddleware } from './services/metrics.js';
import { apiLimiter } from './middleware/rateLimit.js';

import authRouter from './routes/auth.js';
import otpRouter from './routes/otp.js';
import betRouter from './routes/bet.js';
import walletRouter from './routes/wallet.js';
import profileRouter from './routes/profile.js';
import referralsRouter from './routes/referrals.js';
import adminReferralsRouter from './routes/admin/referrals.js';
import supportRouter from './routes/support.js';
import statsRouter from './routes/stats.js';
import adminAuthRouter from './routes/admin/auth.js';
import adminDashboardRouter from './routes/admin/dashboard.js';
import adminUsersRouter from './routes/admin/users.js';
import adminBetsRouter from './routes/admin/bets.js';
import adminSportsRouter from './routes/admin/sports.js';
import adminPromosRouter from './routes/admin/promotions.js';
import adminStatsRouter from './routes/admin/stats.js';
import adminProvidersRouter from './routes/admin/providers.js';
import adminNotificationsRouter from './routes/admin/notifications.js';
import adminDepositsRouter from './routes/admin/deposits.js';
import adminSettingsRouter from './routes/admin/settings.js';
import adminSupportRouter from './routes/admin/support.js';
import adminCatalogRouter from './routes/admin/catalog.js';
import adminMgmtSportsRouter from './routes/admin/management-sports.js';
import adminMgmtTeamsRouter from './routes/admin/management-teams.js';
import adminMgmtLeaguesRouter from './routes/admin/management-leagues.js';
import adminMgmtMatchesRouter from './routes/admin/management-matches.js';
import adminMgmtMarketsRouter from './routes/admin/management-markets.js';
import adminMgmtResultsRouter from './routes/admin/management-results.js';
import { seedAdmins } from './db/seedAdmins.js';
import { seedTemplates } from './db/marketTemplates.js';
import { backfillVerification } from './db/backfillVerification.js';
import { initStores } from './db/store.js';
import { getSettings } from './db/settings.js';
import { startSettlementLoop } from './services/settlement.js';
import { attachRealtime } from './services/realtime.js';
import { startAggregator, startLiveTrack } from './services/oddsAggregator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// API-only deploy: the SPA is served by Vercel, so the CSP we apply here
// only governs the few admin/utility routes hosted on the Render origin
// (/, /api/*). Restrict scripts to same-origin + Google Identity Services
// for the social-login popup. Vite's dev needs are not relevant here —
// the dev server uses its own policy and bypasses Helmet entirely.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://accounts.google.com', 'https://apis.google.com'],
        'connect-src': ["'self'", 'https://accounts.google.com'],
        'frame-src': ["'self'", 'https://accounts.google.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // required by Google Identity Services popup
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Google's button assets
  }),
);
// Shared predicate — also reused by realtime.js for Socket.IO so the two
// transports always agree on what's allowed (including Vercel preview URLs
// when CORS_ALLOW_VERCEL is set).
const isAllowedOrigin = buildOriginAllowlist({
  isProd,
  allowedOrigins: CORS_ORIGINS,
  vercelProject: CORS_ALLOW_VERCEL,
});
app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      log.warn(`CORS: rejecting origin ${origin}. Add it to CORS_ORIGIN if it's a legitimate frontend.`);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use(metricsMiddleware);
app.use('/api', apiLimiter);

// Render exposes the commit SHA of the current deploy as RENDER_GIT_COMMIT.
// Surface it on /api/health so we can confirm which build is live without
// having to log into the Render dashboard.
const DEPLOYED_COMMIT = (process.env.RENDER_GIT_COMMIT || 'unknown').slice(0, 12);
const BOOT_AT = new Date().toISOString();
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'oddsify-api',
    version: '1.0.0',
    commit: DEPLOYED_COMMIT,
    bootAt: BOOT_AT,
    google: GOOGLE.enabled,
    smtp: SMTP.enabled,
    env: isProd ? 'production' : 'development',
  });
});

app.get('/api/settings/public', (_req, res) => {
  const s = getSettings();
  res.json({
    maintenance: s.maintenance,
    maintenanceMessage: s.maintenanceMessage,
    signupsOpen: s.signupsOpen,
    minDeposit: s.minDeposit,
    minWithdraw: s.minWithdraw,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/otp', otpRouter);
app.use('/api/bet', betRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/profile', profileRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/support', supportRouter);
app.use('/api/stats', statsRouter);

app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/bets', adminBetsRouter);
app.use('/api/admin/sports', adminSportsRouter);
app.use('/api/admin/promotions', adminPromosRouter);
app.use('/api/admin/stats', adminStatsRouter);
app.use('/api/admin/providers', adminProvidersRouter);
app.use('/api/admin/notifications', adminNotificationsRouter);
app.use('/api/admin/deposits', adminDepositsRouter);
app.use('/api/admin/referrals', adminReferralsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/admin/support', adminSupportRouter);
app.use('/api/admin/catalog', adminCatalogRouter);
app.use('/api/admin/management/sports', adminMgmtSportsRouter);
app.use('/api/admin/management/teams', adminMgmtTeamsRouter);
app.use('/api/admin/management/leagues', adminMgmtLeaguesRouter);
app.use('/api/admin/management/matches', adminMgmtMatchesRouter);
app.use('/api/admin/management/markets', adminMgmtMarketsRouter);
app.use('/api/admin/management/results', adminMgmtResultsRouter);

app.use('/api', notFoundHandler);

// Optional monolith mode: only serve the React SPA from this process when
// `client/dist/index.html` actually exists. On Render the build command is
// `npm install` (no client build), so this block stays inert and the catch-
// all that used to ENOENT on every non-/api request is gone.
//
// To re-enable serving the SPA from the API, add `npm run build` to the
// Render build command (or any equivalent build step) so client/dist is
// populated before the server starts.
if (isProd) {
  const dist = path.join(__dirname, '../../client/dist');
  const indexHtml = path.join(dist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(indexHtml, (err) => err && next(err));
    });
    log.info(`Serving SPA from ${dist}`);
  } else {
    log.info(`SPA bundle not present (${indexHtml}) — running as API-only.`);
    app.get('/', (_req, res) => {
      res.json({ ok: true, service: 'oddsify-api', mode: 'api-only' });
    });
  }
}

app.use(errorHandler);

const server = http.createServer(app);
attachRealtime(server);

async function boot() {
  // Load every KV store (Postgres or JSON files) into memory so that
  // synchronous get/set in route handlers is safe.
  await initStores();

  // Production safety: refuse to boot on Render's free-tier ephemeral disk
  // when no DATABASE_URL is set. Without persistence, every user account
  // gets wiped on each restart and the operator cannot understand why
  // logins keep failing. Surface the misconfiguration loudly instead.
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    log.error(
      'DATABASE_URL is not set in production. Refusing to boot — set the Neon connection string in the Render dashboard or remove NODE_ENV=production for local testing.',
    );
    process.exit(1);
  }

  // Seed the canonical market templates so auto-attach works on first match.
  const seeded = seedTemplates();
  if (seeded > 0) log.info(`Seeded ${seeded} market templates`);

  // Only the super admin is seeded. No demo players, no demo bets, no
  // demo transactions, no seeded promotions — operators add real content
  // through the admin UI.
  await seedAdmins();

  // One-time: reset legacy accounts to unverified so verification is fully
  // manual. Guarded internally — safe to call on every boot.
  backfillVerification();

  await new Promise((resolve) => server.listen(PORT, resolve));
  log.info(`Oddsify API listening on http://127.0.0.1:${PORT}`);

  try {
    startSettlementLoop();
    startAggregator();
    startLiveTrack();
  } catch (e) {
    log.error('post-boot error', e?.message || e);
  }
}

boot().catch((e) => {
  log.error('boot failed:', e?.stack || e);
  process.exit(1);
});
