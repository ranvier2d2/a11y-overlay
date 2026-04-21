const LOAD_EXPORT_CAPTURE_MESSAGE = "a11y-overlay-load-export-capture";
const exportToken = new URLSearchParams(window.location.search).get("token") || "";

let currentCapture = null;
let loadInFlight = false;

const els = {
  closeButton: document.getElementById("closeButton"),
  copyButton: document.getElementById("copyButton"),
  filenameLabel: document.getElementById("filenameLabel"),
  placeholder: document.getElementById("placeholder"),
  previewImage: document.getElementById("previewImage"),
  refreshButton: document.getElementById("refreshButton"),
  saveButton: document.getElementById("saveButton"),
  sourceLabel: document.getElementById("sourceLabel"),
  statusText: document.getElementById("statusText")
};

function setStatus(message, tone = "muted") {
  els.statusText.className = `status${tone === "muted" ? "" : ` ${tone}`}`;
  els.statusText.textContent = message;
}

function setButtonsEnabled(enabled) {
  els.copyButton.disabled = !enabled;
  els.saveButton.disabled = !enabled;
}

function describeSource(url) {
  try {
    if (!url) {
      return "Current page";
    }
    const parsed = new URL(url);
    return parsed.protocol === "file:" ? "Local file" : parsed.host;
  } catch (_error) {
    return "Current page";
  }
}

function formatUiError(error) {
  const message = error && error.message ? error.message : String(error);
  if (/No recent export is ready/i.test(message)) {
    return "Run Copy PNG from the overlay again.";
  }
  if (/Extension context invalidated/i.test(message)) {
    return "The extension reloaded. Reopen Copy PNG from the overlay.";
  }
  if (/ClipboardItem is unavailable|NotAllowedError|Document is not focused|Permission denied/i.test(message)) {
    return "Clipboard copy is blocked in this browser state. Use Save PNG instead.";
  }
  return message;
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function applyCapture(capture) {
  currentCapture = capture;
  els.previewImage.src = capture.dataUrl;
  els.previewImage.hidden = false;
  els.placeholder.hidden = true;
  els.sourceLabel.textContent = `Source: ${describeSource(capture.sourceUrl)}`;
  els.filenameLabel.textContent = `File: ${capture.filename}`;
  setButtonsEnabled(true);
}

async function loadCapture() {
  if (loadInFlight) return;
  loadInFlight = true;
  currentCapture = null;
  setButtonsEnabled(false);
  els.previewImage.hidden = true;
  els.placeholder.hidden = false;
  els.placeholder.textContent = "Preparing the latest viewport capture…";
  setStatus("Capturing the latest viewport…");

  try {
    const response = await chrome.runtime.sendMessage({
      type: LOAD_EXPORT_CAPTURE_MESSAGE,
      token: exportToken
    });

    if (!response || !response.ok || !response.dataUrl) {
      throw new Error(response && response.error ? response.error : "Capture failed.");
    }

    applyCapture(response);
    setStatus("Ready to copy or save this viewport.", "success");
    els.copyButton.focus();
  } catch (error) {
    els.placeholder.textContent = "No capture is ready yet.";
    setStatus(formatUiError(error), "error");
  } finally {
    loadInFlight = false;
  }
}

async function copyCapture() {
  if (!currentCapture || els.copyButton.disabled) return;
  els.copyButton.disabled = true;
  setStatus("Writing PNG to the clipboard…");

  try {
    if (typeof ClipboardItem !== "function") {
      throw new Error("ClipboardItem is unavailable.");
    }
    const blob = await dataUrlToBlob(currentCapture.dataUrl);
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type || "image/png"]: blob
      })
    ]);
    setStatus("PNG copied to clipboard.", "success");
  } catch (error) {
    setStatus(formatUiError(error), "error");
  } finally {
    els.copyButton.disabled = false;
  }
}

async function saveCapture() {
  if (!currentCapture || els.saveButton.disabled) return;
  els.saveButton.disabled = true;
  setStatus("Opening the save dialog…");

  try {
    await chrome.downloads.download({
      filename: currentCapture.filename,
      saveAs: true,
      url: currentCapture.dataUrl
    });
    setStatus("PNG save dialog opened.", "success");
  } catch (error) {
    setStatus(formatUiError(error), "error");
  } finally {
    els.saveButton.disabled = false;
  }
}

els.copyButton.addEventListener("click", () => {
  copyCapture();
});

els.saveButton.addEventListener("click", () => {
  saveCapture();
});

els.refreshButton.addEventListener("click", () => {
  loadCapture();
});

els.closeButton.addEventListener("click", () => {
  window.close();
});

window.addEventListener("DOMContentLoaded", () => {
  window.focus();
  loadCapture();
});
