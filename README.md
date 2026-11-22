# THM Markdown Copier

A Firefox userscript and extension that copies an entire TryHackMe room — every
task's lesson content and questions — to the clipboard as clean Markdown with a
single click.

## Features

- One-click floating **Copy Markdown** button on any `https://tryhackme.com/room/*` page.
- Captures every task in the room, not only the currently expanded one.
- Converts lesson HTML to Markdown: headings, lists, code blocks, links, bold/italic, and images.
- Includes each task's questions in a `### Questions` section.
- Zero runtime dependencies; plain browser JavaScript.

## How it works

TryHackMe room pages render an interactive accordion that loads each task on
demand. The complete room content is nonetheless present in the server-rendered
`<section id="room-page-critical-content">`, which React keeps in the DOM but
hides with `display: none` and `visibility: hidden`.

The script reads that hidden section directly, extracts the room title,
description, and every `article[data-task-no]` (task title, lesson HTML, and
questions), and converts the lesson HTML to Markdown. No accordion expansion or
API reverse-engineering is required; hidden elements remain fully readable via
`innerHTML`.

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

