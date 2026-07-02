import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { IntervalSegment } from '@/types/IntervalValues';

const { width } = Dimensions.get('window');
const SEGMENT_WIDTH = 100; // Width of a future segment card
const ACTIVE_WIDTH = 100;  // Keep uniform for narrower feel
const SPACING = 8;

interface Props {
    segments: IntervalSegment[];
    currentIndex: number;
    progressInSegment: number; // 0.0 to 1.0 representing completion of current segment
}

export function IntervalProgressStrip({ segments, currentIndex, progressInSegment }: Props) {

    // We want the active segment to be roughly centered or effectively placed
    // Let's create a viewing window.

    // Derived values for animations
    const translateX = useSharedValue(0);

    useEffect(() => {
        // Calculate target offset to keep current index in "focus" position
        // Let's say focus position is mostly left-aligned but with some padding
        const targetOffset = -(currentIndex * (SEGMENT_WIDTH + SPACING));
        translateX.value = withSpring(targetOffset, { damping: 15 });
    }, [currentIndex]);

    const animatedContainerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }]
        };
    });

    return (
        <View style={styles.container}>
            <View style={styles.mask}>
                <Animated.View style={[styles.track, animatedContainerStyle]}>
                    {segments.map((segment, index) => {
                        const isActive = index === currentIndex;
                        const isPast = index < currentIndex;

                        return (
                            <SegmentCard
                                key={segment.id}
                                segment={segment}
                                isActive={isActive}
                                isPast={isPast}
                                progress={isActive ? progressInSegment : isPast ? 1 : 0}
                            />
                        );
                    })}
                </Animated.View>
            </View>

            {/* Overlay Gradient for fade effect on edges if needed */}
        </View>
    );
}

function SegmentCard({ segment, isActive, isPast, progress }: {
    segment: IntervalSegment,
    isActive: boolean,
    isPast: boolean,
    progress: number
}) {

    const cardScale = useSharedValue(0.9);
    const cardOpacity = useSharedValue(0.5);

    useEffect(() => {
        cardScale.value = withTiming(isActive ? 1.05 : 0.9);
        cardOpacity.value = withTiming(isActive ? 1 : isPast ? 0.3 : 0.5);
    }, [isActive, isPast]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
        // Active card gets wider visual prominence? 
        // For simplicity, keep width uniform but scale up
    }));

    const progressWidth = `${Math.min(100, Math.max(0, progress * 100))}%`;

    return (
        <Animated.View style={[styles.card, animatedStyle, { borderColor: segment.color }]}>
            <View style={[styles.progressBar, { backgroundColor: segment.color, width: progressWidth as any, opacity: 0.3 }]} />

            <View style={styles.cardContent}>
                <Text style={[styles.typeLabel, { color: segment.color }]}>{segment.type.toUpperCase()}</Text>
                <Text style={styles.durationLabel}>{formatTime(segment.durationSec)}</Text>
            </View>

            {/* Active Indicator Border */}
            {isActive && (
                <View style={[styles.activeBorder, { borderColor: segment.color }]} />
            )}
        </Animated.View>
    );
}

function formatTime(sec: number) {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: {
        height: 60,
        backgroundColor: 'transparent', // Remove the bulky dark background
        justifyContent: 'center',
    },
    mask: {
        overflow: 'hidden',
        width: width,
        paddingLeft: width * 0.4, // Center a bit better for smaller cards
    },
    track: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    card: {
        width: SEGMENT_WIDTH,
        height: 50,
        backgroundColor: 'rgba(30, 41, 59, 0.8)', // Glassy feel
        borderRadius: 12,
        marginRight: SPACING,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardContent: {
        alignItems: 'center',
        zIndex: 2,
    },
    typeLabel: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
    },
    durationLabel: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    progressBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 1,
    },
    activeBorder: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderWidth: 2,
        borderRadius: 16,
    }
});
