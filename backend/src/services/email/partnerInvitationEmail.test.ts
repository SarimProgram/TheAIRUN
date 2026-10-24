import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPartnerInvitationEmailService,
  escapeHtml,
  InvitationEmailDeliveryError,
  renderPartnerInvitationEmail,
} from './partnerInvitationEmail';

const input = {
  invitationId: 'invite-123',
  toEmail: '  PERSON@Example.COM ',
  inviterDisplayName: 'Sam & <Taylor>',
  invitationCode: 'ABC12345',
};

test('renders escaped HTML and a plain-text alternative', () => {
  const rendered = renderPartnerInvitationEmail(input, 'https://example.com/app?x=1&y=2');

  assert.match(rendered.html, /Sam &amp; &lt;Taylor&gt;/);
  assert.match(rendered.html, /x=1&amp;y=2/);
  assert.doesNotMatch(rendered.html, /Sam & <Taylor>/);
  assert.match(rendered.text, /Sam & <Taylor>/);
  assert.match(rendered.text, /Invitation code: ABC12345/);
  assert.equal(escapeHtml(`'"&<>`), '&#039;&quot;&amp;&lt;&gt;');
});

test('does not contact the provider when disabled or incompletely configured', async () => {
  let calls = 0;
  const sender = {
    async send() {
      calls += 1;
      return { data: {}, error: null };
    },
  };

  const disabled = createPartnerInvitationEmailService(
    { enabled: false, apiKey: '', from: '', appStoreUrl: '' },
    sender
  );
  assert.deepEqual(await disabled.sendInvitation(input), { sent: false, reason: 'disabled' });

  const missing = createPartnerInvitationEmailService(
    { enabled: true, apiKey: 'key', from: '', appStoreUrl: 'https://example.com/app' },
    sender
  );
  assert.deepEqual(await missing.sendInvitation(input), {
    sent: false,
    reason: 'missing_configuration',
  });
  assert.equal(calls, 0);
});

test('normalizes recipients and uses invitation-ID idempotency', async () => {
  const calls: Array<{ payload: any; options: any }> = [];
  const sender = {
    async send(payload: any, options: any) {
      calls.push({ payload, options });
      return { data: { id: 'email-1' }, error: null };
    },
  };
  const service = createPartnerInvitationEmailService(
    {
      enabled: true,
      apiKey: 'secret-key',
      from: 'RunTogether <invites@example.com>',
      appStoreUrl: 'https://example.com/app',
    },
    sender
  );

  assert.deepEqual(await service.sendInvitation(input), { sent: true });
  assert.deepEqual(calls[0].payload.to, ['person@example.com']);
  assert.equal(calls[0].options.idempotencyKey, 'partner-invitation/invite-123');
  assert.equal(typeof calls[0].payload.html, 'string');
  assert.equal(typeof calls[0].payload.text, 'string');
});

test('replaces provider details with a sanitized delivery error', async () => {
  const sender = {
    async send() {
      return { data: null, error: { message: 'secret provider diagnostic' } };
    },
  };
  const service = createPartnerInvitationEmailService(
    {
      enabled: true,
      apiKey: 'secret-key',
      from: 'invites@example.com',
      appStoreUrl: 'https://example.com/app',
    },
    sender
  );

  await assert.rejects(
    service.sendInvitation(input),
    (error: unknown) =>
      error instanceof InvitationEmailDeliveryError &&
      error.status === 502 &&
      !error.message.includes('secret provider diagnostic')
  );
});
