import bcrypt from 'bcrypt';
import { createPublicKey } from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db/prisma';
import { tokenService } from '../lib/tokens';
import { env } from '../config/env';
import { presentUser } from './presenters';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const socialAuthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(20),
  name: z.string().trim().min(1).max(120).optional(),
});

type SocialIdentity = {
  provider: 'google' | 'apple';
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
};

const parseCsv = (value?: string) =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

async function verifyGoogleIdToken(idToken: string): Promise<SocialIdentity> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json().catch(() => ({} as any));

  if (!res.ok || data.error_description || !data.sub) {
    throw new Error(data.error_description || 'Invalid Google token');
  }

  const iss = String(data.iss || '');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(iss)) {
    throw new Error('Invalid Google token issuer');
  }

  const allowedClientIds = parseCsv(env.GOOGLE_OAUTH_CLIENT_IDS);
  if (allowedClientIds.length > 0 && !allowedClientIds.includes(String(data.aud || ''))) {
    throw new Error('Google token audience mismatch');
  }

  if (String(data.email_verified || '').toLowerCase() !== 'true') {
    throw new Error('Google email is not verified');
  }

  const email = String(data.email || '').toLowerCase().trim();
  if (!email) throw new Error('Google token missing email');

  return {
    provider: 'google',
    subject: String(data.sub),
    email,
    emailVerified: true,
    displayName: typeof data.name === 'string' ? data.name : undefined,
  };
}

async function fetchAppleJwks() {
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) {
    throw new Error('Failed to fetch Apple public keys');
  }
  const data = await res.json();
  if (!Array.isArray(data?.keys)) {
    throw new Error('Invalid Apple keyset');
  }
  return data.keys as Array<Record<string, any>>;
}

async function verifyAppleIdToken(idToken: string): Promise<SocialIdentity> {
  const decoded = jwt.decode(idToken, { complete: true }) as any;
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;
  if (!kid || alg !== 'RS256') {
    throw new Error('Invalid Apple token header');
  }

  const appleAudiences = parseCsv(env.APPLE_OAUTH_AUDIENCES);
  if (appleAudiences.length === 0) {
    throw new Error('Apple auth is not configured on backend');
  }

  const keys = await fetchAppleJwks();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    throw new Error('Apple signing key not found');
  }

  const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
  const audience = appleAudiences.length === 1 ? appleAudiences[0] : (appleAudiences as [string, ...string[]]);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience,
  }) as any;

  const email = String(payload?.email || '').toLowerCase().trim();

  // Apple only returns the email claim on the first sign-in (or after user revokes access).
  // On subsequent sign-ins the token may omit email/email_verified entirely, which is expected.
  // Only reject when Apple explicitly says email_verified is false.
  const emailVerifiedClaim = payload?.email_verified;
  const emailVerifiedExplicitlyFalse =
    emailVerifiedClaim === false ||
    String(emailVerifiedClaim ?? '').toLowerCase() === 'false';

  if (email && emailVerifiedExplicitlyFalse) {
    throw new Error('Apple email is not verified');
  }

  const emailVerified =
    emailVerifiedClaim === true ||
    String(emailVerifiedClaim ?? '').toLowerCase() === 'true';

  return {
    provider: 'apple',
    subject: String(payload.sub),
    email: email || undefined,
    emailVerified: emailVerified || !email,
  };
}

async function verifySocialIdToken(provider: 'google' | 'apple', idToken: string) {
  if (provider === 'google') {
    return verifyGoogleIdToken(idToken);
  }
  return verifyAppleIdToken(idToken);
}

function buildDisplayName(email: string | undefined, providedName?: string, tokenName?: string) {
  const candidate = (providedName || tokenName || '').trim();
  if (candidate) return candidate;
  return (email || '').split('@')[0] || 'User';
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: name,
      },
    });

    const accessToken = tokenService.signAccessToken(user);
    const refreshToken = tokenService.signRefreshToken(user);

    return res.status(201).json({ user: presentUser(user), accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await (prisma as any).user.findUnique({
      where: { email },
      include: { billingProfile: true },
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'This account uses social sign-in. Continue with Google or Apple.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = tokenService.signAccessToken(user);
    const refreshToken = tokenService.signRefreshToken(user);

    return res.json({ user: presentUser(user), accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
});

router.post('/social', async (req, res, next) => {
  try {
    const { provider, idToken, name } = socialAuthSchema.parse(req.body);

    const identity = await verifySocialIdToken(provider, idToken);
    const subjectField = provider === 'google' ? 'googleSub' : 'appleSub';

    let user = await (prisma as any).user.findFirst({
      where: { [subjectField]: identity.subject },
      include: { billingProfile: true },
    });

    if (!user) {
      if (identity.email) {
        user = await (prisma as any).user.findUnique({
          where: { email: identity.email },
          include: { billingProfile: true },
        });
      }
    }

    const displayName = buildDisplayName(identity.email, name, identity.displayName);

    if (!user) {
      if (!identity.email) {
        return res.status(400).json({
          message: 'Apple did not return an email for this sign-in. Use the same Apple account you originally used or reset Apple authorization for this app.',
        });
      }

      user = await (prisma as any).user.create({
        data: {
          email: identity.email,
          displayName,
          passwordHash: null,
          [subjectField]: identity.subject,
        },
        include: { billingProfile: true },
      });
    } else {
      const updates: Record<string, any> = {};
      if (!user[subjectField]) updates[subjectField] = identity.subject;
      if (!user.displayName && displayName) updates.displayName = displayName;

      if (Object.keys(updates).length > 0) {
        user = await (prisma as any).user.update({
          where: { id: user.id },
          data: updates,
          include: { billingProfile: true },
        });
      }
    }

    const accessToken = tokenService.signAccessToken(user);
    const refreshToken = tokenService.signRefreshToken(user);

    return res.json({ user: presentUser(user), accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const payload = tokenService.verify(refreshToken);
    if (payload.tokenType !== 'refresh') {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    const user = await (prisma as any).user.findUnique({
      where: { id: payload.userId },
      include: { billingProfile: true },
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid user' });
    }

    const newAccess = tokenService.signAccessToken(user);
    const newRefresh = tokenService.signRefreshToken(user);

    return res.json({
      user: presentUser(user),
      accessToken: newAccess,
      refreshToken: newRefresh,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
