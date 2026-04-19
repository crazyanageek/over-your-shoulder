/*
 * Phase 05.1 scaffold — minimal runtime.
 * - Print button handler (CSP forbids inline onclick, so wired from here).
 * - Populates the "generated on" fields with the current date/time so the
 *   cover and page-8 footer show real values on every open.
 *
 * Dynamic tokens inside the report body (e.g. {firstTimeToday},
 * {vendorList}) stay as literal placeholders and will be replaced in
 * phase 05.2 / 05.3 once the content layer is wired up.
 */

const printBtn = document.getElementById("print-btn");
if (printBtn) {
  printBtn.addEventListener("click", () => window.print());
}

function twoDigits(n) {
  return String(n).padStart(2, "0");
}

function formatDateLong(d) {
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatTime(d) {
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}`;
}

const now = new Date();
const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};
const dateLong = formatDateLong(now);
setText("date-generated", dateLong.toUpperCase());
setText("footer-date", dateLong);
setText("footer-time", formatTime(now));
setText("footer-year", String(now.getFullYear()));

// Chrome uses document.title as the default filename when the user picks
// "Save as PDF" in the print dialog, so set it dynamically at load time.
document.title = `Over Your Shoulder — Exposure Report — ${dateLong}`;
