export function getPackageTitle(pkg: any) {
  const period = getPackagePeriodLabel(pkg);
  if (period === 'year') return 'Yearly';
  if (period === 'month') return 'Monthly';
  if (period === 'week') return 'Weekly';
  return pkg?.product?.title || pkg?.storeProduct?.title || 'Premium';
}

export function getPackagePrice(pkg: any) {
  return pkg?.product?.priceString || pkg?.storeProduct?.priceString || '';
}

function getIntroPrice(pkg: any) {
  return (
    pkg?.product?.introPrice ??
    pkg?.storeProduct?.introPrice ??
    pkg?.product?.introductoryPrice ??
    pkg?.storeProduct?.introductoryPrice ??
    null
  );
}

export function packageHasFreeTrial(pkg: any): boolean {
  return !!getTrialLengthLabel(pkg);
}

export function getZeroTodayLabel(pkg: any): string {
  const currency = (pkg?.product ?? pkg?.storeProduct)?.currencyCode;
  if (currency) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(0); } catch {}
  }
  return getIntroPrice(pkg)?.priceString || '$0.00';
}

export function getTrialLengthLabel(pkg: any): string | null {
  const intro = getIntroPrice(pkg);
  if (!intro || intro.price !== 0) return null;
  const period = String(intro.periodUnit ?? intro.period ?? intro.subscriptionPeriod ?? '').toLowerCase();
  const iso = period.match(/^p(\d+)([dwmy])$/);
  const units = Number(intro.periodNumberOfUnits ?? iso?.[1] ?? 1);
  const cycles = Number(intro.cycles ?? intro.numberOfPeriods ?? 1);
  const count = units * cycles;
  if (!Number.isFinite(count) || count <= 0) return null;
  if (period.includes('week') || iso?.[2] === 'w') return `${count * 7} days`;
  const unit = period.includes('day') || iso?.[2] === 'd' ? 'day'
    : period.includes('month') || iso?.[2] === 'm' ? 'month'
    : period.includes('year') || iso?.[2] === 'y' ? 'year' : null;
  return unit ? `${count} ${unit}${count === 1 ? '' : 's'}` : null;
}

export function getPackagePeriodLabel(pkg: any): string {
  const rawType = String(pkg?.packageType ?? '').toUpperCase();
  if (rawType.includes('WEEK')) return 'week';
  if (rawType.includes('MONTH')) return 'month';
  if (rawType.includes('ANNUAL') || rawType.includes('YEAR')) return 'year';

  const rawPeriod = String(
    pkg?.product?.subscriptionPeriod?.iso8601 ??
      pkg?.storeProduct?.subscriptionPeriod?.iso8601 ??
      (typeof pkg?.product?.subscriptionPeriod === 'string' ? pkg.product.subscriptionPeriod : undefined) ??
      (typeof pkg?.storeProduct?.subscriptionPeriod === 'string' ? pkg.storeProduct.subscriptionPeriod : undefined) ??
      pkg?.product?.subscriptionPeriod?.unit ??
      pkg?.storeProduct?.subscriptionPeriod?.unit ??
      ''
  ).toLowerCase();

  if (rawPeriod.includes('p1w') || rawPeriod.includes('week')) return 'week';
  if (rawPeriod.includes('p1m') || rawPeriod.includes('month')) return 'month';
  if (rawPeriod.includes('p1y') || rawPeriod.includes('year')) return 'year';
  return 'billing period';
}

export function getAllPackages(offerings: any): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  const addPackages = (list?: any[]) => {
    if (!Array.isArray(list)) return;
    for (const pkg of list) {
      if (!pkg) continue;
      const key = String(pkg?.identifier || pkg?.product?.identifier || result.length);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(pkg);
    }
  };

  addPackages(offerings?.current?.availablePackages);
  addPackages(offerings?.all?.default?.availablePackages);
  return result;
}

function getWeeklyEquivalent(pkg: any): number | null {
  const price = pkg?.product?.price ?? pkg?.storeProduct?.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const period = getPackagePeriodLabel(pkg);
  if (period === 'week') return price;
  if (period === 'month') return price / 4.33;
  if (period === 'year') return price / 52;
  return null;
}

export function getSavingsLabel(pkg: any, weeklyPkg: any | undefined): string | null {
  if (!weeklyPkg || getPackagePeriodLabel(pkg) !== 'year') return null;
  const currency = (pkg?.product ?? pkg?.storeProduct)?.currencyCode;
  const weeklyCurrency = (weeklyPkg?.product ?? weeklyPkg?.storeProduct)?.currencyCode;
  if (currency && weeklyCurrency && currency !== weeklyCurrency) return null;
  const weeklyEq = getWeeklyEquivalent(pkg);
  const weeklyPrice = getWeeklyEquivalent(weeklyPkg);
  if (!weeklyEq || !weeklyPrice || weeklyPrice <= weeklyEq) return null;
  const pct = Math.round(((weeklyPrice - weeklyEq) / weeklyPrice) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

export function formatWeeklyEquivalentLabel(pkg: any): string | null {
  const weeklyEq = getWeeklyEquivalent(pkg);
  if (weeklyEq == null) return null;
  const currency = (pkg?.product ?? pkg?.storeProduct)?.currencyCode;
  if (!currency) return null;
  try {
    return `About ${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(weeklyEq)}/week`;
  } catch { return null; }
}

