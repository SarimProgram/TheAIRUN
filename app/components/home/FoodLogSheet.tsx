import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import type { PermissionResponse } from 'expo-modules-core';
import { Camera, Check, ChevronLeft, Keyboard as KeyboardIcon, RotateCcw, Send, X } from 'lucide-react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeOut, FadeOutLeft, FadeOutRight,
  LinearTransition, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FoodLogCoach, { type FoodCoachGender, type FoodCoachStage } from './FoodLogCoach';
import FoodScanTransition, { type FoodScan, type PhotoRect } from './FoodScanTransition';
import { MacroCard, PortionCard, ReviewHero, SendOptions, SendRow } from './FoodLogReview';
import PlateThrowStage from '@/components/mealpass/PlateThrowStage';
import DinnerPlate from '@/components/mealpass/DinnerPlate';
import { EASE_OUT, POP, SNAP, usePassColors, type PassColors } from '@/components/mealpass/passTheme';
import { useMealPassComposer, type PassChoice, type PassPhase } from '@/components/mealpass/useMealPassComposer';
import { simulateIncomingPlate } from '@/components/mealpass/MealPassOverlay';
import type { SharedMeal } from '@/lib/meal-pass-api';
import { overallShare, partnerWords, plateTotals, recipientPortion, senderPortion, uniformShares } from '@/lib/meal-pass';

export type FoodLogStep = 'camera' | 'manual' | 'analyzing' | 'results';
export type FoodLogItem = {
  foodName: string; calories: number; grams?: number | null;
  proteinG?: number | null; carbsG?: number | null; fatG?: number | null;
};
type Props = {
  visible: boolean; gender: FoodCoachGender; mealType: string; step: FoodLogStep;
  permission: PermissionResponse | null; cameraRef: React.RefObject<CameraView | null>;
  rootRef: React.RefObject<View | null>; cameraFrameRef: React.RefObject<View | null>;
  resultPhotoRef: React.RefObject<View | null>; onResultLayout: () => void;
  scan: FoodScan | null; photo: { original: string; cutout?: string } | null;
  items: FoodLogItem[]; manualName: string; manualKcal: string;
  capturing: boolean; saving: boolean; analyzingManual: boolean;
  onNameChange: (value: string) => void; onKcalChange: (value: string) => void;
  onItemCaloriesChange: (index: number, value: string) => void;
  onModeChange: (mode: 'camera' | 'manual') => void;
  onCapture: () => void; onIdentify: () => void; onSave: () => void;
  onPermission: () => void; onClose: () => void; onSettled: () => void;
  /** Plate passing lives inside the sheet so slider drags never re-render the screen behind it. */
  pass?: {
    authFetch: (input: string, init?: RequestInit) => Promise<Response>;
    userKey: string; partnerId?: string | null; partnerLinked: boolean;
    youAvatarKey?: string; partnerAvatarKey?: string; youGender?: string | null;
    dayKey: () => string;
    onPassed: (dayKey: string) => void | Promise<void>;
  };
};
const noFetch = () => Promise.reject(new Error('Not signed in'));
const Coach = React.memo(FoodLogCoach);
const SHEET_SPRING = { duration: 420, dampingRatio: 0.9 };
const PAGE_SPRING = { duration: 480, dampingRatio: 0.86 };
const pageIn = (from: 'left' | 'right') => (from === 'left' ? FadeInLeft : FadeInRight).duration(320).easing(EASE_OUT).reduceMotion(ReduceMotion.System);
const pageOut = (to: 'left' | 'right') => (to === 'left' ? FadeOutLeft : FadeOutRight).duration(180).reduceMotion(ReduceMotion.System);

/**
 * Sections rise into place one after another when a step changes, so the sheet never hard-cuts.
 * `still` mounts them in place: after a scan the flying photo is measured against its final slot,
 * and the sections are hidden under the scan overlay anyway.
 */
function Rise({ order, reduced, still, children, style }: { order: number; reduced: boolean; still?: boolean; children: React.ReactNode; style?: object }) {
  return (
    <Animated.View style={style}
      entering={still ? undefined : reduced ? FadeIn.duration(150) : FadeInDown.duration(320).delay(40 + order * 55).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
      {children}
    </Animated.View>
  );
}

/** Photo / Type it in, with a white pill that springs between the two. */
function ModeSwitch({ value, disabled, onChange, colors, reduced }: {
  value: 'camera' | 'manual'; disabled: boolean; onChange: (mode: 'camera' | 'manual') => void; colors: PassColors; reduced: boolean;
}) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(value === 'manual' ? 1 : 0);
  useEffect(() => { x.set(reduced ? (value === 'manual' ? 1 : 0) : withSpring(value === 'manual' ? 1 : 0, SNAP)); }, [reduced, value, x]);
  const half = Math.max(0, (width - 8) / 2);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * half }] }));
  return (
    <View accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.modes, { backgroundColor: colors.soft }]}>
      {width > 0 && <Animated.View pointerEvents="none" style={[styles.modePill, { width: half, backgroundColor: colors.card, boxShadow: colors.cardShadow }, pill]} />}
      {(['camera', 'manual'] as const).map(mode => {
        const selected = value === mode;
        const Icon = mode === 'camera' ? Camera : KeyboardIcon;
        const label = mode === 'camera' ? 'Photo' : 'Type it in';
        return <Pressable key={mode} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled}
          onPress={() => { if (!selected) { Keyboard.dismiss(); onChange(mode); } }} style={styles.mode}>
          <Icon size={17} color={selected ? colors.ink : colors.muted} strokeWidth={2.2} />
          <Text style={[styles.modeText, { color: selected ? colors.ink : colors.muted }]}>{label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

/** Viewfinder corners breathe slowly while the camera is live. */
function Viewfinder({ live, reduced }: { live: boolean; reduced: boolean }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (!live || reduced) { breathe.set(0); return; }
    breathe.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breathe);
  }, [breathe, live, reduced]);
  const motion = useAnimatedStyle(() => ({ opacity: 0.75 + breathe.get() * 0.25, transform: [{ scale: 1 - breathe.get() * 0.025 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.frameCorners, motion]}>
      <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
    </Animated.View>
  );
}

export default function FoodLogSheet(props: Props) {
  // Keep the last visible content through the exit, even when the caller resets
  // its draft immediately after saving. Otherwise the camera flashes on exit.
  const lastVisible = useRef(props);
  if (props.visible) lastVisible.current = props;
  const display = props.visible ? props : { ...lastVisible.current, visible: false, scan: props.scan };
  const {
    visible, gender, mealType, step, permission, cameraRef, rootRef, cameraFrameRef, resultPhotoRef,
    onResultLayout, scan, photo, items, manualName, manualKcal, capturing, saving, analyzingManual,
    onNameChange, onKcalChange, onItemCaloriesChange, onModeChange,
    onCapture, onIdentify, onSave, onPermission, onClose, onSettled, pass,
  } = display;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = usePassColors();
  const reduced = useReducedMotion();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [presented, setPresented] = useState(visible);
  const [focused, setFocused] = useState<'name' | 'kcal' | null>(null);
  const offset = useSharedValue(height);
  const opacity = useSharedValue(0);
  const press = useSharedValue(1);
  const sheetHeight = Math.min(height - insets.top - 12, step === 'results' ? 780 : 740 + insets.bottom);

  const passComposer = useMealPassComposer({
    authFetch: pass?.authFetch ?? noFetch, partnerLinked: !!pass?.partnerLinked, partnerId: pass?.partnerId,
    open: visible && step === 'results', userKey: pass?.userKey ?? 'default-user', rawItems: items,
  });
  const composer = pass ? passComposer : undefined;
  const passPhase = composer?.phase ?? 'idle';
  const blocked = saving || !!scan || capturing || analyzingManual || passPhase === 'sending';
  const reviewing = step === 'results';
  const canPass = reviewing && !!composer?.available;
  const passChoice: PassChoice = canPass ? composer!.choice : 'SOLO';
  const sharing = passChoice !== 'SOLO';
  const words = partnerWords(composer?.partner?.name, composer?.partner?.gender);
  const passLocked = passPhase === 'aiming' || passPhase === 'sending' || passPhase === 'passed';
  const theirTotals = sharing && composer ? plateTotals(recipientPortion(composer.items, composer.shares)) : null;
  const theirKcal = theirTotals?.calories ?? 0;
  const theirShare = sharing && composer ? overallShare(composer.items, composer.shares) : 0;
  const plateSize = Math.min(width * 0.38, 148);
  const plateRef = useRef<View>(null);

  // The send page is a second page inside the sheet: the plate tucks away and the options slide in.
  const [page, setPage] = useState<'log' | 'send'>('log');
  const [returned, setReturned] = useState(false);
  const sendOpen = canPass && page === 'send';
  const pageProgress = useSharedValue(0);
  useEffect(() => { if (!visible || !reviewing) { setPage('log'); setReturned(false); } }, [reviewing, visible]);
  useEffect(() => {
    pageProgress.set(reduced ? (sendOpen ? 1 : 0) : withSpring(sendOpen ? 1 : 0, PAGE_SPRING));
  }, [pageProgress, reduced, sendOpen]);
  const yourTotals = sharing && composer ? plateTotals(senderPortion(composer.items, composer.shares, passChoice === 'COPY' ? 'COPY' : 'SPLIT')) : null;

  const remaining = useSharedValue(1);
  const heroMotion = useAnimatedStyle(() => ({ transform: [{ scale: remaining.get() }] }));
  const [stageOrigin, setStageOrigin] = useState<PhotoRect | null>(null);
  useEffect(() => {
    if (passPhase !== 'aiming' || stageOrigin) return;
    if (!rootRef.current || !plateRef.current) return;
    rootRef.current.measureInWindow((rootX, rootY) => {
      plateRef.current?.measureInWindow((x, y, w, h) => setStageOrigin({ x: x - rootX, y: y - rootY, width: w, height: h }));
    });
  }, [passPhase, rootRef, stageOrigin]);
  const openSend = () => {
    if (!composer) return;
    Keyboard.dismiss();
    void Haptics.selectionAsync().catch(() => {});
    composer.choose('COPY');
    setPage('send');
  };
  const backToLog = useCallback(() => {
    composer?.choose('SOLO');
    setReturned(true);
    setPage('log');
  }, [composer]);
  useEffect(() => {
    // The photo gives up its portion while the plate is out, then settles back.
    remaining.set(stageOrigin
      ? withTiming(sharing && passChoice === 'SPLIT' ? 0.9 : 0.96, { duration: 260, easing: EASE_OUT })
      : withSpring(1, reduced ? SNAP : POP));
  }, [passChoice, reduced, remaining, sharing, stageOrigin]);
  const stageClosed = useCallback(() => setStageOrigin(null), []);
  const handleThrown = (xPct: number) => {
    if (!pass || !composer) return;
    const dayKey = pass.dayKey();
    void composer.throwPlate({
      xPct, mealType: mealType.toUpperCase() as SharedMeal['mealType'], dayKey,
      photoUri: photo?.original, cutoutUri: photo?.cutout, inputText: photo ? null : manualName.trim() || null,
      onLogged: () => { void Promise.resolve(pass.onPassed(dayKey)).catch(() => {}); },
    });
  };

  // Dev only: the real throw stage with no API call, then the same plate lands on this phone as if from the partner.
  const [devThrow, setDevThrow] = useState<{ origin: PhotoRect; phase: PassPhase } | null>(null);
  const devThrowRef = useRef({ phase: 'idle' as PassPhase, xPct: 0.5 });
  const setDevPhase = (phase: PassPhase) => { devThrowRef.current.phase = phase; setDevThrow(current => current && { ...current, phase }); };
  const landDevPlate = (xPct?: number) => {
    Keyboard.dismiss();
    onClose();
    const plate = {
      xPct, mealType: mealType.toUpperCase() as SharedMeal['mealType'], items: items.length ? items : undefined,
      imageUri: photo ? photo.cutout || photo.original : null, isCutout: !!photo?.cutout,
    };
    setTimeout(() => simulateIncomingPlate(plate), 450);
  };
  const startDevThrow = () => {
    Keyboard.dismiss();
    devThrowRef.current = { phase: 'aiming', xPct: 0.5 };
    setDevThrow({ origin: { x: width / 2 - 60, y: height * 0.45 - 60, width: 120, height: 120 }, phase: 'aiming' });
  };
  const devThrown = (xPct: number) => {
    devThrowRef.current.xPct = xPct;
    setDevPhase('sending');
    setTimeout(() => setDevPhase('passed'), 600);
  };
  const devClosed = () => {
    const thrown = devThrowRef.current.phase === 'passed';
    setDevThrow(null);
    if (thrown) landDevPlate(devThrowRef.current.xPct);
  };

  const cameraMode = step === 'camera' || (step === 'analyzing' && !!scan);
  const fromScan = !!scan;
  const coachStage: FoodCoachStage = reviewing ? 'ready' : step === 'analyzing' ? 'scan' : step === 'manual' ? 'manual' : 'welcome';
  const total = items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const knownMacro = (key: 'proteinG' | 'carbsG' | 'fatG') => items.some(item => item[key] != null);
  const macro = (key: 'proteinG' | 'carbsG' | 'fatG') => Math.round(items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0));

  useEffect(() => {
    if (visible) {
      setPresented(true);
      offset.set(reduced ? 0 : height);
      offset.set(withSpring(0, SHEET_SPRING));
      opacity.set(withTiming(1, { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }));
    } else {
      offset.set(withTiming(reduced ? 0 : height, { duration: 280, easing: Easing.in(Easing.cubic) }));
      opacity.set(withTiming(0, { duration: 220, reduceMotion: ReduceMotion.Never }, finished => {
        if (finished) scheduleOnRN(setPresented, false);
      }));
    }
    return () => { cancelAnimation(offset); cancelAnimation(opacity); };
  }, [height, offset, opacity, reduced, visible]);
  useLayoutEffect(() => { if (step === 'camera') { setCameraReady(false); setCameraError(false); } }, [step, visible]);
  const close = useCallback(() => {
    if (saving || passPhase === 'sending') return;
    if (passPhase === 'aiming') { composer?.cancel(); return; }
    Keyboard.dismiss(); onClose();
  }, [composer, onClose, passPhase, saving]);
  const back = useCallback(() => {
    if (sendOpen && !passLocked && !saving) backToLog();
    else close();
  }, [backToLog, close, passLocked, saving, sendOpen]);
  const pan = Gesture.Pan().enabled(!blocked && !stageOrigin).onChange(event => {
    cancelAnimation(offset);
    offset.set(Math.max(-12, offset.get() + event.changeY * (offset.get() < 0 ? 0.3 : 1)));
  }).onEnd(event => {
    if (offset.get() + event.velocityY * 0.15 > sheetHeight * 0.24) {
      offset.set(withSpring(height, { ...SHEET_SPRING, velocity: event.velocityY }, finished => { if (finished) scheduleOnRN(close); }));
    } else offset.set(withSpring(0, { ...SHEET_SPRING, velocity: event.velocityY }));
  });
  const sheetMotion = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: reduced ? [] : [{ translateY: offset.get() }] }));
  const backdropMotion = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const buttonMotion = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const pressIn = () => { if (!reduced) press.set(withTiming(0.97, { duration: 110, easing: EASE_OUT })); };
  const pressOut = () => press.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
  const disabled = blocked || (cameraMode ? !permission?.granted || !cameraReady || cameraError : step === 'manual' ? !manualName.trim() || (!!manualKcal && (!Number.isFinite(Number(manualKcal)) || Number(manualKcal) < 0)) : step === 'results' ? !items.length : true);
  const mainAction = () => {
    Keyboard.dismiss();
    if (reviewing && sharing && composer) {
      if (passPhase === 'passed') onClose();
      else if (passPhase !== 'aiming') composer.lift();
    } else if (reviewing) onSave();
    else if (step === 'manual') onIdentify();
    else onCapture();
  };

  const mealWord = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
  const title = step === 'manual' ? 'Tell me what\u2019s cooking.' : step === 'analyzing' && !scan ? 'A closer look\nat your meal.' : 'Scan your meal.';
  const pageTitle = !reviewing ? null : sendOpen ? `Share with ${words.name}` : `Log ${mealWord.toLowerCase()}`;
  const passButtonLabel = passPhase === 'sending' ? 'Passing the plate\u2026' : passPhase === 'passed' ? 'Done' : passPhase === 'error' ? 'Try again'
    : `Send to ${words.name}`;
  const footerHint = !reviewing ? null : !sharing ? 'Your estimate. Your final say.'
    : passChoice === 'SPLIT' ? `You keep ${(yourTotals?.calories ?? 0).toLocaleString()} kcal` : `${words.subject} gets a copy. Yours stays logged.`;
  const passStatus = passPhase === 'sending' && !stageOrigin ? `Passing to ${words.object}\u2026` : passPhase === 'passed' ? composer?.statusLabel ?? `Waiting for ${words.object}`
    : passPhase === 'error' ? composer?.error ?? 'Could not pass the plate.' : null;
  const mealTitle = items.length === 1 ? items[0].foodName : manualName.trim() || undefined;
  const plateName = mealTitle
    || (items.length > 2 ? `${items.slice(0, 2).map(item => item.foodName).join(', ')} + ${items.length - 2} more` : items.map(item => item.foodName).join(' & '))
    || `Your ${mealType.toLowerCase()}`;
  const primaryLabel = saving ? 'Logging your meal\u2026' : analyzingManual ? 'Estimating nutrition\u2026' : reviewing ? 'Log meal' : step === 'manual' ? manualKcal ? 'Review meal' : 'Estimate nutrition' : 'Scan meal';

  return <Modal visible={presented || visible} transparent animationType="none" statusBarTranslucent onRequestClose={back}>
    <GestureHandlerRootView style={styles.fill}>
      <View ref={rootRef} collapsable={false} style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, backdropMotion]}>
          <Pressable accessibilityLabel="Close food log" accessibilityRole="button" onPress={close} style={styles.fill} disabled={saving} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottom} pointerEvents={scan ? 'none' : 'box-none'}>
          <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!!scan || !!stageOrigin} importantForAccessibility={scan || stageOrigin ? 'no-hide-descendants' : 'auto'}
            style={[styles.sheet, { height: sheetHeight, backgroundColor: colors.surface }, sheetMotion]}>
            <GestureDetector gesture={pan}>
              <View style={styles.sheetTop}>
                <View style={[styles.handle, { backgroundColor: colors.handle }]} />
                <View style={styles.header}>
                  <View style={styles.pageTitleSlot}>
                    {pageTitle && <Animated.View key={pageTitle} entering={reduced ? FadeIn.duration(150) : pageIn(sendOpen ? 'right' : 'left')}
                      exiting={reduced ? FadeOut.duration(120) : pageOut(sendOpen ? 'right' : 'left')} style={styles.pageTitleRow}>
                      {sendOpen && !passLocked && <Pressable accessibilityRole="button" accessibilityLabel="Back to your meal" disabled={blocked} onPress={backToLog}
                        hitSlop={8} style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}>
                        <ChevronLeft size={26} color={colors.ink} strokeWidth={2.4} />
                      </Pressable>}
                      <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.ink }]} numberOfLines={1}>{pageTitle}</Text>
                    </Animated.View>}
                  </View>
                  {__DEV__ && <View style={styles.devRow}>
                    <Pressable accessibilityRole="button" onPress={startDevThrow} disabled={!!devThrow || blocked}
                      style={({ pressed }) => [styles.devPill, { borderColor: colors.faint, opacity: pressed ? 0.5 : 1 }]}>
                      <Text style={[styles.devText, { color: colors.muted }]}>DEV throw</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => landDevPlate()} disabled={!!devThrow || blocked}
                      style={({ pressed }) => [styles.devPill, { borderColor: colors.faint, opacity: pressed ? 0.5 : 1 }]}>
                      <Text style={[styles.devText, { color: colors.muted }]}>DEV receive</Text>
                    </Pressable>
                  </View>}
                  <Pressable accessibilityRole="button" accessibilityLabel="Close meal sheet" disabled={saving} onPress={close}
                    style={({ pressed }) => [styles.close, { backgroundColor: colors.soft, opacity: pressed ? 0.6 : 1 }]}>
                    <X size={18} color={colors.muted} strokeWidth={2.4} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {!reviewing && <View style={styles.intro}>
                <View style={styles.introText}>
                  <Animated.Text key={title} entering={reduced ? FadeIn.duration(150) : FadeInDown.duration(280).easing(EASE_OUT)} style={[styles.title, { color: colors.ink }]}>{title}</Animated.Text>
                </View>
                {(presented || visible) && <View style={styles.coach}><Coach gender={gender} stage={coachStage} playing={!scan && visible} /></View>}
              </View>}

              {(cameraMode || step === 'manual') && <ModeSwitch value={cameraMode ? 'camera' : 'manual'} disabled={blocked} onChange={onModeChange} colors={colors} reduced={reduced} />}

              {cameraMode && <Rise order={0} reduced={reduced} key="camera" style={styles.cameraSection}>
                <View ref={cameraFrameRef} collapsable={false} style={[styles.camera, { boxShadow: colors.liftShadow }]}>
                  {scan ? <Image source={{ uri: scan.photoUri }} style={styles.fill} resizeMode="cover" /> : permission?.granted && !cameraError ? <>
                    <CameraView ref={cameraRef} style={styles.fill} facing="back" onCameraReady={() => setCameraReady(true)} onMountError={() => setCameraError(true)} />
                    <Viewfinder live={cameraReady} reduced={reduced} />
                  </> : <View style={styles.cameraFallback}>
                    <View style={styles.cameraFallbackIcon}><Camera size={26} color="#FFFFFF" strokeWidth={1.8} /></View>
                    <Text style={styles.cameraFallbackTitle}>{cameraError ? 'Camera unavailable' : !permission ? 'Preparing your camera' : 'Let\u2019s see your meal'}</Text>
                    <Text style={styles.cameraFallbackText}>{cameraError ? 'Try reopening the sheet, or type your meal instead.' : 'Allow camera access to scan a photo, or type it in instead.'}</Text>
                    {!cameraError && permission && <Pressable accessibilityRole="button" onPress={() => permission.canAskAgain ? onPermission() : void Linking.openSettings()}
                      style={({ pressed }) => [styles.permissionButton, { opacity: pressed ? 0.8 : 1 }]}>
                      <Text style={styles.permissionText}>{permission.canAskAgain ? 'Allow camera' : 'Open settings'}</Text>
                    </Pressable>}
                  </View>}
                </View>
              </Rise>}

              {step === 'manual' && <Rise order={0} reduced={reduced} key="manual" style={styles.fields}>
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.ink }]}>What did you eat?</Text>
                  <TextInput accessibilityLabel="Food description" onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                    style={[styles.input, { backgroundColor: colors.card, color: colors.ink, borderColor: focused === 'name' ? colors.accent : colors.line }]}
                    placeholder="e.g. Chicken salad with avocado" placeholderTextColor={colors.faint} value={manualName} onChangeText={onNameChange} multiline textAlignVertical="top" />
                </View>
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}><Text style={[styles.fieldLabel, { color: colors.ink }]}>Calories</Text><Text style={[styles.optional, { color: colors.faint }]}>OPTIONAL</Text></View>
                  <View style={[styles.calorieField, { backgroundColor: colors.card, borderColor: focused === 'kcal' ? colors.accent : colors.line }]}>
                    <TextInput accessibilityLabel="Meal calories" onFocus={() => setFocused('kcal')} onBlur={() => setFocused(null)}
                      style={[styles.calorieInput, { color: colors.ink }]} placeholder="I can estimate this" placeholderTextColor={colors.faint} value={manualKcal} onChangeText={onKcalChange} keyboardType="number-pad" />
                    <Text style={[styles.unit, { color: colors.muted }]}>kcal</Text>
                  </View>
                </View>
              </Rise>}

              {step === 'analyzing' && !scan && <Rise order={0} reduced={reduced} key="progress">
                <View style={[styles.manualProgress, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={colors.accent} />
                  <Text style={[styles.progressText, { color: colors.ink }]}>Finding your meal’s nutrition…</Text>
                </View>
              </Rise>}

              {reviewing && <View style={styles.results}>
                <Rise order={0} reduced={reduced} still={fromScan}>
                  <ReviewHero
                    progress={pageProgress} sending={sendOpen} width={width - 48} plateSize={plateSize} plateRef={plateRef}
                    name={plateName} kcal={total} foods={items.length} colors={colors}
                    plate={<Animated.View style={[{ width: plateSize, height: plateSize, borderRadius: plateSize / 2, boxShadow: colors.liftShadow }, heroMotion]}>
                      <DinnerPlate
                        size={plateSize} imageUri={photo ? photo.cutout || photo.original : null} isCutout={!!photo?.cutout} colors={colors}
                        title={photo ? undefined : mealTitle} foodHidden={!!scan} foodRef={resultPhotoRef} onFoodLayout={onResultLayout}
                      />
                    </Animated.View>}
                  />
                </Rise>
                <Rise order={1} reduced={reduced} still={fromScan}>
                  <MacroCard colors={colors} values={{
                    proteinG: knownMacro('proteinG') ? macro('proteinG') : null,
                    carbsG: knownMacro('carbsG') ? macro('carbsG') : null,
                    fatG: knownMacro('fatG') ? macro('fatG') : null,
                  }} />
                </Rise>

                {sendOpen && composer ? <Animated.View key="send" style={styles.results}
                  entering={reduced ? FadeIn.duration(150) : pageIn('right')} exiting={reduced ? FadeOut.duration(120) : pageOut('right')}>
                  <SendOptions portion={passChoice === 'SPLIT'} locked={passLocked || blocked} fullKcal={total} colors={colors}
                    onChoose={portion => composer.choose(portion ? 'SPLIT' : 'COPY')} />
                  {passChoice === 'SPLIT' && theirTotals && <Animated.View
                    entering={reduced ? FadeIn.duration(150) : FadeInDown.duration(300).easing(EASE_OUT)} exiting={FadeOut.duration(140)}>
                    <PortionCard share={theirShare} totals={theirTotals} keepKcal={yourTotals?.calories ?? 0} locked={passLocked || blocked} colors={colors}
                      onChange={share => composer.setShares(uniformShares(composer.items, share))} />
                  </Animated.View>}
                  {passStatus && <Animated.View entering={FadeIn.duration(200)} layout={reduced ? undefined : LinearTransition.duration(240).easing(EASE_OUT)}
                    style={[styles.passStatus, { backgroundColor: passPhase === 'error' ? colors.accentSoft : colors.card, boxShadow: colors.cardShadow }]} accessibilityLiveRegion="polite">
                    {passPhase === 'sending' ? <ActivityIndicator size="small" color={colors.muted} />
                      : passPhase === 'passed' && composer.statusLabel && !composer.statusLabel.startsWith('Waiting') ? <Check size={14} color={colors.success} strokeWidth={3} />
                      : passPhase === 'passed' ? <View style={[styles.waitingDot, { backgroundColor: colors.partner }]} /> : null}
                    <Text style={[styles.passStatusText, { color: passPhase === 'error' ? colors.accent : colors.ink }]}>{passStatus}</Text>
                  </Animated.View>}
                </Animated.View> : <Animated.View key="log" style={styles.results}
                  entering={returned ? (reduced ? FadeIn.duration(150) : pageIn('left')) : undefined} exiting={reduced ? FadeOut.duration(120) : pageOut('left')}>
                  {canPass && <Rise order={2} reduced={reduced} still={fromScan || returned}>
                    <SendRow name={words.name} disabled={blocked} onPress={openSend} colors={colors}
                      you={{ name: 'You', avatarKey: pass?.youAvatarKey, gender: pass?.youGender }}
                      partner={{ name: words.name, avatarKey: pass?.partnerAvatarKey, gender: composer!.partner?.gender }} />
                  </Rise>}
                  <Rise order={3} reduced={reduced} still={fromScan || returned} key="items">
                    <View style={styles.breakdownHeader}><Text style={[styles.sectionLabel, { color: colors.faint }]}>ON YOUR PLATE</Text><Text style={[styles.optional, { color: colors.faint }]}>Tap calories to adjust</Text></View>
                    <View style={[styles.foodCard, { backgroundColor: colors.card, boxShadow: colors.cardShadow }]}>
                      {items.map((item, index) => <View key={index} style={[styles.foodRow, index > 0 && { borderTopWidth: 1, borderColor: colors.line }]}>
                        <View style={styles.foodInfo}>
                          <Text style={[styles.foodName, { color: colors.ink }]}>{item.foodName}</Text>
                          <Text style={[styles.foodPortion, { color: colors.muted }]}>{item.grams != null ? `About ${Math.round(item.grams)}g` : 'Estimated serving'}</Text>
                        </View>
                        <TextInput accessibilityLabel={`Calories for ${item.foodName}`} editable={!saving && !scan} style={[styles.foodCalories, { color: colors.ink, backgroundColor: colors.soft }]} keyboardType="number-pad" value={String(item.calories)} onChangeText={value => onItemCaloriesChange(index, value)} selectTextOnFocus />
                        <Text style={[styles.unit, { color: colors.muted }]}>kcal</Text>
                      </View>)}
                    </View>
                  </Rise>
                  <Rise order={4} reduced={reduced} still={fromScan || returned}>
                    <Pressable accessibilityRole="button" disabled={blocked} onPress={() => onModeChange(photo ? 'camera' : 'manual')} style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.5 : 1 }]}>
                      {photo ? <RotateCcw size={15} color={colors.muted} /> : <ChevronLeft size={15} color={colors.muted} />}
                      <Text style={[styles.retryText, { color: colors.muted }]}>{photo ? 'Retake photo' : 'Edit description'}</Text>
                    </Pressable>
                  </Rise>
                </Animated.View>}
              </View>}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.surface, borderTopColor: colors.line }]}>
              <Animated.View style={buttonMotion}>
                {reviewing && sharing ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={passButtonLabel} accessibilityState={{ disabled, busy: passPhase === 'sending' }} disabled={disabled} onPress={mainAction}
                    onPressIn={pressIn} onPressOut={pressOut}
                    style={[styles.primary, { backgroundColor: colors.accent, boxShadow: disabled ? 'none' : colors.accentShadow, opacity: disabled ? 0.5 : 1 }]}>
                    <Animated.View entering={FadeIn.duration(200)} style={styles.primaryInner}>
                      {passPhase === 'sending' ? <ActivityIndicator color={colors.onAccent} /> : passPhase === 'passed' ? <Check size={20} color={colors.onAccent} strokeWidth={2.6} /> : <Send size={19} color={colors.onAccent} strokeWidth={2.4} />}
                      <Text style={[styles.primaryText, { color: colors.onAccent }]}>{passButtonLabel}</Text>
                      {(passPhase === 'idle' || passPhase === 'error') && <View style={styles.primaryTotal}><Text style={[styles.primaryTotalText, { color: colors.onAccent }]}>{theirKcal} kcal</Text></View>}
                    </Animated.View>
                  </Pressable>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel} accessibilityState={{ disabled, busy: blocked }} disabled={disabled} onPress={mainAction}
                    onPressIn={pressIn} onPressOut={pressOut}
                    style={[styles.primary, { backgroundColor: colors.accent, boxShadow: disabled ? 'none' : colors.accentShadow, opacity: disabled ? 0.5 : 1 }]}>
                    <Animated.View entering={returned ? FadeIn.duration(200) : undefined} style={styles.primaryInner}>
                      {blocked ? <ActivityIndicator color={colors.onAccent} /> : reviewing ? <Check size={20} color={colors.onAccent} strokeWidth={2.6} /> : step === 'manual' ? <KeyboardIcon size={19} color={colors.onAccent} strokeWidth={2.2} /> : <Camera size={20} color={colors.onAccent} strokeWidth={2.2} />}
                      <Text style={[styles.primaryText, { color: colors.onAccent }]}>{primaryLabel}</Text>
                      {reviewing && <View style={styles.primaryTotal}><Text style={[styles.primaryTotalText, { color: colors.onAccent }]}>{total} kcal</Text></View>}
                    </Animated.View>
                  </Pressable>
                )}
              </Animated.View>
              {footerHint && <Animated.Text key={footerHint.startsWith('You keep') ? 'keep' : footerHint} entering={FadeIn.duration(180)}
                style={[styles.footerHint, { color: colors.muted }]}>{footerHint}</Animated.Text>}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
        {scan && <FoodScanTransition scan={scan} gender={gender} onCancel={close} onSettled={onSettled} />}
        {stageOrigin && composer && <PlateThrowStage
          origin={stageOrigin} imageUri={photo ? photo.cutout || photo.original : null} isCutout={!!photo?.cutout} title={mealTitle} mealType={mealType}
          copy={passChoice === 'COPY'} share={theirShare} kcal={theirKcal} words={words} colors={colors}
          partner={{ name: words.name, avatarKey: pass?.partnerAvatarKey, gender: composer.partner?.gender }}
          phase={passPhase} error={composer.error} cancelled={passPhase === 'idle'}
          onThrown={handleThrown} onCancel={composer.cancel} onClosed={stageClosed}
        />}
        {__DEV__ && devThrow && <PlateThrowStage
          origin={devThrow.origin} imageUri={photo ? photo.cutout || photo.original : null} isCutout={!!photo?.cutout} title={mealTitle ?? 'Chicken & rice'} mealType={mealType}
          copy={false} share={0.4} kcal={Math.round((total || 780) * 0.4)} words={words} colors={colors}
          partner={{ name: words.name, avatarKey: pass?.partnerAvatarKey, gender: composer?.partner?.gender }}
          phase={devThrow.phase} error={null} cancelled={devThrow.phase === 'idle'}
          onThrown={devThrown} onCancel={() => setDevPhase('idle')} onClosed={devClosed}
        />}
      </View>
    </GestureHandlerRootView>
  </Modal>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderCurve: 'continuous', overflow: 'hidden', flexShrink: 1, maxHeight: '100%', boxShadow: '0 -12px 32px rgba(15, 23, 42, 0.16)' },
  sheetTop: { paddingHorizontal: 24, paddingTop: 12 }, handle: { width: 44, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  pageTitleSlot: { flex: 1, minHeight: 44, justifyContent: 'center' },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageTitle: { flexShrink: 1, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  back: { width: 36, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  close: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  devRow: { flexDirection: 'row', gap: 6, marginRight: 8 },
  devPill: { height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  devText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 16, gap: 16 }, intro: { minHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 16 },
  introText: { flex: 1, paddingVertical: 8 }, title: { fontSize: 30, lineHeight: 34, letterSpacing: -0.8, fontWeight: '800' },
  coach: { width: 80, height: 120, alignSelf: 'flex-end' },
  modes: { flexDirection: 'row', padding: 4, borderRadius: 18, borderCurve: 'continuous' },
  modePill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 14, borderCurve: 'continuous' },
  mode: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, modeText: { fontSize: 14, fontWeight: '600' },
  cameraSection: { flexGrow: 1, minHeight: 280 },
  camera: { flex: 1, minHeight: 280, borderRadius: 28, borderCurve: 'continuous', backgroundColor: '#1E293B', overflow: 'hidden' },
  frameCorners: { ...StyleSheet.absoluteFillObject, margin: 28 }, corner: { position: 'absolute', width: 30, height: 30, borderColor: '#FFFFFF' },
  topLeft: { left: 0, top: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 }, topRight: { right: 0, top: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bottomLeft: { left: 0, bottom: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 }, bottomRight: { right: 0, bottom: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  cameraFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  cameraFallbackIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cameraFallbackTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' }, cameraFallbackText: { color: '#CBD5E1', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 260 },
  permissionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 22, backgroundColor: '#FFFFFF', marginTop: 8 }, permissionText: { color: '#1F2937', fontSize: 14, fontWeight: '800' },
  fields: { gap: 24 }, field: { gap: 8 }, fieldLabel: { fontSize: 15, fontWeight: '600' }, fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optional: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  input: { minHeight: 104, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1.5, fontSize: 16, fontWeight: '500', padding: 16, lineHeight: 22 },
  calorieField: { borderWidth: 1.5, borderRadius: 18, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  calorieInput: { flex: 1, minHeight: 56, fontSize: 16, fontWeight: '600' }, unit: { fontSize: 12, fontWeight: '600' },
  manualProgress: { padding: 20, borderRadius: 24, borderCurve: 'continuous', flexDirection: 'row', gap: 12, alignItems: 'center' }, progressText: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  results: { gap: 16 },
  passStatus: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 18 },
  passStatusText: { fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, waitingDot: { width: 7, height: 7, borderRadius: 4 },
  breakdownHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  foodCard: { borderRadius: 24, borderCurve: 'continuous', paddingHorizontal: 16 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }, foodInfo: { flex: 1, gap: 2 },
  foodName: { fontSize: 15, fontWeight: '700', lineHeight: 20 }, foodPortion: { fontSize: 12, fontWeight: '500' },
  foodCalories: { width: 68, minHeight: 44, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 8, textAlign: 'center', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, retryText: { fontSize: 13, fontWeight: '700' },
  footer: { paddingHorizontal: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  primary: { minHeight: 56, borderRadius: 20, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  primaryInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { fontSize: 16, fontWeight: '800' },
  primaryTotal: { marginLeft: 'auto', paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  primaryTotalText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footerHint: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
