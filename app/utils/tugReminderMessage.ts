const PREFIX = /^\[STEPS:tug:([a-z0-9-]{8,80})\]/;

export function buildTugReminderMessage() {
  const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `[STEPS:tug:${session}] Our steps control these little versions of us. Come pull!`;
}

export function parseTugReminderMessage(content: string): string | null {
  return content.trim().match(PREFIX)?.[1] ?? null;
}

/** Identical physical direction on both phones, regardless of which user is viewing. */
export function tugEdgeShift(leftSteps: number, rightSteps: number, width: number) {
  return -Math.max(-1, Math.min(1, (leftSteps - rightSteps) / 1500)) * Math.min(64, width * 0.16);
}
