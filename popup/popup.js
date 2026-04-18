const STORAGE_KEY = "oys_active";

const toggleButton = document.getElementById("toggle");
const subtitle = document.getElementById("subtitle");

function render(active) {
  toggleButton.textContent = active ? "Pause" : "Resume";
  subtitle.textContent = active ? "Monitoring active" : "Monitoring paused";
}

chrome.storage.local.get({ [STORAGE_KEY]: true }, (result) => {
  render(result[STORAGE_KEY]);
});

toggleButton.addEventListener("click", () => {
  chrome.storage.local.get({ [STORAGE_KEY]: true }, (result) => {
    const next = !result[STORAGE_KEY];
    chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
      render(next);
    });
  });
});
