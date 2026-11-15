/* ==========================================================================
   Fleeting — quick thoughts, in a queue.

   Cam: "quick note, a little text widget where I can write a quick thought
   and it gets saved under a new sub section in Notes called Fleeting (this
   will store all quick notes taken simply title fleeting note #. A fleeting
   note then can be reviewed later and I can add to another note in the Vault
   section Via copy and paste, then I can delete the note from fleeting. If I
   have 5 notes in fleeting then delete number 1 the other notes then rename.
   The numbers act as a que. I take alot of fleeting notes so this would be
   great."

   They are ORDINARY notes in a Fleeting folder of the vault — so they open in
   Notes, and in whatever else Cam points at the vault. Only the naming and
   the renumbering are special, and both are done in one place in the backend
   where they can be tested.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const store = {
    list: () => SS.Store.call("fleeting_list", [], "Your fleeting notes"),
    add: (text) => SS.Store.call("fleeting_add", [text], "Saving a fleeting note"),
    remove: (n) => SS.Store.call("fleeting_delete", [n], "Deleting a fleeting note"),
  };

  /* The app's own list, so the dashboard's quick-note block and this screen
     never disagree about what is in the queue. */
  SS.Fleeting = SS.Fleeting || {};
  SS.Fleeting.add = (text) => store.add(text);
  SS.Fleeting.list = () => store.list();
  /* The dashboard's Fleeting viewer deletes through this too, so a note
     removed there renumbers the queue exactly as it does here. */
  SS.Fleeting.remove = (n) => store.remove(n);

  async function render(host) {
    const notes = (await store.list()) || [];
    host.innerHTML = `
      <div class="fl-page">
        <div class="fl-head">
          <h2 class="page-h">Fleeting</h2>
          ${notes.length ? `<button class="btn btn-quiet" id="fl-pdf"
             title="Every fleeting note in one PDF">Export all to PDF</button>` : ""}
        </div>
        <p class="stamp">Quick thoughts, numbered in the order they were taken.
          Copy one into a note in Scribe, then delete it — the rest close up
          so the numbers stay a queue.</p>

        <div class="fl-new">
          <textarea class="input fl-input" id="fl-text" rows="3"
                    placeholder="A quick thought&#8230;"></textarea>
          <button class="btn btn-primary" id="fl-save">Save</button>
        </div>

        ${notes.length ? `<div class="fl-list">${notes.map(row).join("")}</div>`
          : `<p class="fl-empty">Nothing here. Anything you jot down — here or
               on the dashboard — lands in this queue.</p>`}
      </div>`;

    const box = host.querySelector("#fl-text");
    host.querySelector("#fl-save").onclick = () => save(host, box);
    /* Ctrl+Enter saves, because a thought worth catching is worth catching
       without reaching for the mouse. */
    box.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") save(host, box);
    });
    const pdfBtn = host.querySelector("#fl-pdf");
    if (pdfBtn) pdfBtn.onclick = () => exportPdf(pdfBtn);
    host.querySelectorAll("[data-copy]").forEach((b) =>
      b.onclick = () => copyOut(b.dataset.copy, notes));
    host.querySelectorAll("[data-open]").forEach((b) =>
      b.onclick = () => SS.go("notes:vault"));
    host.querySelectorAll("[data-del]").forEach((b) =>
      b.onclick = () => remove(host, Number(b.dataset.del), notes));
  }

  /* Cam (2026-10-02): "export all the fleeting notes into a pdf. Then i can
     provide this to you, so you have all the changes that i require in the
     one document." Built and rendered in the backend (fleeting_pdf.py); it
     asks where to save it, then opens it. */
  async function exportPdf(btn) {
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Making the PDF…";
    try {
      const r = await SS.Store.call("fleeting_export_pdf", [], "Exporting to PDF");
      if (r && r.error) SS.shared.toast(r.error, "error");
      else if (r && r.ok) SS.shared.toast(`${r.notes} fleeting note${r.notes === 1 ? "" : "s"} saved as a PDF.`);
    } finally {
      btn.disabled = false;
      btn.textContent = was;
    }
  }

  function row(n) {
    const when = n.written ? new Date(n.written * 1000).toLocaleString() : "";
    return `<div class="fl-note">
      <div class="fl-note-h">
        <span class="fl-n">${n.n}</span>
        <span class="fl-when">${esc(when)}</span>
        <button class="btn btn-quiet" data-copy="${n.n}">Copy</button>
        <button class="btn btn-quiet" data-open="${n.n}"
                title="Open Notes to paste it into a note">Notes</button>
        <button class="btn btn-quiet fl-del" data-del="${n.n}">Delete</button>
      </div>
      <div class="fl-text">${esc(n.text).replace(/\n/g, "<br>") || "<i>Empty</i>"}</div>
    </div>`;
  }

  async function save(host, box) {
    const text = box.value.trim();
    if (!text) { SS.shared.toast("Nothing to save yet."); return; }
    const res = await store.add(text);
    if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't save.", "error"); return; }
    box.value = "";
    await render(host);
    SS.shared.toast(`Saved as fleeting note ${res.n}.`);
  }

  async function copyOut(n, notes) {
    const note = notes.find((x) => String(x.n) === String(n));
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note.text || "");
      SS.shared.toast("Copied — paste it wherever you want it.");
    } catch (e) {
      /* Without clipboard permission, show it selected so Ctrl+C still works
         rather than leaving Cam with a copy button that does nothing. */
      const d = SS.shared.openDlg(`Fleeting note ${n}`,
        `<textarea class="input" rows="8" id="fl-copy">${esc(note.text || "")}</textarea>
         <p class="stamp">Select and copy — this build couldn't reach the clipboard.</p>`);
      d.btn("Close", "btn-quiet", d.close);
      const t = d.body.querySelector("#fl-copy");
      t.focus(); t.select();
    }
  }

  async function remove(host, n, notes) {
    const note = notes.find((x) => x.n === n);
    const yes = await SS.shared.confirm({
      title: `Delete fleeting note ${n}?`,
      body: (note && note.text ? `“${note.text.slice(0, 90)}${note.text.length > 90 ? "…" : ""}”`
        : "This note is empty.") + " The notes after it move up a number.",
      yes: "Delete",
    });
    if (!yes) return;
    const res = await store.remove(n);
    if (!res || res.error) { SS.shared.toast((res && res.error) || "That didn't work.", "error"); return; }
    await render(host);
  }

  SS.Fleeting.VIEWS = ["fleeting:list"];
  SS.Fleeting.PREFIX = "fleeting:";
  SS.Fleeting.mount = async (host) => {
    host.style.display = "";
    await render(host);
  };
})();
