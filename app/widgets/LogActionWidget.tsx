import { HStack, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import {
  background,
  font,
  foregroundStyle,
  frame,
  ignoreSafeArea,
  padding,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';

type LogActionWidgetProps = {
  title: string;
  subtitle: string;
};

const LogActionWidgetView = (props: LogActionWidgetProps, _environment: WidgetEnvironment) => {
  'widget';

  return (
    <ZStack
      modifiers={[
        widgetURL('app://log'),
        background('#FF6B6B'),
        ignoreSafeArea({ edges: 'all' }),
      ]}>
      <VStack
        spacing={8}
        modifiers={[
          frame({ maxWidth: 999, maxHeight: 999 }),
          padding({ top: 16, bottom: 16, leading: 16, trailing: 16 }),
        ]}>
        <Text
          modifiers={[
            font({ size: 16, weight: 'bold', design: 'rounded' }),
            foregroundStyle('#FFFFFF'),
          ]}>
          {props.title || 'Quick Log'}
        </Text>
        <HStack
          modifiers={[
            padding({ top: 6, bottom: 6, leading: 10, trailing: 10 }),
            background('#FFFFFF', shapes.roundedRectangle({ cornerRadius: 12 })),
          ]}>
          <Text
            modifiers={[
              font({ size: 12, weight: 'semibold', design: 'rounded' }),
              foregroundStyle('#FF6B6B'),
            ]}>
            {props.subtitle || 'Meal or workout'}
          </Text>
        </HStack>
      </VStack>
    </ZStack>
  );
};

export const LogActionWidget = createWidget('LogActionWidget', LogActionWidgetView);

try {
  LogActionWidget.updateSnapshot({
    title: 'Quick Log',
    subtitle: 'Meal or workout',
  });
} catch (error) {
  console.warn('[LogActionWidget] Initial snapshot failed:', error);
}

export default LogActionWidget;
