import { Resend } from 'resend';
import { env } from '../../config/env';

export type InvitationEmailInput = {
  invitationId: string;
  toEmail: string;
  inviterDisplayName: string;
  invitationCode: string;
};

type EmailSender = {
  send: (
    payload: { from: string; to: string[]; subject: string; html: string; text: string },
    options: { idempotencyKey: string }
  ) => Promise<{ data: unknown; error: unknown | null }>;
};

export type InvitationEmailConfig = {
  enabled: boolean;
  apiKey: string;
  from: string;
  appStoreUrl: string;
};

export type InvitationEmailResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'missing_configuration' };

export class InvitationEmailDeliveryError extends Error {
  readonly code = 'EMAIL_PROVIDER_ERROR';
  readonly status = 502;

  constructor() {
    super('Invitation email could not be delivered');
    this.name = 'InvitationEmailDeliveryError';
  }
}

export function normalizeRecipientEmail(email: string) {
  return email.trim().toLowerCase();
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}

export function renderPartnerInvitationEmail(input: InvitationEmailInput, appStoreUrl: string) {
  const inviterName = input.inviterDisplayName.trim() || 'A friend';
  const safeInviterName = escapeHtml(inviterName);
  const safeInvitationCode = escapeHtml(input.invitationCode);
  const safeAppStoreUrl = escapeHtml(appStoreUrl);
  const subject = `${inviterName} invited you to RunTogether`;

  return {
    subject,
    text: [
      `${inviterName} invited you to join them on RunTogether.`,
      '',
      `Invitation code: ${input.invitationCode}`,
      '',
      `Download RunTogether: ${appStoreUrl}`,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 6px 24px rgba(23,32,51,.08)">
        <h1 style="font-size:24px;margin:0 0 16px">You have a RunTogether invitation</h1>
        <p style="font-size:16px;line-height:1.5;margin:0 0 24px"><strong>${safeInviterName}</strong> invited you to join their fitness journey.</p>
        <div style="background:#f0f4ff;border-radius:12px;padding:18px;text-align:center;margin-bottom:24px">
          <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#59657a">Invitation code</div>
          <div style="font-size:28px;font-weight:700;letter-spacing:.12em;margin-top:8px">${safeInvitationCode}</div>
        </div>
        <a href="${safeAppStoreUrl}" style="display:inline-block;background:#315efb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;padding:14px 20px">Download RunTogether</a>
        <p style="font-size:13px;line-height:1.5;color:#6a7487;margin:24px 0 0">Sign in with this email address, then open your pending partner invitations to accept or decline.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

function configFromEnvironment(): InvitationEmailConfig {
  return {
    enabled: env.EMAIL_INVITES_ENABLED,
    apiKey: env.RESEND_API_KEY.trim(),
    from: env.EMAIL_FROM.trim(),
    appStoreUrl: env.APP_STORE_URL.trim(),
  };
}

function createResendSender(apiKey: string): EmailSender {
  const resend = new Resend(apiKey);
  return {
    send: (payload, options) => resend.emails.send(payload, options),
  };
}

export function createPartnerInvitationEmailService(
  config: InvitationEmailConfig,
  sender?: EmailSender
) {
  return {
    async sendInvitation(input: InvitationEmailInput): Promise<InvitationEmailResult> {
      if (!config.enabled) {
        return { sent: false, reason: 'disabled' };
      }

      if (!config.apiKey.trim() || !config.from.trim() || !config.appStoreUrl.trim()) {
        return { sent: false, reason: 'missing_configuration' };
      }

      const recipient = normalizeRecipientEmail(input.toEmail);
      const content = renderPartnerInvitationEmail(input, config.appStoreUrl.trim());
      const emailSender = sender ?? createResendSender(config.apiKey.trim());

      try {
        const result = await emailSender.send(
          {
            from: config.from.trim(),
            to: [recipient],
            subject: content.subject,
            html: content.html,
            text: content.text,
          },
          { idempotencyKey: `partner-invitation/${input.invitationId}` }
        );

        if (result.error) {
          throw new InvitationEmailDeliveryError();
        }

        return { sent: true };
      } catch {
        throw new InvitationEmailDeliveryError();
      }
    },
  };
}

export const partnerInvitationEmailService = createPartnerInvitationEmailService(
  configFromEnvironment()
);
