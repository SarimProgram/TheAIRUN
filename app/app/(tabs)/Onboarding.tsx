import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAccessToken } from '../../lib/authToken';
import { API_BASE_URL } from '../../config/api';
import { useTabBar } from '@/contexts/TabBarContext';
import { useAuth } from '@/src/auth/authContext';
import { useEntitlement } from '@/src/billing';
import { upsertTrainingProfile } from '@/db/offlineDb';
import { setAnalyticsUserProperties, trackEvent, trackOnboardingStep } from '@/src/analytics/analytics';
import { resolveOnboardingAnalytics } from '@/src/analytics/onboardingPhases';
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
import Phase3ProofChart from '../../components/onboarding/Phase3ProofChart';
import Phase4PartnerCode, { type PartnerLookupInvite } from '../../components/onboarding/Phase4PartnerCode';
import Phase4Complete from '../../components/onboarding/Phase4Complete';
import Phase5Dummy from '../../components/onboarding/5_PrimaryGoal';
import WeightHeightSelection from '../../components/onboarding/6_Weight&Height';
import TargetWeight from '../../components/onboarding/7_TargetWeight';
import WeightHabitPlan from '../../components/onboarding/7b_WeightHabitPlan';
import JourneyTypeSelection from '../../components/onboarding/8_StartingPoint';
import AvailableDays from '../../components/onboarding/10_AvailableDays';
import PreferredTime from '../../components/onboarding/11_PreferredTime';
import MarketplaceHowItWorks from '../../components/onboarding/12_PromoHowto';
import Phase16Dummy from '../../components/onboarding/Phase16Dummy';
import Phase17Dummy from '../../components/onboarding/Phase17Dummy';
import Phase18PlanSetup from '../../components/onboarding/Phase18PlanSetup';
import Phase19PlanTimeline from '../../components/onboarding/Phase19PlanTimeline';
import WeightBranch from '../../components/onboarding/Weight_Branch';
import RunningBranch from '../../components/onboarding/Running_Branch';
import Phase20RunningHabits from '../../components/onboarding/Phase20RunningHabits';
import OnboardingPhaseTransition from '../../components/onboarding/OnboardingPhaseTransition';
import { useOnboardingCrossDissolve } from '../../components/onboarding/useOnboardingCrossDissolve';

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
const TOTAL_PHASES = 25;

type DevNavStep =
    | { type: 'phase'; id: number }
    | { type: 'plan'; view: 'setup' | 'summary' };

const DEV_NAV_STEPS: DevNavStep[] = [
    { type: 'phase', id: 0 },
    { type: 'phase', id: 1 },
    { type: 'phase', id: 22 },
    { type: 'phase', id: 24 },
    { type: 'phase', id: 3 },
    { type: 'phase', id: 4 },
    { type: 'phase', id: 23 },
    { type: 'phase', id: 25 },
    { type: 'phase', id: 5 },
    { type: 'phase', id: 6 },
    { type: 'phase', id: 7 },
    { type: 'phase', id: 8 },
    { type: 'phase', id: 26 },
    { type: 'phase', id: 2 },
    { type: 'phase', id: 19 },
    { type: 'phase', id: 20 },
    { type: 'phase', id: 21 },
    { type: 'phase', id: 9 },
    { type: 'phase', id: 12 },
    { type: 'phase', id: 14 },
    { type: 'phase', id: 15 },
    { type: 'phase', id: 17 },
    { type: 'phase', id: 18 },
    { type: 'plan', view: 'setup' },
    { type: 'plan', view: 'summary' },
    { type: 'phase', id: 10 },
];

const DEV_LAST_PHASE = DEV_NAV_STEPS[DEV_NAV_STEPS.length - 1].type === 'phase'
    ? DEV_NAV_STEPS[DEV_NAV_STEPS.length - 1].id
    : 10;
const HERO_BACKGROUND_PHASES = new Set([3, 4]);
const HERO_BACKGROUND_COLOR = '#FF3B3B';
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
    26: '7b_WeightHabitPlan.tsx',
    9: '8_StartingPoint.tsx',
    10: 'Phase19PlanTimeline.tsx',
    11: 'Phase18PlanSetup.tsx',
    12: '10_AvailableDays.tsx',
    14: '11_PreferredTime.tsx',
    15: '12_PromoHowto.tsx',
    17: 'Phase16Dummy.tsx',
    18: 'Phase17Dummy.tsx',
    19: 'Weight_Branch.tsx',
    20: 'Running_Branch.tsx',
    21: 'Phase20RunningHabits.tsx',
    22: 'Phase0ManualAuth.tsx',
    23: 'Phase4PartnerCode.tsx',
    24: 'Phase0ManualLogin.tsx',
    25: 'Phase3ProofChart.tsx',
};
const TRAINING_TIME_PREFERENCE_KEY = 'plans_training_time_preference_v1';
const APPLE_DISPLAY_NAME_KEY = 'apple_display_name_v1';

const ONBOARDING_PROGRESS: Partial<Record<number, number>> = {
    25: 0.04,
    5: 0.06,
    6: 0.12,
    7: 0.18,
    8: 0.24,
    26: 0.28,
    2: 0.30,
    19: 0.32,
    20: 0.40,
    9: 0.48,
    12: 0.56,
    14: 0.72,
    15: 0.78,
    17: 0.86,
    18: 0.91,
    11: 0.97,
    10: 1,
};

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

function getDevStepLabel(step: DevNavStep) {
    if (step.type === 'plan') {
        return step.view === 'setup' ? 'Phase18PlanSetup.tsx' : 'Phase19PlanSummary.tsx';
    }
    return DEV_PHASE_FILE_NAMES[step.id] ?? `Phase ${step.id}`;
}

function resolveDevStepIndex(
    phase: number,
    planView: 'setup' | 'summary' | null,
    hasGeneratedPlan: boolean,
): number {
    for (let i = 0; i < DEV_NAV_STEPS.length; i++) {
        const step = DEV_NAV_STEPS[i];
        if (step.type === 'plan') {
            if (phase === 11 && planView === step.view) return i;
            continue;
        }
        if (step.id === phase && phase !== 11) return i;
    }

    if (phase === 11) {
        const autoView = planView ?? (hasGeneratedPlan ? 'summary' : 'setup');
        const planIndex = DEV_NAV_STEPS.findIndex(
            (step) => step.type === 'plan' && step.view === autoView,
        );
        if (planIndex >= 0) return planIndex;
    }

    for (let i = DEV_NAV_STEPS.length - 1; i >= 0; i--) {
        const step = DEV_NAV_STEPS[i];
        const stepPhase = step.type === 'phase' ? step.id : 11;
        if (phase >= stepPhase) return i;
    }

    return 0;
}

export default function OnboardingGreeting() {
    const navigation = useNavigation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { setTabBarVisible } = useTabBar();
    const { socialLogin, login, register, authFetch, user, isAuthenticated } = useAuth();
    const { hasAccess, refreshAccess } = useEntitlement();
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
    const [partnerEngaged, setPartnerEngaged] = useState(false);
    const [checkpointHydrated, setCheckpointHydrated] = useState(false);
    const deviceTimezone = useRef(getDeviceTimezone()).current;
    const shouldPersistCheckpointRef = useRef(false);
    const pendingServerFlushRef = useRef(false);
    const onboardingCompletedRef = useRef(false);
    const postAuthDestinationRef = useRef<number | null>(null);
    const preAuthPhaseRef = useRef(0);
    const proofChartBackPhaseRef = useRef(3);
    const partnerCodeBackPhaseRef = useRef(0);
    const pendingPartnerAcceptInviteIdRef = useRef<string | null>(null);
    const [authIntent, setAuthIntent] = useState<'default' | 'partner' | 'partner_accept'>('default');
    const [planDevView, setPlanDevView] = useState<'setup' | 'summary' | null>(null);
    const [devStepIndex, setDevStepIndex] = useState(0);

    // Splash Animation Values
    const splashFade = useRef(new Animated.Value(1)).current;
    const textFade = useRef(new Animated.Value(0)).current;
    const textMove = useRef(new Animated.Value(20)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const {
        currentPhase,
        transitionToPhase,
        setPhaseInstant,
    } = useOnboardingCrossDissolve(0);

    const buildCheckpointPayload = useCallback((
        overrides?: Partial<{
            currentPhase: number;
            planData: Record<string, any>;
        }>,
    ) => ({
        currentPhase: overrides?.currentPhase ?? currentPhase,
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
        planData: {
            ...planData,
            ...(overrides?.planData ?? {}),
            partnerEngaged: partnerEngaged || planData.partnerEngaged,
        },
        generatedWeeklyPlan,
        joinedWithCode,
    }), [
        availableDays,
        currentPhase,
        generatedWeeklyPlan,
        joinedWithCode,
        partnerEngaged,
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
        if (!checkpointHydrated) return;

        const { screenName, stepKey, stepOrder } = resolveOnboardingAnalytics(
            currentPhase,
            planDevView,
        );
        trackOnboardingStep(stepKey, screenName, stepOrder).catch(() => {});

        if (currentPhase === 0) {
            trackEvent('onboarding_started').catch(() => {});
        }
    }, [checkpointHydrated, currentPhase, planDevView]);

    useEffect(() => {
        const progress = ONBOARDING_PROGRESS[currentPhase];
        if (progress === undefined) return;

        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [currentPhase, progressAnim]);

    useEffect(() => {
        if (!__DEV__) return;
        setDevStepIndex(resolveDevStepIndex(
            currentPhase,
            planDevView,
            generatedWeeklyPlan.length > 0,
        ));
    }, [currentPhase, generatedWeeklyPlan.length, planDevView]);

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
                const restoredPlanData = checkpoint.planData && typeof checkpoint.planData === 'object'
                    ? checkpoint.planData
                    : { intensityLevel: 'ACTIVE', activityPreference: 'WALKING_RUNNING' };
                setPlanData(restoredPlanData);
                pendingPartnerAcceptInviteIdRef.current =
                    typeof restoredPlanData.pendingPartnerAcceptInviteId === 'string'
                        ? restoredPlanData.pendingPartnerAcceptInviteId
                        : null;
                setGeneratedWeeklyPlan(Array.isArray(checkpoint.generatedWeeklyPlan)
                    ? checkpoint.generatedWeeklyPlan
                    : []);
                setJoinedWithCode(!!checkpoint.joinedWithCode);
                setPartnerEngaged(
                    !!checkpoint.joinedWithCode || !!restoredPlanData.partnerEngaged,
                );
                const restoredPhaseRaw = Math.min(checkpoint.currentPhase, DEV_LAST_PHASE);
                const restoredPhase = restoredPhaseRaw === 16 ? 17 : restoredPhaseRaw;
                const restoredHasPlan = Array.isArray(checkpoint.generatedWeeklyPlan)
                    && checkpoint.generatedWeeklyPlan.length > 0;
                setPhaseInstant(restoredPhase);
                if (__DEV__) {
                    setDevStepIndex(resolveDevStepIndex(restoredPhase, null, restoredHasPlan));
                }
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
            !shouldPersistCheckpointRef.current ||
            onboardingCompletedRef.current
        ) {
            return;
        }

        saveOnboardingProgress(buildCheckpointPayload()).catch(() => {});
    }, [buildCheckpointPayload, checkpointHydrated]);

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

    const applyDevStep = useCallback((step: DevNavStep) => {
        if (step.type === 'plan') {
            setPlanDevView(step.view);
            setPhaseInstant(11);
            return;
        }
        setPlanDevView(null);
        setPhaseInstant(step.id);
    }, [setPhaseInstant]);

    const goToDevStepIndex = useCallback((index: number) => {
        if (index < 0 || index >= DEV_NAV_STEPS.length) return;
        setDevStepIndex(index);
        applyDevStep(DEV_NAV_STEPS[index]);
    }, [applyDevStep]);

    const goToDevPhase = useCallback((direction: -1 | 1) => {
        const nextIndex = devStepIndex + direction;
        goToDevStepIndex(nextIndex);
    }, [devStepIndex, goToDevStepIndex]);

    const goToNextPhase = useCallback(() => {
        shouldPersistCheckpointRef.current = true;
        if (currentPhase < TOTAL_PHASES - 1) {
            transitionToPhase(currentPhase + 1);
        } else {
            handleFinalSubmit();
        }
    }, [currentPhase, transitionToPhase]);

    const goToPrevPhase = useCallback(() => {
        if (currentPhase > 0) transitionToPhase(currentPhase - 1, 'back');
    }, [currentPhase, transitionToPhase]);

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

    const redirectToAuth = useCallback((
        destinationPhase: number,
        options?: { intent?: 'default' | 'partner' | 'partner_accept'; returnPhase?: number },
    ) => {
        if (isAuthenticated) {
            transitionToPhase(destinationPhase);
            return;
        }

        preAuthPhaseRef.current = options?.returnPhase ?? currentPhase;
        postAuthDestinationRef.current = destinationPhase;
        setAuthIntent(
            options?.intent ?? (destinationPhase === 9 ? 'partner' : 'default'),
        );
        transitionToPhase(1);
    }, [currentPhase, isAuthenticated, transitionToPhase]);

    const requireAuthThen = useCallback((destinationPhase: number) => {
        redirectToAuth(destinationPhase);
    }, [redirectToAuth]);

    const handleRequireAuthForPartnerInvite = useCallback((email: string) => {
        shouldPersistCheckpointRef.current = true;
        setPlanData((prev: any) => ({
            ...prev,
            pendingPartnerInviteEmail: email,
            pendingPartnerInviteSend: true,
        }));
        redirectToAuth(9, { intent: 'partner' });
    }, [redirectToAuth]);

    const clearPendingPartnerInvite = useCallback(() => {
        setPlanData((prev: any) => {
            const next = { ...prev };
            delete next.pendingPartnerInviteEmail;
            delete next.pendingPartnerInviteSend;
            return next;
        });
    }, []);

    const clearPendingPartnerAccept = useCallback(() => {
        pendingPartnerAcceptInviteIdRef.current = null;
        setPlanData((prev: any) => {
            const next = { ...prev };
            delete next.pendingPartnerAcceptInviteId;
            delete next.pendingPartnerAcceptEmail;
            delete next.pendingPartnerAcceptInviterName;
            return next;
        });
    }, []);

    const storePartnerAcceptFromInvite = useCallback((invite: PartnerLookupInvite) => {
        shouldPersistCheckpointRef.current = true;
        setJoinedWithCode(true);
        setPartnerEngaged(true);
        pendingPartnerAcceptInviteIdRef.current = invite.id;
        setPlanData((prev: any) => ({
            ...prev,
            pendingPartnerAcceptInviteId: invite.id,
            pendingPartnerAcceptEmail: invite.toEmail,
            pendingPartnerAcceptInviterName: invite.fromUser?.displayName ?? 'Your partner',
        }));
    }, []);

    const acceptPendingPartnerInvite = useCallback(async (inviteId: string) => {
        const res = await authFetch(`${API_BASE_URL}/partner/invites/${inviteId}/accept`, {
            method: 'POST',
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error || 'Unable to connect with your partner.');
        }
        await refreshAccess().catch(() => {});
    }, [authFetch, refreshAccess]);

    const finishPartnerAcceptOnboarding = useCallback(async (resolvedName?: string) => {
        const nextName = resolvedName?.trim() || user?.displayName?.trim();
        if (nextName) {
            setUserName(nextName);
        }

        clearPendingPartnerAccept();
        setAuthIntent('default');
        postAuthDestinationRef.current = null;

        const shouldSkipOnboarding = await hasExistingPlan();
        if (shouldSkipOnboarding) {
            onboardingCompletedRef.current = true;
            await markOnboardingComplete();
            router.replace('/welcome');
            return;
        }

        shouldPersistCheckpointRef.current = true;
        transitionToPhase(3);
    }, [clearPendingPartnerAccept, hasExistingPlan, router, transitionToPhase, user?.displayName]);

    const completePartnerAcceptFlow = useCallback(async (resolvedName?: string) => {
        const inviteId =
            pendingPartnerAcceptInviteIdRef.current
            || (planData.pendingPartnerAcceptInviteId as string | undefined);
        if (!inviteId) {
            throw new Error('Partner invite not found. Please enter your code again.');
        }
        await acceptPendingPartnerInvite(inviteId);
        await finishPartnerAcceptOnboarding(resolvedName);
    }, [acceptPendingPartnerInvite, finishPartnerAcceptOnboarding, planData.pendingPartnerAcceptInviteId]);

    const beginPartnerAcceptRegistration = useCallback(() => {
        setAuthIntent('partner_accept');
        preAuthPhaseRef.current = currentPhase;
        postAuthDestinationRef.current = null;
        transitionToPhase(22);
    }, [currentPhase, transitionToPhase]);

    const beginPartnerAcceptLogin = useCallback(() => {
        setAuthIntent('partner_accept');
        preAuthPhaseRef.current = currentPhase;
        postAuthDestinationRef.current = null;
        transitionToPhase(24);
    }, [currentPhase, transitionToPhase]);

    const handlePartnerConnectFromCode = useCallback((invite: PartnerLookupInvite) => {
        partnerCodeBackPhaseRef.current = currentPhase;
        storePartnerAcceptFromInvite(invite);

        if (isAuthenticated) {
            void completePartnerAcceptFlow(user?.displayName ?? undefined).catch((err: any) => {
                Alert.alert('Unable to Connect', err?.message || 'Please try again.');
            });
            return;
        }

        beginPartnerAcceptRegistration();
    }, [
        beginPartnerAcceptRegistration,
        completePartnerAcceptFlow,
        currentPhase,
        isAuthenticated,
        storePartnerAcceptFromInvite,
        user?.displayName,
    ]);

    const handlePartnerLoginFromCode = useCallback((invite: PartnerLookupInvite) => {
        partnerCodeBackPhaseRef.current = currentPhase;
        storePartnerAcceptFromInvite(invite);
        beginPartnerAcceptLogin();
    }, [beginPartnerAcceptLogin, currentPhase, storePartnerAcceptFromInvite]);

    const continueAfterAuth = useCallback(async (prefilledName?: string) => {
        if (planData.pendingPartnerAcceptInviteId || pendingPartnerAcceptInviteIdRef.current) {
            try {
                await completePartnerAcceptFlow(prefilledName || user?.displayName || undefined);
                return;
            } catch (err: any) {
                Alert.alert('Unable to Connect', err?.message || 'Please try again.');
                transitionToPhase(23);
                return;
            }
        }

        if (postAuthDestinationRef.current !== null) {
            const destination = postAuthDestinationRef.current;
            postAuthDestinationRef.current = null;
            setAuthIntent('default');
            shouldPersistCheckpointRef.current = true;
            pendingServerFlushRef.current = true;
            transitionToPhase(destination);
            return;
        }

        const checkpoint = await loadOnboardingCheckpoint();
        if (checkpoint && !checkpoint.completed) {
            shouldPersistCheckpointRef.current = true;
            transitionToPhase(
                checkpoint.currentPhase > 1
                    ? Math.min(checkpoint.currentPhase, DEV_LAST_PHASE)
                    : 3
            );
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
        transitionToPhase(3);
    }, [
        completePartnerAcceptFlow,
        hasExistingPlan,
        planData.pendingPartnerAcceptInviteId,
        router,
        transitionToPhase,
        user?.displayName,
    ]);

    const handleAuthBack = useCallback(() => {
        if (authIntent === 'partner_accept') {
            setAuthIntent('default');
            transitionToPhase(preAuthPhaseRef.current || partnerCodeBackPhaseRef.current || 23, 'back');
            return;
        }

        if (postAuthDestinationRef.current !== null) {
            const returnPhase = preAuthPhaseRef.current;
            postAuthDestinationRef.current = null;
            setAuthIntent('default');
            transitionToPhase(returnPhase, 'back');
            return;
        }

        goToPrevPhase();
    }, [authIntent, currentPhase, transitionToPhase, goToPrevPhase]);

    useEffect(() => {
        if (!checkpointHydrated || isAuthenticated || currentPhase !== 11) return;

        pendingServerFlushRef.current = true;
        redirectToAuth(11, { returnPhase: 17 });
    }, [checkpointHydrated, currentPhase, isAuthenticated, redirectToAuth]);

    const saveOnboardingCheckpoint = useCallback(async (overrides?: { planData?: Record<string, any> }) => {
        if (!isAuthenticated) {
            throw new Error('Please sign in to continue');
        }

        const effectivePlanData = overrides?.planData ?? planData;
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
            ...effectivePlanData,
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

        const phase16Rewards = effectivePlanData?.phase16Rewards as
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
        user,
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

    const generateOnboardingWeeklyPlan = useCallback(async () => {
        if (!isAuthenticated) {
            throw new Error('Please sign in to generate your plan');
        }

        await saveOnboardingCheckpoint();

        const requestWeeklyPlan = () =>
            authFetch(`${API_BASE_URL}/plan/generate-weekly?force=true`, {
                method: 'POST',
            });

        let response = await requestWeeklyPlan();
        if (response.status === 404) {
            await new Promise<void>((resolve) => setTimeout(resolve, 400));
            response = await requestWeeklyPlan();
        }

        if (!response.ok) {
            const errorText = await response.text();
            let message = errorText || 'Failed to generate weekly plan';
            try {
                const parsed = JSON.parse(errorText);
                if (typeof parsed?.message === 'string') {
                    message = parsed.message;
                }
            } catch {
                // Keep raw response text.
            }
            throw new Error(message);
        }

        const data = await response.json();
        const weeklyPlan = data?.['Weekly Plan Table'];
        if (!Array.isArray(weeklyPlan) || weeklyPlan.length === 0) {
            throw new Error('Your plan came back empty. Please try again.');
        }

        return weeklyPlan;
    }, [authFetch, isAuthenticated, saveOnboardingCheckpoint]);

    useEffect(() => {
        if (!isAuthenticated || !pendingServerFlushRef.current) return;

        pendingServerFlushRef.current = false;
        void saveOnboardingCheckpoint().catch((err) => {
            console.warn('Failed to flush onboarding to server:', err);
        });
    }, [isAuthenticated, saveOnboardingCheckpoint]);

    const finishPenaltyStep = useCallback(async (penalty: string | null) => {
        if (savingOnboardingCheckpoint) return;

        const nextPlanData = {
            ...planData,
            phase17Penalty: penalty,
        };

        setPlanData(nextPlanData);

        try {
            setSavingOnboardingCheckpoint(true);
            shouldPersistCheckpointRef.current = true;
            await saveOnboardingProgress(buildCheckpointPayload({
                currentPhase: 11,
                planData: nextPlanData,
            }));

            if (!isAuthenticated) {
                pendingServerFlushRef.current = true;
                requireAuthThen(11);
                return;
            }

            await saveOnboardingCheckpoint({ planData: nextPlanData });
            transitionToPhase(11);
        } catch (err: any) {
            Alert.alert(
                'Unable to prepare your plan',
                err?.message || 'Please try again.'
            );
        } finally {
            setSavingOnboardingCheckpoint(false);
        }
    }, [
        buildCheckpointPayload,
        isAuthenticated,
        planData,
        requireAuthThen,
        saveOnboardingCheckpoint,
        savingOnboardingCheckpoint,
        transitionToPhase,
    ]);

    const advanceAfterRewards = useCallback(async () => {
        const shouldShowPenaltyStep = joinedWithCode || partnerEngaged;
        if (!shouldShowPenaltyStep) {
            await finishPenaltyStep(null);
            return;
        }

        if (joinedWithCode && isAuthenticated) {
            try {
                const res = await authFetch(`${API_BASE_URL}/wager/overview`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.currentWager) {
                        await finishPenaltyStep(null);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Failed to check partner wager during onboarding:', error);
            }
        }

        transitionToPhase(18);
    }, [
        authFetch,
        finishPenaltyStep,
        isAuthenticated,
        joinedWithCode,
        partnerEngaged,
        transitionToPhase,
    ]);

    const handlePhase2Identity = async (name: string, gender: string) => {
        const normalizedGender = normalizeGenderEnum(gender);
        setUserName(name);
        setUserGender(normalizedGender);
        shouldPersistCheckpointRef.current = true;

        if (isAuthenticated) {
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
            }
        }

        if (joinedWithCode) {
            proofChartBackPhaseRef.current = 3;
        }

        transitionToPhase(joinedWithCode ? 25 : 4);
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

    const renderPhaseContent = (phase: number) => {
        switch (phase) {
            case 0: return <Phase0Welcome
                onNext={() => {
                    shouldPersistCheckpointRef.current = true;
                    transitionToPhase(3);
                }}
                onLogin={() => transitionToPhase(24)}
                onInviteCode={() => {
                    setJoinedWithCode(true);
                    setPartnerEngaged(true);
                    partnerCodeBackPhaseRef.current = 0;
                    transitionToPhase(23);
                }}
            />;
            case 1: return <Phase0Auth
                onNext={continueAfterAuth}
                onBack={handleAuthBack}
                onApplePress={handleAppleAuth}
                onManualPress={() => transitionToPhase(22)}
                onLoginPress={() => transitionToPhase(24)}
                socialLoading={socialLoading}
                disabled={!!socialLoading}
                userName={userName}
                subtitle={
                    authIntent === 'partner_accept'
                        ? `Create your account to connect with ${planData.pendingPartnerAcceptInviterName ?? 'your partner'}.`
                        : authIntent === 'partner'
                            ? 'Sign up to invite your partner.'
                            : undefined
                }
            />;
            case 22: return <Phase0ManualAuth
                onBack={() => {
                    if (authIntent === 'partner_accept') {
                        transitionToPhase(preAuthPhaseRef.current || partnerCodeBackPhaseRef.current || 23, 'back');
                        return;
                    }
                    transitionToPhase(1, 'back');
                }}
                initialEmail={planData.pendingPartnerAcceptEmail ?? ''}
                subtitle={
                    authIntent === 'partner_accept'
                        ? `Create your account to connect with ${planData.pendingPartnerAcceptInviterName ?? 'your partner'}.`
                        : undefined
                }
                onLoginPress={() => beginPartnerAcceptLogin()}
                onApplePress={handleAppleAuth}
                socialLoading={socialLoading}
                userName={userName}
                onRegister={async (name, email, password) => {
                    await register(name, email, password);
                    setUserName(name.trim());
                }}
                onSuccess={continueAfterAuth}
            />;
            case 24: return <Phase0ManualLogin
                onBack={() => {
                    if (authIntent === 'partner_accept') {
                        transitionToPhase(preAuthPhaseRef.current || partnerCodeBackPhaseRef.current || 23, 'back');
                        return;
                    }
                    transitionToPhase(1, 'back');
                }}
                initialEmail={planData.pendingPartnerAcceptEmail ?? ''}
                subtitle={
                    authIntent === 'partner_accept'
                        ? `Log in to connect with ${planData.pendingPartnerAcceptInviterName ?? 'your partner'}.`
                        : undefined
                }
                onRegisterPress={() => beginPartnerAcceptRegistration()}
                onLogin={login}
                onSuccess={continueAfterAuth}
                onApplePress={handleAppleAuth}
                socialLoading={socialLoading}
                userName={userName}
            />;
            case 2: return <Phase1HealthConsent
                onNext={() => {
                    if (userGoal === 'running' || userGoal === 'both') {
                        transitionToPhase(20);
                    } else if (userGoal === 'weightloss') {
                        transitionToPhase(19);
                    } else {
                        transitionToPhase(joinedWithCode ? 12 : 9);
                    }
                }}
                onBack={() => transitionToPhase(26, 'back')}
            />;
            case 3: return <Phase2Goals
                onNext={handlePhase2Identity}
                onBack={() => transitionToPhase(0, 'back')}
                prefilledName={userName}
            />;
            case 4: return <Phase3Profile
                userName={userName}
                onBack={() => transitionToPhase(3, 'back')}
                onHaveCode={() => {
                    setJoinedWithCode(true);
                    setPartnerEngaged(true);
                    partnerCodeBackPhaseRef.current = 4;
                    transitionToPhase(23);
                }}
                onFirstTime={() => {
                    setJoinedWithCode(false);
                    proofChartBackPhaseRef.current = 4;
                    transitionToPhase(25);
                }}
                onJoinedPartner={() => {
                    setJoinedWithCode(true);
                    setPartnerEngaged(true);
                    proofChartBackPhaseRef.current = 4;
                    transitionToPhase(25);
                }}
            />;
            case 5: return <Phase5Dummy
                gender={userGender}
                joinedWithPartner={joinedWithCode}
                onContinue={(goal: string | null) => {
                    setUserGoal(goal);
                    transitionToPhase(6);
                }}
                onBack={() => transitionToPhase(25, 'back')}
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
                    if (userGoal === 'weightloss' || userGoal === 'both') {
                        transitionToPhase(8);
                    } else if (userGoal === 'running') {
                        transitionToPhase(26);
                    } else {
                        transitionToPhase(joinedWithCode ? 12 : 9);
                    }
                }}
                onBack={goToPrevPhase}
            />;
            case 8: return <TargetWeight
                currentWeight={userWeight}
                unit={userWeightUnit}
                onContinue={(target: any) => {
                    setUserTargetWeight(target);
                    transitionToPhase(26);
                }}
                onBack={() => transitionToPhase(7, 'back')}
            />;
            case 26: return <WeightHabitPlan
                currentWeight={userWeight}
                targetWeight={userTargetWeight}
                unit={userWeightUnit}
                userGoal={userGoal}
                onContinue={() => {
                    transitionToPhase(2);
                }}
                onBack={() => {
                    if (userGoal === 'running') {
                        transitionToPhase(7, 'back');
                    } else {
                        transitionToPhase(8, 'back');
                    }
                }}
            />;
            case 9: return <JourneyTypeSelection
                inviterName={userName}
                initialPartnerEmail={planData.pendingPartnerInviteEmail ?? ''}
                shouldSendInviteAfterAuth={!!planData.pendingPartnerInviteSend}
                onRequireAuthForInvite={handleRequireAuthForPartnerInvite}
                onInviteSent={clearPendingPartnerInvite}
                onContinue={(mode) => {
                    const engaged = mode === 'couple';
                    setPartnerEngaged(engaged);
                    setPlanData((prev: any) => ({ ...prev, partnerEngaged: engaged }));
                    clearPendingPartnerInvite();
                    transitionToPhase(12);
                }}
                onBack={() => {
                    // Back needs to go to the previous branch based on goal
                    if (userGoal === 'both') {
                        transitionToPhase(20, 'back');
                    } else if (userGoal === 'running') {
                        transitionToPhase(20, 'back');
                    } else if (userGoal === 'weightloss') {
                        transitionToPhase(19, 'back');
                    } else {
                        transitionToPhase(7, 'back');
                    }
                }}
            />;
            case 12: return <AvailableDays
                initialSelectedDays={availableDays}
                onContinue={(days: number[]) => {
                    setAvailableDays(days);
                    setPlanData((prev: any) => ({ ...prev, availableDays: days }));
                    transitionToPhase(14);
                }}
                onBack={() => {
                    if (!joinedWithCode) {
                        transitionToPhase(9, 'back');
                        return;
                    }

                    if (userGoal === 'weightloss') {
                        transitionToPhase(19, 'back');
                    } else if (userGoal === 'running' || userGoal === 'both') {
                        transitionToPhase(20, 'back');
                    } else {
                        transitionToPhase(7, 'back');
                    }
                }}
            />;
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
                onBack={() => transitionToPhase(12, 'back')}
            />;
            case 15: return <MarketplaceHowItWorks onContinue={() => transitionToPhase(17)} />;
            case 17: return <Phase16Dummy
                joinedWithCode={joinedWithCode}
                onBack={() => transitionToPhase(15, 'back')}
                onContinue={(data: { week1: string | null; week2: string | null; week3: string | null }) => {
                    setPlanData((prev: any) => ({
                        ...prev,
                        phase16Rewards: data,
                    }));
                    void advanceAfterRewards();
                }}
            />;
            case 18: return <Phase17Dummy
                joinedWithCode={joinedWithCode}
                onBack={() => transitionToPhase(17, 'back')}
                onContinue={finishPenaltyStep}
            />;
            case 10: return <Phase19PlanTimeline
                userName={userName}
                userGender={userGender}
                joinedWithCode={joinedWithCode}
                weeklyPlan={generatedWeeklyPlan}
                currentWeight={userWeight}
                weightUnit={userWeightUnit}
                mainGoal={userGoal}
                onBack={() => transitionToPhase(11, 'back')}
                onContinue={async ({ skipPaywall } = {}) => {
                    onboardingCompletedRef.current = true;
                    await markOnboardingComplete();

                    await refreshAccess();
                    let billingHasAccess = hasAccess;
                    try {
                        const res = await authFetch(`${API_BASE_URL}/billing/access`);
                        const data = await res.json();
                        billingHasAccess = !!data?.billing?.hasAccess;
                    } catch {
                        // Fall back to the latest entitlement snapshot.
                    }

                    if (skipPaywall || billingHasAccess) {
                        router.replace('/welcome');
                        return;
                    }

                    router.push('/paywall');
                }}
            />;
            case 11: {
                if (!isAuthenticated) {
                    return (
                        <View style={styles.checkpointLoading}>
                            <ActivityIndicator size="large" color={COLORS.coral} />
                        </View>
                    );
                }

                return <Phase18PlanSetup
                key={`plan-${planDevView ?? 'auto'}`}
                onBack={() => transitionToPhase(17, 'back')}
                onGeneratePlan={generateOnboardingWeeklyPlan}
                onGenerated={(weeklyPlan) => {
                    setGeneratedWeeklyPlan(weeklyPlan);
                    setPlanDevView(null);
                    transitionToPhase(10);
                }}
                currentWeight={userWeight}
                weightUnit={userWeightUnit}
                height={userHeight}
                heightUnit={userHeightUnit}
                targetWeight={userTargetWeight}
                gender={userGender}
                mainGoal={userGoal}
                planData={planData}
                availableDays={availableDays}
                initialWeeklyPlan={generatedWeeklyPlan}
                devView={planDevView ?? 'auto'}
            />;
            }
            case 19: return <WeightBranch
                currentWeight={userWeight}
                targetWeight={userTargetWeight}
                unit={userWeightUnit}
                gender={userGender}
                onBack={() => transitionToPhase(2, 'back')}
                onComplete={(data: any) => {
                    // Map WeightBranch data to planData
                    const finalTimeHorizon = data.timeline === 'custom' ? 'SPECIFIC_DATE' : (data.timeline === 'aggressive' ? 'AGGRESSIVE' : 'STANDARD');

                    setPlanData((prev: any) => ({
                        ...prev,
                        timeHorizon: finalTimeHorizon,
                        targetDate: data.timeline === 'custom' && data.targetDate
                            ? data.targetDate.toISOString()
                            : null,
                        trainingStyle: data.trainingStyle,
                        hasRaceGoal: data.raceTraining === 'yes',
                    }));

                    if (userGoal === 'both') transitionToPhase(20);
                    else transitionToPhase(joinedWithCode ? 12 : 9);
                }}
            />;
            case 20: return <RunningBranch
                skipDietStrategy={userGoal === 'both'}
                gender={userGender}
                initialData={planData.runningBranchDraft}
                onBack={() => transitionToPhase(2, 'back')}
                onComplete={(data: any) => {
                // Map RunningBranch data to planData
                setPlanData((prev: any) => ({
                    ...prev,
                    runGoal: data.trainingGoal,
                    runExperience: data.isAbsoluteNewToRunning ? 'beginner' : data.experience,
                    runDietFocus: data.dietStrategy,
                    runPriority: data.priority,
                    hasRaceGoal: prev.hasRaceGoal || data.raceDateSelection === 'yes',
                    runRaceDate: data.raceDate || null,
                    baselinePaceSecPerKm: data.baselinePaceSecPerKm ?? null,
                    runningBranchDraft: data,
                }));
                transitionToPhase(joinedWithCode ? 12 : 9);
            }} />;
            case 21: return <Phase20RunningHabits onComplete={goToNextPhase} />;
            case 23: return <Phase4PartnerCode
                onBack={() => transitionToPhase(partnerCodeBackPhaseRef.current, 'back')}
                onConnect={handlePartnerConnectFromCode}
                onLoginWithInvite={handlePartnerLoginFromCode}
            />;
            case 25: return <Phase3ProofChart
                userName={userName}
                onBack={() => transitionToPhase(proofChartBackPhaseRef.current, 'back')}
                onContinue={() => transitionToPhase(5)}
            />;
            default: return null;
        }
    };

    const renderDevPhaseControls = () => {
        if (!__DEV__) return null;

        const currentStep = DEV_NAV_STEPS[devStepIndex];
        const isFirstPhase = devStepIndex <= 0;
        const isLastPhase = devStepIndex === DEV_NAV_STEPS.length - 1;
        const phaseFileName = getDevStepLabel(currentStep);
        const phasePosition = `${devStepIndex + 1}/${DEV_NAV_STEPS.length}`;

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
                        {phasePosition} · {phaseFileName}
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

    const usesHeroBackground = HERO_BACKGROUND_PHASES.has(currentPhase);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isSplashVisible ? "light-content" : "dark-content"} />

            <View style={[
                styles.safeArea,
                { backgroundColor: usesHeroBackground ? HERO_BACKGROUND_COLOR : COLORS.white },
            ]}>
                {checkpointHydrated ? (
                    <OnboardingPhaseTransition
                        currentPhase={currentPhase}
                        renderPhase={renderPhaseContent}
                    />
                ) : (
                    <View style={styles.checkpointLoading}>
                        <ActivityIndicator size="large" color={COLORS.coral} />
                    </View>
                )}

                {checkpointHydrated && ONBOARDING_PROGRESS[currentPhase] !== undefined && (
                    <View
                        pointerEvents="none"
                        style={[styles.progressTrack, { top: insets.top + 5 }]}
                    >
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: progressAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                },
                            ]}
                        />
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
    phaseContent: {
        ...StyleSheet.absoluteFillObject,
    },
    checkpointLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressTrack: {
        position: 'absolute',
        left: 28,
        right: 28,
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(31, 41, 55, 0.08)',
        zIndex: 850,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: COLORS.coral,
        opacity: 0.78,
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
