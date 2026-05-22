# No Suggested

[![Release](https://img.shields.io/github/v/release/loldi/no-suggested?label=release&color=ef4444)](https://github.com/loldi/no-suggested/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-f97316)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-22c55e)](#)
[![Code size](https://img.shields.io/github/languages/code-size/loldi/no-suggested)](https://github.com/loldi/no-suggested)
[![Downloads](https://img.shields.io/github/downloads/loldi/no-suggested/total?color=8b5cf6)](https://github.com/loldi/no-suggested/releases)

A tiny browser extension that hides LinkedIn **Suggested** posts from your feed. ~270 lines of vanilla JS, zero dependencies, zero telemetry.

Includes a uBlock-style **element picker** for the occasional post that slips through: click the extension icon (or press `Alt+Shift+H`), hover any post, click to permanently hide it. The pick is fingerprinted by author and post URN, so future posts from the same account also get nuked.

## Supported browsers

| Browser | Status | Install method |
|---|---|---|
| ![Firefox](https://img.shields.io/badge/Firefox-FF7139?logo=firefoxbrowser&logoColor=fff) | ✅ **Primary target** | Temporary add-on via `about:debugging` |
| ![Chrome](https://img.shields.io/badge/Chrome-4285F4?logo=googlechrome&logoColor=fff) | ✅ Supported | Unpacked via `chrome://extensions` |
| ![Edge](https://img.shields.io/badge/Edge-0078D7?logo=microsoftedge&logoColor=fff) | ✅ Should work | Unpacked via `edge://extensions` (Chromium) |
| ![Brave](https://img.shields.io/badge/Brave-FB542B?logo=brave&logoColor=fff) | ✅ Should work | Unpacked via `brave://extensions` (Chromium) |
| ![Opera](https://img.shields.io/badge/Opera-FF1B2D?logo=opera&logoColor=fff) | ⚠️ Untested | Unpacked via `opera://extensions` (Chromium) |
| ![Safari](https://img.shields.io/badge/Safari-000000?logo=safari&logoColor=fff) | ❌ Not supported | Would require Xcode conversion |

## Install (unpacked)

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Choose `manifest.json` in this folder

> Temporary add-ons disappear when Firefox restarts. For a permanent install, use [Firefox Add-on signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) or keep loading unpacked via `about:debugging`. Your kill list in `storage.local` persists across reloads either way.

### Chrome / Edge / Brave

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`no-suggested`)

## Element picker (the eyedropper)

When a non-Suggested slop card slips through:

1. **Activate**: click the extension's toolbar icon, or press `Alt+Shift+H` on the LinkedIn tab.
2. The cursor becomes a crosshair and a toast appears top-right.
3. **Hover** any post: it gets a red outline.
4. **Click** to nuke it permanently.
5. `ESC` to cancel without picking.

What gets stored (in `chrome.storage.local`):

| Field | Source | Effect |
|---|---|---|
| `activityUrn` | `data-urn` on the post | Hides this exact post |
| `author` | profile/company URL slug | Hides all future posts from this account |
| `textSnippet` | first 120 chars of post text | Fallback when no urn/author found |

To clear the kill list:

```js
chrome.storage.local.remove('no-suggested-kills');
```

## How it works

LinkedIn changes CSS class names constantly, but the **Suggested** label text is stable, and feed cards are wrapped in `[role="listitem"]`. The extension:

1. **CSS file** (`hide.css`) is injected at `document_start` — the CSS engine hides anything with `[data-no-suggested-hidden="1"]` before paint. No JS layout work.
2. **Content script** finds every `[role="listitem"]` in the feed, checks for a "Suggested" header span, and marks matches with the data attribute.
3. **MutationObserver** watches for new feed items and only re-scans newly added subtrees (not the whole document).
4. **WeakSet** of already-checked list items means we never re-process the same node.
5. Mutation bursts are **coalesced** into one scan per animation frame.

Inspired by uBlock Origin's cosmetic filtering perf patterns.

## Debugging (when a Suggested post still shows)

1. Reload the extension at `chrome://extensions` (click the refresh icon on the card).
2. On LinkedIn, open DevTools → **Console**.
3. You should see: `[No Suggested] extension active on ...` — if not, the content script is not running.
4. Enable verbose mode and reload:

```js
localStorage.setItem('no-suggested-debug', '1');
location.reload();
```

5. After the feed loads, run:

```js
noSuggestedDiag()
```

6. Copy the `[No Suggested] DIAG { ... }` line and paste it back for analysis.

To turn debug off: `localStorage.removeItem('no-suggested-debug'); location.reload();`

## If LinkedIn changes the label

Edit `SUGGESTED_TEXT` in `content.js` and add any new strings you see in the UI.

## License

MIT — do whatever you want with it.
