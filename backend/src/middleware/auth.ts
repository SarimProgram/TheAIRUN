import { NextFunction, Request, Response } from 'express';
import { tokenService } from '../lib/tokens';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.replace('Bearer ', '');
  try {
    const payload = tokenService.verify(token);
    if (payload.tokenType !== 'access') {
      return res.status(401).json({ message: 'Invalid token type' });
    }
    req.user = { id: payload.userId, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
