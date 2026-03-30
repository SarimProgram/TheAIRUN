import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { env } from '../../config/env';
import { BillingError, getBillingAccessForUser } from './service';

export function requirePremiumAccess() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!env.PAYWALL_ENABLED) return next();
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

      const { billing } = await getBillingAccessForUser(req.user.id);
      if (billing.hasAccess) return next();

      return res.status(403).json({
        code: 'PREMIUM_REQUIRED',
        message: 'Premium access required',
        billing,
        paywallReason: billing.paywallReason ?? 'trial_not_started',
      });
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
  };
}

