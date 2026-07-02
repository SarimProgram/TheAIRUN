/* eslint-disable react/no-unescaped-entities */
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
} from 'react-native';
import { ChevronLeft, ArrowRight, Target, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ITEM_HEIGHT = 70;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  selection: '#FFF0F0',
  accent: '#F1F5F9',
  cardBg: '#F9FAFB',
};

interface Props {
  currentWeight: number | string;
  unit: string;
  onContinue: (targetWeight: number | string) => void;
  onBack: () => void;
}

export default function TargetWeight({ currentWeight, unit = 'kg', onContinue, onBack }: Props) {
  const kgValues = Array.from({ length: 121 }, (_, i) => i + 30).filter(v => v <= Number(currentWeight));
  const lbsValues = Array.from({ length: 261 }, (_, i) => i + 70).filter(v => v <= Number(currentWeight));
  const values = unit.toLowerCase() === 'kg' ? kgValues : lbsValues;

  // Initial index set to just below current weight or the last value
  const initialIndex = values.length > 0 ? values.length - 2 : 0;
  const safeInitialIndex = Math.max(0, initialIndex);

  const [selectedIndex, setSelectedIndex] = useState(safeInitialIndex);
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const renderValue = (val: string | number, index: number) => {
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={COLORS.black} size={30} />
          </TouchableOpacity>
        </View>

        <View style={styles.main}>
          <Animated.View style={[
            styles.topSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
           
            <Text style={styles.title}>
              What's your{"\n"}
              <Text style={{ color: COLORS.coral }}>Goal Weight?</Text>
            </Text>
            <Text style={styles.subtitle}>
              Helping us calculate your daily calorie budget and timeline.
            </Text>
          </Animated.View>

          <View style={styles.weightSummary}>
            <View style={styles.weightBox}>
              <Text style={styles.weightLabel}>CURRENT</Text>
              <Text style={styles.weightVal}>{currentWeight}<Text style={styles.weightUnitSmall}>{unit}</Text></Text>
            </View>

            <ArrowRight color="#E2E8F0" size={20} />

            <View style={[styles.weightBox, styles.targetHighlighted]}>
              <Text style={[styles.weightLabel, { color: COLORS.coral }]}>TARGET GOAL</Text>
              <Text style={[styles.weightVal, { color: COLORS.coral }]}>
                {values[selectedIndex]}<Text style={[styles.weightUnitSmall, { color: COLORS.coral }]}>{unit}</Text>
              </Text>
            </View>
          </View>

          <Animated.View style={[styles.pickerSection, { opacity: fadeAnim }]}>
            <View style={styles.pickerContainer}>
              <View style={styles.indicator} pointerEvents="none" />
              <Animated.FlatList<any>
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                data={values}
                renderItem={({ item, index }) => renderValue(item, index)}
                keyExtractor={(_, index) => index.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                onScroll={onScroll}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                  setSelectedIndex(index);
                }}
                decelerationRate="fast"
                initialScrollIndex={safeInitialIndex}
                getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
              />
            </View>
          </Animated.View>

          <View style={styles.infoNote}>
            <Info color={COLORS.muted} size={16} />
            <Text style={styles.infoText}>We recommend a healthy and sustainable weight loss pace of 0.5 - 1 kg per week.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.mainButton} onPress={() => onContinue(values[selectedIndex])} activeOpacity={0.9}>
            <LinearGradient
              colors={[COLORS.coral, COLORS.coralDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  main: { flex: 1, paddingHorizontal: 32, paddingTop: 10 },
  topSection: { marginBottom: 30 },
  badge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: COLORS.coral, letterSpacing: 1.5 },
  title: { fontSize: 36, fontWeight: '900', color: COLORS.black, lineHeight: 42, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.muted, lineHeight: 22, fontWeight: '500' },

  weightSummary: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: 28,
    padding: 10,
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
  },
  weightBox: {
    alignItems: 'center',
  },
  targetHighlighted: {
    backgroundColor: COLORS.selection,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  weightLabel: { fontSize: 10, fontWeight: '800', color: COLORS.muted, marginBottom: 4, letterSpacing: 0.5 },
  weightVal: { fontSize: 24, fontWeight: '900', color: COLORS.black },
  weightUnitSmall: { fontSize: 14, color: COLORS.muted, fontWeight: '600' },
  weightDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },

  pickerSection: { alignItems: 'center', height: PICKER_HEIGHT, marginBottom: 30 },
  pickerContainer: { height: PICKER_HEIGHT, width: width * 0.45, justifyContent: 'center', alignItems: 'center' },
  indicator: { position: 'absolute', height: ITEM_HEIGHT, width: '110%', backgroundColor: COLORS.selection, borderRadius: 20, zIndex: -1 },
  itemWrapper: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  valueText: { fontSize: 42, fontWeight: '900', letterSpacing: -1.5 },

  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.muted, lineHeight: 18, fontWeight: '500' },

  footer: { paddingHorizontal: 32, paddingBottom: 32 },
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
  buttonText: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
});
