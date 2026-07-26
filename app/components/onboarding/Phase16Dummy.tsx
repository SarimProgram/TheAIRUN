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
import {
  Coffee,
  Film,
  Gift,
  Heart,
  Trophy,
  ArrowRight,
  Check,
  Sparkles,
  Calendar,
  Smile,
  Zap
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  success: '#2ECC71',
};

const OPTIONS = [
  { id: 'coffee', label: 'Coffee / Treat', icon: Coffee },
  { id: 'movie', label: 'Movie Night', icon: Film },
  { id: 'gift', label: 'Surprise Gift', icon: Gift },
  { id: 'date', label: 'Special Date', icon: Calendar },
  { id: 'heart', label: 'Quality Time', icon: Heart },
  { id: 'trophy', label: 'Bigger Prize', icon: Trophy },
];

export default function PartnerRewardSelection({ onContinue, joinedWithCode = false }: any) {
  const { authFetch } = useAuth();
  const [setupStep, setSetupStep] = useState(1); // 1-3: Setup, 4: Summary
  const [week1Reward, setWeek1Reward] = useState<string | null>(null);
  const [week2Reward, setWeek2Reward] = useState<string | null>(null);
  const [week3Reward, setWeek3Reward] = useState<string | null>(null);
  const [isCommiting, setIsCommiting] = useState(false);
  const [partnerName, setPartnerName] = useState('your partner');
  const [partnerHasOnboardingRewards, setPartnerHasOnboardingRewards] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const itemFades = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    animateIn();
    if (setupStep === 4) {
      Animated.stagger(200, itemFades.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true })
      )).start();
    }
  }, [setupStep, isCommiting]);

  useEffect(() => {
    if (!joinedWithCode) return;

    let mounted = true;
    const loadPartnerState = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/partner`);
        const data = await res.json();
        if (!mounted) return;
        setPartnerName(data?.partner?.displayName || 'your partner');
        setPartnerHasOnboardingRewards(!!data?.partnerHasOnboardingRewards);
      } catch {
        if (!mounted) return;
        setPartnerName('your partner');
        setPartnerHasOnboardingRewards(false);
      }
    };

    loadPartnerState();
    return () => {
      mounted = false;
    };
  }, [joinedWithCode, authFetch]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true })
    ]).start();
  };

  const handleRewardSelect = (id: string) => {
    if (setupStep === 1) setWeek1Reward(id);
    else if (setupStep === 2) setWeek2Reward(id);
    else setWeek3Reward(id);
  };

  const handleConfirmAction = () => {
    if (setupStep < 3) {
      setSetupStep(prev => prev + 1);
      setIsCommiting(false);
    } else if (setupStep === 3) {
      setSetupStep(4);
    } else {
      onContinue({ week1: week1Reward, week2: week2Reward, week3: week3Reward });
    }
  };

  const currentSelection = setupStep === 1 ? week1Reward : setupStep === 2 ? week2Reward : week3Reward;
  const milestonePoints = setupStep === 1 ? "700" : setupStep === 2 ? "1,400" : "2,100";
  const milestoneTime = setupStep === 1 ? "1 Week" : setupStep === 2 ? "2 Weeks" : "3 Weeks";
  const shouldShowPartnerStoreStory = joinedWithCode && partnerHasOnboardingRewards;

  const getRewardInfo = (id: string | null) => {
    if (!id) return { label: 'Nothing set yet', icon: Heart };
    return OPTIONS.find(o => o.id === id) || { label: 'Reward', icon: Gift };
  };

  const summaryData = [
    { week: "With", points: "700", ...getRewardInfo(week1Reward) },
    { week: "With", points: "1,400", ...getRewardInfo(week2Reward) },
    { week: "With", points: "2,100", ...getRewardInfo(week3Reward) },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#FFFFFF', '#FDFCFB', '#FEF9F9']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.flex}>
        <View style={[styles.content, useCompactLayout && styles.contentCompact]}>

          {/* Header Section */}
          <View style={[styles.header, useCompactLayout && styles.headerCompact]}>
            <View style={[styles.miniTag, useCompactLayout && styles.miniTagCompact]}>
              <Smile size={12} color={COLORS.coral} fill={COLORS.coral} />
              <Text style={[styles.miniTagText, useCompactLayout && styles.miniTagTextCompact]}>
                {setupStep === 4 ? 'SETUP COMPLETE' : shouldShowPartnerStoreStory ? 'STORE ALREADY SET' : 'PARTNER SURPRISE'}
              </Text>
            </View>
            <Text style={[styles.title, useCompactLayout && styles.titleCompact]}>
              {setupStep === 4 ? 'Rewards' : shouldShowPartnerStoreStory ? 'Store for' : 'Let\'s treat your'}{"\n"}
              <Text style={{ color: COLORS.coral }}>
                {setupStep === 4 ? 'Overview' : shouldShowPartnerStoreStory ? 'Them Too' : 'Favorite Person'}
              </Text>
            </Text>
            {setupStep !== 4 && (
              <Text style={[styles.subtitle, useCompactLayout && styles.subtitleCompact]}>
                {shouldShowPartnerStoreStory
                  ? `${partnerName} has already set up the store for you. Do you want to add anything for them too? You can always fine-tune it in the store later.`
                  : 'Small rewards keep the motivation high!'}
              </Text>
            )}
          </View>

          {setupStep < 4 && (
            <View style={[styles.progressTracker, useCompactLayout && styles.progressTrackerCompact]}>
              <View style={styles.trackLine}>
                <View style={[styles.trackFill, { width: setupStep === 1 ? '15%' : setupStep === 2 ? '50%' : '100%' }]} />
              </View>
              <View style={styles.dotContainer}>
                <View style={[styles.dot, styles.dotActive]}><Text style={styles.dotText}>1</Text></View>
                <View style={[styles.dot, setupStep >= 2 && styles.dotActive]}><Text style={styles.dotText}>2</Text></View>
                <View style={[styles.dot, setupStep === 3 && styles.dotActive]}><Text style={styles.dotText}>3</Text></View>
              </View>
            </View>
          )}

          <Animated.View style={[styles.mainArea, useCompactLayout && styles.mainAreaCompact, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {setupStep === 4 ? (
              <View style={[styles.summaryContainer, useCompactLayout && styles.summaryContainerCompact]}>
                {summaryData.map((item, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.summaryCard,
                      useCompactLayout && styles.summaryCardCompact,
                      { opacity: itemFades[index], transform: [{ scale: itemFades[index] }] }
                    ]}
                  >
                    <View style={styles.summaryLeft}>
                      <View style={[styles.weekIndicator, useCompactLayout && styles.weekIndicatorCompact]}>
                        <Text style={[styles.weekText, useCompactLayout && styles.weekTextCompact]}>{item.week}</Text>
                        <Text style={[styles.pointText, useCompactLayout && styles.pointTextCompact]}>{item.points} PTS</Text>
                      </View>
                    </View>
                    <View style={[styles.summaryRight, useCompactLayout && styles.summaryRightCompact]}>
                      <item.icon size={useCompactLayout ? 20 : 24} color={COLORS.coral} />
                      <Text style={[styles.summaryLabel, useCompactLayout && styles.summaryLabelCompact]}>{item.label}</Text>
                    </View>
                  </Animated.View>
                ))}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmAction}
                  style={[styles.finalFinishBtn, useCompactLayout && styles.finalFinishBtnCompact]}
                >
                  <LinearGradient
                    colors={[COLORS.coral, COLORS.coralDark]}
                    style={styles.confirmBtnGradient}
                  >
                    <Text style={styles.confirmBtnText}>Finish Surprise Setup</Text>
                    <ArrowRight color="white" size={18} strokeWidth={3} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : !isCommiting ? (
              <View style={[styles.questionCard, useCompactLayout && styles.questionCardCompact]}>
                <View style={[styles.integratedQuestion, useCompactLayout && styles.integratedQuestionCompact]}>
                  <Text style={[styles.unifiedQuestionText, useCompactLayout && styles.unifiedQuestionTextCompact]}>
                    {shouldShowPartnerStoreStory ? (
                      <>
                        <Text style={styles.boldCoral}>{partnerName}</Text> has already set up the store for you. In{' '}
                        <Text style={styles.boldCoral}>{milestoneTime}</Text>, if they hit their goals, they can earn{' '}
                        <Text style={styles.heavyBlack}>{milestonePoints} POINTS</Text>.{' '}
                        <Text style={styles.offerQuestionHighlight}>Do you want to set up anything for them too?</Text>
                      </>
                    ) : (
                      <>
                        In <Text style={styles.boldCoral}>{milestoneTime}</Text>, if they achieve all their goals, they earn <Text style={styles.heavyBlack}>{milestonePoints} POINTS</Text>.{' '}
                        <Text style={styles.offerQuestionHighlight}>Would you like to offer a reward to keep them motivated?</Text>
                      </>
                    )}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.actionBtn, useCompactLayout && styles.actionBtnCompact]}
                  activeOpacity={0.9}
                  onPress={() => setIsCommiting(true)}
                >
                  <LinearGradient colors={[COLORS.coral, COLORS.coralDark]} style={styles.btnGradient}>
                    <Text style={[styles.btnText, useCompactLayout && styles.btnTextCompact]}>{shouldShowPartnerStoreStory ? "Yes, I'll add something for them" : "Yes, let's offer something!"}</Text>
                    <Gift color="white" size={useCompactLayout ? 18 : 20} />
                  </LinearGradient>
                </TouchableOpacity>

                <View style={[styles.centerOr, useCompactLayout && styles.centerOrCompact]}>
                  <Text style={styles.orText}>— or —</Text>
                </View>

                <TouchableOpacity
                  style={[styles.secondaryActionBtn, useCompactLayout && styles.secondaryActionBtnCompact]}
                  onPress={handleConfirmAction}
                >
                  <Text style={styles.secondaryActionText}>
                    {shouldShowPartnerStoreStory
                      ? "Skip this milestone for now"
                      : setupStep === 1
                      ? "Wait until they earn 1,400 points"
                      : setupStep === 2
                        ? "Wait until they earn 2,100 points"
                        : "Don't offer anything"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tertiarySkipBtn, useCompactLayout && styles.tertiarySkipBtnCompact]}
                  onPress={() => onContinue({ week1: null, week2: null, week3: null })}
                >
                  <Text style={styles.tertiarySkipText}>
                    {shouldShowPartnerStoreStory ? "I'll handle their store setup later" : "Actually, I'll set everything up later"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.pickerArea, useCompactLayout && styles.pickerAreaCompact]}>
                <Text style={[styles.pickerTitle, useCompactLayout && styles.pickerTitleCompact]}>What are you offering?</Text>

                <View style={[styles.grid, useCompactLayout && styles.gridCompact]}>
                  {OPTIONS.map((item) => {
                    const isSelected = currentSelection === item.id;
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.9}
                        onPress={() => handleRewardSelect(item.id)}
                        style={[styles.card, useCompactLayout && styles.cardCompact, isSelected && styles.cardSelected]}
                      >
                        <View style={[styles.iconBox, useCompactLayout && styles.iconBoxCompact, isSelected && styles.iconBoxSelected]}>
                          <Icon color={isSelected ? COLORS.white : COLORS.coral} size={useCompactLayout ? 19 : 22} strokeWidth={2.5} />
                        </View>
                        <Text style={[styles.cardLabel, useCompactLayout && styles.cardLabelCompact, isSelected && styles.cardLabelSelected]}>{item.label}</Text>
                        {isSelected && (
                          <View style={styles.checkBadge}><Check color={COLORS.white} size={8} strokeWidth={4} /></View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmAction}
                  style={[styles.confirmBtn, useCompactLayout && styles.confirmBtnCompact]}
                  disabled={!currentSelection}
                >
                  <LinearGradient
                    colors={currentSelection ? [COLORS.coral, COLORS.coralDark] : ['#E5E7EB', '#D1D5DB']}
                    style={styles.confirmBtnGradient}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.confirmBtnText}>Lock it in</Text>
                    <ArrowRight color="white" size={18} strokeWidth={3} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          <View style={[styles.footerTip, useCompactLayout && styles.footerTipCompact]}>
            <Text style={[styles.tipText, useCompactLayout && styles.tipTextCompact]}>Tip: You can change these anytime in the Marketplace.</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
  },
  contentCompact: {
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCompact: {
    marginBottom: 8,
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
  miniTagCompact: {
    paddingVertical: 3,
    marginBottom: 6,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1,
  },
  miniTagTextCompact: {
    fontSize: 9,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  subtitleCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  progressTracker: {
    height: 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressTrackerCompact: {
    height: 30,
    marginBottom: 12,
  },
  trackLine: {
    position: 'absolute',
    height: 3,
    width: '60%',
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.coral,
    borderRadius: 2,
  },
  dotContainer: {
    width: '60%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  dotActive: {
    backgroundColor: COLORS.coral,
  },
  dotText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.white,
  },
  mainArea: {
    flex: 1,
    justifyContent: 'center',
  },
  mainAreaCompact: {
    flex: 0,
    justifyContent: 'flex-start',
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  questionCardCompact: {
    borderRadius: 26,
    padding: 22,
  },
  integratedQuestion: {
    alignItems: 'center',
    marginBottom: 24,
  },
  integratedQuestionCompact: {
    marginBottom: 16,
  },
  unifiedQuestionText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
  unifiedQuestionTextCompact: {
    fontSize: 15,
    lineHeight: 21,
  },
  boldCoral: {
    color: COLORS.coral,
    fontWeight: '900',
  },
  heavyBlack: {
    color: COLORS.black,
    fontWeight: '900',
  },
  offerQuestionHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
    letterSpacing: -0.1,
  },
  actionBtn: {
    width: '100%',
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
  },
  actionBtnCompact: {
    height: 58,
    borderRadius: 18,
    marginBottom: 6,
  },
  centerOr: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  centerOrCompact: {
    paddingVertical: 5,
  },
  orText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secondaryActionBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryActionBtnCompact: {
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  secondaryActionText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '700',
  },
  tertiarySkipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  tertiarySkipBtnCompact: {
    paddingVertical: 6,
  },
  tertiarySkipText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
    opacity: 0.7,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  btnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  btnTextCompact: {
    fontSize: 14,
  },
  ignoreBtn: {
    marginTop: 16,
    padding: 10,
  },
  ignoreBtnText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  skipSetupBtn: {
    marginTop: 8,
    padding: 10,
  },
  skipSetupBtnText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    textDecorationLine: 'underline',
  },
  summaryContainer: {
    flex: 1,
    gap: 16,
    paddingTop: 10,
  },
  summaryContainerCompact: {
    flex: 0,
    gap: 10,
    paddingTop: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryCardCompact: {
    borderRadius: 20,
    padding: 16,
  },
  summaryLeft: {
    flex: 1,
  },
  weekIndicator: {
    gap: 2,
  },
  weekIndicatorCompact: {
    gap: 0,
  },
  weekText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weekTextCompact: {
    fontSize: 10,
  },
  pointText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
  },
  pointTextCompact: {
    fontSize: 18,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.coralLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 10,
  },
  summaryRightCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.black,
  },
  summaryLabelCompact: {
    fontSize: 12,
  },
  finalFinishBtn: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginTop: 'auto',
    marginBottom: 10,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  finalFinishBtnCompact: {
    height: 58,
    borderRadius: 24,
    marginTop: 14,
    marginBottom: 0,
  },
  pickerArea: {
    flex: 1,
  },
  pickerAreaCompact: {
    flex: 0,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.black,
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerTitleCompact: {
    fontSize: 16,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  gridCompact: {
    gap: 8,
  },
  card: {
    width: (width - 60) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    height: 100,
    justifyContent: 'center',
  },
  cardCompact: {
    height: 90,
    borderRadius: 18,
    padding: 10,
  },
  cardSelected: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.white,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBoxCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 5,
  },
  iconBoxSelected: {
    backgroundColor: COLORS.coral,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.black,
  },
  cardLabelCompact: {
    fontSize: 11,
  },
  cardLabelSelected: {
    color: COLORS.black,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.coral,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  confirmBtn: {
    height: 54,
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 20,
  },
  confirmBtnCompact: {
    height: 54,
    borderRadius: 22,
    marginTop: 14,
  },
  confirmBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  footerTip: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerTipCompact: {
    marginTop: 6,
  },
  tipText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  tipTextCompact: {
    fontSize: 10,
  },
});
