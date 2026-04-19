const SUPPORTED = ["CN", "FR", "DE", "CH", "GB", "US"];

const TZ_MAP = {
  "Europe/Zurich": "CH",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Frankfurt": "DE",
  "Europe/Munich": "DE",
  "Europe/London": "GB",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "Asia/Shanghai": "CN",
  "Asia/Beijing": "CN",
  "Asia/Hong_Kong": "CN",
  "Asia/Chongqing": "CN",
  "Asia/Urumqi": "CN",
};

export async function detectUserCountry() {
  try {
    const stored = await chrome.storage.local.get({ oys_user_country: "auto" });
    const pref = stored.oys_user_country;
    if (pref === "OTHER") return "OTHER";
    if (typeof pref === "string" && SUPPORTED.includes(pref)) return pref;
    // pref is "auto" (default) or missing — fall through to auto-detection
  } catch {
    // storage unavailable — proceed with heuristics
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_MAP[tz]) return TZ_MAP[tz];
  } catch {
    // Intl API not available — skip
  }

  const lang = (typeof navigator !== "undefined" && navigator.language) || "";
  const match = lang.match(/-([A-Za-z]{2})$/);
  if (match) {
    const code = match[1].toUpperCase();
    if (SUPPORTED.includes(code)) return code;
  }

  return null;
}
