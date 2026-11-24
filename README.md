# THM Markdown Copier

A Firefox userscript and extension that copies an entire TryHackMe room — every
task's lesson content and questions — to the clipboard as clean Markdown with a
single click.

## Features

- One-click floating **Copy Markdown** button on TryHackMe room pages (`/room/*` and `/r/room/*`), including client-side SPA navigation.
- Works on both **free** and **subscriber-only** rooms, capturing every task — not only the currently expanded one.
- Converts lesson HTML to clean text-only Markdown: headings, lists, tables, dedented code blocks, links, and bold/italic (images omitted).
- Includes each task's questions in a `### Questions` section.
- Zero runtime dependencies; plain browser JavaScript.

## How it works

TryHackMe room pages render an interactive accordion (`RoomPageLazy`) that loads
each task on demand:

1. **Free rooms (DOM primary path):** the complete room content is present in the
   server-rendered `<section id="room-page-critical-content">`, which React keeps
   hidden in the DOM (`display: none; visibility: hidden`). The script reads each
   `article[data-task-no]` directly via `innerHTML` with zero network requests.
2. **Subscriber-only rooms (authenticated API fallback):** Next.js SSR omits task
   lessons and questions from `#room-page-critical-content`, leaving only `<h2>`
   titles. When the script detects empty tasks, it falls back to a same-origin
   authenticated `GET /api/v2/rooms/tasks?roomCode=<roomCode>` request (using
   `content.fetch` in Firefox content scripts so page cookies and origin match).

No accordion automation is required. See [docs/extraction-strategy.md](docs/extraction-strategy.md)
for the full technical breakdown.

## Requirements

- **Permanent installation (recommended):**
  - Firefox (or any modern desktop browser).
  - [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) (or another userscript manager such as Tampermonkey).
- **Rebuilding the userscript after code edits (optional):**
  - `bash` and `sed` (preinstalled on Linux/macOS; no Node.js or npm required).

## Installation

### Option 1: Permanent installation with Violentmonkey (Recommended)

Standard Firefox Release requires Mozilla signing for permanent add-ons. Installing
as a userscript via Violentmonkey keeps it permanently installed without uploading
or signing on Mozilla AMO.

1. Install [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/) in Firefox.
2. Open the raw userscript URL from this repository:
   ```
   https://raw.githubusercontent.com/Salvatierra-Benjamin/try-copy-me-extention/main/thm-markdown-copier.user.js
   ```
3. Violentmonkey will open an installation prompt — click **Confirm installation**.

Because the userscript includes `@updateURL` and `@downloadURL`, Violentmonkey
automatically checks for updates whenever `@version` is bumped on `main`.

**Offline / local installation:** open the Violentmonkey dashboard, click **+**,
and paste or drag-and-drop `thm-markdown-copier.user.js` from your local clone.

### Option 2: Temporary Firefox Add-on (Development)

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this directory.

Temporary add-ons are unloaded when the browser restarts.

## Usage

1. Open any TryHackMe room page (for example `https://tryhackme.com/room/dnsindetail`).
2. Click the **Copy Markdown** button in the top-right corner.
3. The full room Markdown is copied to the clipboard; a brief confirmation toast appears.

## Development

Edit `converter.js` or `content.js`, bump `"version"` in `manifest.json` when
releasing, and regenerate the userscript:

```bash
./scripts/build-userscript.sh
```

## Project structure

```
.
├── manifest.json                 # Extension manifest (Manifest V3, Firefox)
├── converter.js                  # HTML -> Markdown converter (window.ThmConverter)
├── content.js                    # Extraction, button injection, clipboard logic
├── thm-markdown-copier.user.js   # Generated userscript for Violentmonkey
├── scripts/
│   └── build-userscript.sh       # Generates thm-markdown-copier.user.js from source files
├── README.md
└── docs/
    └── extraction-strategy.md    # Technical justification for the extraction approach
```

