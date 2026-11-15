/* ==========================================================================
   Algorithm — the editor.

   A textarea with a highlighted <pre> behind it, scroll-locked together.

   WHY NOT A CONTENTEDITABLE. Because a textarea already has everything that
   is genuinely hard: native undo that survives, correct selection
   behaviour, working IME for non-Latin input, and text that copies as text
   rather than as HTML. A contenteditable gets you styled text and then
   makes you rebuild all of that badly. The cost is that the input layer
   cannot be styled — which is why the visible colour comes from a layer
   behind it and the textarea itself is transparent.

   THE ALIGNMENT RULE. The two layers must agree on every metric that
   affects where a glyph lands: font, size, line height, letter spacing,
   padding, tab size, and white-space handling. One mismatch and the
   colours drift away from the characters further down the file. They are
   set together in the stylesheet for that reason, not separately.
   ========================================================================== */
window.AL = window.AL || {};

AL.Editor = (() => {
  "use strict";

  /* Highlighting a very large file on every keystroke would be felt. Beyond
     this, the highlight layer is switched off and the editor keeps working
     as plain text rather than becoming sluggish. */
  const HIGHLIGHT_LIMIT = 200000;   // characters, about 5000 lines of code
  const DEBOUNCE_MS = 60;

  function create(host, { language = "plain", text = "", onChange, onSave,
                          onReplaceAll } = {}) {
    host.innerHTML = `
      <div class="find" hidden>
        <div class="find-row">
          <input class="find-what" placeholder="Find" autocomplete="off"
                 spellcheck="false" aria-label="Find">
          <span class="find-count"></span>
          <button class="find-btn find-prev" title="Previous (Shift+Enter)">&uarr;</button>
          <button class="find-btn find-next" title="Next (Enter)">&darr;</button>
          <button class="find-btn find-case" title="Match case">Aa</button>
          <button class="find-btn find-close" title="Close (Escape)">&times;</button>
        </div>
        <div class="find-row find-replace-row" hidden>
          <input class="find-with" placeholder="Replace with" autocomplete="off"
                 spellcheck="false" aria-label="Replace with">
          <button class="find-btn find-one">Replace</button>
          <button class="find-btn find-all">All</button>
        </div>
      </div>
      <div class="ed">
        <div class="ed-gutter" aria-hidden="true"></div>
        <div class="ed-scroll">
          <div class="ed-line" aria-hidden="true"></div>
          <pre class="ed-paint" aria-hidden="true"><code></code></pre>
          <textarea class="ed-input" spellcheck="false" autocapitalize="off"
            autocomplete="off" autocorrect="off" wrap="off"></textarea>
        </div>
      </div>`;

    const gutter = host.querySelector(".ed-gutter");
    const lineHl = host.querySelector(".ed-line");
    const scroll = host.querySelector(".ed-scroll");
    const paint = host.querySelector(".ed-paint code");
    const input = host.querySelector(".ed-input");

    let current = language;
    let timer = null;
    let plainMode = false;

    const find = {
      open: false,
      needle: "",
      caseSensitive: false,
      ranges: [],
      index: -1,
    };
    const findEl = {
      bar: host.querySelector(".find"),
      what: host.querySelector(".find-what"),
      with: host.querySelector(".find-with"),
      count: host.querySelector(".find-count"),
      replaceRow: host.querySelector(".find-replace-row"),
      caseBtn: host.querySelector(".find-case"),
    };

    input.value = text;

    function repaint() {
      const value = input.value;
      plainMode = value.length > HIGHLIGHT_LIMIT;
      if (plainMode) {
        // Above the limit the syntax layer is off, but matches still need
        // marking — losing find in a large file is the opposite of helpful.
        paint.innerHTML = find.ranges.length
          ? AL.Highlight.toHtml(value, "plain", find.ranges, find.index)
          : AL.Highlight.escapeHtml(value);
      } else {
        paint.innerHTML = AL.Highlight.toHtml(
          value, current, find.ranges.length ? find.ranges : null, find.index);
      }
      drawGutter(value);
    }

    /* The line the caret is on, drawn as a band behind the text.

       Positioned from the caret's line number rather than measured from the
       DOM, because the painted layer has no per-line elements to measure —
       it is one block of text. Line number times line height is exact as
       long as nothing wraps, which is why the editor does not wrap. */
    function drawCurrentLine() {
      const before = input.value.slice(0, input.selectionStart);
      const line = before.split("\n").length - 1;
      const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
      const padding = parseFloat(getComputedStyle(input).paddingTop) || 0;
      lineHl.style.height = `${lineHeight}px`;
      lineHl.style.transform =
        `translateY(${padding + line * lineHeight - input.scrollTop}px)`;
      // Hidden while a selection spans text: a band behind a highlighted
      // range fights with the selection colour and reads as a glitch.
      lineHl.hidden = input.selectionStart !== input.selectionEnd;
      markActiveGutter(line);
    }

    let activeLine = -1;
    function markActiveGutter(line) {
      if (line === activeLine) return;
      const previous = gutter.children[activeLine];
      if (previous) previous.classList.remove("on");
      const current = gutter.children[line];
      if (current) current.classList.add("on");
      activeLine = line;
    }

    function drawGutter(value) {
      const lines = value.split("\n").length;
      // Rebuilt only when the count changes; a thousand <div>s per keystroke
      // is the kind of thing that makes an editor feel heavy.
      if (gutter.childElementCount === lines) return;
      let html = "";
      for (let i = 1; i <= lines; i += 1) html += `<div>${i}</div>`;
      gutter.innerHTML = html;
      activeLine = -1;      // the elements it pointed at are gone
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(repaint, DEBOUNCE_MS);
    }

    input.addEventListener("input", () => {
      schedule();
      if (find.open && find.needle) {
        // Keep the count honest while the document changes underneath it.
        clearTimeout(find.timer);
        find.timer = setTimeout(() => runSearch(true), DEBOUNCE_MS);
      }
      if (onChange) onChange(input.value);
    });

    /* The paint layer scrolls with the input rather than being scrolled by
       the user, so there is only ever one scroll position to be wrong. */
    input.addEventListener("scroll", () => {
      paint.parentElement.scrollTop = input.scrollTop;
      paint.parentElement.scrollLeft = input.scrollLeft;
      gutter.scrollTop = input.scrollTop;
      drawCurrentLine();
    });

    for (const event of ["click", "keyup", "select", "focus"]) {
      input.addEventListener(event, drawCurrentLine);
    }
    input.addEventListener("blur", () => { lineHl.hidden = true; });

    /* Pairs that close themselves. Quotes are in here too, which needs the
       "skip over" behaviour below to not be maddening: typing the closing
       quote of a pair the editor just made should step over it rather than
       insert a second one. */
    const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
    const CLOSERS = new Set(Object.values(PAIRS));

    function handlePairs(e) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const value = input.value;
      const next = value[end];

      // Wrap a selection rather than replacing it — selecting a word and
      // pressing ( should put brackets round it, not delete it.
      if (PAIRS[e.key] && start !== end) {
        e.preventDefault();
        const selected = value.slice(start, end);
        replaceRange(start, end, e.key + selected + PAIRS[e.key]);
        input.setSelectionRange(start + 1, end + 1);
        return true;
      }

      // Step over a closer that is already there.
      if (CLOSERS.has(e.key) && next === e.key && start === end) {
        e.preventDefault();
        input.setSelectionRange(start + 1, start + 1);
        drawCurrentLine();
        return true;
      }

      if (PAIRS[e.key] && start === end) {
        // Not inside a word: `don't` should not become `don''t`, and typing
        // a quote before a letter usually means opening a string round it.
        const quote = e.key === '"' || e.key === "'" || e.key === "`";
        const before = value[start - 1] || "";
        if (quote && /[\w)\]}"'`]/.test(before)) return false;
        if (next && /[\w({\[]/.test(next)) return false;
        e.preventDefault();
        replaceRange(start, end, e.key + PAIRS[e.key]);
        input.setSelectionRange(start + 1, start + 1);
        return true;
      }

      // Backspace between an empty pair removes both halves.
      if (e.key === "Backspace" && start === end && start > 0) {
        const previous = value[start - 1];
        if (PAIRS[previous] && next === PAIRS[previous]) {
          e.preventDefault();
          replaceRange(start - 1, start + 1, "");
          return true;
        }
      }
      return false;
    }

    input.addEventListener("keydown", (e) => {
      // Tab inserts a tab rather than leaving the editor. Shift+Tab and
      // Escape still move focus, so the editor is not a keyboard trap.
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        insert("    ");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (onSave) onSave(input.value);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault(); openFind(false); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault(); openFind(true); return;
      }
      if (e.key === "Escape" && find.open) {
        e.preventDefault(); closeFind(); return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && handlePairs(e)) return;
      if (e.key === "Enter") {
        // Keep the current line's indentation on the new line; losing it on
        // every newline is the single most irritating thing a plain
        // textarea does to code.
        const before = input.value.slice(0, input.selectionStart);
        const line = before.slice(before.lastIndexOf("\n") + 1);
        const indent = (line.match(/^[ \t]*/) || [""])[0];
        const opensBlock = /[:{([]\s*$/.test(line);
        if (indent || opensBlock) {
          e.preventDefault();
          insert("\n" + indent + (opensBlock ? "    " : ""));
        }
      }
    });

    /**
     * Replace a range, keeping the browser's own undo stack.
     *
     * setRangeText looks like the modern answer and does NOT create an undo
     * entry in Chromium — tested, and one Ctrl+Z after a replace-all took
     * nothing back. execCommand("insertText") is deprecated but is still
     * the only call that types as if a person did, which is exactly what
     * undo needs to see. setRangeText is kept as the fallback for anywhere
     * execCommand has finally been removed.
     */
    function replaceRange(start, end, str) {
      input.focus();
      input.setSelectionRange(start, end);
      let ok = false;
      try {
        ok = document.execCommand("insertText", false, str);
      } catch {
        ok = false;
      }
      if (!ok) {
        input.setRangeText(str, start, end, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function insert(str) {
      replaceRange(input.selectionStart, input.selectionEnd, str);
    }

    /* ---- find and replace ---------------------------------------------- */

    function runSearch(keepIndex = false) {
      const value = input.value;
      find.ranges = AL.Highlight.findRanges(value, find.needle,
        { caseSensitive: find.caseSensitive });
      if (!find.ranges.length) {
        find.index = -1;
      } else if (!keepIndex || find.index < 0
                 || find.index >= find.ranges.length) {
        // Start from wherever the caret is, so Ctrl+F then Enter goes to the
        // next match below you rather than back to the top of the file.
        const from = input.selectionStart;
        const at = find.ranges.findIndex(([s]) => s >= from);
        find.index = at === -1 ? 0 : at;
      }
      updateCount();
      repaint();
    }

    function updateCount() {
      findEl.count.textContent = !find.needle ? ""
        : find.ranges.length
          ? `${find.index + 1} of ${find.ranges.length}`
          : "none";
      findEl.count.classList.toggle("is-none",
        Boolean(find.needle) && !find.ranges.length);
    }

    function gotoMatch(step) {
      if (!find.ranges.length) return;
      find.index = (find.index + step + find.ranges.length) % find.ranges.length;
      revealMatch();
      updateCount();
      repaint();
    }

    function revealMatch() {
      const range = find.ranges[find.index];
      if (!range) return;
      // Selecting in the textarea both shows the match and scrolls to it,
      // which is why the caret layer is doing the work rather than a
      // separate scroll calculation that could disagree with it.
      input.focus();
      input.setSelectionRange(range[0], range[1]);
      const before = input.value.slice(0, range[0]).split("\n").length - 1;
      const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
      const target = before * lineHeight;
      if (target < input.scrollTop
          || target > input.scrollTop + input.clientHeight - lineHeight * 2) {
        input.scrollTop = Math.max(0, target - input.clientHeight / 2);
        input.dispatchEvent(new Event("scroll"));
      }
    }

    function openFind(withReplace) {
      find.open = true;
      findEl.bar.hidden = false;
      findEl.replaceRow.hidden = !withReplace;
      const selected = input.value.slice(input.selectionStart, input.selectionEnd);
      // Whatever is selected is almost always what you meant to search for.
      if (selected && !selected.includes("\n")) {
        find.needle = selected;
        findEl.what.value = selected;
      }
      findEl.what.focus();
      findEl.what.select();
      runSearch();
    }

    function closeFind() {
      find.open = false;
      find.ranges = [];
      find.index = -1;
      findEl.bar.hidden = true;
      repaint();
      input.focus();
    }

    function replaceCurrent() {
      const range = find.ranges[find.index];
      if (!range) return;
      const replacement = findEl.with.value;
      replaceRange(range[0], range[1], replacement);
      runSearch(true);
      // Land on the match after the one just replaced rather than looping.
      if (find.ranges.length) {
        const after = find.ranges.findIndex(([s]) => s >= range[0]);
        find.index = after === -1 ? 0 : after;
        revealMatch();
        updateCount();
        repaint();
      }
    }

    function replaceAll() {
      if (!find.ranges.length) return;
      const replacement = findEl.with.value;
      const value = input.value;
      let out = "";
      let last = 0;
      for (const [start, end] of find.ranges) {
        out += value.slice(last, start) + replacement;
        last = end;
      }
      out += value.slice(last);
      const count = find.ranges.length;
      // One edit over the whole document, so Ctrl+Z takes the whole
      // replacement back rather than one occurrence at a time.
      replaceRange(0, value.length, out);
      runSearch();
      if (onReplaceAll) onReplaceAll(count);
    }

    findEl.what.addEventListener("input", () => {
      find.needle = findEl.what.value;
      runSearch();
    });
    /* The shortcuts have to work from inside the find fields too. Focus is
       already there after Ctrl+F, so a handler bound only to the textarea
       means Ctrl+H does nothing at exactly the moment you would press it. */
    function findShortcuts(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        findEl.replaceRow.hidden = false;
        findEl.with.focus();
        return true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        findEl.what.focus();
        findEl.what.select();
        return true;
      }
      if (e.key === "Escape") { e.preventDefault(); closeFind(); return true; }
      return false;
    }

    findEl.what.addEventListener("keydown", (e) => {
      if (findShortcuts(e)) return;
      if (e.key === "Enter") { e.preventDefault(); gotoMatch(e.shiftKey ? -1 : 1); }
    });
    findEl.with.addEventListener("keydown", (e) => {
      if (findShortcuts(e)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) replaceAll(); else replaceCurrent();
      }
    });
    host.querySelector(".find-next").addEventListener("click", () => gotoMatch(1));
    host.querySelector(".find-prev").addEventListener("click", () => gotoMatch(-1));
    host.querySelector(".find-close").addEventListener("click", closeFind);
    host.querySelector(".find-one").addEventListener("click", replaceCurrent);
    host.querySelector(".find-all").addEventListener("click", replaceAll);
    findEl.caseBtn.addEventListener("click", () => {
      find.caseSensitive = !find.caseSensitive;
      findEl.caseBtn.classList.toggle("on", find.caseSensitive);
      runSearch();
    });

    repaint();
    drawCurrentLine();

    return {
      openFind, closeFind,
      get findOpen() { return find.open; },
      get value() { return input.value; },
      set value(v) { input.value = v; repaint(); },
      get language() { return current; },
      setLanguage(lang) { current = lang; repaint(); },
      focus() { input.focus(); },
      /** Select a range and scroll it into view — used when jumping to a
          project-search hit. */
      selectRange(start, end) {
        input.focus();
        input.setSelectionRange(start, end);
        const line = input.value.slice(0, start).split("\n").length - 1;
        const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
        input.scrollTop = Math.max(0, line * lineHeight - input.clientHeight / 2);
        input.dispatchEvent(new Event("scroll"));
      },
      isPlain: () => plainMode,
      element: input,
    };
  }

  return { create, HIGHLIGHT_LIMIT };
})();
