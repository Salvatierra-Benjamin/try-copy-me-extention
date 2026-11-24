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
