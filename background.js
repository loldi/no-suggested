/** Tiny service worker: toolbar icon and keyboard command both forward
 *  a "toggle picker" message to the active LinkedIn tab. */
const TARGET_MATCH = /^https:\/\/www\.linkedin\.com\//;

function send(tab) {
  if (!tab?.id || !TARGET_MATCH.test(tab.url || "")) return;
  chrome.tabs.sendMessage(tab.id, { type: "no-suggested:toggle-picker" }).catch(() => {});
}

chrome.action?.onClicked.addListener(send);

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "toggle-picker") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  send(tab);
});
