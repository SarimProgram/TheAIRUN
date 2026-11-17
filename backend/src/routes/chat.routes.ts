import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { deliverPartnerChatMessage } from '../socket';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

/** Same as the `chat:send` socket event, for callers without a live socket. */
router.post('/messages', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { content } = sendMessageSchema.parse(req.body);
    const result = await deliverPartnerChatMessage(req.user.id, content);
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }

    return res.status(201).json({ message: result.message });
  } catch (err) {
    return next(err);
  }
});

export default router;
