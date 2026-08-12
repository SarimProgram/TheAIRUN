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
  Image,
} from 'react-native';
import { ArrowRight, Zap, Coins, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const height = Math.min(windowHeight, 800);

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  glass: 'rgba(255, 255, 255, 0.8)',
};

const STAGES = [
  {
    id: '1',
    title: 'Complete your runs',
    desc: 'Finish workouts and stay on track to earn points.',
    icon: Zap,
    image: require('../../assets/Comp1.png'),
    align: 'left',
  },
  {
    id: '2',
    title: 'Build your balance',
    desc: 'Your points add up in a shared reward balance.',
    icon: Coins,
    image: require('../../assets/comp2.png'),
    align: 'right',
  },
  {
    id: '3',
    title: 'Choose your reward',
    desc: 'Use your balance on treats you’ll both enjoy.',
    icon: Gift,
    image: require('../../assets/comp3.png'),
    align: 'left',
  },
];

export default function MarketplaceHowItWorks({ onContinue }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  // SVG Path for the curved dotted line
  // This path creates a subtle S-curve journey through the steps
  const pathData = `
    M ${width * 0.25} 0 
    C ${width * 0.25} 100, ${width * 0.75} 150, ${width * 0.75} 250
    C ${width * 0.75} 350, ${width * 0.25} 400, ${width * 0.25} 500
    C ${width * 0.25} 600, ${width * 0.75} 650, ${width * 0.75} 750
  `;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FFF5F5']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={[styles.flex, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.mainTitle}>
              How rewards{"\n"}
              <Text style={{ color: COLORS.coral }}>work for you.</Text>
            </Text>
          </View>

          {/* Vertical Step List */}
          <View style={styles.stepsContainer}>
            {/* Background Dotted Curve - Extended for scrollable area */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg height="100%" width="100%">
                <Path
                  d={`
                    M ${width * 0.09} 30 
                    C ${width * 0.09} 130, ${width * 0.91} 130, ${width * 0.91} 230
                    C ${width * 0.91} 330, ${width * 0.09} 430, ${width * 0.09} 530
                    C ${width * 0.09} 630, ${width * 0.91} 680, ${width * 0.91} 780
                  `}
                  fill="none"
                  stroke={COLORS.coral}
                  strokeWidth="2"
                  strokeDasharray="6, 8"
                  opacity="0.3"
                />
              </Svg>
            </View>

            {STAGES.map((stage, index) => {
              const isLeft = stage.align === 'left';
              return (
                <View
                  key={stage.id}
                  style={[
                    styles.stepRow,
                    { flexDirection: isLeft ? 'row' : 'row-reverse' }
                  ]}
                >
                  {/* Step Icon */}
                  <View style={styles.iconWrapper}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.mainStepNumber}>{stage.id}</Text>
                    </View>
                  </View>

                  {/* Content Card */}
                  <View style={[
                    styles.cardWrapper,
                    { alignItems: isLeft ? 'flex-start' : 'flex-end' }
                  ]}>
                    <View style={[
                      styles.card,
                      isLeft ? styles.cardLeft : styles.cardRight
                    ]}>
                      <Text style={[styles.cardTitle, { textAlign: isLeft ? 'left' : 'right' }]}>
                        {stage.title}
                      </Text>
                      <Text style={[styles.cardDesc, { textAlign: isLeft ? 'left' : 'right' }]}>
                        {stage.desc}
                      </Text>

                      {stage.image && (
                        <View style={styles.imageReveal}>
                          <Image
                            source={stage.image}
                            style={styles.cardImage}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Footer - Now at the end of scroll content */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.mainButton}
              onPress={onContinue}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.coral, COLORS.coralDark]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Start earning</Text>
                <ArrowRight color="white" size={20} strokeWidth={3} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.coralLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  stepsContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 30,
  },
  stepRow: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrapper: {
    width: width * 0.18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  mainStepNumber: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '98%',
  },
  cardLeft: {
    marginLeft: 10,
  },
  cardRight: {
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    lineHeight: 18,
  },
  imageReveal: {
    marginTop: 12,
    height: 140,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    width: '100%',
    marginTop: 20,
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
    justifyContent: 'center',
    gap: 12
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
