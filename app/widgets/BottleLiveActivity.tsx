import { Button, HStack, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export const BOTTLE_LIVE_ACTIVITY_NAME = 'BottleLiveActivity';

export type BottleLiveActivityProps = {
  fromName: string;
  /** Bottles waiting to be caught, including this one. */
  count: number;
  messageId: string;
  sentAt: string;
  /** Written by the native intent when a card button is tapped, e.g. `end:drink:<messageId>`. */
  lastAction?: string;
};

const BottleLiveActivityView = (props: BottleLiveActivityProps, _environment: unknown) => {
  'widget';

  // No backslashes in 'widget' functions: the layout is shipped as a template string, which drops them (/\s/ becomes /s/).
  const name = (props.fromName || 'Your partner').trim().split(' ')[0];
  const count = Math.max(1, Math.round(Number(props.count) || 1));
  const headline = count > 1 ? `${count} bottles waiting 💧` : 'Catch! Drink a glass 💧';
  const url = 'app://home';

  const bottleTile = (size: number) => (
    <ZStack modifiers={[frame({ width: size, height: size }), clipShape('roundedRectangle', size * 0.28)]}>
      <Rectangle
        modifiers={[
          frame({ width: size, height: size }),
          foregroundStyle({
            type: 'linearGradient',
            colors: ['#38BDF8', '#0369A1'],
            startPoint: { x: 0.2, y: 0 },
            endPoint: { x: 0.8, y: 1 },
          }),
        ]}
      />
      <Image systemName="waterbottle.fill" size={size * 0.52} color="#FFFFFF" />
    </ZStack>
  );

  // Set by the native intent the moment a card button is tapped; the card then shows this until it dismisses.
  const resolved = props.lastAction?.startsWith('end:drink')
    ? { title: 'Caught! +250 ml 💧', subtitle: `${name} will see you drank it` }
    : props.lastAction?.startsWith('end:throwback')
      ? { title: 'Thrown back! 💨', subtitle: `It's landing on ${name}'s screen` }
      : null;

  const actionButton = (action: 'drink' | 'throwback', label: string, symbol: 'drop.fill' | 'arrow.uturn.up', primary: boolean) => (
    <Button target={`end:${action}:${props.messageId}`} modifiers={[buttonStyle('plain')]}>
      <HStack
        spacing={5}
        alignment="center"
        modifiers={[
          frame({ maxWidth: 999, height: 38 }),
          background(primary ? '#38BDF8' : '#164E63', shapes.capsule({ roundedCornerStyle: 'continuous' })),
        ]}>
        <Image systemName={symbol} size={13} color={primary ? '#082F49' : '#E0F2FE'} />
        <Text
          modifiers={[
            font({ size: 14, weight: 'bold', design: 'rounded' }),
            foregroundStyle(primary ? '#082F49' : '#E0F2FE'),
            lineLimit(1),
          ]}>
          {label}
        </Text>
      </HStack>
    </Button>
  );

  const banner = (
    <VStack
      spacing={12}
      alignment="leading"
      modifiers={[
        widgetURL(url),
        frame({ maxWidth: 999 }),
        padding({ top: 14, bottom: 14, leading: 14, trailing: 16 }),
        background('#082F49'),
      ]}>
      <HStack spacing={14} alignment="center">
        {bottleTile(resolved ? 52 : 64)}
        <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: 999, alignment: 'leading' })]}>
          <Text
            modifiers={[
              font({ size: 12, weight: 'bold', design: 'rounded' }),
              foregroundStyle('#7DD3FC'),
              lineLimit(1),
            ]}>
            {`${name.toUpperCase()} THREW YOU WATER`}
          </Text>
          <Text
            modifiers={[
              font({ size: 20, weight: 'heavy', design: 'rounded' }),
              foregroundStyle('#FFFFFF'),
              lineLimit(1),
            ]}>
            {resolved ? resolved.title : headline}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, weight: 'medium', design: 'rounded' }),
              foregroundStyle('#BAE6FD'),
              lineLimit(1),
            ]}>
            {resolved ? resolved.subtitle : 'Drink it, or throw it straight back'}
          </Text>
        </VStack>
      </HStack>
      {resolved ? null : (
        <HStack spacing={10} alignment="center">
          {actionButton('drink', 'Drink +250 ml', 'drop.fill', true)}
          {actionButton('throwback', 'Throw back', 'arrow.uturn.up', false)}
        </HStack>
      )}
    </VStack>
  );

  const bottleSymbol = (size: number) => <Image systemName="waterbottle.fill" size={size} color="#38BDF8" />;

  return {
    banner,
    compactLeading: bottleSymbol(15),
    compactTrailing: (
      <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle('#7DD3FC')]}>
        {count > 1 ? `×${count}` : '💧'}
      </Text>
    ),
    minimal: bottleSymbol(14),
    expandedLeading: (
      <VStack modifiers={[padding({ leading: 4, top: 4 }), widgetURL(url)]}>{bottleTile(48)}</VStack>
    ),
    expandedCenter: resolved ? (
      <Text
        modifiers={[
          font({ size: 17, weight: 'heavy', design: 'rounded' }),
          foregroundStyle('#FFFFFF'),
          lineLimit(1),
          widgetURL(url),
        ]}>
        {resolved.title}
      </Text>
    ) : (
      <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 999, alignment: 'leading' }), widgetURL(url)]}>
        <Text
          modifiers={[
            font({ size: 12, weight: 'bold', design: 'rounded' }),
            foregroundStyle('#7DD3FC'),
            lineLimit(1),
          ]}>
          {`${name.toUpperCase()} THREW YOU WATER`}
        </Text>
        <Text
          modifiers={[
            font({ size: 17, weight: 'heavy', design: 'rounded' }),
            foregroundStyle('#FFFFFF'),
            lineLimit(1),
          ]}>
          {headline}
        </Text>
      </VStack>
    ),
    expandedBottom: resolved ? (
      <HStack modifiers={[widgetURL(url), padding({ top: 4 })]}>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 13, weight: 'semibold', design: 'rounded' }),
            foregroundStyle('#BAE6FD'),
          ]}>
          {resolved.subtitle}
        </Text>
        <Spacer />
      </HStack>
    ) : (
      <HStack spacing={10} alignment="center" modifiers={[padding({ top: 4 })]}>
        {actionButton('drink', 'Drink +250 ml', 'drop.fill', true)}
        {actionButton('throwback', 'Throw back', 'arrow.uturn.up', false)}
      </HStack>
    ),
  };
};

export const BottleLiveActivity = createLiveActivity<BottleLiveActivityProps>(
  BOTTLE_LIVE_ACTIVITY_NAME,
  BottleLiveActivityView,
);

export default BottleLiveActivity;
