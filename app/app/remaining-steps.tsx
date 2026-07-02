import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Zap, TrendingUp, Clock3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import { useAuth } from '../src/auth/authContext';
import { useStepSync } from '../hooks/UseStepSync';
import { useDailySummary } from '../hooks/useDailySummary';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6B6B',
  dark: '#0F172A',
  muted: '#94A3B8',
  white: '#FFFFFF',
};

const FALLBACK_REGION: Region = {
  latitude: -33.865143,
  longitude: 151.2099,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const NIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7c8aa5' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#172033' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#172033' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#66748f' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08111f' }] },
];

function parseNumericParam(value: string | string[] | undefined, fallback: number): number {
  const raw = typeof value === 'string' ? value : value?.[0];
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDurationLabel(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (ms <= 0) {
    return '0m';
  }

  if (hours <= 0) {
    return `${Math.max(1, totalMinutes)} min`;
  }

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function RemainingStepsScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const { accessToken } = useAuth();
  const { steps: liveSteps } = useStepSync({ accessToken });
  const { summary } = useDailySummary({ accessToken });
  const { current = '0', target = '10000' } = useLocalSearchParams();
  const openedAtRef = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [trailCoords, setTrailCoords] = useState<LatLng[]>([]);

  const fallbackCurrent = parseNumericParam(current, 0);
  const fallbackTarget = parseNumericParam(target, 10000);
  const cur = Math.max(fallbackCurrent, summary?.steps ?? 0, liveSteps ?? 0);
  const tgt = Math.max(summary?.stepsTarget ?? 0, fallbackTarget, 1);
  const remaining = Math.max(0, tgt - cur);
  const progress = tgt > 0 ? Math.min(1, cur / tgt) : 0;
  const sessionSteps = Math.max(0, cur - fallbackCurrent);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Date.now() - openedAtRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    const syncLocation = (coords: Location.LocationObjectCoords) => {
      if (!active) {
        return;
      }

      const next: LatLng = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      setCurrentLocation(next);
      setTrailCoords((prev) => {
        if (prev.length === 0) {
          return [next];
        }

        const last = prev[prev.length - 1];
        const latDiff = Math.abs(last.latitude - next.latitude);
        const lonDiff = Math.abs(last.longitude - next.longitude);

        if (latDiff < 0.000015 && lonDiff < 0.000015) {
          return prev;
        }

        return [...prev, next].slice(-80);
      });
    };

    const startLocationWatch = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || permission.status !== 'granted') {
          return;
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        syncLocation(initial.coords);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8,
            timeInterval: 5000,
          },
          (location) => {
            syncLocation(location.coords);
          }
        );
      } catch {
        // Keep the screen usable even if location fails.
      }
    };

    startLocationWatch();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !currentLocation) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      450
    );
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const paceMsPer1000 = useMemo(() => {
    if (sessionSteps <= 0 || elapsedMs <= 0) {
      return null;
    }

    return (elapsedMs / sessionSteps) * 1000;
  }, [elapsedMs, sessionSteps]);

  const etaMs = useMemo(() => {
    if (remaining === 0) {
      return 0;
    }

    if (!paceMsPer1000) {
      return null;
    }

    return (paceMsPer1000 * remaining) / 1000;
  }, [paceMsPer1000, remaining]);
  
  const message = useMemo(() => {
    if (remaining === 0) return "GOAL REACHED!";
    if (progress > 0.8) return "ALMOST THERE!";
    if (progress > 0.5) return "HALFWAY POINT!";
    return "KEEP MOVING!";
  }, [remaining, progress]);

  const initialRegion = useMemo<Region>(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    if (trailCoords.length > 0) {
      return {
        latitude: trailCoords[0].latitude,
        longitude: trailCoords[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return FALLBACK_REGION;
  }, [currentLocation, trailCoords]);

  const displayTrailCoords = useMemo(() => {
    if (!currentLocation) {
      return trailCoords;
    }

    if (trailCoords.length === 0) {
      return [currentLocation];
    }

    const last = trailCoords[trailCoords.length - 1];
    const latDiff = Math.abs(last.latitude - currentLocation.latitude);
    const lonDiff = Math.abs(last.longitude - currentLocation.longitude);

    if (latDiff < 0.000005 && lonDiff < 0.000005) {
      return trailCoords;
    }

    return [...trailCoords, currentLocation];
  }, [currentLocation, trailCoords]);

  const isUsingGoogle = Platform.OS === 'android';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <MapView
        ref={mapRef}
        style={[StyleSheet.absoluteFillObject, { opacity: 0.80 }]}
        provider={isUsingGoogle ? PROVIDER_GOOGLE : undefined}
        customMapStyle={isUsingGoogle ? NIGHT_MAP_STYLE : undefined}
        initialRegion={initialRegion}
        mapType="standard"
        showsBuildings={false}
        showsCompass={false}
        showsMyLocationButton={false}
        showsIndoorLevelPicker={false}
        showsIndoors={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        loadingEnabled
      >
        {displayTrailCoords.length > 1 && (
          <Polyline
            coordinates={displayTrailCoords}
            strokeWidth={4}
            strokeColor="#FF6B6B55"
            geodesic
          />
        )}
        {currentLocation && (
          <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.mapMarkerOuter}>
              <View style={styles.mapMarkerInner} />
            </View>
          </Marker>
        )}
      </MapView>

      <LinearGradient
        colors={['rgba(2, 6, 23, 0.65)', 'rgba(2, 6, 23, 0.85)', 'rgba(2, 6, 23, 0.98)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <View style={styles.contentContainer}>
        <TouchableOpacity 
          style={styles.closeBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <BlurView intensity={20} style={styles.blurBtn} tint="dark">
            <X size={20} color={COLORS.white} />
          </BlurView>
        </TouchableOpacity>

        <View style={styles.mainContent}>
          <Animated.View entering={FadeIn.delay(200)} style={styles.headerGroup}>
            <View style={styles.pillBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.pillText}>LIVE TRACKING</Text>
            </View>
            <Text style={styles.messageText}>{message}</Text>
          </Animated.View>
          
          <View style={styles.centerGroup}>
            <Animated.Text entering={ZoomIn.delay(300)} style={styles.bigNumber}>
              {remaining.toLocaleString()}
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(400)} style={styles.subLabel}>
              STEPS REMAINING
            </Animated.Text>
          </View>

          <Animated.View entering={FadeInUp.delay(500)} style={styles.progressSection}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <View>
                <Text style={styles.metaLabel}>PROGRESS</Text>
                <Text style={styles.metaValue}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metaLabel}>GOAL</Text>
                <Text style={styles.metaValue}>{tgt.toLocaleString()}</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)} style={styles.dashboard}>
            <View style={styles.dashboardHeader}>
              <Clock3 size={14} color={COLORS.primary} />
              <Text style={styles.dashboardTitle}>SESSION INSIGHTS</Text>
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{formatElapsedClock(elapsedMs)}</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabelSmall}>PACE</Text>
                <Text style={styles.metricValueLarge}>
                  {paceMsPer1000 ? formatDurationLabel(paceMsPer1000) : '--'}
                </Text>
                <Text style={styles.metricSub}>per 1k steps</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabelSmall}>EST. TIME</Text>
                <Text style={styles.metricValueLarge}>
                  {etaMs === null ? '--' : formatDurationLabel(etaMs)}
                </Text>
                <Text style={styles.metricSub}>to finish</Text>
              </View>
            </View>

            <View style={styles.sessionStatus}>
              <TrendingUp size={12} color={COLORS.muted} style={styles.sessionStatusIcon} />
              <Text style={styles.sessionStatusText}>
                {sessionSteps > 0
                  ? `+${sessionSteps.toLocaleString()} steps detected`
                  : 'Awaiting movement...'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(800)} style={styles.footer}>
          <Text style={styles.footerText}>REAL-TIME DEVICE SYNC ACTIVE</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#020617' 
  },
  contentContainer: { 
    flex: 1, 
    padding: 24,
    justifyContent: 'center'
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  blurBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mainContent: {
    width: '100%',
  },
  headerGroup: {
    alignItems: 'center',
    marginBottom: 40,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.16)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  centerGroup: {
    alignItems: 'center',
    marginBottom: 60,
  },
  bigNumber: {
    fontSize: width * 0.32,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -8,
    lineHeight: width * 0.32,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 4,
    marginTop: 10,
  },
  progressSection: {
    width: '100%',
    marginBottom: 48,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
  },
  dashboard: {
    backgroundColor: 'rgba(2,6,23,0.88)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dashboardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
    marginLeft: 10,
  },
  timerPill: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    fontVariant: ['tabular-nums'],
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metricItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  metricLabelSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  metricValueLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(148,163,184,0.5)',
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    borderRadius: 16,
  },
  sessionStatusIcon: {
    marginRight: 8,
  },
  sessionStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(148,163,184,0.45)',
    letterSpacing: 2,
  },
  mapMarkerOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  mapMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
