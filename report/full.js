import { computeScore } from "../lib/score.js";
import { detectUserCountry } from "../lib/country.js";

const EVENTS_PREFIX = "oys_events_";
const MIN_EVENTS_FOR_ACTIVE_DAY = 5;

/* Host → city/country map, mirrors the HOST_GEO in report.js. Used for
   derived tokens (cityCount, farthestCity, etc.) and future chart layers.
   Keep in sync if report.js's list changes. */
const HOST_GEO = {
  "api.openai.com":                     { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "chatgpt.com":                        { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "chat.openai.com":                    { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "openai.com":                         { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.anthropic.com":                  { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "claude.ai":                          { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "generativelanguage.googleapis.com":  { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "gemini.google.com":                  { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "aistudio.google.com":                { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "copilot.microsoft.com":              { city: "Redmond",       country: "US", coords: [-122.12, 47.67] },
  "api.cognitive.microsoft.com":        { city: "Redmond",       country: "US", coords: [-122.12, 47.67] },
  "api.mistral.ai":                     { city: "Paris",         country: "FR", coords: [2.35, 48.86] },
  "chat.mistral.ai":                    { city: "Paris",         country: "FR", coords: [2.35, 48.86] },
  "api.cohere.com":                     { city: "Toronto",       country: "CA", coords: [-79.38, 43.65] },
  "dashboard.cohere.com":               { city: "Toronto",       country: "CA", coords: [-79.38, 43.65] },
  "api.perplexity.ai":                  { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "perplexity.ai":                      { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "www.perplexity.ai":                  { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.x.ai":                           { city: "Palo Alto",     country: "US", coords: [-122.14, 37.44] },
  "grok.com":                           { city: "Palo Alto",     country: "US", coords: [-122.14, 37.44] },
  "api-inference.huggingface.co":       { city: "New York",      country: "US", coords: [-74.00, 40.71] },
  "huggingface.co":                     { city: "New York",      country: "US", coords: [-74.00, 40.71] },
  "api.together.xyz":                   { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.together.ai":                    { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.groq.com":                       { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "api.deepseek.com":                   { city: "Hangzhou",      country: "CN", coords: [120.16, 30.26] },
  "chat.deepseek.com":                  { city: "Hangzhou",      country: "CN", coords: [120.16, 30.26] },
};

const COUNTRY_NAME = {
  US: "the United States",
  FR: "France",
  DE: "Germany",
  GB: "the United Kingdom",
  UK: "the United Kingdom",
  CH: "Switzerland",
  CN: "China",
  CA: "Canada",
};

/* Product names as used in the editorial ("ChatGPT", "Claude"). Keys match
   the vendor field in data/endpoints.json. */
const VENDOR_PRODUCT = {
  OpenAI: "ChatGPT",
  Anthropic: "Claude",
  Google: "Gemini",
  Microsoft: "Copilot",
  Mistral: "Mistral",
  Cohere: "Cohere",
  Perplexity: "Perplexity",
  xAI: "Grok",
  HuggingFace: "Hugging Face",
  Together: "Together AI",
  Groq: "Groq",
  DeepSeek: "DeepSeek",
};

/* Origin coordinates per user country — mirrors COUNTRY_COORDS in report.js. */
const COUNTRY_COORDS = {
  CH:    { coords: [6.63, 46.52]   },  // Lausanne
  FR:    { coords: [2.35, 48.86]   },  // Paris
  DE:    { coords: [13.40, 52.52]  },  // Berlin
  GB:    { coords: [-0.13, 51.51]  },  // London
  US:    { coords: [-74.00, 40.71] },  // New York
  CN:    { coords: [116.40, 39.90] },  // Beijing
  OTHER: { coords: [-30, 35]       },  // Mid-Atlantic
};
const DEFAULT_ORIGIN = COUNTRY_COORDS.CH;

/* IANA timezone per destination city. Every distinct city in HOST_GEO has
   an entry; used by {timezoneCount}. */
const CITY_TIMEZONES = {
  "San Francisco": "America/Los_Angeles",
  "Mountain View": "America/Los_Angeles",
  "Redmond":       "America/Los_Angeles",
  "Palo Alto":     "America/Los_Angeles",
  "New York":      "America/New_York",
  "Paris":         "Europe/Paris",
  "Toronto":       "America/Toronto",
  "Hangzhou":      "Asia/Shanghai",
};

/* Short anecdotes about what lives in each city — used by {cityBreakdown}.
   Cities not listed fall back to "on servers in City, CC". */
const CITY_ANECDOTES = {
  "San Francisco": "where OpenAI's main infrastructure lives",
  "New York":      "routed through Cloudflare's east coast edge network",
  "Mountain View": "where Google's AI servers live",
  "Redmond":       "where Microsoft hosts Copilot",
  "Palo Alto":     "where xAI operates",
  "Paris":         "where Mistral hosts its servers",
  "Toronto":       "where Cohere is based",
  "Hangzhou":      "home to DeepSeek's infrastructure",
  "Beijing":       "routed through Chinese backbone infrastructure",
  "Amsterdam":     "through Microsoft Azure's European region",
};

const SENSITIVE_CATEGORIES = ["email", "code", "documents", "communications", "crm", "finance", "professional"];
const CATEGORY_LABEL = {
  email: "email",
  code: "code",
  documents: "documents",
  communications: "communications",
  crm: "customer data",
  finance: "finance",
  professional: "professional platforms",
};

/* ========================================================================
   Helpers
   ======================================================================== */

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function defaultCounters() {
  return {
    total: 0, today: 0, todayDate: dayKey(),
    byHost: {}, byCategory: {}, byCountry: {}, byVendor: {}, bySourceCategory: {},
  };
}

function countDaysActive(all) {
  let count = 0;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    if (Array.isArray(value) && value.length >= MIN_EVENTS_FOR_ACTIVE_DAY) count++;
  }
  return count;
}

function computeExposureStats(all, counters) {
  const totalRequests = counters && counters.total ? counters.total : 0;
  if (totalRequests === 0) return null;
  const timestamps = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    if (!Array.isArray(value)) continue;
    for (const ev of value) {
      if (ev && typeof ev.timestamp === "number") timestamps.push(ev.timestamp);
    }
  }
  if (timestamps.length === 0) return null;
  timestamps.sort((a, b) => a - b);

  const GAP_MS = 300000;
  const MIN_MS = 30000;
  let sumMs = 0;
  let sessionStart = timestamps[0];
  let sessionEnd = timestamps[0];
  let sessions = 1;
  for (let i = 1; i < timestamps.length; i++) {
    const t = timestamps[i];
    if (t - sessionEnd > GAP_MS) {
      sumMs += Math.max(sessionEnd - sessionStart, MIN_MS);
      sessions += 1;
      sessionStart = t;
    }
    sessionEnd = t;
  }
  sumMs += Math.max(sessionEnd - sessionStart, MIN_MS);

  const totalMinutes = sumMs < 60000 ? 1 : Math.round(sumMs / 60000);
  const secondsPerRequest = sumMs / 1000 / totalRequests;
  return { totalMinutes, totalRequests, secondsPerRequest, sessionCount: sessions };
}

function formatTime12h(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  if (h === 0)  return `12:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return h < 12 ? `${h}:${m} AM` : `${h - 12}:${m} PM`;
}
function formatHour12h(h) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function formatDateLong(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function formatTimeShort(d) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function englishList(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
}

function computeHourlyStats(all) {
  const hourCounts = new Array(24).fill(0);
  const todayK = dayKey();
  let firstToday = null;
  let lastToday = null;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    if (!Array.isArray(value)) continue;
    const isToday = key === EVENTS_PREFIX + todayK;
    for (const ev of value) {
      if (!ev || typeof ev.timestamp !== "number") continue;
      const d = new Date(ev.timestamp);
      hourCounts[d.getHours()] += 1;
      if (isToday) {
        if (firstToday == null || ev.timestamp < firstToday) firstToday = ev.timestamp;
        if (lastToday == null || ev.timestamp > lastToday) lastToday  = ev.timestamp;
      }
    }
  }
  let peakHour = 0;
  let peakHourRequests = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > peakHourRequests) {
      peakHour = h;
      peakHourRequests = hourCounts[h];
    }
  }
  const activeHours = hourCounts.filter((c) => c > 0).length;
  const idleHours = 24 - activeHours;
  const startHour = hourCounts.findIndex((c) => c > 0);
  const endHour = (() => {
    for (let h = 23; h >= 0; h--) if (hourCounts[h] > 0) return h;
    return -1;
  })();

  let daytime = 0, nighttime = 0;
  for (let h = 0; h < 24; h++) {
    if (h >= 7 && h < 23) daytime += hourCounts[h];
    else nighttime += hourCounts[h];
  }
  const dayNightRatio =
    nighttime === 0 ? (daytime > 0 ? "all daytime" : "—")
                    : `${(daytime / nighttime).toFixed(1)}x`;

  return {
    peakHour: peakHourRequests > 0 ? formatHour12h(peakHour) : "—",
    peakHourRequests,
    activeHours,
    idleHours,
    startHour: startHour >= 0 ? formatHour12h(startHour) : "—",
    endHour:   endHour   >= 0 ? formatHour12h(endHour)   : "—",
    dayNightRatio,
    firstActivityTime: firstToday ? formatTime12h(new Date(firstToday)) : "—",
    lastActivityTime:  lastToday  ? formatTime12h(new Date(lastToday))  : "—",
  };
}

function computeVolumePercentile(all, daysObserved, counters) {
  if (daysObserved <= 1) return "N/A";
  const todayK = dayKey();
  const todayCount = (all[EVENTS_PREFIX + todayK] || []).length;
  const dailyTotals = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    if (!Array.isArray(value)) continue;
    dailyTotals.push(value.length);
  }
  if (dailyTotals.length <= 1) return "N/A";
  const lowerCount = dailyTotals.filter((c) => c < todayCount).length;
  return Math.round((lowerCount / (dailyTotals.length - 1)) * 100) + "%";
}

function buildVendorList(byVendor) {
  const entries = Object.entries(byVendor || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "no AI service";
  const names = entries.map(([v]) => VENDOR_PRODUCT[v] || v);
  return englishList(names);
}

function buildCategoriesList(bySourceCategory) {
  const present = SENSITIVE_CATEGORIES.filter((c) => (bySourceCategory || {})[c] > 0);
  if (present.length === 0) return "none yet";
  return englishList(present.map((c) => CATEGORY_LABEL[c] || c));
}

function topEntry(obj) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  return entries[0] || [null, 0];
}
function secondEntry(obj) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  return entries[1] || [null, 0];
}

/* ========================================================================
   05.3 — Score history + geo distances + prose templates
   ======================================================================== */

function formatDateISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatMonthDay(iso) {
  if (!iso || typeof iso !== "string") return "—";
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "—";
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${d} ${month}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* Reads oys_score_history, seeds retroactively if empty, always writes today's
   snapshot (overwrites if present), rotates to the 30 most recent entries. */
async function seedOrUpdateScoreHistory(all, currentScore) {
  let history = Array.isArray(all.oys_score_history) ? all.oys_score_history.slice() : [];
  const isFirstSeed = history.length === 0;
  const today = formatDateISO(new Date());

  if (isFirstSeed) {
    const dayKeys = Object.keys(all)
      .filter((k) => k.startsWith(EVENTS_PREFIX))
      .sort();
    const cumulative = {
      total: 0,
      byHost: {},
      byCountry: {},
      byVendor: {},
      bySourceCategory: {},
    };
    let activeDayCount = 0;

    for (const key of dayKeys) {
      const events = all[key];
      if (!Array.isArray(events)) continue;

      // Accumulate this day's events into cumulative.
      for (const ev of events) {
        if (!ev) continue;
        cumulative.total += 1;
        if (ev.hostname) cumulative.byHost[ev.hostname] = (cumulative.byHost[ev.hostname] || 0) + 1;
        if (ev.endpointCountry)
          cumulative.byCountry[ev.endpointCountry] = (cumulative.byCountry[ev.endpointCountry] || 0) + 1;
        if (ev.endpointVendor)
          cumulative.byVendor[ev.endpointVendor] = (cumulative.byVendor[ev.endpointVendor] || 0) + 1;
        if (ev.sourceCategory)
          cumulative.bySourceCategory[ev.sourceCategory] =
            (cumulative.bySourceCategory[ev.sourceCategory] || 0) + 1;
      }
      if (events.length < MIN_EVENTS_FOR_ACTIVE_DAY) continue;

      activeDayCount += 1;
      const part = key.slice(EVENTS_PREFIX.length);
      if (part.length !== 8) continue;
      const dateISO = `${part.slice(0, 4)}-${part.slice(4, 6)}-${part.slice(6, 8)}`;
      const s = computeScore(cumulative, activeDayCount);
      history.push({
        date: dateISO,
        score: s.score,
        factors: {
          volume:      Math.round(s.breakdown.volume),
          categories:  Math.round(s.breakdown.categoryDiversity),
          geography:   Math.round(s.breakdown.geoExposure),
          continuity:  Math.round(s.breakdown.continuity),
        },
      });
    }
  }

  // Always write today's entry from the live counters (match oys_counters).
  const todayEntry = {
    date: today,
    score: currentScore.score,
    factors: {
      volume:      Math.round(currentScore.breakdown.volume),
      categories:  Math.round(currentScore.breakdown.categoryDiversity),
      geography:   Math.round(currentScore.breakdown.geoExposure),
      continuity:  Math.round(currentScore.breakdown.continuity),
    },
  };
  const idx = history.findIndex((e) => e.date === today);
  if (idx >= 0) history[idx] = todayEntry;
  else history.push(todayEntry);

  history.sort((a, b) => a.date.localeCompare(b.date));
  if (history.length > 30) history = history.slice(-30);

  try {
    await chrome.storage.local.set({ oys_score_history: history });
  } catch (err) {
    console.warn("OYS could not persist oys_score_history", err);
  }
  return history;
}

function computeTrendLabel(history) {
  if (!Array.isArray(history) || history.length < 4) return "insufficient data";
  const n = history.length;
  const last = (history[n - 1].score + history[n - 2].score) / 2;
  const prev = (history[n - 3].score + history[n - 4].score) / 2;
  if (last > prev + 3) return "rising";
  if (last < prev - 3) return "falling";
  return "stable";
}

function computeTodayVsAvg(todayScore, avgScore) {
  const diff = todayScore - avgScore;
  if (diff > 5) return "notably above your average";
  if (diff > 2) return "slightly above your average";
  if (Math.abs(diff) <= 2) return "right in line with your average";
  if (diff < -5) return "notably below your average";
  if (diff < -2) return "slightly below your average";
  return "right in line with your average";
}

function computeHistoryTokens(history, todayScore) {
  if (!history || history.length === 0) {
    return {
      minScore: 0,
      maxScore: 0,
      avgScore: 0,
      minScoreDate: "—",
      maxScoreDate: "—",
      trendLabel: "insufficient data",
      todayVsAvg: "right in line with your average",
    };
  }
  let minE = history[0];
  let maxE = history[0];
  let sum = 0;
  for (const e of history) {
    if (e.score < minE.score) minE = e;
    if (e.score > maxE.score) maxE = e;
    sum += e.score;
  }
  const avgScore = Math.round(sum / history.length);
  return {
    minScore: minE.score,
    maxScore: maxE.score,
    avgScore,
    minScoreDate: formatMonthDay(minE.date),
    maxScoreDate: formatMonthDay(maxE.date),
    trendLabel: computeTrendLabel(history),
    todayVsAvg: computeTodayVsAvg(todayScore, avgScore),
  };
}

function computeContinuityTrend(daysObserved) {
  if (daysObserved < 7) {
    const remaining = 7 - daysObserved;
    return `to reach the maximum in ${remaining} more day${remaining === 1 ? "" : "s"}`;
  }
  if (daysObserved === 7) return "at full continuity score";
  return "well into consistent exposure territory";
}

function computeTimezoneCount(byHost) {
  const tzs = new Set();
  for (const host of Object.keys(byHost || {})) {
    const geo = HOST_GEO[host];
    if (!geo) continue;
    const tz = CITY_TIMEZONES[geo.city];
    if (tz) tzs.add(tz);
  }
  return tzs.size;
}

function computeGeoDistanceTokens(byHost, userCountry) {
  const originEntry = (userCountry && COUNTRY_COORDS[userCountry]) || DEFAULT_ORIGIN;
  const [originLon, originLat] = originEntry.coords;

  const byCity = new Map();
  for (const [host, count] of Object.entries(byHost || {})) {
    const geo = HOST_GEO[host];
    if (!geo) continue;
    const key = geo.coords.join(",");
    if (!byCity.has(key)) {
      byCity.set(key, { city: geo.city, country: geo.country, coords: geo.coords, count: 0 });
    }
    byCity.get(key).count += count;
  }

  let farthest = null;
  let farthestDistance = 0;
  let totalDistance = 0;
  for (const info of byCity.values()) {
    const [lon, lat] = info.coords;
    const dist = haversineKm(originLat, originLon, lat, lon);
    totalDistance += dist * info.count;
    if (dist > farthestDistance) {
      farthestDistance = dist;
      farthest = info;
    }
  }

  const roundedFarthest =
    farthestDistance > 0 ? Math.round(farthestDistance / 100) * 100 : 0;
  return {
    farthestCity: farthest ? `${farthest.city}, ${farthest.country}` : "—",
    distanceKm: roundedFarthest > 0 ? roundedFarthest.toLocaleString("en-US") : "—",
    totalDistanceKm: totalDistance > 0 ? Math.round(totalDistance).toLocaleString("en-US") : "—",
  };
}

function buildCityBreakdown(byHost) {
  const byCity = new Map();
  for (const [host, count] of Object.entries(byHost || {})) {
    const geo = HOST_GEO[host];
    if (!geo) continue;
    const key = geo.coords.join(",");
    if (!byCity.has(key)) byCity.set(key, { city: geo.city, country: geo.country, count: 0 });
    byCity.get(key).count += count;
  }
  const cities = [...byCity.values()].sort((a, b) => b.count - a.count);
  if (cities.length === 0) return "Nowhere — no AI traffic yet";

  const fmt = (n) => (n > 999 ? n.toLocaleString("en-US") : String(n));
  const anecdote = (city, country) =>
    CITY_ANECDOTES[city] || `on servers in ${city}, ${country}`;

  if (cities.length === 1) {
    const c = cities[0];
    return `Most of them landed in ${c.city}, ${anecdote(c.city, c.country)}`;
  }
  if (cities.length === 2) {
    const [a, b] = cities;
    return `About ${fmt(a.count)} of them landed in ${a.city}, ${anecdote(a.city, a.country)}. The rest went to ${b.city}, ${anecdote(b.city, b.country)}`;
  }
  const [a, b, c] = cities;
  return `About ${fmt(a.count)} of them landed in ${a.city}, ${anecdote(a.city, a.country)}. ${fmt(b.count)} went to ${b.city}, ${anecdote(b.city, b.country)}. ${fmt(c.count)} to ${c.city}, ${anecdote(c.city, c.country)}`;
}

function buildCountrySummary(userCountry, byCountry, total) {
  if (!userCountry || userCountry === "OTHER") {
    return "Your data left. You know where it went. We don't know where you are";
  }
  const countryName = COUNTRY_NAME[userCountry] || userCountry;
  const domestic = (byCountry || {})[userCountry] || 0;
  if (domestic === 0) {
    return `Nothing stayed in ${countryName}, where your browser was calling from`;
  }
  if (total > 0 && domestic === total) {
    return `It all stayed within ${countryName}. Rare, these days`;
  }
  return `Some of it stayed in ${countryName}. Most of it did not`;
}

/* ========================================================================
   Token assembly
   ======================================================================== */

function buildTokens(all) {
  const counters = all.oys_counters || defaultCounters();
  const total = counters.total || 0;
  const byCountry = counters.byCountry || {};
  const byVendor = counters.byVendor || {};
  const byHost = counters.byHost || {};
  const bySourceCategory = counters.bySourceCategory || {};

  // Country
  const userCountry = all._userCountry || null;  // set by caller
  const [topCountry, topCountryCount] = topEntry(byCountry);
  const topCountryShare = total > 0 && topCountryCount
    ? Math.round((topCountryCount / total) * 100) : 0;
  const usTotal = byCountry.US || 0;
  const cnTotal = byCountry.CN || 0;
  const topDestinationShare = total > 0 ? Math.round((usTotal / total) * 100) : 0;
  const percentToChina = total > 0 ? Math.round((cnTotal / total) * 100) : 0;

  // Cross-border
  let crossBorderCount = 0;
  for (const [cc, n] of Object.entries(byCountry)) {
    if (userCountry && cc !== userCountry) crossBorderCount += n;
  }
  const percentCrossingBorders = total > 0
    ? Math.round((crossBorderCount / total) * 100) : 0;

  const countryCount = Object.keys(byCountry).length;
  const foreignCountryCount = userCountry && byCountry[userCountry]
    ? Math.max(0, countryCount - 1) : countryCount;

  // Cities (from HOST_GEO)
  const cityKeys = new Set();
  for (const host of Object.keys(byHost)) {
    const geo = HOST_GEO[host];
    if (geo) cityKeys.add(geo.coords.join(","));
  }
  const cityCount = cityKeys.size;

  // Vendors
  const vendorCount = Object.keys(byVendor).length;
  const [topVendorKey, topVendorCount] = topEntry(byVendor);
  const [secondVendorKey, secondVendorCount] = secondEntry(byVendor);
  const topVendorName = topVendorKey ? (VENDOR_PRODUCT[topVendorKey] || topVendorKey) : "—";
  const secondVendorName = secondVendorKey ? (VENDOR_PRODUCT[secondVendorKey] || secondVendorKey) : "—";
  const topVendorShare = total > 0 && topVendorCount ? Math.round((topVendorCount / total) * 100) : 0;
  const secondVendorShare = total > 0 && secondVendorCount ? Math.round((secondVendorCount / total) * 100) : 0;
  const topToSecondRatio = secondVendorShare > 0
    ? `${(topVendorShare / secondVendorShare).toFixed(1)}x`
    : (vendorCount <= 1 ? "N/A — single vendor" : "∞");
  const vendorList = buildVendorList(byVendor);

  // Score
  const daysObserved = all._daysObserved ?? 0;
  const score = all._score || { score: 0, breakdown: { volume: 0, categoryDiversity: 0, geoExposure: 0, continuity: 0 } };
  const todayScore = score.score;
  const volumeScore = Math.round(score.breakdown.volume);
  const categoriesScore = Math.round(score.breakdown.categoryDiversity);
  const geographyScore = Math.round(score.breakdown.geoExposure);
  const continuityScore = Math.round(score.breakdown.continuity);
  const avgDailyRequests = daysObserved > 0 ? Math.round(total / daysObserved) : total;

  // Categories
  const sensitivePresent = SENSITIVE_CATEGORIES.filter((c) => (bySourceCategory[c] || 0) > 0);
  const categoriesCount = sensitivePresent.length;
  const categoriesList = buildCategoriesList(bySourceCategory);

  // Exposure stats
  const exposure = all._exposure;
  const minutesActive = exposure ? exposure.totalMinutes : 0;
  let secondsPerRequest = "—";
  if (exposure && Number.isFinite(exposure.secondsPerRequest)) {
    const s = exposure.secondsPerRequest;
    secondsPerRequest = s < 1 ? s.toFixed(1) : String(Math.round(s));
  }

  // Hourly
  const hourly = all._hourly || {};

  // Today times (editorial uses firstTimeToday / lastTimeToday as aliases)
  const firstTimeToday = hourly.firstActivityTime || "—";
  const lastTimeToday  = hourly.lastActivityTime  || "—";

  // Dates
  const now = new Date();
  const dateLong = formatDateLong(now);
  const dateLongUpper = dateLong.toUpperCase();
  const timeShort = formatTimeShort(now);
  const year = now.getFullYear();

  // Volume percentile
  const volumePercentile = computeVolumePercentile(all, daysObserved, counters);

  const tokens = {
    // volume / count
    totalRequests: total.toLocaleString("en-US"),
    totalRequestsFormatted: total.toLocaleString("en-US"),
    totalRequestsToday: total.toLocaleString("en-US"),

    // time
    minutesActive,
    secondsPerRequest,
    firstTimeToday,
    lastTimeToday,
    firstActivityTime: hourly.firstActivityTime || "—",
    lastActivityTime:  hourly.lastActivityTime  || "—",
    peakHour: hourly.peakHour || "—",
    peakHourRequests: hourly.peakHourRequests ?? 0,
    idleHours: hourly.idleHours ?? 0,
    startHour: hourly.startHour || "—",
    endHour:   hourly.endHour   || "—",
    dayNightRatio: hourly.dayNightRatio || "—",

    // vendors
    vendorCount,
    topVendorName,
    topVendorShare,
    secondVendorName,
    secondVendorShare,
    topToSecondRatio,
    vendorName: topVendorName,
    vendorList,

    // score
    todayScore,
    volumeScore,
    categoriesScore,
    geographyScore,
    continuityScore,
    avgDailyRequests,
    volumePercentile,

    // categories
    categoriesCount,
    categoriesList,

    // geography
    userCountry: userCountry || "—",
    countryName: userCountry ? (COUNTRY_NAME[userCountry] || userCountry) : "—",
    topCountry: topCountry || "—",
    topCountryShare,
    crossBorderShare: percentCrossingBorders,
    percentCrossingBorders,
    percentToChina,
    topDestinationShare,
    cityCount,
    countryCount,
    foreignCountryCount,

    // observation
    daysObserved,

    // date
    date: dateLong,
    dateLongUpper,
    time: timeShort,
    year,
  };

  /* All 14 "Category 3" tokens (cityBreakdown, countrySummary, minScore,
     maxScore, avgScore, minScoreDate, maxScoreDate, trendLabel, todayVsAvg,
     continuityTrend, timezoneCount, farthestCity, distanceKm, totalDistanceKm)
     are merged into `tokens` by initFull() right before DOM replacement. */

  return { tokens, userCountry, topCountry, countryCount, vendorCount, percentToChina,
           daysObserved, total, activeHours: hourly.activeHours ?? 0,
           categoriesCount };
}

/* ========================================================================
   DOM walk + variant resolution
   ======================================================================== */

function chooseVariant(groupKey, ctx) {
  if (groupKey === "mode") {
    return (ctx.daysObserved >= 3 && ctx.total >= 500) ? "full" : "light";
  }
  if (groupKey === "geography") {
    if (ctx.userCountry && ctx.topCountry && ctx.userCountry === ctx.topCountry && ctx.countryCount === 1) return "allDomestic";
    if (ctx.userCountry && ctx.topCountry && ctx.userCountry !== ctx.topCountry && ctx.countryCount === 1) return "allForeign";
    return "multiCountry";
  }
  if (groupKey === "continuity") {
    return ctx.daysObserved === 1 ? "firstDay" : "standard";
  }
  if (groupKey === "china") {
    return ctx.percentToChina > 0 ? "hasChina" : "noChina";
  }
  if (groupKey === "vendor-legend") {
    return ctx.vendorCount === 1 ? "mono" : "multi";
  }
  if (groupKey === "hourly-legend") {
    return ctx.activeHours < 6 ? "concentrated" : "standard";
  }
  if (groupKey === "categories-section") {
    return ctx.categoriesCount === 0 ? "empty" : "standard";
  }
  return null;
}

function resolveVariants(ctx) {
  const groups = document.querySelectorAll("[data-variant-group]");
  for (const group of groups) {
    const key = group.dataset.variantGroup;
    const chosen = chooseVariant(key, ctx);
    if (!chosen) continue;
    const variants = group.querySelectorAll(":scope > [data-variant-if]");
    for (const v of variants) {
      if (v.dataset.variantIf !== chosen) v.remove();
    }
  }
}

function replaceTokens(root, tokens) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const tokenRe = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) {
    if (!node.nodeValue.includes("{")) continue;
    const next = node.nodeValue.replace(tokenRe, (m, name) =>
      name in tokens ? String(tokens[name]) : m
    );
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

/* ========================================================================
   Init
   ======================================================================== */

async function initFull() {
  const printBtn = document.getElementById("print-btn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  try {
    const all = await chrome.storage.local.get(null);
    const counters = all.oys_counters || defaultCounters();
    const daysObserved = countDaysActive(all);
    const userCountry = await detectUserCountry();
    const exposure = computeExposureStats(all, counters);
    const hourly = computeHourlyStats(all);
    const score = computeScore(counters, daysObserved);

    // 05.3 — score history (seed retroactively on first run, then update today).
    const scoreHistory = await seedOrUpdateScoreHistory(all, score);

    // 05.3 — compute the 14 previously-deferred tokens.
    const historyTokens = computeHistoryTokens(scoreHistory, score.score);
    const geoTokens = computeGeoDistanceTokens(counters.byHost, userCountry);
    const timezoneCount = computeTimezoneCount(counters.byHost);
    const continuityTrend = computeContinuityTrend(daysObserved);
    const cityBreakdown = buildCityBreakdown(counters.byHost);
    const countrySummary = buildCountrySummary(userCountry, counters.byCountry, counters.total || 0);

    all._userCountry = userCountry;
    all._daysObserved = daysObserved;
    all._exposure = exposure;
    all._hourly = hourly;
    all._score = score;

    const { tokens, ...ctx } = buildTokens(all);

    // Merge 05.3 tokens (override any defaults left by buildTokens).
    Object.assign(tokens, historyTokens, geoTokens, {
      timezoneCount,
      continuityTrend,
      cityBreakdown,
      countrySummary,
    });

    document.title = `Over Your Shoulder — Exposure Report — ${tokens.date}`;

    resolveVariants(ctx);
    replaceTokens(document.body, tokens);

    // --- Verification log (Part 9) ---
    const cat3Keys = new Set([
      "cityBreakdown", "countrySummary",
      "minScore", "maxScore", "avgScore", "minScoreDate", "maxScoreDate",
      "trendLabel", "todayVsAvg", "continuityTrend",
      "timezoneCount", "farthestCity", "distanceKm", "totalDistanceKm",
    ]);
    const c1c2 = {};
    for (const [k, v] of Object.entries(tokens)) if (!cat3Keys.has(k)) c1c2[k] = v;

    console.group("OYS Full Report — Token trace");
    console.log("=== Variants chosen ===");
    console.table({
      mode: chooseVariant("mode", ctx),
      geography: chooseVariant("geography", ctx),
      continuity: chooseVariant("continuity", ctx),
      "vendor-legend": chooseVariant("vendor-legend", ctx),
      "hourly-legend": chooseVariant("hourly-legend", ctx),
      china: chooseVariant("china", ctx),
      "categories-section": chooseVariant("categories-section", ctx),
    });
    console.log("=== Category 1 + 2 tokens ===");
    console.table(c1c2);
    console.log("=== Category 3 (newly resolved) ===");
    console.table({
      minScore: historyTokens.minScore,
      maxScore: historyTokens.maxScore,
      avgScore: historyTokens.avgScore,
      minScoreDate: historyTokens.minScoreDate,
      maxScoreDate: historyTokens.maxScoreDate,
      trendLabel: historyTokens.trendLabel,
      todayVsAvg: historyTokens.todayVsAvg,
      timezoneCount,
      farthestCity: geoTokens.farthestCity,
      distanceKm: geoTokens.distanceKm,
      totalDistanceKm: geoTokens.totalDistanceKm,
      continuityTrend,
      cityBreakdown:
        cityBreakdown.length > 100 ? cityBreakdown.substring(0, 100) + "…" : cityBreakdown,
      countrySummary,
    });
    console.log("=== History seed status ===");
    console.log("Score history entries:", scoreHistory.length);
    if (scoreHistory.length > 0) {
      console.log("First entry:", scoreHistory[0]);
      console.log("Last entry:", scoreHistory[scoreHistory.length - 1]);
    }
    console.groupEnd();
  } catch (err) {
    console.error("OYS full report init failed", err);
  }
}

initFull();
