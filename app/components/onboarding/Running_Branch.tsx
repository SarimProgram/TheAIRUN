import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Activity,
  ChevronLeft,
  ArrowRight,
  Footprints,
  Target,
  Sprout,
  TrendingUp,
  Trophy,
  Calendar,
  CalendarRange,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getGenderMascotSource } from '../../utils/genderMascot';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const height = Math.min(windowHeight, 800);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;
const PICKER_ITEM_HEIGHT = 32;
const PICKER_HEIGHT = PICKER_ITEM_HEIGHT * 3;

const COLORS = {
  brand: '#FF6B6B', // Vibrant Coral
  brandDark: '#EE5253',
  ink: '#121212',
  white: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.95)',
  border: '#F0F0F0',
  muted: '#999999',
  accent: '#FFF0F0',
  offWhite: '#F5F5F7',
};

const STEPS = [
  {
    id: 'trainingGoal',
    title: "I'm training for...",
    desc: 'Pick your primary running objective.',
    options: [
      { id: '5k', iconLabel: '5K', desc: 'Speed & power' },
      { id: '10k', iconLabel: '10K', desc: 'Balance & pace' },
      { id: 'halfMarathon', iconLabel: 'Half Marathon', desc: 'Stamina & grit' },
      { id: 'speedImprovement', iconLabel: 'PR', desc: 'Speed work' },
    ],
  },
  {
    id: 'experience',
    title: "My running level is...",
    desc: 'Be honest to get the best training plan.',
    options: [
      { id: 'beginner', label: 'Beginner', iconComponent: Sprout, desc: 'New or starting over' },
      { id: 'intermediate', label: 'Intermediate', iconComponent: TrendingUp, desc: 'Consistent weekly runner' },
      { id: 'advanced', label: 'Advanced', iconComponent: Trophy, desc: 'Experienced competitive athlete' },
    ],
  },
  {
    id: 'easyBaseline',
    title: 'Easy Pace',
    desc: 'What finish time feels comfortable for you?',
    options: [],
  },
  {
    id: 'raceDate',
    title: "Do you have a race day?",
    desc: "We'll shape your plan around your timeline.",
    options: [
      {
        id: 'yes',
        label: 'Yes, I have a date',
        iconComponent: Calendar,
        hasDatePicker: true,
        desc: "Pick your event and we'll count down to it",
      },
      {
        id: 'notYet',
        label: 'Not yet',
        iconComponent: CalendarRange,
        desc: 'Train on a flexible schedule for now',
      },
    ],
  },
  {
    id: 'dietStrategy',
    title: "What's your food goal?",
    desc: 'Pick what fits you best.',
    options: [
      { id: 'performance', label: 'Fuel my runs', icon: 'food-apple-outline', desc: 'More energy for training' },
      { id: 'weightloss', label: 'Lose a little weight', icon: 'scale-bathroom', desc: 'Support steady weight loss' },
    ],
  },
  {
    id: 'priority',
    title: 'Your focus',
    desc: 'Pick what matters most.',
    options: [
      { id: 'faster', label: 'Get faster', iconComponent: Target, desc: 'More speed' },
      { id: 'longer', label: 'Go longer', iconComponent: Footprints, desc: 'More distance' },
      { id: 'form', label: 'Run smoothly', iconComponent: Activity, desc: 'Better form' },
    ],
  },
];

const RUN_BASELINE_CONFIG: Record<string, { label: string; distanceKm: number; defaultMinutes: number }> = {
  '5k': { label: '5K', distanceKm: 5, defaultMinutes: 35 },
  '10k': { label: '10K', distanceKm: 10, defaultMinutes: 70 },
  'halfMarathon': { label: 'Half Marathon', distanceKm: 21.1, defaultMinutes: 150 },
  speedImprovement: { label: 'easy 5K', distanceKm: 5, defaultMinutes: 35 },
};
const MINUTE_OPTIONS = Array.from({ length: 231 }, (_, index) => index + 10);
const SECOND_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

export default function RunningBranch({ onComplete, onBack, skipDietStrategy = false, gender, initialData }: any) {
  const steps = skipDietStrategy
    ? STEPS.filter((step) => step.id !== 'dietStrategy')
    : STEPS;
  const [currentStep, setCurrentStep] = useState(() => initialData ? steps.length - 1 : 0);
  const [selections, setSelections] = useState<Record<string, string>>(() => initialData ? {
    trainingGoal: initialData.trainingGoal,
    experience: initialData.experience,
    raceDate: initialData.raceDateSelection ?? (initialData.raceDate ? 'yes' : 'notYet'),
    dietStrategy: initialData.dietStrategy,
    priority: initialData.priority,
  } : {});
  const [raceDate, setRaceDate] = useState<Date | null>(() => initialData?.raceDate ? new Date(initialData.raceDate) : null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [easyMinutes, setEasyMinutes] = useState(initialData?.easyMinutes ?? 35);
  const [easySeconds, setEasySeconds] = useState(initialData?.easySeconds ?? 0);
  const [baselineMode, setBaselineMode] = useState<'estimate' | 'absolute_new'>(initialData?.baselineMode ?? 'absolute_new');
  const minuteScrollRef = useRef<ScrollView | null>(null);
  const secondScrollRef = useRef<ScrollView | null>(null);
  const shouldInitializeBaselineRef = useRef(!initialData);

  useEffect(() => {
    const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal];
    if (baselineConfig && shouldInitializeBaselineRef.current) {
      setEasyMinutes(baselineConfig.defaultMinutes);
      setEasySeconds(0);
    }
    shouldInitializeBaselineRef.current = true;
  }, [selections.trainingGoal]);

  useEffect(() => {
    const minuteIndex = Math.max(0, MINUTE_OPTIONS.indexOf(easyMinutes));
    const secondIndex = Math.max(0, SECOND_OPTIONS.indexOf(easySeconds));
    const timer = setTimeout(() => {
      minuteScrollRef.current?.scrollTo({ y: minuteIndex * PICKER_ITEM_HEIGHT, animated: false });
      secondScrollRef.current?.scrollTo({ y: secondIndex * PICKER_ITEM_HEIGHT, animated: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [easyMinutes, easySeconds, currentStep]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCalendar(false);
      if (selectedDate) {
        setRaceDate(selectedDate);
        setSelections({ ...selections, raceDate: 'yes' });
      }
    } else if (selectedDate) {
      setRaceDate(selectedDate);
    }
  };

  const confirmIosDate = () => {
    if (raceDate) {
      setSelections({ ...selections, raceDate: 'yes' });
      setShowCalendar(false);
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      const nextStep = steps[currentStep + 1];
      if (nextStep.id === 'priority' && selections.experience === 'beginner') {
          setSelections(prev => ({ ...prev, priority: 'form' }));
      }
      setCurrentStep(currentStep + 1);
    } else {
      const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal] || RUN_BASELINE_CONFIG['5k'];
      const baselinePaceSecPerKm = baselineMode === 'absolute_new'
        ? 9 * 60
        : Math.round(((easyMinutes * 60) + easySeconds) / baselineConfig.distanceKm);

      onComplete?.({
        ...selections,
        raceDate: raceDate?.toISOString() || null,
        raceDateSelection: selections.raceDate,
        easyMinutes,
        easySeconds,
        baselineMode,
        baselinePaceSecPerKm,
        isAbsoluteNewToRunning: baselineMode === 'absolute_new',
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack?.();
    }
  };

  const toggleSelection = (id: string, hasDatePicker?: boolean) => {
    if (hasDatePicker) {
      if (!raceDate) setRaceDate(new Date());
      setShowCalendar(true);
      return;
    }
    setSelections({ ...selections, [steps[currentStep].id]: id });
  };

  const stepData = steps[currentStep];
  const selectedOptionId = selections[stepData.id];
  const baselineConfig = RUN_BASELINE_CONFIG[selections.trainingGoal] || RUN_BASELINE_CONFIG['5k'];
  const baselinePaceSecPerKm = baselineMode === 'absolute_new'
    ? 9 * 60
    : Math.round(((easyMinutes * 60) + easySeconds) / baselineConfig.distanceKm);
  const baselinePaceMinutes = Math.floor(baselinePaceSecPerKm / 60);
  const baselinePaceSeconds = baselinePaceSecPerKm % 60;
  const isButtonActive = stepData.id === 'easyBaseline' ? true : !!selectedOptionId;
  const mascotSource = getGenderMascotSource(gender);

  const stepTitle = stepData.id === 'easyBaseline'
    ? "Let's find your starting pace"
    : stepData.title;
  const stepDesc = stepData.id === 'easyBaseline'
    ? 'Pick what feels right for you.'
    : stepData.desc;
  const selectedGoalOption = stepData.id === 'trainingGoal'
    ? stepData.options.find((item: any) => item.id === selectedOptionId)
    : null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectMinute = (value: number) => {
    setBaselineMode('estimate');
    setEasyMinutes(value);
  };

  const selectSecond = (value: number) => {
    setBaselineMode('estimate');
    setEasySeconds(value);
  };

  return (
    <View style={styles.container}>
        <View style={[styles.fixedHeader, useCompactLayout && styles.fixedHeaderCompact]}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <Text style={styles.watermarkText}>RUNNING</Text>
                <SafeAreaView>
                    <View style={[styles.navRow, useCompactLayout && styles.navRowCompact]}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={[styles.backBtn, useCompactLayout && styles.backBtnCompact]}
                        >
                            <ChevronLeft color={COLORS.white} size={28} />
                        </TouchableOpacity>
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
                        </View>
                    </View>
                </SafeAreaView>
                
                <View style={[styles.mascotWrapper, useCompactLayout && styles.mascotWrapperCompact]} pointerEvents="none">
                    <Image
                        source={mascotSource}
                        style={[styles.heroMascot, useCompactLayout && styles.heroMascotCompact]}
                        contentFit="contain"
                    />
                </View>
            </LinearGradient>
        </View>

      <View
        style={[
            styles.contentMask,
            useCompactLayout && styles.contentMaskCompact,
        ]}
      >
        <View style={styles.content}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, useCompactLayout && styles.scrollContentCompact]}
            >
                <View style={[styles.textGroup, useCompactLayout && styles.textGroupCompact]}>
                    <Text style={[styles.mainTitle, useCompactLayout && styles.mainTitleCompact]}>{stepTitle}</Text>
                    <Text style={[styles.subTitle, useCompactLayout && styles.subTitleCompact]}>{stepDesc}</Text>
                </View>

                {stepData.id === 'easyBaseline' ? (
                    <View style={[styles.optionStack, useCompactLayout && styles.optionStackCompact]}>
                        {selections.trainingGoal === 'speedImprovement' && (
                            <View style={[styles.recommendNote, useCompactLayout && styles.recommendNoteCompact]}>
                                <Text style={[styles.recommendNoteText, useCompactLayout && styles.recommendNoteTextCompact]}>
                                    For speed work, we use your <Text style={{ fontWeight: '900' }}>easy 5K pace</Text> as the starting point.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={() => setBaselineMode('absolute_new')}
                            activeOpacity={0.8}
                            style={[
                                styles.optionCard,
                                useCompactLayout && styles.optionCardCompact,
                                baselineMode === 'absolute_new' && styles.optionCardActive
                            ]}
                        >
                            <View style={[styles.iconWrap, useCompactLayout && styles.iconWrapCompact, baselineMode === 'absolute_new' && styles.iconWrapActive]}>
                                <MaterialCommunityIcons
                                    name="run-fast"
                                    size={useCompactLayout ? 21 : 24}
                                    color={baselineMode === 'absolute_new' ? COLORS.white : COLORS.brand}
                                />
                            </View>
                            <View style={[styles.optionTextWrap, useCompactLayout && styles.optionTextWrapCompact]}>
                                <Text style={[styles.optionTitle, useCompactLayout && styles.optionTitleCompact, baselineMode === 'absolute_new' && { color: COLORS.brand }]}>
                                    I am new to running
                                </Text>
                                <Text style={[styles.optionSub, useCompactLayout && styles.optionSubCompact]}>
                                    Use a gentle starting pace.
                                </Text>
                            </View>
                            <MaterialCommunityIcons
                                name={baselineMode === 'absolute_new' ? 'check-circle' : 'chevron-right'}
                                size={24}
                                color={baselineMode === 'absolute_new' ? COLORS.brand : '#E2E8F0'}
                            />
                        </TouchableOpacity>

                        <View
                            style={[
                                styles.optionCard,
                                useCompactLayout && styles.optionCardCompact,
                                { flexDirection: 'column', alignItems: 'stretch' },
                                baselineMode === 'estimate' && styles.optionCardActive
                            ]}
                        >
                            <TouchableOpacity
                                onPress={() => setBaselineMode('estimate')}
                                activeOpacity={0.8}
                                style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                                <View style={[styles.iconWrap, useCompactLayout && styles.iconWrapCompact, baselineMode === 'estimate' && styles.iconWrapActive]}>
                                    <MaterialCommunityIcons
                                        name="timer-outline"
                                        size={useCompactLayout ? 21 : 24}
                                        color={baselineMode === 'estimate' ? COLORS.white : COLORS.brand}
                                    />
                                </View>
                                <View style={[styles.optionTextWrap, useCompactLayout && styles.optionTextWrapCompact]}>
                                    <Text style={[styles.optionTitle, useCompactLayout && styles.optionTitleCompact, baselineMode === 'estimate' && { color: COLORS.brand }]}>
                                        I know my pace
                                    </Text>
                                    <Text style={[styles.optionSub, useCompactLayout && styles.optionSubCompact]}>
                                        Select your comfortable finishing time.
                                    </Text>
                                </View>
                                <MaterialCommunityIcons
                                    name={baselineMode === 'estimate' ? 'check-circle' : 'chevron-right'}
                                    size={24}
                                    color={baselineMode === 'estimate' ? COLORS.brand : '#E2E8F0'}
                                />
                            </TouchableOpacity>

                            {baselineMode === 'estimate' && (
                                <View style={[styles.baselineCard, useCompactLayout && styles.baselineCardCompact]}>
                                    <View style={[styles.mainSelectionRow, useCompactLayout && styles.mainSelectionRowCompact]}>
                                        <View style={styles.leftPaceColumn}>
                                            <View style={styles.timePickerRow}>
                                                <View style={styles.pickerBlock}>
                                                    <Text style={styles.pickerLabel}>MINUTES</Text>
                                                    <View style={styles.pickerShell}>
                                                        <View style={styles.pickerCenterHighlight} pointerEvents="none" />
                                                        <ScrollView
                                                            ref={minuteScrollRef}
                                                            showsVerticalScrollIndicator={false}
                                                            snapToInterval={PICKER_ITEM_HEIGHT}
                                                            decelerationRate="fast"
                                                            onMomentumScrollEnd={(e) => {
                                                                const index = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                                                                if (MINUTE_OPTIONS[index]) selectMinute(MINUTE_OPTIONS[index]);
                                                            }}
                                                            contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                                                        >
                                                            {MINUTE_OPTIONS.map((m) => (
                                                                <View key={`min-${m}`} style={styles.pickerItem}>
                                                                    <Text style={[styles.pickerItemText, easyMinutes === m && styles.pickerItemTextActive]}>
                                                                        {m}
                                                                    </Text>
                                                                </View>
                                                            ))}
                                                        </ScrollView>
                                                    </View>
                                                </View>

                                                <View style={styles.pickerBlock}>
                                                    <Text style={styles.pickerLabel}>SECONDS</Text>
                                                    <View style={styles.pickerShell}>
                                                        <View style={styles.pickerCenterHighlight} pointerEvents="none" />
                                                        <ScrollView
                                                            ref={secondScrollRef}
                                                            showsVerticalScrollIndicator={false}
                                                            snapToInterval={PICKER_ITEM_HEIGHT}
                                                            decelerationRate="fast"
                                                            onMomentumScrollEnd={(e) => {
                                                                const index = Math.round(e.nativeEvent.contentOffset.y / PICKER_ITEM_HEIGHT);
                                                                if (SECOND_OPTIONS[index] !== undefined) selectSecond(SECOND_OPTIONS[index]);
                                                            }}
                                                            contentContainerStyle={{ paddingVertical: PICKER_ITEM_HEIGHT }}
                                                        >
                                                            {SECOND_OPTIONS.map((s) => (
                                                                <View key={`sec-${s}`} style={styles.pickerItem}>
                                                                    <Text style={[styles.pickerItemText, easySeconds === s && styles.pickerItemTextActive]}>
                                                                        {String(s).padStart(2, '0')}
                                                                    </Text>
                                                                </View>
                                                            ))}
                                                        </ScrollView>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.rightStatsColumn}>
                                            <View style={[styles.statsCard, useCompactLayout && styles.statsCardCompact]}>
                                                <Text style={styles.statsLabel}>KM AVG</Text>
                                                <Text style={[styles.statsValue, useCompactLayout && styles.statsValueCompact]}>
                                                    {baselinePaceMinutes}:{String(baselinePaceSeconds).padStart(2, '0')}
                                                </Text>
                                                <Text style={styles.statsUnit}>/km</Text>
                                                <View style={[styles.statsDivider, useCompactLayout && styles.statsDividerCompact]} />
                                                <Text style={[styles.totalSummaryText, useCompactLayout && styles.totalSummaryTextCompact]}>
                                                    {easyMinutes}:{String(easySeconds).padStart(2, '0')} total
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {baselineMode === 'absolute_new' && (
                            <View style={[styles.recommendNote, useCompactLayout && styles.recommendNoteCompact]}>
                                <Text style={[styles.recommendNoteText, useCompactLayout && styles.recommendNoteTextCompact]}>
                                    Starting pace: <Text style={{ fontWeight: '900' }}>{baselinePaceMinutes}:{String(baselinePaceSeconds).padStart(2, '0')} /km</Text>
                                </Text>
                            </View>
                        )}
                    </View>
                ) : stepData.id === 'trainingGoal' ? (
                    <View style={[styles.goalPicker, useCompactLayout && styles.goalPickerCompact]}>
                        <View style={[styles.goalHero, useCompactLayout && styles.goalHeroCompact]}>
                            <Text style={[
                                styles.goalHeroBadge,
                                useCompactLayout && styles.goalHeroBadgeCompact,
                                (selectedGoalOption?.iconLabel?.length ?? 0) > 5 && styles.goalHeroBadgeLong,
                                (selectedGoalOption?.iconLabel?.length ?? 0) > 5 && useCompactLayout && styles.goalHeroBadgeLongCompact,
                                !selectedGoalOption && styles.goalHeroBadgeMuted,
                            ]}>
                                {selectedGoalOption?.iconLabel ?? 'None'}
                            </Text>
                            <Text style={[styles.goalHeroDesc, useCompactLayout && styles.goalHeroDescCompact]}>
                                {selectedGoalOption?.desc ?? 'Tap a distance below'}
                            </Text>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[styles.goalPillRow, useCompactLayout && styles.goalPillRowCompact]}
                        >
                            {stepData.options.map((item: any) => {
                                const isSelected = selectedOptionId === item.id;

                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        onPress={() => toggleSelection(item.id)}
                                        activeOpacity={0.85}
                                        style={[
                                            styles.goalPill,
                                            useCompactLayout && styles.goalPillCompact,
                                            isSelected && styles.goalPillSelected,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.goalPillText,
                                            useCompactLayout && styles.goalPillTextCompact,
                                            isSelected && styles.goalPillTextSelected,
                                        ]}>
                                            {item.iconLabel}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={[styles.optionStack, useCompactLayout && styles.optionStackCompact]}>
                        {stepData.options.map((item: any) => {
                            const isSelected = selectedOptionId === item.id;
                            const showDateLabel = item.hasDatePicker && raceDate && isSelected;
                            const IconComponent = item.iconComponent;

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    onPress={() => toggleSelection(item.id, item.hasDatePicker)}
                                    activeOpacity={0.8}
                                    style={[
                                        styles.optionCard,
                                        useCompactLayout && styles.optionCardCompact,
                                        isSelected && styles.optionCardActive
                                    ]}
                                >
                                    <View style={[styles.iconWrap, useCompactLayout && styles.iconWrapCompact, isSelected && styles.iconWrapActive]}>
                                        {IconComponent ? (
                                            <IconComponent
                                                size={useCompactLayout ? 20 : 22}
                                                strokeWidth={2.4}
                                                color={isSelected ? COLORS.white : COLORS.brand}
                                            />
                                        ) : (
                                            <MaterialCommunityIcons
                                                name={item.icon as any}
                                                size={useCompactLayout ? 21 : 24}
                                                color={isSelected ? COLORS.white : COLORS.brand}
                                            />
                                        )}
                                    </View>
                                    <View style={[styles.optionTextWrap, useCompactLayout && styles.optionTextWrapCompact]}>
                                        <Text style={[styles.optionTitle, useCompactLayout && styles.optionTitleCompact, isSelected && { color: COLORS.brand }]}>
                                            {showDateLabel ? formatDate(raceDate) : item.label}
                                        </Text>
                                        {!!item.desc && !showDateLabel && (
                                            <Text style={[styles.optionSub, useCompactLayout && styles.optionSubCompact]}>
                                                {item.desc}
                                            </Text>
                                        )}
                                        {showDateLabel && (
                                            <Text style={[styles.optionSub, useCompactLayout && styles.optionSubCompact, isSelected && { color: COLORS.brand }]}>
                                                Race day selected
                                            </Text>
                                        )}
                                    </View>
                                    <MaterialCommunityIcons
                                        name={isSelected ? "check-circle" : "chevron-right"}
                                        size={24}
                                        color={isSelected ? COLORS.brand : "#E2E8F0"}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {stepData.id === 'priority' && selections.experience === 'beginner' && (
                    <View style={[styles.recommendNote, useCompactLayout && styles.recommendNoteCompact]}>
                        <Text style={[styles.recommendNoteText, useCompactLayout && styles.recommendNoteTextCompact]}>
                            Beginners: try <Text style={{ fontWeight: '900' }}>Run smoothly</Text> first.
                        </Text>
                    </View>
                )}
                
                <View style={{ height: useCompactLayout ? 16 : 40 }} />
            </ScrollView>

            <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
                <TouchableOpacity 
                    disabled={!isButtonActive}
                    onPress={handleNext}
                    style={[styles.nextBtn, useCompactLayout && styles.nextBtnCompact, !isButtonActive && styles.nextBtnDisabled]}
                    activeOpacity={0.9}
                >
                    <Text style={[styles.nextBtnText, useCompactLayout && styles.nextBtnTextCompact]}>
                        Continue
                    </Text>
                    <View style={[styles.nextIconWrap, useCompactLayout && styles.nextIconWrapCompact]}>
                        <ArrowRight color={COLORS.white} size={useCompactLayout ? 18 : 20} strokeWidth={3} />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
      </View>

      {/* iOS Modal Calendar */}
      {Platform.OS === 'ios' && (
        <Modal animationType="fade" transparent={true} visible={showCalendar}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Race Date</Text>
              <DateTimePicker
                value={raceDate || new Date()}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={onDateChange}
                style={styles.modalCalendar}
                accentColor={COLORS.brand}
              />
              <TouchableOpacity style={styles.modalButton} onPress={confirmIosDate}>
                <Text style={styles.modalButtonText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showCalendar && Platform.OS === 'android' && (
        <DateTimePicker
            value={raceDate || new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={onDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    width: width,
  },
  fixedHeaderCompact: {
    height: height * 0.38,
  },
  hero: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: 'flex-start',
  },
  watermarkText: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    width: width,
    textAlign: 'center',
    fontSize: 52,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: -1,
    zIndex: 0,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 15,
  },
  navRowCompact: {
    marginTop: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
  },
  backBtnCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginRight: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  mascotWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: height * 0.08,
  },
  mascotWrapperCompact: {
    paddingBottom: height * 0.05,
  },
  heroMascot: {
    width: width * 0.55,
    height: width * 0.55,
  },
  heroMascotCompact: {
    width: width * 0.45,
    height: width * 0.45,
  },
  contentMask: {
    flex: 1,
    marginTop: height * 0.33,
  },
  contentMaskCompact: {
    marginTop: height * 0.28,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 160,
  },
  scrollContentCompact: {
    paddingTop: 26,
    paddingBottom: 112,
  },
  textGroup: {
    marginBottom: 30,
  },
  textGroupCompact: {
    marginBottom: 18,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -1,
  },
  mainTitleCompact: {
    fontSize: 28,
  },
  subTitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 10,
    lineHeight: 24,
  },
  subTitleCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  optionStack: {
    gap: 10,
  },
  optionStackCompact: {
    gap: 8,
  },
  goalPicker: {
    gap: 28,
    paddingTop: 8,
  },
  goalPickerCompact: {
    gap: 22,
    paddingTop: 4,
  },
  goalHero: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    borderRadius: 32,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  goalHeroCompact: {
    minHeight: 150,
    borderRadius: 26,
    paddingVertical: 24,
  },
  goalHeroBadge: {
    fontSize: 72,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -4,
    lineHeight: 76,
    textAlign: 'center',
  },
  goalHeroBadgeCompact: {
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -3,
  },
  goalHeroBadgeLong: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
  },
  goalHeroBadgeLongCompact: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
  },
  goalHeroBadgeMuted: {
    color: '#D1D5DB',
  },
  goalHeroDesc: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  goalHeroDescCompact: {
    marginTop: 8,
    fontSize: 14,
  },
  goalPillRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  goalPillRowCompact: {
    gap: 8,
  },
  goalPill: {
    minWidth: 76,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPillCompact: {
    minWidth: 68,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  goalPillSelected: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  goalPillText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.4,
  },
  goalPillTextCompact: {
    fontSize: 15,
  },
  goalPillTextSelected: {
    color: COLORS.white,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  optionCardCompact: {
    padding: 10,
    borderRadius: 18,
  },
  optionCardActive: {
    backgroundColor: '#FFF0F0',
    borderColor: COLORS.brand,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
  },
  iconWrapCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: COLORS.brand,
  },
  optionTextWrap: {
    flex: 1,
    marginLeft: 15,
  },
  optionTextWrapCompact: {
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  optionTitleCompact: {
    fontSize: 14,
  },
  optionSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  optionSubCompact: {
    fontSize: 11,
  },
  baselineCardMuted: {
    opacity: 0.55,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerBlock: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
    marginBottom: 6,
    textAlign: 'center',
  },
  pickerShell: {
    height: PICKER_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    position: 'relative',
  },
  pickerSpacer: {
    height: PICKER_ITEM_HEIGHT,
  },
  pickerItem: {
    height: PICKER_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.muted,
  },
  pickerItemTextActive: {
    color: COLORS.ink,
    fontWeight: '900',
  },
  pickerCenterHighlight: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: PICKER_ITEM_HEIGHT,
    height: PICKER_ITEM_HEIGHT,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: '#FFD8D8',
  },
  timeDisplay: {
    alignItems: 'center',
    marginBottom: 25,
  },
  timeDisplayValue: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.brand,
    letterSpacing: -2,
  },
  timeDisplayLabel: {
    fontSize: 20,
    color: COLORS.muted,
    fontWeight: '600',
  },
  timeDisplaySub: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: '600',
  },
  baselineCard: {
    paddingVertical: 10,
  },
  baselineCardCompact: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  tappableGroup: {
    width: '100%',
  },
  pillScrollContent: {
    paddingRight: 20,
    gap: 10,
  },
  pill: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  pillActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  pillText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
  pillTextActive: {
    color: COLORS.white,
  },
  mainSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  mainSelectionRowCompact: {
    gap: 10,
  },
  leftPaceColumn: {
    flex: 0.65,
  },
  sliderGroup: {
    width: '100%',
  },
  compactLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.muted,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  rightStatsColumn: {
    flex: 0.35,
    height: '100%',
    justifyContent: 'center',
  },
  statsCard: {
    backgroundColor: '#FAFAFA',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statsCardCompact: {
    padding: 10,
    borderRadius: 14,
  },
  statsLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.brand,
    letterSpacing: -1,
  },
  statsValueCompact: {
    fontSize: 16,
  },
  statsUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: -2,
  },
  statsDivider: {
    width: '80%',
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 10,
  },
  statsDividerCompact: {
    marginVertical: 7,
  },
  totalSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ink,
    opacity: 0.6,
  },
  totalSummaryTextCompact: {
    fontSize: 10,
  },
  recommendNote: {
    padding: 16,
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  recommendNoteCompact: {
    padding: 12,
    borderRadius: 16,
    marginTop: 14,
  },
  recommendNoteText: {
    fontSize: 13,
    color: COLORS.brandDark,
    lineHeight: 18,
    fontWeight: '600',
  },
  recommendNoteTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    paddingTop: 15,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  footerCompact: {
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 18,
  },
  nextBtn: {
    backgroundColor: COLORS.ink,
    height: 70,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  nextBtnCompact: {
    height: 58,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  nextBtnDisabled: {
    backgroundColor: COLORS.offWhite,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  nextBtnTextCompact: {
    fontSize: 16,
  },
  nextIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextIconWrapCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 24,
    width: width * 0.9,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 20,
  },
  modalCalendar: {
    width: '100%',
    height: 340,
  },
  modalButton: {
    backgroundColor: COLORS.ink,
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
});
