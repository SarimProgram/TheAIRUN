import { Circle, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import {
  background,
  font,
  foregroundStyle,
  frame,
  ignoreSafeArea,
  lineLimit,
  padding,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

type PartnerKcalsWidgetProps = {
  title: string;
  subtitle: string;
  primaryLine: string;
  secondaryLine: string;
  status: string;
  staleReason: string;
};

const PartnerKcalsWidgetView = (props: PartnerKcalsWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const COLORS = {
    bg: '#FFFFFF',
    ink: '#1C1C1E',
    muted: '#8E8E93',
    coral: '#FF6B6B',
    divider: '#F2F2F7',
  };

  const header = props.title || 'Partner Kcals';
  const statusLine =
    props.status === 'connected'
      ? props.subtitle
      : props.staleReason || 'Waiting for partner';

  return (
    <ZStack
      modifiers={[
        widgetURL('app://kcals'),
        background(COLORS.bg),
        ignoreSafeArea({ edges: 'all' }),
      ]}>
      <VStack
        spacing={12}
        modifiers={[
          frame({ maxWidth: 999, maxHeight: 999 }),
          padding({ top: 16, bottom: 16, leading: 16, trailing: 16 }),
        ]}>
        
        {/* Minimalist Header */}
        <HStack spacing={6} alignment="center">
          <Circle
            modifiers={[
              frame({ width: 6, height: 6 }),
              foregroundStyle(COLORS.coral),
            ]}
          />
          <Text
            modifiers={[
              font({ size: 12, weight: 'bold', design: 'rounded' }),
              foregroundStyle(COLORS.ink),
              lineLimit(1),
            ]}>
            {header}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 10, weight: 'medium', design: 'rounded' }),
              foregroundStyle(COLORS.muted),
              lineLimit(1),
            ]}>
            {statusLine}
          </Text>
        </HStack>

        <Spacer />

        {/* Elegant Typography Data Area */}
        <HStack spacing={16} alignment="center" modifiers={[frame({ maxHeight: 999 })]}>
          
          {/* User Side */}
          <VStack
            alignment="leading"
            spacing={6}
            modifiers={[
              frame({ maxWidth: 999, alignment: 'leading' }),
            ]}>
            <Text
              modifiers={[
                font({ size: 10, weight: 'heavy', design: 'rounded' }),
                foregroundStyle(COLORS.coral),
              ]}>
              YOU
            </Text>
            <Text
              modifiers={[
                font({ size: 14, weight: 'bold', design: 'rounded' }),
                foregroundStyle(COLORS.ink),
                lineLimit(2),
              ]}>
              {props.primaryLine}
            </Text>
          </VStack>

          {/* Minimal Vertical Divider */}
          <VStack 
            modifiers={[
              frame({ width: 2, maxHeight: 999 }),
              background(COLORS.divider, shapes.roundedRectangle({ cornerRadius: 1 }))
            ]}>
            <Text>{''}</Text>
          </VStack>

          {/* Partner Side */}
          <VStack
            alignment="leading"
            spacing={6}
            modifiers={[
              frame({ maxWidth: 999, alignment: 'leading' }),
            ]}>
            <Text
              modifiers={[
                font({ size: 10, weight: 'heavy', design: 'rounded' }),
                foregroundStyle(COLORS.muted),
              ]}>
              PARTNER
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: 'medium', design: 'rounded' }),
                foregroundStyle(COLORS.muted),
                lineLimit(2),
              ]}>
              {props.secondaryLine}
            </Text>
          </VStack>

        </HStack>
      </VStack>
    </ZStack>
  );
};

export const PartnerKcalsWidget = createWidget('PartnerKcalsWidget', PartnerKcalsWidgetView);

try {
  PartnerKcalsWidget.updateSnapshot({
    title: 'Partner Kcals',
    subtitle: 'Updated now',
    primaryLine: '1450 / 2200 kcal\n8420 steps',
    secondaryLine: '1120 / 2000 kcal\n6750 steps',
    status: 'connected',
    staleReason: '',
  });
} catch (error) {
  console.warn('[PartnerKcalsWidget] Initial snapshot failed:', error);
}

export default PartnerKcalsWidget;
