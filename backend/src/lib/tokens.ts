import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type TokenType = 'access' | 'refresh';

export interface TokenPayload {
  userId: string;
  email: string;
  tokenType: TokenType;
}

const ACCESS_EXPIRES_IN = '365d';
const REFRESH_EXPIRES_IN = '365d';

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: payload.tokenType === 'access' ? ACCESS_EXPIRES_IN : REFRESH_EXPIRES_IN,
  });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token');
  }
  return decoded as TokenPayload;
}

export const tokenService = {
  signAccessToken(user: { id: string; email: string }) {
    return signToken({ userId: user.id, email: user.email, tokenType: 'access' });
  },
  signRefreshToken(user: { id: string; email: string }) {
    return signToken({ userId: user.id, email: user.email, tokenType: 'refresh' });
  },
  verify: verifyToken,
};
