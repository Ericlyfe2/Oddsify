/**
 * Public support endpoint — accepts ticket submissions from the help page.
 * Stored in the same store used by the admin support module.
 */
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ticketStore } from './admin/support.js';
import { emitAdmin } from '../services/realtime.js';

const router = Router();

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('').transform(() => undefined)),
  topic: z.string().trim().min(1).max(40),
  body: z.string().trim().min(1).max(4000),
});

router.post('/tickets', validate(ticketSchema), asyncHandler(async (req, res) => {
  const { name, email, topic, body } = req.body;
  const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const ticket = {
    id,
    name, email: email || null, topic, body,
    status: 'open',
    replies: [],
    createdAt: now,
    updatedAt: now,
    sourceIp: req.ip,
  };
  ticketStore.set(id, ticket);
  emitAdmin('support:new', { ticketId: id, topic, name });
  res.status(201).json({ ok: true, ticket: { id, status: 'open' } });
}));

export default router;
