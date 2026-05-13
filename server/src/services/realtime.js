/**
 * Realtime backbone.
 *
 * Two namespaces:
 *   /live   — player-facing. Token optional. Rooms: 'fixture:<id>',
 *             'sport:<id>', 'user:<id>' (when authed).
 *   /admin  — admin-only. Token required and scope=admin. Rooms: 'global',
 *             'provider:<id>'.
 *
 * Event names (server -> client):
 *   /live:
 *     - odds:tick      { key, fixtureId, market, selections, provider }
 *     - odds:movement  { key, fixtureId, market, selection, prev, next }
 *     - score:update   { fixtureId, scoreHome, scoreAway, minute }
 *     - bet:settled    { betId, status, payout }                 (user room only)
 *     - bet:won        { betId, payout }                         (user room only)
 *     - wallet:update  { balance, delta, reason }                (user room only)
 *   /admin:
 *     - audit:event    Audit log row
 *     - provider:health Provider snapshot
 *     - bet:placed     New bet
 *     - bet:settled    Settled bet (any user)
 *     - kpi:tick       Lightweight KPI delta (online users, etc.)
 *
 * Client -> server commands:
 *   /live   subscribe   { fixtureIds: string[], sportIds: string[] }
 *   /live   unsubscribe { fixtureIds: string[], sportIds: string[] }
 *   /admin  subscribe   { providers?: string[] }
 */
import { Server as IOServer } from 'socket.io';
import { verifyAccessToken } from './token.js';
import { getUserById } from '../db/users.js';
import { isProd } from '../config/env.js';
import { log } from '../utils/logger.js';

let io = null;
let liveNs = null;
let adminNs = null;

// Track sockets per user / per admin for monitoring
const liveByUser = new Map();   // userId -> Set<socket>
const adminSockets = new Set();

export function attachRealtime(httpServer) {
  if (io) return io;
  io = new IOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 60_000,
    transports: ['websocket', 'polling'],
  });

  liveNs  = io.of('/live');
  adminNs = io.of('/admin');

  // --- /live namespace (player site) ---------------------------------------
  liveNs.use((socket, next) => {
    const token = pickToken(socket);
    socket.data.user = null;
    if (token) {
      try {
        const claims = verifyAccessToken(token);
        if (claims.scope === 'user' || !claims.scope) {
          const u = getUserById(claims.sub);
          if (u && !u.suspended) socket.data.user = u;
        }
      } catch { /* anonymous, still allowed */ }
    }
    next();
  });

  liveNs.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) {
      socket.join(`user:${user.id}`);
      const set = liveByUser.get(user.id) || new Set();
      set.add(socket);
      liveByUser.set(user.id, set);
    }

    socket.emit('ready', { authenticated: !!user, ts: Date.now() });

    socket.on('subscribe', (payload = {}) => {
      const { fixtureIds = [], sportIds = [] } = payload;
      for (const id of fixtureIds.slice(0, 200)) socket.join(`fixture:${id}`);
      for (const id of sportIds.slice(0, 10))    socket.join(`sport:${id}`);
    });

    socket.on('unsubscribe', (payload = {}) => {
      const { fixtureIds = [], sportIds = [] } = payload;
      for (const id of fixtureIds) socket.leave(`fixture:${id}`);
      for (const id of sportIds)   socket.leave(`sport:${id}`);
    });

    socket.on('disconnect', () => {
      if (user) {
        const set = liveByUser.get(user.id);
        if (set) { set.delete(socket); if (set.size === 0) liveByUser.delete(user.id); }
      }
    });
  });

  // --- /admin namespace ----------------------------------------------------
  adminNs.use((socket, next) => {
    const token = pickToken(socket);
    if (!token) return next(new Error('admin token required'));
    try {
      const claims = verifyAccessToken(token);
      if (claims.scope !== 'admin') return next(new Error('not an admin token'));
      const u = getUserById(claims.sub);
      if (!u || u.role !== 'admin' || u.suspended) return next(new Error('admin not active'));
      socket.data.admin = u;
      socket.data.adminClaims = claims;
      return next();
    } catch (e) {
      return next(new Error('invalid admin session'));
    }
  });

  adminNs.on('connection', (socket) => {
    adminSockets.add(socket);
    socket.join('global');
    socket.emit('ready', { admin: socket.data.admin.email, role: socket.data.admin.adminRole, ts: Date.now() });

    socket.on('subscribe', (payload = {}) => {
      const { providers = [] } = payload;
      for (const id of providers) socket.join(`provider:${id}`);
    });

    socket.on('disconnect', () => { adminSockets.delete(socket); });
  });

  log.info('Realtime: Socket.IO attached on /socket.io (namespaces /live and /admin)');
  return io;
}

function pickToken(socket) {
  return (
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
    null
  );
}

/* ------------------------------------------------------------------ *
 *  Emit helpers used throughout the server. No-ops before attach so
 *  modules can import these unconditionally.
 * ------------------------------------------------------------------ */

export function emitOddsTick(payload) {
  if (!liveNs) return;
  const room = `fixture:${payload.fixtureId || payload.key}`;
  liveNs.to(room).emit('odds:tick', payload);
  if (payload.sport) liveNs.to(`sport:${payload.sport}`).emit('odds:tick', payload);
}

export function emitOddsMovement(payload) {
  if (!liveNs) return;
  liveNs.to(`fixture:${payload.fixtureId}`).emit('odds:movement', payload);
  if (adminNs) adminNs.to('global').emit('odds:movement', payload);
}

export function emitScoreUpdate(payload) {
  if (!liveNs) return;
  liveNs.to(`fixture:${payload.fixtureId}`).emit('score:update', payload);
  if (payload.sport) liveNs.to(`sport:${payload.sport}`).emit('score:update', payload);
}

export function emitToUser(userId, event, payload) {
  if (!liveNs || !userId) return;
  liveNs.to(`user:${userId}`).emit(event, payload);
}

export function emitAdmin(event, payload) {
  if (!adminNs) return;
  adminNs.to('global').emit(event, payload);
}

/** Broadcast to every connected player socket. */
export function emitAll(event, payload) {
  if (!liveNs) return;
  liveNs.emit(event, payload);
}

export function emitProviderHealth(snapshot) {
  if (!adminNs) return;
  adminNs.to('global').emit('provider:health', snapshot);
}

export function realtimeStats() {
  return {
    attached: !!io,
    livePlayers: liveByUser.size,
    liveSockets: liveNs ? liveNs.sockets.size : 0,
    adminSockets: adminSockets.size,
  };
}
