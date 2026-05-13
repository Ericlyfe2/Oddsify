/**
 * Admin-namespace Socket.IO client. Requires an admin token.
 * Use inside the admin-only routes (rendered after AdminGuard succeeds).
 */
import { io } from 'socket.io-client';
import { getAdminAccess } from './adminApi.js';

const URL = import.meta.env.VITE_API_BASE
  || (typeof window !== 'undefined' && window.location.origin)
  || 'http://localhost:5173';

let socket = null;

export function getAdminSocket() {
  if (socket && socket.connected) return socket;
  if (socket) return socket;
  socket = io(`${URL}/admin`, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token: getAdminAccess() || undefined },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
  });
  return socket;
}

export function onAdmin(event, handler) {
  const s = getAdminSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}

export function emitAdminCmd(event, payload) {
  const s = getAdminSocket();
  s.emit(event, payload);
}

export function disconnectAdminSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
