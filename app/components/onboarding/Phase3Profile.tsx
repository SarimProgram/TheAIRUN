/* eslint-disable react/no-unescaped-entities */
import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    SafeAreaView,
    StatusBar,
    Dimensions,
} from 'react-native';
import { ChevronLeft, Users, Plus, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const COLORS = {
    brand: '#FF3B3B', // Vibrant high-energy red
    brandDark: '#D62F2F',
    ink: '#121212',
    white: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.95)',
    border: '#F0F0F0',
    muted: '#999999',
};

export default function Phase3Neo({ userName, onBack, onHaveCode, onFirstTime }: any) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 20, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* 1. Dynamic Gradient Header */}
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <SafeAreaView>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ChevronLeft color={COLORS.white} size={28} />
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            {/* 2. Floating Content Content */}
            <Animated.View 
                style={[
                    styles.content, 
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                ]}
            >
                <View style={styles.textGroup}>
                    <Text style={styles.welcomeText}>Hey {userName || 'Runner'},</Text>
                    <Text style={styles.mainTitle}>Ready to start?</Text>
                    <Text style={styles.subTitle}>Select how you'd like to join the community.</Text>
                </View>

                <View style={styles.buttonStack}>
                    {/* Primary Action */}
                    <TouchableOpacity 
                        onPress={onHaveCode} 
                        activeOpacity={0.9} 
                        style={styles.primaryBtn}
                    >
                        <View style={styles.btnIconWrap}>
                            <Users color={COLORS.brand} size={24} />
                        </View>
                        <View style={styles.btnTextWrap}>
                            <Text style={styles.primaryBtnTitle}>I have a code</Text>
                            <Text style={styles.primaryBtnSub}>Join your partner's plan</Text>
                        </View>
                        <ArrowRight color={COLORS.brand} size={20} />
                    </TouchableOpacity>

                    {/* Secondary Action */}
                    <TouchableOpacity 
                        onPress={onFirstTime} 
                        activeOpacity={0.8} 
                        style={styles.secondaryBtn}
                    >
                        <View style={[styles.btnIconWrap, { backgroundColor: '#F5F5F5' }]}>
                            <Plus color={COLORS.ink} size={24} />
                        </View>
                        <View style={styles.btnTextWrap}>
                            <Text style={styles.secondaryBtnTitle}>First time here</Text>
                            <Text style={styles.secondaryBtnSub}>Create a new couple plan</Text>
                        </View>
                        <ArrowRight color={COLORS.muted} size={20} />
                    </TouchableOpacity>
                </View>
            </Animated.View>

           
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    hero: {
        height: height * 0.4,
        paddingHorizontal: 25,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 22,
        marginTop: 10,
    },
    content: {
        flex: 1,
        marginTop: -height * 0.15, // Pull content up into the red hero
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingHorizontal: 30,
        paddingTop: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    textGroup: {
        marginBottom: 40,
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.brand,
        marginBottom: 4,
    },
    mainTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1,
    },
    subTitle: {
        fontSize: 16,
        color: COLORS.muted,
        marginTop: 10,
        lineHeight: 24,
    },
    buttonStack: {
        gap: 16,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 20,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: COLORS.brand,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    btnIconWrap: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: '#FFF0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnTextWrap: {
        flex: 1,
        marginLeft: 15,
    },
    primaryBtnTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.ink,
    },
    primaryBtnSub: {
        fontSize: 14,
        color: COLORS.brand,
        fontWeight: '500',
    },
    secondaryBtnTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.ink,
    },
    secondaryBtnSub: {
        fontSize: 14,
        color: COLORS.muted,
    },
    brandTag: {
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '800',
        color: '#EEEEEE',
        letterSpacing: 2,
        marginBottom: 30,
    }
});
