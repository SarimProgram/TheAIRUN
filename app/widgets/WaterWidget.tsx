import {
  Button,
  Capsule,
  Ellipse,
  HStack,
  Image,
  Rectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import {
  accessibilityLabel,
  animation,
  Animation,
  background,
  buttonStyle,
  clipShape,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  ignoreSafeArea,
  lineLimit,
  monospacedDigit,
  offset,
  opacity,
  padding,
  scaleEffect,
  shadow,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

export type WaterWidgetProps = {
  waterMl: number;
  goalMl: number;
  dayKey: string;
  lastLoggedAt: string;
  /** JSON array of `{ id, ml, at }` taps made on the widget that the app has not imported yet. */
  pendingTaps: string;
};

const WaterWidgetView = (props: WaterWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const GLASS_ML = 250;
  const isDark = environment.colorScheme === 'dark';
  const isSmall = environment.widgetFamily === 'systemSmall';

  const C = isDark
    ? {
        canvas: '#07161C',
        tank: '#0E2730',
        ink: '#EAF8FC',
        muted: '#8FB0BB',
        accent: '#3CCBEE',
        waterTop: '#2BB8E0',
        waterBottom: '#06617F',
        crest: '#5FD6F4',
        pipEmpty: '#1B3A44',
        buttonBg: '#EAF8FC',
        buttonInk: '#06617F',
      }
    : {
        canvas: '#F3FAFD',
        tank: '#E2F3F9',
        ink: '#0B2A36',
        muted: '#5E7C87',
        accent: '#08B8E1',
        waterTop: '#6FD8F3',
        waterBottom: '#0796C2',
        crest: '#A9E9F9',
        pipEmpty: '#D3EAF2',
        buttonBg: '#FFFFFF',
        buttonInk: '#0784AB',
      };

  const keyFor = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // No regex escapes here: the layout ships as a template string, which drops backslashes.
  const withCommas = (n: number) => {
    const digits = String(Math.abs(Math.round(n)));
    let out = '';
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
      out += digits[i];
    }
    return n < 0 ? `-${out}` : out;
  };

  const goalMl = props.goalMl > 0 ? props.goalMl : 2000;
  // String compare works for YYYY-MM-DD; an entry dated past the props' day (the midnight entry) reads as a fresh day.
  const isCurrentDay = (props.dayKey || '') >= keyFor(environment.date);
  const shownMl = isCurrentDay ? Math.max(0, props.waterMl || 0) : 0;
  const progress = Math.min(1, shownMl / goalMl);
  const goalReached = shownMl >= goalMl;
  const glasses = Math.floor(shownMl / GLASS_ML);
  const totalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML));
  const remainingMl = Math.max(0, goalMl - shownMl);
  const slosh = glasses % 2 === 0 ? -1 : 1;

  const lastLoggedLabel = (() => {
    if (!isCurrentDay || !props.lastLoggedAt) return '';
    const d = new Date(props.lastLoggedAt);
    if (Number.isNaN(d.getTime())) return '';
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
  })();

  const addWater = (ml: number) => () => {
    const now = new Date();
    const today = keyFor(now);
    const base = props.dayKey === today ? Math.max(0, props.waterMl || 0) : 0;
    let taps: { id: string; ml: number; at: string }[] = [];
    try {
      const parsed = JSON.parse(props.pendingTaps || '[]');
      if (Array.isArray(parsed)) taps = parsed;
    } catch {}
    taps.push({
      id: `widget-${now.getTime()}-${Math.floor(Math.random() * 1e6)}`,
      ml,
      at: now.toISOString(),
    });
    return {
      waterMl: base + ml,
      dayKey: today,
      lastLoggedAt: now.toISOString(),
      pendingTaps: JSON.stringify(taps.slice(-60)),
    };
  };

  const fillSpring = Animation.spring({ response: 0.9, dampingFraction: 0.68 });
  const numberSpring = Animation.spring({ response: 0.45, dampingFraction: 0.85 });
  const popSpring = Animation.spring({ response: 0.4, dampingFraction: 0.55 });

  // Liquid column: two offset ellipses form a curved crest that sloshes sideways on every glass.
  const liquid = (width: number, fillHeight: number) => (
    <VStack
      spacing={0}
      modifiers={[
        frame({ maxWidth: 999, maxHeight: 999, alignment: 'bottom' }),
        animation(fillSpring, shownMl),
      ]}>
      <Spacer />
      {fillHeight > 0 ? (
        <ZStack modifiers={[frame({ width, height: 14 }), offset({ y: 7 })]}>
          <Ellipse
            modifiers={[
              frame({ width: width * 1.5, height: 14 }),
              foregroundStyle(C.crest),
              opacity(0.75),
              offset({ x: slosh * width * 0.16 }),
            ]}
          />
          <Ellipse
            modifiers={[
              frame({ width: width * 1.35, height: 12 }),
              foregroundStyle(C.waterTop),
              offset({ x: -slosh * width * 0.12, y: 3 }),
            ]}
          />
        </ZStack>
      ) : null}
      <Rectangle
        modifiers={[
          frame({ width, height: fillHeight }),
          foregroundStyle({
            type: 'linearGradient',
            colors: [C.waterTop, C.waterBottom],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      />
    </VStack>
  );

  const header = (
    <HStack spacing={5} alignment="center">
      <Image systemName="drop.fill" size={12} color={C.accent} />
      <Text
        modifiers={[
          font({ size: 13, weight: 'semibold', design: 'rounded' }),
          foregroundStyle(C.ink),
          lineLimit(1),
        ]}>
        Water
      </Text>
      <Spacer />
      {goalReached ? (
        <Image
          systemName="checkmark.circle.fill"
          size={15}
          color={C.accent}
          modifiers={[scaleEffect(goalReached ? 1 : 0.4), animation(popSpring, goalReached)]}
        />
      ) : lastLoggedLabel ? (
        <Text
          modifiers={[
            font({ size: 11, weight: 'medium', design: 'rounded' }),
            foregroundStyle(C.muted),
            monospacedDigit(),
            lineLimit(1),
          ]}>
          {lastLoggedLabel}
        </Text>
      ) : null}
    </HStack>
  );

  const amount = (size: number) => (
    <HStack spacing={3} alignment="firstTextBaseline">
      <Text
        modifiers={[
          font({ size, weight: 'bold', design: 'rounded' }),
          foregroundStyle(C.ink),
          monospacedDigit(),
          contentTransition('numericText'),
          animation(numberSpring, shownMl),
          lineLimit(1),
        ]}>
        {withCommas(shownMl)}
      </Text>
      <Text
        modifiers={[
          font({ size: Math.round(size * 0.42), weight: 'semibold', design: 'rounded' }),
          foregroundStyle(C.muted),
        ]}>
        ml
      </Text>
    </HStack>
  );

  const addButton = (ml: number, target: string, compact: boolean) => (
    <Button target={target} onPress={addWater(ml)} modifiers={[buttonStyle('plain')]}>
      <HStack
        spacing={4}
        alignment="center"
        modifiers={[
          padding({ vertical: compact ? 7 : 8, horizontal: compact ? 11 : 12 }),
          background(C.buttonBg, shapes.capsule({ roundedCornerStyle: 'continuous' })),
          shadow({ radius: 6, y: 2, color: isDark ? '#00000066' : '#0796C226' }),
          accessibilityLabel(`Add ${ml} millilitres of water`),
        ]}>
        <Image systemName="plus" size={11} color={C.buttonInk} />
        <Text
          modifiers={[
            font({ size: 13, weight: 'bold', design: 'rounded' }),
            foregroundStyle(C.buttonInk),
            monospacedDigit(),
          ]}>
          {`${ml}`}
        </Text>
      </HStack>
    </Button>
  );

  const summary = goalReached
    ? `Goal of ${withCommas(goalMl)} ml reached`
    : `${withCommas(remainingMl)} ml to go`;

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack
        spacing={8}
        modifiers={[
          widgetURL('app://home'),
          accessibilityLabel(`Water, ${shownMl} of ${goalMl} millilitres. ${summary}`),
        ]}>
        <Image systemName={goalReached ? 'checkmark.circle.fill' : 'drop.fill'} size={24} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>Water today</Text>
          <Text modifiers={[font({ size: 16, weight: 'bold' }), monospacedDigit(), lineLimit(1)]}>
            {`${withCommas(shownMl)} / ${withCommas(goalMl)} ml`}
          </Text>
          <Text modifiers={[font({ size: 11 }), lineLimit(1)]}>
            {goalReached ? 'Daily goal reached' : `${Math.round(progress * 100)}% of daily goal`}
          </Text>
        </VStack>
      </HStack>
    );
  }

  if (isSmall) {
    // Approximates the small widget height across iPhone sizes; the canvas clips any overshoot.
    const widgetHeight = 170;
    return (
      <ZStack
        alignment="bottom"
        modifiers={[
          widgetURL('app://home'),
          background(C.canvas),
          ignoreSafeArea({ edges: 'all' }),
          accessibilityLabel(`Water, ${shownMl} of ${goalMl} millilitres`),
        ]}>
        {liquid(220, Math.round(progress * widgetHeight))}
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            frame({ maxWidth: 999, maxHeight: 999, alignment: 'topLeading' }),
            padding({ all: 14 }),
          ]}>
          {header}
          <Spacer />
          {amount(32)}
          <Text
            modifiers={[
              font({ size: 12, weight: 'medium', design: 'rounded' }),
              foregroundStyle(progress > 0.32 ? C.ink : C.muted),
              opacity(progress > 0.32 ? 0.78 : 1),
              lineLimit(1),
            ]}>
            {`of ${withCommas(goalMl)} ml`}
          </Text>
          <HStack modifiers={[padding({ top: 10 })]}>
            <Spacer />
            {addButton(GLASS_ML, 'add-250', true)}
          </HStack>
        </VStack>
      </ZStack>
    );
  }

  const tankWidth = 86;
  const tankHeight = 134;
  return (
    <HStack
      spacing={16}
      alignment="center"
      modifiers={[
        widgetURL('app://home'),
        frame({ maxWidth: 999, maxHeight: 999 }),
        padding({ all: 15 }),
        background(C.canvas),
        ignoreSafeArea({ edges: 'all' }),
        accessibilityLabel(`Water, ${shownMl} of ${goalMl} millilitres`),
      ]}>
      <ZStack
        alignment="bottom"
        modifiers={[
          frame({ width: tankWidth, height: tankHeight }),
          background(C.tank, shapes.roundedRectangle({ cornerRadius: 24, roundedCornerStyle: 'continuous' })),
          clipShape('roundedRectangle', 24),
        ]}>
        {liquid(tankWidth, Math.round(progress * tankHeight))}
        <VStack modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}>
          <Text
            modifiers={[
              font({ size: 17, weight: 'heavy', design: 'rounded' }),
              foregroundStyle(progress > 0.55 ? '#FFFFFF' : C.ink),
              monospacedDigit(),
              contentTransition('numericText'),
              animation(numberSpring, shownMl),
            ]}>
            {`${Math.round(progress * 100)}%`}
          </Text>
        </VStack>
      </ZStack>

      <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}>
        {header}
        <Spacer />
        {amount(30)}
        <Text
          modifiers={[
            font({ size: 12, weight: 'medium', design: 'rounded' }),
            foregroundStyle(C.muted),
            lineLimit(1),
          ]}>
          {summary}
        </Text>
        <HStack spacing={4} modifiers={[padding({ top: 8 })]}>
          {Array.from({ length: Math.min(totalGlasses, 12) }, (_, i) => (
            <Capsule
              key={`pip-${i}`}
              modifiers={[
                frame({ width: i < glasses ? 14 : 8, height: 6 }),
                foregroundStyle(i < glasses ? C.accent : C.pipEmpty),
                animation(popSpring.delay(i * 0.03), glasses),
              ]}
            />
          ))}
        </HStack>
        <Spacer />
        <HStack spacing={8}>
          {addButton(GLASS_ML, 'add-250', false)}
          {addButton(GLASS_ML * 2, 'add-500', false)}
        </HStack>
      </VStack>
    </HStack>
  );
};

export const WaterWidget = createWidget('WaterWidget', WaterWidgetView);

export default WaterWidget;
