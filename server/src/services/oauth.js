import { OAuth2Client } from 'google-auth-library';
import { GOOGLE } from '../config/env.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import { log } from '../utils/logger.js';

const client = GOOGLE.enabled ? new OAuth2Client(GOOGLE.clientId) : null;

export async function verifyGoogleIdToken(idToken) {
  if (!client) throw badRequest('Google sign-in is not configured on this server.');
  if (!idToken || typeof idToken !== 'string') throw badRequest('Missing Google credential.');
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE.clientId });
    const payload = ticket.getPayload();
    if (!payload) throw unauthorized('Invalid Google credential.');
    if (!payload.email)            throw unauthorized('Google account has no email.');
    if (!payload.email_verified)   throw unauthorized('Google account email is not verified.');
    if (payload.aud !== GOOGLE.clientId) throw unauthorized('Credential audience mismatch.');
    return {
      email:         payload.email.toLowerCase(),
      displayName:   payload.name || payload.given_name || payload.email,
      googleId:      payload.sub,
      picture:       payload.picture || null,
      emailVerified: true,
    };
  } catch (e) {
    if (e.status) throw e;
    log.error('Google verifyIdToken failed:', e?.message || e);
    throw unauthorized('Could not verify Google credential — please try again.');
  }
}
