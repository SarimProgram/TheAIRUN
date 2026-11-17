import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Check, X } from 'lucide-react-native';
import { mealLabel, partnerWords, plateTotals, recipientPortion } from '@/lib/meal-pass';
import type { SharedMeal } from '@/lib/meal-pass-api';
import DrawnPlate from './DrawnPlate';
import PortionSplit from './PortionSplit';
import { SNAP, type PassColors } from './passTheme';

type Props = {
  meal: SharedMeal | null;
  imageUri: string | null;
  isCutout: boolean;
  youAvatarKey?: string;
  partnerAvatarKey?: string;
  youGender?: string | null;
  colors: PassColors;
  onAccept: (shares: number[]) => Promise<void>;
  onDecline: () => Promise<void>;
  onLater: () => void;
};

/** Calm review of a passed plate: the photo holds still while only the numbers respond to the slider. */
export default function MealPassReviewSheet({ meal, imageUri, isCutout, youAvatarKey, partnerAvatarKey, youGender, colors, onAccept, onDecline, onLater }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const visible = !!meal;
  const [shown, setShown] = useState<SharedMeal | null>(meal);
  const [shares, setShares] = useState<number[]>(meal?.itemShares ?? []);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const offset = useSharedValue(height);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (meal) { setShown(meal); setShares(meal.itemShares); setError(null); setBusy(null); }
  }, [meal]);
  useEffect(() => {
    if (visible) {
      offset.set(reduced ? 0 : height);
      offset.set(withSpring(0, SNAP));
      opacity.set(withTiming(1, { duration: 220, reduceMotion: ReduceMotion.Never }));
    } else {
      offset.set(withSpring(reduced ? 0 : height, SNAP));
      opacity.set(withTiming(0, { duration: 180, reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished) scheduleOnRN(setShown, null);
      }));
    }
    return () => { cancelAnimation(offset); cancelAnimation(opacity); };
  }, [height, offset, opacity, reduced, visible]);

  const later = () => { if (!busy) onLater(); };
  const pan = Gesture.Pan().enabled(!busy).onChange((event) => {
    offset.set(Math.max(-12, offset.get() + event.changeY));
  }).onEnd((event) => {
    if (offset.get() + event.velocityY * 0.15 > 180) scheduleOnRN(later);
    else offset.set(withSpring(0, { ...SNAP, velocity: event.velocityY }));
  });
  const sheetMotion = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: reduced ? [] : [{ translateY: offset.get() }] }));
  const scrimMotion = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (!shown) return null;
  const sender = partnerWords(shown.senderName, shown.senderGender);
  const copy = shown.mode === 'COPY';
  const yours = plateTotals(recipientPortion(shown.items, shares));
  const photoSize = Math.min(width - 96, 200);
  const pending = shown.status === 'PENDING' && Date.parse(shown.expiresAt) > Date.now();

  const run = async (kind: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(kind); setError(null);
    try {
      await (kind === 'accept' ? onAccept(shares) : onDecline());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={later}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrimMotion]}>
          <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel="Decide later" onPress={later} />
        </Animated.View>
        <View style={styles.bottom} pointerEvents="box-none">
          <Animated.View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, maxHeight: height - insets.top - 12 }, sheetMotion]}>
            <GestureDetector gesture={pan}>
              <View style={styles.top}>
                <View style={[styles.handle, { backgroundColor: colors.handle }]} />
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text style={[styles.eyebrow, { color: colors.muted }]}>{sender.name.toUpperCase()} {'\u00b7'} {shown.mealType}</Text>
                    <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{sender.name} passed you {mealLabel(shown.mealType)}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Decide later" disabled={!!busy} onPress={later}
                    style={({ pressed }) => [styles.close, { backgroundColor: colors.soft, opacity: pressed ? 0.6 : 1 }]}>
                    <X size={18} color={colors.muted} strokeWidth={2.4} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={[styles.photo, { width: photoSize, height: photoSize }]}>
                {imageUri
                  ? <Image source={{ uri: imageUri }} style={[styles.fill, !isCutout && styles.photoImage]} resizeMode={isCutout ? 'contain' : 'cover'} accessibilityIgnoresInvertColors />
                  : <View style={[styles.fill, styles.drawnPlate, { borderRadius: photoSize / 2, backgroundColor: colors.card, boxShadow: colors.liftShadow }]}>
                      <DrawnPlate size={photoSize * 0.84} colors={colors} title={shown.items.length === 1 ? shown.items[0].foodName : undefined} />
                    </View>}
              </View>

              <View style={[styles.foods, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]}>
                {shown.items.map((item, index) => (
                  <View key={`${item.foodName}-${index}`} style={[styles.food, index > 0 && { borderTopWidth: 1, borderColor: colors.line }]}>
                    <Text style={[styles.foodName, { color: colors.ink }]} numberOfLines={1}>{item.foodName}</Text>
                    <Text style={[styles.foodMeta, { color: colors.muted }]}>{item.grams != null ? `${Math.round(item.grams)}g \u00b7 ` : ''}{item.calories} kcal</Text>
                  </View>
                ))}
              </View>

              <PortionSplit
                mode={shown.mode} items={shown.items} shares={shares} onChange={pending && !busy ? setShares : undefined}
                youAreRecipient colors={colors}
                you={{ label: 'You', avatarKey: youAvatarKey, gender: youGender }}
                other={{ label: sender.name, avatarKey: partnerAvatarKey, gender: shown.senderGender }}
              />
              <Text style={[styles.explainer, { color: colors.muted }]}>
                {copy ? 'Already in your log. Adjust your serving or decline to remove it.' : `Already in your log. Adjusting the split also updates ${sender.name}\u2019s portion. Declining removes your meal.`}
              </Text>
              {!pending && <Text style={[styles.error, { color: colors.ink }]}>This plate was already answered or has expired.</Text>}
              {error && <Text accessibilityRole="alert" style={[styles.error, { color: colors.ink }]}>{error}</Text>}
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Save serving of ${yours.calories} calories`} accessibilityState={{ disabled: !pending || !!busy, busy: busy === 'accept' }}
                disabled={!pending || !!busy} onPress={() => void run('accept')}
                style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent, boxShadow: pending ? colors.accentShadow : 'none', opacity: !pending ? 0.5 : 1, transform: [{ scale: pressed && !reduced ? 0.97 : 1 }] }]}>
                {busy === 'accept' ? <ActivityIndicator color={colors.onAccent} /> : <Check size={20} color={colors.onAccent} />}
                <Text style={[styles.primaryText, { color: colors.onAccent }]}>Save serving</Text>
                <Text style={[styles.primaryTotal, { color: colors.onAccent }]}>{yours.calories} kcal</Text>
              </Pressable>
              <View style={styles.secondary}>
                <Pressable accessibilityRole="button" disabled={!!busy} onPress={later} style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.5 : 1 }]}>
                  <Text style={[styles.secondaryText, { color: colors.ink }]}>Later</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={!pending || !!busy} onPress={() => void run('decline')} style={({ pressed }) => [styles.secondaryButton, { opacity: !pending ? 0.4 : pressed ? 0.5 : 1 }]}>
                  {busy === 'decline' ? <ActivityIndicator size="small" color={colors.muted} /> : <Text style={[styles.secondaryText, { color: colors.muted }]}>Decline & remove</Text>}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', overflow: 'hidden' },
  top: { paddingHorizontal: 24, paddingTop: 12 },
  handle: { width: 44, height: 5, borderRadius: 999, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  headerText: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.6 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 16 },
  photo: { alignSelf: 'center' },
  photoImage: { borderRadius: 28, borderCurve: 'continuous' },
  drawnPlate: { padding: '8%' },
  foods: { borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 16 },
  food: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  foodName: { flex: 1, fontSize: 15, fontWeight: '700' },
  foodMeta: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  explainer: { fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  error: { fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 4 },
  primary: { minHeight: 56, borderRadius: 20, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  primaryTotal: { fontSize: 13, fontWeight: '800', marginLeft: 'auto', fontVariant: ['tabular-nums'], opacity: 0.9 },
  secondary: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  secondaryButton: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '800' },
});
