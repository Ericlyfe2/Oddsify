/**
 * One-time-password service. Stores hashed codes only.
 * - 10-minute TTL
 * - 60-second resend cooldown
 * - Max 5 verify attempts per code
 * - Purposes: register, reset, login
 */
import crypto from 'crypto';
import { createStore } from '../db/store.js';
import { sendOtp } from './email.js';
import { badRequest, tooMany } from '../utils/httpError.js';

const otpStore = createStore('otps', {});

const TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function key(email, purpose) {
  return `${purpose}:${email.toLowerCase()}`;
}
function hash(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}
function generate() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export async function issueOtp(email, purpose) {
  const k = key(email, purpose);
  const existing = otpStore.get(k);
  if (existing && Date.now() - existing.lastSentAt < RESEND_MS) {
    const wait = Math.ceil((RESEND_MS - (Date.now() - existing.lastSentAt)) / 1000);
    throw tooMany(`Please wait ${wait}s before requesting another code.`, { resendInSeconds: wait });
  }
  const code = generate();
  const record = {
    purpose,
    email: email.toLowerCase(),
    codeHash: hash(code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
    createdAt: existing?.createdAt || Date.now(),
    lastSentAt: Date.now(),
  };
  otpStore.set(k, record);
  await sendOtp(email, code, purpose);
  return { sent: true, expiresIn: Math.floor(TTL_MS / 1000) };
}

/** Verify but DO NOT delete — caller decides when to consume. */
export function checkOtp(email, purpose, code) {
  const k = key(email, purpose);
  const record = otpStore.get(k);
  if (!record) throw badRequest('No active code. Request a new one.');
  if (record.expiresAt < Date.now()) {
    otpStore.delete(k);
    throw badRequest('Code expired. Request a new one.');
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(k);
    throw tooMany('Too many wrong attempts. Request a new code.');
  }
  if (record.codeHash !== hash(code)) {
    otpStore.update(k, (r) => ({ ...r, attempts: (r.attempts || 0) + 1 }));
    throw badRequest('Incorrect code.');
  }
  return record;
}

export function consumeOtp(email, purpose) {
  otpStore.delete(key(email, purpose));
}

export function hasPending(email, purpose) {
  const r = otpStore.get(key(email, purpose));
  if (!r) return false;
  if (r.expiresAt < Date.now()) {
    otpStore.delete(key(email, purpose));
    return false;
  }
  return true;
}
