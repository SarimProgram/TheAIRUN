import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { ChevronLeft, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const width = Math.min(windowWidth, 480);
const isAirLayout = windowWidth >= 700 || (Platform.OS === 'ios' && Platform.isPad);
const isCompactFrame = windowHeight <= 820;
const useCompactLayout = isAirLayout || isCompactFrame;

// Picker settings
const ITEM_HEIGHT = useCompactLayout ? 54 : 64;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const titleSize = useCompactLayout ? 30 : 34;

const COLORS = {
  coral: '#FF6B6B',
  coralDark: '#EE5253',
  black: '#1F2937',
  muted: '#6B7280',
  white: '#FFFFFF',
  bg: '#FFFFFF',
  selection: '#FFF0F0',
};

interface Phase4Props {
  onComplete: (age: number) => void;
  onBack: () => void;
}

export default function Phase4Complete({ onComplete, onBack }: Phase4Props) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [selectedIndex, setSelectedIndex] = useState(20);
  const selectedAge = currentYear - years[selectedIndex];

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

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setSelectedIndex(index);
  };

  const renderYear = (year: number, index: number) => {
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
        <Animated.Text
          style={[
            styles.yearText,
            { opacity, transform: [{ scale }], color },
          ]}
        >
          {year}
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
            <Text style={styles.title}>When were you{"\n"}<Text style={{ color: COLORS.coral }}>Born?</Text></Text>
            <Text style={styles.subtitle}>Helping us calculate your heart rate zones and training intensity.</Text>
          </Animated.View>

          <Animated.View style={[styles.pickerSection, { opacity: fadeAnim }]}>
            <View style={styles.ageBadge}>
              <Text style={styles.ageBadgeLabel}>ESTIMATED AGE</Text>
              <Text style={styles.ageBadgeValue}>
                {selectedAge}
                <Text style={styles.ageBadgeUnit}>  yrs</Text>
              </Text>
            </View>

            <View style={styles.pickerContainer}>
              <View style={styles.indicator} pointerEvents="none" />

              <Animated.FlatList
                data={years}
                renderItem={({ item, index }) => renderYear(item, index)}
                keyExtractor={(item) => item.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                onScroll={onScroll}
                onMomentumScrollEnd={onMomentumScrollEnd}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
                initialScrollIndex={20}
                getItemLayout={(_, index) => ({
                  length: ITEM_HEIGHT,
                  offset: ITEM_HEIGHT * index,
                  index,
                })}
              />
            </View>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.mainButton}
            onPress={() => onComplete(selectedAge)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.coral, COLORS.coralDark]}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  topSection: {
    marginBottom: 0,
  },
  title: {
    fontSize: titleSize,
    fontWeight: '900',
    color: COLORS.black,
    lineHeight: titleSize + 6,
    letterSpacing: -1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: '500',
  },
  pickerSection: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  ageBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: COLORS.selection,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 12,
    gap: 10,
  },
  ageBadgeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.coral,
    letterSpacing: 1.4,
  },
  ageBadgeValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  ageBadgeUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0,
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    height: ITEM_HEIGHT - 10,
    width: '100%',
    backgroundColor: COLORS.selection,
    borderRadius: 20,
    zIndex: -1,
  },
  itemWrapper: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: width - 80,
  },
  yearText: {
    fontSize: useCompactLayout ? 26 : 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  footer: {
    paddingHorizontal: 32,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 24,
  },
  mainButton: {
    height: 58,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
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
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
