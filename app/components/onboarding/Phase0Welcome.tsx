import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    Animated,
} from 'react-native';
import { Image } from 'expo-image';
import {
    ArrowRight,
} from 'lucide-react-native';

const COLORS = {
    coral: '#FF6B6B',
    white: '#FFFFFF',
    textMain: '#1F2937', // Dark Grey
};

interface Phase0Props {
    onNext: () => void;
    onLogin: () => void;
    onInviteCode: () => void;
}

export default function Phase0Welcome({ onNext, onLogin, onInviteCode }: Phase0Props) {
    // Animation Values for welcome screen
    const fadeButton = useRef(new Animated.Value(0)).current;
    const scaleButton = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeButton, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(scaleButton, { toValue: 1, friction: 5, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <View style={{ flex: 1, width: '100%', backgroundColor: COLORS.white }}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.welcomeContainer}>
                    {/* Image Section - Flexes to fill space */}
                    <Animated.View style={styles.imageSection}>
                        <Image
                            source={require('../../assets/Realhero.png')}
                            style={styles.heroImage}
                            contentFit="contain"
                            transition={0}
                        />
                        <Text style={styles.heroHeadline}>
                            The #1 Fitness App Made for Couples
                        </Text>
                        <Animated.View style={[styles.buttonSection, { opacity: fadeButton, transform: [{ scale: scaleButton }] }]}>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                activeOpacity={0.8}
                                onPress={onNext}
                            >
                                <Text style={styles.buttonText}>Get Started</Text>
                                <ArrowRight color="white" size={20} strokeWidth={3} />
                            </TouchableOpacity>
                            <View style={styles.linkRow}>
                                <TouchableOpacity onPress={onLogin} activeOpacity={0.7}>
                                    <Text style={styles.linkText}>Log in</Text>
                                </TouchableOpacity>
                                <Text style={styles.linkDivider}>•</Text>
                                <TouchableOpacity onPress={onInviteCode} activeOpacity={0.7}>
                                    <Text style={styles.linkText}>Have an invite code?</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    welcomeContainer: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 28,
        paddingBottom: 20,
        justifyContent: 'space-between',
        backgroundColor: 'transparent',
    },
    imageSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    heroImage: {
        width: '100%',
        height: '70%',
    },
    heroHeadline: {
        marginTop: 12,
        textAlign: 'center',
        fontSize: 30,
        lineHeight: 35,
        fontWeight: '900',
        color: COLORS.textMain,
        letterSpacing: -0.5,
    },
    buttonSection: {
        width: '100%',
        marginTop: 18,
    },
    primaryButton: {
        backgroundColor: COLORS.coral,
        height: 54,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: COLORS.coral,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    linkRow: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    linkText: {
        color: COLORS.coral,
        fontSize: 15,
        fontWeight: '700',
    },
    linkDivider: {
        color: '#D1D5DB',
        fontSize: 15,
    },
});
