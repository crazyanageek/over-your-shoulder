import { computeScore } from "../lib/score.js";
import { detectUserCountry } from "../lib/country.js";

const EVENTS_PREFIX = "oys_events_";
const MIN_EVENTS_FOR_ACTIVE_DAY = 5;

const HOST_GEO = {
  "api.openai.com":                 { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "chatgpt.com":                    { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "chat.openai.com":                { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "openai.com":                     { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.anthropic.com":              { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "claude.ai":                      { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "generativelanguage.googleapis.com": { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "gemini.google.com":              { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "aistudio.google.com":            { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "copilot.microsoft.com":          { city: "Redmond",       country: "US", coords: [-122.12, 47.67] },
  "api.cognitive.microsoft.com":    { city: "Redmond",       country: "US", coords: [-122.12, 47.67] },
  "api.mistral.ai":                 { city: "Paris",         country: "FR", coords: [2.35, 48.86] },
  "chat.mistral.ai":                { city: "Paris",         country: "FR", coords: [2.35, 48.86] },
  "api.cohere.com":                 { city: "Toronto",       country: "CA", coords: [-79.38, 43.65] },
  "dashboard.cohere.com":           { city: "Toronto",       country: "CA", coords: [-79.38, 43.65] },
  "api.perplexity.ai":              { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "perplexity.ai":                  { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "www.perplexity.ai":              { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.x.ai":                       { city: "Palo Alto",     country: "US", coords: [-122.14, 37.44] },
  "grok.com":                       { city: "Palo Alto",     country: "US", coords: [-122.14, 37.44] },
  "api-inference.huggingface.co":   { city: "New York",      country: "US", coords: [-74.00, 40.71] },
  "huggingface.co":                 { city: "New York",      country: "US", coords: [-74.00, 40.71] },
  "api.together.xyz":               { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.together.ai":                { city: "San Francisco", country: "US", coords: [-122.42, 37.77] },
  "api.groq.com":                   { city: "Mountain View", country: "US", coords: [-122.08, 37.39] },
  "api.deepseek.com":               { city: "Hangzhou",      country: "CN", coords: [120.16, 30.26] },
  "chat.deepseek.com":              { city: "Hangzhou",      country: "CN", coords: [120.16, 30.26] },
};

const COUNTRY_COORDS = {
  CH:    { coords: [6.63, 46.52],   label: "YOU ARE HERE" },      // Lausanne
  FR:    { coords: [2.35, 48.86],   label: "YOU ARE HERE" },      // Paris
  DE:    { coords: [13.40, 52.52],  label: "YOU ARE HERE" },      // Berlin
  GB:    { coords: [-0.13, 51.51],  label: "YOU ARE HERE" },      // London
  US:    { coords: [-74.00, 40.71], label: "YOU ARE HERE" },      // New York
  CN:    { coords: [116.40, 39.90], label: "YOU ARE HERE" },      // Beijing
  OTHER: { coords: [-30, 35],       label: "YOU ARE NOT HERE" },  // Mid-Atlantic
};
const DEFAULT_ORIGIN = COUNTRY_COORDS.CH;

const COUNTRY_NAME = {
  US: "United States",
  FR: "France",
  CA: "Canada",
  CN: "China",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  CH: "Switzerland",
};

const FALLBACK_PUNCHLINES = {
  masthead: ["Your browser had a chattier day than you."],
  mapHeadline: {
    domestic: {},
    dominantByCountry: {
      US: ["Your data crossed the Atlantic {N} times today."],
    },
    neutral: ["{N} transmissions left this laptop today."],
  },
  verdict: {
    low:       { lines: ["Barely exposed"] },
    mild:      { lines: ["Warming up"] },
    moderate:  { lines: ["Moderate and climbing"] },
    high:      { lines: ["Loud and getting louder"] },
    alarming:  { lines: ["Shouting in all directions"] },
  },
};

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

// Groups timestamps into sessions (5-min gap), sums durations, derives the
// "X minutes / Y requests / one every Z" stats rendered in the hero-sub.
// Returns null when there's nothing to report (empty storage).
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

  const GAP_MS = 300000;   // 5 min gap starts a new session
  const MIN_MS = 30000;    // single-event sessions count as 30s

  let sumMs = 0;
  let sessions = 1;
  let sessionStart = timestamps[0];
  let sessionEnd = timestamps[0];

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

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function scoreBandKey(score) {
  if (score <= 20) return "low";
  if (score <= 40) return "mild";
  if (score <= 60) return "moderate";
  if (score <= 80) return "high";
  return "alarming";
}

function pickVerdict(verdictObj, score, daysActive) {
  if (!daysActive) return "No signal yet";
  const band = scoreBandKey(score);
  const node = verdictObj && verdictObj[band];
  const lines = (node && node.lines) || FALLBACK_PUNCHLINES.verdict[band].lines;
  return pickRandom(lines);
}

function ringColorFor(score) {
  if (score <= 20) return "#0F4C3A";
  if (score <= 40) return "#CC9500";
  if (score <= 60) return "#E28413";
  return "#B91C1C";
}

function tierFor(count) {
  if (count >= 100) return 3;
  if (count >= 10)  return 2;
  return 1;
}

function tierColorHex(tier) {
  return tier === 3 ? "#B91C1C" : tier === 2 ? "#E28413" : "#CC9500";
}

function computeDateline(daysActive, installDateKey) {
  let dateStr;
  if (installDateKey && /^\d{8}$/.test(installDateKey)) {
    const y = parseInt(installDateKey.slice(0, 4), 10);
    const m = parseInt(installDateKey.slice(4, 6), 10);
    const d = parseInt(installDateKey.slice(6, 8), 10);
    const date = new Date(y, m - 1, d);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    dateStr = `Since ${d} ${month}`;
  } else {
    dateStr = "Since today";
  }
  const daysStr = daysActive === 1 ? "1 day observed" : `${daysActive} days observed`;
  return { dateStr, daysStr };
}

function earliestEventKey(all) {
  const keys = Object.keys(all)
    .filter((k) => k.startsWith(EVENTS_PREFIX) && /^\d{8}$/.test(k.slice(EVENTS_PREFIX.length)));
  if (keys.length === 0) return null;
  keys.sort();
  return keys[0].slice(EVENTS_PREFIX.length);
}

async function selectMapHeadline(punchlines, counters, totalRequests) {
  const lang = "en";
  const mh = (punchlines.mapHeadline && punchlines.mapHeadline[lang]) || {};
  const fbMh = FALLBACK_PUNCHLINES.mapHeadline;
  const neutralPool = (mh.neutral && mh.neutral.length ? mh.neutral : fbMh.neutral) || [];

  const byCountry = counters.byCountry || {};
  const entries = Object.entries(byCountry);
  if (entries.length === 0 || totalRequests <= 0) {
    console.log("OYS mapHeadline pool: neutral (no byCountry data)");
    return { template: pickRandom(neutralPool), nValue: totalRequests };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topCountry, topCount] = entries[0];
  const topShare = topCount / totalRequests;

  if (topShare < 0.70) {
    console.log(
      `OYS mapHeadline pool: neutral (top=${topCountry} ${Math.round(topShare * 100)}% < 70%)`
    );
    return { template: pickRandom(neutralPool), nValue: totalRequests };
  }

  const userCountry = await detectUserCountry();
  const isDomestic = userCountry && userCountry === topCountry;
  const domesticPool = mh.domestic && mh.domestic[topCountry];
  const dominantPool = mh.dominantByCountry && mh.dominantByCountry[topCountry];
  const fbDominant = fbMh.dominantByCountry && fbMh.dominantByCountry[topCountry];

  if (isDomestic && domesticPool && domesticPool.length) {
    console.log(
      `OYS mapHeadline pool: domestic.${topCountry} (user=${userCountry}, top=${topCountry} ${Math.round(topShare * 100)}%)`
    );
    return { template: pickRandom(domesticPool), nValue: topCount };
  }
  if (!isDomestic && dominantPool && dominantPool.length) {
    console.log(
      `OYS mapHeadline pool: dominantByCountry.${topCountry} (user=${userCountry || "null"}, top=${topCountry} ${Math.round(topShare * 100)}%)`
    );
    return { template: pickRandom(dominantPool), nValue: topCount };
  }
  if (!isDomestic && fbDominant && fbDominant.length) {
    console.log(
      `OYS mapHeadline pool: FALLBACK.dominantByCountry.${topCountry} (user=${userCountry || "null"})`
    );
    return { template: pickRandom(fbDominant), nValue: topCount };
  }
  console.log(
    `OYS mapHeadline pool: neutral (no matching pool for top=${topCountry}, user=${userCountry || "null"})`
  );
  return { template: pickRandom(neutralPool), nValue: totalRequests };
}

async function loadPunchlines() {
  try {
    const url = chrome.runtime.getURL("report/data/punchlines.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed: " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("OYS punchlines load failed, using fallback", err);
    return {
      masthead: { en: FALLBACK_PUNCHLINES.masthead },
      heroSub: { en: FALLBACK_PUNCHLINES.heroSub },
      mapHeadline: { en: FALLBACK_PUNCHLINES.mapHeadline },
      verdict: { en: FALLBACK_PUNCHLINES.verdict },
    };
  }
}

function renderMasthead(punchline, { dateStr, daysStr }) {
  document.querySelector(".masthead .punchline").textContent = `"${punchline}"`;
  const datelineEl = document.querySelector(".masthead .dateline");
  datelineEl.replaceChildren();
  const s1 = document.createElement("span"); s1.textContent = dateStr;
  const s2 = document.createElement("span"); s2.textContent = daysStr;
  datelineEl.append(s1, s2);
}

function renderHero(total) {
  const el = document.getElementById("hero-number");
  el.textContent = total === 0 ? "—" : total.toLocaleString();
}

function renderHeroEmpty() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  hero.classList.add("hero-empty-state");
  hero.replaceChildren();
  const l1 = document.createElement("p");
  l1.className = "he-line1";
  l1.textContent = "Nothing to show yet.";
  const l2 = document.createElement("p");
  l2.className = "he-line2";
  l2.textContent =
    "Send a prompt to any AI \u2014 Open ChatGPT, Claude, Gemini \u2014 anything \u2014 refresh this page, and watch what your browser does.";
  hero.append(l1, l2);
}

function renderHeroSub(stats, total) {
  const el = document.querySelector(".hero-sub");
  el.replaceChildren();
  const caption = document.createElement("span");
  caption.className = "caption-label";
  caption.textContent = "Requests your browser has sent to AI servers";
  el.appendChild(caption);
  if (total === 0 || !stats) {
    el.appendChild(document.createTextNode("No data yet. Come back tomorrow."));
    return;
  }
  renderExposureSentence(el, stats);
}

function renderExposureSentence(el, stats) {
  const { totalMinutes, totalRequests, secondsPerRequest } = stats;

  const numSpan = (text) => {
    const s = document.createElement("span");
    s.className = "exposure-stat-number";
    s.textContent = text;
    return s;
  };
  const text = (t) => document.createTextNode(t);

  el.appendChild(text(" In "));
  el.appendChild(numSpan(String(totalMinutes)));
  el.appendChild(text(totalMinutes === 1 ? " minute on AI sites, your browser sent " : " minutes on AI sites, your browser sent "));

  if (totalRequests === 1) {
    el.appendChild(numSpan("1"));
    el.appendChild(text(" request."));
  } else {
    el.appendChild(numSpan(totalRequests.toLocaleString()));
    el.appendChild(text(" requests."));
  }

  if (secondsPerRequest > 300) return;

  el.appendChild(text(" That\u2019s one every "));

  if (secondsPerRequest < 1) {
    el.appendChild(numSpan(secondsPerRequest.toFixed(1)));
    el.appendChild(text(" seconds."));
  } else if (secondsPerRequest < 60) {
    const z = Math.round(secondsPerRequest);
    el.appendChild(numSpan(String(z)));
    el.appendChild(text(z === 1 ? " second." : " seconds."));
  } else {
    const w = Math.round(secondsPerRequest / 60);
    el.appendChild(numSpan(String(w)));
    el.appendChild(text(w === 1 ? " minute." : " minutes."));
  }
}

function formatLegendVal(val, max) {
  if (val >= max) return `${max} maxed`;
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

function renderScore(score, breakdown, verdict) {
  document.querySelector(".ring-center .num").textContent = String(score);
  const fill = document.querySelector(".ring .ring-fill");
  const dashLen = (score * 3.27).toFixed(1);
  fill.setAttribute("stroke-dasharray", `${dashLen} 327`);
  fill.setAttribute("stroke", ringColorFor(score));

  document.querySelector(".c-header .verdict").textContent = verdict;

  const { volume, categoryDiversity, geoExposure, continuity } = breakdown;
  const filledSum = volume + categoryDiversity + geoExposure + continuity;
  const empty = Math.max(0, Math.round(100 - filledSum));

  const bar = document.querySelector(".c-bar");
  bar.replaceChildren();
  const addSeg = (cls, val, labelOverride) => {
    if (val <= 0) return;
    const d = document.createElement("div");
    d.className = `seg ${cls}`;
    d.style.flex = `${val} 0 0`;
    d.textContent = labelOverride ?? (val >= 4 ? String(Math.round(val)) : "");
    bar.appendChild(d);
  };
  addSeg("seg-volume", volume);
  addSeg("seg-cat",    categoryDiversity);
  addSeg("seg-geo",    geoExposure);
  addSeg("seg-cont",   continuity);
  if (empty > 0) {
    const d = document.createElement("div");
    d.className = "seg seg-empty";
    d.style.flex = `${empty} 0 0`;
    d.textContent = empty >= 10 ? `${empty} to go` : "";
    bar.appendChild(d);
  }

  const legend = document.querySelector(".c-legend");
  legend.replaceChildren();
  const addLg = (swatchVar, name, valText) => {
    const item = document.createElement("span"); item.className = "lg-item";
    const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = swatchVar;
    const city = document.createElement("span"); city.className = "city"; city.textContent = name;
    const v = document.createElement("span"); v.className = "val"; v.textContent = valText;
    item.append(sw, city, v);
    legend.appendChild(item);
  };
  addLg("var(--make-volume)", "Volume",     formatLegendVal(volume, 30));
  addLg("var(--make-cat)",    "Categories", formatLegendVal(categoryDiversity, 30));
  addLg("var(--make-geo)",    "Geography",  formatLegendVal(geoExposure, 25));
  addLg("var(--make-cont)",   "Continuity", formatLegendVal(continuity, 15));
}

function renderMapHeadline(text) {
  const el = document.querySelector(".map-headline");
  el.replaceChildren();
  const parts = text.split(/(\{em\}.*?\{\/em\})/);
  const emRe = /^\{em\}(.*)\{\/em\}$/;
  for (const part of parts) {
    const m = part.match(emRe);
    if (m) {
      const em = document.createElement("em"); em.textContent = m[1];
      el.appendChild(em);
    } else if (part) {
      el.appendChild(document.createTextNode(part));
    }
  }
}

/*
 * Antimeridian-safe arc construction.
 *
 * d3.geoInterpolate returns great-circle points in [-180, 180], but the
 * Natural Earth projection maps ±180 to opposite horizontal edges. When an
 * arc's shortest path crosses the antimeridian (e.g. Beijing → San Francisco),
 * interpolation near the crossing produces one point at x≈600 and the next at
 * x≈0, rendering a spurious horizontal line across the top of the map.
 *
 * We detect the crossing (|dlon - olon| > 180) and split the arc into two
 * screen-space segments that exit one edge and re-enter the other at the same
 * latitude. The sine-curve lift uses the *global* t so the two halves meet
 * seamlessly in y when the viewer's eye continues past the edge.
 */
function buildArcSegments(origin, dest, projection) {
  const [olon, olat] = origin;
  const [dlon, dlat] = dest;
  const crosses = Math.abs(dlon - olon) > 180;
  const STEPS = 48;

  if (!crosses) {
    const interp = d3.geoInterpolate(origin, dest);
    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const p = interp(t);
      const lift = Math.sin(t * Math.PI) * 18;
      const [px, py] = projection(p);
      pts.push([px, py - lift]);
    }
    return [pts];
  }

  const east = olon > dlon;                // crossing via +180 edge
  const edgeOut = east ? 180 : -180;
  const edgeIn  = east ? -180 : 180;
  const lonDist1 = east ? 180 - olon : olon + 180;
  const lonDist2 = east ? dlon + 180 : 180 - dlon;
  const tEdge = lonDist1 / (lonDist1 + lonDist2);
  const latEdge = olat + (dlat - olat) * tEdge;

  const linearArc = (fLon, fLat, tLon, tLat, tStart, tEnd, steps) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const local = i / steps;
      const lon = fLon + (tLon - fLon) * local;
      const lat = fLat + (tLat - fLat) * local;
      const globalT = tStart + (tEnd - tStart) * local;
      const lift = Math.sin(globalT * Math.PI) * 18;
      const [px, py] = projection([lon, lat]);
      pts.push([px, py - lift]);
    }
    return pts;
  };

  const s1 = Math.max(12, Math.round(STEPS * tEdge));
  const s2 = Math.max(12, Math.round(STEPS * (1 - tEdge)));
  return [
    linearArc(olon, olat, edgeOut, latEdge, 0,     tEdge, s1),
    linearArc(edgeIn, latEdge, dlon,  dlat,  tEdge, 1,     s2),
  ];
}

async function renderMap(counters) {
  const svg = d3.select("#worldmap");
  svg.selectAll("*").remove();
  const width = 600, height = 200;
  const projection = d3.geoNaturalEarth1()
    .scale(95).center([-10, 20]).translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));
  svg.append("path").attr("class", "graticule")
    .attr("d", path(d3.geoGraticule().step([30, 30])()));

  try {
    const worldUrl = chrome.runtime.getURL("report/data/world-110m.json");
    const world = await (await fetch(worldUrl)).json();
    const countries = topojson.feature(world, world.objects.countries);
    svg.append("g").selectAll("path").data(countries.features).enter().append("path")
      .attr("class", "land").attr("d", path);
    svg.append("path").attr("class", "borders-internal")
      .attr("d", path(topojson.mesh(world, world.objects.countries, (a, b) => a !== b)));
    svg.append("path").attr("class", "coastline")
      .attr("d", path(topojson.mesh(world, world.objects.countries, (a, b) => a === b)));
  } catch (e) {
    console.error("OYS world atlas failed to load", e);
  }

  const userCountry = await detectUserCountry();
  const originEntry =
    (userCountry && COUNTRY_COORDS[userCountry]) || DEFAULT_ORIGIN;
  const origin = originEntry.coords;
  const originLabel = originEntry.label;
  console.log(
    `OYS map origin: ${userCountry || "null"} -> [${origin[0]}, ${origin[1]}] "${originLabel}"`
  );
  const [ox, oy] = projection(origin);

  const byCity = new Map();
  for (const [host, count] of Object.entries(counters.byHost || {})) {
    const geo = HOST_GEO[host];
    if (!geo) continue;
    const key = geo.coords.join(",");
    if (!byCity.has(key)) byCity.set(key, { coords: geo.coords, city: geo.city, country: geo.country, count: 0 });
    byCity.get(key).count += count;
  }
  const destinations = Array.from(byCity.values());
  destinations.forEach((d) => { d.tier = tierFor(d.count); d.color = tierColorHex(d.tier); });

  const arcLayer = svg.append("g");
  const line = d3.line().curve(d3.curveBasis);
  destinations.forEach((d) => {
    let strokeWidth, opacity;
    if (d.tier === 3)      { strokeWidth = 2.6; opacity = 0.92; }
    else if (d.tier === 2) { strokeWidth = 1.9; opacity = 0.9;  }
    else                   { strokeWidth = 1.5; opacity = 0.9;  }

    for (const segment of buildArcSegments(origin, d.coords, projection)) {
      arcLayer.append("path").attr("class", "arc").attr("d", line(segment))
        .attr("stroke", d.color).attr("stroke-width", strokeWidth).attr("opacity", opacity);
    }
  });

  const dotLayer = svg.append("g");
  destinations.forEach((d) => {
    const [dx, dy] = projection(d.coords);
    const r = d.tier === 3 ? 6 : d.tier === 2 ? 3.8 : 3.3;
    dotLayer.append("circle").attr("class", "dest")
      .attr("cx", dx).attr("cy", dy).attr("r", r).attr("fill", d.color);
  });

  svg.append("circle").attr("class", "origin-ring").attr("cx", ox).attr("cy", oy).attr("r", 10);
  svg.append("circle").attr("class", "origin-ring").attr("cx", ox).attr("cy", oy).attr("r", 5);
  svg.append("circle").attr("class", "origin").attr("cx", ox).attr("cy", oy).attr("r", 2.5);

  const labelWidth = originLabel === "YOU ARE NOT HERE" ? 110 : 78;
  const labelHeight = 13;
  const labelX = ox - labelWidth / 2;
  const labelY = oy + 14;
  svg.append("rect").attr("class", "you-are-here-bg")
    .attr("x", labelX).attr("y", labelY).attr("width", labelWidth).attr("height", labelHeight);
  svg.append("text").attr("class", "you-are-here")
    .attr("x", ox).attr("y", labelY + 9).attr("text-anchor", "middle")
    .text(originLabel);
}

function renderDestinations(counters) {
  const destList = document.querySelector(".destinations-list");
  destList.replaceChildren();

  const byCountry = {};
  for (const [host, count] of Object.entries(counters.byHost || {})) {
    const geo = HOST_GEO[host];
    if (!geo) continue;
    const cc = geo.country;
    if (!byCountry[cc]) byCountry[cc] = { count: 0, maxCityCount: 0 };
    byCountry[cc].count += count;
    byCountry[cc].maxCityCount = Math.max(byCountry[cc].maxCityCount, count);
  }

  const rows = Object.entries(byCountry).sort((a, b) => b[1].count - a[1].count);
  if (rows.length === 0) {
    const note = document.createElement("span");
    note.className = "empty-note";
    note.textContent = "No outbound requests captured yet.";
    destList.appendChild(note);
    return;
  }

  for (const [cc, data] of rows) {
    const tier = tierFor(data.maxCityCount);
    const color = tierColorHex(tier);
    const item = document.createElement("span"); item.className = "dest-item";
    const swatch = document.createElement("span"); swatch.className = "swatch"; swatch.style.background = color;
    const country = document.createElement("span"); country.className = "country";
    country.textContent = COUNTRY_NAME[cc] || cc;
    const cnt = document.createElement("span"); cnt.className = "count";
    cnt.textContent = "· " + data.count.toLocaleString();
    item.append(swatch, country, cnt);
    destList.appendChild(item);
  }
}

function renderStats(counters, totalRequests) {
  const us = (counters.byCountry && counters.byCountry.US) || 0;
  const pct = totalRequests > 0 ? Math.round((us / totalRequests) * 100) : 0;
  const stats = document.querySelectorAll(".stats-row .stat");

  stats[0].querySelector(".value").textContent = `${pct}%`;
  stats[0].querySelector(".label").textContent = "Routed to USA";

  const cities = new Set();
  for (const host of Object.keys(counters.byHost || {})) {
    const g = HOST_GEO[host];
    if (g) cities.add(g.coords.join(","));
  }
  const countryCount = Object.keys(counters.byCountry || {}).length;
  stats[1].querySelector(".value").textContent = String(cities.size);
  stats[1].querySelector(".label").textContent =
    `Cities · ${countryCount} ${countryCount === 1 ? "country" : "countries"}`;

  const vendorCount = Object.keys(counters.byVendor || {}).length;
  stats[2].querySelector(".value").textContent = String(vendorCount);
  stats[2].querySelector(".label").textContent =
    vendorCount === 1 ? "AI vendor contacted" : "AI vendors contacted";
}

const BADGE_W = 600;
const BADGE_H = 750;
const STAGE_MARGIN = 32;

function fitBadge() {
  const badge = document.querySelector(".badge");
  const stage = document.querySelector(".badge-stage");
  if (!badge || !stage) return;
  const scaleW = (window.innerWidth - STAGE_MARGIN) / BADGE_W;
  const scaleH = (window.innerHeight - STAGE_MARGIN) / BADGE_H;
  const scale = Math.max(0.1, Math.min(1, scaleW, scaleH));
  badge.style.transform = `scale(${scale})`;
  stage.style.width = BADGE_W * scale + "px";
  stage.style.height = BADGE_H * scale + "px";
}

function fitHeroNumber() {
  const num = document.getElementById("hero-number");
  if (!num) return;
  const wrap = num.parentElement;
  if (!wrap) return;
  const minSize = 44;
  const adjust = () => {
    num.style.fontSize = "";
    let current = parseFloat(getComputedStyle(num).fontSize);
    let guard = 40;
    while (num.scrollWidth > wrap.clientWidth && current > minSize && guard-- > 0) {
      current -= 3;
      num.style.fontSize = current + "px";
    }
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(adjust);
  } else {
    window.addEventListener("load", adjust);
  }
  window.addEventListener("resize", adjust);
}

async function initReport() {
  const all = await chrome.storage.local.get(null);
  const isActive = all.oys_active !== false;
  const counters = all.oys_counters || defaultCounters();
  const daysActive = countDaysActive(all);
  const { score, breakdown } = computeScore(counters, daysActive);

  const punchlines = await loadPunchlines();
  const lang = "en";

  const masthead = pickRandom(punchlines.masthead?.[lang] || FALLBACK_PUNCHLINES.masthead);
  const verdict  = pickVerdict(punchlines.verdict?.[lang] || FALLBACK_PUNCHLINES.verdict, score, daysActive);
  const exposureStats = computeExposureStats(all, counters);

  const totalRequests = counters.total || 0;
  const byCountry = counters.byCountry || {};

  let mapHeadline;
  if (totalRequests === 0) {
    mapHeadline = "No outbound requests yet.";
  } else {
    const { template, nValue } = await selectMapHeadline(punchlines, counters, totalRequests);
    const countryCount = Object.keys(byCountry).length;
    mapHeadline = template
      .replace("{N}", `{em}${nValue.toLocaleString()}{/em}`)
      .replace("{C}", String(countryCount));
  }

  renderBanner(isActive, totalRequests, daysActive);
  const installDateKey = earliestEventKey(all);
  const dateline = computeDateline(daysActive, installDateKey);
  if (totalRequests === 0) {
    dateline.daysStr = "awaiting data";
  }
  renderMasthead(masthead, dateline);
  if (totalRequests === 0) {
    renderHeroEmpty();
  } else {
    renderHero(totalRequests);
    renderHeroSub(exposureStats, totalRequests);
  }
  renderScore(score, breakdown, verdict);
  renderMapHeadline(mapHeadline);
  await renderMap(counters);
  renderDestinations(counters);
  renderStats(counters, totalRequests);
  wireShareButtons(masthead);
  fitHeroNumber();
  fitBadge();
  window.addEventListener("resize", fitBadge);
}

function renderBanner(isActive, totalRequests, daysActive) {
  const el = document.getElementById("banner");
  if (!el) return;
  el.className = "banner";
  el.textContent = "";
  el.hidden = true;
  // total === 0 no longer shows a banner; the hero is replaced with a
  // dedicated empty-state message instead (see renderHeroEmpty).
  if (totalRequests > 0 && daysActive < 1) {
    el.classList.add("warning");
    el.textContent = "Less than a day of data. The report will get richer as you keep the extension on.";
    el.hidden = false;
  } else if (!isActive) {
    el.classList.add("paused");
    el.textContent = "Monitoring is currently paused. Resume from the extension icon.";
    el.hidden = false;
  }
}

// Landing page at overyourshoulder.ch is coming in phase 06.
// Share links already point there so existing shares benefit when the page goes live.
const SHARE_TARGET_URL = "https://overyourshoulder.ch";

function wireShareButtons(mastheadPunchline) {
  const downloadBtn = document.getElementById("download-btn");
  const liLink = document.getElementById("share-linkedin");
  const xLink = document.getElementById("share-x");

  if (liLink) {
    liLink.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_TARGET_URL)}`;
  }
  if (xLink) {
    const text = encodeURIComponent(mastheadPunchline);
    const url = encodeURIComponent(SHARE_TARGET_URL);
    xLink.href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    console.log("X share URL:", xLink.href);
  }
  if (downloadBtn && !downloadBtn.dataset.wired) {
    downloadBtn.dataset.wired = "1";
    downloadBtn.addEventListener("click", () => {
      downloadCard().catch((err) => {
        console.error("OYS download failed", err);
        alert('Export failed. Right-click the card and use "Save image as…" as a fallback.');
      });
    });
  }
}

/*
 * Download pipeline: serialize the .badge element into an SVG foreignObject,
 * rasterize via <img> + canvas, trigger download as PNG.
 *
 * Fonts are bundled locally (/report/fonts/) and inlined as base64 data: URLs
 * into the exported SVG's <style> block. This avoids the tainted-canvas error
 * that occurs when SVGs reference cross-origin (Google Fonts) resources, and
 * lets the PNG render in the real typefaces instead of system fallbacks.
 */
async function downloadCard() {
  const badge = document.querySelector(".badge");
  if (!badge) return;
  const btn = document.getElementById("download-btn");
  if (btn) btn.disabled = true;

  try {
    const [stylesCss, fontsCssInlined] = await Promise.all([
      fetch("styles.css").then((r) => r.text()),
      loadFontsCssWithBase64(),
    ]);

    const tokensOverride = `
      .badge {
        --bg: #FAFAF7;
        --ink: #0E0E0D;
        --ink-muted: #6B6B6A;
        --ink-soft: #A8A8A3;
        --rule: #D9D6CC;
        --rule-soft: #ECEAE2;
        --coast: #6B6B6A;
        --alarm: #B91C1C;
        --warn: #E28413;
        --heat-1: #CC9500;
        --heat-2: #E28413;
        --heat-3: #B91C1C;
        --make-volume: #2B2B2A;
        --make-cat: #BFA57A;
        --make-geo: #B91C1C;
        --make-cont: #3E5C66;
      }
      * { animation: none !important; transition: none !important; }
    `;

    // The badge is CSS-sized at 600x750 and may be visually scaled down on
    // narrow viewports via transform: scale(). Use offsetWidth/Height (which
    // return layout dimensions, unaffected by transform) so the export always
    // rasterizes at the intrinsic size regardless of current viewport scale.
    const width = badge.offsetWidth || BADGE_W;
    const height = badge.offsetHeight || BADGE_H;
    const scale = 2;

    const clone = badge.cloneNode(true);
    // The live badge is position:absolute + transform:scale(N) for the on-screen
    // stage layout. Reset both on the clone so it rasterizes at its intrinsic
    // 600x750 without shrinking into a corner of the exported canvas.
    clone.style.transform = "none";
    clone.style.position = "static";
    const shareGroup = clone.querySelector(".share-group");
    if (shareGroup) shareGroup.remove();

    const serializer = new XMLSerializer();
    const badgeHtml = serializer.serializeToString(clone);

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml">` +
      `<style>${fontsCssInlined}${stylesCss}${tokensOverride}</style>` +
      badgeHtml +
      `</div></foreignObject></svg>`;

    console.log("Serialized SVG length:", svg.length);
    console.log("First 500 chars:", svg.substring(0, 500));
    console.log("Contains fonts.googleapis:", svg.includes("fonts.googleapis"));
    console.log("Contains fonts.gstatic:", svg.includes("fonts.gstatic"));
    console.log("Contains http:", svg.match(/https?:\/\/[^\s"']+/g));

    // Use data: URL instead of blob: URL. In MV3 extensions, blob: URLs
    // loaded via <img> can be treated as cross-origin by canvas tainting
    // rules even when they come from the extension's own origin. A data:
    // URL is always treated as same-origin-equivalent for tainting.
    const svgB64 = btoa(unescape(encodeURIComponent(svg)));
    const svgUrl = "data:image/svg+xml;base64," + svgB64;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("SVG failed to load"));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FAFAF7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("toBlob returned null");

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const filename = `over-your-shoulder-${y}-${m}-${day}.png`;

    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
  } finally {
    if (btn) btn.disabled = false;
  }
}

let cachedFontsCssInlined = null;
async function loadFontsCssWithBase64() {
  if (cachedFontsCssInlined) return cachedFontsCssInlined;
  const cssText = await (await fetch("fonts.css")).text();
  const urlRe = /url\(['"]?(fonts\/[^'")]+\.woff2)['"]?\)/g;
  const paths = [...new Set([...cssText.matchAll(urlRe)].map((m) => m[1]))];
  const entries = await Promise.all(
    paths.map(async (p) => {
      const buf = await (await fetch(p)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return [p, "data:font/woff2;base64," + btoa(binary)];
    })
  );
  const dataUrls = Object.fromEntries(entries);
  cachedFontsCssInlined = cssText.replace(urlRe, (_, p) => `url('${dataUrls[p]}')`);
  return cachedFontsCssInlined;
}

initReport().catch((err) => console.error("OYS report init failed", err));
