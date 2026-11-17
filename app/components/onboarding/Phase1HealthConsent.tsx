import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Check, Footprints, Lock, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { requestStepPermissions } from '../../lib/requestStepPermissions';
import { C, EASE_OUT, OnboardingScreen, ScreenTitle, pop, rise, useCompact } from './OnboardingKit';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const PULSE_LENGTH = 90;

const BENEFITS: { title: string; icon: LucideIcon }[] = [
    { title: 'Step Analysis', icon: Footprints },
    { title: 'Privacy First', icon: ShieldCheck },
    { title: 'Delete Anytime', icon: Trash2 },
];

interface Phase1Props {
    onNext: () => void;
    onBack?: () => void;
}

export default function Phase1HealthConsent({ onNext, onBack }: Phase1Props) {
    const compact = useCompact();
    const [requestingPermission, setRequestingPermission] = useState(false);

    const handleEnableAccess = async () => {
        if (requestingPermission) return;

        try {
            setRequestingPermission(true);
            await requestStepPermissions();
        } catch (err: any) {
            // Apple requires that tapping the primary CTA after a custom pre-prompt always proceeds past the screen.
            console.warn('Health permission request error:', err?.message);
        } finally {
            setRequestingPermission(false);
            onNext();
        }
    };

    return <OnboardingScreen onBack={onBack} showBrand ctaLabel="Continue" onCta={handleEnableAccess} ctaLoading={requestingPermission}>
        <Animated.View entering={pop(60)} style={[styles.tile, compact ? styles.tileCompact : { marginTop: 28 }]}>
            <BeatingHeart size={compact ? 52 : 60} />
        </Animated.View>

        <ScreenTitle lead="Your Body, Your " accent="Data" sparkles delay={140} style={{ marginTop: compact ? 20 : 32 }} />

        <View style={{ marginTop: compact ? 20 : 32, gap: compact ? 10 : 14 }}>
            {BENEFITS.map(({ title, icon: Icon }, index) => (
                <Animated.View key={title} entering={rise(240 + index * 70)} style={[styles.card, compact && styles.cardCompact]} accessible accessibilityLabel={title}>
                    <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
                        <Icon color={C.coral} size={compact ? 24 : 26} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
                    <Animated.View entering={pop(620 + index * 90)} style={styles.check}>
                        <Check color={C.white} size={18} strokeWidth={3.4} />
                    </Animated.View>
                </Animated.View>
            ))}
        </View>

        <Animated.View entering={rise(500)} style={[styles.footnote, { marginTop: compact ? 16 : 24 }]}>
            <Lock color={FOOTNOTE} size={16} strokeWidth={2.2} />
            <Text style={styles.footnoteText}>Only step data is requested.</Text>
        </Animated.View>

        <View style={styles.spacer} />
    </OnboardingScreen>;
}

function BeatingHeart({ size }: { size: number }) {
    const reduced = useReducedMotion();
    const pulse = useSharedValue(reduced ? 1 : 0);
    const beat = useSharedValue(1);

    useEffect(() => {
        if (reduced) return;
        pulse.set(withDelay(420, withTiming(1, { duration: 760, easing: EASE_OUT })));
        beat.set(withDelay(900, withRepeat(withSequence(
            withTiming(1.1, { duration: 140, easing: EASE_OUT }),
            withTiming(1, { duration: 160, easing: EASE_OUT }),
            withTiming(1.06, { duration: 120, easing: EASE_OUT }),
            withTiming(1, { duration: 240, easing: EASE_OUT }),
            withTiming(1, { duration: 1700 }),
        ), -1)));
        return () => cancelAnimation(beat);
    }, [reduced, pulse, beat]);

    const pulseProps = useAnimatedProps(() => ({ strokeDashoffset: PULSE_LENGTH * (1 - pulse.get()) }));
    const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));

    return <Animated.View style={beatStyle} accessible={false}>
        <Svg width={size} height={size} viewBox="0 0 64 64">
            <Defs>
                <LinearGradient id="heart" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FF7B7B" />
                    <Stop offset="1" stopColor="#F0303F" />
                </LinearGradient>
            </Defs>
            <Path
                d="M32 56 C30 54 6 40 6 22 C6 13 13 7 21 7 C26 7 30 10 32 14 C34 10 38 7 43 7 C51 7 58 13 58 22 C58 40 34 54 32 56 Z"
                fill="url(#heart)"
            />
            <Path d="M13 21 C13 16 16 13 20 12" stroke={C.white} strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" fill="none" />
            <AnimatedPath
                d="M10 32 L22 32 L26 25 L31 40 L36 22 L40 32 L54 32"
                stroke={C.white}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={`${PULSE_LENGTH} ${PULSE_LENGTH}`}
                animatedProps={pulseProps}
            />
        </Svg>
    </Animated.View>;
}

const FOOTNOTE = 'rgba(8, 36, 55, 0.5)';

const styles = StyleSheet.create({
    tile: { width: 96, height: 96, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderCurve: 'continuous', backgroundColor: C.white, boxShadow: '0 10px 28px rgba(8, 36, 55, 0.08)' },
    tileCompact: { width: 84, height: 84, borderRadius: 24, marginTop: 12 },
    card: { minHeight: 72, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1.5, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.78)', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 18, gap: 16, boxShadow: '0 6px 18px rgba(8, 36, 55, 0.05)' },
    cardCompact: { minHeight: 64 },
    iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white, boxShadow: '0 4px 12px rgba(8, 36, 55, 0.08)' },
    iconCircleCompact: { width: 44, height: 44, borderRadius: 22 },
    cardTitle: { flex: 1, color: C.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
    check: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.coral, alignItems: 'center', justifyContent: 'center' },
    footnote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    footnoteText: { color: FOOTNOTE, fontSize: 15, fontWeight: '600' },
    spacer: { flexGrow: 1, minHeight: 16 },
});
