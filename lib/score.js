const SENSITIVE_CATEGORIES = [
  "email",
  "code",
  "documents",
  "communications",
  "crm",
  "finance",
  "professional",
];

const COUNTRY_WEIGHTS = {
  US: 1.0,
  CN: 1.0,
  UK: 0.6,
  GB: 0.6,
  CA: 0.5,
  FR: 0.4,
  DE: 0.4,
  IT: 0.4,
  ES: 0.4,
  NL: 0.4,
  BE: 0.4,
  SE: 0.4,
  IE: 0.4,
  PL: 0.4,
  AT: 0.4,
  DK: 0.4,
  FI: 0.4,
  PT: 0.4,
  CZ: 0.4,
  GR: 0.4,
  HU: 0.4,
  RO: 0.4,
  LU: 0.4,
  SK: 0.4,
  SI: 0.4,
  HR: 0.4,
  BG: 0.4,
  EE: 0.4,
  LV: 0.4,
  LT: 0.4,
  MT: 0.4,
  CY: 0.4,
  CH: 0.1,
};

const UNKNOWN_WEIGHT = 0.7;
const round1 = (n) => Math.round(n * 10) / 10;

export function computeScore(counters, daysActive) {
  const c = counters || {};
  const totalRequests = c.total || 0;
  const byCountry = c.byCountry || {};
  const bySourceCategory = c.bySourceCategory || {};
  const days = daysActive || 0;

  const volume = Math.min(30, 5 * Math.log10(totalRequests + 1));

  const categoriesDetected = Object.keys(bySourceCategory).filter(
    (cat) => SENSITIVE_CATEGORIES.includes(cat) && bySourceCategory[cat] > 0
  );
  const categoryDiversity = Math.min(30, categoriesDetected.length * 5);

  const countries = Object.keys(byCountry);
  let weightedSum = 0;
  for (const [country, count] of Object.entries(byCountry)) {
    const w =
      COUNTRY_WEIGHTS[country] !== undefined
        ? COUNTRY_WEIGHTS[country]
        : UNKNOWN_WEIGHT;
    weightedSum += w * count;
  }
  const usEquivalentShare =
    totalRequests > 0 ? Math.min(1, weightedSum / totalRequests) : 0;
  const geoExposure = Math.min(25, 25 * usEquivalentShare);

  const continuity = 15 * Math.min(1, days / 7);

  const score = Math.round(volume + categoryDiversity + geoExposure + continuity);

  return {
    score,
    breakdown: {
      volume: round1(volume),
      categoryDiversity: round1(categoryDiversity),
      geoExposure: round1(geoExposure),
      continuity: round1(continuity),
    },
    meta: {
      totalRequests,
      categoriesDetected,
      countries,
      daysActive: days,
      usEquivalentShare: Math.round(usEquivalentShare * 1000) / 1000,
    },
  };
}
