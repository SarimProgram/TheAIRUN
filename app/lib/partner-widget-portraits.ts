export type WidgetGender = 'male' | 'female' | null | undefined;

export function normalizeWidgetGender(value?: string | null): WidgetGender {
  if (value === undefined) return undefined;
  const gender = String(value ?? '').trim().toLowerCase();
  return gender === 'male' || gender === 'female' ? gender : null;
}

export function selectPartnerWidgetPortraits(
  snapshot: { userGender?: string | null; partnerGender?: string | null },
  artwork: { male?: string; female?: string },
) {
  const mine = normalizeWidgetGender(snapshot.userGender);
  const partner = normalizeWidgetGender(snapshot.partnerGender);
  return {
    userPortraitUri: mine ? artwork[mine] : undefined,
    partnerPortraitUri: partner ? artwork[partner] : undefined,
  };
}
