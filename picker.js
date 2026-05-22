/**
 * No Suggested — Element picker.
 *
 * Toggle picker mode (Alt+Shift+H or toolbar icon). Hover any feed item to
 * highlight it; click to permanently hide it. ESC to cancel.
 *
 * Stores fingerprints in chrome.storage.local so kills survive reloads.
 * The main content script (content.js) reads the same store and re-applies on scan.
 */
(function () {
  "use strict";

  const LOG = "[No Suggested picker]";
  const STORE_KEY = "no-suggested-kills";
  const LIST_ITEM_SELECTOR = '[role="listitem"]';
  const HIGHLIGHT_CLASS = "no-suggested-picker-highlight";
  const ACTIVE_CLASS = "no-suggested-picker-active";
  const TOAST_ID = "no-suggested-picker-toast";

  let active = false;
  let currentTarget = null;
  let toastTimer = null;

  function findFeedItem(el) {
    while (el && el !== document.body) {
      if (el.matches?.(LIST_ITEM_SELECTOR)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /** Pull stable identifiers from a feed item. Multiple fingerprints → tougher to evade. */
  function fingerprint(item) {
    const fp = {};

    const urnNode = item.querySelector("[data-urn]");
    const urn = urnNode?.getAttribute("data-urn") || item.getAttribute("data-urn");
    if (urn && /urn:li:(activity|ugcPost|share)/.test(urn)) {
      fp.activityUrn = urn;
    }

    const profileAnchor = item.querySelector('a[href*="/in/"], a[href*="/company/"]');
    if (profileAnchor) {
      const href = profileAnchor.getAttribute("href") || "";
      const match = href.match(/\/(in|company)\/([^/?#]+)/);
      if (match) fp.author = `${match[1]}/${match[2]}`;
    }

    if (!fp.activityUrn && !fp.author) {
      const text = (item.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (text) fp.textSnippet = text;
    }

    return fp;
  }

  function setHighlight(item) {
    if (currentTarget === item) return;
    if (currentTarget) currentTarget.classList.remove(HIGHLIGHT_CLASS);
    currentTarget = item;
    if (item) item.classList.add(HIGHLIGHT_CLASS);
  }

  function toast(html, ttl = 1800) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.setAttribute("data-visible", "1");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.removeAttribute("data-visible"), ttl);
  }

  function onMouseMove(e) {
    if (!active) return;
    const item = findFeedItem(e.target);
    setHighlight(item);
  }

  function onClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    const item = findFeedItem(e.target);
    if (!item) return;
    const fp = fingerprint(item);
    if (!fp.activityUrn && !fp.author && !fp.textSnippet) {
      toast("<strong>Couldn't fingerprint</strong> — nothing to remember by.");
      return;
    }
    saveKill(fp).then(() => {
      item.setAttribute("data-no-suggested-hidden", "1");
      const label = fp.author
        ? "by " + fp.author.replace(/^in\//, "@").replace(/^company\//, "")
        : fp.activityUrn
        ? "this post"
        : "this card";
      toast(`<strong>Nuked.</strong> Hiding ${label} on future loads.`);
    });
  }

  function onKey(e) {
    if (e.altKey && e.shiftKey && (e.key === "H" || e.key === "h")) {
      e.preventDefault();
      toggle();
      return;
    }
    if (active && e.key === "Escape") {
      e.preventDefault();
      deactivate();
    }
  }

  function activate() {
    if (active) return;
    active = true;
    document.documentElement.classList.add(ACTIVE_CLASS);
    toast("<strong>Picker on.</strong> Click a post to nuke it. ESC to cancel.", 3000);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    document.documentElement.classList.remove(ACTIVE_CLASS);
    setHighlight(null);
    toast("Picker off.", 1200);
  }

  function toggle() {
    active ? deactivate() : activate();
  }

  async function loadKills() {
    try {
      const result = await chrome.storage.local.get(STORE_KEY);
      return Array.isArray(result[STORE_KEY]) ? result[STORE_KEY] : [];
    } catch {
      return [];
    }
  }

  async function saveKill(fp) {
    const kills = await loadKills();
    kills.push({ ...fp, ts: Date.now() });
    await chrome.storage.local.set({ [STORE_KEY]: kills });
  }

  document.addEventListener("mouseover", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "no-suggested:toggle-picker") toggle();
  });

  console.log(LOG, "ready — Alt+Shift+H to toggle, or click toolbar icon");
})();
