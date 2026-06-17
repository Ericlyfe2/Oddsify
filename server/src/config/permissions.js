/**
 * Granular permission matrix for the Oddsify admin control center.
 *
 * Every admin action that mutates data is gated by one or more permissions,
 * checked server-side via `requirePermission()`. The matrix maps permission
 * keys to the minimum admin role that can perform them.
 *
 * Convention: `<resource>.<action>` — e.g. `matches.create`, `users.suspend`.
 * Super_admin always passes. Extend by adding entries below; the same map
 * drives both the server middleware and the client-side UI visibility.
 */

export const PERMISSIONS = {
  // ── Matches ──────────────────────────────────────────────
  'matches.create': ['odds_manager'],
  'matches.edit': ['odds_manager'],
  'matches.delete': ['odds_manager'],
  'matches.suspend': ['odds_manager'],
  'matches.cancel': ['odds_manager', 'moderator'],
  'matches.archive': ['odds_manager'],
  'matches.bulk': ['odds_manager'],
  'matches.import': ['odds_manager', 'super_admin'],

  // ── Leagues ──────────────────────────────────────────────
  'leagues.create': ['odds_manager'],
  'leagues.edit': ['odds_manager'],
  'leagues.archive': ['odds_manager'],
  'leagues.delete': ['super_admin'],

  // ── Sports ───────────────────────────────────────────────
  'sports.create': ['super_admin'],
  'sports.edit': ['odds_manager', 'super_admin'],
  'sports.archive': ['super_admin'],

  // ── Teams ────────────────────────────────────────────────
  'teams.create': ['odds_manager'],
  'teams.edit': ['odds_manager'],
  'teams.archive': ['odds_manager'],

  // ── Markets ──────────────────────────────────────────────
  'markets.create': ['odds_manager'],
  'markets.edit': ['odds_manager'],
  'markets.suspend': ['odds_manager'],
  'markets.disable': ['odds_manager'],
  'markets.attach': ['odds_manager'],
  'markets.detach': ['odds_manager'],

  // ── Selections / Odds ────────────────────────────────────
  'odds.edit': ['odds_manager'],
  'odds.suspend': ['odds_manager'],
  'odds.reset': ['odds_manager'],

  // ── Results & Settlement ─────────────────────────────────
  'results.enter': ['odds_manager'],
  'results.confirm': ['odds_manager', 'super_admin'],
  'results.override': ['super_admin'],
  'settlement.run': ['odds_manager'],
  'settlement.reverse': ['super_admin'],

  // ── Bets ─────────────────────────────────────────────────
  'bets.view': ['moderator', 'support', 'odds_manager', 'finance_admin'],
  'bets.settle': ['odds_manager', 'finance_admin'],
  'bets.cancel': ['odds_manager', 'finance_admin', 'moderator'],
  'bets.void': ['odds_manager', 'finance_admin'],
  'bets.delete': ['moderator', 'odds_manager', 'finance_admin'],
  'bets.note': ['moderator', 'support', 'odds_manager', 'finance_admin'],

  // ── Users ────────────────────────────────────────────────
  'users.view': ['moderator', 'support', 'odds_manager', 'finance_admin'],
  'users.create': ['super_admin'],
  'users.suspend': ['moderator'],
  'users.ban': ['moderator', 'super_admin'],
  'users.delete': ['super_admin'],
  'users.kyc': ['moderator', 'support'],
  'users.stage': ['moderator', 'support'],
  'users.tags': ['moderator', 'support'],
  'users.notes': ['moderator', 'support'],
  'users.impersonate': ['super_admin'],
  'users.resetPassword': ['super_admin'],
  'users.forceLogout': ['moderator', 'super_admin'],

  // ── Wallet / Finance ─────────────────────────────────────
  'wallet.adjust': ['finance_admin'],
  'wallet.view': ['finance_admin', 'moderator'],
  'deposits.approve': ['finance_admin'],
  'deposits.reject': ['finance_admin'],
  'deposits.view': ['finance_admin'],
  'withdrawals.approve': ['finance_admin'],
  'withdrawals.reject': ['finance_admin'],
  'withdrawals.view': ['finance_admin'],
  'transactions.view': ['finance_admin', 'moderator'],

  // ── Referrals ────────────────────────────────────────────
  'referrals.approve': ['finance_admin'],
  'referrals.reject': ['finance_admin'],
  'referrals.reverse': ['finance_admin'],
  'referrals.view': ['finance_admin', 'moderator'],

  // ── Promotions ───────────────────────────────────────────
  'promotions.create': ['super_admin'],
  'promotions.edit': ['super_admin'],
  'promotions.delete': ['super_admin'],

  // ── Notifications ────────────────────────────────────────
  'notifications.create': ['moderator', 'super_admin'],
  'notifications.delete': ['moderator', 'super_admin'],

  // ── Support ──────────────────────────────────────────────
  'support.tickets': ['support', 'moderator'],
  'support.reply': ['support', 'moderator'],

  // ── System ───────────────────────────────────────────────
  'settings.view': ['moderator', 'support', 'odds_manager', 'finance_admin', 'super_admin'],
  'settings.edit': ['super_admin'],
  'admin.invite': ['super_admin'],
  'admin.manage': ['super_admin'],
  'audit.view': ['moderator', 'super_admin'],

  // ── Providers ────────────────────────────────────────────
  'providers.view': ['moderator', 'super_admin'],
  'providers.test': ['odds_manager', 'super_admin'],

  // ── Analytics ────────────────────────────────────────────
  'analytics.view': ['moderator', 'odds_manager', 'finance_admin', 'super_admin'],
  'analytics.export': ['moderator', 'odds_manager', 'finance_admin', 'super_admin'],
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);

export const ADMIN_ROLE_HIERARCHY = [
  'support',
  'moderator',
  'odds_manager',
  'finance_admin',
  'super_admin',
];
