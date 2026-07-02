import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import { Activity, Maximize2, Minimize2 } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate,
} from 'react-native-reanimated';

type PositionLike = {
  latitude: number;
  longitude: number;
  timestamp?: number;
};

type Props = {
  currentPosition: PositionLike | null;
  myDistanceM: number;
  partnerDistanceM: number;
};

const DEFAULT_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const THEME = {
  primary: '#FF6B81',
  secondary: '#2EC4B6',
  textMain: '#2D3436',
  textLight: '#8395A7',
  glass: 'rgba(255, 255, 255, 0.95)',
  surface: '#FFFFFF',
  border: 'rgba(0,0,0,0.06)',
};

const MIN_DELTA = 0.0012; // Zoomed in more
const MAX_DELTA = 0.02;   // Don't zoom out too far
const TRAIL_LIMIT = 120;

function appendTrailPoint(trail: LatLng[], point: LatLng | null) {
  if (!point) return trail;
  if (trail.length === 0) return [point];

  const last = trail[trail.length - 1];
  const latDiff = Math.abs(last.latitude - point.latitude);
  const lonDiff = Math.abs(last.longitude - point.longitude);

  if (latDiff < 0.00001 && lonDiff < 0.00001) {
    return trail;
  }

  const nextTrail = [...trail, point];
  return nextTrail.length > TRAIL_LIMIT ? nextTrail.slice(nextTrail.length - TRAIL_LIMIT) : nextTrail;
}

function getAdaptiveRegion(
  currentPosition: LatLng | null,
  myTrail: LatLng[]
): Region {
  const center = currentPosition;
  if (!center) return DEFAULT_REGION;

  const points = [
    center,
    myTrail[myTrail.length - 1] ?? null,
  ].filter(Boolean) as LatLng[];

  let furthestLatDiff = 0;
  let furthestLonDiff = 0;

  points.forEach((point) => {
    furthestLatDiff = Math.max(furthestLatDiff, Math.abs(point.latitude - center.latitude));
    furthestLonDiff = Math.max(furthestLonDiff, Math.abs(point.longitude - center.longitude));
  });

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, furthestLatDiff * 5 + 0.0012)),
    longitudeDelta: Math.min(MAX_DELTA, Math.max(MIN_DELTA, furthestLonDiff * 5 + 0.0012)),
  };
}

function formatDistance(distanceM: number) {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return '0m';
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(2)}km`;
}

export default function RaceMiniMap({
  currentPosition,
  myDistanceM,
  partnerDistanceM,
}: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [myTrail, setMyTrail] = useState<LatLng[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const expansionProgress = useSharedValue(0);

  useEffect(() => {
    expansionProgress.value = withSpring(isExpanded ? 1 : 0, {
      damping: 20,
      stiffness: 100,
    });
  }, [isExpanded]);

  const myCoordinate = useMemo(
    () =>
      currentPosition
        ? { latitude: currentPosition.latitude, longitude: currentPosition.longitude }
        : null,
    [currentPosition]
  );

  useEffect(() => {
    setMyTrail((existing) => appendTrailPoint(existing, myCoordinate));
  }, [myCoordinate]);

  const mapRegion = useMemo(
    () => getAdaptiveRegion(myCoordinate, myTrail),
    [myCoordinate, myTrail]
  );

  useEffect(() => {
    if (!mapRef.current || !myCoordinate || !isExpanded) return;
    mapRef.current.animateToRegion(mapRegion, 350);
  }, [mapRegion, myCoordinate, isExpanded]);

  const progressText = `${formatDistance(myDistanceM)}`;
  const gap = myDistanceM - partnerDistanceM;
  const gapPrefix = gap >= 0 ? '+' : '-';
  const ahead = gap >= 0;

  const shellStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(expansionProgress.value, [0, 1], [72, 280]),
    };
  });

  const mapOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: expansionProgress.value,
      transform: [
        { translateY: interpolate(expansionProgress.value, [0, 1], [10, 0]) }
      ]
    };
  });

  return (
    <Animated.View style={[styles.shell, shellStyle]}>
      <TouchableOpacity 
        style={styles.headerBar} 
        activeOpacity={0.85}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Activity size={18} color={THEME.primary} />
          </View>
          <View>
            <Text style={styles.eyebrow}>RACE RADAR</Text>
            <Text style={styles.distanceText}>{progressText}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.gapBadge, { backgroundColor: ahead ? 'rgba(46, 196, 182, 0.15)' : 'rgba(255, 107, 129, 0.15)' }]}>
            <Text style={[styles.gapText, { color: ahead ? THEME.secondary : THEME.primary }]}>
              {gapPrefix}{Math.abs(gap).toFixed(0)}m
            </Text>
          </View>
          <View style={styles.toggleBtn}>
            {isExpanded ? <Minimize2 size={20} color={THEME.textLight} /> : <Maximize2 size={20} color={THEME.textLight} />}
          </View>
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.mapContent, mapOverlayStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
        <View style={styles.mapFrame}>
          <MapView
            key={isExpanded ? 'expanded' : 'collapsed'}
            ref={mapRef}
            style={{ flex: 1, borderRadius: 16 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsCompass={false}
            showsScale={false}
            showsBuildings={false}
            showsIndoors={false}
            showsTraffic={false}
            showsMyLocationButton={false}
          >
            {myTrail.length > 1 && (
              <Polyline
                coordinates={myTrail}
                strokeWidth={4}
                strokeColor={THEME.primary}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {myCoordinate && (
              <Marker coordinate={myCoordinate as LatLng} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.markerShell, styles.myMarkerShell]}>
                  <View style={[styles.markerCore, styles.myMarkerCore]} />
                </View>
              </Marker>
            )}
          </MapView>

          {!myCoordinate && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingTitle}>Locating runner</Text>
              <Text style={styles.loadingText}>Waiting for GPS lock</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 180 + 12, // Above dock
    left: 16,
    right: 16,
    backgroundColor: THEME.glass,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    zIndex: 1000,
  },
  headerBar: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: THEME.textLight,
  },
  distanceText: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '900',
    color: THEME.textMain,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gapBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapText: {
    fontSize: 12,
    fontWeight: '900',
  },
  toggleBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mapFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  markerShell: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  myMarkerShell: {
    backgroundColor: THEME.primary,
  },
  markerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  myMarkerCore: {
    backgroundColor: '#FFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loadingTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: THEME.textMain,
  },
  loadingText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textLight,
  },
});
