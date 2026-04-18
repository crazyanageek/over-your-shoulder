import { computeScore } from "../lib/score.js";

const STORAGE_KEY_ACTIVE = "oys_active";
const STORAGE_KEY_COUNTERS = "oys_counters";
const EVENTS_PREFIX = "oys_events_";
const REFRESH_MS = 2000;
const BAR_WIDTH = 10;
const MIN_EVENTS_FOR_ACTIVE_DAY = 5;

const BAR_MAX = {
  volume: 30,
  categoryDiversity: 30,
  geoExposure: 25,
  continuity: 15,
};

const todayCountEl = document.getElementById("today-count");
const sublineEl = document.getElementById("subline");
const topListEl = document.getElementById("top-list");
const statusEl = document.getElementById("status");
const statusTextEl = statusEl.querySelector(".status-text");
const toggleBtn = document.getElementById("toggle");
const scoreSectionEl = document.getElementById("score-section");
const scoreValueEl = document.getElementById("score-value");
const scoreLabelEl = document.getElementById("score-label");
const scoreBarsEl = document.getElementById("score-bars");

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function defaultCounters() {
  return {
    total: 0,
    today: 0,
    todayDate: dayKey(),
    byHost: {},
    byCategory: {},
    byCountry: {},
    byVendor: {},
    bySourceCategory: {},
  };
}

function unicodeBar(value, max) {
  if (!Number.isFinite(value) || max <= 0) return "░".repeat(BAR_WIDTH);
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((value / max) * BAR_WIDTH)));
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function scoreBand(score) {
  if (score <= 30) return "green";
  if (score <= 60) return "amber";
  return "red";
}

function scoreLabelText(score) {
  if (score <= 30) return "Exposition faible";
  if (score <= 60) return "Exposition modérée";
  return "Exposition élevée";
}

function countDaysActive(all) {
  let count = 0;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(EVENTS_PREFIX)) continue;
    if (Array.isArray(value) && value.length >= MIN_EVENTS_FOR_ACTIVE_DAY) count++;
  }
  return count;
}

async function refresh() {
  const all = await chrome.storage.local.get(null);
  const isActive = all[STORAGE_KEY_ACTIVE] !== false;
  const counters = all[STORAGE_KEY_COUNTERS] || defaultCounters();
  const todayEvents = Array.isArray(all[EVENTS_PREFIX + dayKey()])
    ? all[EVENTS_PREFIX + dayKey()]
    : [];
  const daysActive = countDaysActive(all);

  const todayDisplay =
    counters.todayDate === dayKey() ? counters.today : todayEvents.length;
  todayCountEl.textContent = todayDisplay.toLocaleString();

  const totalRequests = counters.total || 0;
  const endpointCount = Object.keys(counters.byHost || {}).length;
  sublineEl.textContent = `${totalRequests.toLocaleString()} requests total, across ${endpointCount} endpoint${
    endpointCount === 1 ? "" : "s"
  }`;

  const todayByHost = {};
  for (const ev of todayEvents) {
    if (!ev || !ev.hostname) continue;
    todayByHost[ev.hostname] = (todayByHost[ev.hostname] || 0) + 1;
  }
  const top = Object.entries(todayByHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  topListEl.replaceChildren();
  if (top.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No requests captured yet today";
    topListEl.appendChild(li);
  } else {
    for (const [host, count] of top) {
      const li = document.createElement("li");
      const nameEl = document.createElement("span");
      nameEl.className = "host";
      nameEl.textContent = host;
      const countEl = document.createElement("span");
      countEl.className = "count";
      countEl.textContent = count.toLocaleString();
      li.append(nameEl, countEl);
      topListEl.appendChild(li);
    }
  }

  const { score, breakdown } = computeScore(counters, daysActive);
  scoreValueEl.textContent = String(score);
  scoreSectionEl.classList.remove("green", "amber", "red");
  scoreSectionEl.classList.add(scoreBand(score));
  scoreLabelEl.textContent = scoreLabelText(score);

  for (const li of scoreBarsEl.querySelectorAll("li")) {
    const factor = li.dataset.factor;
    const val = breakdown[factor] ?? 0;
    const max = BAR_MAX[factor];
    li.querySelector(".bar").textContent = unicodeBar(val, max);
    const display = Number.isInteger(val) ? val : val.toFixed(1);
    li.querySelector(".val").textContent = `${display}/${max}`;
  }

  statusEl.classList.toggle("active", isActive);
  statusEl.classList.toggle("paused", !isActive);
  statusTextEl.textContent = isActive ? "Monitoring active" : "Paused";
  toggleBtn.textContent = isActive ? "Pause" : "Resume";
}

toggleBtn.addEventListener("click", async () => {
  const data = await chrome.storage.local.get({ [STORAGE_KEY_ACTIVE]: true });
  const next = data[STORAGE_KEY_ACTIVE] === false;
  await chrome.storage.local.set({ [STORAGE_KEY_ACTIVE]: next });
  refresh();
});

refresh();
const timer = setInterval(refresh, REFRESH_MS);
window.addEventListener("pagehide", () => clearInterval(timer));
