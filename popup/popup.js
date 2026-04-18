const STORAGE_KEY_ACTIVE = "oys_active";
const STORAGE_KEY_COUNTERS = "oys_counters";
const EVENTS_PREFIX = "oys_events_";
const REFRESH_MS = 2000;

const todayCountEl = document.getElementById("today-count");
const sublineEl = document.getElementById("subline");
const topListEl = document.getElementById("top-list");
const statusEl = document.getElementById("status");
const statusTextEl = statusEl.querySelector(".status-text");
const toggleBtn = document.getElementById("toggle");

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function defaultCounters() {
  return { total: 0, today: 0, todayDate: dayKey(), byHost: {}, byCategory: {} };
}

async function refresh() {
  const todayKey = EVENTS_PREFIX + dayKey();
  const data = await chrome.storage.local.get({
    [STORAGE_KEY_ACTIVE]: true,
    [STORAGE_KEY_COUNTERS]: defaultCounters(),
    [todayKey]: [],
  });

  const isActive = data[STORAGE_KEY_ACTIVE] !== false;
  const counters = data[STORAGE_KEY_COUNTERS] || defaultCounters();
  const todayEvents = Array.isArray(data[todayKey]) ? data[todayKey] : [];

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
