/**
 * Referral & Earn engine.
 *
 * Stores:
 *   referrals      — one record per referred user, keyed by referred userId.
 *                    Guarantees a user can only ever be referred (and
 *                    rewarded for) once: the key IS the dedup constraint.
 *   referralCodes  — code -> ownerUserId. Uniqueness + O(1) lookup.
 *   referralClicks — per-code click log (capped) for conversion analytics.
 *
 * Lifecycle of a referral record:
 *   pending   — referred user registered with a code, no qualifying deposit yet.
 *   flagged   — fraud heuristics tripped; admin must approve or reject.
 *   qualified — qualifying deposit approved; reward about to be paid (transient).
 *   rewarded  — referrer credited. rewardTxId recorded. Terminal.
 *   rejected  — blocked by fraud check or admin. Terminal (admin can approve flagged).
 *   reversed  — admin clawed the reward back. Terminal.
 *
 * Reward trigger: admin deposit approval (the only place money becomes real
 * on this platform) calls handleQualifyingDeposit(). Idempotent — a record
 * already past 'pending'/'flagged' is never re-rewarded.
 */
import { createStore } from '../db/store.js';
import { getUserById, updateUser, logActivity, allUsers } from '../db/users.js';
import { getSettings } from '../db/settings.js';
import { recordAudit } from '../db/audit.js';
import { emitToUser, emitAdmin } from '../services/realtime.js';
import { pushTx } from '../routes/wallet.js';
import { log } from '../utils/logger.js';

const referrals = createStore('referrals', {});
const referralCodes = createStore('referralCodes', {});
const referralClicks = createStore('referralClicks', {});

export const REFERRAL_CODE_RE = /^[A-Z0-9]{6,10}$/;

/* ------------------------------------------------------------------ *
 * Code generation
 * ------------------------------------------------------------------ */

function candidateCode(user, attempt) {
  const base = String(user.displayName || user.email || 'ODDS')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');
  const digits = attempt === 0 ? String(100 + Math.floor(Math.random() * 900)) : String(Math.floor(Math.random() * 10 ** 6)).padStart(6, '0');
  return (base + digits).slice(0, 10);
}

/** Assign a unique referral code to a user (no-op if they already have one). */
export function ensureReferralCode(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  if (user.referralCode) return user.referralCode;
  let code = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const c = candidateCode(user, attempt);
    if (!referralCodes.get(c)) {
      code = c;
      break;
    }
  }
  if (!code) {
    // Astronomically unlikely; fall back to a timestamp-salted code.
    code = `OD${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
  }
  referralCodes.set(code, userId);
  updateUser(userId, { referralCode: code });
  return code;
}

export const lookupCodeOwner = (code) => referralCodes.get(String(code || '').trim().toUpperCase()) || null;

/* ------------------------------------------------------------------ *
 * Click tracking
 * ------------------------------------------------------------------ */

export function recordClick(code, { ip, userAgent } = {}) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(normalized) || !referralCodes.get(normalized)) return false;
  const list = referralClicks.get(normalized) || [];
  referralClicks.set(
    normalized,
    [{ at: new Date().toISOString(), ip: ip || null, userAgent: (userAgent || '').slice(0, 200) }, ...list].slice(0, 500),
  );
  return true;
}

export const clickCount = (code) => (referralClicks.get(String(code || '').toUpperCase()) || []).length;

/* ------------------------------------------------------------------ *
 * Fraud heuristics
 * ------------------------------------------------------------------ */

function fraudCheck({ referrerId, referredUser, ip, deviceId }) {
  const reasons = [];
  if (referrerId === referredUser.id) reasons.push('self_referral');

  const referrer = getUserById(referrerId);
  if (!referrer || referrer.suspended) reasons.push('referrer_unavailable');

  // Same IP as the referrer's recent activity → likely the same person.
  if (ip && referrer) {
    const referrerIps = new Set((referrer.activity || []).map((a) => a.ip).filter(Boolean));
    if (referrerIps.has(ip)) reasons.push('shared_ip');
  }

  // Same device fingerprint already used by another referred account.
  if (deviceId) {
    const dupe = referrals.list().find((r) => r.deviceId && r.deviceId === deviceId);
    if (dupe) reasons.push('shared_device');
  }

  // Referral farming: too many signups for one referrer in 24h.
  const maxPerDay = Number(getSettings().referralMaxPerDay || 20);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = referrals.list().filter((r) => r.referrerId === referrerId && new Date(r.registeredAt).getTime() > dayAgo);
  if (recent.length >= maxPerDay) reasons.push('rate_limited');

  return reasons;
}

/* ------------------------------------------------------------------ *
 * Registration attach
 * ------------------------------------------------------------------ */

/**
 * Bind a freshly registered user to a referrer. Call once, right after
 * createUser(). Never throws — a bad code must not break registration.
 */
export function attachReferral(referredUser, rawCode, { ip, userAgent, deviceId } = {}) {
  try {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return null;
    if (!REFERRAL_CODE_RE.test(code)) return null;
    const referrerId = referralCodes.get(code);
    if (!referrerId) return null;
    if (referrals.get(referredUser.id)) return null; // already referred — keyed dedup

    const fraudReasons = fraudCheck({ referrerId, referredUser, ip, deviceId });
    const blocked = fraudReasons.includes('self_referral') || fraudReasons.includes('referrer_unavailable');
    const status = blocked ? 'rejected' : fraudReasons.length ? 'flagged' : 'pending';

    const record = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      referrerId,
      referredId: referredUser.id,
      referredName: referredUser.displayName || referredUser.email,
      registeredAt: new Date().toISOString(),
      verified: !!referredUser.emailVerified,
      verifiedAt: referredUser.emailVerified ? new Date().toISOString() : null,
      depositAt: null,
      depositAmount: null,
      status,
      fraudReasons,
      ip: ip || null,
      userAgent: (userAgent || '').slice(0, 200),
      deviceId: deviceId || null,
      rewardAmount: null,
      rewardTxId: null,
      rewardedAt: null,
      history: [{ at: new Date().toISOString(), event: 'registered', status }],
    };
    referrals.set(referredUser.id, record);
    updateUser(referredUser.id, { referredBy: referrerId, referredByCode: code });

    recordAudit({
      actorId: referredUser.id,
      action: 'referral.registered',
      target: referrerId,
      targetType: 'user',
      severity: fraudReasons.length ? 'warning' : 'info',
      ip,
      meta: { code, status, fraudReasons },
    });
    if (status !== 'rejected') {
      emitToUser(referrerId, 'referral:update', { kind: 'registered', status });
      emitToUser(referrerId, 'notification:new', {
        id: `referral-reg-${record.id}`,
        title: 'New referral signup',
        body: `${record.referredName} just joined with your code. They qualify once their first deposit of GHS ${getSettings().referralMinDeposit} is approved.`,
        severity: 'info',
        kind: 'referral_registered',
      });
    }
    emitAdmin('referral:registered', { referrerId, referredId: referredUser.id, status, fraudReasons });
    return record;
  } catch (e) {
    log.error('attachReferral failed:', e.message);
    return null;
  }
}

/** Keep the referral record's verification flag in sync. */
export function markReferralVerified(userId) {
  const r = referrals.get(userId);
  if (!r || r.verified) return;
  referrals.update(userId, (cur) => ({
    ...cur,
    verified: true,
    verifiedAt: new Date().toISOString(),
    history: [...(cur.history || []), { at: new Date().toISOString(), event: 'verified' }],
  }));
}

/* ------------------------------------------------------------------ *
 * Reward engine
 * ------------------------------------------------------------------ */

function payReferrer(record, { actor = 'system' } = {}) {
  const settings = getSettings();
  const amount = Number(record.rewardAmount ?? settings.referralBonus ?? 10);
  const referrer = getUserById(record.referrerId);
  if (!referrer) return null;

  const updated = updateUser(referrer.id, { balance: Number((referrer.balance + amount).toFixed(2)) });
  const tx = pushTx(referrer.id, {
    kind: 'referral_bonus',
    amount,
    method: 'referral',
    status: 'completed',
    balanceAfter: updated.balance,
    referredId: record.referredId,
  });

  referrals.update(record.referredId, (cur) => ({
    ...cur,
    status: 'rewarded',
    rewardAmount: amount,
    rewardTxId: tx.id,
    rewardedAt: new Date().toISOString(),
    history: [...(cur.history || []), { at: new Date().toISOString(), event: 'rewarded', amount, by: actor }],
  }));

  logActivity(referrer.id, { kind: 'referral_bonus', amount, referredId: record.referredId });
  recordAudit({
    actorId: actor === 'system' ? null : actor,
    action: 'referral.rewarded',
    target: referrer.id,
    targetType: 'user',
    meta: { amount, referredId: record.referredId, txId: tx.id },
  });

  emitToUser(referrer.id, 'wallet:update', { balance: updated.balance, delta: amount, reason: 'referral_bonus' });
  emitToUser(referrer.id, 'referral:rewarded', {
    amount,
    referredName: record.referredName,
    balance: updated.balance,
    txId: tx.id,
  });
  emitToUser(referrer.id, 'notification:new', {
    id: `referral-reward-${tx.id}`,
    title: 'Congratulations!',
    body: `You earned GHS ${amount.toFixed(2)} from your referral ${record.referredName}.`,
    severity: 'info',
    kind: 'referral_rewarded',
  });
  emitAdmin('referral:rewarded', { referrerId: referrer.id, referredId: record.referredId, amount, txId: tx.id });
  log.info(`referral reward: GHS ${amount} -> ${referrer.id} for ${record.referredId}`);
  return tx;
}

function payWelcomeBonus(referredId) {
  const settings = getSettings();
  const amount = Number(settings.referralWelcomeBonus || 0);
  if (amount <= 0) return null;
  const user = getUserById(referredId);
  if (!user) return null;
  const updated = updateUser(user.id, { balance: Number((user.balance + amount).toFixed(2)) });
  const tx = pushTx(user.id, {
    kind: 'referral_welcome_bonus',
    amount,
    method: 'referral',
    status: 'completed',
    balanceAfter: updated.balance,
  });
  emitToUser(user.id, 'wallet:update', { balance: updated.balance, delta: amount, reason: 'referral_welcome_bonus' });
  emitToUser(user.id, 'notification:new', {
    id: `referral-welcome-${tx.id}`,
    title: 'Welcome bonus!',
    body: `GHS ${amount.toFixed(2)} bonus credited for joining via a referral.`,
    severity: 'info',
    kind: 'referral_welcome',
  });
  return tx;
}

/**
 * Called whenever a deposit is APPROVED. If this user has a pending
 * referral and the deposit meets the qualifying minimum, reward the
 * referrer. Idempotent: only 'pending' records can transition here.
 * Flagged records record the deposit but wait for admin approval.
 */
export function handleQualifyingDeposit(userId, amount) {
  try {
    const record = referrals.get(userId);
    if (!record) return null;
    const settings = getSettings();
    const minDeposit = Number(settings.referralMinDeposit || 100);

    if (record.status !== 'pending' && record.status !== 'flagged') return null;
    if (Number(amount) < minDeposit) return null;

    referrals.update(userId, (cur) => ({
      ...cur,
      depositAt: new Date().toISOString(),
      depositAmount: Number(amount),
      verified: true,
      verifiedAt: cur.verifiedAt || new Date().toISOString(),
      ...(cur.status === 'pending' ? { status: 'qualified' } : {}),
      history: [...(cur.history || []), { at: new Date().toISOString(), event: 'qualifying_deposit', amount: Number(amount) }],
    }));

    const fresh = referrals.get(userId);
    if (fresh.status !== 'qualified') {
      // flagged — needs manual admin approval, deposit is recorded.
      emitAdmin('referral:needs_review', { referredId: userId, referrerId: fresh.referrerId, fraudReasons: fresh.fraudReasons });
      return null;
    }
    const tx = payReferrer(fresh);
    payWelcomeBonus(userId);
    return tx;
  } catch (e) {
    log.error('handleQualifyingDeposit failed:', e.message);
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Admin operations
 * ------------------------------------------------------------------ */

/** Admin approves a flagged referral (pays it if a qualifying deposit exists). */
export function adminApprove(referredId, adminId) {
  const record = referrals.get(referredId);
  if (!record) return { error: 'not_found' };
  if (record.status === 'rewarded') return { error: 'already_rewarded' };
  if (record.status === 'reversed') return { error: 'reversed' };

  if (record.depositAmount != null) {
    referrals.update(referredId, (cur) => ({
      ...cur,
      status: 'qualified',
      history: [...(cur.history || []), { at: new Date().toISOString(), event: 'admin_approved', by: adminId }],
    }));
    const tx = payReferrer(referrals.get(referredId), { actor: adminId });
    return { ok: true, rewarded: true, tx };
  }
  referrals.update(referredId, (cur) => ({
    ...cur,
    status: 'pending',
    fraudReasons: [],
    history: [...(cur.history || []), { at: new Date().toISOString(), event: 'admin_approved', by: adminId }],
  }));
  return { ok: true, rewarded: false };
}

export function adminReject(referredId, adminId, reason) {
  const record = referrals.get(referredId);
  if (!record) return { error: 'not_found' };
  if (record.status === 'rewarded') return { error: 'already_rewarded_use_reverse' };
  referrals.update(referredId, (cur) => ({
    ...cur,
    status: 'rejected',
    history: [...(cur.history || []), { at: new Date().toISOString(), event: 'admin_rejected', by: adminId, reason }],
  }));
  return { ok: true };
}

/** Claw back a paid reward (deducts from referrer wallet). */
export function adminReverse(referredId, adminId, reason) {
  const record = referrals.get(referredId);
  if (!record) return { error: 'not_found' };
  if (record.status !== 'rewarded') return { error: 'not_rewarded' };
  const referrer = getUserById(record.referrerId);
  const amount = Number(record.rewardAmount || 0);
  if (referrer && amount > 0) {
    const updated = updateUser(referrer.id, { balance: Number((referrer.balance - amount).toFixed(2)) });
    pushTx(referrer.id, {
      kind: 'referral_bonus_reversal',
      amount: -amount,
      method: 'referral',
      status: 'completed',
      balanceAfter: updated.balance,
      referredId,
    });
    emitToUser(referrer.id, 'wallet:update', { balance: updated.balance, delta: -amount, reason: 'referral_reversal' });
    emitToUser(referrer.id, 'notification:new', {
      id: `referral-reversal-${Date.now()}`,
      title: 'Referral bonus reversed',
      body: `A GHS ${amount.toFixed(2)} referral bonus was reversed${reason ? ': ' + reason : '.'}`,
      severity: 'critical',
      kind: 'referral_reversed',
    });
  }
  referrals.update(referredId, (cur) => ({
    ...cur,
    status: 'reversed',
    history: [...(cur.history || []), { at: new Date().toISOString(), event: 'admin_reversed', by: adminId, reason }],
  }));
  recordAudit({
    actorId: adminId,
    action: 'referral.reversed',
    target: record.referrerId,
    targetType: 'user',
    severity: 'warning',
    meta: { referredId, amount, reason },
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

function maskName(name = '') {
  const s = String(name);
  if (s.includes('@')) {
    const [local, domain] = s.split('@');
    return `${local.slice(0, 3)}***@${domain}`;
  }
  return s.length > 4 ? `${s.slice(0, 4)}***` : `${s}***`;
}

/** Everything the user's Refer & Earn dashboard needs. */
export function referralSummary(userId, origin = 'https://oddsify.com') {
  const code = ensureReferralCode(userId);
  const mine = referrals.list().filter((r) => r.referrerId === userId);
  const rewarded = mine.filter((r) => r.status === 'rewarded');
  const pending = mine.filter((r) => r.status === 'pending' || r.status === 'flagged');
  const qualified = mine.filter((r) => r.status === 'qualified' || r.status === 'rewarded');
  const totalEarned = rewarded.reduce((s, r) => s + Number(r.rewardAmount || 0), 0);
  const clicks = clickCount(code);
  const settings = getSettings();

  return {
    code,
    link: `${origin}/login?mode=register&ref=${code}`,
    rewardPerReferral: Number(settings.referralBonus || 10),
    minDeposit: Number(settings.referralMinDeposit || 100),
    stats: {
      clicks,
      total: mine.length,
      pending: pending.length,
      qualified: qualified.length,
      rewarded: rewarded.length,
      totalEarned: Number(totalEarned.toFixed(2)),
      conversionRate: mine.length ? Number(((rewarded.length / mine.length) * 100).toFixed(1)) : 0,
    },
    history: mine
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
      .slice(0, 100)
      .map((r) => ({
        id: r.id,
        name: maskName(r.referredName),
        registeredAt: r.registeredAt,
        verified: r.verified,
        deposited: r.depositAmount != null,
        status: r.status === 'flagged' ? 'pending' : r.status,
        rewardAmount: r.rewardAmount,
        rewardedAt: r.rewardedAt,
      })),
  };
}

/** Admin: full referral list with filters. */
export function adminList({ status, search } = {}) {
  let list = referrals.list();
  if (status) list = list.filter((r) => r.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (r) =>
        r.referredId.includes(q) ||
        r.referrerId.includes(q) ||
        (r.code || '').toLowerCase().includes(q) ||
        (r.referredName || '').toLowerCase().includes(q),
    );
  }
  return list.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
}

/** Admin analytics: volumes, conversion, payouts, top referrers. */
export function adminStats() {
  const list = referrals.list();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const within = (ms) => list.filter((r) => now - new Date(r.registeredAt).getTime() < ms).length;
  const rewarded = list.filter((r) => r.status === 'rewarded');
  const totalPaid = rewarded.reduce((s, r) => s + Number(r.rewardAmount || 0), 0);

  const byReferrer = new Map();
  for (const r of list) {
    const cur = byReferrer.get(r.referrerId) || { referrerId: r.referrerId, total: 0, rewarded: 0, earned: 0 };
    cur.total += 1;
    if (r.status === 'rewarded') {
      cur.rewarded += 1;
      cur.earned += Number(r.rewardAmount || 0);
    }
    byReferrer.set(r.referrerId, cur);
  }
  const topReferrers = [...byReferrer.values()]
    .sort((a, b) => b.earned - a.earned || b.total - a.total)
    .slice(0, 10)
    .map((t) => {
      const u = getUserById(t.referrerId);
      return { ...t, name: u?.displayName || t.referrerId, earned: Number(t.earned.toFixed(2)) };
    });

  return {
    total: list.length,
    daily: within(day),
    weekly: within(7 * day),
    monthly: within(30 * day),
    pending: list.filter((r) => r.status === 'pending').length,
    flagged: list.filter((r) => r.status === 'flagged').length,
    rewarded: rewarded.length,
    rejected: list.filter((r) => r.status === 'rejected' || r.status === 'reversed').length,
    conversionRate: list.length ? Number(((rewarded.length / list.length) * 100).toFixed(1)) : 0,
    totalPaid: Number(totalPaid.toFixed(2)),
    usersWithCodes: allUsers().filter((u) => u.referralCode).length,
    topReferrers,
  };
}
