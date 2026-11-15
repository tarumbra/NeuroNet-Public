/* ==========================================================================
   CL -- Code's library: what Guides, Data Structures and Research share.
   ==========================================================================
   Cam (2026-10-01): "Code mainsection is also going to have guides ...
   Algorthm research ... Also then a data structures sub section ... Think
   of it as an environment i can use to learn not just programming but great
   software design. All guides, data structures ect. Need to have the
   ability to add more."

   Unlike the IDE (Algorithm's own page in a shadow root), these three are
   NeuroNet screens drawn straight into the main pane, in NeuroNet's own
   buttons and theme. Their back end is code_library.py, answered as
   code_lib_<name>; this file has the bridge (CL.call), the markdown they
   all read (CL.markdown), code blocks with Copy and Run (CL.wireCode), and a
   plain code editor that knows about Tab (CL.codeArea).
   ========================================================================== */
(() => {
  "use strict";
  const CL = window.CL = window.CL || {};

  const esc = CL.esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  CL.toast = (msg, kind) => (window.SS && SS.shared ? SS.shared.toast(msg, kind) : null);

  /** A code_lib_<name> call. Anything that goes wrong comes back as {error}. */
  CL.call = async (name, ...args) => {
    const api = window.pywebview && window.pywebview.api;
    const fn = api && api["code_lib_" + name];
    if (typeof fn !== "function") return {error: "This needs NeuroNet's window (code_lib_" + name + ")."};
    try {
      const r = await fn(...args);
      return r === undefined || r === null ? {} : r;
    } catch (e) {
      return {error: (e && e.message) || String(e)};
    }
  };

  /* ---- highlighting: Algorithm's own highlighter (ui/code/highlight.js) ---- */
  const LANG = {py: "python", python: "python", js: "javascript", javascript: "javascript",
                ts: "javascript", typescript: "javascript", mjs: "javascript",
                rs: "rust", rust: "rust", html: "html", css: "css"};
  CL.hlName = (lang) => LANG[String(lang || "").toLowerCase()] || "plain";
  CL.highlight = (code, lang) => {
    const name = CL.hlName(lang);
    return name === "plain" || !window.AL || !AL.Highlight ? esc(code) : AL.Highlight.toHtml(code, name);
  };
  /** Languages a snippet can be run in, by the name on its fence. */
  const RUNS = {py: "python", python: "python", js: "javascript", javascript: "javascript",
                ts: "typescript", typescript: "typescript"};

  /* ---- markdown ----
     What a guide can use (the "Writing your own guides" guide lists it):
     headings, paragraphs, lists, > callouts, rules, tables, **bold**,
     *italic*, `code`, links, and fenced code -- coloured, and with a Run
     button when the fence says `python run` / `js run`. Everything is
     escaped before it is marked, so a guide can't put markup into the page;
     a link shows its address rather than leaving the app (it would navigate
     NeuroNet's own window away). */
  function inline(text) {
    return String(text).split(/(``.+?``|`[^`]+`)/).map((part, i) => {
      // odd pieces are the code spans; ``double`` lets a span hold a `
      if (i % 2) return `<code>${esc(part.startsWith("``") ? part.slice(2, -2).trim() : part.slice(1, -1))}</code>`;
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="cl-link" title="$2">$1</a>');
    }).join("");
  }

  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  CL.markdown = (src) => {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = null, quote = null;
    const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
    const flushList = () => {
      if (list) out.push(`<${list.tag}>${list.items.map((t) => `<li>${inline(t)}</li>`).join("")}</${list.tag}>`);
      list = null;
    };
    const flushQuote = () => {
      if (quote) out.push(`<blockquote class="cl-callout">${CL.markdown(quote.join("\n"))}</blockquote>`);
      quote = null;
    };
    const flush = () => { flushPara(); flushList(); flushQuote(); };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+#-]*)\s*(run)?\s*$/);
      if (fence) {
        flush();
        const body = [];
        const close = new RegExp("^\\s*" + fence[1][0] + "{" + fence[1].length + ",}\\s*$");
        for (i++; i < lines.length && !close.test(lines[i]); i++) body.push(lines[i]);
        out.push(CL.codeBlock(body.join("\n"), fence[2], !!fence[3]));
        continue;
      }
      if (/^\s*>/.test(line)) {
        flushPara(); flushList();
        (quote = quote || []).push(line.replace(/^\s*>\s?/, ""));
        continue;
      }
      flushQuote();
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (h) { flush(); const n = Math.min(4, h[1].length + 1); out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
      else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push("<hr>"); }
      else if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || "")) {
        flush();
        const head = cells(line);
        const rows = [];
        for (i += 2; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
        i--;
        out.push(`<div class="cl-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      } else if (item) {
        flushPara(); flushQuote();
        const tag = /\d/.test(item[1]) ? "ol" : "ul";
        if (!list || list.tag !== tag) { flushList(); list = {tag, items: []}; }
        list.items.push(item[2]);
      } else if (!line.trim()) { flushPara(); flushList(); }
      else if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); }
      else { flushList(); para.push(line.trim()); }
    }
    flush();
    return out.join("\n");
  };

  /** A code block: coloured, with Copy -- and Run when it can be run. */
  CL.codeBlock = (code, lang, runnable) => {
    const run = runnable && RUNS[String(lang).toLowerCase()];
    const label = lang ? esc(lang) : "";
    return `<div class="cl-code" data-lang="${esc(run || lang || "")}">
      <div class="cl-code-bar"><span class="cl-code-lang">${label}</span>
        <button class="cl-code-btn" data-act="copy" title="Copy">Copy</button>
        ${run ? `<button class="cl-code-btn cl-run" data-act="run" title="Run this">&#9654; Run</button>` : ""}
      </div>
      <pre><code>${CL.highlight(code, lang)}</code></pre>
      <pre class="cl-out" hidden></pre>
    </div>`;
  };

  /** Copy and Run on every code block inside `el`. `source(block)` may
      supply the text (a structure's editor does); otherwise it's the block's. */
  CL.wireCode = (el, source) => {
    el.querySelectorAll(".cl-code").forEach((block) => {
      const text = () => (source ? source(block) : null) ?? block.querySelector("pre code").textContent;
      const copy = block.querySelector('[data-act="copy"]');
      if (copy) copy.onclick = async () => {
        try { await navigator.clipboard.writeText(text()); CL.toast("Copied", "good"); }
        catch (e) { CL.toast("Couldn't copy: " + e.message, "error"); }
      };
      const run = block.querySelector('[data-act="run"]');
      if (run) run.onclick = () => CL.run(block.dataset.lang, text(), block.querySelector(".cl-out"), run);
    });
  };

  /** Run code and show what it printed in `out`. */
  CL.run = async (lang, text, out, button) => {
    if (button) { button.disabled = true; button.dataset.was = button.innerHTML; button.textContent = "Running…"; }
    out.hidden = false;
    out.className = "cl-out";
    out.textContent = "Running…";
    const r = await CL.call("run", lang, text);
    if (button) { button.disabled = false; button.innerHTML = button.dataset.was; }
    if (r.error) { out.classList.add("bad"); out.textContent = r.error; return r; }
    out.classList.add(r.ok ? "good" : "bad");
    out.textContent = (r.output || "").replace(/\s+$/, "") || (r.ok ? "(it ran, and printed nothing)" : "It failed.");
    return r;
  };

  /** A textarea for code: Tab indents (four spaces), Shift+Tab outdents,
      Enter keeps the indent. Anything else is an ordinary textarea. */
  CL.codeArea = (ta) => {
    ta.spellcheck = false;
    ta.addEventListener("keydown", (e) => {
      const {selectionStart: s, selectionEnd: end, value} = ta;
      if (e.key === "Tab") {
        e.preventDefault();
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        if (e.shiftKey || s !== end) {
          const block = value.slice(lineStart, end);
          const changed = e.shiftKey ? block.replace(/^ {1,4}/gm, "") : block.replace(/^/gm, "    ");
          ta.setRangeText(changed, lineStart, end, "select");
        } else {
          ta.setRangeText("    ", s, end, "end");
        }
        ta.dispatchEvent(new Event("input", {bubbles: true}));
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        const indent = value.slice(lineStart, s).match(/^\s*/)[0];
        const extra = /[:{[(]\s*$/.test(value.slice(lineStart, s)) ? "    " : "";
        if (indent || extra) {
          e.preventDefault();
          ta.setRangeText("\n" + indent + extra, s, end, "end");
          ta.dispatchEvent(new Event("input", {bubbles: true}));
        }
      }
    });
  };

  /** Group items by a field, keeping the order they came in. */
  CL.groupBy = (items, key) => {
    const groups = new Map();
    for (const it of items) {
      const k = it[key] || "Other";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    return groups;
  };

  CL.plain = (md) => String(md || "").replace(/[`*#>|_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();

  CL.originNote = (origin) => ({
    builtin: "One of NeuroNet's. Editing it saves your own copy.",
    edited: "Your copy of one of NeuroNet's.",
    mine: "Yours.",
  }[origin] || "");

  /* ---- the screens, for SS.Code (ide.js) ---- */
  CL.VIEWS = {"code:guides": "Guides", "code:research": "Research", "code:structures": "Structures", "code:web": "Web"};
  /** Draw a library screen; false if `view` isn't one. */
  CL.mount = (host, view) => {
    const screen = CL[CL.VIEWS[view]];
    if (!screen) return false;
    host.style.display = "";
    screen.mount(host);
    return true;
  };
})();
