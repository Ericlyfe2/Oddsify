import { Router } from 'express';
import { getPublicStats } from '../services/publicStats.js';

const router = Router();

/**
 * Public stats payload for the homepage StatsStrip. Cached 30s upstream.
 */
router.get('/public', (_req, res) => {
  res.json(getPublicStats());
});

export default router;
