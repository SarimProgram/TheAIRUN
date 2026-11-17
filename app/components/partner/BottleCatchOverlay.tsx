import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useChat } from '@/contexts/ChatContext';
import {
    getPendingBottleCardTaps,
    acknowledgeBottleCardTap,
    subscribeToLiveActivityTaps,
    syncBottleLiveActivity,
} from '@/lib/bottle-live-activity';
import { applyBottleCardTap } from '@/lib/bottle-card-actions';
import { getLastWaterLog, getTimeBucket, insertWaterLog } from '@/db/offlineDb';
import { notifyWaterListeners, subscribeToWaterChanges } from '@/hooks/useWaterSync';
import { FakeHomeScreen } from '@/components/partner/FakeHomeScreen';
import { WATER_BOTTLE_ASPECT, WaterBottle } from '@/components/partner/WaterBottle';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/src/auth/authContext';
import {
    BOTTLE_CAUGHT_MESSAGE,
    BOTTLE_THROWN_BACK_TEXT,
    buildBottleThrowMessage,
    parseBottleThrowMessage,
} from '@/utils/bottleThrowMessage';
import { pickHomeWallpaper, useHomeWallpaper } from '@/utils/homeWallpaper';

const PENDING_KEY = 'partner.bottle.pending.v1';
const HANDLED_KEY = 'partner.bottle.handled.v1';
const OUTBOX_KEY = 'partner.bottle.outbox.v1';
const BOTTLE_LOG_PREFIX = 'bottle-';
const GLASS_ML = 250;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BOTTLE_WIDTH = 46;
const BOTTLE_HEIGHT = Math.round(BOTTLE_WIDTH * WATER_BOTTLE_ASPECT);
const EDGE_GAP = 18;
const DROPLET_COUNT = 10;
const HIDDEN_ROUTE_PREFIXES = ['/onboarding', '/(tabs)/onboarding', '/welcome', '/paywall'];
const HOME_SCALE = 1.35;
const HOME_REST_OFFSET = 165;
const APP_REST_OFFSET = 112;

type HomeState = 'hidden' | 'open' | 'closing';

type PendingBottle = {
    id: string;
    fromName: string;
    xPct: number;
    sentAt: string;
};

type DrinkReason = 'tap' | 'external';
type BottleReply = string | { id: string; content: string };

function dayKeyLocal(d = new Date()): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function isFresh(sentAt: string) {
    const time = Date.parse(sentAt);
    return Number.isFinite(time) && Date.now() - time < MAX_AGE_MS;
}

function firstName(name: string) {
    return name.trim().split(/\s+/)[0] || 'Your partner';
}

export default function BottleCatchOverlay() {
    const { messages, currentUserId, sendMessage, historyLoaded } = useChat();
    const { authFetch, isAuthenticated } = useAuth();
    const pathname = usePathname().toLowerCase();
    const [queue, setQueue] = useState<PendingBottle[]>([]);
    const [drinking, setDrinking] = useState<DrinkReason | null>(null);
    const [home, setHome] = useState<HomeState>('hidden');
    const [hydrated, setHydrated] = useState(false);
    const hydratedRef = useRef(false);
    const handledRef = useRef(new Set<string>());
    const queueRef = useRef<PendingBottle[]>([]);
    const externalLogAtRef = useRef<number | null>(null);

    const commitQueue = useCallback((next: PendingBottle[]) => {
        queueRef.current = next;
        setQueue(next);
        AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next)).catch(() => {});
    }, []);

    const enqueue = useCallback(
        (bottle: PendingBottle) => {
            if (!hydratedRef.current || handledRef.current.has(bottle.id) || !isFresh(bottle.sentAt)) return;

            handledRef.current.add(bottle.id);
            AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...handledRef.current].slice(-50))).catch(() => {});
            commitQueue(
                [...queueRef.current, bottle].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)),
            );
            // A fresh arrival plays on the "home screen"; bottles restored from storage just float in-app.
            setHome('open');
        },
        [commitQueue],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [pendingRaw, handledRaw] = await Promise.all([
                    AsyncStorage.getItem(PENDING_KEY),
                    AsyncStorage.getItem(HANDLED_KEY),
                ]);
                if (cancelled) return;
                const handled = handledRaw ? (JSON.parse(handledRaw) as string[]) : [];
                handled.forEach((id) => handledRef.current.add(id));
                const pending = pendingRaw ? (JSON.parse(pendingRaw) as PendingBottle[]) : [];
                queueRef.current = pending.filter((bottle) => isFresh(bottle.sentAt));
                setQueue(queueRef.current);
            } catch {
            } finally {
                hydratedRef.current = true;
                if (!cancelled) setHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Live path: the partner's socket message arrives within a few hundred ms of the flick.
    useEffect(() => {
        if (!currentUserId) return;
        for (const message of messages) {
            if (message.optimistic || message.fromUserId === currentUserId) continue;
            const parsed = parseBottleThrowMessage(message.content);
            if (!parsed) continue;
            enqueue({
                id: message.id,
                fromName: message.fromName,
                xPct: parsed.xPct,
                sentAt: message.createdAt,
            });
        }
    }, [messages, currentUserId, enqueue, hydrated]);

    // Offline path: chat history only keeps 60s, so a bottle thrown while the app was closed is recovered from its push.
    useEffect(() => {
        const ingest = (notification: Notifications.Notification) => {
            const data = notification.request.content.data as Record<string, unknown> | undefined;
            if (data?.kind !== 'water_bottle' || typeof data.messageId !== 'string') return;
            const parsed = parseBottleThrowMessage(typeof data.content === 'string' ? data.content : '');
            if (!parsed) return;
            enqueue({
                id: data.messageId,
                fromName: typeof data.fromName === 'string' ? data.fromName : 'Your partner',
                xPct: parsed.xPct,
                sentAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
            });
            Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
        };

        const scanDelivered = () => {
            Notifications.getPresentedNotificationsAsync()
                .then((list) => list.forEach(ingest))
                .catch(() => {});
            Notifications.getLastNotificationResponseAsync()
                .then((response) => response && ingest(response.notification))
                .catch(() => {});
        };

        const startTimer = setTimeout(scanDelivered, 600);
        const received = Notifications.addNotificationReceivedListener(ingest);
        const responded = Notifications.addNotificationResponseReceivedListener((response) =>
            ingest(response.notification),
        );
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active') scanDelivered();
        });

        return () => {
            clearTimeout(startTimer);
            received.remove();
            responded.remove();
            appState.remove();
        };
    }, [enqueue]);

    useEffect(() => {
        if (!hydrated || !historyLoaded || !currentUserId) return;
        void syncBottleLiveActivity(queue);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void syncBottleLiveActivity(queueRef.current);
        });
        return () => subscription.remove();
    }, [hydrated, historyLoaded, currentUserId, queue]);

    // Card replies go over REST: a Live Activity tap can wake the app in the background with no socket yet.
    const flushingOutboxRef = useRef(false);
    const flushOutbox = useCallback(async () => {
        if (flushingOutboxRef.current || !isAuthenticated) return;
        flushingOutboxRef.current = true;
        try {
            const raw = await AsyncStorage.getItem(OUTBOX_KEY);
            let pending = raw ? (JSON.parse(raw) as BottleReply[]) : [];
            while (pending.length > 0) {
                const response = await authFetch(`${API_BASE_URL}/chat/messages`, {
                    method: 'POST',
                    body: JSON.stringify({ content: typeof pending[0] === 'string' ? pending[0] : pending[0].content }),
                });
                // Other 4xx (e.g. partner disconnected) will never succeed, so drop it rather than retrying forever.
                if (!response.ok && (response.status === 401 || response.status >= 500)) break;
                pending = pending.slice(1);
                await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(pending));
            }
        } catch {
            // Offline: the outbox is retried on the next foreground or card tap.
        } finally {
            flushingOutboxRef.current = false;
        }
    }, [authFetch, isAuthenticated]);

    const processingTapsRef = useRef(false);
    const processCardTaps = useCallback(async () => {
        if (!hydratedRef.current || !isAuthenticated || !currentUserId || processingTapsRef.current) return;
        processingTapsRef.current = true;
        try {
            for (const tap of getPendingBottleCardTaps()) {
                await applyBottleCardTap(tap, {
                    logDrink: async (action) => {
                        const at = new Date(action.at);
                        await insertWaterLog({
                            id: `${BOTTLE_LOG_PREFIX}${action.messageId}`,
                            dayKey: dayKeyLocal(at), timeBucket: getTimeBucket(at), amountMl: GLASS_ML,
                            loggedAt: at.toISOString(), createdAt: new Date().toISOString(),
                        }, { ignoreDuplicate: true });
                        notifyWaterListeners();
                    },
                    queueReply: async (action) => {
                        const raw = await AsyncStorage.getItem(OUTBOX_KEY);
                        const pending: BottleReply[] = raw ? JSON.parse(raw) : [];
                        const id = `${action.messageId}:${action.action}`;
                        if (!pending.some((reply) => typeof reply !== 'string' && reply.id === id)) {
                            pending.push({ id, content: action.action === 'drink' ? BOTTLE_CAUGHT_MESSAGE
                                : buildBottleThrowMessage(0.5, BOTTLE_THROWN_BACK_TEXT) });
                            await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(pending));
                        }
                    },
                    markHandled: async (action) => {
                        const handled = new Set([...handledRef.current, action.messageId]);
                        await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...handled].slice(-50)));
                        const next = queueRef.current.filter((bottle) => bottle.id !== action.messageId);
                        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
                        handledRef.current = handled;
                        queueRef.current = next;
                        setQueue(next);
                    },
                    acknowledge: acknowledgeBottleCardTap,
                });
            }
            await flushOutbox();
        } catch (error) {
            // The native queue retains the action; retry after a transient database/storage failure.
            console.warn('[BottleCatchOverlay] Card action pending retry:', error);
        } finally {
            processingTapsRef.current = false;
        }
    }, [currentUserId, flushOutbox, isAuthenticated]);

    useEffect(() => {
        if (!hydrated) return;
        void processCardTaps();
        const unsubscribeTaps = subscribeToLiveActivityTaps(() => void processCardTaps());
        const retry = setInterval(() => void processCardTaps(), 15000);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void processCardTaps();
        });
        return () => {
            unsubscribeTaps();
            clearInterval(retry);
            subscription.remove();
        };
    }, [hydrated, processCardTaps]);

    // Water logged anywhere else (home, widget, plan) after the throw also catches the bottle.
    useEffect(() => {
        const check = async () => {
            const top = queueRef.current[0];
            if (!top || drinking) return;
            try {
                const last = await getLastWaterLog(dayKeyLocal());
                if (!last || last.id.startsWith(BOTTLE_LOG_PREFIX)) return;
                const loggedAt = Date.parse(last.loggedAt);
                if (loggedAt < Date.parse(top.sentAt)) return;
                externalLogAtRef.current = loggedAt;
                setDrinking('external');
            } catch {}
        };
        void check();
        return subscribeToWaterChanges(() => void check());
    }, [drinking, queue]);

    const handleTapDrink = useCallback(async () => {
        const top = queueRef.current[0];
        if (!top || drinking || processingTapsRef.current) return;
        processingTapsRef.current = true;
        const now = new Date();
        try {
            await insertWaterLog({
                id: `${BOTTLE_LOG_PREFIX}${top.id}`,
                dayKey: dayKeyLocal(now),
                timeBucket: getTimeBucket(now),
                amountMl: GLASS_ML,
                loggedAt: now.toISOString(),
                createdAt: now.toISOString(),
            }, { ignoreDuplicate: true });
        } catch (error) {
            console.warn('[BottleCatchOverlay] Water log failed:', error);
            return;
        } finally {
            processingTapsRef.current = false;
        }
        setDrinking('tap');
        notifyWaterListeners();
    }, [drinking]);

    const handleDrinkFinished = useCallback(() => {
        const [finished, ...rest] = queueRef.current;
        if (!finished) return;

        const externalLogAt = externalLogAtRef.current;
        externalLogAtRef.current = null;
        // One glass logged elsewhere covers every bottle thrown before it.
        const next = externalLogAt === null ? rest : rest.filter((bottle) => Date.parse(bottle.sentAt) > externalLogAt);
        commitQueue(next);
        void syncBottleLiveActivity(next, { endWhenEmpty: true });
        setDrinking(null);
        sendMessage(BOTTLE_CAUGHT_MESSAGE);
    }, [commitQueue, sendMessage]);

    useEffect(() => {
        if (home !== 'open' || queue.length > 0) return;
        const timer = setTimeout(() => setHome('closing'), 380);
        return () => clearTimeout(timer);
    }, [home, queue.length]);

    const requestCloseHome = useCallback(() => setHome('closing'), []);
    const handleHomeClosed = useCallback(() => setHome('hidden'), []);

    const hidden = HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const top = queue[0];
    if (hidden || (!top && home === 'hidden')) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {home !== 'hidden' ? (
                <HomeMoment
                    closing={home === 'closing'}
                    onRequestClose={requestCloseHome}
                    onClosed={handleHomeClosed}
                />
            ) : null}
            {top ? (
                <CaughtBottle
                    key={top.id}
                    bottle={top}
                    count={queue.length}
                    drinking={drinking}
                    onHome={home === 'open'}
                    onTap={handleTapDrink}
                    onDrinkFinished={handleDrinkFinished}
                />
            ) : null}
        </View>
    );
}

type HomeMomentProps = {
    closing: boolean;
    onRequestClose: () => void;
    onClosed: () => void;
};

/** Full-screen fake Home Screen the bottle lands on; swipe up from the bottom edge to go back into the app. */
function HomeMoment({ closing, onRequestClose, onClosed }: HomeMomentProps) {
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const wallpaperUri = useHomeWallpaper();
    const progress = useSharedValue(0);
    const drag = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(1, { duration: reduceMotion ? 160 : 260, easing: Easing.out(Easing.cubic) });
    }, [progress, reduceMotion]);

    useEffect(() => {
        if (!closing) return;
        progress.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }, (finished) => {
            if (finished) scheduleOnRN(onClosed);
        });
    }, [closing, onClosed, progress]);

    const changeWallpaper = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        pickHomeWallpaper().catch(() => {});
    }, []);

    const swipeUp = Gesture.Pan()
        .enabled(!closing)
        .activeOffsetY(-8)
        .failOffsetX([-40, 40])
        .onUpdate((event) => {
            drag.value = Math.min(0, event.translationY);
        })
        .onEnd((event) => {
            if (event.translationY < -60 || event.velocityY < -600) {
                scheduleOnRN(onRequestClose);
            } else {
                drag.value = withSpring(0, { damping: 18, stiffness: 220 });
            }
        });

    const screenStyle = useAnimatedStyle(() => {
        const pull = Math.min(1, -drag.value / 260);
        return {
            opacity: progress.value,
            borderRadius: pull * 44,
            transform: [
                { translateY: drag.value * 0.35 },
                { scale: (reduceMotion ? 1 : 1.06 - 0.06 * progress.value) * (1 - pull * 0.12) },
            ],
        };
    });

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.homeScreen, screenStyle]}>
            <FakeHomeScreen
                wallpaperUri={wallpaperUri}
                onPickWallpaper={changeWallpaper}
                onLongPressWallpaper={changeWallpaper}
                swipeHint="Swipe up to keep it for later"
            />
            <GestureDetector gesture={swipeUp}>
                <View style={[styles.swipeZone, { height: insets.bottom + 150 }]} />
            </GestureDetector>
        </Animated.View>
    );
}

type CaughtBottleProps = {
    bottle: PendingBottle;
    count: number;
    drinking: DrinkReason | null;
    onHome: boolean;
    onTap: () => void;
    onDrinkFinished: () => void;
};

function CaughtBottle({ bottle, count, drinking, onHome, onTap, onDrinkFinished }: CaughtBottleProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const [landed, setLanded] = useState(false);
    const [showLabel, setShowLabel] = useState(false);
    const [side, setSide] = useState<'left' | 'right'>('right');
    const [showPlus, setShowPlus] = useState(false);

    const restLeft = screenWidth - EDGE_GAP - BOTTLE_WIDTH;
    const restTop = screenHeight - insets.bottom - (onHome ? HOME_REST_OFFSET : APP_REST_OFFSET) - BOTTLE_HEIGHT;
    const minTop = insets.top + 70;

    const posX = useSharedValue(reduceMotion ? restLeft : bottle.xPct * screenWidth - BOTTLE_WIDTH / 2);
    const posY = useSharedValue(reduceMotion ? restTop : -BOTTLE_HEIGHT - 60);
    const rotation = useSharedValue(reduceMotion ? 0 : (bottle.xPct < 0.5 ? 1 : -1) * 720);
    const scaleX = useSharedValue(1);
    const scaleY = useSharedValue(1);
    const pressScale = useSharedValue(1);
    const opacity = useSharedValue(reduceMotion ? 0 : 1);
    const wobble = useSharedValue(0);
    const splash = useSharedValue(0);
    const puddle = useSharedValue(0);
    const fill = useSharedValue(1);
    const dragStartX = useSharedValue(0);
    const dragStartY = useSharedValue(0);
    const homeScale = useSharedValue(onHome ? HOME_SCALE : 1);
    const isDragging = useSharedValue(false);
    const wasOnHomeRef = useRef(onHome);

    const handleLanded = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setLanded(true);
        setShowLabel(true);
    }, []);

    useEffect(() => {
        if (!showLabel || onHome) return;
        const timer = setTimeout(() => setShowLabel(false), 5500);
        return () => clearTimeout(timer);
    }, [showLabel, onHome]);

    useEffect(() => {
        if (wasOnHomeRef.current === onHome) return;
        wasOnHomeRef.current = onHome;
        const spring = { damping: 17, stiffness: 190, mass: 0.9 };
        homeScale.value = withSpring(onHome ? HOME_SCALE : 1, spring);
        if (landed && !drinking && !isDragging.value) {
            posY.value = withSpring(restTop, spring);
        }
        // Only reacts to the home screen opening/closing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onHome]);

    useEffect(() => {
        if (reduceMotion) {
            opacity.value = withTiming(1, { duration: 250 }, (finished) => {
                if (finished) scheduleOnRN(handleLanded);
            });
            puddle.value = withTiming(1, { duration: 250 });
            return;
        }

        const fall = 640;
        // On the home screen, let the wallpaper fade in first so the bottle visibly drops onto it.
        const lead = onHome ? 140 : 0;
        posX.value = withDelay(lead, withTiming(restLeft, { duration: fall, easing: Easing.out(Easing.quad) }));
        rotation.value = withDelay(lead, withTiming(0, { duration: fall + 40, easing: Easing.out(Easing.cubic) }));
        posY.value = withDelay(lead, withTiming(restTop, { duration: fall, easing: Easing.in(Easing.quad) }, (finished) => {
            if (!finished) return;
            scaleX.value = withSequence(
                withTiming(1.24, { duration: 70 }),
                withSpring(1, { damping: 7, stiffness: 320 }),
            );
            scaleY.value = withSequence(
                withTiming(0.72, { duration: 70 }),
                withSpring(1, { damping: 7, stiffness: 320 }),
            );
            posY.value = withDelay(
                60,
                withSequence(
                    withTiming(restTop - 18, { duration: 150, easing: Easing.out(Easing.quad) }),
                    withTiming(restTop, { duration: 150, easing: Easing.in(Easing.quad) }),
                ),
            );
            splash.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) });
            puddle.value = withDelay(120, withTiming(1, { duration: 400 }));
            wobble.value = withDelay(
                500,
                withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true),
            );
            scheduleOnRN(handleLanded);
        }));
        // Mount-only: the fly-in plays once per bottle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!drinking) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setShowLabel(false);
        setShowPlus(true);
        cancelAnimation(wobble);
        wobble.value = withTiming(0.5, { duration: 200 });

        if (reduceMotion) {
            opacity.value = withTiming(0, { duration: 300 }, (finished) => {
                if (finished) scheduleOnRN(onDrinkFinished);
            });
            return;
        }

        const tilt = side === 'right' ? -28 : 28;
        rotation.value = withTiming(tilt, { duration: 260, easing: Easing.out(Easing.cubic) });
        fill.value = withTiming(0, { duration: 760, easing: Easing.inOut(Easing.quad) });
        puddle.value = withDelay(500, withTiming(0, { duration: 300 }));
        posY.value = withDelay(780, withTiming(posY.value - 30, { duration: 240, easing: Easing.out(Easing.quad) }));
        scaleX.value = withDelay(780, withTiming(0.4, { duration: 240 }));
        scaleY.value = withDelay(780, withTiming(0.4, { duration: 240 }));
        opacity.value = withDelay(
            780,
            withTiming(0, { duration: 240 }, (finished) => {
                if (finished) scheduleOnRN(onDrinkFinished);
            }),
        );
        // Runs once when a drink starts for this bottle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drinking]);

    const snapToSide = useCallback((next: 'left' | 'right') => setSide(next), []);

    const pan = Gesture.Pan()
        .enabled(landed && !drinking)
        .minDistance(6)
        .onStart(() => {
            isDragging.value = true;
            dragStartX.value = posX.value;
            dragStartY.value = posY.value;
        })
        .onUpdate((event) => {
            posX.value = dragStartX.value + event.translationX;
            posY.value = Math.min(restTop, Math.max(minTop, dragStartY.value + event.translationY));
            rotation.value = Math.max(-20, Math.min(20, event.velocityX * 0.012));
        })
        .onEnd((event) => {
            const projected = posX.value + event.velocityX * 0.15;
            const toLeft = projected + BOTTLE_WIDTH / 2 < screenWidth / 2;
            const spring = { damping: 16, stiffness: 180, mass: 0.9 };
            posX.value = withSpring(toLeft ? EDGE_GAP : restLeft, { ...spring, velocity: event.velocityX });
            posY.value = withSpring(
                Math.min(restTop, Math.max(minTop, posY.value + event.velocityY * 0.1)),
                { ...spring, velocity: event.velocityY },
            );
            rotation.value = withSpring(0, spring);
            scheduleOnRN(snapToSide, toLeft ? 'left' : 'right');
        })
        .onFinalize(() => {
            isDragging.value = false;
        });

    const tap = Gesture.Tap()
        .enabled(landed && !drinking)
        .maxDuration(300)
        .onBegin(() => {
            pressScale.value = withTiming(0.92, { duration: 100 });
        })
        .onEnd((_event, success) => {
            if (success) scheduleOnRN(onTap);
        })
        .onFinalize(() => {
            pressScale.value = withSpring(1, { damping: 12, stiffness: 300 });
        });

    const gesture = Gesture.Race(pan, tap);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateX: posX.value }, { translateY: posY.value }, { scale: homeScale.value }],
    }));

    const bottleStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value + (wobble.value - 0.5) * 8}deg` },
            { scaleX: scaleX.value * pressScale.value },
            { scaleY: scaleY.value * pressScale.value },
        ],
    }));

    const puddleStyle = useAnimatedStyle(() => ({
        opacity: puddle.value * 0.3,
        transform: [{ scaleX: 0.6 + puddle.value * 0.4 }],
    }));

    const rippleStyle = useAnimatedStyle(() => ({
        opacity: interpolate(splash.value, [0, 0.1, 1], [0, 0.55, 0]),
        transform: [{ scale: 0.3 + splash.value * 1.5 }],
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]} pointerEvents="box-none">
            <Animated.View style={[styles.puddle, puddleStyle]} pointerEvents="none" />
            <Animated.View style={[styles.ripple, rippleStyle]} pointerEvents="none" />
            {Array.from({ length: DROPLET_COUNT }, (_, index) => (
                <Droplet key={index} index={index} progress={splash} />
            ))}

            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={[styles.bottle, bottleStyle]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Water bottle from ${firstName(bottle.fromName)}. Tap to drink a glass.`}
                >
                    <WaterBottle width={BOTTLE_WIDTH} fill={fill} />
                    {count > 1 ? (
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>{count}</Text>
                        </View>
                    ) : null}
                </Animated.View>
            </GestureDetector>

            {showLabel ? (
                <Animated.View
                    entering={FadeIn.duration(220)}
                    exiting={FadeOut.duration(180)}
                    style={[styles.label, side === 'right' ? styles.labelLeftOfBottle : styles.labelRightOfBottle]}
                    pointerEvents="none"
                >
                    <Text style={styles.labelTitle} numberOfLines={1}>
                        {firstName(bottle.fromName)} threw you water
                    </Text>
                    <Text style={styles.labelHint}>Tap to drink a glass</Text>
                </Animated.View>
            ) : null}

            {showPlus ? <PlusGlass /> : null}
        </Animated.View>
    );
}

function Droplet({ index, progress }: { index: number; progress: SharedValue<number> }) {
    const angle = (-165 + (150 * index) / (DROPLET_COUNT - 1)) * (Math.PI / 180);
    const distance = 34 + ((index * 37) % 5) * 9;
    const size = 5 + ((index * 13) % 3) * 2;

    const style = useAnimatedStyle(() => {
        const p = progress.value;
        return {
            opacity: p === 0 ? 0 : 1 - p,
            transform: [
                { translateX: Math.cos(angle) * distance * p },
                { translateY: Math.sin(angle) * distance * p + 70 * p * p },
                { scale: 1 - p * 0.5 },
            ],
        };
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.droplet, { width: size, height: size, borderRadius: size / 2 }, style]}
        />
    );
}

function PlusGlass() {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
    }, [progress]);

    const style = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 0.2, 0.75, 1], [0, 1, 1, 0]),
        transform: [{ translateY: -46 * progress.value }, { scale: 0.9 + progress.value * 0.15 }],
    }));

    return (
        <Animated.View style={[styles.plus, style]} pointerEvents="none">
            <Text style={styles.plusText}>+{GLASS_ML} ml</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    homeScreen: {
        zIndex: 8000,
        overflow: 'hidden',
        borderCurve: 'continuous',
        backgroundColor: '#000000',
    },
    swipeZone: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: BOTTLE_WIDTH,
        height: BOTTLE_HEIGHT,
        zIndex: 9000,
    },
    bottle: {
        width: BOTTLE_WIDTH,
        height: BOTTLE_HEIGHT,
        boxShadow: '0 8px 16px rgba(3, 105, 161, 0.28)',
        borderRadius: BOTTLE_WIDTH / 3,
    },
    puddle: {
        position: 'absolute',
        bottom: -5,
        left: -BOTTLE_WIDTH * 0.15,
        width: BOTTLE_WIDTH * 1.3,
        height: 10,
        borderRadius: 999,
        backgroundColor: '#0284C7',
    },
    ripple: {
        position: 'absolute',
        bottom: -7,
        left: -BOTTLE_WIDTH * 0.3,
        width: BOTTLE_WIDTH * 1.6,
        height: 14,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#38BDF8',
    },
    droplet: {
        position: 'absolute',
        bottom: 0,
        left: BOTTLE_WIDTH / 2 - 3,
        backgroundColor: '#38BDF8',
    },
    countBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: 11,
        backgroundColor: '#0369A1',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    label: {
        position: 'absolute',
        top: BOTTLE_HEIGHT * 0.28,
        width: 176,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: '#0C4A6E',
        boxShadow: '0 6px 16px rgba(12, 74, 110, 0.3)',
    },
    labelLeftOfBottle: {
        right: BOTTLE_WIDTH + 10,
    },
    labelRightOfBottle: {
        left: BOTTLE_WIDTH + 10,
    },
    labelTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    labelHint: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '600',
        color: '#7DD3FC',
    },
    plus: {
        position: 'absolute',
        top: -8,
        left: -30,
        width: BOTTLE_WIDTH + 60,
        alignItems: 'center',
    },
    plusText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0284C7',
        fontVariant: ['tabular-nums'],
    },
});
