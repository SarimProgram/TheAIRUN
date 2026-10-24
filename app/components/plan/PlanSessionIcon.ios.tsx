import { SymbolView } from 'expo-symbols';

import type { SessionActivityKind } from './planSessionIconUtils';

export { getSessionActivityKind } from './planSessionIconUtils';
export type { SessionActivityKind } from './planSessionIconUtils';

const SYMBOL_NAMES: Record<SessionActivityKind, string> = {
  run: 'figure.run',
  walk: 'figure.walk',
  recovery: 'figure.cooldown',
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
  return (
    <SymbolView
      name={SYMBOL_NAMES[kind]}
      tintColor={color}
      weight="semibold"
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
