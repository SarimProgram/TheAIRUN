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
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import {
  ArrowRight,
  Check,
  Heart,
  ChevronLeft,
  ShieldCheck,
  Medal,
  Smile,
  Coffee,
  Film,
  Gift,
  Calendar,
  Trophy,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '@/src/auth/authContext';
import { API_BASE_URL } from '../../config/api';
import { Fonts } from '../../constants/theme';

const H_PADDING = 28;
const OPTION_WIDTH = 104;
const OPTION_GAP = 14;

const BENEFITS = [
  { icon: ShieldCheck, text: 'Stay motivated' },
  { icon: Medal, text: 'Celebrate wins' },
  { icon: Smile, text: "They'll love it" },
];

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  coralLight: '#FFF5F5',
  white: '#FFFFFF',
  black: '#1F2937',
  muted: '#6B7280',
  border: '#F0F0F0',
  selection: '#FFF0F0',
};

type RewardOption = {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  isCustom?: boolean;
};

const OPTIONS: RewardOption[] = [
  { id: 'coffee', label: 'Coffee', icon: Coffee, iconColor: '#C2410C', iconBg: '#FFF7ED' },
  { id: 'movie', label: 'Movie', icon: Film, iconColor: '#7C3AED', iconBg: '#F5F3FF' },
  { id: 'gift', label: 'Gift', icon: Gift, iconColor: '#DB2777', iconBg: '#FDF2F8' },
  { id: 'date', label: 'Date', icon: Calendar, iconColor: '#E11D48', iconBg: '#FFF1F2' },
  { id: 'heart', label: 'Time', icon: Heart, iconColor: '#DC2626', iconBg: '#FEF2F2' },
  { id: 'trophy', label: 'Prize', icon: Trophy, iconColor: '#2563EB', iconBg: '#EFF6FF' },
  { id: 'custom', label: 'Custom', icon: Sparkles, iconColor: '#6366F1', iconBg: '#EEF2FF', isCustom: true },
];

const WEEKS = [
  {
    key: 'week1' as const,
    label: 'Week 1',
    points: '700',
    milestoneAction: 'If your partner earns',
    milestoneSub: 'they’ll unlock this reward.',
  },
  {
    key: 'week2' as const,
    label: 'Week 2',
    points: '1,400',
    milestoneAction: 'If your partner earns',
    milestoneSub: 'they’ll unlock this reward.',
  },
  {
    key: 'week3' as const,
    label: 'Week 3',
    points: '2,100',
    milestoneAction: 'If your partner earns',
    milestoneSub: 'they’ll unlock this reward.',
  },
];

type RewardMap = {
  week1: string | null;
  week2: string | null;
  week3: string | null;
};

type CustomLabels = {
  week1: string;
  week2: string;
  week3: string;
};

type Props = {
  onContinue: (data: RewardMap) => void;
  onBack?: () => void;
  joinedWithCode?: boolean;
};

function RewardHero({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.heroScene, compact && styles.heroSceneCompact]}>
      <View style={[styles.heroGlow, compact && styles.heroGlowCompact]} />
      <ExpoImage
        source={require('../../assets/bf5ea328-b200-4872-90b4-5932707e2f40.png')}
        style={[styles.heroImage, compact && styles.heroImageCompact]}
        contentFit="contain"
        contentPosition="center"
      />
      <View style={[styles.heroHeartBadge, compact && styles.heroHeartBadgeCompact]}>
        <Heart size={compact ? 9 : 11} color={COLORS.white} fill={COLORS.white} />
      </View>
    </View>
  );
}

function RewardTile({
  option,
  isSelected,
  displayLabel,
  onPress,
}: {
  option: RewardOption;
  isSelected: boolean;
  displayLabel: string;
  onPress: () => void;
}) {
  const Icon = option.icon;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.optionCard,
        option.isCustom && !isSelected && styles.optionCardCustom,
        isSelected && styles.optionCardSelected,
      ]}
    >
      {isSelected ? (
        <LinearGradient
          colors={[COLORS.coral, COLORS.coralDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWell}
        >
          <Icon color={COLORS.white} size={22} strokeWidth={2} />
        </LinearGradient>
      ) : (
        <View style={[styles.iconWell, { backgroundColor: option.iconBg }]}>
          <Icon color={option.iconColor} size={22} strokeWidth={1.9} />
        </View>
      )}

      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]} numberOfLines={1}>
        {displayLabel}
      </Text>

      <View style={[styles.selectRing, isSelected && styles.selectRingActive]}>
        {isSelected && <Check color={COLORS.white} size={10} strokeWidth={3.5} />}
      </View>
    </TouchableOpacity>
  );
}

export default function PartnerRewardSelection({
  onContinue,
  onBack,
  joinedWithCode = false,
}: Props) {
  const { authFetch } = useAuth();
  const [rewards, setRewards] = useState<RewardMap>({
    week1: null,
    week2: null,
    week3: null,
  });
  const [customLabels, setCustomLabels] = useState<CustomLabels>({
    week1: '',
    week2: '',
    week3: '',
  });
  const [customModalWeek, setCustomModalWeek] = useState<keyof RewardMap | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const [partnerHasOnboardingRewards, setPartnerHasOnboardingRewards] = useState(false);
  const [step, setStep] = useState<'pick' | 'review'>('pick');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (!joinedWithCode) return;

    let mounted = true;
    const loadPartnerState = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/partner`);
        const data = await res.json();
        if (!mounted) return;
        setPartnerHasOnboardingRewards(!!data?.partnerHasOnboardingRewards);
      } catch {
        if (!mounted) return;
        setPartnerHasOnboardingRewards(false);
      }
    };

    loadPartnerState();
    return () => {
      mounted = false;
    };
  }, [joinedWithCode, authFetch]);

  const selectReward = (weekKey: keyof RewardMap, option: RewardOption) => {
    if (option.isCustom) {
      setCustomDraft(customLabels[weekKey]);
      setCustomModalWeek(weekKey);
      return;
    }

    setRewards((prev) => ({
      ...prev,
      [weekKey]: prev[weekKey] === option.id ? null : option.id,
    }));
  };

  const confirmCustomReward = () => {
    if (!customModalWeek) return;
    const label = customDraft.trim();
    setCustomLabels((prev) => ({ ...prev, [customModalWeek]: label }));
    setRewards((prev) => ({
      ...prev,
      [customModalWeek]: prev[customModalWeek] === 'custom' && !label ? null : 'custom',
    }));
    setCustomModalWeek(null);
    setCustomDraft('');
  };

  const getRewardOption = (optionId: string | null) =>
    OPTIONS.find((o) => o.id === optionId) ?? null;

  const getDisplayLabel = (weekKey: keyof RewardMap, optionId: string | null) => {
    if (!optionId) return '';
    if (optionId === 'custom' && customLabels[weekKey].trim()) {
      return customLabels[weekKey].trim();
    }
    return getRewardOption(optionId)?.label ?? '';
  };

  const selectedCount = [rewards.week1, rewards.week2, rewards.week3].filter(Boolean).length;
  const hasAnySelection = selectedCount >= 1;
  const shouldShowPartnerStoreStory = joinedWithCode && partnerHasOnboardingRewards;

  const handleBack = () => {
    if (step === 'review') {
      setStep('pick');
      return;
    }
    onBack?.();
  };

  const handlePrimaryAction = () => {
    if (step === 'pick') {
      if (hasAnySelection) setStep('review');
      return;
    }
    onContinue({
      week1: rewards.week1,
      week2: rewards.week2,
      week3: rewards.week3,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.7}
            disabled={step === 'pick' && !onBack}
          >
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[
              styles.flex,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <ScrollView
              style={styles.flex}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.heroBlock}>
                <View style={styles.heroRow}>
                  <View style={styles.heroTextCol}>
                    <View style={styles.titleBlock}>
                      {step === 'pick' ? (
                        <Text style={styles.title}>
                          Pick rewards{'\n'}
                          <Text style={styles.titleAccent}>for your partner</Text>
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.title}>Review your</Text>
                          <Text style={styles.reviewTitleAction}>reward picks</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <RewardHero compact={step === 'review'} />
                </View>

                <Text style={[styles.subtitle, styles.pickSubtitle]}>
                  {step === 'pick'
                    ? shouldShowPartnerStoreStory
                      ? 'Your partner already set up their store — add milestones or skip for now.'
                      : 'Choose what your partner earns when they complete their weekly tasks and reach each points milestone.'
                    : `${selectedCount} of 3 milestones set. You can edit these anytime.`}
                </Text>
              </View>

              {step === 'pick' ? (
                <View style={styles.benefitsRow}>
                  {BENEFITS.map(({ icon: Icon, text }) => (
                    <View key={text} style={styles.benefitItem}>
                      <View style={styles.benefitIcon}>
                        <Icon size={16} color={COLORS.coral} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.benefitText}>{text}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.weeksList}>
                {WEEKS.map((week) => {
                  const weekKey = week.key;
                  const selectedId = rewards[weekKey];
                  const option = getRewardOption(selectedId);
                  const label = getDisplayLabel(weekKey, selectedId);
                  const isSet = Boolean(selectedId && option);

                  if (step === 'pick') {
                    return (
                      <View key={week.key} style={styles.weekSection}>
                        <View style={styles.weekHeader}>
                          <Text style={styles.weekLabel}>{week.label}</Text>
                          <View style={styles.pointsRow}>
                            <Heart size={14} color={COLORS.coral} fill={COLORS.coral} />
                            <Text style={styles.pointsText}>
                              {week.points}
                              <Text style={styles.pointsUnit}> pts</Text>
                            </Text>
                          </View>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.optionsRow}
                          decelerationRate="fast"
                        >
                          {OPTIONS.map((optionItem) => {
                            const isSelected = selectedId === optionItem.id;
                            const optionLabel =
                              optionItem.isCustom && isSelected
                                ? getDisplayLabel(weekKey, 'custom') || 'Custom'
                                : optionItem.label;

                            return (
                              <RewardTile
                                key={`${week.key}-${optionItem.id}`}
                                option={optionItem}
                                isSelected={isSelected}
                                displayLabel={optionLabel}
                                onPress={() => selectReward(weekKey, optionItem)}
                              />
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  }

                  return (
                    <View key={week.key} style={styles.weekSection}>
                      <View style={styles.weekHeader}>
                        <Text style={styles.weekLabel}>{week.label}</Text>
                        <View style={styles.pointsRow}>
                          <Heart size={14} color={COLORS.coral} fill={COLORS.coral} />
                          <Text style={styles.pointsText}>
                            {week.points}
                            <Text style={styles.pointsUnit}> pts</Text>
                          </Text>
                        </View>
                      </View>

                      <View style={styles.milestoneBlock}>
                        <Text style={styles.milestoneAction}>{week.milestoneAction}</Text>
                        <Text style={styles.milestoneValue}>
                          {week.points}
                          <Text style={styles.milestoneValueUnit}> pts</Text>
                        </Text>
                        <Text style={styles.milestoneSub}>{week.milestoneSub}</Text>
                      </View>

                      {isSet && option ? (
                        <View style={styles.reviewCard}>
                          <View style={[styles.reviewIconWell, { backgroundColor: option.iconBg }]}>
                            <option.icon color={option.iconColor} size={22} strokeWidth={2} />
                          </View>
                          <View style={styles.reviewTextWrap}>
                            <Text style={styles.reviewRewardLabel}>{label}</Text>
                            <Text style={styles.reviewRewardHint}>Locked in</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => setStep('pick')}
                            style={styles.editBtn}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setStep('pick')}
                          style={styles.reviewEmptyCard}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.reviewEmptyTitle}>No reward set</Text>
                          <Text style={styles.reviewEmptyHint}>Tap to add one</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePrimaryAction}
            style={styles.mainButton}
            disabled={step === 'pick' && !hasAnySelection}
          >
            <LinearGradient
              colors={
                step === 'review' || hasAnySelection
                  ? [COLORS.coral, COLORS.coralDark]
                  : ['#E5E7EB', '#D1D5DB']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>
                {step === 'pick' ? 'Continue' : 'Finish setup'}
              </Text>
              <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>

          {step === 'pick' && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onContinue({ week1: null, week2: null, week3: null })}
              style={styles.skipBtn}
            >
              <Text style={styles.skipText}>I'll decide later</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={customModalWeek !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalWeek(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCustomModalWeek(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Name your reward</Text>
            <Text style={styles.modalSubtitle}>
              Something personal your partner will love.
            </Text>
            <TextInput
              value={customDraft}
              onChangeText={setCustomDraft}
              placeholder="e.g. Massage, Brunch, New shoes..."
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={confirmCustomReward}
            />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={confirmCustomReward}
              style={styles.modalBtn}
            >
              <LinearGradient
                colors={[COLORS.coral, COLORS.coralDark]}
                style={styles.modalBtnGradient}
              >
                <Text style={styles.modalBtnText}>Save reward</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: 24,
  },

  heroBlock: {
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 4,
  },
  heroScene: {
    width: 112,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  heroSceneCompact: {
    width: 96,
    height: 100,
    marginTop: 0,
  },
  heroGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  heroGlowCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  heroImage: {
    width: 108,
    height: 96,
  },
  heroImageCompact: {
    width: 88,
    height: 80,
  },
  heroHeartBadge: {
    position: 'absolute',
    bottom: 10,
    left: 18,
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
  heroHeartBadgeCompact: {
    bottom: 6,
    left: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  titleBlock: {
    marginBottom: 10,
  },
  titleAccent: {
    color: COLORS.coral,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 0,
    maxWidth: 320,
  },
  pickSubtitle: {
    maxWidth: '100%',
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 32,
    marginTop: 12,
  },
  benefitItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 14,
  },

  weeksList: {
    gap: 36,
  },
  weekSection: {
    gap: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.4,
  },
  pointsUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },

  optionsRow: {
    gap: OPTION_GAP,
    paddingRight: H_PADDING,
    paddingVertical: 2,
  },
  optionCard: {
    width: OPTION_WIDTH,
    minHeight: 124,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#ECEEF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  optionCardCustom: {
    borderStyle: 'dashed',
    borderColor: '#D8DEE9',
    backgroundColor: '#FCFCFD',
  },
  optionCardSelected: {
    backgroundColor: '#FFFAFA',
    borderColor: COLORS.coral,
    borderWidth: 1.5,
    shadowColor: COLORS.coral,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  optionLabelSelected: {
    color: COLORS.black,
    fontWeight: '800',
  },
  selectRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  selectRingActive: {
    backgroundColor: COLORS.coral,
    borderColor: COLORS.coral,
  },

  reviewTitleAction: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 38,
    color: COLORS.coral,
    fontStyle: 'italic',
    letterSpacing: -0.8,
    marginTop: -4,
  },
  milestoneBlock: {
    gap: 0,
    paddingVertical: 4,
  },
  milestoneAction: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    lineHeight: 27,
    color: COLORS.muted,
    fontStyle: 'italic',
    letterSpacing: -0.4,
  },
  milestoneValue: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    color: COLORS.coral,
    letterSpacing: -1,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  milestoneValueUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: -0.2,
  },
  milestoneSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.muted,
    marginTop: 4,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  reviewIconWell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTextWrap: {
    flex: 1,
  },
  reviewRewardLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  reviewRewardHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.coralLight,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.coral,
  },
  reviewEmptyCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  reviewEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
  },
  reviewEmptyHint: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.coral,
    marginTop: 4,
  },

  footer: {
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  mainButton: {
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
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
    letterSpacing: -0.3,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  modalBtn: {
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
