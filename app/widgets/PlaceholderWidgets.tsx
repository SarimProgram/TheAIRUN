import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  background,
  clipped,
  clipShape,
  font,
  foregroundStyle,
  frame,
  ignoreSafeArea,
  lineLimit,
  monospacedDigit,
  offset,
  padding,
  resizable,
  rotationEffect,
  shadow,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type PartnerFoodWidgetProps = {
  /** Empty when nothing from the partner is on show. */
  mealId: string;
  senderName: string;
  mealType: string;
  /** Short food list, e.g. "Grilled chicken, Rice +1". */
  foods: string;
  /** Calories in this user's portion. */
  kcal: number;
  status: string;
  sentAt: string;
  expiresAt: string;
  /** Plate photo or cutout copied into the shared app group; empty until downloaded. */
  imageUri?: string;
  imageIsCutout?: boolean;
  /** Full-body partner illustration from the shared app group. */
  portraitUri?: string;
};

function PartnerFoodWidgetView(props: PartnerFoodWidgetProps, environment: WidgetEnvironment) {
  'widget';

  const dark = environment.colorScheme === 'dark';
  const small = environment.widgetFamily === 'systemSmall';
  const C = dark
    ? { canvas: '#211A1C', halo: '#3A2629', rim: '#3B3134', well: '#2C2326', ink: '#F8F1F2', muted: '#C7B5B8', accent: '#FF8E8E', soft: '#4A2C31', onAccent: '#2A1215', shadow: '#00000080' }
    : { canvas: '#FFF4F1', halo: '#FFE2DA', rim: '#FFFFFF', well: '#FFF0EB', ink: '#1F2330', muted: '#7A6A6D', accent: '#FF6B6B', soft: '#FFE1E1', onAccent: '#FFFFFF', shadow: '#C9524A33' };

  const expired = props.status === 'PENDING' && !!props.expiresAt
    && new Date(props.expiresAt).getTime() <= environment.date.getTime();
  const hasPlate = !!props.mealId && props.status !== 'DECLINED' && !expired;
  const waiting = props.status === 'PENDING';
  const name = props.senderName || 'Your partner';
  const meal = props.mealType ? props.mealType.charAt(0) + props.mealType.slice(1).toLowerCase() : 'Food';
  const mealSymbol = props.mealType === 'BREAKFAST' ? 'cup.and.saucer.fill'
    : props.mealType === 'LUNCH' ? 'takeoutbag.and.cup.and.straw.fill'
      : props.mealType === 'SNACK' ? 'carrot.fill' : 'fork.knife';
  const time = (() => {
    const d = new Date(props.sentAt);
    if (!props.sentAt || Number.isNaN(d.getTime())) return '';
    const h = d.getHours();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  })();
  const kcal = Math.max(0, Math.round(props.kcal || 0));
  const round = (size: number) => shapes.roundedRectangle({ cornerRadius: size / 2 });

  // A plate: white rim, tinted well, and the real food (photo filling the well, or the cutout sitting on it).
  const plate = (size: number, empty: boolean) => {
    const well = Math.round(size * 0.8);
    const food = !empty && props.imageUri ? (
      props.imageIsCutout ? (
        <Image uiImage={props.imageUri} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: Math.round(size * 0.74), height: Math.round(size * 0.74) })]} />
      ) : (
        <Image uiImage={props.imageUri} modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: well, height: well }), clipShape('circle')]} />
      )
    ) : (
      <Image systemName={empty ? 'fork.knife' : mealSymbol} size={Math.round(size * 0.32)} color={empty ? C.muted : C.accent}
        modifiers={[rotationEffect(empty ? -12 : 0)]} />
    );
    return (
      <ZStack modifiers={[frame({ width: size, height: size }), background(C.rim, round(size)), shadow({ radius: 8, y: 4, color: C.shadow })]}>
        <ZStack modifiers={[frame({ width: well, height: well }), background(C.well, round(well))]}>
          {food}
        </ZStack>
      </ZStack>
    );
  };

  const sticker = (
    <HStack spacing={3} alignment="center" modifiers={[
      padding({ vertical: 4, horizontal: 8 }),
      background(C.accent, shapes.capsule({ roundedCornerStyle: 'continuous' })),
      shadow({ radius: 4, y: 2, color: C.shadow }),
    ]}>
      <Image systemName="flame.fill" size={9} color={C.onAccent} />
      <Text modifiers={[font({ size: 11, weight: 'heavy', design: 'rounded' }), foregroundStyle(C.onAccent), monospacedDigit(), lineLimit(1)]}>
        {`${kcal} kcal`}
      </Text>
    </HStack>
  );

  const servedPlate = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size + 10 })]}>
      <ZStack modifiers={[offset({ y: -5 })]}>{plate(size, false)}</ZStack>
      <ZStack modifiers={[offset({ y: size / 2 - 2 })]}>{sticker}</ZStack>
      {!waiting ? (
        <ZStack modifiers={[frame({ width: 22, height: 22 }), background(C.rim, round(22)), offset({ x: size * 0.36, y: -size * 0.38 })]}>
          <Image systemName="checkmark.circle.fill" size={18} color={C.accent} />
        </ZStack>
      ) : null}
    </ZStack>
  );

  // The illustration is full body; a top-aligned, clipped window shows the face.
  const avatar = (size: number) => props.portraitUri ? (
    <VStack spacing={0} modifiers={[frame({ width: size, height: size, alignment: 'top' }), background(C.halo), clipped(), clipShape('circle')]}>
      <Image uiImage={props.portraitUri} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: size * 2.3, height: size * 3.45 }), offset({ y: size * 0.04 })]} />
    </VStack>
  ) : (
    <ZStack modifiers={[frame({ width: size, height: size }), background(C.soft, round(size))]}>
      <Image systemName="person.fill" size={Math.round(size * 0.5)} color={C.accent} />
    </ZStack>
  );

  const canvas = (label: string, horizontal: number, vertical: number) => [
    widgetURL('app://home'),
    padding({ horizontal, vertical }),
    frame({ maxWidth: 999, maxHeight: 999 }),
    background(C.canvas),
    ignoreSafeArea({ edges: 'all' }),
    accessibilityLabel(label),
  ];

  if (!hasPlate) {
    const copy = (
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), foregroundStyle(C.ink), lineLimit(1)]}>
          Partner food
        </Text>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(C.muted), lineLimit(3)]}>
          When your partner passes you a plate, it shows up here.
        </Text>
      </VStack>
    );
    if (small) {
      return (
        <VStack alignment="leading" spacing={0} modifiers={canvas('Partner food. Nothing passed yet.', 14, 14)}>
          {plate(56, true)}
          <Spacer />
          {copy}
        </VStack>
      );
    }
    return (
      <HStack spacing={18} alignment="center" modifiers={canvas('Partner food. Nothing passed yet.', 16, 16)}>
        <ZStack modifiers={[frame({ width: 120, height: 120 }), background(C.halo, round(120))]}>
          {plate(96, true)}
        </ZStack>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: 999 })]}>{copy}</VStack>
      </HStack>
    );
  }

  const label = `${name} passed you ${meal.toLowerCase()}: ${props.foods || 'food'}, ${kcal} calories. ${waiting ? 'Tap to review.' : 'Logged.'}`;
  const headline = waiting ? `Passed you ${meal.toLowerCase()}` : `${meal} logged`;

  if (small) {
    return (
      <VStack alignment="center" spacing={0} modifiers={canvas(label, 12, 12)}>
        <HStack spacing={6} alignment="center">
          {avatar(28)}
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(C.ink), lineLimit(1)]}>{name}</Text>
            <Text modifiers={[font({ size: 10, weight: 'semibold', design: 'rounded' }), foregroundStyle(waiting ? C.accent : C.muted), lineLimit(1)]}>{headline}</Text>
          </VStack>
          <Spacer />
        </HStack>
        <Spacer />
        {servedPlate(76)}
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(C.muted), lineLimit(1)]}>
          {waiting ? 'Tap to review' : props.foods || meal}
        </Text>
      </VStack>
    );
  }

  // Medium: the partner stands beside the plate they're handing over.
  return (
    <HStack spacing={10} alignment="center" modifiers={canvas(label, 14, 12)}>
      <ZStack modifiers={[frame({ width: 150, height: 134 })]}>
        <Image systemName="circle.fill" size={126} color={C.halo} modifiers={[offset({ x: 14 })]} />
        <ZStack modifiers={[offset({ x: props.portraitUri ? 18 : 0, y: -4 })]}>{servedPlate(98)}</ZStack>
        {props.portraitUri ? (
          <Image uiImage={props.portraitUri} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: 76, height: 114 }), offset({ x: -40, y: 20 })]} />
        ) : null}
      </ZStack>
      <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 999, maxHeight: 999, alignment: 'leading' })]}>
        <HStack spacing={4} alignment="center">
          <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(C.ink), lineLimit(1)]}>{`From ${name}`}</Text>
          <Spacer />
          {time ? (
            <Text modifiers={[font({ size: 11, weight: 'medium', design: 'rounded' }), foregroundStyle(C.muted), monospacedDigit(), lineLimit(1)]}>{time}</Text>
          ) : null}
        </HStack>
        <Text modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), foregroundStyle(C.accent), lineLimit(1)]}>{headline}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: 'semibold', design: 'rounded' }), foregroundStyle(C.ink), lineLimit(2)]}>
          {props.foods || meal}
        </Text>
        <HStack spacing={4} alignment="center" modifiers={[
          padding({ vertical: 5, horizontal: 10 }),
          background(waiting ? C.accent : C.soft, shapes.capsule({ roundedCornerStyle: 'continuous' })),
        ]}>
          <Image systemName={waiting ? 'hand.tap.fill' : 'checkmark.circle.fill'} size={11} color={waiting ? C.onAccent : C.accent} />
          <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle(waiting ? C.onAccent : C.accent), lineLimit(1)]}>
            {waiting ? 'Tap to review' : 'In your log'}
          </Text>
        </HStack>
      </VStack>
    </HStack>
  );
}

type PlaceholderProps = { slot: number };

function PlaceholderWidgetView(props: PlaceholderProps, environment: WidgetEnvironment) {
  'widget';

  const dark = environment.colorScheme === 'dark';
  return (
    <VStack spacing={10} modifiers={[
      frame({ maxWidth: 999, maxHeight: 999 }),
      padding({ all: 16 }),
      background(dark ? '#242831' : '#F3F5F7'),
      widgetURL('app://home'),
    ]}>
      <Image systemName="square.dashed" size={28} color={dark ? '#B5BBC9' : '#687381'} />
      <Text modifiers={[font({ size: 16, weight: 'semibold', design: 'rounded' }), foregroundStyle(dark ? '#F6F5FA' : '#182731')]}>
        {`Placeholder ${props.slot || 1}`}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(dark ? '#B5BBC9' : '#687381')]}>
        More to come
      </Text>
    </VStack>
  );
}

// Keeps the original native kind so widgets already on home screens pick up the new layout.
export const PartnerFoodWidget = createWidget('PlaceholderOneWidget', PartnerFoodWidgetView);
export const PlaceholderTwoWidget = createWidget('PlaceholderTwoWidget', PlaceholderWidgetView);

try {
  PlaceholderTwoWidget.updateSnapshot({ slot: 2 });
} catch (error) {
  console.warn('[PlaceholderWidgets] Initial snapshots failed:', error);
}
