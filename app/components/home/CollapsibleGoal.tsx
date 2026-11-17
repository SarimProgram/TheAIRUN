import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { ArrowUpRight, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

const GOAL_ICONS = require('../../assets/goals/goal-icons-v1.png');

const GoalExpansionContext = createContext(true);
export const useGoalExpanded = () => useContext(GoalExpansionContext);

export default function CollapsibleGoal({ number, title, titleAccessory, children, status, expandedStatus, details, onOpen, onTitlePress, onIconPress, iconAccessibilityHint = 'Opens the Activity page', complete = false, overTarget = false, connect = true, defaultExpanded = false, contentStyle }: {
  number: number;
  title: string;
  titleAccessory?: React.ReactNode;
  children: React.ReactNode;
  status?: React.ReactNode;
  expandedStatus?: React.ReactNode;
  details?: React.ReactNode;
  onOpen?: () => void;
  onTitlePress?: () => void;
  onIconPress?: () => void;
  iconAccessibilityHint?: string;
  complete?: boolean;
  overTarget?: boolean;
  connect?: boolean;
  defaultExpanded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hasOpened, setHasOpened] = useState(defaultExpanded);
  const dark = useColorScheme() === 'dark';
  const reducedMotion = useReducedMotion();
  const tilt = useSharedValue(0);
  const iconTiltStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reducedMotion ? 0 : tilt.get()}deg` }],
  }));
  useEffect(() => () => cancelAnimation(tilt), [tilt]);
  const Chevron = expanded ? ChevronUp : ChevronDown;
  const toggle = () => {
    cancelAnimation(tilt);
    if (!expanded) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!reducedMotion) {
        tilt.set(withSequence(
          withSpring(-8, { duration: 110, dampingRatio: 1 }),
          withSpring(5, { duration: 110, dampingRatio: 1 }),
          withSpring(0, { duration: 130, dampingRatio: 1 }),
        ));
      }
    } else {
      tilt.set(withSpring(0, { duration: 130, dampingRatio: 1 }));
    }
    setHasOpened(true);
    setExpanded(value => !value);
  };
  const iconIndex = Math.max(0, Math.min(3, number - 1));
  return <View style={[styles.section, connect && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dark ? '#334155' : '#E9EDF2' }]}>
    <View style={styles.header}>
      <Pressable
        accessibilityRole={onIconPress ? 'link' : 'button'}
        accessibilityLabel={`${onIconPress ? `Open ${title.toLowerCase()}` : `${expanded ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`}${overTarget ? ', over target' : complete ? ', complete, plus one goal' : ''}`}
        accessibilityHint={onIconPress ? iconAccessibilityHint : undefined}
        accessibilityState={onIconPress ? undefined : { expanded }}
        aria-expanded={onIconPress ? undefined : expanded}
        onPress={onIconPress ?? toggle}
        style={({ pressed }) => [
          styles.iconTarget,
          onIconPress && {
            backgroundColor: dark ? '#1E293B' : '#FFFFFF',
            boxShadow: dark ? '0 3px 0 #020617, 0 5px 8px rgba(0,0,0,0.2)' : '0 3px 0 #E2E8F0, 0 5px 8px rgba(15,23,42,0.08)',
          },
          pressed && styles.iconPressed,
        ]}
      >
        <Animated.View style={[styles.iconCrop, iconTiltStyle]} pointerEvents="none">
          <Image accessible={false} source={GOAL_ICONS} style={[styles.iconSheet, { left: -(iconIndex % 2) * 64, top: -Math.floor(iconIndex / 2) * 64 }]} />
        </Animated.View>
        {(complete || overTarget) && <View pointerEvents="none" style={[styles.goalCredit, { borderColor: dark ? '#0F172A' : '#FFFFFF', backgroundColor: overTarget ? '#B91C1C' : '#15803D' }]}>
          {overTarget ? <X accessible={false} size={14} color="#FFFFFF" strokeWidth={3} /> : <Text accessible={false} style={styles.goalCreditText}>+1</Text>}
        </View>}
      </Pressable>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
        <Pressable accessibilityRole={onTitlePress ? 'link' : 'button'} accessibilityLabel={title} accessibilityHint={onTitlePress ? 'Opens the full goal page' : 'Tap to expand or collapse this goal'} accessibilityState={onTitlePress ? undefined : { expanded }} aria-expanded={onTitlePress ? undefined : expanded} onPress={onTitlePress ?? toggle} style={[styles.titleTarget, expanded && titleAccessory != null && styles.titleWithAccessory]}>
          <Text style={[styles.title, { color: dark ? '#F1F5F9' : '#182033' }]}>{title}</Text>
        </Pressable>
        {expanded && titleAccessory}
        </View>
        {expanded && expandedStatus !== undefined ? expandedStatus : status}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title.toLowerCase()} details`} accessibilityState={{ expanded }} aria-expanded={expanded} onPress={toggle} style={({ pressed }) => [styles.expandTarget, pressed && { opacity: 0.6 }]}>
        <View style={[styles.expandIcon, { backgroundColor: dark ? '#39252C' : '#FFF1F2' }]}><Chevron size={18} strokeWidth={2.5} color="#FF6B6B" /></View>
      </Pressable>
    </View>
    {hasOpened && <GoalExpansionContext.Provider value={expanded}><View style={expanded ? [styles.content, contentStyle] : styles.hidden} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
      {details}
      {children}
      {onOpen && <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title.toLowerCase()}`} onPress={onOpen} style={styles.open}>
        <Text style={styles.openText}>View details</Text><ArrowUpRight size={18} color="#FF6B6B" />
      </Pressable>}
    </View></GoalExpansionContext.Provider>}
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  iconTarget: { width: 64, minHeight: 64, alignSelf: 'flex-start', alignItems: 'center', marginTop: 0, borderRadius: 20, borderCurve: 'continuous' },
  iconPressed: { transform: [{ translateY: 2 }, { scale: 0.97 }], boxShadow: 'none' },
  goalCredit: { position: 'absolute', right: -4, top: -4, minWidth: 28, height: 24, paddingHorizontal: 5, borderRadius: 12, borderWidth: 2, backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center' },
  goalCreditText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  iconCrop: { width: 64, height: 64, overflow: 'hidden' },
  iconSheet: { position: 'absolute', width: 128, height: 128 },
  copy: { flex: 1, minWidth: 0 },
  titleTarget: { minHeight: 44, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleWithAccessory: { flexShrink: 1, minWidth: 0 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  expandTarget: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  expandIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 12, paddingTop: 16, paddingBottom: 8 },
  open: { minHeight: 44, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'flex-end' },
  openText: { color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  hidden: { display: 'none' },
});
