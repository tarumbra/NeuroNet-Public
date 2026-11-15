/* ==========================================================================
   crux.ui — toasts, confirms, dialogs, and the veil discipline.
   ==========================================================================
   Small, and carrying three bugs' worth of hard-won rules. Every one of
   these cost a real report before it was understood.

   1. EACH OVERLAY GETS ITS OWN VEIL ELEMENT. A confirm opened from
      inside a dialog must not render into the same element that dialog
      is living in, or opening it destroys the dialog's live DOM out from
      under it. Cashbox hit this with Delete-inside-edit; Cam's Cards hit
      it with a photo picker; Capture's lightbox hit it in split view.
      Three separate reports, one cause.

   2. LISTENERS GO ON THE VEIL ONCE, NOT PER DIALOG. Veils are permanent
      elements — unlike page content, they are never torn down. Attaching
      a fresh mousedown/mouseup pair every time a dialog opened leaked
      one pair per dialog, forever. Cam: "the app crashes... it freezes
      and i can't click anything at all... after i click around the app
      for a little." That was ten stale listener pairs firing on every
      click.

   3. CLOSE ON MOUSEDOWN **AND** MOUSEUP, NOT ON CLICK. A text-selection
      drag that starts inside the dialog can have its click target
      resolve to the veil, so a plain `e.target === veil` check reads a
      drag as a click outside. Cam: "when i use my mouse to highlight the
      entry or text it closes the add or edit window." Only close when
      both halves genuinely landed on the veil.

   THE STACK. Give a new overlay a layer rather than guessing a number:
      600 fullscreen · 700 viewer/editor · 800 dialogs · 900 confirms
      · 950 toasts
   ========================================================================== */
"use strict";

window.CruxUI = (function () {
  const esc = (s) => String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escA = (s) => esc(s).replace(/"/g, "&quot;");

  /* Rule 2: one listener pair per veil, ever. The WeakMap holds which
     close function the shared listener should currently call. */
  const veilClosers = new WeakMap();
  const wired = new WeakSet();

  function wireVeil(veil) {
    if (wired.has(veil)) return;
    wired.add(veil);
    let downOnVeil = false;
    veil.addEventListener("mousedown", (e) => {
      downOnVeil = e.target === veil;
    });
    veil.addEventListener("mouseup", (e) => {
      /* Rule 3: both halves, or a selection drag closes the dialog */
      const bothOnVeil = downOnVeil && e.target === veil;
      downOnVeil = false;
      if (!bothOnVeil) return;
      const close = veilClosers.get(veil);
      if (close) close();
    });
  }

  function setCloser(veil, fn) {
    wireVeil(veil);
    veilClosers.set(veil, fn);
  }

  function toast(message, kind) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " toast-" + kind : "");
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  /** A dialog. `veilId` lets a caller open one inside another safely —
      see rule 1. */
  function openDlg(title, bodyHTML, opts) {
    opts = opts || {};
    const veil = document.getElementById(opts.veilId || "modal-veil");
    if (!veil) return null;
    veil.innerHTML = `
      <div class="modal ${opts.wide ? "modal-wide" : ""}" role="dialog"
           aria-modal="true" aria-label="${escA(title)}">
        <h3>${esc(title)}</h3>
        <div class="dlg-body"></div>
        <div class="dlg-row row"></div>
      </div>`;
    veil.querySelector(".dlg-body").innerHTML = bodyHTML;
    const close = () => {
      veil.classList.remove("open");
      veil.innerHTML = "";
      veilClosers.delete(veil);
    };
    setCloser(veil, close);
    veil.classList.add("open");
    return {
      veil,
      body: veil.querySelector(".dlg-body"),
      row: veil.querySelector(".dlg-row"),
      close,
      btn(label, cls, fn) {
        const b = document.createElement("button");
        b.className = "btn " + (cls || "");
        b.textContent = label;
        b.onclick = fn;
        this.row.appendChild(b);
        return b;
      },
    };
  }

  /** Resolves true/false. Renders into its OWN veil (rule 1) so it can
      be called from inside an open dialog. */
  function confirm(opts) {
    const {title, body, fine = "", yes = "Go ahead", danger = true,
           veilId = "confirm-veil"} = opts || {};
    return new Promise((resolve) => {
      const veil = document.getElementById(veilId);
      if (!veil) { resolve(false); return; }
      veil.innerHTML = `
        <div class="modal" role="alertdialog" aria-modal="true">
          <h3></h3><p class="stamp"></p><p class="stamp"></p>
          <div class="row">
            <button class="btn btn-quiet" data-act="no">Cancel</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}"
                    data-act="yes"></button>
          </div>
        </div>`;
      veil.querySelector("h3").textContent = title || "";
      const ps = veil.querySelectorAll("p");
      ps[0].textContent = body || "";
      ps[1].textContent = fine;
      veil.querySelector("[data-act=yes]").textContent = yes;
      const close = (answer) => {
        veil.classList.remove("open");
        veil.innerHTML = "";
        veilClosers.delete(veil);
        resolve(answer);
      };
      veil.querySelector("[data-act=no]").onclick = () => close(false);
      veil.querySelector("[data-act=yes]").onclick = () => close(true);
      setCloser(veil, () => close(false));
      veil.classList.add("open");
      veil.querySelector("[data-act=yes]").focus();
    });
  }

  /** One text field. Resolves the string, or null if cancelled — null
      and "" mean different things and callers rely on the difference. */
  function promptText(title, label, initial, opts) {
    return new Promise((resolve) => {
      const d = openDlg(title, `
        <label class="dlg-label">${esc(label)}</label>
        <input class="input" id="crux-prompt" style="width:100%"
               value="${escA(initial || "")}">`, opts);
      if (!d) { resolve(null); return; }
      const input = d.body.querySelector("#crux-prompt");
      const done = (v) => { d.close(); resolve(v); };
      d.btn("Cancel", "btn-quiet", () => done(null));
      d.btn("Save", "btn-primary", () => done(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); done(input.value); }
        if (e.key === "Escape") done(null);
      });
      input.focus();
      input.select();
    });
  }

  return {esc, escA, toast, openDlg, confirm, promptText, setCloser};
})();
