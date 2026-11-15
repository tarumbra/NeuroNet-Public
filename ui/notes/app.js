/* ==========================================================================
   Amnesia — a real, standalone, Obsidian-style second brain
   ==========================================================================
   Originally built as "Cortex Collab," one tool among several in a
   larger, shared project. Now fully standalone in its own right —
   Cam: "Change its name to Cortex. Stop referring to it as part of
   cams collective for this app now is fully standalone." Its own
   version history starts fresh from here (v8) rather than continuing
   that earlier project's own numbering.

   Cam's own original brief, still exactly what this app is: "This app
   should allow linking of notes as well and tagging in the same mark
   down style as obsidian. No Canvas boards for this app. However
   should allow attaching photos to notes... It should have folders as
   well. This app will act as my second brain and brain dump."

   Confirmed directly before any of this was built: notes are REAL,
   RAW MARKDOWN TEXT (see amnesia.py's own header for the full
   reasoning) — [[links]] are genuinely just text within a note,
   scanned the same way this file scans them. No graph view
   (deliberately out of scope). Scoped to Obsidian's own real breadth
   — notes, linking, folders, photos, and now PDFs (Cam: "PDF
   capability, this way i can use it to read PDF or even open it
   split view with a note beside it and write notes on what i read").
   #tag support was part of the app's original scope and genuinely
   built, but never worked the way Cam actually writes his notes (his
   real tagging convention turned out to be a backtick-wrapped
   `#tag`, which standard Markdown correctly treats as literal code,
   not a parseable tag), so at Cam's own request the whole feature
   was pulled back out rather than kept as something that half-works.
   [[links]] are unaffected.

   Genuinely standalone application: its own window, its own shell,
   one dark theme with no picker anywhere in it. */

"use strict";

const CC = {};
window.CC = CC;

/* WHERE A FLOATING ELEMENT GOES.

   Amnesia appended its context submenus and its caret-measuring mirror
   to document.body. In KinCrux all of its CSS is scoped under #cx-shell,
   so anything on document.body falls outside that scope and is rendered
   with no styling whatsoever.

   That is exactly what "no options appear when I select highlight" was:
   the submenu was built, filled with the four colours and appended --
   just with no background, no border and no position, so there was
   nothing to see.

   Defined here rather than in the bridge because the bridge loads last;
   this file is the first of the notes files to run. Falls back to
   document.body so app.js still runs standalone. */
CC.uiRoot = () => document.getElementById("cx-shell") || document.body;

/* --------------------------------------------------------------------------
   Store — talks to amnesia.py's own Api.
   -------------------------------------------------------------------------- */
CC.Store = (() => {
  let api = null;

  /* MOVED FROM AMNESIA. This is the only change in the file, and it is
     here rather than at 40-odd call sites because Amnesia put a seam in
     exactly the right place: everything below talks to `api`, never to
     window.pywebview.

     Every method is namespaced on the way through. Amnesia's get_prefs,
     set_prefs and ping collide with KinCrux's own and mean different
     files, and the rest would collide with whatever module arrives
     next. api.read_note(p) becomes notes_read_note(p), and nothing
     above this line had to know. */
  const NS = "notes_";
  const namespaced = () => new Proxy({}, {
    get: (_t, name) => {
      if (typeof name !== "string") return undefined;
      return (...args) => window.CP.Store.call(NS + name, args, "Notes");
    },
    has: () => true,
  });

  const ready = new Promise((resolve) => {
    if (window.CP && window.CP.Store && typeof window.CP.Store.call === "function") {
      api = namespaced();
      resolve();
      return;
    }
    /* the host owns the bridge; if it is not up yet, wait for it */
    let tries = 0;
    const poll = setInterval(() => {
      if (window.CP && window.CP.Store && typeof window.CP.Store.call === "function") {
        clearInterval(poll);
        api = namespaced();
        resolve();
      } else if (++tries > 40) {
        clearInterval(poll);
        resolve();
      }
    }, 25);
  });

  const isDesktop = () => api !== null;

  return {
    ready,
    isDesktop,
    async listTree() { await ready; return isDesktop() ? api.list_tree() : []; },
    /* separate vaults (2026-10-12, Cam: "Think like the seperate cash books") */
    async listVaults() { await ready; return isDesktop() ? api.list_vaults() : {active: "main", vaults: [{id: "main", name: "Main vault"}]}; },
    async switchVault(id) { await ready; return isDesktop() ? api.switch_vault(id) : {error: "Not in this build."}; },
    async newVault(name) { await ready; return isDesktop() ? api.new_vault(name) : {error: "Not in this build."}; },
    async renameVault(id, name) { await ready; return isDesktop() ? api.rename_vault(id, name) : {error: "Not in this build."}; },
    async deleteVault(id) { await ready; return isDesktop() ? api.delete_vault(id) : {error: "Not in this build."}; },
    async vaultFolders(id) { await ready; return isDesktop() ? api.vault_folders(id) : {folders: []}; },
    async moveToVault(path, id, folder) { await ready; return isDesktop() ? api.move_to_vault(path, id, folder || "") : {error: "Not in this build."}; },
    /** Every note's text in one call, for the web of knowledge. */
    async readAllNotes() {
      await ready;
      return isDesktop() ? api.read_all_notes() : {notes: [], truncated: false};
    },
    async readNote(path) {
      await ready; return isDesktop() ? api.read_note(path) : null;
    },
    async writeNote(path, text) {
      await ready; return isDesktop() ? api.write_note(path, text) : {ok: true};
    },
    async createNote(parentPath, name) {
      await ready; return isDesktop() ? api.create_note(parentPath, name)
        : {path: name};
    },
    /* Cam: "have a look at obisidians webpage... I want an in depth
       system implemented into Cortex." A canvas's own real content is
       JSON text (the real JSON Canvas format), so these mirror
       readNote/writeNote/createNote exactly — the frontend owns
       parsing/serializing that JSON itself, the same way it already
       owns rendering markdown from a note's own raw text. */
    async readCanvas(path) {
      await ready; return isDesktop() ? api.read_canvas(path) : null;
    },
    async writeCanvas(path, jsonText) {
      await ready; return isDesktop() ? api.write_canvas(path, jsonText)
        : {ok: true};
    },
    async createCanvas(parentPath, name) {
      await ready; return isDesktop() ? api.create_canvas(parentPath, name)
        : {path: name};
    },
    async createFolder(parentPath, name) {
      await ready; return isDesktop() ? api.create_folder(parentPath, name)
        : {path: name};
    },
    async renameItem(path, newName) {
      await ready; return isDesktop() ? api.rename_item(path, newName)
        : {path: newName};
    },
    async moveItem(path, newParentPath) {
      await ready; return isDesktop() ? api.move_item(path, newParentPath)
        : {path};
    },
    async deleteItem(path) {
      await ready; return isDesktop() ? api.delete_item(path) : {ok: true};
    },
    async duplicateItem(path) {
      await ready; return isDesktop() ? api.duplicate_item(path) : {path};
    },
    /* notes that ship with releases (2026-10-11) */
    async shipList() { await ready; return isDesktop() ? api.ship_list() : []; },
    async setShip(path, on) { await ready; return isDesktop() ? api.set_ship(path, on) : {paths: []}; },
    /* ticks and flags, the archive (2026-11-02) */
    async marksList() { await ready; return isDesktop() ? api.marks_list() : {}; },
    async setMark(path, mark) { await ready; return isDesktop() ? api.set_mark(path, mark) : {marks: {}}; },
    async archiveItem(path) { await ready; return isDesktop() ? api.archive_item(path) : {ok: true}; },
    async showInFileManager(path) {
      await ready;
      return isDesktop() ? api.show_in_file_manager(path) : {ok: true};
    },
    async openInDefaultApp(path) {
      await ready;
      return isDesktop() ? api.open_in_default_app(path) : {ok: true};
    },
    async saveImage(name, dataUrl) {
      await ready; return isDesktop() ? api.save_image(name, dataUrl) : name;
    },
    async imageURL(name) {
      await ready; return isDesktop() ? api.image_url(name) : null;
    },
    /* v171 — "Add insert photo to right click." A native file dialog
       genuinely can't work outside the real desktop app (no
       window.pywebview there at all), so both fall back to an
       obviously-empty result rather than throwing — insertImageFlow
       is the one place that turns "cancelled" vs "nothing picked"
       into the right toast for each. */
    async pickImage() {
      await ready; return isDesktop() ? api.pick_image() : {cancelled: true};
    },
    async attachImages(paths) {
      await ready; return isDesktop() ? api.attach_images(paths)
        : {saved: [], skipped: []};
    },
    /* Cam: "Does canvas allow me to add photos onto the canvas as
       well?" -> "Pick from existing attachments". */
    async listAttachments() {
      await ready; return isDesktop() ? api.list_attachments() : [];
    },
    /* Cam: "PDF capability, this way i can use it to read PDF or even
       open it split view with a note beside it and write notes on
       what i read." Modeled directly on imageURL/pickImage/
       attachImages above — pdfData reads a PDF's own real bytes back
       out as a base64 data URL (see amnesia.py's own
       _pdf_as_data_url), pickPdf/importPdfs bring a new one in. */
    async pdfData(path) {
      await ready; return isDesktop() ? api.pdf_data(path) : null;
    },
    async pickPdf() {
      await ready; return isDesktop() ? api.pick_pdf() : {cancelled: true};
    },
    async importPdfs(paths, destFolderPath) {
      await ready; return isDesktop()
        ? api.import_pdfs(paths, destFolderPath)
        : {saved: [], skipped: []};
    },
    async getPrefs() {
      await ready; return isDesktop() ? api.get_prefs() : {};
    },
    async setPrefs(prefs) {
      await ready; return isDesktop() ? api.set_prefs(prefs) : {ok: true};
    },
  };
})();

/* --------------------------------------------------------------------------
   Toast / confirm / prompt — small, self-contained UI helpers.
   -------------------------------------------------------------------------- */
CC.toast = (msg, kind = "ok") => {
  const box = document.getElementById("cx-toasts");
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
};

CC.confirm = ({title, body, fine = "", yes = "Continue", danger = false}) => {
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-confirm-veil");
    veil.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <h3></h3><p></p><p class="fine"></p>
        <div class="row">
          <button class="btn btn-quiet" data-act="no">Cancel</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}"
                  data-act="yes"></button>
        </div>
      </div>`;
    veil.querySelector("h3").textContent = title;
    veil.querySelector("p").textContent = body;
    veil.querySelector(".fine").textContent = fine;
    veil.querySelector("[data-act=yes]").textContent = yes;
    const close = (answer) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      resolve(answer);
    };
    veil.querySelector("[data-act=no]").onclick = () => close(false);
    veil.querySelector("[data-act=yes]").onclick = () => close(true);
    veil.onclick = (e) => { if (e.target === veil) close(false); };
    veil.classList.add("open");
    veil.querySelector("[data-act=yes]").focus();
  });
};

CC.prompt = ({title, body = "", placeholder = "", value = "",
             yes = "Create"}) => {
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3></h3><p></p>
        <input type="text" id="cx-prompt-input">
        <div class="row">
          <button class="btn btn-quiet" data-act="no">Cancel</button>
          <button class="btn btn-primary" data-act="yes"></button>
        </div>
      </div>`;
    veil.querySelector("h3").textContent = title;
    const bodyEl = veil.querySelector("p");
    if (body) bodyEl.textContent = body; else bodyEl.remove();
    const input = veil.querySelector("#cx-prompt-input");
    input.placeholder = placeholder;
    input.value = value;
    veil.querySelector("[data-act=yes]").textContent = yes;
    const close = (answer) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      resolve(answer);
    };
    veil.querySelector("[data-act=no]").onclick = () => close(null);
    veil.querySelector("[data-act=yes]").onclick = () =>
      close(input.value.trim() || null);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(input.value.trim() || null);
      if (e.key === "Escape") close(null);
    });
    veil.onclick = (e) => { if (e.target === veil) close(null); };
    veil.classList.add("open");
    input.focus();
    input.select();
  });
};

/* ============================================================================
   MARKDOWN — a small, focused markdown -> HTML renderer, and the
   [[link]] extractor every other piece of this app builds on.
   Deliberately NOT a full CommonMark implementation — the realistic,
   common subset Obsidian notes actually use, the same scoping
   principle the main app's own markdown importer already established
   (see that file's own header, ui/tools/cortex.js, for the reasoning
   behind leaving single-underscore italic out on purpose).
   ============================================================================ */
CC.md = (() => {
  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** [[Note Title]] or [[Note Title|Display Text]] -> every distinct
      title linked from this text, in first-appearance order. The
      exact regex Cam's Cortex's own linkTitles already uses
      (ui/tools/cortex.js) for the bracket-matching itself, extended
      for Obsidian's own "|alias" piped-display-text syntax, which
      Cam's Cortex has no equivalent of at all since it never needed
      one. */
  function extractLinks(text) {
    const out = [];
    const re = /(?<!!)\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g;
    let m;
    while ((m = re.exec(text))) {
      const title = m[1].trim();
      if (title && !out.includes(title)) out.push(title);
    }
    return out;
  }

  /** One line's own inline markdown -> HTML: **bold**, *italic*,
      ***both***, `code`, [[links]] (rendered as a real, clickable
      anchor — resolution of whether the target exists happens here
      via existingTitles, a Set the caller already knows, not a
      second lookup), ![[embeds]]/![alt](src) images, and
      [text](url) external links. Order matters: images and links are
      pulled out (and replaced with placeholders) BEFORE bold/italic
      scanning, so a URL or filename containing an underscore or
      asterisk is never misread as emphasis — the same class of bug
      the main app's own importer deliberately avoids by leaving
      single-underscore italic out entirely; here the fix is
      resolving the more specific, less ambiguous syntax first. */
  function renderInline(text, {existingTitles, resolveImage}) {
    const placeholders = [];
    const stash = (html) => {
      placeholders.push(html);
      return `\u0000${placeholders.length - 1}\u0000`;
    };

    // code spans FIRST, before anything else — inline code has the
    // highest precedence in real markdown: whatever's inside it is
    // shown completely literally, protected from every other kind of
    // interpretation (a real bug, found by directly testing a code
    // span wrapping "<u>text</u>": with <u>-matching running first,
    // its content got converted to a real <u> tag before the code-
    // span regex ever saw it, so the code span ended up wrapping the
    // now-broken internal placeholder token and leaking it straight
    // into the visible output). escapeHtml is applied explicitly
    // here, since the single, later, global escapeHtml() call below
    // no longer reaches this already-stashed content.
    text = text.replace(/`([^`\n]+)`/g,
      (_all, code) => stash(`<code>${escapeHtml(code)}</code>`));

    // images next: ![[name]] or ![[name|alt]], and ![alt](src)
    text = text.replace(/!\[\[([^\[\]|]+?)(?:\|([^\[\]]*))?\]\]/g,
      (_all, name, alt) => stash(
        `<img data-cx-embed="${escapeHtml(name.trim())}" alt="${
          escapeHtml((alt || name).trim())}">`));
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (_all, alt, src) => stash(
        `<img data-cx-embed="${escapeHtml(src.trim())}" alt="${
          escapeHtml(alt)}">`));

    // [[links]] next
    text = text.replace(/\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g,
      (_all, title, display) => {
        const t = title.trim();
        const exists = existingTitles.has(t.toLowerCase());
        return stash(`<a class="cx-wikilink${exists ? "" : " cx-broken"}" `
          + `data-cx-link="${escapeHtml(t)}">${
            escapeHtml((display || t).trim())}</a>`);
      });

    // ordinary [text](url) links (never matches an already-stashed
    // image, since those are gone from the text by this point)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_all, label, url) => stash(
        `<a data-cx-ext="${escapeHtml(url)}">${escapeHtml(label)}</a>`));

    // <u>underline</u> — markdown itself has no standard underline
    // syntax; Obsidian's own real behaviour is to render a narrow set
    // of inline HTML tags, <u> among them, so this matches that one,
    // specific, literal tag only (never general HTML) — the inner
    // text is still escaped below, so this can never become an
    // arbitrary-HTML vector even from a hostile imported note.
    text = text.replace(/<u>([^<]*)<\/u>/gi,
      (_all, inner) => stash(`<u>${escapeHtml(inner)}</u>`));

    // escape whatever real text is left, THEN do bold/italic so
    // formatting markers in already-escaped HTML (the placeholders
    // above) are never touched
    text = escapeHtml(text);

    // bold/italic/strikethrough — same linear tokeniser shape the
    // main app's own markdown importer already uses (mdInlineRuns,
    // ui/tools/cortex.js), single-underscore italic deliberately
    // excluded for the same reason: it silently mangles ordinary text
    // with underscores in it (file_names, snake_case) far too easily.
    let out = "";
    let bold = false, italic = false, strike = false, mark = false;
    let i = 0;
    while (i < text.length) {
      const three = text.slice(i, i + 3);
      const two = text.slice(i, i + 2);
      if (three === "***" || three === "___") {
        out += bold && italic ? "</em></strong>"
          : (bold ? "<em>" : italic ? "<strong>" : "<strong><em>");
        if (bold && italic) { bold = false; italic = false; }
        else { bold = true; italic = true; }
        i += 3;
      } else if (two === "**" || two === "__") {
        out += bold ? "</strong>" : "<strong>";
        bold = !bold;
        i += 2;
      } else if (two === "~~") {
        out += strike ? "</del>" : "<del>";
        strike = !strike;
        i += 2;
      } else if (two === "==") {
        // Cam: "highlight... the same colour highlight applied to
        // cells on hover" — <mark> is the one real HTML element built
        // for exactly this, and ==text== is Obsidian's own real
        // markdown syntax for it (not a Amnesia invention),
        // matching the "real markdown, not a structured format" rule
        // every other syntax choice in this parser already follows.
        // v16 — Cam: "have the ability to change the highlighter
        // color. Green, purple, blue and yellow please." Vanilla
        // Obsidian itself has no single, canonical syntax for a
        // colored highlight (confirmed directly — it's only ever
        // done via community plugins, each with its own different
        // syntax), so =={color}text== is this app's own — an
        // optional colour marker right after the opening ==, checked
        // ONLY when opening a fresh mark (mark is currently false),
        // and only ever a real, known colour name — anything else
        // (including plain ==text==, still the far more common case)
        // falls through to the same plain, unmarked <mark> as always,
        // so nothing here changes for a note that predates this
        // feature entirely.
        if (!mark) {
          const colorMatch = text.slice(i + 2)
            .match(/^\{(yellow|green|purple|blue)\}/);
          if (colorMatch) {
            out += `<mark class="cx-hl-${colorMatch[1]}">`;
            mark = true;
            i += 2 + colorMatch[0].length;
            continue;
          }
        }
        out += mark ? "</mark>" : "<mark>";
        mark = !mark;
        i += 2;
      } else if (text[i] === "*") {
        out += italic ? "</em>" : "<em>";
        italic = !italic;
        i += 1;
      } else {
        out += text[i];
        i += 1;
      }
    }
    // any tag left open by malformed input (an odd number of markers)
    // is closed out here rather than left to corrupt the rest of the
    // page's own DOM structure
    if (italic) out += "</em>";
    if (bold) out += "</strong>";
    if (strike) out += "</del>";
    if (mark) out += "</mark>";

    // restore every stashed placeholder
    out = out.replace(/\u0000(\d+)\u0000/g, (_all, idx) =>
      placeholders[Number(idx)]);
    return out;
  }

  /** The full render: a markdown string -> an HTML string, given the
      set of note titles that currently exist (so a [[link]] can be
      styled as broken/not-yet-created) and an image resolver (async,
      called after the HTML is inserted — see wireImages below,
      app.js — since a data: URL lookup is itself async and HTML
      strings can't await anything mid-render). */
  function render(md, existingTitles) {
    const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let para = [];
    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${para.map((line) =>
          renderInline(line, {existingTitles})).join("<br>")}</p>`);
      }
      para = [];
    };
    while (i < lines.length) {
      const line = lines[i];

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushPara();
        const level = Math.min(h[1].length, 3);
        out.push(`<h${level}>${
          renderInline(h[2].trim(), {existingTitles})}</h${level}>`);
        i++; continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
        flushPara(); out.push("<hr>"); i++; continue;
      }

      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        flushPara();
        const codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          codeLines.push(lines[i]); i++;
        }
        i++; // skip the closing fence
        const lang = fence[1] || "";
        /* A Grid is a spreadsheet stored in the note as a ```grid block.
           It is drawn as an empty holder carrying its own text, and
           grid-view.js turns that into the working grid after render. The
           text rides on the element so that turning the page back into
           Markdown can write it out exactly -- see serializeBlock. */
        if (lang === "grid") {
          out.push(`<div class="ss-grid" contenteditable="false" data-grid-src="${
            encodeURIComponent(codeLines.join("\n"))}"></div>`);
          continue;
        }
        /* The language is kept on the element. It used to be dropped here
           and never written back, so a ```python block came back as bare
           ``` the first time its note was edited in the editable view. */
        out.push(`<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}><code>${
          escapeHtml(codeLines.join("\n"))}</code></pre>`);
        continue;
      }

      const bq = line.match(/^\s*>\s?(.*)$/);
      if (bq) {
        flushPara();
        const bqLines = [bq[1]];
        i++;
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          bqLines.push(lines[i].replace(/^\s*>\s?/, "")); i++;
        }
        out.push(`<blockquote>${
          renderInline(bqLines.join(" "), {existingTitles})}</blockquote>`);
        continue;
      }

      const nextLine = lines[i + 1];
      if (line.includes("|") && nextLine !== undefined
          && /^\s*\|?[\s:|-]+\|?\s*$/.test(nextLine) && nextLine.includes("-")) {
        flushPara();
        const parseRow = (l) => l.trim().replace(/^\|/, "")
          .replace(/\|$/, "").split("|").map((c) => c.trim());
        const header = parseRow(line);
        const widths = parseColumnWidths(nextLine, header.length);
        let j = i + 2;
        const rows = [];
        while (j < lines.length && lines[j].includes("|")) {
          rows.push(parseRow(lines[j])); j++;
        }
        let html = "<table" + (widths ? ' class="cx-sized"' : "") + ">"
          + colgroupHtml(widths)
          + "<thead><tr>" + header.map((c) =>
          `<th>${renderInline(c, {existingTitles})}</th>`).join("")
          + "</tr></thead><tbody>";
        for (const row of rows) {
          html += "<tr>" + row.map((c) =>
            `<td>${renderInline(c, {existingTitles})}</td>`).join("") + "</tr>";
        }
        html += "</tbody></table>";
        out.push(html);
        i = j; continue;
      }

      const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const numbered = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (bullet || numbered) {
        flushPara();
        const tag = bullet ? "ul" : "ol";
        const rawItems = [];   // each: array of its own lines - the
                               // first (with its own marker) plus any
                               // lazy continuation lines after it
        while (i < lines.length) {
          const bm = lines[i].match(/^(\s*)[-*+]\s+(.*)$/);
          const nm = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
          const match = bullet ? bm : nm;
          if (match) {
            rawItems.push([match[2]]);
            i++;
          } else if (lines[i].trim() !== "" && rawItems.length) {
            // a lazy continuation - a wrapped line with no marker of
            // its own belongs to the item directly above it, the
            // same real markdown behaviour most renderers support;
            // without this, any multi-line bullet point silently
            // breaks the list into a stray paragraph instead
            rawItems[rawItems.length - 1].push(lines[i].trim());
            i++;
          } else {
            break;
          }
        }
        /* v300 — Cam: "in view mode allow me to ... click boxes."
           Task list items ("- [ ] thing" / "- [x] thing") render as a
           real, tickable checkbox rather than the literal characters
           "[ ]". data-cx-task carries the item's own index within
           this list so a tick can be written back to the exact right
           line of the real markdown afterwards, without having to
           re-match on the item's text (which would break the moment
           two items on one list said the same thing). */
        const items = rawItems.map((itemLines, itemIdx) => {
          const raw = itemLines.join(" ");
          const tm = raw.match(/^\[([ xX])\]\s+([\s\S]*)$/);
          if (!tm) {
            return `<li>${renderInline(raw, {existingTitles})}</li>`;
          }
          const done = tm[1].toLowerCase() === "x";
          return `<li class="cx-task${done ? " cx-task-done" : ""}">`
            + `<span class="cx-checkbox${done ? " cx-checkbox-on" : ""}" `
            + `data-cx-task="${itemIdx}" contenteditable="false" `
            + `role="checkbox" aria-checked="${done}" tabindex="0">`
            + `${done ? "\u2713" : ""}</span>`
            + `<span class="cx-task-text">`
            + `${renderInline(tm[2], {existingTitles})}</span></li>`;
        });
        const hasTask = items.some((h) => h.includes("cx-task"));
        out.push(`<${tag}${hasTask ? ' class="cx-task-list"' : ""}>`
          + `${items.join("")}</${tag}>`);
        continue;
      }

      if (line.trim() === "") { flushPara(); i++; continue; }

      para.push(line.trim());
      i++;
    }
    flushPara();
    return out.join("\n");
  }

  return {render, extractLinks, renderInline, escapeHtml};
})();

/* ============================================================================
   STATE
   ============================================================================ */
let tree = [];
let titleToPath = new Map();     // lowercase title -> vault-relative path
let allNotes = [];               // flat list of {title, path}, for search/link-autocomplete
const collapsed = new Set();     // folder paths currently collapsed
/* Cam (2026-10-03): "in notes in neuronet i want to be able to select a
   note and press delete to delete it." What is chosen in the sidebar: a
   click chooses one (and opens it, as before), Ctrl+click adds or takes
   away one more. Delete with the sidebar focused deletes them -- still
   through the same "can't be undone" question as the right-click menu. */
const treeSel = new Set();
let currentPath = null;
let currentType = "note";        // "note" | "pdf" — what's actually
                                 // open in the primary pane right now
let currentText = "";
let dirty = false;
let mode = "edit";        // "edit" | "preview" (labeled "View")
/* v300 — Cam: "Merge to two modes — Edit + View (View is
   interactive)". "viewEdit" (the old "Data Entry") is gone as a
   separate mode; View itself is now the rendered, directly-editable
   page it used to be. normalizeMode() below still maps the old value
   to "preview" so a prefs.json written by an older build (or an open
   tab snapshot carrying mode:"viewEdit") lands somewhere real
   instead of falling through to a branch that no longer exists. */
const MODES = ["edit", "preview"];
const normalizeMode = (m) => (m === "viewEdit" ? "preview"
  : (MODES.includes(m) ? m : "edit"));
let saveTimer = null;
let viewZoom = 100;               // percentage, View mode text size

/* Cam: "A Tab like feature like obsidian." Each tab: {path, text,
   dirty, type} — path === null means an empty "New tab", matching
   Obsidian's own real empty-tab screen exactly. type ("note" | "pdf")
   was added for PDF support — Cam: "PDF capability, this way i can
   use it to read PDF or even open it split view with a note beside
   it" — so switching tabs restores not just WHICH file is open but
   what KIND of viewer belongs on screen for it. Deliberately a
   separate snapshot store, not a replacement for currentPath/
   currentType/currentText/dirty above: those stay the single source
   of truth for "what's on screen right now" everywhere else in this
   file already does, and tabs[] is only read from / written to at
   the moment of actually switching tabs — see switchToTab(). (mode is
   NOT part of a tab's own snapshot — see MODES above: it's one
   global, persistent setting for the whole app now, not per tab.) */
let tabs = [];
let activeTabIndex = -1;

/* v291 — Cam: "the split view mode where i can open 2 notes side by
   side." One optional second pane, deliberately NOT a second tab
   strip: {path, text, dirty, mode} — everything a single note on
   screen needs, all in one object rather than a second set of bare
   globals, since (unlike the primary pane) there's no pre-existing
   pile of code that already assumes bare currentPath/currentText/
   dirty/mode singletons to work around. null means the split pane
   isn't open at all — #cx-split-area stays display:none and nothing
   below ever runs. The two panes are fully independent once opened:
   editing the SAME note in both is allowed (Obsidian allows it too),
   but there's no live sync between them — whichever pane saves last
   wins on disk, the same last-write-wins reality any two independent
   editors on one file would have. */
let splitPane = null;
let splitSaveTimer = null;
/* v12 — Cam: "make the sides of the screen resizable, by draging the
   middle to either side." null means the default, even 50/50 split;
   a real number (a percentage, clamped 20-80) once Cam has actually
   dragged the divider — persisted the same way viewZoom/mode/
   sidebarHidden already are, so a chosen split survives across notes,
   sessions, and a full restart. */
let splitRatio = null;
let dividerDragActive = false;
/* v14 — Cam: "add a ctrl+z for undo feature within Cortex." A real,
   custom undo system, not a reliance on the browser's own native
   textarea/contenteditable undo — confirmed directly, not assumed,
   that native undo wouldn't hold up here anyway: nearly every
   formatting shortcut and every table/highlight operation in this
   app sets .value or mutates the DOM directly rather than through
   document.execCommand, the one API that would keep a native undo
   stack consistent, and setting .value directly is well known to
   clear a textarea's own native undo history outright.
   Keyed by pane ("primary" | "split"), each holding a bounded stack
   of past text snapshots (undo) and undone-and-redoable ones (redo).
   Deliberately reset whenever a DIFFERENT note or PDF is opened into
   that pane, rather than kept per-tab across switches — undoing a
   recent mistake in whatever's currently on screen is the real,
   common case, and scoping it that way is far simpler to get
   genuinely right than threading a separate history through every
   tab-lifecycle function (switchToTab already fully replaces the
   outgoing tab's own object wholesale, which would silently wipe any
   new fields added there). */
let undoState = {
  primary: {stack: [], redoStack: [], lastPushAt: 0},
  split: {stack: [], redoStack: [], lastPushAt: 0},
};
const UNDO_COALESCE_MS = 700;
const UNDO_MAX_DEPTH = 200;

/* v292 — Cam: "an active note feature, think my hyprland set up,
   where one window is active at one time." Tracks which pane a
   pane-scoped shortcut (Ctrl+E, Ctrl+Alt+1/2/3 — see the keydown
   handlers in boot()) should act on. Formatting shortcuts (Ctrl+B and
   friends) don't need this at all: they fire as native keydown events
   on whichever textarea/contenteditable actually has focus, so they
   were already correctly pane-scoped once commitEdit() itself was
   fixed to check e.target rather than assuming the primary pane (see
   the big comment on commitEdit). activePane exists specifically for
   the shortcuts that DON'T receive an element to key off of — only
   meaningful while splitPane is actually open; single-pane, it's
   always "primary" and never checked. */
let activePane = "primary";   // "primary" | "split"

function setActivePane(pane) {
  if (activePane === pane) return;
  activePane = pane;
  updateActivePaneIndicator();
}

/* the Hyprland-style border itself — only shown once there are
   actually two panes to tell apart; see updateActivePaneIndicator's
   callers (openInSplit turns it on, closeSplit turns it back off). */
function updateActivePaneIndicator() {
  const primaryEl = document.getElementById("cx-editor-area");
  const splitEl = document.getElementById("cx-split-area");
  if (primaryEl) {
    primaryEl.classList.toggle("cx-pane-active",
      !!splitPane && activePane === "primary");
  }
  if (splitEl) {
    splitEl.classList.toggle("cx-pane-active",
      !!splitPane && activePane === "split");
  }
}

function flattenNotes(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === "note") out.push({title: n.name, path: n.path});
    else if (n.children) flattenNotes(n.children, out);
  }
  return out;
}

/** Every note AND PDF in the vault, depth-first — deliberately a
    separate helper from flattenNotes above rather than extending it:
    flattenNotes feeds [[link]] autocomplete and titleToPath, and a
    [[link]] should only ever be able to point at a note, never a PDF
    — the data source for the "Open note or PDF" picker below
    instead, Cam: "Ability to click open note when i start a new
    tab." */
function flattenOpenable(nodes, out = []) {
  for (const n of nodes) {
    if (n.type === "note" || n.type === "pdf") {
      out.push({title: n.name, path: n.path, type: n.type});
    } else if (n.children) {
      flattenOpenable(n.children, out);
    }
  }
  return out;
}

/* every folder in the vault, depth-first, with its own nesting depth
   — the data source for the "Move to..." picker below */
function flattenFolders(nodes, depth = 0, out = []) {
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push({name: n.name, path: n.path, depth});
      flattenFolders(n.children, depth + 1, out);
    }
  }
  return out;
}

/* notes that ship with releases (2026-10-11, Cam: "add a check box where i can select notes to ship along in the
   future"): the vault paths, a folder shipping everything inside it */
let shipped = new Set();
/* ticks and flags (2026-11-02, Cam: "right click a note ... and put a tick or flag next to it ... flag anything for
   review or tick what i have done"): {path: "tick" | "flag"}, the open vault's, from <notes>/marks.json */
let marks = {};
const MARK_HTML = {tick: `<span class="cx-mark cx-mark-tick" title="Ticked: done">✓</span>`, flag: `<span class="cx-mark cx-mark-flag" title="Flagged for review">⚑</span>`};
const markHTML = (path) => MARK_HTML[marks[path]] || "";
const isShipped = (path) => [...shipped].some((p) => path === p || path.startsWith(p + "/"));
/* folders start collapsed (2026-10-12, Cam: "i want the notes sidebar to be collapsed by default. It is disjointing
   opening it and seeing everything open"): the first time Notes sees a folder -- when it opens, or a folder that's
   new since -- it's folded away, unless the note on screen is inside it, so you still see where you are. What you
   open or fold by hand afterwards stays as you left it. */
const seenFolders = new Set();
function foldNewFolders() {
  flattenFolders(tree).forEach((f) => {
    if (seenFolders.has(f.path)) return;
    seenFolders.add(f.path);
    const holdsOpen = [currentPath, splitPane && splitPane.path].some((p) => p && p.startsWith(f.path + "/"));
    if (!holdsOpen) collapsed.add(f.path);
  });
}
async function refreshTree() {
  try { shipped = new Set(await CC.Store.shipList() || []); } catch (e) { shipped = new Set(); }
  try { const m = await CC.Store.marksList(); marks = m && !m.error ? m : {}; } catch (e) { marks = {}; }
  tree = await CC.Store.listTree();
  foldNewFolders();
  allNotes = flattenNotes(tree);
  titleToPath = new Map(allNotes.map((n) => [n.title.toLowerCase(), n.path]));
  renderTree();
}

/* separate vaults (2026-10-12, Cam: "Another feature would be seperate vaults. Think like the seperate cash
   books."): a bar at the top of the sidebar says which vault is open; switch, make a new one, rename or delete
   one. The main vault is the one there's always been (Fleeting notes and shipping stay with it); a new vault
   starts empty. Switching saves what's open, closes the tabs and shows the other vault's tree. */
let vaultsInfo = {active: "main", vaults: [{id: "main", name: "Main vault"}]};
const vaultName = (id) => ((vaultsInfo.vaults || []).find((v) => v.id === id) || {}).name || "Main vault";
async function loadVaults() {
  try { const v = await CC.Store.listVaults(); if (v && !v.error && Array.isArray(v.vaults)) vaultsInfo = v; } catch (e) { /* the main vault */ }
  renderVaultBar();
}
function renderVaultBar() {
  const bar = document.getElementById("cx-vault-bar");
  if (!bar) return;
  const a = vaultsInfo.active;
  bar.innerHTML = `
    <select id="cx-vault-pick" title="The vault that's open" aria-label="Vault">
      ${vaultsInfo.vaults.map((v) => `<option value="${CC.md.escapeHtml(v.id)}" ${v.id === a ? "selected" : ""}>${CC.md.escapeHtml(v.name)}</option>`).join("")}
    </select>
    <button class="cx-vault-btn" id="cx-vault-new" title="A new, empty vault">New</button>
    <button class="cx-vault-btn" id="cx-vault-rename" title="Rename this vault">Rename</button>
    ${a !== "main" ? `<button class="cx-vault-btn" id="cx-vault-delete" title="Delete this vault">Delete</button>` : ""}`;
  bar.querySelector("#cx-vault-pick").onchange = (e) => switchVault(e.target.value);
  bar.querySelector("#cx-vault-new").onclick = async () => {
    const name = await CC.prompt({title: "New vault", body: "A vault of its own: its own notes, folders and pictures. It starts empty.",
      placeholder: "What's it for? (a name)", yes: "Make the vault"});
    if (!name) return;
    await leaveVault();
    const r = await CC.Store.newVault(name);
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    await enterVault(r, `“${name}” is ready. It's empty -- make a note, or import some.`);
  };
  bar.querySelector("#cx-vault-rename").onclick = async () => {
    const name = await CC.prompt({title: "Rename the vault", value: vaultName(a), yes: "Rename"});
    if (!name || name === vaultName(a)) return;
    const r = await CC.Store.renameVault(a, name);
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    vaultsInfo = r; renderVaultBar();
  };
  const del = bar.querySelector("#cx-vault-delete");
  if (del) del.onclick = async () => {
    const name = vaultName(a);
    const ok = await CC.confirm({title: `Delete “${name}”?`, body: "Every note, folder and picture in it goes with it.",
      fine: "It isn't erased straight away: the folder is moved to notes/deleted vaults, so it can be fetched back by hand. The other vaults aren't touched.",
      yes: "Delete it", danger: true});
    if (!ok) return;
    await leaveVault();
    const r = await CC.Store.deleteVault(a);
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    await enterVault(r, `“${name}” is deleted. You're in ${vaultName(r.active)}.`);
  };
}
/** Save what's open and close it all: the tabs and the split belong to the vault you're leaving. */
async function leaveVault() {
  if (dirty) await flushSave();
  await closeSplit();
  tabs = [{path: null, text: "", dirty: false, type: "note"}];
  activeTabIndex = 0;
  currentPath = null; currentType = "note"; currentText = ""; dirty = false;
  resetUndoHistory("primary");
}
async function enterVault(info, msg) {
  vaultsInfo = info;
  collapsed.clear(); seenFolders.clear(); treeSel.clear();
  const search = document.getElementById("cx-search"); if (search) search.value = "";
  renderVaultBar();
  renderTabBar();
  showEmptyState();
  await refreshTree();
  if (msg) CC.toast(msg);
}
async function switchVault(id) {
  if (id === vaultsInfo.active) return;
  await leaveVault();
  const r = await CC.Store.switchVault(id);
  if (r && r.error) { CC.toast(r.error, "error"); renderVaultBar(); return; }
  await enterVault(r, `Vault: ${vaultName(id)}.`);
}

/* ============================================================================
   SIDEBAR TREE
   ============================================================================ */
const ICON_FOLDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2"><path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0
  0 1-1 1H4a1 1 0 0 1-1-1Z"/></svg>`;
const ICON_NOTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2"><path d="M6 2h9l5 5v15H6Z"/><path d="M14 2v6h6"/></svg>`;
const ICON_PDF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2"><path d="M6 2h9l5 5v15H6Z"/><path d="M14 2v6h6"/>
  <path d="M9 13h6M9 16h6M9 10h2" stroke-width="1.6"/></svg>`;
const ICON_CANVAS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/>
  <rect x="5" y="7" width="6" height="4" rx="0.5" stroke-width="1.6"/>
  <rect x="13" y="8.5" width="6" height="5" rx="0.5" stroke-width="1.6"/>
  <rect x="6" y="14" width="5" height="4" rx="0.5" stroke-width="1.6"/></svg>`;
const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0
  0-5.66-5.66l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0
  0 0 5.66 5.66l1.5-1.5"/></svg>`;
const ICON_CARET = `<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M8 5v14l11-7Z"/></svg>`;

function treeRowHTML(node) {
  if (node.type === "folder") {
    const isCollapsed = collapsed.has(node.path);
    const childrenHtml = node.children.map(treeRowHTML).join("");
    return `
      <div class="cx-tree-item" data-path="${CC.md.escapeHtml(node.path)}"
           data-type="folder">
        <div class="cx-tree-row ${isCollapsed ? "cx-collapsed" : ""}${
          treeSel.has(node.path) ? " cx-selected" : ""}">
          <span class="cx-caret">${ICON_CARET}</span>
          <span class="cx-row-icon">${ICON_FOLDER}</span>
          <span class="cx-row-label">${CC.md.escapeHtml(node.name)}</span>${markHTML(node.path)}${isShipped(node.path) ? `<span class="cx-ship-mark" title="Ships with releases">⇪</span>` : ""}
        </div>
        <div class="cx-tree-children ${isCollapsed ? "cx-hidden" : ""}">${
          childrenHtml}</div>
      </div>`;
  }
  const icon = node.type === "pdf" ? ICON_PDF
    : node.type === "canvas" ? ICON_CANVAS : ICON_NOTE;
  return `
    <div class="cx-tree-item" data-path="${CC.md.escapeHtml(node.path)}"
         data-type="${node.type}">
      <div class="cx-tree-row ${node.path === currentPath ? "cx-active" : ""}${
        treeSel.has(node.path) ? " cx-selected" : ""}">
        <span class="cx-caret" style="visibility:hidden">${ICON_CARET}</span>
        <span class="cx-row-icon">${icon}</span>
        <span class="cx-row-label">${CC.md.escapeHtml(node.name)}</span>${markHTML(node.path)}${isShipped(node.path) ? `<span class="cx-ship-mark" title="Ships with releases">⇪</span>` : ""}
      </div>
    </div>`;
}

/* v297 — Cam: "Obsidian has a very small animation detail, when
   expanding and collapsing a folder it doesn't do it instantly... it
   presents each item in the list from the top to the bottom with the
   smallest delay... When collapsing it goes from bottom to top."
   Deliberately does NOT go through renderTree() at all for a plain
   toggle — nothing about the underlying DATA changed, just which
   folders are open, so a full sidebar rebuild has no reason to
   happen (and would replay this same animation on every row in the
   tree, not just the one folder Cam actually clicked, since
   renderTree()'s own children are all freshly created DOM nodes
   every time it runs). Direct, targeted DOM work on just this one
   folder's own already-existing children instead.
   Capped stagger (never more than 12 items' worth of delay) so a
   folder with dozens of notes in it doesn't turn a quick toggle into
   a multi-second wait — everything past the 12th item animates
   together with the 12th, still clearly staggered for what's
   actually visible without a screenful of scrolling.
   Collapsing waits for the animate-out to actually finish before
   applying display:none (a bare class swap is instant and would
   never leave time for anything to play) — but re-checks `collapsed`
   right before hiding, so clicking to re-expand mid-collapse doesn't
   get its own state clobbered by the stale timeout that was already
   in flight. prefers-reduced-motion skips the stagger entirely and
   applies the end state immediately, same as a plain toggle always
   did before this existed. */
const CX_STAGGER_STEP_MS = 22;
const CX_STAGGER_ITEM_MS = 140;
const CX_STAGGER_MAX_STEPS = 12;

function toggleFolder(item, path) {
  const childrenEl = item.querySelector(":scope > .cx-tree-children");
  const row = item.querySelector(":scope > .cx-tree-row");
  const kids = [...childrenEl.children];
  const reduceMotion = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (collapsed.has(path)) {
    // ---- EXPANDING: top to bottom ----
    collapsed.delete(path);
    row.classList.remove("cx-collapsed");
    childrenEl.classList.remove("cx-hidden");
    if (reduceMotion) return;
    kids.forEach((kid, i) => {
      const delay = Math.min(i, CX_STAGGER_MAX_STEPS) * CX_STAGGER_STEP_MS;
      kid.style.animation = `cx-tree-item-in ${CX_STAGGER_ITEM_MS}ms ease `
        + `both`;
      kid.style.animationDelay = `${delay}ms`;
      kid.addEventListener("animationend", () => {
        kid.style.animation = "";
        kid.style.animationDelay = "";
      }, {once: true});
    });
  } else {
    // ---- COLLAPSING: bottom to top, THEN actually hide ----
    collapsed.add(path);
    row.classList.add("cx-collapsed");
    if (reduceMotion) { childrenEl.classList.add("cx-hidden"); return; }
    const n = kids.length;
    let maxDelay = 0;
    kids.forEach((kid, i) => {
      const reverseIndex = n - 1 - i;   // last item animates first
      const delay = Math.min(reverseIndex, CX_STAGGER_MAX_STEPS)
        * CX_STAGGER_STEP_MS;
      maxDelay = Math.max(maxDelay, delay);
      kid.style.animation = `cx-tree-item-out ${CX_STAGGER_ITEM_MS}ms ease `
        + `both`;
      kid.style.animationDelay = `${delay}ms`;
    });
    setTimeout(() => {
      if (collapsed.has(path)) childrenEl.classList.add("cx-hidden");
      kids.forEach((kid) => {
        kid.style.animation = "";
        kid.style.animationDelay = "";
      });
    }, maxDelay + CX_STAGGER_ITEM_MS);
  }
}

function renderTree() {
  const el = document.getElementById("cx-tree");
  if (!tree.length) {
    el.innerHTML = `<div id="cx-tree-empty">No notes yet.<br>
      Use + New note below, or Import to bring in existing files.</div>`;
    updateCollapseAllBtn();
    return;
  }
  el.innerHTML = tree.map(treeRowHTML).join("");
  el.querySelectorAll(".cx-tree-item").forEach((item) => {
    const path = item.dataset.path;
    const type = item.dataset.type;
    const row = item.querySelector(":scope > .cx-tree-row");
    row.addEventListener("click", (e) => {
      if (justDragged) { justDragged = false; return; }
      if (e.ctrlKey || e.metaKey) {           // one more, or one fewer
        if (treeSel.has(path)) treeSel.delete(path); else treeSel.add(path);
        markTreeSelection();
        focusTree();
        return;
      }
      treeSel.clear();
      treeSel.add(path);
      markTreeSelection();
      let opened;
      if (type === "folder") {
        toggleFolder(item, path);
      } else if (type === "pdf") {
        opened = openPdf(path);
      } else if (type === "canvas") {
        opened = openCanvas(path);
      } else {
        opened = openNote(path);
      }
      /* the sidebar keeps the keys, so Delete reaches it -- after the
         note has opened, since opening may focus its editor */
      Promise.resolve(opened).then(focusTree, focusTree);
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openItemMenu(path, type, e.clientX, e.clientY);
    });
    row.addEventListener("mousedown", (e) => onDragMouseDown(e, path, row));
  });
  if (!el.dataset.keysWired) {
    el.dataset.keysWired = "1";
    el.addEventListener("keydown", onTreeKeydown);
  }
  updateCollapseAllBtn();
}

function focusTree() {
  const el = document.getElementById("cx-tree");
  if (el && el.focus) el.focus({preventScroll: true});
}

/** The chosen rows, marked without redrawing the tree (a redraw would
    replay the folder animation and lose the scroll). */
function markTreeSelection() {
  document.querySelectorAll("#cx-tree .cx-tree-item").forEach((item) => {
    const row = item.querySelector(":scope > .cx-tree-row");
    if (row) row.classList.toggle("cx-selected", treeSel.has(item.dataset.path));
  });
}

/** A path's node in the tree, or null when it isn't there (any more). */
function treeNodeAt(path, nodes = tree) {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const hit = treeNodeAt(path, n.children);
      if (hit) return hit;
    }
  }
  return null;
}

function onTreeKeydown(e) {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName || "")) return;  // renaming
  if (e.key === "Escape" && treeSel.size) {
    treeSel.clear();
    markTreeSelection();
    return;
  }
  if (e.key !== "Delete") return;
  const paths = [...treeSel].filter((p) => treeNodeAt(p));
  if (!paths.length) return;
  e.preventDefault();
  deleteSelectionFlow(paths);
}

/** Delete what is chosen in the sidebar: one item asks exactly as the
    right-click Delete does; several are asked about once, together. */
async function deleteSelectionFlow(paths) {
  /* a note inside a folder that is also chosen goes with its folder */
  const top = paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(q + "/")));
  if (top.length === 1) {
    const node = treeNodeAt(top[0]);
    await deleteItemFlow(top[0], node ? node.type : "note");
    focusTree();
    return;
  }
  const folders = top.filter((p) => (treeNodeAt(p) || {}).type === "folder").length;
  const names = top.map((p) => p.split("/").pop());
  const ok = await CC.confirm({
    title: `Delete these ${top.length} items?`,
    body: names.slice(0, 8).join(", ") + (names.length > 8 ? ` and ${names.length - 8} more` : "")
      + (folders ? ". Folders go with everything inside them." : "."),
    fine: "This can't be undone.", yes: `Delete ${top.length}`, danger: true,
  });
  if (!ok) return;
  for (const p of top) {
    const node = treeNodeAt(p);
    const r = await CC.Store.deleteItem(p);
    if (r && r.error) { CC.toast(r.error, "error"); break; }
    afterItemDeleted(p, node ? node.type : "note");
  }
  renderTabBar();
  await refreshTree();
  focusTree();
}

/* Cam: "a button to collapse and expand all... should be one button."
   One element, two states, decided fresh from the actual tree every
   time rather than tracked as its own separate flag — "are all
   folders collapsed right now" can drift out of sync with reality any
   number of ways otherwise (a folder created after "collapse all" was
   pressed, one toggled open by hand afterward, importing a whole new
   vault...), and recomputing it is cheap enough that there's no
   reason to risk that drift. Empty vault (no folders at all) disables
   the button entirely rather than leaving it to toggle nothing. */
function allFolderPaths() {
  return flattenFolders(tree).map((f) => f.path);
}

function toggleCollapseAll() {
  const paths = allFolderPaths();
  if (!paths.length) return;
  const allCollapsed = paths.every((p) => collapsed.has(p));
  if (allCollapsed) collapsed.clear();
  else paths.forEach((p) => collapsed.add(p));
  renderTree();
}

function updateCollapseAllBtn() {
  const btn = document.getElementById("cx-collapse-all-btn");
  if (!btn) return;
  const paths = allFolderPaths();
  const allCollapsed = paths.length > 0 && paths.every((p) => collapsed.has(p));
  btn.disabled = paths.length === 0;
  btn.title = allCollapsed ? "Expand all folders" : "Collapse all folders";
  btn.classList.toggle("cx-all-collapsed", allCollapsed);
}

/* Cam: "a button to hide the side bar menu." The button that hides it
   lives IN the sidebar and necessarily disappears along with
   everything else there — #cx-show-sidebar-btn (same icon, small,
   floating at the start of #cx-topbar) is how it comes back, revealed
   only while the sidebar is actually hidden. {skipSave} exists purely
   for restoring this at boot: applying a pref that was JUST read off
   disk has no business writing straight back to disk before the app
   has even finished loading. */
function setSidebarHidden(hidden, {skipSave = false} = {}) {
  document.getElementById("cx-sidebar")
    .classList.toggle("cx-sidebar-hidden", hidden);
  document.getElementById("cx-show-sidebar-btn").style.display =
    hidden ? "flex" : "none";
  if (!skipSave) setPref("sidebarHidden", hidden);
}

/* ---- drag-and-drop — Cam: "A drag feature, the ability to drag a
   file or folder around in the left side bar." Built on plain mouse
   events (mousedown/mousemove/mouseup), not the browser's own native
   HTML5 drag-and-drop — Cam: "The drag and drop doesnt work, i can
   drag but it wont drop into a folder", a real, confirmed failure in
   the earlier, native-DnD version. Mouse events are universally,
   identically supported everywhere, sidestepping the whole class of
   WebKitGTK-specific DnD inconsistency this app's own real
   environment (Hyprland, GTK backend) has a genuine history of.
   Instant on the first real movement past a small threshold — no
   artificial hold delay of any kind, matching Cam's own explicit
   ask. ---- */
let dragSourcePath = null;
let dragStartX = 0, dragStartY = 0;
let dragActive = false;
let justDragged = false;   // suppresses the click that follows mouseup
                           // after a real drag, so it never also
                           // opens the note / toggles the folder
const DRAG_THRESHOLD = 5;

let dragSourceRow = null;

function onDragMouseDown(e, path, row) {
  if (e.button !== 0) return;   // left mouse button only
  dragSourcePath = path;
  dragSourceRow = row;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragActive = false;
  window.addEventListener("mousemove", onDragMouseMove);
  window.addEventListener("mouseup", onDragMouseUp);
}

function currentDropTargetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const item = el.closest(".cx-tree-item");
  if (item && item.dataset.type === "folder") {
    return {kind: "folder", path: item.dataset.path, row: item.querySelector(
      ":scope > .cx-tree-row")};
  }
  if (document.getElementById("cx-tree").contains(el)) {
    return {kind: "root", path: "", row: null};   // empty background
  }
  const mainEl = document.getElementById("cx-main");
  if (mainEl && mainEl.contains(el)) {
    return {kind: "main-content", path: null, row: null};
  }
  return null;
}

/** Only a note or PDF can ever be opened in a tab — a folder dropped
    onto the main content area has nothing sensible to do there. */
function isOpenableDragSource(path) {
  const lower = (path || "").toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".pdf");
}

/* Cam: "The ability to drag and drop a note into the right area,
   then opens it in a new tab." If the note or PDF is already open
   somewhere, switches to that tab instead of opening a real
   duplicate — the same "already open? switch to it" rule openNote/
   openPdf themselves already follow for a plain sidebar click.
   Otherwise opens a genuinely new, empty tab first (reusing
   openNewTab exactly as Ctrl+N already does) and loads the dropped
   item into it, rather than duplicating tab-creation logic here. */
async function openInNewTab(path) {
  const existingIdx = tabs.findIndex((t) => t.path === path);
  if (existingIdx !== -1) { await switchToTab(existingIdx); return; }
  await openNewTab();
  if (path.toLowerCase().endsWith(".pdf")) await openPdf(path);
  else await openNote(path);
}

function onDragMouseMove(e) {
  if (!dragActive) {
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragActive = true;
    document.body.classList.add("cx-drag-active");
    if (dragSourceRow) dragSourceRow.classList.add("cx-dragging");
  }
  document.querySelectorAll(".cx-drop-target").forEach((r) =>
    r.classList.remove("cx-drop-target"));
  document.getElementById("cx-main").classList.remove("cx-drop-target-main");
  const target = currentDropTargetAt(e.clientX, e.clientY);
  if (!target) return;
  if (target.kind === "folder" && canDropOn(dragSourcePath, target.path)) {
    target.row.classList.add("cx-drop-target");
  } else if (target.kind === "root" && canDropOn(dragSourcePath, "")) {
    document.getElementById("cx-tree").classList.add("cx-drop-target");
  } else if (target.kind === "main-content"
      && isOpenableDragSource(dragSourcePath)) {
    document.getElementById("cx-main").classList.add("cx-drop-target-main");
  }
}

async function onDragMouseUp(e) {
  window.removeEventListener("mousemove", onDragMouseMove);
  window.removeEventListener("mouseup", onDragMouseUp);
  document.body.classList.remove("cx-drag-active");
  if (dragSourceRow) dragSourceRow.classList.remove("cx-dragging");
  document.querySelectorAll(".cx-drop-target").forEach((r) =>
    r.classList.remove("cx-drop-target"));
  document.getElementById("cx-tree").classList.remove("cx-drop-target");
  document.getElementById("cx-main").classList.remove("cx-drop-target-main");
  if (!dragActive) { dragSourcePath = null; dragSourceRow = null; return; }
  justDragged = true;
  const target = currentDropTargetAt(e.clientX, e.clientY);
  const source = dragSourcePath;
  dragActive = false;
  dragSourcePath = null;
  dragSourceRow = null;
  if (!target) return;
  if (target.kind === "main-content") {
    if (isOpenableDragSource(source)) await openInNewTab(source);
    return;
  }
  const destPath = target.path;
  if (!canDropOn(source, destPath)) return;
  await moveViaDrag(source, destPath);
}

function canDropOn(sourcePath, targetFolderPath) {
  if (sourcePath === targetFolderPath) return false;
  // never allow a folder to be dropped into itself or its own
  // descendant - the backend's own move_item_path already rejects
  // this with a clear ValueError, but checking here too means the
  // drop target never even highlights as valid in the first place
  if ((targetFolderPath + "/").startsWith(sourcePath + "/")) return false;
  const parent = sourcePath.includes("/")
    ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  return parent !== targetFolderPath;   // already there - nothing to do
}

/** Into another vault: save it first if it's open, then it leaves this vault's tabs and tree like a deleted item. */
async function moveToVault(path, type, vault, folder) {
  const inside = (p) => p && (p === path || p.startsWith(path + "/"));
  if (dirty && inside(currentPath)) await flushSave();
  if (splitPane && inside(splitPane.path)) await closeSplit();
  const r = await CC.Store.moveToVault(path, vault, folder);
  if (!r || r.error) { CC.toast((r && r.error) || "It couldn't be moved.", "error"); return; }
  afterItemDeleted(path, type);
  renderTabBar();
  await refreshTree();
  CC.toast(`Moved to ${vaultName(vault)}${folder ? " / " + folder : ""}${r.pictures ? ` (with ${r.pictures} picture${r.pictures === 1 ? "" : "s"})` : ""}.`);
}

async function moveViaDrag(sourcePath, targetFolderPath) {
  const r = await CC.Store.moveItem(sourcePath, targetFolderPath);
  if (r.error) { CC.toast(r.error, "error"); return; }
  const lower = sourcePath.toLowerCase();
  const isFolder = !lower.endsWith(".md") && !lower.endsWith(".pdf");
  if (sourcePath === currentPath) currentPath = r.path;
  updateTabsForPathChange(sourcePath, r.path, isFolder);
  await refreshTree();
  renderTabBar();
}

/* ============================================================================
   CONTEXT MENU — a generic renderer shared by the sidebar's own
   file/folder menu and the editor's own right-click menu below.
   Items: [label, action, danger?, submenuItems?] — a null entry is a
   separator. A submenu item's own action is never called directly;
   hovering it opens a nested flyout instead (Cam's own screenshot
   shows exactly this shape: Format/Paragraph/Insert each open a
   further list, not run something immediately).
   ============================================================================ */
function closeCtxMenu() {
  document.querySelectorAll(".cx-ctx-menu.open").forEach((m) =>
    m.classList.remove("open"));
  document.querySelectorAll(".cx-ctx-submenu").forEach((m) => m.remove());
}

function menuItemsHTML(items) {
  return items.map((it) => it === null ? "<hr>"
    : `<button ${it[2] ? 'class="cx-danger-item"' : ""}>${
      CC.md.escapeHtml(it[0])}${it[3] ? '<span class="cx-submenu-arrow">'
      + "\u203a</span>" : ""}</button>`).join("");
}

function wireMenuItems(menuEl, items) {
  const buttons = menuEl.querySelectorAll(":scope > button");
  let bi = 0;
  for (const it of items) {
    if (it === null) continue;
    const btn = buttons[bi];
    if (it[3]) {
      let submenuEl = null;
      let hideTimer = null;
      const openSubmenu = () => {
        clearTimeout(hideTimer);
        if (submenuEl) return;
        submenuEl = document.createElement("div");
        submenuEl.className = "cx-ctx-menu cx-ctx-submenu open";
        submenuEl.innerHTML = menuItemsHTML(it[3]);
        CC.uiRoot().appendChild(submenuEl);   /* not document.body */
        wireMenuItems(submenuEl, it[3]);
        const r = btn.getBoundingClientRect();
        const subWidth = 190;
        const left = r.right + subWidth > window.innerWidth
          ? Math.max(0, r.left - subWidth) : r.right;
        submenuEl.style.left = left + "px";
        submenuEl.style.top = Math.min(r.top,
          window.innerHeight - 40 * it[3].filter((x) => x).length)
          + "px";
        submenuEl.addEventListener("mouseenter", () =>
          clearTimeout(hideTimer));
        submenuEl.addEventListener("mouseleave", scheduleClose);
      };
      const scheduleClose = () => {
        hideTimer = setTimeout(() => {
          if (submenuEl) { submenuEl.remove(); submenuEl = null; }
        }, 250);
      };
      btn.addEventListener("mouseenter", openSubmenu);
      btn.addEventListener("mouseleave", scheduleClose);
    } else {
      btn.onclick = () => { closeCtxMenu(); it[1](); };
    }
    bi++;
  }
}

function renderCtxMenu(items, x, y) {
  const menu = document.getElementById("cx-ctx-menu");
  menu.innerHTML = menuItemsHTML(items);
  wireMenuItems(menu, items);
  menu.style.left = Math.min(x, window.innerWidth - 190) + "px";
  menu.style.top = Math.min(y, window.innerHeight - 20 * items.length)
    + "px";
  menu.classList.add("open");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".cx-ctx-menu")) closeCtxMenu();
});

/* ---- "Move to..." — a real folder picker, reusing the same modal-veil
   pattern CC.prompt already uses. Flat list with indentation rather
   than a fully interactive nested tree widget inside the modal itself
   — genuinely functional, without building a second, parallel tree
   UI just for this one picker. ---- */
/* other vaults too (2026-10-12, Cam: "the right click option where it says move folder to, to include other vaults
   as well ... save on copy and pasting notes"): under this vault's folders, each other vault and its folders. The
   pictures its notes show go with it (copied: this vault keeps its own). */
async function moveToFlow(path, type) {
  const others = (vaultsInfo.vaults || []).filter((v) => v.id !== vaultsInfo.active);
  const elsewhere = [];
  for (const v of others) {
    let fs = [];
    try { const r = await CC.Store.vaultFolders(v.id); if (r && Array.isArray(r.folders)) fs = r.folders; } catch (e) { /* just its top */ }
    elsewhere.push({vault: v, folders: fs});
  }
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    const folders = flattenFolders(tree)
      .filter((f) => canDropOn(path, f.path));
    const rootOk = canDropOn(path, "");
    const esc = CC.md.escapeHtml;
    /* one vault's folders at a time; a chooser at the top picks the vault (a long main vault would bury the others) */
    const listFor = (vid) => vid === vaultsInfo.active
      ? `${rootOk ? `<button class="cx-move-item" data-path="">Vault root</button>` : ""}
         ${folders.map((f) => `<button class="cx-move-item" data-path="${esc(f.path)}"
           style="padding-left:${14 + f.depth * 16}px">${esc(f.name)}</button>`).join("")}`
      : (() => { const e = elsewhere.find((x) => x.vault.id === vid);
          return `<button class="cx-move-item" data-vault="${esc(vid)}" data-path="">Vault root</button>
            ${e.folders.map((f) => `<button class="cx-move-item" data-vault="${esc(vid)}" data-path="${esc(f.path)}"
              style="padding-left:${14 + f.depth * 16}px">${esc(f.name)}</button>`).join("")}`; })();
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Move ${type === "folder" ? "folder" : "note"} to...</h3>
        ${others.length ? `<select class="cx-move-vault-pick" aria-label="Which vault">
            <option value="${esc(vaultsInfo.active)}">${esc(vaultName(vaultsInfo.active))} (this vault)</option>
            ${others.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}
          </select>` : ""}
        <div class="cx-move-list">${listFor(vaultsInfo.active)}</div>
        <div class="row"><button class="btn btn-quiet"
          data-act="no">Cancel</button></div>
      </div>`;
    const close = async (destPath, vault) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      if (destPath === null) { resolve(false); return; }
      if (vault) await moveToVault(path, type, vault, destPath);
      else await moveViaDrag(path, destPath);
      resolve(true);
    };
    const wireList = () => veil.querySelectorAll(".cx-move-item").forEach((b) =>
      b.addEventListener("click", () => close(b.dataset.path, b.dataset.vault || "")));
    wireList();
    const pick = veil.querySelector(".cx-move-vault-pick");
    if (pick) pick.onchange = () => { veil.querySelector(".cx-move-list").innerHTML = listFor(pick.value); wireList(); };
    veil.querySelector("[data-act=no]").onclick = () => close(null);
    veil.onclick = (e) => { if (e.target === veil) close(null); };
    veil.classList.add("open");
  });
}

/* Cam: "Ability to click open note when i start a new tab." A
   searchable picker for an EXISTING note or PDF, reached from the
   empty "New tab" screen's own new "Open note..." button — modeled
   directly on moveToFlow's own modal-veil pattern above, with live
   filtering added since a real vault can hold far more notes than a
   short, unfiltered list would stay usable for. Opens the choice
   into the CURRENT (empty) tab — the only place this is ever called
   from — reusing openNote/openPdf directly rather than duplicating
   opening logic here. */
function openExistingItemFlow() {
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    const items = flattenOpenable(tree);
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Open note or PDF</h3>
        <input type="text" class="cx-open-search" placeholder="Search...">
        <div class="cx-move-list cx-open-list"></div>
        <div class="row"><button class="btn btn-quiet"
          data-act="no">Cancel</button></div>
      </div>`;
    const listEl = veil.querySelector(".cx-open-list");
    const searchEl = veil.querySelector(".cx-open-search");
    const renderList = (query) => {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? items.filter((it) => it.title.toLowerCase().includes(q))
        : items;
      listEl.innerHTML = filtered.length
        ? filtered.map((it) => `<button class="cx-move-item cx-open-item"
            data-path="${CC.md.escapeHtml(it.path)}"
            data-type="${it.type}">${CC.md.escapeHtml(it.title)}
            <span class="cx-open-item-path">${
              CC.md.escapeHtml(it.path)}</span></button>`).join("")
        : `<div class="cx-open-empty">No matches.</div>`;
      listEl.querySelectorAll(".cx-open-item").forEach((b) =>
        b.addEventListener("click",
          () => close(b.dataset.path, b.dataset.type)));
    };
    const close = async (path, type) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      if (path === null) { resolve(false); return; }
      if (type === "pdf") await openPdf(path); else await openNote(path);
      resolve(true);
    };
    renderList("");
    searchEl.addEventListener("input", () => renderList(searchEl.value));
    veil.querySelector("[data-act=no]").onclick = () => close(null);
    veil.onclick = (e) => { if (e.target === veil) close(null); };
    veil.classList.add("open");
    searchEl.focus();
  });
}

/* a robust clipboard-write with a real fallback — Cam: "app crashes
   when i select copy from the right click menu when text is
   highlighted." Root cause: navigator.clipboard.writeText() had zero
   error handling at every one of its own call sites except paste,
   which already caught its own failures and is exactly why paste
   never crashed while copy did. WebKitGTK (Cam's own real
   environment) has already shown real gaps in modern web-platform
   API support this session (the earlier native drag-and-drop
   rebuild), so this doesn't just swallow the error — it falls back
   to the older, far more widely-supported execCommand("copy")
   technique (a temporary, off-screen textarea, selected and copied
   the classic way), so copying keeps genuinely working even where
   the modern async Clipboard API doesn't. Returns true/false so
   callers can tell Cam plainly if BOTH paths failed, rather than
   silently pretending it worked. */
/* Cam: "Still crashes when i click copy from the right click menu."
   No JS-triggered clipboard call anywhere in this app any more, after
   two consecutive attempts (the modern async API, then an
   execCommand("copy") fallback) both apparently still crashed —
   pointing to something more serious than either specific API: a
   likely native-level instability in WebKitGTK's own clipboard
   integration under Hyprland, which no JavaScript try/catch can ever
   protect against, since a native crash isn't a JS exception to
   begin with. A small modal shows the path in a real, visible,
   pre-selected, read-only field instead — Cam's own real Ctrl+C
   keypress does the actual copying, the exact same safe, native
   mechanism that already reliably handles paste. */
function copyPathFlow(path) {
  const veil = document.getElementById("cx-modal-veil");
  veil.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Copy path</h3>
      <input type="text" id="cx-copy-path-field" class="cx-copy-path-field"
             value="${CC.md.escapeHtml(path)}" readonly>
      <div style="color:var(--text-muted);font-size:12.5px;margin:8px 0 16px">
        Selected \u2014 press Ctrl+C to copy.
      </div>
      <div class="row"><button class="btn btn-primary" data-act="ok"
        >Done</button></div>
    </div>`;
  const close = () => { veil.classList.remove("open"); veil.innerHTML = ""; };
  veil.querySelector("[data-act=ok]").onclick = close;
  veil.onclick = (e) => { if (e.target === veil) close(); };
  veil.classList.add("open");
  const field = document.getElementById("cx-copy-path-field");
  field.focus();
  field.select();
}

/* the archive (2026-11-02, Cam: "implement an archive in the scribe app ... this will stop cluttering the main apps"):
   out of the tree into the vault's hidden archive; Scribe > Archive shows it and puts it back where it was */
async function archiveItemFlow(path, type) {
  try { await flushSave(); await flushSplitSave(); } catch (e) { /* what's on disk goes */ }
  const r = await CC.Store.archiveItem(path);
  if (r && r.error) { CC.toast(r.error, "error"); return; }
  afterItemDeleted(path, type);                        // (gone from here: its tabs and the editor let go of it, as a delete)
  renderTabBar();
  await refreshTree();
  CC.toast(`${type === "folder" ? "Folder" : "Note"} archived -- find it in Scribe > Archive.`);
}

function openItemMenu(path, type, x, y) {
  const items = [];
  const setMark = async (mark) => {
    const r = await CC.Store.setMark(path, mark);
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    marks = (r && r.marks) || marks;
    renderTree();
  };
  items.push([`${marks[path] === "tick" ? "☑" : "☐"} ✓ Tick (done)`, () => setMark(marks[path] === "tick" ? "" : "tick")]);
  items.push([`${marks[path] === "flag" ? "☑" : "☐"} ⚑ Flag for review`, () => setMark(marks[path] === "flag" ? "" : "flag")]);
  items.push(null);
  if (type === "folder") {
    items.push(["New note", () => newNoteIn(path)]);
    items.push(["New folder", () => newFolderIn(path)]);
    items.push(null);
  }
  if (type === "note" || type === "pdf") {
    items.push(["Open in split", () => openInSplit(path)]);
    items.push(null);
  }
  items.push(["Make a copy", async () => {
    const r = await CC.Store.duplicateItem(path);
    if (r.error) { CC.toast(r.error, "error"); return; }
    await refreshTree();
    CC.toast("Copy created.");
  }]);
  items.push([`Move ${type === "folder" ? "folder" : "file"} to...`,
    () => moveToFlow(path, type)]);
  items.push(["Copy path", () => copyPathFlow(path)]);
  /* ship with releases: a tick in the menu; inside a shipped folder it ships with the folder */
  const viaFolder = !shipped.has(path) && isShipped(path);
  items.push([`${isShipped(path) ? "☑" : "☐"} Ship with releases${viaFolder ? " (with its folder)" : ""}`, async () => {
    if (viaFolder) { CC.toast("This ships with its folder. Untick the folder to stop it.", "error"); return; }
    const r = await CC.Store.setShip(path, !shipped.has(path));
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    await refreshTree();
    CC.toast(shipped.has(path) ? "It will ship with the next release." : "It won't ship with releases any more.");
  }]);
  items.push(null);
  items.push(["Show in system explorer",
    async () => {
      const r = await CC.Store.showInFileManager(path);
      if (r.error) CC.toast(r.error, "error");
    }]);
  if (type === "note" || type === "pdf" || type === "canvas") {
    items.push(["Open in default app",
      async () => {
        const r = await CC.Store.openInDefaultApp(path);
        if (r.error) CC.toast(r.error, "error");
      }]);
  }
  items.push(null);
  items.push(["Rename", () => renameItemFlow(path, type)]);
  items.push([`Archive${type === "folder" ? " folder" : ""}`, () => archiveItemFlow(path, type)]);
  if (treeSel.size > 1 && treeSel.has(path)) {
    items.push([`Delete ${treeSel.size} chosen items`,
      () => deleteSelectionFlow([...treeSel].filter((p) => treeNodeAt(p))), true]);
  } else {
    items.push(["Delete", () => deleteItemFlow(path, type), true]);
  }
  renderCtxMenu(items, x, y);
}

/* ---- "Insert > Table" — Cam: "Can we add an insert table feature "
   + "where i select how many rows and collumms i want." A real
   picker, reusing the same modal-veil pattern CC.prompt already
   uses. "Rows" means data rows (the header row is always present in
   any markdown table regardless, so it isn't counted separately). ---- */
function insertTableFlow(ta) {
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Insert table</h3>
        <div class="cx-table-size-row">
          <label>Columns
            <input type="text" id="cx-table-cols" value="2"></label>
          <label>Rows
            <input type="text" id="cx-table-rows" value="2"></label>
        </div>
        <div class="row">
          <button class="btn btn-quiet" data-act="no">Cancel</button>
          <button class="btn btn-primary" data-act="yes">Insert</button>
        </div>
      </div>`;
    const colsInput = veil.querySelector("#cx-table-cols");
    const rowsInput = veil.querySelector("#cx-table-rows");
    const close = (ok) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      resolve(ok);
    };
    veil.querySelector("[data-act=no]").onclick = () => close(false);
    veil.querySelector("[data-act=yes]").onclick = () => {
      const cols = Math.max(1, Math.min(20,
        parseInt(colsInput.value, 10) || 2));
      const rows = Math.max(1, Math.min(50,
        parseInt(rowsInput.value, 10) || 2));
      const header = "| " + Array.from({length: cols},
        (_v, i) => `Column ${i + 1}`).join(" | ") + " |";
      const divider = "|" + Array(cols).fill("---").join("|") + "|";
      const dataRow = "| " + Array(cols).fill(" ").join(" | ") + " |";
      const table = [header, divider, ...Array(rows).fill(dataRow)]
        .join("\n") + "\n";
      insertAtCursor(ta, table);
      close(true);
    };
    veil.onclick = (e) => { if (e.target === veil) close(false); };
    veil.classList.add("open");
    colsInput.focus();
    colsInput.select();
  });
}

/* v171 — Cam: "Add insert photo to right click when clicking inside
   right side" (the notes pane's own context menu — see the "Insert"
   submenu in openEditorMenu below). Cam also asked that an inserted
   photo get copied into the vault's own folders rather than staying
   an external link — that self-sufficient behaviour already exists
   for a PASTED image (onEditorPaste -> saveImage -> attachments/, see
   the comment on attach_images in amnesia.py for why this reuses
   that exact same folder rather than starting a second one), so this
   is really just a second door into the same room: pick a file from
   disk instead of the clipboard, everything after that is identical —
   copied into attachments/, embedded with the same ![[name]] syntax,
   same "Image attached" toast. Multiple photos can be picked at once
   (the file dialog itself allows it, matching Import's own multi-
   select), each landing on its own line. */
async function insertImageFlow(ta) {
  await CC.Store.ready;
  if (!CC.Store.isDesktop()) {
    CC.toast("Inserting a photo runs in the desktop app.", "error");
    return;
  }
  const picked = await CC.Store.pickImage();
  if (!picked || picked.error) {
    CC.toast((picked && picked.error) || "Couldn't open the file picker.", "error");
    return;
  }
  if (picked.cancelled) return;
  const r = await CC.Store.attachImages(picked.paths);
  if (r.saved.length) {
    insertAtCursor(ta, r.saved.map((name) => `![[${name}]]`).join("\n")
      + "\n");
  }
  if (r.saved.length && !r.skipped.length) {
    CC.toast(r.saved.length === 1 ? "Image attached."
      : `${r.saved.length} images attached.`);
  } else if (r.saved.length && r.skipped.length) {
    CC.toast(`${r.saved.length} attached, ${r.skipped.length} skipped `
      + `(not a supported image type).`, "error");
  } else if (r.skipped.length) {
    CC.toast("Couldn't attach that \u2014 not a supported image type.",
      "error");
  }
}

/* ---- the editor's own right-click menu — Cam: "i want right click
   options for the right hand side (notes side)... See the image for
   an example of the features obsidian has." Deliberately does NOT
   include every item Obsidian's own real menu has — see the Format/
   Paragraph/Insert submenus below for exactly what's covered; things
   with no real equivalent in a plain-markdown, single-pane app (a
   spell-check submenu, "Open in..." variants) are left out rather
   than faked. ---- */
function openEditorMenu(ta, x, y) {
  const hasSelection = ta.selectionStart !== ta.selectionEnd;
  const items = [
    ["Add link", () => addLinkFlow(ta)],
    ["Add external link", () => addExternalLinkFlow(ta)],
    null,
  ];
  if (hasSelection) {
    items.push([`Search for "${
      ta.value.slice(ta.selectionStart, ta.selectionEnd).trim()
        .slice(0, 24)}${
      ta.value.slice(ta.selectionStart, ta.selectionEnd).trim().length > 24
        ? "\u2026" : ""}"`, () => searchForSelectionFlow(ta)]);
    items.push(["Extract current selection...",
      () => extractSelectionFlow(ta)]);
    items.push(null);
  }
  items.push(["Format", null, false, [
    ["Bold", () => wrapSelection(ta, "**", "**")],
    ["Italic", () => wrapSelection(ta, "*", "*")],
    ["Underline", () => wrapSelection(ta, "<u>", "</u>")],
    ["Strikethrough", () => wrapSelection(ta, "~~", "~~")],
    ["Code", () => wrapSelection(ta, "`", "`")],
  ]]);
  items.push(["Paragraph", null, false, [
    ["Heading 1", () => prefixLines(ta, "# ")],
    ["Heading 2", () => prefixLines(ta, "## ")],
    ["Heading 3", () => prefixLines(ta, "### ")],
    ["Quote", () => prefixLines(ta, "> ")],
    ["Bullet list", () => prefixLines(ta, "- ")],
    ["Numbered list", () => prefixLines(ta, "1. ")],
  ]]);
  items.push(["Insert", null, false, [
    ["Table...", () => insertTableFlow(ta)],
    ["Photo...", () => insertImageFlow(ta)],
    ["Horizontal rule", () => insertAtCursor(ta, "\n---\n")],
  ]]);
  items.push(null);
  items.push(["Select all", () => editorSelectAll(ta)]);
  renderCtxMenu(items, x, y);
}

/* v290 — Cam: "select text in Data Entry to right click and click
   highlight. By default it will highlight the text with the same
   colour highlight that you applied to the cells [on] hover." Only
   ever offered when there's an actual selection (see the contextmenu
   listener in renderEditorBody) — Highlight with nothing selected
   has nothing to act on. Toggles: right-clicking text that's already
   highlighted offers "Remove highlight" instead, so the same action
   works both ways rather than needing a separate undo path. */
function openPreviewMenu(editable, x, y, targetCell) {
  const items = [];
  const sel = window.getSelection();
  const hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0
    && editable.contains(sel.anchorNode);
  if (hasSelection) {
    const range = sel.getRangeAt(0);
    const spansMultipleCells = cellsTouchedByRange(range).length > 1;
    const alreadyMarked = spansMultipleCells
      ? selectionAnchorInMark(editable)
      : selectionMarkAncestor(editable) !== null;
    items.push(["Highlight", null, false, HIGHLIGHT_COLORS.map((color) =>
      [color.charAt(0).toUpperCase() + color.slice(1),
        () => applyHighlightSelection(editable, color)])]);
    if (alreadyMarked) {
      items.push(["Remove highlight", () => removeHighlightSelection(editable)]);
    }
  }

  const cell = targetCell || closestCell(sel && sel.anchorNode);
  if (cell && editable.contains(cell)) {
    if (items.length) items.push(null);
    items.push(["Insert \u2713", () => insertSymbolInCell(cell, "\u2713", editable)]);
    items.push(["Insert \u2717", () => insertSymbolInCell(cell, "\u2717", editable)]);
    items.push(null);
    const row = cell.closest("tr");
    const table = cell.closest("table");
    const headerRow = table && table.querySelector("thead tr");
    if (row !== headerRow) {
      items.push(["Insert row above", () => insertTableRow(cell, "above", editable)]);
    }
    items.push(["Insert row below", () => insertTableRow(cell, "below", editable)]);
    items.push(["Insert column left",
      () => insertTableColumn(cell, "left", editable)]);
    items.push(["Insert column right",
      () => insertTableColumn(cell, "right", editable)]);
  }

  if (!items.length) return;
  renderCtxMenu(items, x, y);
}

/** The single <mark> a given range is entirely inside, or null if it
    isn't inside exactly one (no highlight there yet, or a range that
    only partly overlaps one — treated the same as "not highlighted"
    rather than guessing). The real logic selectionMarkAncestor below
    already used, generalized to take any range directly rather than
    always reading the current selection — reused for each per-cell
    clipped range in the multi-cell highlight-color code, not just
    the top-level selection itself. */
function rangeMarkAncestor(range, editable) {
  const startEl = range.startContainer.nodeType === 3
    ? range.startContainer.parentElement : range.startContainer;
  const endEl = range.endContainer.nodeType === 3
    ? range.endContainer.parentElement : range.endContainer;
  const startMark = startEl && startEl.closest && startEl.closest("mark");
  const endMark = endEl && endEl.closest && endEl.closest("mark");
  if (startMark && startMark === endMark && editable.contains(startMark)) {
    return startMark;
  }
  return null;
}

/** The single <mark> the current selection is entirely inside, or
    null if it isn't inside exactly one (no highlight there yet, or a
    selection that only partly overlaps one — treated the same as
    "not highlighted" rather than guessing which way to toggle). */
function selectionMarkAncestor(editable) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  return rangeMarkAncestor(sel.getRangeAt(0), editable);
}

/** A more lenient check than selectionMarkAncestor above, used only
    for a selection spanning MULTIPLE table cells: each cell gets its
    own separate <mark> there (never one mark spanning cells — that's
    exactly the corruption this whole fix exists to avoid), so
    requiring both ends of the selection to share a single exact mark
    instance, the way selectionMarkAncestor deliberately does, would
    never match a genuinely, fully highlighted row at all. Whether the
    selection's own anchor (where it actually started) sits inside
    ANY mark is a reliable enough signal for that case — unlike
    within one cell, where a selection partly overlapping a single
    mark is genuinely ambiguous about which way to toggle. */
function selectionAnchorInMark(editable) {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode || !editable.contains(sel.anchorNode)) return false;
  const anchorEl = sel.anchorNode.nodeType === 3
    ? sel.anchorNode.parentElement : sel.anchorNode;
  const mark = anchorEl && anchorEl.closest && anchorEl.closest("mark");
  return !!(mark && editable.contains(mark));
}

/** Walks up from a node (possibly a text node) to the nearest real
    <table> ancestor, or null if there isn't one. */
function closestTable(node) {
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  return el && el.closest ? el.closest("table") : null;
}

/** Every real <td>/<th> that a Range genuinely touches, in DOM
    order. The real reason this matters: Range.extractContents() /
    Range.insertNode() can't safely handle a selection that crosses a
    <td> boundary — extracting content that spans two cells pulls out
    partial row/cell structure along with it, and re-inserting that
    wrapped in a single <mark> produces HTML a table can't actually
    contain (a <mark> holding real <td> elements, sitting where a
    <tr> expects only more cells). This doesn't throw — the browser's
    own HTML parser silently "fixes" the invalid result per the real
    HTML spec's own table content-model rules, which in practice
    means displacing the mark out of the table's normal flow
    entirely. Confirmed directly (not assumed) to be the actual cause
    of the corruption Cam reported: "select all the text in a row
    within a table and click highlight, it destroys the formatting
    of the table." */
function cellsTouchedByRange(range) {
  const table = closestTable(range.commonAncestorContainer);
  if (!table) return [];
  return [...table.querySelectorAll("td, th")].filter((cell) =>
    range.intersectsNode(cell));
}

/** A new Range representing just the part of `range` that falls
    inside `cell` — the real building block for handling a selection
    that spans several cells: the whole operation still happens, just
    once per cell instead of once across all of them, so no single
    extractContents()/insertNode() call ever has to cross a <td>
    boundary. */
function clipRangeToCell(range, cell) {
  const r = document.createRange();
  if (cell.contains(range.startContainer)) {
    r.setStart(range.startContainer, range.startOffset);
  } else {
    r.setStart(cell, 0);
  }
  if (cell.contains(range.endContainer)) {
    r.setEnd(range.endContainer, range.endOffset);
  } else {
    r.setEnd(cell, cell.childNodes.length);
  }
  return r;
}

/** Unwraps every real <mark> that a range touches, in place — the
    multi-cell equivalent of toggleHighlightSelection's own single-
    mark unwrap below, scoped to whatever's actually inside range's
    own commonAncestorContainer (in practice, one cell at a time, via
    clipRangeToCell) rather than the whole editable region. */
function unwrapMarksInRange(range) {
  const container = range.commonAncestorContainer;
  const root = container.nodeType === 3 ? container.parentElement : container;
  if (!root || !root.querySelectorAll) return;
  for (const mark of [...root.querySelectorAll("mark")]) {
    if (!range.intersectsNode(mark)) continue;
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

/** The four real highlight colors Cam can choose from — yellow is
    the default, unmarked <mark> (see the inline renderer/serializer
    for the ==text== / =={color}text== split this maps to). */
const HIGHLIGHT_COLORS = ["yellow", "green", "purple", "blue"];

/** The one place a single range actually gets highlighted (or
    re-colored) — recolors an existing mark in place if the range is
    already entirely inside exactly one (no need to unwrap and
    rewrap, just change its own class), or wraps a fresh <mark> of the
    given color otherwise. range.surroundContents() was the obvious
    first choice for the "fresh wrap" case but throws on a range that
    partially crosses an element boundary (extremely easy to do by
    accident with a mouse drag); extractContents()+insertNode() is
    the more forgiving equivalent. Shared by both the plain,
    single-range path and the multi-cell, one-range-per-cell path
    below — the only real difference between them is which ranges get
    handed to this. */
function applyHighlightToRange(range, color, editable) {
  const existing = rangeMarkAncestor(range, editable);
  if (existing) {
    existing.className = `cx-hl-${color}`;
    return existing;
  }
  const mark = document.createElement("mark");
  mark.className = `cx-hl-${color}`;
  mark.appendChild(range.extractContents());
  range.insertNode(mark);
  return mark;
}

/** Applies (or changes) a highlight color across the current
    selection. A selection spanning MULTIPLE table cells — dragging
    across a whole row is the easy, natural way to end up with one —
    is handled as a genuinely separate case (see cellsTouchedByRange's
    own comment for why: a single range crossing a <td> boundary
    would silently corrupt the table). Every other case (plain text, a
    selection within one cell) is completely unaffected — this only
    ever branches differently once a real second cell is actually
    touched. */
function applyHighlightSelection(editable, color) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const touchedCells = cellsTouchedByRange(range);

  if (touchedCells.length > 1) {
    for (const cell of touchedCells) {
      const cellRange = clipRangeToCell(range, cell);
      if (cellRange.collapsed) continue;
      try {
        applyHighlightToRange(cellRange, color, editable);
      } catch (err) {
        // one cell failing to highlight shouldn't abort the rest of
        // the row — each cell is an independent operation
      }
    }
    sel.removeAllRanges();
    onViewEditInput({target: editable}, true);
    return;
  }

  let mark;
  try {
    mark = applyHighlightToRange(range, color, editable);
  } catch (err) {
    CC.toast("Couldn't highlight that selection.", "error");
    return;
  }
  const newRange = document.createRange();
  newRange.selectNodeContents(mark);
  sel.removeAllRanges();
  sel.addRange(newRange);
  onViewEditInput({target: editable}, true);
}

/** Removes any highlight from the current selection, regardless of
    color — the same multi-cell handling as applyHighlightSelection
    above, and for the same real reason. */
function removeHighlightSelection(editable) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const touchedCells = cellsTouchedByRange(range);

  if (touchedCells.length > 1) {
    for (const cell of touchedCells) {
      const cellRange = clipRangeToCell(range, cell);
      if (cellRange.collapsed) continue;
      try {
        unwrapMarksInRange(cellRange);
      } catch (err) {
        // one cell failing shouldn't abort the rest of the row
      }
    }
    sel.removeAllRanges();
    onViewEditInput({target: editable}, true);
    return;
  }

  const existingMark = selectionMarkAncestor(editable);
  if (!existingMark) return;
  const parent = existingMark.parentNode;
  while (existingMark.firstChild) {
    parent.insertBefore(existingMark.firstChild, existingMark);
  }
  parent.removeChild(existingMark);
  parent.normalize();
  onViewEditInput({target: editable}, true);
}

/** Walks up from a node (possibly a text node, the common case for a
    cursor position or selection anchor) to the nearest real <td>/<th>
    ancestor, or null if there isn't one. */
function closestCell(node) {
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  return el && el.closest ? el.closest("td, th") : null;
}

/* Cam: "add a tick or a cross into cells." Inserts the real Unicode
   character at the current cursor position if it's genuinely inside
   the target cell (replacing a selection there too, the same way
   typing a character always would), or appends it to the cell's own
   existing content otherwise — a right-click doesn't always leave the
   browser's own selection sitting inside the exact cell that was
   clicked, so this always succeeds either way rather than silently
   doing nothing. */
function insertSymbolInCell(cell, symbol, editable) {
  const sel = window.getSelection();
  let inserted = false;
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (cell.contains(range.startContainer)) {
      range.deleteContents();
      const textNode = document.createTextNode(symbol);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      inserted = true;
    }
  }
  if (!inserted) {
    // a fresh, empty cell's own placeholder <br> (see insertTableRow/
    // insertTableColumn below) would otherwise leave a stray blank
    // line sitting alongside the real symbol
    if (cell.innerHTML.trim() === "<br>") cell.innerHTML = "";
    cell.appendChild(document.createTextNode(symbol));
  }
  onViewEditInput({target: editable}, true);
}

/* Cam: "right click a cell in a table and choose to insert another
   row or column to the table... further allign table functionality
   to that of Obsidian." A new row always gets exactly as many cells
   as the header row genuinely has — the one real source of truth for
   a table's own width (see serializeTable, which builds the |---|---|
   separator purely from header.length, not from any row's own actual
   cell count) — so a new row can never silently narrow or widen what
   the table serializes as. "Insert row above" is never offered for
   the header row itself (see openPreviewMenu below) since a row
   before the header would break the table's own structure; "below"
   from the header row lands the new row as the body's own first row,
   immediately underneath it. */
function insertTableRow(cell, position, editable) {
  const targetRow = cell.closest("tr");
  const table = cell.closest("table");
  if (!targetRow || !table) return;
  const tbody = table.querySelector("tbody");
  const headerRow = table.querySelector("thead tr");
  if (!tbody || !headerRow) return;
  const colCount = headerRow.children.length;
  const newRow = document.createElement("tr");
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement("td");
    td.innerHTML = "<br>";
    newRow.appendChild(td);
  }
  if (targetRow === headerRow) {
    tbody.insertBefore(newRow, tbody.firstChild);
  } else if (position === "above") {
    tbody.insertBefore(newRow, targetRow);
  } else {
    tbody.insertBefore(newRow, targetRow.nextSibling);
  }
  onViewEditInput({target: editable}, true);
}

/* A column spans the WHOLE table, so every real <tr> (header and
   every body row alike) gets a new cell at the same index — <th> for
   the header row, <td> everywhere else, decided from what that row's
   own first cell already is rather than assumed from thead/tbody
   membership, since that's the one thing that can never disagree
   with itself. cellIndex comes from the actual clicked row (not
   assumed to be the header), so the new column always lands exactly
   where Cam actually right-clicked, immediately left or right of it. */
function insertTableColumn(cell, direction, editable) {
  const row = cell.closest("tr");
  const table = cell.closest("table");
  if (!row || !table) return;
  const cellIndex = [...row.children].indexOf(cell);
  if (cellIndex === -1) return;
  const insertIndex = direction === "left" ? cellIndex : cellIndex + 1;
  const allRows = [...table.querySelectorAll("tr")];
  for (const tr of allRows) {
    const isHeaderCellRow = tr.children[0] && tr.children[0].tagName === "TH";
    const newCell = document.createElement(isHeaderCellRow ? "th" : "td");
    newCell.innerHTML = "<br>";
    tr.insertBefore(newCell, tr.children[insertIndex] || null);
  }
  onViewEditInput({target: editable}, true);
}

/* ============================================================================
   NOTE / FOLDER CRUD
   ============================================================================ */
async function newNoteIn(parentPath) {
  const r = await CC.Store.createNote(parentPath, "Untitled");
  if (r.error) { CC.toast(r.error, "error"); return; }
  await refreshTree();
  await openNote(r.path);
  const titleInput = document.getElementById("cx-title-input");
  if (titleInput) { titleInput.focus(); titleInput.select(); }
}

/* Cam: "Obisidian has a canvas feature, i would like to implement
   that into Amnesia... I want an in depth system implemented into
   Amnesia." Mirrors newNoteIn above exactly, minus the title-input
   focus step — a canvas's own chrome (like a PDF's) shows a plain,
   static breadcrumb title rather than an editable title input. */
async function newCanvasIn(parentPath) {
  const r = await CC.Store.createCanvas(parentPath, "Untitled");
  if (r.error) { CC.toast(r.error, "error"); return; }
  await refreshTree();
  await openCanvas(r.path);
}

async function newFolderIn(parentPath) {
  const r = await CC.Store.createFolder(parentPath, "New Folder");
  if (r.error) { CC.toast(r.error, "error"); return; }
  await refreshTree();
  startInlineRename(r.path, "folder");
}

/* ---- inline rename — Obsidian's own real UX for this: the sidebar
   label itself becomes an editable field, not a separate popup
   dialog. Reused for both a brand-new folder (landing here straight
   after creation, no naming prompt first) and the "Rename" context-
   menu action itself. ---- */
function startInlineRename(path, type) {
  const item = document.querySelector(
    `.cx-tree-item[data-path="${CSS.escape(path)}"]`);
  if (!item) return;
  const row = item.querySelector(":scope > .cx-tree-row");
  const label = row.querySelector(".cx-row-label");
  if (!label) return;
  const currentName = type === "note"
    ? path.split("/").pop().replace(/\.md$/i, "")
    : type === "pdf"
    ? path.split("/").pop().replace(/\.pdf$/i, "")
    : path.split("/").pop();
  const input = document.createElement("input");
  input.type = "text";
  input.className = "cx-inline-rename";
  input.value = currentName;
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const newName = input.value.trim();
    if (!newName || newName === currentName) { renderTree(); return; }
    const r = await CC.Store.renameItem(path, newName);
    if (r.error) { CC.toast(r.error, "error"); renderTree(); return; }
    if (path === currentPath) {
      currentPath = r.path;
      if (currentType === "pdf") renderPdfChrome(); else renderEditorChrome();
    }
    updateTabsForPathChange(path, r.path, type === "folder");
    renderTabBar();
    await refreshTree();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { e.preventDefault(); done = true; renderTree(); }
  });
  input.addEventListener("blur", commit);
  input.addEventListener("click", (e) => e.stopPropagation());
}

function renameItemFlow(path, type) {
  startInlineRename(path, type);
}

async function deleteItemFlow(path, type) {
  const itemWord = type === "folder" ? "folder" : type === "pdf" ? "PDF"
    : "note";
  const ok = await CC.confirm({
    title: `Delete this ${itemWord}?`,
    body: type === "folder"
      ? "This deletes the folder and everything inside it."
      : `This deletes the ${itemWord}. This can't be undone.`,
    fine: "This can't be undone.", yes: "Delete", danger: true,
  });
  if (!ok) return;
  await CC.Store.deleteItem(path);
  afterItemDeleted(path, type);
  renderTabBar();
  await refreshTree();
}

/** What an item's deletion leaves behind: an editor showing it emptied,
    tabs on it closed, and it no longer chosen. */
function afterItemDeleted(path, type) {
  for (const p of [...treeSel]) {
    if (p === path || p.startsWith(path + "/")) treeSel.delete(p);
  }
  if (currentPath === path || (type === "folder"
      && currentPath && currentPath.startsWith(path + "/"))) {
    currentPath = null;
    currentType = "note";
    if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
      tabs[activeTabIndex] = {path: null, text: "", dirty: false,
        type: "note"};
    }
    showEmptyState();
  }
  updateTabsForPathChange(path, null, type === "folder");
}

/* ============================================================================
   EDITOR
   ============================================================================ */
/* the display title for a tab - the note or PDF's own title, or "New
   tab" for an empty one, matching Obsidian's own real label exactly */
function tabTitleFor(tab) {
  if (!tab.path) return "New tab";
  return tab.type === "pdf" ? pdfTitleOf(tab.path) : noteTitleOf(tab.path);
}

function renderTabBar() {
  const bar = document.getElementById("cx-tabbar");
  bar.innerHTML = tabs.map((tab, i) => `
    <div class="cx-tab ${i === activeTabIndex ? "cx-tab-active" : ""}"
         data-idx="${i}">
      <span class="cx-tab-label">${CC.md.escapeHtml(tabTitleFor(tab))}${
        tab.dirty ? '<span class="cx-tab-dirty">\u25cf</span>' : ""}</span>
      <button class="cx-tab-close" data-idx="${i}"
              title="Close tab">\u00d7</button>
    </div>`).join("")
    + '<button id="cx-tab-new" title="New tab">+</button>';
  bar.querySelectorAll(".cx-tab").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest(".cx-tab-close")) return;
      switchToTab(parseInt(el.dataset.idx, 10));
    });
  });
  bar.querySelectorAll(".cx-tab-close").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(parseInt(btn.dataset.idx, 10));
    });
  });
  document.getElementById("cx-tab-new").onclick = () => openNewTab();
}

/* switches to a DIFFERENT, still-open tab - the outgoing tab's own
   current state is snapshotted back into tabs[] first (flushing any
   pending, not-yet-saved edit to disk immediately rather than
   leaving it to a debounce timer that would otherwise need its own,
   separate per-tab bookkeeping), then the target tab's own saved
   state is loaded into the same currentPath/currentText/dirty/mode
   globals every other function in this file already reads from. */
/* v289 — Cam: "don't change the mode until i change it. So should
   stay persistent across app." `mode` used to be part of each tab's
   own snapshot (restored on switchToTab/closeTab, hardcoded to
   "edit" on openNewTab) — exactly the kind of per-tab drift that
   contradicted DOCUMENTATION_NOTE's own long-standing claim that
   "whichever mode you're in stays selected... it never quietly
   resets." True for a single tab, never true the moment a second tab
   entered the picture. `mode` is now a genuinely global setting:
   nothing below touches it at all — only setMode() (an explicit,
   deliberate action) ever changes it, and it now also survives an
   actual app restart via prefsCache (see setMode itself). */
async function switchToTab(index) {
  if (index === activeTabIndex || index < 0 || index >= tabs.length) return;
  if (dirty) await flushSave();
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex] = {path: currentPath, text: currentText,
      dirty: false, type: currentType};
  }
  activeTabIndex = index;
  const tab = tabs[index];
  currentPath = tab.path;
  currentType = tab.type || "note";
  currentText = tab.text;
  dirty = tab.dirty;
  resetUndoHistory("primary");
  renderTree();
  renderTabBar();
  if (currentPath && currentType === "pdf") {
    renderPdfChrome(); renderPdfBody();
  } else if (currentType === "graph") {
    renderGraphChrome(); renderGraphBody();
  } else if (currentPath && currentType === "canvas") {
    canvasState = parseCanvasJSON(currentText, null);
    renderCanvasChrome(); renderCanvasBody();
  } else if (currentPath) {
    renderEditorChrome(); renderEditorBody();
  } else {
    showEmptyState();
  }
}

async function openNewTab() {
  tabs.push({path: null, text: "", dirty: false, type: "note"});
  await switchToTab(tabs.length - 1);
}

/* closing the tab currently on screen is handled directly here
   rather than by calling switchToTab() afterwards - by the time the
   tab is spliced out, the "outgoing tab" switchToTab() would try to
   snapshot no longer exists at that index at all. Always leaves at
   least one tab open, matching Obsidian's own real behaviour. */
async function closeTab(index) {
  if (index < 0 || index >= tabs.length) return;
  const closingActive = index === activeTabIndex;
  if (closingActive && dirty) await flushSave();
  tabs.splice(index, 1);
  if (!tabs.length) {
    tabs.push({path: null, text: "", dirty: false, type: "note"});
  }

  if (closingActive) {
    const newIndex = Math.min(index, tabs.length - 1);
    activeTabIndex = newIndex;
    const tab = tabs[newIndex];
    currentPath = tab.path;
    currentType = tab.type || "note";
    currentText = tab.text;
    dirty = tab.dirty;
    renderTree();
    renderTabBar();
    if (currentPath && currentType === "pdf") {
      renderPdfChrome(); renderPdfBody();
    } else if (currentPath) {
      renderEditorChrome(); renderEditorBody();
    } else {
      showEmptyState();
    }
  } else {
    if (index < activeTabIndex) activeTabIndex--;
    renderTabBar();
  }
}

/* keeps every OTHER (non-active) tab's own reference to a path in
   sync when a note or folder is renamed, moved, or deleted -
   Cam's own multi-tab request means a note open in some inactive
   tab can now be affected by something that happens somewhere else
   entirely in the vault, not just whatever's on screen right now.
   newPathOrNull === null means the item was deleted outright. */
function updateTabsForPathChange(oldPath, newPathOrNull, isFolder) {
  for (let i = 0; i < tabs.length; i++) {
    if (i === activeTabIndex) continue;   // the active tab is always
                                          // handled directly by the
                                          // caller already
    const t = tabs[i];
    if (!t.path) continue;
    const affected = isFolder
      ? (t.path === oldPath || t.path.startsWith(oldPath + "/"))
      : (t.path === oldPath);
    if (!affected) continue;
    if (newPathOrNull === null) {
      t.path = null; t.text = ""; t.dirty = false;
    } else if (!isFolder) {
      t.path = newPathOrNull;
    } else {
      t.path = newPathOrNull + t.path.slice(oldPath.length);
    }
  }

  if (splitPane && splitPane.path) {
    const affected = isFolder
      ? (splitPane.path === oldPath
         || splitPane.path.startsWith(oldPath + "/"))
      : (splitPane.path === oldPath);
    if (affected) {
      if (newPathOrNull === null) {
        // the note open in the split pane was just deleted — nothing
        // sensible left to show there, so close it entirely rather
        // than leaving a broken reference on screen
        clearTimeout(splitSaveTimer);
        splitPane = null;
        document.getElementById("cx-split-area").style.display = "none";
      } else {
        splitPane.path = isFolder
          ? newPathOrNull + splitPane.path.slice(oldPath.length)
          : newPathOrNull;
        renderSplitChrome();
      }
    }
  }
}

/* Cam's own screenshot: "New tab" with "Create new note (Ctrl + N)"
   and "Close" — matched exactly, deliberately without a "Go to file"
   link, since there's no quick-switcher feature in this app to back
   it up, and a button with no real function behind it is never
   faked in here. */
/* ---- the web of knowledge -------------------------------------------------
   A tab with no note behind it: it is a view of the whole vault rather than
   of any one file, so it carries no path and nothing to save. */

let webState = { graph: null, geometry: null, focus: null, zoom: 1,
                 panX: 0, panY: 0 };

function openGraphTab() {
  const existing = tabs.findIndex((t) => t.type === "graph");
  if (existing !== -1) { switchToTab(existing); return; }
  tabs.push({ path: null, text: "", dirty: false, type: "graph" });
  switchToTab(tabs.length - 1);
}

function renderGraphChrome() {
  // The same breadcrumb row every other view uses, with the mode toggle and
  // the other views' toolbars hidden — there is no raw/preview for a graph.
  document.getElementById("cx-breadcrumb").innerHTML = `
    <div class="cx-web-bar">
      <span class="cx-web-title">Web of knowledge</span>
      <span class="cx-web-stats" id="cx-web-stats"></span>
      <input id="cx-web-filter" class="cx-web-filter" placeholder="Highlight…"
        autocomplete="off" spellcheck="false">
      <button class="cx-web-btn" id="cx-web-refresh" title="Rebuild">Rebuild</button>
    </div>`;
  document.getElementById("cx-mode-toggle").style.display = "none";
  const pdfZoom = document.getElementById("cx-pdf-zoom-control");
  if (pdfZoom) pdfZoom.style.display = "none";
  const canvasBar = document.getElementById("cx-canvas-toolbar");
  if (canvasBar) canvasBar.style.display = "none";
  const filter = document.getElementById("cx-web-filter");
  filter.addEventListener("input", () => applyWebFilter(filter.value));
  document.getElementById("cx-web-refresh")
    .addEventListener("click", () => renderGraphBody());
}

async function renderGraphBody() {
  const area = document.getElementById("cx-editor-area");
  area.innerHTML = `<div class="cx-web-wrap" id="cx-web-wrap">
    <p class="cx-web-loading">Reading the vault…</p></div>`;

  const result = await CC.Store.readAllNotes();
  const notes = (result && result.notes) || [];
  const wrap = document.getElementById("cx-web-wrap");
  if (!wrap) return;                     // the tab was closed while reading

  if (!notes.length) {
    wrap.innerHTML = `<p class="cx-web-loading">No notes yet.</p>`;
    return;
  }

  let graph, geometry;
  try {
  graph = CC.Graph.build(notes);
  const width = wrap.clientWidth || 900;
  const height = wrap.clientHeight || 700;
  geometry = CC.Graph.layout(graph, { width, height });
  webState = { graph, geometry, focus: null, zoom: 1, panX: 0, panY: 0 };

  wrap.innerHTML = CC.Graph.render(graph, geometry, { width, height });
  } catch (err) {
    // A graph that fails silently just says "Reading the vault…" forever,
    // which is indistinguishable from a hang.
    console.error("web of knowledge:", err);
    wrap.innerHTML = `<p class="cx-web-loading">Could not draw the web:
      ${CC.md.escapeHtml(String((err && err.message) || err))}</p>`;
    return;
  }

  const linked = graph.nodes.filter((n) => n.degree > 0 && !n.missing).length;
  const lonely = graph.nodes.filter((n) => n.degree === 0).length;
  const missing = graph.nodes.filter((n) => n.missing).length;
  const stats = document.getElementById("cx-web-stats");
  if (stats) {
    stats.textContent =
      `${graph.edges.length} link${graph.edges.length === 1 ? "" : "s"} · `
      + `${linked} connected · ${lonely} unlinked`
      + (missing ? ` · ${missing} not written yet` : "")
      + (geometry.skipped ? " · too large to settle, showing rings only" : "");
  }

  wireWeb(wrap);
}

function wireWeb(wrap) {
  const svg = wrap.querySelector("svg");
  if (!svg) return;

  // Hovering a note lifts it and its neighbours and fades everything else,
  // which is the only way a web of any size stays readable.
  svg.querySelectorAll(".cx-web-node").forEach((g) => {
    g.addEventListener("mouseenter", () => focusWeb(svg, g.dataset.id));
    g.addEventListener("mouseleave", () => focusWeb(svg, null));
    g.addEventListener("click", () => {
      const node = webState.graph.nodes.find((n) => n.id === g.dataset.id);
      if (!node) return;
      if (node.missing) {
        CC.toast ? CC.toast(`"${node.title}" is linked to but not written yet.`)
                 : null;
        return;
      }
      openNote(node.id);
    });
  });

  // Wheel zooms about the pointer, drag pans. Applied as a transform on the
  // group rather than by re-laying out, so it is free.
  const world = svg.querySelector(".cx-web-nodes").parentElement;
  const apply = () => {
    svg.style.transform =
      `translate(${webState.panX}px, ${webState.panY}px) scale(${webState.zoom})`;
  };
  wrap.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    webState.zoom = Math.min(4, Math.max(0.3, webState.zoom * factor));
    apply();
  }, { passive: false });

  let dragging = false, lastX = 0, lastY = 0;
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".cx-web-node")) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    wrap.classList.add("is-panning");
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    webState.panX += e.clientX - lastX;
    webState.panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  window.addEventListener("pointerup", () => {
    dragging = false; wrap.classList.remove("is-panning");
  });
  void world;
}

function focusWeb(svg, id) {
  svg.classList.toggle("is-focused", Boolean(id));
  if (!id) {
    svg.querySelectorAll(".on, .near").forEach((e) =>
      e.classList.remove("on", "near"));
    return;
  }
  const near = new Set([id]);
  for (const edge of webState.graph.edges) {
    if (edge.source.id === id) near.add(edge.target.id);
    if (edge.target.id === id) near.add(edge.source.id);
  }
  svg.querySelectorAll(".cx-web-node").forEach((g) => {
    g.classList.toggle("on", g.dataset.id === id);
    g.classList.toggle("near", g.dataset.id !== id && near.has(g.dataset.id));
  });
  svg.querySelectorAll(".cx-web-thread").forEach((p) => {
    p.classList.toggle("on",
      p.dataset.from === id || p.dataset.to === id);
  });
}

function applyWebFilter(text) {
  const svg = document.querySelector(".cx-web-svg");
  if (!svg || !webState.graph) return;
  const needle = String(text || "").trim().toLowerCase();
  svg.classList.toggle("is-filtered", Boolean(needle));
  svg.querySelectorAll(".cx-web-node").forEach((g) => {
    const node = webState.graph.nodes.find((n) => n.id === g.dataset.id);
    g.classList.toggle("hit",
      Boolean(needle) && node && node.title.toLowerCase().includes(needle));
  });
}

function showEmptyState() {
  document.getElementById("cx-main").querySelector("#cx-editor-area")
    .innerHTML = `<div id="cx-empty-state">
      <div class="cx-empty-title">New tab</div>
      <button class="cx-empty-action" id="cx-empty-new-note">Create new
        note (Ctrl + N)</button>
      <button class="cx-empty-action" id="cx-empty-open">Open note or
        PDF...</button>
      <button class="cx-empty-action" id="cx-empty-close">Close</button>
    </div>`;
  document.getElementById("cx-breadcrumb").innerHTML = "";
  document.getElementById("cx-mode-toggle").style.display = "none";
  document.getElementById("cx-zoom-control").style.display = "none";
  document.getElementById("cx-pdf-zoom-control").style.display = "none";
  document.getElementById("cx-canvas-toolbar").style.display = "none";
  document.getElementById("cx-empty-new-note").onclick = () => newNoteIn("");
  document.getElementById("cx-empty-open").onclick = () =>
    openExistingItemFlow();
  document.getElementById("cx-empty-close").onclick = () =>
    closeTab(activeTabIndex);
}

/* v291 — SPLIT VIEW. Cam: "the split view mode where i can open 2
   notes side by side." Reached from a note's own right-click menu
   ("Open in split") or Ctrl+\ (Obsidian's own real "split right"
   binding — see the keydown handler below), never from a plain
   sidebar click, which still always targets the primary pane exactly
   as it always has. Deliberately simpler than the primary pane in
   one way: no title-rename input in the split editor itself (the
   primary pane's own has one) — rename from the sidebar or the
   primary pane instead. Everything else (Edit/View/Data Entry, live
   table formatting, highlighting, image embeds, wikilinks) works
   identically in both panes, because the functions that do that work
   (renderPreviewInto, htmlToMarkdown, openPreviewMenu...) were
   already parameterized by element/text rather than reading bare
   globals — reused directly here, not duplicated. */
async function openInSplit(path) {
  if (splitPane && splitPane.dirty) await flushSplitSave();
  const isPdf = path.toLowerCase().endsWith(".pdf");
  splitPane = isPdf
    ? {path, text: "", dirty: false, mode: "edit", type: "pdf"}
    : {path, text: (await CC.Store.readNote(path)) || "", dirty: false,
       mode: "edit", type: "note"};
  resetUndoHistory("split");
  document.getElementById("cx-split-area").style.display = "flex";
  document.getElementById("cx-split-divider").style.display = "block";
  applySplitRatio(splitRatio);
  renderSplitChrome();
  renderSplitBody();
  setActivePane("split");
}

async function closeSplit() {
  if (!splitPane) return;
  if (splitPane.dirty) await flushSplitSave();
  clearTimeout(splitSaveTimer);
  splitPane = null;
  resetUndoHistory("split");
  document.getElementById("cx-split-area").style.display = "none";
  document.getElementById("cx-split-divider").style.display = "none";
  setActivePane("primary");
}

/** Sets the actual flex-basis of both panes from a percentage (or
    null for the default, even 50/50 split) — the one place both
    panes' own widths are ever actually set, so opening split view and
    dragging the divider can never disagree about how to apply a
    ratio. */
function applySplitRatio(percent) {
  /* v300 — sizes #cx-editor-COLUMN, not #cx-editor-area: the toolbar
     restyle moved the row-level flex child up one level (the column
     wraps editor + bottom toolbar so they stack). Setting flexBasis on
     the inner area instead would silently do nothing to the split
     ratio, since it is no longer a child of the flex row. */
  const editorArea = document.getElementById("cx-editor-column");
  const splitArea = document.getElementById("cx-split-area");
  if (percent == null) {
    editorArea.style.flexBasis = "50%";
    splitArea.style.flexBasis = "50%";
    return;
  }
  editorArea.style.flexBasis = `${percent}%`;
  splitArea.style.flexBasis = `${100 - percent}%`;
}

/** Wipes a pane's own undo/redo history — called whenever a
    different note or PDF is opened into that pane, since an earlier
    note's own edit history has nothing meaningful to do with
    whatever's on screen now. */
function resetUndoHistory(paneKey) {
  undoState[paneKey] = {stack: [], redoStack: [], lastPushAt: 0};
}

/** Records one undo step, given the pane's own text as it was BEFORE
    the change that's about to be committed. Rapid, continuous typing
    coalesces into a single step (the same way every real editor's
    own undo already behaves) unless force is true, for a discrete,
    deliberate action — a formatting shortcut, a table edit, a
    highlight, a paste — which always gets its own step regardless of
    typing rhythm, the same way a fresh keystroke right after a pause
    also always starts a new one. A real, bounded depth (200 steps)
    keeps this from growing without limit across a very long editing
    session. Any new step invalidates whatever was in the redo stack —
    the same "a fresh edit clears redo" rule every real editor
    follows too. */
function recordUndoStep(paneKey, previousText, force) {
  const state = undoState[paneKey];
  const now = Date.now();
  const shouldCoalesce = !force && state.stack.length > 0
    && now - state.lastPushAt < UNDO_COALESCE_MS;
  if (!shouldCoalesce) {
    state.stack.push(previousText);
    if (state.stack.length > UNDO_MAX_DEPTH) state.stack.shift();
  }
  state.lastPushAt = now;
  state.redoStack = [];
}

/** The one place restored text actually gets applied back — reuses
    renderEditorBody()/renderSplitBody() to redraw whichever mode
    (Edit, View, or Data Entry) is currently active straight from the
    restored text, exactly the same way opening a different note
    already does, rather than writing separate, mode-specific
    restoration logic that could drift out of sync with it. */
function applyRestoredText(paneKey, text) {
  if (paneKey === "primary") {
    currentText = text;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 600);
    if (currentType === "canvas") {
      canvasState = parseCanvasJSON(currentText, canvasState);
      renderCanvasWorld();
    } else {
      renderEditorBody();
    }
  } else {
    if (!splitPane) return;
    splitPane.text = text;
    splitPane.dirty = true;
    clearTimeout(splitSaveTimer);
    splitSaveTimer = setTimeout(flushSplitSave, 600);
    renderSplitBody();
  }
}

function undoEdit(paneKey) {
  const state = undoState[paneKey];
  if (!state.stack.length) return;
  const current = paneKey === "primary" ? currentText
    : (splitPane ? splitPane.text : null);
  if (current == null) return;
  const previous = state.stack.pop();
  state.redoStack.push(current);
  if (state.redoStack.length > UNDO_MAX_DEPTH) state.redoStack.shift();
  state.lastPushAt = 0;   // the very next real edit always starts a
                          // genuinely new step of its own, never
                          // silently coalescing into this restore
  applyRestoredText(paneKey, previous);
}

function redoEdit(paneKey) {
  const state = undoState[paneKey];
  if (!state.redoStack.length) return;
  const current = paneKey === "primary" ? currentText
    : (splitPane ? splitPane.text : null);
  if (current == null) return;
  const next = state.redoStack.pop();
  state.stack.push(current);
  state.lastPushAt = 0;
  applyRestoredText(paneKey, next);
}

/* Cam: "When in split view make the sides of the screen resizable,
   by draging the middle to either side." A dedicated, separate drag
   system from the sidebar's own item-drag one above — resizing a
   pane's own width by tracking real-time cursor position is a
   genuinely different interaction than tracking a dragged item
   toward a drop target, and trying to share one system between both
   would only make each harder to follow. The percentage is computed
   fresh from the cursor's own real position each move, never from an
   accumulated delta, so there's no drift to correct for. */
function onSplitDividerMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  dividerDragActive = true;
  document.getElementById("cx-split-divider").classList.add("cx-divider-active");
  window.addEventListener("mousemove", onSplitDividerMouseMove);
  window.addEventListener("mouseup", onSplitDividerMouseUp);
}

function onSplitDividerMouseMove(e) {
  if (!dividerDragActive) return;
  const workspace = document.getElementById("cx-workspace");
  const rect = workspace.getBoundingClientRect();
  const dividerWidth = 8;   // matches #cx-split-divider's own real
                            // flex-basis in shared.css
  const usableWidth = rect.width - dividerWidth;
  if (usableWidth <= 0) return;
  let percent = ((e.clientX - rect.left) / usableWidth) * 100;
  percent = Math.max(20, Math.min(80, percent));
  applySplitRatio(percent);
  splitRatio = percent;
}

async function onSplitDividerMouseUp() {
  window.removeEventListener("mousemove", onSplitDividerMouseMove);
  window.removeEventListener("mouseup", onSplitDividerMouseUp);
  document.getElementById("cx-split-divider").classList.remove("cx-divider-active");
  if (!dividerDragActive) return;
  dividerDragActive = false;
  // only ever persisted once, at the end of a real drag gesture — the
  // same "commit once, not on every intermediate frame" rule
  // changeZoom already follows for its own +/- clicks
  await setPref("splitRatio", splitRatio);
}

async function flushSplitSave() {
  if (!splitPane || !splitPane.dirty || !splitPane.path) return;
  const path = splitPane.path;
  const text = splitPane.text;
  splitPane.dirty = false;
  await CC.Store.writeNote(path, text);
  await refreshTree();
}

function setSplitMode(newMode) {
  newMode = normalizeMode(newMode);
  if (!splitPane || splitPane.type === "pdf" || splitPane.mode === newMode) {
    return;
  }
  splitPane.mode = newMode;
  renderSplitChrome();
  renderSplitBody();
}

function renderSplitChrome() {
  if (!splitPane) return;
  const isPdf = splitPane.type === "pdf";
  document.getElementById("cx-split-breadcrumb").innerHTML =
    `<b>${CC.md.escapeHtml(isPdf ? pdfTitleOf(splitPane.path)
      : noteTitleOf(splitPane.path))}</b>`;
  const toggle = document.getElementById("cx-split-mode-toggle");
  document.getElementById("cx-split-pdf-zoom-control").style.display =
    isPdf ? "flex" : "none";
  if (isPdf) { toggle.style.display = "none"; return; }
  toggle.style.display = "";
  const editBtn = toggle.querySelector('[data-mode="edit"]');
  const viewBtn = toggle.querySelector('[data-mode="preview"]');
  // same declutter rule as the primary pane's own toggle: exactly one
  // of Edit/View shows, whichever splitPane's own mode isn't right now
  const showEditBtn = splitPane.mode !== "edit";
  editBtn.style.display = showEditBtn ? "" : "none";
  viewBtn.style.display = showEditBtn ? "none" : "";
  toggle.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("cx-on", b.dataset.mode === splitPane.mode);
  });
}

function renderSplitBody() {
  if (!splitPane) return;
  const area = document.getElementById("cx-split-editor-area");
  if (splitPane.type === "pdf") {
    area.innerHTML = `<div id="cx-split-pdf-viewer"
      class="cx-pdf-viewer"></div>`;
    const container = document.getElementById("cx-split-pdf-viewer");
    renderPdfPagesInto(container, splitPane.path, "split");
    return;
  }
  if (splitPane.mode === "edit") {
    area.innerHTML = `
      <div id="cx-split-editor-wrap"><div id="cx-split-editor-inner">
        <textarea id="cx-split-editor" placeholder="Start writing..."
                  spellcheck="false"></textarea>
      </div></div>`;
    const ta = document.getElementById("cx-split-editor");
    ta.value = splitPane.text;
    ta.addEventListener("input", onSplitEditorInput);
    /* v292 — the exact same keydown/paste/context-menu handlers the
       primary editor uses (onEditorKeydown, onEditorPaste,
       openEditorMenu — all already parameterized by the textarea
       they're given, never a hardcoded reference to the primary
       one) reused directly rather than a second, split-specific
       copy: Ctrl+B/I/U/K, the heading shortcuts, Tab table-navigation
       and list-indent, pasting a screenshot, and the right-click
       Format/Insert/Cut/Copy/Paste menu all now work here exactly
       like they do in the primary pane. */
    ta.addEventListener("keydown", onEditorKeydown);
    ta.addEventListener("paste", onEditorPaste);
    ta.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openEditorMenu(ta, e.clientX, e.clientY);
    });
    ta.focus();
  } else {
    /* v300 — same Edit+View merge as the primary pane: the split
       pane's View is the interactive, directly-editable page now, not
       a separate Data Entry mode. */
    area.innerHTML = `
      <div id="cx-split-editor-wrap"><div id="cx-split-editor-inner">
        <div id="cx-split-preview" contenteditable="true"
             spellcheck="false"></div>
      </div></div>`;
    const editable = document.getElementById("cx-split-preview");
    renderPreviewInto(editable, splitPane.text);
    applyViewZoom();
    editable.addEventListener("input", onSplitViewEditInput);
    attachTableResizing(editable);
    // v292 — live table formatting (Enter on a completed table block)
    // reused directly, same reasoning as above: onViewEditKeydown was
    // already purely e.target-driven, just never wired here before.
    editable.addEventListener("keydown", onViewEditKeydown);
    // the exact same Highlight menu the primary pane's Data Entry
    // mode gets (openPreviewMenu/toggleHighlightSelection already
    // take the editable element as a parameter — no duplicate needed)
    editable.addEventListener("contextmenu", (e) => {
      const sel = window.getSelection();
      const hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0
        && editable.contains(sel.anchorNode);
      const cell = closestCell(e.target);
      const inTable = cell && editable.contains(cell);
      if (!hasSelection && !inTable) return;
      e.preventDefault();
      openPreviewMenu(editable, e.clientX, e.clientY, cell);
    });
    wireSplitTaskCheckboxes(editable);
    wireSplitWikilinks(editable);
  }
}

/** View mode's own renderer for the split pane — mirrors renderPreview()
    exactly, except a clicked [[wikilink]] opens INTO the split pane
    (via openInSplit) rather than the primary one, so clicking around
    in the right-hand pane never disturbs whatever's open on the left. */
function renderSplitPreview() {
  const el = document.getElementById("cx-split-preview");
  if (!el || !splitPane) return;
  renderPreviewInto(el, splitPane.text);
  wireSplitWikilinks(el);
}

/** The split pane's own link wiring, split out of renderSplitPreview()
    so the interactive View (which renders via renderPreviewInto
    directly, not through renderSplitPreview) gets the exact same
    click behaviour rather than a second copy of it — a clicked
    [[wikilink]] opens INTO the split pane via openInSplit, so
    clicking around on the right never disturbs the left. */
function wireSplitWikilinks(el) {
  if (!el) return;
  el.querySelectorAll("[data-cx-link]").forEach((a) => {
    a.addEventListener("click", async () => {
      const title = a.dataset.cxLink;
      const existingPath = titleToPath.get(title.toLowerCase());
      if (existingPath) { openInSplit(existingPath); return; }
      const r = await CC.Store.createNote("", title);
      if (r.error) { CC.toast(r.error, "error"); return; }
      await refreshTree();
      openInSplit(r.path);
    });
  });
  el.querySelectorAll("[data-cx-ext]").forEach((a) => {
    a.addEventListener("click", async () => {
      await CC.Store.ready;
      if (window.CP && window.CP.Store) {
        window.CP.Store.call("notes_open_external", [a.dataset.cxExt], "Notes");
      }
    });
  });
}

function onSplitEditorInput(e) {
  recordUndoStep("split", splitPane.text, false);
  splitPane.text = e.target.value;
  splitPane.dirty = true;
  clearTimeout(splitSaveTimer);
  splitSaveTimer = setTimeout(flushSplitSave, 600);
  maybeShowLinkSuggest(e.target);
}

function onSplitViewEditInput(e) {
  recordUndoStep("split", splitPane.text, false);
  splitPane.text = htmlToMarkdown(e.target);
  splitPane.dirty = true;
  clearTimeout(splitSaveTimer);
  splitSaveTimer = setTimeout(flushSplitSave, 600);
}

/* ============================================================================
   PDF VIEWING — Cam: "PDF capability, this way i can use it to read
   PDF or even open it split view with a note beside it and write
   notes on what i read." pdf.js (Mozilla's own real PDF renderer,
   vendored locally under ui/vendor/pdfjs so this works fully offline
   like everything else in this app) renders each page onto its own
   <canvas>, continuously scrollable — the same "just scroll" reading
   experience Obsidian's own built-in PDF viewer defaults to, rather
   than a fiddly page-by-page navigator neither of us asked for.
   ============================================================================ */

/* pdf.js's own build is a real ES module (export/import syntax) while
   this whole file is loaded as a plain, non-module script — a static
   `import` statement can't be used here at all, but a dynamic
   import() genuinely can, regardless of what kind of script calls
   it. Loaded once, lazily (only the first time a PDF is actually
   opened, not on every boot), and cached so opening a second PDF
   never re-pays that cost.
   workerSrc is deliberately just the bare filename, not a path
   including "vendor/pdfjs/" again — confirmed directly by testing
   against the real, vendored library rather than assumed: pdf.js
   resolves workerSrc relative to pdf.min.mjs's own module location
   (the same way passing a relative URL to Worker() always resolves
   against the calling script's own location, not whatever else
   happens to be on screen), so including that prefix a second time
   doubly-nested the path and made the real, dedicated worker thread
   fail to load every time — a real, confirmed bug, not a hypothetical
   one; pdf.js was silently falling back to a degraded mode instead of
   ever finding its own real worker. */
/* WHERE pdf.js LIVES. The import below is relative, and a dynamic import
   resolves from the SCRIPT's own address, not the page's. In standalone
   Amnesia this file sat at ui/app.js, so "./vendor/pdfjs/" meant
   ui/vendor/pdfjs/. Moved into ui/notes/ for the merge, the same text
   started meaning ui/notes/vendor/pdfjs/ -- a folder that did not exist,
   so opening any PDF failed. The library now sits where the import looks,
   inside notes/, which also keeps the whole module in one folder. */
/* AND THE WORKER. Its path was relative too, but it resolves from a
   different place than the import does -- the page, not the script -- so
   "./pdf.worker.min.mjs" meant ui/pdf.worker.min.mjs, which does not exist.
   pdf.js then quietly falls back to parsing on the main thread. That still
   draws a page, so nothing looked wrong, but a textbook of a few hundred
   pages would freeze the window while it parsed.

   So neither path is left to a resolution rule: the library's address is
   worked out once, from where this script actually loaded, and both the
   module and its worker are built from it. document.currentScript is only
   set while the script first runs, which is why this is at the top level
   rather than inside getPdfjsLib(). */
const PDFJS_BASE = new URL("vendor/pdfjs/",
  (document.currentScript && document.currentScript.src)
    || new URL("notes/", location.href).href);

let pdfjsLibPromise = null;
function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(new URL("pdf.min.mjs", PDFJS_BASE).href).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", PDFJS_BASE).href;
      return mod;
    });
  }
  return pdfjsLibPromise;
}

/* One entry per pane ("primary" | "split") — doc is the live pdf.js
   document object (kept around so the zoom controls can re-render
   without re-fetching/re-parsing the whole file from scratch every
   click), scale is null until Cam actually changes it (null means
   "fit width," recomputed fresh every render since the window itself
   can resize) or a real number once he's zoomed by hand. renderGen is
   a real, confirmed fix for a race condition: renderPdfPagesInto
   shows "Loading PDF…" and wipes the pane's own pages SYNCHRONOUSLY,
   before its own first await — so clicking zoom again before the
   previous render finishes (an entirely normal thing to do, clicking
   + a few times in a row to reach a size) makes the second click's
   own scroll-state capture find an already-emptied pane and get
   nothing back, silently losing the real page position. Each call
   claims its own generation number; every checkpoint below bails out
   the moment a newer call has superseded it, so only the LAST click
   in a rapid sequence ever finishes and touches scroll. */
const pdfViewerState = {
  primary: {path: null, doc: null, scale: null, renderGen: 0},
  split: {path: null, doc: null, scale: null, renderGen: 0},
};

function pdfTitleOf(path) {
  return path.split("/").pop().replace(/\.pdf$/i, "");
}

/* Shared by both panes — matches this file's own established pattern
   of one parameterized renderer rather than a second, split-specific
   copy (see renderPreviewInto, commitEdit, and friends). `container`
   is whichever pane's own body element is currently on screen;
   `paneKey` ("primary" | "split") is only used to remember that
   pane's own zoom level and live doc reference across re-renders. */
/** Which page is currently at the top of the pane's own visible
    viewport, and how far scrolled into that page (0 = its own top
    edge, 1 = its own bottom edge) — captured before a re-render so
    the same real reading position can be restored afterward, even
    though every page's own real pixel height changes at a new scale.
    getBoundingClientRect() rather than offsetTop specifically, to
    stay correct regardless of the exact offsetParent chain the
    surrounding flex/scroll layout happens to produce. */
function getCurrentPdfScrollState(container) {
  const wrap = container.querySelector(".cx-pdf-pages");
  if (!wrap) return null;
  const pages = [...wrap.querySelectorAll(".cx-pdf-page")];
  if (!pages.length) return null;
  const containerRect = container.getBoundingClientRect();
  const scrollTop = container.scrollTop;
  let pageIndex = 0, pageTop = 0, pageHeight = 1;
  for (let i = 0; i < pages.length; i++) {
    const rect = pages[i].getBoundingClientRect();
    const top = rect.top - containerRect.top + scrollTop;
    if (top <= scrollTop + 1) {
      pageIndex = i; pageTop = top; pageHeight = rect.height || 1;
    } else break;
  }
  const fraction = Math.max(0, Math.min(1, (scrollTop - pageTop) / pageHeight));
  return {pageIndex, fraction};
}

/** The inverse of getCurrentPdfScrollState — scrolls the pane so the
    same page, at roughly the same relative position within it, is
    showing again after a re-render at a new scale. */
function restorePdfScrollState(container, state) {
  if (!state) return;
  const wrap = container.querySelector(".cx-pdf-pages");
  if (!wrap) return;
  const pages = [...wrap.querySelectorAll(".cx-pdf-page")];
  if (!pages.length) return;
  const page = pages[state.pageIndex] || pages[pages.length - 1];
  const containerRect = container.getBoundingClientRect();
  const pageRect = page.getBoundingClientRect();
  const pageTop = pageRect.top - containerRect.top + container.scrollTop;
  container.scrollTop = pageTop + state.fraction * pageRect.height;
}

async function renderPdfPagesInto(container, path, paneKey, restoreState) {
  const state = pdfViewerState[paneKey];
  const myGen = ++state.renderGen;
  container.innerHTML = `<div class="cx-pdf-status">Loading PDF\u2026</div>`;

  let pdfjsLib;
  try {
    pdfjsLib = await getPdfjsLib();
  } catch (err) {
    if (state.renderGen !== myGen) return;   // superseded while awaiting
    container.innerHTML =
      `<div class="cx-pdf-status">Couldn't load the PDF viewer.</div>`;
    return;
  }
  if (state.renderGen !== myGen) return;

  const dataUrl = await CC.Store.pdfData(path);
  if (state.renderGen !== myGen) return;
  if (!dataUrl) {
    container.innerHTML =
      `<div class="cx-pdf-status">Couldn't read that PDF.</div>`;
    return;
  }
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  let doc;
  try {
    doc = await pdfjsLib.getDocument({data: bytes, isEvalSupported: false}).promise;   // no eval from a PDF (CVE-2024-4367)
  } catch (err) {
    if (state.renderGen !== myGen) return;
    container.innerHTML = `<div class="cx-pdf-status">Couldn't open `
      + `that PDF \u2014 it may be corrupted or password-protected.</div>`;
    return;
  }
  if (state.renderGen !== myGen) return;
  // the container may have been torn down (pane closed, note switched)
  // while the async work above was still in flight — never paint into
  // a stale container that isn't attached to the page anymore
  if (!container.isConnected) return;

  state.doc = doc;
  state.path = path;

  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "cx-pdf-pages";
  container.appendChild(wrap);

  const firstPage = await doc.getPage(1);
  if (state.renderGen !== myGen) return;
  const naturalWidth = firstPage.getViewport({scale: 1}).width;
  const fitScale = Math.max(0.2,
    (container.clientWidth - 32) / naturalWidth);
  const scale = state.scale || fitScale;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    if (state.renderGen !== myGen || !container.isConnected) return;
    const page = pageNum === 1 ? firstPage : await doc.getPage(pageNum);
    if (state.renderGen !== myGen) return;
    const viewport = page.getViewport({scale});
    const canvas = document.createElement("canvas");
    canvas.className = "cx-pdf-page";
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    if (pageNum === 1) canvas.dataset.naturalWidth = String(naturalWidth);
    wrap.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    await page.render({canvasContext: ctx, viewport}).promise;
    if (state.renderGen !== myGen) return;
  }
  restorePdfScrollState(container, restoreState);
}

/* +/- zoom for a PDF pane — re-renders every page at the new scale
   (canvas content scaled via CSS instead would go blurry; pdf.js
   itself re-rasterizing at the new scale is what every real PDF
   viewer actually does for a reason). Seeds `scale` from whatever
   fit-width resolved to on the very first render if Cam hasn't
   picked an explicit zoom yet, so the first zoom click moves
   smoothly from wherever the page actually already was on screen.
   Cam: "When changing zoom on pdf i want it to stay on the same
   page" — a re-render always wipes and rebuilds every canvas from
   scratch (see renderPdfPagesInto), which would otherwise reset
   scroll to the very top every time; capturing the real scroll state
   first and restoring it afterward is what actually fixes that.
   Cam: "The pdf still doesn't remain on the same page... it still re
   renders" — the FIRST fix above wasn't actually enough on its own:
   renderPdfPagesInto wipes the pane to a "Loading PDF…" message
   synchronously, before its own first await, so clicking zoom again
   before the previous click's render had finished (an entirely
   normal thing to do — clicking + a few times in a row to reach a
   size) made the SECOND click's own scroll-state capture run against
   an already-emptied pane and get nothing back, silently losing the
   real page position. renderGen (see pdfViewerState's own comment)
   is what actually fixes that: each call bails out cleanly the
   moment a newer one has superseded it, so only the last click in a
   rapid sequence ever finishes and touches scroll. */
function changePdfZoom(paneKey, container, factor) {
  const state = pdfViewerState[paneKey];
  if (!state.path) return;
  const current = state.scale || guessCurrentPdfScale(container);
  state.scale = Math.max(0.2, Math.min(4, current * factor));
  const scrollState = getCurrentPdfScrollState(container);
  renderPdfPagesInto(container, state.path, paneKey, scrollState);
}

/* the scale actually on screen right now, even if Cam hasn't zoomed
   by hand yet and it's still sitting at whatever fit-width resolved
   to — read directly off the first rendered page's own real canvas
   width vs the PDF's own native page width, rather than trying to
   track a duplicate copy of that number separately. */
function guessCurrentPdfScale(container) {
  const canvas = container.querySelector(".cx-pdf-page");
  if (!canvas || !canvas.dataset.naturalWidth) return 1;
  return canvas.width / Number(canvas.dataset.naturalWidth);
}

async function openNote(path) {
  const existingIdx = tabs.findIndex((t, i) =>
    t.path === path && i !== activeTabIndex);
  if (existingIdx !== -1) { await switchToTab(existingIdx); return; }
  if (dirty) await flushSave();
  currentPath = path;
  currentType = "note";
  currentText = (await CC.Store.readNote(path)) || "";
  dirty = false;
  resetUndoHistory("primary");
  renderTree();
  renderEditorChrome();
  renderEditorBody();
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex] = {path: currentPath, text: currentText,
      dirty: false, type: "note"};
  }
  renderTabBar();
}

/* Cam: "PDF capability, this way i can use it to read PDF or even
   open it split view with a note beside it and write notes on what i
   read." Mirrors openNote's own shape directly (existing-tab
   detection, flushing whatever was dirty before switching away from
   it) — the one real difference is there's no text to eagerly read
   here at all: renderPdfBody/renderPdfPagesInto fetch and decode the
   PDF's own real bytes lazily, only once the viewer is actually on
   screen, and there is no dirty/save concept whatsoever since PDFs
   are read-only in this app — Cam reads and takes notes ABOUT one
   beside it, in split view, rather than editing the PDF itself. */
async function openPdf(path) {
  const existingIdx = tabs.findIndex((t, i) =>
    t.path === path && i !== activeTabIndex);
  if (existingIdx !== -1) { await switchToTab(existingIdx); return; }
  if (dirty) await flushSave();
  currentPath = path;
  currentType = "pdf";
  currentText = "";
  dirty = false;
  resetUndoHistory("primary");
  renderTree();
  renderPdfChrome();
  renderPdfBody();
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex] = {path: currentPath, text: "", dirty: false,
      type: "pdf"};
  }
  renderTabBar();
}

function noteTitleOf(path) {
  return path.split("/").pop().replace(/\.md$/i, "");
}

function renderEditorChrome() {
  document.getElementById("cx-breadcrumb").innerHTML =
    `<b>${CC.md.escapeHtml(noteTitleOf(currentPath))}</b>`;
  const toggle = document.getElementById("cx-mode-toggle");
  toggle.style.display = "";
  document.getElementById("cx-pdf-zoom-control").style.display = "none";
  document.getElementById("cx-canvas-toolbar").style.display = "none";
  const editBtn = toggle.querySelector('[data-mode="edit"]');
  const viewBtn = toggle.querySelector('[data-mode="preview"]');
  // whichever one Ctrl+E would switch you TO is the one shown — same
  // "mode === 'edit' ? preview : edit" the shortcut itself uses (see
  // toggleMode), so the single visible button never disagrees with
  // what pressing Ctrl+E right now would actually do.
  const showEditBtn = mode !== "edit";
  editBtn.style.display = showEditBtn ? "" : "none";
  viewBtn.style.display = showEditBtn ? "none" : "";
  toggle.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("cx-on", b.dataset.mode === mode);
  });
  applyViewZoom();
}

/* PDF equivalent of renderEditorChrome — Edit/View/Data Entry have no
   meaning for a read-only PDF, so the mode toggle and text-view zoom
   are hidden entirely rather than left showing controls that do
   nothing; the PDF's own dedicated zoom control takes their place. */
function renderPdfChrome() {
  document.getElementById("cx-breadcrumb").innerHTML =
    `<b>${CC.md.escapeHtml(pdfTitleOf(currentPath))}</b>`;
  document.getElementById("cx-mode-toggle").style.display = "none";
  document.getElementById("cx-zoom-control").style.display = "none";
  document.getElementById("cx-pdf-zoom-control").style.display = "flex";
  document.getElementById("cx-canvas-toolbar").style.display = "none";
}

function renderPdfBody() {
  const area = document.getElementById("cx-editor-area");
  area.innerHTML = `<div id="cx-pdf-viewer" class="cx-pdf-viewer"></div>`;
  const container = document.getElementById("cx-pdf-viewer");
  renderPdfPagesInto(container, currentPath, "primary");
}

/* ============================================================================
   CANVAS — Cam: "Obisidian has a canvas feature, i would like to
   implement that into Cortex. This will be an incredible tool for
   storyboarding, planning, mindmaps, idea boards, UI ideas, ect...
   Please have a look at obisidians webpage for information on the
   canvas feature, break down the feature in steps of implementation.
   I want an in depth system implemented into Cortex."

   Phase 1 (this delivery): a real, first-class .canvas vault item —
   infinite pan/zoom, text cards you can create, move, resize, edit,
   and delete. Saved in the real, open JSON Canvas format
   (jsoncanvas.org — confirmed directly against Obsidian's own real
   spec and a real sample .canvas file, not invented): a plain JSON
   object with "nodes" and "edges" arrays. A board built here can
   genuinely open in Obsidian or any other JSON Canvas app, matching
   this whole project's own established "real, open, portable format"
   philosophy — the same reason every note is plain markdown, not a
   structured, proprietary format.

   Deliberately reuses currentText/dirty/saveTimer/flushSave and the
   real undo system wholesale, rather than building a parallel state
   machine: a canvas tab's own currentText IS its serialized JSON, the
   exact same role currentText already plays for a note's own raw
   markdown. Every real edit (move, resize, create, delete, a
   keystroke in a card's own text) re-serializes into currentText,
   marks dirty, and schedules a save through the SAME pipeVine every
   other edit in this app already goes through — which is also what
   makes Ctrl+Z already work on a canvas with no new undo code at all.

   Split-pane canvas support, edges/connections, more card types
   (embedded notes/PDFs, links), groups, and colors are real,
   deliberately deferred scope for a later phase, not oversights. */
/* matches amnesia.py's own EMPTY_CANVAS_JSON exactly - a real,
   minimal, VALID JSON Canvas structure, used as a fallback if
   CC.Store.readCanvas somehow comes back empty (a brand new file
   should already be seeded with exactly this by create_canvas_file,
   but currentText should never actually hold null/undefined either
   way - it's saved back verbatim if Cam never edits anything at
   all). */
const CC_EMPTY_CANVAS_JSON = "{\"nodes\":[],\"edges\":[]}";
let canvasState = null;   // {nodes, edges, panX, panY, zoom, selectedId}
let canvasDragState = null;   // in-progress drag/resize/pan, or null

function canvasTitleOf(path) {
  return path.split("/").pop().replace(/\.canvas$/i, "");
}

/** Parses a canvas's own raw JSON text into a real, live canvasState.
    Defensive throughout — a missing file, empty text, or genuinely
    malformed JSON all fall back to an empty, working board rather
    than crashing the whole app, the same "never let one bad file
    take down the editor" principle CC.md's own renderer already
    follows. previousState (when given, e.g. restoring an undo step)
    carries over the real pan/zoom/selection the user actually had —
    undoing a card's own position shouldn't also yank the viewport
    back to wherever it happened to be when the note was first
    opened. */
function parseCanvasJSON(raw, previousState) {
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (err) {
    CC.toast("That canvas file couldn't be read \u2014 starting fresh so "
      + "nothing else breaks.", "error");
  }
  const nodes = Array.isArray(parsed && parsed.nodes) ? parsed.nodes : [];
  const edges = Array.isArray(parsed && parsed.edges) ? parsed.edges : [];
  return {
    nodes, edges,
    panX: previousState ? previousState.panX : 0,
    panY: previousState ? previousState.panY : 0,
    zoom: previousState ? previousState.zoom : 1,
    selectedId: previousState ? previousState.selectedId : null,
    selectedKind: previousState ? previousState.selectedKind : null,
  };
}

function generateCanvasNodeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* Cam: continuing the Canvas feature — Phase 4, groups and colors.
   The real JSON Canvas "color" field (a preset "1"-"6" or a hex
   string) — the six preset numbers confirmed directly against a
   real Obsidian CSS snippet (not guessed): 1=red, 2=orange,
   3=yellow, 4=green, 5=blue, 6=purple. The exact shades below are
   Amnesia's own, chosen to read clearly on its own dark background,
   the same "true to Amnesia" rule every earlier phase of this
   feature already followed — only the six preset NUMBERS themselves
   need to match Obsidian's own real convention for a saved board to
   mean the same thing in either app. */
const CANVAS_COLOR_PRESETS = [
  ["1", "Red"], ["2", "Orange"], ["3", "Yellow"],
  ["4", "Green"], ["5", "Blue"], ["6", "Purple"],
];

function setCanvasNodeColor(nodeId, colorNum) {
  const node = canvasState.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  if (colorNum === null) delete node.color; else node.color = colorNum;
  commitCanvasChange(true);
  renderCanvasWorld();
}

/** Cam: "Lastly a send back and forward feature for layering."
    renderCanvasWorld() already renders every group as one backmost
    layer and every card as one frontmost layer, regardless of their
    raw position in canvasState.nodes (see that function's own
    comment) — so reordering only has a real, visible effect WITHIN
    a node's own bucket (group vs. card), which is exactly what these
    two operate on. Available for every node kind, not shapes only:
    a text card sitting on top of another text card is exactly as
    real a layering problem as two overlapping shapes. */
function reorderCanvasNode(nodeId, delta) {
  const node = canvasState.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const isGroup = node.type === "group";
  const bucket = canvasState.nodes.filter((n) => (n.type === "group") === isGroup);
  const other = canvasState.nodes.filter((n) => (n.type === "group") !== isGroup);
  const idx = bucket.indexOf(node);
  const swapIdx = idx + delta;
  if (swapIdx < 0 || swapIdx >= bucket.length) return;   // already at that edge
  [bucket[idx], bucket[swapIdx]] = [bucket[swapIdx], bucket[idx]];
  canvasState.nodes = [...other, ...bucket];
  commitCanvasChange(true);
  renderCanvasWorld();
}

function reorderCanvasNodeToEdge(nodeId, toFront) {
  const node = canvasState.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const isGroup = node.type === "group";
  const rest = canvasState.nodes.filter((n) =>
    (n.type === "group") === isGroup && n.id !== nodeId);
  const other = canvasState.nodes.filter((n) => (n.type === "group") !== isGroup);
  const newBucket = toFront ? [...rest, node] : [node, ...rest];
  canvasState.nodes = [...other, ...newBucket];
  commitCanvasChange(true);
  renderCanvasWorld();
}

/** Cam: "choose colour, line width ect... I want the shapes to be
    able to have a color fill them as well." A dedicated dialog
    rather than folding this into the right-click menu's own simple
    list-of-presets style (which is all the existing "Color" submenu
    needs) — arbitrary stroke AND fill colours together, plus a real
    numeric width, genuinely need real form controls, not a list of
    six swatches to click. Reuses #modal-veil, the same veil every
    other real dialog in this app already uses (CC.prompt, moveToFlow)
    — a new, separate veil would be a second, parallel modal system
    for no real reason. Live: every control commits immediately, so
    the preview and the real card on the board update together as
    Cam drags a slider or picks a colour, rather than needing an
    "Apply" click to see anything change. */
function shapeStyleDialog(node) {
  const veil = document.getElementById("cx-modal-veil");
  const hasFill = !!node.fillColor;
  veil.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Shape style</h3>
      <div class="cx-shape-preview" id="cx-shape-preview"></div>
      <div class="cx-shape-style-row">
        <label>Stroke</label>
        <input type="color" id="cx-shape-stroke">
      </div>
      <div class="cx-shape-style-row">
        <label>Line width</label>
        <input type="range" id="cx-shape-width" min="0" max="16" step="1">
        <input type="number" id="cx-shape-width-num" min="0" max="16" step="1">
      </div>
      <div class="cx-shape-style-row">
        <label>Fill</label>
        <input type="color" id="cx-shape-fill">
        <button type="button" class="cx-shape-nofill-btn" id="cx-shape-nofill"
          >No fill</button>
      </div>
      <div class="row"><button class="btn btn-primary" data-act="done"
        >Done</button></div>
    </div>`;

  const strokeInput = veil.querySelector("#cx-shape-stroke");
  const widthRange = veil.querySelector("#cx-shape-width");
  const widthNum = veil.querySelector("#cx-shape-width-num");
  const fillInput = veil.querySelector("#cx-shape-fill");
  const nofillBtn = veil.querySelector("#cx-shape-nofill");
  const preview = veil.querySelector("#cx-shape-preview");

  strokeInput.value = node.strokeColor || "#7c9cff";
  const width = node.strokeWidth === undefined ? 2 : node.strokeWidth;
  widthRange.value = width;
  widthNum.value = width;
  fillInput.value = node.fillColor || "#7c9cff";
  nofillBtn.classList.toggle("cx-on", !hasFill);

  const redraw = () => {
    preview.innerHTML = canvasShapeSVG(node.shapeType || "rectangle", 90, 50,
      node.strokeColor, node.strokeWidth, node.fillColor);
    const cardEl = document.querySelector(
      `.cx-canvas-card[data-node-id="${cssEscapeId(node.id)}"]`);
    if (cardEl) cardEl.innerHTML = canvasShapeCardInnerHTML(node);
  };
  const commit = () => commitCanvasChange(false);

  strokeInput.addEventListener("input", () => {
    node.strokeColor = strokeInput.value;
    redraw(); commit();
  });
  const setWidth = (v) => {
    node.strokeWidth = Math.max(0, Math.min(16, +v || 0));
    widthRange.value = node.strokeWidth;
    widthNum.value = node.strokeWidth;
    redraw(); commit();
  };
  widthRange.addEventListener("input", () => setWidth(widthRange.value));
  widthNum.addEventListener("input", () => setWidth(widthNum.value));
  fillInput.addEventListener("input", () => {
    node.fillColor = fillInput.value;
    nofillBtn.classList.remove("cx-on");
    redraw(); commit();
  });
  nofillBtn.addEventListener("click", () => {
    node.fillColor = null;
    nofillBtn.classList.add("cx-on");
    redraw(); commit();
  });

  redraw();
  const close = () => {
    commitCanvasChange(true);   // one real, discrete undo step for the
                                 // whole editing session, not one per slider tick
    veil.classList.remove("open");
    veil.innerHTML = "";
  };
  veil.querySelector("[data-act=done]").onclick = close;
  veil.onclick = (e) => { if (e.target === veil) close(); };
  veil.classList.add("open");
}

/** The one real place a canvas edit actually commits — records an
    undo step from the text as it was BEFORE this change, re-
    serializes canvasState's own nodes/edges into currentText (the
    real JSON Canvas structure, nothing extra), marks dirty, and
    schedules a save through the exact same pipeline typing in a note
    already uses. force follows the same real rule recordUndoStep
    itself already establishes: a discrete action (create, delete, a
    completed drag or resize) always gets its own step; continuous
    typing in a card's own text coalesces the same way it already
    does everywhere else. */
function commitCanvasChange(force) {
  recordUndoStep("primary", currentText, !!force);
  currentText = JSON.stringify({nodes: canvasState.nodes,
    edges: canvasState.edges});
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

async function openCanvas(path) {
  const existingIdx = tabs.findIndex((t, i) =>
    t.path === path && i !== activeTabIndex);
  if (existingIdx !== -1) { await switchToTab(existingIdx); return; }
  if (dirty) await flushSave();
  currentPath = path;
  currentType = "canvas";
  currentText = (await CC.Store.readCanvas(path)) || CC_EMPTY_CANVAS_JSON;
  canvasState = parseCanvasJSON(currentText, null);
  dirty = false;
  resetUndoHistory("primary");
  renderTree();
  renderCanvasChrome();
  renderCanvasBody();
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex] = {path: currentPath, text: currentText,
      dirty: false, type: "canvas"};
  }
  renderTabBar();
}

function renderCanvasChrome() {
  document.getElementById("cx-breadcrumb").innerHTML =
    `<b>${CC.md.escapeHtml(canvasTitleOf(currentPath))}</b>`;
  document.getElementById("cx-mode-toggle").style.display = "none";
  document.getElementById("cx-zoom-control").style.display = "none";
  document.getElementById("cx-pdf-zoom-control").style.display = "none";
  document.getElementById("cx-canvas-toolbar").style.display = "flex";
  updateCanvasZoomLevel();
}

/** Keeps the toolbar's own displayed zoom percentage in sync — zoom
    can change without a full renderCanvasChrome() call (Ctrl+Scroll,
    for one), so this is called from renderCanvasWorld() too, not
    just here. */
function updateCanvasZoomLevel() {
  const el = document.getElementById("cx-canvas-zoom-level");
  if (el && canvasState) el.textContent = `${Math.round(canvasState.zoom * 100)}%`;
}

function renderCanvasBody() {
  const area = document.getElementById("cx-editor-area");
  area.innerHTML = `
    <div id="cx-canvas-viewport" class="cx-canvas-viewport">
      <div id="cx-canvas-world" class="cx-canvas-world"></div>
      <div id="cx-canvas-hint" class="cx-canvas-hint">
        Drag from below or double click<br>
        Space + Drag to pan<br>
        Ctrl + Scroll to zoom
      </div>
    </div>`;
  renderCanvasWorld();
  wireCanvasViewportInteractions(document.getElementById("cx-canvas-viewport"));
}

/* Cam: continuing the Canvas feature — Phase 2, connections between
   cards. The real JSON Canvas edge shape (fromNode/fromSide/toNode/
   toSide, an optional label) confirmed against the same real spec
   Phase 1 was already built against, not a new format invented for
   this. */

/** The real, fixed world-space point where a connection attaches to
    a card, given which side — the real JSON Canvas spec's own four
    side values (top/right/bottom/left) exactly. */
function canvasNodeSidePoint(node, side) {
  switch (side) {
    case "top": return {x: node.x + node.width / 2, y: node.y};
    case "bottom": return {x: node.x + node.width / 2, y: node.y + node.height};
    case "left": return {x: node.x, y: node.y + node.height / 2};
    case "right": return {x: node.x + node.width, y: node.y + node.height / 2};
    default: return {x: node.x + node.width / 2, y: node.y + node.height / 2};
  }
}

/** Given a real world point (wherever a connection was actually
    dropped), which of a card's own four real sides is closest — used
    to infer toSide when connecting to a card, rather than requiring
    Cam to aim at a specific handle on the target too. Normalized by
    the card's own real width/height first, so a wide card doesn't
    unfairly favor top/bottom just because a horizontal distance is
    naturally larger there. */
function canvasClosestSide(node, point) {
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  const nx = (point.x - cx) / (node.width / 2);
  const ny = (point.y - cy) / (node.height / 2);
  if (Math.abs(nx) > Math.abs(ny)) return nx > 0 ? "right" : "left";
  return ny > 0 ? "bottom" : "top";
}

/** A real, smooth cubic bezier path between two connection points,
    each extending outward from its own real side before curving
    toward the other — the same "flows out from the side" look real
    canvas-style connections have, not a plain straight line between
    two points. toSide may be null (the in-progress, still-being-
    drawn connection has no real target side yet, just wherever the
    cursor currently is). */
function canvasEdgePathD(fromPoint, fromSide, toPoint, toSide) {
  const offset = 60;
  const sideVec = {top: {x: 0, y: -1}, bottom: {x: 0, y: 1},
    left: {x: -1, y: 0}, right: {x: 1, y: 0}};
  const fv = sideVec[fromSide] || {x: 0, y: 0};
  const tv = sideVec[toSide] || {x: 0, y: 0};
  const c1 = {x: fromPoint.x + fv.x * offset, y: fromPoint.y + fv.y * offset};
  const c2 = {x: toPoint.x + tv.x * offset, y: toPoint.y + tv.y * offset};
  return `M ${fromPoint.x} ${fromPoint.y} C ${c1.x} ${c1.y}, `
    + `${c2.x} ${c2.y}, ${toPoint.x} ${toPoint.y}`;
}

/** The full SVG layer — every real, saved connection, plus the
    live, in-progress one while a connection is actually being
    dragged. Sits inside the SAME transformed .cx-canvas-world layer
    the cards themselves live in, so it inherits the exact same pan/
    zoom automatically — every path below is drawn in plain WORLD
    coordinates, never converted to screen space at all. A dangling
    edge (its own fromNode/toNode no longer exists — the node itself
    was deleted some other way) is silently skipped rather than
    crashing the whole canvas. */
function canvasEdgesSVG() {
  if (!canvasState) return "";
  const paths = canvasState.edges.map((edge) => {
    const fromNode = canvasState.nodes.find((n) => n.id === edge.fromNode);
    const toNode = canvasState.nodes.find((n) => n.id === edge.toNode);
    if (!fromNode || !toNode) return "";
    const fromSide = edge.fromSide || "right";
    const toSide = edge.toSide || "left";
    const d = canvasEdgePathD(canvasNodeSidePoint(fromNode, fromSide),
      fromSide, canvasNodeSidePoint(toNode, toSide), toSide);
    const selected = edge.id === canvasState.selectedId
      && canvasState.selectedKind === "edge" ? "cx-canvas-edge-selected" : "";
    return `<path class="cx-canvas-edge ${selected}" d="${d}" `
      + `data-edge-id="${CC.md.escapeHtml(edge.id)}" `
      + `marker-end="url(#cx-canvas-arrowhead)"/>`;
  }).join("");

  let dragPath = "";
  if (canvasDragState && canvasDragState.kind === "connect") {
    const fromNode = canvasState.nodes.find((n) =>
      n.id === canvasDragState.fromNodeId);
    if (fromNode) {
      const fromPoint = canvasNodeSidePoint(fromNode, canvasDragState.fromSide);
      const toPoint = {x: canvasDragState.currentWorldX,
        y: canvasDragState.currentWorldY};
      const d = canvasEdgePathD(fromPoint, canvasDragState.fromSide,
        toPoint, null);
      dragPath = `<path class="cx-canvas-edge cx-canvas-edge-drawing" d="${d}"/>`;
    }
  }

  return `<svg class="cx-canvas-edges-svg" width="1" height="1">
    <defs>
      <marker id="cx-canvas-arrowhead" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="cx-canvas-arrowhead-fill"/>
      </marker>
    </defs>
    ${paths}${dragPath}
  </svg>`;
}

/* Cam: continuing the Canvas feature — Phase 3, more card types.
   The real JSON Canvas "file" node (an existing vault file embedded
   as a card) and "link" node (a plain URL) — confirmed against the
   same real spec every earlier phase was already built against. */

const canvasFileContentCache = new Map();    // note path -> raw text
const canvasFileContentLoading = new Set();  // paths currently being fetched
const canvasImageUrlCache = new Map();       // attachment name -> data URL
const canvasImageUrlLoading = new Set();     // attachment names being fetched

/** A note's own raw text isn't part of the canvas's own JSON at all
    — it's a live reference to a real, separate vault file, not a
    copy — so rendering it needs an async fetch, but canvasCardHTML
    itself runs synchronously as part of a plain render pass. Cached
    once fetched (a card gets re-rendered often — every drag, every
    resize — and shouldn't re-fetch the same file's own content on
    every single one of those); a "Loading…" placeholder shows until
    then, with a fresh renderCanvasWorld() once the real content
    actually arrives. An embedded photo's own real data URL is
    cached the exact same way, for the exact same reason — a base64
    photo can be genuinely large, and re-fetching it from the real
    backend on every single mousemove of an ordinary drag would be
    real, wasteful, unnecessary work. */
function canvasFileCardInnerHTML(node) {
  const path = node.file || "";
  const title = path.split("/").pop();
  const isPdf = /\.pdf$/i.test(path);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
  const openAttrs = `data-open-path="${CC.md.escapeHtml(path)}" `
    + `data-open-type="${isPdf ? "pdf" : isImage ? "image" : "note"}"`;
  if (isImage) {
    // "attachments/photo.png" -> "photo.png", the bare attachment
    // name every real image-serving API in this app already expects
    // — attachments/ is never part of the regular vault tree at all
    // (see list_tree's own docstring), so this is the one, real
    // exception among file cards where "file" isn't a plain,
    // ordinary vault-relative path the rest of the app already uses
    const attachmentName = path.replace(/^attachments\//, "");
    let bodyHtml = '<div class="cx-canvas-file-loading">Loading\u2026</div>';
    if (canvasImageUrlCache.has(attachmentName)) {
      const url = canvasImageUrlCache.get(attachmentName);
      bodyHtml = url
        ? `<img class="cx-canvas-file-image" src="${CC.md.escapeHtml(url)}" `
          + `alt="${CC.md.escapeHtml(title)}" draggable="false">`
        : `<div class="cx-canvas-file-loading">Missing: `
          + `${CC.md.escapeHtml(title)}</div>`;
    } else if (!canvasImageUrlLoading.has(attachmentName)) {
      canvasImageUrlLoading.add(attachmentName);
      CC.Store.imageURL(attachmentName).then((url) => {
        canvasImageUrlCache.set(attachmentName, url || "");
        canvasImageUrlLoading.delete(attachmentName);
        if (currentType === "canvas" && canvasState) renderCanvasWorld();
      });
    }
    return `<div class="cx-canvas-file-card cx-canvas-file-card-image" ${openAttrs}>
      ${bodyHtml}
    </div>`;
  }
  if (isPdf) {
    return `<div class="cx-canvas-file-card cx-canvas-file-card-pdf" ${openAttrs}>
      <div class="cx-canvas-file-icon">${ICON_PDF}</div>
      <div class="cx-canvas-file-title">${CC.md.escapeHtml(title)}</div>
    </div>`;
  }
  let previewHtml = '<div class="cx-canvas-file-loading">Loading\u2026</div>';
  if (canvasFileContentCache.has(path)) {
    previewHtml = CC.md.render(canvasFileContentCache.get(path),
      new Set(titleToPath.keys()));
  } else if (!canvasFileContentLoading.has(path)) {
    canvasFileContentLoading.add(path);
    CC.Store.readNote(path).then((text) => {
      canvasFileContentCache.set(path, text || "");
      canvasFileContentLoading.delete(path);
      if (currentType === "canvas" && canvasState) renderCanvasWorld();
    });
  }
  return `<div class="cx-canvas-file-card cx-canvas-file-card-note" ${openAttrs}>
    <div class="cx-canvas-file-title">${CC.md.escapeHtml(title)}</div>
    <div class="cx-canvas-file-preview">${previewHtml}</div>
  </div>`;
}

function canvasLinkCardInnerHTML(node) {
  const url = node.url || "";
  let domain = url;
  try { domain = new URL(url).hostname || url; } catch (err) { /* keep raw url */ }
  return `<div class="cx-canvas-link-card" data-open-url="${CC.md.escapeHtml(url)}">
    <div class="cx-canvas-link-icon">${ICON_LINK}</div>
    <div class="cx-canvas-link-domain">${CC.md.escapeHtml(domain)}</div>
    <div class="cx-canvas-link-url">${CC.md.escapeHtml(url)}</div>
  </div>`;
}

/** Cam: "To canvas add the ability to add shapes (choose colour,
    line width ect.)... I want the shapes to be able to have a color
    fill them as well." Rendered as a real, direct SVG rather than a
    CSS-class trick (which is what every other card's own "color"
    already uses, but that's limited to 6 fixed presets on a border
    only) — a shape needs arbitrary stroke AND fill colours together,
    which only a real <rect>/<ellipse>/<polygon> with its own
    fill/stroke/stroke-width attributes can give directly. Four solid
    primitives on purpose, not a "line" — this app already has real
    connections (edges) for pointing/linking between cards; a
    duplicate "line shape" would just be a worse version of that. */
const SHAPE_TYPES = [
  ["rectangle", "Rectangle"], ["ellipse", "Ellipse"],
  ["triangle", "Triangle"], ["diamond", "Diamond"],
];

function canvasShapePoints(shapeType, w, h, inset) {
  if (shapeType === "triangle") {
    return `${w / 2},${inset} ${w - inset},${h - inset} ${inset},${h - inset}`;
  }
  if (shapeType === "diamond") {
    return `${w / 2},${inset} ${w - inset},${h / 2} ${w / 2},${h - inset} ${inset},${h / 2}`;
  }
  return null;
}

/** The one real place a shape's own visual is actually drawn — used
    both by the live card on the board (canvasShapeCardInnerHTML) and
    the style dialog's own live preview, so the two can never
    silently drift apart into looking different from each other. */
function canvasShapeSVG(shapeType, width, height, strokeColor, strokeWidth, fillColor) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const sw = Math.max(0, strokeWidth);
  const inset = sw / 2;
  const fillAttr = fillColor ? CC.md.escapeHtml(fillColor) : "none";
  const strokeAttr = CC.md.escapeHtml(strokeColor || "#7c9cff");
  let shapeEl;
  if (shapeType === "ellipse") {
    shapeEl = `<ellipse cx="${w / 2}" cy="${h / 2}" `
      + `rx="${Math.max(0, w / 2 - inset)}" ry="${Math.max(0, h / 2 - inset)}"/>`;
  } else if (shapeType === "triangle" || shapeType === "diamond") {
    shapeEl = `<polygon points="${canvasShapePoints(shapeType, w, h, inset)}"/>`;
  } else {
    shapeEl = `<rect x="${inset}" y="${inset}" width="${Math.max(0, w - sw)}" `
      + `height="${Math.max(0, h - sw)}" rx="4"/>`;
  }
  return `<svg class="cx-canvas-shape-svg" viewBox="0 0 ${w} ${h}" `
    + `preserveAspectRatio="none">`
    + `<g fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${sw}" `
    + `stroke-linejoin="round">${shapeEl}</g></svg>`;
}

function canvasShapeCardInnerHTML(node) {
  return canvasShapeSVG(node.shapeType || "rectangle", node.width, node.height,
    node.strokeColor, node.strokeWidth === undefined ? 2 : node.strokeWidth,
    node.fillColor || null);
}

function canvasTextCardInnerHTML(node) {
  const text = typeof node.text === "string" ? node.text : "";
  return `<div class="cx-canvas-card-text" contenteditable="true"
           >${CC.md.escapeHtml(text)}</div>`;
}

/** A group renders as a large background rectangle with its own
    label, deliberately with no connection handles at all — Cam's
    own real ask was groups and colors specifically; connecting an
    edge TO a group is real, separate scope of its own, not silently
    included here. */
function canvasGroupHTML(node) {
  const selected = node.id === canvasState.selectedId
    && canvasState.selectedKind === "node" ? "cx-canvas-group-selected" : "";
  const colorClass = node.color ? `cx-canvas-color-${node.color}` : "";
  const label = typeof node.label === "string" ? node.label : "Group";
  return `
    <div class="cx-canvas-group ${colorClass} ${selected}"
         data-node-id="${CC.md.escapeHtml(node.id)}"
         style="left:${node.x}px; top:${node.y}px;
                width:${node.width}px; height:${node.height}px;">
      <div class="cx-canvas-group-label">${CC.md.escapeHtml(label)}</div>
      <div class="cx-canvas-resize-handle"></div>
    </div>`;
}

function canvasCardHTML(node) {
  const selected = node.id === canvasState.selectedId
    && canvasState.selectedKind === "node" ? "cx-canvas-card-selected" : "";
  const colorClass = node.color ? `cx-canvas-color-${node.color}` : "";
  const handles = ["top", "right", "bottom", "left"].map((side) =>
    `<div class="cx-canvas-connect-handle cx-canvas-connect-${side}"
          data-side="${side}"></div>`).join("");
  const kind = node.type === "file" || node.type === "link" || node.type === "shape"
    ? node.type : "text";
  const inner = kind === "file" ? canvasFileCardInnerHTML(node)
    : kind === "link" ? canvasLinkCardInnerHTML(node)
    : kind === "shape" ? canvasShapeCardInnerHTML(node)
    : canvasTextCardInnerHTML(node);
  return `
    <div class="cx-canvas-card cx-canvas-card-kind-${kind} ${colorClass} ${selected}"
         data-node-id="${CC.md.escapeHtml(node.id)}"
         style="left:${node.x}px; top:${node.y}px;
                width:${node.width}px; height:${node.height}px;">
      ${inner}
      <div class="cx-canvas-resize-handle"></div>
      ${handles}
    </div>`;
}

function renderCanvasWorld() {
  const world = document.getElementById("cx-canvas-world");
  const hint = document.getElementById("cx-canvas-hint");
  if (!world || !canvasState) return;
  world.style.transform = `translate(${canvasState.panX}px, `
    + `${canvasState.panY}px) scale(${canvasState.zoom})`;
  // groups render as the backmost real layer, then the SVG edges,
  // then the cards themselves on top — a connection or a card should
  // never be visually hidden behind a group's own background, and a
  // group should never be drawn on top of the real cards it's
  // meant to be sitting BEHIND
  const groups = canvasState.nodes.filter((n) => n.type === "group");
  const cards = canvasState.nodes.filter((n) => n.type !== "group");
  world.innerHTML = groups.map(canvasGroupHTML).join("")
    + canvasEdgesSVG()
    + cards.map(canvasCardHTML).join("");
  if (hint) {
    hint.style.display = canvasState.nodes.length === 0 ? "block" : "none";
  }
  wireCanvasCardInteractions(world);
  wireCanvasGroupInteractions(world);
  wireCanvasEdgeInteractions(world);
  updateCanvasZoomLevel();
}

/** A screen position (e.g. e.clientX/clientY) -> the real world
    position it corresponds to right now, accounting for both the
    current pan AND zoom — the one real conversion every canvas
    interaction (creating a card where you actually clicked, moving
    one by the real distance the cursor moved) depends on getting
    right. */
function canvasScreenToWorld(screenX, screenY) {
  const viewport = document.getElementById("cx-canvas-viewport");
  const rect = viewport.getBoundingClientRect();
  return {
    x: (screenX - rect.left - canvasState.panX) / canvasState.zoom,
    y: (screenY - rect.top - canvasState.panY) / canvasState.zoom,
  };
}

function createCanvasTextCardAt(worldX, worldY) {
  const width = 250, height = 60;
  const node = {
    id: generateCanvasNodeId(), type: "text",
    x: Math.round(worldX - width / 2), y: Math.round(worldY - height / 2),
    width, height, text: "",
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
  const el = document.querySelector(
    `.cx-canvas-card[data-node-id="${cssEscapeId(node.id)}"] `
    + `.cx-canvas-card-text`);
  if (el && el.focus) el.focus();
}

/** Mirrors createCanvasTextCardAt exactly — same push/select/commit/
    render sequence, just seeded with shape-specific fields instead
    of an empty text string. Defaults (accent-blue stroke, 2px width,
    no fill) match this app's own accent colour so a freshly-placed
    shape reads as "part of Amnesia" immediately, not a jarring
    default straight off some generic template. */
function createCanvasShapeAt(worldX, worldY, shapeType) {
  const width = 160, height = 120;
  const node = {
    id: generateCanvasNodeId(), type: "shape", shapeType: shapeType || "rectangle",
    x: Math.round(worldX - width / 2), y: Math.round(worldY - height / 2),
    width, height, strokeColor: "#7c9cff", strokeWidth: 2, fillColor: null,
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
}

/** CSS.escape isn't available in every real environment this app
    might run in — node ids are always this app's own generated,
    plain alphanumeric strings (see generateCanvasNodeId), so a
    direct, simple escape is genuinely sufficient here without
    depending on that API existing at all. */
function cssEscapeId(id) {
  return String(id).replace(/["\\]/g, "\\$&");
}

/** Zooms toward a specific screen point (the real cursor position)
    rather than the canvas's own origin — the same real point under
    the cursor stays under the cursor after zooming, which is what
    makes Ctrl+Scroll actually feel right rather than the view
    drifting out from under you. */
function zoomCanvasAt(screenX, screenY, factor) {
  const viewport = document.getElementById("cx-canvas-viewport");
  const rect = viewport.getBoundingClientRect();
  const oldZoom = canvasState.zoom;
  const newZoom = Math.max(0.1, Math.min(4, oldZoom * factor));
  const localX = screenX - rect.left, localY = screenY - rect.top;
  const worldX = (localX - canvasState.panX) / oldZoom;
  const worldY = (localY - canvasState.panY) / oldZoom;
  canvasState.panX = localX - worldX * newZoom;
  canvasState.panY = localY - worldY * newZoom;
  canvasState.zoom = newZoom;
  renderCanvasWorld();
}

/* Cam: "Where are all the tools?" — the hint bubble is the ONLY
   thing that ever showed pan/zoom/create at all, and it disappears
   the moment a single real card exists, leaving no visible way to
   discover any of this again. These three back the new, real,
   always-visible toolbar (#cx-canvas-toolbar) rather than leaving
   every interaction undiscoverable once the board isn't empty. */

/** The current viewport's own real center, converted to world space —
    the one sensible default position for anything a toolbar button
    creates, since a button click (unlike a double-click or a drag)
    has no cursor position of its own on the canvas at all. */
function canvasViewportCenterWorld() {
  const viewport = document.getElementById("cx-canvas-viewport");
  const rect = viewport.getBoundingClientRect();
  return canvasScreenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

/** The toolbar's own "+" button — creates a card centered in
    whatever's currently visible, since a button click (unlike a
    double-click) has no specific position of its own to place one
    at. */
function addCanvasCardViaToolbar() {
  const world = canvasViewportCenterWorld();
  createCanvasTextCardAt(world.x, world.y);
}

/** The toolbar's own "Add a shape" button — reuses renderCtxMenu (the
    exact same popup this app already uses for every right-click
    menu) rather than a bespoke dropdown, so a shape-type choice looks
    and behaves identically to every other menu in Amnesia. */
/** v299 — Cam: "Can't see the new tool?" The real bug: a global
    document-level click listener closes any open context menu
    whenever the click target isn't inside .cx-ctx-menu (the normal,
    correct way a menu dismisses when you click elsewhere). Every
    EXISTING context menu in this app opens from a real right-click
    (a "contextmenu" event), which never also fires a "click" — so
    that global listener never had a reason to interfere with them.
    This toolbar button opens the exact same menu from a real
    left-click instead, and that same click keeps bubbling upward
    after this handler runs, straight into that global listener,
    which closes the menu in the very same tick it just opened —
    genuinely invisible, not almost-invisible, confirmed directly
    with a real browser (jsdom's synthetic .click() doesn't reproduce
    this timing, which is why it slipped through the first time).
    stopPropagation() here is the fix: this click is fully handled by
    opening the menu, so it has no business reaching that unrelated
    listener at all. */
function addCanvasShapeViaToolbar(e) {
  e.stopPropagation();
  const world = canvasViewportCenterWorld();
  const items = SHAPE_TYPES.map(([type, label]) =>
    [label, () => createCanvasShapeAt(world.x, world.y, type)]);
  renderCtxMenu(items, e.clientX, e.clientY);
}

/** The toolbar's own zoom in/out buttons — the same real
    cursor-anchored zoomCanvasAt above, just anchored at the
    viewport's own center instead of a real cursor position, since a
    button click has no cursor position on the canvas itself either. */
function zoomCanvasButton(factor) {
  const viewport = document.getElementById("cx-canvas-viewport");
  const rect = viewport.getBoundingClientRect();
  zoomCanvasAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

/** Cam: continuing the Canvas feature — Phase 3, more card types.
    Reuses the exact same picker UI openExistingItemFlow already
    established for "Open note or PDF..." on an empty tab, but
    resolves with the chosen path instead of opening it — a
    genuinely separate, parallel flow rather than a modified version
    of the original, so nothing about that already-proven picker is
    put at any risk. */
function pickFileForCanvasCard() {
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    const items = flattenOpenable(tree);
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Add a note or PDF to the canvas</h3>
        <input type="text" class="cx-open-search" placeholder="Search...">
        <div class="cx-move-list cx-open-list"></div>
        <div class="row"><button class="btn btn-quiet"
          data-act="no">Cancel</button></div>
      </div>`;
    const listEl = veil.querySelector(".cx-open-list");
    const searchEl = veil.querySelector(".cx-open-search");
    const renderList = (query) => {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? items.filter((it) => it.title.toLowerCase().includes(q))
        : items;
      listEl.innerHTML = filtered.length
        ? filtered.map((it) => `<button class="cx-move-item cx-open-item"
            data-path="${CC.md.escapeHtml(it.path)}">${CC.md.escapeHtml(it.title)}
            <span class="cx-open-item-path">${
              CC.md.escapeHtml(it.path)}</span></button>`).join("")
        : `<div class="cx-open-empty">No matches.</div>`;
      listEl.querySelectorAll(".cx-open-item").forEach((b) =>
        b.addEventListener("click", () => close(b.dataset.path)));
    };
    const close = (path) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      resolve(path || null);
    };
    renderList("");
    searchEl.addEventListener("input", () => renderList(searchEl.value));
    veil.querySelector("[data-act=no]").onclick = () => close(null);
    veil.onclick = (e) => { if (e.target === veil) close(null); };
    veil.classList.add("open");
    searchEl.focus();
  });
}


/** Cam: "Does canvas allow me to add photos onto the canvas as
    well?" -> "Pick from existing attachments". Mirrors
    pickFileForCanvasCard's own exact modal structure above, but
    async at the top level, since it needs to await the real list of
    attachments before it can even build the picker at all. */
async function pickAttachmentForCanvasCard() {
  const names = await CC.Store.listAttachments();
  return new Promise((resolve) => {
    const veil = document.getElementById("cx-modal-veil");
    veil.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>Add a photo to the canvas</h3>
        <input type="text" class="cx-open-search" placeholder="Search...">
        <div class="cx-move-list cx-open-list"></div>
        <div class="row"><button class="btn btn-quiet"
          data-act="no">Cancel</button></div>
      </div>`;
    const listEl = veil.querySelector(".cx-open-list");
    const searchEl = veil.querySelector(".cx-open-search");
    const renderList = (query) => {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? names.filter((n) => n.toLowerCase().includes(q))
        : names;
      listEl.innerHTML = filtered.length
        ? filtered.map((n) => `<button class="cx-move-item cx-open-item"
            data-name="${CC.md.escapeHtml(n)}">${
              CC.md.escapeHtml(n)}</button>`).join("")
        : `<div class="cx-open-empty">${names.length ? "No matches."
            : "No photos attached to any note yet — attach one to a "
              + "note first, or drag a photo file onto the canvas "
              + "directly."}</div>`;
      listEl.querySelectorAll(".cx-open-item").forEach((b) =>
        b.addEventListener("click", () => close(b.dataset.name)));
    };
    const close = (name) => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      resolve(name || null);
    };
    renderList("");
    searchEl.addEventListener("input", () => renderList(searchEl.value));
    veil.querySelector("[data-act=no]").onclick = () => close(null);
    veil.onclick = (e) => { if (e.target === veil) close(null); };
    veil.classList.add("open");
    searchEl.focus();
  });
}

function createCanvasFileCard(path) {
  const center = canvasViewportCenterWorld();
  const width = 280, height = 200;
  const node = {
    id: generateCanvasNodeId(), type: "file",
    x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2),
    width, height, file: path,
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
}

function createCanvasLinkCard(url) {
  const center = canvasViewportCenterWorld();
  const width = 240, height = 90;
  const node = {
    id: generateCanvasNodeId(), type: "link",
    x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2),
    width, height, url,
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
}

function createCanvasGroup() {
  const center = canvasViewportCenterWorld();
  const width = 400, height = 300;
  const node = {
    id: generateCanvasNodeId(), type: "group",
    x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2),
    width, height, label: "Group",
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
}

/** Unlike the other toolbar-only creation functions above, this
    takes explicit world coordinates rather than always centering in
    the viewport — it serves two genuinely different real callers:
    the toolbar's own picker (which centers it) and the real,
    native drag-and-drop handler (which needs to place it exactly
    where a real photo was actually dropped). */
function createCanvasImageCard(attachmentName, worldX, worldY) {
  const width = 280, height = 210;
  const node = {
    id: generateCanvasNodeId(), type: "file",
    x: Math.round(worldX - width / 2), y: Math.round(worldY - height / 2),
    width, height, file: `attachments/${attachmentName}`,
  };
  canvasState.nodes.push(node);
  canvasState.selectedId = node.id;
  canvasState.selectedKind = "node";
  commitCanvasChange(true);
  renderCanvasWorld();
}

async function addCanvasFileCardViaToolbar() {
  const path = await pickFileForCanvasCard();
  if (!path) return;
  createCanvasFileCard(path);
}

async function addCanvasImageCardViaToolbar() {
  const name = await pickAttachmentForCanvasCard();
  if (!name) return;
  const center = canvasViewportCenterWorld();
  createCanvasImageCard(name, center.x, center.y);
}

async function addCanvasLinkCardViaToolbar() {
  const url = await CC.prompt({title: "Add a link card",
    placeholder: "https://...", yes: "Add"});
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) {
    CC.toast("That doesn't look like a real web address \u2014 links need "
      + "to start with http:// or https://", "error");
    return;
  }
  createCanvasLinkCard(url);
}

/** Obsidian's own real "Zoom to fit all cards" — genuinely important
    on its own, not just a discoverability nicety: pan far enough
    away and there'd otherwise be no way back to your own cards at
    all short of guessing. Computes the real bounding box of every
    real card, then sets pan/zoom so all of it fits within the
    viewport with a real, comfortable margin. */
function zoomCanvasToFit() {
  if (!canvasState || !canvasState.nodes.length) return;
  const minX = Math.min(...canvasState.nodes.map((n) => n.x));
  const minY = Math.min(...canvasState.nodes.map((n) => n.y));
  const maxX = Math.max(...canvasState.nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...canvasState.nodes.map((n) => n.y + n.height));
  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const viewport = document.getElementById("cx-canvas-viewport");
  const rect = viewport.getBoundingClientRect();
  const padding = 60;
  const scaleX = (rect.width - padding * 2) / boundsWidth;
  const scaleY = (rect.height - padding * 2) / boundsHeight;
  const newZoom = Math.max(0.1, Math.min(2, Math.min(scaleX, scaleY)));
  canvasState.zoom = newZoom;
  canvasState.panX = (rect.width - boundsWidth * newZoom) / 2 - minX * newZoom;
  canvasState.panY = (rect.height - boundsHeight * newZoom) / 2 - minY * newZoom;
  renderCanvasWorld();
}

let canvasSpaceHeld = false;

function wireCanvasViewportInteractions(viewport) {
  viewport.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomCanvasAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, {passive: false});

  viewport.addEventListener("dblclick", (e) => {
    if (e.target.closest(".cx-canvas-card")) return;
    const world = canvasScreenToWorld(e.clientX, e.clientY);
    createCanvasTextCardAt(world.x, world.y);
  });

  viewport.addEventListener("mousedown", (e) => {
    if (!canvasSpaceHeld) {
      if (!e.target.closest(".cx-canvas-card")
          && !e.target.closest(".cx-canvas-edge")) {
        canvasState.selectedId = null;
        canvasState.selectedKind = null;
        renderCanvasWorld();
      }
      return;
    }
    e.preventDefault();
    canvasDragState = {
      kind: "pan", startX: e.clientX, startY: e.clientY,
      startPanX: canvasState.panX, startPanY: canvasState.panY,
    };
    window.addEventListener("mousemove", onCanvasDragMove);
    window.addEventListener("mouseup", onCanvasDragEnd);
  });

  /* Cam: "Does canvas allow me to add photos onto the canvas as
     well?" -> "Both" — dragging a real photo in from outside the
     app entirely (the file manager, a browser, anywhere) is a real,
     genuinely different mechanism from every other drag this app
     already has: it's the OS itself managing the gesture right up
     until the actual drop, not this app's own mousedown/mousemove/
     mouseup system, so it needs the real, standard, native
     dragover/drop events instead. */
  viewport.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  viewport.addEventListener("drop", async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files
        || !e.dataTransfer.files.length) {
      return;
    }
    e.preventDefault();
    const world = canvasScreenToWorld(e.clientX, e.clientY);
    const files = [...e.dataTransfer.files].filter((f) =>
      /^image\/(png|jpe?g|gif|webp)$/i.test(f.type));
    if (!files.length) {
      CC.toast("That doesn't look like a supported photo type.", "error");
      return;
    }
    let offset = 0;
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
        + Math.random().toString(36).slice(2, 6);
      const saved = await CC.Store.saveImage(`canvas-photo-${stamp}.${ext}`,
        dataUrl);
      // a slight, deliberate stagger so dropping several photos at
      // once doesn't land them all in one identical, fully
      // overlapping stack at the exact same real spot
      createCanvasImageCard(saved, world.x + offset, world.y + offset);
      offset += 30;
    }
    CC.toast(files.length === 1 ? "Photo added."
      : `${files.length} photos added.`);
  });
}

function onCanvasDragMove(e) {
  if (!canvasDragState || !canvasState) return;
  const dx = e.clientX - canvasDragState.startX;
  const dy = e.clientY - canvasDragState.startY;
  if (canvasDragState.kind === "pan") {
    canvasState.panX = canvasDragState.startPanX + dx;
    canvasState.panY = canvasDragState.startPanY + dy;
    renderCanvasWorld();
  } else if (canvasDragState.kind === "move") {
    const node = canvasDragState.node;
    node.x = Math.round(canvasDragState.startNodeX + dx / canvasState.zoom);
    node.y = Math.round(canvasDragState.startNodeY + dy / canvasState.zoom);
    renderCanvasWorld();
  } else if (canvasDragState.kind === "move-group") {
    const node = canvasDragState.node;
    node.x = Math.round(canvasDragState.startNodeX + dx / canvasState.zoom);
    node.y = Math.round(canvasDragState.startNodeY + dy / canvasState.zoom);
    canvasDragState.contained.forEach((c) => {
      c.node.x = Math.round(c.startX + dx / canvasState.zoom);
      c.node.y = Math.round(c.startY + dy / canvasState.zoom);
    });
    renderCanvasWorld();
  } else if (canvasDragState.kind === "resize") {
    const node = canvasDragState.node;
    node.width = Math.max(80, Math.round(
      canvasDragState.startWidth + dx / canvasState.zoom));
    node.height = Math.max(40, Math.round(
      canvasDragState.startHeight + dy / canvasState.zoom));
    renderCanvasWorld();
  } else if (canvasDragState.kind === "connect") {
    const world = canvasScreenToWorld(e.clientX, e.clientY);
    canvasDragState.currentWorldX = world.x;
    canvasDragState.currentWorldY = world.y;
    renderCanvasWorld();
  }
}

function onCanvasDragEnd(e) {
  window.removeEventListener("mousemove", onCanvasDragMove);
  window.removeEventListener("mouseup", onCanvasDragEnd);
  if (canvasDragState && canvasDragState.kind === "connect") {
    const targetCardEl = e && e.target && e.target.closest
      ? e.target.closest(".cx-canvas-card") : null;
    const toNode = targetCardEl
      ? canvasState.nodes.find((n) => n.id === targetCardEl.dataset.nodeId)
      : null;
    if (toNode && toNode.id !== canvasDragState.fromNodeId) {
      const dropPoint = {x: canvasDragState.currentWorldX,
        y: canvasDragState.currentWorldY};
      const toSide = canvasClosestSide(toNode, dropPoint);
      const edge = {id: generateCanvasNodeId(),
        fromNode: canvasDragState.fromNodeId,
        fromSide: canvasDragState.fromSide, toNode: toNode.id, toSide};
      canvasState.edges.push(edge);
      canvasState.selectedId = edge.id;
      canvasState.selectedKind = "edge";
      commitCanvasChange(true);
    }
    canvasDragState = null;
    renderCanvasWorld();
    return;
  }
  if (canvasDragState && canvasDragState.kind !== "pan") {
    commitCanvasChange(true);
  }
  canvasDragState = null;
}

function wireCanvasCardInteractions(world) {
  world.querySelectorAll(".cx-canvas-card").forEach((cardEl) => {
    const nodeId = cardEl.dataset.nodeId;
    const node = canvasState.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    cardEl.addEventListener("mousedown", (e) => {
      const handleEl = e.target.closest(".cx-canvas-connect-handle");
      if (handleEl) {
        e.preventDefault();
        e.stopPropagation();
        const startWorld = canvasScreenToWorld(e.clientX, e.clientY);
        canvasDragState = {
          kind: "connect", fromNodeId: node.id,
          fromSide: handleEl.dataset.side,
          currentWorldX: startWorld.x, currentWorldY: startWorld.y,
        };
        window.addEventListener("mousemove", onCanvasDragMove);
        window.addEventListener("mouseup", onCanvasDragEnd);
        renderCanvasWorld();
        return;
      }
      if (e.target.closest(".cx-canvas-resize-handle")) {
        e.preventDefault();
        canvasState.selectedId = node.id;
        canvasState.selectedKind = "node";
        canvasDragState = {
          kind: "resize", node,
          startX: e.clientX, startY: e.clientY,
          startWidth: node.width, startHeight: node.height,
        };
        window.addEventListener("mousemove", onCanvasDragMove);
        window.addEventListener("mouseup", onCanvasDragEnd);
        renderCanvasWorld();
        return;
      }
      if (e.target.closest(".cx-canvas-card-text")) {
        canvasState.selectedId = node.id;
        canvasState.selectedKind = "node";
        return;   // let the browser place a normal text cursor
      }
      e.preventDefault();
      canvasState.selectedId = node.id;
      canvasState.selectedKind = "node";
      canvasDragState = {
        kind: "move", node,
        startX: e.clientX, startY: e.clientY,
        startNodeX: node.x, startNodeY: node.y,
      };
      window.addEventListener("mousemove", onCanvasDragMove);
      window.addEventListener("mouseup", onCanvasDragEnd);
      renderCanvasWorld();
    });

    const textEl = cardEl.querySelector(".cx-canvas-card-text");
    if (textEl) {
      textEl.addEventListener("input", () => {
        node.text = textEl.textContent;
        commitCanvasChange(false);
      });
      textEl.addEventListener("keydown", (e) => {
        e.stopPropagation();   // never let Delete/Backspace while
                               // typing reach the card-delete handler
      });
    }

    cardEl.addEventListener("dblclick", (e) => {
      const openPathEl = e.target.closest("[data-open-path]");
      const openUrlEl = e.target.closest("[data-open-url]");
      if (openPathEl) {
        e.stopPropagation();
        if (openPathEl.dataset.openType === "image") {
          CC.Store.openInDefaultApp(openPathEl.dataset.openPath);
        } else {
          openInNewTab(openPathEl.dataset.openPath);
        }
      } else if (openUrlEl) {
        e.stopPropagation();
        if (window.CP && window.CP.Store) {
          window.CP.Store.call("notes_open_external",
            [openUrlEl.dataset.openUrl], "Notes");
        }
      }
    });

    cardEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openCanvasNodeMenu(node, e.clientX, e.clientY);
    });
  });
}

/** Groups get their own, separate wiring rather than being folded
    into wireCanvasCardInteractions above — the one real, meaningful
    difference is that MOVING a group also moves whatever's spatially
    inside it, which none of the other node kinds need at all. */
function wireCanvasGroupInteractions(world) {
  world.querySelectorAll(".cx-canvas-group").forEach((groupEl) => {
    const nodeId = groupEl.dataset.nodeId;
    const node = canvasState.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    groupEl.addEventListener("mousedown", (e) => {
      if (e.target.closest(".cx-canvas-resize-handle")) {
        e.preventDefault();
        canvasState.selectedId = node.id;
        canvasState.selectedKind = "node";
        canvasDragState = {
          kind: "resize", node,
          startX: e.clientX, startY: e.clientY,
          startWidth: node.width, startHeight: node.height,
        };
        window.addEventListener("mousemove", onCanvasDragMove);
        window.addEventListener("mouseup", onCanvasDragEnd);
        renderCanvasWorld();
        return;
      }
      e.preventDefault();
      canvasState.selectedId = node.id;
      canvasState.selectedKind = "node";
      // real, spatial containment — whichever other real nodes are
      // genuinely inside this group's own bounds right now, computed
      // once at the START of the drag (the group itself is what's
      // about to move, so this can't be recomputed continuously
      // without a group dragging its own contents right out from
      // under themselves)
      const contained = canvasState.nodes.filter((n) =>
        n.id !== node.id && n.type !== "group"
        && n.x >= node.x && n.y >= node.y
        && n.x + n.width <= node.x + node.width
        && n.y + n.height <= node.y + node.height)
        .map((n) => ({node: n, startX: n.x, startY: n.y}));
      canvasDragState = {
        kind: "move-group", node,
        startX: e.clientX, startY: e.clientY,
        startNodeX: node.x, startNodeY: node.y,
        contained,
      };
      window.addEventListener("mousemove", onCanvasDragMove);
      window.addEventListener("mouseup", onCanvasDragEnd);
      renderCanvasWorld();
    });

    groupEl.addEventListener("dblclick", async (e) => {
      if (e.target.closest(".cx-canvas-resize-handle")) return;
      e.stopPropagation();
      await renameCanvasGroupFlow(node);
    });

    groupEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openCanvasNodeMenu(node, e.clientX, e.clientY);
    });
  });
}

async function renameCanvasGroupFlow(node) {
  const newLabel = await CC.prompt({title: "Rename group",
    value: node.label || "", placeholder: "Group name", yes: "Rename"});
  if (newLabel === null) return;
  node.label = newLabel;
  commitCanvasChange(true);
  renderCanvasWorld();
}

/** The real, shared right-click menu for any card OR group —
    "Color" (the same six real presets, reused for both), and for a
    group specifically, "Rename group" too. "Delete" reuses
    deleteCanvasSelection exactly, by first making this the real,
    current selection — the one, single, real deletion path, not a
    second one built just for right-click. */
function openCanvasNodeMenu(node, x, y) {
  const items = [
    ["Color", null, false, [
      ...CANVAS_COLOR_PRESETS.map(([num, name]) =>
        [name, () => setCanvasNodeColor(node.id, num)]),
      null,
      ["Remove color", () => setCanvasNodeColor(node.id, null)],
    ]],
  ];
  if (node.type === "shape") {
    items.push(["Style\u2026", () => shapeStyleDialog(node)]);
  }
  if (node.type === "group") {
    items.push(["Rename group", () => renameCanvasGroupFlow(node)]);
  }
  items.push(["Layer", null, false, [
    ["Bring to front", () => reorderCanvasNodeToEdge(node.id, true)],
    ["Send forward", () => reorderCanvasNode(node.id, 1)],
    ["Send backward", () => reorderCanvasNode(node.id, -1)],
    ["Send to back", () => reorderCanvasNodeToEdge(node.id, false)],
  ]]);
  items.push(["Delete", () => {
    canvasState.selectedId = node.id;
    canvasState.selectedKind = "node";
    deleteCanvasSelection();
  }, true]);
  renderCtxMenu(items, x, y);
}

/** Click-to-select on a real, existing connection — the in-progress
    "drawing" path (while dragging a new connection) has no real edge
    id at all and is silently skipped, since there's nothing to
    select yet. */
function wireCanvasEdgeInteractions(world) {
  world.querySelectorAll(".cx-canvas-edge").forEach((pathEl) => {
    const edgeId = pathEl.dataset.edgeId;
    if (!edgeId) return;
    pathEl.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      canvasState.selectedId = edgeId;
      canvasState.selectedKind = "edge";
      renderCanvasWorld();
    });
  });
}

/** The one real place a selected node OR edge actually gets deleted
    — shared by the Delete/Backspace keydown handler below and the
    right-click menu's own "Delete" item, so there's exactly one real
    implementation of "what deleting the current selection means,"
    not two that could quietly drift apart. */
function deleteCanvasSelection() {
  if (!canvasState || !canvasState.selectedId) return;
  if (canvasState.selectedKind === "edge") {
    canvasState.edges = canvasState.edges.filter((edge) =>
      edge.id !== canvasState.selectedId);
  } else {
    canvasState.nodes = canvasState.nodes.filter((n) =>
      n.id !== canvasState.selectedId);
    canvasState.edges = canvasState.edges.filter((edge) =>
      edge.fromNode !== canvasState.selectedId
      && edge.toNode !== canvasState.selectedId);
  }
  canvasState.selectedId = null;
  canvasState.selectedKind = null;
  commitCanvasChange(true);
  renderCanvasWorld();
}

/* Cam: "have a look at obisidians webpage... I want an in depth
   system implemented into Cortex." Delete/Backspace with a card OR a
   connection selected (and NOT actively focused for text editing —
   the keydown listener on each card's own text above already stops
   that case from ever reaching here) removes whichever one is
   actually selected. */
window.addEventListener("keydown", (e) => {
  if (currentType !== "canvas" || !canvasState || !canvasState.selectedId) {
    return;
  }
  if (e.key !== "Delete" && e.key !== "Backspace") return;
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains(
      "cx-canvas-card-text")) {
    return;
  }
  e.preventDefault();
  deleteCanvasSelection();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && currentType === "canvas") {
    const active = document.activeElement;
    const isTyping = active && active.classList
      && active.classList.contains("cx-canvas-card-text");
    if (!isTyping) canvasSpaceHeld = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") canvasSpaceHeld = false;
});

async function computeBacklinks(path) {
  const title = noteTitleOf(path).toLowerCase();
  const hits = [];
  for (const n of allNotes) {
    if (n.path === path) continue;
    const text = await CC.Store.readNote(n.path);
    if (!text) continue;
    const links = CC.md.extractLinks(text).map((t) => t.toLowerCase());
    if (links.includes(title)) hits.push(n);
  }
  return hits;
}

/* ============================================================================
   HTML -> MARKDOWN — the inverse of CC.md.render(), for Data Entry
   mode (labeled "View Edit" until v289 — see MODES/setMode).
   Cam: "add a new feature called view edit. Where i can edit the view
   version and it will allow me to make changes while mainting the
   formatting present already. This will allow me to make templates,
   then edit them without the risk of destroying the templates."

   Deliberately defensive throughout: real contenteditable editing in
   a real browser produces genuinely messy, engine-specific DOM (a
   paste can introduce a stray <span style="...">, Enter can produce
   a bare <div> instead of a <p> depending on the engine) — an
   unrecognized element always falls through to recursing into its
   own children rather than being dropped, so Cam's own typed content
   is never silently lost even where formatting fidelity has a rough
   edge. Matches CC.md's own real scope exactly (the same realistic
   subset, not full CommonMark) — there is no format this can produce
   that CC.md.render() can't already show.
   ============================================================================ */
function htmlToMarkdown(root) {
  const blocks = [];
  for (const child of root.childNodes) {
    const block = serializeBlock(child);
    if (block !== null && block.trim() !== "") blocks.push(block);
  }
  return blocks.join("\n\n") + (blocks.length ? "\n" : "");
}

function serializeBlock(node) {
  if (node.nodeType === 3) {   // TEXT_NODE
    const text = node.textContent.replace(/\u200b/g, "").trim();
    return text || null;
  }
  if (node.nodeType !== 1) return null;   // ELEMENT_NODE only beyond here
  const tag = node.tagName.toLowerCase();
  /* A Grid writes back exactly the text it carries -- never its drawn
     cells. Without this it is a <div>, which is flattened to plain text
     below, and a grid's formulas, formats and chart would be lost on the
     next edit anywhere in the note. */
  if (node.classList && node.classList.contains("ss-grid")) {
    return "```grid\n" + decodeURIComponent(node.dataset.gridSrc || "") + "\n```";
  }
  switch (tag) {
    case "h1": return "# " + serializeInline(node);
    case "h2": return "## " + serializeInline(node);
    case "h3": return "### " + serializeInline(node);
    case "blockquote":
      return serializeInline(node).split("\n")
        .map((l) => "> " + l).join("\n");
    case "ul": return serializeList(node, false);
    case "ol": return serializeList(node, true);
    case "pre": {
      const codeEl = node.querySelector ? node.querySelector("code") : null;
      // The language comes back with it (see the renderer's fence case).
      return "```" + (node.dataset.lang || "") + "\n"
        + (codeEl || node).textContent + "\n```";
    }
    case "table": return serializeTable(node);
    case "hr": return "---";
    case "br": return null;   // a bare <br> at block level carries no
                              // content of its own to preserve
    case "p": case "div": case "li": {
      const inline = serializeInline(node);
      return inline.trim() ? inline : null;
    }
    default: {
      // an unrecognized block-level wrapper - never drop its content,
      // just recurse into it the same way a <p> would be handled
      const inline = serializeInline(node);
      return inline.trim() ? inline : null;
    }
  }
}

function serializeList(node, ordered) {
  const items = [...node.children].filter((c) =>
    c.tagName && c.tagName.toLowerCase() === "li");
  return items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : "- ";
    /* v300 — a task item has to round-trip back to real markdown as
       "- [ ] text" / "- [x] text". Without this, saving a note from
       View mode would serialize a checkbox item as a plain bullet and
       silently destroy every checkbox in it — the tick state lives in
       the class, and the visible "\u2713" glyph is decoration that
       must NOT end up in the text. Reads the class rather than the
       glyph so it stays correct regardless of how the checkbox is
       styled. */
    if (li.classList && li.classList.contains("cx-task")) {
      const done = li.classList.contains("cx-task-done");
      const textEl = li.querySelector(".cx-task-text");
      const body = textEl ? serializeInline(textEl) : serializeInline(li);
      return `${marker}[${done ? "x" : " "}] ${body.trim()}`;
    }
    return marker + serializeInline(li);
  }).join("\n");
}

/* ---- DRAGGING A COLUMN EDGE --------------------------------------------
   One listener on the editable region rather than a handle element per
   column: a table is re-rendered from markdown constantly while Cam types,
   and per-column handle elements would have to be rebuilt every time and
   would end up inside the contenteditable, where they are one stray
   backspace away from being deleted as if they were text.

   Instead the pointer position decides. Within GRAB_PX of a cell's right
   edge the cursor becomes a resize cursor, and a drag from there resizes
   that column. Nothing is added to the DOM, so nothing can be typed into
   or deleted by accident. */

const GRAB_PX = 6;

/** Which column edge, if any, the pointer is within grabbing distance of. */
function columnEdgeAt(e) {
  const cell = e.target.closest && e.target.closest("th, td");
  if (!cell) return null;
  const table = cell.closest("table");
  if (!table) return null;
  const rect = cell.getBoundingClientRect();
  const fromRight = rect.right - e.clientX;
  const fromLeft = e.clientX - rect.left;

  // The right edge of this cell, or the right edge of the previous one if
  // the pointer is just inside the left border instead.
  if (fromRight <= GRAB_PX && fromRight >= -GRAB_PX) {
    return { table, index: cell.cellIndex };
  }
  if (fromLeft <= GRAB_PX && cell.cellIndex > 0) {
    return { table, index: cell.cellIndex - 1 };
  }
  return null;
}

/** Give a table a colgroup matching what its columns currently measure, so
    a drag has real numbers to start from rather than "auto". */
function ensureColgroup(table) {
  let group = table.querySelector("colgroup");
  const headRow = table.querySelector("tr");
  if (!headRow) return null;
  const count = headRow.children.length;

  if (group && group.children.length === count) return group;

  const measured = [...headRow.children].map((c) =>
    Math.max(MIN_COL_PX, Math.round(c.getBoundingClientRect().width)));
  if (group) group.remove();
  group = document.createElement("colgroup");
  for (const w of measured) {
    const col = document.createElement("col");
    col.style.width = w + "px";
    group.appendChild(col);
  }
  table.insertBefore(group, table.firstChild);
  table.classList.add("cx-sized");
  return group;
}

let colDrag = null;

function onTableResizeMove(e) {
  if (!colDrag) return;
  const delta = e.clientX - colDrag.startX;
  const next = Math.max(MIN_COL_PX, colDrag.startWidth + delta);
  colDrag.col.style.width = next + "px";
  e.preventDefault();
}

function onTableResizeEnd() {
  if (!colDrag) return;
  const { table, editable } = colDrag;
  document.removeEventListener("pointermove", onTableResizeMove);
  document.removeEventListener("pointerup", onTableResizeEnd);
  document.body.classList.remove("cx-resizing-col");
  colDrag = null;
  // The width lives in the DOM now; tell the app the note changed so it
  // serializes (and so the dash counts get written to the file).
  if (editable) {
    const isSplit = editable.id === "cx-split-preview";
    const notify = isSplit ? onSplitViewEditInput : onViewEditInput;
    if (typeof notify === "function") notify({ target: editable });
  }
  void table;
}

/** Pointer-down on a column edge starts a resize instead of a selection. */
function onTablePointerDown(e) {
  if (e.button !== 0) return;
  // Only where the note is actually editable. In read-only View mode a drag
  // would appear to work and then be silently lost on the next render,
  // because there is nothing to serialize it into.
  if (!e.target.closest("[contenteditable='true'], [contenteditable='']")) return;
  // A Grid resizes its own columns and saves itself. Left to this resizer,
  // a drag on a grid's column edge picked the grid as "the note" and saved
  // the grid's cell text over the ENTIRE note.
  if (e.target.closest(".ss-grid")) return;
  const edge = columnEdgeAt(e);
  if (!edge) return;
  const group = ensureColgroup(edge.table);
  if (!group || !group.children[edge.index]) return;

  const col = group.children[edge.index];
  colDrag = {
    table: edge.table,
    col,
    startX: e.clientX,
    startWidth: parseFloat(col.style.width) || MIN_COL_PX,
    // An element that is actually editable -- not merely one carrying the
    // attribute. A plain [contenteditable] match also finds
    // contenteditable="false", which is exactly what a Grid's holder is.
    editable: e.target.closest("[contenteditable='true'], [contenteditable='']"),
  };
  document.body.classList.add("cx-resizing-col");
  document.addEventListener("pointermove", onTableResizeMove);
  document.addEventListener("pointerup", onTableResizeEnd);
  // Stops the drag from selecting text across the cells it passes over.
  e.preventDefault();
}

/** Show the resize cursor only when an edge is actually grabbable. */
function onTablePointerHover(e) {
  if (colDrag) return;
  const cell = e.target.closest && e.target.closest("th, td");
  if (!cell) return;
  if (!e.target.closest("[contenteditable='true'], [contenteditable='']")) {
    cell.style.cursor = "";
    return;
  }
  cell.style.cursor = columnEdgeAt(e) ? "col-resize" : "";
}

function attachTableResizing(el) {
  if (!el || el.dataset.cxColResize === "1") return;
  el.dataset.cxColResize = "1";
  el.addEventListener("pointerdown", onTablePointerDown);
  el.addEventListener("pointermove", onTablePointerHover);
}

/* ---- TABLE COLUMN WIDTHS ------------------------------------------------
   Cam: "When working with tables in Amnesia i want the ability to drag and
   resize cells."

   A note is a real .md file, and a GFM table has nowhere to put a column
   width — so a dragged width would be lost the moment the note was saved.
   Rather than give up on persistence, the width rides in the separator
   row's own dash count:

       | Date | Change                    |
       |------|---------------------------|

   That is still a completely valid GFM separator. Every other markdown
   tool, Obsidian included, renders the table exactly as it would have
   anyway — the dashes carry no meaning to them. This app reads them back
   and restores the widths. Nothing is added to the file that a reader
   would see as noise, and no frontmatter or HTML comment is needed.

   The unit is DASHES_PER_100PX dashes per 100px — 5, so one dash per 20px.
   Column widths do not need finer resolution than that, and the coarse unit
   is what lets a 60-dash ceiling still express a 1200px column while
   keeping the separator line short enough to read in a plain text editor.
   The floor of three dashes is not cosmetic: fewer would stop being a valid
   GFM separator. A table that has never been resized is written with the
   plain three dashes it always used, so existing notes are untouched
   until Cam actually drags something. */

const DASHES_PER_100PX = 5;
const MIN_DASHES = 3;
const MAX_DASHES = 60;
const MIN_COL_PX = 48;

/** Dash counts -> pixel widths, or null if this table carries no widths. */
function parseColumnWidths(separator, columnCount) {
  const cells = separator.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|");
  if (cells.length !== columnCount) return null;
  const dashes = cells.map((c) => (c.match(/-/g) || []).length);
  // Three dashes everywhere is the default separator, not a width.
  if (dashes.every((d) => d <= MIN_DASHES)) return null;
  return dashes.map((d) =>
    Math.max(MIN_COL_PX, Math.round(d / DASHES_PER_100PX * 100)));
}

/** Pixel widths -> the dashes that encode them. */
function widthsToDashes(widths) {
  return widths.map((px) => {
    const d = Math.round((px || 0) / 100 * DASHES_PER_100PX);
    return "-".repeat(Math.min(MAX_DASHES, Math.max(MIN_DASHES, d)));
  });
}

function colgroupHtml(widths) {
  if (!widths) return "";
  return "<colgroup>" + widths.map((w) =>
    `<col style="width:${w}px">`).join("") + "</colgroup>";
}

/** The widths a live <table> is currently showing, or null if unsized. */
function tableColumnWidths(table) {
  const cols = [...table.querySelectorAll("colgroup > col")];
  if (!cols.length) return null;
  return cols.map((c) => Math.round(parseFloat(c.style.width) || 0));
}

function serializeTable(node) {
  const rows = [...node.querySelectorAll("tr")];
  if (!rows.length) return "";
  const rowCells = (tr) => [...tr.children].map((c) => serializeInline(c)
    .replace(/\|/g, "\\|").trim());
  const header = rowCells(rows[0]);
  const widths = tableColumnWidths(node);
  const dashes = widths && widths.length === header.length
    ? widthsToDashes(widths)
    : header.map(() => "-".repeat(MIN_DASHES));
  const lines = [
    "| " + header.join(" | ") + " |",
    "|" + dashes.join("|") + "|",
  ];
  for (const tr of rows.slice(1)) {
    lines.push("| " + rowCells(tr).join(" | ") + " |");
  }
  return lines.join("\n");
}

function serializeInline(node) {
  let out = "";
  for (const child of node.childNodes) out += serializeInlineNode(child);
  return out;
}

function serializeInlineNode(node) {
  if (node.nodeType === 3) return node.textContent.replace(/\u200b/g, "");
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  switch (tag) {
    case "br": return "\n";
    case "strong": case "b": {
      const inner = serializeInline(node);
      return inner.trim() ? `**${inner}**` : "";
    }
    case "em": case "i": {
      const inner = serializeInline(node);
      return inner.trim() ? `*${inner}*` : "";
    }
    case "u": {
      const inner = serializeInline(node);
      return inner.trim() ? `<u>${inner}</u>` : "";
    }
    case "del": case "s": case "strike": {
      const inner = serializeInline(node);
      return inner.trim() ? `~~${inner}~~` : "";
    }
    case "mark": {
      const inner = serializeInline(node);
      if (!inner.trim()) return "";
      const classMatch = (node.className || "")
        .match(/cx-hl-(yellow|green|purple|blue)/);
      const color = classMatch ? classMatch[1] : null;
      return color && color !== "yellow"
        ? `=={${color}}${inner}==` : `==${inner}==`;
    }
    case "code": return "`" + node.textContent + "`";
    case "a": {
      if (node.classList && node.classList.contains("cx-wikilink")) {
        const title = node.dataset.cxLink || node.textContent;
        const display = node.textContent;
        return display && display !== title
          ? `[[${title}|${display}]]` : `[[${title}]]`;
      }
      const url = (node.dataset && node.dataset.cxExt)
        || node.getAttribute("href") || "";
      return `[${serializeInline(node)}](${url})`;
    }
    case "img": {
      const name = (node.dataset && node.dataset.cxEmbed) || "";
      return `![[${name}]]`;
    }
    default:
      // an unrecognized inline wrapper - recurse rather than drop it
      return serializeInline(node);
  }
}

function renderEditorBody() {
  const area = document.getElementById("cx-editor-area");
  const titleValue = noteTitleOf(currentPath);
  updateToolbarVisibility();
  if (mode === "edit") {
    area.innerHTML = `
      <div id="cx-editor-wrap"><div id="cx-editor-inner">
        <input type="text" id="cx-title-input" value="${
          CC.md.escapeHtml(titleValue)}">
        <textarea id="cx-editor" placeholder="Start writing..."
                  spellcheck="false"></textarea>
      </div></div>`;
    const ta = document.getElementById("cx-editor");
    ta.value = currentText;
    ta.addEventListener("input", onEditorInput);
    ta.addEventListener("paste", onEditorPaste);
    ta.addEventListener("keydown", onEditorKeydown);
    ta.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openEditorMenu(ta, e.clientX, e.clientY);
    });
    wireTitleInput();
    ta.focus();
  } else {
    /* v300 - Cam: "Merge to two modes - Edit + View (View is
       interactive)". The old three-mode split (Edit / read-only View /
       Data Entry) collapses to two, matching the reference app's own
       simple eye-pencil toggle. What used to be Data Entry IS View
       now: the rendered, formatted page, directly editable - tables
       fillable, checkboxes tickable - rather than a separate third
       mode Cam had to remember to switch into. The backlinks block
       that only ever appeared in the old read-only View is kept, so
       nothing is lost in the merge; it sits outside the
       contenteditable region so it can't be typed into by accident. */
    area.innerHTML = `
      <div id="cx-editor-wrap"><div id="cx-editor-inner">
        <input type="text" id="cx-title-input" value="${
          CC.md.escapeHtml(titleValue)}">
        <div id="cx-preview" contenteditable="true"
             spellcheck="false"></div>
        <div id="cx-note-meta" contenteditable="false">
          <h4>Backlinks</h4>
          <div id="cx-backlinks">Loading\u2026</div>
        </div>
      </div></div>`;
    wireTitleInput();
    const editable = document.getElementById("cx-preview");
    renderPreviewInto(editable, currentText);
    applyViewZoom();
    editable.addEventListener("input", onViewEditInput);
    editable.addEventListener("keydown", onViewEditKeydown);
    attachTableResizing(editable);
    editable.addEventListener("contextmenu", (e) => {
      const sel = window.getSelection();
      const hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0
        && editable.contains(sel.anchorNode);
      const cell = closestCell(e.target);
      const inTable = cell && editable.contains(cell);
      if (!hasSelection && !inTable) return;
      e.preventDefault();
      openPreviewMenu(editable, e.clientX, e.clientY, cell);
    });
    wireTaskCheckboxes(editable);
    computeBacklinks(currentPath).then((hits) => {
      const el = document.getElementById("cx-backlinks");
      if (!el) return;
      el.innerHTML = hits.length
        ? hits.map((h) => `<div class="cx-backlink-item"
            data-path="${CC.md.escapeHtml(h.path)}">${
            CC.md.escapeHtml(h.title)}</div>`).join("")
        : `<div style="color:var(--text-faint);font-size:13px">
             Nothing links here yet.</div>`;
      el.querySelectorAll(".cx-backlink-item").forEach((b) =>
        b.addEventListener("click", () => openNote(b.dataset.path)));
    });
  }
}

function wireTitleInput() {
  const input = document.getElementById("cx-title-input");
  const commit = async () => {
    const newTitle = input.value.trim();
    const oldTitle = noteTitleOf(currentPath);
    if (!newTitle || newTitle === oldTitle) {
      input.value = oldTitle;
      return;
    }
    const r = await CC.Store.renameItem(currentPath, newTitle);
    if (r.error) { CC.toast(r.error, "error"); input.value = oldTitle; return; }
    currentPath = r.path;
    await refreshTree();
    renderEditorChrome();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
  });
  input.addEventListener("blur", commit);
}

function renderPreviewInto(el, text) {
  const existing = new Set(titleToPath.keys());
  el.innerHTML = CC.md.render(text, existing);
  wireImages(el);
  hydrateGrids(el);
}

/* Grids become live after each render. Whether one can be EDITED is asked
   at the moment of editing, not now: the view is made editable after it
   renders, so asking here would get the wrong answer. A change goes through
   onViewEditInput -- the same path as typing -- so it is saved, and undone,
   exactly like any other edit to the note. */
function hydrateGrids(el) {
  if (!window.SSGridView) return;
  el.querySelectorAll(".ss-grid").forEach((holder) =>
    window.SSGridView.mount(holder, {
      editable: () => el.isContentEditable,
      onChange: () => onViewEditInput({target: el}, true),
    }));
}

function renderPreview() {
  const el = document.getElementById("cx-preview");
  if (!el) return;
  renderPreviewInto(el, currentText);
  el.querySelectorAll("[data-cx-link]").forEach((a) => {
    a.addEventListener("click", async () => {
      const title = a.dataset.cxLink;
      const existingPath = titleToPath.get(title.toLowerCase());
      if (existingPath) { openNote(existingPath); return; }
      const r = await CC.Store.createNote("", title);
      if (r.error) { CC.toast(r.error, "error"); return; }
      await refreshTree();
      openNote(r.path);
    });
  });
  el.querySelectorAll("[data-cx-ext]").forEach((a) => {
    a.addEventListener("click", async () => {
      await CC.Store.ready;
      if (window.CP && window.CP.Store) {
        window.CP.Store.call("notes_open_external", [a.dataset.cxExt], "Notes");
      }
    });
  });
}

function wireImages(root) {
  root.querySelectorAll("img[data-cx-embed]").forEach(async (img) => {
    const name = img.dataset.cxEmbed;
    const url = await CC.Store.imageURL(name);
    if (url) img.src = url;
    else img.replaceWith(document.createTextNode(`[[${name}]] (missing)`));
  });
}

function onEditorInput(e) {
  recordUndoStep("primary", currentText, false);
  currentText = e.target.value;
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
  maybeShowLinkSuggest(e.target);
}

/* ============================================================================
   LIVE FORMATTING (Data Entry mode) — Cam: "Is there a way to have live
   formatting appear. For example, for a table... Can we have below
   automatically turn to a table as we are typing, so we get instant
   feedback." Split deliberately into pure, DOM-independent detection/
   HTML-building logic (fully testable) and the DOM-manipulation layer
   that actually swaps content and preserves the cursor (necessarily
   harder to fully simulate outside a real browser, so built as
   narrowly and carefully as possible on top of the well-tested pure
   layer below).
   ============================================================================ */

/* given the raw, plain-text lines of a single block (already split on
   \n), returns the table's own row lines if they form a complete,
   valid pipe table (a header row plus a matching separator row) -
   the exact same detection shape CC.md's own render() already uses
   for consistency, so "does this look like a table" never disagrees
   between the two. Returns null if not a complete table yet. */
function detectCompleteTableLines(lines) {
  if (lines.length < 2) return null;
  const header = lines[0];
  const divider = lines[1];
  if (!header.includes("|")) return null;
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(divider) || !divider.includes("-")) {
    return null;
  }
  // every remaining line must also look like a real table row (contain
  // at least one pipe) - a genuinely unrelated line typed right after
  // must not be silently swallowed into the table
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].includes("|")) return lines.slice(0, i);
  }
  return lines;
}

/* the plain-text content of a contenteditable block, with each real
   line break (a <br>, or a block-level child like a nested <div>)
   represented as \n - mirrors how htmlToMarkdown already treats <br>,
   so the same text a table's own source would eventually serialize to
   is what gets checked here too. */
function blockPlainTextLines(el) {
  const text = [...el.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType === 1 && n.tagName === "BR") return "\n";
    return n.textContent;
  }).join("");
  return text.split("\n");
}

/* the direct child of `root` (the contenteditable region itself) that
   contains `node` - the "current block" a table conversion operates
   on, matching how CC.md.render() itself always produces one element
   per block (a <p>, <h1>, <ul>, ...) as a direct child of wherever
   it's rendered into. */
function findCurrentBlock(node, root) {
  while (node && node.parentNode && node.parentNode !== root) {
    node = node.parentNode;
  }
  return (node && node.parentNode === root) ? node : null;
}

/* places the cursor at the start of a fresh, empty paragraph
   immediately after `afterEl` - the natural "I just finished that
   block, ready to keep typing" landing spot once a table has just
   been created or extended. Deliberately simpler than trying to map
   an old text offset into a position inside the new table's own
   cells, which a table's own multi-cell structure has no single,
   obvious equivalent for anyway.
   Pane-scoped the same way commitEdit() already is, and for the exact
   same real reason (see commitEdit's own comment: "a Ctrl+B in the
   split pane would have silently saved into the PRIMARY note's
   file") — a bug found here too by directly testing it: completing a
   table in the split pane's own Data Entry mode was writing the
   result into the PRIMARY pane's currentText/dirty/saveTimer
   regardless of which pane's contenteditable `editable` actually
   was, since this function was never updated when that same class of
   bug was fixed for the textarea-based shortcuts. Decided the same
   way commitEdit() decides it: from the element's own id, the one
   source of truth that can never disagree with itself. */
function placeCursorAfter(afterEl, editable) {
  const freshPara = document.createElement("p");
  freshPara.innerHTML = "<br>";
  afterEl.after(freshPara);
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(freshPara, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  if (editable && editable.id === "cx-split-preview") {
    splitPane.text = htmlToMarkdown(editable);
    splitPane.dirty = true;
    clearTimeout(splitSaveTimer);
    splitSaveTimer = setTimeout(flushSplitSave, 600);
    return;
  }
  currentText = htmlToMarkdown(editable);
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

/* converts a block of raw, just-typed table syntax into a genuine,
   live-rendered <table> - Cam: "Can we have below automatically turn
   to a table as we are typing, so we get instant feedback." Reuses
   CC.md.render() itself for the actual HTML, so a live-formatted
   table is built by exactly the same logic as any other table in
   this app, never a second, parallel implementation that could drift
   out of sync with it. */
function convertBlockToTable(block, tableLines, editable) {
  const tableMarkdown = tableLines.join("\n");
  const html = CC.md.render(tableMarkdown, new Set(titleToPath.keys()));
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const tableEl = wrapper.querySelector("table");
  if (!tableEl) return false;   // safety net - shouldn't happen given
                                // detectCompleteTableLines already
                                // validated this is a real table
  block.replaceWith(tableEl);
  placeCursorAfter(tableEl, editable);
  return true;
}

/* extends an EXISTING, already-rendered table with one more row -
   Cam's own screenshot shows exactly this: typing several more
   "| | | | |" rows below an already-converted table, each one meant
   to become part of the SAME table, not a second, separate one.
   Serializes the existing table back to real markdown (the exact
   same serializeTable() Data Entry mode's own save path already uses)
   and re-renders the whole thing with the new row appended, rather
   than hand-building a <tr> separately - one real implementation of
   "what a table looks like," reused everywhere. */
function appendRowToTable(tableEl, rowLine, blockToRemove, editable) {
  const existingMarkdown = serializeTable(tableEl);
  const newMarkdown = existingMarkdown + "\n" + rowLine;
  const html = CC.md.render(newMarkdown, new Set(titleToPath.keys()));
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const newTableEl = wrapper.querySelector("table");
  if (!newTableEl) return false;
  tableEl.replaceWith(newTableEl);
  blockToRemove.remove();
  placeCursorAfter(newTableEl, editable);
  return true;
}

/* the actual trigger — checked on Enter, the natural moment Cam has
   finished a line and is moving to the next: has the block he was
   just typing in become a complete table (or a single row ready to
   extend an existing one right above it)? Checked on Enter rather
   than every keystroke so a table doesn't flicker into existence
   mid-line while Cam is still typing the separator row itself. */
function onViewEditKeydown(e) {
  if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey) return;
  const editable = e.target;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const block = findCurrentBlock(range.startContainer, editable);
  if (!block || block.tagName === "TABLE") return;

  const lines = blockPlainTextLines(block);
  const tableLines = detectCompleteTableLines(lines);
  if (tableLines && tableLines.length >= 2) {
    e.preventDefault();
    convertBlockToTable(block, tableLines, editable);
    return;
  }

  // a single, already-valid-looking row, typed right after an
  // existing table - extend it rather than requiring a fresh
  // header+separator every time
  if (lines.length === 1) {
    const singleLine = lines[0].trim();
    const looksLikeRow = /^\|.*\|$/.test(singleLine)
      && !/^\s*\|?[\s:|-]+\|?\s*$/.test(singleLine);
    const prevEl = block.previousElementSibling;
    if (looksLikeRow && prevEl && prevEl.tagName === "TABLE") {
      e.preventDefault();
      appendRowToTable(prevEl, singleLine, block, editable);
    }
  }
}

/* Data Entry mode's own input handler — Cam: "add a new feature called
   view edit... it will allow me to make changes while mainting the
   formatting present already." The live, editable DOM (e.target) is
   the authoritative source of truth while Cam is actively typing —
   it is NEVER re-rendered from currentText mid-edit, which would
   reset his own cursor position and make this unusable. currentText
   is only ever derived FROM the DOM here (via htmlToMarkdown), and
   only used for saving — the same debounced dirty/saveTimer/
   flushSave pipeline Edit mode already has, reused rather than
   duplicated.
   Pane-scoped the same way commitEdit() already is, for the exact
   same real reason, and for a bug found the same way (direct
   testing): toggleHighlightSelection() calls this function manually
   on whatever pane's own editable it was given — a programmatic DOM
   change (wrapping a selection in <mark>) doesn't reliably fire a
   real, native "input" event on its own, so this is the only thing
   that actually persists a highlight — and openPreviewMenu's own
   right-click Highlight action is wired to BOTH panes. Without this
   check, highlighting text in the split pane's own Data Entry mode
   silently wrote the result into the PRIMARY pane's own note. */
/* v300 — Cam: "in view mode allow me to ... click boxes."
   Ticking a checkbox in View mode flips the item's own class and then
   routes through the exact same onViewEditInput save path every other
   View-mode edit already uses (htmlToMarkdown -> debounced write),
   rather than a second, parallel save mechanism that could drift out
   of step with it. serializeList (above) is what turns the flipped
   class back into real "- [x] " markdown.

   The checkbox span is contenteditable="false" so clicking it moves
   no caret and types nothing; keyboard users get Enter/Space on it
   too, since it carries role="checkbox" and a tabindex. */
function toggleTaskCheckbox(box, editable) {
  const li = box.closest("li");
  if (!li) return;
  const nowDone = !li.classList.contains("cx-task-done");
  li.classList.toggle("cx-task-done", nowDone);
  box.classList.toggle("cx-checkbox-on", nowDone);
  box.setAttribute("aria-checked", String(nowDone));
  box.textContent = nowDone ? "\u2713" : "";
  onViewEditInput({target: editable}, true);
}

function wireTaskCheckboxes(editable) {
  if (!editable) return;
  editable.querySelectorAll("[data-cx-task]").forEach((box) => {
    box.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTaskCheckbox(box, editable);
    });
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      toggleTaskCheckbox(box, editable);
    });
  });
}

/** The split pane's own checkboxes — identical behaviour, but the
    save path onViewEditInput picks is decided by the element's id,
    so this just points it at the split pane's own editable. */
function wireSplitTaskCheckboxes(editable) {
  wireTaskCheckboxes(editable);
}

/** The note area an edit belongs to -- always the WHOLE preview, never a
    part of it. Every caller is meant to pass the preview itself; this makes
    it impossible to rebuild a note from a fragment even if one does not.
    A Grid's column-resize drag once reached here carrying the grid, and the
    grid's cell text was saved over the entire note. */
function wholeNoteArea(target) {
  if (!target || !target.closest) return document.getElementById("cx-preview");
  if (target.id === "cx-preview" || target.id === "cx-split-preview") return target;
  return target.closest("#cx-split-preview") || target.closest("#cx-preview")
    || document.getElementById("cx-preview");
}

function onViewEditInput(e, forceUndoStep) {
  e = {target: wholeNoteArea(e && e.target)};
  if (e.target && e.target.id === "cx-split-preview") {
    recordUndoStep("split", splitPane.text, !!forceUndoStep);
    splitPane.text = htmlToMarkdown(e.target);
    splitPane.dirty = true;
    clearTimeout(splitSaveTimer);
    splitSaveTimer = setTimeout(flushSplitSave, 600);
    return;
  }
  recordUndoStep("primary", currentText, !!forceUndoStep);
  currentText = htmlToMarkdown(e.target);
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

async function flushSave() {
  if (!dirty || !currentPath) return;
  const path = currentPath;
  const text = currentText;
  const type = currentType;
  dirty = false;
  if (type === "canvas") {
    await CC.Store.writeCanvas(path, text);
  } else {
    await CC.Store.writeNote(path, text);
  }
  // titles/links may have changed - refresh the sidebar's own link
  // index quietly, without disturbing whatever Cam is doing right now
  await refreshTree();
}

function onEditorKeydown(e) {
  const suggest = document.getElementById("cx-link-suggest");
  if (suggest.classList.contains("open")) {
    const items = [...suggest.querySelectorAll(".cx-suggest-item")];
    let idx = items.findIndex((i) => i.classList.contains("cx-picked"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (idx >= 0) items[idx].classList.remove("cx-picked");
      idx = e.key === "ArrowDown"
        ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[idx].classList.add("cx-picked");
      items[idx].scrollIntoView({block: "nearest"});
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      (items[idx] || items[0])?.click();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); closeLinkSuggest(); return; }
    return;
  }

  /* Cam: "I need to have shortcuts in the app as well... Ctrl + b for
     bold etc." Ctrl+B/Ctrl+I/Ctrl+K match Omawrite's own real,
     confirmed shortcuts exactly (its own README: "Ctrl+B, Ctrl+I, and
     Ctrl+K insert bold, italic, and link Markdown"). Ctrl+U and
     Ctrl+1/2/3 extend sensibly beyond Omawrite's own smaller scope —
     the same wrapSelection/prefixLines/addLinkFlow functions the
     right-click Format menu already uses, so a shortcut and a menu
     click do exactly the same thing either way. */
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    const ta = e.target;
    const key = e.key.toLowerCase();
    if (key === "b") { e.preventDefault(); wrapSelection(ta, "**", "**"); return; }
    if (key === "i") { e.preventDefault(); wrapSelection(ta, "*", "*"); return; }
    if (key === "u") { e.preventDefault(); wrapSelection(ta, "<u>", "</u>"); return; }
    if (key === "k") { e.preventDefault(); addLinkFlow(ta); return; }
    if (key === "1") { e.preventDefault(); prefixLines(ta, "# "); return; }
    if (key === "2") { e.preventDefault(); prefixLines(ta, "## "); return; }
    if (key === "3") { e.preventDefault(); prefixLines(ta, "### "); return; }
  }

  /* Cam: "Tab to work as expected in notes edit, at the moment it
     just highlights the next icon. I want tab to be able to go to
     next cells in table, space and add a nested list like this." The
     confirmed bug: Tab was never intercepted at all, so the browser's
     own default (move focus to the next element on the page) took
     over. Three real behaviors instead, checked in order: jump to
     the next table cell (wrapping to the next row's own first cell
     at the end of a row) if the cursor is genuinely inside a table
     row; indent the current line if it's a list item, creating a
     nested sub-item; otherwise insert a plain, literal tab, the
     ordinary default. */
  if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const ta = e.target;
    if (e.shiftKey) {
      if (outdentListLine(ta)) { e.preventDefault(); return; }
      return;
    }
    e.preventDefault();
    if (tabToNextTableCell(ta)) return;
    if (indentListLine(ta)) return;
    insertAtCursor(ta, "\t");
  }
}

/* jumps the cursor to the start of the next real table cell on the
   current line, or the next line's own first cell if already at the
   row's own final, closing pipe — returns false (and changes
   nothing) if the cursor isn't genuinely inside a table row at all,
   so the caller can fall through to the next Tab behavior instead */
function tabToNextTableCell(ta) {
  const value = ta.value;
  const pos = ta.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  if (!/^\s*\|/.test(line)) return false;

  const posInLine = pos - lineStart;
  const remainingPipes = [...line.slice(posInLine).matchAll(/\|/g)];
  if (remainingPipes.length >= 2) {
    // there's a real cell boundary ahead (not just the row's own
    // final, closing pipe) - land right after it, skipping one
    // leading space if the cell is padded the usual "| cell |" way
    let target = lineStart + posInLine + remainingPipes[0].index + 1;
    if (value[target] === " ") target++;
    ta.selectionStart = ta.selectionEnd = target;
    return true;
  }
  // at (or past) the row's own final cell - wrap to the next line's
  // own first cell, if that line is genuinely a table row too
  if (lineEnd < value.length) {
    const nextLineEnd = value.indexOf("\n", lineEnd + 1);
    const nextLine = value.slice(lineEnd + 1,
      nextLineEnd === -1 ? value.length : nextLineEnd);
    if (/^\s*\|/.test(nextLine)) {
      const firstPipe = nextLine.indexOf("|");
      let target = lineEnd + 1 + firstPipe + 1;
      if (value[target] === " ") target++;
      ta.selectionStart = ta.selectionEnd = target;
      return true;
    }
  }
  return false;
}

/* indents the current line two spaces if it's a list item, creating
   a nested sub-item - matches Obsidian's own real Tab convention for
   this. Returns false if the current line isn't a list item at all. */
function indentListLine(ta) {
  const value = ta.value;
  const pos = ta.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  if (!/^\s*([-*+]|\d+\.)\s/.test(line)) return false;
  ta.value = value.slice(0, lineStart) + "  " + value.slice(lineStart);
  ta.selectionStart = ta.selectionEnd = pos + 2;
  commitEdit(ta);
  return true;
}

/* Shift+Tab's own counterpart - removes up to two leading spaces of
   indentation from a list item line, the reverse of indentListLine. */
function outdentListLine(ta) {
  const value = ta.value;
  const pos = ta.selectionStart;
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  if (!/^\s*([-*+]|\d+\.)\s/.test(line)) return false;
  const removeCount = line.startsWith("  ") ? 2 : (line.startsWith(" ") ? 1 : 0);
  if (!removeCount) return false;
  ta.value = value.slice(0, lineStart) + value.slice(lineStart + removeCount);
  ta.selectionStart = ta.selectionEnd = Math.max(lineStart, pos - removeCount);
  commitEdit(ta);
  return true;
}

/* ---- photo attachment — Cam: "should allow attaching photos to
   notes" — paste an image straight into the editor, the same way
   pasting a screenshot into Obsidian itself already works. ---- */
async function onEditorPaste(e) {
  const items = [...(e.clipboardData?.items || [])];
  const imageItem = items.find((it) => it.type.startsWith("image/"));
  if (!imageItem) return;
  e.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const saved = await CC.Store.saveImage(`pasted-image-${stamp}.${ext}`,
    dataUrl);
  const ta = e.target;
  insertAtCursor(ta, `![[${saved}]]`);
  CC.toast("Image attached.");
}

/* shared by every text-manipulation helper below: after directly
   mutating ta.value, sync the RIGHT pane's own text/dirty/save-timer
   state and schedule the same debounced save that pane's own input
   handler already uses — so every path that edits a textarea's value
   programmatically (a shortcut, a menu click, the link-suggest
   dropdown) behaves exactly like typing it by hand would, in
   whichever pane it actually happened in.
   v292 — Cam: "the short cuts don't work on the note that has been
   opened on the split view side... i want it to work on that side
   when i am actively working on that note." Before this, EVERY
   caller below always wrote to the PRIMARY pane's currentText/dirty/
   saveTimer no matter which textarea `ta` actually was — not just a
   missing feature but a real correctness bug waiting to happen the
   moment a shortcut got wired onto the split textarea at all: a
   Ctrl+B in the split pane would have silently saved into the
   PRIMARY note's file. Decided purely from `ta.id` — the element a
   keystroke actually landed on is the one source of truth that can
   never disagree with itself, unlike a separately-tracked "which
   pane" flag that could in principle drift out of sync. */
function commitEdit(ta) {
  if (ta && ta.id === "cx-split-editor") {
    recordUndoStep("split", splitPane.text, true);
    splitPane.text = ta.value;
    splitPane.dirty = true;
    clearTimeout(splitSaveTimer);
    splitSaveTimer = setTimeout(flushSplitSave, 600);
    return;
  }
  recordUndoStep("primary", currentText, true);
  currentText = ta.value;
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

function insertAtCursor(ta, text) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  const pos = start + text.length;
  ta.selectionStart = ta.selectionEnd = pos;
  commitEdit(ta);
}

/* wraps the current selection in before/after (e.g. "**"/"**" for
   bold) — with nothing selected, inserts an empty pair and leaves the
   cursor between them, ready to type straight into. */
/* v300 — Cam: "they have a tool bar down the bottom with all the useful
   tools." Every command here routes through the SAME wrapSelection /
   prefixLines / addLinkFlow helpers the right-click menu and the
   Ctrl+B/I/U keyboard shortcuts already use, so each action has one
   real implementation rather than a second, parallel one that could
   drift out of step with it.

   Only shown in Edit mode: the toolbar drives a <textarea>, and View
   mode has no textarea to drive - its own formatting already happens
   through the right-click menu on the rendered page instead. */
const TOOLBAR_COMMANDS = {
  bold: (ta) => wrapSelection(ta, "**", "**"),
  italic: (ta) => wrapSelection(ta, "*", "*"),
  strike: (ta) => wrapSelection(ta, "~~", "~~"),
  highlight: (ta) => wrapSelection(ta, "==", "=="),
  h1: (ta) => prefixLines(ta, "# "),
  h2: (ta) => prefixLines(ta, "## "),
  h3: (ta) => prefixLines(ta, "### "),
  ul: (ta) => prefixLines(ta, "- "),
  ol: (ta) => prefixLines(ta, "1. "),
  task: (ta) => prefixLines(ta, "- [ ] "),
  quote: (ta) => prefixLines(ta, "> "),
  code: (ta) => wrapSelection(ta, "`", "`"),
  wikilink: (ta) => addLinkFlow(ta),
  link: (ta) => addExternalLinkFlow(ta),
  table: (ta) => replaceSelection(ta,
    "\n| Column | Column |\n| --- | --- |\n|  |  |\n"),
  rule: (ta) => replaceSelection(ta, "\n---\n"),
  /* In the raw editor a grid is only its text, and Notes opens notes in
     this mode by default -- so clicking Grid dropped a block of text into
     the note and looked like nothing had happened. A grid can only be USED
     in View, so it switches there to show the spreadsheet just inserted.
     setMode is the same path as pressing View, so the text is saved and the
     choice remembered exactly as if the toggle had been pressed. */
  grid: (ta) => {
    replaceSelection(ta, "\n```grid\n"
      + window.SSGrid.serialize(window.SSGrid.blank()) + "\n```\n");
    Promise.resolve().then(() => setMode("preview"));
  },
};

/* v301 — Cam: "add the tool bar to the bottom of the view mode as
   well, since i can enter data in that view as well."

   View mode is a contenteditable rendered page, not a <textarea>, so
   the Edit-mode commands above (which all drive a textarea's .value
   and selectionStart/End) genuinely cannot be reused here - they'd
   throw on the first property access. These are the same set of
   actions expressed against a real DOM Range instead, following the
   exact pattern the existing highlight/table operations in this file
   already use: mutate the DOM, then hand the whole editable to
   onViewEditInput, which serializes it back to markdown through
   htmlToMarkdown and saves. That keeps ONE save path for every kind
   of View edit rather than a second parallel one.

   Deliberately NOT document.execCommand: this app runs a custom undo
   stack (see undoState's own comment) precisely because nearly every
   operation here mutates the DOM directly, and mixing execCommand in
   would leave the two undo histories disagreeing with each other. */

/** Wraps the current selection in a new element of tagName. Returns
    the element, or null if there's nothing selected to wrap. */
function viewWrapSelection(editable, tagName, className) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!editable.contains(range.commonAncestorContainer)) return null;
  const el = document.createElement(tagName);
  if (className) el.className = className;
  try {
    el.appendChild(range.extractContents());
    range.insertNode(el);
  } catch (err) {
    return null;   // a selection spanning incompatible block boundaries
  }
  sel.removeAllRanges();
  return el;
}

/** The block element the caret/selection currently sits inside, at the
    top level of the editable (a <p>, <h2>, <li>, etc). */
function viewCurrentBlock(editable) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let node = sel.getRangeAt(0).startContainer;
  if (node === editable) return null;
  while (node && node.parentNode !== editable) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}

/** Swaps the current block's tag (paragraph <-> heading), preserving
    its contents. Re-applying the same heading level toggles it back to
    a paragraph, matching prefixLines' own toggle behaviour in Edit. */
function viewSetBlockTag(editable, tagName) {
  const block = viewCurrentBlock(editable);
  if (!block) return false;
  const already = block.tagName.toLowerCase() === tagName;
  const target = already ? "p" : tagName;
  const el = document.createElement(target);
  while (block.firstChild) el.appendChild(block.firstChild);
  block.replaceWith(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

/** Converts the current block into a single-item list of listTag, or
    back to a paragraph if it's already in one. */
function viewToggleList(editable, listTag, asTask) {
  const block = viewCurrentBlock(editable);
  if (!block) return false;
  const tag = block.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    const frag = document.createDocumentFragment();
    block.querySelectorAll("li").forEach((li) => {
      const p = document.createElement("p");
      const text = li.querySelector(".cx-task-text");
      const src = text || li;
      while (src.firstChild) p.appendChild(src.firstChild);
      frag.appendChild(p);
    });
    block.replaceWith(frag);
    return true;
  }
  const list = document.createElement(listTag);
  const li = document.createElement("li");
  if (asTask) {
    list.className = "cx-task-list";
    li.className = "cx-task";
    const box = document.createElement("span");
    box.className = "cx-checkbox";
    box.setAttribute("data-cx-task", "0");
    box.setAttribute("contenteditable", "false");
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", "false");
    box.setAttribute("tabindex", "0");
    const textSpan = document.createElement("span");
    textSpan.className = "cx-task-text";
    while (block.firstChild) textSpan.appendChild(block.firstChild);
    li.append(box, textSpan);
  } else {
    while (block.firstChild) li.appendChild(block.firstChild);
  }
  list.appendChild(li);
  block.replaceWith(list);
  if (asTask) wireTaskCheckboxes(editable);
  return true;
}

function viewInsertBlock(editable, el) {
  const block = viewCurrentBlock(editable);
  if (block) block.after(el); else editable.appendChild(el);
}

const VIEW_TOOLBAR_COMMANDS = {
  bold: (ed) => viewWrapSelection(ed, "strong"),
  italic: (ed) => viewWrapSelection(ed, "em"),
  strike: (ed) => viewWrapSelection(ed, "del"),
  highlight: (ed) => applyHighlightSelection(ed, HIGHLIGHT_COLORS[0]),
  h1: (ed) => viewSetBlockTag(ed, "h1"),
  h2: (ed) => viewSetBlockTag(ed, "h2"),
  h3: (ed) => viewSetBlockTag(ed, "h3"),
  ul: (ed) => viewToggleList(ed, "ul", false),
  ol: (ed) => viewToggleList(ed, "ol", false),
  task: (ed) => viewToggleList(ed, "ul", true),
  quote: (ed) => viewSetBlockTag(ed, "blockquote"),
  code: (ed) => viewWrapSelection(ed, "code"),
  wikilink: (ed) => {
    const sel = window.getSelection();
    const title = (sel && !sel.isCollapsed) ? sel.toString().trim() : "";
    if (!title) { CC.toast("Select the note title to link to.", "error"); return; }
    const a = viewWrapSelection(ed, "a");
    if (a) { a.setAttribute("data-cx-link", title); a.textContent = title; }
  },
  link: async (ed) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { CC.toast("Select the text to link.", "error"); return; }
    const url = await CC.prompt({title: "Add external link",
      placeholder: "https://...", yes: "Add"});
    if (!url) return;
    const a = viewWrapSelection(ed, "a");
    if (a) { a.setAttribute("data-cx-ext", url); a.setAttribute("href", url); }
  },
  table: (ed) => {
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Column</th><th>Column</th></tr></thead>"
      + "<tbody><tr><td><br></td><td><br></td></tr></tbody>";
    viewInsertBlock(ed, table);
  },
  rule: (ed) => viewInsertBlock(ed, document.createElement("hr")),
  grid: (ed) => {
    const holder = document.createElement("div");
    holder.className = "ss-grid";
    holder.setAttribute("contenteditable", "false");
    holder.dataset.gridSrc = encodeURIComponent(
      window.SSGrid.serialize(window.SSGrid.blank()));
    viewInsertBlock(ed, holder);
    hydrateGrids(ed);
    onViewEditInput({target: ed}, true);
  },
};

/** The one editable currently being worked in — the split pane's when
    that's the active pane, otherwise the primary one. */
function activeViewEditable() {
  if (activePane === "split" && splitPane) {
    return document.getElementById("cx-split-preview");
  }
  return document.getElementById("cx-preview");
}

function wireToolbar() {
  const bar = document.getElementById("cx-toolbar");
  if (!bar) return;
  bar.querySelectorAll(".cx-tool").forEach((btn) => {
    /* mousedown, not click: the textarea must keep focus and its
       selection through the press, and a plain click fires only
       AFTER focus has already moved to the button itself. */
    btn.addEventListener("mousedown", async (e) => {
      /* mousedown, not click: the editor must keep focus and its
         selection through the press, and a plain click fires only
         AFTER focus has already moved to the button itself. */
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const ta = document.getElementById("cx-editor");
      if (ta) {                       // Edit mode - textarea commands
        const fn = TOOLBAR_COMMANDS[cmd];
        if (fn) fn(ta);
        return;
      }
      /* v301 - View mode: same tools, DOM-based implementations, and
         the DOM mutation has to be handed to onViewEditInput
         afterwards to actually serialize and save. The highlight
         command is the one exception that already does its own
         saving internally, so double-calling is avoided. */
      const editable = activeViewEditable();
      if (!editable) return;
      const fn = VIEW_TOOLBAR_COMMANDS[cmd];
      if (!fn) return;
      const before = editable.innerHTML;
      const result = await fn(editable);
      if (cmd === "highlight") return;   // saves itself
      if (result === false) return;      // nothing applicable to act on
      if (editable.innerHTML !== before) {
        onViewEditInput({target: editable}, true);
      }
    });
  });
}

/* Shown only when there is genuinely a note open in Edit mode - a PDF,
   a canvas, View mode, or an empty tab all have no textarea for it to
   act on, so a visible-but-dead toolbar would be a lie. */
function updateToolbarVisibility() {
  const wrap = document.getElementById("cx-toolbar-wrap");
  if (!wrap) return;
  /* v301 - Cam: "add the tool bar to the bottom of the view mode as
     well, since i can enter data in that view as well." View is
     genuinely editable now, so the toolbar belongs there too; it's
     still hidden for PDFs and canvases, which have neither a textarea
     nor an editable rendered page for it to act on. */
  const show = !!currentPath && currentType === "note"
    && (mode === "edit" || mode === "preview");
  wrap.style.display = show ? "block" : "none";
}

function wrapSelection(ta, before, after) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  ta.value = ta.value.slice(0, start) + before + selected + after
    + ta.value.slice(end);
  if (selected) {
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + selected.length;
  } else {
    ta.selectionStart = ta.selectionEnd = start + before.length;
  }
  commitEdit(ta);
  ta.focus();
}

/* prefixes every line the current selection touches with a marker
   (e.g. "# " for a heading, "> " for a quote) — a "Paragraph" action
   applies to whole lines, not just the exact characters selected,
   matching Obsidian's own real behaviour for this. togglePrefix: if
   every touched line already starts with this exact marker, it's
   removed instead of doubled up (so re-applying "# " toggles the
   heading off again, rather than stacking to "# # "). */
function prefixLines(ta, marker) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const value = ta.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const allPrefixed = lines.every((l) => l.startsWith(marker));
  const newLines = allPrefixed
    ? lines.map((l) => l.slice(marker.length))
    : lines.map((l) => marker + l);
  const newBlock = newLines.join("\n");
  ta.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  ta.selectionStart = lineStart;
  ta.selectionEnd = lineStart + newBlock.length;
  commitEdit(ta);
  ta.focus();
}

/* replaces the current selection outright (used by "Extract current
   selection..." to swap the cut text for a [[link]] back to its own,
   brand-new note) */
function replaceSelection(ta, text) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  commitEdit(ta);
  ta.focus();
}

/* ---- the rest of the editor's own right-click menu — Cam: "i want
   right click options for the right hand side (notes side)... See
   the image for an example of the features obsidian has." ---- */
function addLinkFlow(ta) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const hadSelection = start !== end;
  wrapSelection(ta, "[[", "]]");
  if (hadSelection) {
    // land past the closing ]] rather than leaving the just-wrapped
    // title text selected (wrapSelection's own default, right for
    // **bold** but not for a link Cam is about to move on from)
    ta.selectionStart = ta.selectionEnd = start + 2 + (end - start) + 2;
  }
}

async function addExternalLinkFlow(ta) {
  const url = await CC.prompt({title: "Add external link",
    placeholder: "https://...", yes: "Add"});
  if (!url) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const label = ta.value.slice(start, end) || "link";
  replaceSelection(ta, `[${label}](${url})`);
}

function searchForSelectionFlow(ta) {
  const text = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
  if (!text) return;
  document.getElementById("cx-search").value = text;
  applySearch();
}

/* Obsidian's own real "Extract current selection...": the selected
   text is cut out of the current note entirely, becomes the WHOLE
   content of a brand-new note, and what's left behind in the
   original note is a [[link]] straight back to it — the same
   "don't lose text, give it a real home" spirit as everything else
   in this app. */
async function extractSelectionFlow(ta) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  if (!selected.trim()) return;
  const suggested = selected.trim().split("\n")[0].slice(0, 60);
  const title = await CC.prompt({title: "Extract to a new note",
    value: suggested, yes: "Extract"});
  if (!title) return;
  const parentPath = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "";
  const r = await CC.Store.createNote(parentPath, title);
  if (r.error) { CC.toast(r.error, "error"); return; }
  await CC.Store.writeNote(r.path, selected);
  const newTitle = noteTitleOf(r.path);
  ta.value = ta.value.slice(0, start) + `[[${newTitle}]]` + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + newTitle.length + 4;
  commitEdit(ta);
  await refreshTree();
  CC.toast(`Extracted to "${newTitle}".`);
}

/* Select all — reimplemented because intercepting the native context
   menu (preventDefault on contextmenu) also hides the browser's own
   automatic version of it; without this, right-clicking would
   silently lose the ability to do it at all. Cut/Copy/Paste used to
   live here too, but Cam: "remove the copy and paste from right
   click menu... doesn't work so i dont want it to be there" — they
   were never real clipboard actions to begin with (no Clipboard API
   involved), just a reselect-and-toast telling him to press Ctrl+C/
   X/V himself, which is exactly the confusing non-functionality he's
   describing. Removed rather than actually implemented: the native
   Ctrl+C/X/V already work perfectly well on their own (Cam's own
   "Bugs 2026" note: "ctrl + c and v works, may be best to forget the
   right click copy and paste feature"), so there was never a real
   gap here to fill, just a broken menu item pretending to fill one. */
function editorSelectAll(ta) {
  ta.focus();
  ta.select();
}

/* ---- [[link]] autocomplete — typing "[[" starts it, matching
   Obsidian's own real behaviour, positioned at the actual cursor via
   a hidden "mirror" element (an invisible div sharing the textarea's
   own font/width/padding) — the standard, well-established technique
   for finding a plain <textarea>'s own caret pixel position, which
   the DOM otherwise never exposes directly. ---- */
function closeLinkSuggest() {
  document.getElementById("cx-link-suggest").classList.remove("open");
}

function currentLinkQuery(ta) {
  const upTo = ta.value.slice(0, ta.selectionStart);
  const lineStart = upTo.lastIndexOf("\n") + 1;
  const line = upTo.slice(lineStart);
  const openAt = line.lastIndexOf("[[");
  if (openAt === -1) return null;
  const between = line.slice(openAt + 2);
  if (between.includes("]]") || between.includes("\n")) return null;
  return {query: between, start: lineStart + openAt};
}

function caretPixelPosition(ta, charIndex) {
  const mirror = document.createElement("div");
  const style = getComputedStyle(ta);
  ["fontFamily", "fontSize", "lineHeight", "padding", "border",
   "boxSizing", "whiteSpace", "wordWrap"].forEach((k) => {
    mirror.style[k] = style[k];
  });
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.width = ta.clientWidth + "px";
  mirror.style.height = "auto";
  mirror.textContent = ta.value.slice(0, charIndex);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  CC.uiRoot().appendChild(mirror);   /* not document.body */
  const taRect = ta.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const top = taRect.top + (markerRect.top - mirrorRect.top) - ta.scrollTop;
  const left = taRect.left + (markerRect.left - mirrorRect.left);
  document.body.removeChild(mirror);
  return {top: top + 20, left};
}

function maybeShowLinkSuggest(ta) {
  const q = currentLinkQuery(ta);
  if (!q) { closeLinkSuggest(); return; }
  const query = q.query.toLowerCase();
  const matches = allNotes.filter((n) =>
    n.title.toLowerCase().includes(query)).slice(0, 8);
  const suggest = document.getElementById("cx-link-suggest");
  const showCreate = query && !allNotes.some((n) =>
    n.title.toLowerCase() === query);
  if (!matches.length && !showCreate) { closeLinkSuggest(); return; }
  suggest.innerHTML = matches.map((n) =>
    `<div class="cx-suggest-item" data-title="${
      CC.md.escapeHtml(n.title)}">${CC.md.escapeHtml(n.title)}</div>`).join("")
    + (showCreate ? `<div class="cx-suggest-item" data-title="${
        CC.md.escapeHtml(q.query)}"><span class="cx-suggest-new">Create
        note \u201c${CC.md.escapeHtml(q.query)}\u201d</span></div>` : "");
  suggest.querySelectorAll(".cx-suggest-item").forEach((item, idx) => {
    if (idx === 0) item.classList.add("cx-picked");
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const title = item.dataset.title;
      const before = ta.value.slice(0, q.start);
      const after = ta.value.slice(ta.selectionStart);
      ta.value = before + "[[" + title + "]]" + after;
      const pos = before.length + title.length + 4;
      ta.selectionStart = ta.selectionEnd = pos;
      commitEdit(ta);
      closeLinkSuggest();
      ta.focus();
    });
  });
  const pos = caretPixelPosition(ta, ta.selectionStart);
  suggest.style.top = pos.top + "px";
  suggest.style.left = pos.left + "px";
  suggest.classList.add("open");
}

/* ============================================================================
   SEARCH — filters the visible tree by note title.
   ============================================================================ */
function applySearch() {
  const q = document.getElementById("cx-search").value.trim().toLowerCase();
  const rows = document.querySelectorAll("#cx-tree .cx-tree-item");
  if (!q) { rows.forEach((r) => { r.style.display = ""; }); return; }
  rows.forEach((item) => {
    if (item.dataset.type !== "note") return;
    const label = item.querySelector(".cx-row-label").textContent
      .toLowerCase();
    item.style.display = label.includes(q) ? "" : "none";
  });
}

/* ============================================================================
   IMPORT — Cam: "It should also allow the importing on obsidian text
   files."
   ============================================================================ */
async function importFlow(kind) {
  await CC.Store.ready;
  if (!CC.Store.isDesktop()) {
    CC.toast("Import runs in the desktop app.", "error");
    return;
  }
  /* MOVED FROM AMNESIA. This reached past CC.Store to window.pywebview
     directly -- the one place in the file that did -- so the namespacing
     proxy never saw it and it would have called KinCrux's unprefixed
     methods. Routed through the host like everything else. */
  const call = (name, args) => window.CP.Store.call("notes_" + name, args, "Notes");
  const picked = kind === "folder"
    ? await call("pick_import_folder", []) : await call("pick_import", []);
  /* A picker that fails says so. Before, an error here fell through to
     import_files with no paths, and the button just seemed dead. */
  if (!picked || picked.error) {
    CC.toast((picked && picked.error) || "Couldn't open the file picker.", "error");
    return;
  }
  if (picked.cancelled) return;
  const r = await call("import_files", [picked.paths, ""]);
  if (r.error) { CC.toast(r.error, "error"); return; }
  await refreshTree();
  const skippedMsg = r.skipped.length
    ? ` (${r.skipped.length} file${r.skipped.length === 1 ? "" : "s"} skipped)`
    : "";
  CC.toast(`Imported ${r.notes} note${r.notes === 1 ? "" : "s"} and `
    + `${r.images} photo${r.images === 1 ? "" : "s"}.${skippedMsg}`);
}

async function importPdfFlow() {
  await CC.Store.ready;
  if (!CC.Store.isDesktop()) {
    CC.toast("Import runs in the desktop app.", "error");
    return;
  }
  const picked = await CC.Store.pickPdf();
  if (!picked || picked.error) {
    CC.toast((picked && picked.error) || "Couldn't open the file picker.", "error");
    return;
  }
  if (picked.cancelled) return;
  const r = await CC.Store.importPdfs(picked.paths, "");
  if (r.error) { CC.toast(r.error, "error"); return; }
  await refreshTree();
  const skippedMsg = r.skipped.length
    ? ` (${r.skipped.length} file${r.skipped.length === 1 ? "" : "s"} skipped)`
    : "";
  CC.toast(`Imported ${r.saved.length} `
    + `PDF${r.saved.length === 1 ? "" : "s"}.${skippedMsg}`);
}

/* ============================================================================
   BOOT
   ============================================================================ */
function setMode(newMode) {
  newMode = normalizeMode(newMode);
  if (!currentPath || currentType === "pdf" || mode === newMode) return;
  mode = newMode;
  renderEditorChrome();
  renderEditorBody();
  setPref("mode", mode);
}

/* Cam: "a shortcut implemented for [toggling view mode] this will
   allign with my keyboard centric workflow" — a simple, predictable
   binary: not currently "edit" -> go to "edit"; currently "edit" ->
   go to "preview". Works the same way regardless of whether Cam is
   currently in Data Entry mode too, rather than needing a
   third, separate rule for it. */
/* v292 — pane-aware: toggles whichever pane activePane says is the
   one Cam's actually working in right now, not always the primary
   one. Single-pane (no splitPane open at all), activePane is always
   "primary" and this behaves exactly as it always did. */
function toggleMode() {
  if (activePane === "split" && splitPane) {
    setSplitMode(splitPane.mode === "edit" ? "preview" : "edit");
    return;
  }
  if (!currentPath) return;
  setMode(mode === "edit" ? "preview" : "edit");
}

/* Cam: "a text size feature in view mode..." / v170's sidebar-hidden
   pref below it. Store.setPrefs OVERWRITES prefs.json wholesale —
   write_prefs on the Python side has no merge logic, it's a straight
   json.dump of whatever object it's handed. viewZoom's own save used
   to just pass {viewZoom} and that was fine as the ONLY pref that
   existed; a second independent pref calling setPrefs with its own
   single-key object would silently erase the other one on disk
   (whichever saves last wins, the other reverts to its default next
   launch). prefsCache is loaded once at boot and kept in sync locally
   so setPref() below can always write the FULL merged object instead
   — every future pref this app ever gains should go through it. */
let prefsCache = {};
async function setPref(key, value) {
  prefsCache[key] = value;
  await CC.Store.setPrefs(prefsCache);
}

/* the View-mode zoom control — Cam: "a text size feature in view
   mode, think like a zoom feature built into the app... hyprland
   doesnt play well in the app when i increase the UI host side."
   applyViewZoom() is safe to call any time, in any mode — it no-ops
   cleanly if #cx-preview doesn't currently exist (Edit mode). */
function applyViewZoom() {
  const zoomControl = document.getElementById("cx-zoom-control");
  const showZoom = mode === "preview";
  zoomControl.style.display = showZoom ? "flex" : "none";
  const preview = document.getElementById("cx-preview");
  if (preview) preview.style.setProperty("--view-zoom", viewZoom / 100);
  const label = document.getElementById("cx-zoom-level");
  if (label) label.textContent = viewZoom + "%";
  // v291 — the split pane shares this same zoom level rather than
  // getting its own separate control; keep its own preview element
  // (when it has one — Edit mode doesn't) in step with every change.
  const splitPreview = document.getElementById("cx-split-preview");
  if (splitPreview) splitPreview.style.setProperty("--view-zoom", viewZoom / 100);
}

async function changeZoom(delta) {
  viewZoom = Math.max(60, Math.min(250, viewZoom + delta));
  applyViewZoom();
  await setPref("viewZoom", viewZoom);
}

/* Cam: "If these are already possible then have the app preloaded
   with a note that explains the way to get the formatting." Written
   in real markdown, using the exact same syntax it's teaching — Cam
   can toggle to View and see it rendered right there as its own
   demonstration, or read it as raw markdown in Edit mode either way. */
const FORMATTING_HELP_NOTE = `# Formatting in Amnesia

Every note here is real, plain markdown text \u2014 the same format
Obsidian itself uses. You can type any of this directly, or right-
click a selection for the Format/Paragraph/Insert menus to do it for
you.

## Text

- \`**bold**\` or \`__bold__\` \u2192 **bold**
- \`*italic*\` \u2192 *italic*
- \`***bold and italic***\` \u2192 ***bold and italic***
- \`<u>underline text</u>\` \u2192 <u>underline text</u>
- \`~~strikethrough~~\` \u2192 ~~strikethrough~~
- \`==highlight==\` \u2192 ==highlight== (or right-click a selection in
  Data Entry and choose Highlight)
- \`=={color}text==\` \u2192 a colored highlight (green/purple/blue) — the
  same right-click menu offers all four colors directly
- single backticks around text \u2192 \`inline code\`

## Headings

\`# Heading 1\`, \`## Heading 2\`, \`### Heading 3\`

## Lists

Bullet list:
- \`- item one\`
- \`- item two\`

Numbered list:
1. \`1. first\`
2. \`2. second\`

## Quotes and code blocks

\`> a quoted line\` becomes:
> a quoted line

Three backticks on their own line start a code block, ending the same
way:

\`\`\`
a whole block of code
stays exactly as typed
\`\`\`

## Tables

\`\`\`
| Column 1 | Column 2 |
|---|---|
| a | b |
\`\`\`

becomes:

| Column 1 | Column 2 |
|---|---|
| a | b |

In Data Entry mode, right-click any real cell in a table for more:

- **Insert row above / Insert row below** \u2014 adds a real new row,
  matching the header's own real width. ("Above" isn't offered from
  the header row itself \u2014 a row before the header would break the
  table's own structure; "below" from the header lands the new row as
  the body's own first row.)
- **Insert column left / Insert column right** \u2014 adds a real new
  column across every row in the table, not just the one clicked.
- **Insert \u2713 / Insert \u2717** \u2014 drops a real checkmark or cross
  straight into the cell, right at the cursor.

## Linking notes

\`[[Another Note]]\` links to a note called "Another Note" \u2014
clicking it in View mode opens it, or creates it if it doesn't exist
yet. Type \`[[\` anywhere to get autocomplete as you type.

## Photos

Paste an image straight into a note in Edit mode to attach it.

## Keyboard shortcuts

In Edit mode, select some text and use:

- \`Ctrl+B\` \u2014 bold
- \`Ctrl+I\` \u2014 italic
- \`Ctrl+U\` \u2014 underline
- \`Ctrl+K\` \u2014 wrap the selection as a \`[[link]]\`
- \`Ctrl+1\` / \`Ctrl+2\` / \`Ctrl+3\` \u2014 turn the current line into a
  Heading 1, 2, or 3

\`Ctrl+E\` toggles View mode on and off from anywhere in the app.
`;

/* Cam: "please provide a Cortex Collaboration documentation note,
   that lists all the features of the app and how to use them." A
   real, comprehensive reference — every feature actually in the app,
   not an aspirational list. */
const DOCUMENTATION_NOTE = `# Amnesia \u2014 Documentation

Amnesia is a real, standalone second brain \u2014 notes are actual
\`.md\` files in actual folders on disk, the same way Obsidian itself
works. This note covers every real feature and how to use it.

## The vault and the sidebar

Every note, folder, and PDF lives in the tree on the left. Click a
folder to expand or collapse it. Click a note or PDF to open it.

- **New note** (the + button at the top of the sidebar) creates a
  note called "Untitled" and opens it immediately, title selected and
  ready to type over \u2014 no naming prompt gets in the way.
- **New folder** (the folder-plus button) creates "New Folder" and
  makes its name editable right there in the sidebar immediately.
- **Collapse/expand all folders** \u2014 one button, reads the whole tree
  fresh each time rather than a separate flag that could drift out of
  sync with reality.
- **Hide sidebar** \u2014 a small floating button takes its place at the
  start of the top bar while it's hidden, to bring it back.
- **Search** filters the sidebar by note title.

## Tabs and split view

Multiple notes or PDFs can be open at once, each in its own tab along
the top \u2014 \`Ctrl+N\` opens a new one. Opening something already open
in another tab switches to that tab instead of duplicating it.

A new, empty tab offers three things: *Create new note*, *Open note or PDF...*
(a searchable picker listing everything in the vault), and *Close*.
**Dragging a note or PDF from the sidebar onto the main content area**
does the same as picking it from that list \u2014 it opens in a genuinely
new tab, or switches to it if it's already open somewhere.

**Split view** puts a second, independent pane beside the first \u2014
right-click any note or PDF and choose *Open in split*, or press
\`Ctrl+\\\` (Obsidian's own real "split right" binding) to duplicate
whatever's currently open into a new pane beside it. Read one thing
in the primary pane while working in the other \u2014 Cam's own real use
case for this: reading a PDF on one side while taking notes about it
on the other. One extra pane, not a second tab strip \u2014 opening
another item into it replaces what's there. Close it with the \u00d7 in
its own top bar. **Drag the thin line between the two panes** to
resize them \u2014 the chosen split is remembered for next time.

**Active pane**, once split is open: whichever pane you last clicked
or tabbed into gets a visible border, and that's the one a shortcut
without its own obvious target (\`Ctrl+E\`, \`Ctrl+Alt+1/2/3\`) actually
acts on \u2014 the same idea as a tiling window manager's own focused
window.

## Organizing: drag, rename, move, copy, delete

- **Drag any note, folder, or PDF** onto a folder to move it there, or
  onto empty space in the sidebar to send it back to the vault's own
  root.
- **Right-click a note, folder, or PDF** for the full set of actions:
  - *Open in split* (notes and PDFs) \u2014 see Split view above.
  - *Make a copy* \u2014 duplicates a note or PDF, or an entire folder
    (recursively, everything inside it too).
  - *Move file/folder to...* \u2014 a picker listing every folder in the
    vault, an alternative to dragging.
  - *Copy path* \u2014 copies the item's own vault-relative path to the
    clipboard.
  - *Show in system explorer* \u2014 opens the item in your OS's own
    file manager.
  - *Open in default app* (notes and PDFs) \u2014 opens the raw file in
    whatever your system already has associated with that file type.
  - *Rename* \u2014 makes the sidebar label editable in place.
  - *Delete* \u2014 asks for confirmation first, then removes it for
    real (a folder's own delete removes everything inside it too).
- A folder's own right-click menu also offers *New note* and *New
  folder*, scoped to inside that folder.

## The three modes (notes only)

- **Edit** \u2014 the raw markdown text, in a plain text box.
- **View** \u2014 the same note, fully rendered: headings look like
  headings, bold looks bold, links are clickable.
- **Data Entry** \u2014 the rendered, formatted view, but directly
  editable. Click in and type \u2014 whatever formatting surrounds your
  cursor (bold, a heading, a list item) carries on naturally, the
  same way it would in any rich text editor. Built specifically so
  editing a template can't accidentally corrupt its own formatting
  the way editing raw markdown syntax sometimes can. Table cells are
  deliberately roomier here than in View \u2014 a real, comfortably-sized
  target to click into and edit, not a compact, published-looking
  table. Right-click any cell for real table-editing options \u2014
  insert a row or column, or drop a \u2713/\u2717 straight in \u2014 see the
  Formatting Guide's own Tables section for the full list.

Switch between them with the buttons at the top, press \`Ctrl+E\` to
jump straight between Edit and View, or \`Ctrl+Alt+1/2/3\` to jump to
Edit/View/Data Entry directly. Whichever mode you're in stays selected
\u2014 open a different note, switch tabs, even close and reopen Amnesia
entirely, and it's still exactly where you left it. It only ever
changes when you change it yourself. (None of this applies to a PDF
\u2014 see PDFs below.)

In View or Data Entry, use the \`\u2212\`/\`+\` zoom control next to the mode
buttons to change the text size \u2014 useful if your system's own
display scaling doesn't play well with the app. It's remembered the
next time you open Amnesia.

## Undo and redo

\`Ctrl+Z\` undoes your most recent change; \`Ctrl+Shift+Z\` redoes it.
Works in every mode, and for every kind of edit \u2014 typing, a
formatting shortcut, a table insert, a highlight \u2014 not just plain
text. A real, dedicated history for whichever pane you're actually
working in, rather than the browser's own native undo, which
wouldn't stay reliable across everything this app does to a note
behind the scenes. Ordinary typing groups into one undo step per
pause, the same way undo already feels in any other real editor,
rather than undoing a single character at a time. Scoped to whatever
you're currently looking at \u2014 switching to a different note or tab
starts that pane's own history fresh, rather than carrying it along.

## Formatting

See the separate "Formatting Guide" note (created alongside this one)
for the full, demonstrated list of markdown syntax, keyboard
shortcuts, and the right-click Format/Paragraph/Insert menus \u2014
available by right-clicking inside a note in Edit mode, including a
real table-size picker under Insert.

## Highlighting

In Data Entry mode, select some text and right-click for *Highlight* —
a submenu offers four real colors: Yellow, Green, Purple, Blue. Picking
a color on text that's already highlighted changes it to that color,
rather than layering a second highlight on top. *Remove highlight*
shows alongside the submenu once something's actually highlighted.

Uses Obsidian's own real \`==text==\` syntax under the hood for the
default yellow, and this app's own \`=={color}text==\` for the other
three colors — Obsidian itself has no single, standard syntax for a
colored highlight (only third-party plugins do, each with a different
one), so every highlight from before this feature existed keeps
working exactly as it always has.

## Linking \u2014 genuinely Obsidian-style

- \`[[Note Title]]\` links to another note. Type \`[[\` anywhere and an
  autocomplete list of matching notes appears as you keep typing;
  pick one, or keep typing a new title to create a note that doesn't
  exist yet.
- \`[[Note Title|custom label]]\` links the same way but displays
  different text.
- Clicking a link in View mode opens that note \u2014 or creates it, if
  it doesn't exist yet.
- Every note shows its own **Backlinks** in View mode \u2014 every other
  note that links to it, listed and clickable.

## Photos

Paste an image directly into a note while in Edit mode to attach it,
or right-click and choose *Insert > Photo...* to pick one already
sitting on disk. Either way it's saved into the vault's own
\`attachments\` folder and embedded automatically.

## PDFs

A PDF is a real, first-class item in the vault, opened and worked
with the same way a note is \u2014 not an attachment buried inside
something else. Bring one in with the **Import PDF** button at the
bottom of the sidebar; it appears in the tree alongside your notes,
with its own distinct icon.

Click one to open it \u2014 a continuously scrollable view of every page,
rendered at a width that fits the pane by default. The \`\u2212\`/\`+\` zoom
control re-renders every page at a new scale, since a PDF's own pages
are real, sharp renders rather than a resizable image, and stays on
whatever page you were actually reading rather than jumping back to
the top. A PDF is read-only in this app \u2014 there's no Edit/View/Data
Entry distinction for one, and nothing to save.

The real value is combining this with split view \u2014 open a PDF in one
pane and a note in the other (right-click the PDF \u2192 *Open in split*,
or the reverse: open the note first, then split the PDF in beside
it), and take real notes on what you're reading without losing your
place in either one.

## Canvas

Obsidian's own Canvas feature, built into Amnesia \u2014 an infinite,
zoomable space for storyboarding, mindmaps, idea boards, or laying
out anything that doesn't fit neatly into a linear document. Create
one with the board icon at the top of the sidebar; it appears in
the tree alongside your notes and PDFs, with its own distinct icon.

**Pan and zoom**: hold \`Space\` and drag to pan around, or
\`Ctrl+Scroll\` to zoom \u2014 zooming stays anchored to wherever your
cursor actually is, so the spot you're looking at never drifts out
from under you.

**Toolbar**: at the top, once a canvas is open \u2014 buttons to add a
text card, an embedded note or PDF, a photo, a link card, or a
group; zoom in/out; and a button to fit every card on the board
into view at once, for whenever you've panned off somewhere and
lost track of where your own cards actually are.

**Cards**: double-click anywhere empty to create a new text card,
right where you clicked. Click into a card to type; drag it by its
own edge to move it; drag the small handle in its own bottom-right
corner to resize it. Select a card and press \`Delete\` or
\`Backspace\` to remove it.

**Connections**: hover over any card to reveal four small handles on
its own edges. Drag from one to another card to connect them \u2014
the target side is worked out automatically from wherever you
actually drop, so there's no need to aim precisely. Click a
connection to select it, then \`Delete\` or \`Backspace\` to remove
it \u2014 removing a connection never removes the cards on either end
of it.

**Embedding**: the toolbar's own file and link buttons add an
existing note or PDF, or a plain web link, as its own card. A note
shows a real, live preview of its own content; a PDF shows its own
name and icon; either opens the real thing in a new tab with a
double-click. A link card shows its own domain, and opens in your
system's browser the same way.

**Photos**: the toolbar's own photo button picks from any image
already attached to a note; dragging a photo file in from outside
Amnesia entirely works too, landing exactly where you drop it.
Either way it becomes its own real card on the board.

**Groups and colors**: right-click any card or group for a real
\`Color\` menu \u2014 the same six colors Obsidian itself uses, so a
board colored here means the same thing there too. A group is a
labeled region you can drag other cards into; double-click its own
label to rename it, and dragging the group itself moves whatever's
actually inside it along too.

Saved in JSON Canvas, the real, open file format Obsidian itself
uses (not something invented for Amnesia) \u2014 a board built here can
genuinely open in Obsidian, or any other app that supports the
same format.

This is Phase 4 of a larger feature \u2014 groups and colors were the
next step after Phase 3's own embedded notes, PDFs, and links.
Photos came directly out of a follow-up question, not the
original phase plan itself. Export to image and a nested canvas
are the last real, planned steps of that original plan.

## Importing

The buttons at the bottom of the sidebar bring existing files in:

- **Import files** \u2014 pick one or more \`.md\` files.
- **Import folder** \u2014 pick an entire folder (a whole Obsidian vault,
  or part of one).
- **Import PDF** \u2014 pick one or more PDF files.

Markdown imports are genuinely lossless \u2014 the raw text is copied
byte-for-byte, so every \`[[link]]\` already in an imported note keeps
working exactly as written. Any local image an imported note
references (either Obsidian's own \`![[embed]]\` syntax or standard
\`![alt](path)\` markdown) is copied in too, and its reference is
updated automatically if the name had to be deduplicated.

## What's deliberately not here

No Canvas boards, no plugins, no cloud sync \u2014 Amnesia is scoped
deliberately to the real, everyday core of a markdown second brain
and reference library: notes, folders, linking, photos, and PDFs.
`;

/* Cam: "another preloaded note called versions which breaks down each
   version and lists the changes made in each version." The real,
   accurate history \u2014 matching this project's own handover records
   directly rather than summarized from memory. */
const VERSIONS_NOTE = `# Amnesia \u2014 Version History

Amnesia has been renamed twice. It was originally built as "Cortex
Collab," one tool among several in a larger, shared project; at v8 it
became standalone and was renamed "Cortex" \u2014 Cam: "Change its name
to Cortex. Stop referring to it as part of cams collective for this
app now is fully standalone." At v25 it was renamed again, to
Amnesia. Both earlier names are left intact in the entries below,
because each records what the app was actually called at the time.
Version numbering still starts fresh at v8 rather than continuing
the earlier shared project's own count.

## v8 \u2014 standalone, and PDF capability

- **Renamed** from "Cortex Collab" to "Cortex" throughout \u2014 the
  window title, the sidebar, every reference in this app's own
  documentation. The vault's own data folder name is deliberately
  left exactly as it already was, so nothing about an existing
  install's own real notes was put at any risk by a purely cosmetic
  rename.
- **A new visual identity** \u2014 a real, hand-drawn brain mark in the
  sidebar and as the app's own taskbar/app-drawer icon, replacing the
  earlier placeholder.
- **PDF capability** \u2014 Cam: "PDF capability, this way i can use it
  to read PDF or even open it split view with a note beside it and
  write notes on what i read." A PDF is a real, first-class item in
  the vault now, imported via a new Import PDF button, opened and
  tabbed the same way a note is, with its own continuously-scrollable
  reader and zoom control. Combined with split view, a PDF can sit in
  one pane while a note for actual notes-on-what-you're-reading sits
  in the other. See the Documentation note's own PDFs section for the
  full detail.
- Several real bugs found and fixed directly while building PDF
  support, by testing rather than assuming: renaming a PDF would have
  had .md incorrectly forced onto its own name; dragging a PDF in the
  sidebar would have misclassified it as a folder; a PDF's own tab
  title would have shown with .pdf still attached; and a text-editing
  shortcut like Ctrl+E had no check at all for whether a PDF was even
  open, and would have tried to render a note editor over one.

## v9 \u2014 table editing, closer to Obsidian's own

Cam: "Now i need the ability to add a tick or a cross into cells.
Further in view edit mode i want to be able to right click a cell in
a table and choose to insert another row or column to the table. This
is in a move to further allign table functionality to that of
Obsidian."

- **Right-click any table cell in Data Entry mode** for real
  table-editing options \u2014 no text selection needed first, just the
  cell itself: *Insert row above/below*, *Insert column left/right*,
  and *Insert \u2713* / *Insert \u2717*. All genuinely edit the table's own
  real structure and round-trip correctly back to markdown, not a
  cosmetic-only insert.
- A new row always gets exactly as many cells as the header row
  genuinely has \u2014 the one real source of truth for a table's own
  width. "Insert row above" is never offered from the header row
  itself, since a row before the header would break the table's own
  structure.
- A new column spans the whole table \u2014 every row gets the new cell
  at the same position, not just the one right-clicked.
- The tick/cross inserts at the real cursor position when there is
  one inside that cell, or appends to the cell's own existing content
  otherwise, so it always succeeds rather than silently doing nothing
  when a right-click doesn't happen to leave the cursor exactly where
  expected.

## v10 \u2014 opening notes faster

Cam: "The ability to drag and drop a note into the right area, then
opens it in a new tab. Ability to click open note when i start a new
tab. When changing zoom on pdf i want it to stay on the same page."

- **Drag a note or PDF from the sidebar onto the main content area**
  to open it \u2014 a genuinely new tab, or a switch to it if it's already
  open somewhere, the same rule a plain click already follows.
- **A new, empty tab now offers "Open note or PDF..."** alongside
  Create new note and Close \u2014 a real, searchable picker across the
  whole vault, filtering live as you type, rather than needing to
  hunt through the sidebar tree for something that already exists.
- **PDF zoom now stays on the same page.** Every zoom click re-renders
  every page from scratch at the new scale, which was silently
  resetting the scroll position back to the very top each time \u2014
  fixed by capturing which page (and how far into it) was actually
  showing beforehand, and landing back on that same real spot
  afterward, even though every page's own real height changes at a
  new scale.

## v11 \u2014 the zoom fix, actually fixed

Cam: "The pdf still doesn't remain on the same page when i resize, it
still re renders" (clicking the +/- zoom buttons, confirmed directly).

- v10's own fix captured and restored scroll correctly for a single
  zoom click in isolation, but wasn't enough on its own: clicking zoom
  a second time before the first click had finished re-rendering \u2014
  an entirely normal thing to do, clicking + a few times in a row to
  reach a size \u2014 made the second click's own scroll capture run
  against a pane that the first click had already wiped to a
  "Loading PDF\u2026" message, getting nothing real back. Fixed with a
  real generation counter: each zoom click claims its own number, and
  every step of its own render bails out cleanly the moment a newer
  click has come in behind it, so only the last click in a rapid
  sequence ever finishes and touches scroll.
- Reproduced and confirmed with real, deliberately overlapping async
  timing (not just tested in isolation) before and after the fix, to
  make sure this was the actual, real cause and not just a plausible
  guess.
- A second, separate, genuinely real bug found the same way while
  verifying this: pdf.js's own real worker script was never actually
  loading at all \u2014 its path was resolved relative to pdf.js's own
  file, not this app's, so the path used here was accidentally
  doubled and never found the real file. Confirmed directly against
  the real, vendored library and fixed.

## v12 \u2014 a resizable split, and the zoom fix shelved

Cam: "Still broken and didnt work shelf the fix for later. When in
split view make the sides of the screen resizable, by draging the
middle to either side."

- The v11 zoom-page fix still isn't fixing what Cam is actually
  seeing, despite real, direct testing at every step along the way \u2014
  shelved for now rather than guessing again without something new to
  go on.
- **The split view divider is now genuinely resizable** \u2014 drag the
  thin line between the two panes to make either one wider, clamped
  to a sane range (20-80%) so neither pane ever gets squeezed to
  nothing. The chosen split is remembered the same way viewZoom,
  mode, and sidebarHidden already are, and survives across notes,
  sessions, and a full restart.

## v13 \u2014 an icon that actually matches

Cam: "fix the icon for cortex please in the app and the desktop to be
closer alligned to the cashbox app icon :) If you have to change the
brain to all yellow that is fine, that way it can appear easier on
the black background."

- **A real, solid brain silhouette**, replacing the earlier two-colour
  outline-plus-inner-fold-lines artwork \u2014 sampled cashbox's own real
  icon directly for its exact background (#12151A) and glyph
  (#D9A441) colours, rather than guessing at a close match. The
  silhouette itself is a genuine fill of the original artwork's own
  outer contour (any real ink, outline or inner fold alike, marks a
  pixel as part of the brain; everything enclosed by the outermost
  boundary gets filled solid), not a redraw from scratch \u2014 so it's
  still recognisably the same brain, just rendered the way cashbox's
  own icon actually is: bold, flat, one colour.
- This also genuinely fixes the small-size legibility problem the
  older two-colour line art always had, at its actual root rather
  than working around it \u2014 there's no longer a separate "thickened"
  version needed below 64px; the same solid silhouette reads clearly
  at every size, 256px down to 16px, confirmed directly by rendering
  and inspecting each one.
- The in-app sidebar's own brand mark \u2014 previously a separate,
  hand-drawn SVG approximation of the brain, not derived from the
  real artwork at all \u2014 now uses this exact same silhouette too, so
  the taskbar icon and the mark inside the app itself are finally the
  same brain, not two different ones.

## v14 \u2014 real undo and redo

Cam: "Now add a ctrl+z for undo feature within Cortex."

- \`Ctrl+Z\`/\`Ctrl+Shift+Z\`, working in every mode and for every kind
  of edit \u2014 typing, a formatting shortcut, a table insert, a
  highlight. A genuinely custom system, not a reliance on the
  browser's own native textarea/contenteditable undo \u2014 confirmed
  directly, not assumed, that native undo wouldn't hold up here at
  all: this app sets a textarea's own \`.value\` directly and mutates
  the Data Entry DOM programmatically almost everywhere, and both are
  well known to clear or bypass a browser's own native undo stack
  outright.
- Ordinary typing groups into a single undo step per pause, the same
  way undo already feels in every other real editor, rather than
  undoing one character at a time; a discrete action like a table
  edit or formatting shortcut always gets its own step regardless of
  typing rhythm.
- A real, separate history per pane, reset whenever a different note
  is opened into it \u2014 undoing a recent mistake in whatever's
  currently on screen is the real, common case, and switching notes
  starting that pane's own history fresh is far simpler to get
  genuinely right than threading a separate history through every
  tab.
- Guarded so it never hijacks a genuinely unrelated text field \u2014 the
  rename box, the title input, search \u2014 which keep using their own
  ordinary, native undo instead.

## v15 \u2014 highlighting a whole row, without breaking the table

Cam: "when in vie[w] edit mode and select all the text in a row
within a table and click highlight, it destroys the formatting of
the table."

- A real, confirmed cause: highlighting works by cutting the selected
  content out and re-inserting it wrapped in a \`<mark>\`, and when a
  selection crosses a \`<td>\` boundary, that cut pulls out real row
  structure along with it \u2014 producing HTML a table can't actually
  contain. It never throws, so nothing caught it before; the
  browser's own HTML parser just silently "fixes" the invalid result
  by displacing the highlight out of the table's normal flow, which
  is exactly the broken bar in Cam's own screenshots.
- Fixed by handling a selection that spans multiple cells as what it
  actually is \u2014 several independent highlights, one per cell, never
  one operation that crosses a \`<td>\` boundary. Selecting a whole row
  and clicking Highlight now genuinely highlights every cell in it;
  clicking it again on an already-highlighted row removes it from
  every cell too.
- The right-click menu's own "Highlight"/"Remove highlight" label is
  fixed to match, for the same reason \u2014 it could previously say
  "Highlight" on an already-highlighted row, since the check it used
  was written for one selection inside one single highlight, which a
  multi-cell row was never going to satisfy even when genuinely fully
  highlighted.

## v16 \u2014 four real highlight colors

Cam: "have the ability to change the highlighter color. Green,
purple, blue and yellow please."

- Right-click a selection and choose *Highlight* for a real submenu
  of all four colors, alongside *Remove highlight* once something's
  actually highlighted. Picking a color on an already-highlighted
  selection changes it to that color in place, rather than layering a
  second highlight on top \u2014 so this genuinely changes an existing
  highlight's own color, not just adds new ones.
- Vanilla Obsidian itself has no single, standard syntax for a
  colored highlight (confirmed directly \u2014 only third-party plugins
  do it, each with a different one), so \`=={color}text==\` is this
  app's own. Yellow stays the plain, unmarked \`==text==\` it's always
  been, so every highlight already in Cam's own real notes keeps
  working exactly as it always has, with nothing to migrate.
- The multi-cell table fix from v15 carries through untouched \u2014
  highlighting (or re-coloring, or removing) a whole selected row
  still works correctly, per cell, with full color support.

## v17 \u2014 Canvas, Phase 1

Cam: "Obisidian has a canvas feature, i would like to implement that
into Amnesia. This will be an incredible tool for storyboarding,
planning, mindmaps, idea boards, UI ideas, ect... Please have a look
at obisidians webpage for information on the canvas feature, break
down the feature in steps of implementation. I want an in depth
system implemented into Cortex. Please keep the design true to
cortex."

- Researched directly before building anything \u2014 Obsidian's own real
  Canvas page, and the actual JSON Canvas file format (verified
  against Obsidian's own real spec and a real sample .canvas file on
  GitHub, not guessed). A five-phase plan followed from that: this
  delivery is Phase 1 \u2014 connections, more card types, groups/colors,
  and export are real, planned next phases, not gaps pretending not
  to exist.
- \`.canvas\` is a real, first-class vault item now, exactly like a
  note or PDF \u2014 its own icon in the sidebar, its own "New canvas"
  button, opens in a tab, and saves in JSON Canvas, the real, open
  format Obsidian itself uses. A board built here can genuinely open
  in Obsidian too.
- A real, infinite pan/zoom surface, with cursor-anchored zoom (the
  actual point under the cursor stays under it while zooming \u2014
  confirmed with real coordinate math, not assumed). Text cards:
  double-click to create, drag to move, drag a corner handle to
  resize, click in to edit, \`Delete\`/\`Backspace\` to remove.
- A real, deliberate architectural choice: a canvas's own live JSON
  reuses the exact same save/dirty/undo pipeline a note's own raw
  text already goes through, rather than a second, parallel system \u2014
  which is also what makes \`Ctrl+Z\` already work on every canvas
  edit, with no separate undo code written for it at all.
- A real, confirmed bug caught before it could ship: flushSave and
  the undo-restore path both silently assumed the primary pane always
  holds a note, which would have corrupted a canvas file with note-
  save logic the moment someone switched away from an unsaved one \u2014
  fixed by making both genuinely type-aware first.

## v18 \u2014 where the tools actually are

Cam: "Where are all the tools?" (with a screenshot of a real canvas,
two real cards on it, and genuinely nothing else visible anywhere on
screen).

- A real, confirmed gap: the hint bubble was the ONLY thing that ever
  showed pan/zoom/create at all, and it disappears the moment a
  single real card exists \u2014 leaving no visible way to discover any
  of it again the moment the board wasn't empty.
- A real, always-visible toolbar now sits at the top whenever a
  canvas is open \u2014 a button to add a card, zoom in/out, and Obsidian's
  own real "zoom to fit all cards" too, genuinely important on its
  own: pan far enough away and there'd otherwise be no way back to
  your own board short of guessing.
- Built from the exact same HTML/CSS pattern the PDF viewer's own
  zoom control already uses, so it reads as native to the app rather
  than a bolted-on extra.

## v19 \u2014 Canvas, Phase 2: connections

Continuing the Canvas feature into its own planned second phase \u2014
connecting cards together.

- Hover any card to reveal four small handles on its own real edges;
  drag from one to another card to connect them. The real JSON Canvas
  edge shape (fromNode/fromSide/toNode/toSide) confirmed against the
  exact same real spec Phase 1 was already built against, not
  invented fresh for this.
- The target side is worked out automatically from wherever the
  connection actually gets dropped, rather than requiring Cam to aim
  at a specific handle on the destination card too. Dropping back on
  the same card, or on genuinely empty space, cancels cleanly \u2014
  no pointless self-loop, no crash either.
- A real curved line with an arrowhead, drawn in an SVG layer that
  sits inside the exact same transformed world layer the cards
  themselves already live in \u2014 it inherits pan/zoom automatically,
  with no separate coordinate handling needed for the lines at all.
- Click a connection to select it, \`Delete\`/\`Backspace\` to remove
  it \u2014 removing a connection never removes the cards on either end
  of it, and deleting a card still correctly removes any connections
  attached to it, the same cascading behavior Phase 1 already had.

## v20 \u2014 Canvas, Phase 3: embedding notes, PDFs, and links

Continuing the Canvas feature into its own planned third phase \u2014
more real card types.

- A file card embeds an existing note or PDF. A note shows a real,
  live preview of its own content (the same real markdown renderer
  every note already uses); a PDF shows its own name and icon rather
  than attempting a full, live preview inside a small card, which
  felt like real, separate scope of its own rather than something to
  rush. Either opens the real file in a new tab with a double-click.
- A link card holds a plain web URL, shown by its own domain, and
  opens in the system's own default browser \u2014 reusing open_external,
  a real backend method that already existed for a markdown link
  inside a note, unused for anything else until now.
- Both are created from two new toolbar buttons. The file picker
  reuses the exact same search-filterable list already built for
  "Open note or PDF..." on an empty tab, resolving with the chosen
  path instead of opening it \u2014 a genuinely separate, parallel flow,
  so the original, already-proven picker was never put at any risk.
- Real testing surfaced a real bug in the test suite itself, not the
  app: a modal's own cancel button is wired via a direct \`.onclick =\`
  assignment rather than \`addEventListener\`, which a test helper
  mimicking a click was silently never triggering \u2014 leaving a
  promise waiting forever with no error at all. Traced down
  methodically (checkpoint by checkpoint) rather than guessed at,
  and fixed in both places it appeared.

## v21 \u2014 Canvas, Phase 4: groups and colors

Continuing the Canvas feature into its own planned fourth phase.

- Six real preset colors on any card or group \u2014 confirmed directly
  against a real Obsidian CSS snippet before building anything,
  rather than guessed at: 1=red, 2=orange, 3=yellow, 4=green, 5=blue,
  6=purple. Green/blue/purple reuse the exact shades an earlier
  phase of this app already established for highlighting, so "green"
  means the same real thing everywhere in Amnesia now, not two
  slightly different greens.
- A real, new right-click menu for canvas items \u2014 didn't exist at
  all before this phase, so it's built fresh, reusing the exact same
  menu/submenu system already proven for the highlighter's own color
  picker rather than a new one invented for this.
- Groups: a labeled background region, rendered as the real backmost
  layer (behind connections, behind cards) so it never visually
  covers what it's meant to sit behind. Dragging a group moves every
  card genuinely inside its own bounds along with it \u2014 that
  containment is computed once, right at the start of the drag, not
  continuously, since the group itself is what's actually moving.
  Resizing a group only ever resizes the group itself.
- \`Delete\` on the new menu reuses deleteCanvasSelection exactly \u2014
  the Delete/Backspace keydown handler was refactored to share that
  one, real implementation too, rather than risk two copies of "what
  deleting the current selection means" quietly drifting apart.

## v22 \u2014 a card you could actually get stuck inside

Cam: "When i add a new box the box appears like this and i cant move
it or resize" (with a screenshot of a new text card, text typed into
it, no visible way to grab it).

- A real, confirmed root cause: the text area filled a card's own
  entire surface with zero real gap around it, so any real mousedown
  anywhere on the card \u2014 not just a new one, every text card \u2014 was
  always intercepted by the "let the browser place a cursor" branch
  before the real move-drag logic could ever run at all.
- Fixed by giving the card itself real padding of its own, a genuine
  frame area around the text that was never covered by it \u2014 the one
  thing an actual move-drag needs to be reachable in the first place.
  The resize handle's own hit area was enlarged too, since it was a
  real, easy target to miss.
- A real gap in earlier test coverage, confirmed directly: every
  earlier drag/resize test only ever exercised the math of a drag
  already artificially in progress, constructing canvasDragState by
  hand rather than triggering it through a real, simulated mousedown
  \u2014 which is exactly how this got past testing in the first place.
  A new, real end-to-end test now simulates an actual mousedown on
  the card's own frame and confirms the drag genuinely starts, while
  confirming a mousedown on the real text itself still doesn't.

## v23 \u2014 the real fix, verified in a real browser this time

Cam: "I still cant move the new box i created nor resize it, plus it
still has that white box in the corner." The v22 fix above was
genuinely wrong \u2014 confirmed directly, not excused: it treated a
symptom, and the real bug was still there.

- The real, actual root cause, found this time by rendering the real
  card HTML in a genuine, real browser rather than reasoning about it
  in the abstract: the outer card wrapper's own type-modifier class
  (\`cx-canvas-card-\${kind}\`) collided with the INNER contenteditable
  text element's own, completely different, separately-purposed class
  (\`cx-canvas-card-text\`) \u2014 for a text-kind card specifically, both
  ended up being the literal same string, so a real check meant to
  detect a click on the inner text element always matched the outer
  wrapper itself immediately instead, no matter where a click
  actually landed, and the real move-drag logic could never be
  reached at all. No amount of padding \u2014 v22's own real fix \u2014 could
  ever have addressed this, since the actual check itself was
  broken at a more fundamental level.
- The outer wrapper's own modifier class is now
  \`cx-canvas-card-kind-\${kind}\`, a genuinely separate namespace from
  the inner text element's own class, with zero collision risk left.
- Found this time using Playwright, already available in this real
  environment \u2014 loading the actual, real app.js and shared.css into
  a genuine, real Chromium browser, rendering a real card, and
  literally clicking and dragging it with real, simulated mouse
  events, then reading the actual resulting node position back out.
  Confirmed directly: the earlier, hand-built JS mocks "passed"
  because they encoded my own incorrect assumption about what the
  real, rendered DOM would look like \u2014 a mock can never be more
  accurate than the assumptions that built it. A new, permanent test
  file now runs this same real-browser verification going forward,
  a genuinely different, additional layer of confidence the rest of
  this app's own mock-based suite structurally cannot provide.
- The resize handle's own corner indicator was rebuilt without a
  \`::after\` pseudo-element at all \u2014 confirmed directly that the
  original design renders correctly in a real, standards-compliant
  browser, so the "white box" Cam saw is most likely a genuine
  WebKitGTK-specific rendering quirk with that specific pseudo-
  element technique, matching this project's own real, established
  history of WebKit-specific quirks elsewhere. The new handle is a
  plain, direct, solid-colored square \u2014 simpler, more visible, and
  with nothing left for a pseudo-element quirk to even apply to.

## v27 \u2014 the web of knowledge

- **A graph of the vault's own links**, laid out as a spider's web rather
  than the usual scatter. Cam: "I want it to resemble a spiders web \u2026
  think web of knowledge." The button sits beside New canvas in the
  sidebar.
- **The links come from CC.md.extractLinks** \u2014 the same extractor the
  editor, the backlinks panel and the autocomplete already use. A graph
  with its own regex would eventually disagree with the backlinks about
  what links to what, and there would be no way to tell which was right.
- **Rings, not a blob.** Notes are pulled toward a radius set by how many
  links they sit from the busiest note, so hubs end up near the middle and
  leaves further out. That ring force is the whole difference between a web
  and the even scatter a plain force layout gives.
- **The scaffold is not data.** The faint guide circles and spokes behind
  everything are drawn in a different weight and colour from the threads and
  are never clickable. This is a picture of what links to what, and a
  decorative line that could be mistaken for a relationship would make the
  whole thing lie.
- **A note linked to but never written** is drawn hollow and dashed, because
  it is a hole in the vault rather than a note \u2014 usually a typo or
  something still to write, and worth being able to see.
- **Unlinked notes sit on the outer rim** rather than being hidden. A note
  nothing points at is exactly what a web is useful for finding.
- Hover lifts a note and its neighbours and fades the rest; the filter box
  highlights by title; wheel zooms and drag pans; clicking opens the note.
- Loaded after app.js on purpose: app.js starts the CC namespace with
  \`const CC = {}\`, so graph.js loaded before it was silently wiped \u2014
  which is exactly what happened first time, and showed as "Reading the
  vault\u2026" forever.

## v26 \u2014 resizable table columns, and tables that use the full note

- **Drag a column edge to resize it.** Cam: "When working with tables in
  Amnesia i want the ability to drag and resize cells." Hover within a few
  pixels of a cell's right-hand border and the cursor becomes a resize
  cursor; drag it. Data Entry mode only \u2014 View is read-only, and a drag
  there would appear to work and then be lost on the next render, so it is
  not offered at all.
- **No handle elements.** The resize is driven purely by pointer position.
  A handle element would have to live inside the contenteditable, where a
  stray backspace would delete it like text, and would have to be rebuilt
  every time the table re-rendered while Cam typed.
- **Widths persist in the .md file itself**, carried by the number of
  dashes in the table's own separator row:

      | Date | Change                    |
      |------|---------------------------|

  That is still a valid GFM separator. Obsidian and every other markdown
  tool render the table exactly as before \u2014 the dashes mean nothing to
  them. No frontmatter, no HTML comment, nothing a reader would see as
  noise. One dash per 20px, floored at three (fewer stops being a valid
  separator) and capped at sixty (1200px), so widths come back within 20px
  of where they were left.
- **A table that has never been resized is written exactly as before**,
  with plain three-dash separators, so every existing note is untouched
  until Cam actually drags something.
- **Tables now use the whole note area.** Cam: "Tables should ignore the
  formatting rule and be able to use the whole note area. I create and
  write pretty detailed notes and tables." The 780px reading measure moved
  off the container and onto the blocks inside it: prose, headings and
  lists still sit in the same centred column, and a table is exempt. One
  wider than the pane scrolls sideways on its own rather than dragging the
  whole note with it.
- Two bugs found while building it, both fixed: the rendered note was
  itself being capped at 780px, which put the ceiling straight back where
  it had just been removed from; and with the table pinned to the pane's
  width, \`table-layout: fixed\` shared that width out proportionally, so
  dragging a column 140px wider only grew it 112px and quietly shrank its
  neighbours.

## v25 \u2014 renamed to Amnesia

- **Renamed** from "Cortex" to "Amnesia" \u2014 Cam: "i want the app to
  now be called amnesia please. All functionality to remain the same."
  The window title, the sidebar, the app icon's own filenames, the
  build scripts and every reference in this app's own documentation.
- **New app mark**, supplied by Cam: a head in profile, hand to the
  temple, the top of the skull breaking apart into notes and checklists
  drifting away. It replaces the previous brain glyph in the sidebar, in
  the window icon and on the desktop. It arrived as a JPEG on solid
  black, so the background was keyed out to real alpha and the frame
  cropped to the artwork's own bounds before use.
- **make_amnesia_icon.py got much shorter.** The version before it
  existed to rescue the old brain artwork \u2014 recovering alpha from a
  baked-in checkerboard, then dilating and hole-filling line art into a
  solid silhouette because that style was illegible below 64px. The new
  mark is already flat, already a silhouette and already carries real
  alpha, so all of that was deleted rather than left in place doing
  nothing.
- **Nothing else changed.** No feature was added, removed or altered.
- **The vault's own data folder keeps its existing name**,
  \`cortex_collab_data\`, for exactly the reason the v8 rename kept it:
  a real install already has real notes sitting in a folder with that
  name, and renaming it would make them appear to have vanished the
  moment the update landed. The folder name is invisible in normal
  use; the risk of touching it is not worth a cosmetic gain.
- **Earlier entries keep their original names.** This app was called
  Cortex Collab, then Cortex, then Amnesia, and the history below says
  so rather than pretending it was always called what it is called
  now.
- References to \`ui/tools/cortex.js\` and to "Cam's Cortex" elsewhere
  in the source are left alone deliberately \u2014 those point at the
  separate Cortex tool inside Cams Collective, cited as prior art, not
  at this app.

## v24 \u2014 photos on the canvas

Cam: "Does canvas allow me to add photos onto the canvas as well??"
-> asked how adding one should actually work -> "Both."

- A photo card picks from any real image already attached to a note
  \u2014 attachments/ is deliberately never browsed directly anywhere
  else in this app (see list_tree's own docstring), so the picker's
  own empty state explains that honestly rather than just looking
  like a bug to someone who's never attached a photo to anything yet.
- Dragging a real photo file in from outside Amnesia entirely \u2014 the
  file manager, a browser, anywhere \u2014 works too, landing exactly
  where it's actually dropped. A genuinely different real mechanism
  from every other drag in this app: the OS itself manages the
  gesture right up until the drop, not this app's own mousedown-
  based system, so it uses the real, standard, native drop event
  instead, reusing save_image \u2014 the exact same real backend method
  a pasted image already goes through.
- Caught proactively, before it could ever become a real, reported
  bug: an \`<img>\` tag has its own real, native browser drag-to-move
  behavior that would compete with a card's own custom move-drag
  logic, the exact same real class of bug that just broke a text
  card. Disabled directly this time, on the very first pass.
- The real, native file-drop pipeline \u2014 the part of this feature
  genuinely riskiest to trust to a hand-built mock, given the hard
  lesson two earlier rounds on this exact file already taught \u2014
  is verified in an actual, real browser: a real File and
  DataTransfer, a real dispatched drop event, and the real resulting
  card confirmed to land exactly where it was dropped.

## Before v8 \u2014 built as "Cortex Collab"

## v282 \u2014 the first build

Cortex Collab created as a real, standalone, Obsidian-style second
brain. The foundational decision: notes are real, raw markdown text
(not a structured format), so import and export are genuinely
lossless. A real vault of actual \`.md\` files and folders on disk, not
a database. The dark theme, the sidebar, Edit and View modes,
\`[[linking]]\` with autocomplete, \`#tags\`, photo attachments,
backlinks, and Obsidian import all shipped in this first version. No
graph view and no Canvas \u2014 deliberately out of scope from the start.

## v284 \u2014 fleshed out

- Removed the grey "\u22ef" menu button next to sidebar items \u2014
  right-click already opened the same menu.
- New notes and folders no longer show a naming popup \u2014 notes land
  as "Untitled," folders get an inline-editable label immediately.
- Renaming became inline editing too, instead of a popup.
- A first version of sidebar drag-and-drop.
- Both right-click menus (notes and folders) fleshed out with real
  actions: Make a copy, Move to..., Copy path, Show in system
  explorer, Open in default app.
- A full right-click menu added inside notes themselves: Add link,
  Add external link, Search for selection, Extract current selection,
  Format/Paragraph/Insert submenus, Cut/Copy/Paste/Select all.
- "Preview" renamed to "View," and it stopped resetting to Edit every
  time a different note was opened.
- The preloaded Formatting Guide note added.
- Underline and strikethrough support added to the renderer.

## v285 \u2014 real fixes and three new features

- **Drag-and-drop rebuilt.** The first version (v284) didn't
  reliably complete a drop into a folder on every system \u2014 rebuilt
  entirely on plain mouse events instead of the browser's own native
  drag-and-drop, which behaves inconsistently across different
  environments.
- **Scrolling fixed.** View mode's own note area had no height limit
  at all, so long notes grew instead of scrolling.
- **Line breaks fixed.** A single Enter within a paragraph now
  produces a real line break, matching Obsidian's own real default,
  instead of being silently joined onto the same line.
- **Insert Table, with a real size picker** \u2014 choose the exact
  number of rows and columns.
- **A View-mode zoom control** \u2014 an in-app text size adjustment,
  remembered across restarts.
- **View Edit mode** \u2014 a new, third mode: the same rendered,
  formatted view, but directly editable, so a template's own
  formatting can't be accidentally broken by editing its raw markdown
  syntax.

## v286 \u2014 shortcuts and documentation

- **Keyboard shortcuts added**: \`Ctrl+B\`/\`Ctrl+I\`/\`Ctrl+U\`/\`Ctrl+K\`
  for bold/italic/underline/link, and \`Ctrl+1\`/\`Ctrl+2\`/\`Ctrl+3\` for
  headings, in Edit mode.
- This note, and a documentation note, added as preloaded references.

## v287 \u2014 sidebar controls

- **Collapse/expand all folders** \u2014 one button, top-left of the
  sidebar, that reads the whole tree fresh each time rather than
  tracking its own separate flag; its icon flips 180deg between the
  two states.
- **Hide sidebar** \u2014 also top-left; a small floating button takes
  its place at the start of the top bar while it's hidden, to bring
  it back.
- Both remembered across restarts.

## v288 \u2014 insert photo from disk

- **Insert Photo, from the editor's right-click Insert menu** \u2014 a
  second way to attach a photo alongside paste, for one that's
  already sitting on disk. Opens the same kind of native file picker
  Import already uses, copies the chosen photo(s) straight into the
  vault's own \`attachments/\` folder (never leaving it dependent on
  wherever the original file happens to live), and embeds each with
  the same \`![[name]]\` syntax a pasted image already gets.

## v289 \u2014 Data Entry, renamed and persistent

- **"View Edit" renamed to "Data Entry"** \u2014 same mode, clearer name
  for what it's actually for: typing straight into a table (or any
  other formatted content) without touching raw markdown syntax.
- **Table cells in Data Entry are no longer compact** \u2014 real,
  comfortably-sized padding, so an empty cell is an easy, obvious
  target to click into rather than a thin sliver.
- **Mode is now a genuinely global, persistent setting** \u2014 it used
  to be remembered per TAB (a leftover from before tabs existed at
  all), so switching tabs or opening a new one could silently land
  you back in Edit even mid-session. Now there's exactly one mode for
  the whole app, changed only when you choose to change it \u2014 stays
  put across notes, tabs, and even a full restart.

## v290 \u2014 highlighting

- **Highlight, from Data Entry's own right-click menu** \u2014 select
  text, choose Highlight (or Remove highlight, if it's already
  highlighted). Uses Obsidian's own real \`==text==\` syntax under the
  hood, so it round-trips cleanly through raw markdown, and the
  colour is the exact same one Data Entry's own table-cell hover
  already used.

## v291 \u2014 split view

- **Split view** \u2014 a second, independent pane beside the first.
  Right-click any note and choose "Open in split," or press \`Ctrl+\\\`
  (Obsidian's own real "split right" binding) to duplicate whatever's
  currently open into a new pane beside it. Full Edit/View/Data Entry
  support, its own save, its own zoom-shared-with-the-primary-pane
  reading experience. Deliberately one extra pane, not a second tab
  strip \u2014 opening another note into it replaces what's there.

## v292 \u2014 an active pane, like a tiling window manager

- **One pane is "active" at a time** \u2014 click or tab into either
  pane and a border appears around it (only shown once split is
  actually open). Whichever pane is active is the one a shortcut
  without its own cursor to key off \u2014 \`Ctrl+E\`, \`Ctrl+Alt+1/2/3\` \u2014
  actually acts on.
- Fixed a real correctness bug found while building this: every
  shortcut-driven edit used to always save into the PRIMARY pane's
  note, regardless of which pane the edit actually happened in \u2014
  wiring shortcuts onto the split pane without fixing this first
  would have silently saved split-pane edits into the wrong file.
- A second, separate instance of the same bug \u2014 highlighting text in
  the split pane would also have silently written into the PRIMARY
  pane's own note \u2014 was found and fixed the same way, later,
  directly by testing for it.

## v293\u2013295 \u2014 the tag system, fixed three times, still not right

- v293 found that searching \`#tag\` never actually checked a note's
  real tags at all, only its title \u2014 fixed with a real tag index.
- v294 made that index resilient to a single note failing to read,
  and faster (parallel reads instead of one at a time).
- v295 found the actual root cause after both of those didn't help:
  Cam's own real notes tag themselves with a BACKTICK-WRAPPED
  \`#Amnesia\`, not a bare #Amnesia \u2014 his own consistent convention,
  visible verbatim across several of his real notes. Standard
  Markdown correctly treats backtick-wrapped text as completely
  literal, so his tags were never being recognized as tags anywhere
  in the app, in search or in the rendered preview. Taught the app to
  recognize that one specific pattern as a real tag too.

## v296 \u2014 the tag system, removed

Cam: "scrap the tag system all together please." Even fixed, tagging
never became something worth the complexity it added \u2014 removed
entirely rather than kept as a feature Cam doesn't want. \`#text\`
anywhere in a note is now just plain text again, with no special
meaning; searching only ever matches a note's title. \`[[linking]]\`,
backlinks, and everything else are unaffected.
`;

async function boot() {
  await CC.Store.ready;

  tabs = [{path: null, text: "", dirty: false, type: "note"}];
  activeTabIndex = 0;

  wireToolbar();
  document.getElementById("cx-new-note-btn").onclick = () => newNoteIn("");
  document.getElementById("cx-new-canvas-btn").onclick = () => newCanvasIn("");
  document.getElementById("cx-web-btn").onclick = () => openGraphTab();
  document.getElementById("cx-new-folder-btn").onclick = () => newFolderIn("");
  document.getElementById("cx-collapse-all-btn").onclick = toggleCollapseAll;
  document.getElementById("cx-hide-sidebar-btn").onclick =
    () => setSidebarHidden(true);
  document.getElementById("cx-show-sidebar-btn").onclick =
    () => setSidebarHidden(false);
  document.getElementById("cx-import-btn").onclick = () => importFlow("files");
  document.getElementById("cx-import-folder-btn").onclick =
    () => importFlow("folder");
  document.getElementById("cx-import-pdf-btn").onclick = importPdfFlow;
  document.getElementById("cx-search").addEventListener("input", applySearch);
  document.getElementById("cx-mode-toggle")
    .querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => setMode(b.dataset.mode));
    });
  document.getElementById("cx-split-mode-toggle")
    .querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => setSplitMode(b.dataset.mode));
    });
  document.getElementById("cx-split-close").onclick = closeSplit;
  document.getElementById("cx-split-divider")
    .addEventListener("mousedown", onSplitDividerMouseDown);
  document.getElementById("cx-zoom-out").onclick = () => changeZoom(-10);
  document.getElementById("cx-zoom-in").onclick = () => changeZoom(10);
  document.getElementById("cx-pdf-zoom-out").onclick = () =>
    changePdfZoom("primary", document.getElementById("cx-pdf-viewer"), 1 / 1.2);
  document.getElementById("cx-pdf-zoom-in").onclick = () =>
    changePdfZoom("primary", document.getElementById("cx-pdf-viewer"), 1.2);
  document.getElementById("cx-split-pdf-zoom-out").onclick = () =>
    changePdfZoom("split", document.getElementById("cx-split-pdf-viewer"),
      1 / 1.2);
  document.getElementById("cx-split-pdf-zoom-in").onclick = () =>
    changePdfZoom("split", document.getElementById("cx-split-pdf-viewer"),
      1.2);
  document.getElementById("cx-canvas-add-card").onclick =
    () => addCanvasCardViaToolbar();
  document.getElementById("cx-canvas-add-file").onclick =
    () => addCanvasFileCardViaToolbar();
  document.getElementById("cx-canvas-add-image").onclick =
    () => addCanvasImageCardViaToolbar();
  document.getElementById("cx-canvas-add-link").onclick =
    () => addCanvasLinkCardViaToolbar();
  document.getElementById("cx-canvas-add-group").onclick =
    () => createCanvasGroup();
  /* v298 — a real support case: Cam saw the zoom controls but not
     this button after an update, most likely from index.html and
     app.js briefly coming from two different deliveries rather than
     the same one. A plain getElementById(...).onclick= throws on a
     null element, which would have silently killed every wiring line
     AFTER it in this same function (zoom controls included) — this
     button specifically is the one new addition since the last real
     release, so it's the one most likely to be missing if files ever
     drift out of sync again; guarding it stops that one gap from
     taking the rest of boot() down with it. */
  const addShapeBtn = document.getElementById("cx-canvas-add-shape");
  if (addShapeBtn) addShapeBtn.onclick = (e) => addCanvasShapeViaToolbar(e);
  document.getElementById("cx-canvas-zoom-out").onclick =
    () => zoomCanvasButton(1 / 1.2);
  document.getElementById("cx-canvas-zoom-in").onclick =
    () => zoomCanvasButton(1.2);
  document.getElementById("cx-canvas-zoom-fit").onclick =
    () => zoomCanvasToFit();
  prefsCache = await CC.Store.getPrefs();
  if (typeof prefsCache.viewZoom === "number") viewZoom = prefsCache.viewZoom;
  if (prefsCache.sidebarHidden) setSidebarHidden(true, {skipSave: true});
  if (typeof prefsCache.splitRatio === "number") splitRatio = prefsCache.splitRatio;
  /* v289 — "should stay persistent across app": taken literally
     enough to survive a full restart too, the same way viewZoom and
     sidebarHidden already do. Direct assignment rather than
     setMode(prefsCache.mode) — setMode() no-ops with no note open yet
     (its own `!currentPath` guard), which is exactly where boot()
     is at this point. */
  if (prefsCache.mode) mode = normalizeMode(prefsCache.mode);
  window.addEventListener("beforeunload", () => {
    if (dirty) flushSave();
    if (splitPane && splitPane.dirty) flushSplitSave();
  });

  /* v292 — Cam: "an active note feature, think my hyprland set up,
     where one window is active at one time." Clicking or tabbing
     into either pane's own editable content updates activePane, the
     same way clicking a window focuses it in a tiling WM. Clicks
     elsewhere (the sidebar, a dialog) deliberately leave activePane
     exactly where it was — switching notes in the sidebar shouldn't
     silently steal "active" away from whichever pane you were
     actually typing in a moment ago. */
  document.addEventListener("focusin", (e) => {
    if (!splitPane) return;   // nothing to disambiguate with one pane
    if (e.target.closest("#cx-split-area")) setActivePane("split");
    else if (e.target.closest("#cx-editor-area")) setActivePane("primary");
  });

  /* Cam: "have a shortcut implemented for [toggling view mode] this
     will allign with my keyboard centric workflow." Ctrl+E — Obsidian
     itself uses this exact binding for "Toggle reading view" by
     default, not the Ctrl+V Cam actually typed (the standard paste
     shortcut — almost certainly a slip given the context). Global,
     and preventDefault()'d unconditionally, so it fires the same way
     whether focus is in the sidebar or actively in the editor
     (the moment this is actually most useful) rather than being
     swallowed by a native GTK/readline-style Ctrl+E binding some
     Linux text fields already have (move-to-end-of-line). */
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
        && e.key.toLowerCase() === "e") {
      e.preventDefault();
      toggleMode();
    }
  });

  /* Cam: "implement shortcut CTRL + n, create a new note." Matches
     Obsidian's own real convention exactly (Cam's own screenshot:
     "Create new note (Ctrl + N)") — reuses newNoteIn(""), the same
     function and vault-root placement the sidebar's own + button
     already uses, so a shortcut and a button click do the same
     thing either way. */
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
        && e.key.toLowerCase() === "n") {
      e.preventDefault();
      newNoteIn("");
    }
  });

  /* Cam: "Shortcuts to toggle edit, view and view edit." Three
     dedicated shortcuts, one per mode, alongside (not replacing) the
     existing Ctrl+E toggle above. No single, confirmed external
     convention to match here the way Ctrl+B/I/U/K or the heading
     shortcuts had — Ctrl+Alt+1/2/3 is a deliberate, reasoned choice
     instead: it matches the exact left-to-right order the three mode
     buttons themselves already appear in the UI (Edit, View, View
     Edit), and Alt keeps it from colliding with the existing plain
     Ctrl+1/2/3 heading shortcuts. */
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey) {
      const target = {1: "edit", 2: "preview"}[e.key];
      if (!target) return;
      e.preventDefault();
      if (activePane === "split" && splitPane) setSplitMode(target);
      else setMode(target);
    }
  });

  /* v291 — Cam: "the split view mode where i can open 2 notes side by
     side." Ctrl+\ is Obsidian's own real "split right" binding
     (opens the currently active note into a new pane beside it) —
     matched exactly, same reasoning as every other shortcut in this
     file that has a real external convention to follow. No-ops with
     nothing open (there'd be nothing to duplicate into the split). */
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey
        && e.key === "\\") {
      e.preventDefault();
      if (currentPath) openInSplit(currentPath);
    }
  });

  /* Cam: "Now add a ctrl+z for undo feature within Cortex." Global,
     like every other shortcut above — works no matter which pane or
     mode is focused, acting on whichever pane is currently active
     (activePane) rather than needing a specific element focused
     first. Guarded against hijacking a DIFFERENT, unrelated text
     field though — the rename dialog, the title input, search, the
     move-to picker's own search box — since Ctrl+Z there should keep
     using that field's own ordinary, native undo rather than this
     note's. Only ever intercepted when focus is on one of the four
     real note-editing surfaces themselves, or on nothing in
     particular at all (View mode has no editable surface to focus in
     the first place, so undo should still work there too). */
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key.toLowerCase() !== "z") return;
    const active = document.activeElement;
    const editorIds = new Set(["cx-editor", "cx-split-editor",
      "cx-preview", "cx-split-preview"]);
    const isOtherTextInput = active && active.id
      && !editorIds.has(active.id)
      && (active.tagName === "INPUT" || active.tagName === "TEXTAREA"
          || active.isContentEditable);
    if (isOtherTextInput) return;
    const paneKey = activePane === "split" ? "split" : "primary";
    if (paneKey === "split" && (!splitPane || splitPane.type === "pdf")) return;
    if (paneKey === "primary" && (!currentPath || currentType === "pdf")) return;
    e.preventDefault();
    if (e.shiftKey) redoEdit(paneKey); else undoEdit(paneKey);
  });

  await loadVaults();                               // which vault is open (2026-10-12)
  await refreshTree();
  /* seeded exactly once, on a genuinely brand-new, empty vault only
     — matching the same "seed once, on a real first run" precedent
     the main app's own launcher-folder default already established;
     if Cam later deletes any of these deliberately, an empty vault
     after that point never re-triggers them, since this only ever
     runs from THIS one, first-boot code path. */
  if (!tree.length && vaultsInfo.active === "main") {   // (a new vault of your own starts empty)
    const seeds = [
      ["Formatting Guide", FORMATTING_HELP_NOTE],
      ["Documentation", DOCUMENTATION_NOTE],
      ["Versions", VERSIONS_NOTE],
    ];
    for (const [name, content] of seeds) {
      const r = await CC.Store.createNote("", name);
      if (!r.error) await CC.Store.writeNote(r.path, content);
    }
    await refreshTree();
  }
  renderTabBar();
  showEmptyState();
}

/* MOVED FROM AMNESIA. It booted on DOMContentLoaded, which was right
   when it owned the window. Here that fires at page load, long before
   anyone opens Notes, so the boot is handed to the host and runs once,
   the first time the section is opened.

   Its markup, by contrast, IS in the document from load -- see
   index.html. Amnesia wires listeners at parse time like Coach Cam
   does, and injecting the markup later made every lookup return null. */
window.CC = window.CC || CC;
/* openNote: the Omarchy menu opens one note (app.js openItem). */
/* the tree from disk again (2026-10-12, Cam: "i cannot see any of the notes you have created"): notes written from
   outside the window -- shipped notes, the desktop widgets' Fleeting notes, notes Claude writes -- only showed after
   something in Notes itself refreshed the tree. Now coming back to Notes, or to the window, reads it again (cheap:
   one folder walk), at most once every 2 seconds. */
let lastOutsideRefresh = 0;
async function refreshFromOutside() {
  if (!CC.Shell.booted || Date.now() - lastOutsideRefresh < 2000) return;
  const sh = document.getElementById("cx-shell");
  if (!sh || sh.hidden) return;
  lastOutsideRefresh = Date.now();
  try { await loadVaults(); await refreshTree(); } catch (e) { /* the tree stays as it was */ }
}
window.addEventListener("focus", () => refreshFromOutside());
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshFromOutside(); });
CC.Shell = {boot, booted: false, openNote: (path) => openNote(path), refresh: () => refreshFromOutside()};

/* Exposed for testing only, matching the same established pattern
   every other testable module in this project already uses
   (amnesia.js's own _test, coaching.js's own _test) — real internal
   state and functions, not a second, parallel implementation. */
CC._test = {
  newNoteIn, newFolderIn, renameItemFlow, deleteItemFlow, openNote,
  refreshTree, onEditorInput, flushSave, currentLinkQuery, onEditorKeydown,
  commitEdit, onSplitEditorInput, onSplitViewEditInput,
  tabToNextTableCell, indentListLine, outdentListLine,
  detectCompleteTableLines, blockPlainTextLines, findCurrentBlock,
  convertBlockToTable, appendRowToTable, onViewEditKeydown,
  switchToTab, closeTab, openNewTab, tabTitleFor, updateTabsForPathChange,
  copyPathFlow, onEditorPaste,
  get tabs() { return tabs; }, get activeTabIndex() { return activeTabIndex; },
  canDropOn, moveViaDrag, toggleMode, startInlineRename,
  onDragMouseDown, onDragMouseMove, onDragMouseUp, currentDropTargetAt,
  insertTableFlow, insertImageFlow, applyViewZoom, changeZoom, htmlToMarkdown,
  TOOLBAR_COMMANDS, wireToolbar, updateToolbarVisibility, normalizeMode,
  VIEW_TOOLBAR_COMMANDS, viewWrapSelection, viewSetBlockTag,
  viewToggleList, viewCurrentBlock, activeViewEditable,
  wireTaskCheckboxes, toggleTaskCheckbox, serializeList,
  openPreviewMenu, selectionMarkAncestor, rangeMarkAncestor,
  applyHighlightToRange, applyHighlightSelection, removeHighlightSelection,
  HIGHLIGHT_COLORS,
  selectionAnchorInMark,
  closestCell, insertSymbolInCell, insertTableRow, insertTableColumn,
  closestTable, cellsTouchedByRange, clipRangeToCell, unwrapMarksInRange,
  openInSplit, closeSplit, setSplitMode, flushSplitSave,
  applySplitRatio, onSplitDividerMouseDown, onSplitDividerMouseMove,
  onSplitDividerMouseUp, get splitRatio() { return splitRatio; },
  get dividerDragActive() { return dividerDragActive; },
  setActivePane, get activePane() { return activePane; },
  get splitPane() { return splitPane; },
  resetUndoHistory, recordUndoStep, undoEdit, redoEdit, applyRestoredText,
  get undoState() { return undoState; },
  MODES, boot,
  openCanvas, newCanvasIn, canvasTitleOf, parseCanvasJSON,
  generateCanvasNodeId, commitCanvasChange, renderCanvasChrome,
  renderCanvasBody, renderCanvasWorld, canvasCardHTML,
  canvasScreenToWorld, createCanvasTextCardAt, zoomCanvasAt,
  wireCanvasViewportInteractions, onCanvasDragMove, onCanvasDragEnd,
  wireCanvasCardInteractions,
  addCanvasCardViaToolbar, zoomCanvasButton, zoomCanvasToFit,
  canvasNodeSidePoint, canvasClosestSide, canvasEdgePathD, canvasEdgesSVG,
  canvasFileCardInnerHTML, canvasLinkCardInnerHTML, canvasTextCardInnerHTML,
  createCanvasImageCard, pickAttachmentForCanvasCard, addCanvasImageCardViaToolbar,
  get canvasImageUrlCache() { return canvasImageUrlCache; },
  get canvasImageUrlLoading() { return canvasImageUrlLoading; },
  CANVAS_COLOR_PRESETS, setCanvasNodeColor, createCanvasGroup, canvasGroupHTML,
  wireCanvasGroupInteractions, renameCanvasGroupFlow, openCanvasNodeMenu,
  deleteCanvasSelection,
  SHAPE_TYPES, canvasShapeSVG, canvasShapeCardInnerHTML, createCanvasShapeAt,
  addCanvasShapeViaToolbar, shapeStyleDialog,
  reorderCanvasNode, reorderCanvasNodeToEdge,
  canvasViewportCenterWorld, pickFileForCanvasCard, createCanvasFileCard,
  createCanvasLinkCard, addCanvasFileCardViaToolbar, addCanvasLinkCardViaToolbar,
  get canvasFileContentCache() { return canvasFileContentCache; },
  get canvasFileContentLoading() { return canvasFileContentLoading; },
  wireCanvasEdgeInteractions,
  updateCanvasZoomLevel,
  get canvasState() { return canvasState; },
  set canvasState(v) { canvasState = v; },
  get canvasDragState() { return canvasDragState; },
  set canvasDragState(v) { canvasDragState = v; },
  get canvasSpaceHeld() { return canvasSpaceHeld; },
  set canvasSpaceHeld(v) { canvasSpaceHeld = v; },
  CC_EMPTY_CANVAS_JSON,
  setMode, onViewEditInput, renderPreviewInto,
  get viewZoom() { return viewZoom; },
  flattenFolders, moveToFlow, copyPathFlow, openItemMenu,
  flattenOpenable, openExistingItemFlow, openInNewTab, isOpenableDragSource,
  getCurrentPdfScrollState, restorePdfScrollState,
  wrapSelection, prefixLines, replaceSelection, insertAtCursor,
  openEditorMenu, addLinkFlow, addExternalLinkFlow,
  searchForSelectionFlow, extractSelectionFlow,
  editorSelectAll,
  applySearch,
  renderCtxMenu, closeCtxMenu,
  FORMATTING_HELP_NOTE, DOCUMENTATION_NOTE, VERSIONS_NOTE,
  get currentText() { return currentText; },
  get dirty() { return dirty; },
  set dirty(v) { dirty = v; },
  get currentPath() { return currentPath; },
  get currentType() { return currentType; },
  get titleToPath() { return titleToPath; },
  get tree() { return tree; },
  get mode() { return mode; },
  /* v170 */ toggleCollapseAll, updateCollapseAllBtn, allFolderPaths,
  /* v297 */ toggleFolder, CX_STAGGER_STEP_MS, CX_STAGGER_ITEM_MS,
  CX_STAGGER_MAX_STEPS,
  setSidebarHidden, setPref,
  get collapsed() { return collapsed; },
  get prefsCache() { return prefsCache; },
  _setTree: (t) => { tree = t; },
  /* PDF support */
  openPdf, pdfTitleOf, renderPdfChrome, renderPdfBody,
  renderPdfPagesInto, changePdfZoom, guessCurrentPdfScale,
  get pdfViewerState() { return pdfViewerState; },
  treeRowHTML, importPdfFlow,
};



