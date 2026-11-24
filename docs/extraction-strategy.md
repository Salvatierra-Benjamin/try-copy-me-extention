# Extraction Strategy

## The problem

TryHackMe room pages render tasks in an interactive accordion (`RoomPageLazy`).
Each task's content is loaded on demand only after its accordion header is
clicked. Manual copy-and-paste therefore captures only the currently expanded
task — never the whole room — and reproducing the full room by hand requires
expanding and copying every task individually.

## Primary path: hidden SSR section (free rooms)

On free rooms (`"isAccessibleForFree": true`), the complete content of every task
is present in the server-rendered section:

```html
<section id="room-page-critical-content">
```

React keeps this section in the live DOM but hides it with `display: none` and
`visibility: hidden`. The hidden section contains one `article[data-task-no]`
element per task, each holding the full lesson and questions. Because the
content is present in the initial HTML, no UI interaction or extra network
request is required to reach it.

## Why this approach beats UI automation

1. **No fragile accordion clicks.** Programmatically expanding every accordion
   and reading the rendered task depends on React's internal state, timing, and
   styled-component selectors, and mutates the visible page.
2. **Fast on free rooms.** Reading `#room-page-critical-content` requires zero
   network requests.
3. **Hidden elements remain readable.** CSS hiding (`display: none`,
   `visibility: hidden`) does not remove nodes from the DOM or strip their
   content; `querySelector` and `innerHTML` work on them identically to visible
   nodes.

## Why read `innerHTML` rather than `textContent`

The lesson content inside each task is populated through React's
`dangerouslySetInnerHTML`, so the raw HTML markup is what carries the structure
(headings, lists, tables, code blocks, links, emphasis). Reading `textContent`
would flatten that structure into plain text and lose list boundaries, inline
code, table cells, and link destinations.

## Fallback for subscriber-only rooms (empty SSR tasks)

On subscriber-only rooms (`"isAccessibleForFree": false`), Next.js SSR
intentionally omits the lesson `<div>` and questions `<ol>` from
`#room-page-critical-content`, leaving only the `<h2>` task titles.

When DOM extraction finds no task lessons or questions, `content.js` falls back
to a same-origin authenticated request to:

```
GET /api/v2/rooms/tasks?roomCode=<roomCode>
```

Each returned task provides `taskNo`, `title`, `description` (HTML lesson body),
and `questions[].question` (plain text or HTML, converted through `ThmConverter`).
If the room title is not present in the DOM, it also fetches
`/api/v2/rooms/details?roomCode=<roomCode>`.

### Firefox content-script `fetch` note

Both the MV3 content script and the Violentmonkey userscript (`@inject-into content`,
needed to avoid page CSP blocking) run in Firefox's extension content-script
context. Requests use an absolute URL (`window.location.origin + path`) via
`content.fetch` (falling back to `window.fetch`) so the request executes with
the page's origin and session cookies.

## SPA navigation

TryHackMe navigates between dashboards, paths, and rooms client-side without
full page reloads. The script matches `https://tryhackme.com/*` and watches URL
changes with `MutationObserver` + `popstate`, injecting the **Copy Markdown**
button only on `/room/*` and `/r/room/*` routes and removing it on other pages.

## Markdown conversion notes

- **Text-only output:** images (`<img>`), `<svg>`, and embedded media/script tags
  are omitted so the output stays clean for LLM/note-taking workflows.
- **Inline run grouping:** consecutive text and inline elements (`<code>`,
  `<strong>`, `<em>`, `<a>`, `<span>`) inside `<div>` containers are buffered
  together to prevent mid-sentence line breaks.
- **Code blocks (`<pre>`):** leading/trailing blank lines and trailing spaces are
  stripped, common indentation is dedented, and stray first-line indentation is
  removed while preserving real internal indentation.
- **Tables (`<table>`):** converted to GitHub-flavored Markdown tables.
- **Block separation:** headings, paragraphs, lists, tables, and code fences are
  separated by blank lines (`\n\n`).

## Structural reference (SSR DOM)

Each task article in `#room-page-critical-content` follows this shape on free rooms:

```
article[data-task-no] > h2 (task title) + div (lesson HTML) + h3 + ol (questions)
```

- `h2` — the task title.
- `div` — the lesson content, populated via `dangerouslySetInnerHTML` (selected with `:scope > div`).
- `h3` — the "Answer the questions below" heading.
- `:scope > ol > li` — the questions, one list item each. Scoping to the direct child `<ol>` is required because lesson `<div>` blocks can also contain ordered lists.
