/**
 * Admin audit log. Append-only, capped at 5000 entries.
 * Every privileged action funnels through `recordAudit` so the dashboard
 * can show "who did what" and security can review suspicious activity.
 */
import crypto from 'crypto';
import { createStore } from './store.js';

const auditStore = createStore('audit_logs', { entries: [] });

const CAP = 5000;

export function recordAudit(entry) {
  const row = {
    id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    at: new Date().toISOString(),
    actorId: entry.actorId || null,
    actorRole: entry.actorRole || null,
    action: entry.action,
    target: entry.target || null,
    targetType: entry.targetType || null,
    ip: entry.ip || null,
    userAgent: entry.userAgent || null,
    meta: entry.meta || {},
    severity: entry.severity || 'info',
  };
  const data = auditStore.all();
  const next = [row, ...(data.entries || [])].slice(0, CAP);
  auditStore.set('entries', next);
  return row;
}

export function listAudit({ limit = 200, action, actorId, targetType, severity, from, to } = {}) {
  const all = auditStore.get('entries') || [];
  return all
    .filter((e) => {
      if (action && !String(e.action).includes(action)) return false;
      if (actorId && e.actorId !== actorId) return false;
      if (targetType && e.targetType !== targetType) return false;
      if (severity && e.severity !== severity) return false;
      if (from && new Date(e.at) < new Date(from)) return false;
      if (to && new Date(e.at) > new Date(to)) return false;
      return true;
    })
    .slice(0, limit);
}

export function auditStats() {
  const all = auditStore.get('entries') || [];
  const last24h = all.filter((e) => Date.now() - new Date(e.at).getTime() < 86_400_000);
  const bySeverity = last24h.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1;
    return acc;
  }, {});
  return {
    total: all.length,
    last24h: last24h.length,
    critical24h: bySeverity.critical || 0,
    warning24h: bySeverity.warning || 0,
  };
}
