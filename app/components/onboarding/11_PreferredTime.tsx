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
  ScrollView,
} from 'react-native';
import { ChevronLeft, ArrowRight, Sun, Sunset, Moon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const COLORS = {
  brand: '#FF6B6B',
  ink: '#0F172A',
  white: '#FFFFFF',
  muted: '#94A3B8',
  bg: '#FFFFFF',
  border: '#F1F5F9',
  soft: '#F8FAFC',
};

const OPTIONS = [
  { 
    id: 'morning', 
    label: 'Morning', 
    sub: 'Early starts & fresh air', 
    icon: Sun, 
    color: COLORS.brand,
    bgColor: '#FFF0F0'
  } as const,
  { 
    id: 'afternoon', 
    label: 'Afternoon', 
    sub: 'Mid-day energy & focus', 
    icon: Sunset, 
    color: COLORS.brand,
    bgColor: '#FFF0F0'
  } as const,
  { 
    id: 'evening', 
    label: 'Evening', 
    sub: 'Wind down with a run', 
    icon: Moon, 
    color: COLORS.brand,
    bgColor: '#FFF0F0'
  } as const,
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
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={[styles.header, useCompactLayout && styles.headerCompact]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, useCompactLayout && styles.backBtnCompact]}
          activeOpacity={0.7}
        >
          <View style={[styles.backCircle, useCompactLayout && styles.backCircleCompact]}>
            <ChevronLeft color={COLORS.ink} size={24} />
          </View>
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, useCompactLayout && styles.scrollContentCompact]}
        >
          <View style={[styles.textGroup, useCompactLayout && styles.textGroupCompact]}>
            <Text style={[styles.preTitle, useCompactLayout && styles.preTitleCompact]}>YOUR ROUTINE</Text>
            <Text style={[styles.mainTitle, useCompactLayout && styles.mainTitleCompact]}>When do you{"\n"}<Text style={{ color: COLORS.brand }}>move best?</Text></Text>
            <Text style={[styles.subtitle, useCompactLayout && styles.subtitleCompact]}>We'll schedule your coaching sessions at a time that fits your lifestyle.</Text>
          </View>

          <View style={[styles.optionsList, useCompactLayout && styles.optionsListCompact]}>
            {OPTIONS.map((item) => {
              const isSelected = selected === item.id;
              const Icon = item.icon;
              
              return (
                <TouchableOpacity 
                  key={item.id}
                  onPress={() => setSelected(item.id)}
                  activeOpacity={0.9}
                  style={[
                    styles.choiceCard,
                    useCompactLayout && styles.choiceCardCompact,
                    isSelected && styles.choiceCardActive
                  ]}
                >
                  <View style={[styles.iconBox, useCompactLayout && styles.iconBoxCompact, { backgroundColor: item.bgColor }]}>
                    <Icon color={item.color} size={useCompactLayout ? 21 : 24} strokeWidth={2.5} />
                  </View>
                  
                  <View style={[styles.cardContent, useCompactLayout && styles.cardContentCompact]}>
                    <Text style={[styles.cardLabel, useCompactLayout && styles.cardLabelCompact, isSelected && { color: COLORS.ink }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.cardSub, useCompactLayout && styles.cardSubCompact]}>
                      {item.sub}
                    </Text>
                  </View>

                  <View style={[styles.radio, useCompactLayout && styles.radioCompact, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
          <TouchableOpacity 
            style={[styles.cta, useCompactLayout && styles.ctaCompact]} 
            onPress={() => onContinue(selected)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B6B', '#F43F5E']}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[styles.ctaText, useCompactLayout && styles.ctaTextCompact]}>Continue</Text>
              <ArrowRight color={COLORS.white} size={useCompactLayout ? 18 : 20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 54,
    justifyContent: 'center',
  },
  headerCompact: {
    paddingTop: 0,
    height: 42,
  },
  backBtn: {
    width: 44,
    height: 44,
  },
  backBtnCompact: {
    width: 38,
    height: 38,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 15,
    paddingBottom: 20,
  },
  scrollContentCompact: {
    paddingHorizontal: 30,
    paddingTop: 4,
    paddingBottom: 8,
  },
  textGroup: {
    marginBottom: 35,
  },
  textGroupCompact: {
    marginBottom: 18,
  },
  preTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  preTitleCompact: {
    fontSize: 11,
    marginBottom: 6,
  },
  mainTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -2,
    lineHeight: 52,
    marginBottom: 12,
  },
  mainTitleCompact: {
    fontSize: 36,
    lineHeight: 39,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    fontWeight: '500',
    lineHeight: 24,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 19,
  },
  optionsList: {
    gap: 12,
  },
  optionsListCompact: {
    gap: 8,
  },
  choiceCard: {
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.soft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  choiceCardCompact: {
    height: 72,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  choiceCardActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxCompact: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardContentCompact: {
    marginLeft: 12,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 2,
  },
  cardLabelCompact: {
    fontSize: 16,
  },
  cardSub: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: '500',
  },
  cardSubCompact: {
    fontSize: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  radioActive: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.brand,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.white,
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingTop: 10,
  },
  footerCompact: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 16,
  },
  cta: {
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  ctaCompact: {
    height: 56,
    borderRadius: 20,
  },
  ctaGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ctaTextCompact: {
    fontSize: 16,
  },
});
