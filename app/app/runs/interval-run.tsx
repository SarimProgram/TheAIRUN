import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, type LatLng } from "react-native-maps";
import { Play, Pause, ChevronLeft, ChevronRight, Square, Brain, Flame, Heart, Activity } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    withDelay,
} from 'react-native-reanimated';

// --- IMPORTS ---
// Removed the old IntervalProgressStrip import to use the modern one defined below
import { MOCK_INTERVAL_SESSION, INTERVAL_COLORS } from '@/types/IntervalValues';
import { useRunTracker } from "@/hooks/useRunTracker";
import { getRunTemplate } from "@/lib/run-templates";
import { RunType } from "@/types/RunTemplate";
import { RunResultScreen } from "./RunPhotoCaptur";
import { useAuth } from '@/src/auth/authContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { API_BASE_URL } from '@/config/api';
import { haversineDistanceMeters } from '@/lib/geo';
import {
    applyIntervalWalkTargetsToSteps,
    buildIntervalWalkDistanceSteps,
    buildIntervalWalkPaceTargets,
    buildIntervalWalkQuickSteps,
    IntervalWalkPaceTargets,
    IntervalWorkoutKind,
    IntervalWorkoutStep,
    loadIntervalWalkPaceTargets,
} from '@/lib/interval-workout';

const { width, height } = Dimensions.get('window');

// --- THEME CONSTANTS ---
const COLORS = {
    glassDark: 'rgba(255, 255, 255, 0.90)',
    glassLight: 'rgba(255, 255, 255, 0.6)',
    textDark: '#0F172A',
    muted: '#64748B',
    intervalRed: '#EF4444',
    alertOrange: '#F97316',
    inactive: '#E2E8F0',
};

// --- MODERN COMPONENT DEFINITION ---
// --- MODERN COMPONENT DEFINITION ---
const ModernProgressStrip = ({
    segments,
    currentIndex,
    progressInSegment,
    totalTime,
    estimatedSessionTime,
    counterLabel,
}: {
    segments: any[];
    currentIndex: number;
    progressInSegment: number;
    totalTime: string;
    estimatedSessionTime: string;
    counterLabel: string;
}) => {
    return (
        <View style={stripStyles.inner}>
            <View style={stripStyles.barRow}>
                {segments.map((segment, index) => {
                    const isPast = index < currentIndex;
                    const isActive = index === currentIndex;

                    return (
                        <View key={index} style={stripStyles.trackSegment}>
                            <View
                                style={[
                                    stripStyles.fill,
                                    {
                                        backgroundColor: isPast ? segment.color : COLORS.inactive,
                                        opacity: isPast ? 1 : 0.5
                                    }
                                ]}
                            />

                            {isActive && (
                                <View
                                    style={[
                                        stripStyles.fill,
                                        {
                                            backgroundColor: segment.color,
                                            width: `${progressInSegment * 100}%`,
                                            position: 'absolute',
                                            left: 0,
                                            zIndex: 2
                                        }
                                    ]}
                                />
                            )}
                        </View>
                    );
                })}
            </View>
            <View style={stripStyles.infoRow}>
                <Text style={stripStyles.infoText}>
                    {counterLabel} {currentIndex + 1} <Text style={{ color: COLORS.muted }}>/ {segments.length}</Text>
                </Text>
                
                <View style={stripStyles.phaseKmBadge}>
                     <Text style={stripStyles.phaseKmValue}>{totalTime}</Text>
                     <Text style={stripStyles.phaseKmLabel}>TIME</Text>
                </View>

                <Text style={stripStyles.infoText}>{estimatedSessionTime}</Text>
            </View>
        </View>
    );
};

const stripStyles = StyleSheet.create({
    inner: {
        width: '100%',
    },
    barRow: {
        flexDirection: 'row',
        height: 10,
        gap: 6,
        marginBottom: 10,
    },
    trackSegment: {
        flex: 1,
        height: '100%',
        backgroundColor: '#F1F5F9',
        borderRadius: 5,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 5,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    infoText: {
        fontSize: 13,
        fontWeight: '900',
        color: COLORS.textDark,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    phaseKmBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: 'rgba(0,0,0,0.06)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    phaseKmValue: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.textDark,
    },
    phaseKmLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: COLORS.muted,
        marginLeft: 2,
    }
});

type UIStep = IntervalWorkoutStep;
type IntervalLaunchMode = 'time' | 'distance';
type IntervalSegment = typeof MOCK_INTERVAL_SESSION[number] & {
    targetDistanceKm?: number;
    advanceBy?: 'time' | 'distance';
};

type IntervalScreenConfig = {
    workoutKind: IntervalWorkoutKind;
    templateId: RunType;
    heroEyebrow: string;
    resultGoalText: string;
    resultPartnersLabel: string;
    counterLabel: string;
    fallbackRunTypeAliases: string[];
};

function normalizeText(value: string | null | undefined) {
    return (value || '').trim().toLowerCase();
}

function matchesRunTypeAliases(runType: string | null | undefined, aliases: string[]) {
    const normalized = normalizeText(runType);
    if (!normalized) return false;
    return aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized));
}

function getIntervalScreenConfig(workoutKind: IntervalWorkoutKind): IntervalScreenConfig {
    if (workoutKind === 'interval_walk') {
        return {
            workoutKind,
            templateId: 'interval_walk',
            heroEyebrow: 'LOW IMPACT',
            resultGoalText: 'WALK COMPLETE',
            resultPartnersLabel: 'Solo Walk',
            counterLabel: 'BLOCK',
            fallbackRunTypeAliases: ['interval walk', 'walk intervals', 'interval walking'],
        };
    }

    return {
        workoutKind,
        templateId: 'interval',
        heroEyebrow: 'HIGH INTENSITY',
        resultGoalText: 'RUN COMPLETE',
        resultPartnersLabel: 'Solo Run',
        counterLabel: 'RUN',
        fallbackRunTypeAliases: ['interval run', 'intervals', 'interval'],
    };
}

function formatDurationShort(totalSec: number) {
    if (!totalSec || totalSec <= 0) return '0:00';
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDistanceKmLabel(distanceKm?: number | null) {
    if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) return '--';
    return distanceKm >= 1 ? distanceKm.toFixed(1) : distanceKm.toFixed(2);
}

function formatPaceLabel(secPerKm?: number) {
    if (!secPerKm || secPerKm === Infinity || isNaN(secPerKm)) return null;
    const minutes = Math.floor(secPerKm / 60);
    const seconds = Math.floor(secPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function parseDistanceKmParam(value?: string) {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function getRequiredPaceSecPerKm(durationSec?: number | null, distanceKm?: number | null) {
    if (!durationSec || durationSec <= 0 || !distanceKm || distanceKm <= 0) return null;
    return Math.round(durationSec / distanceKm);
}

function getPaceAdjustText(currentPace?: number | null, targetPace?: number | null) {
    if (!currentPace || !targetPace || !Number.isFinite(currentPace) || !Number.isFinite(targetPace)) {
        return 'Finding pace';
    }

    const delta = currentPace - targetPace;
    if (Math.abs(delta) <= 5) return 'On pace';

    const deltaText = formatPaceLabel(Math.abs(delta));
    if (!deltaText) return 'On pace';

    return delta > 0 ? `+${deltaText}` : `-${deltaText}`;
}

function getFallbackPaceSecPerKm(segmentType: IntervalSegment['type'], template: ReturnType<typeof getRunTemplate>) {
    if (segmentType === 'run') {
        const zone = template.paceZones[template.targetZoneIndex] || template.paceZones[0];
        if (zone) {
            return Math.round((zone.minPaceSecPerKm + zone.maxPaceSecPerKm) / 2);
        }
        return 360;
    }

    const slowZone = template.paceZones[0];
    if (slowZone) return slowZone.maxPaceSecPerKm;
    return 480;
}

function estimateDurationSec(step: UIStep, segmentType: IntervalSegment['type'], template: ReturnType<typeof getRunTemplate>) {
    const paceSecPerKm = step.target?.paceSecPerKm ?? getFallbackPaceSecPerKm(segmentType, template);
    if (!paceSecPerKm || !step.distanceKm || step.distanceKm <= 0) return 30;
    return Math.max(10, Math.round(step.distanceKm * paceSecPerKm));
}

function uiStepsToSegments(steps: UIStep[], template: ReturnType<typeof getRunTemplate>): IntervalSegment[] {
    return steps.map((step, index) => {
        let type: IntervalSegment['type'] = 'run';
        if (step.type === 'warmup') type = 'warmup';
        else if (step.type === 'cooldown') type = 'cooldown';
        else if (step.type === 'recover' || step.type === 'walk') type = 'walk';

        const durationSec = step.durationSec ?? estimateDurationSec(step, type, template);
        const color = type === 'warmup'
            ? INTERVAL_COLORS.warmup
            : type === 'cooldown'
                ? INTERVAL_COLORS.cooldown
                : type === 'run'
                    ? template.primaryColor
                    : template.secondaryColor || INTERVAL_COLORS.walk;

        return {
            id: `${index + 1}`,
            type,
            durationSec,
            label: step.label || `${type.toUpperCase()} ${index + 1}`,
            color,
            targetDistanceKm: step.distanceKm,
            advanceBy: typeof step.durationSec === 'number' && step.durationSec > 0 ? 'time' : 'distance',
        };
    });
}

function buildQuickIntervalSteps(mode: IntervalLaunchMode): UIStep[] {
    const warmupDistanceKm = 0.6;
    const intervalDistanceKm = 0.2;
    const recoveryDistanceKm = 0.2;
    const cooldownDistanceKm = 0.6;
    const intervalCount = 3;

    const steps: UIStep[] = [
        {
            type: 'warmup',
            label: 'Warm Up',
            distanceKm: warmupDistanceKm,
            ...(mode === 'time' ? { durationSec: 300 } : {}),
            target: { effort: 'Easy' },
        },
    ];

    for (let i = 1; i <= intervalCount; i += 1) {
        steps.push({
            type: 'run',
            label: `Interval ${i}`,
            distanceKm: intervalDistanceKm,
            ...(mode === 'time' ? { durationSec: 60 } : {}),
            target: { effort: 'Hard' },
        });
        steps.push({
            type: 'recover',
            label: `Recovery ${i}`,
            distanceKm: recoveryDistanceKm,
            ...(mode === 'time' ? { durationSec: 90 } : {}),
            target: { effort: 'Easy' },
        });
    }

    steps.push({
        type: 'cooldown',
        label: 'Cool Down',
        distanceKm: cooldownDistanceKm,
        ...(mode === 'time' ? { durationSec: 300 } : {}),
        target: { effort: 'Easy' },
    });

    return steps;
}

function buildQuickWorkoutSteps(
    config: IntervalScreenConfig,
    mode: IntervalLaunchMode,
    walkPaces: IntervalWalkPaceTargets,
): UIStep[] {
    if (config.workoutKind === 'interval_walk') {
        return buildIntervalWalkQuickSteps(walkPaces);
    }

    return buildQuickIntervalSteps(mode);
}

// --- MAIN SCREEN ---
export function IntervalWorkoutScreen({ workoutKind = 'interval_run' }: { workoutKind?: IntervalWorkoutKind }) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const params = useLocalSearchParams<{
        sessionId?: string;
        source?: string;
        distanceKm?: string;
        weekContext?: string;
        intervalMode?: string;
    }>();
    const { authFetch } = useAuth();
    const { setTabBarVisible } = useTabBar();
    const screenConfig = useMemo(() => getIntervalScreenConfig(workoutKind), [workoutKind]);
    const requestedDistanceKm = useMemo(() => parseDistanceKmParam(params.distanceKm), [params.distanceKm]);

    // 1. GPS Helper
    const {
        state: runState,
        route: runRoute,
        startRun,
        pauseRun,
        resumeRun,
        finishRun,
        resetRun,
        distanceM,
        elapsedSec,
        paceSecPerKm,
        smoothedLocation,
    } = useRunTracker();

    const template = useMemo(() => getRunTemplate(screenConfig.templateId), [screenConfig.templateId]);
    const [walkPaces, setWalkPaces] = useState<IntervalWalkPaceTargets>(() => buildIntervalWalkPaceTargets({}));

    // 2. Local Interval State
    const [segments, setSegments] = useState<IntervalSegment[]>(MOCK_INTERVAL_SESSION);
    const [uiSteps, setUiSteps] = useState<UIStep[] | null>(null);
    const [segmentsLoading, setSegmentsLoading] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [segmentTimeRemaining, setSegmentTimeRemaining] = useState(MOCK_INTERVAL_SESSION[0].durationSec);
    const [segmentStartTime, setSegmentStartTime] = useState<Date | null>(null); // Track when segment started
    const [segmentStartDistanceM, setSegmentStartDistanceM] = useState(0); // Track distance at start of segment
    const [isFollowingUser, setIsFollowingUser] = useState(true);

    const currentSegment = segments[currentSegmentIndex] || segments[0];
    const currentStep = uiSteps?.[currentSegmentIndex];
    const totalDuration = currentSegment?.durationSec || 1;
    const currentPhaseDistanceM = Math.max(0, distanceM - segmentStartDistanceM);
    const currentPhaseDistanceKm = currentPhaseDistanceM / 1000;
    const totalDistanceKm = distanceM / 1000;
    const targetPhaseDistanceKm = currentSegment?.targetDistanceKm ?? 0;
    const segmentIsDistanceBased = currentSegment?.advanceBy === 'distance' && targetPhaseDistanceKm > 0;
    const distanceProgress = targetPhaseDistanceKm > 0 ? Math.min(currentPhaseDistanceKm / targetPhaseDistanceKm, 1) : 0;
    const progress = segmentIsDistanceBased
        ? distanceProgress
        : totalDuration > 0
            ? 1 - (segmentTimeRemaining / totalDuration)
            : 0;
    const phaseTargetProgress = targetPhaseDistanceKm > 0 ? distanceProgress : progress;
    const remainingPhaseDistanceKm = targetPhaseDistanceKm > 0
        ? Math.max(targetPhaseDistanceKm - currentPhaseDistanceKm, 0)
        : 0;
    const currentBlockDistanceKm = currentStep?.distanceKm ?? targetPhaseDistanceKm;
    const currentBlockDurationSec = currentStep?.durationSec ?? currentSegment?.durationSec;
    const blockStartKm = segments
        .slice(0, currentSegmentIndex)
        .reduce((sum, segment) => sum + (segment.targetDistanceKm ?? 0), 0);
    const blockEndKm = blockStartKm + currentBlockDistanceKm;
    const targetPaceForCurrentBlock = currentStep?.target?.paceSecPerKm
        ?? getRequiredPaceSecPerKm(currentBlockDurationSec, currentBlockDistanceKm);
    const targetPaceLabel = formatPaceLabel(targetPaceForCurrentBlock ?? undefined) ?? '--:--';
    const currentBlockElapsedSec = Math.max((currentBlockDurationSec || 0) - segmentTimeRemaining, 0);
    const currentBlockPaceSecPerKm = getRequiredPaceSecPerKm(currentBlockElapsedSec, currentPhaseDistanceKm);
    const currentBlockPaceLabel = formatPaceLabel(currentBlockPaceSecPerKm ?? undefined) ?? '--:--';
    const paceAdjustText = getPaceAdjustText(currentBlockPaceSecPerKm, targetPaceForCurrentBlock);
    const paceAdjustColor = paceAdjustText.startsWith('Up')
        ? COLORS.intervalRed
        : paceAdjustText.startsWith('Ahead')
            ? currentSegment.color
            : COLORS.muted;
    const estimatedSessionTimeLabel = formatDurationShort(
        segments.reduce((sum, segment) => sum + (segment?.durationSec || 0), 0)
    );

    // 3. Animation & UI Toggle State
    const introAnim = useSharedValue(0);

    useEffect(() => {
        setTabBarVisible(false);
        return () => {
            setTabBarVisible(true);
        };
    }, [setTabBarVisible]);

    useEffect(() => {
        let isActive = true;

        const loadPlanSession = async () => {
            setSegmentsLoading(true);
            try {
                let activeWalkPaces = walkPaces;
                if (screenConfig.workoutKind === 'interval_walk') {
                    activeWalkPaces = await loadIntervalWalkPaceTargets(authFetch);
                    if (isActive) {
                        setWalkPaces(activeWalkPaces);
                    }
                }

                const launchMode = params.intervalMode === 'time' || params.intervalMode === 'distance'
                    ? params.intervalMode
                    : null;
                const shouldUseCustomWalkDistance = (
                    !params.sessionId &&
                    screenConfig.workoutKind === 'interval_walk' &&
                    typeof requestedDistanceKm === 'number'
                );
                const shouldUseQuickLaunch = Boolean(launchMode) && (
                    screenConfig.workoutKind === 'interval_run' || launchMode === 'time'
                );

                if (shouldUseCustomWalkDistance) {
                    const quickSteps = buildIntervalWalkDistanceSteps(requestedDistanceKm, activeWalkPaces);
                    const mapped = uiStepsToSegments(quickSteps, template);
                    if (mapped.length > 0 && isActive) {
                        setSegments(mapped);
                        setUiSteps(quickSteps);
                    }
                    return;
                }

                if (launchMode && shouldUseQuickLaunch) {
                    const quickSteps = buildQuickWorkoutSteps(screenConfig, launchMode, activeWalkPaces);
                    const mapped = uiStepsToSegments(quickSteps, template);
                    if (mapped.length > 0 && isActive) {
                        setSegments(mapped);
                        setUiSteps(quickSteps);
                    }
                    return;
                }

                let steps: UIStep[] | null = null;

                if (params.sessionId) {
                    const response = await authFetch(`${API_BASE_URL}/training-plan/session/${params.sessionId}`);
                    if (response.ok) {
                        const data = await response.json();
                        const fetchedSteps = data?.session?.stepsJson;
                        if (Array.isArray(fetchedSteps)) {
                            steps = fetchedSteps as UIStep[];
                        }
                    }
                }

                if (!steps) {
                    let currentWeek: number | null = null;
                    try {
                        const weekRes = await authFetch(`${API_BASE_URL}/summary/week`);
                        if (weekRes.ok) {
                            const weekData = await weekRes.json();
                            currentWeek = typeof weekData?.currentWeek === 'number' ? weekData.currentWeek : null;
                        }
                    } catch (err) {
                        console.warn('Failed to fetch summary week for intervals', err);
                    }

                    const planRes = await authFetch(`${API_BASE_URL}/training-plan/user/latest`);
                    if (planRes.ok) {
                        const planData = await planRes.json();
                        const sessions = planData?.plan?.sessions;
                        if (Array.isArray(sessions)) {
                            let intervalSessions = sessions.filter((s: any) =>
                                matchesRunTypeAliases(s?.runType, screenConfig.fallbackRunTypeAliases)
                            );
                            if (currentWeek !== null) {
                                const weekSessions = intervalSessions.filter((s: any) => s.week === currentWeek);
                                if (weekSessions.length > 0) {
                                    intervalSessions = weekSessions;
                                }
                            }
                            if (intervalSessions.length > 0) {
                                steps = intervalSessions[0]?.stepsJson as UIStep[] | null;
                            }
                        }
                    }
                }

                if (Array.isArray(steps)) {
                    const normalizedSteps = screenConfig.workoutKind === 'interval_walk'
                        ? applyIntervalWalkTargetsToSteps(steps, activeWalkPaces)
                        : steps;
                    const mapped = uiStepsToSegments(normalizedSteps, template);
                    if (mapped.length > 0 && isActive) {
                        setSegments(mapped);
                        setUiSteps(normalizedSteps);
                    }
                }
            } catch (err) {
                console.warn('Failed to load training session', err);
            } finally {
                if (isActive) setSegmentsLoading(false);
            }
        };

        loadPlanSession();

        return () => {
            isActive = false;
        };
    }, [params.distanceKm, params.intervalMode, params.sessionId, authFetch, requestedDistanceKm, screenConfig, template]);

    useEffect(() => {
        if (segments.length === 0) return;
        if (runState !== 'idle') return;
        setCurrentSegmentIndex(0);
        setSegmentTimeRemaining(segments[0].durationSec);
        setSegmentStartTime(null);
        setSegmentStartDistanceM(0);
    }, [segments, runState]);

    // Sync Interval Timer - Using Date-based calculation for background support
    useEffect(() => {
        let interval: any;
        if (runState === 'running') {
            if (introAnim.value === 0) {
                introAnim.value = withDelay(500, withTiming(1, { duration: 1000 }));
            }

            // Set segment start time when starting or when segment changes
            if (!segmentStartTime) {
                setSegmentStartTime(new Date());
            }

            if (currentSegment.advanceBy === 'distance') {
                setSegmentTimeRemaining(currentSegment.durationSec);
                return;
            }

            interval = setInterval(() => {
                if (segmentStartTime) {
                    const elapsed = Math.floor((Date.now() - segmentStartTime.getTime()) / 1000);
                    const remaining = currentSegment.durationSec - elapsed;

                    if (remaining <= 0) {
                        handleNextSegment();
                    } else {
                        setSegmentTimeRemaining(remaining);
                    }
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [runState, currentSegmentIndex, segmentStartTime, currentSegment]);

    useEffect(() => {
        if (runState !== 'running' || !segmentIsDistanceBased || targetPhaseDistanceKm <= 0) return;
        if (currentPhaseDistanceKm < targetPhaseDistanceKm) return;
        handleNextSegment();
    }, [runState, segmentIsDistanceBased, currentPhaseDistanceKm, targetPhaseDistanceKm]);

    const handleNextSegment = () => {
        if (currentSegmentIndex < segments.length - 1) {
            const nextIndex = currentSegmentIndex + 1;
            setCurrentSegmentIndex(nextIndex);
            setSegmentTimeRemaining(segments[nextIndex].durationSec);
            setSegmentStartTime(new Date()); // Reset start time for new segment
            setSegmentStartDistanceM(distanceM); // Mark distance for the next phase
        } else {
            finishRun();
        }
    };

    const handleFinish = () => finishRun();
    const handleDone = () => {
        resetRun();
        setSegmentStartDistanceM(0);
        router.back();
    };

    // Derived values
    const currentKm = (distanceM / 1000).toFixed(2);
    const elapsedTimeLabel = formatDurationShort(elapsedSec);
    const calories = Math.floor(distanceM * 0.065);
    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
    };
    const formatPace = (sec: number | null) => {
        if (!sec || sec === Infinity || isNaN(sec)) return '--:--';
        return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
    };

    // --- ANIMATED STYLES ---
    const timerContainerStyle = useAnimatedStyle(() => {
        const translateY = interpolate(introAnim.value, [0, 1], [0, -height * 0.08]);
        const scale = interpolate(introAnim.value, [0, 1], [1, 0.7]);
        return { transform: [{ translateY }, { scale }] };
    });

    const overlayOpacityStyle = useAnimatedStyle(() => ({
        opacity: interpolate(introAnim.value, [0, 1], [1, 0]),
    }));

    const mapDimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(introAnim.value, [0, 1], [0, 1]),
    }));

    useEffect(() => {
        if (runState === 'idle') {
            setIsFollowingUser(true);
        }
    }, [runState]);

    const currentMarkerCoordinate = useMemo(() => {
        if (smoothedLocation) {
            return {
                latitude: smoothedLocation.lat,
                longitude: smoothedLocation.lon,
            } as LatLng;
        }

        if (runRoute.length > 0) {
            const lastPoint = runRoute[runRoute.length - 1];
            return {
                latitude: lastPoint.lat,
                longitude: lastPoint.lon,
            } as LatLng;
        }

        return null;
    }, [runRoute, smoothedLocation]);

    const mapRegion = useMemo(() => {
        if (currentMarkerCoordinate) {
            return {
                latitude: currentMarkerCoordinate.latitude,
                longitude: currentMarkerCoordinate.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            };
        }
        return { latitude: -37.8136, longitude: 144.9631, latitudeDelta: 0.005, longitudeDelta: 0.005 };
    }, [currentMarkerCoordinate]);

    const routeCoords = useMemo(() =>
        runRoute.map(p => ({ latitude: p.lat, longitude: p.lon })),
        [runRoute]
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

    useEffect(() => {
        if (!currentMarkerCoordinate || !isFollowingUser || (runState !== 'running' && runState !== 'paused')) return;
        mapRef.current?.animateToRegion({
            latitude: currentMarkerCoordinate.latitude,
            longitude: currentMarkerCoordinate.longitude,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
        }, 350);
    }, [currentMarkerCoordinate, runState, isFollowingUser]);

    if (runState === 'finished') {
        return (
                <RunResultScreen
                    data={{
                    distance: currentKm,
                    time: formatTime(elapsedSec),
                    calories: calories,
                    partners: screenConfig.resultPartnersLabel,
                    goalText: screenConfig.resultGoalText,
                }}
                    onDone={handleDone}
                    onSkip={handleDone}
                />
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* 1. MAP LAYER */}
            <Animated.View style={[StyleSheet.absoluteFillObject, mapDimStyle]}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFillObject}
                    initialRegion={mapRegion}
                    onPanDrag={() => setIsFollowingUser(false)}
                    userInterfaceStyle="light"
                    scrollEnabled={true}
                    zoomEnabled={true}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    showsBuildings={false}
                >
                    {displayRouteCoords.length > 1 && (
                        <Polyline
                            coordinates={displayRouteCoords}
                            strokeWidth={6}
                            strokeColor={currentSegment.color}
                        />
                    )}
                    {currentMarkerCoordinate && (
                        <Marker coordinate={currentMarkerCoordinate} title="Current Position" />
                    )}
                </MapView>
            </Animated.View>

            {/* 2. GRADIENT */}
            <LinearGradient
                colors={['rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.4)']}
                locations={[0, 1]}
                style={[StyleSheet.absoluteFillObject, { top: height * 0.82 }]}
                pointerEvents="none"
            />

            {/* 3. WHITE OVERLAY (Intro Only) */}
            {runState !== 'idle' && (
                <Animated.View
                    style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF' }, overlayOpacityStyle]}
                    pointerEvents="none"
                />
            )}

            {/* 4. UI LAYER */}
            <SafeAreaView style={styles.overlay} edges={['top', 'left', 'right']} pointerEvents="box-none">
                {/* HEADER (Only show back button when idle to avoid overlapping HUD) */}
                {runState === 'idle' && (
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                            <ChevronLeft color={COLORS.textDark} size={24} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* HERO (IDLE) */}
                {runState === 'idle' && (
                    <View style={styles.heroContainer}>
                        <View style={styles.heroContentTop}>
                            <Text style={[styles.heroSubtitle, { color: template.primaryColor }]}>{screenConfig.heroEyebrow}</Text>
                            <Text style={styles.heroTitle}>{template.title}</Text>
                            <View style={styles.aimsContainer}>
                                {template.sessionAims.map((aim, idx) => (
                                    <View key={idx} style={styles.aimPill}>
                                        <Text style={styles.aimText}>{aim.text}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.heroStartBtn,
                                { backgroundColor: template.primaryColor, opacity: segmentsLoading ? 0.7 : 1 }
                            ]}
                            onPress={startRun}
                            disabled={segmentsLoading}
                        >
                            {segmentsLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text style={styles.heroStartText}>START WORKOUT</Text>
                                    <ChevronRight size={24} color={'white'} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* RUNNING HUD */}
                {(runState === 'running' || runState === 'paused') && (
                    <>
                        {/* UNIFIED TOP HUD BOX with Toggle */}
                        <View style={[styles.unifiedTopHud, { top: insets.top + 15 }]}>
                            <ModernProgressStrip
                                segments={segments}
                                currentIndex={currentSegmentIndex}
                                progressInSegment={progress}
                                totalTime={elapsedTimeLabel}
                                estimatedSessionTime={estimatedSessionTimeLabel}
                                counterLabel={screenConfig.counterLabel}
                            />

                            {targetPhaseDistanceKm > 0 && (
                                <View style={styles.phaseHeaderCard}>
                                    <View style={styles.phaseHeaderTop}>
                                        <View style={styles.phaseLabelBlock}>
                                            <Text style={styles.phaseLabelEyebrow}>CURRENT PHASE</Text>
                                            <Text style={[styles.phaseLabelMain, { color: currentSegment.color }]}>
                                                {currentSegment.label}
                                            </Text>
                                            <Text style={styles.phaseBlockRange}>
                                                KM {formatDistanceKmLabel(blockStartKm)} - {formatDistanceKmLabel(blockEndKm)}
                                            </Text>
                                        </View>
                                        <View style={styles.phaseValueBlock}>
                                            <View style={styles.phaseValueRow}>
                                                <Text style={styles.phaseValueMain}>{formatDistanceKmLabel(currentPhaseDistanceKm)}</Text>
                                                <Text style={styles.phaseValueDivider}> / </Text>
                                                <Text style={styles.phaseValueTarget}>{formatDistanceKmLabel(targetPhaseDistanceKm || currentBlockDistanceKm)}</Text>
                                            </View>
                                            <Text style={styles.phaseValueUnit}>BLOCK KILOMETERS</Text>
                                        </View>
                                    </View>
                                    
                                    <View style={styles.phaseHeaderTrack}>
                                        <View
                                            style={[
                                                styles.phaseHeaderFill,
                                                {
                                                    width: `${Math.max(0, Math.min(phaseTargetProgress, 1)) * 100}%`,
                                                    backgroundColor: currentSegment.color,
                                                },
                                            ]}
                                        />
                                    </View>
                                    
                                    <View style={styles.phaseHeaderFooter}>
                                        <View style={styles.phasePaceSummary}>
                                            <View style={styles.phasePaceCol}>
                                                <Text style={styles.phasePaceMeta}>TARGET PACE</Text>
                                                <Text style={styles.phasePaceStrong}>{targetPaceLabel}</Text>
                                            </View>
                                            <View style={styles.phasePaceCol}>
                                                <Text style={styles.phasePaceMeta}>AVG THIS BLOCK</Text>
                                                <Text style={styles.phasePaceStrong}>{currentBlockPaceLabel}</Text>
                                            </View>
                                            <View style={styles.phasePaceColEnd}>
                                                {segmentIsDistanceBased ? (
                                                    <Text style={styles.phaseFooterText}>
                                                        {formatDistanceKmLabel(remainingPhaseDistanceKm)} km left
                                                    </Text>
                                                ) : (
                                                    <Text style={[styles.phasePaceAdjust, { color: paceAdjustColor }]}>
                                                        {paceAdjustText}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* BOTTOM HUD: Pinned to bottom */}
                        <View style={[styles.bottomHud, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
                            {/* Unified Stats Dashboard with Integrated Controls */}
                            <View style={styles.dashboardContainer}>
                                {runState === 'paused' && (
                                    <>
                                        <TouchableOpacity 
                                            style={styles.dashActionBtn}
                                            onPress={handleFinish}
                                        >
                                            <Square size={18} color={COLORS.textDark} fill={COLORS.textDark} />
                                        </TouchableOpacity>
                                        <View style={styles.dashboardDivider} />
                                    </>
                                )}

                                <View style={styles.dashboardStat}>
                                    <Text style={styles.dashboardLabel}>PACE</Text>
                                    <Text style={styles.dashboardValue}>{formatPace(paceSecPerKm)}</Text>
                                    <Text style={styles.dashboardUnit}>/km</Text>
                                </View>
                                
                                <View style={styles.dashboardDivider} />
                                
                                <View style={styles.dashboardMainStat}>
                                    <Text style={styles.currentPhaseBadge}>{currentSegment.label}</Text>
                                    {segmentIsDistanceBased ? (
                                        <Text style={styles.dashboardTimerMain}>
                                            {formatDistanceKmLabel(currentPhaseDistanceKm)}
                                        </Text>
                                    ) : (
                                        <Text style={styles.dashboardTimerMain}>
                                            {Math.floor(segmentTimeRemaining / 60)}:{(segmentTimeRemaining % 60).toString().padStart(2, '0')}
                                        </Text>
                                    )}
                                    <Text style={styles.dashboardTimerSub}>
                                        {segmentIsDistanceBased ? `${formatDistanceKmLabel(targetPhaseDistanceKm)}km Goal` : 'Remaining'}
                                    </Text>
                                </View>
                                
                                <View style={styles.dashboardDivider} />
                                
                                <View style={styles.dashboardStat}>
                                    <Text style={styles.dashboardLabel}>DISTANCE</Text>
                                    <View style={styles.dashboardStatValueRow}>
                                        <Text style={styles.dashboardValue}>{currentKm}</Text>
                                        <Text style={styles.dashboardUnit}>KM</Text>
                                    </View>
                                    <Activity size={12} color={COLORS.muted} style={{ marginTop: 2, opacity: 0.5 }} />
                                </View>

                                <View style={styles.dashboardDivider} />

                                <TouchableOpacity 
                                    style={[styles.dashActionBtn, { backgroundColor: runState === 'paused' ? COLORS.textDark : currentSegment.color + '15' }]}
                                    onPress={runState === 'paused' ? resumeRun : pauseRun}
                                >
                                    {runState === 'paused' ? (
                                        <Play size={20} color="white" fill="white" style={{ marginLeft: 2 }} />
                                    ) : (
                                        <Pause size={20} color={currentSegment.color} fill={currentSegment.color} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    overlay: { flex: 1 },

    // Header
    header: { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', zIndex: 50 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.05)' },
    headerTitle: { color: COLORS.muted, fontSize: 13, fontWeight: '800', marginLeft: 16, letterSpacing: 3 },
    // Hero
    heroContainer: { flex: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 40 },
    heroContentTop: { marginTop: 40 },
    heroSubtitle: { fontSize: 13, fontWeight: '900', letterSpacing: 5, marginBottom: 12 },
    heroTitle: { color: COLORS.textDark, fontSize: 72, fontWeight: '900', letterSpacing: -3, lineHeight: 72 },
    aimsContainer: { marginTop: 40, alignItems: 'flex-start' },
    aimPill: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 14, borderRadius: 20, marginBottom: 12 },
    aimText: { color: COLORS.textDark, fontWeight: '700', fontSize: 15 },
    heroStartBtn: { borderRadius: 24, height: 80, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    heroStartText: { color: 'white', fontSize: 22, fontWeight: '900' },

    // Unified Running Layout
    unifiedTopHud: {
        position: 'absolute',
        left: 14,
        right: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        padding: 16,
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        zIndex: 100,
        elevation: 10,
    },
    phaseHeaderCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },
    phaseHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    phaseLabelBlock: {
        flex: 1,
    },
    phaseLabelEyebrow: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.muted,
        letterSpacing: 1,
        marginBottom: 2,
    },
    phaseLabelMain: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    phaseBlockRange: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.muted,
        letterSpacing: 0.6,
    },
    phaseValueBlock: {
        alignItems: 'flex-end',
    },
    phaseValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    phaseValueMain: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.textDark,
    },
    phaseValueDivider: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.muted,
        marginHorizontal: 2,
    },
    phaseValueTarget: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.muted,
    },
    phaseValueUnit: {
        fontSize: 8,
        fontWeight: '900',
        color: COLORS.muted,
        letterSpacing: 0.5,
        marginTop: -2,
    },
    phaseHeaderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        marginBottom: 10,
    },
    phaseHeaderFill: {
        height: '100%',
        borderRadius: 3,
    },
    phaseHeaderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phaseFooterText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.muted,
    },
    phasePaceSummary: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    phasePaceCol: {
        flexDirection: 'column',
    },
    phasePaceColEnd: {
        alignItems: 'flex-end',
    },
    phasePaceMeta: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.muted,
        letterSpacing: 0.5,
    },
    phasePaceStrong: {
        fontSize: 14,
        fontWeight: '900',
        color: COLORS.textDark,
        marginTop: -1,
    },
    phasePaceAdjust: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    // Bottom HUD
    bottomHud: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
    dashboardContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingVertical: 10,
        paddingHorizontal: 16,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 8,
    },
    dashboardStat: {
        flex: 1,
        alignItems: 'center',
    },
    dashboardMainStat: {
        flex: 1.5,
        alignItems: 'center',
    },
    dashboardDivider: {
        width: 1.5,
        height: 44,
        backgroundColor: '#F1F5F9',
    },
    dashboardLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.muted,
        letterSpacing: 1,
        marginBottom: 2,
    },
    dashboardValue: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.textDark,
        letterSpacing: -0.5,
    },
    dashboardUnit: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.muted,
        marginTop: -1,
    },
    dashboardStatValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    currentPhaseBadge: {
        fontSize: 9,
        fontWeight: '900',
        color: COLORS.muted,
        backgroundColor: 'rgba(0,0,0,0.04)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    dashboardTimerMain: {
        fontSize: 38,
        fontWeight: '900',
        color: COLORS.textDark,
        fontVariant: ['tabular-nums'],
        letterSpacing: -1.5,
        lineHeight: 44,
    },
    dashboardTimerSub: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.muted,
        marginTop: -4,
    },

    dashActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default function IntervalRunScreen() {
    return <IntervalWorkoutScreen workoutKind="interval_run" />;
}
