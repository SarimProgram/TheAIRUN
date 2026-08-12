import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Animated,
    Dimensions,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAccessToken } from '../../lib/authToken';
import { API_BASE_URL } from '../../config/api';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { upsertTrainingProfile } from '@/db/offlineDb';
import { setAnalyticsUserProperties, trackEvent } from '@/src/analytics/analytics';
import {
    loadOnboardingCheckpoint,
    markOnboardingComplete,
    saveOnboardingProgress,
} from '@/src/onboarding/checkpoint';

// Import phase components
import Phase0Welcome from '../../components/onboarding/Phase0Welcome';
import Phase0Auth from '../../components/onboarding/Phase0Auth';
import Phase0ManualAuth from '../../components/onboarding/Phase0ManualAuth';
import Phase0ManualLogin from '../../components/onboarding/Phase0ManualLogin';
import Phase1HealthConsent from '../../components/onboarding/Phase1HealthConsent';
import Phase2Goals from '../../components/onboarding/Phase2Goals';
import Phase3Profile from '../../components/onboarding/Phase3Profile';
import Phase4PartnerCode from '../../components/onboarding/Phase4PartnerCode';
import Phase4Complete from '../../components/onboarding/Phase4Complete';
import Phase5Dummy from '../../components/onboarding/5_PrimaryGoal';
import WeightHeightSelection from '../../components/onboarding/6_Weight&Height';
import TargetWeight from '../../components/onboarding/7_TargetWeight';
import JourneyTypeSelection from '../../components/onboarding/8_StartingPoint';
import AvailableDays from '../../components/onboarding/10_AvailableDays';
import Phase12Promo from '../../components/onboarding/9_PromoCouple';
import PreferredTime from '../../components/onboarding/11_PreferredTime';
import MarketplaceHowItWorks from '../../components/onboarding/12_PromoHowto';
import MarketplaceMotivation from '../../components/onboarding/13_OwnReward';
import Phase16Dummy from '../../components/onboarding/Phase16Dummy';
import Phase17Dummy from '../../components/onboarding/Phase17Dummy';
import Phase18PlanSetup from '../../components/onboarding/Phase18PlanSetup';
import Phase19PlanTimeline from '../../components/onboarding/Phase19PlanTimeline';
import WeightBranch from '../../components/onboarding/Weight_Branch';
import RunningBranch from '../../components/onboarding/Running_Branch';
import Phase20RunningHabits from '../../components/onboarding/Phase20RunningHabits';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const isTablet = Platform.OS === 'ios' ? Platform.isPad : windowWidth >= 600;
const width = isTablet ? 480 : windowWidth;
const height = isTablet ? 800 : windowHeight;

const COLORS = {
    coral: '#FF6B6B',
    white: '#FFFFFF',
    textMain: '#1F2937', // Dark Grey
    textSub: '#6B7280',  // Light Grey
    iconBg: '#FFF0F0',   // Light Coral Wash
};
const TOTAL_PHASES = 24;
const DEV_LAST_PHASE = 24;
const DEV_PHASE_FILE_NAMES: Record<number, string> = {
    0: 'Phase0Welcome.tsx',
    1: 'Phase0Auth.tsx',
    2: 'Phase1HealthConsent.tsx',
    3: 'Phase2Goals.tsx',
    4: 'Phase3Profile.tsx',
    5: '5_PrimaryGoal.tsx',
    6: 'Phase4Complete.tsx',
    7: '6_Weight&Height.tsx',
    8: '7_TargetWeight.tsx',
    9: '8_StartingPoint.tsx',
    10: 'Phase19PlanTimeline.tsx',
    11: 'Phase18PlanSetup.tsx',
    12: '10_AvailableDays.tsx',
    13: '9_PromoCouple.tsx',
    14: '11_PreferredTime.tsx',
    15: '12_PromoHowto.tsx',
    16: '13_OwnReward.tsx',
    17: 'Phase16Dummy.tsx',
    18: 'Phase17Dummy.tsx',
    19: 'Weight_Branch.tsx',
    20: 'Running_Branch.tsx',
    21: 'Phase20RunningHabits.tsx',
    22: 'Phase0ManualAuth.tsx',
    23: 'Phase4PartnerCode.tsx',
    24: 'Phase0ManualLogin.tsx',
};
const TRAINING_TIME_PREFERENCE_KEY = 'plans_training_time_preference_v1';
const APPLE_DISPLAY_NAME_KEY = 'apple_display_name_v1';

function getDeviceTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function normalizeGenderEnum(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? '';
}

export default function OnboardingGreeting() {
    const navigation = useNavigation();
    const router = useRouter();
    const { setTabBarVisible } = useTabBar();
    const { socialLogin, login, register, authFetch, user, isAuthenticated } = useAuth();
    const { hasAccess } = useEntitlement();
    const [currentPhase, setCurrentPhase] = useState(0);
    const [userName, setUserName] = useState('');
    const [userGender, setUserGender] = useState('');
    const [availableDays, setAvailableDays] = useState<number[]>([0, 2, 4]);
    const [userGoal, setUserGoal] = useState<string | null>(null);
    const [userAge, setUserAge] = useState<number | string>('');
    const [userWeight, setUserWeight] = useState<number | string>('');
    const [userWeightUnit, setUserWeightUnit] = useState<string>('kg');
    const [userHeight, setUserHeight] = useState<number | string>('');
    const [userHeightUnit, setUserHeightUnit] = useState<string>('cm');
    const [userTargetWeight, setUserTargetWeight] = useState<number | string>('');
    const [isSplashVisible, setIsSplashVisible] = useState(false);
    const [socialLoading, setSocialLoading] = useState<'apple' | null>(null);

    // UserPlan specific states
    const [planData, setPlanData] = useState<any>({
        intensityLevel: 'ACTIVE',
        activityPreference: 'WALKING_RUNNING',
    });
    const [generatedWeeklyPlan, setGeneratedWeeklyPlan] = useState<any[]>([]);
    const [savingOnboardingCheckpoint, setSavingOnboardingCheckpoint] = useState(false);
    const [joinedWithCode, setJoinedWithCode] = useState(false);
    const [checkpointHydrated, setCheckpointHydrated] = useState(false);
    const deviceTimezone = useRef(getDeviceTimezone()).current;
    const wasAuthenticatedWhenMountedRef = useRef(isAuthenticated);
    const shouldPersistCheckpointRef = useRef(false);
    const onboardingCompletedRef = useRef(false);

    // Splash Animation Values
    const splashFade = useRef(new Animated.Value(1)).current;
    const textFade = useRef(new Animated.Value(0)).current;
    const textMove = useRef(new Animated.Value(20)).current;

    useFocusEffect(
        useCallback(() => {
            setTabBarVisible(false);
            return () => setTabBarVisible(true);
        }, [setTabBarVisible])
    );

    useEffect(() => {
        if (isSplashVisible) {
            Animated.sequence([
                Animated.delay(300),
                Animated.parallel([
                    Animated.timing(textFade, { toValue: 1, duration: 600, useNativeDriver: true }),
                    Animated.timing(textMove, { toValue: 0, duration: 600, useNativeDriver: true }),
                ]),
                Animated.delay(1500),
                Animated.timing(splashFade, { toValue: 0, duration: 800, useNativeDriver: true }),
            ]).start(() => {
                setIsSplashVisible(false);
            });
        }
    }, []);

    useEffect(() => {
        if (currentPhase === 0) {
            trackEvent('onboarding_started').catch(() => {});
        }
    }, [currentPhase]);

    useEffect(() => {
        let cancelled = false;

        loadOnboardingCheckpoint()
            .then((checkpoint) => {
                if (cancelled || !checkpoint) return;

                onboardingCompletedRef.current = checkpoint.completed;
                if (checkpoint.completed) return;

                shouldPersistCheckpointRef.current = true;
                setUserName(checkpoint.userName ?? '');
                setUserGender(checkpoint.userGender ?? '');
                setAvailableDays(Array.isArray(checkpoint.availableDays) ? checkpoint.availableDays : [0, 2, 4]);
                setUserGoal(checkpoint.userGoal ?? null);
                setUserAge(checkpoint.userAge ?? '');
                setUserWeight(checkpoint.userWeight ?? '');
                setUserWeightUnit(checkpoint.userWeightUnit ?? 'kg');
                setUserHeight(checkpoint.userHeight ?? '');
                setUserHeightUnit(checkpoint.userHeightUnit ?? 'cm');
                setUserTargetWeight(checkpoint.userTargetWeight ?? '');
                setPlanData(checkpoint.planData && typeof checkpoint.planData === 'object'
                    ? checkpoint.planData
                    : { intensityLevel: 'ACTIVE', activityPreference: 'WALKING_RUNNING' });
                setGeneratedWeeklyPlan(Array.isArray(checkpoint.generatedWeeklyPlan)
                    ? checkpoint.generatedWeeklyPlan
                    : []);
                setJoinedWithCode(!!checkpoint.joinedWithCode);
                setCurrentPhase(wasAuthenticatedWhenMountedRef.current && checkpoint.currentPhase > 1
                    ? Math.min(checkpoint.currentPhase, DEV_LAST_PHASE)
                    : Math.min(checkpoint.currentPhase, 1));
            })
            .finally(() => {
                if (!cancelled) setCheckpointHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (
            !checkpointHydrated ||
            !isAuthenticated ||
            !shouldPersistCheckpointRef.current ||
            onboardingCompletedRef.current
        ) {
            return;
        }

        saveOnboardingProgress({
            currentPhase,
            userName,
            userGender,
            availableDays,
            userGoal,
            userAge,
            userWeight,
            userWeightUnit,
            userHeight,
            userHeightUnit,
            userTargetWeight,
            planData,
            generatedWeeklyPlan,
            joinedWithCode,
        }).catch(() => {});
    }, [
        availableDays,
        checkpointHydrated,
        currentPhase,
        generatedWeeklyPlan,
        isAuthenticated,
        joinedWithCode,
        planData,
        userAge,
        userGender,
        userGoal,
        userHeight,
        userHeightUnit,
        userName,
        userTargetWeight,
        userWeight,
        userWeightUnit,
    ]);

    const hasExistingPlan = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/plan`);
            if (!res.ok) return false;

            const data = await res.json();
            const plan = data?.plan ?? data;

            if (!plan || typeof plan !== 'object') return false;

            const meaningfulPlanFields = [
                'goalType',
                'currentWeek',
                'availableDays',
                'weightKg',
                'targetWeightKg',
                'activityPreference',
                'intensityLevel',
                'startDate',
            ];

            return meaningfulPlanFields.some((key) => {
                const value = plan?.[key];
                if (Array.isArray(value)) return value.length > 0;
                return value !== null && value !== undefined && value !== '';
            });
        } catch (error) {
            console.error('Error checking existing plan:', error);
            return false;
        }
    }, [authFetch]);

    const continueAfterAuth = useCallback(async (_prefilledName?: string) => {
        const checkpoint = await loadOnboardingCheckpoint();
        if (checkpoint && !checkpoint.completed) {
            shouldPersistCheckpointRef.current = true;
            setCurrentPhase(checkpoint.currentPhase > 1
                ? Math.min(checkpoint.currentPhase, DEV_LAST_PHASE)
                : 2);
            return;
        }

        const shouldSkipOnboarding = await hasExistingPlan();

        if (shouldSkipOnboarding) {
            onboardingCompletedRef.current = true;
            await markOnboardingComplete();
            await trackEvent('onboarding_skipped_existing_plan');
            router.replace('/welcome');
            return;
        }

        shouldPersistCheckpointRef.current = true;
        setCurrentPhase(2);
    }, [hasExistingPlan, router]);

    const handleAppleAuth = async () => {
        if (socialLoading) return;

        if (Platform.OS !== 'ios') {
            Alert.alert('Apple Sign In', 'Apple Sign In is only available on iOS.');
            return;
        }

        try {
            const available = await AppleAuthentication.isAvailableAsync();
            if (!available) {
                Alert.alert('Apple Sign In Unavailable', 'Apple Sign In is not available on this device.');
                return;
            }

            setSocialLoading('apple');
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                throw new Error('Apple did not return an identity token.');
            }

            const appleName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .filter(Boolean)
                .join(' ')
                .trim();

            // Apple only returns fullName on the FIRST sign-in for a given Apple ID.
            // Persist it so we never re-prompt the user for their name (App Store Guideline 4).
            let resolvedName = appleName;
            if (!resolvedName) {
                try {
                    const stored = await AsyncStorage.getItem(APPLE_DISPLAY_NAME_KEY);
                    if (stored) resolvedName = stored;
                } catch {}
            } else {
                try {
                    await AsyncStorage.setItem(APPLE_DISPLAY_NAME_KEY, resolvedName);
                } catch {}
            }

            if (resolvedName) {
                setUserName(resolvedName);
            }

            await socialLogin('apple', credential.identityToken, resolvedName || userName.trim() || undefined);
            await continueAfterAuth(resolvedName);
        } catch (err: any) {
            if (err?.code === 'ERR_REQUEST_CANCELED') return;
            Alert.alert('Apple Login Failed', err?.message || 'Unable to continue with Apple.');
        } finally {
            setSocialLoading(null);
        }
    };

    const goToNextPhase = () => {
        if (isAuthenticated) shouldPersistCheckpointRef.current = true;
        if (currentPhase < TOTAL_PHASES - 1) {
            setCurrentPhase(prev => prev + 1);
        } else {
            handleFinalSubmit();
        }
    };

    const handleFinalSubmit = async () => {
        try {
            const token = await getAccessToken();
            const normalizedGender = normalizeGenderEnum(userGender);
            const payload: any = {
                displayName: userName,
                gender: normalizedGender,
                goalType: userGoal,
                age: userAge,
                units: userWeightUnit === 'kg' ? 'metric' : 'imperial',
                timezone: deviceTimezone,
            };

            // Map Weight
            if (userWeightUnit === 'kg') {
                payload.weightKg = Number(userWeight);
            } else {
                payload.weightLbs = Number(userWeight);
            }

            // Map Height
            if (userHeightUnit === 'cm') {
                payload.heightCm = Number(userHeight);
            } else {
                // Parse ft'in"
                const match = String(userHeight).match(/(\d+)'(\d+)"/);
                if (match) {
                    payload.heightFt = parseInt(match[1]);
                    payload.heightIn = parseInt(match[2]);
                }
            }

            // Map Target Weight
            if (userWeightUnit === 'kg') {
                payload.goalTarget = Number(userTargetWeight);
            } else {
                payload.goalTargetLbs = Number(userTargetWeight);
            }

            // --- SAVE PROFILE ---
            const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!profileResponse.ok) {
                console.error('Failed to save profile:', await profileResponse.text());
            }

            // --- SAVE PLAN ---
            const planPayload = {
                weightKg: userWeightUnit === 'kg' ? Number(userWeight) : Number(userWeight) * 0.453592,
                heightCm: userHeightUnit === 'cm' ? Number(userHeight) : (() => {
                    const match = String(userHeight).match(/(\d+)'(\d+)"/);
                    if (match) return Math.round((parseInt(match[1]) * 30.48) + (parseInt(match[2]) * 2.54));
                    return 170; // fallback
                })(),
                ageYears: Number(userAge),
                goalType: userGoal || 'both',
                targetWeightKg: userTargetWeight ? (userWeightUnit === 'kg' ? Number(userTargetWeight) : Number(userTargetWeight) * 0.453592) : null,
                availableDays,
                ...planData
            };

            const planResponse = await fetch(`${API_BASE_URL}/plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(planPayload)
            });

            if (!planResponse.ok) {
                console.error('Failed to save plan:', await planResponse.text());
            }

            try {
                const phase16Rewards = planData?.phase16Rewards as
                    | { week1?: string | null; week2?: string | null; week3?: string | null }
                    | undefined;

                const hasSelectedRewards = !!(
                    phase16Rewards?.week1 ||
                    phase16Rewards?.week2 ||
                    phase16Rewards?.week3
                );

                const onboardingRewardsPayload = hasSelectedRewards
                    ? {
                        week1RewardId: phase16Rewards?.week1 ?? null,
                        week2RewardId: phase16Rewards?.week2 ?? null,
                        week3RewardId: phase16Rewards?.week3 ?? null,
                        skipped: false,
                    }
                    : {
                        week1RewardId: null,
                        week2RewardId: null,
                        week3RewardId: null,
                        skipped: true,
                    };

                const onboardingRewardRes = await fetch(`${API_BASE_URL}/onboarding/rewards/preferences`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(onboardingRewardsPayload),
                });

                if (!onboardingRewardRes.ok) {
                    console.error('Failed to save onboarding reward preferences:', await onboardingRewardRes.text());
                }
            } catch (err) {
                console.error('Error saving onboarding reward preferences:', err);
            }

            await setAnalyticsUserProperties({
                goal_type: userGoal ?? null,
                has_partner: joinedWithCode ? 'true' : 'false',
            });
            await trackEvent('onboarding_completed', {
                goal_type: userGoal ?? 'unknown',
                joined_with_code: joinedWithCode,
            });

            onboardingCompletedRef.current = true;
            await markOnboardingComplete();
            (navigation as any).navigate('index');
        } catch (error) {
            console.error('Error submitting onboarding:', error);
            onboardingCompletedRef.current = true;
            await markOnboardingComplete();
            (navigation as any).navigate('index');
        }
    };

    const goToPrevPhase = () => {
        if (currentPhase > 0) setCurrentPhase(prev => prev - 1);
    };

    const goToDevPhase = (direction: -1 | 1) => {
        setCurrentPhase(prev => Math.max(0, Math.min(DEV_LAST_PHASE, prev + direction)));
    };

    const generateOnboardingWeeklyPlan = useCallback(async () => {
        if (!isAuthenticated) {
            throw new Error('Please sign in to generate your plan');
        }

        const response = await authFetch(`${API_BASE_URL}/plan/generate-weekly?force=true`, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to generate weekly plan');
        }

        const data = await response.json();
        return Array.isArray(data?.['Weekly Plan Table']) ? data['Weekly Plan Table'] : [];
    }, [authFetch, isAuthenticated]);

    const saveOnboardingCheckpoint = useCallback(async () => {
        if (!isAuthenticated) {
            throw new Error('Please sign in to continue');
        }

        const normalizedGender = normalizeGenderEnum(userGender);
        const profilePayload: any = {
            displayName: userName,
            gender: normalizedGender,
            goalType: userGoal,
            age: userAge,
            units: userWeightUnit === 'kg' ? 'metric' : 'imperial',
            timezone: deviceTimezone,
        };

        if (userWeightUnit === 'kg') {
            profilePayload.weightKg = Number(userWeight);
        } else {
            profilePayload.weightLbs = Number(userWeight);
        }

        if (userHeightUnit === 'cm') {
            profilePayload.heightCm = Number(userHeight);
        } else {
            const match = String(userHeight).match(/(\d+)'(\d+)"/);
            if (match) {
                profilePayload.heightFt = parseInt(match[1]);
                profilePayload.heightIn = parseInt(match[2]);
            }
        }

        if (userWeightUnit === 'kg') {
            profilePayload.goalTarget = Number(userTargetWeight);
        } else {
            profilePayload.goalTargetLbs = Number(userTargetWeight);
        }

        const profileRes = await authFetch(`${API_BASE_URL}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profilePayload),
        });
        if (!profileRes.ok) {
            const errorText = await profileRes.text();
            throw new Error(errorText || 'Failed to save profile');
        }

        const planPayload = {
            weightKg: userWeightUnit === 'kg' ? Number(userWeight) : Number(userWeight) * 0.453592,
            heightCm: userHeightUnit === 'cm' ? Number(userHeight) : (() => {
                const match = String(userHeight).match(/(\d+)'(\d+)"/);
                if (match) return Math.round((parseInt(match[1]) * 30.48) + (parseInt(match[2]) * 2.54));
                return 170;
            })(),
            ageYears: Number(userAge),
            goalType: userGoal || 'both',
            targetWeightKg: userTargetWeight ? (userWeightUnit === 'kg' ? Number(userTargetWeight) : Number(userTargetWeight) * 0.453592) : null,
            availableDays,
            ...planData,
        };

        const planRes = await authFetch(`${API_BASE_URL}/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(planPayload),
        });
        if (!planRes.ok) {
            const errorText = await planRes.text();
            throw new Error(errorText || 'Failed to save plan');
        }

        await upsertTrainingProfile({
            profileKey: user?.id || user?.email || 'active-user',
            runExperience: planPayload.runExperience ?? null,
            baselinePaceSecPerKm: planPayload.baselinePaceSecPerKm ?? null,
        });

        const phase16Rewards = planData?.phase16Rewards as
            | { week1?: string | null; week2?: string | null; week3?: string | null }
            | undefined;

        const hasSelectedRewards = !!(
            phase16Rewards?.week1 ||
            phase16Rewards?.week2 ||
            phase16Rewards?.week3
        );

        const onboardingRewardsPayload = hasSelectedRewards
            ? {
                week1RewardId: phase16Rewards?.week1 ?? null,
                week2RewardId: phase16Rewards?.week2 ?? null,
                week3RewardId: phase16Rewards?.week3 ?? null,
                skipped: false,
            }
            : {
                week1RewardId: null,
                week2RewardId: null,
                week3RewardId: null,
                skipped: true,
            };

        const onboardingRewardRes = await authFetch(`${API_BASE_URL}/onboarding/rewards/preferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(onboardingRewardsPayload),
        });
        if (!onboardingRewardRes.ok) {
            const errorText = await onboardingRewardRes.text();
            throw new Error(errorText || 'Failed to save onboarding rewards');
        }
    }, [
        authFetch,
        userName,
        userGender,
        userGoal,
        userAge,
        userWeightUnit,
        userWeight,
        userHeightUnit,
        userHeight,
        userTargetWeight,
        availableDays,
        planData,
        isAuthenticated,
        deviceTimezone,
    ]);

    const handlePhase2Identity = async (name: string, gender: string) => {
        const normalizedGender = normalizeGenderEnum(gender);
        setUserName(name);
        setUserGender(normalizedGender);

        try {
            const res = await authFetch(`${API_BASE_URL}/profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: name.trim(),
                    gender: normalizedGender,
                }),
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('Failed saving onboarding identity step:', errText);
            }
        } catch (error) {
            console.error('Error saving onboarding identity step:', error);
        } finally {
            goToNextPhase();
        }
    };

    const renderSplash = () => (
        <Animated.View style={[styles.splashContainer, { opacity: splashFade }]}>
            <StatusBar barStyle="light-content" />
            <View style={{ alignItems: 'center' }}>
                <ExpoImage
                    source={require('../../assets/logo.png')}
                    style={[styles.splashLogo, { tintColor: COLORS.white }]}
                    contentFit="contain"
                />
                <Animated.Text style={[
                    styles.splashText,
                    { opacity: textFade, transform: [{ translateY: textMove }] }
                ]}>
                    RunTogether
                </Animated.Text>
            </View>
        </Animated.View>
    );

    const renderPhaseContent = () => {
        switch (currentPhase) {
            case 0: return <Phase0Welcome onNext={goToNextPhase} />;
            case 1: return <Phase0Auth
                onNext={continueAfterAuth}
                onBack={goToPrevPhase}
                onApplePress={handleAppleAuth}
                onManualPress={() => setCurrentPhase(22)}
                onLoginPress={() => setCurrentPhase(24)}
                socialLoading={socialLoading}
                disabled={!!socialLoading}
                userName={userName}
            />;
            case 22: return <Phase0ManualAuth
                onBack={() => setCurrentPhase(1)}
                onRegister={register}
                onSuccess={() => {
                    shouldPersistCheckpointRef.current = true;
                    setCurrentPhase(2);
                }}
            />;
            case 24: return <Phase0ManualLogin
                onBack={() => setCurrentPhase(1)}
                onLogin={login}
                onSuccess={continueAfterAuth}
            />;
            case 2: return <Phase1HealthConsent onNext={goToNextPhase} onBack={goToPrevPhase} />;
            case 3: return <Phase2Goals
                onNext={handlePhase2Identity}
                onBack={goToPrevPhase}
                prefilledName={userName}
            />;
            case 4: return <Phase3Profile
                userName={userName}
                onBack={goToPrevPhase}
                onHaveCode={() => {
                    setJoinedWithCode(true);
                    setCurrentPhase(23);
                }}
                onFirstTime={() => {
                    setJoinedWithCode(false);
                    goToNextPhase();
                }}
            />;
            case 5: return <Phase5Dummy
                gender={userGender}
                onContinue={(goal: string | null) => {
                    setUserGoal(goal);
                    goToNextPhase();
                }}
                onBack={goToPrevPhase}
            />;
            case 6: return <Phase4Complete
                onComplete={(age: number) => {
                    setUserAge(age);
                    goToNextPhase();
                }}
                onBack={goToPrevPhase}
            />;
            case 7: return <WeightHeightSelection
                onContinue={(data: any) => {
                    setUserWeight(data.weight);
                    setUserWeightUnit(data.weightUnit);
                    setUserHeight(data.height);
                    setUserHeightUnit(data.heightUnit);
                    if (userGoal === 'weightloss') {
                        setCurrentPhase(8);
                    } else if (userGoal === 'both') {
                        setCurrentPhase(20);
                    } else if (userGoal === 'running') {
                        setCurrentPhase(20);
                    } else {
                        setCurrentPhase(joinedWithCode ? 12 : 9);
                    }
                }}
                onBack={goToPrevPhase}
            />;
            case 8: return <TargetWeight
                currentWeight={userWeight}
                unit={userWeightUnit}
                onContinue={(target: any) => {
                    setUserTargetWeight(target);
                    // After Target Weight, go to Weight Branch
                    setCurrentPhase(19);
                }}
                onBack={() => setCurrentPhase(7)}
            />;
            case 9: return <JourneyTypeSelection
                onContinue={() => setCurrentPhase(12)}
                onBack={() => {
                    // Back needs to go to the previous branch based on goal
                    if (userGoal === 'both') {
                        setCurrentPhase(20);
                    } else if (userGoal === 'running') {
                        setCurrentPhase(20);
                    } else if (userGoal === 'weightloss') {
                        setCurrentPhase(19);
                    } else {
                        setCurrentPhase(7);
                    }
                }}
            />;
            case 12: return <AvailableDays
                initialSelectedDays={availableDays}
                onContinue={(days: number[]) => {
                    setAvailableDays(days);
                    setPlanData((prev: any) => ({ ...prev, availableDays: days }));
                    goToNextPhase();
                }}
                onBack={() => {
                    if (!joinedWithCode) {
                        setCurrentPhase(9);
                        return;
                    }

                    if (userGoal === 'weightloss') {
                        setCurrentPhase(19);
                    } else if (userGoal === 'running' || userGoal === 'both') {
                        setCurrentPhase(20);
                    } else {
                        setCurrentPhase(7);
                    }
                }}
            />;
            case 13: return <Phase12Promo onContinue={goToNextPhase} />;
            case 14: return <PreferredTime
                initialValue={(planData.trainingTimePreference as 'morning' | 'afternoon' | 'evening') || 'morning'}
                onContinue={async (preferredTime: 'morning' | 'afternoon' | 'evening') => {
                    setPlanData((prev: any) => ({
                        ...prev,
                        trainingTimePreference: preferredTime,
                    }));
                    try {
                        await AsyncStorage.setItem(TRAINING_TIME_PREFERENCE_KEY, preferredTime);
                    } catch (err) {
                        console.error('Failed to persist training time preference:', err);
                    }
                    goToNextPhase();
                }}
                onBack={() => setCurrentPhase(13)}
            />;
            case 15: return <MarketplaceHowItWorks onContinue={() => setCurrentPhase(17)} />;
            case 16: return <MarketplaceMotivation onContinue={goToNextPhase} />;
            case 17: return <Phase16Dummy
                joinedWithCode={joinedWithCode}
                onContinue={(data: { week1: string | null; week2: string | null; week3: string | null }) => {
                    setPlanData((prev: any) => ({
                        ...prev,
                        phase16Rewards: data,
                    }));
                    goToNextPhase();
                }}
            />;
            case 18: return <Phase17Dummy
                joinedWithCode={joinedWithCode}
                onContinue={async (penalty: string | null) => {
                    if (savingOnboardingCheckpoint) return;

                    setPlanData((prev: any) => ({
                        ...prev,
                        phase17Penalty: penalty,
                    }));

                    try {
                        setSavingOnboardingCheckpoint(true);
                        await saveOnboardingCheckpoint();
                        setCurrentPhase(11);
                    } catch (err: any) {
                        Alert.alert(
                            'Unable to prepare your plan',
                            err?.message || 'Please try again.'
                        );
                    } finally {
                        setSavingOnboardingCheckpoint(false);
                    }
                }}
            />;
            case 10: return <Phase19PlanTimeline
                userName={userName}
                userGender={userGender}
                weeklyPlan={generatedWeeklyPlan}
                currentWeight={userWeight}
                weightUnit={userWeightUnit}
                mainGoal={userGoal}
                onBack={() => setCurrentPhase(11)}
                onContinue={async () => {
                    onboardingCompletedRef.current = true;
                    await markOnboardingComplete();
                    if (hasAccess) {
                        router.replace('/welcome');
                        return;
                    }

                    router.push('/paywall');
                }}
            />;
            case 11: return <Phase18PlanSetup
                onBack={() => setCurrentPhase(17)}
                onGeneratePlan={generateOnboardingWeeklyPlan}
                onGenerated={(weeklyPlan) => {
                    setGeneratedWeeklyPlan(weeklyPlan);
                    setCurrentPhase(10);
                }}
                currentWeight={userWeight}
                weightUnit={userWeightUnit}
                height={userHeight}
                heightUnit={userHeightUnit}
                targetWeight={userTargetWeight}
                gender={userGender}
            />;
            case 19: return <WeightBranch
                currentWeight={userWeight}
                targetWeight={userTargetWeight}
                unit={userWeightUnit}
                gender={userGender}
                onComplete={(data: any) => {
                    // Map WeightBranch data to planData
                    const finalTimeHorizon = data.timeline === 'custom' ? 'SPECIFIC_DATE' : (data.timeline === 'aggressive' ? 'AGGRESSIVE' : 'STANDARD');

                    setPlanData((prev: any) => ({
                        ...prev,
                        timeHorizon: finalTimeHorizon,
                        targetDate: data.targetDate?.toISOString() || null,
                        trainingStyle: data.trainingStyle,
                        hasRaceGoal: data.raceTraining === 'yes',
                    }));

                    if (userGoal === 'both') setCurrentPhase(20);
                    else setCurrentPhase(joinedWithCode ? 12 : 9);
                }}
            />;
            case 20: return <RunningBranch skipDietStrategy={userGoal === 'both'} gender={userGender} onComplete={(data: any) => {
                // Map RunningBranch data to planData
                setPlanData((prev: any) => ({
                    ...prev,
                    runGoal: data.trainingGoal,
                    runExperience: data.isAbsoluteNewToRunning ? 'beginner' : data.experience,
                    runDietFocus: data.dietStrategy,
                    runPriority: data.priority,
                    hasRaceGoal: prev.hasRaceGoal || data.raceDate === 'yes',
                    runRaceDate: data.raceDate || null,
                    baselinePaceSecPerKm: data.baselinePaceSecPerKm ?? null,
                }));
                setCurrentPhase(joinedWithCode ? 12 : 9);
            }} />;
            case 21: return <Phase20RunningHabits onComplete={goToNextPhase} />;
            case 23: return <Phase4PartnerCode
                userName={userName}
                onBack={() => setCurrentPhase(4)}
                onContinue={() => setCurrentPhase(5)}
            />;
            default: return <Phase0Welcome onNext={goToNextPhase} />;
        }
    };

    const renderDevPhaseControls = () => {
        if (!__DEV__) return null;

        const isFirstPhase = currentPhase <= 0;
        const isLastPhase = currentPhase >= DEV_LAST_PHASE;
        const phaseFileName = DEV_PHASE_FILE_NAMES[currentPhase] ?? `Phase ${currentPhase}`;

        return (
            <View style={styles.devControls} pointerEvents="box-none">
                <TouchableOpacity
                    style={[styles.devButton, isFirstPhase && styles.devButtonDisabled]}
                    onPress={() => goToDevPhase(-1)}
                    disabled={isFirstPhase}
                    activeOpacity={0.75}
                >
                    <Text style={[styles.devButtonText, isFirstPhase && styles.devButtonTextDisabled]}>
                        Prev
                    </Text>
                </TouchableOpacity>

                <View style={styles.devPhasePill}>
                    <Text style={styles.devPhaseText} numberOfLines={1}>
                        {phaseFileName}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.devButton, isLastPhase && styles.devButtonDisabled]}
                    onPress={() => goToDevPhase(1)}
                    disabled={isLastPhase}
                    activeOpacity={0.75}
                >
                    <Text style={[styles.devButtonText, isLastPhase && styles.devButtonTextDisabled]}>
                        Next
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isSplashVisible ? "light-content" : "dark-content"} />

            <View style={styles.safeArea}>
                {checkpointHydrated ? renderPhaseContent() : (
                    <View style={styles.checkpointLoading}>
                        <ActivityIndicator size="large" color={COLORS.coral} />
                    </View>
                )}
            </View>

            {checkpointHydrated && renderDevPhaseControls()}

            {isSplashVisible && renderSplash()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        width: width,
        height: height,
        alignSelf: 'center',
        overflow: 'hidden',
    },
    checkpointLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // --- Splash ---
    splashContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.coral,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    splashLogo: {
        width: width * 0.3,
        height: width * 0.3,
        marginBottom: 10,
    },
    splashText: {
        color: COLORS.white,
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        marginTop: -20,
    },
    devControls: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Platform.OS === 'ios' ? 18 : 12,
        zIndex: 900,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    devButton: {
        minWidth: 52,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.textMain,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 5,
        elevation: 3,
    },
    devButtonDisabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
        elevation: 0,
    },
    devButtonText: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: '800',
    },
    devButtonTextDisabled: {
        color: COLORS.textSub,
    },
    devPhasePill: {
        height: 28,
        minWidth: 128,
        maxWidth: 190,
        paddingHorizontal: 10,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
    },
    devPhaseText: {
        color: COLORS.textMain,
        fontSize: 10,
        fontWeight: '900',
        flexShrink: 1,
    },
});
