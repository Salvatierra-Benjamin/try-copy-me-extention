# Extraction Strategy

## The problem

TryHackMe room pages render tasks in an interactive accordion (`RoomPageLazy`).
Each task's content is loaded on demand only after its accordion header is
clicked. Manual copy-and-paste therefore captures only the currently expanded
task — never the whole room — and reproducing the full room by hand requires
expanding and copying every task individually.

## The key finding

The complete content of every task is always present in the server-rendered
section:

```html
<section id="room-page-critical-content">
```

React keeps this section in the live DOM but hides it with `display: none` and
`visibility: hidden`. The hidden section still contains one
`article[data-task-no]` element per task, each holding the full lesson and
questions. Because the content is present in the initial HTML, no interaction is
required to reach it.

## Why this approach beats the alternatives

1. **No fragile UI automation.** Programmatically expanding every accordion and
   reading the rendered task is brittle: it depends on React's internal state,
   timing, and selectors, and it mutates the page's visible state.
2. **No API reverse-engineering.** Reading the already-rendered DOM avoids
   depending on undocumented, session-dependent API endpoints or request
   formats, which can change without notice.
3. **Hidden elements remain readable.** CSS hiding (`display: none`,
   `visibility: hidden`) does not remove nodes from the DOM or strip their
   content; `querySelector` and `innerHTML` work on them exactly as on visible
   nodes.

## Why read `innerHTML` rather than `textContent`

The lesson content inside each task is populated through React's
`dangerouslySetInnerHTML`, so the raw HTML markup is what carries the structure
(headings, lists, code blocks, links, emphasis). Reading `textContent` would
flatten that structure into plain text and make accurate Markdown conversion
impossible — list boundaries, inline code, and link destinations would be lost.
Reading `innerHTML` preserves the markup so the converter can reproduce it as
Markdown.

## Fallback if critical content is ever truncated

If, on very long rooms, the hidden critical-content section were ever truncated
or emptied, a fallback remains available: locate each accordion control with
`button[data-task-no]`, click it to force the task to render, and read the
rendered content from the visible accordion. This is deliberately a fallback
only, since the primary path requires no interaction.

## Structural reference

Each task article follows this shape:

```
article[data-task-no] > h2 (task title) + div (lesson HTML) + h3 + ol (questions)
```

- `h2` — the task title.
- `div` — the lesson content, populated via `dangerouslySetInnerHTML` (selected with `:scope > div`).
- `h3` — the "Answer the questions below" heading.
- `:scope > ol > li` — the questions, one list item each. Scoping to the direct child `<ol>` is required because lesson `<div>` blocks can also contain ordered lists.
