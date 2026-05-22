/**
 * Popup UI: master toggle, stats, kill-list with undo.
 *
 * Reads everything from chrome.storage.local. Toggling the master switch
 * writes back; the content script and background pick it up via
 * chrome.storage.onChanged.
 */
(function () {
  "use strict";

  const KEYS = {
    enabled: "no-suggested-enabled",
    kills: "no-suggested-kills",
    stats: "no-suggested-stats",
    showBadge: "no-suggested-show-badge",
  };

  const els = {
    toggle: document.getElementById("enabled-toggle"),
    banner: document.getElementById("status-banner"),
    statPage: document.getElementById("stat-page"),
    statLifetime: document.getElementById("stat-lifetime"),
    statManual: document.getElementById("stat-manual"),
    pickBtn: document.getElementById("pick-btn"),
    killList: document.getElementById("kill-list"),
    clearAll: document.getElementById("clear-all-btn"),
    badgeToggle: document.getElementById("badge-toggle"),
    versionTag: document.getElementById("version-tag"),
  };

  const LINKEDIN_MATCH = /^https:\/\/www\.linkedin\.com\//;

  async function getState() {
    const result = await chrome.storage.local.get([
      KEYS.enabled, KEYS.kills, KEYS.stats, KEYS.showBadge,
    ]);
    return {
      enabled: result[KEYS.enabled] !== false,
      kills: Array.isArray(result[KEYS.kills]) ? result[KEYS.kills] : [],
      stats: result[KEYS.stats] || { suggestedHidden: 0 },
      showBadge: result[KEYS.showBadge] !== false,
    };
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString();
  }

  function labelForKill(k) {
    if (k.author) {
      const handle = k.author.replace(/^in\//, "@").replace(/^company\//, "🏢 ");
      return { kind: k.author.startsWith("company/") ? "company" : "author", label: handle };
    }
    if (k.activityUrn) {
      const tail = k.activityUrn.split(":").pop() || "";
      return { kind: "post", label: "id ending " + tail.slice(-6) };
    }
    if (k.textSnippet) return { kind: "text", label: '"' + k.textSnippet.slice(0, 40) + '…"' };
    return { kind: "card", label: "unknown card" };
  }

  function renderKills(kills) {
    els.killList.innerHTML = "";
    if (!kills.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No manual kills yet. Use the picker above.";
      els.killList.appendChild(li);
      els.clearAll.hidden = true;
      return;
    }

    els.clearAll.hidden = false;
    const sorted = [...kills].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    for (let i = 0; i < sorted.length; i++) {
      const k = sorted[i];
      const { kind, label } = labelForKill(k);
      const li = document.createElement("li");

      const span = document.createElement("span");
      span.className = "kill-label";
      const kindEl = document.createElement("span");
      kindEl.className = "kind";
      kindEl.textContent = kind;
      span.appendChild(kindEl);
      span.appendChild(document.createTextNode(label));
      span.title = label;

      const btn = document.createElement("button");
      btn.className = "undo-btn";
      btn.type = "button";
      btn.title = "Restore this post";
      btn.textContent = "×";
      btn.addEventListener("click", () => undoKill(k));

      li.appendChild(span);
      li.appendChild(btn);
      els.killList.appendChild(li);
    }
  }

  async function getPageCount() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !LINKEDIN_MATCH.test(tab.url || "")) return null;
      const reply = await chrome.tabs.sendMessage(tab.id, {
        type: "no-suggested:get-page-count",
      });
      return typeof reply?.count === "number" ? reply.count : null;
    } catch {
      return null;
    }
  }

  async function refresh() {
    const [state, pageCount] = await Promise.all([getState(), getPageCount()]);
    const { enabled, kills, stats, showBadge } = state;

    els.toggle.checked = enabled;
    els.banner.hidden = enabled;
    els.pickBtn.disabled = !enabled;
    els.badgeToggle.checked = showBadge;

    els.statPage.textContent = pageCount === null ? "—" : fmt(pageCount);
    els.statLifetime.textContent = fmt(stats.suggestedHidden || 0);
    els.statManual.textContent = fmt(kills.length);

    renderKills(kills);
  }

  function killsEqual(a, b) {
    return (
      a.activityUrn === b.activityUrn &&
      a.author === b.author &&
      a.textSnippet === b.textSnippet &&
      a.ts === b.ts
    );
  }

  async function undoKill(target) {
    const { kills } = await getState();
    const next = kills.filter((k) => !killsEqual(k, target));
    await chrome.storage.local.set({ [KEYS.kills]: next });
  }

  async function clearAllKills() {
    if (!confirm("Restore all manually-nuked posts? Auto-hidden Suggested posts stay hidden.")) return;
    await chrome.storage.local.set({ [KEYS.kills]: [] });
  }

  els.toggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ [KEYS.enabled]: els.toggle.checked });
  });

  els.badgeToggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ [KEYS.showBadge]: els.badgeToggle.checked });
  });

  els.pickBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "no-suggested:toggle-picker" }).catch(() => {});
    window.close();
  });

  els.clearAll.addEventListener("click", clearAllKills);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") refresh();
  });

  const manifest = chrome.runtime.getManifest();
  els.versionTag.textContent = "v" + manifest.version;

  refresh();
})();
