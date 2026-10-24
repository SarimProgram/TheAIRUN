/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Scale,
  Utensils,
  DollarSign,
  Users,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWager } from '../../hooks/useWager';

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  coralBorder: '#FFDCDC',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  surface: '#F8F9FA',
  line: '#EFEEF3',
};

const PENALTIES = [
  { id: 'chore', label: 'Cleaning duty', hint: 'Chores on you', icon: Scale },
  { id: 'dinner', label: 'Buy dinner', hint: 'Treat your partner', icon: Utensils },
  { id: 'fine', label: '$5 fund', hint: 'Into the pot', icon: DollarSign },
  { id: 'partner', label: 'Partner decides', hint: 'They pick the stakes', icon: Users },
];

export default function PenaltyWagerScreen({ onContinue, onBack, joinedWithCode = false }: any) {
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const { wager, loading } = useWager();
  const showExistingWager = joinedWithCode && !!wager;
  const canContinue = showExistingWager || !!selected;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FEF9F9']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.topNav}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <ChevronLeft color={COLORS.black} size={22} />
            </TouchableOpacity>
          </View>

          <Animated.View
            style={[
              styles.header,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.miniTag}>
              <Scale size={13} color={COLORS.coral} />
              <Text style={styles.miniTagText}>
                {showExistingWager ? 'SHARED WAGER' : 'WEEKLY STAKES'}
              </Text>
            </View>
            <Text style={styles.title}>
              {showExistingWager ? 'Your wager\nis set' : 'Pick a penalty'}
            </Text>
            <Text style={styles.subtitle}>
              {showExistingWager
                ? `${wager?.partnerName || 'Your partner'} already chose this week's stakes.`
                : 'If either of you misses the weekly run goal.'}
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.mainArea,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {joinedWithCode && loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.coral} size="large" />
              </View>
            ) : showExistingWager ? (
              <View style={styles.existingCard}>
                <Text style={styles.existingTitle}>{wager?.title}</Text>
                <View style={styles.existingMeta}>
                  <Text style={styles.existingMetaLabel}>With</Text>
                  <Text style={styles.existingMetaValue}>{wager?.partnerName}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.optionList}>
                {PENALTIES.map((item) => {
                  const isSelected = selected === item.id;
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => setSelected(item.id)}
                      style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    >
                      <View style={[styles.iconTile, isSelected && styles.iconTileSelected]}>
                        <Icon
                          color={isSelected ? COLORS.white : COLORS.coral}
                          size={20}
                          strokeWidth={2.4}
                        />
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                          {item.label}
                        </Text>
                        <Text style={styles.optionHint}>{item.hint}</Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>

          <Animated.View
            style={[
              styles.footer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onContinue(showExistingWager ? wager?.title || null : selected)}
              style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
              disabled={joinedWithCode ? loading || !canContinue : !selected}
            >
              <LinearGradient
                colors={canContinue ? [COLORS.coral, COLORS.coralDark] : ['#E5E7EB', '#D1D5DB']}
                style={styles.primaryBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryBtnText}>
                  {showExistingWager ? 'Continue' : 'Lock it in'}
                </Text>
                <View style={[styles.btnArrow, !canContinue && styles.btnArrowDisabled]}>
                  <ChevronRight color={canContinue ? COLORS.coral : '#9CA3AF'} size={18} strokeWidth={3} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {!showExistingWager && (
              <TouchableOpacity
                style={styles.skipBtn}
                activeOpacity={0.7}
                onPress={() => onContinue(null)}
              >
                <Text style={styles.skipBtnText}>I'll decide later</Text>
              </TouchableOpacity>
            )}

            {!showExistingWager && (
              <View style={styles.footerTip}>
                <View style={styles.footerShield}>
                  <ShieldCheck color={COLORS.coral} size={14} />
                </View>
                <Text style={styles.footerTipText}>You can change this anytime</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },

  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    marginBottom: 32,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 34,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },

  mainArea: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },

  optionList: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  optionRowSelected: {
    backgroundColor: COLORS.coralLight,
    shadowColor: COLORS.coral,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconTileSelected: {
    backgroundColor: COLORS.coral,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  optionLabelSelected: {
    color: COLORS.coral,
  },
  optionHint: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.coral,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.coral,
  },

  existingCard: {
    backgroundColor: COLORS.coralLight,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  existingTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  existingMeta: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.coralBorder,
    gap: 4,
  },
  existingMetaLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  existingMetaValue: {
    fontSize: 17,
    color: COLORS.black,
    fontWeight: '800',
  },

  footer: {
    paddingTop: 24,
    gap: 10,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
    paddingRight: 8,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  btnArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnArrowDisabled: {
    backgroundColor: '#F3F4F6',
  },
  skipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  skipBtnText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  footerTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F1F5',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 4,
  },
  footerShield: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerTipText: {
    fontSize: 12,
    color: COLORS.black,
    fontWeight: '600',
  },
});
