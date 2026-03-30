import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  BillingError,
  applyRevenueCatWebhook,
  getBillingAccessForUser,
  getOrCreateBillingProfile,
  getPaywallProductsConfig,
  startTrial,
  syncFromRevenueCat,
  validateRevenueCatWebhookSecret,
} from '../services/billing';

const router = Router();

router.post('/webhooks/revenuecat', async (req, res, next) => {
  try {
    if (!validateRevenueCatWebhookSecret(req.headers as Record<string, unknown>)) {
      return res.status(401).json({ message: 'Unauthorized webhook' });
    }

    const result = await applyRevenueCatWebhook(req.body);
    return res.status(result.duplicate ? 200 : 202).json(result);
  } catch (err) {
    return next(err);
  }
});

router.use(authMiddleware);

router.get('/access', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { billing } = await getBillingAccessForUser(req.user.id);
    return res.json({ billing, products: getPaywallProductsConfig() });
  } catch (err) {
    return next(err);
  }
});

router.post('/trial/start', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const profile = await getOrCreateBillingProfile(req.user.id);
    const updated = await startTrial(profile);
    const { billing } = await getBillingAccessForUser(req.user.id);
    return res.json({ success: true, billing, trialStartedAt: updated.trialStartedAt, trialEndsAt: updated.trialEndsAt });
  } catch (err) {
    if (err instanceof BillingError) {
      return res.status(err.status).json({
        code: err.code,
        message: err.message,
        paywallReason: err.paywallReason ?? null,
      });
    }
    return next(err);
  }
});

router.post('/refresh', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const { billing } = await syncFromRevenueCat(req.user.id);
    return res.json({ success: true, billing });
  } catch (err) {
    if (err instanceof BillingError) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    return next(err);
  }
});

router.get('/products', async (_req: AuthRequest, res) => {
  return res.json(getPaywallProductsConfig());
});

export default router;

