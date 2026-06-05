/**
 * Admin observability for the external-API integration layer.
 */
import { Router } from 'express';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { providersHealth, listProviders, getProvider } from '../../services/providerRegistry.js';
import { aggregateOnce, getAggregatedOdds } from '../../services/oddsAggregator.js';
import { listApiLogs, summariseApiCalls } from '../../db/apiLogs.js';
import { realtimeStats } from '../../services/realtime.js';
import { stats as cacheStats } from '../../services/cache.js';

const router = Router();

router.get('/', requireAdmin, (_req, res) => {
  res.json({
    providers: providersHealth(),
    summary: summariseApiCalls(),
    realtime: realtimeStats(),
    cache: cacheStats(),
  });
});

router.get('/logs', requireAdmin, (req, res) => {
  const { provider, limit, since } = req.query;
  res.json({ logs: listApiLogs({ provider, limit: Number(limit) || 100, since }) });
});

router.get('/odds', requireAdmin, async (_req, res) => {
  res.json({ odds: await getAggregatedOdds() });
});

router.post('/refresh', requireAdmin, async (_req, res, next) => {
  try {
    const r = await aggregateOnce();
    res.json({ ok: true, ...r });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/test', requireAdmin, async (req, res, next) => {
  const p = getProvider(req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider not found' });
  try {
    const sample = await p.fetchOdds('football').catch(() => p.fetchFixtures('football').catch(() => []));
    res.json({ ok: true, count: sample?.length || 0, sample: sample?.slice(0, 3) || [], health: p.health() });
  } catch (e) {
    next(e);
  }
});

export default router;
