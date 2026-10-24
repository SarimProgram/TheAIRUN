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
} from 'react-native';
import { ChevronLeft, ArrowRight, Sun, Sunset, Moon, Clock, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

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

const OPTIONS = [
  { id: 'morning', label: 'Morning', icon: Sun },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset },
  { id: 'evening', label: 'Evening', icon: Moon },
] as const;

type PreferredTimeValue = typeof OPTIONS[number]['id'];

type Props = {
  onContinue: (value: PreferredTimeValue) => void;
  onBack: () => void;
  initialValue?: PreferredTimeValue;
};

export default function PreferredTime({ onContinue, onBack, initialValue = 'morning' }: Props) {
  const [selected, setSelected] = useState<PreferredTimeValue>(initialValue);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const staggerAnims = useRef(OPTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.stagger(80, staggerAnims.map((anim) =>
      Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true })
    )).start();
  }, [fadeAnim, slideAnim, staggerAnims]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Animated.View
            style={[
              styles.topSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.badge}>
              <Clock color={COLORS.coral} size={14} strokeWidth={2.5} />
              <Text style={styles.badgeText}>SCHEDULE</Text>
            </View>
            <Text style={styles.title}>
              Preferred <Text style={{ color: COLORS.coral }}>time?</Text>
            </Text>
            <Text style={styles.subtitle}>When do you usually like to train?</Text>
          </Animated.View>

          <View style={styles.optionsArea}>
            <View style={styles.optionsList}>
              {OPTIONS.map((item, index) => {
                const isSelected = selected === item.id;
                const Icon = item.icon;

                return (
                  <Animated.View
                    key={item.id}
                    style={{
                      opacity: staggerAnims[index],
                      transform: [{
                        translateY: staggerAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      }],
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setSelected(item.id)}
                      activeOpacity={0.85}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    >
                      <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
                        <Icon
                          color={isSelected ? COLORS.white : COLORS.coral}
                          size={24}
                          strokeWidth={2.2}
                        />
                      </View>

                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                        {item.label}
                      </Text>

                      <View style={[styles.radio, isSelected && styles.radioActive]}>
                        {isSelected && <Check size={15} color={COLORS.white} strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.mainButton}
            onPress={() => onContinue(selected)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.coral, COLORS.coralDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Continue</Text>
              <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  topSection: {
    paddingTop: 8,
    marginBottom: 40,
  },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.8,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 40,
    letterSpacing: -1.2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: '500',
    maxWidth: 300,
  },
  optionsArea: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  optionsList: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#ECECEC',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardSelected: {
    backgroundColor: COLORS.selection,
    borderColor: COLORS.coral,
    shadowColor: COLORS.coral,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: COLORS.coral,
  },
  optionTitle: {
    flex: 1,
    marginLeft: 18,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  optionTitleSelected: {
    color: COLORS.coral,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    backgroundColor: COLORS.coral,
    borderColor: COLORS.coral,
  },
  footer: {
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
  },
  mainButton: {
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
