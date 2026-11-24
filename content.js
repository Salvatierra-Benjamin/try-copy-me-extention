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

  // Fallback for subscriber-only rooms where SSR omits task lessons/questions.
  async function fetchRoomFromApi(roomCode, domRoom) {
    const tasksUrl = "/api/v2/rooms/tasks?roomCode=" + encodeURIComponent(roomCode);
    const res = await fetch(tasksUrl, { credentials: "same-origin" });
    if (!res.ok) {
      return null;
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
        const detailsUrl = "/api/v2/rooms/details?roomCode=" + encodeURIComponent(roomCode);
        const detailsRes = await fetch(detailsUrl, { credentials: "same-origin" });
        if (detailsRes.ok) {
          const detailsJson = await detailsRes.json();
          const data = detailsJson && detailsJson.data;
          if (data) {
            title = data.title || title;
            description = data.description || description;
          }
        }
      } catch (e) {
        // Ignore details failure; tasks alone are still usable.
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
      // Fall back to whatever DOM content was available.
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
