import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function WhiteboardWidgetView(_props: Record<string, never>) {
  'widget';

  return (
    <VStack alignment="leading" spacing={0} modifiers={[
      frame({ maxWidth: 999, maxHeight: 999 }),
      background('#FFFFFF'),
      padding({ all: 20 }),
      widgetURL('app://home'),
    ]}>
      <HStack spacing={8}>
        <Image systemName="pencil.tip" size={17} color="#687381" />
        <Text modifiers={[font({ size: 16, weight: 'semibold', design: 'rounded' }), foregroundStyle('#182731')]}>
          Whiteboard
        </Text>
      </HStack>
      <Spacer />
    </VStack>
  );
}

export const WhiteboardWidget = createWidget('WhiteboardWidget', WhiteboardWidgetView);

try {
  WhiteboardWidget.updateSnapshot({});
} catch (error) {
  console.warn('[WhiteboardWidget] Initial snapshot failed:', error);
}

export default WhiteboardWidget;
