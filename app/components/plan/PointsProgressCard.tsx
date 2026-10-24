import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Footprints, Droplets, Flame, Zap, Activity, Check, Heart, Lock } from 'lucide-react-native';
import { PointCategory } from '../../hooks/useDailyPoints';

const COLORS = {
    accent: '#FF4757',
    accentSoft: 'rgba(255, 71, 87, 0.1)',
    accentMuted: 'rgba(255, 71, 87, 0.55)',
    success: '#00B894',
    successSoft: 'rgba(0, 184, 148, 0.1)',
    ink: '#1A1C1E',
    inkSoft: '#6C757D',
    muted: '#ADB5BD',
    line: '#F1F3F5',
    surface: '#FFFFFF',
    lockedBg: '#F8F9FA',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    WALK_RUN: Zap,
    STEPS: Footprints,
    CALORIES: Flame,
    MOBILITY: Activity,
    HYDRATION: Droplets,
};

type CardVariant = 'locked' | 'ready' | 'collected';

interface Props {
    category: PointCategory;
    onClaim: () => void;
    onPress?: () => void;
}

export function PointsProgressCard({ category, onClaim, onPress }: Props) {
    const isComplete = category.progress >= 1;
    const isClaimable = category.claimable ?? (!category.isAwarded && isComplete);
    const isAwarded = category.isAwarded;
    const variant: CardVariant = isAwarded ? 'collected' : isClaimable ? 'ready' : 'locked';

    const Icon = CATEGORY_ICONS[category.key] || Activity;
    const [isFlipped, setIsFlipped] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;

    const isStatusOnly = category.key === 'MOBILITY';
    const metricParts = category.metricText?.split('/') || [];
    const currentValue = metricParts[0]?.trim() || '';
    const targetPart = metricParts[1]?.trim() || '';
    const progressPct = Math.round(Math.min(category.progress, 1) * 100);

    const frontRotation = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });
    const backRotation = flipAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['180deg', '360deg'],
    });

    useEffect(() => {
        Animated.spring(flipAnim, {
            toValue: isFlipped ? 1 : 0,
            useNativeDriver: true,
            friction: 9,
            tension: 65,
        }).start();
    }, [flipAnim, isFlipped]);

    const handleCardPress = () => {
        if (variant === 'ready') {
            onClaim();
            return;
        }
        if (onPress) {
            onPress();
            return;
        }
        setIsFlipped(true);
    };

    return (
        <View style={styles.container}>
            <Animated.View
                pointerEvents={isFlipped ? 'none' : 'auto'}
                style={[
                    styles.card,
                    styles.cardFace,
                    variant === 'ready' && styles.cardReady,
                    { transform: [{ perspective: 1000 }, { rotateY: frontRotation }] },
                ]}
            >
                <TouchableOpacity
                    style={styles.content}
                    activeOpacity={0.9}
                    onPress={handleCardPress}
                    onLongPress={() => setIsFlipped(true)}
                >
                    <View style={styles.header}>
                        <View style={[
                            styles.iconWrap,
                            variant === 'collected' && styles.iconWrapCollected,
                            variant === 'ready' && styles.iconWrapReady,
                        ]}>
                            <Icon
                                size={17}
                                color={variant === 'collected' ? COLORS.success : COLORS.accent}
                            />
                        </View>
                        <Text style={styles.categoryLabel} numberOfLines={1}>
                            {category.label}
                        </Text>
                    </View>

                    <View style={styles.metricBlock}>
                        <Text
                            style={[
                                styles.metricValue,
                                isStatusOnly && styles.metricValueAction,
                                variant === 'collected' && styles.metricValueCollected,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                        >
                            {currentValue}
                        </Text>
                        {targetPart ? (
                            <Text style={styles.metricTarget} numberOfLines={1}>
                                {targetPart}
                            </Text>
                        ) : null}
                    </View>

                    {isStatusOnly && category.statusText ? (
                        <Text style={styles.actionHint}>
                            {category.statusText}
                        </Text>
                    ) : !isStatusOnly ? (
                        <View style={styles.progressBlock}>
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${progressPct}%`,
                                            backgroundColor: variant === 'collected' ? COLORS.success : COLORS.accent,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressLabel}>{progressPct}%</Text>
                        </View>
                    ) : null}

                    <RewardStrip variant={variant} points={category.maxPoints} />
                </TouchableOpacity>
            </Animated.View>

            <Animated.View
                pointerEvents={isFlipped ? 'auto' : 'none'}
                style={[
                    styles.card,
                    styles.cardFace,
                    styles.cardBack,
                    { transform: [{ perspective: 1000 }, { rotateY: backRotation }] },
                ]}
            >
                <TouchableOpacity
                    style={styles.content}
                    activeOpacity={0.95}
                    onPress={() => setIsFlipped(false)}
                >
                    <Text style={styles.backEyebrow}>{category.label}</Text>
                    <Text style={styles.backText}>{category.info}</Text>
                    <Text style={styles.backHint}>Tap to go back</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

function RewardStrip({ variant, points }: { variant: CardVariant; points: number }) {
    if (variant === 'collected') {
        return (
            <View style={[styles.rewardStrip, styles.rewardStripCollected]}>
                <Check size={14} color={COLORS.success} strokeWidth={3} />
                <Text style={styles.rewardCollectedText}>+{points} pts earned</Text>
            </View>
        );
    }

    if (variant === 'ready') {
        return (
            <View style={[styles.rewardStrip, styles.rewardStripReady]}>
                <Heart size={15} color={COLORS.accent} fill={COLORS.accent} />
                <Text style={styles.rewardReadyText}>{points} pts</Text>
                <Text style={styles.rewardReadyAction}>Tap to claim</Text>
            </View>
        );
    }

    return (
        <View style={[styles.rewardStrip, styles.rewardStripLocked]}>
            <Lock size={13} color={COLORS.muted} />
            <Heart size={14} color={COLORS.muted} />
            <Text style={styles.rewardLockedText}>{points} pts</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 154,
        height: 208,
        marginRight: 12,
    },
    card: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 22,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.line,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
        overflow: 'hidden',
    },
    cardFace: {
        backfaceVisibility: 'hidden',
    },
    cardReady: {
        borderColor: 'rgba(255, 71, 87, 0.25)',
    },
    cardBack: {
        backgroundColor: '#FAFAFA',
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: COLORS.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapReady: {
        backgroundColor: 'rgba(255, 71, 87, 0.14)',
    },
    iconWrapCollected: {
        backgroundColor: COLORS.successSoft,
    },
    categoryLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.ink,
    },
    metricBlock: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 4,
    },
    metricValue: {
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -0.5,
        lineHeight: 28,
    },
    metricValueAction: {
        fontSize: 17,
        color: COLORS.accent,
    },
    metricValueCollected: {
        color: COLORS.inkSoft,
    },
    metricTarget: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.muted,
    },
    progressBlock: {
        gap: 5,
        marginBottom: 4,
    },
    progressTrack: {
        height: 5,
        backgroundColor: COLORS.line,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
    progressLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.muted,
    },
    actionHint: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.accentMuted,
        marginBottom: 4,
    },
    rewardStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
    },
    rewardStripLocked: {
        backgroundColor: COLORS.lockedBg,
    },
    rewardLockedText: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.muted,
    },
    rewardStripReady: {
        backgroundColor: COLORS.accentSoft,
        justifyContent: 'center',
    },
    rewardReadyText: {
        fontSize: 15,
        fontWeight: '900',
        color: COLORS.accent,
    },
    rewardReadyAction: {
        marginLeft: 'auto',
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.accent,
        opacity: 0.8,
    },
    rewardStripCollected: {
        backgroundColor: COLORS.successSoft,
    },
    rewardCollectedText: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.success,
    },
    backEyebrow: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.accent,
        marginBottom: 10,
    },
    backText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
        color: COLORS.inkSoft,
    },
    backHint: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.muted,
        textAlign: 'center',
        marginTop: 12,
    },
});
