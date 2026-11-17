import React, { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions, type DimensionValue, type ListRenderItemInfo, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, Extrapolation, FadeInDown, Keyframe, interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';

export const C = { bg: '#FFFCFC', coral: '#FF4548', ink: '#082437', border: '#EEEDEF', muted: '#C6C8CC', track: '#F1F1F3', white: '#FFFFFF' };
export const SURFACE = 'rgba(255,255,255,0.78)';
export const SURFACE_SELECTED = 'rgba(255,236,236,0.95)';
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const rise = (delay: number) => FadeInDown.duration(560).delay(delay).easing(EASE_OUT)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 18 }] });

export const pop = (delay: number) => new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }] },
  60: { opacity: 1, transform: [{ scale: 1.12 }], easing: EASE_OUT },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(420).delay(delay);

export const useCompact = () => useWindowDimensions().height < 740;

export function OnboardingScreen({ onBack, showBrand = false, progress, scrollable = false, avoidKeyboard = false, ctaLabel, onCta, ctaLoading = false, ctaDisabled = false, ctaDelay = 420, children }: {
  onBack?: () => void;
  showBrand?: boolean;
  progress?: number;
  scrollable?: boolean;
  avoidKeyboard?: boolean;
  ctaLabel?: string;
  onCta?: () => void;
  ctaLoading?: boolean;
  ctaDisabled?: boolean;
  ctaDelay?: number;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = useCompact();
  const padding = { paddingTop: insets.top + 24, paddingBottom: compact ? 16 : 24 };

  const body = <>
    <View style={styles.header}>
      {onBack && <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.backPressed]} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
        <ChevronLeft color={C.ink} size={32} strokeWidth={2.5} />
      </Pressable>}
      {showBrand && <View style={styles.brand}>
        <Image source={require('../../assets/logo.png')} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
        <Text style={styles.brandName}>RunTogether</Text>
      </View>}
    </View>
    {progress !== undefined && <ProgressTrack progress={progress} />}
    {children}
    {scrollable && <View style={styles.scrollSpacer} />}
    {ctaLabel && onCta && <Animated.View entering={rise(ctaDelay)}>
      <PrimaryButton label={ctaLabel} onPress={onCta} loading={ctaLoading} disabled={ctaDisabled} />
    </Animated.View>}
  </>;

  return <View style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.topBlush, { width: width * 0.85, height: width * 0.85 }]} />
      <View style={[styles.bottomMint, { width: width * 0.95, height: width * 0.95 }]} />
    </View>
    {scrollable
      ? <KeyboardAvoidingView style={styles.fill} enabled={avoidKeyboard} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.scrollContent, padding]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >{body}</ScrollView>
      </KeyboardAvoidingView>
      : <View style={[styles.content, padding]}>{body}</View>}
  </View>;
}

function ProgressTrack({ progress }: { progress: number }) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(withTiming(progress, { duration: 480, easing: EASE_OUT }));
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return <View
    style={styles.progressTrack}
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
  >
    <Animated.View style={[styles.progressFill, fillStyle]} />
  </View>;
}

export function ScreenTitle({ lead, accent, trail, lines = 1, delay = 80, sparkles = false, style }: {
  lead: string;
  accent: string;
  trail?: string;
  lines?: 1 | 2;
  delay?: number;
  sparkles?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const compact = useCompact();
  return <Animated.View entering={rise(delay)} style={[styles.titleWrap, sparkles && styles.titleWrapCentered, { marginTop: compact ? 32 : lines === 2 ? 44 : 52 }, style]}>
    <Text
      style={[styles.title, lines === 2 && styles.titleTwoLine, compact && (lines === 2 ? styles.titleTwoLineCompact : styles.titleCompact)]}
      adjustsFontSizeToFit
      numberOfLines={lines}
      accessibilityRole="header"
    >
      {lead}<Text style={styles.titleAccent}>{accent}</Text>{trail}
    </Text>
    {sparkles && <Sparkles delay={delay + 300} />}
  </Animated.View>;
}

export function Sparkles({ delay, style }: { delay: number; style?: StyleProp<ViewStyle> }) {
  return <View pointerEvents="none" style={[styles.sparkles, style]}>
    <Animated.View entering={pop(delay)} style={[styles.sparkleSlot, styles.sparkleOne]}><View style={[styles.sparkle, styles.rotOne]} /></Animated.View>
    <Animated.View entering={pop(delay + 60)} style={[styles.sparkleSlot, styles.sparkleTwo]}><View style={[styles.sparkle, styles.rotTwo]} /></Animated.View>
    <Animated.View entering={pop(delay + 120)} style={[styles.sparkleSlot, styles.sparkleThree]}><View style={[styles.sparkle, styles.rotThree]} /></Animated.View>
  </View>;
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, style }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const pressed = useSharedValue(0);
  const ready = useSharedValue(disabled ? 0 : 1);

  useEffect(() => {
    ready.set(withTiming(disabled ? 0 : 1, { duration: 220, easing: EASE_OUT }));
  }, [disabled, ready]);

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ready.get(), [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(pressed.get(), [0, 1], [0, 5]) }] }));

  return <Pressable
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPress();
    }}
    disabled={loading || disabled}
    onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
    onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ busy: loading, disabled: loading || disabled }}
  >
    <Animated.View style={[styles.cta, style, buttonStyle]}>
      {loading
        ? <ActivityIndicator color={C.white} />
        : <>
          <Text style={styles.ctaText}>{label}</Text>
          <Animated.View style={arrowStyle}>
            <ArrowRight color={C.white} size={27} strokeWidth={2.4} />
          </Animated.View>
        </>}
    </Animated.View>
  </Pressable>;
}

const TOGGLE_WIDTH = 200;
const TOGGLE_PAD = 4;
const SEGMENT_WIDTH = (TOGGLE_WIDTH - TOGGLE_PAD * 2) / 2;

export function UnitToggle<T extends string>({ options, value, onChange }: {
  options: readonly [{ id: T; label: string }, { id: T; label: string }];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = options[1].id === value ? 1 : 0;
  const position = useSharedValue(index);

  useEffect(() => {
    position.set(withTiming(index, { duration: 260, easing: EASE_OUT }));
  }, [index, position]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * SEGMENT_WIDTH }] }));

  return <View style={styles.toggle} accessibilityRole="radiogroup">
    <Animated.View style={[styles.toggleThumb, thumbStyle]} />
    {options.map((option, i) => (
      <Pressable
        key={option.id}
        style={styles.toggleSegment}
        onPress={() => {
          if (option.id === value) return;
          Haptics.selectionAsync().catch(() => {});
          onChange(option.id);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: option.id === value }}
        accessibilityLabel={option.label}
      >
        <ToggleLabel label={option.label} index={i} position={position} />
      </Pressable>
    ))}
  </View>;
}

function ToggleLabel({ label, index, position }: { label: string; index: number; position: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(position.get() - index)), [0, 1], [C.coral, C.ink]),
  }));
  return <Animated.Text style={[styles.toggleText, style]}>{label}</Animated.Text>;
}

type WheelValue = string | number;

export const WheelPicker = memo(function WheelPicker({ values, initialIndex, onChange, itemHeight, fontSize, highlightHeight, highlightWidth = '100%', accessibilityLabel, unit = '', virtualized = true }: {
  values: readonly WheelValue[];
  initialIndex: number;
  onChange: (index: number) => void;
  itemHeight: number;
  fontSize: number;
  highlightHeight: number;
  highlightWidth?: DimensionValue;
  accessibilityLabel: string;
  unit?: string;
  /** Disable for bounded wheels inside a vertical ScrollView. */
  virtualized?: boolean;
}) {
  const listRef = useRef<FlatList<WheelValue>>(null);
  const scrollRef = useRef<ScrollView>(null);
  const initialOffset = useRef({ x: 0, y: initialIndex * itemHeight }).current;
  const onChangeRef = useRef(onChange);
  const [selected, setSelected] = useState(initialIndex);
  const scrollY = useSharedValue(initialIndex * itemHeight);
  const current = useSharedValue(initialIndex);
  const lastIndex = values.length - 1;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const tick = useCallback((index: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChangeRef.current(index);
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      const index = Math.min(lastIndex, Math.max(0, Math.round(event.contentOffset.y / itemHeight)));
      if (index !== current.get()) {
        current.set(index);
        scheduleOnRN(tick, index);
      }
    },
    onEndDrag: () => {
      scheduleOnRN(setSelected, current.get());
    },
    onMomentumEnd: () => {
      scheduleOnRN(setSelected, current.get());
    },
  }, [lastIndex, itemHeight, tick]);

  const scrollToIndex = useCallback((index: number) => {
    if (virtualized) {
      listRef.current?.scrollToOffset({ offset: index * itemHeight, animated: true });
    } else {
      scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
    }
  }, [itemHeight, virtualized]);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<WheelValue>) => (
    <WheelItem label={String(item)} index={index} scrollY={scrollY} itemHeight={itemHeight} fontSize={fontSize} onPress={scrollToIndex} />
  ), [scrollY, itemHeight, fontSize, scrollToIndex]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: itemHeight, offset: itemHeight * index, index }), [itemHeight]);
  const contentStyle = useMemo(() => ({ paddingVertical: itemHeight }), [itemHeight]);

  return <View
    style={[styles.wheel, { height: itemHeight * 3 }]}
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ text: `${values[selected]}${unit ? ` ${unit}` : ''}` }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={({ nativeEvent }) => {
      const step = nativeEvent.actionName === 'increment' ? 1 : -1;
      scrollToIndex(Math.min(lastIndex, Math.max(0, current.get() + step)));
    }}
  >
    <View pointerEvents="none" style={[styles.wheelHighlight, { height: highlightHeight, width: highlightWidth, borderRadius: highlightHeight / 2 }]} />
    {virtualized ? <Animated.FlatList
      ref={listRef}
      data={values}
      style={StyleSheet.absoluteFill}
      renderItem={renderItem}
      keyExtractor={String}
      getItemLayout={getItemLayout}
      initialScrollIndex={initialIndex}
      contentContainerStyle={contentStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={itemHeight}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      initialNumToRender={9}
      maxToRenderPerBatch={12}
      windowSize={11}
    /> : <Animated.ScrollView
      ref={scrollRef}
      style={StyleSheet.absoluteFill}
      contentOffset={initialOffset}
      contentContainerStyle={contentStyle}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={itemHeight}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {values.map((value, index) => <WheelItem
        key={String(value)}
        label={String(value)}
        index={index}
        scrollY={scrollY}
        itemHeight={itemHeight}
        fontSize={fontSize}
        onPress={scrollToIndex}
      />)}
    </Animated.ScrollView>}
  </View>;
});

const WheelItem = memo(function WheelItem({ label, index, scrollY, itemHeight, fontSize, onPress }: {
  label: string;
  index: number;
  scrollY: SharedValue<number>;
  itemHeight: number;
  fontSize: number;
  onPress: (index: number) => void;
}) {
  const itemStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.get() - index * itemHeight) / itemHeight;
    return {
      opacity: interpolate(distance, [0, 1, 1.8], [1, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.62], Extrapolation.CLAMP) }],
    };
  });
  const inkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(scrollY.get() - index * itemHeight) / itemHeight, [0, 0.7], [1, 0], Extrapolation.CLAMP),
  }));
  const textStyle = [styles.wheelText, { fontSize, lineHeight: Math.round(fontSize * 1.15) }];

  return <Pressable onPress={() => onPress(index)} style={[styles.wheelItem, { height: itemHeight }]}>
    <Animated.View style={itemStyle}>
      <Text allowFontScaling={false} style={[textStyle, styles.wheelTextMuted]}>{label}</Text>
      <Animated.Text allowFontScaling={false} style={[textStyle, styles.wheelTextInk, inkStyle]}>{label}</Animated.Text>
    </Animated.View>
  </Pressable>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  topBlush: { position: 'absolute', top: -255, left: -130, borderRadius: 999, backgroundColor: '#FFF0EF' },
  bottomMint: { position: 'absolute', bottom: -320, right: -190, borderRadius: 999, backgroundColor: '#E4F5F1' },
  content: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  scrollSpacer: { flexGrow: 1, minHeight: 24 },
  progressTrack: { height: 6, marginTop: 12, marginHorizontal: 32, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: C.coral },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -8, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  backPressed: { opacity: 0.5 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 29, height: 29 },
  brandName: { color: C.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.8 },
  titleWrap: { alignSelf: 'stretch' },
  title: { color: C.ink, fontSize: 44, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  titleCompact: { fontSize: 38 },
  titleTwoLine: { fontSize: 42, lineHeight: 48 },
  titleTwoLineCompact: { fontSize: 36, lineHeight: 42 },
  titleAccent: { color: C.coral },
  titleWrapCentered: { alignSelf: 'center', maxWidth: '88%' },
  sparkles: { position: 'absolute', right: -30, top: -26, width: 44, height: 38 },
  sparkleSlot: { position: 'absolute', width: 17, height: 17, alignItems: 'center', justifyContent: 'center' },
  sparkle: { width: 4, height: 17, borderRadius: 3, backgroundColor: C.coral },
  sparkleOne: { left: -2, top: 0 },
  sparkleTwo: { left: 17, top: 8 },
  sparkleThree: { right: -6, bottom: -6 },
  rotOne: { transform: [{ rotate: '7deg' }] },
  rotTwo: { transform: [{ rotate: '42deg' }] },
  rotThree: { transform: [{ rotate: '65deg' }] },
  cta: { height: 54, borderRadius: 999, borderCurve: 'continuous', marginHorizontal: 1, marginBottom: __DEV__ ? 92 : 12, backgroundColor: C.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 8px 20px rgba(255, 69, 72, 0.26)' },
  ctaText: { color: C.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  toggle: { width: TOGGLE_WIDTH, height: 52, padding: TOGGLE_PAD, borderRadius: 999, borderCurve: 'continuous', backgroundColor: C.track, flexDirection: 'row', alignSelf: 'center' },
  toggleThumb: { position: 'absolute', top: TOGGLE_PAD, bottom: TOGGLE_PAD, left: TOGGLE_PAD, width: SEGMENT_WIDTH, borderRadius: 999, borderCurve: 'continuous', backgroundColor: C.white, borderWidth: 1.5, borderColor: 'rgba(255, 69, 72, 0.22)', boxShadow: '0 4px 12px rgba(255, 69, 72, 0.14)' },
  toggleSegment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  wheel: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  wheelHighlight: { position: 'absolute', backgroundColor: SURFACE_SELECTED, borderCurve: 'continuous' },
  wheelItem: { alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'], textAlign: 'center' },
  wheelTextMuted: { color: C.muted },
  wheelTextInk: { ...StyleSheet.absoluteFillObject, color: C.ink },
});
