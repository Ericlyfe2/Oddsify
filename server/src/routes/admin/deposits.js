import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { getUserById, updateUser, logActivity } from '../../db/users.js';
import { createStore } from '../../db/store.js';
import { emitToUser, emitAdmin } from '../../services/realtime.js';
import { handleQualifyingDeposit } from '../../services/referrals.js';

const txStore = createStore('transactions', {});
const router = Router();

router.get('/pending', requireAdmin, requireRole('finance_admin'), (req, res) => {
  const all = txStore.all() || {};
  const pending = [];
  for (const [userId, txs] of Object.entries(all)) {
    for (const tx of txs) {
      if (tx.kind === 'deposit' && tx.status === 'pending') {
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
    if (foundTx.kind !== 'deposit' || foundTx.status !== 'pending') {
      throw badRequest('Transaction is not a pending deposit');
    }

    const user = getUserById(foundUserId);
    if (!user) throw notFound('User not found');

    const amount = foundTx.amount;
    const prevTotal = Number(user.totalDeposited || 0);
    const newTotal = Number((prevTotal + amount).toFixed(2));
    const patch = {
      balance: Number((user.balance + amount).toFixed(2)),
      totalDeposited: newTotal,
    };

    // Verification and stage promotions are FULLY manual. A deposit never
    // changes a user's verification/stage state — the admin alone decides
    // when a user moves to "In review" (Stage 2) or is verified, via
    // PATCH /api/admin/users/:id/stage and the verify actions.
    const updated = updateUser(foundUserId, patch);

    const userTxs = txStore.get(foundUserId) || [];
    const updatedTxs = userTxs.map((t) =>
      t.id === txId
        ? {
            ...t,
            status: 'completed',
            balanceAfter: updated.balance,
            approvedAt: new Date().toISOString(),
            approvedBy: req.admin?.email || req.admin?.id,
          }
        : t,
    );
    txStore.set(foundUserId, updatedTxs);

    logActivity(foundUserId, { kind: 'deposit_approved', amount, by: req.admin?.email });
    // Referral qualifying-deposit hook — idempotent, never throws.
    handleQualifyingDeposit(foundUserId, amount);
    emitToUser(foundUserId, 'deposit:approved', {
      transaction: updatedTxs.find((t) => t.id === txId),
      account: { ...updated, passwordHash: undefined, googleId: undefined, activity: undefined },
    });
    emitAdmin('deposit:approved', { userId: foundUserId, amount, transactionId: txId, approvedBy: req.admin?.email });

    audit(req, {
      action: 'deposit.approve',
      target: foundUserId,
      targetType: 'user',
      severity: 'info',
      meta: { amount, transactionId: txId },
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
    if (foundTx.kind !== 'deposit' || foundTx.status !== 'pending') {
      throw badRequest('Transaction is not a pending deposit');
    }

    const userTxs = txStore.get(foundUserId) || [];
    const updatedTxs = userTxs.map((t) =>
      t.id === txId
        ? {
            ...t,
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: req.admin?.email || req.admin?.id,
            rejectReason: req.body?.reason || null,
          }
        : t,
    );
    txStore.set(foundUserId, updatedTxs);

    logActivity(foundUserId, {
      kind: 'deposit_rejected',
      amount: foundTx.amount,
      by: req.admin?.email,
      reason: req.body?.reason,
    });
    emitToUser(foundUserId, 'deposit:rejected', {
      transaction: updatedTxs.find((t) => t.id === txId),
      reason: req.body?.reason,
    });
    emitAdmin('deposit:rejected', {
      userId: foundUserId,
      amount: foundTx.amount,
      transactionId: txId,
      rejectedBy: req.admin?.email,
    });

    audit(req, {
      action: 'deposit.reject',
      target: foundUserId,
      targetType: 'user',
      severity: 'warning',
      meta: { amount: foundTx.amount, transactionId: txId, reason: req.body?.reason },
    });
    res.json({ ok: true });
  }),
);

export default router;
