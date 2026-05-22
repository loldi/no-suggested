# No Suggested

[![Release](https://img.shields.io/github/v/release/loldi/no-suggested?label=release&color=ef4444)](https://github.com/loldi/no-suggested/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-f97316)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)
[![Dependencies](https://img.shields.io/badge/dependencies-zero-22c55e)](#)
[![Code size](https://img.shields.io/github/languages/code-size/loldi/no-suggested)](https://github.com/loldi/no-suggested)
[![Downloads](https://img.shields.io/github/downloads/loldi/no-suggested/total?color=8b5cf6)](https://github.com/loldi/no-suggested/releases)

A tiny browser extension that hides LinkedIn **Suggested** posts from your feed. Vanilla JS, zero dependencies, zero telemetry.

**What you get**

- Auto-hides every feed card labeled **Suggested**
- A uBlock-style **element picker** (press `Alt+Shift+H`) to nuke any other post — fingerprinted by author + post URN so future posts from the same account also disappear
- Toolbar **popup**: master on/off switch, live stats, recently-nuked list with one-click undo
- Toolbar **badge counter** showing how many cards have been hidden on the current page

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

## The popup

Click the toolbar icon to open it:

- **On/off toggle** in the header — turns hiding off entirely (page un-hides immediately)
- **Stats** — total hidden, Suggested-auto count, manually-nuked count
- **Pick a post to nuke** button — activates the picker (same as `Alt+Shift+H`)
- **Recently nuked** list — every manual kill with a one-click `×` to restore

## Element picker (the eyedropper)

When a non-Suggested slop card slips through:

1. **Activate**: press `Alt+Shift+H`, or click "Pick a post to nuke" in the popup.
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

To restore individual posts, click `×` next to the entry in the popup's "Recently nuked" list. To clear everything, use the popup's **Clear all** link.

## How it works

LinkedIn changes CSS class names constantly, but the **Suggested** label text is stable, and feed cards are wrapped in `[role="listitem"]`. The extension:

1. **CSS file** (`hide.css`) is injected at `document_start` — the CSS engine hides anything with `[data-no-suggested-hidden="1"]` before paint. No JS layout work.
2. **Content script** finds every `[role="listitem"]` in the feed, checks for a "Suggested" header span, and marks matches with the data attribute.
3. **MutationObserver** watches for new feed items and only re-scans newly added subtrees (not the whole document).
4. **WeakSet** of already-checked list items means we never re-process the same node.
5. Mutation bursts are **coalesced** into one scan per animation frame.

Inspired by uBlock Origin's cosmetic filtering perf patterns.

## Regenerating the icon

The icon is drawn programmatically by `tools/make_icons.py` (Pillow required). Re-run after tweaking the design:

```bash
python tools/make_icons.py
```

Outputs `icons/icon{16,32,48,96,128}.png`.

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
