// ==UserScript==
// @name         THM Markdown Copier
// @namespace    https://github.com/Salvatierra-Benjamin/try-copy-me-extention
// @version      0.1.5
// @description  Copy an entire TryHackMe room to the clipboard as clean Markdown.
// @match        https://tryhackme.com/*
// @grant        none
// @inject-into  content
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Salvatierra-Benjamin/try-copy-me-extention/main/thm-markdown-copier.user.js
// @updateURL    https://raw.githubusercontent.com/Salvatierra-Benjamin/try-copy-me-extention/main/thm-markdown-copier.user.js
// ==/UserScript==

// GENERATED FILE — edit converter.js or content.js and run ./scripts/build-userscript.sh.

// THM Markdown Copier — HTML to Markdown converter.
// Dependency-free; exposes `window.ThmConverter` for use by content.js.
// Plain browser JavaScript: no ES module import/export.
(function () {
  "use strict";

  const SKIP_TAGS = new Set([
    "img",
    "svg",
    "script",
    "style",
    "noscript",
    "iframe",
    "video",
    "audio",
    "canvas"
  ]);

  const BLOCK_TAGS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "pre", "ul", "ol", "blockquote", "table", "hr",
    "div", "section", "article", "main", "header", "footer",
    "aside", "nav", "figure", "figcaption", "dl", "dt", "dd",
    "details", "summary"
  ]);

  const CONTAINER_TAGS = new Set([
    "div", "section", "article", "main", "header", "footer",
    "aside", "figure", "figcaption", "details", "span"
  ]);

  // Collapse runs of whitespace into a single space and trim.
  function collapse(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  // Wrap inline text with Markdown markers without wrapping whitespace-only
  // content or splitting markers across newlines (e.g. `<strong><br/></strong>`).
  function wrapInline(raw, marker) {
    if (!raw) {
      return "";
    }
    return raw
      .split("\n")
      .map((part) => {
        const trimmed = collapse(part);
        if (!trimmed) {
          return "";
        }
        const lead = /^\s/.test(part) ? " " : "";
        const trail = /\s$/.test(part) ? " " : "";
        return lead + marker + trimmed + marker + trail;
      })
      .join("\n");
  }

  // Convert an inline-level node to Markdown text.
  function inline(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) {
      return "";
    }

    switch (tag) {
      case "strong":
      case "b":
        return wrapInline(childrenInline(node), "**");
      case "em":
      case "i":
        return wrapInline(childrenInline(node), "*");
      case "code":
      case "kbd": {
        const raw = node.textContent || "";
        const trimmed = collapse(raw);
        if (!trimmed) {
          return "";
        }
        const lead = /^\s/.test(raw) ? " " : "";
        const trail = /\s$/.test(raw) ? " " : "";
        return lead + "`" + trimmed + "`" + trail;
      }
      case "a": {
        const href = node.getAttribute("href");
        const raw = childrenInline(node);
        const inner = collapse(raw);
        if (!inner) {
          return "";
        }
        const lead = /^\s/.test(raw) ? " " : "";
        const trail = /\s$/.test(raw) ? " " : "";
        if (!href) {
          return lead + inner + trail;
        }
        return lead + "[" + inner + "](" + href + ")" + trail;
      }
      case "br": {
        // Line break; stray spacing breaks are collapsed later in the pipeline.
        return "\n";
      }
      case "p":
      case "div":
      case "li": {
        // Preserve boundaries when block tags appear inside inline contexts
        // (such as multi-paragraph <li>, <td>, or <blockquote>).
        return "\n" + childrenInline(node) + "\n";
      }
      default:
        return childrenInline(node);
    }
  }

  // Inline conversion over all children of a node.
  function childrenInline(node) {
    let out = "";
    for (const child of node.childNodes) {
      out += inline(child);
    }
    return out;
  }

  // Split inline output on line breaks, collapse each part, and drop empties.
  // This removes stray `<br/>` / `<span><br/></span>` spacing artifacts.
  function splitLines(raw) {
    return raw
      .split("\n")
      .map(collapse)
      .filter(Boolean);
  }

  // Clean and dedent a `<pre>` block into a fenced Markdown code block.
  function formatCodeBlock(el) {
    const raw = (el.textContent || "").replace(/\r\n?/g, "\n");
    const rawLines = raw.split("\n").map((line) => line.replace(/[ \t]+$/, ""));

    let start = 0;
    while (start < rawLines.length && rawLines[start].trim() === "") {
      start += 1;
    }
    let end = rawLines.length - 1;
    while (end >= start && rawLines[end].trim() === "") {
      end -= 1;
    }
    if (start > end) {
      return "";
    }

    const trimmedLines = rawLines.slice(start, end + 1);

    let minIndent = Infinity;
    for (const line of trimmedLines) {
      if (line.trim() === "") {
        continue;
      }
      const match = line.match(/^[ \t]*/);
      const indent = match ? match[0].length : 0;
      if (indent < minIndent) {
        minIndent = indent;
      }
    }
    if (!Number.isFinite(minIndent)) {
      minIndent = 0;
    }

    const dedented = trimmedLines.map((line) =>
      line.trim() === "" ? "" : line.slice(minIndent)
    );

    // TryHackMe <pre> tags often indent only the first line while subsequent
    // lines start at column 0. Strip stray leading spaces on line 0 in that case.
    if (minIndent === 0 && dedented.length > 0) {
      dedented[0] = dedented[0].replace(/^[ \t]+/, "");
    }

    return "```\n" + dedented.join("\n") + "\n```";
  }

  // Convert an HTML `<table>` into a GitHub-flavored Markdown table.
  function convertTable(table) {
    const rows = [];
    for (const tr of table.querySelectorAll("tr")) {
      if (tr.closest("table") !== table) {
        continue;
      }
      const cells = Array.from(tr.children)
        .filter((cell) => {
          const cellTag = cell.tagName.toLowerCase();
          return cellTag === "th" || cellTag === "td";
        })
        .map((cell) => collapse(childrenInline(cell)).replace(/\|/g, "\\|"));
      if (cells.length && cells.some(Boolean)) {
        rows.push(cells);
      }
    }

    if (!rows.length) {
      return "";
    }

    const colCount = Math.max(...rows.map((row) => row.length));
    const formatRow = (row) => {
      const copy = row.slice();
      while (copy.length < colCount) {
        copy.push("");
      }
      return "| " + copy.join(" | ") + " |";
    };

    const header = formatRow(rows[0]);
    const separator = "| " + Array(colCount).fill("---").join(" | ") + " |";
    const body = rows.slice(1).map(formatRow);
    return [header, separator, ...body].join("\n");
  }

  // Convert a `<ul>` / `<ol>` (and any nested lists) to Markdown lines.
  function convertList(list, depth, lines) {
    const ordered = list.tagName.toLowerCase() === "ol";
    const indent = "  ".repeat(depth);
    let index = 1;

    for (const child of list.children) {
      if (child.nodeType !== Node.ELEMENT_NODE || child.tagName.toLowerCase() !== "li") {
        continue;
      }
      const li = child;
      let text = "";
      const nestedLists = [];

      for (const sub of li.childNodes) {
        if (sub.nodeType === Node.ELEMENT_NODE) {
          const subTag = sub.tagName.toLowerCase();
          if (subTag === "ul" || subTag === "ol") {
            nestedLists.push(sub);
            continue;
          }
        }
        text += inline(sub);
      }

      const itemText = collapse(text);
      if (itemText) {
        const prefix = ordered ? index + ". " : "- ";
        index += 1;
        lines.push(indent + prefix + itemText);
      }

      for (const nested of nestedLists) {
        convertList(nested, depth + 1, lines);
      }
    }
  }

  function isBlockElement(el) {
    const tag = el.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag)) {
      return true;
    }
    if (tag === "span") {
      return Boolean(
        el.querySelector("h1,h2,h3,h4,h5,h6,p,pre,ul,ol,blockquote,table,div,section,article")
      );
    }
    return false;
  }

  function flushInline(buffer, blocks) {
    const lines = splitLines(buffer);
    if (lines.length) {
      blocks.push(lines.join("\n"));
    }
  }

  // Convert one block-level element into Markdown blocks.
  function convertBlock(el, blocks) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) {
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.charAt(1));
      const text = collapse(childrenInline(el));
      if (text) {
        blocks.push("#".repeat(level) + " " + text);
      }
      return;
    }

    if (tag === "p") {
      const lines = splitLines(childrenInline(el));
      if (lines.length) {
        blocks.push(lines.join("\n"));
      }
      return;
    }

    if (tag === "pre") {
      const codeBlock = formatCodeBlock(el);
      if (codeBlock) {
        blocks.push(codeBlock);
      }
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const listLines = [];
      convertList(el, 0, listLines);
      if (listLines.length) {
        blocks.push(listLines.join("\n"));
      }
      return;
    }

    if (tag === "table") {
      const tableMd = convertTable(el);
      if (tableMd) {
        blocks.push(tableMd);
      }
      return;
    }

    if (tag === "blockquote") {
      const quoteLines = splitLines(childrenInline(el)).map((part) => "> " + part);
      if (quoteLines.length) {
        blocks.push(quoteLines.join("\n"));
      }
      return;
    }

    if (tag === "hr") {
      blocks.push("---");
      return;
    }

    if (CONTAINER_TAGS.has(tag)) {
      convertChildren(el, blocks);
      return;
    }

    // Unknown block element: flatten to inline text.
    const lines = splitLines(childrenInline(el));
    if (lines.length) {
      blocks.push(lines.join("\n"));
    }
  }

  // Walk a node's children, grouping consecutive inline runs and converting blocks.
  function convertChildren(parent, blocks) {
    let inlineBuffer = "";

    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        inlineBuffer += child.textContent;
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      const tag = child.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) {
        continue;
      }
      if (isBlockElement(child)) {
        flushInline(inlineBuffer, blocks);
        inlineBuffer = "";
        convertBlock(child, blocks);
      } else {
        inlineBuffer += inline(child);
      }
    }

    flushInline(inlineBuffer, blocks);
  }

  // Convert an HTML string to Markdown.
  function htmlToMarkdown(html) {
    if (!html || typeof html !== "string") {
      return "";
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const blocks = [];
    convertChildren(doc.body, blocks);
    return blocks.join("\n\n");
  }

  // The rendered `<h2>` often already contains "Task N: ...". Strip it so the
  // emitted heading does not duplicate the number.
  function normalizeTaskTitle(title) {
    return (title || "").replace(/^Task\s+\d+\s*:\s*/i, "").trim();
  }

  // Build the full room Markdown from the extracted room object.
  function buildRoomMarkdown(room) {
    const parts = [];

    parts.push("# " + (room.title || "").trim());

    const description = (room.description || "").trim();
    if (description) {
      parts.push("", description);
    }

    const tasks = room.tasks || [];
    tasks.forEach((task, index) => {
      parts.push("", "## Task " + (index + 1) + ": " + normalizeTaskTitle(task.title));

      const lesson = htmlToMarkdown(task.lessonHtml || "");
      if (lesson) {
        parts.push("", lesson);
      }

      const questions = task.questions || [];
      if (questions.length) {
        parts.push("", "### Questions", "");
        questions.forEach((question, qIndex) => {
          parts.push((qIndex + 1) + ". " + question);
        });
      }
    });

    return parts.join("\n") + "\n";
  }

  window.ThmConverter = {
    htmlToMarkdown: htmlToMarkdown,
    buildRoomMarkdown: buildRoomMarkdown
  };
})();

// THM Markdown Copier — content script.
// Reads the hidden critical-content section, injects a floating "Copy Markdown"
// button, and copies the full room as Markdown to the clipboard.
(function () {
  "use strict";

  const BUTTON_ID = "thm-markdown-copy-btn";
  const TOAST_ID = "thm-markdown-copy-toast";
  const STYLE_ID = "thm-markdown-copy-styles";

  // Read the server-rendered critical-content section and build the room object.
  function extractRoomFromDom() {
    const section = document.getElementById("room-page-critical-content");
    if (!section) {
      return null;
    }

    const titleEl = section.querySelector("h1");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const descEl = section.querySelector(":scope > p");
    const description = descEl ? descEl.textContent.trim() : "";

    const tasks = Array.from(section.querySelectorAll("article[data-task-no]")).map((article) => {
      const taskTitleEl = article.querySelector("h2");
      const taskTitle = taskTitleEl ? taskTitleEl.textContent.trim() : "";

      const lessonEl = article.querySelector(":scope > div");
      const lessonHtml = lessonEl ? lessonEl.innerHTML : "";

      const questions = Array.from(article.querySelectorAll(":scope > ol > li"))
        .map((li) => li.textContent.trim())
        .filter(Boolean);

      return { title: taskTitle, lessonHtml: lessonHtml, questions: questions };
    });

    return { title: title, description: description, tasks: tasks };
  }

  function hasTaskContent(room) {
    return Boolean(
      room &&
        room.tasks &&
        room.tasks.length > 0 &&
        room.tasks.some(
          (task) =>
            (task.lessonHtml && task.lessonHtml.trim()) ||
            (task.questions && task.questions.length > 0)
        )
    );
  }

  function getRoomCode() {
    const match = window.location.pathname.match(/^\/(?:r\/)?room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function formatQuestion(raw) {
    if (!raw || typeof raw !== "string") {
      return "";
    }
    const md = window.ThmConverter.htmlToMarkdown(raw);
    return md.replace(/\s+/g, " ").trim();
  }

  // Use page-context fetch in Firefox content scripts so cookies/origin match the page.
  function pageFetch(path) {
    const url = window.location.origin + path;
    const fetchFn =
      typeof content !== "undefined" && content && typeof content.fetch === "function"
        ? content.fetch.bind(content)
        : window.fetch.bind(window);
    return fetchFn(url, { credentials: "same-origin" });
  }

  // Fallback for subscriber-only rooms where SSR omits task lessons/questions.
  async function fetchRoomFromApi(roomCode, domRoom) {
    const tasksPath = "/api/v2/rooms/tasks?roomCode=" + encodeURIComponent(roomCode);
    const res = await pageFetch(tasksPath);
    if (!res.ok) {
      throw new Error("Tasks API HTTP " + res.status);
    }
    const json = await res.json();
    const rawTasks = Array.isArray(json && json.data) ? json.data : [];
    if (!rawTasks.length) {
      return null;
    }

    let title = (domRoom && domRoom.title) || "";
    let description = (domRoom && domRoom.description) || "";

    if (!title) {
      try {
        const detailsPath = "/api/v2/rooms/details?roomCode=" + encodeURIComponent(roomCode);
        const detailsRes = await pageFetch(detailsPath);
        if (detailsRes.ok) {
          const detailsJson = await detailsRes.json();
          const data = detailsJson && detailsJson.data;
          if (data) {
            title = data.title || title;
            description = data.description || description;
          }
        }
      } catch (e) {
        console.warn("[THM Markdown Copier] Details API failed:", e);
      }
    }

    const sortedTasks = rawTasks.slice().sort((a, b) => (a.taskNo || 0) - (b.taskNo || 0));
    const tasks = sortedTasks.map((task) => {
      const sortedQuestions = (Array.isArray(task.questions) ? task.questions : [])
        .slice()
        .sort((a, b) => (a.questionNo || 0) - (b.questionNo || 0));

      const questions = sortedQuestions
        .map((q) => formatQuestion(q && q.question))
        .filter(Boolean);

      return {
        title: task.title || "",
        lessonHtml: task.description || "",
        questions: questions
      };
    });

    return {
      title: title || roomCode,
      description: description,
      tasks: tasks
    };
  }

  async function extractRoom() {
    const domRoom = extractRoomFromDom();
    if (hasTaskContent(domRoom)) {
      return domRoom;
    }

    const roomCode = getRoomCode();
    if (!roomCode) {
      return domRoom;
    }

    try {
      const apiRoom = await fetchRoomFromApi(roomCode, domRoom);
      if (hasTaskContent(apiRoom)) {
        return apiRoom;
      }
    } catch (e) {
      console.error("[THM Markdown Copier] API fallback failed:", e);
    }

    return domRoom;
  }

  // Clipboard fallback via a hidden textarea + execCommand.
  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }

    document.body.removeChild(textarea);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard
        .writeText(text)
        .then(() => true)
        .catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  // Show a brief toast that auto-fades.
  function showToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("visible");

    // Restart the fade timers on rapid clicks.
    clearTimeout(toast._hideTimer);
    clearTimeout(toast._removeTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove("visible");
      toast._removeTimer = setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, 300);
    }, 1500);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + BUTTON_ID + " {",
      "  position: fixed;",
      "  top: 16px;",
      "  right: 16px;",
      "  z-index: 2147483647;",
      "  padding: 10px 16px;",
      "  border: none;",
      "  border-radius: 6px;",
      "  background: #1e293b;",
      "  color: #f8fafc;",
      "  font: 600 14px/1 system-ui, -apple-system, sans-serif;",
      "  cursor: pointer;",
      "  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);",
      "}",
      "#" + BUTTON_ID + ":hover { background: #334155; }",
      "#" + TOAST_ID + " {",
      "  position: fixed;",
      "  bottom: 24px;",
      "  left: 50%;",
      "  transform: translateX(-50%);",
      "  z-index: 2147483647;",
      "  padding: 10px 18px;",
      "  border-radius: 6px;",
      "  background: #16a34a;",
      "  color: #ffffff;",
      "  font: 600 14px/1 system-ui, -apple-system, sans-serif;",
      "  opacity: 0;",
      "  pointer-events: none;",
      "  transition: opacity 0.3s ease;",
      "}",
      "#" + TOAST_ID + ".visible { opacity: 1; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureButton() {
    // Guard against re-injection on SPA navigation.
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Copy Markdown";

    button.addEventListener("click", async () => {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      button.textContent = "Copying…";
      try {
        const room = await extractRoom();
        if (!room) {
          showToast("No room content found");
          return;
        }
        const markdown = window.ThmConverter.buildRoomMarkdown(room);
        const ok = await copyText(markdown);
        showToast(ok ? "Copied ✓" : "Copy failed");
      } finally {
        button.disabled = false;
        button.textContent = "Copy Markdown";
      }
    });

    document.body.appendChild(button);
  }

  function isRoomPage() {
    return /^\/(r\/)?room\/[^/]+/.test(window.location.pathname);
  }

  function removeButton() {
    const button = document.getElementById(BUTTON_ID);
    if (button) {
      button.remove();
    }
  }

  let lastHref = "";

  function syncUI() {
    lastHref = window.location.href;
    if (isRoomPage()) {
      injectStyles();
      ensureButton();
    } else {
      removeButton();
    }
  }

  function watchNavigation() {
    window.addEventListener("popstate", syncUI);
    const observer = new MutationObserver(() => {
      if (
        window.location.href !== lastHref ||
        (isRoomPage() && !document.getElementById(BUTTON_ID))
      ) {
        syncUI();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    syncUI();
    watchNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
