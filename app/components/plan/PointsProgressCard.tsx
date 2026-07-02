import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Footprints, Droplets, Flame, Zap, Activity, Heart, Check } from 'lucide-react-native';
import { PointCategory } from '../../hooks/useDailyPoints';

const COLORS = {
    accent: '#FF6B6B',
    success: '#00B894',
    background: '#FFFFFF',
    textMain: '#1A1C1E',
    textSub: '#6C757D',
    line: '#F1F3F5',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    WALK_RUN: Zap,
    STEPS: Footprints,
    CALORIES: Flame,
    MOBILITY: Activity,
    HYDRATION: Droplets,
};

interface Props {
    category: PointCategory;
    onClaim: () => void;
}

export function PointsProgressCard({ category, onClaim }: Props) {
    const isComplete = category.progress >= 1;
    const isClaimable = category.claimable ?? (!category.isAwarded && isComplete);
    const Icon = CATEGORY_ICONS[category.key] || Activity;
    const [isFlipped, setIsFlipped] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;

    // Custom rendering logic based on category or content
    const isStatusOnly = category.key === 'MOBILITY';
    const metricParts = category.metricText?.split('/') || [];
    const currentValue = metricParts[0]?.trim() || '';
    const targetPart = metricParts[1]?.trim() || '';
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
            friction: 8,
            tension: 70,
        }).start();
    }, [flipAnim, isFlipped]);

    return (
        <View style={styles.container}>
            <View style={styles.cardShell}>
                <Animated.View
                    pointerEvents={isFlipped ? 'none' : 'auto'}
                    style={[
                        styles.card,
                        styles.cardFace,
                        { transform: [{ perspective: 1000 }, { rotateY: frontRotation }] },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.flipTopArea}
                        activeOpacity={0.9}
                        onPress={() => setIsFlipped(true)}
                    >
                        <View style={styles.header}>
                            <View style={styles.iconWrapper}>
                                <Icon size={14} color={COLORS.accent} />
                            </View>
                            <Text style={styles.label} numberOfLines={1}>{category.label.toUpperCase()}</Text>
                        </View>

                        <View style={styles.infoSection}>
                            <Text
                                style={[
                                    styles.metricValue,
                                    isStatusOnly && { fontSize: 16, color: isComplete ? COLORS.success : COLORS.accent }
                                ]}
                                numberOfLines={1}
                            >
                                {currentValue}
                            </Text>
                            {targetPart ? (
                                <Text style={styles.metricTarget} numberOfLines={1}>
                                    {targetPart.startsWith('<') || targetPart.startsWith('>') ? targetPart : `/ ${targetPart}`}
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.pointsSection}>
                            <View style={styles.pointsBadge}>
                                <Heart size={10} color={COLORS.accent} fill={COLORS.accent} />
                                <Text style={styles.pointsValue}>{category.maxPoints}</Text>
                                <Text style={styles.pointsLabel}>PTS</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <View style={styles.track}>
                            <View
                                style={[
                                    styles.fill,
                                    {
                                        width: `${Math.min(category.progress, 1) * 100}%`,
                                        backgroundColor: isComplete ? COLORS.success : COLORS.accent
                                    }
                                ]}
                            />
                        </View>

                        <View style={styles.statusRow}>
                            {isClaimable ? (
                                <TouchableOpacity
                                    style={styles.claimButton}
                                    onPress={onClaim}
                                >
                                    <Text style={styles.claimText}>CLAIM</Text>
                                </TouchableOpacity>
                            ) : category.isAwarded ? (
                                <View style={styles.awardedBadge}>
                                    <Check size={10} color={COLORS.success} strokeWidth={4} />
                                    <Text style={styles.awardedText}>REWARDED</Text>
                                </View>
                            ) : (
                                <Text style={styles.progressText}>
                                    {category.statusText || `${Math.round(category.progress * 100)}%`}
                                </Text>
                            )}
                        </View>
                    </View>
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
                        style={styles.backTapArea}
                        activeOpacity={0.95}
                        onPress={() => setIsFlipped(false)}
                    >
                        <View style={styles.header}>
                            <View style={styles.iconWrapper}>
                                <Icon size={14} color={COLORS.accent} />
                            </View>
                            <Text style={styles.label} numberOfLines={1}>{category.label.toUpperCase()}</Text>
                        </View>

                        <View style={styles.backContent}>
                            <Text style={styles.backTitle}>How to earn</Text>
                            <Text style={styles.backText}>{category.info}</Text>
                        </View>

                        <Text style={styles.flipHint}>Tap top area to go back</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 125,
        height: 175,
        marginRight: 12,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 12,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#F1F3F5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    cardShell: {
        width: '100%',
        height: '100%',
    },
    flipTopArea: {
        flex: 1,
        minHeight: 105,
        justifyContent: 'flex-start',
    },
    backTapArea: {
        flex: 1,
    },
    cardFace: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backfaceVisibility: 'hidden',
    },
    cardBack: {
        backgroundColor: '#FFF8F8',
        borderColor: '#FFE3E3',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: '#FFF5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.textSub,
        letterSpacing: 0.5,
        flex: 1,
    },
    infoSection: {
        marginTop: 4,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.textMain,
        lineHeight: 24,
    },
    metricTarget: {
        fontSize: 10,
        color: COLORS.textSub,
        fontWeight: '700',
        marginTop: -2,
    },
    pointsSection: {
        marginVertical: 4,
    },
    pointsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        alignSelf: 'flex-start',
        gap: 4,
        borderWidth: 1,
        borderColor: '#F1F3F5',
    },
    pointsValue: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.textMain,
    },
    pointsLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: COLORS.textSub,
    },
    footer: {
        gap: 8,
    },
    track: {
        height: 4,
        backgroundColor: '#F1F3F5',
        borderRadius: 2,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 2,
    },
    statusRow: {
        minHeight: 24,
        justifyContent: 'center',
    },
    progressText: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textSub,
        opacity: 0.7,
        textAlign: 'center',
    },
    claimButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 5,
        borderRadius: 10,
        alignItems: 'center',
    },
    claimText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
    awardedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    awardedText: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.success,
    },
    backContent: {
        flex: 1,
        justifyContent: 'center',
    },
    backTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: COLORS.accent,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    backText: {
        fontSize: 12,
        lineHeight: 18,
        color: COLORS.textMain,
        fontWeight: '700',
    },
    flipHint: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textSub,
        textAlign: 'center',
        opacity: 0.7,
    },
});
