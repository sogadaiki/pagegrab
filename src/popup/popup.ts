import type { Message, ScreenshotMessage } from "../types";

const extractBtn = document.getElementById("extract-btn") as HTMLButtonElement;
const analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
const designSystemBtn = document.getElementById("design-system-btn") as HTMLButtonElement;
const pickComponentBtn = document.getElementById("pick-component-btn") as HTMLButtonElement;
const visibleScreenshotBtn = document.getElementById("visible-screenshot-btn") as HTMLButtonElement;
const fullScreenshotBtn = document.getElementById("full-screenshot-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const versionLabel = document.getElementById("version-label") as HTMLSpanElement;

versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;

function setStatus(text: string, type: "info" | "success" | "error" = "info") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

function setButtonsDisabled(disabled: boolean) {
  extractBtn.disabled = disabled;
  analyzeBtn.disabled = disabled;
  designSystemBtn.disabled = disabled;
  pickComponentBtn.disabled = disabled;
  visibleScreenshotBtn.disabled = disabled;
  fullScreenshotBtn.disabled = disabled;
}

async function injectAndSendAction(action: "extract" | "analyze" | "design-system" | "pick-component", statusText: string) {
  setButtonsDisabled(true);
  setStatus(statusText, "info");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab", "error");
    setButtonsDisabled(false);
    return;
  }

  // Inject content script on demand (in case it wasn't loaded)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch {
    // Content script may already be injected, ignore error
  }

  chrome.tabs.sendMessage(
    tab.id,
    { action },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus(
          `Error: ${chrome.runtime.lastError.message}`,
          "error"
        );
        setButtonsDisabled(false);
        return;
      }

      if (response?.success) {
        setStatus(`Saving: ${response.title}`, "info");
      } else {
        setStatus(`Error: ${response?.error ?? "Unknown"}`, "error");
        setButtonsDisabled(false);
      }
    }
  );
}

extractBtn.addEventListener("click", () => {
  injectAndSendAction("extract", "Extracting...");
});

analyzeBtn.addEventListener("click", () => {
  injectAndSendAction("analyze", "Analyzing LP...");
});

designSystemBtn.addEventListener("click", () => {
  injectAndSendAction("design-system", "Extracting Design System...");
});

pickComponentBtn.addEventListener("click", () => {
  injectAndSendAction("pick-component", "Click an element to extract...");
});

async function captureScreenshot(mode: ScreenshotMessage["mode"], statusText: string) {
  setButtonsDisabled(true);
  setStatus(statusText, "info");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    setStatus("No active tab", "error");
    setButtonsDisabled(false);
    return;
  }

  // Screenshot goes directly to service-worker (no content script needed)
  const msg: ScreenshotMessage = { action: "screenshot", tabId: tab.id, url: tab.url, mode };
  chrome.runtime.sendMessage(msg, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(`Error: ${chrome.runtime.lastError.message}`, "error");
      setButtonsDisabled(false);
      return;
    }
    if (response?.success) {
      setStatus(`Saved: ${response.filename}`, "success");
      setButtonsDisabled(false);
    } else {
      setStatus(`Error: ${response?.error ?? "Unknown"}`, "error");
      setButtonsDisabled(false);
    }
  });
}

visibleScreenshotBtn.addEventListener("click", () => {
  captureScreenshot("visible", "Capturing visible screenshot...");
});

fullScreenshotBtn.addEventListener("click", () => {
  captureScreenshot("full-page", "Capturing full-page screenshot...");
});

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.action === "status") {
    const type = message.status === "done"
      ? "success"
      : message.status === "error"
        ? "error"
        : "info";
    setStatus(message.message, type);
    if (message.status === "done" || message.status === "error") {
      setButtonsDisabled(false);
    }
  }
});
