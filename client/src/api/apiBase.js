/**
 * Single source of truth for the backend origin.
 *
 * Production reads VITE_API_BASE from the Vercel project settings. When that
 * is unset the client falls back to BACKEND_ORIGIN below — so if the backend
 * moves hosts, this constant is the ONE line that changes. Leaving a stale
 * value here is what makes a mis-set VITE_API_BASE fail as a confusing 405 on
 * login rather than an obvious connection error.
 */
const BACKEND_ORIGIN = 'https://oddsify-api-production.up.railway.app';
const DEV_ORIGIN = 'http://127.0.0.1:4000';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * Absolute origin for Socket.IO, which cannot use a relative URL.
 * Falls back to the page origin for preview builds served from the API host.
 */
export const SOCKET_ORIGIN =
  import.meta.env.VITE_API_BASE ||
  (isLocalHost
    ? DEV_ORIGIN
    : import.meta.env.PROD
      ? BACKEND_ORIGIN
      : typeof window !== 'undefined'
        ? window.location.origin
        : DEV_ORIGIN);

/**
 * Origin for fetch(). Empty string in dev so Vite proxies /api to the local
 * server; absolute in production.
 */
export const API_ORIGIN =
  import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? BACKEND_ORIGIN : '');
