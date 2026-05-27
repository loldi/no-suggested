# Changelog

## v1.2.4 — Shadow DOM feed scan + hide (2026-05-22)

**Symptom:** Suggested posts visible again. Popup shows `0 this page`. `noSuggestedDiag()` reported `feedCards: 0` while a Suggested card was on screen.

**Root cause:** LinkedIn moved the main feed into **open shadow DOM**. Two failures followed:

1. **Detection:** `document.querySelectorAll('[role="listitem"]')` only searches the light DOM. The feed (and Suggested labels) lived inside shadow roots, so the scanner never saw any cards.
2. **Hiding:** Injected `hide.css` does not apply inside shadow trees. Setting `[data-no-suggested-hidden="1"]` alone had no visual effect even when the attribute landed on the right node.

**Proper fix:**

| Layer | Change |
|---|---|
| Scan | `walkDeep()` / `deepQueryAll()` traverse light DOM **and** open shadow roots |
| Ancestors | `deepClosest()` and `findPostAncestor()` walk up through `ShadowRoot.host` boundaries |
| Fallback | Label-first collection: find short `"Suggested"` text, resolve post wrapper via URN / `data-view-name` / article probes |
| Hide | Keep data-attribute **plus** `element.style.setProperty("display", "none", "important")` for shadow-contained cards |
| Picker | Same shadow-aware card resolution + inline hide on manual block |

**Diag tip:** If Suggesteds slip through again, run `noSuggestedDiag()`. `feedCards: 0` with posts visible means the DOM boundary changed again (closed shadow, iframe, or new wrapper). Check `shadowRoots` count in the report.

---

## v1.2.3 — Diagnostic bridge under CSP (2026-05-22)

LinkedIn CSP blocked inline injection of `window.noSuggestedDiag`. Replaced with `page-diag.js` loaded via `web_accessible_resources`; listener moved to `document` with `dispatchEvent` fallback.

---

## v1.2.2 — Suggested label + data-view-name (2026-05-22)

LinkedIn nested the Suggested label (no longer leaf-only spans). Added `[data-view-name="feed-suggested-update"]` and relaxed label matching (`aria-label`, `/^Suggested/` prefix). Insufficient alone once feed moved to shadow DOM.

---

## v1.2.1 — Popup refresh + concept C icon

E1 popup layout + E3 explainer, rounded zinc chrome, concept C toolbar icon.

## v1.2.0 — Badge visibility toggle

## v1.1.x — Performance + stats

CSS-based hiding, WeakSet cache, URN-deduplicated lifetime stats, `[role="listitem"]` as hide target (replacing inner-div snip).

## v1.0.x — Initial release

Text-based Suggested detection, element picker, Firefox + Chromium support.
