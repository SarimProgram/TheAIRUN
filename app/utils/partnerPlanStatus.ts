import type { BillingAccessSnapshot } from '@/src/billing/types';

export type PartnerPlanSummary = {
  accessStatus: string;
  hasActivePlan: boolean;
  coversPartner: boolean;
};

export type PartnerPlanStatusMessage = {
  title: string;
  subtitle: string;
  tone: 'success' | 'info' | 'muted';
  skipPaywall: boolean;
};

function formatPartnerName(name?: string | null) {
  const trimmed = String(name || '').trim();
  return trimmed || 'Your partner';
}

export function getPartnerPlanStatusMessage(params: {
  partnerName?: string | null;
  selfAccess?: BillingAccessSnapshot | null;
  partnerPlan?: PartnerPlanSummary | null;
  hasLinkedPartner?: boolean;
}): PartnerPlanStatusMessage | null {
  const partnerName = formatPartnerName(params.partnerName);
  const selfAccess = params.selfAccess;
  const partnerPlan = params.partnerPlan;

  if (selfAccess?.accessSource === 'partner' && selfAccess.hasAccess) {
    const sharedBy = selfAccess.sharedByPartnerName || partnerName;
    if (selfAccess.accessStatus === 'PARTNER_INCLUDED_GRACE') {
      return {
        title: `${sharedBy} included you`,
        subtitle: 'Your shared access is in a grace period while you stay connected.',
        tone: 'info',
        skipPaywall: true,
      };
    }

    return {
      title: `${sharedBy} already purchased for you`,
      subtitle: 'Premium is included while you stay connected as partners.',
      tone: 'success',
      skipPaywall: true,
    };
  }

  if (!partnerPlan) return null;

  switch (partnerPlan.accessStatus) {
    case 'PREMIUM_ACTIVE':
    case 'PREMIUM_GRACE':
      return {
        title: `${partnerName} already has Premium`,
        subtitle: params.hasLinkedPartner
          ? 'You are covered — no paywall needed.'
          : 'Accept their invite to unlock shared access.',
        tone: 'success',
        skipPaywall: !!params.hasLinkedPartner,
      };
    case 'TRIAL_ACTIVE':
      return {
        title: `${partnerName} is on a free trial`,
        subtitle: params.hasLinkedPartner
          ? 'Their trial covers you while you are connected.'
          : 'Join them to share trial access together.',
        tone: 'info',
        skipPaywall: !!params.hasLinkedPartner,
      };
    case 'TRIAL_EXPIRED':
    case 'NONE':
      return {
        title: `${partnerName} has not started a plan yet`,
        subtitle: 'Start yours here and they will get access too.',
        tone: 'muted',
        skipPaywall: false,
      };
    default:
      if (partnerPlan.hasActivePlan) {
        return {
          title: `${partnerName} already has an active plan`,
          subtitle: params.hasLinkedPartner
            ? 'You are covered — no paywall needed.'
            : 'Connect with them to share access.',
          tone: 'success',
          skipPaywall: !!params.hasLinkedPartner,
        };
      }

      return {
        title: `${partnerName} has not started a plan yet`,
        subtitle: 'Start yours here and they will get access too.',
        tone: 'muted',
        skipPaywall: false,
      };
  }
}
