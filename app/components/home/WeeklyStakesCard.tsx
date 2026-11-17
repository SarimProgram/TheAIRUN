import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { DoodleThumb } from './DoodleSignature';
import type { WeeklyRewardColors } from './weeklyRewardTheme';

type Props = {
  colors: WeeklyRewardColors;
  dark: boolean;
  prize: string | null;
  headline: string;
  /** Short uppercase state shown next to "THE STAKES", e.g. "WAITING FOR SAM". */
  status: string | null;
  actionLabel: string;
  actionAccessibilityLabel: string;
  emphasizeAction: boolean;
  busy: boolean;
  showHint: boolean;
  canSign: boolean;
  yourSignature: string[];
  partnerSignature: string[];
  partnerName: string;
  pulseStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  onPress: () => void;
  onAction: () => void;
  onSign: () => void;
};

export default function WeeklyStakesCard({
  colors, dark, prize, headline, status, actionLabel, actionAccessibilityLabel, emphasizeAction, busy, showHint,
  canSign, yourSignature, partnerSignature, partnerName, pulseStyle, onPress, onAction, onSign,
}: Props) {
  const action = (style: StyleProp<ViewStyle>, textColor: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={actionAccessibilityLabel} accessibilityState={{ disabled: busy, busy }} hitSlop={8}
      disabled={busy} onPress={event => { event.stopPropagation(); onAction(); }} style={style}>
      <Text style={[styles.actionText, { color: textColor }]}>{actionLabel}</Text>
    </Pressable>
  );

  const massage = !!prize && /^(winner gets\s+)?(a\s+)?massage$/i.test(prize.trim());

  return (
    <Pressable accessible={false} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: dark ? colors.surface : '#FFF9F9', borderColor: dark ? colors.coralSoft : '#F9D8DA' }, pressed && styles.pressed]}>
      {massage && <View style={styles.banner}>
        <Image source={require('../../assets/rewards/massage.png')} style={styles.art} contentFit="contain" />
        <View style={styles.bannerCopy}>
          <Text style={[styles.bannerLabel, { color: colors.ink }]}>Win &amp; get a</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.bannerTitle, { color: colors.coral }]}>Massage</Text>
        </View>
      </View>}
      {!massage && <Text style={[styles.caption, { color: colors.muted }]}>THE STAKES</Text>}
      {prize && !emphasizeAction && <Pressable accessibilityRole="button" accessibilityLabel={actionAccessibilityLabel}
        accessibilityState={{ disabled: busy, busy }} disabled={busy} hitSlop={6}
        onPress={event => { event.stopPropagation(); onAction(); }} style={styles.editAction}>
        <Text style={[styles.editText, { color: colors.muted }]}>{actionLabel}</Text>
      </Pressable>}
      {!prize ? <>
        <Animated.View testID="weekly-prize-text" style={[styles.emptyCopy, pulseStyle]}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>{headline}</Text>
          {showHint && <Text style={[styles.hint, { color: colors.muted }]}>A massage, dinner, or something only you two get.</Text>}
        </Animated.View>
        <View style={[styles.divider, { backgroundColor: dark ? colors.coralSoft : '#F9D8DA' }]} />
        <View style={styles.emptyFooter}>
          <Text style={[styles.hint, styles.footerHint, { color: colors.muted }]}>Pick a reward, then you both sign.</Text>
          {action([styles.setAction, { backgroundColor: colors.coral }], '#FFFFFF')}
        </View>
      </> : <>
        {!massage && <Text testID="weekly-prize-text" style={[styles.prizeName, { color: colors.ink }]}>{headline}</Text>}
        {status && <Text numberOfLines={1} style={[styles.status, { color: colors.coral }]}>{status}</Text>}
        <View style={[styles.divider, { backgroundColor: dark ? colors.coralSoft : '#F9D8DA' }]} />
        <View style={styles.footerRow}>
          {canSign && <View style={styles.signatures}>
            <Pressable accessibilityRole="button" accessibilityLabel={yourSignature.length ? 'Edit your doodle' : 'Doodle to sign'} hitSlop={8}
              onPress={event => { event.stopPropagation(); onSign(); }} style={styles.signature}>
              <Text style={[styles.nameBadge, { color: colors.teal, backgroundColor: colors.tealSoft }]}>You</Text>
              {yourSignature.length ? <View style={styles.doodle}><DoodleThumb paths={yourSignature} color={colors.ink} height={22} /></View>
                : <Text style={[styles.signatureText, { color: colors.muted }]}>Tap to sign</Text>}
            </Pressable>
            <View accessible accessibilityLabel={partnerSignature.length ? `${partnerName} signed` : `${partnerName} has not signed yet`} style={styles.signature}>
              <Text numberOfLines={1} style={[styles.nameBadge, { color: colors.coral, backgroundColor: colors.coralSoft }]}>{partnerName}</Text>
              {partnerSignature.length ? <View style={styles.doodle}><DoodleThumb paths={partnerSignature} color={colors.ink} height={22} /></View>
                : <Text numberOfLines={1} style={[styles.signatureText, { color: colors.muted }]}>{partnerName} to sign</Text>}
            </View>
          </View>}
          {emphasizeAction && action([styles.acceptAction, { backgroundColor: colors.coral }], '#FFFFFF')}
        </View>
      </>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden' },
  banner: { flexDirection: 'row', alignItems: 'center', minHeight: 100 },
  art: { width: '43%', height: 100 },
  bannerCopy: { flex: 1, minWidth: 0, paddingLeft: 8 },
  bannerLabel: { fontSize: 17, fontWeight: '700' },
  bannerTitle: { fontSize: 34, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1 },
  pressed: { opacity: 0.7 },
  caption: { alignSelf: 'center', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  status: { alignSelf: 'center', marginTop: 2, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  emptyCopy: { alignItems: 'center', paddingTop: 7 },
  emptyTitle: { fontSize: 19, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5, textAlign: 'center' },
  divider: { height: 1, marginTop: 8, marginBottom: 5 },
  emptyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hint: { fontSize: 11, marginTop: 3, textAlign: 'center' },
  footerHint: { flex: 1, marginTop: 0, lineHeight: 15, textAlign: 'left' },
  setAction: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  prizeName: { marginTop: 7, fontSize: 19, fontWeight: '900', fontStyle: 'italic', letterSpacing: -0.5, textAlign: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editAction: { position: 'absolute', top: 2, right: 6, minHeight: 32, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  editText: { fontSize: 10, fontWeight: '600' },
  acceptAction: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '700' },
  signatures: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  signature: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  doodle: { flex: 1, minWidth: 0 },
  nameBadge: { overflow: 'hidden', maxWidth: 62, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderCurve: 'continuous', fontSize: 10, fontWeight: '800' },
  signatureText: { flexShrink: 1, fontSize: 10, fontStyle: 'italic' },
});
