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
import {
  Coffee,
  Film,
  Gift,
  Heart,
  Trophy,
  ArrowRight,
  Check,
  Calendar,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Star,
  Plus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  coralBorder: '#FFDCDC',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  trackBg: '#E2E8F0',
  success: '#2ECC71',
};

const OPTIONS = [
  { id: 'coffee', label: 'Coffee', hint: 'A treat', icon: Coffee },
  { id: 'movie', label: 'Movie', hint: 'Cozy night', icon: Film },
  { id: 'gift', label: 'Gift', hint: 'Surprise', icon: Gift },
  { id: 'date', label: 'Date', hint: 'Plan it', icon: Calendar },
  { id: 'heart', label: 'Time', hint: 'Together', icon: Heart },
  { id: 'trophy', label: 'Prize', hint: 'Big win', icon: Trophy },
];

export default function PartnerRewardSelection({ onContinue, onBack, joinedWithCode = false }: any) {
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
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true }),
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

  const editWeek = (weekIndex: number) => {
    setSetupStep(weekIndex);
    setIsCommiting(true);
  };

  const currentSelection = setupStep === 1 ? week1Reward : setupStep === 2 ? week2Reward : week3Reward;
  const milestonePoints = setupStep === 1 ? '700' : setupStep === 2 ? '1,400' : '2,100';
  const nextMilestonePoints = setupStep === 1 ? '1,400' : setupStep === 2 ? '2,100' : '2,800';
  const milestoneTime = setupStep === 1 ? '1 Week' : setupStep === 2 ? '2 Weeks' : '3 Weeks';
  const winningWeekLabel = setupStep === 1 ? 'first' : setupStep === 2 ? 'second' : 'third';
  const shouldShowPartnerStoreStory = joinedWithCode && partnerHasOnboardingRewards;

  const getRewardInfo = (id: string | null) => {
    if (!id) return { label: 'Nothing set yet', icon: Heart };
    return OPTIONS.find(o => o.id === id) || { label: 'Reward', icon: Gift };
  };

  const summaryData = [
    { points: '700', rewardId: week1Reward, weekIndex: 1 },
    { points: '1,400', rewardId: week2Reward, weekIndex: 2 },
    { points: '2,100', rewardId: week3Reward, weekIndex: 3 },
  ];

  const renderTopNav = () => (
    <View style={styles.topNav}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          if (isCommiting) setIsCommiting(false);
          else if (setupStep > 1) setSetupStep(prev => prev - 1);
          else if (onBack) onBack();
        }}
      >
        <ChevronLeft color={COLORS.black} size={22} />
      </TouchableOpacity>
      <View style={styles.stepPill}>
        <Text style={styles.stepPillText}>
          {setupStep === 4 ? (
            <>3 of 3</>
          ) : (
            <>Step <Text style={styles.stepPillNumber}>{setupStep}</Text> of 3</>
          )}
        </Text>
      </View>
    </View>
  );

  const renderHeader = () => {
    const isQuestion = setupStep < 4 && !isCommiting;
    return (
      <View style={styles.header}>
        <View style={styles.miniTag}>
          {setupStep === 4 ? (
            <View style={styles.miniCheckDot}>
              <Check color={COLORS.white} size={9} strokeWidth={4} />
            </View>
          ) : (
            <Gift size={13} color={COLORS.coral} />
          )}
          <Text style={styles.miniTagText}>
            {setupStep === 4
              ? 'SETUP COMPLETE'
              : shouldShowPartnerStoreStory
              ? 'STORE ALREADY SET'
              : `PARTNER REWARDS · ${setupStep} OF 3`}
          </Text>
        </View>
        <Text style={styles.title}>
          {setupStep === 4
            ? 'Your reward\njourney'
            : isCommiting
            ? 'Pick a reward\nfor your partner'
            : `Set up your partner\'s\n${winningWeekLabel} reward`}
        </Text>
        {setupStep === 4 && (
          <Text style={styles.subtitle}>
            Three milestones to keep the momentum going.
          </Text>
        )}
        {isQuestion && (
          <Text style={styles.subtitle}>
            Choose what your partner earns when they reach <Text style={styles.subtitleAccent}>{milestonePoints} points</Text>.
          </Text>
        )}
      </View>
    );
  };

  const renderProgressDots = () => (
    <View style={styles.progressTracker}>
      <View style={styles.trackLine}>
        <View
          style={[
            styles.trackFill,
            { width: setupStep === 1 ? '15%' : setupStep === 2 ? '50%' : '100%' },
          ]}
        />
      </View>
      <View style={styles.dotContainer}>
        <View style={[styles.dot, styles.dotActive]}>
          <Text style={styles.dotText}>1</Text>
        </View>
        <View style={[styles.dot, setupStep >= 2 && styles.dotActive]}>
          <Text style={[styles.dotText, setupStep < 2 && styles.dotTextInactive]}>2</Text>
        </View>
        <View style={[styles.dot, setupStep >= 3 && styles.dotActive]}>
          <Text style={[styles.dotText, setupStep < 3 && styles.dotTextInactive]}>3</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FDFCFB', '#FEF9F9']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.flex}>
        <View style={styles.content}>
          {renderTopNav()}
          {renderHeader()}
          {setupStep < 4 && renderProgressDots()}

          <Animated.View
            style={[
              styles.mainArea,
              setupStep === 4 && styles.mainAreaSummary,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {setupStep === 4 ? (
              <View style={styles.summaryContainer}>
                <View style={styles.timelineWrap}>
                  <View style={styles.timelineTrackWrap} pointerEvents="none">
                    <View style={styles.timelineTrack} />
                  </View>

                  {summaryData.map((item, index) => {
                    const info = getRewardInfo(item.rewardId);
                    const isEmpty = !item.rewardId;
                    const RewardIcon = info.icon;
                    return (
                      <Animated.View
                        key={index}
                        style={[
                          styles.timelineRow,
                          {
                            opacity: itemFades[index],
                            transform: [
                              {
                                translateY: Animated.multiply(
                                  Animated.subtract(1, itemFades[index]),
                                  12,
                                ),
                              },
                            ],
                          },
                        ]}
                      >
                        <View style={styles.timelineDotCol}>
                          <View style={[styles.timelineDot, isEmpty && styles.timelineDotEmpty]}>
                            {isEmpty ? (
                              <Plus color={COLORS.coral} size={16} strokeWidth={3} />
                            ) : (
                              <Check color={COLORS.white} size={14} strokeWidth={4} />
                            )}
                          </View>
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelinePointsRow}>
                            <Text style={styles.timelinePoints}>{item.points}</Text>
                            <Text style={styles.timelinePointsUnit}>pts</Text>
                          </View>

                          {isEmpty ? (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => editWeek(item.weekIndex)}
                              style={styles.emptyRewardCard}
                            >
                              <View style={styles.emptyIconTile}>
                                <Gift color={COLORS.coral} size={26} strokeWidth={2} />
                              </View>
                              <View style={styles.emptyTextWrap}>
                                <Text style={styles.emptyTitle}>Add a reward</Text>
                                <Text style={styles.emptyHint}>Choose something they'll love</Text>
                              </View>
                              <View style={styles.emptyChevron}>
                                <ChevronRight color={COLORS.coral} size={18} strokeWidth={2.5} />
                              </View>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.filledRewardCard}>
                              <View style={styles.filledIconTile}>
                                <RewardIcon color={COLORS.coral} size={28} strokeWidth={2} />
                              </View>
                              <View style={styles.filledTextWrap}>
                                <Text style={styles.filledLabel} numberOfLines={1}>
                                  {info.label}
                                </Text>
                                <Text style={styles.filledHint}>Locked in</Text>
                              </View>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => editWeek(item.weekIndex)}
                                style={styles.editBtn}
                              >
                                <Text style={styles.editBtnText}>Edit</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>

                <View style={styles.summaryFooter}>
                  <View style={styles.updateTip}>
                    <View style={styles.updateTipShield}>
                      <ShieldCheck color={COLORS.success} size={14} />
                    </View>
                    <Text style={styles.updateTipText}>You can update rewards anytime.</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleConfirmAction}
                    style={styles.finalFinishBtn}
                  >
                    <LinearGradient
                      colors={[COLORS.coral, COLORS.coralDark]}
                      style={styles.confirmBtnGradient}
                    >
                      <Text style={styles.finalFinishText}>Finish setup</Text>
                      <ArrowRight color="white" size={20} strokeWidth={3} />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setSetupStep(3)}
                    style={styles.backToReviewBtn}
                  >
                    <Text style={styles.backToReviewText}>Back to review</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !isCommiting ? (
              <View style={styles.questionWrap}>
                <View style={styles.statsBento}>
                  <View style={styles.statCard}>
                    <View style={styles.statIconTile}>
                      <Calendar color={COLORS.coral} size={16} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.statLabel}>After</Text>
                    <Text style={styles.statValue}>{milestoneTime}</Text>
                  </View>

                  <View style={styles.statConnector}>
                    <View style={styles.statConnectorLine} />
                    <View style={styles.statConnectorCircle}>
                      <ArrowRight color={COLORS.white} size={12} strokeWidth={3} />
                    </View>
                    <View style={styles.statConnectorLine} />
                  </View>

                  <View style={[styles.statCard, styles.statCardPrimary]}>
                    <View style={[styles.statIconTile, styles.statIconTilePrimary]}>
                      <Star color={COLORS.white} size={16} strokeWidth={2.4} fill={COLORS.white} />
                    </View>
                    <Text style={styles.statLabelPrimary}>Unlock</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValuePrimary}>{milestonePoints}</Text>
                      <Text style={styles.statUnitPrimary}>pts</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionStack}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    activeOpacity={0.9}
                    onPress={() => setIsCommiting(true)}
                  >
                    <LinearGradient
                      colors={[COLORS.coral, COLORS.coralDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.btnGradient}
                    >
                      <Text style={styles.btnText}>Choose a reward</Text>
                      <View style={styles.btnArrowCircle}>
                        <ArrowRight color={COLORS.coral} size={16} strokeWidth={3} />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    activeOpacity={0.8}
                    onPress={handleConfirmAction}
                  >
                    <Text style={styles.secondaryActionText}>
                      {shouldShowPartnerStoreStory
                        ? 'Skip this milestone'
                        : `Wait for ${nextMilestonePoints} pts`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.tertiarySkipBtn}
                    activeOpacity={0.7}
                    onPress={() => onContinue({ week1: null, week2: null, week3: null })}
                  >
                    <Text style={styles.tertiarySkipText}>I'll decide later</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.pickerArea}>
                <Text style={styles.pickerTitle}>What are you offering?</Text>

                <View style={styles.grid}>
                  {OPTIONS.map((item) => {
                    const isSelected = currentSelection === item.id;
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() => handleRewardSelect(item.id)}
                        style={[styles.card, isSelected && styles.cardSelected]}
                      >
                        <View style={[styles.iconTile, isSelected && styles.iconTileSelected]}>
                          <Icon
                            color={isSelected ? COLORS.white : COLORS.coral}
                            size={22}
                            strokeWidth={2.4}
                          />
                        </View>
                        <Text style={styles.cardLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={styles.cardHint} numberOfLines={1}>
                          {item.hint}
                        </Text>
                        {isSelected && (
                          <View style={styles.checkBadge}>
                            <Check color={COLORS.white} size={10} strokeWidth={4} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirmAction}
                  style={styles.confirmBtn}
                  disabled={!currentSelection}
                >
                  <LinearGradient
                    colors={currentSelection ? [COLORS.coral, COLORS.coralDark] : ['#E5E7EB', '#D1D5DB']}
                    style={styles.confirmBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.confirmBtnText}>Lock it in</Text>
                    <ArrowRight color="white" size={18} strokeWidth={3} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {setupStep !== 4 && (
            <View style={styles.footerTip}>
              <View style={styles.footerShield}>
                <ShieldCheck color={COLORS.coral} size={14} />
              </View>
              <Text style={styles.tipText}>You can change this anytime</Text>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: Platform.OS === 'ios' ? 6 : 12,
  },

  // Top nav
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepPill: {
    backgroundColor: COLORS.coralLight,
    borderWidth: 1,
    borderColor: COLORS.coralBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  stepPillText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '700',
  },
  stepPillNumber: {
    color: COLORS.coral,
    fontWeight: '900',
  },

  // Header
  header: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  miniTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 6,
    marginBottom: 8,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.2,
  },
  miniCheckDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'left',
    lineHeight: 34,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
    textAlign: 'left',
    marginTop: 6,
    lineHeight: 18,
  },
  subtitleAccent: {
    color: COLORS.coral,
    fontWeight: '800',
  },

  // Progress tracker
  progressTracker: {
    height: 32,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  trackLine: {
    position: 'absolute',
    height: 2,
    width: '55%',
    backgroundColor: COLORS.trackBg,
    borderRadius: 2,
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.coral,
    borderRadius: 2,
  },
  dotContainer: {
    width: '55%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.trackBg,
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
  dotTextInactive: {
    color: '#94A3B8',
  },

  // Main area
  mainArea: {
    flex: 1,
    justifyContent: 'center',
  },
  mainAreaSummary: {
    justifyContent: 'flex-start',
  },

  // Question screen
  questionWrap: {
    width: '100%',
  },

  // Bento stats row
  statsBento: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F1F1F5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  statCardPrimary: {
    backgroundColor: COLORS.coral,
    borderColor: COLORS.coral,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  statIconTile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconTilePrimary: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  statLabelPrimary: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  statValuePrimary: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.8,
  },
  statUnitPrimary: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.4,
  },
  statConnector: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statConnectorLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.coralBorder,
  },
  statConnectorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },

  questionText: {
    fontSize: 26,
    color: COLORS.black,
    textAlign: 'left',
    lineHeight: 30,
    letterSpacing: -0.9,
    fontWeight: '900',
    marginBottom: 8,
  },
  rewardExplanation: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'left',
    marginBottom: 22,
  },
  rewardExplanationBold: {
    color: COLORS.coral,
    fontWeight: '800',
  },

  // Buttons
  actionStack: {
    gap: 10,
  },
  actionBtn: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
    paddingRight: 8,
  },
  btnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  btnArrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FBFAFC',
    borderWidth: 1,
    borderColor: '#EFEEF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '700',
  },
  tertiarySkipBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  tertiarySkipText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  // Picker area
  pickerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.black,
    marginBottom: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 10,
    columnGap: 10,
  },
  card: {
    width: '30%',
    aspectRatio: 0.92,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F1F5',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: COLORS.coral,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ translateY: -2 }],
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconTileSelected: {
    backgroundColor: COLORS.coral,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  cardHint: {
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 14,
  },
  confirmBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  confirmBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },

  // Summary / timeline
  summaryContainer: {
    flex: 1,
    paddingTop: 8,
  },
  summaryFooter: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  timelineWrap: {
    position: 'relative',
    paddingTop: 4,
  },
  timelineTrackWrap: {
    position: 'absolute',
    left: 15, // dot column center: 32/2 - track/2 (2/2)
    top: 32,
    bottom: 32,
    width: 2,
  },
  timelineTrack: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.coralBorder,
    borderRadius: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDotCol: {
    width: 32,
    alignItems: 'center',
    paddingTop: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.coral,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineDotEmpty: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.coral,
    shadowOpacity: 0.15,
  },
  timelineContent: {
    flex: 1,
  },
  timelinePointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
    gap: 4,
  },
  timelinePoints: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.6,
  },
  timelinePointsUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  filledRewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#F1F1F5',
    borderRadius: 20,
    padding: 14,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  filledIconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledTextWrap: {
    flex: 1,
  },
  filledLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  filledHint: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 2,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.coralLight,
    borderRadius: 999,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.coral,
    letterSpacing: 0.2,
  },

  emptyRewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.coralLight,
    borderWidth: 1,
    borderColor: COLORS.coralBorder,
    borderRadius: 20,
    padding: 14,
    gap: 14,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFE4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTextWrap: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  emptyHint: {
    fontSize: 12.5,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  updateTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#F1F1F5',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  updateTipShield: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E6F7EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateTipText: {
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '600',
  },

  finalFinishBtn: {
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    marginTop: 14,
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  finalFinishText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  backToReviewBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backToReviewText: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer tip
  footerTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F1F5',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 10,
  },
  footerShield: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.coralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 12,
    color: COLORS.black,
    fontWeight: '600',
  },
});
