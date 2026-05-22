/**
 * No Suggested — hides LinkedIn "Suggested" feed cards (and any cards the
 * user manually nuked via the picker).
 *
 * Perf notes (cribbed from uBlock Origin):
 *  - Hiding is done by CSS (hide.css) keyed off a data-attribute. JS only sets the attribute.
 *  - Mutation handler bails out the moment it sees no added element nodes.
 *  - Scans use querySelectorAll, never TreeWalker or qSA("*").
 *  - Processed list items live in a WeakSet so we never re-check them.
 *  - Mutation bursts are coalesced into one scan per animation frame.
 *  - User-nuked items are matched by stable fingerprints (urn / author / text).
 */
(function () {
  "use strict";

  const VERSION = "1.0.0";
  const LOG = "[No Suggested]";
  const HIDDEN_ATTR = "data-no-suggested-hidden";
  const DEBUG_KEY = "no-suggested-debug";
  const STORE_KEY = "no-suggested-kills";

  const SUGGESTED_TEXT = new Set([
    "Suggested",
    "Suggested for you",
    "Suggested post",
  ]);

  const LIST_ITEM_SELECTOR = '[role="listitem"]';
  let seen = new WeakSet();
  const pending = new Set();
  let scanScheduled = false;
  let totalHidden = 0;
  let kills = [];

  function isDebug() {
    try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch { return false; }
  }

  function debug(...args) {
    if (isDebug()) console.log(LOG, ...args);
  }

  function isSuggested(item) {
    const text = item.textContent;
    if (!text || !text.includes("Suggested")) return false;
    const spans = item.querySelectorAll("span, h2, h3");
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      if (span.children.length !== 0) continue;
      const t = span.textContent.trim();
      if (SUGGESTED_TEXT.has(t)) return true;
    }
    return false;
  }

  function authorOf(item) {
    const a = item.querySelector('a[href*="/in/"], a[href*="/company/"]');
    if (!a) return null;
    const m = (a.getAttribute("href") || "").match(/\/(in|company)\/([^/?#]+)/);
    return m ? `${m[1]}/${m[2]}` : null;
  }

  function urnOf(item) {
    const n = item.querySelector("[data-urn]");
    return n?.getAttribute("data-urn") || item.getAttribute("data-urn") || null;
  }

  function snippetOf(item) {
    return (item.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  /** Does this item match any user-nuked fingerprint? */
  function matchesKill(item) {
    if (!kills.length) return false;
    const urn = urnOf(item);
    const author = authorOf(item);
    let snippet = null;
    for (let i = 0; i < kills.length; i++) {
      const k = kills[i];
      if (k.activityUrn && urn === k.activityUrn) return true;
      if (k.author && author === k.author) return true;
      if (k.textSnippet) {
        if (snippet === null) snippet = snippetOf(item);
        if (snippet && snippet.startsWith(k.textSnippet.slice(0, 60))) return true;
      }
    }
    return false;
  }

  function hide(item) {
    if (item.getAttribute(HIDDEN_ATTR) === "1") return false;
    item.setAttribute(HIDDEN_ATTR, "1");
    item.setAttribute("aria-hidden", "true");
    totalHidden++;
    return true;
  }

  function scan(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return 0;
    const items = root.matches?.(LIST_ITEM_SELECTOR)
      ? [root, ...root.querySelectorAll(LIST_ITEM_SELECTOR)]
      : root.querySelectorAll(LIST_ITEM_SELECTOR);
    let hidden = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (seen.has(item)) continue;
      seen.add(item);
      if ((isSuggested(item) || matchesKill(item)) && hide(item)) hidden++;
    }
    return hidden;
  }

  function runPending() {
    scanScheduled = false;
    let hidden = 0;
    if (pending.size === 0) {
      hidden += scan(document.body);
    } else {
      for (const root of pending) hidden += scan(root);
      pending.clear();
    }
    if (hidden && isDebug()) debug("hid", hidden, "total", totalHidden);
  }

  function scheduleScan(root) {
    if (root) pending.add(root);
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(runPending);
  }

  function onMutations(mutations) {
    let dirty = false;
    for (let i = 0; i < mutations.length; i++) {
      const added = mutations[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        dirty = true;
        pending.add(node);
      }
    }
    if (dirty) scheduleScan(null);
  }

  /** When picker saves a new kill, drop the seen cache so items re-evaluate. */
  function rescanAll() {
    pending.clear();
    seen = new WeakSet();
    scheduleScan(document.body);
  }

  async function loadKills() {
    try {
      const result = await chrome.storage.local.get(STORE_KEY);
      kills = Array.isArray(result[STORE_KEY]) ? result[STORE_KEY] : [];
      debug("kills loaded:", kills.length);
    } catch (e) {
      kills = [];
    }
  }

  function start() {
    const observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleScan(document.body);
    debug("started v" + VERSION);
  }

  function installDiagHook() {
    window.addEventListener("no-suggested-diag", () => {
      const items = document.querySelectorAll(LIST_ITEM_SELECTOR);
      let suggested = 0;
      let killed = 0;
      items.forEach((it) => {
        if (isSuggested(it)) suggested++;
        else if (matchesKill(it)) killed++;
      });
      console.log(LOG, "DIAG", {
        version: VERSION,
        url: location.href,
        listItems: items.length,
        suggestedHits: suggested,
        killMatches: killed,
        storedKills: kills.length,
        hidden: document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`).length,
        totalHidden,
      });
    });
    window.addEventListener("no-suggested-kills-updated", async () => {
      await loadKills();
      // WeakSet has no clear(); rebuild reference instead.
      rescanAll();
    });
    const helper = document.createElement("script");
    helper.textContent = "window.noSuggestedDiag=function(){window.dispatchEvent(new Event('no-suggested-diag'));};";
    (document.documentElement || document.head).appendChild(helper);
    helper.remove();
  }

  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORE_KEY]) {
      kills = Array.isArray(changes[STORE_KEY].newValue) ? changes[STORE_KEY].newValue : [];
      debug("kills updated:", kills.length);
      rescanAll();
    }
  });

  console.log(LOG, "active v" + VERSION);
  installDiagHook();

  loadKills().then(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  });
})();
