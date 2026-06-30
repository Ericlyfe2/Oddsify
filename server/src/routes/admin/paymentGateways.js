import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRole, audit } from '../../middleware/adminAuth.js';
import { validate } from '../../middleware/validate.js';
import { getPaymentGateways, updatePaymentGateway } from '../../db/paymentGateways.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const gatewaySchema = z.object({
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  maintenanceNote: z.string().max(500).optional(),
});

router.get('/', requireAdmin, (_req, res) => {
  res.json({ gateways: getPaymentGateways() });
});

router.put(
  '/:key',
  requireAdmin,
  requireRole(),
  validate(gatewaySchema),
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const validKeys = ['paystack', 'paybill'];
    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: `Invalid gateway key. Supported: ${validKeys.join(', ')}` });
    }
    const updated = updatePaymentGateway(key, req.body);
    audit(req, { action: 'payment_gateway.update', target: key, meta: req.body });
    res.json({ ok: true, gateways: updated });
  }),
);

export default router;
