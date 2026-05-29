# Changelog

## Versioning policy

**Version bumps = functional deployments** (new features, meaningful UI ships, releases users install).

Bug fixes, regression patches, and debugging tooling ship **inside** the next deployment version. Do not mint a new version for each fix attempt.

---

## v1.3.0 — Hide headerless suggested posts (2026-05-29)

LinkedIn sometimes injects suggested/discovery posts **without** the "Suggested" header row. They often look like a 2nd/3rd-degree profile with a **+ Follow** button and no "liked this" / repost context.

**Detection added:**
- Broader `data-view-name` match (`suggest`, `recommend`, `discover`)
- Headerless heuristic: `• 2nd` / `• 3rd` + Follow CTA, no engagement header

**Manual block** still works for anything that slips through.

---

## v1.2.2 — Fix Suggested posts regression (2026-05-22)

LinkedIn changed the feed again; Suggested cards were visible with popup showing `0 this page`.

**Symptom:** `noSuggestedDiag()` reported `feedCards: 0` while Suggested posts were on screen.

**Root cause:** Feed moved into **open shadow DOM**. Light-DOM `querySelectorAll` never saw cards. Injected `hide.css` does not apply inside shadow trees.

**Fix (shipped as one deployment):**

| Layer | Change |
|---|---|
| Scan | `walkDeep()` / `deepQueryAll()` across open shadow roots |
| Ancestors | `deepClosest()` / `findPostAncestor()` through `ShadowRoot.host` |
| Detection | `[data-view-name="feed-suggested-update"]`, relaxed Suggested label match, label-first fallback |
| Hide | Data-attribute + inline `display: none !important` for shadow-contained cards |
| Diag | `page-diag.js` via `web_accessible_resources` (CSP blocked inline bridge) |
| AMO | `data_collection_permissions: { required: ["none"] }`, Firefox desktop 140+ / Android 142+, no `innerHTML` in picker toasts |

**Future regressions:** If Suggesteds slip through, run `noSuggestedDiag()`. `feedCards: 0` with posts visible = DOM boundary changed again.

---

## v1.2.1 — Popup refresh + concept C icon

E1 popup layout + E3 explainer, rounded zinc chrome, concept C toolbar icon, README hero.

## v1.2.0 — Badge visibility toggle

## v1.1.x — Performance + stats

CSS-based hiding, WeakSet cache, URN-deduplicated lifetime stats, `[role="listitem"]` hide target.

## v1.0.x — Initial release

Text-based Suggested detection, element picker, Firefox + Chromium support.
