// app/components/RunMap.tsx

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  Region,
  PROVIDER_GOOGLE,
  LatLng as RNLatLng,
} from "react-native-maps";

export type LatLng = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type RunMapProps = {
  path: LatLng[];
  currentLocation?: LatLng;
  isRunning: boolean;
};

const FALLBACK_REGION: Region = {
  latitude: -33.865143,
  longitude: 151.2099,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function buildStrokeColors(n: number): string[] {
  if (n <= 1) return ["#7C3AED"];
  const stops = ["#0EA5E9", "#3B82F6", "#8B5CF6", "#7C3AED"];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const idx = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const localT = t * (stops.length - 1) - idx;
    out.push(mixHex(stops[idx], stops[idx + 1], localT));
  }
  return out;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace("#", ""), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const r = Math.round(((pa >> 16) * (1 - t)) + ((pb >> 16) * t));
  const g = Math.round((((pa >> 8) & 0xff) * (1 - t)) + (((pb >> 8) & 0xff) * t));
  const bl = Math.round(((pa & 0xff) * (1 - t)) + ((pb & 0xff) * t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

const MODERN_LIGHT_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e3f2fd" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const RunMap: React.FC<RunMapProps> = ({ path, currentLocation, isRunning }) => {
  const mapRef = useRef<MapView | null>(null);

  const provider = Platform.OS === "android" ? PROVIDER_GOOGLE : undefined;
  const isUsingGoogle = Platform.OS === "android";

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulse]);

  const initialRegion: Region = useMemo(() => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    if (path.length > 0) {
      return {
        latitude: path[0].latitude,
        longitude: path[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    return FALLBACK_REGION;
  }, [currentLocation?.latitude, currentLocation?.longitude, path]);

  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;

    mapRef.current.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: isRunning ? 0.004 : 0.008,
        longitudeDelta: isRunning ? 0.004 : 0.008,
      },
      450
    );
  }, [currentLocation?.latitude, currentLocation?.longitude, isRunning]);

  useEffect(() => {
    if (!mapRef.current || !path.length || isRunning || path.length <= 1) return;

    try {
      mapRef.current.fitToCoordinates(path as RNLatLng[], {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    } catch (error) {
      console.warn("fitToCoordinates failed", error);
    }
  }, [isRunning, path]);

  const strokeColors = useMemo(() => buildStrokeColors(Math.max(2, path.length)), [path.length]);

  const pulseStyle = {
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.4],
        }),
      },
    ],
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 0],
    }),
  };

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={provider}
      customMapStyle={isUsingGoogle ? MODERN_LIGHT_STYLE : undefined}
      initialRegion={initialRegion}
      mapType="standard"
      showsBuildings={false}
      showsIndoorLevelPicker={false}
      showsIndoors={false}
      showsCompass={false}
      showsMyLocationButton={false}
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      loadingEnabled
    >
      {path.length > 1 && (
        <Polyline
          coordinates={path}
          strokeWidth={6}
          strokeColor="#7C3AED"
          strokeColors={isUsingGoogle ? strokeColors : undefined}
          geodesic
        />
      )}

      {currentLocation && (
        <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.markerWrapper}>
            <Animated.View style={[styles.pulse, pulseStyle]} />
            <View style={styles.markerCore} />
          </View>
        </Marker>
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  markerWrapper: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22d3ee",
  },
  markerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#38bdf8",
    borderWidth: 2,
    borderColor: "#0ea5e9",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});

export default RunMap;
