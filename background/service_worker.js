console.log("OYS service worker loaded");

const STORAGE_KEY_ACTIVE = "oys_active";
const STORAGE_KEY_COUNTERS = "oys_counters";
const EVENTS_PREFIX = "oys_events_";

const RING_LIMIT = 5000;
const FLUSH_BATCH = 100;
const FLUSH_PERIOD_MINUTES = 0.5;
const RETENTION_DAYS = 30;
const PATHNAME_LIMIT = 50;
const FLUSH_ALARM = "oys-flush";

const domains = new Set();
const categoryByDomain = new Map();
const pending = new Map();
let ringBuffer = [];
let active = true;
let ready = false;
let flushing = false;

init();

async function init() {
  try {
    const resp = await fetch(chrome.runtime.getURL("data/endpoints.json"));
    const endpoints = await resp.json();
    for (const ep of endpoints) {
      domains.add(ep.domain);
      categoryByDomain.set(ep.domain, ep.category);
    }
    const stored = await chrome.storage.local.get({
      [STORAGE_KEY_ACTIVE]: true,
      [STORAGE_KEY_COUNTERS]: defaultCounters(),
    });
    active = stored[STORAGE_KEY_ACTIVE] !== false;
  } catch (err) {
    console.error("OYS init failed", err);
  } finally {
    ready = true;
  }
}

function defaultCounters() {
  return {
    total: 0,
    today: 0,
    todayDate: dayKey(),
    byHost: {},
    byCategory: {},
  };
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function contentLengthFrom(headers) {
  if (!Array.isArray(headers)) return null;
  for (const h of headers) {
    if (h && h.name && h.name.toLowerCase() === "content-length") {
      const n = parseInt(h.value, 10);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!ready || !active) return;
    const host = hostOf(details.url);
    if (!host || !domains.has(host)) return;

    let pathname = "";
    try {
      pathname = new URL(details.url).pathname;
    } catch {}

    const event = {
      requestId: details.requestId,
      timestamp: Date.now(),
      hostname: host,
      category: categoryByDomain.get(host) || null,
      pathname: pathname.slice(0, PATHNAME_LIMIT),
      tabId: typeof details.tabId === "number" ? details.tabId : -1,
      initiator: hostOf(details.initiator),
      requestSize: contentLengthFrom(details.requestHeaders),
      statusCode: null,
      responseSize: null,
    };

    ringBuffer.push(event);
    while (ringBuffer.length > RING_LIMIT) ringBuffer.shift();
    pending.set(details.requestId, event);

    if (ringBuffer.length >= FLUSH_BATCH) flush();
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!ready) return;
    const ev = pending.get(details.requestId);
    if (!ev) return;
    ev.statusCode = typeof details.statusCode === "number" ? details.statusCode : null;
    ev.responseSize = contentLengthFrom(details.responseHeaders);
    pending.delete(details.requestId);
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) flush();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const change = changes[STORAGE_KEY_ACTIVE];
  if (!change) return;
  const next = change.newValue !== false;
  if (active !== next) {
    active = next;
    console.log(`OYS ${next ? "resumed" : "paused"}`);
  }
});

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    if (ringBuffer.length === 0) {
      await rotate();
      return;
    }
    const batch = ringBuffer;
    ringBuffer = [];

    const byDate = new Map();
    for (const ev of batch) {
      const key = EVENTS_PREFIX + dayKey(ev.timestamp);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(ev);
    }

    const readKeys = [STORAGE_KEY_COUNTERS, ...byDate.keys()];
    const stored = await chrome.storage.local.get(readKeys);
    const counters = stored[STORAGE_KEY_COUNTERS] || defaultCounters();

    const curDay = dayKey();
    if (counters.todayDate !== curDay) {
      counters.today = 0;
      counters.todayDate = curDay;
    }
    counters.byHost = counters.byHost || {};
    counters.byCategory = counters.byCategory || {};

    for (const ev of batch) {
      counters.total += 1;
      if (dayKey(ev.timestamp) === curDay) counters.today += 1;
      counters.byHost[ev.hostname] = (counters.byHost[ev.hostname] || 0) + 1;
      if (ev.category) {
        counters.byCategory[ev.category] = (counters.byCategory[ev.category] || 0) + 1;
      }
    }

    const writes = { [STORAGE_KEY_COUNTERS]: counters };
    for (const [key, evs] of byDate) {
      const existing = Array.isArray(stored[key]) ? stored[key] : [];
      writes[key] = existing.concat(evs);
    }
    await chrome.storage.local.set(writes);
    await rotate();
  } catch (err) {
    console.error("OYS flush failed", err);
  } finally {
    flushing = false;
  }
}

async function rotate() {
  const all = await chrome.storage.local.get(null);
  const cutoff = Date.now() - RETENTION_DAYS * 86400 * 1000;
  const stale = [];
  for (const key of Object.keys(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    const part = key.slice(EVENTS_PREFIX.length);
    if (part.length !== 8) continue;
    const y = parseInt(part.slice(0, 4), 10);
    const m = parseInt(part.slice(4, 6), 10);
    const d = parseInt(part.slice(6, 8), 10);
    if (!y || !m || !d) continue;
    const ts = new Date(y, m - 1, d).getTime();
    if (Number.isFinite(ts) && ts < cutoff) stale.push(key);
  }
  if (stale.length) await chrome.storage.local.remove(stale);
}
