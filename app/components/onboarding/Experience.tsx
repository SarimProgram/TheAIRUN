import React, { useEffect, useRef } from 'react';
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
import { ChevronRight, Target, Coins, Gift, Sparkles, CheckCircle2 } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const COLORS = {
  brand: '#FF6B6B',
  white: '#FFFFFF',
  black: '#1A1A1A',
  muted: 'rgba(255, 255, 255, 0.7)',
  glass: 'rgba(255, 255, 255, 0.12)',
};

const STEPS = [
  {
    title: 'Work out & Deficit',
    desc: 'Stay active and hit your daily calorie goals.',
    icon: Target
  },
  {
    title: 'Points are earned',
    desc: 'Every successful day adds to your point total.',
    icon: Coins
  },
  {
    title: 'Partner sets rewards',
    desc: 'Your partner chooses rewards that motivate you.',
    icon: Gift
  },
  {
    title: 'You unlock them',
    desc: 'Trade your hard-earned points for real rewards.',
    icon: Sparkles
  },
];

export default function MarketplaceHowItWorks({ onContinue }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const stepAnims = useRef(STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
    ]).start();

    // Sequence the steps appearing
    const animations = stepAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        delay: 300 + (i * 150),
        useNativeDriver: true
      })
    );
    Animated.parallel(animations).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Dynamic Background Pattern */}
      <View style={styles.bgPattern} pointerEvents="none">
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.badge}>THE SYSTEM</Text>
            <Text style={styles.title}>How it Works</Text>
            <Text style={styles.subtitle}>
              Consistency is your currency. Here is the magic behind the rewards.
            </Text>
          </View>

          {/* Timeline Steps */}
          <View style={styles.timelineContainer}>
            {/* The Connecting Line */}
            <View style={styles.verticalLine} />

            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.stepRow,
                    {
                      opacity: stepAnims[index],
                      transform: [{
                        translateX: stepAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0]
                        })
                      }]
                    }
                  ]}
                >
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <Icon color={COLORS.brand} size={22} strokeWidth={2.5} />
                    </View>
                    <View style={styles.dot} />
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Bottom Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.ctaButton}
              onPress={onContinue}
            >
              <Text style={styles.buttonText}>Get Started</Text>
              <View style={styles.arrowBox}>
                <ChevronRight color={COLORS.brand} size={24} strokeWidth={3} />
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.brand,
  },
  bgPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.1,
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.white,
    top: -50,
    left: -100,
  },
  circle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.white,
    bottom: 50,
    right: -80,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
  },
  header: {
    marginBottom: 40,
  },
  badge: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    opacity: 0.8,
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 12,
    lineHeight: 26,
    fontWeight: '500',
  },
  timelineContainer: {
    flex: 1,
    marginBottom: 40,
  },
  verticalLine: {
    position: 'absolute',
    left: 20,
    top: 30,
    bottom: 30,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 42,
    alignItems: 'center',
    marginRight: 20,
    zIndex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginTop: 8,
    opacity: 0.8,
  },
  textContainer: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 15,
    color: COLORS.white,
    opacity: 0.8,
    lineHeight: 22,
    fontWeight: '500',
  },
  footer: {
    marginTop: 'auto',
  },
  ctaButton: {
    backgroundColor: COLORS.white,
    height: 72,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingLeft: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.brand,
    textAlign: 'left',
  },
  arrowBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
