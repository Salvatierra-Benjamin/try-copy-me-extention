// THM Markdown Copier — HTML to Markdown converter.
// Dependency-free; exposes `window.ThmConverter` for use by content.js.
// Plain browser JavaScript: no ES module import/export.
(function () {
  "use strict";

  // Collapse runs of whitespace into a single space and trim.
  function collapse(text) {
    return text.replace(/\s+/g, " ").trim();
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
      case "b": {
        const inner = childrenInline(node);
        return inner ? "**" + inner + "**" : "";
      }
      case "em":
      case "i": {
        const inner = childrenInline(node);
        return inner ? "*" + inner + "*" : "";
      }
      case "code": {
        return "`" + collapse(node.textContent) + "`";
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
