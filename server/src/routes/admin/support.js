/**
 * Support ticket queue — read/respond/close from the admin console.
 * Tickets are created by the public POST /api/support/tickets endpoint
 * (see routes/support.js).
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { createStore } from '../../db/store.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { notFound } from '../../utils/httpError.js';
import { emitAdmin } from '../../services/realtime.js';

const store = createStore('support_tickets', {});
const router = Router();

const replySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const statusSchema = z.object({
  status: z.enum(['open', 'pending', 'closed']),
});

router.get('/tickets', requireAdmin, (req, res) => {
  const status = req.query.status;
  let list = Object.values(store.all() || {});
  if (status) list = list.filter((t) => t.status === status);
  list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  res.json({ tickets: list.slice(0, 200) });
});

router.get('/tickets/:id', requireAdmin, (req, res, next) => {
  const t = store.get(req.params.id);
  if (!t) return next(notFound('Ticket not found.'));
  res.json({ ticket: t });
});

router.post(
  '/tickets/:id/reply',
  requireAdmin,
  validate(replySchema),
  asyncHandler(async (req, res, next) => {
    const t = store.get(req.params.id);
    if (!t) return next(notFound('Ticket not found.'));
    const reply = {
      by: req.admin.email,
      role: 'admin',
      body: req.body.body,
      at: new Date().toISOString(),
    };
    const updated = store.update(t.id, (cur) => ({
      ...cur,
      replies: [...(cur.replies || []), reply],
      status: 'pending',
      updatedAt: new Date().toISOString(),
    }));
    audit(req, { action: 'admin.support.replied', target: t.id, targetType: 'ticket' });
    emitAdmin('support:reply', { ticketId: t.id, status: updated.status });
    res.json({ ok: true, ticket: updated });
  }),
);

router.patch(
  '/tickets/:id',
  requireAdmin,
  validate(statusSchema),
  asyncHandler(async (req, res, next) => {
    const t = store.get(req.params.id);
    if (!t) return next(notFound('Ticket not found.'));
    const updated = store.update(t.id, (cur) => ({
      ...cur,
      status: req.body.status,
      updatedAt: new Date().toISOString(),
    }));
    audit(req, {
      action: 'admin.support.status',
      target: t.id,
      targetType: 'ticket',
      meta: { status: req.body.status },
    });
    res.json({ ok: true, ticket: updated });
  }),
);

export default router;
export { store as ticketStore };
