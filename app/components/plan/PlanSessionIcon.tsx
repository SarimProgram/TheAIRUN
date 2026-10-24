import { Ionicons } from '@expo/vector-icons';

import type { SessionActivityKind } from './planSessionIconUtils';

export { getSessionActivityKind } from './planSessionIconUtils';
export type { SessionActivityKind } from './planSessionIconUtils';

const IONICON_NAMES: Record<SessionActivityKind, keyof typeof Ionicons.glyphMap> = {
  run: 'fitness',
  walk: 'walk',
  recovery: 'heart',
};

export function PlanSessionIcon({
  kind,
  size = 16,
  color,
}: {
  kind: SessionActivityKind;
  size?: number;
  color: string;
}) {
  return <Ionicons name={IONICON_NAMES[kind]} size={size} color={color} />;
}
