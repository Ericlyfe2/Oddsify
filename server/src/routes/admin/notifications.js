/**
 * Admin broadcasts. A broadcast is a message the admin team publishes for the
 * whole player base — surfaced via the realtime channel and persisted so any
 * client connecting later can fetch the recent set.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { createStore } from '../../db/store.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound } from '../../utils/httpError.js';
import { emitAll, emitAdmin } from '../../services/realtime.js';

const store = createStore('notifications', {});
const router = Router();

const broadcastSchema = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(500),
  audience: z.enum(['all', 'verified', 'admins']).default('all'),
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
});

router.get('/', requireAdmin, (_req, res) => {
  const all = Object.values(store.all() || {}).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ notifications: all.slice(0, 100) });
});

router.post(
  '/',
  requireAdmin,
  validate(broadcastSchema),
  asyncHandler(async (req, res) => {
    const { title, body, audience, severity } = req.body;
    const id = `nfn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record = {
      id,
      title,
      body,
      audience,
      severity,
      createdBy: req.admin.id,
      createdAt: new Date().toISOString(),
    };
    store.set(id, record);
    audit(req, {
      action: 'admin.broadcast.sent',
      target: id,
      targetType: 'notification',
      meta: { audience, severity },
    });
    if (audience === 'admins') emitAdmin('notification:new', record);
    else emitAll('notification:new', record);
    res.status(201).json({ ok: true, notification: record });
  }),
);

router.delete('/:id', requireAdmin, (req, res, next) => {
  const rec = store.get(req.params.id);
  if (!rec) return next(notFound('Notification not found.'));
  store.delete(req.params.id);
  audit(req, {
    action: 'admin.broadcast.deleted',
    target: req.params.id,
    targetType: 'notification',
    severity: 'warning',
  });
  res.json({ ok: true });
});

export default router;
