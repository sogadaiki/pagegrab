import type { Message } from "../types";

const extractBtn = document.getElementById("extract-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

function setStatus(text: string, type: "info" | "success" | "error" = "info") {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  setStatus("Extracting...", "info");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab", "error");
    extractBtn.disabled = false;
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
    { action: "extract" },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus(
          `Error: ${chrome.runtime.lastError.message}`,
          "error"
        );
        extractBtn.disabled = false;
        return;
      }

      if (response?.success) {
        setStatus(`Saving: ${response.title}`, "info");
      } else {
        setStatus(`Error: ${response?.error ?? "Unknown"}`, "error");
        extractBtn.disabled = false;
      }
    }
  );
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
      extractBtn.disabled = false;
    }
  }
});
