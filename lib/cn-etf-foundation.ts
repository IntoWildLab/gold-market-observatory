export type AlignmentStatus = "same_date" | "nav_lagged" | "price_missing" | "nav_missing" | "no_common_date";
export type PriceShareRelationship = "same_direction" | "price_up_shares_down" | "price_down_shares_up" | "flat_or_mixed";

export interface DatedValue { date: string; value: number }
export interface EtfFoundationRow {
  date: string;
  price: number | null;
  nav: number | null;
  navDate: string | null;
  sharesHundredMillion: number | null;
  alignmentStatus: AlignmentStatus;
  premiumDiscountPct: number | null;
  estimatedAumCny: number | null;
  sharesChange5dPct: number | null;
  sharesChange20dPct: number | null;
  sharesChange60dPct: number | null;
  shareChangeStreakDays: number;
  marketEffectCny: number | null;
  shareEffectCny: number | null;
  aumChangeCny: number | null;
  decompositionResidualCny: number | null;
  priceShareRelationship: PriceShareRelationship | null;
}

export interface CnEtfFoundationData {
  generated_at: string;
  etf_code: "518880";
  units: {
    price: "cny_per_share";
    nav: "cny_per_share";
    shares: "hundred_million_shares";
    estimated_aum: "cny";
  };
  methodology: {
    premium_discount: string;
    estimated_aum: string;
    decomposition: string;
  };
  latest_formal_premium: EtfFoundationRow | null;
  rows: EtfFoundationRow[];
}

function pct(current: number, prior: number): number | null {
  return prior > 0 ? ((current / prior) - 1) * 100 : null;
}

function relationship(priceDelta: number, shareDelta: number): PriceShareRelationship {
  const eps = 1e-12;
  if (Math.abs(priceDelta) < eps || Math.abs(shareDelta) < eps) return "flat_or_mixed";
  if (Math.sign(priceDelta) === Math.sign(shareDelta)) return "same_direction";
  return priceDelta > 0 ? "price_up_shares_down" : "price_down_shares_up";
}

export function buildEtfFoundationRows(prices: DatedValue[], navs: DatedValue[], shares: DatedValue[]): EtfFoundationRow[] {
  const priceMap = new Map(prices.map((x) => [x.date, x.value]));
  const navMap = new Map(navs.map((x) => [x.date, x.value]));
  const shareMap = new Map(shares.map((x) => [x.date, x.value]));
  const dates = [...new Set([...priceMap.keys(), ...navMap.keys(), ...shareMap.keys()])].sort();
  const shareHistory: DatedValue[] = [];
  let previousComplete: { nav: number; shares: number } | null = null;
  let streak = 0;
  let priorShare: number | null = null;

  return dates.map((date) => {
    const price = priceMap.get(date) ?? null;
    const exactNav = navMap.get(date) ?? null;
    const sharesValue = shareMap.get(date) ?? null;
    const priorNav = [...navs].filter((x) => x.date < date).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    let alignmentStatus: AlignmentStatus;
    let navDate: string | null = exactNav !== null ? date : null;
    let displayedNav = exactNav;
    if (price !== null && exactNav !== null) alignmentStatus = "same_date";
    else if (price === null && exactNav !== null) alignmentStatus = "price_missing";
    else if (price !== null && priorNav) { alignmentStatus = "nav_lagged"; displayedNav = priorNav.value; navDate = priorNav.date; }
    else if (price !== null) alignmentStatus = "nav_missing";
    else alignmentStatus = "no_common_date";

    if (sharesValue !== null) {
      shareHistory.push({ date, value: sharesValue });
      if (priorShare !== null) {
        const delta = sharesValue - priorShare;
        streak = delta === 0 ? 0 : Math.sign(delta) === Math.sign(streak) ? streak + Math.sign(delta) : Math.sign(delta);
      }
      priorShare = sharesValue;
    }
    const rolling = (n: number) => sharesValue !== null && shareHistory.length > n ? pct(sharesValue, shareHistory[shareHistory.length - 1 - n].value) : null;
    const shareCount = sharesValue === null ? null : sharesValue * 100_000_000;
    const estimatedAumCny = exactNav !== null && shareCount !== null ? exactNav * shareCount : null;
    let marketEffectCny: number | null = null;
    let shareEffectCny: number | null = null;
    let aumChangeCny: number | null = null;
    let residual: number | null = null;
    let rel: PriceShareRelationship | null = null;
    if (exactNav !== null && shareCount !== null && previousComplete) {
      const q0 = previousComplete.shares;
      const n0 = previousComplete.nav;
      marketEffectCny = ((shareCount + q0) / 2) * (exactNav - n0);
      shareEffectCny = ((exactNav + n0) / 2) * (shareCount - q0);
      aumChangeCny = exactNav * shareCount - n0 * q0;
      residual = aumChangeCny - marketEffectCny - shareEffectCny;
      rel = relationship(exactNav - n0, shareCount - q0);
    }
    if (exactNav !== null && shareCount !== null) previousComplete = { nav: exactNav, shares: shareCount };
    return {
      date, price, nav: displayedNav, navDate, sharesHundredMillion: sharesValue, alignmentStatus,
      premiumDiscountPct: alignmentStatus === "same_date" && price !== null && exactNav !== null ? (price / exactNav - 1) * 100 : null,
      estimatedAumCny, sharesChange5dPct: rolling(5), sharesChange20dPct: rolling(20), sharesChange60dPct: rolling(60),
      shareChangeStreakDays: sharesValue === null ? 0 : streak, marketEffectCny, shareEffectCny,
      aumChangeCny, decompositionResidualCny: residual, priceShareRelationship: rel,
    };
  });
}

export function latestFormalPremium(rows: EtfFoundationRow[]): EtfFoundationRow | null {
  return [...rows].reverse().find((row) => row.alignmentStatus === "same_date" && row.premiumDiscountPct !== null) ?? null;
}
