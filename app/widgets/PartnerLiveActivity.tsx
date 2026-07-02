import {
  HStack,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

import type { PartnerLivePayload } from '@/lib/partner-surface';

const StatColumn = ({
  name,
  kcal,
  goal,
  steps,
  accent,
}: {
  name: string;
  kcal: number;
  goal: number;
  steps: number;
  accent: string;
}) => (
  <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: 999 })]}>
    <Text
      modifiers={[
        font({ size: 10, weight: 'bold', design: 'rounded' }),
        foregroundStyle(accent),
        lineLimit(1),
      ]}>
      {name.toUpperCase()}
    </Text>
    <Text
      modifiers={[
        font({ size: 22, weight: 'heavy', design: 'rounded' }),
        foregroundStyle('#FFFFFF'),
        lineLimit(1),
      ]}>
      {`${kcal}/${goal}`}
    </Text>
    <Text
      modifiers={[
        font({ size: 11, weight: 'medium', design: 'rounded' }),
        foregroundStyle('#D1D5DB'),
        lineLimit(1),
      ]}>
      {`${steps.toLocaleString()} steps`}
    </Text>
  </VStack>
);

const PartnerLiveActivityView = (
  props: PartnerLivePayload,
  _environment: any,
) => {
  'widget';

  const statusLine =
    props.status === 'connected'
      ? 'Partner battle live'
      : props.staleReason || 'Waiting for partner';

  const banner = (
    <ZStack
      modifiers={[
        background('#0F172A'),
        padding({ top: 14, bottom: 14, leading: 16, trailing: 16 }),
      ]}>
      <VStack alignment="leading" spacing={10} modifiers={[frame({ maxWidth: 999 })]}>
        <HStack spacing={8} alignment="center">
          <Text
            modifiers={[
              font({ size: 12, weight: 'bold', design: 'rounded' }),
              foregroundStyle('#F8FAFC'),
              lineLimit(1),
            ]}>
            KCALS + STEPS
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 10, weight: 'medium', design: 'monospaced' }),
              foregroundStyle('#94A3B8'),
              lineLimit(1),
            ]}>
            {statusLine}
          </Text>
        </HStack>

        <HStack spacing={18} alignment="center" modifiers={[frame({ maxWidth: 999 })]}>
          <StatColumn
            name={props.userName}
            kcal={props.userKcal}
            goal={props.userGoal}
            steps={props.userSteps}
            accent="#FF8A8A"
          />
          <StatColumn
            name={props.partnerName}
            kcal={props.partnerKcal}
            goal={props.partnerGoal}
            steps={props.partnerSteps}
            accent="#6EE7D8"
          />
        </HStack>
      </VStack>
    </ZStack>
  );

  return {
    banner,
    compactLeading: (
      <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle('#FF8A8A')]}>
        {props.userSteps.toLocaleString()}
      </Text>
    ),
    compactTrailing: (
      <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle('#6EE7D8')]}>
        {props.partnerSteps.toLocaleString()}
      </Text>
    ),
    minimal: (
      <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle('#FFFFFF')]}>
        {`${props.userSteps.toLocaleString()}-${props.partnerSteps.toLocaleString()}`}
      </Text>
    ),
    expandedCenter: banner,
  };
};

export const PartnerLiveActivity = createLiveActivity('PartnerLiveActivity', PartnerLiveActivityView);

export default PartnerLiveActivity;
