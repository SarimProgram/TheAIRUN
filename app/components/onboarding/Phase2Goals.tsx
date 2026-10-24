import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    Keyboard,
} from 'react-native';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height: windowHeight } = Dimensions.get('window');
const height = Math.min(windowHeight, 800);
const isCompact = windowHeight <= 740;

const COLORS = {
    brand: '#FF3B3B',
    brandDark: '#D62F2F',
    ink: '#121212',
    white: '#FFFFFF',
    muted: '#999999',
    line: '#F0F0F0',
};

export default function Phase2Goals({ onNext, onBack, prefilledName }: any) {
    const trimmedPrefilled = typeof prefilledName === 'string' ? prefilledName.trim() : '';
    const hasPrefilledName = trimmedPrefilled.length > 0;
    const [name, setName] = useState(trimmedPrefilled);
    const [gender, setGender] = useState<string | null>(null);
    const genderOptions = [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
    ];

    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: 0.25,
            duration: 1000,
            useNativeDriver: false,
        }).start();
    }, [progressAnim]);

    const canContinue = name.trim().length > 0 && !!gender;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <View style={styles.progressContainer}>
                    <Animated.View
                        style={[
                            styles.progressBar,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                }),
                            },
                        ]}
                    />
                </View>

                <SafeAreaView>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ChevronLeft color={COLORS.white} size={28} />
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
                <View style={styles.content}>
                    <ScrollView
                        style={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        bounces={false}
                    >
                        <View style={styles.textGroup}>
                            <Text style={styles.welcomeText}>Let&apos;s get started!</Text>
                            <Text style={styles.mainTitle}>Tell us about you</Text>
                        </View>

                        {!hasPrefilledName && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.fieldLabel}>YOUR NAME</Text>
                                <TextInput
                                    style={styles.mainInput}
                                    placeholder="Enter your name"
                                    placeholderTextColor={COLORS.muted}
                                    value={name}
                                    onChangeText={setName}
                                    selectionColor={COLORS.brand}
                                    returnKeyType="done"
                                    onSubmitEditing={Keyboard.dismiss}
                                />
                                <View style={styles.underline} />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.fieldLabel}>CHOOSE ONE</Text>
                            <View style={styles.genderRow}>
                                {genderOptions.map((opt) => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => setGender(opt.value)}
                                        style={[
                                            styles.pill,
                                            gender === opt.value && styles.pillActive,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.pillText,
                                                gender === opt.value && styles.pillTextActive,
                                            ]}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                    <TouchableOpacity
                        disabled={!canContinue}
                        onPress={() => onNext(name, gender)}
                        style={[styles.mainButton, !canContinue && styles.mainButtonDisabled]}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={
                                canContinue ? [COLORS.brand, COLORS.brandDark] : ['#E5E7EB', '#D1D5DB']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientButton}
                        >
                            <Text style={[styles.nextBtnText, !canContinue && styles.nextBtnTextDisabled]}>
                                Let&apos;s go
                            </Text>
                            <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
                        </LinearGradient>
                    </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    flex: {
        flex: 1,
    },
    hero: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.4,
        paddingHorizontal: 25,
    },
    progressContainer: {
        height: 3,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.white,
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
        marginTop: height * 0.2,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: Platform.OS === 'ios' ? 16 : 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 8,
    },
    textGroup: {
        marginBottom: isCompact ? 18 : 22,
        alignItems: 'center',
        width: '100%',
    },
    welcomeText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.brand,
        marginBottom: 4,
        textAlign: 'center',
    },
    mainTitle: {
        fontSize: isCompact ? 28 : 30,
        fontWeight: '900',
        color: COLORS.ink,
        letterSpacing: -1,
        lineHeight: isCompact ? 32 : 34,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: isCompact ? 18 : 22,
        width: '100%',
        alignItems: 'center',
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.muted,
        letterSpacing: 1.5,
        marginBottom: 10,
        textAlign: 'center',
    },
    mainInput: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.ink,
        paddingVertical: 8,
        width: '100%',
        textAlign: 'center',
    },
    underline: {
        height: 1.5,
        backgroundColor: COLORS.line,
        marginTop: 5,
        alignSelf: 'stretch',
    },
    genderRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    pill: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#FAFAFA',
        borderWidth: 1.5,
        borderColor: '#F0F0F0',
    },
    pillActive: {
        backgroundColor: '#FFF0F0',
        borderColor: COLORS.brand,
    },
    pillText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.muted,
    },
    pillTextActive: {
        color: COLORS.brand,
    },
    footer: {
        paddingTop: 12,
        marginTop: 'auto',
    },
    mainButton: {
        height: 58,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: COLORS.brand,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 6,
    },
    mainButtonDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
    gradientButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    nextBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    nextBtnTextDisabled: {
        color: '#9CA3AF',
    },
});
