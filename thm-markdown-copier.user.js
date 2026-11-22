// ==UserScript==
// @name         THM Markdown Copier
// @namespace    https://github.com/Salvatierra-Benjamin/try-copy-me-extention
// @version      0.1.2
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

    switch (tag) {
      case "strong":
      case "b":
        return wrapInline(childrenInline(node), "**");
      case "em":
      case "i":
        return wrapInline(childrenInline(node), "*");
      case "code": {
        const text = collapse(node.textContent);
        return text ? "`" + text + "`" : "";
      }
      case "a": {
        const href = node.getAttribute("href");
        const inner = childrenInline(node);
        if (!href) {
          return inner;
        }
        return "[" + inner + "](" + href + ")";
      }
      case "img": {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return "![" + alt + "](" + src + ")";
      }
      case "br": {
        // Line break; stray spacing breaks are collapsed later in the pipeline.
        return "\n";
      }
      case "span": {
        // Strip empty span wrappers but keep their inner text.
        return childrenInline(node);
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
      const prefix = ordered ? index + ". " : "- ";
      index += 1;

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

      lines.push(indent + prefix + collapse(text));

      for (const nested of nestedLists) {
        convertList(nested, depth + 1, lines);
      }
    }
  }

  // Convert one block-level element into Markdown lines.
  function convertBlock(el, lines) {
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.charAt(1));
      const text = collapse(childrenInline(el));
      if (text) {
        lines.push("#".repeat(level) + " " + text);
      }
      return;
    }

    if (tag === "p") {
      for (const part of splitLines(childrenInline(el))) {
        lines.push(part);
      }
      return;
    }

    if (tag === "pre") {
      const code = el.textContent.replace(/\n+$/, "");
      lines.push("```", code, "```");
      return;
    }

    if (tag === "ul" || tag === "ol") {
      convertList(el, 0, lines);
      return;
    }

    if (tag === "blockquote") {
      for (const part of splitLines(childrenInline(el))) {
        lines.push("> " + part);
      }
      return;
    }

    if (
      tag === "div" ||
      tag === "section" ||
      tag === "article" ||
      tag === "main" ||
      tag === "header" ||
      tag === "footer" ||
      tag === "span"
    ) {
      convertChildren(el, lines);
      return;
    }

    // Unknown block element: flatten to inline text.
    const text = collapse(childrenInline(el));
    if (text) {
      lines.push(text);
    }
  }

  // Walk a node's children, converting each block.
  function convertChildren(parent, lines) {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = collapse(child.textContent);
        if (text) {
          lines.push(text);
        }
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        convertBlock(child, lines);
      }
    }
  }

  // Convert an HTML string to Markdown.
  function htmlToMarkdown(html) {
    if (!html || typeof html !== "string") {
      return "";
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const lines = [];
    convertChildren(doc.body, lines);
    return lines.join("\n");
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
  function extractRoom() {
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

    button.addEventListener("click", () => {
      const room = extractRoom();
      if (!room) {
        showToast("No room content found");
        return;
      }
      const markdown = window.ThmConverter.buildRoomMarkdown(room);
      copyText(markdown).then((ok) => {
        showToast(ok ? "Copied ✓" : "Copy failed");
      });
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
