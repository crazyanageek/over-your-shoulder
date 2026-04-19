import { computeScore } from "../lib/score.js";

const STORAGE_KEY_ACTIVE = "oys_active";
const STORAGE_KEY_COUNTERS = "oys_counters";
const EVENTS_PREFIX = "oys_events_";
const REFRESH_MS = 2000;
const MIN_EVENTS_FOR_ACTIVE_DAY = 5;

const todayEl      = document.getElementById("popup-today");
const cumulativeEl = document.getElementById("popup-cumulative");
const scoreEl      = document.getElementById("popup-score");
const verdictEl    = document.getElementById("popup-verdict");
const ringFillEl   = document.getElementById("popup-ring-fill");
const openBtn      = document.getElementById("open-report");
const toggleBtn    = document.getElementById("toggle");
const rootEl       = document.getElementById("popup-root");
const viewMain     = document.getElementById("view-main");
const viewSettings = document.getElementById("view-settings");
const gearBtn      = document.getElementById("gear-btn");
const backBtn      = document.getElementById("settings-back");
const countryPicker= document.getElementById("country-picker");
const resetBtn     = document.getElementById("reset-data-btn");

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

function ringColor(score) {
  if (score <= 20) return "#0F4C3A";
  if (score <= 40) return "#CC9500";
  if (score <= 60) return "#E28413";
  return "#B91C1C";
}

function verdictText(score, daysActive) {
  if (!daysActive) return "No signal yet";
  if (score <= 20) return "Barely exposed";
  if (score <= 40) return "Warming up";
  if (score <= 60) return "Moderate and climbing";
  if (score <= 80) return "Loud and getting louder";
  return "Shouting in all directions";
}

async function refresh() {
  const all = await chrome.storage.local.get(null);
  const isActive = all[STORAGE_KEY_ACTIVE] !== false;
  const counters = all[STORAGE_KEY_COUNTERS] || defaultCounters();
  const daysActive = countDaysActive(all);

  const todayCount = counters.todayDate === dayKey() ? (counters.today || 0) : 0;
  todayEl.textContent = todayCount === 0 ? "—" : todayCount.toLocaleString();

  const totalCount = counters.total || 0;
  cumulativeEl.textContent = totalCount === 0
    ? "— since install"
    : `${totalCount.toLocaleString()} since install`;

  const { score } = computeScore(counters, daysActive);
  scoreEl.textContent = String(score);
  verdictEl.textContent = verdictText(score, daysActive);

  const dashLen = (score * 3.27).toFixed(1);
  ringFillEl.setAttribute("stroke-dasharray", `${dashLen} 327`);
  ringFillEl.setAttribute("stroke", ringColor(score));

  toggleBtn.textContent = isActive ? "Pause" : "Resume";
  rootEl.classList.toggle("paused", !isActive);
}

openBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("report/index.html") });
});

toggleBtn.addEventListener("click", async () => {
  const data = await chrome.storage.local.get({ [STORAGE_KEY_ACTIVE]: true });
  const next = data[STORAGE_KEY_ACTIVE] === false;
  await chrome.storage.local.set({ [STORAGE_KEY_ACTIVE]: next });
  refresh();
});

function showSettings() {
  viewMain.hidden = true;
  viewSettings.hidden = false;
  rootEl.classList.add("settings-open");
}
function showMain() {
  viewSettings.hidden = true;
  viewMain.hidden = false;
  rootEl.classList.remove("settings-open");
}
gearBtn.addEventListener("click", showSettings);
backBtn.addEventListener("click", showMain);

chrome.storage.local.get({ oys_user_country: "auto" }).then((data) => {
  countryPicker.value = data.oys_user_country;
});
countryPicker.addEventListener("change", () => {
  chrome.storage.local.set({ oys_user_country: countryPicker.value });
});

resetBtn.addEventListener("click", async () => {
  const ok = window.confirm("Reset all OYS data? This cannot be undone.");
  if (!ok) return;
  await chrome.storage.local.clear();
  try {
    await chrome.runtime.sendMessage({ type: "oys_reset" });
  } catch {
    // Service worker may be asleep; it will re-init on its own.
  }
  window.close();
});

refresh();
const timer = setInterval(refresh, REFRESH_MS);
window.addEventListener("pagehide", () => clearInterval(timer));
