import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { Play, Pause, Heart, Zap, Trophy, X } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRaceSocketContext } from '@/contexts/RaceSocketContext';
import { useRaceTracker } from '@/hooks/useRaceTracker';
import { useTabBar } from '@/contexts/TabBarContext';
import PreRaceDashboard from '../../components/race/PreRaceDashboard';
import RaceMiniMap from '../../components/race/RaceMiniMap';

const { width, height } = Dimensions.get('window');
const AUTO_CAMERA_PAUSE_MS = 10000;
const PERFORMANCE_DOCK_HEIGHT = 180;
const SIDE_SPLIT_GAP = 10;

// --- THEME: WARM ENERGY + SOFT ROMANCE ---
const THEME = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  textMain: '#2D3436',
  textLight: '#8395A7',
  road: '#E3E8EC',
  kerb1: '#FF9F43',
  kerb2: '#FFFFFF',
  shadow: '#FF6B81',
  glass: 'rgba(255, 255, 255, 0.95)',
};

export default function RaceScreen() {
  const autoCameraResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchStartZoomRef = useRef(0.55);
  const pinchGestureRef = useRef(null);
  const panGestureRef = useRef(null);
  const panStartOffsetRef = useRef(0);
  const {
    isConnected,
    raceState,
    inviteFrom,
    raceDistance,
    countdown,
    partnerPosition,
    winner,
    raceStartTime,
    sendInvite,
    acceptInvite,
    declineInvite,
    sendPosition,
    finishRace,
    cancelRace,
    resetRace,
  } = useRaceSocketContext();

  const {
    currentPosition,
    distanceM,
    speedMps,
    startTracking,
    stopTracking,
    resetTracker,
  } = useRaceTracker();
  
  const { setTabBarVisible } = useTabBar();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [isAutoCameraEnabled, setIsAutoCameraEnabled] = useState(true);
  const [isAutoCameraPaused, setIsAutoCameraPaused] = useState(false);
  const [manualZoomLevel, setManualZoomLevel] = useState(0.55);
  const [isSideSplitVisible, setIsSideSplitVisible] = useState(false);

  // Hide tab bar only when focused on this screen
  useEffect(() => {
    if (isFocused) {
      setTabBarVisible(false);
    } else {
      setTabBarVisible(true);
    }
    // Safety cleanup
    return () => setTabBarVisible(true);
  }, [isFocused, setTabBarVisible]);

  // Animation shared values
  const myProgress = useSharedValue(0);
  const theirProgress = useSharedValue(0);
  const cameraMode = useSharedValue(2);
  const manualCameraOffset = useSharedValue(0);

  const clampZoomLevel = useCallback((value: number) => Math.min(1, Math.max(0, value)), []);
  const clampCameraOffset = useCallback(
    (value: number) => Math.min(height * 0.65, Math.max(-height * 0.65, value)),
    []
  );

  const mapCameraModeToManualZoom = useCallback(
    (modeValue: number) => {
      const normalizedMode = Math.min(2, Math.max(0, modeValue));
      if (normalizedMode <= 1) {
        return clampZoomLevel(0.55 + normalizedMode * 0.3);
      }
      return clampZoomLevel(0.85 - (normalizedMode - 1) * 0.45);
    },
    [clampZoomLevel]
  );

  const clearAutoCameraPause = useCallback(() => {
    if (autoCameraResumeTimeoutRef.current) {
      clearTimeout(autoCameraResumeTimeoutRef.current);
      autoCameraResumeTimeoutRef.current = null;
    }
    setIsAutoCameraPaused(false);
  }, []);

  const pauseAutoCameraForInteraction = useCallback(() => {
    if (!isAutoCameraEnabled) return;

    setManualZoomLevel(mapCameraModeToManualZoom(cameraMode.value));
    setIsAutoCameraPaused(true);

    if (autoCameraResumeTimeoutRef.current) {
      clearTimeout(autoCameraResumeTimeoutRef.current);
    }

    autoCameraResumeTimeoutRef.current = setTimeout(() => {
      setIsAutoCameraPaused(false);
      autoCameraResumeTimeoutRef.current = null;
    }, AUTO_CAMERA_PAUSE_MS);
  }, [cameraMode, isAutoCameraEnabled, mapCameraModeToManualZoom]);

  const handleCameraToggle = useCallback(() => {
    setIsAutoCameraEnabled((previous) => {
      const nextValue = !previous;
      if (!nextValue) {
        clearAutoCameraPause();
        setManualZoomLevel(mapCameraModeToManualZoom(cameraMode.value));
      } else {
        clearAutoCameraPause();
        manualCameraOffset.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
        panStartOffsetRef.current = 0;
        cameraMode.value = 2;
      }
      return nextValue;
    });
  }, [cameraMode, clearAutoCameraPause, manualCameraOffset, mapCameraModeToManualZoom]);

  const handleManualZoom = useCallback(
    (delta: number) => {
      if (isAutoCameraEnabled) {
        pauseAutoCameraForInteraction();
      }
      setManualZoomLevel((previous) => clampZoomLevel(previous + delta));
    },
    [clampZoomLevel, isAutoCameraEnabled, pauseAutoCameraForInteraction]
  );

  const handlePinchStateChange = useCallback(
    (event: any) => {
      const gestureState = event.nativeEvent?.state;

      if (gestureState === State.BEGAN) {
        pinchStartZoomRef.current = manualZoomLevel;
        if (isAutoCameraEnabled) {
          pauseAutoCameraForInteraction();
        }
        return;
      }

      if (
        gestureState === State.END ||
        gestureState === State.CANCELLED ||
        gestureState === State.FAILED
      ) {
        pinchStartZoomRef.current = manualZoomLevel;
      }
    },
    [isAutoCameraEnabled, manualZoomLevel, pauseAutoCameraForInteraction]
  );

  const handlePinchGestureEvent = useCallback(
    (event: any) => {
      const scale = event.nativeEvent?.scale;
      if (typeof scale !== 'number' || !Number.isFinite(scale)) return;

      const nextZoom = clampZoomLevel(pinchStartZoomRef.current + (scale - 1) * 0.35);
      setManualZoomLevel(nextZoom);
    },
    [clampZoomLevel]
  );

  const handlePanStateChange = useCallback(
    (event: any) => {
      const gestureState = event.nativeEvent?.state;

      if (gestureState === State.BEGAN) {
        panStartOffsetRef.current = manualCameraOffset.value;
        if (isAutoCameraEnabled) {
          pauseAutoCameraForInteraction();
        }
        return;
      }

      if (
        gestureState === State.END ||
        gestureState === State.CANCELLED ||
        gestureState === State.FAILED
      ) {
        panStartOffsetRef.current = manualCameraOffset.value;
      }
    },
    [isAutoCameraEnabled, manualCameraOffset, pauseAutoCameraForInteraction]
  );

  const handlePanGestureEvent = useCallback(
    (event: any) => {
      const translationY = event.nativeEvent?.translationY;
      if (typeof translationY !== 'number' || !Number.isFinite(translationY)) return;

      manualCameraOffset.value = clampCameraOffset(panStartOffsetRef.current + translationY);
    },
    [clampCameraOffset, manualCameraOffset]
  );

  // Start/stop GPS tracking when race state changes
  useEffect(() => {
    if (raceState === 'racing') startTracking();
    else if (raceState === 'idle' || raceState === 'finished') stopTracking();
  }, [raceState, startTracking, stopTracking]);

  // Camera animation during race
  useEffect(() => {
    if (raceState === 'racing' && isAutoCameraEnabled && !isAutoCameraPaused) {
      cameraMode.value = 2;
      cameraMode.value = withRepeat(
        withSequence(
          withTiming(2, { duration: 2500 }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 4200 }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3200 }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2600 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(cameraMode);
      if (raceState !== 'racing') {
        cameraMode.value = withTiming(2, { duration: 1000, easing: Easing.out(Easing.exp) });
      }
    }
  }, [raceState, cameraMode, isAutoCameraEnabled, isAutoCameraPaused]);

  useEffect(() => {
    return () => {
      if (autoCameraResumeTimeoutRef.current) {
        clearTimeout(autoCameraResumeTimeoutRef.current);
      }
    };
  }, []);

  // Update progress animations
  useEffect(() => {
    if (raceDistance > 0) {
      myProgress.value = withTiming(Math.min(distanceM / raceDistance, 1), { duration: 300 });
    }
  }, [distanceM, raceDistance, myProgress]);

  useEffect(() => {
    if (partnerPosition && raceDistance > 0) {
      const progressValue = Math.min(partnerPosition.distanceCovered / raceDistance, 1);
      theirProgress.value = withTiming(progressValue, { duration: 300 });
    }
  }, [partnerPosition, raceDistance, theirProgress]);

  useEffect(() => {
    if (raceState !== 'racing') {
      manualCameraOffset.value = 0;
      panStartOffsetRef.current = 0;
      setIsSideSplitVisible(false);
    }
  }, [manualCameraOffset, raceState]);

  // Send position to partner
  useEffect(() => {
    if (currentPosition && raceState === 'racing') {
      const liveDistanceM = Math.max(distanceM, currentPosition.distanceCovered);

      sendPosition({
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        distanceCovered: liveDistanceM,
        speed: currentPosition.speed,
      });

      if (liveDistanceM >= raceDistance && raceStartTime) {
        const duration = Date.now() - raceStartTime;
        finishRace({ finalDistance: liveDistanceM, duration });
      }
    }
  }, [currentPosition, distanceM, raceState, raceDistance, raceStartTime, sendPosition, finishRace]);

  const handleCancelRace = () => {
    Alert.alert('Cancel Race', 'Are you sure you want to cancel the race?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          cancelRace();
          resetTracker();
        },
      },
    ]);
  };

  const handlePlayAgain = () => {
    resetTracker();
    resetRace();
  };

  const handleCloseFinishedRace = () => {
    resetTracker();
    resetRace();
  };

  const liveDistanceM = Math.max(distanceM, currentPosition?.distanceCovered ?? 0);
  const myKm = (liveDistanceM / 1000).toFixed(2);
  const partnerDist = partnerPosition?.distanceCovered ?? 0;
  const gap = liveDistanceM - partnerDist;
  const ahead = gap >= 0;
  const sidePaneWidth = (width - 32 - SIDE_SPLIT_GAP) / 2;
  const trackViewportHeight = height - PERFORMANCE_DOCK_HEIGHT;

  // Animated styles (must be top level, not conditional)
  const myProgressStyle = useAnimatedStyle(() => ({ width: `${myProgress.value * 100}%` }));
  const theirProgressStyle = useAnimatedStyle(() => ({ width: `${theirProgress.value * 100}%` }));

  const renderTrackLayer = (isSideSplit: boolean) => (
    <PanGestureHandler
      ref={panGestureRef}
      simultaneousHandlers={pinchGestureRef}
      onGestureEvent={handlePanGestureEvent}
      onHandlerStateChange={handlePanStateChange}
      minDist={4}
    >
      <View style={isSideSplit ? styles.sideSplitTrackPane : styles.trackLayer}>
        <PinchGestureHandler
          ref={pinchGestureRef}
          simultaneousHandlers={panGestureRef}
          onGestureEvent={handlePinchGestureEvent}
          onHandlerStateChange={handlePinchStateChange}
        >
          <View style={styles.trackTouchSurface} onTouchStart={pauseAutoCameraForInteraction}>
            <InfiniteTrack
              myProgress={myProgress}
              theirProgress={theirProgress}
              cameraMode={cameraMode}
              raceDistance={raceDistance}
              isAutoCameraEnabled={isAutoCameraEnabled}
              isAutoCameraPaused={isAutoCameraPaused}
              manualZoomLevel={manualZoomLevel}
              manualCameraOffset={manualCameraOffset}
              viewportWidth={isSideSplit ? sidePaneWidth : width}
              viewportHeight={trackViewportHeight}
              isSideSplit={isSideSplit}
            />
          </View>
        </PinchGestureHandler>
      </View>
    </PanGestureHandler>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* --- Track Layer --- */}
      {renderTrackLayer(false)}

      {raceState === 'racing' && (
        <RaceMiniMap
          currentPosition={currentPosition}
          myDistanceM={liveDistanceM}
          partnerDistanceM={partnerDist}
        />
      )}

      {/* --- UI Layer --- */}
      <SafeAreaView style={styles.uiLayer} pointerEvents="box-none">
        {raceState === 'racing' && (
          <View style={[styles.cameraControlBar, { top: Math.max(insets.top + 12, 58) }]}>
            <TouchableOpacity
              style={[styles.cameraToggleBtn, (isAutoCameraEnabled && !isAutoCameraPaused) ? styles.cameraToggleBtnActive : null]}
              onPress={handleCameraToggle}
              activeOpacity={0.85}
            >
              <Text style={[styles.cameraToggleText, (isAutoCameraEnabled && !isAutoCameraPaused) ? styles.cameraToggleTextActive : null]}>
                {isAutoCameraEnabled ? (isAutoCameraPaused ? 'AUTO PAUSED' : 'RECENTER') : 'AUTO OFF'}
              </Text>
            </TouchableOpacity>

            <View style={styles.cameraZoomCluster}>
              <TouchableOpacity
                style={styles.cameraZoomBtn}
                onPress={() => handleManualZoom(-0.12)}
                activeOpacity={0.85}
              >
                <Text style={styles.cameraZoomBtnText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraZoomBtn}
                onPress={() => handleManualZoom(0.12)}
                activeOpacity={0.85}
              >
                <Text style={styles.cameraZoomBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} pointerEvents="none" />

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* Countdown Overlay */}
        {raceState === 'countdown' && countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown === 0 ? 'GO!' : countdown}</Text>
          </View>
        )}

        {/* Bottom Dashboard */}
        {raceState === 'idle' ? (
          <PreRaceDashboard
            isConnected={isConnected}
            onConfirmRunNow={(km) => {
              if (!isConnected) {
                Alert.alert('Not Connected', 'Wait for connection.');
                return;
              }
              sendInvite(km * 1000);
            }}
            onConfirmSchedule={(time, km) => {}}
          />
        ) : (
          <View style={{ flex: 1, width: '100%' }} pointerEvents="box-none">
            {/* Racing HUD (Performance Dock) */}
            {raceState === 'racing' && (
              <View style={styles.performanceDock}>
                {/* Edge Progress Bar */}
                <View style={styles.dockProgressContainer}>
                  <Animated.View style={[styles.dockProgressFill, { backgroundColor: THEME.secondary, opacity: 0.3, height: 4 }, theirProgressStyle] } />
                  <Animated.View style={[styles.dockProgressFill, { backgroundColor: THEME.primary, height: 4 }, myProgressStyle] } />
                </View>

                <View style={styles.dockContent}>
                  <View style={styles.dockStatCol}>
                    <Text style={styles.dockLabel}>SPEED</Text>
                    <Text style={styles.dockValueSmall}>{(speedMps * 3.6).toFixed(1)} <Text style={styles.dockUnit}>km/h</Text></Text>
                  </View>

                  <View style={styles.dockMainCol}>
                    <Text style={styles.dockLabelCenter}>DISTANCE</Text>
                    <View style={styles.dockValueRow}>
                      <Text style={styles.dockValueLarge}>{myKm}</Text>
                      <Text style={[styles.dockUnit, { fontSize: 18, marginBottom: 8 }]}>KM</Text>
                    </View>
                  </View>

                  <View style={styles.dockStatCol}>
                    <Text style={[styles.dockLabel, { textAlign: 'right' }]}>GAP</Text>
                    <Text style={[styles.dockValueSmall, { textAlign: 'right', color: ahead ? THEME.secondary : THEME.primary }]}>
                      {ahead ? '+' : '-'}{Math.abs(gap).toFixed(0)}m
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.dockStopBtn} onPress={handleCancelRace}>
                  <View style={styles.stopIconInner}>
                    <Pause size={20} color={THEME.primary} fill={THEME.primary} />
                  </View>
                  <Text style={styles.stopBtnText}>STOP</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Inviting State (Clean Dock) */}
            {raceState === 'inviting' && (
              <View style={[styles.performanceDock, { height: 120, justifyContent: 'center' }]}>
                <View style={styles.invitingContent}>
                  <View style={styles.invitingStatusBox}>
                    <ActivityIndicator size="small" color={THEME.primary} />
                    <Text style={styles.invitingText}>WAITING FOR PARTNER ACCEPTANCE</Text>
                  </View>
                  <TouchableOpacity style={styles.cancelDockBtn} onPress={cancelRace}>
                    <Text style={styles.cancelDockText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {raceState === 'invited' && inviteFrom && (
              <View style={[styles.performanceDock, { height: 170, justifyContent: 'center' }]}>
                <View style={styles.invitingContent}>
                  <View style={styles.invitingStatusBox}>
                    <Trophy size={18} color={THEME.primary} />
                    <Text style={styles.invitingText}>
                      {inviteFrom.fromName.toUpperCase()} INVITED YOU TO RACE {((inviteFrom.distance ?? raceDistance) / 1000).toFixed(1)}KM
                    </Text>
                  </View>
                  <View style={styles.inviteActionRow}>
                    <TouchableOpacity style={styles.inviteDeclineBtn} onPress={declineInvite} activeOpacity={0.85}>
                      <Text style={styles.inviteDeclineText}>DECLINE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inviteAcceptBtn} onPress={acceptInvite} activeOpacity={0.85}>
                      <Text style={styles.inviteAcceptText}>ACCEPT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Celebration State (Full Overlay) */}
            {raceState === 'finished' && winner && (
              <View style={styles.finishOverlay}>
                <LinearGradient
                  colors={['rgba(45, 52, 54, 0.95)', 'rgba(0, 0, 0, 0.98)']}
                  style={styles.finishBackdrop}
                >
                  <TouchableOpacity
                    style={[styles.finishCloseBtn, { top: Math.max(insets.top + 12, 24) }]}
                    onPress={handleCloseFinishedRace}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Close race result"
                  >
                    <X size={24} color="#FFF" />
                  </TouchableOpacity>

                  <View style={styles.trophyGlow}>
                    <Trophy size={100} color={THEME.kerb1} />
                  </View>
                  
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.resultLabel}>RACE COMPLETE</Text>
                    <Text style={styles.winnerMainName}>{winner.winnerName}</Text>
                    <Text style={styles.subtitleLabel}>IS THE CHAMPION</Text>
                  </View>

                  <View style={styles.resultDetailsRow}>
                    <View style={styles.resultStatBlock}>
                      <Text style={styles.resultStatLabel}>TOTAL TIME</Text>
                      <Text style={styles.resultStatValue}>{(winner.duration / 1000).toFixed(1)}s</Text>
                    </View>
                    <View style={styles.resultDivider} />
                    <View style={styles.resultStatBlock}>
                      <Text style={styles.resultStatLabel}>DISTANCE</Text>
                      <Text style={styles.resultStatValue}>{(((winner.finalDistance ?? raceDistance) as number) / 1000).toFixed(2)}km</Text>
                    </View>
                  </View>

                  <View style={styles.resultActionRow}>
                    <TouchableOpacity style={styles.rematchBtn} onPress={handlePlayAgain}>
                      <Play size={24} color="#FFF" fill="#FFF" />
                      <Text style={styles.rematchText}>REMATCH</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.exitDockBtn} onPress={resetRace}>
                      <Text style={styles.exitDockText}>EXIT TO HUB</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// --- Track & Avatar Components (same UI as your working version) ---
function formatCheckpointLabel(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '';
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)}m`;

  const distanceKm = distanceMeters / 1000;
  return Number.isInteger(distanceKm) ? `${distanceKm}km` : `${distanceKm.toFixed(1)}km`;
}

const InfiniteTrack = ({
  myProgress,
  theirProgress,
  cameraMode,
  raceDistance,
  isAutoCameraEnabled,
  isAutoCameraPaused,
  manualZoomLevel,
  manualCameraOffset,
  viewportWidth,
  viewportHeight,
  isSideSplit,
}: any) => {
  const checkpoints = useMemo(() => {
    const totalDistance = Number.isFinite(raceDistance) && raceDistance > 0 ? raceDistance : 1000;
    const checkpointFractions = Array.from({ length: 9 }, (_, index) => (index + 1) / 10);

    return checkpointFractions.map((fraction) => ({
      id: `checkpoint-${fraction}`,
      label: formatCheckpointLabel(totalDistance * fraction),
      top: `${10 + (1 - fraction) * 75}%`,
    }));
  }, [raceDistance]);

  const cameraStyle = useAnimatedStyle(() => {
    const usingAutoCamera = isAutoCameraEnabled && !isAutoCameraPaused;
    const autoTilt = interpolate(cameraMode.value, [0, 1, 2], isSideSplit ? [30, 27, 23] : [34, 30, 26]);
    const autoScale = interpolate(cameraMode.value, [0, 1, 2], isSideSplit ? [1.08, 1.02, 0.94] : [1.02, 0.96, 0.88]);
    const manualTilt = 12 + manualZoomLevel * 30;
    const manualScale = 0.28 + manualZoomLevel * 1.12;
    const tilt = usingAutoCamera ? autoTilt : manualTilt;
    const scale = usingAutoCamera ? autoScale : manualScale;
    const baseTrackingShift = interpolate(myProgress.value, [0, 1], [-viewportHeight * 0.16, viewportHeight * 0.82]);
    const startFocusBoost = interpolate(myProgress.value, [0, 0.12, 1], [-viewportHeight * 0.34, -viewportHeight * 0.08, 0]);
    const dockClearanceShift = isSideSplit
      ? 0
      : interpolate(
          myProgress.value,
          [0, 0.18, 1],
          [-PERFORMANCE_DOCK_HEIGHT * 1.1, -PERFORMANCE_DOCK_HEIGHT * 0.4, 0]
        );
    const trackingShift = baseTrackingShift + startFocusBoost + dockClearanceShift;
    const manualTrackingShift = trackingShift * (0.15 + manualZoomLevel * 0.85);
    const translateY = (usingAutoCamera ? trackingShift : manualTrackingShift) + manualCameraOffset.value;
    return {
      transform: [
        { perspective: 850 },
        { rotateX: `${tilt}deg` },
        { scale },
        { translateY },
      ],
    };
  });

  const roadWidth = Math.max(viewportWidth * (isSideSplit ? 0.9 : 0.85), isSideSplit ? 160 : 220);
  const roadHeight = viewportHeight * 2;
  const laneOffset = Math.max(28, Math.min(viewportWidth * 0.18, 56));

  return (
    <View style={styles.sceneContainer}>
      <Animated.View style={[styles.roadStrip, { width: roadWidth, height: roadHeight }, cameraStyle]}>
        <View style={styles.roadSurface}>
          <View style={styles.grassLeft} />
          <View style={styles.grassRight} />
          <View style={styles.kerbContainer}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View key={i} style={[styles.kerbBlock, { backgroundColor: i % 2 === 0 ? THEME.kerb1 : THEME.kerb2 }]} />
            ))}
          </View>
          <View style={styles.asphalt}>
            {checkpoints.map((checkpoint) => (
              <View key={checkpoint.id} style={[styles.distanceLine, { top: (checkpoint.top as any) }]}>
                <Text style={styles.gridText}>{checkpoint.label}</Text>
              </View>
            ))}
            <View style={styles.laneMarkerCenter} />
            <View style={styles.startLine}><Text style={styles.lineLabel}>START</Text></View>
            <View style={[styles.startLine, { bottom: 'auto', top: '5%', backgroundColor: THEME.primary }]}>
              <Text style={[styles.lineLabel, { color: THEME.primary }]}>FINISH</Text>
            </View>
            <Avatar progress={theirProgress} color={THEME.secondary} icon={<Heart size={20} color="#FFF" fill="rgba(255,255,255,0.5)" />} laneOffset={-laneOffset} label="Partner" />
            <Avatar progress={myProgress} color={THEME.primary} icon={<Zap size={20} color="#FFF" fill="#FFF" />} laneOffset={laneOffset} label="You" isMe />
          </View>
          <View style={styles.kerbContainer}>
            {Array.from({ length: 40 }).map((_, i) => (
              <View key={i} style={[styles.kerbBlock, { backgroundColor: i % 2 === 0 ? THEME.kerb1 : THEME.kerb2 }]} />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const Avatar = ({ progress, color, icon, laneOffset, label, isMe }: any) => {
  const yPos = useAnimatedStyle(() => ({ bottom: `${interpolate(progress.value, [0, 1], [10, 85])}%` }));
  return (
    <Animated.View style={[styles.runnerContainer, { transform: [{ translateX: laneOffset }] }, yPos]}>
      <View style={styles.runnerLabelTag}>
        <Text style={[styles.runnerLabelText, { color }]}>{label}</Text>
      </View>
      <View style={[styles.runnerBody, { backgroundColor: color, transform: [{ scale: isMe ? 1.1 : 1 }] }]}>{icon}</View>
      <View style={[styles.runnerShadow, { backgroundColor: color }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  trackLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  sideSplitScene: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 1,
  },
  sideSplitConsole: {
    flex: 1,
    backgroundColor: THEME.glass,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
  },
  consoleHeaderRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  consoleHeaderCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleDividerSmall: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  consoleEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    color: THEME.textLight,
  },
  consoleMainBody: {
    flex: 1,
    flexDirection: 'row',
  },
  sideSplitPane: { flex: 1 },
  sideSplitTrackPane: {
    flex: 1,
    backgroundColor: '#F6F8FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  trackTouchSurface: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  uiLayer: { flex: 1, zIndex: 10, justifyContent: 'space-between' },
  cameraControlBar: { position: 'absolute', top: 18, left: 16, right: 196, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 60 },
  cameraToggleBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  cameraToggleBtnActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  cameraToggleText: { fontSize: 11, fontWeight: '900', color: THEME.textMain, letterSpacing: 0.8 },
  cameraToggleTextActive: { color: '#FFF' },
  cameraZoomCluster: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cameraZoomBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  cameraZoomBtnText: { fontSize: 24, fontWeight: '700', color: THEME.textMain, marginTop: -2 },



  performanceDock: { position: 'absolute', bottom: 0, left: 0, right: 0, height: PERFORMANCE_DOCK_HEIGHT, backgroundColor: 'rgba(255, 255, 255, 0.92)', borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.14, shadowRadius: 24, overflow: 'hidden', paddingBottom: 14, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  dockProgressContainer: { height: 4, width: '100%', backgroundColor: 'rgba(0,0,0,0.05)', position: 'absolute', top: 0 },
  dockProgressFill: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
  dockContent: { flex: 1, flexDirection: 'row', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 48, alignItems: 'center' },
  dockStatCol: { flex: 1, justifyContent: 'center' },
  dockMainCol: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  dockLabel: { fontSize: 10, fontWeight: '900', color: THEME.textLight, letterSpacing: 1.6, marginBottom: 6 },
  dockLabelCenter: { fontSize: 10, fontWeight: '900', color: THEME.primary, letterSpacing: 2.2, marginBottom: 6 },
  dockValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  dockValueLarge: { fontSize: 52, fontWeight: '900', color: THEME.textMain, letterSpacing: -2, lineHeight: 56 },
  dockValueSmall: { fontSize: 22, fontWeight: '900', color: THEME.textMain, lineHeight: 26 },
  dockUnit: { fontSize: 12, fontWeight: '800', color: THEME.textLight, marginLeft: 4 },
  
  dockStopBtn: { position: 'absolute', bottom: 14, alignSelf: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  stopIconInner: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255, 107, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },
  stopBtnText: { fontSize: 12, fontWeight: '900', color: THEME.textMain, letterSpacing: 1 },

  invitingContent: { alignItems: 'center', gap: 12, width: '100%', paddingHorizontal: 16 },
  invitingStatusBox: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  invitingText: { fontSize: 12, fontWeight: '900', color: THEME.textMain, letterSpacing: 0.8, textAlign: 'center' },
  cancelDockBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelDockText: { fontSize: 12, fontWeight: '800', color: THEME.primary, letterSpacing: 1 },
  inviteActionRow: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 4 },
  inviteDeclineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteDeclineText: { fontSize: 13, fontWeight: '900', color: THEME.textMain, letterSpacing: 0.8 },
  inviteAcceptBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteAcceptText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.8 },

  finishOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000 },
  finishBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 40 },
  finishCloseBtn: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  trophyGlow: { width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255, 159, 67, 0.15)', justifyContent: 'center', alignItems: 'center', shadowColor: THEME.kerb1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 30 },
  resultLabel: { fontSize: 14, fontWeight: '900', color: THEME.primary, letterSpacing: 5, marginBottom: 10 },
  winnerMainName: { fontSize: 64, fontWeight: '900', color: '#FFF', textAlign: 'center', letterSpacing: -2 },
  subtitleLabel: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  
  resultDetailsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 30, padding: 30, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  resultStatBlock: { flex: 1, alignItems: 'center' },
  resultStatLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.5)', marginBottom: 8, letterSpacing: 1 },
  resultStatValue: { fontSize: 28, fontWeight: '900', color: '#FFF' },
  resultDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },

  resultActionRow: { width: '100%', gap: 20 },
  rematchBtn: { width: '100%', height: 70, borderRadius: 35, backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, elevation: 10, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
  rematchText: { fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  exitDockBtn: { alignSelf: 'center', padding: 15 },
  exitDockText: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },

  countdownOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,107,129,0.95)', zIndex: 100 },
  countdownText: { fontSize: 180, fontWeight: '900', color: '#FFF' },

  sceneContainer: { flex: 1, width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  roadStrip: {},
  roadSurface: { flex: 1, flexDirection: 'row', overflow: 'hidden', borderRadius: 20 },
  grassLeft: { position: 'absolute', left: -500, width: 500, height: '100%', backgroundColor: '#E8F5E9' },
  grassRight: { position: 'absolute', right: -500, width: 500, height: '100%', backgroundColor: '#E8F5E9' },
  kerbContainer: { width: 12, height: '100%' },
  kerbBlock: { flex: 1 },
  asphalt: { flex: 1, backgroundColor: THEME.road, overflow: 'hidden' },
  distanceLine: { position: 'absolute', width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'flex-end', paddingRight: 10 },
  gridText: { color: 'rgba(0,0,0,0.2)', fontSize: 9, fontWeight: '700', marginTop: -14 },
  laneMarkerCenter: { position: 'absolute', left: '50%', marginLeft: -2, height: '100%', width: 4, backgroundColor: '#FFF', opacity: 0.6 },
  startLine: { position: 'absolute', bottom: '10%', width: '100%', height: 6, backgroundColor: '#FFF' },
  lineLabel: { position: 'absolute', right: '105%', color: 'rgba(0,0,0,0.3)', fontWeight: '800', fontSize: 10 },
  runnerContainer: { position: 'absolute', left: '50%', marginLeft: -24, width: 48, height: 48, alignItems: 'center', zIndex: 50 },
  runnerBody: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  runnerLabelTag: { position: 'absolute', top: -24, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, borderRadius: 8 },
  runnerLabelText: { fontSize: 9, fontWeight: '800' },
  runnerShadow: { position: 'absolute', bottom: -8, width: 30, height: 30, borderRadius: 15, opacity: 0.3, transform: [{ scaleX: 2 }, { scaleY: 0.3 }] },
});
