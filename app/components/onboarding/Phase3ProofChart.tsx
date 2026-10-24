import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    SafeAreaView,
    TouchableOpacity,
    Animated,
    Easing,
    StatusBar,
    Dimensions,
    Platform,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { ChevronLeft } from 'lucide-react-native';

const { width: windowWidth } = Dimensions.get('window');
const isTablet = Platform.OS === 'ios' ? Platform.isPad : windowWidth >= 600;
const width = isTablet ? 480 : windowWidth;

const COLORS = {
    brand: '#FF3B3B',
    brandDark: '#D62F2F',
    brandSoft: '#FFF5F5',
    ink: '#121212',
    white: '#FFFFFF',
    border: '#E8ECF0',
    borderStrong: '#E2E8F0',
    grid: '#B8C4D4',
    gridStrong: '#94A3B8',
    surface: '#F5F5F7',
    surfaceStrong: '#EDEEF2',
    muted: '#64748B',
    mutedStrong: '#94A3B8',
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const CHART_WIDTH = Math.min(width - 120, 280);
const CHART_HEIGHT = 180;
const ALONE_PATH_LEN = 520;
const RUN_PATH_LEN = 470;
const DRAW_EASE = Easing.bezier(0.22, 1, 0.36, 1);

// Y positions: 40 = top (high), 150 = bottom (low)
const Y_TOP = 40;
const Y_BOTTOM = 150;
const X_LEFT = 20;
const X_RIGHT = CHART_WIDTH - 20;

const GRID_H_LINES = [0.16, 0.32, 0.48, 0.64, 0.8].map(
    (t) => Y_TOP + (Y_BOTTOM - Y_TOP) * t,
);
const GRID_V_LINES = [0.2, 0.4, 0.6, 0.8].map(
    (t) => X_LEFT + (X_RIGHT - X_LEFT) * t,
);

// RunTogether curve (brand) — slow start, then compounding S-curve ending high.
const RUN_PATH = `M ${X_LEFT} ${Y_BOTTOM} C ${CHART_WIDTH * 0.18} ${Y_BOTTOM - 4}, ${CHART_WIDTH * 0.28} ${Y_BOTTOM - 18}, ${CHART_WIDTH * 0.38} ${Y_BOTTOM - 12} S ${CHART_WIDTH * 0.58} ${Y_TOP + 55}, ${CHART_WIDTH * 0.68} ${Y_TOP + 38} S ${CHART_WIDTH * 0.82} ${Y_TOP + 18}, ${X_RIGHT} ${Y_TOP}`;

// Alone curve (gray) — sharp burst, early peak, wobble, then fades back down.
const ALONE_PATH = `M ${X_LEFT} ${Y_BOTTOM} C ${CHART_WIDTH * 0.1} ${Y_TOP + 52}, ${CHART_WIDTH * 0.22} ${Y_TOP + 18}, ${CHART_WIDTH * 0.34} ${Y_TOP + 32} S ${CHART_WIDTH * 0.48} ${Y_BOTTOM - 38}, ${CHART_WIDTH * 0.56} ${Y_BOTTOM - 22} S ${CHART_WIDTH * 0.68} ${Y_TOP + 48}, ${CHART_WIDTH * 0.76} ${Y_BOTTOM - 30} S ${CHART_WIDTH * 0.88} ${Y_BOTTOM - 8}, ${X_RIGHT} ${Y_BOTTOM - 20}`;

const RUN_END = { x: X_RIGHT, y: Y_TOP };
const ALONE_END = { x: X_RIGHT, y: Y_BOTTOM - 20 };

interface Props {
    onContinue: () => void;
    onBack: () => void;
    userName?: string;
}

export default function Phase3ProofChart({ onContinue, onBack, userName }: Props) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    const grayDraw = useRef(new Animated.Value(0)).current;
    const brandDraw = useRef(new Animated.Value(0)).current;
    const dotOpacity = useRef(new Animated.Value(0)).current;
    const dotScale = useRef(new Animated.Value(0.6)).current;

    const grayStrokeDashoffset = grayDraw.interpolate({
        inputRange: [0, 1],
        outputRange: [ALONE_PATH_LEN, 0],
    });
    const brandStrokeDashoffset = brandDraw.interpolate({
        inputRange: [0, 1],
        outputRange: [RUN_PATH_LEN, 0],
    });

    useEffect(() => {
        Animated.parallel([
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(grayDraw, {
                    toValue: 1,
                    duration: 2600,
                    easing: DRAW_EASE,
                    useNativeDriver: false,
                }),
                Animated.sequence([
                    Animated.delay(280),
                    Animated.timing(brandDraw, {
                        toValue: 1,
                        duration: 3000,
                        easing: DRAW_EASE,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.sequence([
                    Animated.delay(3100),
                    Animated.parallel([
                        Animated.spring(dotOpacity, {
                            toValue: 1,
                            friction: 7,
                            tension: 90,
                            useNativeDriver: true,
                        }),
                        Animated.spring(dotScale, {
                            toValue: 1,
                            friction: 7,
                            tension: 90,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]),
        ]).start();
    }, [brandDraw, dotOpacity, dotScale, fadeAnim, grayDraw, slideAnim]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                        <ChevronLeft color={COLORS.ink} size={30} />
                    </TouchableOpacity>
                </View>

                <Animated.View
                    style={[
                        styles.content,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <Text style={styles.title}>
                        Better results{'\n'}with RunTogether
                    </Text>

                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>
                            {userName ? `${userName}'s progress with a plan` : 'Your progress with a plan'}
                        </Text>

                        <View style={styles.chartWrap}>
                            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                                {GRID_H_LINES.map((y, i) => (
                                    <Line
                                        key={`grid-h-${i}`}
                                        x1={X_LEFT}
                                        y1={y}
                                        x2={X_RIGHT}
                                        y2={y}
                                        stroke={COLORS.grid}
                                        strokeWidth={1.5}
                                        opacity={0.9}
                                    />
                                ))}
                                {GRID_V_LINES.map((x, i) => (
                                    <Line
                                        key={`grid-v-${i}`}
                                        x1={x}
                                        y1={Y_TOP}
                                        x2={x}
                                        y2={Y_BOTTOM}
                                        stroke={COLORS.grid}
                                        strokeWidth={1.5}
                                        opacity={0.9}
                                    />
                                ))}
                                <Line
                                    x1={X_LEFT}
                                    y1={Y_TOP}
                                    x2={X_RIGHT}
                                    y2={Y_TOP}
                                    stroke={COLORS.gridStrong}
                                    strokeWidth={1.5}
                                    opacity={0.55}
                                />
                                <Line
                                    x1={X_LEFT}
                                    y1={Y_TOP}
                                    x2={X_LEFT}
                                    y2={Y_BOTTOM}
                                    stroke={COLORS.gridStrong}
                                    strokeWidth={1.5}
                                    opacity={0.55}
                                />
                                <Line
                                    x1={X_RIGHT}
                                    y1={Y_TOP}
                                    x2={X_RIGHT}
                                    y2={Y_BOTTOM}
                                    stroke={COLORS.gridStrong}
                                    strokeWidth={1.5}
                                    opacity={0.55}
                                />
                                {/* Baseline */}
                                <Path
                                    d={`M ${X_LEFT} ${Y_BOTTOM} L ${X_RIGHT} ${Y_BOTTOM}`}
                                    stroke={COLORS.gridStrong}
                                    strokeWidth={2}
                                    fill="none"
                                />
                                {/* Alone (gray) — draws first, sits on the back */}
                                <AnimatedPath
                                    d={ALONE_PATH}
                                    stroke={COLORS.mutedStrong}
                                    strokeWidth={3}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray={ALONE_PATH_LEN}
                                    strokeDashoffset={grayStrokeDashoffset}
                                />
                                {/* RunTogether (brand) — draws on top */}
                                <AnimatedPath
                                    d={RUN_PATH}
                                    stroke={COLORS.brand}
                                    strokeWidth={4}
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray={RUN_PATH_LEN}
                                    strokeDashoffset={brandStrokeDashoffset}
                                />
                            </Svg>

                            {/* Endpoint dots */}
                            <Animated.View
                                style={[
                                    styles.endDot,
                                    styles.endDotBrand,
                                    {
                                        top: RUN_END.y - 7,
                                        left: RUN_END.x - 7,
                                        opacity: dotOpacity,
                                        transform: [{ scale: dotScale }],
                                    },
                                ]}
                            />
                            <Animated.View
                                style={[
                                    styles.endDot,
                                    styles.endDotGray,
                                    {
                                        top: ALONE_END.y - 5,
                                        left: ALONE_END.x - 5,
                                        opacity: dotOpacity,
                                        transform: [{ scale: dotScale }],
                                    },
                                ]}
                            />
                        </View>

                        <View style={styles.axisRow}>
                            <Text style={styles.axisText}>Week 1</Text>
                            <Text style={styles.axisText}>Week 6</Text>
                        </View>

                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.brand }]} />
                                <Text style={styles.legendText}>RunTogether</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: COLORS.mutedStrong }]} />
                                <Text style={styles.legendText}>On your own</Text>
                            </View>
                        </View>

                        <Text style={styles.stat}>
                            People with a plan are 3× more likely to reach their goal.
                        </Text>
                    </View>
                </Animated.View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        onPress={onContinue}
                        activeOpacity={0.9}
                        style={styles.continueBtn}
                    >
                        <Text style={styles.continueText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    safe: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 16,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -0.8,
        lineHeight: 34,
        marginBottom: 0,
        alignSelf: 'stretch',
        textAlign: 'left',
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        paddingVertical: 22,
        paddingHorizontal: 20,
        marginTop: 'auto',
        marginBottom: 'auto',
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    cardLabel: {
        alignSelf: 'flex-start',
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.ink,
        marginBottom: 8,
    },
    chartWrap: {
        width: CHART_WIDTH,
        height: CHART_HEIGHT,
        alignSelf: 'center',
        position: 'relative',
        marginTop: 4,
    },
    endDot: {
        position: 'absolute',
        borderRadius: 999,
    },
    endDotBrand: {
        width: 14,
        height: 14,
        backgroundColor: COLORS.brand,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    endDotGray: {
        width: 10,
        height: 10,
        backgroundColor: COLORS.mutedStrong,
        borderWidth: 2,
        borderColor: COLORS.white,
    },
    axisRow: {
        width: CHART_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingHorizontal: 4,
    },
    axisText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.muted,
    },
    legendRow: {
        flexDirection: 'row',
        gap: 18,
        marginTop: 18,
        marginBottom: 12,
        alignSelf: 'center',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.ink,
    },
    stat: {
        fontSize: 13,
        color: COLORS.muted,
        textAlign: 'center',
        lineHeight: 19,
        marginTop: 4,
        paddingHorizontal: 8,
        fontWeight: '500',
    },
    footer: {
        paddingHorizontal: 28,
        paddingBottom: Platform.OS === 'ios' ? 20 : 24,
        paddingTop: 12,
    },
    continueBtn: {
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.ink,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
});
