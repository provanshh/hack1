// contentScript.js
// Injected into pages to detect typed/pasted text and ask background to block immediately.

(async () => {
  // request settings (synchronous-ish)
  let settings = await new Promise(resolve =>
    chrome.runtime.sendMessage({ type: "getSettings" }, resp => resolve(resp?.settings || {}))
  );

  let blockedWords = (settings.words || []);

  // normalize + leet mapping (same logic as background)
  const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '2': 'z', '6': 'g', '8': 'b', '9': 'g' };
  function applyLeet(s) { return s.replace(/[0-9]/g, ch => LEET_MAP[ch] || ch); }
  function normalizeText(text) {
    if (!text) return "";
    try {
      return applyLeet(
        text
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "")
      );
    } catch (e) {
      return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
    }
  }

  // create normalized blocked list
  let normalizedBlocked = (blockedWords || []).map(w => normalizeText(w)).filter(Boolean);

  // receive updates from popup/background if settings change
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "settingsUpdated") {
      blockedWords = msg.newWords || blockedWords;
      normalizedBlocked = (blockedWords || []).map(w => normalizeText(w)).filter(Boolean);
    }
  });

  // find matches (return original words as found)
  function findMatches(text) {
    const norm = normalizeText(text || "");
    const found = [];
    for (const w of blockedWords) {
      if (!w) continue;
      const nw = normalizeText(w);
      if (nw && norm.includes(nw)) found.push(w);
    }
    return found;
  }

  // Prevent spamming block requests for same input rapidly
  let lastSent = { norm: "", t: 0 };
  function shouldSend(norm) {
    const now = Date.now();
    if (norm === lastSent.norm && now - lastSent.t < 1500) return false;
    lastSent = { norm, t: now };
    return true;
  }

  // send block request to background
  function sendBlockRequest(foundArray) {
    try {
      chrome.runtime.sendMessage({ type: "blockNow", found: foundArray, pageUrl: location.href }, () => { /* no-op */ });
    } catch (e) {
      // ignore
    }
  }

  // Main handler for input/paste/compositionend
  function handleEvent(e) {
    try {
      const el = e.target;
      if (!el) return;

      // skip password fields
      if (el.tagName === "INPUT" && el.type === "password") return;

      // collect text content
      let raw = "";
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") raw = el.value || "";
      else if (el.isContentEditable) raw = el.innerText || el.textContent || "";
      else raw = (el.value || el.innerText || el.textContent || "") + "";

      if (!raw) return;

      const norm = normalizeText(raw);
      if (!norm) return;

      // quick check for matches
      const found = findMatches(raw);
      if (found.length > 0 && shouldSend(norm)) {
        sendBlockRequest(found);
      }
    } catch (err) {
      // swallow errors - content scripts should be resilient
      // console.error("contentScript error:", err);
    }
  }

  // attach global listeners (capture = true to detect early)
  document.addEventListener("input", handleEvent, true);
  document.addEventListener("paste", (e) => {
    // pasted text may not be in input.value immediately, so slightly delay
    setTimeout(() => handleEvent({ target: e.target }), 10);
  }, true);
  document.addEventListener("compositionend", (e) => handleEvent({ target: e.target }), true);

  // Some SPA frameworks create inputs dynamically; MutationObserver is not strictly needed since input listener is global,
  // but keep an observer stub to stay compatible with dynamic frameworks
  const mo = new MutationObserver(() => { /* noop - global input listener catches new nodes */ });
  mo.observe(document.documentElement || document.body || document, { childList: true, subtree: true });

  // also check URL query parameters on load (search pages)
  try {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of params.entries()) {
      if (v) {
        const found = findMatches(v);
        if (found.length > 0 && shouldSend(normalizeText(v))) {
          sendBlockRequest(found);
          break;
        }
      }
    }
  } catch (e) { /* ignore */ }
})();
