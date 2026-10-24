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
import {
  ArrowRight,
  Footprints,
  Users,
  Gift,
  Star,
  Heart,
  Coffee,
  ShoppingBag,
  Headphones,
  Sparkles,
  Plus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Line } from 'react-native-svg';

const { width: windowWidth } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const CARD_WIDTH = Math.min(width * 0.62, 260);
const CARD_WIDTH_WIDE = Math.min(width * 0.68, 280);
const TIMELINE_HEIGHT = 480;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF0F0',
  white: '#FFFFFF',
  navy: '#1A202C',
  muted: '#718096',
  cardBg: '#FFFFFF',
};

const STAGES = [
  {
    id: '01',
    title: 'Complete your activity',
    desc: 'Finish workouts and earn points.',
    icon: Footprints,
  },
  {
    id: '02',
    title: 'Build your balance',
    desc: 'Your points add up in your reward balance.',
    icon: Users,
  },
  {
    id: '03',
    title: 'Choose your reward',
    desc: 'Use your balance on treats you\u2019ll both enjoy.',
    icon: Gift,
  },
];

function StepOneCard() {
  return (
    <View style={styles.mockCard}>
      <Text style={styles.mockLabel}>Great start!</Text>
      <Text style={styles.mockSubLabel}>You earned</Text>
      <View style={styles.pointsRow}>
        <Text style={styles.pointsValue}>+10</Text>
        <Text style={styles.pointsUnit}>points</Text>
        <View style={styles.starBadge}>
          <Star size={17} color={COLORS.coral} fill={COLORS.coral} />
        </View>
      </View>
    </View>
  );
}

function StepTwoCard() {
  return (
    <View style={styles.mockCard}>
      <View style={styles.balanceHeader}>
        <Users size={13} color={COLORS.muted} />
        <Text style={styles.mockSubLabel}>Partner balance</Text>
      </View>
      <View style={styles.balanceRow}>
        <Heart size={16} color={COLORS.coral} fill={COLORS.coral} />
        <Text style={styles.balanceValue}>100</Text>
        <Text style={styles.pointsUnit}>points</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(100 / 700) * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>100/700 points to next reward</Text>
    </View>
  );
}

const REWARDS = [
  { icon: Coffee, points: 150 },
  { icon: ShoppingBag, points: 300 },
  { icon: Headphones, points: 500 },
];

function StepThreeCard() {
  return (
    <View style={[styles.mockCard, styles.mockCardWide]}>
      <Text style={styles.mockSubLabel}>Popular rewards</Text>
      <View style={styles.rewardsRow}>
        {REWARDS.map(({ icon: Icon, points }, index) => (
          <View key={index} style={styles.rewardItem}>
            <View style={styles.rewardIconBox}>
              <Icon size={22} color={COLORS.navy} strokeWidth={2} />
            </View>
            <View style={styles.rewardPrice}>
              <Heart size={9} color={COLORS.white} fill={COLORS.white} />
              <Text style={styles.rewardPriceText}>{points}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const STEP_CARDS = [StepOneCard, StepTwoCard, StepThreeCard];

const PARTICLES = [
  { type: 'plus', top: 6, left: 4, size: 14, opacity: 0.55 },
  { type: 'sparkle', top: 2, right: 18, size: 16, opacity: 0.7 },
  { type: 'x', top: 52, right: -2, size: 12, opacity: 0.45 },
  { type: 'dot', bottom: 28, right: 8, size: 6, opacity: 0.5 },
  { type: 'sparkle', bottom: 10, left: 0, size: 13, opacity: 0.6 },
  { type: 'plus', top: 36, left: -6, size: 11, opacity: 0.4 },
] as const;

function GiftHero() {
  return (
    <View style={styles.heroScene}>
      <View style={styles.heroCore}>
        <View style={styles.heroGlow} />
        <ExpoImage
          source={require('../../assets/bf5ea328-b200-4872-90b4-5932707e2f40.png')}
          style={styles.heroImage}
          contentFit="contain"
          contentPosition="center"
        />
        <View style={styles.heroHeartBadge}>
          <Heart size={11} color={COLORS.white} fill={COLORS.white} />
        </View>
      </View>

      {PARTICLES.map((particle, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              top: 'top' in particle ? particle.top : undefined,
              left: 'left' in particle ? particle.left : undefined,
              right: 'right' in particle ? particle.right : undefined,
              bottom: 'bottom' in particle ? particle.bottom : undefined,
              opacity: particle.opacity,
            },
          ]}
        >
          {particle.type === 'plus' && (
            <Plus size={particle.size} color={COLORS.coral} strokeWidth={3} />
          )}
          {particle.type === 'x' && (
            <Text style={[styles.particleX, { fontSize: particle.size }]}>×</Text>
          )}
          {particle.type === 'sparkle' && (
            <Sparkles size={particle.size} color={COLORS.coral} strokeWidth={2.2} />
          )}
          {particle.type === 'dot' && (
            <View style={[styles.particleDot, { width: particle.size, height: particle.size }]} />
          )}
        </View>
      ))}

    </View>
  );
}

export default function MarketplaceHowItWorks({ onContinue }: { onContinue?: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FFF8F8']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <Animated.View
          style={[styles.flex, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Animated.ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.flex}
          >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.mainTitle}>
                Turn your activity{'\n'}
                <Text style={styles.titleAccent}>into rewards.</Text>
              </Text>
              <Text style={styles.subtitle}>
                Stay active, earn points, get treats you'll love.
              </Text>
            </View>
            <GiftHero />
          </View>

          {/* Steps */}
          <View style={styles.stepsContainer}>
            <View style={styles.timelineLine} pointerEvents="none">
              <Svg height={TIMELINE_HEIGHT} width="2">
                <Line
                  x1="1"
                  y1="0"
                  x2="1"
                  y2={TIMELINE_HEIGHT}
                  stroke={COLORS.coral}
                  strokeWidth="2"
                  strokeDasharray="6,8"
                  opacity={0.3}
                />
              </Svg>
            </View>

            {STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const CardComponent = STEP_CARDS[index];
              return (
                <View key={stage.id} style={styles.stepRow}>
                  <View style={styles.iconColumn}>
                    <View style={styles.iconCircle}>
                      <Icon size={22} color={COLORS.white} strokeWidth={2.5} />
                    </View>
                  </View>

                  <View style={styles.stepContent}>
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepNumber}>{stage.id}</Text>
                      <Text style={styles.stepTitle}>{stage.title}</Text>
                      <Text style={styles.stepDesc}>{stage.desc}</Text>
                    </View>

                    <View style={[styles.cardCol, index === 2 && styles.cardColWide]}>
                      <CardComponent />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          </Animated.ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.mainButton}
              onPress={onContinue}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.coral, COLORS.coralDark]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.buttonSide} />
                <Text style={styles.buttonText}>Continue</Text>
                <View style={styles.buttonSide}>
                  <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 40,
    minHeight: 140,
    overflow: 'visible',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
    paddingTop: 4,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.navy,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  titleAccent: {
    color: COLORS.coral,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 19,
    maxWidth: 220,
  },
  heroScene: {
    width: 148,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
    marginRight: -8,
    overflow: 'visible',
  },
  heroCore: {
    width: 136,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    top: '50%',
    left: '50%',
    marginTop: -38,
    marginLeft: -48,
  },
  heroImage: {
    width: 136,
    height: 108,
  },
  heroHeartBadge: {
    position: 'absolute',
    bottom: 4,
    left: 26,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.white,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  particle: {
    position: 'absolute',
    zIndex: 3,
  },
  particleX: {
    color: COLORS.coral,
    fontWeight: '700',
    lineHeight: 14,
  },
  particleDot: {
    borderRadius: 999,
    backgroundColor: COLORS.coral,
  },

  stepsContainer: {
    position: 'relative',
    marginBottom: 36,
    paddingLeft: 2,
  },
  timelineLine: {
    position: 'absolute',
    left: 25,
    top: 28,
    width: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 52,
  },
  iconColumn: {
    width: 52,
    alignItems: 'center',
    paddingTop: 4,
    zIndex: 2,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 16,
  },
  stepTextCol: {
    paddingTop: 2,
    paddingRight: 8,
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.coral,
    marginBottom: 3,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navy,
    marginBottom: 4,
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  stepDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 17,
  },
  cardCol: {
    alignSelf: 'flex-end',
    width: CARD_WIDTH,
    marginRight: -4,
  },
  cardColWide: {
    width: CARD_WIDTH_WIDE,
  },

  mockCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    padding: 18,
    minHeight: 116,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mockCardWide: {
    width: CARD_WIDTH_WIDE,
    minHeight: 130,
  },
  mockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.coral,
    marginBottom: 3,
  },
  mockSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 5,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  pointsValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.navy,
    lineHeight: 30,
  },
  pointsUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 4,
  },
  starBadge: {
    marginLeft: 'auto',
    marginBottom: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginBottom: 12,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.navy,
    lineHeight: 26,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.coralLight,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: COLORS.coral,
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.muted,
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rewardItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  rewardIconBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  rewardPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.coral,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  rewardPriceText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
  },

  footer: {
    width: '100%',
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
  mainButton: {
    height: 54,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
