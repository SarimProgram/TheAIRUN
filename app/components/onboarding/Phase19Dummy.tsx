import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { 
  PersonStanding, 
  Zap, 
  Apple, 
  Layers, 
  ChevronRight 
} from 'lucide-react-native';

const COLORS = {
  bg: '#FFFFFF',
  coral: '#FF6B6B',
  textMain: '#1A1A1A',
  textSub: '#7F8C8D',
  cardBg: '#F8F9FA',
  border: '#F0F0F0',
  selectedBg: '#FFF5F5',
  white: '#FFFFFF',
};

const OPTIONS = [
  { 
    id: 'walking', 
    label: 'Mostly walking & light exercise', 
    icon: PersonStanding 
  },
  { 
    id: 'running', 
    label: 'Mostly running', 
    icon: Zap 
  },
  { 
    id: 'food', 
    label: 'Mostly food / calorie control', 
    icon: Apple 
  },
  { 
    id: 'mix', 
    label: 'A mix of all three', 
    icon: Layers 
  },
];

export default function SustainabilityApproach({ onContinue }: any) {
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.centeredWrapper}>
          <Animated.View style={[
            styles.content, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            
            {/* Header Section */}
            <View style={styles.header}>
              <Text style={styles.stepIndicator}>STEP 10 OF 12</Text>
              <Text style={styles.title}>Sustainable Path</Text>
              <Text style={styles.subtitle}>
                Which approach feels most sustainable for you?
              </Text>
            </View>

            {/* Options List */}
            <View style={styles.optionsContainer}>
              {OPTIONS.map((item) => {
                const isSelected = selected === item.id;
                const Icon = item.icon;
                
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => setSelected(item.id)}
                    style={[
                      styles.card,
                      isSelected && styles.cardSelected
                    ]}
                  >
                    <View style={styles.leftContent}>
                      <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                        <Icon 
                          color={isSelected ? COLORS.coral : COLORS.textSub} 
                          size={22} 
                          strokeWidth={2.5} 
                        />
                      </View>
                      <Text style={[styles.label, isSelected && styles.labelSelected]}>
                        {item.label}
                      </Text>
                    </View>

                    {/* Radio Indicator */}
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Footer Action */}
            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onContinue(selected)}
                style={[
                  styles.button,
                  !selected && styles.buttonDisabled
                ]}
                disabled={!selected}
              >
                <Text style={styles.buttonText}>Continue</Text>
                <View style={styles.iconCircle}>
                  <ChevronRight color={COLORS.white} size={22} strokeWidth={3} />
                </View>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safeArea: {
    flex: 1,
  },
  centeredWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  stepIndicator: {
    color: COLORS.coral,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.textMain,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSub,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  optionsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    padding: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBg,
  },
  cardSelected: {
    backgroundColor: COLORS.selectedBg,
    borderColor: COLORS.coral,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBoxSelected: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.selectedBg,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    flex: 1,
  },
  labelSelected: {
    color: COLORS.coral,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioOuterSelected: {
    borderColor: COLORS.coral,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.coral,
  },
  footer: {
    marginTop: 40,
  },
  button: {
    backgroundColor: COLORS.coral,
    height: 64,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingLeft: 32,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});