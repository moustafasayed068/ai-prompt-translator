// Does the actual translation. Runs in the extension's background so it can
// reach Google Translate without being blocked by the chat site's page rules.

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";
const MAX_CHUNK = 1500; // keep each request URL short

function splitIntoChunks(text) {
  const chunks = [];
  let current = "";
  for (const line of text.split(/(\n)/)) {
    if ((current + line).length > MAX_CHUNK && current) {
      chunks.push(current);
      current = "";
    }
    // A single very long line: cut it at sentence ends or hard limit
    if (line.length > MAX_CHUNK) {
      const parts = line.match(new RegExp(`[^.!?؟۔]{1,${MAX_CHUNK}}[.!?؟۔]?`, "g")) || [line];
      for (const p of parts) {
        if ((current + p).length > MAX_CHUNK && current) {
          chunks.push(current);
          current = "";
        }
        current += p;
      }
    } else {
      current += line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(text, source, target) {
  if (!text.trim()) return text;
  const params = new URLSearchParams({ client: "gtx", sl: source, tl: target, dt: "t", q: text });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Google Translate returned ${res.status}`);
  const data = await res.json();
  return {
    text: (data[0] || []).map((seg) => seg[0]).join(""),
    detected: data[2] || null, // language Google detected, e.g. "ar", "fr"
  };
}

async function translate(text, source = "auto", target = "en") {
  const chunks = splitIntoChunks(text);
  const out = [];
  const detected = new Set();
  for (const c of chunks) {
    const r = await translateChunk(c, source, target);
    if (typeof r === "string") { out.push(r); continue; }
    out.push(r.text);
    if (r.detected) detected.add(r.detected);
  }
  return { result: out.join(""), detected: [...detected] };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "translate") {
    translate(msg.text, msg.source, msg.target)
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true; // keep the channel open for the async reply
  }
});

// Keyboard shortcut (Alt+T by default) → tell the Claude tab to translate
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-prompt") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Only tabs where the content script runs will answer; others are ignored
  if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "do-translate" }).catch(() => {});
});
