import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { getUserById, updateUser, logActivity } from '../../db/users.js';
import { createStore } from '../../db/store.js';
import { emitToUser, emitAdmin } from '../../services/realtime.js';

const txStore = createStore('transactions', {});
const router = Router();

router.get('/pending', requireAdmin, requireRole('finance_admin'), (req, res) => {
  const all = txStore.all() || {};
  const pending = [];
  for (const [userId, txs] of Object.entries(all)) {
    for (const tx of txs) {
      if (tx.kind === 'withdraw' && tx.status === 'pending') {
        const user = getUserById(userId);
        pending.push({
          ...tx,
          user: user ? { id: user.id, email: user.email, displayName: user.displayName, phone: user.phone } : null,
        });
      }
    }
  }
  pending.sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json({ pending });
});

router.post(
  '/:id/approve',
  requireAdmin,
  requireRole('finance_admin'),
  asyncHandler(async (req, res) => {
    const txId = req.params.id;
    const all = txStore.all() || {};
    let foundTx = null;
    let foundUserId = null;
    for (const [userId, txs] of Object.entries(all)) {
      for (const tx of txs) {
        if (tx.id === txId) {
          foundTx = tx;
          foundUserId = userId;
          break;
        }
      }
      if (foundTx) break;
    }
    if (!foundTx) throw notFound('Transaction not found');
    if (foundTx.kind !== 'withdraw' || foundTx.status !== 'pending') {
      throw badRequest('Transaction is not a pending withdrawal');
    }

    // Funds were already deducted (held) when the user submitted the
    // request — approval just confirms the payout went out, no balance
    // change here.
    const userTxs = txStore.get(foundUserId) || [];
    const updatedTxs = userTxs.map((t) =>
      t.id === txId
        ? {
            ...t,
            status: 'completed',
            approvedAt: new Date().toISOString(),
            approvedBy: req.admin?.email || req.admin?.id,
          }
        : t,
    );
    txStore.set(foundUserId, updatedTxs);

    logActivity(foundUserId, { kind: 'withdraw_approved', amount: foundTx.amount, by: req.admin?.email });
    emitToUser(foundUserId, 'withdrawal:approved', {
      transaction: updatedTxs.find((t) => t.id === txId),
    });
    emitAdmin('withdrawal:approved', {
      userId: foundUserId,
      amount: foundTx.amount,
      transactionId: txId,
      approvedBy: req.admin?.email,
    });

    audit(req, {
      action: 'withdrawal.approve',
      target: foundUserId,
      targetType: 'user',
      severity: 'info',
      meta: { amount: foundTx.amount, transactionId: txId },
    });
    res.json({ ok: true, transaction: updatedTxs.find((t) => t.id === txId) });
  }),
);

router.post(
  '/:id/reject',
  requireAdmin,
  requireRole('finance_admin'),
  validate(z.object({ reason: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => {
    const txId = req.params.id;
    const all = txStore.all() || {};
    let foundTx = null;
    let foundUserId = null;
    for (const [userId, txs] of Object.entries(all)) {
      for (const tx of txs) {
        if (tx.id === txId) {
          foundTx = tx;
          foundUserId = userId;
          break;
        }
      }
      if (foundTx) break;
    }
    if (!foundTx) throw notFound('Transaction not found');
    if (foundTx.kind !== 'withdraw' || foundTx.status !== 'pending') {
      throw badRequest('Transaction is not a pending withdrawal');
    }

    const user = getUserById(foundUserId);
    if (!user) throw notFound('User not found');

    // Reversing a rejected withdrawal means refunding the held amount —
    // deposits never touch balance until approved, but withdrawals hold
    // funds up front, so rejecting them has to give that money back.
    const refunded = Number((user.balance + foundTx.amount).toFixed(2));
    const updated = updateUser(foundUserId, { balance: refunded });

    const userTxs = txStore.get(foundUserId) || [];
    const updatedTxs = userTxs.map((t) =>
      t.id === txId
        ? {
            ...t,
            status: 'rejected',
            balanceAfter: updated.balance,
            rejectedAt: new Date().toISOString(),
            rejectedBy: req.admin?.email || req.admin?.id,
            rejectReason: req.body?.reason || null,
          }
        : t,
    );
    txStore.set(foundUserId, updatedTxs);

    logActivity(foundUserId, {
      kind: 'withdraw_rejected',
      amount: foundTx.amount,
      by: req.admin?.email,
      reason: req.body?.reason,
    });
    emitToUser(foundUserId, 'wallet:update', {
      balance: updated.balance,
      delta: foundTx.amount,
      reason: 'withdraw_rejected',
    });
    emitToUser(foundUserId, 'withdrawal:rejected', {
      transaction: updatedTxs.find((t) => t.id === txId),
      reason: req.body?.reason,
    });
    emitAdmin('withdrawal:rejected', {
      userId: foundUserId,
      amount: foundTx.amount,
      transactionId: txId,
      rejectedBy: req.admin?.email,
    });

    audit(req, {
      action: 'withdrawal.reject',
      target: foundUserId,
      targetType: 'user',
      severity: 'warning',
      meta: { amount: foundTx.amount, transactionId: txId, reason: req.body?.reason },
    });
    res.json({ ok: true, transaction: updatedTxs.find((t) => t.id === txId) });
  }),
);

export default router;
