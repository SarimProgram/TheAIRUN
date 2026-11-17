import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    ZoomIn,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Check, ChevronUp, X } from 'lucide-react-native';

import { FakeHomeScreen } from '@/components/partner/FakeHomeScreen';
import { WATER_BOTTLE_ASPECT, WaterBottle } from '@/components/partner/WaterBottle';
import { pickHomeWallpaper, useHomeWallpaper } from '@/utils/homeWallpaper';

const BOTTLE_WIDTH = 84;
const BOTTLE_HEIGHT = Math.round(BOTTLE_WIDTH * WATER_BOTTLE_ASPECT);
const FLICK_VELOCITY = -700;
const FLICK_DISTANCE = -140;
const RETURN_SPRING = { damping: 15, stiffness: 190, mass: 0.9 };

type BottleThrowModalProps = {
    visible: boolean;
    partnerName: string;
    onClose: () => void;
    /** Fires on the release frame; `xPct` is where the bottle leaves the screen horizontally (0–1). */
    onThrow: (xPct: number) => void;
};

export function BottleThrowModal({ visible, partnerName, onClose, onThrow }: BottleThrowModalProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const [thrown, setThrown] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tx = useSharedValue(0);
    const ty = useSharedValue(0);
    const rotation = useSharedValue(0);
    const pressScale = useSharedValue(1);
    const flightScale = useSharedValue(1);
    const dragging = useSharedValue(0);
    const idle = useSharedValue(0);
    const hint = useSharedValue(0);
    const released = useSharedValue(0);

    const wallpaperUri = useHomeWallpaper();
    const restBottom = insets.bottom + 150;

    const changeWallpaper = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
        pickHomeWallpaper().catch(() => {});
    }, []);
    const exitY = -(screenHeight - restBottom + 40);

    useEffect(() => {
        if (!visible) return;

        setThrown(false);
        tx.value = 0;
        ty.value = 0;
        rotation.value = 0;
        pressScale.value = 1;
        flightScale.value = 1;
        released.value = 0;

        if (!reduceMotion) {
            idle.value = withRepeat(
                withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
                -1,
                true,
            );
            hint.value = withRepeat(
                withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
                -1,
                false,
            );
        }

        return () => {
            cancelAnimation(idle);
            cancelAnimation(hint);
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, [visible, reduceMotion, tx, ty, rotation, pressScale, flightScale, released, idle, hint]);

    const handleGrab = useCallback(() => {
        Haptics.selectionAsync().catch(() => {});
    }, []);

    const handleThrown = useCallback(
        (xPct: number) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onThrow(xPct);
            setThrown(true);
            closeTimerRef.current = setTimeout(onClose, 1500);
        },
        [onClose, onThrow],
    );

    const pan = Gesture.Pan()
        .enabled(!thrown)
        .onBegin(() => {
            pressScale.value = withTiming(1.06, { duration: 120 });
            dragging.value = withTiming(1, { duration: 120 });
            scheduleOnRN(handleGrab);
        })
        .onUpdate((event) => {
            tx.value = event.translationX;
            // Pulling down rubber-bands so the bottle never leaves its resting spot that way.
            ty.value = event.translationY > 0 ? event.translationY * 0.3 : event.translationY;
            rotation.value = Math.max(-35, Math.min(35, event.translationX * 0.12 + event.velocityX * 0.01));
        })
        .onEnd((event) => {
            const flicked =
                event.velocityY < FLICK_VELOCITY ||
                (event.translationY < FLICK_DISTANCE && event.velocityY < 0);

            if (!flicked) {
                tx.value = withSpring(0, { ...RETURN_SPRING, velocity: event.velocityX });
                ty.value = withSpring(0, { ...RETURN_SPRING, velocity: event.velocityY });
                rotation.value = withSpring(0, RETURN_SPRING);
                return;
            }

            released.value = 1;
            const speedY = Math.max(Math.abs(event.velocityY), 1400);
            const distanceY = Math.abs(exitY - ty.value);
            // Ease-out-quad starts at 2× average speed, so this duration hands the finger's velocity straight to the flight.
            const duration = Math.min(520, Math.max(240, ((2 * distanceY) / speedY) * 1000));
            const projectedX = tx.value + (event.velocityX * duration) / 2000;
            const exitX = Math.max(-screenWidth * 0.42, Math.min(screenWidth * 0.42, projectedX));
            const spin = (event.velocityX >= 0 ? 1 : -1) * 540;
            const flight = { duration, easing: Easing.out(Easing.quad) };

            tx.value = withTiming(exitX, flight);
            ty.value = withTiming(exitY, flight);
            rotation.value = withTiming(rotation.value + spin, flight);
            flightScale.value = withTiming(0.72, flight);

            scheduleOnRN(handleThrown, Math.max(0.08, Math.min(0.92, 0.5 + exitX / screenWidth)));
        })
        .onFinalize(() => {
            pressScale.value = withTiming(1, { duration: 150 });
            dragging.value = withTiming(0, { duration: 150 });
        });

    const bottleStyle = useAnimatedStyle(() => {
        const bob = (1 - dragging.value) * (1 - released.value);
        return {
            transform: [
                { translateX: tx.value },
                { translateY: ty.value - idle.value * 8 * bob },
                { rotate: `${rotation.value + (idle.value - 0.5) * 6 * bob}deg` },
                { scale: pressScale.value * flightScale.value },
            ],
        };
    });

    const shadowStyle = useAnimatedStyle(() => {
        const lift = Math.min(1, Math.max(0, -ty.value / 220));
        return {
            opacity: 0.35 * (1 - lift) * (1 - released.value),
            transform: [{ scaleX: 1 - lift * 0.5 + idle.value * 0.06 * (1 - dragging.value) }],
        };
    });

    const hintStyle = useAnimatedStyle(() => ({
        opacity: interpolate(hint.value, [0, 0.4, 1], [0, 1, 0]) * (1 - dragging.value) * (1 - released.value),
        transform: [{ translateY: interpolate(hint.value, [0, 1], [10, -14]) }],
    }));

    const hintLabelStyle = useAnimatedStyle(() => ({
        opacity: (1 - dragging.value) * (1 - released.value),
    }));

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.root}>
                <FakeHomeScreen
                    wallpaperUri={wallpaperUri}
                    onPickWallpaper={changeWallpaper}
                    onLongPressWallpaper={changeWallpaper}
                    widgetContent={
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <X size={18} color="#FFFFFF" strokeWidth={2.4} />
                            </TouchableOpacity>
                            <Text style={styles.eyebrow}>HYDRATION</Text>
                            <Text style={styles.title} numberOfLines={1}>
                                Throw {partnerName} a bottle
                            </Text>
                            <Text style={styles.subtitle}>
                                It lands on their home screen and stays until they drink a glass.
                            </Text>
                        </View>
                    }
                />

                {thrown ? (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.thrownCard}>
                        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.thrownCheck}>
                            <Check size={26} color="#0369A1" strokeWidth={3} />
                        </Animated.View>
                        <Text style={styles.thrownTitle}>Thrown!</Text>
                        <Text style={styles.thrownSubtitle}>Landing on {partnerName}&apos;s screen now</Text>
                    </Animated.View>
                ) : null}

                <View style={[styles.stage, { bottom: restBottom }]} pointerEvents="box-none">
                    <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
                        <ChevronUp size={22} color="#E0F2FE" strokeWidth={3} />
                        <ChevronUp size={22} color="#E0F2FE" strokeWidth={3} style={styles.hintChevron} />
                    </Animated.View>

                    <Animated.View style={[styles.shadow, shadowStyle]} />

                    <GestureDetector gesture={pan}>
                        <Animated.View
                            style={[styles.bottle, bottleStyle]}
                            hitSlop={{ top: 30, bottom: 30, left: 40, right: 40 }}
                            accessible
                            accessibilityRole="adjustable"
                            accessibilityLabel={`Water bottle. Flick up to throw it to ${partnerName}.`}
                        >
                            <WaterBottle width={BOTTLE_WIDTH} />
                        </Animated.View>
                    </GestureDetector>

                    <Animated.Text style={[styles.hintLabel, hintLabelStyle]}>Flick up to throw</Animated.Text>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        paddingRight: 36,
    },
    closeButton: {
        position: 'absolute',
        top: -4,
        right: -6,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
        color: '#7DD3FC',
    },
    title: {
        marginTop: 4,
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.4,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 13.5,
        lineHeight: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    stage: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    hint: {
        alignItems: 'center',
        marginBottom: 14,
    },
    hintChevron: {
        marginTop: -12,
    },
    shadow: {
        position: 'absolute',
        bottom: 26,
        width: BOTTLE_WIDTH * 1.1,
        height: 14,
        borderRadius: 999,
        backgroundColor: '#020617',
    },
    bottle: {
        width: BOTTLE_WIDTH,
        height: BOTTLE_HEIGHT,
    },
    hintLabel: {
        marginTop: 18,
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.3,
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    thrownCard: {
        position: 'absolute',
        top: '38%',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    thrownCheck: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    thrownTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    thrownSubtitle: {
        marginTop: 6,
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});
