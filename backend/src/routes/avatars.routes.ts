import { Router } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth';
import { AvatarError, generateAvatar } from '../services/avatarGeneration';

const input = z.object({
    photo: z.string().max(900_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    accent: z.enum(['teal', 'coral']),
});

export function createAvatarRouter(generate = generateAvatar, now = Date.now) {
    const router = Router();
    const usage = new Map<string, { started: number; count: number; busy: boolean }>();
    router.post('/generate', async (req, res) => {
        const userId = (req as AuthRequest).user?.id;
        if (!userId) return res.status(401).json({ message: 'Please sign in to make your character.' });
        const parsed = input.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: 'Choose a photo before making your character.' });
        const time = now();
        for (const [id, row] of usage) if (!row.busy && time - row.started >= 3_600_000) usage.delete(id);
        const row = usage.get(userId) ?? { started: time, count: 0, busy: false };
        if (row.busy) return res.status(409).json({ message: 'Your character is already being made. Please wait.' });
        if (row.count >= 3) return res.status(429).json({ message: 'You can make 3 characters each hour. Please try again later.' });
        if (!usage.has(userId) && usage.size >= 10_000) return res.status(503).json({ message: 'Character creation is busy. Please try again later.' });
        row.busy = true; row.count++; usage.set(userId, row);
        res.setHeader('Cache-Control', 'no-store');
        try {
            const uri = await generate(parsed.data.photo, parsed.data.accent, userId);
            return res.json({ uri, layout: 'home-v1', columns: 3, rows: 4 });
        } catch (error) {
            row.count--;
            if (error instanceof AvatarError) return res.status(error.status).json({ message: error.message });
            // Never expose the provider response or photo in logs / error bodies.
            const status = (error as { status?: number; code?: string })?.status;
            const code = (error as { code?: string })?.code;
            const unavailable = status === 401 || status === 403;
            const message = unavailable ? 'Character creation is not available right now. You can still use your photo.'
                : code === 'moderation_blocked' || code === 'content_policy_violation'
                ? 'That photo could not be transformed. Please choose another photo.'
                : status === 429 ? 'Character creation is busy. Please try again shortly.'
                    : 'Could not make your character. Please try again or use your photo.';
            return res.status(unavailable || status === 429 ? 503 : 502).json({ message });
        } finally { row.busy = false; }
    });
    return router;
}

export default createAvatarRouter();
