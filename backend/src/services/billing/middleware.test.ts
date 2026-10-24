import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnpaidPartnerInvitationRoute } from './middleware';

test('allows authenticated unpaid users only through invitation routes', () => {
  assert.equal(isUnpaidPartnerInvitationRoute('GET', '/invites/pending'), true);
  assert.equal(isUnpaidPartnerInvitationRoute('GET', '/invites/sent/'), true);
  assert.equal(isUnpaidPartnerInvitationRoute('POST', '/invites/abc/accept'), true);
  assert.equal(isUnpaidPartnerInvitationRoute('POST', '/invites/abc/decline/'), true);

  assert.equal(isUnpaidPartnerInvitationRoute('POST', '/invite'), true);
  assert.equal(isUnpaidPartnerInvitationRoute('POST', '/invite/'), true);
  assert.equal(isUnpaidPartnerInvitationRoute('DELETE', '/invites/abc'), false);
  assert.equal(isUnpaidPartnerInvitationRoute('GET', '/'), false);
  assert.equal(isUnpaidPartnerInvitationRoute('POST', '/disconnect'), false);
});
