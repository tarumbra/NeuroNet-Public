/* ==========================================================================
   Settings → Export & import
   ==========================================================================
   Cam: "in settings i would like a setting to export and import data. It
   will export all the data except for music, movies, videos or anything
   large, It will export the photos and ebooks. This will make it easier to
   move to another system."

   The work is data_transfer.py's; this is the page. It shows what will go
   in and what won't BEFORE anything is written -- where every part of the
   data lives, how big it is, and what is left out (the music, above all) --
   because an export that silently lacked something would only be found out
   on the new computer, with the old one gone.

   Export and import run in the background; the page asks how far along they
   are, so a large photo library shows progress rather than a frozen window,
   and leaving the page and coming back picks the progress up again.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const call = (name, args, what) => SS.Store.call(name, args || [], what || "Export & import");
  const toast = (m, k) => SS.shared.toast(m, k);

  function size(b) {
    b = Number(b) || 0;
    if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
    if (b >= 1e6) return Math.round(b / 1e6) + " MB";
    if (b >= 1e3) return Math.round(b / 1e3) + " KB";
    return b ? b + " bytes" : "empty";
  }
  const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${n === 1 ? "" : "s"}`;

  let host = null;
  let poll = null;

  async function render(el) {
    host = el;
    el.innerHTML = `
      <div class="tx">
        <section class="tx-card">
          <h3 class="tx-h">Export</h3>
          <p class="stamp">One file with everything of yours in it, to copy to the other
            computer. Photos and ebooks go in; music, films and other recordings don't —
            they're far too big, and are best copied across as they are.</p>
          <div id="tx-summary"><p class="stamp">Working out what's there…</p></div>
          <div class="tx-lock">
            <div class="tx-left-h">A password on the export</div>
            <p class="stamp">Recommended: the export holds your journal, money and contacts,
              and it travels by LocalSend or on a stick. With a password it's locked — a
              <b>.nnx</b> file that opens only with it. There's no way back in without it,
              so keep it somewhere safe. Leave both empty for a plain .zip.</p>
            <div class="tx-row">
              <input class="input" type="password" id="tx-pass" placeholder="Password" autocomplete="new-password">
              <input class="input" type="password" id="tx-pass2" placeholder="Same again" autocomplete="new-password">
            </div>
          </div>
          <p class="stamp">It also takes this computer's desktop set-up — the dock, the desktop
            board and photo frame settings, and the NeuroNet theme — so a new computer comes
            up looking like this one.</p>
          <div class="tx-row">
            <button class="btn btn-primary" id="tx-export">Export to a file…</button>
          </div>
          <div class="tx-status" id="tx-export-status" hidden></div>
        </section>

        <section class="tx-card">
          <h3 class="tx-h">Import</h3>
          <p class="stamp">Bring in an export made on another computer. It adds and replaces;
            it never deletes. Anything it replaces is kept first, so nothing is lost if you
            import the wrong one.</p>
          <div class="tx-row">
            <button class="btn" id="tx-import">Import from a file…</button>
          </div>
          <div class="tx-status" id="tx-import-status" hidden></div>
        </section>
      </div>`;
    el.querySelector("#tx-export").onclick = startExport;
    el.querySelector("#tx-import").onclick = pickImport;
    const st = await call("data_transfer_status", [], "");
    if (st && st.state === "running") follow(st.kind);
    const sum = await call("data_export_summary", [], "Looking at your data");
    if (host === el) paintSummary(sum);
  }

  function paintSummary(sum) {
    const box = host && host.querySelector("#tx-summary");
    if (!box) return;
    if (!sum || sum.error) {
      box.innerHTML = `<p class="bd-empty">${esc((sum && sum.error) || "Couldn't look at your data.")}</p>`;
      return;
    }
    box.innerHTML = `
      <table class="tx-table">
        <thead><tr><th>What</th><th>Where it is now</th><th class="n">Files</th><th class="n">Size</th></tr></thead>
        <tbody>${sum.areas.map((a) => `<tr>
          <td>${esc(a.label)}</td><td class="tx-path" title="${esc(a.path)}">${esc(a.path)}</td>
          <td class="n">${a.files.toLocaleString()}</td><td class="n">${a.files ? size(a.bytes) : "—"}</td></tr>`).join("")}
        </tbody>
        <tfoot><tr><td colspan="2">The export</td><td class="n">${sum.files.toLocaleString()}</td>
          <td class="n">${size(sum.bytes)}</td></tr></tfoot>
      </table>
      ${sum.skipped.length ? `<div class="tx-left">
        <div class="tx-left-h">Left out</div>
        <ul>${sum.skipped.map((s) => `<li><b>${esc(s.why[0].toUpperCase() + s.why.slice(1))}</b> —
          ${plural(s.files, "file")}, ${size(s.bytes)}</li>`).join("")}</ul>
        ${sum.skipped.some((s) => /music/.test(s.why)) ? `<p class="stamp">To take your music too,
          copy <b>chords/music</b> from NeuroNet's data folder, and the <b>Movies</b> folder
          from NeuroNet's own, onto the new computer in the same places.</p>` : ""}
      </div>` : ""}`;
  }

  /* ---- export -------------------------------------------------------------- */

  async function startExport() {
    const p1 = host ? host.querySelector("#tx-pass").value : "";
    const p2 = host ? host.querySelector("#tx-pass2").value : "";
    if (p1 !== p2) { toast("The two passwords aren't the same.", "error"); return; }
    if (p1 && p1.length < 6) { toast("Make the password at least 6 characters.", "error"); return; }
    const r = await call("data_export_start", [p1], "Starting the export");
    if (!r || r.cancelled) return;
    if (r.error) { toast(r.error, "error"); return; }
    follow("export");
  }

  /* ---- import --------------------------------------------------------------- */

  async function pickImport() {
    const r = await call("data_import_pick", [], "Opening the export");
    if (!r || r.cancelled) return;
    if (r.error) { toast(r.error, "error"); return; }
    if (r.locked) { askPassword(r.path, ""); return; }
    confirmImport(r, "");
  }

  /* A locked (.nnx) export: its password shows what's in it -- checked
     without unlocking the whole file -- and then the same question as a
     plain one. A wrong password asks again. */
  function askPassword(path, said) {
    const d = SS.shared.openDlg("This export is locked", `
      <p>Type the password it was exported with.</p>
      ${said ? `<p class="tx-bad">${esc(said)}</p>` : ""}
      <input class="input" type="password" id="tx-open-pass" placeholder="Password" style="width:100%">`);
    const field = d.body.querySelector("#tx-open-pass");
    const go = async () => {
      const pw = field.value;
      d.close();
      const r = await call("data_import_peek", [path, pw], "Checking the password");
      if (!r || r.error) { askPassword(path, (r && r.error) || "That didn't work."); return; }
      confirmImport(r, pw);
    };
    field.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Open", "btn-save", go);
    setTimeout(() => field.focus(), 50);
  }

  function confirmImport(r, password) {
    const m = r.manifest;
    const when = m.created ? new Date(m.created).toLocaleString() : "an unknown date";
    const d = SS.shared.openDlg("Import this export?", `
      <p>Made on <b>${esc(m.from || "another computer")}</b>, ${esc(when)}:
        ${plural(m.files || 0, "file")}, ${size(m.bytes)}.</p>
      <table class="tx-table tx-small">
        <thead><tr><th>What</th><th>Goes to, on this computer</th></tr></thead>
        <tbody>${(r.targets || []).map((t) => `<tr><td>${esc(t.label)}</td>
          <td class="tx-path" title="${esc(t.to)}">${t.to ? esc(t.to) : "<i>nowhere here — left out</i>"}</td></tr>`).join("")}</tbody>
      </table>
      <p class="stamp">Files in the export replace the ones here with the same name; nothing
        here is deleted, so your music and films stay as they are. Anything replaced is kept
        first, in <b>import-backups</b> in NeuroNet's data folder.</p>
      ${r.locked ? `<p class="stamp">Locked with a password: it's unlocked into NeuroNet's data
        folder while importing, and that copy is removed afterwards.</p>` : ""}
      <p class="stamp">If it brings a desktop set-up — the dock, desktop board, photo frame and
        theme — that's put in place too; this computer's own settings are kept beside them.</p>
      <p class="stamp">NeuroNet reloads when it's finished.</p>`, true);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Import", "btn-save", async () => {
      d.close();
      const s = await call("data_import_start", [r.path, password || ""], "Starting the import");
      if (!s || s.error) { toast((s && s.error) || "The import didn't start.", "error"); return; }
      follow("import");
    });
  }

  /* ---- progress, for either --------------------------------------------------- */

  function follow(kind) {
    clearInterval(poll);
    const box = host && host.querySelector(`#tx-${kind}-status`);
    const buttons = host ? [...host.querySelectorAll("#tx-export, #tx-import")] : [];
    buttons.forEach((b) => { b.disabled = true; });
    const tick = async () => {
      const st = await call("data_transfer_status", [], "");
      const live = host && host.querySelector(`#tx-${kind}-status`);
      if (!st || st.kind !== kind) return;
      if (live) {
        live.hidden = false;
        if (st.state === "running") {
          const pct = Math.round((st.fraction || 0) * 100);
          live.innerHTML = `<div class="tx-bar"><span style="width:${pct}%"></span></div>
            <p class="stamp">${kind === "export" ? "Exporting" : "Importing"}
              ${st.total ? `${st.done.toLocaleString()} of ${st.total.toLocaleString()} files · ${pct}%` : "…"}</p>`;
        }
      }
      if (st.state === "running") return;
      clearInterval(poll);
      buttons.forEach((b) => { b.disabled = false; });
      const res = st.result || {};
      if (st.state === "error") {
        if (live) live.innerHTML = `<p class="tx-bad">${esc(res.error || "It didn't finish.")}</p>`;
        toast(res.error || "It didn't finish.", "error");
        return;
      }
      if (kind === "export") {
        if (live) live.innerHTML = `<p class="tx-good">Saved: <b>${esc(res.path)}</b> —
          ${plural(res.files, "file")}, ${size(res.bytes)}.</p>`;
        toast("Export saved.", "good");
      } else {
        if (live) live.innerHTML = `<p class="tx-good">Imported ${plural(res.written, "file")}${
          res.same ? ` (${res.same} already here, unchanged)` : ""}${
          res.replaced ? `, ${res.replaced} replacing ones here (kept in ${esc(res.backup)})` : ""}.
          ${res.refused && res.refused.length ? `<br>${res.refused.length} left out as unsafe.` : ""}
          ${res.desktop && res.desktop.length ? `<br>Desktop: ${esc(res.desktop.join(", "))}.` : ""}
          Reloading…</p>`;
        toast("Imported. Reloading NeuroNet…", "good");
        setTimeout(() => SS.Transfer._reload(), 1800);
      }
    };
    if (box) box.hidden = false;
    tick();
    poll = setInterval(tick, 500);
  }

  /* The welcome's "Bring my NeuroNet across" (ui/welcome): the same import,
     started from this page, so there's one way it's done. */
  SS.Transfer = {render, startImport: pickImport, _reload: () => location.reload(), _test: {size}};
})();
