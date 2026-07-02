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
} from 'react-native';
import { ChevronLeft, ArrowRight, Calendar, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  cardBg: '#F9FAFB',
  selection: '#FFF0F0',
};

const DAYS = [
  { id: 0, label: 'Monday', short: 'Mon' },
  { id: 1, label: 'Tuesday', short: 'Tue' },
  { id: 2, label: 'Wednesday', short: 'Wed' },
  { id: 3, label: 'Thursday', short: 'Thu' },
  { id: 4, label: 'Friday', short: 'Fri' },
  { id: 5, label: 'Saturday', short: 'Sat' },
  { id: 6, label: 'Sunday', short: 'Sun' },
];

type Props = {
  onContinue: (days: number[]) => void;
  onBack: () => void;
  initialSelectedDays?: number[];
};

export default function AvailableDays({ onContinue, onBack, initialSelectedDays = [0, 2, 4] }: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelectedDays);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const staggerAnims = useRef(DAYS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();

    Animated.stagger(50, staggerAnims.map(anim =>
      Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true })
    )).start();
  }, []);

  useEffect(() => {
    const normalized = Array.from(new Set(initialSelectedDays))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort((a, b) => a - b);
    if (normalized.length >= 3) {
      setSelected(normalized);
    }
  }, [initialSelectedDays]);

  const toggleDay = (id: number) => {
    setSelected(prev => {
      const isSelected = prev.includes(id);
      if (isSelected && prev.length <= 3) return prev;
      return isSelected ? prev.filter(item => item !== id) : [...prev, id].sort((a, b) => a - b);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <View style={styles.main}>
          <Animated.View style={[
            styles.topSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            <View style={styles.badge}>
              <Calendar color={COLORS.coral} size={14} strokeWidth={2.5} />
              <Text style={styles.badgeText}>SCHEDULE</Text>
            </View>
            <Text style={styles.title}>
              Available <Text style={{ color: COLORS.coral }}>Days?</Text>
            </Text>
            <Text style={styles.subtitle}>
              Which days are you ready to commit to your training?
            </Text>
          </Animated.View>

          <View style={styles.daysGrid}>
            {DAYS.map((day, index) => {
              const isSelected = selected.includes(day.id);
              return (
                <Animated.View
                  key={day.id}
                  style={{
                    opacity: staggerAnims[index],
                    transform: [{ translateY: staggerAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => toggleDay(day.id)}
                    style={[
                      styles.dayCard,
                      isSelected && styles.dayCardSelected
                    ]}
                  >
                    <View style={styles.dayContent}>
                      <Text style={[styles.dayFullText, isSelected && styles.dayTextSelected]}>
                        {day.label}
                      </Text>
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Check color="white" size={14} strokeWidth={4} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
          <View style={styles.infoNote}>
            <Text style={styles.infoText}>A minimum of 3 days per week is required for an effective training plan.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.mainButton, selected.length < 3 && styles.buttonDisabled]}
            onPress={() => onContinue(selected)}
            disabled={selected.length < 3}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={selected.length < 3 ? ['#E5E7EB', '#E5E7EB'] : [COLORS.coral, COLORS.coralDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Confirm Schedule</Text>
              <ArrowRight color="white" size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  main: { flex: 1, paddingHorizontal: 28, paddingTop: 5 },
  topSection: { marginBottom: 8 },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: COLORS.coral, letterSpacing: 1.5 },
  title: { fontSize: 32, fontWeight: '900', color: COLORS.black, lineHeight: 38, letterSpacing: -1, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.muted, lineHeight: 20, fontWeight: '500' },

  daysGrid: {
    gap: 6,
  },
  dayCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayCardSelected: {
    backgroundColor: COLORS.selection,
    borderColor: COLORS.coral,
  },
  dayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayFullText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.black,
  },
  dayTextSelected: {
    color: COLORS.coral,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.coral,
    borderColor: COLORS.coral,
  },

  infoNote: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
    textAlign: 'center',
  },

  footer: { paddingHorizontal: 28, paddingBottom: Platform.OS === 'ios' ? 20 : 30 },
  mainButton: {
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  gradientButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
});
