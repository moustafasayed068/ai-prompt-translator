// Adds a "Translate" button next to the send button on AI chat sites and
// swaps the text in the message box for its translation. Any language in.

(() => {
  const BTN_ID = "cat-translate-btn";
  let settings = { appendReply: true, target: "en" };

  // ---------- per-site selectors (first match wins, generic search after) ----------
  const SITES = [
    {
      host: /(^|\.)claude\.ai$/,
      editor: ['div.ProseMirror[contenteditable="true"]'],
      send: ['button[aria-label="Send message"]', 'fieldset button[type="submit"]'],
    },
    {
      host: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/,
      editor: ["#prompt-textarea", 'div.ProseMirror[contenteditable="true"]'],
      send: ['button[data-testid="send-button"]', "#composer-submit-button"],
    },
    {
      host: /(^|\.)gemini\.google\.com$/,
      editor: ['rich-textarea .ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]'],
      send: ["button.send-button", 'button[aria-label="Send message"]'],
    },
    {
      host: /(^|\.)(grok\.com|x\.com)$/,
      editor: ['form textarea', 'form [contenteditable="true"]'],
      send: ['form button[type="submit"]', 'button[aria-label="Submit"]'],
    },
    {
      host: /(^|\.)perplexity\.ai$/,
      editor: ["#ask-input", 'textarea[placeholder]'],
      send: ['button[aria-label="Submit"]', 'button[data-testid="submit-button"]'],
    },
    {
      host: /(^|\.)chat\.deepseek\.com$/,
      editor: ["textarea#chat-input", "textarea"],
      send: ['div[role="button"][aria-disabled]', 'button[type="submit"]'],
    },
    {
      host: /(^|\.)copilot\.microsoft\.com$/,
      editor: ["textarea#userInput", "textarea"],
      send: ['button[aria-label="Submit message"]', 'button[type="submit"]'],
    },
    {
      host: /(^|\.)chat\.mistral\.ai$/,
      editor: ['div.ProseMirror[contenteditable="true"]', "textarea"],
      send: ['button[type="submit"]', 'button[aria-label*="Send" i]'],
    },
  ];
  const site = SITES.find((s) => s.host.test(location.hostname)) || { editor: [], send: [] };

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const first = (selectors) => {
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) if (visible(el)) return el;
    }
    return null;
  };
  const isEditable = (el) =>
    el && (el.tagName === "TEXTAREA" || el.isContentEditable);

  function findEditor() {
    const known = first(site.editor);
    if (known) return known;
    const active = document.activeElement;
    if (isEditable(active) && visible(active)) return active;
    // Generic: the lowest visible text box on the page is usually the chat box
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"]')].filter(visible);
    all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return all[0] || null;
  }

  function findSendButton(editor) {
    const known = first(site.send);
    if (known) return known;
    const scope = (editor && (editor.closest("form") || editor.closest("fieldset"))) || document;
    return (
      [...scope.querySelectorAll(
        'button[aria-label*="Send" i], button[data-testid*="send" i], button[type="submit"]'
      )].find(visible) || null
    );
  }

  // ---------- language names and button label ----------
  const langName = (code) => {
    try {
      return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
    } catch (_) {
      return code;
    }
  };

  function refreshLabel() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const code = (settings.target || "en").split("-")[0].toUpperCase();
    btn.querySelector(".cat-label").textContent = "文→" + code;
    btn.title = `Translate to ${langName(settings.target)} (Alt+T)`;
    btn.setAttribute("aria-label", `Translate to ${langName(settings.target)}`);
  }

  chrome.storage.sync.get(settings, (s) => {
    settings = { ...settings, ...s };
    refreshLabel();
  });
  chrome.storage.onChanged.addListener((changes) => {
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    refreshLabel();
  });

  // ---------- reading and writing the box ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const squash = (s) => s.replace(/\s+/g, "").toLowerCase();
  const readText = (el) => (el.tagName === "TEXTAREA" ? el.value : el.innerText);

  function selectAllIn(el) {
    el.focus();
    if (el.tagName === "TEXTAREA") {
      el.select();
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function looksReplaced(el, original, translated) {
    const now = squash(readText(el));
    const head = squash(translated).slice(0, 24);
    const oldHead = squash(original).slice(0, 24);
    return now.includes(head) && (!oldHead || !now.includes(oldHead));
  }

  // Method A: select everything and type over it (keeps Ctrl+Z working)
  async function typeOver(el, text) {
    selectAllIn(el);
    document.execCommand("insertText", false, text);
    await wait(60);
  }

  // Method B: paste over it (rich editors) or set the value (plain text boxes)
  async function pasteOver(el, text) {
    selectAllIn(el);
    await wait(30);
    if (el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      try {
        const dt = new DataTransfer();
        dt.setData("text/plain", text);
        el.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
        );
      } catch (_) {}
    }
    await wait(60);
  }

  async function restore(el, original) {
    if (squash(readText(el)) === squash(original)) return;
    selectAllIn(el);
    document.execCommand("insertText", false, original);
    await wait(60);
  }

  async function setEditorText(el, original, text) {
    await typeOver(el, text);
    if (looksReplaced(el, original, text)) return true;
    await pasteOver(el, text);
    if (looksReplaced(el, original, text)) return true;
    await restore(el, original);
    return false;
  }

  // ---------- feedback ----------
  function toast(msg, isError = false) {
    let el = document.getElementById("cat-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cat-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = isError ? "cat-show cat-error" : "cat-show";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.className = ""), 2600);
  }

  function showFallback(text) {
    let box = document.getElementById("cat-fallback");
    if (!box) {
      box = document.createElement("div");
      box.id = "cat-fallback";
      box.innerHTML =
        '<div class="cat-fb-head">Translation ready. Copy it and paste into the box.</div>' +
        "<textarea readonly></textarea>" +
        '<div class="cat-fb-row"><button type="button" data-a="copy">Copy</button>' +
        '<button type="button" data-a="close">Close</button></div>';
      document.body.appendChild(box);
      box.addEventListener("click", (e) => {
        const a = e.target.getAttribute("data-a");
        const ta = box.querySelector("textarea");
        if (a === "copy") {
          const done = () => (e.target.textContent = "Copied");
          navigator.clipboard.writeText(ta.value).then(done).catch(() => {
            ta.select();
            document.execCommand("copy");
            done();
          });
        } else if (a === "close") {
          box.remove();
        }
      });
    }
    box.querySelector("textarea").value = text;
    box.querySelector('[data-a="copy"]').textContent = "Copy";
  }

  function setBusy(busy) {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    btn.disabled = busy;
    btn.classList.toggle("cat-busy", busy);
  }

  // ---------- the main action ----------
  let lastEditor = null;

  async function translateNow() {
    const editor = (lastEditor && lastEditor.isConnected && lastEditor) || findEditor();
    if (!editor) return toast("Couldn't find the message box", true);

    const original = readText(editor);
    const text = original.replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return toast("Type your prompt first");

    const target = settings.target || "en";
    const targetName = langName(target);
    const replyLine = `Reply in ${targetName}.`;

    setBusy(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: "translate", text, source: "auto", target });
      if (!res || !res.ok) throw new Error(res ? res.error : "No response");

      const base = target.split("-")[0].toLowerCase();
      const detected = (res.detected || []).map((d) => d.split("-")[0].toLowerCase());
      if (detected.length && detected.every((d) => d === base)) {
        return toast(`Already in ${targetName}, nothing to translate`);
      }

      let out = res.result.trim();
      if (settings.appendReply && !out.toLowerCase().includes(replyLine.toLowerCase())) {
        out += "\n\n" + replyLine;
      }

      if (!(await setEditorText(editor, original, out))) {
        showFallback(out);
        return toast("Couldn't write into the box. Your text is safe, copy the translation instead.", true);
      }
      const from = detected.length ? langName(detected[0]) : "your language";
      toast(`Translated from ${from} to ${targetName}. Ctrl+Z to undo.`);
    } catch (err) {
      toast("Translation failed: " + err.message, true);
    } finally {
      setBusy(false);
    }
  }

  // ---------- placing the button ----------
  function makeButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.innerHTML =
      '<span class="cat-label">文→EN</span><span class="cat-spin" aria-hidden="true"></span>';
    // mousedown keeps focus in the chat box on sites that clear it on blur
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      translateNow();
    });
    return btn;
  }

  function placeButton() {
    const existing = document.getElementById(BTN_ID);
    const editor = findEditor();
    if (editor) lastEditor = editor;
    const send = editor ? findSendButton(editor) : null;

    if (send && send.parentElement) {
      if (existing && existing.nextElementSibling === send) return;
      const btn = existing || makeButton();
      btn.classList.remove("cat-floating");
      send.parentElement.insertBefore(btn, send);
    } else if (editor) {
      if (existing && existing.classList.contains("cat-floating")) return;
      const btn = existing || makeButton();
      btn.classList.add("cat-floating");
      document.body.appendChild(btn);
    } else if (existing) {
      existing.remove();
      return;
    }
    refreshLabel();
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      placeButton();
    });
  }).observe(document.body, { childList: true, subtree: true });
  placeButton();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "do-translate") translateNow();
  });
})();
