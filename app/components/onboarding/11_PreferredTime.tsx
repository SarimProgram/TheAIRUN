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

const { height } = Dimensions.get('window');

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
    color: '#FF6B6B',
    bgColor: '#FFF0F0'
  } as const,
  { 
    id: 'afternoon', 
    label: 'Afternoon', 
    sub: 'Mid-day energy & focus', 
    icon: Sunset, 
    color: '#FFB800',
    bgColor: '#FFF8E6'
  } as const,
  { 
    id: 'evening', 
    label: 'Evening', 
    sub: 'Wind down with a run', 
    icon: Moon, 
    color: '#8B5CF6',
    bgColor: '#F5F3FF'
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <View style={styles.backCircle}>
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
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.textGroup}>
            <Text style={styles.preTitle}>YOUR ROUTINE</Text>
            <Text style={styles.mainTitle}>When do you{"\n"}<Text style={{ color: COLORS.brand }}>move best?</Text></Text>
            <Text style={styles.subtitle}>We'll schedule your coaching sessions at a time that fits your lifestyle.</Text>
          </View>

          <View style={styles.optionsList}>
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
                    isSelected && styles.choiceCardActive
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                    <Icon color={item.color} size={24} strokeWidth={2.5} />
                  </View>
                  
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardLabel, isSelected && { color: COLORS.ink }]}>
                      {item.label}
                    </Text>
                    <Text style={styles.cardSub}>
                      {item.sub}
                    </Text>
                  </View>

                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.cta} 
            onPress={() => onContinue(selected)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B6B', '#F43F5E']}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.ctaText}>Continue</Text>
              <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
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
    height: 60,
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 15,
    paddingBottom: 20,
  },
  textGroup: {
    marginBottom: 35,
  },
  preTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -2,
    lineHeight: 52,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    fontWeight: '500',
    lineHeight: 24,
  },
  optionsList: {
    gap: 12,
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
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: '500',
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
  cta: {
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
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
});
