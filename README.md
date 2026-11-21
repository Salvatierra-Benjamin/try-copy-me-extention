# THM Markdown Copier

A Firefox extension that copies an entire TryHackMe room — every task's lesson
content and questions — to the clipboard as clean Markdown with a single click.

## Features

- One-click floating **Copy Markdown** button on any `https://tryhackme.com/room/*` page.
- Captures every task in the room, not only the currently expanded one.
- Converts lesson HTML to Markdown: headings, lists, code blocks, links, bold/italic, and images.
- Includes each task's questions in a `### Questions` section.
- Dependency-free; no build step; plain browser JavaScript.

## How it works

TryHackMe room pages render an interactive accordion that loads each task on
demand. The complete room content is nonetheless present in the server-rendered
`<section id="room-page-critical-content">`, which React keeps in the DOM but
hides with `display: none` and `visibility: hidden`.

The content script reads that hidden section directly, extracts the room title,
description, and every `article[data-task-no]` (task title, lesson HTML, and
questions), and converts the lesson HTML to Markdown. No accordion expansion or
API reverse-engineering is required; hidden elements remain fully readable via
`innerHTML`.

## Installation

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `manifest.json` from this directory.

Temporary add-ons are unloaded when the browser restarts. Persistent installation
requires a signed, packaged add-on.

## Usage

1. Open any TryHackMe room page (for example `https://tryhackme.com/room/dnsindetail`).
2. Click the **Copy Markdown** button in the top-right corner.
3. The full room Markdown is copied to the clipboard; a brief confirmation toast appears.

## Project structure

```
.
├── manifest.json              # Extension manifest (Manifest V3, Firefox)
├── converter.js               # HTML -> Markdown converter (window.ThmConverter)
├── content.js                 # Extraction, button injection, clipboard logic
├── README.md
└── docs/
    └── extraction-strategy.md # Technical justification for the extraction approach
```

## Roadmap

Phase 2 (planned):

- "Open Gemini" shortcut to send the Markdown directly to Gemini.
- Option to include or exclude the questions section.
- Packaging and signing for permanent installation and distribution.
