import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { notFound, conflict } from '../../utils/httpError.js';
import * as Markets from '../../db/markets.js';
import { getTemplateByKey } from '../../db/marketTemplates.js';
import { bridgeMarketStatusChanged, bridgeSelectionPriceChanged } from '../../services/catalogBridge.js';

const router = Router();

router.get('/:matchId', requireAdmin, (req, res) => {
  const markets = Markets.listMarkets(req.params.matchId);
  const result = markets.map((m) => ({
    ...m,
    selections: Markets.listSelections(m.id),
  }));
  res.json({ total: markets.length, markets: result });
});

router.get('/:matchId/:marketId', requireAdmin, (req, res) => {
  const m = Markets.getMarket(req.params.marketId);
  if (!m || m.matchId !== req.params.matchId) throw notFound('Market not found');
  const selections = Markets.listSelections(req.params.marketId);
  res.json({ market: m, selections });
});

const createMarketSchema = z.object({
  templateKey: z.string().min(1),
  marginPct: z.number().min(0).max(1).optional(),
});

router.post('/:matchId', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(createMarketSchema), (req, res) => {
  const template = getTemplateByKey(req.body.templateKey);
  if (!template) throw notFound('Market template not found');

  const existing = Markets.findMarket(req.params.matchId, template.key);
  if (existing) throw conflict('Market already exists for this match');

  const market = Markets.createMarket(req.params.matchId, template, { marginPct: req.body.marginPct });
  const selections = Markets.autoAttachSelections(market.id, template);

  audit(req, { action: 'market.create', target: market.id, targetType: 'market', meta: { matchId: req.params.matchId } });
  res.status(201).json({ market, selections });
});

const patchMarketSchema = z.object({
  status: z.enum(['open', 'suspended', 'disabled']).optional(),
  marginPct: z.number().min(0).max(1).optional(),
});

router.patch('/:matchId/:marketId', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(patchMarketSchema), (req, res) => {
  const m = Markets.updateMarket(req.params.marketId, req.body);
  if (!m) throw notFound('Market not found');
  audit(req, { action: 'market.update', target: req.params.marketId, targetType: 'market' });
  if (req.body.status) bridgeMarketStatusChanged(req.params.matchId, m);
  res.json({ market: m });
});

const priceUpdateSchema = z.object({
  price: z.number().positive(),
});

router.patch('/:matchId/:marketId/selections/:selId', requireAdmin, requireRole('odds_manager', 'super_admin'), validate(priceUpdateSchema), (req, res) => {
  const s = Markets.updateSelection(req.params.selId, { price: req.body.price });
  if (!s) throw notFound('Selection not found');
  const market = Markets.getMarket(req.params.marketId);
  audit(req, { action: 'selection.price.update', target: req.params.selId, targetType: 'selection' });
  bridgeSelectionPriceChanged(req.params.matchId, market, s);
  res.json({ selection: s });
});

export default router;
