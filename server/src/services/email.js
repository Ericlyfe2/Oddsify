import nodemailer from 'nodemailer';
import { SMTP } from '../config/env.js';
import { log } from '../utils/logger.js';

let transporter = null;

if (SMTP.enabled) {
  transporter = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.secure,
    auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass } : undefined,
  });
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    // Dev fallback — print so OTPs are visible during development.
    log.info(`[email-dev] To: ${to}\n  Subject: ${subject}\n  Body: ${text}`);
    return { dev: true };
  }
  const info = await transporter.sendMail({ from: SMTP.from, to, subject, text, html });
  log.info(`[email] sent ${info.messageId} -> ${to}`);
  return info;
}

export async function sendOtp(to, code, purpose = 'verify') {
  const subjectMap = {
    verify: 'Your BetNexa verification code',
    reset: 'Reset your BetNexa password',
    login: 'BetNexa login verification',
  };
  const subject = subjectMap[purpose] || 'Your BetNexa code';
  const text = `Your BetNexa code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  // Colors are hardcoded rather than CSS variables — email clients strip
  // <style> blocks and external stylesheets, so the BetNexa green/white
  // palette has to be inlined per element to render consistently.
  const html = `<div style="font-family:system-ui,sans-serif;background:#f7faf7;padding:24px">
    <h2 style="color:#15803d;margin:0 0 12px">BetNexa</h2>
    <p style="color:#172117">Your one-time code is:</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px;background:#eaf8e8;color:#15803d;padding:16px 24px;border-radius:12px;display:inline-block">${code}</p>
    <p style="color:#657365;font-size:13px;margin-top:16px">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
  </div>`;
  return sendMail({ to, subject, text, html });
}
