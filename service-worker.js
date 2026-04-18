const OVERLAY_FILE = "a11y-overlay.js";
const BADGE_RESET_MS = 2200;

function isSupportedUrl(url) {
  return typeof url === "string" && /^(https?:|file:)/.test(url);
}

async function setBadge(tabId, text, color) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }, BADGE_RESET_MS);
}

async function injectIntoTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab available.");
  }

  if (!isSupportedUrl(tab.url)) {
    await setBadge(tab.id, "NO", "#fb7185");
    throw new Error("a11y-overlay only injects into http, https, or file URLs.");
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [OVERLAY_FILE]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.focus();
      }
    });
    await setBadge(tab.id, "ON", "#84cc16");
  } catch (error) {
    await setBadge(tab.id, "ERR", "#fb7185");
    throw error;
  }
}

async function injectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await injectIntoTab(tab);
}

chrome.action.onClicked.addListener(() => {
  injectActiveTab().catch((error) => {
    console.error("[a11y-overlay] action injection failed:", error);
  });
});
