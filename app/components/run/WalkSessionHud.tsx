// app/components/run/WalkSessionHud.tsx
// Live HUD for walk sessions: map on top, stats + block ring + cue banner below.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
    ChartNoAxesColumnIncreasing, ChevronLeft, Flame, Footprints, Layers, LocateFixed, Lock, LockOpen,
    MapPin, MessageCircle, Navigation, Pause, Play, Square,
} from 'lucide-react-native';

import { WALK_THEME } from '@/constants/walkTheme';

const STATS_HEIGHT = 96;
const RING_CARD_PADDING = 14;
const BANNER_HEIGHT = 50;
const CARD_GAP = 12;
const CARD_OVERLAP = 16;

/** Sizes the map so the cards below it fit exactly on screen. */
export function getWalkLayout(windowHeight: number, bottomInset: number) {
    const ringSize = Math.round(Math.min(184, Math.max(140, windowHeight * 0.2)));
    const cardsHeight =
        STATS_HEIGHT + ringSize + RING_CARD_PADDING * 2 + BANNER_HEIGHT + CARD_GAP * 2 + bottomInset + 12;
    return { ringSize, mapHeight: windowHeight - cardsHeight + CARD_OVERLAP };
}

type WalkSessionHudProps = {
    title: string;
    phaseLabel: string;
    phaseIndex: number;
    totalPhases: number;
    blockRemainingSec: number;
    blockDurationSec: number;
    blockProgress: number;
    steps: number;
    distanceKm: string;
    calories: number;
    cueText: string;
    isPaused: boolean;
    isSaving: boolean;
    isSatellite: boolean;
    mapHeight: number;
    ringSize: number;
    topInset: number;
    bottomInset: number;
    onBack: () => void;
    onPause: () => void;
    onResume: () => void;
    onFinish: () => void;
    onCoach: () => void;
    onRecenter: () => void;
    onOverview: () => void;
    onToggleLayers: () => void;
};

const formatClock = (sec: number) => {
    const safe = Math.max(0, Math.round(sec));
    return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, '0')}`;
};

const formatCount = (value: number) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const toTitleCase = (value: string) =>
    value.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

function CircleButton({
    size = 44, label, onPress, onLongPress, disabled, active, children,
}: {
    size?: number;
    label: string;
    onPress: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    active?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={600}
            disabled={disabled}
            hitSlop={4}
            style={({ pressed }) => [
                styles.circleButton,
                { width: size, height: size, borderRadius: size / 2 },
                active && styles.circleButtonActive,
                pressed && styles.pressed,
                disabled && styles.disabled,
            ]}
        >
            {children}
        </Pressable>
    );
}

function BlockRing({ size, progress, children }: { size: number; progress: number; children: React.ReactNode }) {
    const strokeWidth = Math.round(size * 0.075);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(1, Math.max(0, progress));
    const center = size / 2;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
                <Defs>
                    <SvgGradient id="walkRing" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={WALK_THEME.accentLight} />
                        <Stop offset="1" stopColor={WALK_THEME.accent} />
                    </SvgGradient>
                </Defs>
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={WALK_THEME.ringTrack}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {clamped > 0 && (
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="url(#walkRing)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - clamped)}
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                )}
            </Svg>
            {children}
        </View>
    );
}

export function WalkSessionHud(props: WalkSessionHudProps) {
    const {
        title, phaseLabel, phaseIndex, totalPhases, blockRemainingSec, blockDurationSec, blockProgress,
        steps, distanceKm, calories, cueText, isPaused, isSaving, isSatellite, mapHeight, ringSize,
        topInset, bottomInset, onBack, onPause, onResume, onFinish, onCoach, onRecenter, onOverview,
        onToggleLayers,
    } = props;
    const [isLocked, setIsLocked] = useState(false);
    const controlsDisabled = isLocked || isSaving;

    const lock = () => {
        if (isLocked) return;
        setIsLocked(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const unlock = () => {
        setIsLocked(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const handlePauseToggle = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (isPaused) onResume();
        else onPause();
    };

    const bannerText = isLocked
        ? 'Locked · hold the lock to unlock'
        : isPaused
            ? 'Paused · tap play to keep going'
            : cueText;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <LinearGradient
                pointerEvents="none"
                colors={[WALK_THEME.background, WALK_THEME.background, WALK_THEME.backgroundClear]}
                locations={[0, 0.45, 1]}
                style={[styles.topFade, { height: topInset + 130 }]}
            />
            <LinearGradient
                pointerEvents="none"
                colors={[WALK_THEME.backgroundClear, WALK_THEME.background, WALK_THEME.backgroundTint]}
                locations={[0, 0.12, 1]}
                style={[styles.bottomArea, { top: mapHeight - 70 }]}
            />

            {/* Header */}
            <View style={[styles.header, { paddingTop: topInset + 6 }]} pointerEvents="box-none">
                <CircleButton label="Save and exit" onPress={onBack} disabled={controlsDisabled}>
                    <ChevronLeft size={22} color={WALK_THEME.text} strokeWidth={2.25} />
                </CircleButton>

                <View style={styles.headerCenter} pointerEvents="none">
                    <Text style={styles.title} numberOfLines={1}>{toTitleCase(title)}</Text>
                    <View style={styles.blockChip}>
                        <Footprints size={13} color={WALK_THEME.accent} strokeWidth={2.25} />
                        <Text style={styles.blockChipText} numberOfLines={1}>
                            {toTitleCase(phaseLabel)}
                        </Text>
                        <Text style={styles.blockChipCount}>{phaseIndex + 1}/{totalPhases}</Text>
                    </View>
                </View>

                <CircleButton label="Get a coaching tip" onPress={onCoach} disabled={controlsDisabled}>
                    <MessageCircle size={20} color={WALK_THEME.text} strokeWidth={2} />
                </CircleButton>
            </View>

            {/* Map controls */}
            <View style={[styles.mapControls, { top: mapHeight * 0.4 }]} pointerEvents="box-none">
                <CircleButton
                    label={isSatellite ? 'Show standard map' : 'Show satellite map'}
                    onPress={onToggleLayers}
                    disabled={isLocked}
                    active={isSatellite}
                >
                    <Layers size={19} color={isSatellite ? WALK_THEME.accent : WALK_THEME.text} strokeWidth={2} />
                </CircleButton>
                <CircleButton label="Show whole route" onPress={onOverview} disabled={isLocked}>
                    <Navigation size={18} color={WALK_THEME.accent} fill={WALK_THEME.accent} strokeWidth={2} />
                </CircleButton>
                <CircleButton label="Center on my location" onPress={onRecenter} disabled={isLocked}>
                    <LocateFixed size={19} color={WALK_THEME.text} strokeWidth={2} />
                </CircleButton>
            </View>

            {/* Cards */}
            <View
                style={[styles.cards, { top: mapHeight - CARD_OVERLAP, paddingBottom: bottomInset + 12 }]}
                pointerEvents="box-none"
            >
                <View style={[styles.card, styles.statsCard]}>
                    <View style={styles.statCell}>
                        <Footprints size={20} color={WALK_THEME.accent} strokeWidth={2} />
                        <Text style={styles.statValue} numberOfLines={1}>{formatCount(steps)}</Text>
                        <Text style={styles.statLabel}>steps</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCell}>
                        <MapPin size={20} color={WALK_THEME.accent} strokeWidth={2} />
                        <Text style={styles.statValue} numberOfLines={1}>
                            {distanceKm}<Text style={styles.statUnit}> km</Text>
                        </Text>
                        <Text style={styles.statLabel}>distance</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCell}>
                        <Flame size={20} color={WALK_THEME.accent} strokeWidth={2} />
                        <Text style={styles.statValue} numberOfLines={1}>
                            ~{formatCount(calories)}<Text style={styles.statUnit}> kcal</Text>
                        </Text>
                        <Text style={styles.statLabel}>calories</Text>
                    </View>
                </View>

                <View style={[styles.card, styles.ringCard]}>
                    <CircleButton
                        size={52}
                        label={isLocked ? 'Hold to unlock screen' : 'Lock screen'}
                        onPress={lock}
                        onLongPress={isLocked ? unlock : undefined}
                        active={isLocked}
                        disabled={isSaving}
                    >
                        {isLocked ? (
                            <Lock size={20} color={WALK_THEME.accent} strokeWidth={2} />
                        ) : (
                            <LockOpen size={20} color={WALK_THEME.text} strokeWidth={2} />
                        )}
                    </CircleButton>

                    <BlockRing size={ringSize} progress={blockProgress}>
                        <Text style={[styles.ringTime, { fontSize: Math.round(ringSize * 0.23) }]}>
                            {formatClock(blockRemainingSec)}
                        </Text>
                        <Text style={styles.ringSub}>of {formatClock(blockDurationSec)}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
                            onPress={handlePauseToggle}
                            disabled={controlsDisabled}
                            hitSlop={6}
                            style={({ pressed }) => [
                                styles.pauseButton,
                                isPaused && styles.resumeButton,
                                pressed && styles.pressed,
                                controlsDisabled && styles.disabled,
                            ]}
                        >
                            {isPaused ? (
                                <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                            ) : (
                                <Pause size={18} color={WALK_THEME.accent} fill={WALK_THEME.accent} />
                            )}
                        </Pressable>
                    </BlockRing>

                    <CircleButton size={52} label="Finish walk" onPress={onFinish} disabled={controlsDisabled}>
                        <Square size={17} color={WALK_THEME.text} strokeWidth={2.25} />
                    </CircleButton>
                </View>

                <View style={styles.banner}>
                    <ChartNoAxesColumnIncreasing size={20} color={WALK_THEME.accent} strokeWidth={2.75} />
                    <Text style={styles.bannerText} numberOfLines={1}>{bannerText}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    topFade: { position: 'absolute', top: 0, left: 0, right: 0 },
    bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    pressed: { transform: [{ scale: 0.95 }] },
    disabled: { opacity: 0.45 },

    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    headerCenter: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 8 },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: WALK_THEME.text,
        letterSpacing: -0.3,
        lineHeight: 44,
    },
    blockChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: WALK_THEME.card,
        paddingHorizontal: 12,
        height: 30,
        borderRadius: 15,
        boxShadow: WALK_THEME.buttonShadow,
    },
    blockChipText: { fontSize: 13, fontWeight: '600', color: WALK_THEME.text },
    blockChipCount: {
        fontSize: 12,
        fontWeight: '600',
        color: WALK_THEME.textMuted,
        fontVariant: ['tabular-nums'],
    },

    circleButton: {
        backgroundColor: WALK_THEME.card,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: WALK_THEME.buttonShadow,
    },
    circleButtonActive: { backgroundColor: WALK_THEME.accentSoftSolid },

    mapControls: { position: 'absolute', right: 16, gap: 12 },

    cards: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        gap: CARD_GAP,
    },
    card: {
        backgroundColor: WALK_THEME.card,
        borderRadius: 24,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: WALK_THEME.border,
        boxShadow: WALK_THEME.cardShadow,
    },
    statsCard: { height: STATS_HEIGHT, flexDirection: 'row', alignItems: 'center' },
    statCell: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
    statDivider: { width: 1, height: 44, backgroundColor: WALK_THEME.divider },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: WALK_THEME.text,
        letterSpacing: -0.3,
        fontVariant: ['tabular-nums'],
        marginTop: 6,
    },
    statUnit: { fontSize: 15, fontWeight: '700', letterSpacing: 0 },
    statLabel: { fontSize: 13, fontWeight: '500', color: WALK_THEME.textMuted, marginTop: 1 },

    ringCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
        paddingVertical: RING_CARD_PADDING,
    },
    ringTime: {
        fontWeight: '800',
        color: WALK_THEME.text,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'],
    },
    ringSub: { fontSize: 14, fontWeight: '600', color: WALK_THEME.textMuted, marginTop: -2 },
    pauseButton: {
        marginTop: 8,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: WALK_THEME.accentSoftSolid,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resumeButton: { backgroundColor: WALK_THEME.accent },

    banner: {
        height: BANNER_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 20,
        borderRadius: BANNER_HEIGHT / 2,
        backgroundColor: WALK_THEME.accentSoftSolid,
    },
    bannerText: {
        flexShrink: 1,
        fontSize: 15,
        fontWeight: '700',
        color: WALK_THEME.accentText,
    },
});
