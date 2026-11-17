import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Droplets } from 'lucide-react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

export const WATER_BOTTLE_ASPECT = 2.35;
const MAX_LEVEL = 0.84;

type WaterBottleProps = {
    width: number;
    /** 0 = empty, 1 = full. Defaults to full. */
    fill?: SharedValue<number>;
};

export function WaterBottle({ width, fill }: WaterBottleProps) {
    const height = Math.round(width * WATER_BOTTLE_ASPECT);
    const capHeight = Math.round(height * 0.11);
    const neckHeight = Math.round(height * 0.06);
    const bodyHeight = height - capHeight - neckHeight;

    const waterStyle = useAnimatedStyle(() => {
        const level = (fill ? fill.value : 1) * MAX_LEVEL;
        return { transform: [{ translateY: (1 - level) * bodyHeight }] };
    });

    return (
        <View style={{ width, height, alignItems: 'center' }}>
            <View
                style={[
                    styles.cap,
                    { width: width * 0.52, height: capHeight, borderRadius: Math.max(4, width * 0.08) },
                ]}
            >
                <View style={[styles.capRidge, { top: capHeight * 0.3 }]} />
                <View style={[styles.capRidge, { top: capHeight * 0.6 }]} />
            </View>
            <View style={[styles.neck, { width: width * 0.42, height: neckHeight }]} />
            <View
                style={[
                    styles.body,
                    {
                        width,
                        height: bodyHeight,
                        borderTopLeftRadius: width * 0.32,
                        borderTopRightRadius: width * 0.32,
                        borderBottomLeftRadius: width * 0.24,
                        borderBottomRightRadius: width * 0.24,
                    },
                ]}
            >
                <Animated.View style={[StyleSheet.absoluteFill, waterStyle]}>
                    <LinearGradient
                        colors={['#7DD3FC', '#38BDF8', '#0284C7']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.waterSurface} />
                </Animated.View>
                <View
                    style={[
                        styles.label,
                        { top: bodyHeight * 0.4, height: bodyHeight * 0.2 },
                    ]}
                >
                    <Droplets size={Math.max(10, width * 0.24)} color="#0284C7" strokeWidth={2.4} />
                </View>
                <View
                    style={[
                        styles.glare,
                        {
                            left: width * 0.14,
                            top: bodyHeight * 0.1,
                            width: Math.max(3, width * 0.09),
                            height: bodyHeight * 0.62,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    cap: {
        backgroundColor: '#0369A1',
        borderCurve: 'continuous',
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
        overflow: 'hidden',
    },
    capRidge: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1.5,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    neck: {
        backgroundColor: 'rgba(224,242,254,0.92)',
        borderLeftWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
    },
    body: {
        overflow: 'hidden',
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.95)',
        backgroundColor: 'rgba(224,242,254,0.55)',
    },
    waterSurface: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.65)',
    },
    label: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glare: {
        position: 'absolute',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
});
