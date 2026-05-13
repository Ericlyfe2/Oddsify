/**
 * Xenbet API client.
 * - Reads/writes JWT tokens from localStorage (access + refresh).
 * - Auto-refreshes a single in-flight access token on 401.
 * - Throws an Error with .status/.body on non-2xx.
 */

const API_BASE = '/api';
const ACCESS_KEY  = 'bv_access';
const REFRESH_KEY = 'bv_refresh';

let refreshInflight = null;

const ls = typeof localStorage !== 'undefined' ? localStorage : null;

export const setTokens = (access, refresh) => {
  if (!ls) return;
  if (access)  ls.setItem(ACCESS_KEY,  access);  else ls.removeItem(ACCESS_KEY);
  if (refresh) ls.setItem(REFRESH_KEY, refresh); else ls.removeItem(REFRESH_KEY);
};
export const getAccess  = () => ls?.getItem(ACCESS_KEY)  || null;
export const getRefresh = () => ls?.getItem(REFRESH_KEY) || null;
export const clearTokens = () => { ls?.removeItem(ACCESS_KEY); ls?.removeItem(REFRESH_KEY); };

async function rawFetch(path, opts = {}, retry = true) {
  const headers = new Headers(opts.headers || {});
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const access = getAccess();
  if (access && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${access}`);
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status !== 401 || !retry) return res;

  // Try silent refresh exactly once.
  const refresh = getRefresh();
  if (!refresh) return res;
  try {
    refreshInflight = refreshInflight || (async () => {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!r.ok) throw new Error('refresh failed');
      const j = await r.json();
      setTokens(j.accessToken, j.refreshToken);
      return j.accessToken;
    })();
    await refreshInflight;
  } catch {
    clearTokens();
    return res;
  } finally {
    refreshInflight = null;
  }
  return rawFetch(path, opts, false);
}

async function jsonOrThrow(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const get  = (p)        => rawFetch(p).then(jsonOrThrow);
const post = (p, body)  => rawFetch(p, { method: 'POST',   body: JSON.stringify(body || {}) }).then(jsonOrThrow);
const del  = (p)        => rawFetch(p, { method: 'DELETE' }).then(jsonOrThrow);
const patch= (p, body)  => rawFetch(p, { method: 'PATCH',  body: JSON.stringify(body || {}) }).then(jsonOrThrow);

/* meta */
export const fetchHealth = () => get('/health');
export const fetchAuthConfig = () => get('/auth/config');
export const fetchSports = () => get('/bet/sports');

/* matches */
export const fetchMatches = (sport = 'football') => get(`/bet/matches?sport=${encodeURIComponent(sport)}`);
export const fetchMatch   = (id)                 => get(`/bet/matches/${encodeURIComponent(id)}`);
export const fetchLeagues = (sport = 'football') => get(`/bet/leagues?sport=${encodeURIComponent(sport)}`);
export const fetchLeagueMatches = (id)           => get(`/bet/leagues/${encodeURIComponent(id)}/matches`);

/* bets */
export const placeBet       = (payload) => post('/bet/place', payload);
export const fetchBetHistory= ()        => get('/bet/history');
export const fetchBet       = (id)      => get(`/bet/bets/${encodeURIComponent(id)}`);
export const cashOutBet     = (id)      => del (`/bet/bets/${encodeURIComponent(id)}`);
export const fetchUnacknowledgedWins = () => get('/bet/bets/unacknowledged');
export const acknowledgeBet = (id) => post(`/bet/bets/${encodeURIComponent(id)}/ack`);

/* casino, virtuals, jackpot, promos */
export const fetchCasinoGames = (cat) => get(`/bet/casino/games${cat ? `?category=${encodeURIComponent(cat)}` : ''}`);
export const fetchVirtuals    = ()    => get('/bet/virtuals');
export const fetchJackpot     = ()    => get('/bet/jackpot');
export const enterJackpot     = (picks) => post('/bet/jackpot/enter', { picks });
export const fetchPromotions  = ()    => get('/bet/promos');

/* auth */
export const register        = (body) => post('/auth/register',        body);
export const login           = (body) => post('/auth/login',           body);
export const logout          = ()     => post('/auth/logout',          { refreshToken: getRefresh() });
export const changePassword  = (body) => post('/auth/change-password', body);
export const fetchMe         = ()     => get ('/auth/me');
export const fetchActivity   = ()     => get ('/auth/activity');
export const googleSignIn    = (credential, country) => post('/auth/google', { credential, country });

/* wallet */
export const fetchTransactions = ()             => get ('/wallet/transactions');
export const fetchWalletRules  = ()             => get ('/wallet/rules');
export const deposit          = (amount, method) => post('/wallet/deposit',  { amount, method });
export const withdraw         = (amount, method) => post('/wallet/withdraw', { amount, method });

/* profile */
export const fetchProfile  = ()      => get  ('/profile');
export const updateProfile = (patch_) => patch('/profile', patch_);

/* support */
export const submitTicket = (body) => post('/support/tickets', body);
