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
import { Target, Scale, Zap, Activity, ChevronLeft, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width } = Dimensions.get('window');

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

interface GoalOption {
  id: string;
  title: string;
  icon: any;
}

const GOALS: GoalOption[] = [
  { id: 'weightloss', title: 'Weight loss', icon: Scale },
  { id: 'running', title: 'Running', icon: Zap },
  { id: 'both', title: 'Weight loss while preparing for a run', icon: Activity },
];

interface Props {
  onContinue: (goal: string | null) => void;
  onBack: () => void;
  gender?: string | null;
}

export default function Phase5Dummy({ onContinue, onBack, gender }: Props) {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const staggerAnims = useRef(GOALS.map(() => new Animated.Value(0))).current;
  const mascotSource =
    gender?.trim().toLowerCase() === 'female'
      ? require('../../assets/pink.png')
      : require('../../assets/Gree.png');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.stagger(100, staggerAnims.map(anim =>
      Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true })
    )).start();
  }, []);

  const Option = ({ goal, index }: { goal: GoalOption; index: number }) => {
    const isSelected = selectedGoal === goal.id;
    const Icon = goal.icon;

    return (
      <Animated.View style={{
        opacity: staggerAnims[index],
        transform: [{ translateY: staggerAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
      }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedGoal(goal.id)}
          style={[
            styles.card,
            isSelected && styles.selectedCard
          ]}
        >
          <View style={[styles.iconBox, isSelected && styles.selectedIconBox]}>
            <Icon color={isSelected ? COLORS.coral : COLORS.muted} size={22} strokeWidth={2.5} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, isSelected && styles.selectedCardTitle]}>
              {goal.title}
            </Text>
          </View>
          <View style={[styles.radio, isSelected && styles.radioActive]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
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

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.main}>
            <Animated.View style={[
              styles.topSection,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}>
              <View style={styles.headerRow}>
                <View style={styles.headerTextSide}>
                  <View style={styles.badge}>
                    <Target color={COLORS.coral} size={14} strokeWidth={2.5} />
                    <Text style={styles.badgeText}>YOUR OBJECTIVE</Text>
                  </View>
                  <Text style={styles.title}>Primary{"\n"}<Text style={{ color: COLORS.coral }}>Goal?</Text></Text>
                </View>

                <View style={[
                  styles.mascotContainer,
                ]}>
                  <View style={styles.mascotCircle} />
                  <Image
                    source={mascotSource}
                    style={styles.mascotImage}
                    contentFit="contain"
                  />
                </View>
              </View>
              <Text style={styles.subtitle}>Helping us customize your training path to what matters most.</Text>
            </Animated.View>

            <View style={styles.optionsContainer}>
              {GOALS.map((goal, index) => (
                <Option key={goal.id} goal={goal} index={index} />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.mainButton, !selectedGoal && styles.buttonDisabled]}
            onPress={() => onContinue(selectedGoal)}
            disabled={!selectedGoal}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={!selectedGoal ? ['#E5E7EB', '#E5E7EB'] : [COLORS.coral, COLORS.coralDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Continue</Text>
              <ArrowRight color="white" size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
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
    paddingTop: 10,
    paddingBottom: 20,
  },
  topSection: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTextSide: {
    flex: 1,
  },
  mascotContainer: {
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotCircle: {
    position: 'absolute',
    width: '85%',
    height: '85%',
    borderRadius: 65,
    backgroundColor: '#FFF0F0',
    zIndex: -1,
  },
  mascotImage: {
    width: '120%',
    height: '120%',
    marginTop: 0,
  },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: '500',
  },
  optionsContainer: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    backgroundColor: COLORS.selection,
    borderColor: COLORS.coral,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  selectedIconBox: {
    backgroundColor: COLORS.white,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  selectedCardTitle: {
    color: COLORS.black,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: COLORS.coral,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.coral,
  },
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
  },
  mainButton: {
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
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
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
