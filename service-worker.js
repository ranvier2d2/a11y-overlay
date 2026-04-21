const OVERLAY_FILE = "a11y-overlay.js";
const BADGE_RESET_MS = 2200;
const EXPORT_MESSAGE = "a11y-overlay-export-png";
const OPEN_EXPORT_WINDOW_MESSAGE = "a11y-overlay-open-export-window";
const LOAD_EXPORT_CAPTURE_MESSAGE = "a11y-overlay-load-export-capture";
const GET_VIEWPORT_CAPTURE_MESSAGE = "a11y-overlay-get-viewport-capture";
const EXPORT_PAGE = "export.html";
const EXPORT_CONTEXT_PREFIX = "pendingExportContext::";
const EXPORT_CONTEXT_TTL_MS = 5 * 60 * 1000;

function isSupportedUrl(url) {
  return typeof url === "string" && /^(https?:|file:)/.test(url);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function slugify(value, fallback) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildExportFilename(tabLike) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("") + "-" + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");

  let host = "page";
  try {
    if (tabLike && tabLike.url) {
      const parsed = new URL(tabLike.url);
      host = parsed.protocol === "file:" ? "local-file" : slugify(parsed.hostname, "page");
    }
  } catch (_error) {
    host = "page";
  }

  return `a11y-overlay-${host}-${stamp}.png`;
}

function buildExportContext(tab, dataUrl) {
  return {
    createdAt: Date.now(),
    dataUrl,
    filename: buildExportFilename(tab),
    tabId: tab.id,
    url: tab.url || "",
    windowId: tab.windowId
  };
}

function createExportToken() {
  if (typeof crypto === "object" && crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function exportContextStorageKey(token) {
  return `${EXPORT_CONTEXT_PREFIX}${token}`;
}

async function setPendingExportContext(token, context) {
  await pruneExpiredExportContexts();
  await chrome.storage.session.set({
    [exportContextStorageKey(token)]: context
  });
}

async function getPendingExportContext(token) {
  if (!token) return null;
  const key = exportContextStorageKey(token);
  const stored = await chrome.storage.session.get(key);
  return stored[key] || null;
}

async function removePendingExportContext(token) {
  if (!token) return;
  await chrome.storage.session.remove(exportContextStorageKey(token));
}

async function pruneExpiredExportContexts(now = Date.now()) {
  const stored = await chrome.storage.session.get(null);
  const expiredKeys = Object.entries(stored || {})
    .filter(([key, context]) => (
      key.startsWith(EXPORT_CONTEXT_PREFIX) &&
      (
        !context ||
        typeof context.createdAt !== "number" ||
        (now - context.createdAt) > EXPORT_CONTEXT_TTL_MS
      )
    ))
    .map(([key]) => key);
  if (expiredKeys.length) {
    await chrome.storage.session.remove(expiredKeys);
  }
}

function isFreshExportContext(context) {
  return !!(
    context &&
    typeof context.windowId === "number" &&
    typeof context.dataUrl === "string" &&
    typeof context.filename === "string" &&
    typeof context.createdAt === "number" &&
    (Date.now() - context.createdAt) <= EXPORT_CONTEXT_TTL_MS
  );
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
      world: "ISOLATED",
      files: [OVERLAY_FILE]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
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

async function handleDownloadRequest(message, sender) {
  const tab = sender && sender.tab;
  if (!tab || typeof tab.windowId !== "number") {
    throw new Error("No active tab is available for export.");
  }

  if (message.target !== "download") {
    throw new Error(`Unsupported export target: ${message.target}`);
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const filename = buildExportFilename(tab);
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: true
  });
  return { ok: true, target: "download", filename, downloadId };
}

async function handleOpenExportWindow(sender) {
  const tab = sender && sender.tab;
  if (!tab || typeof tab.id !== "number" || typeof tab.windowId !== "number") {
    throw new Error("No active tab is available for copy export.");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const token = createExportToken();
  await setPendingExportContext(token, buildExportContext(tab, dataUrl));
  await chrome.windows.create({
    focused: true,
    height: 720,
    type: "popup",
    url: chrome.runtime.getURL(`${EXPORT_PAGE}?token=${encodeURIComponent(token)}&ts=${Date.now()}`),
    width: 540
  });

  return { ok: true };
}

async function handleLoadExportCapture(message) {
  const token = message && message.token;
  const context = await getPendingExportContext(token);
  if (!isFreshExportContext(context)) {
    await removePendingExportContext(token);
    throw new Error("No recent export is ready. Run Copy PNG from the overlay again.");
  }

  await removePendingExportContext(token);
  return {
    ok: true,
    dataUrl: context.dataUrl,
    filename: context.filename,
    sourceUrl: context.url || ""
  };
}

async function handleViewportCapture(sender) {
  const tab = sender && sender.tab;
  if (!tab || typeof tab.windowId !== "number") {
    throw new Error("No active tab is available for capture.");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return {
    ok: true,
    dataUrl,
    filename: buildExportFilename(tab),
    sourceUrl: tab.url || ""
  };
}

chrome.action.onClicked.addListener((tab) => {
  const run = tab ? injectIntoTab(tab) : injectActiveTab();
  run.catch((error) => {
    console.error("[a11y-overlay] action injection failed:", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let task = null;

  if (message && message.type === EXPORT_MESSAGE) {
    task = handleDownloadRequest(message, sender);
  } else if (message && message.type === OPEN_EXPORT_WINDOW_MESSAGE) {
    task = handleOpenExportWindow(sender);
  } else if (message && message.type === LOAD_EXPORT_CAPTURE_MESSAGE) {
    task = handleLoadExportCapture(message);
  } else if (message && message.type === GET_VIEWPORT_CAPTURE_MESSAGE) {
    task = handleViewportCapture(sender);
  }

  if (!task) {
    return undefined;
  }

  task.then((response) => {
    sendResponse(response);
  }).catch((error) => {
    sendResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  });

  return true;
});
