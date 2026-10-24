// app/app/runs/runscreen.tsx
// Unified Run Session Engine - Core component for all run types

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, StatusBar,
    Dimensions, Alert, Platform, PanResponder, BackHandler, Image,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker, type LatLng } from "react-native-maps";
import { LinearGradient } from 'expo-linear-gradient';
import { saveRun, syncPendingRuns } from '@/lib/run-storage';
import * as Location from "expo-location";
import {
    Play, Pause, Square, Brain, Heart, Zap, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Target,
    LocateFixed
} from 'lucide-react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
    interpolate, withDelay, withSpring, Easing
} from 'react-native-reanimated';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RunResultScreen } from "./RunPhotoCaptur";
import { API_BASE_URL, getDefaultHeaders } from "@/config/api";
import { useRunTracker } from "@/hooks/useRunTracker";
import { useAuth } from "@/src/auth/authContext";
import { useTabBar } from "@/contexts/TabBarContext";
import { getRunTemplate, RUN_TEMPLATES } from "@/lib/run-templates";
import { APP_NAME } from '@/constants/branding';
import type { RunType, SessionAim } from "@/types/RunTemplate";
import type { Run } from "@/types/run";
import { getCuesForRun } from "@/lib/cues";
import { estimateDistanceCalories } from '@/lib/calorie-burn';
import { haversineDistanceMeters } from "@/lib/geo";
import { generateApproxLoopRoute, generateRoadLoopRoute } from "@/lib/loop-route";
import { getGenderMascotSource } from "@/utils/genderMascot";
import {
    getPaceState,
    parseWeekNumber,
    pickConfiguredRunInstruction,
    type RunInstructionTrigger,
} from "@/lib/run-instruction-config";
import { usePaceProfile } from '@/hooks/usePaceProfile';
import {
    buildPaceBarZones,
    buildRunPhasePlan,
    getPaceBarPosition as getPersonalizedPaceBarPosition,
    getPhaseProgressFromPlan,
} from '@/lib/run-pace-targets';

import type { PerceivedEffort } from '@/lib/pace-personalization';

const { width, height } = Dimensions.get('window');

const COLORS = {
    glassDark: 'rgba(255, 255, 255, 0.90)',
    glassLight: 'rgba(255, 255, 255, 0.2)',
    textLight: '#F8FAFC',
    textDark: '#0F172A',
    bottomBar: '#14213D',
    muted: '#64748B',
    alertOrange: '#F97316',
    coral: '#FF6B6B',
};

const METERS_PER_DEG_LAT = 111_111;

function offsetCoordinate(
    coordinate: LatLng,
    eastMeters: number,
    northMeters: number
): LatLng {
    const latRad = (coordinate.latitude * Math.PI) / 180;
    const metersPerDegLon = Math.max(1, METERS_PER_DEG_LAT * Math.cos(latRad));

    return {
        latitude: coordinate.latitude + northMeters / METERS_PER_DEG_LAT,
        longitude: coordinate.longitude + eastMeters / metersPerDegLon,
    };
}

function normalizeHeading(heading: number): number {
    return ((heading % 360) + 360) % 360;
}

function shortestHeadingDelta(from: number, to: number): number {
    return ((to - from + 540) % 360) - 180;
}

// Icon mapping for session aims
const AIM_ICONS: Record<SessionAim['icon'], React.ComponentType<any>> = {
    brain: Brain,
    flame: Zap,
    heart: Heart,
    zap: Zap,
    target: Target,
};

export default function RunScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = React.useRef<MapView>(null);
    const { authFetch, user } = useAuth();
    const { setTabBarVisible } = useTabBar();
    // Get params from navigation
    const params = useLocalSearchParams<{
        templateId?: string;
        distanceKm?: string;
        weekContext?: string;
        askLoop?: string;
        runType?: string;
    }>();

    // Determine which template to use - with fallback to 'easy' 
    const rawTemplateId = params.templateId as string;
    let templateId: RunType = 'easy'; // default
    
    // Validate templateId exists in RUN_TEMPLATES
    if (rawTemplateId && RUN_TEMPLATES[rawTemplateId as RunType]) {
        templateId = rawTemplateId as RunType;
    } else if (rawTemplateId) {
        console.warn(`Invalid templateId '${rawTemplateId}', falling back to 'easy'`);
    }
    
    const template = useMemo(() => getRunTemplate(templateId), [templateId]);
    const workoutLabel = typeof params.runType === 'string' && params.runType.trim()
        ? params.runType.trim()
        : template.title;
    const workoutType: NonNullable<Run['workoutType']> =
        templateId === 'walk' || templateId.endsWith('_walk') ? 'WALK' : 'RUN';
    // Use session/day km when provided and valid, otherwise fall back to template default.
    const parsedDistanceKm = params.distanceKm ? parseFloat(params.distanceKm) : NaN;
    const targetDistanceKm =
        Number.isFinite(parsedDistanceKm) && parsedDistanceKm > 0
            ? parsedDistanceKm
            : template.defaultDistanceKm;

    const weekContext = params.weekContext || 'WEEK 1 / FOUNDATION';
    const shouldOfferLoopPrompt = templateId === 'long_walk' || params.askLoop === '1';

    // Use the real GPS tracker hook
    const {
        state: runState,
        route,
        smoothedLocation,
        startTime,
        endTime,
        elapsedSec,
        distanceM,
        paceSecPerKm,
        startRun,
        pauseRun,
        resumeRun,
        finishRun,
        resetRun,
    } = useRunTracker();

    const [isSaving, setIsSaving] = useState(false);
    const savedFinishedRunRef = React.useRef(false);
    const [plannedLoopCoords, setPlannedLoopCoords] = useState<LatLng[]>([]);
    const [plannedLoopDistanceM, setPlannedLoopDistanceM] = useState(0);
    const [loopPreviewActive, setLoopPreviewActive] = useState(false);
    const [isGeneratingLoop, setIsGeneratingLoop] = useState(false);
    const [longWalkLoopDecision, setLongWalkLoopDecision] = useState<'undecided' | 'yes' | 'no'>('undecided');
    const [loopAnchor, setLoopAnchor] = useState<LatLng | null>(null);
    const [isFollowingUser, setIsFollowingUser] = useState(true);
    const [cameraHeading, setCameraHeading] = useState(0);
    const [isHudCollapsed, setIsHudCollapsed] = useState(true);
    const [userGender, setUserGender] = useState<string | null>(
        typeof user?.gender === 'string' ? user.gender : null
    );
    const [userWeightKg, setUserWeightKg] = useState<number | null>(
        typeof user?.weightKg === 'number' && user.weightKg > 0 ? user.weightKg : null
    );
    const lastFollowCameraHeadingRef = React.useRef<number | null>(null);
    const lastFollowCameraCoordinateRef = React.useRef<LatLng | null>(null);
    const coachAvatarSource = useMemo(() => getGenderMascotSource(userGender), [userGender]);
    const { profile: paceProfile } = usePaceProfile(true);

    // RunTogether guidance & HUD state
    const [instruction, setInstruction] = useState<string | null>(null);
    const instructionAnim = useSharedValue(0); 
    const introAnim = useSharedValue(0); 
    const hudShrinkAnim = useSharedValue(1); // 1 = shrunk (default)
    const lastPhaseInstructionIndexRef = React.useRef<number | null>(null);
    const instructionCountsRef = React.useRef<Record<string, number>>({});
    const instructionLastShownAtRef = React.useRef<Record<string, number>>({});
    const instructionHideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const instructionSwipeStartRef = React.useRef(0);
    const lastInstructionSwipeAtRef = React.useRef(0);
    const handleBackPressRef = React.useRef<() => void>(() => {});
    const coachDistanceRef = React.useRef(0);
    const lastObservedCoachDistanceRef = React.useRef(0);
    const periodicCoachDistanceRef = React.useRef(0);
    const lastCoachMovementAtRef = React.useRef(0);
    const coachContextRef = React.useRef({
        templateId,
        phaseLabel: "WARM UP",
        elapsedSec: 0,
        distanceProgressPercent: 0,
        weekNumber: null as number | null,
        paceState: "unknown" as ReturnType<typeof getPaceState>,
    });

    // Force re-render every second to keep the phase timer active
    const [, setTick] = useState(0);

    useEffect(() => {
        setTabBarVisible(false);
        return () => {
            setTabBarVisible(true);
        };
    }, [setTabBarVisible]);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (typeof user?.gender === 'string' && user.gender.trim().length > 0) {
            setUserGender(user.gender);
        }
        if (typeof user?.weightKg === 'number' && user.weightKg > 0) {
            setUserWeightKg(user.weightKg);
        }
    }, [user?.gender, user?.weightKg]);

    useEffect(() => {
        let isActive = true;

        const loadProfileGender = async () => {
            try {
                const response = await authFetch(`${API_BASE_URL}/profile`, {
                    headers: getDefaultHeaders(API_BASE_URL),
                });

                if (!response.ok) {
                    return;
                }

                const json = await response.json();
                const nextGender = json?.user?.gender;
                const nextWeight = json?.user?.weightKg ?? json?.plan?.weightKg;

                if (isActive && typeof nextGender === 'string' && nextGender.trim().length > 0) {
                    setUserGender(nextGender);
                }
                if (isActive && typeof nextWeight === 'number' && nextWeight > 0) {
                    setUserWeightKg(nextWeight);
                }
            } catch (error) {
                console.warn('Failed to load run profile gender', error);
            }
        };

        loadProfileGender();

        return () => {
            isActive = false;
        };
    }, [authFetch]);

    // --- FAT BURN PULSE ANIMATION ---
    const pulseOpacity = useSharedValue(0.7);
    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withSequence(withTiming(1, { duration: 1000 }), withTiming(0.6, { duration: 1000 })),
            -1, true
        );
    }, []);

    const animatedPulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

    const hideInstruction = () => {
        if (instructionHideTimeoutRef.current) {
            clearTimeout(instructionHideTimeoutRef.current);
            instructionHideTimeoutRef.current = null;
        }

        instructionAnim.value = withTiming(0, {
            duration: 600,
            easing: Easing.bezier(0.33, 1, 0.68, 1)
        });
    };

    const showInstruction = (message: string) => {
        setInstruction(message);

        if (instructionHideTimeoutRef.current) {
            clearTimeout(instructionHideTimeoutRef.current);
        }

        // Slide top HUD to Coach page using smooth timing (NO BOUNCE)
        instructionAnim.value = withTiming(1, { 
            duration: 600, 
            easing: Easing.bezier(0.33, 1, 0.68, 1) 
        });

        // Auto-slide back to Pace page after 10 seconds
        instructionHideTimeoutRef.current = setTimeout(() => {
            hideInstruction();
        }, 10000);
    };

    const goToHudPage = (page: 0 | 1) => {
        if (instructionHideTimeoutRef.current) {
            clearTimeout(instructionHideTimeoutRef.current);
            instructionHideTimeoutRef.current = null;
        }

        lastInstructionSwipeAtRef.current = Date.now();
        instructionAnim.value = withSpring(page, {
            duration: 350,
            dampingRatio: 1,
        });
    };

    const toggleHudPage = () => {
        goToHudPage(instructionAnim.value >= 0.5 ? 0 : 1);
    };

    const instructionSwipeResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    Math.abs(gestureState.dx) > 10 &&
                    Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
                onMoveShouldSetPanResponderCapture: (_, gestureState) =>
                    Math.abs(gestureState.dx) > 10 &&
                    Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
                onPanResponderGrant: () => {
                    instructionSwipeStartRef.current = instructionAnim.value;
                    if (instructionHideTimeoutRef.current) {
                        clearTimeout(instructionHideTimeoutRef.current);
                        instructionHideTimeoutRef.current = null;
                    }
                },
                onPanResponderMove: (_, gestureState) => {
                    const pageWidth = Math.max(1, width - 68);
                    const nextProgress = instructionSwipeStartRef.current - gestureState.dx / pageWidth;
                    instructionAnim.value = Math.max(0, Math.min(1, nextProgress));
                },
                onPanResponderRelease: (_, gestureState) => {
                    lastInstructionSwipeAtRef.current = Date.now();
                    const movedLeft = gestureState.dx < -32 || gestureState.vx < -0.35;
                    const movedRight = gestureState.dx > 32 || gestureState.vx > 0.35;
                    const targetPage = movedLeft
                        ? 1
                        : movedRight
                            ? 0
                            : instructionSwipeStartRef.current >= 0.5
                                ? 1
                                : 0;

                    instructionAnim.value = withSpring(targetPage, {
                        duration: 350,
                        dampingRatio: 1,
                        velocity: -gestureState.vx,
                    });
                },
                onPanResponderTerminate: () => {
                    lastInstructionSwipeAtRef.current = Date.now();
                    instructionAnim.value = withSpring(
                        instructionAnim.value >= 0.5 ? 1 : 0,
                        { duration: 350, dampingRatio: 1 }
                    );
                },
            }),
        []
    );

    const triggerCoachInstruction = (trigger: RunInstructionTrigger = "manual") => {
        const coachContext = coachContextRef.current;
        const configuredRule = pickConfiguredRunInstruction(
            {
                templateId: coachContext.templateId,
                trigger,
                phaseLabel: coachContext.phaseLabel,
                elapsedSec: coachContext.elapsedSec,
                distanceProgressPercent: coachContext.distanceProgressPercent,
                weekNumber: coachContext.weekNumber,
                paceState: coachContext.paceState,
            },
            instructionCountsRef.current,
            instructionLastShownAtRef.current
        );

        if (configuredRule) {
            instructionCountsRef.current[configuredRule.id] = (instructionCountsRef.current[configuredRule.id] ?? 0) + 1;
            instructionLastShownAtRef.current[configuredRule.id] = coachContext.elapsedSec;
        }

        const fallbackCues = getCuesForRun(coachContext.templateId);
        const fallbackMessage = fallbackCues[Math.floor(Math.random() * fallbackCues.length)];
        const message = configuredRule?.message ?? fallbackMessage;
        showInstruction(message);
    };

    useEffect(() => {
        coachDistanceRef.current = distanceM;

        if (runState === 'idle') {
            lastObservedCoachDistanceRef.current = 0;
            periodicCoachDistanceRef.current = 0;
            lastCoachMovementAtRef.current = 0;
            return;
        }

        if (runState === 'running' && distanceM > lastObservedCoachDistanceRef.current + 1) {
            lastCoachMovementAtRef.current = Date.now();
        }

        lastObservedCoachDistanceRef.current = distanceM;
    }, [distanceM, runState]);

    // Rotate through cues only while GPS confirms recent movement.
    useEffect(() => {
        if (runState === 'running') {
            periodicCoachDistanceRef.current = coachDistanceRef.current;

            // Initial intro animation
            if (introAnim.value === 0) {
                introAnim.value = withDelay(200, withSpring(1, { damping: 15 }));
            }

            const coachInterval = setInterval(() => {
                const currentDistanceM = coachDistanceRef.current;
                const movementSinceLastCheckM = currentDistanceM - periodicCoachDistanceRef.current;
                periodicCoachDistanceRef.current = currentDistanceM;

                if (movementSinceLastCheckM >= 8) {
                    triggerCoachInstruction('periodic');
                }
            }, 25000); // Coach speaks every 25 seconds

            return () => clearInterval(coachInterval);
        }
    }, [runState, templateId]);

    // Derived values
    const currentKm = (distanceM / 1000).toFixed(2);
    const calories = estimateDistanceCalories(
        distanceM,
        workoutType === 'WALK' ? 'WALK' : 'RUN',
        userWeightKg ?? undefined,
    );
    const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

    const runPhasePlan = useMemo(
        () => buildRunPhasePlan(
            paceProfile,
            template,
            templateId,
            targetDistanceKm,
            workoutLabel,
        ),
        [paceProfile, template, templateId, targetDistanceKm, workoutLabel],
    );

    const distanceProgressPercent = (distanceM / (targetDistanceKm * 1000)) * 100;
    const phaseInfo = getPhaseProgressFromPlan(runPhasePlan, elapsedSec, distanceProgressPercent);
    const currentPhase = phaseInfo.currentPhase;
    const currentPhasePace = currentPhase.pace;
    const phaseCountdown = formatTime(phaseInfo.timeRemainingSec);
    const weekNumber = useMemo(() => parseWeekNumber(weekContext), [weekContext]);
    const instructionWeekNumber = weekNumber ?? 1;
    const targetDisplayLabel = currentPhasePace.displayLabel;
    const paceBarZones = useMemo(
        () => buildPaceBarZones(runPhasePlan.mainRange, template),
        [runPhasePlan.mainRange, template],
    );
    const paceBarTargetZoneIndex = 1;
    const paceBarPointerPosition = getPersonalizedPaceBarPosition(paceSecPerKm, paceBarZones);
    const paceState = useMemo(
        () => getPaceState(
            paceSecPerKm,
            currentPhasePace.minPaceSecPerKm,
            currentPhasePace.maxPaceSecPerKm,
        ),
        [paceSecPerKm, currentPhasePace],
    );

    useEffect(() => {
        coachContextRef.current = {
            templateId,
            phaseLabel: currentPhase.label,
            elapsedSec,
            distanceProgressPercent: phaseInfo.distanceProgressPercent,
            weekNumber: instructionWeekNumber,
            paceState,
        };
    }, [templateId, currentPhase.label, elapsedSec, phaseInfo.distanceProgressPercent, instructionWeekNumber, paceState]);

    useEffect(() => {
        if (runState !== "running") {
            lastPhaseInstructionIndexRef.current = null;
            return;
        }

        if (lastPhaseInstructionIndexRef.current === phaseInfo.currentPhaseIndex) {
            return;
        }

        const hasRecentMovement = Date.now() - lastCoachMovementAtRef.current <= 15000;
        if (!hasRecentMovement) {
            return;
        }

        lastPhaseInstructionIndexRef.current = phaseInfo.currentPhaseIndex;
        triggerCoachInstruction("phase_start");
    }, [distanceM, runState, phaseInfo.currentPhaseIndex]);

    // Track user location with smooth animation instead of rigid region prop
    const currentMarkerCoordinate = useMemo(() => {
        if (smoothedLocation) {
            return {
                latitude: smoothedLocation.lat,
                longitude: smoothedLocation.lon,
            } as LatLng;
        }

        if (route.length === 0) return null;
        const last = route[route.length - 1];
        return {
            latitude: last.lat,
            longitude: last.lon,
        } as LatLng;
    }, [route, smoothedLocation]);

    const currentMarkerHeading = smoothedLocation?.heading ?? null;
    const displayedMarkerHeading =
        currentMarkerHeading === null ? 0 : normalizeHeading(currentMarkerHeading - cameraHeading);
    const showDynamicMarkerHeading = isFollowingUser && currentMarkerHeading !== null;

    const focusCameraOnUser = useCallback((duration: number, immediateHeading = false) => {
        if (!currentMarkerCoordinate) return false;

        if (currentMarkerHeading !== null) {
            const nextHeading = normalizeHeading(currentMarkerHeading);
            const previousHeading = lastFollowCameraHeadingRef.current;
            const previousCoordinate = lastFollowCameraCoordinateRef.current;
            const headingDelta =
                previousHeading === null ? 180 : Math.abs(shortestHeadingDelta(previousHeading, nextHeading));
            const movedMeters = previousCoordinate
                ? haversineDistanceMeters(
                    { lat: previousCoordinate.latitude, lon: previousCoordinate.longitude },
                    { lat: currentMarkerCoordinate.latitude, lon: currentMarkerCoordinate.longitude }
                )
                : Number.POSITIVE_INFINITY;

            setCameraHeading(nextHeading);
            const nextCamera = {
                center: currentMarkerCoordinate,
                heading: nextHeading,
                pitch: 0,
                altitude: Platform.OS === 'ios' ? 650 : undefined,
                zoom: Platform.OS === 'android' ? 18.2 : undefined,
            };

            if ((immediateHeading && movedMeters < 1.2) || (headingDelta >= 1.25 && movedMeters < 1.2)) {
                mapRef.current?.setCamera(nextCamera);
            } else if (headingDelta >= 0.6 || movedMeters >= 0.5) {
                mapRef.current?.animateCamera(nextCamera, { duration });
            } else {
                return true;
            }

            lastFollowCameraHeadingRef.current = nextHeading;
            lastFollowCameraCoordinateRef.current = currentMarkerCoordinate;
            return true;
        }

        mapRef.current?.animateToRegion(
            {
                latitude: currentMarkerCoordinate.latitude,
                longitude: currentMarkerCoordinate.longitude,
                latitudeDelta: 0.0035,
                longitudeDelta: 0.0035,
            },
            duration
        );
        lastFollowCameraHeadingRef.current = 0;
        lastFollowCameraCoordinateRef.current = currentMarkerCoordinate;
        return true;
    }, [currentMarkerCoordinate, currentMarkerHeading]);

    useEffect(() => {
        if (!currentMarkerCoordinate || !isFollowingUser || (runState !== 'running' && runState !== 'paused')) return;
        focusCameraOnUser(140, true);
    }, [currentMarkerCoordinate, currentMarkerHeading, focusCameraOnUser, runState, isFollowingUser]);

    const currentPace = paceSecPerKm
        ? (paceSecPerKm / 60).toFixed(2)
        : '0.00';

    // --- ANIMATED STYLES ---
    const timerContainerStyle = useAnimatedStyle(() => {
        const config = { duration: 300, easing: Easing.out(Easing.exp) };
        return { 
            transform: [
                { scale: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [1, 0.9]), config) },
                { translateY: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [0, -20]), config) }
            ],
            opacity: 1
        };
    });

    const hudProgressBarStyle = useAnimatedStyle(() => {
        const config = { duration: 300, easing: Easing.out(Easing.exp) };
        return {
            height: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [38, 0]), config),
            opacity: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [1, 0]), config),
            marginTop: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [8, 0]), config),
            overflow: 'visible',
        };
    });

    const HUD_CARD_INNER_WIDTH = width - 68;

    const hudPaginationStyle = useAnimatedStyle(() => {
        return {
            transform: [{ 
                translateX: interpolate(instructionAnim.value, [0, 1], [0, -HUD_CARD_INNER_WIDTH])
            }]
        };
    });

    const hudPagerCollapseStyle = useAnimatedStyle(() => {
        const config = { duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1) };
        return {
            height: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [110, 0]), config),
            opacity: withTiming(interpolate(hudShrinkAnim.value, [0, 0.65, 1], [1, 0, 0]), config),
            marginBottom: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [8, 0]), config),
        };
    });

    const phaseHeaderCollapseStyle = useAnimatedStyle(() => {
        const config = { duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1) };
        return {
            marginBottom: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [24, 0]), config),
            paddingBottom: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [20, 0]), config),
            borderBottomWidth: withTiming(interpolate(hudShrinkAnim.value, [0, 1], [1.5, 0]), config),
        };
    });

    const page1Style = useAnimatedStyle(() => ({ opacity: 1 }));
    const page2Style = useAnimatedStyle(() => ({ opacity: 1 }));
    const forwardChevronStyle = useAnimatedStyle(() => ({
        opacity: interpolate(instructionAnim.value, [0, 0.45], [1, 0]),
    }));
    const backChevronStyle = useAnimatedStyle(() => ({
        opacity: interpolate(instructionAnim.value, [0.55, 1], [0, 1]),
    }));

    const coachContainerStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(instructionAnim.value, [0, 1], [0.8, 1]),
            transform: [
                { scale: interpolate(instructionAnim.value, [0, 1], [1, 1.1]) },
                { translateY: interpolate(instructionAnim.value, [0, 1], [0, -10]) }
            ]
        };
    });

    const bubbleStyle = useAnimatedStyle(() => {
        return {
            opacity: instructionAnim.value,
            transform: [
                { scale: instructionAnim.value },
                { translateY: interpolate(instructionAnim.value, [0, 1], [20, -10]) }
            ]
        };
    });

    const introButtonStyle = useAnimatedStyle(() => ({
        opacity: interpolate(introAnim.value, [0, 1], [1, 0]),
        transform: [{ translateY: interpolate(introAnim.value, [0, 1], [0, 50]) }]
    }));

    useEffect(() => {
        if (runState === 'idle') {
            setIsFollowingUser(true);
            setCameraHeading(0);
            lastFollowCameraHeadingRef.current = null;
            lastFollowCameraCoordinateRef.current = null;
            lastPhaseInstructionIndexRef.current = null;
            instructionCountsRef.current = {};
            instructionLastShownAtRef.current = {};
            if (instructionHideTimeoutRef.current) {
                clearTimeout(instructionHideTimeoutRef.current);
                instructionHideTimeoutRef.current = null;
            }
        }
    }, [runState]);

    useEffect(() => {
        return () => {
            if (instructionHideTimeoutRef.current) {
                clearTimeout(instructionHideTimeoutRef.current);
            }
        };
    }, []);

    // Prepare run summary for saving
    const runSummary = useMemo(() => {
        if (runState !== 'finished' || !startTime || !endTime) return null;
        return {
            id: `${startTime.toISOString()}_${endTime.toISOString()}`,
            startedAt: startTime.toISOString(),
            endedAt: endTime.toISOString(),
            durationSeconds: elapsedSec,
            totalDistanceMeters: distanceM,
            avgPaceSecPerKm: paceSecPerKm,
            workoutType,
            title: workoutLabel,
            calories,
            route,
        } as Run;
    }, [runState, startTime, endTime, elapsedSec, distanceM, paceSecPerKm, route, workoutLabel, workoutType, calories]);

    const handleEffortSelect = async (perceivedEffort: PerceivedEffort) => {
        if (!runSummary) return null;
        setIsSaving(true);
        try {
            const paceUpdate = await saveRun({ ...runSummary, perceivedEffort }, authFetch);
            savedFinishedRunRef.current = true;
            return paceUpdate;
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!runSummary) return;
        if (savedFinishedRunRef.current) {
            clearLoopPreview();
            resetRun();
            router.back();
            return;
        }
        try {
            setIsSaving(true);
            await saveRun(runSummary, authFetch);
            Alert.alert("Saved", "Run saved to history.");
            clearLoopPreview();
            resetRun();
            router.back();
        } catch (e) {
            Alert.alert("Error", "Could not save run.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDone = () => {
        clearLoopPreview();
        resetRun();
        router.back();
    };

    const clearLoopPreview = () => {
        setPlannedLoopCoords([]);
        setPlannedLoopDistanceM(0);
        setLoopPreviewActive(false);
        setIsGeneratingLoop(false);
        setLongWalkLoopDecision('undecided');
        setLoopAnchor(null);
    };

    const saveAndExitCurrentSession = async () => {
        if (!startTime || isSaving) return;

        const finalEndTime = endTime ?? new Date();
        const partialRun: Run = {
            id: `${startTime.toISOString()}_${finalEndTime.toISOString()}`,
            startedAt: startTime.toISOString(),
            endedAt: finalEndTime.toISOString(),
            durationSeconds: elapsedSec,
            totalDistanceMeters: distanceM,
            avgPaceSecPerKm: distanceM > 10 ? elapsedSec / (distanceM / 1000) : null,
            workoutType,
            title: workoutLabel,
            calories,
            route,
        };

        try {
            setIsSaving(true);
            await finishRun();
            await saveRun(partialRun);
            void syncPendingRuns(authFetch).catch(() => {});
            clearLoopPreview();
            router.back();
        } catch (error) {
            console.warn('Failed to save partial workout before exit', error);
            Alert.alert(
                'Could not save workout',
                'Your workout is still open. Please try again so your distance is not lost.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackPress = () => {
        if (isSaving) return;

        if (runState === 'idle' || !startTime) {
            clearLoopPreview();
            router.back();
            return;
        }

        const activityName = workoutType === 'WALK' ? 'walk' : 'run';
        Alert.alert(
            `Save and exit this ${activityName}?`,
            `Your completed ${currentKm} km will be saved to your activity history.`,
            [
                {
                    text: 'Keep Going',
                    style: 'cancel',
                },
                {
                    text: 'Save & Exit',
                    onPress: () => {
                        void saveAndExitCurrentSession();
                    },
                },
            ]
        );
    };

    handleBackPressRef.current = handleBackPress;

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBackPressRef.current();
            return true;
        });

        return () => subscription.remove();
    }, []);

    const displayLoopAnchor = useMemo(() => {
        if (!loopAnchor) return null;
        if (!currentMarkerCoordinate) return loopAnchor;

        const overlapDistance = haversineDistanceMeters(
            { lat: loopAnchor.latitude, lon: loopAnchor.longitude },
            { lat: currentMarkerCoordinate.latitude, lon: currentMarkerCoordinate.longitude }
        );

        if (overlapDistance < 18) {
            return offsetCoordinate(loopAnchor, 10, 12);
        }

        return loopAnchor;
    }, [loopAnchor, currentMarkerCoordinate]);

    // Map region from route
    const mapRegion = useMemo(() => {
        if (route.length > 0) {
            const lastPoint = route[route.length - 1];
            return {
                latitude: lastPoint.lat,
                longitude: lastPoint.lon,
                latitudeDelta: 0.0015,
                longitudeDelta: 0.0015,
            };
        }
        return { latitude: -37.8136, longitude: 144.9631, latitudeDelta: 0.008, longitudeDelta: 0.008 };
    }, [route]);

    // Convert route for polyline
    const routeCoords = useMemo(
        () => route.map((p) => ({ latitude: p.lat, longitude: p.lon })),
        [route]
    );

    const displayRouteCoords = useMemo(() => {
        if (!currentMarkerCoordinate) return routeCoords;
        if (routeCoords.length === 0) return [currentMarkerCoordinate];

        const lastRouteCoord = routeCoords[routeCoords.length - 1];
        const gapToMarker = haversineDistanceMeters(
            { lat: lastRouteCoord.latitude, lon: lastRouteCoord.longitude },
            { lat: currentMarkerCoordinate.latitude, lon: currentMarkerCoordinate.longitude }
        );

        if (gapToMarker < 1) {
            return routeCoords;
        }

        return [...routeCoords, currentMarkerCoordinate];
    }, [currentMarkerCoordinate, routeCoords]);

    const generateLongWalkLoopPreview = async () => {
        setIsGeneratingLoop(true);
        try {
            let anchor = smoothedLocation
                ? { lat: smoothedLocation.lat, lon: smoothedLocation.lon }
                : null;

            if (!anchor) {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (permission.status !== 'granted') {
                    Alert.alert("Location Needed", "Location permission is required to generate a walk loop.");
                    setLongWalkLoopDecision('undecided');
                    return;
                }

                const current = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                anchor = {
                    lat: current.coords.latitude,
                    lon: current.coords.longitude,
                };
            }

            if (!anchor) {
                Alert.alert("Location Unavailable", "Could not get your location to create a loop.");
                setLongWalkLoopDecision('undecided');
                return;
            }

            let generated;
            let usedFallbackApprox = false;
            try {
                generated = await generateRoadLoopRoute(anchor, targetDistanceKm * 1000, {
                    profile: 'foot',
                });
            } catch (roadErr) {
                console.warn("Road loop generation failed, falling back to local loop", roadErr);
                generated = generateApproxLoopRoute(anchor, targetDistanceKm * 1000);
                usedFallbackApprox = true;
            }

            setPlannedLoopCoords(generated.coordinates);
            setPlannedLoopDistanceM(generated.estimatedDistanceMeters);
            setLoopPreviewActive(true);
            setLoopAnchor({ latitude: anchor.lat, longitude: anchor.lon });

            if (usedFallbackApprox) {
                Alert.alert(
                    "Road Loop Unavailable",
                    "Couldn't fetch a road-following loop right now, so a local preview loop was generated instead."
                );
            }

            setTimeout(() => {
                if (generated.coordinates.length > 1) {
                    mapRef.current?.fitToCoordinates(generated.coordinates, {
                        edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
                        animated: true,
                    });
                }
            }, 50);
        } catch (e) {
            console.warn("Failed to generate long walk loop preview", e);
            Alert.alert("Loop Preview Failed", "Could not create a loop right now. You can try again or start normally.");
            setLongWalkLoopDecision('undecided');
            setLoopPreviewActive(false);
        } finally {
            setIsGeneratingLoop(false);
        }
    };

    const handleStartPress = () => {
        if (isGeneratingLoop) return;

        if (!shouldOfferLoopPrompt) {
            startRun();
            return;
        }

        if (loopPreviewActive && plannedLoopCoords.length > 1) {
            startRun();
            return;
        }

        if (longWalkLoopDecision === 'no') {
            startRun();
            return;
        }

        if (longWalkLoopDecision === 'yes') {
            generateLongWalkLoopPreview();
            return;
        }

        Alert.alert(
            "Create a Loop?",
            `Create a ${targetDistanceKm.toFixed(1)} km loop for this ${template.title.toLowerCase()}?`,
            [
                { text: "No", style: "cancel", onPress: () => { setLongWalkLoopDecision('no'); startRun(); } },
                {
                    text: "Yes",
                    onPress: () => {
                        setLongWalkLoopDecision('yes');
                        generateLongWalkLoopPreview();
                    }
                },
            ]
        );
    };

    // Recenter map on user
    const handleRecenter = () => {
        setIsFollowingUser(true);
        if (focusCameraOnUser(260)) {
            return;
        }

        if (plannedLoopCoords.length > 1) {
            mapRef.current?.fitToCoordinates(plannedLoopCoords, {
                edgePadding: { top: 120, right: 60, bottom: 220, left: 60 },
                animated: true,
            });
        }
    };

    // --- TRANSITION TO RESULT SCREEN ---
    if (runState === 'finished') {
        return (
            <RunResultScreen
                data={{
                    distance: currentKm,
                    time: formatTime(elapsedSec),
                    calories: calories,
                    partners: "Sara & Mike",
                    goalText: template.goalText
                }}
                onDone={handleSave}
                onSkip={handleSave}
                onEffortSelect={handleEffortSelect}
            />
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <StatusBar barStyle="light-content" />

            {/* BACKGROUND MAP */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={mapRegion}
                onPanDrag={() => setIsFollowingUser(false)}
                onRegionChangeComplete={(_, details) => {
                    if (details?.isGesture) {
                        setIsFollowingUser(false);
                    }
                }}
                showsMyLocationButton={false}
                showsCompass={false}
                pitchEnabled={false}
                rotateEnabled={false}
                showsBuildings={false}
                tintColor={template.primaryColor}
            >
                {displayRouteCoords.length > 1 && (
                    <Polyline
                        coordinates={displayRouteCoords}
                        strokeWidth={6}
                        strokeColor={template.primaryColor}
                    />
                )}
                {plannedLoopCoords.length > 1 && (
                    <Polyline
                        coordinates={plannedLoopCoords}
                        strokeWidth={runState === 'idle' ? 4 : 3}
                        strokeColor={runState === 'idle' ? template.primaryColor : `${template.primaryColor}88`}
                        lineDashPattern={runState === 'idle' ? [10, 8] : [6, 6]}
                        zIndex={1}
                    />
                )}
                {displayLoopAnchor && plannedLoopCoords.length > 1 && (
                    <Marker coordinate={displayLoopAnchor} title="Loop Start" tracksViewChanges={false}>
                        <View style={[styles.loopStartMarker, { borderColor: template.primaryColor }]}>
                            <View style={[styles.loopStartMarkerInner, { backgroundColor: template.primaryColor }]} />
                            <View style={[styles.loopStartMarkerBadge, { backgroundColor: template.primaryColor }]}>
                                <Text style={styles.loopStartMarkerBadgeText}>S</Text>
                            </View>
                        </View>
                    </Marker>
                )}
                {currentMarkerCoordinate && (
                    <Marker
                        coordinate={currentMarkerCoordinate}
                        title="Current Position"
                        anchor={{ x: 0.5, y: 0.5 }}
                        tracksViewChanges={showDynamicMarkerHeading}
                    >
                        <View style={styles.customMarkerWrap}>
                            <View style={styles.customMarker}>
                                {showDynamicMarkerHeading && (
                                    <View
                                        style={[
                                            styles.customMarkerHeadingWrap,
                                            { transform: [{ rotate: `${displayedMarkerHeading}deg` }] },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.customMarkerHeading,
                                                { borderBottomColor: template.primaryColor },
                                            ]}
                                        />
                                    </View>
                                )}
                                <View
                                    style={[
                                        styles.customMarkerInner,
                                        { backgroundColor: template.primaryColor, borderColor: 'white' },
                                    ]}
                                />
                            </View>
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* GRADIENT MAP DIMMING */}
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.7)']}
                locations={[0, 1]}
                style={[StyleSheet.absoluteFillObject, { top: width * 1.2 }]}
                pointerEvents="none"
            />

            {/* IDLE HERO OVERLAY */}
            {runState === 'idle' && (
                <LinearGradient
                    colors={['rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.85)']}
                    style={StyleSheet.absoluteFillObject}
                />
            )}

            <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right']} pointerEvents="box-none">

                {/* HEADER (Only for Idle State) */}
                {runState === 'idle' && (
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBackPress} style={styles.iconButton}>
                            <ChevronLeft color="white" size={24} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* MAP CONTROLS (Floating Right - Centered Vertically for better reach) */}
                <View style={styles.mapControls} pointerEvents="box-none">
                    <TouchableOpacity
                        style={[styles.mapBtn, { backgroundColor: COLORS.glassDark }]}
                        onPress={handleRecenter}
                        activeOpacity={0.7}
                    >
                        <LocateFixed size={18} color={COLORS.textDark} />
                    </TouchableOpacity>
                </View>

                {/* REMOVED: Separate floating phase timer (now integrated into top bar) */}

                {/* 1. HERO SCREEN (IDLE STATE) */}
                {runState === 'idle' && (
                    <View style={styles.heroContainer}>
                        <View style={styles.heroContentTop}>
                            <Text style={[styles.heroSubtitle, { color: template.primaryColor }]}>
                                {weekContext.toUpperCase()}
                            </Text>
                            <Text style={styles.heroTitle}>{template.title}</Text>

                            <View style={styles.aimsContainer}>
                                <Text style={styles.aimsLabel}>SESSION AIMS:</Text>
                                {template.sessionAims.map((aim, idx) => {
                                    const IconComponent = AIM_ICONS[aim.icon];
                                    return (
                                        <View key={idx} style={styles.aimPill}>
                                            <IconComponent size={16} color={template.primaryColor} />
                                            <Text style={styles.aimText}>{aim.text}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.heroContentBottom}>
                            <View style={styles.targetRow}>
                                <Text style={styles.targetVal}>{targetDistanceKm.toFixed(1)} KM</Text>
                                <Text style={[styles.targetLab, { color: template.primaryColor }]}>
                                    TARGET DISTANCE
                                </Text>
                            </View>
                            {shouldOfferLoopPrompt && loopPreviewActive && plannedLoopDistanceM > 0 && (
                                <Text style={styles.loopPreviewText}>
                                    Loop preview: ~{(plannedLoopDistanceM / 1000).toFixed(1)} km
                                </Text>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.heroStartBtn,
                                    { backgroundColor: template.primaryColor },
                                    isGeneratingLoop && { opacity: 0.7 }
                                ]}
                                onPress={handleStartPress}
                                disabled={isGeneratingLoop}
                                activeOpacity={isGeneratingLoop ? 1 : 0.7}
                            >
                                <Text style={styles.heroStartText}>
                                    {isGeneratingLoop
                                        ? 'GENERATING LOOP...'
                                        : (shouldOfferLoopPrompt && loopPreviewActive)
                                            ? 'START LOOP WALK'
                                            : 'START RUN'}
                                </Text>
                                <ChevronRight size={24} color={COLORS.textDark} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* 2. RUNNING HUD */}
                {(runState === 'running' || runState === 'paused') && (
                    <View style={styles.runningHud} pointerEvents="box-none">
                        {/* A. INTEGRATED TOP BAR (Pace + Phase) */}
                        {template.hud.showPaceBar && (
                            <Animated.View style={[styles.topHud, timerContainerStyle]} pointerEvents="box-none">
                                    <View style={styles.paceCard}>
                                        {/* Phase Header */}
                                        <Animated.View style={[styles.phaseHeaderIntegrated, phaseHeaderCollapseStyle]}>
                                            <TouchableOpacity
                                                disabled={isSaving}
                                                onPress={handleBackPress}
                                                style={styles.paceBackButtonCompact}
                                            >
                                                <ChevronLeft color={COLORS.textDark} size={20} strokeWidth={3} />
                                            </TouchableOpacity>
                                            
                                            <View style={styles.phaseMetaCluster}>
                                                {!isHudCollapsed && (
                                                    <Text style={styles.phaseLabelMiniLight}>
                                                        BLOCK {phaseInfo.currentPhaseIndex + 1} OF {phaseInfo.totalPhases}
                                                    </Text>
                                                )}
                                                <Text
                                                    numberOfLines={1}
                                                    adjustsFontSizeToFit
                                                    minimumFontScale={0.78}
                                                    style={styles.phaseTagValue}
                                                >
                                                    {currentPhase.label}
                                                </Text>
                                            </View>

                                            <View style={styles.phaseTimerCompact}>
                                                <Text style={styles.phaseTimeLeftLabel}>REMAINING</Text>
                                                <Text style={styles.phaseTimeLeft}>{phaseCountdown}</Text>
                                            </View>
                                            <TouchableOpacity
                                                accessibilityRole='button'
                                                accessibilityLabel={isHudCollapsed ? 'Expand workout details' : 'Collapse workout details'}
                                                accessibilityState={{ expanded: !isHudCollapsed }}
                                                activeOpacity={0.7}
                                                style={styles.hudCollapseButton}
                                                onPress={() => {
                                                    const nextCollapsed = !isHudCollapsed;
                                                    setIsHudCollapsed(nextCollapsed);
                                                    hudShrinkAnim.value = nextCollapsed ? 1 : 0;
                                                }}
                                            >
                                                {isHudCollapsed ? (
                                                    <ChevronDown color={COLORS.textDark} size={20} strokeWidth={2.75} />
                                                ) : (
                                                    <ChevronUp color={COLORS.textDark} size={20} strokeWidth={2.75} />
                                                )}
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Paginated Header: Pace vs Coach */}
                                        <Animated.View
                                            pointerEvents={isHudCollapsed ? 'none' : 'auto'}
                                            style={[styles.hudPagerShell, hudPagerCollapseStyle]}
                                        >
                                            <View style={styles.hudSliderContainer} {...instructionSwipeResponder.panHandlers}>
                                                <Animated.View style={[styles.hudSliderTrack, hudPaginationStyle]}>
                                                
                                                {/* PAGE 1: Pace Metrics */}
                                                <Animated.View style={[styles.hudSlidePage, page1Style]}>
                                                    <View style={styles.paceHeaderInside}>
                                                        <View style={styles.paceMain}>
                                                            <Text style={[styles.paceNum, { color: COLORS.coral }]}>{currentPace}</Text>
                                                            <Text style={styles.paceLabelSmall}>AVERAGE PACE</Text>
                                                        </View>
                                                        <View style={styles.paceGoalContainer}>
                                                            <Target size={14} color={COLORS.coral} strokeWidth={2.5} />
                                                            <View>
                                                                <Text style={[styles.paceUnit, { color: COLORS.coral }]}>
                                                                    TARGET
                                                                </Text>
                                                                <Text style={[styles.paceTargetValue, { color: COLORS.coral }]}>
                                                                    {targetDisplayLabel}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                </Animated.View>

                                                {/* PAGE 2: Coach Instruction */}
                                                <Animated.View style={[styles.hudSlidePage, page2Style]}>
                                                    <View style={styles.hudCoachContentSimple}>
                                                        <View style={styles.hudCoachIconContainer}>
                                                                <View style={styles.hudCoachIconCircle} />
                                                            <Image 
                                                                source={coachAvatarSource}
                                                                style={styles.hudCoachIconImage}
                                                                resizeMode="contain"
                                                            />
                                                        </View>
                                                        <View style={styles.hudCoachTextContainerFull}>
                                                            <Text style={styles.hudCoachLabel}>{APP_NAME} says</Text>
                                                            <Text
                                                                style={styles.hudCoachInstructionLarge}
                                                                numberOfLines={3}
                                                                adjustsFontSizeToFit
                                                                minimumFontScale={0.72}
                                                            >
                                                                {instruction || "ALL SYSTEMS GO! KEEP AT IT."}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </Animated.View>

                                                </Animated.View>
                                            </View>
                                            <TouchableOpacity
                                                accessibilityRole='button'
                                                accessibilityLabel='Toggle pace and coach'
                                                activeOpacity={0.72}
                                                hitSlop={4}
                                                style={styles.hudEdgeChevron}
                                                onPress={(event) => {
                                                    event.stopPropagation();
                                                    toggleHudPage();
                                                }}
                                            >
                                                <Animated.View style={forwardChevronStyle}>
                                                    <ChevronRight color={COLORS.textDark} size={22} strokeWidth={3} />
                                                </Animated.View>
                                                <Animated.View style={[styles.hudChevronIconOverlay, backChevronStyle]}>
                                                    <ChevronLeft color={COLORS.textDark} size={22} strokeWidth={3} />
                                                </Animated.View>
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Labeled Progress Bar */}
                                        <Animated.View style={[styles.weightLossBarContainer, hudProgressBarStyle]}>
                                            <View style={styles.zoneLabels}>
                                                {paceBarZones.map((zone, idx) => (
                                                    <Text key={idx} style={[
                                                        styles.zoneLabelText,
                                                        idx === paceBarTargetZoneIndex && { color: zone.color, fontWeight: '900' }
                                                    ]}>
                                                        {zone.label}
                                                    </Text>
                                                ))}
                                            </View>
                                            <View style={styles.weightLossBarTrack}>
                                                <View style={styles.weightLossBar}>
                                                    {paceBarZones.map((zone, idx) => (
                                                        <Animated.View
                                                            key={idx}
                                                            style={[
                                                                styles.barZone,
                                                                { flex: 1, backgroundColor: zone.color },
                                                                idx === paceBarTargetZoneIndex && animatedPulseStyle
                                                            ]}
                                                        />
                                                    ))}
                                                </View>
                                                <View
                                                    style={[
                                                        styles.barPointer,
                                                        { left: `${paceBarPointerPosition}%` },
                                                    ]}
                                                />
                                            </View>
                                        </Animated.View>
                                    </View>
                            </Animated.View>
                        )}

                        {/* B. BOTTOM AREA */}
                        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 10 }]}>
                            <View style={styles.bottomRow}>
                                {/* B1. Controls & Metrics Pill */}
                                <View style={styles.controlPill}>
                                    <View style={styles.miniMetric}>
                                        <Text style={styles.miniLabel}>TIME</Text>
                                        <Text style={styles.miniValue}>{formatTime(elapsedSec)}</Text>
                                    </View>

                                    <View style={styles.vertDivider} />

                                    <View style={styles.miniMetric}>
                                        <Text style={styles.miniLabel}>KM</Text>
                                        <Text style={styles.miniValue}>{currentKm}</Text>
                                    </View>

                                    {template.hud.showCalories && (
                                        <>
                                            <View style={styles.vertDivider} />
                                            <View style={styles.miniMetric}>
                                                <Text style={styles.miniLabel}>KCAL</Text>
                                                <Text style={styles.miniValue}>{calories}</Text>
                                            </View>
                                        </>
                                    )}

                                    {/* Play/Pause */}
                                    {runState === 'paused' ? (
                                        <TouchableOpacity style={styles.playBtn} onPress={resumeRun}>
                                            <Play size={20} color="white" fill="white" />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity style={[styles.pauseBtn, { backgroundColor: COLORS.coral }]} onPress={pauseRun}>
                                            <Pause size={20} color={COLORS.textDark} fill={COLORS.textDark} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* B2. Avatar / guidance button */}
                                <View style={styles.bottomCoachButton}>
                                    <TouchableOpacity 
                                        onPress={() => triggerCoachInstruction("manual")}
                                        activeOpacity={0.8}
                                    >
                                        <Animated.View style={[styles.avatarContainer, coachContainerStyle]}>
                                            <View style={styles.avatarCircle} />
                                            <Image 
                                                source={coachAvatarSource}
                                                style={styles.avatarImage}
                                                resizeMode="contain"
                                            />
                                        </Animated.View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Secondary Finish Button (Floating) */}
                        {runState === 'paused' && (
                            <TouchableOpacity style={styles.floatingFinish} onPress={finishRun}>
                                <Square size={16} color="white" fill="white" />
                                <Text style={styles.finishText}>FINISH</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* 3. PAUSED STATE (MINIMAL OLD VERSION - OVERRIDDEN BY NEW UI) */}
                {/* We can keep this empty or stylized similarly to the new HUD */}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.textDark },
    overlay: { flex: 1 },

    // Header
    header: { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', zIndex: 50 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.1)' },

    // Hero Idle
    heroContainer: { flex: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 40 },
    heroContentTop: { marginTop: 40 },
    heroSubtitle: { fontSize: 14, fontWeight: '800', letterSpacing: 4, marginBottom: 8 },
    heroTitle: { color: COLORS.textLight, fontSize: 72, fontWeight: '900', letterSpacing: -3, lineHeight: 72 },
    aimsContainer: { marginTop: 40, alignItems: 'flex-start' },
    aimsLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 12 },
    aimPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.glassLight, padding: 12, borderRadius: 30, marginBottom: 10 },
    aimText: { color: 'white', fontWeight: '600' },
    heroContentBottom: { gap: 20 },
    targetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    targetVal: { color: 'white', fontSize: 32, fontWeight: '900' },
    targetLab: { fontSize: 12, fontWeight: '800' },
    loopPreviewText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', marginTop: -8 },
    heroStartBtn: { borderRadius: 100, height: 72, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    heroStartText: { color: COLORS.textDark, fontSize: 20, fontWeight: '900' },

    // Running HUD (Unified Premium)
    runningHud: { flex: 1, paddingHorizontal: 10, paddingVertical: 20 },
    topHud: { width: '100%', paddingTop: 0 },
    paceCard: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 32,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        position: 'relative',
        elevation: 12,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.05)',
    },
    // HUD Paging
    hudPagerShell: { position: 'relative', width: '100%', height: 110, marginBottom: 8 },
    hudSliderContainer: { width: '100%', overflow: 'hidden', height: 110 },
    hudSliderTrack: { flexDirection: 'row', width: '200%' },
    hudSlidePage: { width: '50%' },
    paceHeaderInside: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%' },
    
    hudCoachContentSimple: { flexDirection: 'row', alignItems: 'center', width: '100%', height: '100%', gap: 12, paddingRight: 24 },
    hudEdgeChevron: {
        position: 'absolute',
        top: 35,
        right: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(241, 245, 249, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        zIndex: 10,
    },
    hudChevronIconOverlay: { position: 'absolute' },
    hudCoachIconContainer: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
    hudCoachIconCircle: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9' },
    hudCoachIconImage: { width: 65, height: 65, marginTop: -8 },
    hudCoachTextContainerFull: { flex: 1 },
    hudCoachLabel: { fontSize: 10, fontWeight: '900', color: COLORS.coral, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
    hudCoachInstructionLarge: { color: COLORS.textDark, fontSize: 22, fontWeight: '900', fontStyle: 'italic', lineHeight: 26 },
    
    // Bottom Coach Button
    bottomCoachButton: { justifyContent: 'flex-end', marginBottom: -10 },
    avatarContainer: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
    avatarCircle: {
        position: 'absolute', width: 68, height: 68, borderRadius: 34,
        backgroundColor: 'white', borderWidth: 2, borderColor: '#f1f5f9',
        shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 6,
    },
    avatarImage: { width: 95, height: 95, marginTop: -15 },

    paceNum: { fontSize: 64, fontWeight: '900', fontStyle: 'italic', fontVariant: ['tabular-nums'], letterSpacing: -3 },
    paceUnit: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    paceTargetValue: { fontSize: 13, fontWeight: '900', marginTop: 1 },
    paceGoalContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15, 23, 42, 0.04)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
    weightLossBarTrack: {
        position: 'relative',
        width: '100%',
        height: 14,
        justifyContent: 'center',
        overflow: 'visible',
    },
    weightLossBar: { height: 6, borderRadius: 4, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.26)', overflow: 'hidden' },
    barZone: { height: '100%' },
    barPointer: {
        position: 'absolute',
        top: 2,
        width: 5,
        height: 12,
        marginLeft: -2.5,
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.35)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
        elevation: 4,
        zIndex: 20,
    },

    bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },

    // Control Pill (Narrowed)
    controlPill: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
        paddingVertical: 10, paddingHorizontal: 10, borderRadius: 100,
        shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 16,
        gap: 12, marginBottom: 12,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    miniMetric: { alignItems: 'center', minWidth: 40 },
    miniLabel: { fontSize: 8, fontWeight: '900', color: 'rgba(15,23,42,0.48)', letterSpacing: 1, textTransform: 'uppercase' },
    miniValue: { fontSize: 16, fontWeight: '900', color: COLORS.textDark, fontVariant: ['tabular-nums'], fontStyle: 'italic' },
    vertDivider: { width: 1.5, height: 20, backgroundColor: 'rgba(15,23,42,0.06)' },
    pauseBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
    playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.coral, justifyContent: 'center', alignItems: 'center' },


    // Floating Finish
    floatingFinish: {
        position: 'absolute', bottom: 100, left: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#EF4444', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 25,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6,
    },
    finishText: { color: 'white', fontWeight: '900', fontSize: 11 },

    // Custom Marker
    customMarkerWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    customMarker: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.96)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    customMarkerHeadingWrap: {
        position: 'absolute',
        top: 2,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    customMarkerHeading: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 12,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    customMarkerInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
    },
    loopStartMarker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 3,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    loopStartMarkerInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    loopStartMarkerBadge: {
        position: 'absolute',
        top: -10,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
    },
    loopStartMarkerBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },

    // Map Controls
    mapControls: {
        position: 'absolute',
        right: 20,
        bottom: 156,
        gap: 10,
        zIndex: 100,
    },
    mapBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        elevation: 5,
    },

    // Unified Top Bar Integrated Styles
    phaseHeaderIntegrated: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 24,
        paddingBottom: 20,
        borderBottomWidth: 1.5,
        borderBottomColor: 'rgba(15,23,42,0.08)',
    },
    hudCollapseButton: {
        width: 44,
        height: 44,
        marginLeft: 4,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paceBackButtonCompact: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    phaseMetaCluster: {
        flex: 1,
        alignItems: 'flex-start',
        marginHorizontal: 8,
    },
    phaseLabelMiniLight: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'rgba(15,23,42,0.5)',
        marginBottom: 2,
    },
    phaseTagValue: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textDark,
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    phaseTimerCompact: {
        alignItems: 'flex-end',
    },
    phaseTimeLeftLabel: {
        color: 'rgba(15,23,42,0.5)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    phaseTimeLeft: {
        color: COLORS.textDark,
        fontSize: 32,
        fontWeight: '900',
        fontStyle: 'italic',
        fontVariant: ['tabular-nums'],
        letterSpacing: -1.5,
        marginTop: -4,
    },
    paceMain: {
        flex: 1,
        flexBasis: 0,
        flexShrink: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        gap: -4,
    },
    paceLabelSmall: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(15,23,42,0.5)',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    weightLossBarContainer: {
        width: '100%',
        marginTop: 15,
        overflow: 'visible',
    },
    zoneLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        paddingHorizontal: 2,
    },
    zoneLabelText: {
        fontSize: 8,
        fontWeight: '700',
        color: 'rgba(15,23,42,0.62)',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // Old Styles Kept for Reference/Transitions
    phaseTimerContainer: {
        position: 'absolute',
        top: height * 0.4,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
    },
    phaseTimerInner: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingVertical: 24,
        paddingHorizontal: 40,
        borderRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        gap: 8,
    },
});
