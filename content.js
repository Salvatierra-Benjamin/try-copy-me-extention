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

  function init() {
    injectStyles();
    ensureButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
