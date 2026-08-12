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
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ChevronLeft, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

const ITEM_HEIGHT = useCompactLayout ? 58 : 70;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const titleSize = useCompactLayout ? 32 : 36;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  selection: '#FFF0F0',
  accent: '#F1F5F9',
};

interface Props {
  onContinue: (data: { weight: number | string, height: number | string, weightUnit: string, heightUnit: string }) => void;
  onBack: () => void;
}

export default function WeightHeightSelection({ onContinue, onBack }: Props) {
  const [step, setStep] = useState(0); // 0: Weight, 1: Height
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');

  // Weight Values
  const kgValues = Array.from({ length: 121 }, (_, i) => i + 30);
  const lbsValues = Array.from({ length: 261 }, (_, i) => i + 70);
  const weightValues = weightUnit === 'kg' ? kgValues : lbsValues;

  // Height Values
  const cmValues = Array.from({ length: 151 }, (_, i) => i + 100);
  // FT values: 3'0" to 8'0"
  const ftValues = Array.from({ length: 61 }, (_, i) => {
    const totalInches = i + 36;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  });
  const heightValues = heightUnit === 'cm' ? cmValues : ftValues;

  const [selectedWeightIndex, setSelectedWeightIndex] = useState(40);
  const [selectedHeightIndex, setSelectedHeightIndex] = useState(70);

  const weightScrollY = useRef(new Animated.Value(0)).current;
  const heightScrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    runEnterAnimation();
  }, [step]);

  const runEnterAnimation = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();
  };

  const onWeightScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: weightScrollY } } }],
    { useNativeDriver: true }
  );

  const onHeightScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: heightScrollY } } }],
    { useNativeDriver: true }
  );

  const renderValue = (val: string | number, index: number, scrollY: any) => {
    const inputRange = [
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.85, 1.15, 0.85],
      extrapolate: 'clamp',
    });

    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    const color = scrollY.interpolate({
      inputRange,
      outputRange: [COLORS.muted, COLORS.black, COLORS.muted],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.itemWrapper} key={index}>
        <Animated.Text style={[styles.valueText, { opacity, transform: [{ scale }], color }]}>
          {val}
        </Animated.Text>
      </View>
    );
  };

  // Visual Ruler Ticks for Height
  const renderRuler = () => {
    return (
      <View style={styles.rulerContainer}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={[styles.rulerTick, i % 5 === 0 ? styles.rulerTickLarge : styles.rulerTickSmall]} />
        ))}
      </View>
    );
  };

  // Visual Indicator for Weight (Removed from here, now at top)
  const renderWeightVisual = () => {
    return null;
  };

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else {
      onContinue({
        weight: weightValues[selectedWeightIndex],
        height: heightValues[selectedHeightIndex],
        weightUnit,
        heightUnit,
      });
    }
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
    } else {
      onBack();
    }
  };

  const renderResultDisplay = (extraStyle?: StyleProp<ViewStyle>) => (
    <View style={[styles.resultDisplay, useCompactLayout && styles.resultDisplayCompact, extraStyle]}>
      <Text style={styles.resultLabel}>{step === 0 ? 'YOUR WEIGHT' : 'YOUR HEIGHT'}</Text>
      <View style={styles.resultRow}>
        <Text style={styles.resultValue}>
          {step === 0 ? weightValues[selectedWeightIndex] : heightValues[selectedHeightIndex]}
        </Text>
        <Text style={styles.resultUnit}>{step === 0 ? weightUnit : (heightUnit === 'cm' ? 'CM' : '')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <View style={[styles.main, useCompactLayout && styles.mainCompact]}>
          <Animated.View style={[
            styles.topSection,
            useCompactLayout && styles.topSectionCompact,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextSide}>
               
                <Text style={styles.title}>
                  {step === 0 ? "What’s your\n" : "How tall are\n"}
                  <Text style={{ color: COLORS.coral }}>{step === 0 ? 'weight?' : 'you?'}</Text>
                </Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              {step === 0
                ? "This helps us make your plan fit you better."
                : "This helps us make your plan feel more personal."}
            </Text>
          </Animated.View>

          {/* Unit Toggle */}
          <View style={[styles.unitToggleRow, useCompactLayout && styles.unitToggleRowCompact]}>
            {step === 0 ? (
              <>
                <TouchableOpacity style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]} onPress={() => setWeightUnit('kg')}>
                  <Text style={[styles.unitBtnText, weightUnit === 'kg' && styles.unitBtnTextActive]}>KG</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.unitBtn, weightUnit === 'lbs' && styles.unitBtnActive]} onPress={() => setWeightUnit('lbs')}>
                  <Text style={[styles.unitBtnText, weightUnit === 'lbs' && styles.unitBtnTextActive]}>LBS</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.unitBtn, heightUnit === 'cm' && styles.unitBtnActive]} onPress={() => setHeightUnit('cm')}>
                  <Text style={[styles.unitBtnText, heightUnit === 'cm' && styles.unitBtnTextActive]}>CM</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.unitBtn, heightUnit === 'ft' && styles.unitBtnActive]} onPress={() => setHeightUnit('ft')}>
                  <Text style={[styles.unitBtnText, heightUnit === 'ft' && styles.unitBtnTextActive]}>FT</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Animated.View style={[styles.pickerSection, useCompactLayout && styles.pickerSectionCompact, { opacity: fadeAnim }]}>
            {useCompactLayout && renderResultDisplay(styles.resultDisplayTopCompact)}

            <View style={[styles.pickerWrapperOuter, useCompactLayout && styles.pickerWrapperOuterCompact]}>

              {/* Left Visual Decoration */}
              <View style={styles.leftVisualPanel}>
                {step === 0 ? renderWeightVisual() : renderRuler()}
              </View>

              <View style={styles.pickerContainer}>
                <View style={styles.indicator} pointerEvents="none" />
                <Animated.FlatList<any>
                  contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                  data={step === 0 ? weightValues : heightValues}
                  renderItem={({ item, index }) => renderValue(item, index, step === 0 ? weightScrollY : heightScrollY)}
                  keyExtractor={(_, index) => index.toString()}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  onScroll={step === 0 ? onWeightScroll : onHeightScroll}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                    if (step === 0) setSelectedWeightIndex(index);
                    else setSelectedHeightIndex(index);
                  }}
                  decelerationRate="fast"
                  initialScrollIndex={step === 0 ? selectedWeightIndex : selectedHeightIndex}
                  getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                />
              </View>

              {/* Right Visual Decoration (Mirror or complementary) */}
              <View style={styles.rightVisualPanel}>
                {step === 1 && renderRuler()}
              </View>
            </View>

            {!useCompactLayout && renderResultDisplay()}
          </Animated.View>
        </View>

        <View style={[styles.footer, useCompactLayout && styles.footerCompact]}>
          <TouchableOpacity style={styles.mainButton} onPress={handleNext} activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.coral, COLORS.coralDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>{step === 0 ? 'Next' : 'Finish'}</Text>
              <ArrowRight color="white" size={20} strokeWidth={3} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  main: { flex: 1, paddingHorizontal: 32, paddingTop: 10 },
  mainCompact: { paddingTop: 4 },
  topSection: { marginBottom: 30 },
  topSectionCompact: { marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTextSide: {
    flex: 1,
  },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: COLORS.coral, letterSpacing: 1.5 },
  title: { fontSize: titleSize, fontWeight: '900', color: COLORS.black, lineHeight: titleSize + 6, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.muted, lineHeight: 22, fontWeight: '500' },

  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    width: 140,
    alignSelf: 'center'
  },
  unitToggleRowCompact: { marginBottom: 8 },
  unitBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  unitBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  unitBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  unitBtnTextActive: { color: COLORS.coral },

  pickerSection: { alignItems: 'center', flex: 1 },
  pickerSectionCompact: { flexShrink: 1 },
  pickerWrapperOuter: { flexDirection: 'row', alignItems: 'center', height: PICKER_HEIGHT + 20 },
  pickerWrapperOuterCompact: { height: PICKER_HEIGHT + 4 },
  leftVisualPanel: { width: 60, alignItems: 'center', justifyContent: 'center' },
  rightVisualPanel: { width: 60, alignItems: 'center', justifyContent: 'center' },

  pickerContainer: { height: PICKER_HEIGHT, width: width * 0.45, justifyContent: 'center', alignItems: 'center' },
  indicator: { position: 'absolute', height: ITEM_HEIGHT, width: '110%', backgroundColor: COLORS.selection, borderRadius: 20, zIndex: -1 },
  itemWrapper: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  valueText: { fontSize: useCompactLayout ? 32 : 36, fontWeight: '900', letterSpacing: -1.5 },

  // Ruler Visuals
  rulerContainer: { gap: 8 },
  rulerTick: { height: 2, backgroundColor: '#E2E8F0', borderRadius: 1 },
  rulerTickSmall: { width: 15 },
  rulerTickLarge: { width: 25, backgroundColor: COLORS.coral },

  // Mascot Visuals
  mascotContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotCircle: {
    position: 'absolute',
    width: '85%',
    height: '85%',
    borderRadius: 45,
    backgroundColor: '#FFF0F0',
    zIndex: -1,
  },
  mascotImage: {
    width: '200%',
    height: '200%',
    marginTop: -60,

  },

  resultDisplay: { alignItems: 'center', marginTop: 15, minHeight: 82 },
  resultDisplayCompact: { marginTop: 4, minHeight: 70 },
  resultDisplayTopCompact: { marginTop: 0, marginBottom: 4 },
  resultLabel: { fontSize: 12, fontWeight: '800', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'baseline' },
  resultValue: { fontSize: useCompactLayout ? 42 : 52, fontWeight: '900', color: COLORS.black, letterSpacing: -2 },
  resultUnit: { fontSize: 20, fontWeight: '700', color: COLORS.muted, marginLeft: 6 },

  footer: { padding: 32 },
  footerCompact: { paddingTop: 18, paddingBottom: Platform.OS === 'ios' ? 12 : 20 },
  mainButton: {
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8
  },
  gradientButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: -0.5 },
});
