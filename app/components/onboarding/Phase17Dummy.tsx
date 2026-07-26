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
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Scale,
  Utensils,
  DollarSign,
  Users,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldAlert
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useWager } from '../../hooks/useWager';

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF0F0',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  bg: '#FFFFFF',
};

const PENALTIES = [
  { id: 'chore', label: 'Cleaning Duty', icon: Scale },
  { id: 'dinner', label: 'Buy Dinner', icon: Utensils },
  { id: 'fine', label: '$5 Fund', icon: DollarSign },
  { id: 'partner', label: 'Partner Decides', icon: Users },
];

export default function PenaltyWagerScreen({ onContinue, onBack, joinedWithCode = false }: any) {
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const { wager, loading } = useWager();
  const showExistingWager = joinedWithCode && !!wager;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true })
    ]).start();
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>

        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <View style={styles.main}>
          {/* Title Section back at top */}
          <Animated.View style={[
            styles.topSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
         
            <Text style={styles.title}>
              {showExistingWager ? 'Weekly ' : 'Penalty '}<Text style={{ color: COLORS.coral }}>Wager?</Text>
            </Text>
            <Text style={styles.subtitle}>
              {showExistingWager
                ? `This is the wager ${wager?.partnerName || 'your partner'} already set for this week.`
                : 'For your first weekly run goal, what happens if you or partner miss it?'}
            </Text>
          </Animated.View>

          <Animated.View style={[
            styles.mainArea,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            {joinedWithCode && loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={COLORS.coral} size="large" />
              </View>
            ) : showExistingWager ? (
              <View style={styles.existingWagerCard}>
                <View style={styles.existingWagerBadge}>
                  <ShieldAlert size={16} color={COLORS.coral} />
                  <Text style={styles.existingWagerBadgeText}>{wager?.status || 'ACTIVE'}</Text>
                </View>
                <Text style={styles.existingWagerTitle}>{wager?.title}</Text>
                <Text style={styles.existingWagerCopy}>
                  This week already has a shared wager in place, so you can continue without creating another one.
                </Text>
                <View style={styles.existingWagerMeta}>
                  <Text style={styles.existingWagerMetaLabel}>Partner</Text>
                  <Text style={styles.existingWagerMetaValue}>{wager?.partnerName}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.grid}>
                {PENALTIES.map((item) => {
                  const isSelected = selected === item.id;
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.9}
                      onPress={() => handleSelect(item.id)}
                      style={[styles.card, isSelected && styles.cardSelected]}
                    >
                      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                        <Icon color={isSelected ? COLORS.white : COLORS.coral} size={24} strokeWidth={2.5} />
                      </View>
                      <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>{item.label}</Text>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Check color={COLORS.white} size={10} strokeWidth={4} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onContinue(showExistingWager ? wager?.title || null : selected)}
            style={styles.mainButton}
            disabled={joinedWithCode ? loading || (!showExistingWager && !selected) : !selected}
          >
            <LinearGradient
              colors={showExistingWager || selected ? [COLORS.coral, COLORS.coralDark] : ['#E5E7EB', '#D1D5DB']}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>{showExistingWager ? 'Continue with This Wager' : 'Confirm & Continue'}</Text>
              <ChevronRight color="white" size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>

          {!showExistingWager && (
            <TouchableOpacity style={styles.skipBtn} onPress={() => onContinue(null)}>
              <Text style={styles.skipBtnText}>I'll decide this later</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 5,
  },
  topSection: {
    marginBottom: 20,
  },
  badge: {
    backgroundColor: COLORS.coralLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 38,
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 20,
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60, // Shift grid up
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  existingWagerCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FFD9D9',
    gap: 12,
  },
  existingWagerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  existingWagerBadgeText: {
    color: COLORS.coral,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  existingWagerTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    color: COLORS.black,
  },
  existingWagerCopy: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
    fontWeight: '500',
  },
  existingWagerMeta: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#FBCACA',
  },
  existingWagerMetaLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  existingWagerMetaValue: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '800',
  },
  card: {
    width: (width - 68) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    height: 120,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardSelected: {
    borderColor: COLORS.coral,
    backgroundColor: '#FFF5F5',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBoxSelected: {
    backgroundColor: COLORS.coral,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.black,
    textAlign: 'center',
  },
  cardLabelSelected: {
    color: COLORS.coral,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.coral,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 70 : 80, // Shift footer button up
    alignItems: 'center',
  },
  mainButton: {
    width: '100%',
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  skipBtn: {
    marginTop: 15,
    padding: 10,
  },
  skipBtnText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
