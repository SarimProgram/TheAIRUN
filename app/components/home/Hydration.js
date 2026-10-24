import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Crown } from 'lucide-react-native';
import { useAuth } from '../../src/auth/authContext';
import { useWaterSync } from '../../hooks/useWaterSync';
import { usePartnerSummary } from '../../hooks/usePartnerSummary';

const WATER_GLASS_GOAL = 8;

const COLORS = {
  primary: '#FF6B6B',
  teal: '#1F938A',
  water: '#38BDF8',
  textMuted: '#94A3B8',
  dark: '#1E293B',
};

const GLASS_BODY =
  'M 18 14 C 18 9 46 9 46 14 L 48 66 C 48 72 16 72 16 66 Z';
const GLASS_WATER =
  'M 20 30 L 18.5 64 C 18.5 68 45.5 68 45.5 64 L 44 30 Z';
const GLASS_RIM =
  'M 18 14 C 18 10 46 10 46 14';
const GLASS_HIGHLIGHT =
  'M 22 18 L 21 62 C 21 65 24 65 26 65 L 27 18 Z';

function HydrationGlass({ filled, onPress, disabled, index, accent }) {
  const gradientId = `hydration-duel-water-${index}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.glassBtn}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Svg width={28} height={34} viewBox="0 0 64 80">
        <Defs>
          <LinearGradient id={gradientId} x1="32" y1="28" x2="32" y2="70" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#BAE6FD" />
            <Stop offset="1" stopColor={COLORS.water} />
          </LinearGradient>
        </Defs>

        <Path
          d={GLASS_BODY}
          fill={filled ? '#F0F9FF' : '#F8FAFC'}
          stroke={filled ? '#7DD3FC' : '#CBD5E1'}
          strokeWidth={2}
        />

        {filled ? <Path d={GLASS_WATER} fill={`url(#${gradientId})`} /> : null}

        <Path d={GLASS_HIGHLIGHT} fill="rgba(255,255,255,0.42)" />
        <Path
          d={GLASS_RIM}
          fill="none"
          stroke={filled ? accent : '#94A3B8'}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

function GlassGrid({ count, accent, interactive, onSelect }) {
  return (
    <View style={styles.glassGrid}>
      {[...Array(WATER_GLASS_GOAL)].map((_, index) => (
        <HydrationGlass
          key={index}
          index={index}
          filled={index < count}
          accent={accent}
          disabled={!interactive}
          onPress={() => onSelect?.(index + 1)}
        />
      ))}
    </View>
  );
}

const Hydration = ({ partnerDisplayName = 'PARTNER', cardStyle }) => {
  const { accessToken } = useAuth();
  const { glassCount, setWaterTotal } = useWaterSync({ accessToken });
  const { partnerData } = usePartnerSummary({ accessToken });

  const myGlasses = glassCount;
  const partnerGlasses = partnerData?.waterMl ? Math.floor(partnerData.waterMl / 250) : 0;
  const amIWinning = myGlasses >= partnerGlasses;
  const total = (myGlasses + partnerGlasses) || 1;
  const rawMyPercent = (myGlasses / total) * 100;
  const myTargetPercent = Math.max(15, Math.min(85, rawMyPercent));

  const barAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: myTargetPercent,
      duration: 1200,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: false,
    }).start();
  }, [barAnim, myTargetPercent]);

  const p1Flex = barAnim;
  const p2Flex = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [100, 0],
  });

  const handleUpdateWater = useCallback(async (glasses) => {
    try {
      await setWaterTotal(glasses * 250);
    } catch (e) {
      console.error('Water update error:', e);
    }
  }, [setWaterTotal]);

  const partnerName = useMemo(
    () => (partnerDisplayName || 'PARTNER').split(' ')[0].toUpperCase(),
    [partnerDisplayName]
  );

  return (
    <View style={[styles.duelCard, cardStyle, styles.duelCardFill]}>
      <View style={styles.duelRow}>
        <View style={styles.playerColumn}>
          <GlassGrid
            count={myGlasses}
            accent={COLORS.primary}
            interactive
            onSelect={handleUpdateWater}
          />
          <Text style={[styles.playerNumber, { color: COLORS.primary }]}>
            {myGlasses}/{WATER_GLASS_GOAL}
          </Text>
          <View style={styles.playerLabelRow}>
            <Text style={styles.playerLabel}>YOU</Text>
            {amIWinning ? <Crown size={13} color={COLORS.primary} strokeWidth={2.5} /> : null}
          </View>
        </View>

        <View style={styles.vsColumn}>
          <View style={styles.vsBadge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        </View>

        <View style={styles.playerColumn}>
          <GlassGrid count={partnerGlasses} accent={COLORS.teal} />
          <Text style={[styles.playerNumber, { color: COLORS.teal }]}>
            {partnerGlasses}/{WATER_GLASS_GOAL}
          </Text>
          <View style={styles.playerLabelRow}>
            {!amIWinning && partnerGlasses > 0 ? (
              <Crown size={13} color={COLORS.teal} strokeWidth={2.5} />
            ) : null}
            <Text style={styles.playerLabel} numberOfLines={1} ellipsizeMode="tail">
              {partnerName}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.duelBarWrap}>
        <View style={styles.barContainer}>
          <Animated.View style={[styles.barSegment, { flex: p1Flex, backgroundColor: COLORS.primary }]} />
          <Animated.View style={[styles.barSegment, { flex: p2Flex, backgroundColor: COLORS.teal }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  duelCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 10,
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'space-between',
  },
  duelCardFill: {
    flex: 1,
  },
  duelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  playerColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '46%',
    paddingHorizontal: 4,
  },
  glassGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    minHeight: 116,
    marginBottom: 4,
  },
  glassBtn: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumber: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    lineHeight: 46,
    minHeight: 46,
    textAlign: 'center',
  },
  playerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 2,
    width: '100%',
    paddingHorizontal: 2,
  },
  playerLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
    maxWidth: '100%',
  },
  vsColumn: {
    width: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 44,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  duelBarWrap: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  barContainer: {
    height: 12,
    width: '100%',
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  barSegment: { height: '100%' },
});

export default Hydration;
