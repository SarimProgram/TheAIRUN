import { HStack, Image, Rectangle, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import {
  accessibilityLabel, aspectRatio, clipShape, clipped, font,
  foregroundStyle, frame, lineLimit, offset,
  monospacedDigit, padding, resizable, scaleEffect, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import type { PartnerKcalsWidgetSnapshot } from '@/lib/partner-surface';

function PartnerKcalsWidgetView(props: PartnerKcalsWidgetSnapshot, environment: WidgetEnvironment) {
  'widget';

  const dark = environment.colorScheme === 'dark';
  const small = environment.widgetFamily === 'systemSmall';
  const C = {
    ink: dark ? '#F6F5FA' : '#182731',
    muted: dark ? '#B5BBC9' : '#687381',
    teal: dark ? '#72DDE9' : '#086875',
    coral: dark ? '#FFB0BD' : '#A53E56',
    left: dark ? '#302C22' : '#FFF7DD',
    right: dark ? '#33272C' : '#FFE7EA',
    pill: dark ? '#242831' : '#FFFFFF',
  };
  const connected = props.status === 'connected';
  const unlinked = props.status === 'no_partner';
  const status = unlinked ? 'Connect a partner in the app' : connected
    ? props.subtitle || 'Today' : 'Open app to sync';

  // Older installed timelines contain only formatted lines, until their next sync.
  const people = [
    { name: props.userName, kcal: props.userKcal, goal: props.userGoal, line: props.primaryLine, portrait: props.userGender ? props.userPortraitUri : undefined, mirror: props.userGender === 'female', fallback: 'You', color: C.teal, surface: C.left, kcalColor: dark ? '#FFC86A' : '#B35A00', flameColor: '#F28A25' },
    { name: props.partnerName, kcal: props.partnerKcal, goal: props.partnerGoal, line: props.secondaryLine, portrait: props.partnerGender ? props.partnerPortraitUri : undefined, mirror: props.partnerGender === 'male', fallback: 'Partner', color: C.coral, surface: C.right, kcalColor: dark ? '#FF9FB4' : '#B93856', flameColor: '#ED5D7B' },
  ].map((person) => {
    // Widget layouts are serialized into a template literal by Expo. Regex escape
    // sequences are lost in that step, so parse old snapshots using plain strings.
    const separator = person.line?.lastIndexOf(': ') ?? -1;
    const legacyAmounts = separator >= 0
      ? person.line!.slice(separator + 2).split(' kcal')[0].split('/') : [];
    const hasLegacy = legacyAmounts.length === 2;
    const name = person.name?.trim() || (separator >= 0 ? person.line!.slice(0, separator) : person.fallback);
    const kcal = person.kcal ?? (hasLegacy ? Number(legacyAmounts[0]) : undefined);
    const goal = person.goal ?? (hasLegacy ? Number(legacyAmounts[1]) : undefined);
    const available = !unlinked && typeof kcal === 'number' && Number.isFinite(kcal)
      && typeof goal === 'number' && Number.isFinite(goal) && goal > 0;
    const remaining = available ? Math.round(goal! - kcal!) : 0;
    return {
      name, portrait: person.portrait, mirror: person.mirror, color: person.color, surface: person.surface, fallback: person.fallback,
      kcalColor: person.kcalColor, flameColor: person.flameColor,
      value: available ? String(Math.abs(remaining)) : '—',
      label: available ? remaining < 0 ? 'KCAL OVER' : 'KCAL LEFT' : 'SYNC IN APP',
      detail: available ? `${Math.round(kcal!)} / ${Math.round(goal!)} eaten` : unlinked ? 'Link your partner' : 'Waiting for data',
    };
  });

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <HStack spacing={8} modifiers={[widgetURL('app://kcals'), accessibilityLabel('Partner calories')]}>
        <Image systemName="heart.fill" size={20} />
        <VStack alignment="leading" spacing={2}>
          <VStack alignment="leading" spacing={2}>
            {people.map((person) => (
              <Text key={person.fallback} modifiers={[font({ size: 12, weight: 'semibold' }), monospacedDigit(), lineLimit(1)]}>
                {`${person.name}: ${person.value} ${person.label.toLowerCase()}`}
              </Text>
            ))}
          </VStack>
          {!connected ? <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>{status}</Text> : null}
        </VStack>
      </HStack>
    );
  }

  // Calorie text sits beside each portrait, centred in the remaining width.
  const panels = people.map((person, index) => {
    const portraitImage = person.portrait ? (
      <Image uiImage={person.portrait} modifiers={[
        resizable(), aspectRatio({ contentMode: 'fit' }), scaleEffect(small ? 1.15 : 1.6), scaleEffect({ x: person.mirror ? -1 : 1, y: 1 }),
        frame({ width: small ? 46 : 68, height: small ? 64 : 128 }), offset({ y: small ? 6 : 10 }),
      ]} />
    ) : (
      <Image systemName="person.fill" size={small ? 30 : 48} color={person.color}
        modifiers={[frame({ width: small ? 46 : 68, height: small ? 64 : 128 })]} />
    );
    // The lane clips the intentional negative bottom margin, independently of text.
    const portrait = (
      <VStack spacing={0} modifiers={[
        frame({ width: small ? 46 : 68 }),
        frame({ maxHeight: 999, alignment: 'bottom' }), clipped(),
      ]}>{portraitImage}</VStack>
    );
    return (
      <HStack key={person.fallback} spacing={4} modifiers={[
        padding({ horizontal: 4 }),
        frame({ maxWidth: 999, maxHeight: 999 }),
        accessibilityLabel(`${person.name}, ${person.value} ${person.label.toLowerCase()}, ${person.detail}`),
      ]}>
        {small || index === 0 ? portrait : null}
        <VStack alignment="center" spacing={2} modifiers={[frame({ maxWidth: 999 }), clipped()]}>
          <Text modifiers={[
            font({ size: 11, weight: 'bold', design: 'rounded' }),
            foregroundStyle(C.ink), lineLimit(1), frame({ height: 14 }),
          ]}>{person.name}</Text>
          <Text modifiers={[
            font({ size: person.value.length > 4 ? 17 : 22, weight: 'heavy', design: 'rounded' }),
            foregroundStyle(C.ink), monospacedDigit(), lineLimit(1),
          ]}>{person.value}</Text>
          <HStack spacing={3}>
            <Image systemName="flame.fill" size={9} color={person.flameColor} />
            <Text modifiers={[font({ size: 7, weight: 'bold', design: 'rounded' }), foregroundStyle(person.kcalColor), lineLimit(1)]}>{person.label.toLowerCase()}</Text>
          </HStack>
        </VStack>
        {!small && index === 1 ? portrait : null}
      </HStack>
    );
  });

  const surfaces = [C.left, C.right].map((color) => (
    <Rectangle key={color} modifiers={[foregroundStyle(color), frame({ maxWidth: 999, maxHeight: 999 })]} />
  ));

  return (
    <ZStack modifiers={[
      frame({ maxWidth: 999, maxHeight: 999 }), clipShape('roundedRectangle', 24),
      widgetURL('app://kcals'), accessibilityLabel('Daily calories for both partners'),
    ]}>
      {small ? <VStack spacing={0}>{surfaces}</VStack> : <HStack spacing={0}>{surfaces}</HStack>}
      <VStack spacing={6} modifiers={[
        padding({ horizontal: 4 }),
        frame({ maxWidth: 999, maxHeight: 999 }),
      ]}>
        {small ? (
          <VStack spacing={0} modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}>{panels}</VStack>
        ) : (
          <HStack spacing={4} modifiers={[frame({ maxWidth: 999, maxHeight: 999 })]}>{panels}</HStack>
        )}
      </VStack>
    </ZStack>
  );
}

export const PartnerKcalsWidget = createWidget('PartnerKcalsWidget', PartnerKcalsWidgetView);
export default PartnerKcalsWidget;
