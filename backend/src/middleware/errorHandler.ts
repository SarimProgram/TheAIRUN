import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// Central error handler to keep responses consistent
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      issues: err.issues,
    });
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  const status = (err as any)?.status || 500;

  return res.status(status).json({ message });
}

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({ message: 'Not Found' });
}
