// backend/src/socket.ts
// Socket.IO server initialization and partner room management

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { prisma } from './db/prisma';
import { tokenService } from './lib/tokens';
import { sendChatMessagePush } from './lib/pushNotifications';

// Store io instance for access from routes
let ioInstance: SocketServer | null = null;
type ActiveRaceSession = {
    userAId: string;
    userBId: string;
    distanceM: number;
    startTime?: number;
    winnerDeclared: boolean;
};
const activeRaceSessions = new Map<string, ActiveRaceSession>();

function getRacePairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
}

export function getIO(): SocketServer {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return ioInstance;
}

/**
 * Initialize Socket.IO server with authentication
 * @param httpServer - HTTP server instance to attach to
 */
export function initializeSocket(httpServer: HTTPServer): SocketServer {
    const io = new SocketServer(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling']
    });

    // Authentication middleware - verify JWT on connection
    io.use(async (socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify JWT using the same tokenService as REST API
            const payload = tokenService.verify(token);

            // Check it's an access token
            if (payload.tokenType !== 'access') {
                return next(new Error('Invalid token type'));
            }

            if (!payload.userId) {
                return next(new Error('Invalid token payload'));
            }

            // Attach userId to socket for later use
            socket.data.userId = payload.userId;
            socket.data.email = payload.email;
            next();
        } catch (err) {
            console.error('[Socket] Auth error:', err);
            next(new Error('Authentication failed'));
        }
    });

    // Handle new connections
    io.on('connection', async (socket: Socket) => {
        const userId = socket.data.userId as string;
        console.log(`[Socket] User ${userId} connected`);

        try {
            // Join personal room (for receiving updates about yourself)
            socket.join(`user:${userId}`);

            // Fetch partner info and join partner's room
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    partnerId: true,
                    partner: {
                        select: {
                            id: true,
                            displayName: true
                        }
                    }
                }
            });

            if (user?.partnerId) {
                // Join room that receives partner's step updates
                socket.join(`partner:${user.partnerId}`);
                console.log(`[Socket] User ${userId} joined partner room: partner:${user.partnerId}`);

                // Send initial partner info on connect
                if (user.partner) {
                    // Fetch partner's timezone to calculate their "today"
                    const partnerUser = await prisma.user.findUnique({
                        where: { id: user.partnerId },
                        select: { timezone: true }
                    });

                    // Calculate today in partner's timezone (default to UTC if not set)
                    const partnerTimezone = partnerUser?.timezone || 'UTC';
                    let todayDateForPartner: Date;

                    try {
                        // Get current time in partner's timezone
                        const nowInPartnerTz = new Date().toLocaleString('en-US', { timeZone: partnerTimezone });
                        const partnerLocalDate = new Date(nowInPartnerTz);

                        // Extract YYYY-MM-DD and convert to UTC midnight for that date
                        const year = partnerLocalDate.getFullYear();
                        const month = partnerLocalDate.getMonth();
                        const day = partnerLocalDate.getDate();
                        todayDateForPartner = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                    } catch {
                        // Fallback to server UTC date
                        const now = new Date();
                        todayDateForPartner = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
                    }

                    const partnerSteps = await prisma.dailyStep.findUnique({
                        where: {
                            userId_date: {
                                userId: user.partnerId,
                                date: todayDateForPartner
                            }
                        }
                    });

                    socket.emit('partnerInfo', {
                        partnerId: user.partner.id,
                        partnerName: user.partner.displayName,
                        steps: partnerSteps?.steps ?? 0
                    });

                    console.log(`[Socket] Sent partnerInfo: ${user.partner.displayName} has ${partnerSteps?.steps ?? 0} steps`);
                }
            }
        } catch (err) {
            console.error(`[Socket] Error setting up user ${userId}:`, err);
        }

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`[Socket] User ${userId} disconnected: ${reason}`);
        });

        // Handle errors
        socket.on('error', (err) => {
            console.error(`[Socket] Error for user ${userId}:`, err);
        });

        // ============================================
        // RACE EVENTS
        // ============================================

        /**
         * race:invite - User invites partner to race
         */
        socket.on('race:invite', async (data: { distance: number }) => {
            try {
                const user: any = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        partnerId: true,
                        displayName: true,
                        partner: {
                            select: {
                                expoPushToken: true,
                            }
                        }
                    }
                });

                if (!user?.partnerId) {
                    socket.emit('race:error', { message: 'No partner connected' });
                    return;
                }

                // Send invite to partner with proposed distance
                io.to(`user:${user.partnerId}`).emit('race:invited', {
                    fromUserId: userId,
                    fromName: user.displayName,
                    distance: data.distance
                });

                console.log(`[Race] ${userId} invited partner ${user.partnerId} for ${data.distance}m`);
            } catch (err) {
                console.error('[Race] Invite error:', err);
                socket.emit('race:error', { message: 'Failed to send invite' });
            }
        });

        /**
         * race:accept - Partner accepts the race invite
         * This triggers the countdown and race start
         */
        socket.on('race:accept', async (data: { initiatorId: string; distance: number }) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        partnerId: true,
                        displayName: true,
                        partner: {
                            select: {
                                expoPushToken: true,
                            }
                        }
                    }
                });

                if (!user?.partnerId) return;

                // Notify both users that invite was accepted
                io.to(`user:${data.initiatorId}`).emit('race:accepted', {
                    acceptedBy: userId,
                    acceptedByName: user?.displayName
                });
                socket.emit('race:accepted', {
                    acceptedBy: userId,
                    acceptedByName: user?.displayName
                });

                console.log(`[Race] ${userId} accepted race from ${data.initiatorId} - starting countdown for ${data.distance}m`);

                // Start countdown immediately after acceptance
                const distance = data.distance;
                const pairKey = getRacePairKey(userId, data.initiatorId);
                activeRaceSessions.set(pairKey, {
                    userAId: pairKey.split(':')[0],
                    userBId: pairKey.split(':')[1],
                    distanceM: distance,
                    winnerDeclared: false,
                });

                setTimeout(() => {
                    io.to(`user:${userId}`).emit('race:countdown', { count: 3 });
                    io.to(`user:${user.partnerId}`).emit('race:countdown', { count: 3 });
                }, 500);

                setTimeout(() => {
                    io.to(`user:${userId}`).emit('race:countdown', { count: 2 });
                    io.to(`user:${user.partnerId}`).emit('race:countdown', { count: 2 });
                }, 1500);

                setTimeout(() => {
                    io.to(`user:${userId}`).emit('race:countdown', { count: 1 });
                    io.to(`user:${user.partnerId}`).emit('race:countdown', { count: 1 });
                }, 2500);

                setTimeout(() => {
                    const startTime = Date.now();
                    const existing = activeRaceSessions.get(pairKey);
                    if (existing) {
                        existing.startTime = startTime;
                        existing.distanceM = distance;
                        existing.winnerDeclared = false;
                        activeRaceSessions.set(pairKey, existing);
                    }
                    io.to(`user:${userId}`).emit('race:start', { startTime, distance });
                    io.to(`user:${user.partnerId}`).emit('race:start', { startTime, distance });
                    console.log(`[Race] Race started: ${distance}m`);
                }, 3500);

            } catch (err) {
                console.error('[Race] Accept error:', err);
            }
        });

        /**
         * race:decline - Partner declines the race invite
         */
        socket.on('race:decline', async (data: { initiatorId: string }) => {
            io.to(`user:${data.initiatorId}`).emit('race:declined', {
                declinedBy: userId
            });
            console.log(`[Race] ${userId} declined race from ${data.initiatorId}`);
        });

        /**
         * race:setDistance - DEPRECATED: Distance is now set when accepting invite
         * Kept for backwards compatibility but does nothing
         */
        socket.on('race:setDistance', async (data: { distance: number }) => {
            console.log('[Race] race:setDistance is deprecated - distance is now set on invite accept');
        });

        /**
         * race:position - User sends GPS position update during race
         */
        socket.on('race:position', async (data: {
            latitude: number;
            longitude: number;
            distanceCovered: number;
            speed: number;
        }) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        partnerId: true,
                        displayName: true,
                        partner: {
                            select: {
                                expoPushToken: true,
                            }
                        }
                    }
                });

                if (!user?.partnerId) return;

                // Send position to partner
                io.to(`user:${user.partnerId}`).emit('race:partnerPosition', {
                    odId: userId,
                    partnerName: user.displayName,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    distanceCovered: data.distanceCovered,
                    speed: data.speed,
                    timestamp: Date.now()
                });
            } catch (err) {
                console.error('[Race] Position update error:', err);
            }
        });

        /**
         * race:finish - User crossed the finish line
         */
        socket.on('race:finish', async (data: {
            finalDistance: number;
            finishTime: number;
            duration: number;
        }) => {
            try {
                const user: any = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        partnerId: true,
                        displayName: true,
                        partner: {
                            select: {
                                expoPushToken: true,
                            }
                        }
                    }
                });

                if (!user?.partnerId) return;
                const pairKey = getRacePairKey(userId, user.partnerId);
                const activeSession = activeRaceSessions.get(pairKey);
                if (activeSession?.winnerDeclared) {
                    console.log(`[Race] Finish ignored (winner already recorded) for pair ${pairKey}`);
                    return;
                }
                if (activeSession) {
                    activeSession.winnerDeclared = true;
                    activeRaceSessions.set(pairKey, activeSession);
                }

                const winnerData = {
                    odId: userId,
                    winnerName: user.displayName,
                    finalDistance: data.finalDistance,
                    duration: data.duration
                };

                const sessionUserAId = activeSession?.userAId ?? [userId, user.partnerId].sort()[0];
                const sessionUserBId = activeSession?.userBId ?? [userId, user.partnerId].sort()[1];
                const distanceKm = Number(((activeSession?.distanceM ?? data.finalDistance) / 1000).toFixed(3));
                const durationMs = Math.max(0, Math.round(data.duration));

                await prisma.raceResult.create({
                    data: {
                        userAId: sessionUserAId,
                        userBId: sessionUserBId,
                        winnerUserId: userId,
                        winnerName: user.displayName,
                        distanceKm,
                        durationMs,
                        finishedAt: new Date(data.finishTime || Date.now()),
                    },
                });

                // Notify both users of winner
                io.to(`user:${userId}`).emit('race:winner', winnerData);
                io.to(`user:${user.partnerId}`).emit('race:winner', winnerData);
                activeRaceSessions.delete(pairKey);

                console.log(`[Race] Winner: ${user.displayName} - ${data.finalDistance}m in ${data.duration}ms`);
            } catch (err) {
                console.error('[Race] Finish error:', err);
            }
        });

        /**
         * race:cancel - Cancel ongoing race
         */
        socket.on('race:cancel', async () => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { partnerId: true }
                });

                if (!user?.partnerId) return;
                activeRaceSessions.delete(getRacePairKey(userId, user.partnerId));

                io.to(`user:${userId}`).emit('race:cancelled', { cancelledBy: userId });
                io.to(`user:${user.partnerId}`).emit('race:cancelled', { cancelledBy: userId });

                console.log(`[Race] Race cancelled by ${userId}`);
            } catch (err) {
                console.error('[Race] Cancel error:', err);
            }
        });

        // ============================================
        // CHAT EVENTS
        // ============================================

        /**
         * chat:send - User sends a message to their partner
         * Saves to DB and emits to partner in real-time
         */
        socket.on('chat:send', async (data: { content: string }) => {
            try {
                if (!data.content || !data.content.trim()) {
                    socket.emit('chat:error', { message: 'Message cannot be empty' });
                    return;
                }

                const user: any = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        partnerId: true,
                        displayName: true,
                        partner: {
                            select: {
                                expoPushToken: true,
                            }
                        }
                    }
                });

                if (!user?.partnerId) {
                    socket.emit('chat:error', { message: 'No partner connected' });
                    return;
                }

                // Save message to DB
                const message = await prisma.chatMessage.create({
                    data: {
                        fromUserId: userId,
                        toUserId: user.partnerId,
                        content: data.content.trim(),
                    }
                });

                const msgPayload = {
                    id: message.id,
                    fromUserId: userId,
                    fromName: user.displayName,
                    toUserId: user.partnerId,
                    content: message.content,
                    createdAt: message.createdAt.toISOString(),
                };

                // Send to partner in real-time
                io.to(`user:${user.partnerId}`).emit('chat:message', msgPayload);

                // Confirm back to sender
                socket.emit('chat:message', msgPayload);

                console.log('[Chat] Partner push token lookup', {
                    fromUserId: userId,
                    partnerId: user.partnerId,
                    hasToken: !!user.partner?.expoPushToken,
                    tokenPreview: user.partner?.expoPushToken
                        ? `${user.partner.expoPushToken.slice(0, 20)}...`
                        : null,
                });

                sendChatMessagePush({
                    to: user.partner?.expoPushToken,
                    fromName: user.displayName,
                    content: message.content,
                }).catch((pushErr) => {
                    console.error('[Chat] Push send error:', pushErr);
                });

                console.log(`[Chat] ${userId} -> ${user.partnerId}: "${data.content.trim().substring(0, 30)}..."`);
            } catch (err) {
                console.error('[Chat] Send error:', err);
                socket.emit('chat:error', { message: 'Failed to send message' });
            }
        });

        /**
         * chat:history - Load recent chat messages between user and partner
         * Returns messages from the last 60 seconds
         */
        socket.on('chat:history', async () => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { partnerId: true }
                });

                if (!user?.partnerId) {
                    socket.emit('chat:history:response', { messages: [] });
                    return;
                }

                const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

                const messages = await prisma.chatMessage.findMany({
                    where: {
                        createdAt: { gte: sixtySecondsAgo },
                        OR: [
                            { fromUserId: userId, toUserId: user.partnerId },
                            { fromUserId: user.partnerId, toUserId: userId },
                        ]
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 50,
                    include: {
                        fromUser: { select: { displayName: true } }
                    }
                });

                socket.emit('chat:history:response', {
                    messages: messages.map(m => ({
                        id: m.id,
                        fromUserId: m.fromUserId,
                        fromName: m.fromUser.displayName,
                        toUserId: m.toUserId,
                        content: m.content,
                        createdAt: m.createdAt.toISOString(),
                    }))
                });

                console.log(`[Chat] Sent ${messages.length} history messages to ${userId}`);
            } catch (err) {
                console.error('[Chat] History error:', err);
                socket.emit('chat:history:response', { messages: [] });
            }
        });
    });

    ioInstance = io;
    console.log('[Socket] Socket.IO server initialized');

    return io;
}

/**
 * Emit step update to a user's partners
 * Called from steps.routes.ts after successful sync
 */
export async function emitStepUpdateToPartner(
    userId: string,
    steps: number,
    displayName: string
): Promise<void> {
    if (!ioInstance) {
        console.warn('[Socket] Cannot emit - Socket.IO not initialized');
        return;
    }

    try {
        // Get partner ID
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { partnerId: true }
        });

        if (!user?.partnerId) {
            return; // No partner, nothing to emit
        }

        // Emit to room listening for updates about THIS user
        // Partner B should have joined `partner:A` to receive A's updates
        ioInstance.to(`partner:${userId}`).emit('stepUpdate', {
            partnerId: userId,
            partnerName: displayName,
            steps,
            timestamp: new Date().toISOString()
        });

        console.log(`[Socket] Emitted stepUpdate to partner:${userId} - ${steps} steps`);
    } catch (err) {
        console.error('[Socket] Error emitting step update:', err);
    }
}
