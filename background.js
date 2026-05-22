/**
 * Background service worker.
 *
 *  - Updates the toolbar badge with the number of hidden posts on each tab.
 *  - Relays the keyboard shortcut (Alt+Shift+H) into the active LinkedIn tab.
 *
 * Toolbar icon clicks open the popup directly (configured via the action's
 * default_popup in the manifest), so we no longer dispatch a picker toggle
 * from a chrome.action.onClicked listener.
 */
const TARGET_MATCH = /^https:\/\/www\.linkedin\.com\//;
const BADGE_ON = "#ef4444";
const BADGE_OFF = "#6b7280";

async function setBadgeForTab(tabId, count, enabled) {
  try {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: enabled ? BADGE_ON : BADGE_OFF,
    });
    const text = !enabled ? "off" : count > 0 ? formatBadge(count) : "";
    await chrome.action.setBadgeText({ tabId, text });
  } catch {
    // tab may have closed; ignore.
  }
}

function formatBadge(n) {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== "no-suggested:badge") return;
  if (!sender.tab?.id) return;
  setBadgeForTab(sender.tab.id, msg.count || 0, msg.enabled !== false);
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-picker") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !TARGET_MATCH.test(tab.url || "")) return;
  chrome.tabs.sendMessage(tab.id, { type: "no-suggested:toggle-picker" }).catch(() => {});
});
