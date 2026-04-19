import { computeScore } from "../lib/score.js";

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
  heroSub: ["You didn't authorize most of these. They went out anyway."],
  mapHeadline: {
    usDominant: ["Your data crossed the Atlantic {N} times today."],
    neutral:    ["{N} transmissions left this laptop today."],
  },
  verdict: {
    low:       { lines: ["Barely exposed"] },
    mild:      { lines: ["Warming up"] },
    moderate:  { lines: ["Moderate & climbing"] },
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

function computeDateline(daysActive) {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const dateStr = `${weekday} ${day} ${month}`;
  const daysStr = daysActive === 1 ? "1 day of data" : `${daysActive} days of data`;
  return { dateStr, daysStr };
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

function renderHeroSub(line, total) {
  const el = document.querySelector(".hero-sub");
  el.replaceChildren();
  const caption = document.createElement("span");
  caption.className = "caption-label";
  caption.textContent = "Requests your browser sent to AI servers today";
  el.appendChild(caption);
  const text = total === 0 ? "No data yet. Come back tomorrow." : line;
  el.appendChild(document.createTextNode(text));
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

  const origin = [6.63, 46.52];
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
  destinations.forEach((d) => {
    const interp = d3.geoInterpolate(origin, d.coords);
    const steps = 48;
    const lifted = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = interp(t);
      const lift = Math.sin(t * Math.PI) * 18;
      const [px, py] = projection(p);
      lifted.push([px, py - lift]);
    }
    const line = d3.line().curve(d3.curveBasis);
    let strokeWidth, opacity;
    if (d.tier === 3)      { strokeWidth = 2.6; opacity = 0.92; }
    else if (d.tier === 2) { strokeWidth = 1.9; opacity = 0.9;  }
    else                   { strokeWidth = 1.5; opacity = 0.9;  }
    arcLayer.append("path").attr("class", "arc").attr("d", line(lifted))
      .attr("stroke", d.color).attr("stroke-width", strokeWidth).attr("opacity", opacity);
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

  const labelWidth = 78, labelHeight = 13;
  const labelX = ox - labelWidth / 2;
  const labelY = oy + 14;
  svg.append("rect").attr("class", "you-are-here-bg")
    .attr("x", labelX).attr("y", labelY).attr("width", labelWidth).attr("height", labelHeight);
  svg.append("text").attr("class", "you-are-here")
    .attr("x", ox).attr("y", labelY + 9).attr("text-anchor", "middle")
    .text("YOU ARE HERE");
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
  stats[2].querySelector(".label").textContent = vendorCount === 1 ? "AI vendor" : "AI vendors";
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
  const counters = all.oys_counters || defaultCounters();
  const daysActive = countDaysActive(all);
  const { score, breakdown } = computeScore(counters, daysActive);

  const punchlines = await loadPunchlines();
  const lang = "en";

  const masthead  = pickRandom(punchlines.masthead?.[lang]  || FALLBACK_PUNCHLINES.masthead);
  const heroSub   = pickRandom(punchlines.heroSub?.[lang]   || FALLBACK_PUNCHLINES.heroSub);
  const verdict   = pickVerdict(punchlines.verdict?.[lang]  || FALLBACK_PUNCHLINES.verdict, score, daysActive);

  const totalRequests = counters.total || 0;
  const byCountry = counters.byCountry || {};
  const usTotal = byCountry.US || 0;
  const usShare = totalRequests > 0 ? usTotal / totalRequests : 0;
  const usDominant = usShare >= 0.8 && totalRequests > 0;

  const mapTemplate = usDominant
    ? pickRandom(punchlines.mapHeadline?.[lang]?.usDominant || FALLBACK_PUNCHLINES.mapHeadline.usDominant)
    : pickRandom(punchlines.mapHeadline?.[lang]?.neutral    || FALLBACK_PUNCHLINES.mapHeadline.neutral);
  const countryCount = Object.keys(byCountry).length;
  const nValue = usDominant ? usTotal : totalRequests;
  let mapHeadline;
  if (totalRequests === 0) {
    mapHeadline = "No outbound requests yet.";
  } else {
    mapHeadline = mapTemplate
      .replace("{N}", `{em}${nValue.toLocaleString()}{/em}`)
      .replace("{C}", String(countryCount));
  }

  renderMasthead(masthead, computeDateline(daysActive));
  renderHero(totalRequests);
  renderHeroSub(heroSub, totalRequests);
  renderScore(score, breakdown, verdict);
  renderMapHeadline(mapHeadline);
  await renderMap(counters);
  renderDestinations(counters);
  renderStats(counters, totalRequests);
  fitHeroNumber();
}

initReport().catch((err) => console.error("OYS report init failed", err));
