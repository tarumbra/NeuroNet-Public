/* ==========================================================================
   MONEY — bills, income, goals. Merged in from Cashbox.
   ==========================================================================
   MOVED, NOT REWRITTEN. Everything below the shell was already correct
   and is now covered by test/test_money_contract.js, which was written
   against the ORIGINAL Cashbox and passed there before this file
   existed. That ordering is the point: a test that has only ever run
   against the new code proves nothing about whether the port changed
   behaviour.

   THE FROZEN CONTRACT. dueDates / buildPeriod / totals are verified
   against an original Python implementation across 27 date
   combinations. Every screen here consumes them. Do not re-derive them;
   if you must change them, the contract tests come first.

   AND THE REASON THEY USE {y, m, d} RATHER THAN Date: no DST surprises.
   Writing the contract test I reintroduced that very bug by subtracting
   two local Date objects across Melbourne's DST change — 14 days came
   out as 14 days and an hour. The app is right to avoid them.

   WHAT CHANGED IN THE MOVE: the module hangs off CP.Money rather than
   owning the window, and its shell services (toast, confirm, dialogs,
   store) come from crux instead of its own copies.
   ========================================================================== */
"use strict";

/* Money reads and writes KinCrux's own budget file through the kc_* calls --
   the merged app namespaces them so they cannot collide with its own. */
(function () {
  /* ------------------------------------------------------- the bridge ---
     Money keeps its OWN data file. That is deliberate and follows the
     plan: separate data per domain, so a bad write to the budget cannot
     touch the photo library, and each module keeps the storage shape
     that suits it.

     What it does NOT keep is its own shell. Cashbox had its own toast,
     confirm, dialog stack and veil handling — all four now come from
     crux, which carries the same three bug fixes they did and only has
     to be fixed once. The CC alias below means none of the several
     hundred call sites below had to change. */
  const S = window.CP.shared;

  const CC = {
    toast: (msg, kind = "ok") => S.toast(msg, kind === "ok" ? "good" : kind),
    confirm: (opts) => S.confirm(opts),
    Store: {
      async getData() {
        const res = await window.CP.Store.call(
          "kc_get_money", [], "The money module");
        return (res && !res.error) ? res : {
          templates: [], oneoffs: [], payments: {}, goals: [],
          calc: {bills: [], income: []},
          spendingLog: {periodStart: "", entries: []},
        };
      },
      saveData: (d) => window.CP.Store.call("kc_save_money", [d], "Saving"),
      getPrefs: () => window.CP.Store.getPrefs(),
      setPrefs: (p) => window.CP.Store.setPrefs(p),
      openPrintDocument: (html, kind) =>
        window.CP.Store.call("open_print_document", [html, kind || null], "Printing"),
      /* Cam: "assign the provided logo to all prints and exports from Main
         Section Money." Built by the app's own letterhead so the logo lives
         in ONE place -- change icons/cashbox.png and every Money printout
         changes with it. */
      printHeader: (title, opts) =>
        window.CP.Store.call("print_header", [title, opts], "The letterhead"),
      /* Cashbox imported from Cam's Collective; inside KinCrux that
         route is gone, so these answer honestly rather than throwing. */
      pickImportFile: async () => ({cancelled: true}),
      readImportFile: async () => ({error: "Importing runs from Settings now."}),
    },
  };

  const openDlg = (title, body, wide) => S.openDlg(title, body, wide);
  const promptText = (title, label, initial) =>
    S.promptText(title, label, initial);

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (s) => esc(s).replace(/"/g, "&quot;");

const CYCLES = ["Weekly", "Fortnightly", "Monthly", "One-off"];
const KINDS = ["Bill", "Income"];
const CATEGORIES = ["Housing", "Utilities", "Food", "Transport",
                    "Insurance", "Health", "Subscriptions", "Debt",
                    "Study", "Fun", "Other"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                  "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November",
                "December"];

/* ------------------------------------------------------- date helpers */
/* Dates are {y, m, d} with m 1-12 — no Date objects, no DST surprises,
   behaviour matches Python's datetime.date exactly. (unchanged) */
const D = (y, m, d) => ({y, m, d});
const iso = (dt) => `${dt.y}-${String(dt.m).padStart(2, "0")}-` +
                    `${String(dt.d).padStart(2, "0")}`;
const fromISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const dt = D(+m[1], +m[2], +m[3]);
  return (dt.m >= 1 && dt.m <= 12 && dt.d >= 1
          && dt.d <= daysInMonth(dt.y, dt.m)) ? dt : null;
};
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const cmp = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;
const todayD = () => {
  const n = new Date();
  return D(n.getFullYear(), n.getMonth() + 1, n.getDate());
};
const weekday = (dt) => (new Date(dt.y, dt.m - 1, dt.d).getDay() + 6) % 7;
const addDays = (dt, n) => {
  const js = new Date(dt.y, dt.m - 1, dt.d + n);
  return D(js.getFullYear(), js.getMonth() + 1, js.getDate());
};
const monthStart = (dt) => D(dt.y, dt.m, 1);
const monthEnd = (dt) => D(dt.y, dt.m, daysInMonth(dt.y, dt.m));
const addMonths = (dt, n) => {
  const m0 = dt.m - 1 + n;
  const y = dt.y + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12 + 1;
  return D(y, m, Math.min(dt.d, daysInMonth(y, m)));
};
/* fortnight math (unchanged) — a fixed Monday anchors which pairs of
   weeks count as one fortnight, so "this fortnight" means the same
   thing every time the app opens. */
const FORTNIGHT_EPOCH = D(2025, 1, 6);
const fortnightStart = (dt) => {
  let mon = dt;
  while (weekday(mon) !== 0) mon = addDays(mon, -1);
  const daysSince = Math.round((new Date(mon.y, mon.m - 1, mon.d)
    - new Date(FORTNIGHT_EPOCH.y, FORTNIGHT_EPOCH.m - 1, FORTNIGHT_EPOCH.d))
    / 86400000);
  const phase = (((daysSince / 7) % 2) + 2) % 2;
  return phase !== 0 ? addDays(mon, -7) : mon;
};
const fortnightEnd = (dt) => addDays(fortnightStart(dt), 13);
const addFortnights = (dt, n) => addDays(dt, n * 14);
const fmtFortnightLabel = (start, end) => {
  const s = `${start.d} ${MONTHS[start.m - 1].slice(0, 3)}`;
  const e = `${end.d} ${MONTHS[end.m - 1].slice(0, 3)}`;
  return start.y === end.y ? `${s} \u2013 ${e} ${end.y}`
    : `${s} ${start.y} \u2013 ${e} ${end.y}`;
};
/* DD-MM-YY display/entry format (unchanged) — storage stays ISO
   throughout; iso()/fromISO() above are untouched. */
const fmtDDMMYY = (dt) => `${String(dt.d).padStart(2, "0")}-` +
  `${String(dt.m).padStart(2, "0")}-${String(dt.y % 100).padStart(2, "0")}`;
const fromDDMMYY = (s) => {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const yy = +m[3];
  const dt = D(yy < 70 ? 2000 + yy : 1900 + yy, +m[2], +m[1]);
  return (dt.m >= 1 && dt.m <= 12 && dt.d >= 1
          && dt.d <= daysInMonth(dt.y, dt.m)) ? dt : null;
};
const fmtShort = (dt) => {
  const js = new Date(dt.y, dt.m - 1, dt.d);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    [js.getDay()]} ${fmtDDMMYY(dt)}`;
};

/* ------------------------------------------------------ money helpers */
const money = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "$0.00";
  const neg = n < 0;
  const s = Math.abs(n).toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${s}`;
};
const parseMoney = (text) => {
  if (text === null || text === undefined) return null;
  const cleaned = String(text).replace(/\$/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const v = parseFloat(cleaned);
  return isNaN(v) ? null : Math.round(v * 100) / 100;
};

/* --------------------------------------- THE GENERATOR (python parity) */
/* dueDates/buildPeriod/totals are the exact "frozen contract" from
   Cam's Collective's own counting.js — verified against the original
   Python implementation, 27 combos. Unchanged, on purpose: a facelift
   is never a reason to re-derive logic that already works. */
function dueDates(template, start, end) {
  const cycle = template.cycle || "Monthly";
  const anchor = template.anchor ?? "";
  const out = [];
  const sinceD = fromISO(template.since || "");
  const after = (list) =>
    sinceD ? list.filter((x) => cmp(sinceD, x) <= 0) : list;

  if (cycle === "One-off") {
    const d = fromISO(anchor);
    if (!d) return [];
    return after((cmp(start, d) <= 0 && cmp(d, end) <= 0) ? [d] : []);
  }

  if (cycle === "Weekly" || cycle === "Fortnightly") {
    let target = WEEKDAYS.indexOf(anchor);
    if (target < 0) target = 0;
    const step = cycle === "Weekly" ? 7 : 14;
    let base = template.seed ? fromISO(template.seed) : null;
    if (base === null && sinceD) {
      base = sinceD;
      target = weekday(sinceD);
    }
    if (base === null) {
      base = start;
      while (weekday(base) !== target) base = addDays(base, 1);
    }
    while (cmp(base, start) > 0) base = addDays(base, -step);
    let d = base;
    while (cmp(d, start) < 0) d = addDays(d, step);
    while (cmp(d, end) <= 0) {
      out.push(d);
      d = addDays(d, step);
    }
    return after(out);
  }

  // Monthly
  let day = parseInt(anchor, 10);
  if (isNaN(day)) day = 1;
  day = Math.max(1, Math.min(31, day));
  let d = monthStart(start);
  while (cmp(d, end) <= 0) {
    const last = daysInMonth(d.y, d.m);
    const candidate = D(d.y, d.m, Math.min(day, last));
    if (cmp(start, candidate) <= 0 && cmp(candidate, end) <= 0) {
      out.push(candidate);
    }
    d = addMonths(monthStart(d), 1);
  }
  return after(out);
}

const payKey = (id, dt) => `${id}|${iso(dt)}`;

function buildPeriod(data, start, end) {
  const rows = [];
  for (const t of data.templates) {
    if (t.active === false) continue;
    for (const d of dueDates(t, start, end)) {
      const rec = data.payments[payKey(t.id, d)] || {};
      rows.push({key: payKey(t.id, d), source: "template", id: t.id,
                 name: t.name || "?", kind: t.kind || "Bill",
                 category: t.category || "Other",
                 amount: parseFloat(rec.amount ?? t.amount ?? 0) || 0,
                 date: d, paid: !!rec.paid, notes: t.notes || "",
                 cycle: t.cycle || "Monthly"});
    }
  }
  for (const o of data.oneoffs) {
    const d = fromISO(o.date);
    if (!d || cmp(start, d) > 0 || cmp(d, end) > 0) continue;
    const key = `one|${o.id}`;
    const rec = data.payments[key] || {};
    rows.push({key, source: "oneoff", id: o.id, name: o.name || "?",
               kind: o.kind || "Bill", category: o.category || "Other",
               amount: parseFloat(o.amount ?? 0) || 0, date: d,
               paid: !!rec.paid, notes: o.notes || "", cycle: "One-off"});
  }
  rows.sort((a, b) => cmp(a.date, b.date)
                      || (a.name || "").localeCompare(b.name || ""));
  return rows;
}

function totals(rows) {
  const sum = (f) => rows.filter(f).reduce((s, r) => s + r.amount, 0);
  const bills = sum((r) => r.kind === "Bill");
  const income = sum((r) => r.kind === "Income");
  const paid = sum((r) => r.kind === "Bill" && r.paid);
  return {bills, income, paid, outstanding: bills - paid,
          left: income - bills};
}

const newId = (prefix, existing) => {
  const used = new Set(existing.map((x) => x.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
};

/** Ids for templates and one-offs, which is a harder job than newId's.

    THE BUG THIS EXISTS TO PREVENT. payments is keyed "<id>|<date>" and
    deliberately outlives the record it belongs to — the delete confirm
    says so: "Past payments you've ticked off are kept." newId hands out
    the lowest number not currently in use, so deleting a record frees
    its id for the next one created, which then inherits every payment
    the deleted one left behind: a brand new bill showing up already
    ticked off, at the wrong amount.

    That was previously unreachable for one-offs because there was no
    way to delete one. Adding delete makes it reachable, so it is closed
    here rather than left as a trap: an id still referenced anywhere in
    payments is treated as taken, even if no record holds it.

    No migration needed — this only affects ids handed out from now on,
    and existing records keep theirs. */
function newRecordId(prefix, existing) {
  const used = new Set(existing.map((x) => x.id));
  for (const key of Object.keys(data.payments || {})) {
    const bar = key.indexOf("|");
    if (bar < 0) continue;
    const head = key.slice(0, bar);
    used.add(head === "one" ? key.slice(bar + 1) : head);
  }
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

/* ------------------------------------------------------------- state */
let data = {templates: [], oneoffs: [], payments: {}, goals: [],
  calc: {bills: [], income: []}, spendingLog: {periodStart: "", entries: []}};
let sub = "dashboard";
let viewDate = monthStart(todayD());
let fnViewDate = fortnightStart(todayD());
let rowSel = -1;
let tplSel = -1;

/* ---------------------------------------------------------- cash books ---
   Cam (2026-10-11): "i want to be able to have seperate cash books. So my main one and then another one say a
   hypothetical one set up. Then i should be able to compare them against each other as well. With differences in
   incomes, bills, left over money etc."

   The file is the MAIN cash book, exactly as it always was (its budget at the top level), plus `cashbooks`: the
   others, each a whole budget of its own. `data` is the one being looked at -- every screen below reads and writes
   `data` as before, untouched -- and `file` is what's saved. Which one is open is a preference, per computer. */
let file = data;
let bookId = "main";
const cashbooksOf = () => (Array.isArray(file.cashbooks) ? file.cashbooks : (file.cashbooks = []));
const blankBudget = () => ({templates: [], oneoffs: [], payments: {}, goals: [],
  calc: {bills: [], income: []}, spendingLog: {periodStart: "", entries: []}, books: []});
function bookDataOf(id) {
  if (id === "main") return file;
  const b = cashbooksOf().find((x) => x.id === id);
  return b ? b.data : null;
}
function bookNameOf(id) {
  if (id === "main") return file.mainName || "Main";
  const b = cashbooksOf().find((x) => x.id === id);
  return b ? b.name : "";
}
function openBook(id) {
  const d = bookDataOf(id);
  bookId = d ? id : "main";
  data = d || file;
  data.goals.forEach(normalizeGoal);
}
/** A whole budget replacing the open book's (an import), keeping the other books and the printed ones. */
function replaceOpenBook(newData) {
  if (bookId === "main") {
    newData.cashbooks = cashbooksOf(); newData.books = Array.isArray(file.books) ? file.books : [];
    file = newData; data = file;
  } else {
    const b = cashbooksOf().find((x) => x.id === bookId);
    b.data = newData; data = newData;
  }
}

async function loadAll() {
  file = await CC.Store.getData();
  cashbooksOf();
  let want = bookId;
  try { const p = await CC.Store.getPrefs(); if (p && p.moneyCashbook) want = p.moneyCashbook; } catch (e) { /* the main book */ }
  openBook(want);
  if (ensureCurrentSpendingLog()) await save();
}

const save = () => {
  if (bookId === "main" && data !== file) { data.cashbooks = cashbooksOf(); file = data; }   // (a test's _setData)
  return CC.Store.saveData(file);
};

/* ================================================================ SHELL */
const NAV = [
  ["dashboard", "Dashboard", "home"],
  ["period", "This Month", "cal"], ["fortnight", "This Fortnight", "clock"],
  ["templates", "Recurring", "repeat"], ["goals", "Savings", "target"],
  ["calc", "Calculation", "calc"], ["compare", "Compare", "scale"], ["books", "Books", "book"],
];
const NAV_ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>' +
        '<path d="M9 20v-6h6v6"/>',
  cal: '<path d="M3 9h18M8 3v4M16 3v4"/><rect x="3" y="5" width="18" ' +
       'height="16" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/>' +
          '<path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>' +
          '<circle cx="12" cy="12" r="1"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/>' +
        '<path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  scale: '<path d="M12 3v18M5 21h14M6 7h12"/><path d="M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/>' +
        '<path d="M8 6h8M8 11h1M11.5 11h1M15 11h1M8 15h1M11.5 15h1M15 15h1' +
        'M8 19h1M11.5 19h1M15 19h1"/>',
};

function renderNav() {
  /* Cashbox drew its own sidebar. KinCrux draws one for every module,
     so this is skipped rather than deleted — keeping the function means
     the module still runs standalone if it is ever pulled back out. */
  const nav = document.getElementById("cb-nav");
  if (!nav) return;
  nav.innerHTML = NAV.map(([id, label, icon]) => `
    <button class="cb-nav-item ${id === sub ? "on" : ""}" data-sub="${id}">
      <span class="cb-nav-icon"><svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">${NAV_ICON[icon]}</svg>
      </span>${label}
    </button>`).join("");
  nav.querySelectorAll(".cb-nav-item").forEach((b) => {
    b.addEventListener("click", () => {
      sub = b.dataset.sub;
      CC.Store.setPrefs({sub});
      render();
    });
  });
}

function render() {
  /* Cashbox owned the whole window and rendered into its own chrome.
     Inside KinCrux it is handed a pane, so the sidebar and title come
     from the host and the missing elements are simply skipped rather
     than throwing. */
  document.querySelectorAll(".cb-nav-item").forEach((b) =>
    b.classList.toggle("on", b.dataset.sub === sub));
  const active = NAV.find(([id]) => id === sub) || NAV[0];
  const titleEl = document.getElementById("cb-topbar-title");
  if (titleEl) titleEl.textContent = active[1];
  const page = document.getElementById("cb-content");
  if (!page) return;
  ({dashboard: renderDashboard, period: renderPeriod, fortnight: renderFortnight,
    templates: renderTemplates, goals: renderGoals,
    calc: renderCalculation, compare: renderCompare, books: renderBooks})[sub](page);
  renderBookBar();
}

/* ================================================================= DASHBOARD */
/** Cam: "Dashboard - which will show an overview with what bills are
    due that week, and upcomming (preset for a week), a piggy bank
    when you add money towards a saving goal it is represented in the
    piggy bank that fills up. A spot which shows money left over that
    fortnight a way we can use a - button and remove what we spend
    from it, so we can track at a glance what we have left when
    making spending decisions."

    The leftover tracker is deliberately its OWN running total, not
    the Savings Guide's own currentPeriodLeftover() reused directly —
    that number is "income minus bills this period," a constant for
    the period. This one needs to go DOWN in real time as Cam spends
    against it during the fortnight, which means it needs its own
    ledger (spendingLog) layered on top, the same deposit/withdrawal-
    style pattern the Savings goals already use. It resets itself
    automatically the moment a new fortnight begins — checked once at
    load time (loadAll()), not scattered through every render. */

function ensureCurrentSpendingLog() {
  const key = iso(fortnightStart(todayD()));
  if (!data.spendingLog || data.spendingLog.periodStart !== key) {
    data.spendingLog = {periodStart: key, entries: []};
    return true;
  }
  return false;
}

function fortnightRemaining() {
  ensureCurrentSpendingLog();
  const leftover = currentPeriodLeftover("fortnight");
  const spent = data.spendingLog.entries.reduce((s, e) => s + e.amount, 0);
  return Math.round((leftover - spent) * 100) / 100;
}

function spendDialog() {
  const d = openDlg("Log a spend", `
    <label class="dlg-label" style="margin-top:0">Amount</label>
    <input class="input" id="sp-amount" style="width:160px" placeholder="20">
    <label class="dlg-label">What was it? (optional)</label>
    <input class="input" id="sp-note" style="width:100%" placeholder="e.g. coffee">`);
  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Log spend", "btn-danger", async () => {
    const amount = parseMoney(d.body.querySelector("#sp-amount").value);
    if (amount === null || amount <= 0) {
      CC.toast("Enter a real amount, like 20.", "error");
      return;
    }
    ensureCurrentSpendingLog();
    data.spendingLog.entries.push({id: newId("s", data.spendingLog.entries),
      date: iso(todayD()), amount,
      note: d.body.querySelector("#sp-note").value.trim()});
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#sp-amount").focus();
}

function dashBillRowHtml(r) {
  return `<div class="cb-row" style="justify-content:space-between;
    padding:7px 0;border-bottom:1px solid var(--line)">
    <span>${esc(r.name)}</span>
    <span class="stamp">${fmtShort(r.date)}</span>
    <span class="money-down"><b>${money(r.amount)}</b></span>
  </div>`;
}

function renderDashboard(page) {
  const today = todayD();
  const dueThisWeek = buildPeriod(data, today, addDays(today, 6))
    .filter((r) => r.kind === "Bill");
  const upcoming = buildPeriod(data, addDays(today, 7), addDays(today, 13))
    .filter((r) => r.kind === "Bill");
  const remaining = fortnightRemaining();
  const spendEntries = [...data.spendingLog.entries].sort((a, b) =>
    cmp(fromISO(b.date) || today, fromISO(a.date) || today));

  page.innerHTML = `
    <p class="cb-page-sub">Everything worth a glance, in one place.</p>

    <div class="panel" style="padding:var(--sp-3);margin-bottom:14px">
      <h3 style="margin:0 0 10px;font-size:15px">Due This Week</h3>
      ${dueThisWeek.length ? dueThisWeek.map(dashBillRowHtml).join("")
        : `<div class="cb-empty">Nothing due this week.</div>`}
    </div>

    <div class="panel" style="padding:var(--sp-3);margin-bottom:14px">
      <h3 style="margin:0 0 10px;font-size:15px">Upcoming \u2014 Next Week</h3>
      ${upcoming.length ? upcoming.map(dashBillRowHtml).join("")
        : `<div class="cb-empty">Nothing due next week yet.</div>`}
    </div>

    <div class="panel" style="padding:var(--sp-3);margin-bottom:14px">
      <h3 style="margin:0 0 4px;font-size:15px">This Fortnight \u2014 Left to Spend</h3>
      <p class="stamp" style="margin:0 0 8px">Income minus bills this
        fortnight, minus whatever you've logged spending below.</p>
      <p class="${remaining < 0 ? "money-down" : "money-up"}"
         style="font-size:28px;font-weight:700;margin:0 0 12px">${money(remaining)}</p>
      <button class="btn btn-danger" id="db-spend">&minus; Log a spend</button>
      ${spendEntries.length ? `<div class="goal-ledger">
        ${spendEntries.map((e) => `<div class="goal-txn-row">
          <span class="goal-txn-type money-down">&minus;${money(e.amount)}</span>
          <span class="stamp" style="flex:1">${esc(e.note || "")}</span>
          <span class="stamp">${fromISO(e.date) ? fmtShort(fromISO(e.date)) : ""}</span>
          <button class="btn btn-quiet" data-del-spend="${escA(e.id)}"
                  style="padding:2px 8px" title="Remove">&#10006;</button>
        </div>`).join("")}
      </div>` : ""}
    </div>

    ${data.goals.length ? `<div class="panel" style="padding:var(--sp-3)">
      <h3 style="margin:0 0 12px;font-size:15px">Savings Goals</h3>
      <div class="dash-piggy-row">
        ${data.goals.map((g) => {
          const saved = goalSaved(g);
          const pct = g.target ? Math.min(1, Math.max(0, saved / g.target)) : 0;
          return `<div class="dash-piggy-item">
            <div class="piggy-wrap dash-piggy-wrap">${piggyBankSvg(pct, `db-${g.id}`)}</div>
            <div>
              <div style="font-weight:700;font-size:13.5px">${esc(g.name)}</div>
              <div class="stamp">${money(saved)} of ${money(g.target)}
                (${Math.round(pct * 100)}%)</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>` : ""}`;

  page.querySelector("#db-spend").onclick = () => spendDialog();
  page.querySelectorAll("[data-del-spend]").forEach((b) =>
    b.addEventListener("click", async () => {
      data.spendingLog.entries = data.spendingLog.entries
        .filter((e) => e.id !== b.dataset.delSpend);
      await save();
      render();
    }));
}

/* =========================================================== THIS MONTH */
/* renderPeriodPage: shared by This Month and This Fortnight (unchanged
   reasoning from Cam's Collective's own counting.js) — buildPeriod()/
   totals() never cared what date range they were given, so both
   periods share every bit of table/metrics/button behaviour and only
   differ in which range and which navigation callbacks they pass in.
   The "To calendar" button from the original is gone entirely here —
   Cam: "Happy if it doesn't have any of the export or calendar
   features, it should remain standalone" — there is no shell service
   for it to call even if it wanted to. */
function renderPeriodPage(page, opts) {
  const {start, end, label, emptyWhen, onPrev, onNext, onToday} = opts;
  const rows = buildPeriod(data, start, end);
  const t = totals(rows);
  const now = todayD();

  page.innerHTML = `
    <div class="cb-row cb-row-center" style="margin-bottom:14px">
      <button class="btn btn-quiet" id="ct-prev">Prev</button>
      <span class="period-label">${label}</span>
      <button class="btn btn-quiet" id="ct-next">Next</button>
      <button class="btn" id="ct-today">Today</button>
    </div>
    <div class="metric-row" style="margin-bottom:16px">
      ${[["Income", t.income, "up"], ["Bills", t.bills, ""],
         ["Paid", t.paid, "muted"],
         ["Still to pay", t.outstanding, "down"],
         ["Left over", t.left, t.left >= 0 ? "up" : "down"]]
        .map(([mLabel, v, cls]) => `
          <div class="metric-card">
            <span class="metric-label">${mLabel}</span>
            <span class="metric-value money-${cls}">${money(v)}</span>
          </div>`).join("")}
    </div>
    <div class="panel" style="padding:var(--sp-3)">
      <table class="detail-table">
        <tr><th style="width:5%"></th><th style="width:14%">Due</th>
        <th>What</th><th style="width:14%">Category</th>
        <th style="width:12%">Cycle</th>
        <th style="width:13%;text-align:right">Amount</th></tr>
        ${rows.map((r, i) => {
          const overdue = !r.paid && r.kind === "Bill"
            && cmp(r.date, now) < 0;
          return `<tr class="count-row ${i === rowSel ? "row-on" : ""}
            ${r.paid ? "row-paid" : ""} ${overdue ? "row-overdue" : ""}
            ${r.kind === "Income" ? "row-income" : ""}" data-i="${i}">
            <td style="text-align:center">${r.paid ? "\u2713" : ""}</td>
            <td>${fmtShort(r.date)}</td>
            <td>${esc(r.name)}</td>
            <td>${esc(r.category)}</td>
            <td style="text-align:center">${esc(r.cycle)}</td>
            <td style="text-align:right">${r.kind === "Income" ? "+" :
              ""}${money(r.amount)}</td></tr>`;
        }).join("") || `<tr><td colspan="6" class="cb-empty">Nothing due
          ${emptyWhen} \u2014 add a recurring bill or a one-off.
          </td></tr>`}
      </table>
      <div class="cb-form-actions" style="margin-top:var(--sp-3)">
        <button class="btn btn-quiet" id="ct-oneoff">+ One-off</button>
        <button class="btn btn-quiet" id="ct-amount">Change or delete</button>
        <button class="btn btn-save" id="ct-paid">Mark paid / unpaid</button>
      </div>
      <p class="stamp" style="text-align:right;margin-top:10px">Tip:
        double-click a row to tick it off.</p>
    </div>`;

  page.querySelector("#ct-prev").onclick = () => {
    onPrev(); rowSel = -1; render();
  };
  page.querySelector("#ct-next").onclick = () => {
    onNext(); rowSel = -1; render();
  };
  page.querySelector("#ct-today").onclick = () => {
    onToday(); rowSel = -1; render();
  };

  const togglePaid = async (r) => {
    const rec = data.payments[r.key] = data.payments[r.key] || {};
    rec.paid = !r.paid;
    rec.on = rec.paid ? iso(todayD()) : "";
    if (rec.amount === undefined) rec.amount = r.amount;
    await save();
    render();
  };
  page.querySelectorAll(".count-row").forEach((tr) => {
    tr.addEventListener("click", () => {
      rowSel = +tr.dataset.i;
      page.querySelectorAll(".count-row").forEach((x) =>
        x.classList.toggle("row-on", +x.dataset.i === rowSel));
    });
    tr.addEventListener("dblclick", () => togglePaid(rows[+tr.dataset.i]));
  });
  page.querySelector("#ct-paid").onclick = () => {
    if (rowSel < 0 || !rows[rowSel]) {
      CC.toast("Pick a row first.", "error");
      return;
    }
    togglePaid(rows[rowSel]);
  };
  /* v5 \u2014 "Change amount" became "Change or delete", and what it opens
     now depends on what kind of row is selected. The two are genuinely
     different things and conflating them would be worse than the gap
     it fixes:

       a ONE-OFF is a record of its own, so it can be edited in full
       and deleted outright;

       a row from a RECURRING bill is generated, not stored \u2014 there is
       no record to delete, only this month's amount to override. The
       bill itself is edited or paused under Recurring, and the dialog
       says so rather than offering a Delete that would have to either
       do nothing or quietly wipe the whole series. */
  page.querySelector("#ct-amount").onclick = async () => {
    const r = rows[rowSel];
    if (!r) { CC.toast("Pick a row first.", "error"); return; }

    if (r.source === "oneoff") {
      const o = data.oneoffs.find((x) => x.id === r.id);
      if (!o) { CC.toast("That one-off has gone.", "error"); return; }
      oneoffDialog(o);
      return;
    }
    occurrenceDialog(r);
  };
  page.querySelector("#ct-oneoff").onclick = () => oneoffDialog();
}

function renderPeriod(page) {
  const start = monthStart(viewDate);
  const end = monthEnd(viewDate);
  renderPeriodPage(page, {
    start, end,
    label: `${MONTHS[start.m - 1]} ${start.y}`,
    emptyWhen: "this month",
    onPrev: () => { viewDate = addMonths(viewDate, -1); },
    onNext: () => { viewDate = addMonths(viewDate, 1); },
    onToday: () => { viewDate = monthStart(todayD()); },
  });
}

/* ======================================================= THIS FORTNIGHT */
function renderFortnight(page) {
  const start = fortnightStart(fnViewDate);
  const end = fortnightEnd(fnViewDate);
  renderPeriodPage(page, {
    start, end,
    label: fmtFortnightLabel(start, end),
    emptyWhen: "this fortnight",
    onPrev: () => { fnViewDate = addFortnights(fnViewDate, -1); },
    onNext: () => { fnViewDate = addFortnights(fnViewDate, 1); },
    onToday: () => { fnViewDate = fortnightStart(todayD()); },
  });
}

/** One occurrence of a recurring bill. Only the amount for THIS date
    can change here — the row is generated from the template, so there
    is nothing stored to delete. "Use the usual amount" drops the
    override again, which was previously impossible: once a month's
    amount had been changed there was no way back to the default short
    of retyping it and hoping you remembered the right figure. */
function occurrenceDialog(r) {
  const rec = data.payments[r.key] || {};
  const tpl = data.templates.find((t) => t.id === r.id);
  const base = tpl ? (parseFloat(tpl.amount) || 0) : r.amount;
  const overridden = rec.amount !== undefined && rec.amount !== base;

  const d = openDlg(r.name || "Payment", `
    <p class="stamp">${fmtShort(r.date)} · ${esc(r.cycle)}
      ${esc(r.kind)}</p>
    <label class="dlg-label">Amount for this one</label>
    <input class="input" id="oc-amount" style="width:160px"
           value="${escA(Number(r.amount).toFixed(2))}">
    <p class="stamp" style="margin-top:6px">Changes only
      ${fmtShort(r.date)}, not the recurring bill.
      ${overridden ? `The usual amount is ${money(base)}.` : ""}</p>
    <p class="stamp" style="margin-top:14px">This comes from a recurring
      bill, so there's no single entry to delete. To stop it appearing,
      pause or delete it under <b>Recurring</b>.</p>`);

  d.btn("Cancel", "btn-quiet", d.close);
  if (overridden) {
    d.btn("Use the usual amount", "btn-quiet", async () => {
      delete data.payments[r.key].amount;
      await save();
      d.close();
      render();
    });
  }
  d.btn("Go to Recurring", "btn-quiet", () => {
    d.close();
    sub = "templates";
    tplSel = data.templates.findIndex((t) => t.id === r.id);
    CC.Store.setPrefs({sub});
    render();
  });
  d.btn("Save", "btn-save", async () => {
    const v = parseMoney(d.body.querySelector("#oc-amount").value);
    if (v === null) { CC.toast("Enter an amount, like 240.50.", "error"); return; }
    const cell = data.payments[r.key] = data.payments[r.key] || {};
    cell.amount = v;
    if (cell.paid === undefined) cell.paid = r.paid;
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#oc-amount").focus();
  d.body.querySelector("#oc-amount").select();
}

/** Add a one-off, or edit an existing one.

    v5 — Cam: "we need a way to delete one off entries when created. I
    accidently created one and couldnt remove it."

    He was right and it was worse than he described: a one-off could
    not be edited either. Once saved, the only field that could ever be
    changed was the amount, via the period table — so a one-off typed
    with the wrong date, name or category was permanent and wrong
    forever. Passing the record in makes this the edit dialog too,
    which is the same shape templateDialog(existing) already uses. */
function oneoffDialog(existing) {
  const cur = existing || {};
  const isEdit = !!existing;
  const sel = (id, list, chosen) =>
    `<select class="input" id="${id}">${list.map((v) =>
      `<option${v === chosen ? " selected" : ""}>${v}</option>`).join("")}</select>`;

  const d = openDlg(isEdit ? "Edit one-off" : "Add one-off", `
    <p class="stamp">A single bill or payday that isn't part of a
      pattern.</p>
    <label class="dlg-label">Name</label>
    <input class="input" id="oo-name" style="width:100%"
           value="${escA(cur.name || "")}">
    <label class="dlg-label">Kind</label>
    ${sel("oo-kind", KINDS, cur.kind || "Bill")}
    <label class="dlg-label">Amount</label>
    <input class="input" id="oo-amount" style="width:160px"
           value="${cur.amount !== undefined
             ? escA(Number(cur.amount).toFixed(2)) : ""}">
    <label class="dlg-label">Date (DD-MM-YY)</label>
    <input class="input" id="oo-date" style="width:160px"
           value="${fmtDDMMYY(fromISO(cur.date) || todayD())}">
    <label class="dlg-label">Category</label>
    ${sel("oo-cat", CATEGORIES, cur.category || "Other")}
    <label class="dlg-label">Notes</label>
    <input class="input" id="oo-notes" style="width:100%"
           value="${escA(cur.notes || "")}">`);

  d.btn("Cancel", "btn-quiet", d.close);
  if (isEdit) d.btn("Delete", "btn-danger", () => deleteOneoff(existing, d.close));
  d.btn("Save", "btn-save", async () => {
    const name = d.body.querySelector("#oo-name").value.trim();
    if (!name) { CC.toast("Give it a name.", "error"); return; }
    const amt = parseMoney(d.body.querySelector("#oo-amount").value);
    if (amt === null) {
      CC.toast("Enter an amount, like 240.50.", "error");
      return;
    }
    const date = fromDDMMYY(d.body.querySelector("#oo-date").value);
    if (!date) { CC.toast("The date needs to be DD-MM-YY.", "error");
                 return; }
    const fields = {name,
                    kind: d.body.querySelector("#oo-kind").value,
                    amount: amt, date: iso(date),
                    category: d.body.querySelector("#oo-cat").value,
                    notes: d.body.querySelector("#oo-notes").value.trim()};
    if (isEdit) {
      Object.assign(existing, fields);
    } else {
      data.oneoffs.push({id: newRecordId("o", data.oneoffs), ...fields});
    }
    await save();
    d.close();
    rowSel = -1;
    if (sub === "fortnight") fnViewDate = fortnightStart(date);
    else viewDate = monthStart(date);
    render();
  });
  d.body.querySelector("#oo-name").focus();
}

/** Removes a one-off for good, along with the payment record it left
    behind. Dropping that record matters for more than tidiness: it is
    keyed "one|<id>", and without this it would sit in the file waiting
    to attach itself to whichever one-off is given that id next. */
async function deleteOneoff(o, after) {
  const ok = await CC.confirm({
    title: "Delete this one-off?",
    body: `Delete “${o.name || ""}” on `
      + `${fmtShort(fromISO(o.date) || todayD())}?`,
    fine: "It goes completely — this isn't a recurring bill, so "
      + "there's nothing left behind to pause.",
    yes: "Delete"});
  if (!ok) return;
  data.oneoffs = data.oneoffs.filter((x) => x.id !== o.id);
  delete data.payments[`one|${o.id}`];
  rowSel = -1;
  await save();
  if (after) after();
  render();
  CC.toast("One-off deleted.");
}

/* ============================================================ RECURRING */
function whenText(t) {
  const cycle = t.cycle || "Monthly";
  const anchor = t.anchor ?? "";
  if (cycle === "Monthly") {
    let n = parseInt(anchor, 10);
    if (isNaN(n)) n = 1;
    const suffix = (n % 100 >= 11 && n % 100 <= 13) ? "th"
      : {1: "st", 2: "nd", 3: "rd"}[n % 10] || "th";
    return `${n}${suffix} of the month`;
  }
  if (cycle === "Weekly" || cycle === "Fortnightly") {
    return anchor;
  }
  return anchor || "\u2014";
}

function renderTemplates(page) {
  page.innerHTML = `
    <p class="cb-page-sub">Enter it once \u2014 it appears every period.
      Pause instead of deleting if it might come back.</p>
    <div class="panel" style="padding:var(--sp-3)">
      <table class="detail-table">
        <tr><th>Name</th><th style="width:9%">Kind</th>
        <th style="width:12%;text-align:right">Amount</th>
        <th style="width:12%">Cycle</th><th style="width:18%">When</th>
        <th style="width:13%">Category</th>
        <th style="width:9%">Active</th></tr>
        ${data.templates.map((t, i) => `
          <tr class="count-row ${i === tplSel ? "row-on" : ""}
              ${t.active === false ? "row-paid" : ""}
              ${t.kind === "Income" ? "row-income" : ""}" data-i="${i}">
            <td>${esc(t.name || "?")}</td><td>${esc(t.kind || "Bill")}</td>
            <td style="text-align:right">${money(t.amount)}</td>
            <td>${esc(t.cycle || "Monthly")}</td>
            <td>${esc(whenText(t))}</td>
            <td>${esc(t.category || "Other")}</td>
            <td>${t.active === false ? "paused" : "yes"}</td></tr>`)
          .join("") || `<tr><td colspan="7" class="cb-empty">Nothing yet
          \u2014 press + Add recurring.</td></tr>`}
      </table>
      <div class="cb-form-actions" style="margin-top:var(--sp-3)">
        <button class="btn btn-danger" id="tp-del">Delete</button>
        <button class="btn btn-quiet" id="tp-pause">Pause / resume</button>
        <button class="btn btn-quiet" id="tp-edit">Edit</button>
        <button class="btn btn-save" id="tp-add">+ Add recurring</button>
      </div>
    </div>`;
  page.querySelectorAll(".count-row").forEach((tr) =>
    tr.addEventListener("click", () => {
      tplSel = +tr.dataset.i;
      page.querySelectorAll(".count-row").forEach((x) =>
        x.classList.toggle("row-on", +x.dataset.i === tplSel));
    }));
  const sel = () => data.templates[tplSel] || null;
  page.querySelector("#tp-add").onclick = () => templateDialog(null);
  page.querySelector("#tp-edit").onclick = () => {
    const t = sel();
    if (!t) { CC.toast("Pick a row first.", "error"); return; }
    templateDialog(t);
  };
  page.querySelector("#tp-pause").onclick = async () => {
    const t = sel();
    if (!t) { CC.toast("Pick a row first.", "error"); return; }
    t.active = t.active === false;
    await save();
    render();
  };
  page.querySelector("#tp-del").onclick = async () => {
    const t = sel();
    if (!t) { CC.toast("Pick a row first.", "error"); return; }
    const ok = await CC.confirm({title: "Delete recurring?",
      body: `Delete \u201C${t.name || ""}\u201D? Past payments you've ` +
            "ticked off are kept.",
      fine: "If you just want it to stop appearing, use Pause instead.",
      yes: "Delete"});
    if (!ok) return;
    data.templates.splice(data.templates.indexOf(t), 1);
    tplSel = -1;
    await save();
    render();
  };
}

function templateDialog(existing) {
  const cur = existing || {};
  const d = openDlg(existing ? "Edit recurring" : "Add recurring", `
    <p class="stamp">Enter it once \u2014 it appears every period.</p>
    <label class="dlg-label">Name</label>
    <input class="input" id="tp-name" style="width:100%"
           value="${escA(cur.name || "")}">
    <label class="dlg-label">Kind</label>
    <select class="input" id="tp-kind">${KINDS.map((k) =>
      `<option ${k === (cur.kind || "Bill") ? "selected" : ""}>${k}
       </option>`).join("")}</select>
    <label class="dlg-label">Amount</label>
    <input class="input" id="tp-amount" style="width:160px"
           value="${cur.amount !== undefined ?
             escA(parseFloat(cur.amount).toFixed(2)) : ""}">
    <label class="dlg-label">Cycle</label>
    <select class="input" id="tp-cycle">${CYCLES.map((c) =>
      `<option ${c === (cur.cycle || "Monthly") ? "selected" : ""}>${c}
       </option>`).join("")}</select>
    <div id="tp-anchor"></div>
    <label class="dlg-label">Starts (optional) \u2014 DD-MM-YY.
      Nothing falls due before this; for weekly and fortnightly the
      first payment lands ON this date. Handy when a new job's pay
      begins.</label>
    <input class="input" id="tp-since" style="width:160px"
           placeholder="${escA(fmtDDMMYY(todayD()))}"
           value="${escA(fromISO(cur.since || "") ?
             fmtDDMMYY(fromISO(cur.since)) : "")}">
    <label class="dlg-label">Category</label>
    <select class="input" id="tp-cat">${CATEGORIES.map((c) =>
      `<option ${c === (cur.category || "Other") ? "selected" : ""}>${c}
       </option>`).join("")}</select>
    <label class="dlg-label">Notes</label>
    <input class="input" id="tp-notes" style="width:100%"
           value="${escA(cur.notes || "")}">`);

  const anchorBox = d.body.querySelector("#tp-anchor");
  const buildAnchor = () => {
    const cycle = d.body.querySelector("#tp-cycle").value;
    const prev = cur.anchor ?? "";
    if (cycle === "Monthly") {
      anchorBox.innerHTML = `
        <label class="dlg-label">Day of the month (1\u201331; short
          months clamp to their last day)</label>
        <input class="input" id="tp-a" type="number" min="1" max="31"
               style="width:100px" value="${/^\d+$/.test(prev) ?
               escA(prev) : "1"}">`;
    } else if (cycle === "Weekly" || cycle === "Fortnightly") {
      anchorBox.innerHTML = `
        <label class="dlg-label">Which day${cycle === "Fortnightly" ?
          " (alternating weeks stay in phase automatically)" : ""}
          </label>
        <select class="input" id="tp-a">${WEEKDAYS.map((w) =>
          `<option ${w === (WEEKDAYS.includes(prev) ? prev : "Monday") ?
           "selected" : ""}>${w}</option>`).join("")}</select>`;
    } else {
      anchorBox.innerHTML = `
        <label class="dlg-label">Date (DD-MM-YY)</label>
        <input class="input" id="tp-a" style="width:160px"
               value="${escA(fromISO(prev) ? fmtDDMMYY(fromISO(prev))
                 : fmtDDMMYY(todayD()))}">`;
    }
  };
  d.body.querySelector("#tp-cycle").addEventListener("change", buildAnchor);
  buildAnchor();

  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Save", "btn-save", async () => {
    const name = d.body.querySelector("#tp-name").value.trim();
    if (!name) { CC.toast("Give it a name.", "error"); return; }
    const amt = parseMoney(d.body.querySelector("#tp-amount").value);
    if (amt === null) {
      CC.toast("Enter an amount, like 240.50.", "error");
      return;
    }
    const t = existing || {id: newRecordId("t", data.templates), active: true};
    t.name = name;
    t.amount = amt;
    t.kind = d.body.querySelector("#tp-kind").value;
    t.cycle = d.body.querySelector("#tp-cycle").value;
    const rawAnchor = String(d.body.querySelector("#tp-a").value).trim();
    if (t.cycle === "One-off") {
      const anchorDate = fromDDMMYY(rawAnchor);
      if (!anchorDate) {
        CC.toast("The date needs to be DD-MM-YY.", "error");
        return;
      }
      t.anchor = iso(anchorDate);
    } else {
      t.anchor = rawAnchor;
    }
    t.category = d.body.querySelector("#tp-cat").value;
    t.notes = d.body.querySelector("#tp-notes").value.trim();
    const sinceRaw = d.body.querySelector("#tp-since").value.trim();
    let sinceDate = null;
    if (sinceRaw) {
      sinceDate = fromDDMMYY(sinceRaw);
      if (!sinceDate) {
        CC.toast("The start date needs to be DD-MM-YY (or blank).",
                 "error");
        return;
      }
    }
    if (sinceDate) t.since = iso(sinceDate); else delete t.since;
    if (t.cycle === "Fortnightly" && t.since) t.seed = t.since;
    if (t.cycle === "Fortnightly" && !t.seed) {
      const target = WEEKDAYS.includes(t.anchor)
        ? WEEKDAYS.indexOf(t.anchor) : 0;
      let base = todayD();
      while (weekday(base) !== target) base = addDays(base, 1);
      t.seed = iso(base);
    }
    if (t.cycle !== "Fortnightly") delete t.seed;
    if (!existing) data.templates.push(t);
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#tp-name").focus();
}

/* ================================================================ GOALS */
/** Cam: "lets move it towards a more fully featured budgeting app...
    A saving guide feature. Which we can set a goal and set a
    percentage of left over income to save and it will calculate how
    much we have to save from each pay... Alternatively another
    method is it can calculate how much we would have to put away to
    reach a set amount and a set amount of time. All Calculations
    occur of what we have left over and never from the bills."
    Builds on the existing, much simpler Goals feature (just a name/
    target/saved number, one manual "+ Add money" button) rather than
    replacing it outright — same data.goals array, same card layout,
    now with a real calculation engine, a full deposit/withdrawal
    ledger, and a piggy bank fill indicator. */

const fmtLong = (dt) => `${dt.d} ${MONTHS[dt.m - 1]} ${dt.y}`;

function normalizeGoal(g) {
  if (!Array.isArray(g.transactions)) {
    const legacy = Math.round((parseFloat(g.saved || 0) || 0) * 100) / 100;
    g.transactions = legacy > 0 ? [{id: "t1", date: iso(todayD()),
      type: "deposit", amount: legacy, method: "bank",
      note: "Starting balance"}] : [];
  }
  delete g.saved;
  if (g.method !== "percent" && g.method !== "time") g.method = "percent";
  if (g.payFrequency !== "month" && g.payFrequency !== "fortnight") {
    g.payFrequency = "fortnight";
  }
  if (typeof g.percent !== "number" || !(g.percent > 0)) g.percent = 10;
  if (!fromISO(g.targetDate)) g.targetDate = iso(addMonths(todayD(), 6));
  return g;
}

function goalSaved(g) {
  const sum = (g.transactions || []).reduce((s, t) =>
    s + (t.type === "withdrawal" ? -t.amount : t.amount), 0);
  return Math.round(sum * 100) / 100;
}

/** Cam: "All Calculations occur of what we have left over and never
    from the bills." The CURRENT real pay period's actual leftover
    (income minus bills, from the exact same buildPeriod()/totals()
    the Month/Fortnight screens already use) — not a manually-typed
    guess, and deliberately not the separate Calculation screen's own
    marks either, since those are a what-if scratchpad Cam builds up
    by hand, not "this period, for real." */
function currentPeriodLeftover(payFrequency) {
  const today = todayD();
  const start = payFrequency === "month" ? monthStart(today) : fortnightStart(today);
  const end = payFrequency === "month" ? monthEnd(today) : fortnightEnd(today);
  return totals(buildPeriod(data, start, end)).left;
}

function payPeriodsUntil(targetDate, payFrequency) {
  const today = payFrequency === "month" ? monthStart(todayD()) : fortnightStart(todayD());
  const target = fromISO(targetDate);
  if (!target || cmp(target, today) <= 0) return 0;
  const step = payFrequency === "month" ? (d) => addMonths(d, 1) : (d) => addFortnights(d, 1);
  let cursor = today, n = 0;
  while (cmp(cursor, target) < 0) {
    cursor = step(cursor);
    n += 1;
    if (n > 2000) break; // guard against a runaway loop on bad input
  }
  return n;
}

/** The two calculation methods Cam described, both landing on the
    same shape ({saved, remaining, leftover, perPay, paysNeeded}) so
    one card renderer can present either. */
function goalProjection(g) {
  const saved = goalSaved(g);
  const remaining = Math.max(0, Math.round((g.target - saved) * 100) / 100);
  const leftover = currentPeriodLeftover(g.payFrequency);
  if (g.method === "time") {
    const paysNeeded = payPeriodsUntil(g.targetDate, g.payFrequency);
    const perPay = paysNeeded > 0
      ? Math.round((remaining / paysNeeded) * 100) / 100 : remaining;
    return {saved, remaining, leftover, perPay, paysNeeded};
  }
  const perPay = Math.max(0, Math.round(leftover * (g.percent / 100) * 100) / 100);
  const paysNeeded = perPay > 0 ? Math.ceil(remaining / perPay) : null;
  return {saved, remaining, leftover, perPay, paysNeeded};
}

/** A liquid-fill piggy bank — the body+snout are clipped, and a
    plain rect rises inside that clip as pct climbs, the same
    technique as a gauge/thermometer fill. Needs a unique clipPath id
    per instance since multiple goals render on screen at once. */
function piggyBankSvg(pct, uid) {
  const p = Math.max(0, Math.min(1, pct));
  const bodyTop = 30, bodyBottom = 86;
  const fillY = (bodyBottom - (bodyBottom - bodyTop) * p).toFixed(1);
  const clipId = `piggy-clip-${escA(uid)}`;
  const fillClass = p >= 1 ? "piggy-fill-done" : "piggy-fill";
  return `<svg viewBox="0 0 120 100" class="piggy-svg">
    <defs><clipPath id="${clipId}">
      <ellipse cx="55" cy="58" rx="38" ry="28"/>
      <circle cx="95" cy="55" r="13"/>
    </clipPath></defs>
    <g clip-path="url(#${clipId})">
      <rect x="0" y="${fillY}" width="120" height="100" class="${fillClass}"/>
    </g>
    <ellipse cx="55" cy="58" rx="38" ry="28" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <circle cx="95" cy="55" r="13" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <circle cx="99" cy="52" r="1.6" fill="currentColor"/>
    <circle cx="99" cy="58" r="1.6" fill="currentColor"/>
    <path d="M30,34 L19,17 L43,30 Z" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="68" cy="46" r="2.6" fill="currentColor"/>
    <rect x="46" y="27" width="18" height="4.5" rx="2.2" fill="none"
          stroke="currentColor" stroke-width="2.5"/>
    <rect x="30" y="80" width="9" height="15" rx="3" fill="none"
          stroke="currentColor" stroke-width="2.5"/>
    <rect x="75" y="80" width="9" height="15" rx="3" fill="none"
          stroke="currentColor" stroke-width="2.5"/>
    <path d="M17,50 q-9,-4 -7,-14 q3,7 9,7" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

function renderGoals(page) {
  page.innerHTML = `
    <p class="cb-page-sub">What you're putting money aside for \u2014
      calculated off what's actually left over each pay, never off
      the bills.</p>
    <div class="cb-row" style="margin-bottom:14px">
      <button class="btn btn-save" id="gl-add">+ New savings goal</button>
    </div>
    <div id="gl-cards" style="display:flex;flex-direction:column;gap:14px"></div>`;
  page.querySelector("#gl-add").onclick = () => goalDialog(null);
  paintGoalCards(page);
}

function paintGoalCards(page) {
  const cards = page.querySelector("#gl-cards");
  if (!data.goals.length) {
    cards.innerHTML = `<div class="cb-empty">No savings goals yet \u2014
      press + New savings goal.</div>`;
    return;
  }
  cards.innerHTML = data.goals.map((g, i) => goalCardHtml(g, i)).join("");
  wireGoalCards(page);
}

function goalCardHtml(g, i) {
  const saved = goalSaved(g);
  const pct = g.target ? Math.min(1, Math.max(0, saved / g.target)) : 0;
  const done = pct >= 1;
  const proj = goalProjection(g);
  const freqWord = g.payFrequency === "month" ? "month" : "fortnight";
  const txns = [...g.transactions].sort((a, b) =>
    cmp(fromISO(b.date) || todayD(), fromISO(a.date) || todayD()));

  const projectionLine = done ? "Goal reached \u2014 nicely done."
    : g.method === "time"
      ? `Save ${money(proj.perPay)} each ${freqWord} to reach this by
         ${fmtLong(fromISO(g.targetDate))}
         (${proj.paysNeeded} ${freqWord}${proj.paysNeeded === 1 ? "" : "s"} away).`
      : `Saving ${g.percent}% of this ${freqWord}'s leftover
         (${money(proj.leftover)}) \u2192 about ${money(proj.perPay)} per
         ${freqWord}${proj.paysNeeded === null
           ? " \u2014 no progress at that rate while there's nothing left over"
           : `, ${proj.paysNeeded} ${freqWord}${proj.paysNeeded === 1 ? "" : "s"} to go`}.`;

  return `<div class="panel" style="padding:var(--sp-3)" data-goal="${escA(g.id)}">
    <div class="cb-row" style="align-items:flex-start;gap:14px">
      <div class="piggy-wrap">${piggyBankSvg(pct, g.id)}</div>
      <div style="flex:1;min-width:0">
        <div class="cb-row">
          <h3 style="flex:1;margin:0;font-size:15px">${esc(g.name || "?")}</h3>
          <span class="${done ? "money-up" : "stamp"}"><b>${money(saved)}
            &nbsp;of&nbsp;${money(g.target)}</b></span>
        </div>
        <div class="goal-track"><div class="goal-fill ${done ? "goal-done" : ""}"
          style="width:${(pct * 100).toFixed(1)}%"></div></div>
        <div class="stamp" style="margin:2px 0 8px">${Math.round(pct * 100)}%
          of the way there</div>
        <p class="${done ? "money-up" : "stamp"}" style="margin:0 0 10px">
          ${projectionLine}</p>
        <div class="cb-row" style="gap:8px">
          <button class="btn btn-quiet" data-a="deposit" data-i="${i}">+ Deposit</button>
          <button class="btn btn-quiet" data-a="withdraw" data-i="${i}">&minus; Withdraw</button>
          <span style="flex:1"></span>
          <button class="btn btn-quiet" data-a="edit" data-i="${i}">Edit</button>
          <button class="btn btn-danger" data-a="del" data-i="${i}">Delete</button>
        </div>
        ${g.notes ? `<div class="stamp" style="margin-top:6px">${esc(g.notes)}</div>` : ""}
      </div>
    </div>
    ${txns.length ? `<div class="goal-ledger">
      ${txns.map((t) => `<div class="goal-txn-row">
        <span class="goal-txn-type ${t.type === "withdrawal" ? "money-down" : "money-up"}">
          ${t.type === "withdrawal" ? "\u2212" : "+"}${money(t.amount)}</span>
        <span class="stamp" style="flex:1">${esc(t.note || "")}</span>
        <span class="stamp">${t.method === "cash" ? "Cash" : "Bank"}</span>
        <span class="stamp">${fromISO(t.date) ? fmtShort(fromISO(t.date)) : ""}</span>
      </div>`).join("")}
    </div>` : ""}
  </div>`;
}

function wireGoalCards(page) {
  page.querySelectorAll("[data-a]").forEach((b) =>
    b.addEventListener("click", async () => {
      const g = data.goals[+b.dataset.i];
      const act = b.dataset.a;
      if (act === "deposit") {
        depositDialog(g);
      } else if (act === "withdraw") {
        withdrawalDialog(g);
      } else if (act === "edit") {
        goalDialog(g);
      } else if (act === "del") {
        const ok = await CC.confirm({title: "Delete goal?",
          body: `Delete \u201C${g.name || ""}\u201D? This can't be undone.`,
          yes: "Delete"});
        if (!ok) return;
        data.goals.splice(data.goals.indexOf(g), 1);
        await save();
        render();
      }
    }));
}

function depositDialog(g) {
  const d = openDlg(`Add to \u201C${g.name}\u201D`, `
    <label class="dlg-label" style="margin-top:0">Amount</label>
    <input class="input" id="dep-amount" style="width:160px" placeholder="50">
    <label class="dlg-label">Method</label>
    <select class="input" id="dep-method" style="width:160px">
      <option value="bank">Bank</option>
      <option value="cash">Cash</option>
    </select>
    <label class="dlg-label">Note (optional)</label>
    <input class="input" id="dep-note" style="width:100%"
           placeholder="e.g. this fortnight's savings">`);
  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Add deposit", "btn-save", async () => {
    const amount = parseMoney(d.body.querySelector("#dep-amount").value);
    if (amount === null || amount <= 0) {
      CC.toast("Enter a real amount, like 50.", "error");
      return;
    }
    g.transactions.push({id: newId("t", g.transactions), date: iso(todayD()),
      type: "deposit", amount,
      method: d.body.querySelector("#dep-method").value,
      note: d.body.querySelector("#dep-note").value.trim()});
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#dep-amount").focus();
}

function withdrawalDialog(g) {
  const saved = goalSaved(g);
  const d = openDlg(`Withdraw from \u201C${g.name}\u201D`, `
    <p class="stamp" style="margin:0 0 10px">Currently saved: ${money(saved)}</p>
    <label class="dlg-label" style="margin-top:0">Amount</label>
    <input class="input" id="wd-amount" style="width:160px" placeholder="50">
    <label class="dlg-label">Method</label>
    <select class="input" id="wd-method" style="width:160px">
      <option value="bank">Bank</option>
      <option value="cash">Cash</option>
    </select>
    <label class="dlg-label">What's it for? (required)</label>
    <input class="input" id="wd-reason" style="width:100%" placeholder="e.g. car repairs">`);
  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Withdraw", "btn-danger", async () => {
    const amount = parseMoney(d.body.querySelector("#wd-amount").value);
    if (amount === null || amount <= 0) {
      CC.toast("Enter a real amount, like 50.", "error");
      return;
    }
    if (amount > saved) {
      CC.toast(`You've only got ${money(saved)} saved here.`, "error");
      return;
    }
    const reason = d.body.querySelector("#wd-reason").value.trim();
    if (!reason) {
      CC.toast("Say what the withdrawal is for.", "error");
      return;
    }
    g.transactions.push({id: newId("t", g.transactions), date: iso(todayD()),
      type: "withdrawal", amount,
      method: d.body.querySelector("#wd-method").value, note: reason});
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#wd-amount").focus();
}

function goalDialog(existing) {
  const cur = existing || {};
  const method = cur.method || "percent";
  const payFrequency = cur.payFrequency || "fortnight";
  const percent = cur.percent || 10;
  const targetDate = cur.targetDate || iso(addMonths(todayD(), 6));
  const d = openDlg(existing ? "Edit savings goal" : "New savings goal", `
    <label class="dlg-label" style="margin-top:0">Name</label>
    <input class="input" id="gd-name" style="width:100%"
           value="${escA(cur.name || "")}">
    <label class="dlg-label">Target amount</label>
    <input class="input" id="gd-target" style="width:160px"
           value="${cur.target !== undefined ?
             escA(parseFloat(cur.target).toFixed(2)) : ""}"
           placeholder="2000">
    <label class="dlg-label">Pay frequency</label>
    <select class="input" id="gd-freq" style="width:160px">
      <option value="fortnight" ${payFrequency === "fortnight" ? "selected" : ""}
        >Fortnightly</option>
      <option value="month" ${payFrequency === "month" ? "selected" : ""}
        >Monthly</option>
    </select>
    <label class="dlg-label">How do you want to work it out?</label>
    <select class="input" id="gd-method" style="width:100%">
      <option value="percent" ${method === "percent" ? "selected" : ""}
        >Save a percentage of what's left over each pay</option>
      <option value="time" ${method === "time" ? "selected" : ""}
        >Reach it by a set date</option>
    </select>
    <div id="gd-percent-group" style="${method === "percent" ? "" : "display:none"}">
      <label class="dlg-label">Percentage of leftover to save</label>
      <input class="input" id="gd-percent" type="number" min="1" max="100" step="1"
             style="width:160px" value="${escA(percent)}">
    </div>
    <div id="gd-date-group" style="${method === "time" ? "" : "display:none"}">
      <label class="dlg-label">Target date</label>
      <input class="input" id="gd-date" type="date" style="width:160px"
             value="${escA(targetDate)}">
    </div>
    <label class="dlg-label">Notes (optional)</label>
    <input class="input" id="gd-notes" style="width:100%"
           value="${escA(cur.notes || "")}">`);

  d.body.querySelector("#gd-method").addEventListener("change", (e) => {
    const isPercent = e.target.value === "percent";
    d.body.querySelector("#gd-percent-group").style.display = isPercent ? "" : "none";
    d.body.querySelector("#gd-date-group").style.display = isPercent ? "none" : "";
  });

  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Save", "btn-save", async () => {
    const name = d.body.querySelector("#gd-name").value.trim();
    if (!name) { CC.toast("Give the goal a name.", "error"); return; }
    const target = parseMoney(d.body.querySelector("#gd-target").value);
    if (target === null || target <= 0) {
      CC.toast("Enter a target amount, like 2000.", "error");
      return;
    }
    const methodVal = d.body.querySelector("#gd-method").value;
    const g = existing || {id: newId("g", data.goals), transactions: []};
    g.name = name;
    g.target = target;
    g.payFrequency = d.body.querySelector("#gd-freq").value;
    g.method = methodVal;
    if (methodVal === "percent") {
      const pct = parseFloat(d.body.querySelector("#gd-percent").value);
      if (!(pct > 0) || pct > 100) {
        CC.toast("Percentage should be between 1 and 100.", "error");
        return;
      }
      g.percent = pct;
    } else {
      const dt = d.body.querySelector("#gd-date").value;
      if (!fromISO(dt)) { CC.toast("Pick a valid target date.", "error"); return; }
      g.targetDate = dt;
    }
    g.notes = d.body.querySelector("#gd-notes").value.trim();
    if (!existing) data.goals.push(g);
    await save();
    d.close();
    render();
  });
  d.body.querySelector("#gd-name").focus();
}

/* ========================================================= CALCULATION */
/** Cam: "lets add another menu option on the left hand side for
    calculation... click with right mouse for bill and click with
    left for income this way it will dynamically do it on the go and
    not rely on outdated checkboxes... I want it a seamless and easy
    to use feature." Its own page rather than living inside Month/
    Fortnight, and marking IS the calculation now — no separate
    select-then-save step, so there's no intermediate state that can
    go stale. Each mark stores enough (source/id/date, not just a
    snapshot amount) to resolve its CURRENT amount live, every
    render — if a bill's amount changes later, the total reflects
    that automatically rather than showing what it was worth when
    marked. */
let calcViewDate = monthStart(todayD());
let calcFnViewDate = fortnightStart(todayD());
let calcMode = "month";

function resolveMarkAmount(mark) {
  if (mark.source === "oneoff") {
    const o = data.oneoffs.find((x) => x.id === mark.id);
    return o ? (parseFloat(o.amount) || 0) : null;
  }
  const t = data.templates.find((x) => x.id === mark.id);
  if (!t) return null;
  const rec = data.payments[mark.key] || {};
  return parseFloat(rec.amount ?? t.amount ?? 0) || 0;
}

function calcTotals() {
  const resolve = (marks) => marks
    .map((m) => ({...m, amount: resolveMarkAmount(m)}))
    .filter((m) => m.amount !== null);
  const billsResolved = resolve(data.calc.bills);
  const incomeResolved = resolve(data.calc.income);
  const bills = billsResolved.reduce((s, m) => s + m.amount, 0);
  const income = incomeResolved.reduce((s, m) => s + m.amount, 0);
  return {bills, income, net: income - bills, billsResolved, incomeResolved};
}

async function toggleMark(r, kind) {
  const list = kind === "Bill" ? "bills" : "income";
  const other = kind === "Bill" ? "income" : "bills";
  const already = data.calc[list].some((m) => m.key === r.key);
  data.calc[other] = data.calc[other].filter((m) => m.key !== r.key);
  data.calc[list] = data.calc[list].filter((m) => m.key !== r.key);
  if (!already) {
    data.calc[list].push({key: r.key, source: r.source, id: r.id,
      date: iso(r.date), name: r.name});
  }
  await save();
  render();
}

function renderCalculation(page) {
  const start = calcMode === "month" ? monthStart(calcViewDate)
    : fortnightStart(calcFnViewDate);
  const end = calcMode === "month" ? monthEnd(calcViewDate)
    : fortnightEnd(calcFnViewDate);
  const label = calcMode === "month" ? `${MONTHS[start.m - 1]} ${start.y}`
    : fmtFortnightLabel(start, end);
  const rows = buildPeriod(data, start, end);
  const t = calcTotals();
  const markKind = (key) => data.calc.bills.some((m) => m.key === key)
    ? "bill" : data.calc.income.some((m) => m.key === key) ? "income" : "";

  page.innerHTML = `
    <div class="cb-row cb-row-center" style="margin-bottom:10px;gap:6px">
      <button class="btn btn-quiet ${calcMode === "month" ? "on" : ""}"
              id="calc-mode-month">Month</button>
      <button class="btn btn-quiet ${calcMode === "fortnight" ? "on" : ""}"
              id="calc-mode-fortnight">Fortnight</button>
    </div>
    <div class="cb-row cb-row-center" style="margin-bottom:12px">
      <button class="btn btn-quiet" id="ct-prev">Prev</button>
      <span class="period-label">${label}</span>
      <button class="btn btn-quiet" id="ct-next">Next</button>
      <button class="btn" id="ct-today">Today</button>
    </div>
    <p class="stamp calc-hint">
      <span class="calc-legend-swatch calc-legend-income"></span>Left-click
      marks Income &nbsp;&nbsp;
      <span class="calc-legend-swatch calc-legend-bill"></span>Right-click
      marks Bill &nbsp;&nbsp; click the same way again to unmark. Marks
      carry across Month, Fortnight, and other periods \u2014 useful when
      the two don't line up.
    </p>
    <div class="metric-row" style="margin-bottom:16px">
      ${[["Bills", t.bills, ""], ["Income", t.income, "up"],
         ["Net (Income \u2212 Bills)", t.net, t.net >= 0 ? "up" : "down"]]
        .map(([mLabel, v, cls]) => `
          <div class="metric-card">
            <span class="metric-label">${mLabel}</span>
            <span class="metric-value money-${cls}">${money(v)}</span>
          </div>`).join("")}
    </div>
    <div class="panel" style="padding:var(--sp-3)">
      <table class="detail-table">
        <tr><th style="width:14%">Due</th><th>What</th>
        <th style="width:14%">Category</th><th style="width:12%">Cycle</th>
        <th style="width:13%;text-align:right">Amount</th></tr>
        ${rows.map((r, i) => {
          const marked = markKind(r.key);
          return `<tr class="count-row calc-mark-row
            ${marked ? `calc-marked-${marked}` : ""}" data-i="${i}">
            <td>${fmtShort(r.date)}</td>
            <td>${esc(r.name)}${marked ?
              ` <span class="calc-mark-badge calc-mark-badge-${marked}">
                ${marked === "bill" ? "BILL" : "INCOME"}</span>` : ""}</td>
            <td>${esc(r.category)}</td>
            <td style="text-align:center">${esc(r.cycle)}</td>
            <td style="text-align:right">${r.kind === "Income" ? "+" :
              ""}${money(r.amount)}</td></tr>`;
        }).join("") || `<tr><td colspan="5" class="cb-empty">Nothing due
          this ${calcMode} \u2014 add a recurring bill or a one-off.
          </td></tr>`}
      </table>
      ${(t.billsResolved.length || t.incomeResolved.length) ? `
      <div class="cb-row" style="justify-content:flex-end;margin-top:var(--sp-3);gap:8px">
        <button class="btn btn-quiet" id="calc-print">Print</button>
        <button class="btn btn-quiet" id="calc-clear-all">Clear all marks</button>
      </div>` : ""}
    </div>`;

  page.querySelector("#calc-mode-month").onclick = () => {
    calcMode = "month"; render();
  };
  page.querySelector("#calc-mode-fortnight").onclick = () => {
    calcMode = "fortnight"; render();
  };
  page.querySelector("#ct-prev").onclick = () => {
    if (calcMode === "month") calcViewDate = addMonths(calcViewDate, -1);
    else calcFnViewDate = addFortnights(calcFnViewDate, -1);
    render();
  };
  page.querySelector("#ct-next").onclick = () => {
    if (calcMode === "month") calcViewDate = addMonths(calcViewDate, 1);
    else calcFnViewDate = addFortnights(calcFnViewDate, 1);
    render();
  };
  page.querySelector("#ct-today").onclick = () => {
    calcViewDate = monthStart(todayD());
    calcFnViewDate = fortnightStart(todayD());
    render();
  };

  page.querySelectorAll(".calc-mark-row").forEach((tr) => {
    const r = rows[+tr.dataset.i];
    tr.addEventListener("click", () => toggleMark(r, "Income"));
    tr.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      toggleMark(r, "Bill");
    });
  });
  const printBtn = page.querySelector("#calc-print");
  if (printBtn) {
    printBtn.onclick = async () => {
      // the letterhead says what it is; the title block names it (2026-10-05)
      const head = (await cashboxHeader("Money calculation", "")) + SS.PrintHouse.titleBlock("Money calculation",
        "Calculation summary", [["Printed", fmtShort(todayD())]]);
      const result = await CC.Store.openPrintDocument(buildCalcPrintDocument(head), "money-calculation");
      if (result && result.error) CC.toast(result.error, "error");
    };
  }
  const clearBtn = page.querySelector("#calc-clear-all");
  if (clearBtn) {
    clearBtn.onclick = async () => {
      data.calc = {bills: [], income: []};
      await save();
      render();
    };
  }
}

/* ================================================================= PRINT */
/** v2 — Cam: "a print feature where you can select which months or
    fortnights you want to print. This way we have a paper copy that
    can be ticked off when away from the pc."

    Reuses buildPeriod()/totals() completely unchanged — the only
    genuinely new piece is turning "start here, this many in a row"
    into a list of period ranges, since Cam picks a CONTIGUOUS run
    (this month plus the next two, the next four fortnights) rather
    than arbitrary scattered ones, which covers the real use case
    ("a paper copy of what's coming up") without needing a full
    non-contiguous multi-select UI.

    Defaults to whichever mode/period Cam is currently looking at —
    open Print while on This Fortnight and the dialog starts on
    Fortnights, showing the same fortnight already on screen — but
    keeps its own separate state once open, so adjusting it here
    never disturbs viewDate/fnViewDate or what's showing behind the
    dialog. */
function printDialog() {
  /* v2 — Cam: "when printing can i be asked a range for what i want to
     print. Otherwise i have to print page by page and it takes ages."
     The old dialog took a starting period plus a count capped at 6,
     which meant printing a year needed two passes and printing an
     arbitrary span meant counting periods by hand. This is a real
     From -> To range instead: pick both ends, get every period between
     them, one page each. The count cap is gone entirely - the range
     itself decides how many pages there are. */
  let prMode = (sub === "fortnight") ? "fortnight" : "period";
  let prFrom = prMode === "fortnight"
    ? fortnightStart(fnViewDate) : monthStart(viewDate);
  let prTo = prFrom;

  const d = openDlg("Print", `
    <p class="stamp">Pick the range you want \u2014 every period from
      the first to the last gets its own page, ready to tick off by
      hand.</p>
    <label class="dlg-label">Period type</label>
    <div class="cb-row" style="gap:8px">
      <button class="btn" id="pr-month">Months</button>
      <button class="btn" id="pr-fortnight">Fortnights</button>
    </div>
    <label class="dlg-label">From</label>
    <div class="cb-row" style="gap:8px">
      <button class="btn btn-quiet" id="pr-from-prev">Prev</button>
      <span class="period-label" id="pr-from-label"
            style="min-width:170px"></span>
      <button class="btn btn-quiet" id="pr-from-next">Next</button>
    </div>
    <label class="dlg-label">To</label>
    <div class="cb-row" style="gap:8px">
      <button class="btn btn-quiet" id="pr-to-prev">Prev</button>
      <span class="period-label" id="pr-to-label"
            style="min-width:170px"></span>
      <button class="btn btn-quiet" id="pr-to-next">Next</button>
    </div>
    <p class="stamp" id="pr-summary" style="margin-top:12px"></p>`);

  const q = (id) => d.body.querySelector(id);

  /* Every period start from prFrom through prTo inclusive. Returns []
     if the range is backwards, which paintAll() surfaces as a real
     message rather than silently printing nothing. */
  const rangePeriods = () => {
    const out = [];
    if (cmp(prFrom, prTo) > 0) return out;
    let cursor = prFrom;
    /* a hard ceiling purely as a runaway guard - a real range will
       never approach it, but a corrupted date shouldn't be able to
       spin here forever building pages */
    for (let i = 0; i < 600; i++) {
      if (prMode === "period") {
        out.push({start: monthStart(cursor), end: monthEnd(cursor),
          label: `${MONTHS[cursor.m - 1]} ${cursor.y}`});
      } else {
        out.push({start: cursor, end: fortnightEnd(cursor),
          label: fmtFortnightLabel(cursor, fortnightEnd(cursor))});
      }
      if (cmp(cursor, prTo) >= 0) break;
      cursor = prMode === "period" ? addMonths(cursor, 1)
        : addFortnights(cursor, 1);
    }
    return out;
  };

  const labelFor = (dt) => prMode === "period"
    ? `${MONTHS[dt.m - 1]} ${dt.y}`
    : fmtFortnightLabel(dt, fortnightEnd(dt));

  const paintAll = () => {
    q("#pr-month").className =
      "btn " + (prMode === "period" ? "btn-save" : "btn-quiet");
    q("#pr-fortnight").className =
      "btn " + (prMode === "fortnight" ? "btn-save" : "btn-quiet");
    q("#pr-from-label").textContent = labelFor(prFrom);
    q("#pr-to-label").textContent = labelFor(prTo);
    const n = rangePeriods().length;
    const word = prMode === "period" ? "month" : "fortnight";
    q("#pr-summary").textContent = n
      ? `${n} ${word}${n === 1 ? "" : "s"} \u2014 ${n} page${n === 1 ? "" : "s"}.`
      : "That range runs backwards \u2014 set To on or after From.";
  };

  const step = (which, dir) => {
    const move = (dt) => prMode === "period"
      ? addMonths(dt, dir) : addFortnights(dt, dir);
    if (which === "from") {
      prFrom = move(prFrom);
      /* keep To from falling behind From - dragging From past To
         carries To along rather than silently making the range
         invalid */
      if (cmp(prFrom, prTo) > 0) prTo = prFrom;
    } else {
      prTo = move(prTo);
    }
    paintAll();
  };

  const setMode = (m) => {
    if (prMode === m) return;
    prMode = m;
    prFrom = m === "period" ? monthStart(todayD()) : fortnightStart(todayD());
    prTo = prFrom;
    paintAll();
  };

  q("#pr-month").onclick = () => setMode("period");
  q("#pr-fortnight").onclick = () => setMode("fortnight");
  q("#pr-from-prev").onclick = () => step("from", -1);
  q("#pr-from-next").onclick = () => step("from", 1);
  q("#pr-to-prev").onclick = () => step("to", -1);
  q("#pr-to-next").onclick = () => step("to", 1);
  paintAll();

  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Print", "btn-save", async () => {
    const periods = rangePeriods();
    if (!periods.length) {
      CC.toast("Set the To period on or after the From period.", "error");
      return;
    }
    const head = await cashboxHeader("Money sheet",
      periods.length === 1 ? periods[0].label : `${periods.length} periods`);
    const result = await CC.Store.openPrintDocument(
      buildPrintDocument(periods, head), "money-sheet");
    if (result && result.error) {
      CC.toast(result.error, "error");
      return;
    }
    d.close();
  });
}

/** A complete, self-contained HTML document — deliberately NOT using
    shared.css's own dark theme (dark backgrounds waste ink and look
    wrong printed, and this needs to stand on its own once handed to
    a real browser, not inherit anything from the app around it). One
    <section> per period, each starting a fresh printed page via
    page-break-after; a bordered box per row shows an already-ticked
    X for whatever's already marked paid in Cashbox, or stays blank
    for Cam to tick by hand while away from the PC. */
/* Both printed pages open with the Cashbox letterhead. Fetched rather than
   written here: the header is built once, in Python, for every module that
   prints. */
/* The house style every printout shares (print_header.py, via SS.PrintHouse),
   put first in each page's <style> (Cam, 2026-10-05: all printouts "handled in
   this way"); Money's own rules follow it. */
const houseCss = () => (window.SS && SS.PrintHouse && SS.PrintHouse.css) || "";
async function cashboxHeader(title, subtitle) {
  if (window.SS && SS.PrintHouse) await SS.PrintHouse.load();
  try {
    const html = await CC.Store.printHeader(title, {
      subtitle: subtitle || "",
      logo: "cashbox.png",
      name: "cashbox",
    });
    return typeof html === "string" ? html : "";
  } catch (e) {
    return "";           // a page without a letterhead still prints
  }
}

function buildPrintDocument(periods, letterhead) {
  const sections = periods.map((p) => {
    const rows = buildPeriod(data, p.start, p.end);
    const t = totals(rows);
    return `
      <section class="period">
        <h1>${esc(p.label)}</h1>
        <div class="totals"><span><b>Income</b> ${money(t.income)}</span>
          <span><b>Bills</b> ${money(t.bills)}</span><span><b>Already paid</b> ${money(t.paid)}</span>
          <span><b>Still to pay</b> ${money(t.outstanding)}</span><span><b>Left over</b> ${money(t.left)}</span></div>
        <table>
          <tr><th></th><th>Due</th><th>What</th><th>Category</th>
          <th>Cycle</th><th style="text-align:right">Amount</th></tr>
          ${rows.map((r) => `
            <tr>
              <td><span class="box">${r.paid ? "\u2715" : ""}</span></td>
              <td>${fmtShort(r.date)}</td>
              <td>${esc(r.name)}</td>
              <td>${esc(r.category)}</td>
              <td>${esc(r.cycle)}</td>
              <td style="text-align:right">${r.kind === "Income" ?
                "+" : ""}${money(r.amount)}</td>
            </tr>`).join("") || `<tr><td colspan="6" class="empty">
            Nothing due.</td></tr>`}
        </table>
      </section>`;
  }).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cashbox \u2014 print</title>
<style>${houseCss()}
  .hint { font-size: 11px; color: #5d665f; margin: 0 0 14px; }
  .period h1 { font-size: 22px; margin: 6px 0 8px; padding-bottom: 8px; border-bottom: 2px solid #1F2A24; }
  .totals { display: flex; flex-wrap: wrap; gap: 6px 8px; margin: 0 0 12px; }
  .totals span { font-size: 11px; color: #5d665f; background: #f4f6f2; border: 1px solid #d6d9d3;
                 border-radius: 999px; padding: 2px 10px; }
  .totals b { color: #1F2A24; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #33473B; border-radius: 3px;
         text-align: center; line-height: 11px; font-size: 11px; font-weight: bold; color: #2E6B38; }
  .empty { color: #5d665f; padding: 14px 10px; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; }
  .period { page-break-after: always; }
  .period:last-child { page-break-after: auto; }
  @media print { .hint { display: none; } }
</style></head>
<body>
  ${letterhead || ""}
  <p class="hint">Press Ctrl+P (or Cmd+P) to print, or use your
    browser's own Print option. Already-ticked boxes are bills or
    income already marked paid in Cashbox \u2014 the blank ones are
    for you to tick by hand.</p>
  ${sections}
</body></html>`;
}

/** Cam: "a print feature to print out the calculation screen, only
    print the summation and selected bills and income, listed and
    specified what it is." Deliberately NOT the full "everything due
    this period" table renderCalculation shows on screen — only
    what's actually marked, since marks are what Cam built up by
    hand and carry across periods regardless of which month/
    fortnight happens to be in view (calcTotals() already resolves
    the full marked set globally, not scoped to the current view).
    Same light, ink-friendly styling as buildPrintDocument above, for
    visual consistency between Cashbox's two print features rather
    than introducing a second look. */
function buildCalcPrintDocument(letterhead) {
  const t = calcTotals();
  const listRows = (marks, kindLabel) => marks.map((m) => {
    const dt = fromISO(m.date);
    return `
    <tr>
      <td>${dt ? fmtShort(dt) : "\u2014"}</td>
      <td>${esc(m.name)}</td>
      <td style="text-align:right">${kindLabel === "Income" ? "+" : ""}${money(m.amount)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="3" class="empty">None marked.</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cashbox \u2014 calculation</title>
<style>${houseCss()}
  .hint { font-size: 11px; color: #5d665f; margin: 0 0 14px; }
  .sub { font-size: 12px; color: #5d665f; margin: 0 0 14px; }
  .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 6px 0 16px; }
  .totals > div { background: #f4f6f2; border: 1px solid #d6d9d3; border-left: 4px solid #2E6B38;
                  border-radius: 6px; padding: 9px 12px; font-size: 10.5px; color: #5d665f;
                  text-transform: uppercase; letter-spacing: .08em; }
  .totals b { display: block; font-size: 20px; color: #1F2A24; text-transform: none; letter-spacing: 0; }
  .section-h { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
               margin: 22px 0 9px; padding: 1px 0 1px 10px; border-left: 4px solid #2E6B38; }
  .empty { color: #5d665f; padding: 12px 10px; }
  @media print { .hint { display: none; } }
</style></head>
<body>
  ${letterhead || `<h1>Calculation summary</h1>
  <p class="sub">Printed ${fmtShort(todayD())}</p>`}
  <p class="hint">Press Ctrl+P (or Cmd+P) to print, or use your
    browser's own Print option.</p>
  <div class="totals">
    <div>Bills<b>${money(t.bills)}</b></div>
    <div>Income<b>${money(t.income)}</b></div>
    <div>Net (Income \u2212 Bills)<b>${money(t.net)}</b></div>
  </div>

  <div class="section-h">Income \u2014 ${t.incomeResolved.length} marked</div>
  <table>
    <tr><th style="width:16%">Due</th><th>What</th>
    <th style="width:18%;text-align:right">Amount</th></tr>
    ${listRows(t.incomeResolved, "Income")}
  </table>

  <div class="section-h">Bills \u2014 ${t.billsResolved.length} marked</div>
  <table>
    <tr><th style="width:16%">Due</th><th>What</th>
    <th style="width:18%;text-align:right">Amount</th></tr>
    ${listRows(t.billsResolved, "Bill")}
  </table>
</body></html>`;
}


/* ================================================================= BOOKS */
/** Money books (2026-10-02). Cam chose "Add books to Money" for the desktop
    Bookshelf: like Training's books, a book keeps its MAKE-UP (months or
    fortnights From -> To, and whether the Calculation sheet and Savings
    goals go in), not a copy -- so it reads what the budget says today. Its
    pages are Money's own printouts (buildPrintDocument, buildCalcPrintDocument)
    bound behind a cover, each part's styles kept to that part. It reads in
    NeuroNet's reader (SS.Reader, the desktop Bookshelf) and prints. */
const booksOf = () => (Array.isArray(data.books) ? data.books : (data.books = []));

function bookPeriods(b) {
  const mode = b.mode === "fortnight" ? "fortnight" : "period";
  const first = fromISO(b.from), last = fromISO(b.to);
  if (!first || !last || cmp(first, last) > 0) return [];
  const out = [];
  let cursor = mode === "period" ? monthStart(first) : fortnightStart(first);
  for (let i = 0; i < 600; i++) {
    if (mode === "period") {
      out.push({start: cursor, end: monthEnd(cursor), label: `${MONTHS[cursor.m - 1]} ${cursor.y}`});
    } else {
      out.push({start: cursor, end: fortnightEnd(cursor), label: fmtFortnightLabel(cursor, fortnightEnd(cursor))});
    }
    cursor = mode === "period" ? addMonths(cursor, 1) : addFortnights(cursor, 1);
    if (cmp(cursor, last) > 0) break;
  }
  return out;
}

function bookRange(b) {
  const ps = bookPeriods(b);
  if (!ps.length) return "No periods";
  const word = b.mode === "fortnight" ? "fortnight" : "month";
  return ps.length === 1 ? ps[0].label
    : `${ps[0].label} to ${ps[ps.length - 1].label} (${ps.length} ${word}s)`;
}

/* A printout's styles kept to its own part of the book: each top-level rule
   gets the part's class in front; @media blocks are dropped (the book has
   its own). Enough for the two printouts above, which is all it is for. */
function scopeCss(css, scope) {
  const noMedia = css.replace(/@media[^{]*\{([^{}]*\{[^}]*\})*[^}]*\}/g, "");
  return noMedia.replace(/([^{}]+)\{([^}]*)\}/g, (all, sel, body) => {
    const scoped = sel.split(",").map((x) => {
      const t = x.trim();
      if (!t) return "";
      if (t === "body" || t === "html") return scope;
      return `${scope} ${t}`;
    }).filter(Boolean).join(", ");
    return `${scoped} {${body}}`;
  });
}
function partOf(doc, scope) {
  const css = (doc.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
  const body = (doc.match(/<body>([\s\S]*)<\/body>/) || ["", ""])[1]
    .replace(/<p class="hint">[\s\S]*?<\/p>/, "");
  return {css: scopeCss(css, "." + scope), html: `<div class="${scope}">${body}</div>`};
}

function goalsPartHtml() {
  const goals = data.goals || [];
  const rows = goals.map((g) => {
    const saved = goalSaved(g);
    const pct = g.target > 0 ? Math.min(100, Math.round((saved / g.target) * 100)) : 0;
    return `<tr><td>${esc(g.name || "Goal")}</td><td style="text-align:right">${money(saved)}</td>
      <td style="text-align:right">${money(g.target || 0)}</td><td style="text-align:right">${pct}%</td>
      <td>${g.targetDate ? esc(fmtShort(fromISO(g.targetDate))) : "\u2014"}</td></tr>`;
  }).join("") || `<tr><td colspan="5" class="empty">No savings goals yet.</td></tr>`;
  return `<div class="mb-goals"><h1>Savings goals</h1>
    <table><tr><th>Goal</th><th style="text-align:right">Saved</th><th style="text-align:right">Target</th>
    <th style="text-align:right">Done</th><th>By</th></tr>${rows}</table></div>`;
}

async function moneyBookDocument(b) {
  const periods = bookPeriods(b);
  const parts = [];
  if (periods.length) parts.push(["Budget, " + (b.mode === "fortnight" ? "by fortnight" : "by month"),
    partOf(buildPrintDocument(periods, ""), "mb-periods")]);
  if (b.calc) parts.push(["Calculation", partOf(buildCalcPrintDocument(""), "mb-calc")]);
  if (b.goals) parts.push(["Savings goals", {css: "", html: goalsPartHtml()}]);
  const head = await cashboxHeader("Money book", "");
  const cover = `<section class="mb-cover">${head}
    <div class="mb-cover-main"><p class="mb-kicker">Money book</p>
      <h1 class="mb-title">${esc(b.name || "Money book")}</h1>
      <div class="mb-rule"></div>
      <p class="mb-sub">${esc(b.subtitle || bookRange(b))}</p>
      <ol class="mb-list">${parts.map(([t]) => `<li>${esc(t)}</li>`).join("")}</ol>
      <p class="mb-made">Made ${esc(fmtShort(todayD()))} from Money as it stands.</p></div></section>`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${esc(b.name || "Money book")} \u2014 Money</title>
<style>${houseCss()}
  .mb-cover { min-height: 90vh; display: flex; flex-direction: column; page-break-after: always; }
  .mb-cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .mb-kicker { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #2E6B38; margin: 0 0 8px; }
  .mb-title { font-size: 34px; line-height: 1.2; font-weight: 700; margin: 0; color: #1F2A24; }
  .mb-rule { width: 110px; height: 2px; margin: 16px auto; background: #1F2A24; }
  .mb-sub { font-size: 15px; color: #555; margin: 0 0 18px; }
  .mb-list { text-align: left; font-size: 14px; color: #333; }
  .mb-made { font-size: 11px; color: #888; margin-top: 28px; }
  .mb-part { page-break-after: always; }
  .mb-part:last-child { page-break-after: auto; }
  .mb-goals h1 { font-size: 18px; margin: 0 0 12px; }
  .mb-goals .empty { color: #5d665f; }
  ${parts.map(([, p]) => p.css).join("\n")}
</style></head>
<body>
${cover}
${parts.map(([, p]) => `<section class="mb-part">${p.html}</section>`).join("\n")}
</body></html>`;
}

function renderBooks(page) {
  const books = [...booksOf()].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, {numeric: true}));
  page.innerHTML = `
    <div class="cb-page-head">
      <h2 class="page-h">Books</h2>
      <p class="stamp">A book of your budget: months or fortnights, with the
        Calculation sheet and your savings goals if you like. It reads on the
        desktop Bookshelf and prints, always from Money as it stands.</p>
      <button class="btn btn-primary" id="mb-new">+ New book</button>
    </div>
    ${books.length ? `<div class="mb-books">${books.map((b) => `
      <div class="mb-book" data-book="${escA(b.id)}">
        <div class="mb-book-main"><b>${esc(b.name)}</b>
          <span class="stamp">${esc(b.subtitle || bookRange(b))}${b.calc ? " \u00b7 Calculation" : ""}${b.goals ? " \u00b7 Savings" : ""}</span></div>
        <button class="btn btn-quiet" data-mb="read">Read</button>
        <button class="btn btn-quiet" data-mb="print">Print</button>
        <button class="btn btn-quiet" data-mb="edit">Edit</button>
        <button class="btn btn-quiet" data-mb="del">Delete</button>
      </div>`).join("")}</div>`
      : `<p class="cm-empty">No books yet. Make one from a run of months or fortnights.</p>`}`;
  page.querySelector("#mb-new").onclick = () => bookDialog(null);
  page.querySelectorAll("[data-book]").forEach((row) => {
    const b = booksOf().find((x) => x.id === row.dataset.book);
    row.querySelectorAll("[data-mb]").forEach((btn) => btn.onclick = async () => {
      const a = btn.dataset.mb;
      if (a === "read") {
        if (window.SS && SS.Reader) SS.Reader.open("money", b.id);
      } else if (a === "print") {
        const r = await CC.Store.openPrintDocument(await moneyBookDocument(b), "money-book");
        if (r && r.error) CC.toast(r.error, "error");
      } else if (a === "edit") {
        bookDialog(b);
      } else if (a === "del") {
        const yes = await CC.confirm({title: `Delete \u201C${b.name}\u201D?`,
          body: "The book goes; your budget, goals and calculation are untouched.", yes: "Delete"});
        if (!yes) return;
        data.books = booksOf().filter((x) => x.id !== b.id);
        await save();
        renderBooks(page);
      }
    });
  });
}

function bookDialog(existing) {
  const b = existing ? {...existing} : {id: "", name: "", subtitle: "", mode: "period",
    from: iso(monthStart(todayD())), to: iso(monthStart(todayD())), calc: true, goals: true};
  let mode = b.mode === "fortnight" ? "fortnight" : "period";
  let from = fromISO(b.from) || monthStart(todayD());
  let to = fromISO(b.to) || from;
  const d = openDlg(existing ? "Edit book" : "New book", `
    <label class="dlg-label" for="mb-name">Name</label>
    <input class="input" id="mb-name" value="${escA(b.name)}" placeholder="2026 so far">
    <label class="dlg-label" for="mb-sub">Under the title <span class="stamp">(optional)</span></label>
    <input class="input" id="mb-sub" value="${escA(b.subtitle || "")}" placeholder="The months, at a glance">
    <label class="dlg-label">Pages</label>
    <div class="cb-row" style="gap:8px">
      <button class="btn" id="mb-month">Months</button>
      <button class="btn" id="mb-fortnight">Fortnights</button>
    </div>
    <label class="dlg-label">From</label>
    <div class="cb-row" style="gap:8px"><button class="btn btn-quiet" id="mb-from-prev">Prev</button>
      <span class="period-label" id="mb-from" style="min-width:170px"></span>
      <button class="btn btn-quiet" id="mb-from-next">Next</button></div>
    <label class="dlg-label">To</label>
    <div class="cb-row" style="gap:8px"><button class="btn btn-quiet" id="mb-to-prev">Prev</button>
      <span class="period-label" id="mb-to" style="min-width:170px"></span>
      <button class="btn btn-quiet" id="mb-to-next">Next</button></div>
    <label class="cb-row" style="gap:8px;margin-top:12px"><input type="checkbox" id="mb-calc" ${b.calc ? "checked" : ""}>
      The Calculation sheet</label>
    <label class="cb-row" style="gap:8px"><input type="checkbox" id="mb-goals" ${b.goals ? "checked" : ""}>
      Savings goals</label>
    <p class="stamp" id="mb-summary"></p>`);
  const q = (s) => d.body.querySelector(s);
  const label = (dt) => mode === "period" ? `${MONTHS[dt.m - 1]} ${dt.y}` : fmtFortnightLabel(dt, fortnightEnd(dt));
  const paint = () => {
    q("#mb-month").className = "btn " + (mode === "period" ? "btn-save" : "btn-quiet");
    q("#mb-fortnight").className = "btn " + (mode === "fortnight" ? "btn-save" : "btn-quiet");
    q("#mb-from").textContent = label(from);
    q("#mb-to").textContent = label(to);
    q("#mb-summary").textContent = bookRange({mode, from: iso(from), to: iso(to)}) + ".";
  };
  const move = (dt, dir) => (mode === "period" ? addMonths(dt, dir) : addFortnights(dt, dir));
  q("#mb-month").onclick = () => { if (mode !== "period") { mode = "period"; from = monthStart(from); to = monthStart(to); paint(); } };
  q("#mb-fortnight").onclick = () => { if (mode !== "fortnight") { mode = "fortnight"; from = fortnightStart(from); to = fortnightStart(to); paint(); } };
  q("#mb-from-prev").onclick = () => { from = move(from, -1); paint(); };
  q("#mb-from-next").onclick = () => { from = move(from, 1); if (cmp(from, to) > 0) to = from; paint(); };
  q("#mb-to-prev").onclick = () => { to = move(to, -1); if (cmp(to, from) < 0) from = to; paint(); };
  q("#mb-to-next").onclick = () => { to = move(to, 1); paint(); };
  paint();
  d.btn("Cancel", "btn-quiet", d.close);
  d.btn(existing ? "Save" : "Make the book", "btn-save", async () => {
    const name = q("#mb-name").value.trim();
    if (!name) { CC.toast("Give the book a name.", "error"); return; }
    const out = {...b, id: b.id || newRecordId("mb", ["main"].concat(cashbooksOf().map((x) => x.id)).flatMap((o) => (bookDataOf(o) || {}).books || [])), name, subtitle: q("#mb-sub").value.trim(),
      mode, from: iso(from), to: iso(to), calc: q("#mb-calc").checked, goals: q("#mb-goals").checked,
      created: b.created || new Date().toISOString()};
    data.books = booksOf().filter((x) => x.id !== out.id).concat([out]);
    const r = await save();
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    d.close();
    CC.toast(existing ? "Saved." : `\u201C${name}\u201D is on the Bookshelf.`);
    if (sub === "books") render();
  });
  q("#mb-name").focus();
}

/** v1 — Cam: "Yes, import them." A first-run choice, not something
    baked in silently: Cashbox has no way to know where Cam's
    Collective's own counting.json lives on his machine, so pointing
    at it is his own action, via a native picker, whenever he actually
    chooses to (first run, or later from the sidebar's own Import
    button — the same flow either way). isEmpty() gates the automatic
    first-run PROMPT only; the button in the sidebar footer always
    stays available regardless, in case Cam skips it now and wants to
    bring the data over later. */
function isEmpty(d) {
  return !d.templates.length && !d.oneoffs.length && !d.goals.length;
}

function showOnboarding() {
  const page = document.getElementById("cb-content");
  if (!page) return;
  const ttl = document.getElementById("cb-topbar-title");
  if (ttl) ttl.textContent = "Welcome";
  page.innerHTML = `
    <div class="cb-onboard">
      <h2>Welcome to Cashbox</h2>
      <p>If you've been using the old Counting tool,
        you can bring your existing bills, income, and goals over —
        once. After that, Cashbox keeps its own data; the two won't
        stay in sync.</p>
      <div class="cb-row">
        <button class="btn btn-quiet" id="ob-skip">Start fresh</button>
        <button class="btn btn-save" id="ob-import">Import from the old
          Counting tool</button>
      </div>
    </div>`;
  page.querySelector("#ob-skip").onclick = () => {
    sub = "period";
    render();
  };
  page.querySelector("#ob-import").onclick = () => runImportFlow(true);
}

async function runImportFlow(isFirstRun) {
  const picked = await CC.Store.pickImportFile();
  if (picked.cancelled) return;
  const result = await CC.Store.readImportFile(picked.path);
  if (result.error) {
    CC.toast(result.error, "error");
    return;
  }
  if (isFirstRun) {
    replaceOpenBook(result.data);
  } else {
    const ok = await CC.confirm({
      title: "Replace Cashbox's data?",
      body: "Importing replaces everything currently in Cashbox with "
        + "what's in that file.",
      fine: "Anything you've entered in Cashbox itself since your last "
        + "import will be lost.",
      yes: "Import and replace",
    });
    if (!ok) return;
    replaceOpenBook(result.data);
  }
  await save();
  CC.toast("Imported from the old Counting tool.");
  sub = "period";
  render();
}


/* ============================================================ CASH BOOKS */
/** The bar above every Money page: which cash book is open, and the others. */
function renderBookBar() {
  const bar = document.getElementById("cb-bookbar");
  if (!bar) return;
  const books = cashbooksOf();
  bar.innerHTML = `
    <label class="cb-bookbar-label" for="cb-book">Cash book</label>
    <select class="input cb-book-pick" id="cb-book">
      <option value="main" ${bookId === "main" ? "selected" : ""}>${esc(bookNameOf("main"))}</option>
      ${books.map((b) => `<option value="${escA(b.id)}" ${bookId === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}
    </select>
    <button class="btn btn-quiet" id="cb-book-new">New cash book</button>
    <button class="btn btn-quiet" id="cb-book-rename">Rename</button>
    ${bookId !== "main" ? `<button class="btn btn-quiet" id="cb-book-delete">Delete</button>` : ""}
    ${books.length ? `<button class="btn btn-quiet" id="cb-book-compare">Compare</button>` : ""}
    ${cashbooksOf().length ? `<span class="stamp cb-book-note">Each cash book is its own budget: income, bills, recurring and savings.</span>` : ""}`;
  bar.querySelector("#cb-book").onchange = (e) => switchBook(e.target.value);
  bar.querySelector("#cb-book-new").onclick = () => cashBookDialog();
  const rn = bar.querySelector("#cb-book-rename");
  if (rn) rn.onclick = async () => {
    const name = await promptText("Rename the cash book", "Whose is it? (a name)", bookNameOf(bookId));
    if (!name || !String(name).trim()) return;
    const nm = String(name).trim().slice(0, 60);
    if (bookId === "main") file.mainName = nm;
    else cashbooksOf().find((x) => x.id === bookId).name = nm;
    const r = await save();
    if (r && r.error) CC.toast(r.error, "error");
    render();
  };
  const del = bar.querySelector("#cb-book-delete");
  if (del) del.onclick = async () => {
    const name = bookNameOf(bookId);
    const ok = await CC.confirm({title: `Delete “${name}”?`, body: "Its bills, income, savings goals and calculation go with it.",
      fine: "The other cash books aren't touched.", yes: "Delete it"});
    if (!ok) return;
    file.cashbooks = cashbooksOf().filter((x) => x.id !== bookId);
    if (cmpA === bookId) cmpA = "main";
    if (cmpB === bookId) cmpB = "main";
    switchBook("main", true);
    const r = await save();
    if (r && r.error) CC.toast(r.error, "error"); else CC.toast(`“${name}” is deleted.`);
  };
  const cp = bar.querySelector("#cb-book-compare");
  if (cp) cp.onclick = () => { sub = "compare"; CC.Store.setPrefs({sub}); render(); };
}

function switchBook(id, quiet) {
  openBook(id);
  CC.Store.setPrefs({moneyCashbook: bookId});
  rowSel = -1; tplSel = -1;
  if (ensureCurrentSpendingLog()) save();
  render();
  if (!quiet) CC.toast(`Cash book: ${bookNameOf(bookId)}.`);
}

/** A new cash book: empty, or a copy of the one that's open (the usual start for a "what if"). */
// (2026-10-11, Cam: "2 completely different cashbooks. Lets say for 2 different people who have 2 completely different
// incomes, budgets, reoccuring etc.") -- a new cash book is someone's own and starts empty; a copy is the second option
function cashBookDialog() {
  const d = openDlg("New cash book", `
    <label class="dlg-label" for="ncb-name">Whose cash book is it?</label>
    <input class="input" id="ncb-name" placeholder="Sarah">
    <label class="dlg-label">Start with</label>
    <label class="cb-row" style="gap:8px"><input type="radio" name="ncb-from" value="empty" checked>
      Nothing -- their own income, bills and recurring, set up from scratch</label>
    <label class="cb-row" style="gap:8px"><input type="radio" name="ncb-from" value="copy">
      A copy of “${esc(bookNameOf(bookId))}”</label>`);
  const q = (s) => d.body.querySelector(s);
  d.btn("Cancel", "btn-quiet", d.close);
  d.btn("Make the cash book", "btn-save", async () => {
    const name = q("#ncb-name").value.trim();
    if (!name) { CC.toast("Whose is it? Give it a name.", "error"); return; }
    const copy = d.body.querySelector('input[name="ncb-from"]:checked').value === "copy";
    const budget = copy ? JSON.parse(JSON.stringify({templates: data.templates, oneoffs: data.oneoffs, payments: data.payments,
      goals: data.goals, calc: data.calc, spendingLog: data.spendingLog})) : blankBudget();
    budget.books = [];
    const b = {id: newId("cb", cashbooksOf()), name: name.slice(0, 60), created: new Date().toISOString(), data: budget};
    cashbooksOf().push(b);
    const r = await save();
    if (r && r.error) { CC.toast(r.error, "error"); return; }
    d.close();
    if (cmpB === "main") cmpB = b.id;
    switchBook(b.id, true);
    CC.toast(`“${b.name}” is ready${copy ? " -- a copy to change as you like" : " -- add their income and bills under Repeating"}.`);
  });
  q("#ncb-name").focus();
}

/* =============================================================== COMPARE */
let cmpA = "main", cmpB = "main", cmpMode = "month", cmpDate = monthStart(todayD());

/** One cash book's period: totals, and its lines summed by name. */
function bookPeriodSummary(id, start, end) {
  const d = bookDataOf(id) || blankBudget();
  const rows = buildPeriod(d, start, end), t = totals(rows), lines = {}, cats = {};
  rows.forEach((r) => {
    const k = r.kind + "|" + String(r.name || "?").trim().toLowerCase();
    if (!lines[k]) lines[k] = {kind: r.kind, name: r.name || "?", category: r.category, amount: 0, count: 0};
    lines[k].amount += r.amount; lines[k].count += 1;
    if (r.kind === "Bill") cats[r.category] = (cats[r.category] || 0) + r.amount;
  });
  const goals = (d.goals || []).reduce((a, g) => ({saved: a.saved + goalSaved(g), target: a.target + (parseFloat(g.target) || 0)}), {saved: 0, target: 0});
  return {t, lines, cats, goals};
}

function cmpRange() {
  if (cmpMode === "fortnight") { const s = fortnightStart(cmpDate); return [s, fortnightEnd(s), fmtFortnightLabel(s, fortnightEnd(s))]; }
  if (cmpMode === "year") return [D(cmpDate.y, 1, 1), D(cmpDate.y, 12, 31), String(cmpDate.y)];
  return [monthStart(cmpDate), monthEnd(cmpDate), `${MONTHS[cmpDate.m - 1]} ${cmpDate.y}`];
}

function renderCompare(page) {
  const ids = ["main"].concat(cashbooksOf().map((b) => b.id));
  if (!ids.includes(cmpA)) cmpA = "main";
  if (!ids.includes(cmpB)) cmpB = ids[1] || "main";
  if (cmpA === "main" && cmpB === "main" && ids[1]) cmpB = ids[1];
  if (ids.length < 2) {
    page.innerHTML = `<div class="cb-empty"><h3>Compare cash books</h3>
      <p class="stamp">Make a second cash book -- someone else's, with their own income, bills and recurring -- and this page
        shows the two side by side: income, bills, what's left over, every line that differs, and the two together.</p>
      <button class="btn btn-save" id="cmp-new">New cash book</button></div>`;
    page.querySelector("#cmp-new").onclick = () => cashBookDialog();
    return;
  }
  const [start, end, label] = cmpRange();
  const A = bookPeriodSummary(cmpA, start, end), B = bookPeriodSummary(cmpB, start, end);
  const nA = esc(bookNameOf(cmpA)), nB = esc(bookNameOf(cmpB));
  const pick = (id, which) => `<select class="input" id="cmp-${which}">${ids.map((x) => `<option value="${escA(x)}" ${x === id ? "selected" : ""}>${esc(bookNameOf(x))}</option>`).join("")}</select>`;
  // two people's books, side by side: a difference is just higher or lower (B against A), and Together adds them up
  const diff = (a, b) => {
    const v = b - a;
    if (Math.abs(v) < 0.005) return `<span class="stamp">same</span>`;
    return `<span class="cmp-diff">${v > 0 ? "▲" : "▼"} ${money(Math.abs(v))}</span>`;
  };
  const sumRow = (name, a, b, strong) => `<tr${strong ? ' class="cmp-strong"' : ""}><td>${name}</td><td class="num">${money(a)}</td><td class="num">${money(b)}</td><td class="num">${diff(a, b)}</td><td class="num cmp-together">${money(a + b)}</td></tr>`;
  const keys = [...new Set(Object.keys(A.lines).concat(Object.keys(B.lines)))];
  const lineRows = (kind) => keys.filter((k) => k.startsWith(kind + "|"))
    .map((k) => ({k, a: A.lines[k], b: B.lines[k]}))
    .map((x) => ({...x, av: x.a ? x.a.amount : 0, bv: x.b ? x.b.amount : 0, name: (x.a || x.b).name, cat: (x.a || x.b).category}))
    .sort((x, y) => Math.abs(y.bv - y.av) - Math.abs(x.bv - x.av) || x.name.localeCompare(y.name))
    .map((x) => `<tr class="${Math.abs(x.bv - x.av) < 0.005 ? "cmp-same" : ""}"><td>${esc(x.name)}${!x.a ? ` <span class="cmp-only">only in ${nB}'s</span>` : !x.b ? ` <span class="cmp-only">only in ${nA}'s</span>` : ""}</td>
        <td class="stamp">${esc(x.cat || "")}</td><td class="num">${x.a ? money(x.av) : "–"}</td><td class="num">${x.b ? money(x.bv) : "–"}</td>
        <td class="num">${diff(x.av, x.bv)}</td><td class="num cmp-together">${money(x.av + x.bv)}</td></tr>`).join("");
  const cats = [...new Set(Object.keys(A.cats).concat(Object.keys(B.cats)))].sort((x, y) => Math.abs((B.cats[y] || 0) - (A.cats[y] || 0)) - Math.abs((B.cats[x] || 0) - (A.cats[x] || 0)));
  const table = (head, body) => `<table class="detail-table cmp-table"><thead><tr>${head.map((h, i) => `<th${i > 1 || (head.length === 5 && i > 0) ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  const leftA = A.t.left, leftB = B.t.left;
  page.innerHTML = `
    <div class="cb-row cb-row-center cmp-picks" style="gap:8px;margin-bottom:10px">${pick(cmpA, "a")}<span class="stamp">against</span>${pick(cmpB, "b")}
      <button class="btn btn-quiet" id="cmp-swap" title="Swap them">⇄</button></div>
    <div class="cb-row cb-row-center" style="margin-bottom:10px;gap:6px">
      ${[["month", "Month"], ["fortnight", "Fortnight"], ["year", "Year"]].map(([m, n]) => `<button class="btn btn-quiet ${cmpMode === m ? "on" : ""}" data-cmode="${m}">${n}</button>`).join("")}</div>
    <div class="cb-row cb-row-center" style="margin-bottom:14px">
      <button class="btn btn-quiet" id="cmp-prev">Prev</button><span class="period-label">${label}</span>
      <button class="btn btn-quiet" id="cmp-next">Next</button><button class="btn" id="cmp-today">Today</button></div>
    <div class="metric-row" style="margin-bottom:16px">
      ${[["Income", A.t.income, B.t.income], ["Bills", A.t.bills, B.t.bills], ["Left over", leftA, leftB]].map(([n, a, b]) => `
        <div class="metric-card"><span class="metric-label">${n}</span>
          <span class="metric-value cmp-pair"><span>${nA} ${money(a)}</span><span>${nB} ${money(b)}</span></span>
          <span class="stamp">Together ${money(a + b)}</span></div>`).join("")}
    </div>
    <h3 class="cmp-h">The totals</h3>
    ${table(["", nA, nB, `${nB} vs ${nA}`, "Together"], sumRow("Income", A.t.income, B.t.income) + sumRow("Bills", A.t.bills, B.t.bills)
      + sumRow("Left over", leftA, leftB, true) + sumRow("Savings goals: saved so far", A.goals.saved, B.goals.saved))}
    <h3 class="cmp-h">Income, line by line</h3>
    ${keys.some((k) => k.startsWith("Income|")) ? table(["", "", nA, nB, `${nB} vs ${nA}`, "Together"], lineRows("Income")) : `<p class="stamp">No income in either book this ${cmpMode === "year" ? "year" : "period"}.</p>`}
    <h3 class="cmp-h">Bills, line by line</h3>
    ${keys.some((k) => k.startsWith("Bill|")) ? table(["", "", nA, nB, `${nB} vs ${nA}`, "Together"], lineRows("Bill")) : `<p class="stamp">No bills in either book this ${cmpMode === "year" ? "year" : "period"}.</p>`}
    ${cats.length ? `<h3 class="cmp-h">Bills by category</h3>${table(["", nA, nB, `${nB} vs ${nA}`, "Together"], cats.map((c) => sumRow(esc(c), A.cats[c] || 0, B.cats[c] || 0)).join(""))}` : ""}
    <p class="stamp">Lines are matched by name. ▲ / ▼ is ${nB} against ${nA}; Together is both cash books added up, as a household.</p>`;
  const q = (s) => page.querySelector(s);
  q("#cmp-a").onchange = (e) => { cmpA = e.target.value; render(); };
  q("#cmp-b").onchange = (e) => { cmpB = e.target.value; render(); };
  q("#cmp-swap").onclick = () => { [cmpA, cmpB] = [cmpB, cmpA]; render(); };
  page.querySelectorAll("[data-cmode]").forEach((b) => { b.onclick = () => { cmpMode = b.dataset.cmode; render(); }; });
  const step = (dir) => { cmpDate = cmpMode === "fortnight" ? addFortnights(fortnightStart(cmpDate), dir) : cmpMode === "year" ? D(cmpDate.y + dir, cmpDate.m, 1) : addMonths(monthStart(cmpDate), dir); render(); };
  q("#cmp-prev").onclick = () => step(-1);
  q("#cmp-next").onclick = () => step(1);
  q("#cmp-today").onclick = () => { cmpDate = monthStart(todayD()); render(); };
}

/* ================================================================= BOOT */
/** Belt-and-suspenders alongside pywebview's own debug=False (which
    should already suppress the native right-click menu at the GTK
    level) — a browser-style context menu with Reload/Inspect/Back
    doesn't belong in a desktop app regardless of which layer is
    responsible for blocking it, and this removes any dependency on
    that pywebview behavior being reliable across WebKitGTK versions.
    Registered at the top level, before DOMContentLoaded, so it's
    active from the very first paint. */
document.addEventListener("contextmenu", (e) => e.preventDefault());

async function boot() {
  await CC.Store.ready;
  renderNav();
  /* Cashbox's own footer buttons. Import is gone inside KinCrux (it
     came from Cam's Collective, which no longer exists as a source) and
     Print moves into the module's own pages, so both are optional here
     rather than assumed present. */
  const importBtn = document.getElementById("cb-import-btn");
  if (importBtn) importBtn.onclick = () => runImportFlow(false);
  const printBtn = document.getElementById("cb-print-btn");
  if (printBtn) printBtn.onclick = () => printDialog();

  await loadAll();
  const prefs = await CC.Store.getPrefs();
  if (NAV.some(([id]) => id === prefs.sub)) sub = prefs.sub;

  if (isEmpty(data)) {
    showOnboarding();
  } else {
    render();
  }
}

/* No DOMContentLoaded handler: the host mounts this module. Cashbox
   booted itself because it owned the window; two self-booting modules
   in one page is how Hearth ended up fetching every thumbnail twice. */

  /* ------------------------------------------------------- the module ---
     The host calls mount(pane, view). VIEWS is what the sidebar offers. */
  let mounted = false;

  /* PREFIXED VIEW KEYS, and the reason is a real collision. Both Hearth
     and Cashbox call their landing page "dashboard". The host checks
     `view === "dashboard"` before it asks any module, so Money's
     Overview would simply never render — a feature silently missing
     rather than an error. Namespacing every module's views fixes that
     class of bug once instead of once per collision, and Training,
     Notes, Games and Music will all want it too. */
  const PREFIX = "money:";
  const strip = (view) => String(view || "").replace(PREFIX, "");

  async function mount(host, view) {
    host.innerHTML = '<div id="cb-bookbar" class="cb-bookbar"></div><div id="cb-content"></div>';
    if (!mounted) { await boot(); mounted = true; }
    const want = strip(view);
    if (want && NAV.some(([id]) => id === want)) sub = want;
    render();
  }

  /* A Money book's document by id, for NeuroNet's reader (the desktop
     Bookshelf). Money needn't have been opened: its data is read first. */
  window.SS = window.SS || {};
  window.SS.MoneyBooks = {
    async document(id) {
      if (!mounted) await loadAll();
      // any person's cash book (2026-10-11): the book is made from its own cash book's budget
      for (const owner of ["main"].concat(cashbooksOf().map((x) => x.id))) {
        const od = bookDataOf(owner), b = ((od && od.books) || []).find((x) => x.id === id);
        if (!b) continue;
        const keep = data; data = od;
        try { return {title: b.name, html: await moneyBookDocument(b), printKind: "money-book"}; } finally { data = keep; }
      }
      return null;
    },
  };

  window.CP.Money = {
    mount,
    PREFIX,
    VIEWS: NAV.map(([id]) => PREFIX + id),
    get sub() { return sub; },
    _test: {
  D, iso, fromISO, fmtDDMMYY, fromDDMMYY, fmtShort, fmtFortnightLabel,
  fortnightStart, fortnightEnd, addFortnights, addMonths, addDays, monthStart,
  monthEnd, todayD, dueDates, buildPeriod, totals, whenText, money, parseMoney,
  newId, isEmpty,
  get data() { return data; },
  _setData: (d) => { data = d; },
  get sub() { return sub; },
  _setSub: (s) => { sub = s; },
  get viewDate() { return viewDate; },
  _setViewDate: (d) => { viewDate = d; },
  get fnViewDate() { return fnViewDate; },
  _setFnViewDate: (d) => { fnViewDate = d; },
  get rowSel() { return rowSel; },
  _setRowSel: (i) => { rowSel = i; },
  get tplSel() { return tplSel; },
  _setTplSel: (i) => { tplSel = i; },
  get calcViewDate() { return calcViewDate; },
  _setCalcViewDate: (d) => { calcViewDate = d; },
  get calcFnViewDate() { return calcFnViewDate; },
  _setCalcFnViewDate: (d) => { calcFnViewDate = d; },
  get calcMode() { return calcMode; },
  _setCalcMode: (m) => { calcMode = m; },
  resolveMarkAmount, calcTotals, toggleMark, renderCalculation,
  render, renderNav, boot, loadAll, save,
  oneoffDialog, templateDialog, goalDialog, showOnboarding, runImportFlow,
  occurrenceDialog, deleteOneoff, newRecordId, renderPeriodPage,
  printDialog, buildPrintDocument, buildCalcPrintDocument,
  bookPeriods, bookRange, scopeCss, moneyBookDocument, renderBooks, bookDialog,
  normalizeGoal, goalSaved, currentPeriodLeftover, payPeriodsUntil,
  goalProjection, piggyBankSvg, renderGoals, goalCardHtml,
  depositDialog, withdrawalDialog,
  ensureCurrentSpendingLog, fortnightRemaining, spendDialog, renderDashboard,
  get file() { return file; }, get bookId() { return bookId; }, openBook, switchBook, bookPeriodSummary, renderCompare, renderBookBar, cashbooksOf,
  _setCompare: (a, b, mode, dt) => { cmpA = a; cmpB = b; cmpMode = mode; cmpDate = dt; },
},
  };
})();
