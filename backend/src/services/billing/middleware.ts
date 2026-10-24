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

const UNPAID_PARTNER_INVITATION_ROUTES = [
  { method: 'POST', pattern: /^\/invite\/?$/ },
  { method: 'GET', pattern: /^\/invites\/(?:pending|sent)\/?$/ },
  { method: 'POST', pattern: /^\/invites\/[^/]+\/(?:accept|decline)\/?$/ },
];

export function isUnpaidPartnerInvitationRoute(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  return UNPAID_PARTNER_INVITATION_ROUTES.some(
    (route) => route.method === normalizedMethod && route.pattern.test(path)
  );
}

export function requirePremiumForPartnerRoute() {
  const premiumRequired = requirePremiumAccess();
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (isUnpaidPartnerInvitationRoute(req.method, req.path)) {
      return next();
    }
    return premiumRequired(req, res, next);
  };
}
