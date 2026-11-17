import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  useAnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Check, ChevronLeft, Pencil } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, EASE_OUT, PrimaryButton, SURFACE_SELECTED, ScreenTitle, rise, useCompact } from "./OnboardingKit";

type RewardMap = {
  week1: string | null;
  week2: string | null;
  week3: string | null;
};
type Props = {
  onContinue: (data: RewardMap) => void;
  onBack?: () => void;
  joinedWithCode?: boolean;
};
type RewardId = "massage" | "cook" | "money" | "custom";
type RewardOption = { id: RewardId; label: string; image: number };

const OPTIONS: RewardOption[] = [
  { id: "massage", label: "Massage", image: require("../../assets/rewards/prize-massage.webp") },
  { id: "cook", label: "Cook a treat", image: require("../../assets/rewards/prize-cook.webp") },
  { id: "money", label: "Money reward", image: require("../../assets/rewards/prize-money.webp") },
  { id: "custom", label: "Your own prize", image: require("../../assets/rewards/prize-custom.webp") },
];

const SURFACE = "rgba(255,255,255,0.78)";
const RING = "#D8D9DB";
const MUTED_TEXT = "rgba(8, 36, 55, 0.5)";
const SETTLE = { duration: 400, dampingRatio: 0.72 };

function PrizeCard({ option, selected, detail, compact, onPress }: {
  option: RewardOption;
  selected: boolean;
  detail?: string;
  compact: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(selected ? 1 : 0);
  const badge = useSharedValue(selected ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 240, easing: EASE_OUT }));
    badge.set(selected ? withSpring(1, SETTLE) : withTiming(0, { duration: 140, easing: EASE_OUT }));
  }, [selected, progress, badge]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [C.border, "#FF9CA3"]),
    backgroundColor: interpolateColor(progress.get(), [0, 1], [SURFACE, SURFACE_SELECTED]),
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(badge.get(), [0, 1], [1, 1.08]) }, { rotate: `${interpolate(badge.get(), [0, 1], [0, -5])}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.6),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.55, 1]) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => pressed.set(withTiming(1, { duration: 110, easing: EASE_OUT }))}
      onPressOut={() => pressed.set(withTiming(0, { duration: 180, easing: EASE_OUT }))}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.label}${detail ? `, ${detail}` : ""}`}
    >
      <Animated.View style={[styles.card, compact && styles.cardCompact, cardStyle]}>
        <Animated.View style={[styles.iconWrap, compact && styles.iconWrapCompact, iconStyle]}>
          <Image source={option.image} style={styles.icon} contentFit="contain" accessible={false} />
        </Animated.View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>{option.label}</Text>
          {!!detail && (
            <Text numberOfLines={1} style={[styles.cardDetail, selected && styles.coral]}>{detail}</Text>
          )}
        </View>
        <View style={styles.radio}>
          <Animated.View style={[styles.radioRing, ringStyle]} />
          <Animated.View style={[styles.radioChecked, checkStyle]}>
            <Check color={C.white} size={18} strokeWidth={3.4} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ScrollReveal({ scrollY, viewport, contentTop, children }: {
  scrollY: SharedValue<number>;
  viewport: SharedValue<number>;
  contentTop: SharedValue<number>;
  children: React.ReactNode;
}) {
  const top = useSharedValue(0);
  const size = useSharedValue(0);

  const style = useAnimatedStyle(() => {
    const h = size.get();
    if (h === 0 || viewport.get() === 0) return {};
    const y = contentTop.get() + top.get();
    const enter = interpolate(scrollY.get() + viewport.get() - y, [0, h], [0, 1], Extrapolation.CLAMP);
    const leave = interpolate(y + h - scrollY.get(), [0, h * 0.7], [0, 1], Extrapolation.CLAMP);
    const visible = Math.min(enter, leave);
    return {
      opacity: interpolate(visible, [0, 1], [0.3, 1]),
      transform: [
        { translateY: interpolate(enter, [0, 1], [14, 0]) },
        { scale: interpolate(visible, [0, 1], [0.92, 1]) },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(e) => {
        top.set(e.nativeEvent.layout.y);
        size.set(e.nativeEvent.layout.height);
      }}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export default function PartnerRewardSelection({ onContinue, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = useCompact();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<RewardId | null>(null);
  const [money, setMoney] = useState("");
  const [custom, setCustom] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const cheer = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const viewport = useSharedValue(0);
  const contentHeight = useRef(0);
  const optionsTop = useSharedValue(0);
  const editorTop = useRef(0);
  const inputFocused = useRef(false);

  const revealEditor = () => {
    scroll.current?.scrollTo({ y: Math.max(0, optionsTop.get() + editorTop.current - 12), animated: !reduced });
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const peek = setTimeout(() => {
      if (inputFocused.current || contentHeight.current <= viewport.get() + 8) return;
      scroll.current?.scrollTo({ y: 56, animated: true });
      settle = setTimeout(() => {
        if (!inputFocused.current) scroll.current?.scrollTo({ y: 0, animated: true });
      }, 560);
    }, 1100);
    return () => {
      clearTimeout(peek);
      if (settle) clearTimeout(settle);
    };
  }, [reduced, scroll, viewport]);

  const moneyValue = Number(money);
  const validMoney = /^\d+(\.\d{1,2})?$/.test(money) && moneyValue > 0 && moneyValue <= 99999;
  const valid =
    selected !== null &&
    (selected !== "money" || validMoney) &&
    (selected !== "custom" || custom.trim().length > 0);
  const moneyLabel = validMoney
    ? `$${moneyValue.toLocaleString("en-AU", { minimumFractionDigits: moneyValue % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
    : "";

  const heroWidth = Math.min(width - 32, 420);
  const heroHeight = Math.round(Math.min(heroWidth * 0.64, height * (compact ? 0.22 : 0.27)));

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(cheer.get(), [0, 1], [0, -6]) },
      { scale: interpolate(cheer.get(), [0, 1], [1, 1.03]) },
    ],
  }));

  const select = (id: RewardId) => {
    if (selected !== id) {
      Haptics.selectionAsync().catch(() => {});
      if (!reduced) {
        cheer.set(withSequence(
          withTiming(1, { duration: 140, easing: EASE_OUT }),
          withSpring(0, { duration: 420, dampingRatio: 0.55 }),
        ));
      }
    }
    setSelected(id);
    if (id !== "custom" && id !== "money") Keyboard.dismiss();
  };

  const finish = () => {
    if (!valid || !selected) return;
    Keyboard.dismiss();
    const value =
      selected === "custom"
        ? `custom:${custom.trim()}`
        : selected === "money"
          ? `money:${moneyValue.toFixed(2)}`
          : selected;
    onContinue({ week1: value, week2: null, week3: null });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.topBlush, { width: width * 0.85, height: width * 0.85 }]} />
        <View style={[styles.bottomMint, { width: width * 0.95, height: width * 0.95 }]} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.listArea}>
        <Animated.ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewport.set(e.nativeEvent.layout.height);
            if (inputFocused.current) revealEditor();
          }}
          onContentSizeChange={(_, h) => {
            contentHeight.current = h;
            if (inputFocused.current) revealEditor();
          }}
        >
        <View style={[styles.top, { paddingTop: insets.top + 24 }]}>
          <View style={styles.header}>
            {onBack && (
              <Pressable
                onPress={onBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <ChevronLeft color={C.ink} size={32} strokeWidth={2.5} />
              </Pressable>
            )}
            <View style={styles.brand}>
              <Image source={require("../../assets/logo.png")} tintColor={C.coral} contentFit="contain" style={styles.brandMark} accessible={false} />
              <Text style={styles.brandName}>RunTogether</Text>
            </View>
          </View>

          <View style={styles.heroClip}>
          <Animated.View entering={rise(40)} style={[styles.hero, { height: heroHeight, marginTop: compact ? 8 : 16 }]}>
            <View pointerEvents="none" style={[styles.heroBackdrop, { width: heroWidth * 0.9, height: heroHeight * 0.92, borderTopLeftRadius: heroWidth * 0.45, borderTopRightRadius: heroWidth * 0.45 }]} />
            <Animated.View style={heroStyle}>
              <Image
                source={require("../../assets/rewards/prize-celebrate-white-eyes.webp")}
                style={{ width: heroWidth, height: heroHeight }}
                contentFit="contain"
                accessibilityLabel="Our teal and coral avatars cheering beside a gold trophy"
              />
            </Animated.View>
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,252,252,0)", C.bg]}
              style={[styles.heroFade, { height: heroHeight * 0.38 }]}
            />
          </Animated.View>
          </View>

          <ScreenTitle lead="This week's " accent="prize" sparkles delay={140} style={styles.title} />
        </View>

          <View onLayout={(e) => { optionsTop.set(e.nativeEvent.layout.y); }} style={[styles.options, compact && styles.optionsCompact]} accessibilityRole="radiogroup" accessibilityLabel="Choose this week's prize">
            {OPTIONS.map((option, index) => (
              <React.Fragment key={option.id}>
                <ScrollReveal scrollY={scrollY} viewport={viewport} contentTop={optionsTop}>
                <Animated.View entering={rise(220 + index * 60)}>
                  <PrizeCard
                    option={option}
                    selected={selected === option.id}
                    compact={compact}
                    detail={
                      option.id === "money"
                        ? moneyLabel || undefined
                        : option.id === "custom"
                          ? custom.trim() || undefined
                          : undefined
                    }
                    onPress={() => select(option.id)}
                  />
                </Animated.View>
                </ScrollReveal>
                {selected === option.id && (option.id === "money" || option.id === "custom") && (
                  <Animated.View
                    entering={rise(0)}
                    onLayout={(e) => {
                      editorTop.current = e.nativeEvent.layout.y;
                      revealEditor();
                    }}
                    style={styles.editor}
                  >
                    <Text nativeID="prize-input-label" style={styles.inputLabel}>
                      {option.id === "money" ? "How much is on the line?" : "What does the winner get?"}
                    </Text>
                    <View style={styles.inputWrap}>
                      {option.id === "money"
                        ? <Text style={styles.currency}>$</Text>
                        : <Pencil size={18} color={C.coral} />}
                      <TextInput
                        key={option.id}
                        accessibilityLabel={option.id === "money" ? "Money reward amount in dollars" : "Custom prize name"}
                        value={option.id === "money" ? money : custom}
                        onChangeText={
                          option.id === "money"
                            ? (text) => setMoney(text.replace(/,/g, ".").replace(/[^0-9.]/g, ""))
                            : setCustom
                        }
                        placeholder={option.id === "money" ? "Enter amount" : "e.g. Breakfast in bed"}
                        placeholderTextColor={C.muted}
                        keyboardType={option.id === "money" ? "decimal-pad" : "default"}
                        maxLength={option.id === "money" ? 8 : 40}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        onFocus={() => {
                          inputFocused.current = true;
                          revealEditor();
                        }}
                        onBlur={() => { inputFocused.current = false; }}
                        style={styles.input}
                      />
                    </View>
                    <Text style={styles.inputHint}>
                      {option.id === "money"
                        ? money && !validMoney
                          ? "Enter an amount between $0.01 and $99,999, with up to 2 decimal places."
                          : "You two settle up. Bragging rights included."
                        : `${custom.trim().length}/40 characters`}
                    </Text>
                  </Animated.View>
                )}
              </React.Fragment>
            ))}
          </View>
        </Animated.ScrollView>
        <LinearGradient pointerEvents="none" colors={[C.bg, "rgba(255,252,252,0)"]} style={[styles.listFade, styles.listFadeTop]} />
        <LinearGradient pointerEvents="none" colors={["rgba(255,252,252,0)", C.bg]} style={[styles.listFade, styles.listFadeBottom]} />
        </View>

        <Animated.View entering={rise(420)} style={[styles.footer, { paddingBottom: keyboardVisible ? 6 : Math.max(insets.bottom - 14, 6) }]}>
          <PrimaryButton label="Continue" onPress={finish} disabled={!valid} style={styles.cta} />
          <Pressable
            onPress={() => onContinue({ week1: null, week2: null, week3: null })}
            accessibilityRole="button"
            hitSlop={4}
            style={({ pressed }) => [styles.skip, { marginBottom: !keyboardVisible && __DEV__ ? 30 : 0 }, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>I&apos;ll decide later</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  flex: { flex: 1 },
  topBlush: { position: "absolute", top: -255, left: -130, borderRadius: 999, backgroundColor: "#FFF0EF" },
  bottomMint: { position: "absolute", bottom: -320, right: -190, borderRadius: 999, backgroundColor: "#E4F5F1" },
  top: {},
  listArea: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  listFade: { position: "absolute", left: 0, right: 0, height: 18 },
  listFadeTop: { top: 0 },
  listFadeBottom: { bottom: 0 },
  heroClip: { overflow: "hidden", marginHorizontal: -24, paddingHorizontal: 24, justifyContent: "flex-end" },
  heroFade: { position: "absolute", left: -24, right: -24, bottom: 0 },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: -8, width: 48, height: 48, alignItems: "center", justifyContent: "center", zIndex: 1 },
  pressed: { opacity: 0.5 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 29, height: 29 },
  brandName: { color: C.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.8 },
  hero: { alignItems: "center", justifyContent: "flex-end" },
  heroBackdrop: { position: "absolute", bottom: 0, backgroundColor: "#FFF0EF", opacity: 0.7, borderCurve: "continuous" },
  title: { marginTop: 12 },
  options: { paddingTop: 16, gap: 12 },
  optionsCompact: { paddingTop: 12, gap: 10 },
  card: { minHeight: 80, borderRadius: 24, borderCurve: "continuous", borderWidth: 1.5, borderColor: C.border, backgroundColor: SURFACE, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 18, paddingVertical: 8, gap: 16, boxShadow: "0 6px 18px rgba(8, 36, 55, 0.05)" },
  cardCompact: { minHeight: 70, paddingVertical: 6 },
  iconWrap: { width: 76, height: 62, alignItems: "center", justifyContent: "center" },
  iconWrapCompact: { width: 64, height: 54 },
  icon: { width: "100%", height: "100%" },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: C.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  cardTitleCompact: { fontSize: 17 },
  cardDetail: { color: MUTED_TEXT, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  coral: { color: C.coral },
  radio: { width: 28, height: 28 },
  radioRing: { ...StyleSheet.absoluteFillObject, borderRadius: 14, borderWidth: 2, borderColor: RING },
  radioChecked: { ...StyleSheet.absoluteFillObject, borderRadius: 14, backgroundColor: C.coral, alignItems: "center", justifyContent: "center" },
  editor: { borderRadius: 24, borderCurve: "continuous", padding: 16, gap: 10, backgroundColor: SURFACE_SELECTED },
  inputLabel: { color: C.ink, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: C.border, borderRadius: 16, borderCurve: "continuous", backgroundColor: C.white, paddingHorizontal: 14 },
  currency: { color: C.coral, fontSize: 22, fontWeight: "800" },
  input: { flex: 1, minHeight: 52, color: C.ink, fontSize: 17, fontWeight: "600", paddingVertical: 12, fontVariant: ["tabular-nums"] },
  inputHint: { color: MUTED_TEXT, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  cta: { marginBottom: 0 },
  skip: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  skipText: { color: MUTED_TEXT, fontSize: 14, fontWeight: "700" },
});
