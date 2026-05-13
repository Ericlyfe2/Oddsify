import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = process.env;

export const isProd = env.NODE_ENV === 'production';

export const PORT = Number(env.PORT) || 4000;

export const JWT = {
  secret:    env.JWT_SECRET || 'dev-only-secret-change-me',
  accessTtl: env.JWT_ACCESS_TTL  || '15m',
  refreshTtl:env.JWT_REFRESH_TTL || '30d',
  issuer:    'xenbet',
};

export const SMTP = {
  host: env.SMTP_HOST || '',
  port: Number(env.SMTP_PORT) || 587,
  secure: env.SMTP_SECURE === 'true',
  user: env.SMTP_USER || '',
  pass: env.SMTP_PASS || '',
  from: env.SMTP_FROM || 'Xenbet <no-reply@xenbet.gh>',
  enabled: !!env.SMTP_HOST,
};

export const GOOGLE = {
  clientId:     env.GOOGLE_CLIENT_ID     || '',
  clientSecret: env.GOOGLE_CLIENT_SECRET || '',
  enabled: !!env.GOOGLE_CLIENT_ID,
};

export const RATE_LIMITS = {
  loginMax: Number(env.RATE_LIMIT_LOGIN_MAX) || 5,
  otpMax:   Number(env.RATE_LIMIT_OTP_MAX)   || 3,
};

export const ODDS_API_KEY = env.ODDS_API_KEY || '';

// Comma-separated list of allowed origins for CORS in production.
// Example: "https://stakepoint-client.vercel.app,https://www.example.com"
// In development, localhost is always allowed.
export const CORS_ORIGINS = (env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const PATHS = {
  root: path.resolve(__dirname, '../..'),
  data: path.resolve(__dirname, '../../data'),
  clientDist: path.resolve(__dirname, '../../../client/dist'),
};

if (!isProd && JWT.secret === 'dev-only-secret-change-me') {
  console.warn('[env] JWT_SECRET not set — using dev default. Override in .env for production.');
}
if (!SMTP.enabled) {
  console.warn('[env] SMTP not configured — OTP emails will print to the server console.');
}
if (!GOOGLE.enabled) {
  console.warn('[env] GOOGLE_CLIENT_ID not set — Google sign-in is disabled until you provide one.');
}
