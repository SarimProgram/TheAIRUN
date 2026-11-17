// @refresh reset
// Dispose old native animation mappers whenever this scene is edited.
import React, { useEffect, useId, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, type SharedValue, useAnimatedProps, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useGoalExpanded } from './CollapsibleGoal';
import { NUTRITION_FOOD } from './nutritionAssets';
import { POSE, PULLEY, pulleyGeometry, pulleyStrain } from './pulleyGeometry';
import PulleyTrophy from './PulleyTrophy';

const MovingGroup = Animated.createAnimatedComponent(G);
const MovingPath = Animated.createAnimatedComponent(Path);
const POSES = require('../../assets/avatars/calorie-pulley-poses-v2.png');
const FONT = Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif', default: 'Arial' });
const IS_WEB = Platform.OS === 'web';
const BASKET_SCALE = 1.3;

type SvgMatrixProps = { transform?: string; matrix?: number[] };

// Native Reanimated parses `transform` as a React Native/CSS transform, not SVG.
// Send the SVG node's six-value matrix directly; web still needs an SVG attribute.
function svgTranslation(x: number, y: number): SvgMatrixProps {
  'worklet';
  return IS_WEB ? { transform: `matrix(1,0,0,1,${x},${y})` } : { matrix: [1, 0, 0, 1, x, y] };
}

function svgRotation(degrees: number, x: number, y: number): SvgMatrixProps {
  'worklet';
  const radians = degrees * Math.PI / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const tx = x - c * x + s * y;
  const ty = y - s * x - c * y;
  return IS_WEB
    ? { transform: `matrix(${c},${s},${-s},${c},${tx},${ty})` }
    : { matrix: [c, s, -s, c, tx, ty] };
}
export type PulleyTotals = { food?: number; exercise?: number; goal?: number };
type Gender = 'male' | 'female';

export function pulleyLoad(data: PulleyTotals) {
  const food = Number.isFinite(data.food) ? data.food! : 0;
  const exercise = Number.isFinite(data.exercise) ? data.exercise! : 0;
  const goal = Number.isFinite(data.goal) && data.goal! > 0 ? data.goal! : 0;
  return goal ? Math.max(0, Math.min(1.3, (food - exercise) / goal)) : 0;
}

/** A complete connected rig, mirrored as a unit so every rope shares one geometry. */
function PulleyRig({ right, gender, data, phase, intro, id }: {
  right: boolean; gender: Gender; data: PulleyTotals; phase: SharedValue<number>; intro: SharedValue<number>; id: string;
}) {
  const load = pulleyLoad(data);
  const heavy = load >= 0.8;
  const female = gender === 'female';
  const strain = pulleyStrain(load);
  const remaining = Math.round((data.goal || 0) - ((data.food || 0) - (data.exercise || 0)));
  const { x, y, radius } = PULLEY;
  // Both rope strokes and all moving parts share one geometry calculation per frame.
  const geometry = useDerivedValue(() => pulleyGeometry(phase.get(), load * intro.get(), female));
  const person = useAnimatedProps(() => svgTranslation(geometry.get().shift, 0));
  const rope = useAnimatedProps(() => ({ d: geometry.get().rope }));
  const basket = useAnimatedProps(() => svgTranslation(PULLEY.basketX, geometry.get().basketY));
  const wheel = useAnimatedProps(() => svgRotation(geometry.get().wheelDegrees, PULLEY.x, PULLEY.y));
  const housing = useAnimatedProps(() => svgRotation(geometry.get().shakeDegrees, PULLEY.x, -2));
  return <G transform={right ? 'translate(400 0) scale(-1 1)' : undefined}>
    <Defs>
      <LinearGradient id={id + 'metal'} x2="1" y2="1">
        <Stop stopColor="#F0F2EF" /><Stop offset=".5" stopColor="#AAB2B1" /><Stop offset="1" stopColor="#626E70" />
      </LinearGradient>
      <LinearGradient id={id + 'rim'} x2="0" y2="1">
        <Stop stopColor="#FFAAA0" /><Stop offset=".45" stopColor="#F16E65" /><Stop offset="1" stopColor="#BF4A48" />
      </LinearGradient>
      <LinearGradient id={id + 'basket'} x2="0" y2="1">
        <Stop stopColor="#E9BA82" /><Stop offset="1" stopColor="#BA804C" />
      </LinearGradient>
      <ClipPath id={id + 'pose'}><Rect width={512} height={512} /></ClipPath>
    </Defs>
    <Rect x={x - 6} y={-4} width={12} height={17} rx={2} fill={`url(#${id}metal)`} stroke="#5F6A6C" strokeWidth={0.8} />
    <Circle cx={x} cy={1} r={1.4} fill="#4F595B" />
    <MovingGroup animatedProps={housing}>
      <Circle cx={x} cy={y} r={radius + 4} fill="#000" opacity={0.06} transform="translate(0 2)" />
      <Circle cx={x} cy={y} r={radius + 3.5} fill={`url(#${id}rim)`} stroke="#B3574D" strokeWidth={1} />
      <Circle cx={x} cy={y} r={radius} fill="#883F36" />
      <MovingGroup animatedProps={wheel}>
        <Circle cx={x} cy={y} r={radius - 3} fill={`url(#${id}rim)`} stroke="#FFD1BF" strokeWidth={1} />
        <Path d={`M${x - 10} ${y} h20 M${x} ${y - 10} v20`} stroke="#C14F48" strokeWidth={2.2} />
      </MovingGroup>
      {strain > 0 && <G opacity={0.35 + strain * 0.65}>
        <Path d={`M${x - 12} ${y + 13} l4 -3.5 l0.5 -4 l4.5 -2 l1 -3`} fill="none" stroke="#3E1614" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
        {load >= 1 && <Path d={`M${x + 6} ${y + 17} l-1 -4 l3 -3 l-0.5 -4`} fill="none" stroke="#3E1614" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />}
      </G>}
    </MovingGroup>
    <MovingPath animatedProps={rope} fill="none" stroke="#714A2B" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    <MovingPath animatedProps={rope} fill="none" stroke="#E9C18D" strokeWidth={1.2} strokeDasharray="2 2.8" strokeLinecap="round" />
    {strain > 0 && <G opacity={strain}>
      <Rect x={PULLEY.basketX - 2} y={y + 24} width={4} height={8} fill="#FFFFFF" />
      <Path d={`M${PULLEY.basketX - 0.6} ${y + 24} V${y + 32} M${PULLEY.basketX + 0.8} ${y + 24} V${y + 32}`} stroke="#714A2B" strokeWidth={0.7} />
      <Path d={`M${PULLEY.basketX + 0.8} ${y + 27} q3.5 0.5 4.5 3.5 M${PULLEY.basketX - 0.6} ${y + 29} q-3.5 0.5 -4 3.5`} fill="none" stroke="#8A6040" strokeWidth={0.6} strokeLinecap="round" />
    </G>}
    <Rect x={x - 3.5} y={12} width={7} height={23} rx={3} fill={`url(#${id}metal)`} stroke="#677274" strokeWidth={0.7} />
    <Circle cx={x} cy={y} r={2.5} fill="#F5F7F5" stroke="#697777" strokeWidth={1} />
    <MovingGroup transform={`translate(${PULLEY.basketX} ${pulleyGeometry(0, load, female).basketY})`} animatedProps={basket}>
      {/* Counter-mirror the basket's text and food while keeping its hook attached. */}
      <G transform={`scale(${right ? -BASKET_SCALE : BASKET_SCALE} ${BASKET_SCALE})`}>
        <Circle r={3} fill="none" stroke="#697777" strokeWidth={2} />
        <Path d="M0 3 L-26 35 M0 3 L26 35" stroke="#8F653E" strokeWidth={2} fill="none" />
        <Path d="M0 3 L-26 35 M0 3 L26 35" stroke="#E5C196" strokeWidth={0.65} fill="none" />
        <Ellipse cy={35} rx={27} ry={5} fill="#966039" />
        <Image href={right ? NUTRITION_FOOD.right : NUTRITION_FOOD.left} x={-26} y={13} width={52} height={29} />
        <Path d="M-27 34 Q0 42 27 34 L24 61 Q0 67 -24 61Z" fill={`url(#${id}basket)`} stroke="#9D6C43" strokeWidth={1} />
        <Path d="M-26 43 Q0 50 26 43 M-25 54 Q0 61 25 54 M-19 38 L-17 62 M19 38 L17 62" fill="none" stroke="#AD7A4D" strokeWidth={1} />
        <Rect x={-23} y={41} width={46} height={23} rx={5} fill={remaining < 0 ? '#FFF0EB' : '#FCFDF8'} stroke="#FFFFFF" strokeWidth={0.7} />
        <SvgText x={0} y={51} textAnchor="middle" fontFamily={FONT} fontSize={Math.abs(remaining) >= 10000 ? 10 : 12} fontWeight="800" fill="#25333A">{Math.abs(remaining).toLocaleString()}</SvgText>
        <SvgText x={0} y={59.5} textAnchor="middle" fontFamily={FONT} fontSize={5.4} fontWeight="700" fill={remaining < 0 ? '#BF514B' : '#66736E'}>{remaining < 0 ? 'KCAL OVER' : 'KCAL LEFT'}</SvgText>
      </G>
    </MovingGroup>
    <Ellipse cx={POSE.x + 250 * POSE.scale} cy={219} rx={36} ry={3} fill="#3B2418" opacity={0.16} />
    <MovingGroup animatedProps={person}>
      {/* Native ignores x/y on nested <Svg>, so position the pose with a transform. */}
      <G transform={`translate(${POSE.x} ${POSE.y}) scale(${POSE.scale})`}>
        <G clipPath={`url(#${id}pose)`}>
          <Image href={POSES} x={heavy ? -512 : 0} y={female ? -512 : 0} width={1024} height={1024} />
        </G>
      </G>
    </MovingGroup>
  </G>;
}

const SCENE_HEIGHT = 300;
/** How long the baskets take to fill and drop onto their final weight. */
export const PULLEY_INTRO = 2200;
// Rig geometry is authored for a 250-tall scene; the extra height becomes chasm.
const RIG_OFFSET = 14;

function Cliff({ right, id }: { right?: boolean; id: string }) {
  return <G transform={right ? 'translate(400 0) scale(-1 1)' : undefined}>
    <Path d="M0 214 L84 215 Q102 215 110 218 L114 226 L109 238 L117 252 L112 266 L120 280 L118 290 L0 290Z" fill={`url(#${id}rock)`} />
    <Path d="M110 218 L114 226 L109 238 L117 252 L112 266 L120 280 L118 290 L98 290 L102 270 L95 250 L101 233Z" fill="#D9776F" opacity={0.2} />
    <Path d="M6 238 Q50 233 96 239 M2 258 Q54 253 102 260 M10 277 Q56 273 106 279" fill="none" stroke="#E0928B" strokeWidth={0.8} opacity={0.35} />
    <Path d="M0 216 Q58 216 111 219 L113 224 Q58 221 0 222Z" fill="#FFF3F1" />
    <Path d="M0 212 Q56 210 106 214 L111 219 Q58 216 0 218Z" fill="#7F8E5C" />
    <Path d="M14 212 l1.5 -4 l1 4 l1.5 -3 l1 3 M58 211 l1.5 -5 l1 5 l1.5 -3 l1 3 M84 213 l1.5 -4 l1 4 l1.5 -3" fill="none" stroke="#6C7B4C" strokeWidth={1} strokeLinecap="round" />
    <Ellipse cx={34} cy={216} rx={6} ry={2.5} fill="#F1BDB7" opacity={0.8} />
  </G>;
}

function Landscape({ id }: { id: string }) {
  return <G>
    <Path d="M0 170 L40 142 L72 156 L112 120 L150 150 L192 128 L232 154 L272 122 L312 148 L352 132 L400 160 V260 H0Z" fill="#FFF2F0" />
    <Path d="M0 196 L52 172 L92 186 L142 162 L200 184 L252 166 L302 182 L352 168 L400 190 V260 H0Z" fill="#FFE6E3" />
    {/* Canyon interior seen between the two cliffs. */}
    <Path d="M96 290 L96 234 Q146 224 200 231 Q254 224 304 234 L304 290Z" fill="#FFEDEA" />
    <Path d="M106 290 L118 256 Q164 248 200 254 Q236 248 282 256 L294 290Z" fill="#FBDAD5" />
    <Rect x={96} y={240} width={208} height={50} fill={`url(#${id}depth)`} />
    <Path d="M174 290 L179 276 Q200 270 221 276 L226 290Z" fill="#F0B6AF" />
    <Ellipse cx={200} cy={276} rx={21} ry={4} fill="#F8CEC8" />
    <Ellipse cx={166} cy={286} rx={8} ry={3.5} fill="#EDB0A9" />
    <Ellipse cx={236} cy={287} rx={7} ry={3} fill="#EDB0A9" />
    <Cliff id={id} />
    <Cliff id={id} right />
  </G>;
}

function Gantry({ id }: { id: string }) {
  const post = <G>
    <Rect x={96} y={0} width={11} height={220} rx={2} fill={`url(#${id}postWood)`} stroke="#5E3A24" strokeWidth={0.8} />
    <Path d="M99.5 20 V206 M103.5 46 V170" stroke="#5E3A24" strokeWidth={0.6} opacity={0.35} />
    <Path d="M107 11 H119 L107 23Z" fill="#6D7577" stroke="#4F585A" strokeWidth={0.6} />
    <Circle cx={110} cy={14.5} r={1.2} fill="#3F474A" />
    <Circle cx={101.5} cy={4.5} r={1.6} fill="#3F474A" />
    <Rect x={94} y={212} width={15} height={7} rx={1.5} fill="#5E3A24" />
  </G>;
  return <G>
    {post}
    <G transform="translate(400 0) scale(-1 1)">{post}</G>
    <Rect x={88} y={-2} width={224} height={13} rx={3} fill={`url(#${id}beamWood)`} stroke="#5E3A24" strokeWidth={0.8} />
    <Path d="M96 2.5 H186 M214 6.5 H304 M160 7 H196" stroke="#5E3A24" strokeWidth={0.6} opacity={0.3} />
  </G>;
}

/** Keep both sides of the net load readable while the rig moves above them. */
function PulleyMetrics({ data, name, right = false }: { data: PulleyTotals; name: string; right?: boolean }) {
  const x = right ? 342 : 58;
  const eaten = Math.round(Number.isFinite(data.food) ? data.food! : 0).toLocaleString();
  const burned = Math.round(Number.isFinite(data.exercise) ? data.exercise! : 0).toLocaleString();
  return <G>
    <Rect x={x - 50} y={244} width={100} height={50} rx={8} fill="#FFFFFF" fillOpacity={0.95} />
    <SvgText x={x} y={255} textAnchor="middle" fontFamily={FONT} fontSize={8} fontWeight="800" fill="#475569">{name.length > 14 ? `${name.slice(0, 13)}…` : name}</SvgText>
    <SvgText x={x - 42} y={271} fontFamily={FONT} fontSize={10} fontWeight="600" fill="#6B7280">Eaten</SvgText>
    <SvgText x={x + 42} y={271} textAnchor="end" fontFamily={FONT} fontSize={10} fontWeight="800" fill="#FF6B6B">{eaten}</SvgText>
    <SvgText x={x - 42} y={286} fontFamily={FONT} fontSize={10} fontWeight="600" fill="#6B7280">Burned</SvgText>
    <SvgText x={x + 42} y={286} textAnchor="end" fontFamily={FONT} fontSize={10} fontWeight="800" fill="#B45309">{burned}</SvgText>
  </G>;
}

function calorieDescription(name: string, data: PulleyTotals) {
  const eaten = Math.round(Number.isFinite(data.food) ? data.food! : 0);
  const burned = Math.round(Number.isFinite(data.exercise) ? data.exercise! : 0);
  const goal = Number.isFinite(data.goal) ? data.goal! : 0;
  const left = Math.round(goal - (eaten - burned));
  return `${name}, ${eaten.toLocaleString()} calories eaten, ${burned.toLocaleString()} calories burned, ${Math.abs(left).toLocaleString()} calories ${left < 0 ? 'over' : 'left'}. Calorie details`;
}

export default function CaloriePulleyScene({ mine, partner, gender, partnerGender, myName, partnerName, onPressMine, onPressPartner, prize, isVisible = true }: {
  mine: PulleyTotals; partner: PulleyTotals; gender: Gender; partnerGender: Gender;
  myName: string; partnerName: string; onPressMine: () => void; onPressPartner: () => void;
  /** Replace with an SVG group drawn within a 64 x 64 viewBox. */
  prize?: React.ReactNode;
  isVisible?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const focused = useIsFocused();
  const expanded = useGoalExpanded();
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);
  const intro = useSharedValue(reduced ? 1 : 0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(intro);
    if (reduced) intro.set(1);
    // Opacity does not stop SVG redraws. Freeze the rig while the summary covers it.
    if (focused && expanded && active && isVisible && !reduced) {
      phase.set(0);
      // Let the rig settle after its introduction instead of redrawing the
      // full SVG (including the pose atlas) indefinitely while the user reads.
      phase.set(withTiming(Math.PI * 2, { duration: PULLEY_INTRO, easing: Easing.linear }));
      intro.set(0);
      intro.set(withTiming(1, { duration: PULLEY_INTRO, easing: Easing.out(Easing.back(1.6)) }));
    }
    return () => { cancelAnimation(phase); cancelAnimation(intro); };
  }, [focused, expanded, active, isVisible, reduced, phase, intro]);
  return <View style={styles.scene}>
    <Svg width="100%" height="100%" viewBox={`0 0 400 ${SCENE_HEIGHT}`} accessible={false}>
      <Defs>
        <LinearGradient id={id + 'fade'} x2="0" y2="1">
          <Stop stopColor="#FFFFFF" stopOpacity={0} /><Stop offset="1" stopColor="#FFFFFF" />
        </LinearGradient>
        <LinearGradient id={id + 'rock'} x2="0" y2="1">
          <Stop stopColor="#FFE1DD" /><Stop offset="1" stopColor="#F4BCB5" />
        </LinearGradient>
        <LinearGradient id={id + 'depth'} x2="0" y2="1">
          <Stop stopColor="#E0736C" stopOpacity={0} /><Stop offset="1" stopColor="#E0736C" stopOpacity={0.2} />
        </LinearGradient>
        <LinearGradient id={id + 'postWood'} x2="1">
          <Stop stopColor="#A87650" /><Stop offset=".45" stopColor="#C08C62" /><Stop offset="1" stopColor="#87593A" />
        </LinearGradient>
        <LinearGradient id={id + 'beamWood'} x2="0" y2="1">
          <Stop stopColor="#C49166" /><Stop offset="1" stopColor="#8E5E3D" />
        </LinearGradient>
      </Defs>
      <G transform={`translate(0 ${RIG_OFFSET})`}>
        <Landscape id={id} />
        <Gantry id={id} />
        <PulleyRig right={false} gender={gender} data={mine} phase={phase} intro={intro} id={id + 'mine'} />
        <PulleyRig right gender={partnerGender} data={partner} phase={phase} intro={intro} id={id + 'partner'} />
        <G transform="translate(184 246) scale(.5)">{prize ?? <PulleyTrophy />}</G>
      </G>
      <Rect y={SCENE_HEIGHT - 34} width={400} height={34} fill={`url(#${id}fade)`} />
      <PulleyMetrics data={mine} name={myName} />
      <PulleyMetrics data={partner} name={partnerName} right />
    </Svg>
    <Pressable style={[styles.personTarget, { left: 0 }]} onPress={onPressMine} accessibilityRole="button" accessibilityLabel={calorieDescription(myName, mine)} />
    <Pressable style={[styles.personTarget, { right: 0 }]} onPress={onPressPartner} accessibilityRole="button" accessibilityLabel={calorieDescription(partnerName, partner)} />
  </View>;
}
const styles = StyleSheet.create({
  scene: { width: '100%', aspectRatio: 400 / SCENE_HEIGHT, overflow: 'hidden' },
  personTarget: { position: 'absolute', top: '30%', width: '35%', bottom: 0, minHeight: 44 },
});
