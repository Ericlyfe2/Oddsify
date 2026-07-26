/**
 * Public support endpoint — accepts ticket submissions from the help page.
 * Stored in the same store used by the admin support module.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { notFound, forbidden } from '../utils/httpError.js';
import { ticketStore } from './admin/support.js';
import { emitAdmin } from '../services/realtime.js';

const router = Router();

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  topic: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(4000),
});

const replySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

router.post(
  '/tickets',
  optionalAuth,
  validate(ticketSchema),
  asyncHandler(async (req, res) => {
    const { name, email, topic, body } = req.body;
    const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const ticket = {
      id,
      userId: req.user?.id || null,
      name,
      email: email || null,
      topic,
      body,
      status: 'open',
      replies: [],
      createdAt: now,
      updatedAt: now,
      sourceIp: req.ip,
    };
    ticketStore.set(id, ticket);
    emitAdmin('support:new', { ticketId: id, topic, name });
    res.status(201).json({ ok: true, ticket: { id, status: 'open' } });
  }),
);

// The signed-in user's own tickets, most recently updated first — powers the
// "my messages" view in the notification bell / contact page.
router.get('/tickets/mine', requireAuth, (req, res) => {
  const mine = Object.values(ticketStore.all() || {}).filter((t) => t.userId === req.user.id);
  mine.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  res.json({ tickets: mine.slice(0, 100) });
});

// Follow-up message from the ticket owner — keeps the conversation going
// after an admin replies, without opening a brand new ticket each time.
router.post(
  '/tickets/:id/reply',
  requireAuth,
  validate(replySchema),
  asyncHandler(async (req, res, next) => {
    const t = ticketStore.get(req.params.id);
    if (!t) return next(notFound('Ticket not found.'));
    if (t.userId !== req.user.id) return next(forbidden('Not your ticket.'));
    const reply = {
      by: req.user.displayName || req.user.email || 'You',
      role: 'user',
      body: req.body.body,
      at: new Date().toISOString(),
    };
    const updated = ticketStore.update(t.id, (cur) => ({
      ...cur,
      replies: [...(cur.replies || []), reply],
      status: 'open',
      updatedAt: new Date().toISOString(),
    }));
    emitAdmin('support:new', { ticketId: t.id, topic: t.topic, name: t.name, followUp: true });
    res.json({ ok: true, ticket: updated });
  }),
);

export default router;
