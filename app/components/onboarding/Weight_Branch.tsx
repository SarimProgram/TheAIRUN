import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  ArrowRight,
} from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getGenderMascotSource } from '../../utils/genderMascot';

const { width, height } = Dimensions.get('window');

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
    id: 'timeline',
    title: 'Your Timeline',
    desc: 'How would you like to achieve your goal?',
    options: [
      { id: 'moderate', label: 'Slow & Steady', icon: 'chart-timeline-variant', desc: 'Balanced transformation' },
      { id: 'aggressive', label: 'Aggressive', icon: 'fire', desc: 'Quickest sustainable path' },
      { id: 'custom', label: 'By a Date', icon: 'calendar-star', desc: 'Pick your own target' },
    ],
  },
  {
    id: 'trainingStyle',
    title: 'Training Method',
    desc: 'How do you want to lose the weight?',
    options: [
      { id: 'walkOnly', label: 'Walk Only', icon: 'walk', desc: 'Sustainable & low impact' },
      { id: 'runOnly', label: 'Running Only', icon: 'run', desc: 'High intensity cardio' },
      { id: 'walkAndRun', label: 'Walk + Run', icon: 'vector-combine', desc: 'The most effective hybrid' },
    ],
  },
  {
    id: 'raceTraining',
    title: 'Race Goal',
    desc: 'Do you have a race specific goal or race date?',
    options: [
      { id: 'yes', label: 'Yes, specific Run', icon: 'flag-checkered', desc: 'Preparing for an run event' },
      { id: 'no', label: 'Just weight loss', icon: 'heart-pulse', desc: 'General Weight Loss' },
    ],
  },
];

export default function WeightBranch({ onComplete, currentWeight, targetWeight, unit, gender }: any) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calculatedWeeks, setCalculatedWeeks] = useState<number | null>(null);
  const [isViable, setIsViable] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const direction = useRef(1);

  useEffect(() => {
    runEnterAnimation();
  }, [currentStep]);

  const runEnterAnimation = () => {
    fadeAnim.setValue(currentStep === 0 ? 0 : 0.4);
    slideAnim.setValue(20);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, useNativeDriver: true })
    ]).start();
  };

  const calculateWeeksFromDate = (date: Date) => {
    const diff = date.getTime() - new Date().getTime();
    const weeks = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7));
    setCalculatedWeeks(weeks);

    const weightDiff = Math.abs(Number(currentWeight) - Number(targetWeight));
    const minWeeksRequired = weightDiff / 1.0; 

    setIsViable(!(weeks < minWeeksRequired && weightDiff > 0));
    return weeks;
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCalendar(false);
      if (selectedDate) {
        setTargetDate(selectedDate);
        calculateWeeksFromDate(selectedDate);
        setSelections({ ...selections, timeline: 'custom' });
      }
    } else if (selectedDate) {
      setTargetDate(selectedDate);
    }
  };

  const confirmIosDate = () => {
    if (targetDate) {
      calculateWeeksFromDate(targetDate);
      setSelections({ ...selections, timeline: 'custom' });
      setShowCalendar(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && selections.trainingStyle === 'walkOnly') {
      onComplete?.({ ...selections, targetDate, calculatedWeeks });
      return;
    }

    if (currentStep < STEPS.length - 1) {
      direction.current = 1;
      setCurrentStep(currentStep + 1);
    } else {
      onComplete?.({ ...selections, targetDate, calculatedWeeks });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      direction.current = -1;
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleSelection = (id: string) => {
    if (id === 'custom') {
      if (!targetDate) setTargetDate(new Date());
      setShowCalendar(true);
      return;
    }

    const weightDiff = Math.abs(Number(currentWeight) - Number(targetWeight));
    if (id === 'moderate') {
      setCalculatedWeeks(Math.ceil(weightDiff / 0.5));
      setIsViable(true);
    } else if (id === 'aggressive') {
      setCalculatedWeeks(Math.ceil(weightDiff / 1.0));
      setIsViable(true);
    } else {
      setCalculatedWeeks(null);
      setIsViable(true);
    }

    setSelections({ ...selections, [STEPS[currentStep].id]: id });
  };

  const stepData = STEPS[currentStep];
  const selectedOptionId = selections[stepData.id];
  const isButtonActive = !!selectedOptionId;
  const mascotSource = getGenderMascotSource(gender);

  return (
    <View style={styles.container}>
        <View style={styles.fixedHeader}>
            <LinearGradient colors={[COLORS.brand, COLORS.brandDark]} style={styles.hero}>
                <Text style={styles.watermarkText}>WEIGHT LOSS</Text>
                <SafeAreaView>
                    <View style={styles.navRow}>
                        <TouchableOpacity onPress={handleBack} style={[styles.backBtn, currentStep === 0 && { opacity: 0 }]} disabled={currentStep === 0}>
                            <ChevronLeft color={COLORS.white} size={28} />
                        </TouchableOpacity>
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${((currentStep + 1) / STEPS.length) * 100}%` }]} />
                        </View>
                    </View>
                </SafeAreaView>
                
                <View style={styles.mascotWrapper} pointerEvents="none">
                    <Image
                        source={mascotSource}
                        style={styles.heroMascot}
                        contentFit="contain"
                    />
                </View>
            </LinearGradient>
        </View>

      <Animated.View 
        style={[
            styles.contentMask, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.content}>
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.textGroup}>
                    <Text style={styles.mainTitle}>{stepData.title}</Text>
                    <Text style={styles.subTitle}>{stepData.desc}</Text>
                </View>

                <View style={styles.optionStack}>
                    {stepData.options.map((item) => {
                        const isSelected = selectedOptionId === item.id;
                        return (
                            <TouchableOpacity 
                                key={item.id}
                                onPress={() => toggleSelection(item.id)}
                                activeOpacity={0.8}
                                style={[
                                    styles.optionCard,
                                    isSelected && styles.optionCardActive
                                ]}
                            >
                                <View style={[styles.iconWrap, isSelected && styles.iconWrapActive]}>
                                    <MaterialCommunityIcons 
                                        name={item.icon as any} 
                                        size={24} 
                                        color={isSelected ? COLORS.white : COLORS.brand} 
                                    />
                                </View>
                                <View style={styles.optionTextWrap}>
                                    <Text style={[styles.optionTitle, isSelected && { color: COLORS.brand }]}>{item.label}</Text>
                                    <Text style={styles.optionSub}>{item.desc}</Text>
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

                {currentStep === 0 && calculatedWeeks !== null && (
                    <View style={[styles.weeksBadge, !isViable && styles.weeksBadgeWarning]}>
                        <Text style={[styles.weeksText, !isViable && styles.weeksTextWarning]}>
                            {selections.timeline === 'custom' && targetDate
                                ? `Target: ${targetDate.toLocaleDateString()} • ${calculatedWeeks} weeks`
                                : isViable
                                    ? `Estimated: ${calculatedWeeks} weeks until goal`
                                    : `⚠️ Too aggressive (${calculatedWeeks} weeks). Try a later date.`}
                        </Text>
                    </View>
                )}
                
                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity 
                    disabled={!isButtonActive}
                    onPress={handleNext}
                    style={[styles.nextBtn, !isButtonActive && styles.nextBtnDisabled]}
                    activeOpacity={0.9}
                >
                    <Text style={styles.nextBtnText}>
                        {currentStep === STEPS.length - 1 ? 'Unlock My Plan' : 'Continue'}
                    </Text>
                    <View style={styles.nextIconWrap}>
                        <ArrowRight color={COLORS.white} size={20} strokeWidth={3} />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
      </Animated.View>

      {/* iOS Modal Calendar */}
      {Platform.OS === 'ios' && (
        <Modal animationType="fade" transparent={true} visible={showCalendar}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Target Date</Text>
              <DateTimePicker
                value={targetDate || new Date()}
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
            value={targetDate || new Date()}
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
    height: height * 0.45,
    width: width,
  },
  hero: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: 'flex-start',
  },
  watermarkText: {
    position: 'absolute',
    top: height * 0.14,
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
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
  heroMascot: {
    width: width * 0.55,
    height: width * 0.55,
  },
  contentMask: {
    flex: 1,
    marginTop: -height * 0.12,
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
  textGroup: {
    marginBottom: 30,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -1,
  },
  subTitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 10,
    lineHeight: 24,
  },
  optionStack: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  optionCardActive: {
    backgroundColor: '#FFF0F0',
    borderColor: COLORS.brand,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
  },
  iconWrapActive: {
    backgroundColor: COLORS.brand,
  },
  optionTextWrap: {
    flex: 1,
    marginLeft: 15,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
  },
  optionSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  weeksBadge: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
  },
  weeksBadgeWarning: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFE0E0',
  },
  weeksText: {
    fontSize: 14,
    color: COLORS.ink,
    fontWeight: '700',
  },
  weeksTextWarning: {
    color: COLORS.brand,
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
  nextIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
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
