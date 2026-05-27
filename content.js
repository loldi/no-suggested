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

  const VERSION = "1.2.3";
  const LOG = "[No Suggested]";
  const HIDDEN_ATTR = "data-no-suggested-hidden";
  const DEBUG_KEY = "no-suggested-debug";

  const KEYS = {
    enabled: "no-suggested-enabled",
    kills: "no-suggested-kills",
    stats: "no-suggested-stats",
  };

  const SUGGESTED_TEXT = new Set([
    "Suggested",
    "Suggested for you",
    "Suggested post",
  ]);

  const LIST_ITEM_SELECTOR = '[role="listitem"]';
  const SUGGESTED_VIEW_SELECTOR = '[data-view-name="feed-suggested-update"]';
  const LABEL_SELECTOR =
    "span, h2, h3, h4, div, p, strong, label, [aria-label]";
  const MAX_LABEL_LEN = 80;

  let seen = new WeakSet();
  const pending = new Set();
  let scanScheduled = false;

  let enabled = true;
  let kills = [];
  let pageHidden = 0;
  let lifetimeUrns = new Set();
  let pendingStatsFlush = null;
  let pendingNewUrns = [];
  const URN_CAP = 50000;

  // Perf: throttle scans triggered by DOM mutations. 60ms is below human
  // perception but lets LinkedIn's bootstrap, scroll handlers, and other
  // event loops breathe between our work.
  const SCAN_DEBOUNCE_MS = 60;
  let scanCount = 0;
  let totalScanMs = 0;
  let maxScanMs = 0;
  let observer = null;
  let observerScope = null;

  function isDebug() {
    try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch { return false; }
  }

  function debug(...args) {
    if (isDebug()) console.log(LOG, ...args);
  }

  function normalizeLabel(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isSuggestedLabel(text) {
    const t = normalizeLabel(text);
    if (!t || t.length > MAX_LABEL_LEN) return false;
    if (SUGGESTED_TEXT.has(t)) return true;
    return /^Suggested\b/i.test(t);
  }

  function labelText(el) {
    const aria = el.getAttribute?.("aria-label");
    if (aria) return normalizeLabel(aria);
    return normalizeLabel(el.textContent);
  }

  /** LinkedIn marks suggested feed cards with data-view-name; label text
   *  may sit in nested spans (no longer leaf-only). */
  function isSuggested(item) {
    if (item.matches?.(SUGGESTED_VIEW_SELECTOR)) return true;
    if (item.querySelector(SUGGESTED_VIEW_SELECTOR)) return true;

    const text = item.textContent;
    if (!text || !text.includes("Suggested")) return false;

    const labels = item.querySelectorAll(LABEL_SELECTOR);
    for (let i = 0; i < labels.length; i++) {
      if (isSuggestedLabel(labelText(labels[i]))) return true;
    }
    return false;
  }

  /** One hide target per feed card (prefer listitem wrapper). */
  function feedCardRoot(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
    const listItem = node.closest?.(LIST_ITEM_SELECTOR);
    if (listItem) return listItem;
    const suggested = node.closest?.(SUGGESTED_VIEW_SELECTOR);
    if (suggested) return suggested;
    if (node.matches?.(LIST_ITEM_SELECTOR)) return node;
    if (node.matches?.(SUGGESTED_VIEW_SELECTOR)) return node;
    return null;
  }

  function collectFeedCards(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];
    const raw = new Set();
    if (root.matches?.(LIST_ITEM_SELECTOR) || root.matches?.(SUGGESTED_VIEW_SELECTOR)) {
      const card = feedCardRoot(root);
      if (card) raw.add(card);
    }
    root.querySelectorAll(LIST_ITEM_SELECTOR).forEach((el) => {
      const card = feedCardRoot(el);
      if (card) raw.add(card);
    });
    root.querySelectorAll(SUGGESTED_VIEW_SELECTOR).forEach((el) => {
      const card = feedCardRoot(el);
      if (card) raw.add(card);
    });
    return [...raw];
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

  /** Stable identifier for the lifetime dedupe set. Prefers URN; falls back
   *  to a short, normalized text snippet when LinkedIn hasn't populated the
   *  data-urn yet (common on scroll-loaded cards). */
  function lifetimeKey(item) {
    const urn = urnOf(item);
    if (urn) return urn;
    const snip = snippetOf(item).slice(0, 80);
    return snip ? "txt:" + snip : null;
  }

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

  function setHidden(item, on) {
    if (on) {
      if (item.getAttribute(HIDDEN_ATTR) === "1") return false;
      item.setAttribute(HIDDEN_ATTR, "1");
      item.setAttribute("aria-hidden", "true");
      pageHidden++;
      return true;
    }
    if (item.getAttribute(HIDDEN_ATTR) !== "1") return false;
    item.removeAttribute(HIDDEN_ATTR);
    item.removeAttribute("aria-hidden");
    pageHidden = Math.max(0, pageHidden - 1);
    return true;
  }

  function scheduleStatsFlush() {
    if (pendingStatsFlush) return;
    pendingStatsFlush = setTimeout(async () => {
      pendingStatsFlush = null;
      if (!pendingNewUrns.length) return;
      pendingNewUrns = [];
      try {
        if (lifetimeUrns.size > URN_CAP) {
          const arr = Array.from(lifetimeUrns);
          lifetimeUrns = new Set(arr.slice(arr.length - URN_CAP));
        }
        await chrome.storage.local.set({
          [KEYS.stats]: {
            suggestedHidden: lifetimeUrns.size,
            seenUrns: Array.from(lifetimeUrns),
          },
        });
      } catch (e) {
        debug("stats flush failed:", e);
      }
    }, 1500);
  }

  function notifyBadge() {
    chrome.runtime?.sendMessage?.({
      type: "no-suggested:badge",
      enabled,
      count: pageHidden,
    }).catch(() => {});
  }

  function scan(root) {
    if (!enabled) return 0;
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return 0;
    const items = collectFeedCards(root);
    let newlyCounted = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (seen.has(item)) continue;
      seen.add(item);
      const suggested = isSuggested(item);
      if (suggested || matchesKill(item)) {
        const wasHidden = setHidden(item, true);
        if (wasHidden && suggested) {
          const key = lifetimeKey(item);
          if (key && !lifetimeUrns.has(key)) {
            lifetimeUrns.add(key);
            pendingNewUrns.push(key);
            newlyCounted++;
          }
        }
      }
    }
    if (newlyCounted) scheduleStatsFlush();
    return newlyCounted;
  }

  /** Collapse `pending` so we don't double-scan when a parent and child are
   *  both queued. Keeps the highest-level roots only. */
  function consolidatePending() {
    if (pending.size <= 1) return;
    const roots = [...pending];
    pending.clear();
    for (const node of roots) {
      let redundant = false;
      for (const other of pending) {
        if (other !== node && other.contains?.(node)) { redundant = true; break; }
      }
      if (redundant) continue;
      for (const other of [...pending]) {
        if (node.contains?.(other) && other !== node) pending.delete(other);
      }
      pending.add(node);
    }
  }

  function runPending() {
    scanScheduled = false;
    const started = performance.now();
    consolidatePending();
    if (pending.size === 0) {
      scan(document.body);
    } else {
      for (const root of pending) scan(root);
      pending.clear();
    }
    const elapsed = performance.now() - started;
    scanCount++;
    totalScanMs += elapsed;
    if (elapsed > maxScanMs) maxScanMs = elapsed;
    notifyBadge();
  }

  function scheduleScan(root, { immediate = false } = {}) {
    if (root) pending.add(root);
    if (scanScheduled) return;
    scanScheduled = true;
    if (immediate) {
      requestAnimationFrame(runPending);
    } else {
      setTimeout(runPending, SCAN_DEBOUNCE_MS);
    }
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

  /** Re-evaluate every currently hidden item: un-hide if it no longer matches. */
  function unhideStale() {
    const hidden = document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`);
    let restored = 0;
    for (let i = 0; i < hidden.length; i++) {
      const item = hidden[i];
      if (!isSuggested(item) && !matchesKill(item)) {
        setHidden(item, false);
        restored++;
      }
    }
    return restored;
  }

  function showAll() {
    const hidden = document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`);
    for (let i = 0; i < hidden.length; i++) setHidden(hidden[i], false);
    pageHidden = 0;
  }

  function reapplyAll() {
    if (!enabled) {
      showAll();
      notifyBadge();
      return;
    }
    unhideStale();
    seen = new WeakSet();
    pending.clear();
    scheduleScan(document.body);
  }

  async function loadState() {
    try {
      const result = await chrome.storage.local.get([KEYS.enabled, KEYS.kills, KEYS.stats]);
      enabled = result[KEYS.enabled] !== false;
      kills = Array.isArray(result[KEYS.kills]) ? result[KEYS.kills] : [];
      const stats = result[KEYS.stats];
      if (stats && Array.isArray(stats.seenUrns)) {
        lifetimeUrns = new Set(stats.seenUrns);
      }
      debug("loaded state: enabled=", enabled, "kills=", kills.length, "lifetime=", lifetimeUrns.size);
    } catch {
      enabled = true;
      kills = [];
      lifetimeUrns = new Set();
    }
  }

  function start() {
    // Observe the whole document. LinkedIn can re-mount <main> during route
    // changes, so narrowing the scope is fragile. The 60ms debounce keeps us
    // off LinkedIn's bootstrap critical path even with this wide observer.
    if (observer) observer.disconnect();
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    observerScope = document.documentElement;
    scheduleScan(document.body, { immediate: true });
    debug("started v" + VERSION);
  }

  function runDiagReport() {
    const items = collectFeedCards(document.body);
    let suggested = 0;
    let killed = 0;
    items.forEach((it) => {
      if (isSuggested(it)) suggested++;
      else if (matchesKill(it)) killed++;
    });
    const suggestedItems = items.filter((it) => isSuggested(it));
    const withUrn = suggestedItems.filter((it) => !!urnOf(it)).length;
    const report = {
      version: VERSION,
      url: location.href,
      enabled,
      feedCards: items.length,
      dataViewSuggested: document.querySelectorAll(SUGGESTED_VIEW_SELECTOR).length,
      suggestedHits: suggested,
      suggestedWithUrn: withUrn,
      suggestedWithoutUrn: suggestedItems.length - withUrn,
      killMatches: killed,
      storedKills: kills.length,
      hidden: document.querySelectorAll(`[${HIDDEN_ATTR}="1"]`).length,
      pageHidden,
      lifetimeSize: lifetimeUrns.size,
      pendingFlushScheduled: !!pendingStatsFlush,
      pendingNewKeys: pendingNewUrns.length,
      observerScope: observerScope?.tagName || null,
      scanCount,
      avgScanMs: scanCount ? +(totalScanMs / scanCount).toFixed(2) : 0,
      maxScanMs: +maxScanMs.toFixed(2),
      pageDiagBridge: !!document.getElementById("no-suggested-diag-bridge"),
    };
    console.log(LOG, "DIAG", report);
    return report;
  }

  function installDiagHook() {
    document.addEventListener("no-suggested-diag", runDiagReport, false);

    const id = "no-suggested-diag-bridge";
    if (document.getElementById(id)) return;
    const bridge = document.createElement("script");
    bridge.id = id;
    bridge.src = chrome.runtime.getURL("page-diag.js");
    bridge.addEventListener("error", () => {
      debug("page-diag.js failed to load (CSP); use document.dispatchEvent fallback");
    });
    (document.head || document.documentElement).appendChild(bridge);
  }

  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[KEYS.enabled]) {
      enabled = changes[KEYS.enabled].newValue !== false;
      debug("enabled changed:", enabled);
      reapplyAll();
    }
    if (changes[KEYS.kills]) {
      kills = Array.isArray(changes[KEYS.kills].newValue) ? changes[KEYS.kills].newValue : [];
      debug("kills changed:", kills.length);
      reapplyAll();
    }
  });

  chrome.runtime?.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "no-suggested:get-page-count") {
      sendResponse({ count: pageHidden, enabled });
      return true;
    }
    if (msg?.type === "no-suggested:refresh-badge") {
      notifyBadge();
    }
    if (msg?.type === "no-suggested:diag") {
      sendResponse(runDiagReport());
      return true;
    }
  });

  console.log(
    LOG,
    "active v" + VERSION,
    "— diag: noSuggestedDiag() or document.dispatchEvent(new Event('no-suggested-diag'))"
  );
  installDiagHook();

  loadState().then(() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  });
})();
