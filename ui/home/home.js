/* ==========================================================================
   Home — the dashboard, the calendar and contacts.

   Cam: "i now want the two apps merged together into one". These three
   screens lived inside KinCrux's own app.js rather than in a module, so they
   were lifted out whole and given the bindings below. The code itself is
   KinCrux's, unchanged.

   TWO DOCUMENTS. The dashboard shows photos and albums, which belong to this
   app's library; contacts and the calendar belong to KinCrux's document. So
   `data` below reads each from the right place and `save` writes each back to
   the file it came from. Handing these screens one document would have shown
   the wrong contacts, or worse, saved them over the wrong file.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS;
  const host = SS.shared;                 // this app: photos, albums
  const kitchen = window.CK.shared;       // KinCrux's: contacts, events

  const data = {
    get photos() { return host.data.photos || []; },
    get albums() { return host.data.albums || []; },
    get folders() { return host.data.folders || []; },
    get contacts() { return (kitchen.data && kitchen.data.contacts) || []; },
    set contacts(v) { if (kitchen.data) kitchen.data.contacts = v; },
    get events() { return (kitchen.data && kitchen.data.events) || []; },
    set events(v) { if (kitchen.data) kitchen.data.events = v; },
  };

  /* Both stores, because a screen here can touch either. Each write is
     atomic on its own file, so saving the pair is safe. */
  const save = async () => { await kitchen.save(); await host.save(); };
  const render = () => host.render();
  const toast = (m, k) => host.toast(m, k);
  const openDlg = (t, b, w) => host.openDlg(t, b, w);
  const confirmDlg = (o) => host.confirm(o);
  const promptText = (t, l, i) => host.promptText(t, l, i);
  const pickFromLibrary = (o) => host.pickFromLibrary(o);
  const $ = (id) => document.getElementById(id);
  /* A local shim, not the host's window.CP -- so anything added to the
     host has to be named here too or it simply is not there. CP.thumb is
     the cached photo thumbnail (see app.js); the widgets below draw the
     same photos the library has usually already fetched. */
  const CP = {Store: SS.Store, thumb: (n) => window.CP.thumb(n)};

  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const EVENT_STAMPS = {
    cake:      {name: "Birthday",    glyph: "\u{1F382}"},
    rings:     {name: "Anniversary", glyph: "\u{1F48D}"},
    tree:      {name: "Christmas",   glyph: "\u{1F384}"},
    bells:     {name: "Bells",       glyph: "\u{1F514}"},
    celebrate: {name: "Celebrate",   glyph: "\u{1F389}"},
    party:     {name: "Party",       glyph: "\u{1F38A}"},
  };
  
  const REPEAT_OPTIONS = [
    {key: "none",    label: "Doesn't repeat"},
    {key: "weekly",  label: "Every week"},
    {key: "monthly", label: "Every month"},
    {key: "yearly",  label: "Every year"},
  ];
  
  const BLOCK_TYPES = {
    today:    {name: "Today", hint: "What's on today"},
    upcoming: {name: "Upcoming", hint: "The next few events"},
    photos:   {name: "Recent photos", hint: "The last few photos added"},
    phonebook: {name: "Phone book", hint: "Search contacts, plus favourites"},
    onthisday: {name: "On this day", hint: "Photos from this date in past years"},
    countdown: {name: "Countdown", hint: "Days until a date you choose"},
    notice:    {name: "Notice board", hint: "A note pinned for the family"},
    week:      {name: "This week", hint: "The next seven days at a glance"},
    album:     {name: "Album", hint: "A shortcut straight into one album"},
    quickadd:  {name: "Quick add", hint: "Add an event without leaving here"},
    frame:    {name: "Photo frame", hint: "A slideshow of chosen photos"},
    /* Cam: "add a music widget where i can select music to play in the form
       of saved playlists or albums ... so when i first open the app i can
       start music quicker in less clicks." */
    music:    {name: "Music", hint: "Start a playlist or album in one click"},
    /* Cam: "a random circuit generator, which displays a random circuit in
       the widget windows that is scrollable" and "quick note, a little text
       widget where I can write a quick thought". */
    circuit:  {name: "Random circuit", hint: "One of your circuits, at random"},
    quicknote: {name: "Quick note", hint: "Jot a thought into Fleeting"},
    /* Cam: "Puzzle - Ability to generate sudoku, kakuro, minesweeper and if
       possible word search", "Quick recipe" and "Fleeting Note Viewer". */
    puzzle:   {name: "Puzzle", hint: "Sudoku, Kakuro, Minesweeper or a word search"},
    quickrecipe: {name: "Quick recipe", hint: "Title, ingredients, directions — saved to Recipes"},
    fleetview: {name: "Fleeting viewer", hint: "Read and clear your fleeting notes"},
    /* Cam: "a new widget called Random Movie, this will bring up a random
       movie from the shelf presented upside down so you dont know what it
       is, but when clicked it flips over an presents the movie cover. When
       movie cover is clicked it opens the shelf entry for the movie." */
    randommovie: {name: "Random movie", hint: "A film off the Shelf, face down until you turn it"},
    /* Cam: "a random pull widget for the dashboard, where i select the type
       of deck and it pulls a random card. Have the card presented like the
       random dvd, where it is upside down then i click to flip (it can be
       either upright or reversed). From here i can add a quick journal
       entry" -- saved to Mindfulness → Journal. */
    randompull: {name: "Random pull", hint: "One card from a Tarot, Oracle or Lenormand deck, face down"},
    /* Cam: "a random album player much like the random dvd". An album from
       Music, dealt face down; turn it over, press the cover to play it. */
    randomalbum: {name: "Random album", hint: "An album from Music, face down until you turn it; press it to play"},
  };
  
  /* THE BLOCKS YOU CAN SET UP, AND SO THE ONES YOU CAN HAVE SEVERAL OF.

     Cam: "On the dashboard i want to be able to add more then one
     countdown timer. At the moment i can only add one."

     Adding a block used to offer only types not already on the board,
     with `frame` written in as the single exception. That is the wrong
     shape of rule: it asks "is it already there", when what matters is
     whether a second one would SAY ANYTHING DIFFERENT.

     These four carry their own settings -- a countdown its date, a
     notice its text, an album which album, a frame its photos -- so two
     of them are two different things: a countdown to a birthday beside a
     countdown to a holiday. The rest draw from one source and always
     show the same thing, so a second "On this day" is the first one
     again, in another square.

     One list, used in three places: which blocks can be added again,
     which get a settings gear, and which open a dialog when it is
     pressed. It was written out by hand in two of those already, and a
     fourth type added to one and not the other is a block with a gear
     that does nothing. */
  const CONFIGURABLE = ["frame", "countdown", "notice", "album"];

  /* One icon per kind of block, so the chooser reads at a glance. */
  const BLOCK_ICONS = {
    today: "i-calendar", upcoming: "i-clock", photos: "i-album",
    phonebook: "i-person", onthisday: "i-clock", countdown: "i-target",
    notice: "i-note-plus", week: "i-calendar", album: "i-album",
    quickadd: "i-plus", frame: "i-album", music: "i-clef",
    circuit: "i-session", quicknote: "i-note-plus",
    puzzle: "i-grid", quickrecipe: "i-recipe", fleetview: "i-book",
    randommovie: "i-library", randompull: "i-tarot", randomalbum: "i-clef",
  };

  const DEFAULT_BLOCKS = [
    {id: "b-today", type: "today"},
    {id: "b-upcoming", type: "upcoming"},
    {id: "b-photos", type: "photos"},
  ];
  
  const D = (y, m, d) => ({y, m, d});
  
  const todayD = () => {
    const n = new Date();
    return D(n.getFullYear(), n.getMonth() + 1, n.getDate());
  };
  
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  
  const monthStart = (dt) => D(dt.y, dt.m, 1);
  
  const monthEnd = (dt) => D(dt.y, dt.m, daysInMonth(dt.y, dt.m));
  
  const addDays = (dt, n) => {
    const d = new Date(dt.y, dt.m - 1, dt.d + n);
    return D(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  
  const addMonths = (dt, n) => {
    const m0 = dt.m - 1 + n;
    const y = dt.y + Math.floor(m0 / 12);
    const m = ((m0 % 12) + 12) % 12 + 1;
    return D(y, m, Math.min(dt.d, daysInMonth(y, m)));
  };
  
  const cmp = (a, b) => a.y - b.y || a.m - b.m || a.d - b.d;
  
  const iso = (dt) => `${dt.y}-${String(dt.m).padStart(2, "0")}-` +
                      `${String(dt.d).padStart(2, "0")}`;
  
  const fromISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    const dt = D(+m[1], +m[2], +m[3]);
    return (dt.m >= 1 && dt.m <= 12 && dt.d >= 1
            && dt.d <= daysInMonth(dt.y, dt.m)) ? dt : null;
  };
  
  const weekday = (dt) => new Date(dt.y, dt.m - 1, dt.d).getDay();
  
  const fmtLongDate = (dt) => `${MONTHS[dt.m - 1]} ${dt.d}, ${dt.y}`;
  
  const newId = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  const escA = (s) => esc(s).replace(/"/g, "&quot;");
  
  const ic = (name, cls) =>
    `<svg class="ic ${cls || ""}" viewBox="0 0 24 24"><use href="#${name}"/></svg>`;
  
  let calSelectedDate = todayD();
  
  let calViewDate = todayD();
  
  let contactSearch = "";
  
  /* Cam: "when i edit the layout of the dashboard then exit the app, the
     changes i made are gone."

     The comment here used to read "loaded from prefs at boot" -- and nothing
     ever loaded it. saveBlocks() wrote the layout to prefs faithfully; on the
     next launch Home started with null and drew the DEFAULT blocks, so every
     change was thrown away at the door. (KinCrux never loaded it either, so
     the layout has never survived a restart.) loadBlocks() below is the read
     that was missing. */
  let dashBlocks = null;
  let dashApps = true;              // the app cards, on unless Cam turns them off in Edit layout
  let blocksLoaded = false;

  async function loadBlocks() {
    if (blocksLoaded) return;
    blocksLoaded = true;             // set first: two mounts must not both read
    try {
      const prefs = await SS.Store.getPrefs();
      if (prefs && Array.isArray(prefs.dashBlocks)) dashBlocks = prefs.dashBlocks;
      if (prefs && prefs.dashApps === false) dashApps = false;
    } catch (e) {
      /* No prefs to be had: the default layout is a fine place to start. */
    }
  }
  
  let dashEditing = false;
  
  const frameIndex = new Map();
  
  const frameTimers = new Map();
  
  let fsFrame = null;          // {source, albumId, seconds, index}
  
  let fsTimer = null;

  function fmtTime12(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  
  function eventFallsOn(ev, dateISO) {
    if (ev.date === dateISO) return true;
    if (!ev.repeat || ev.repeat === "none") return false;
    if (dateISO < ev.date) return false;          // never before it starts
    if (ev.repeatUntil && dateISO > ev.repeatUntil) return false;
  
    const start = fromISO(ev.date);
    const day = fromISO(dateISO);
  
    if (ev.repeat === "weekly") {
      return weekday(start) === weekday(day);
    }
    if (ev.repeat === "monthly") {
      if (start.d === day.d) return true;
      /* the 31st in a 30-day month lands on the last day of that month,
         rather than being skipped */
      const last = monthEnd(day).d;
      return start.d > last && day.d === last;
    }
    if (ev.repeat === "yearly") {
      if (start.m === day.m && start.d === day.d) return true;
      if (start.m === 2 && start.d === 29 && day.m === 2 && day.d === 28) {
        return monthEnd(day).d === 28;            // only in a non-leap year
      }
      return false;
    }
    return false;
  }
  
  function contactBirthdaysOn(dateISO) {
    const day = fromISO(dateISO);
    return (data.contacts || [])
      .filter((ct) => ct.birthday)
      .filter((ct) => {
        const b = fromISO(ct.birthday);
        if (!b) return false;
        if (b.m === day.m && b.d === day.d) return true;
        if (b.m === 2 && b.d === 29 && day.m === 2 && day.d === 28) {
          return monthEnd(day).d === 28;
        }
        return false;
      })
      .map((ct) => {
        const b = fromISO(ct.birthday);
        const years = day.y - b.y;
        return {
          id: "birthday-" + ct.id,
          name: years > 0 ? `${ct.name} turns ${years}` : `${ct.name}'s birthday`,
          date: dateISO,
          startTime: "",
          endTime: "",
          notes: "",
          stamp: "cake",
          fromContact: ct.id,
          readOnly: true,       // edited on the contact, not here
        };
      });
  }
  
  function eventsOn(dateISO) {
    const own = data.events.filter((e) => eventFallsOn(e, dateISO));
    return [...own, ...contactBirthdaysOn(dateISO)]
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }
  
  function newEventDraft(dateISO) {
    return {name: "", date: dateISO, startTime: "", endTime: "", notes: "",
            repeat: "none", repeatUntil: "", stamp: ""};
  }
  
  function renderCalendarPage(page) {
    const label = `${MONTHS[calViewDate.m - 1]} ${calViewDate.y}`;
    /* v5 — Cam: "the calander lags when scrolling down to see the list of
       stuff on that day, lets split the screen with the calander on the
       left hand side, then when a day is pressed the events and things on
       that day are presented on the right."
  
       The day's events used to sit BELOW the month grid, so picking a day
       meant scrolling down to see what was on it and back up to pick
       another — on a full month that's a lot of movement for what should
       be a glance. Side by side, both stay in view and nothing scrolls.
  
       Each column scrolls independently rather than the page as a whole,
       so a day with twenty events can't push the calendar off screen. */
    page.innerHTML = `
      <h2 class="cm-page-h">Calendar</h2>
      <p class="cm-page-sub">Everything the family has coming up.</p>
      <div class="cal-split">
        <div class="cal-left">
          <div class="cm-row cm-row-center"
               style="justify-content:center;gap:10px;margin-bottom:14px">
            <button class="btn btn-quiet" id="cal-prev">Prev</button>
            <span style="font-weight:700;color:var(--ink);min-width:150px;text-align:center"
                  >${label}</span>
            <button class="btn btn-quiet" id="cal-next">Next</button>
            <button class="btn" id="cal-today">Today</button>
          </div>
          <div class="panel" style="padding:var(--sp-3)">
            ${calGridHtml()}
          </div>
        </div>
        <div class="cal-right">
          <div class="panel cal-day-panel" id="cal-day-section"></div>
        </div>
      </div>`;
  
    page.querySelector("#cal-prev").onclick = () => { calViewDate = addMonths(calViewDate, -1); render(); };
    page.querySelector("#cal-next").onclick = () => { calViewDate = addMonths(calViewDate, 1); render(); };
    page.querySelector("#cal-today").onclick = () => {
      calViewDate = monthStart(todayD());
      calSelectedDate = todayD();
      render();
    };
    page.querySelectorAll("[data-date]").forEach((cell) =>
      cell.addEventListener("click", () => {
        calSelectedDate = fromISO(cell.dataset.date);
        render();
      }));
    paintCalDaySection(page);
  }
  
  function calGridHtml() {
    const start = monthStart(calViewDate);
    const totalDays = daysInMonth(start.y, start.m);
    const firstWeekday = weekday(start);
    const today = todayD();
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(D(start.y, start.m, d));
  
    return `<div class="cal-grid">
      <div class="cal-grid-head">
        ${WEEKDAY_LABELS.map((l) => `<div class="cal-dow">${l}</div>`).join("")}
      </div>
      <div class="cal-grid-body">
        ${cells.map((dt) => {
          if (!dt) return `<div class="cal-cell cal-cell-blank"></div>`;
          const key = iso(dt);
          const dayEvents = eventsOn(key);
          const has = dayEvents.length > 0;
          /* a stamped event shows its glyph in the month view - the whole
             point of a stamp is spotting a birthday at a glance rather
             than having to open the day */
          const stamped = dayEvents.find((e) => e.stamp && EVENT_STAMPS[e.stamp]);
          const isToday = cmp(dt, today) === 0;
          const isSelected = calSelectedDate && cmp(dt, calSelectedDate) === 0;
          return `<div class="cal-cell ${isToday ? "cal-cell-today" : ""}
            ${isSelected ? "cal-cell-selected" : ""}" data-date="${key}">
            <div class="cal-cell-num">${dt.d}</div>
            ${stamped
              ? `<div class="cal-cell-stamp">${EVENT_STAMPS[stamped.stamp].glyph}</div>`
              : `<div class="cal-cell-dot ${has ? "" : "hidden"}"></div>`}
            </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  
  function paintCalDaySection(page) {
    const box = page.querySelector("#cal-day-section");
    if (!box) return;
    if (!calSelectedDate) {
      /* the right-hand panel is always there now, so an unselected state
         needs to say something rather than being a blank rectangle */
      box.innerHTML = `<p class="cm-empty" style="padding:40px 20px">
        Pick a day on the left to see what's on.</p>`;
      return;
    }
    const key = iso(calSelectedDate);
    const evts = eventsOn(key);
    box.innerHTML = `
      <div class="cm-row" style="justify-content:space-between;margin-bottom:10px">
        <h3 style="margin:0;font-size:17px;color:var(--ink)">${fmtLongDate(calSelectedDate)}</h3>
        <button class="btn btn-save" id="cal-add-event">+ Add Event</button>
      </div>
      ${evts.length ? evts.map((e) => `
        <div class="cal-event-row" data-id="${escA(e.id)}">
          ${e.stamp && EVENT_STAMPS[e.stamp]
            ? `<span class="cal-event-stamp"
                 title="${escA(EVENT_STAMPS[e.stamp].name)}"
                 >${EVENT_STAMPS[e.stamp].glyph}</span>`
            : `<span class="cal-event-dot"></span>`}
          <div>
            <div class="cal-event-title">${esc(e.name)}
              ${e.repeat && e.repeat !== "none"
                ? `<span class="cal-repeat" title="Repeats">\u21BB</span>` : ""}
            </div>
            ${(e.startTime || e.endTime) ? `<div class="cal-event-time">
              ${esc(fmtTime12(e.startTime))}${e.endTime ? ` \u2013 ${esc(fmtTime12(e.endTime))}` : ""}
              </div>` : ""}
          </div>
        </div>`).join("") : `<p class="cm-empty" style="text-align:left;padding:10px 0">
          Nothing scheduled this day.</p>`}`;
  
    box.querySelector("#cal-add-event").onclick = () => calEventDialog(newEventDraft(key));
    box.querySelectorAll("[data-id]").forEach((row) =>
      row.addEventListener("click", () => {
        const id = row.dataset.id;
        /* a birthday row isn't a real event - it's generated from a
           contact, so clicking it opens the contact rather than doing
           nothing at all */
        if (id.startsWith("birthday-")) {
          const ct = (data.contacts || []).find((x) =>
            x.id === id.slice("birthday-".length));
          if (ct) contactDialog(ct);
          return;
        }
        const e = data.events.find((x) => x.id === id);
        if (e) calEventDialog(e);
      }));
  }
  
  function calEventDialog(evt) {
    const editing = !!evt.id;
    const d = openDlg(editing ? "Edit event" : "Add event", `
      <label class="dlg-label" style="margin-top:0">Title</label>
      <input class="input" id="ce-name" value="${escA(evt.name)}">
      <label class="dlg-label">Date</label>
      <input class="input" id="ce-date" type="date" value="${escA(evt.date)}">
      <div class="cm-row" style="gap:10px">
        <div style="flex:1">
          <label class="dlg-label">Start time (optional)</label>
          <input class="input" id="ce-start" type="time" value="${escA(evt.startTime)}">
        </div>
        <div style="flex:1">
          <label class="dlg-label">End time (optional)</label>
          <input class="input" id="ce-end" type="time" value="${escA(evt.endTime)}">
        </div>
      </div>
      <label class="dlg-label">Repeats</label>
      <select class="input" id="ce-repeat" style="width:100%">
        ${REPEAT_OPTIONS.map((o) => `<option value="${o.key}"${
          (evt.repeat || "none") === o.key ? " selected" : ""}>${
          esc(o.label)}</option>`).join("")}
      </select>
      <div id="ce-until-wrap" ${(evt.repeat && evt.repeat !== "none")
        ? "" : "hidden"}>
        <label class="dlg-label">Stop repeating after (optional)</label>
        <input class="input" id="ce-until" type="date"
               value="${escA(evt.repeatUntil || "")}">
      </div>
  
      <label class="dlg-label">Stamp (optional)</label>
      <div class="stamp-picker" id="ce-stamps">
        <button type="button" class="stamp-opt ${!evt.stamp ? "on" : ""}"
                data-stamp="">None</button>
        ${Object.entries(EVENT_STAMPS).map(([key, s]) => `
          <button type="button" class="stamp-opt ${
            evt.stamp === key ? "on" : ""}" data-stamp="${key}"
            title="${escA(s.name)}">
            <span class="stamp-glyph">${s.glyph}</span>
            <span>${esc(s.name)}</span>
          </button>`).join("")}
      </div>
  
      <label class="dlg-label">Notes (optional)</label>
      <textarea class="input" id="ce-notes" rows="2">${esc(evt.notes || "")}</textarea>`);
  
    /* the "until" date only makes sense on something that repeats */
    let stamp = evt.stamp || "";
    const repeatSel = d.body.querySelector("#ce-repeat");
    repeatSel.addEventListener("change", () => {
      d.body.querySelector("#ce-until-wrap").hidden = repeatSel.value === "none";
    });
    d.body.querySelectorAll("[data-stamp]").forEach((btn) =>
      btn.addEventListener("click", () => {
        stamp = btn.dataset.stamp;
        d.body.querySelectorAll("[data-stamp]").forEach((b) =>
          b.classList.toggle("on", b.dataset.stamp === stamp));
      }));
  
    d.btn("Cancel", "btn-quiet", d.close);
    if (editing) {
      d.btn("Delete", "btn-danger", async () => {
        const ok = await confirmDlg({title: "Delete this event?",
          body: `Delete \u201C${evt.name}\u201D? This can't be undone.`, yes: "Delete"});
        if (!ok) return;
        data.events.splice(data.events.indexOf(evt), 1);
        await save();
        d.close();
        render();
      });
    }
    d.btn(editing ? "Save Changes" : "Add Event", "btn-save", async () => {
      const name = d.body.querySelector("#ce-name").value.trim();
      const date = d.body.querySelector("#ce-date").value;
      if (!name) { toast("Give the event a title.", "error"); return; }
      if (!date || !fromISO(date)) { toast("Pick a valid date.", "error"); return; }
      const repeat = d.body.querySelector("#ce-repeat").value;
      const payload = {name, date,
        startTime: d.body.querySelector("#ce-start").value,
        endTime: d.body.querySelector("#ce-end").value,
        notes: d.body.querySelector("#ce-notes").value.trim(),
        repeat,
        /* an "until" left over from a previous setting would silently
           cap a newly non-repeating event, so it's cleared with it */
        repeatUntil: repeat === "none"
          ? "" : d.body.querySelector("#ce-until").value,
        stamp};
      if (editing) {
        Object.assign(evt, payload);
      } else {
        data.events.push({id: newId(), created: new Date().toISOString(), ...payload});
      }
      await save();
      calSelectedDate = fromISO(date);
      calViewDate = monthStart(calSelectedDate);
      d.close();
      render();
    });
  }
  
/* ---- where each widget sits -----------------------------------------------

   Cam: "maybe if we broke the dashboard into 3 collums with the ability to
   add 3 widgets into each collumn, i dont need a massive photo frame for the
   dashboard."

   The free grid before this let a widget go anywhere, which is what was asked
   for first -- and it was fiddly: sizes to get right, squares to miss, a
   photo frame that swallowed the page.

   THREE COLUMNS, THREE WIDGETS EACH. A widget belongs to a column and a place
   in it, nothing else: no width, no height to set. Dragging drops it into a
   column at a position, and a full column refuses politely. Nine places, all
   the same size, so the page cannot come out lopsided.

   Blocks saved with the old x/y are read once and turned into columns, in the
   order they were on screen, so nobody loses an arrangement. */
const DASH_COLS = 3;
const PER_COL = 3;

function placeBlocks(blocks) {
  /* Old squares (x, y) become a column and a place, once. Sorted the way they
     were laid out -- down the columns, left to right -- so the dashboard
     opens looking like the one Cam left. */
  const needsMoving = blocks.some((b) => !Number.isFinite(b.col));
  if (needsMoving) {
    const byPlace = [...blocks].sort((a, b) => {
      const ax = Number.isFinite(a.x) ? a.x : 0, bx = Number.isFinite(b.x) ? b.x : 0;
      const ay = Number.isFinite(a.y) ? a.y : 0, by = Number.isFinite(b.y) ? b.y : 0;
      return ax - bx || ay - by;
    });
    byPlace.forEach((b, i) => {
      if (Number.isFinite(b.col)) return;
      b.col = Math.min(DASH_COLS - 1, Math.floor(i / PER_COL));
      b.slot = i % PER_COL;
    });
  }
  /* Tidy every column: no gaps, no more than three, and each widget knowing
     where it actually is. */
  for (let c = 0; c < DASH_COLS; c++) {
    blocks.filter((b) => b.col === c)
      .sort((a, b) => (a.slot || 0) - (b.slot || 0))
      .forEach((b, i) => { b.slot = i; });
  }
  for (const b of blocks) {
    if (!Number.isFinite(b.col) || b.col < 0 || b.col >= DASH_COLS) b.col = 0;
    delete b.x; delete b.y; delete b.w; delete b.h;   // the old model, gone
  }
  return blocks;
}

/** The widgets in one column, in order. */
const columnOf = (blocks, c) =>
  blocks.filter((b) => b.col === c).sort((a, b) => (a.slot || 0) - (b.slot || 0));

const columnIsFull = (blocks, c) => columnOf(blocks, c).length >= PER_COL;

  function blocksOrDefault() {
    /* Every block comes back with a square, whether it was saved with one or
       not, so nothing anywhere else has to cope with a block that has none. */
    if (!Array.isArray(dashBlocks)) return placeBlocks(DEFAULT_BLOCKS.map((b) => ({...b})));
    return placeBlocks(dashBlocks);
  }
  
  /** The starred subsections, as quick links.

      Cam: "a favorite feature where i can favorite any sub section and it
      will appear in a Favorites main section ... they act as quick links
      straight to that sub section" -- and then: "our app already has a Home
      Main section which acts as a dashboard, so lets put the favorites
      there". So they live here, above the blocks. */
  function favouritesStrip() {
    const favs = (SS.favourites() || []).map(SS.favouriteInfo).filter(Boolean);
    if (!favs.length) {
      return `<div class="fav-strip fav-strip-empty">
        <span class="fav-strip-h">Favourites</span>
        <p class="cm-page-sub" style="margin:4px 0 0">Star a page (☆ on its tab)
          and it appears here as a quick link.</p>
      </div>`;
    }
    return `<div class="fav-strip">
      <span class="fav-strip-h">Favourites</span>
      <div class="fav-grid">
        ${favs.map((f) => `
          <button class="fav-card" data-fav-go="${escA(f.view)}"
                  style="--card-accent:${f.accent}" title="${escA(f.sectionName)} — ${escA(f.name)}">
            <span class="fav-card-ic">${ic(f.icon)}</span>
            <span class="fav-card-name">${esc(f.name)}</span>
            <span class="fav-card-sec">${esc(f.sectionName)}</span>
          </button>`).join("")}
      </div>
    </div>`;
  }

  /** Every app as a card: its icon, its name and its pages, a click away. */
  function appsStrip() {
    const apps = (SS.appCards && SS.appCards()) || [];
    if (!dashApps || !apps.length) return "";
    return `<div class="fav-strip app-strip">
      <span class="fav-strip-h">Apps</span>
      <div class="fav-grid app-grid">
        ${apps.map((a) => `
          <button class="fav-card app-card" data-app-go="${escA(a.key)}"
                  style="--card-accent:${a.accent}" title="${escA(a.name)}${a.pages.length ? ` — ${escA(a.pages.join(", "))}` : ""}">
            <span class="fav-card-ic">${ic(a.icon)}</span>
            <span class="fav-card-name">${esc(a.name)}</span>
            <span class="fav-card-sec">${esc(a.pages.slice(0, 3).join(" · ") || "Your photos")}</span>
          </button>`).join("")}
      </div>
    </div>`;
  }

  function renderDashboard(page) {
    const blocks = blocksOrDefault();
  
    page.innerHTML = `
      <div class="cm-row" style="align-items:flex-start;margin-bottom:4px">
        <div style="flex:1">
          <h2 class="cm-page-h" style="margin-bottom:2px">Dashboard</h2>
          <p class="cm-page-sub" style="margin:0">Everything at a glance.</p>
        </div>
        <div class="cm-row" style="gap:8px">
          ${dashEditing ? `<button class="btn" id="dash-apps" aria-pressed="${dashApps}">${dashApps ? "Hide app cards" : "Show app cards"}</button>
            <button class="btn" id="dash-add">+ Add a block</button>` : ""}
          <button class="btn ${dashEditing ? "btn-save" : "btn-quiet"}"
                  id="dash-edit">${dashEditing ? "Done" : "Edit layout"}</button>
        </div>
      </div>
  
      ${appsStrip()}
      ${favouritesStrip()}

      <div class="dash-blocks ${dashEditing ? "editing" : ""}" id="dash-blocks">
        ${[0, 1, 2].map((c) => `
          <div class="dash-col" data-col="${c}">
            ${columnOf(blocks, c).map((b) => `
          <div class="dash-block" data-block="${escA(b.id)}">
            ${dashEditing ? `
              <div class="dash-block-tools">
                <span class="dash-tool dash-grip" title="Drag to move"
                      aria-label="Drag to move">&#8942;&#8942;</span>
                ${CONFIGURABLE.includes(b.type)
                  ? `<button class="dash-tool" data-config="${escA(b.id)}"
                       title="Settings">&#9881;</button>` : ""}
                <button class="dash-tool dash-tool-x" data-remove="${escA(b.id)}"
                        title="Remove">&#10005;</button>
              </div>` : ""}
            ${renderBlockBody(b)}
          </div>`).join("")}
            ${dashEditing && !columnIsFull(blocks, c)
              ? `<div class="dash-slot" data-slot-col="${c}">
                   ${columnOf(blocks, c).length ? "Space for one more" : "Empty column"}
                 </div>` : ""}
          </div>`).join("")}
        ${blocks.length ? "" : `<p class="cm-empty">No blocks yet \u2014 press
             <b>Edit layout</b> to add some.</p>`}
      </div>`;
  
    page.querySelector("#dash-edit").onclick = () => {
      dashEditing = !dashEditing;
      render();
    };
    const addBtn = page.querySelector("#dash-add");
    if (addBtn) addBtn.onclick = () => addBlockDialog();
  
    /* Cam: "drag and drop to reorder when in edit layout". The up and down
       arrows are gone: three buttons per block crowded the header so badly
       they sat on top of its own text. */
    if (dashEditing) wireBlockDragging(page);

    /* The covers arrive after the widget is drawn.

       `art` on a playlist or an album is the stored FILE NAME, not
       anything a page can load -- putting it in an <img src> made the
       browser ask for ui/album_al1.jpg and get nothing, which is why
       every cover was blank. The picture has to be fetched across the
       bridge, so the note placeholder is drawn first and replaced when
       each one lands. SS.Music.artURL goes through the app's one art
       cache, so a cover already fetched for the album shelf costs
       nothing here. */
    page.querySelectorAll(".dash-music-art[data-art]").forEach((slot) => {
      const music = window.SS && window.SS.Music;
      if (!music || typeof music.artURL !== "function") return;
      music.artURL(slot.dataset.art, 220).then((url) => {
        if (!url || !slot.isConnected) return;
        const note = slot.querySelector(".dash-music-note");
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        if (note) note.replaceWith(img);
        else slot.insertBefore(img, slot.firstChild);
      }).catch(() => { /* no cover is the placeholder, which is already there */ });
    });

    page.querySelectorAll("[data-shelf]").forEach((tab) =>
      tab.addEventListener("click", async () => {
        const arr = blocksOrDefault();
        const block = arr.find((x) => x.id === tab.dataset.block);
        if (!block) return;
        block.shelf = tab.dataset.shelf;
        dashBlocks = arr;
        await saveBlocks();
        render();
      }));

    const movieCard = page.querySelector("#dash-movie-card");
    if (movieCard) movieCard.addEventListener("click", () => {
      if (!dealtFilm || !dealtFilm.item) return;
      if (!filmTurned) {
        /* Turned in place rather than re-rendered, so the flip is seen. */
        filmTurned = true;
        movieCard.classList.add("turned");
        movieCard.title = "Open it on the Shelf";
        const card = movieCard.closest(".dash-movie");
        const h = card && card.querySelector(".dash-card-h b");
        if (h) h.textContent = dealtFilm.item.title;
        const sub = card && card.querySelector(".dash-movie-sub");
        if (sub) sub.textContent = `${dealtFilm.item.year ? dealtFilm.item.year + " · " : ""}press the cover to open it`;
        return;
      }
      window.SS.Shelf.openEntry(dealtFilm.item.id);
    });
    page.querySelectorAll("[data-pull-kind]").forEach((tab) =>
      tab.addEventListener("click", async () => {
        const arr = blocksOrDefault();
        const block = arr.find((x) => x.id === tab.dataset.block);
        if (!block || block.deckKind === tab.dataset.pullKind) return;
        block.deckKind = tab.dataset.pullKind;
        dashBlocks = arr;
        await saveBlocks();
        render();
      }));
    const pullCard = page.querySelector("#dash-pull-card");
    if (pullCard && !pullTurned) pullCard.addEventListener("click", () => {
      if (!pulled || !pulled.card) return;
      /* Turned in place first, so the flip is seen, then drawn open. */
      pullCard.classList.add("turned");
      pullTurned = true;
      setTimeout(render, 650);
    });
    const pullNoteBox = page.querySelector("#dash-pull-note");
    if (pullNoteBox) {
      pullNoteBox.addEventListener("input", () => { pullNote = pullNoteBox.value; });
      pullNoteBox.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); savePull(); }
      });
    }
    const pullSave = page.querySelector("#dash-pull-save");
    if (pullSave) pullSave.addEventListener("click", () => { pullSave.disabled = true; savePull(); });
    const pullAgain = page.querySelector("#dash-pull-again");
    if (pullAgain) pullAgain.addEventListener("click", async () => {
      if (pullNote.trim() && !pullSaved) {
        const yes = await window.SS.shared.confirm({title: "Pull another card?",
          body: "The journal entry you've started for this card won't be saved.", yes: "Pull another"});
        if (!yes) return;
      }
      dealPull(pulled.kind, pulled.card && pulled.card.id);
    });
    const toJournal = page.querySelector("#dash-pull-journal");
    if (toJournal) toJournal.addEventListener("click", (e) => { e.preventDefault(); window.SS.go("mind:journal"); });
    page.querySelectorAll("[data-go-div]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault(); window.SS.go("div:" + a.dataset.goDiv);
    }));

    const albumCard = page.querySelector("#dash-album-card");
    if (albumCard) albumCard.addEventListener("click", () => {
      const a = dealtAlbum && dealtAlbum.album;
      if (!a) return;
      if (!albumTurned) {
        /* Turned in place rather than re-rendered, so the flip is seen. */
        albumTurned = true;
        albumCard.classList.add("turned");
        albumCard.title = "Play it";
        albumCard.setAttribute("aria-label", "Play " + a.name);
        const card = albumCard.closest(".dash-album");
        const h = card && card.querySelector(".dash-card-h b");
        if (h) h.textContent = a.name;
        const sub = card && card.querySelector(".dash-movie-sub");
        if (sub) sub.textContent = [a.artist, `${a.count} track${a.count === 1 ? "" : "s"}`]
          .filter(Boolean).join(" · ") + " · press the cover to play";
        return;
      }
      window.SS.Music.play("album", a.id);
    });
    const albumAgain = page.querySelector("#dash-album-again");
    if (albumAgain) albumAgain.addEventListener("click", () =>
      dealAlbum(dealtAlbum && dealtAlbum.album && dealtAlbum.album.id));
    const albumGo = page.querySelector("#dash-album-go");
    // albums are Media's CDs now (2026-10-05): open this one's CD, or the CD covers
    if (albumGo) albumGo.addEventListener("click", (e) => {
      e.preventDefault();
      const id = dealtAlbum && dealtAlbum.album && dealtAlbum.album.id;
      if (id && window.SS.Shelf && window.SS.Shelf.openAlbum) window.SS.Shelf.openAlbum(id);
      else if (window.SS.Shelf && window.SS.Shelf.showCDs) window.SS.Shelf.showCDs();
      else window.SS.go("stuff:media");
    });

    const toShelf = page.querySelector("#dash-movie-shelf");
    if (toShelf) toShelf.addEventListener("click", (e) => { e.preventDefault(); window.SS.go("stuff:media"); });
    const movieAgain = page.querySelector("#dash-movie-again");
    if (movieAgain) movieAgain.addEventListener("click", () =>
      dealFilm(dealtFilm && dealtFilm.item && dealtFilm.item.id));

    const again = page.querySelector("#dash-circuit-again");
    if (again) again.addEventListener("click", async () => {
      const training = window.CP && window.CP.Training;
      if (!training) return;
      const next = await training.randomCircuit(shownCircuit && shownCircuit.id);
      if (next) { shownCircuit = next; render(); }
    });

    const qn = page.querySelector("#dash-qn-text");
    if (qn) {
      const saveNote = async () => {
        const text = qn.value.trim();
        if (!text) { toast("Nothing to save yet."); return; }
        const res = await (window.SS.Fleeting && window.SS.Fleeting.add(text));
        if (!res || res.error) { toast((res && res.error) || "That didn't save.", "error"); return; }
        qn.value = "";
        const hint = page.querySelector("#dash-qn-hint");
        if (hint) hint.textContent = `Saved as fleeting note ${res.n}.`;
        toast(`Saved as fleeting note ${res.n}.`);
        refreshFleetViewers(page);       // a viewer beside it shows the new one
      };
      page.querySelector("#dash-qn-save").addEventListener("click", saveNote);
      /* the desktop's sticky notes (2026-10-05): the same words, on the desktop */
      const sticky = page.querySelector("#dash-qn-sticky");
      if (sticky) sticky.addEventListener("click", async () => {
        const text = qn.value.trim();
        const hint = page.querySelector("#dash-qn-hint");
        if (!text) { if (hint) hint.textContent = "Write something first."; return; }
        const res = await SS.Store.call("sticky_add", [text], "Making a sticky note");
        if (res && res.ok) { qn.value = ""; if (hint) hint.textContent = "On your desktop as a sticky note."; toast("On your desktop as a sticky note."); }
        else toast((res && res.error) || "Couldn't make the sticky note.", "error");
      });
      qn.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveNote();
      });
      const open = page.querySelector("#dash-qn-open");
      if (open) open.addEventListener("click", () => host.go("fleeting:list"));
    }

    wirePuzzles(page);
    wireQuickRecipes(page);
    wireFleetViewers(page);

    page.querySelectorAll("[data-play-id]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const music = window.SS && window.SS.Music;
        if (music && music.play) music.play(btn.dataset.play, btn.dataset.playId);
      }));
  
    page.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", async () => {
        dashBlocks = blocksOrDefault().filter((x) => x.id !== b.dataset.remove);
        await saveBlocks();
        render();
      }));
  
    page.querySelectorAll("[data-config]").forEach((b) =>
      b.addEventListener("click", () => {
        const block = blocksOrDefault().find((x) => x.id === b.dataset.config);
        if (!block) return;
        if (block.type === "countdown") countdownDialog(block);
        else if (block.type === "notice") noticeDialog(block);
        else if (block.type === "album") albumBlockDialog(block);
        else framePickerDialog(block);
      }));
  
    page.querySelectorAll("[data-fav-go]").forEach((card) =>
      card.addEventListener("click", () => host.go(card.dataset.favGo)));
    page.querySelectorAll("[data-app-go]").forEach((card) =>
      card.addEventListener("click", () => SS.openSection(card.dataset.appGo)));
    const appsBtn = page.querySelector("#dash-apps");
    if (appsBtn) appsBtn.onclick = async () => {
      dashApps = !dashApps;
      renderDashboard(page);
      await SS.Store.setPrefs({dashApps});
    };
    wireDashboardBlocks(page, blocks);
  }
  
  /** The music block: the playlists and albums Cam already has, each one
      click from playing. Nothing is stored here but which shelf is showing --
      the lists come from Chords itself every time it draws, so a playlist
      renamed there reads correctly here. */
  function musicBlockBody(b) {
    const music = window.SS && window.SS.Music;
    if (!music || !music.shelves) {
      return `<div class="panel dash-card">
        <div class="dash-card-h"><b>Music</b></div>
        <p class="cm-page-sub">The music library isn't loaded.</p></div>`;
    }
    const shelves = music.shelves();
    const showing = b.shelf === "albums" ? "albums" : "playlists";
    const items = shelves[showing] || [];
    return `<div class="panel dash-card dash-music">
      <div class="dash-card-h">
        <b>Music</b>
        <div class="dash-music-tabs" role="group" aria-label="Playlists or albums">
          <button class="dash-music-tab ${showing === "playlists" ? "on" : ""}"
                  data-shelf="playlists" data-block="${escA(b.id)}">Playlists</button>
          <button class="dash-music-tab ${showing === "albums" ? "on" : ""}"
                  data-shelf="albums" data-block="${escA(b.id)}">Albums</button>
        </div>
      </div>
      ${items.length ? `<div class="dash-music-grid">
        ${items.slice(0, 12).map((it) => `
          <button class="dash-music-item" data-play="${showing === "albums" ? "album" : "playlist"}"
                  data-play-id="${escA(it.id)}" title="Play ${escA(it.name)}">
            <span class="dash-music-art"${it.art ? ` data-art="${escA(it.art)}"` : ""}>
              <span class="dash-music-note">\u266A</span>
              <span class="dash-music-play">\u25B6</span>
            </span>
            <span class="dash-music-name">${esc(it.name)}</span>
            <span class="dash-music-sub">${it.count} track${it.count === 1 ? "" : "s"}</span>
          </button>`).join("")}
      </div>`
      : `<p class="cm-page-sub">No ${showing} yet \u2014 make one in Music.</p>`}
    </div>`;
  }

  /** Blocks are dragged into place while the layout is being edited.
      Ordinary HTML drag events: they give the threshold, the ghost and the
      give-up-on-escape behaviour for free. */

  /* ---- placing a widget ---------------------------------------------------

     Cam: "3 collums with the ability to add 3 widgets into each collumn."

     A drag picks a COLUMN and a PLACE in it -- there is nothing else to get
     right, no size to fight with. The column under the pointer highlights and
     a line shows where the widget will sit; a column already holding three
     says so rather than taking a fourth. */
  let draggingBlock = null;

  function columnUnder(page, clientX) {
    const cols = [...page.querySelectorAll(".dash-col")];
    for (const el of cols) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return el;
    }
    return null;
  }

  /** How far down the column the widget would go. */
  function slotUnder(colEl, clientY, movingId) {
    const cards = [...colEl.querySelectorAll("[data-block]")]
      .filter((c) => c.dataset.block !== movingId);
    let slot = cards.length;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      if (clientY < r.top + r.height / 2 && slot > i) slot = i;
    });
    return slot;
  }

  function clearMarks(page) {
    page.querySelectorAll(".dash-col").forEach((el) =>
      el.classList.remove("is-target", "is-full"));
    page.querySelectorAll(".dash-block").forEach((el) =>
      el.classList.remove("drop-above", "drop-below"));
  }

  function wireBlockDragging(page) {
    const wrap = page.querySelector("#dash-blocks");
    if (!wrap) return;

    wrap.querySelectorAll("[data-block]").forEach((card) => {
      const grip = card.querySelector(".dash-grip");
      if (!grip) return;
      grip.addEventListener("pointerdown", (e) => {
        const blocks = blocksOrDefault();
        const block = blocks.find((x) => x.id === card.dataset.block);
        if (!block) return;
        e.preventDefault();
        draggingBlock = block.id;
        card.classList.add("is-dragging");
        grip.setPointerCapture(e.pointerId);
        let want = null;

        const move = (ev) => {
          clearMarks(page);
          const colEl = columnUnder(page, ev.clientX);
          if (!colEl) { want = null; return; }
          const c = Number(colEl.dataset.col);
          const staying = c === block.col;
          if (!staying && columnIsFull(blocks, c)) {
            colEl.classList.add("is-full");   // three already: not this one
            want = null;
            return;
          }
          colEl.classList.add("is-target");
          const slot = slotUnder(colEl, ev.clientY, block.id);
          want = {col: c, slot};
          const cards = [...colEl.querySelectorAll("[data-block]")]
            .filter((x) => x.dataset.block !== block.id);
          if (cards[slot]) cards[slot].classList.add("drop-above");
          else if (cards.length) cards[cards.length - 1].classList.add("drop-below");
        };

        const up = async () => {
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
          card.classList.remove("is-dragging");
          clearMarks(page);
          if (!want || (want.col === block.col && want.slot === block.slot)) {
            draggingBlock = null;
            return;                          // a click, or back where it was
          }
          /* Take it out of its old column, then open a place in the new one:
             done in that order, the widget can move within its own column
             without tripping over itself. */
          const from = block.col;
          block.col = want.col;
          const others = columnOf(blocks, want.col).filter((b) => b.id !== block.id);
          others.splice(Math.min(want.slot, others.length), 0, block);
          others.forEach((b, i) => { b.slot = i; });
          columnOf(blocks, from).forEach((b, i) => { b.slot = i; });
          draggingBlock = null;
          dashBlocks = blocks;
          await saveBlocks();
          render();
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      });
    });
  }

  /* ---- Random movie ---------------------------------------------------------
     A film off the Shelf, dealt face down. The first press turns it over;
     pressing the cover then opens its Shelf entry. ↻ deals another, face down
     again. Held here, like the circuit, so dealing is not a layout change. */
  let dealtFilm = null;          // {item, cover, plain}
  let filmTurned = false;
  let filmDealing = false;

  function dealFilm(notId) {
    if (!window.SS.Shelf || filmDealing) return;
    filmDealing = true;
    window.SS.Shelf.randomFilm(notId).then((f) => {
      filmDealing = false;
      dealtFilm = f || {none: true};
      filmTurned = false;
      render();
    }, () => { filmDealing = false; });
  }

  function randomMovieBlockBody() {
    if (!window.SS.Shelf) {
      return `<div class="panel dash-card"><div class="dash-card-h"><b>Random movie</b></div>
        <p class="cm-page-sub">The Shelf isn't loaded.</p></div>`;
    }
    if (!dealtFilm) dealFilm(null);
    const f = dealtFilm && !dealtFilm.none ? dealtFilm : null;
    const it = f && f.item;
    return `<div class="panel dash-card dash-movie">
      <div class="dash-card-h"><b>${filmTurned && it ? esc(it.title) : "Random movie"}</b>
        ${f ? `<button class="btn btn-quiet dash-circuit-again" id="dash-movie-again"
          title="Deal another, face down">Another</button>` : ""}</div>
      ${dealtFilm && dealtFilm.none
        ? `<p class="cm-page-sub">No films in Media yet. Add DVDs, Blu-rays or tapes in
            M&amp;T → Media. <a href="#" id="dash-movie-shelf">Open Media &rarr;</a></p>`
        : !f ? `<p class="cm-page-sub">Dealing…</p>`
        : `<div class="dash-movie-stage">
            <button class="dash-movie-card ${filmTurned ? "turned" : ""}" id="dash-movie-card"
              aria-label="${filmTurned ? `Open ${escA(it.title)} on the Shelf` : "Turn the card over"}"
              title="${filmTurned ? "Open it on the Shelf" : "Turn it over"}">
              <span class="dash-movie-face dash-movie-back"><span>?</span></span>
              <span class="dash-movie-face dash-movie-front">${f.cover
                ? `<img src="${escA(f.cover)}" alt="">` : f.plain}</span>
            </button>
          </div>
          <p class="cm-page-sub dash-movie-sub">${filmTurned
            ? `${it.year ? `${esc(it.year)} · ` : ""}press the cover to open it`
            : "Press to turn it over"}</p>`}
    </div>`;
  }

  /* ---- Random album ---------------------------------------------------------
     The Random movie again, for music: an album dealt face down. The first
     press turns it over; pressing the cover then plays the album, through
     the same SS.Music.play the music widget and the album shelf use. The
     card is the movie card made square, with a disc on its back. */
  let dealtAlbum = null;         // {album, cover} | {none: true}
  let albumTurned = false;
  let albumDealing = false;

  async function dealAlbum(notId) {
    const music = window.SS && window.SS.Music;
    if (!music || albumDealing) return;
    albumDealing = true;
    try {
      if (music.start) await music.start();
      const all = ((music.shelves() || {}).albums || []).filter((a) => a.count > 0);
      if (!all.length) { dealtAlbum = {none: true}; return; }
      const pool = all.length > 1 && notId ? all.filter((a) => a.id !== notId) : all;
      const album = pool[Math.floor(Math.random() * pool.length)];
      const cover = album.art ? await music.artURL(album.art, 320).catch(() => null) : null;
      dealtAlbum = {album, cover};
      albumTurned = false;
    } finally {
      albumDealing = false;
      render();
    }
  }

  function randomAlbumBlockBody() {
    if (!window.SS.Music) {
      return `<div class="panel dash-card"><div class="dash-card-h"><b>Random album</b></div>
        <p class="cm-page-sub">Music isn't loaded.</p></div>`;
    }
    if (!dealtAlbum && !albumDealing) dealAlbum(null);
    const d = dealtAlbum && !dealtAlbum.none ? dealtAlbum : null;
    const a = d && d.album;
    const sub = (x) => [x.artist, `${x.count} track${x.count === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
    return `<div class="panel dash-card dash-movie dash-album">
      <div class="dash-card-h"><b>${albumTurned && a ? esc(a.name) : "Random album"}</b>
        ${d ? `<button class="btn btn-quiet dash-circuit-again" id="dash-album-again"
          title="Deal another, face down">Another</button>` : ""}</div>
      ${dealtAlbum && dealtAlbum.none
        ? `<p class="cm-page-sub">No albums yet. <a href="#" id="dash-album-go">Open the CDs in Media &rarr;</a></p>`
        : !d ? `<p class="cm-page-sub">Dealing…</p>`
        : `<div class="dash-movie-stage">
            <button class="dash-movie-card dash-album-card ${albumTurned ? "turned" : ""}" id="dash-album-card"
              aria-label="${albumTurned ? `Play ${escA(a.name)}` : "Turn the album over"}"
              title="${albumTurned ? "Play it" : "Turn it over"}">
              <span class="dash-movie-face dash-movie-back"><span></span></span>
              <span class="dash-movie-face dash-movie-front">${d.cover
                ? `<img src="${escA(d.cover)}" alt="">`
                : `<span class="dash-album-plain"><b>${esc(a.name)}</b></span>`}</span>
            </button>
          </div>
          <p class="cm-page-sub dash-movie-sub">${albumTurned
            ? `${esc(sub(a))} · press the cover to play`
            : "Press to turn it over"}</p>`}
    </div>`;
  }

  /* ---- Random pull ----------------------------------------------------------
     One card from a random deck of the chosen kind, dealt face down like the
     Random movie. Turning it shows it upright or reversed -- an even chance,
     as Divination's own draws are -- with what it means that way up, and a
     box for a quick journal entry that is saved to Mindfulness → Journal
     with the card. The kind is the block's own setting (like Music's tabs); the card
     on show is held here, so dealing is not a layout change. */
  const PULL_KINDS = [["tarot", "Tarot"], ["oracle", "Oracle"], ["lenormand", "Lenormand"]];
  let pulled = null;        // {kind, deck, card, reversed, face, back} | {kind, none}
  let pullTurned = false;
  let pullDealing = false;
  let pullNote = "";
  let pullSaved = false;

  function plainCardText(v) {
    if (Array.isArray(v)) {
      return v.map((r) => Array.isArray(r) ? (typeof r[0] === "string" ? r[0] : "")
        : typeof r === "string" ? r : "").join("").trim();
    }
    return typeof v === "string" ? v.trim() : "";
  }

  async function dealPull(kind, notCardId) {
    if (pullDealing) return;
    pullDealing = true;
    try {
      const raw = (await window.SS.Store.call("cards_read_json", ["celestial.json"], "")) || {};
      const decks = (raw[kind + "Decks"] || []).filter((d) => d && (d.cards || []).length);
      if (!decks.length) { pulled = {kind, none: true}; return; }
      const deck = decks[Math.floor(Math.random() * decks.length)];
      let pool = deck.cards;
      if (pool.length > 1 && notCardId) pool = pool.filter((c) => c.id !== notCardId);
      const card = pool[Math.floor(Math.random() * pool.length)];
      const thumb = (name) => name
        ? window.SS.Store.call("cards_thumb_url", [name, 400], "").then((u) => (typeof u === "string" ? u : null))
        : Promise.resolve(null);
      const [face, back] = await Promise.all([thumb(card.image), thumb(deck.cardBack)]);
      pulled = {kind, deck, card, reversed: Math.random() < 0.5, face, back};
    } catch (e) {
      pulled = {kind, none: true};
    } finally {
      pullDealing = false;
      pullTurned = false; pullNote = ""; pullSaved = false;
      render();
    }
  }

  function randomPullBlockBody(b) {
    const kind = PULL_KINDS.some(([k]) => k === b.deckKind) ? b.deckKind : "tarot";
    if (!pulled || pulled.kind !== kind) {
      if (!pullDealing) dealPull(kind, null);
    }
    const p = pulled && pulled.kind === kind && !pulled.none ? pulled : null;
    const tabs = `<div class="dash-music-tabs dash-pull-tabs" role="group" aria-label="Kind of deck">
      ${PULL_KINDS.map(([k, label]) => `<button class="dash-music-tab ${k === kind ? "on" : ""}"
        data-pull-kind="${k}" data-block="${escA(b.id)}">${label}</button>`).join("")}</div>`;
    const head = `<div class="dash-card-h"><b>${pullTurned && p ? esc(p.card.name) : "Random pull"}</b>
      ${tabs}</div>`;
    if (pulled && pulled.kind === kind && pulled.none) {
      return `<div class="panel dash-card dash-pull">${head}
        <p class="cm-page-sub">No ${esc(kind)} decks with cards yet.
          <a href="#" data-go-div="${kind}">Open Divination &rarr;</a></p></div>`;
    }
    if (!p) return `<div class="panel dash-card dash-pull">${head}<p class="cm-page-sub">Shuffling…</p></div>`;
    const meaning = plainCardText(p.reversed ? p.card.reversed : p.card.upright)
      || plainCardText(p.card.synopsis);
    const card = `<button class="dash-pull-card ${pullTurned ? "turned" : ""}" id="dash-pull-card"
        aria-label="${pullTurned ? escA(p.card.name) : "Turn the card over"}"
        title="${pullTurned ? escA(p.card.name) : "Turn it over"}">
        <span class="dash-pull-face dash-pull-back">${p.back
          ? `<img src="${escA(p.back)}" alt="">` : `<span>✦</span>`}</span>
        <span class="dash-pull-face dash-pull-front ${p.reversed ? "rev" : ""}">${p.face
          ? `<img src="${escA(p.face)}" alt="">` : `<b>${esc(p.card.name)}</b>`}</span>
      </button>`;
    if (!pullTurned) {
      return `<div class="panel dash-card dash-pull">${head}
        <div class="dash-pull-stage">${card}</div>
        <p class="cm-page-sub dash-pull-sub">From ${esc(p.deck.name)} · press to turn it over</p>
      </div>`;
    }
    return `<div class="panel dash-card dash-pull dash-pull-open">${head}
      <div class="dash-pull-body">
        <div class="dash-pull-stage">${card}</div>
        <div class="dash-pull-text">
          <p class="dash-pull-way ${p.reversed ? "rev" : ""}">${p.reversed ? "Reversed" : "Upright"}</p>
          <p class="dash-pull-deck">${esc(p.deck.name)}${p.card.suit ? ` · ${esc(p.card.suit)}` : ""}</p>
          ${meaning ? `<p class="dash-pull-meaning">${esc(meaning)}</p>`
            : `<p class="dash-pull-meaning dash-pull-none">Nothing written for this card yet.</p>`}
        </div>
      </div>
      ${pullSaved ? `<p class="dash-pull-saved">Saved to your journal.
          <a href="#" id="dash-pull-journal">Open Journal &rarr;</a></p>`
        : `<textarea class="input dash-pull-note" id="dash-pull-note" rows="2"
            placeholder="A quick journal entry… (Ctrl+Enter saves)">${esc(pullNote)}</textarea>`}
      <div class="dash-pull-acts">
        <button class="btn btn-quiet btn-sm" id="dash-pull-again" title="Shuffle and pull another, face down">Another</button>
        ${pullSaved ? "" : `<button class="btn btn-primary btn-sm" id="dash-pull-save">Save to Journal</button>`}
      </div>
    </div>`;
  }

  async function savePull() {
    const p = pulled;
    const journal = window.SS.Journal;
    if (!p || !p.card || !journal) {
      window.SS.shared.toast("The journal isn't loaded.", "error");
      return;
    }
    const reading = {
      kind: p.kind, deckName: p.deck.name, spreadName: "Random pull",
      cards: [{name: p.card.name, image: p.card.image || null, reversed: p.reversed,
               positionLabel: "", meaning: plainCardText(p.reversed ? p.card.reversed : p.card.upright)}],
    };
    const title = `${p.card.name}${p.reversed ? " (reversed)" : ""} · ${p.deck.name}`;
    const res = await journal.addReading(reading, pullNote.trim(), title);
    if (!res || res.error) {
      window.SS.shared.toast((res && res.error) || "That didn't save.", "error");
      return;
    }
    pullSaved = true;
    pullNote = "";
    render();
  }

  /* The circuit on show. Held here rather than in the block, so picking
     another one does not count as a change to the layout and does not write
     the dashboard to disk every time Cam presses the button. */
  let shownCircuit = null;
  let circuitLoading = false;

  function circuitBlockBody() {
    const training = window.CP && window.CP.Training;
    if (!training || !training.randomCircuit) {
      return `<div class="panel dash-card">
        <div class="dash-card-h"><b>Random circuit</b></div>
        <p class="cm-page-sub">Training isn't loaded.</p></div>`;
    }
    if (!shownCircuit && !circuitLoading) {
      circuitLoading = true;
      training.randomCircuit(null).then((c) => {
        circuitLoading = false;
        if (!c) return;
        shownCircuit = c;
        render();
      });
    }
    const c = shownCircuit;
    return `<div class="panel dash-card dash-circuit">
      <div class="dash-card-h">
        <b>${c ? esc(c.name || "Circuit") : "Random circuit"}</b>
        <button class="btn btn-quiet dash-circuit-again" id="dash-circuit-again"
                title="Show another">Another</button>
      </div>
      ${c ? `
        <div class="dash-circuit-meta">
          ${c.type ? `<span>${esc(c.type)}</span>` : ""}
          ${c.rounds ? `<span>${esc(c.rounds)} rounds</span>` : ""}
          ${c.timeCap ? `<span>${esc(c.timeCap)}</span>` : ""}
          <span>${(c.stations || []).length} station${(c.stations || []).length === 1 ? "" : "s"}</span>
        </div>
        <div class="dash-circuit-scroll">
          ${(c.stations || []).length ? `<ol class="dash-circuit-list">
            ${(c.stations || []).map((s) => `
              <li>
                <span class="dash-circuit-name">${esc(s.name || "Station")}</span>
                <span class="dash-circuit-sub">${[
                  s.workTime, s.reps ? `${esc(s.reps)} reps` : "", s.load, s.category,
                ].filter(Boolean).map(esc).join(" \u00b7 ")}</span>
              </li>`).join("")}
          </ol>` : `<p class="cm-page-sub">This circuit has no stations.</p>`}
          ${c.notes ? `<p class="dash-circuit-notes">${esc(c.notes)}</p>` : ""}
        </div>`
      : `<p class="cm-page-sub">Finding a circuit\u2026</p>`}
    </div>`;
  }
  function quickNoteBlockBody() {
    return `<div class="panel dash-card dash-quicknote">
      <div class="dash-card-h">
        <b>Quick note</b>
        <button class="btn btn-quiet" id="dash-qn-open"
                title="See everything in Fleeting">Fleeting \u2192</button>
      </div>
      <textarea class="input dash-qn-text" id="dash-qn-text" rows="3"
                placeholder="A quick thought\u2026"></textarea>
      <div class="dash-qn-row">
        <span class="dash-qn-hint" id="dash-qn-hint">Ctrl+Enter saves</span>
        <button class="btn btn-quiet" id="dash-qn-sticky"
                title="Put it on the desktop as a sticky note">Sticky note</button>
        <button class="btn btn-primary" id="dash-qn-save">Save</button>
      </div>
    </div>`;
  }

  /* ---- Puzzle ---------------------------------------------------------------

     Cam: "Puzzle - Ability to generate sudoku, kakuro, minesweeper and if
     possible word search on the dashboard."

     Nothing here makes a puzzle. Cranium already generates all four, and
     promises every Sudoku and Kakuro has exactly one solution, so the widget
     asks Cranium's engines (window.CRGames) and only draws and plays them,
     small enough for one widget: an easy Sudoku, a small Kakuro, a beginner
     minefield, a ten-by-ten word search.

     Each block keeps one game of every kind, so flicking to Minesweeper and
     back does not throw away a half-done Sudoku. The games live here rather
     than in the block: a move is not a change to the layout, and saving the
     dashboard on every keypress would be absurd. Which tab is showing IS
     saved, like the music block's shelf. A game in progress does not outlive
     the app.

     Every move repaints this one widget, never the dashboard: a full render
     would restart the photo frames and take focus away mid-puzzle. */
  const PUZZLE_KINDS = [
    {key: "sudoku", name: "Sudoku"},
    {key: "kakuro", name: "Kakuro"},
    {key: "mines", name: "Mines"},
    {key: "words", name: "Words"},
  ];
  const puzzleGames = new Map();      // block id -> {sudoku, kakuro, mines, words}

  const puzzleKind = (b) =>
    PUZZLE_KINDS.some((k) => k.key === b.kind) ? b.kind : "sudoku";

  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function newPuzzle(kind) {
    const G = window.CRGames;
    if (kind === "sudoku") {
      const p = G.Sudoku.generate("easy");
      return {puzzle: p.puzzle, grid: p.puzzle.slice(), sel: null, won: false};
    }
    if (kind === "kakuro") {
      const p = G.Kakuro.generate("small");
      if (!p) return null;
      return {puzzle: p, grid: p.walls.map((row) => row.map(() => 0)),
              sel: null, won: false};
    }
    if (kind === "mines") return {board: G.Minesweeper.create("beginner")};
    /* A word search from one of Cranium's own lists. Ten across is what fits
       a widget, so a word longer than that sits this one out. */
    const lists = (G.WS_PRESETS || []).filter((l) =>
      l.words.filter((w) => w.length <= 10).length >= 6);
    if (!lists.length) return null;
    const list = lists[Math.floor(Math.random() * lists.length)];
    const words = shuffled(list.words.filter((w) => w.length <= 10)).slice(0, 8);
    const p = G.WordSearch.generate(words, {size: 10, difficulty: "medium"});
    return {puzzle: p, name: list.name, found: new Set(), from: null};
  }

  function puzzleGame(id, kind) {
    let games = puzzleGames.get(id);
    if (!games) { games = {}; puzzleGames.set(id, games); }
    if (!games[kind]) games[kind] = newPuzzle(kind);
    return games[kind];
  }

  function puzzleBlockBody(b) {
    const G = window.CRGames;
    if (!G || !G.Sudoku || !G.Kakuro || !G.Minesweeper || !G.WordSearch) {
      return `<div class="panel dash-card">
        <div class="dash-w-h"><b>Puzzle</b></div>
        <p class="cm-page-sub">Puzzles aren't loaded.</p></div>`;
    }
    const kind = puzzleKind(b);
    /* tabindex so the card itself can take the keyboard: digits and arrows
       go to the Sudoku or Kakuro without a text box to click into first. */
    return `<div class="panel dash-card dash-pz" data-pz="${escA(b.id)}"
                 data-pz-kind="${kind}" tabindex="0">
      <div class="dash-w-h">
        <div class="dash-music-tabs dash-pz-tabs" role="group" aria-label="Which puzzle">
          ${PUZZLE_KINDS.map((k) => `
            <button class="dash-music-tab ${k.key === kind ? "on" : ""}"
                    data-pz-tab="${k.key}">${k.name}</button>`).join("")}
        </div>
        <button class="btn btn-quiet dash-circuit-again" data-pz-new
                title="A fresh puzzle">New</button>
      </div>
      <div class="dash-pz-play">${puzzleInner(b.id, kind)}</div>
    </div>`;
  }

  function puzzleInner(id, kind) {
    const g = puzzleGame(id, kind);
    if (!g) {
      return `<p class="cm-page-sub">Couldn't build one — press New to try again.</p>`;
    }
    if (kind === "sudoku") return sudokuHtml(g);
    if (kind === "kakuro") return kakuroHtml(g);
    if (kind === "mines") return minesHtml(g);
    return wordsHtml(g);
  }

  const digitPad = () => `<div class="dash-pz-pad">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      `<button type="button" data-pz-digit="${n}">${n}</button>`).join("")}
    <button type="button" data-pz-digit="0" title="Clear">⌫</button>
  </div>`;

  const solvedFoot = `<p class="dash-pz-foot dash-pz-won">Solved — press New for another.</p>`;

  function sudokuHtml(g) {
    const bad = window.CRGames.Sudoku.conflicts(g.grid);
    const cells = g.grid.map((v, i) => {
      const r = Math.floor(i / 9), c = i % 9;
      const cls = ["dash-pz-cell",
        g.puzzle[i] ? "given" : "",
        g.sel === i ? "sel" : "",
        bad.has(i) ? "bad" : "",
        c === 2 || c === 5 ? "edge-r" : "",
        r === 2 || r === 5 ? "edge-b" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-pz-cell="${i}"
                      tabindex="-1">${v || ""}</button>`;
    }).join("");
    return `<div class="dash-pz-board dash-pz-sudoku">${cells}</div>
      ${g.won ? solvedFoot : digitPad()}`;
  }

  function kakuroHtml(g) {
    const p = g.puzzle;
    const bad = window.CRGames.Kakuro.conflicts(p, g.grid);
    let cells = "";
    for (let r = 0; r < p.rows; r++) {
      for (let c = 0; c < p.cols; c++) {
        if (p.walls[r][c]) {
          const clue = p.clues[r][c];
          /* The usual Kakuro split: the run going right is above the
             diagonal, the run going down below it. */
          cells += clue
            ? `<div class="dash-kk-clue">
                 <span class="dash-kk-right">${clue.right || ""}</span>
                 <span class="dash-kk-down">${clue.down || ""}</span></div>`
            : `<div class="dash-kk-wall"></div>`;
          continue;
        }
        const key = `${r},${c}`;
        const cls = ["dash-pz-cell", g.sel === key ? "sel" : "",
          bad.has(key) ? "bad" : ""].filter(Boolean).join(" ");
        cells += `<button type="button" class="${cls}" data-pz-cell="${key}"
                          tabindex="-1">${g.grid[r][c] || ""}</button>`;
      }
    }
    return `<div class="dash-pz-board dash-pz-kakuro"
                 style="grid-template-columns:repeat(${p.cols}, 1fr)">${cells}</div>
      ${g.won ? solvedFoot : digitPad()}`;
  }

  function minesHtml(g) {
    const b = g.board;
    const M = window.CRGames.Minesweeper;
    const cells = b.revealed.map((open, i) => {
      let text = "", cls = "dash-pz-cell dash-ms";
      if (open) {
        cls += " open";
        if (b.mine[i]) { cls += " boom"; text = "✹"; }
        else if (b.adjacent[i]) { cls += " n" + b.adjacent[i]; text = b.adjacent[i]; }
      } else if (b.flagged[i]) {
        cls += " flag"; text = "⚑";
      }
      return `<button type="button" class="${cls}" data-pz-cell="${i}"
                      tabindex="-1">${text}</button>`;
    }).join("");
    const foot = b.dead ? "Boom — press New for another board."
      : b.won ? "Cleared — every mine found."
      : `Mines left <b>${M.minesLeft(b)}</b> · right-click to flag`;
    return `<div class="dash-pz-board dash-pz-mines"
                 style="grid-template-columns:repeat(${b.cols}, 1fr)">${cells}</div>
      <p class="dash-pz-foot ${b.won ? "dash-pz-won" : ""}">${foot}</p>`;
  }

  function wordsHtml(g) {
    const p = g.puzzle;
    const foundCells = new Set();
    for (const w of p.placed) {
      if (g.found.has(w.word)) w.cells.forEach(([r, c]) => foundCells.add(`${r},${c}`));
    }
    const from = g.from ? g.from.join(",") : "";
    let cells = "";
    for (let r = 0; r < p.size; r++) {
      for (let c = 0; c < p.size; c++) {
        const key = `${r},${c}`;
        const cls = ["dash-pz-cell dash-ws", foundCells.has(key) ? "found" : "",
          key === from ? "sel" : ""].filter(Boolean).join(" ");
        cells += `<button type="button" class="${cls}" data-pz-cell="${key}"
                          tabindex="-1">${esc(p.grid[r][c])}</button>`;
      }
    }
    const all = p.placed.length && p.placed.every((w) => g.found.has(w.word));
    return `<div class="dash-pz-board dash-pz-words"
                 style="grid-template-columns:repeat(${p.size}, 1fr)">${cells}</div>
      <p class="dash-pz-foot ${all ? "dash-pz-won" : ""}">${all
        ? "All found — press New for another."
        : `${esc(g.name)} · click first letter, then last`}</p>
      <div class="dash-ws-list">
        ${p.placed.map((w) => `<span class="${g.found.has(w.word) ? "found" : ""}"
          >${esc(w.word)}</span>`).join("")}
      </div>`;
  }

  /** A click on a cell: select it, reveal it, or finish a word. */
  function puzzleCellClick(g, kind, key) {
    const G = window.CRGames;
    if (kind === "sudoku") { if (!g.won) g.sel = Number(key); return; }
    if (kind === "kakuro") { if (!g.won) g.sel = key; return; }
    if (kind === "mines") {
      const i = Number(key);
      /* A number already open "chords": its flags are trusted and the rest
         of its neighbours open at once, as in every proper Minesweeper. */
      if (g.board.revealed[i]) G.Minesweeper.chord(g.board, i);
      else G.Minesweeper.reveal(g.board, i);
      return;
    }
    const at = key.split(",").map(Number);
    if (!g.from || g.from.join(",") === key) {
      g.from = g.from ? null : at;          // the same letter twice lets go of it
      return;
    }
    const line = G.WordSearch.lineBetween(g.from, at);
    /* Not in a straight line with the first letter: take this one as a
       fresh start rather than making Cam let go and click again. */
    if (!line) { g.from = at; return; }
    const hit = G.WordSearch.checkSelection(g.puzzle, line);
    if (hit) g.found.add(hit.word);
    g.from = null;
  }

  /** A digit (0 clears) into the selected Sudoku or Kakuro cell. */
  function puzzleDigit(g, kind, d) {
    const G = window.CRGames;
    if (!g || g.won || g.sel == null) return;
    if (kind === "sudoku") {
      if (g.puzzle[g.sel]) return;          // a given stays given
      g.grid[g.sel] = d;
      g.won = G.Sudoku.isComplete(g.grid);
    } else if (kind === "kakuro") {
      const [r, c] = g.sel.split(",").map(Number);
      g.grid[r][c] = d;
      g.won = G.Kakuro.isComplete(g.puzzle, g.grid);
    }
    if (g.won) g.sel = null;
  }

  /** Arrow keys walk the selection; Kakuro's step over its black squares. */
  function puzzleMove(g, kind, dr, dc) {
    if (!g || g.won) return;
    if (kind === "sudoku") {
      const i = g.sel == null ? 0 : g.sel;
      const r = Math.min(8, Math.max(0, Math.floor(i / 9) + dr));
      const c = Math.min(8, Math.max(0, i % 9 + dc));
      g.sel = r * 9 + c;
      return;
    }
    const p = g.puzzle;
    let [r, c] = g.sel ? g.sel.split(",").map(Number) : [0, 0];
    for (;;) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= p.rows || c >= p.cols) return;
      if (!p.walls[r][c]) { g.sel = `${r},${c}`; return; }
    }
  }

  const ARROWS = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};

  /** Once per game, the moment it is solved: App stats counts these beside
      Cranium's own, which the widget never writes to. */
  function countIfSolved(g, kind) {
    if (!g || g.counted) return;
    const done = kind === "mines" ? g.board.won
      : kind === "words" ? g.puzzle.placed.length > 0
        && g.puzzle.placed.every((w) => g.found.has(w.word))
      : g.won;
    if (!done) return;
    g.counted = true;
    SS.Store.call("usage_count", ["puzzle:dashboard-" + kind], "Counting a puzzle");
  }

  function wirePuzzles(page) {
    page.querySelectorAll("[data-pz]").forEach((card) => {
      const id = card.dataset.pz;
      const kind = () => card.dataset.pzKind;
      const game = () => puzzleGame(id, kind());
      const paint = () => {
        card.querySelector(".dash-pz-play").innerHTML = puzzleInner(id, kind());
      };
      /* Painting replaces the cell that was clicked, and focus goes with it;
         handing it back to the card keeps the keyboard on the puzzle. */
      const refocus = () => card.focus({preventScroll: true});

      card.addEventListener("click", async (e) => {
        const tab = e.target.closest("[data-pz-tab]");
        if (tab) {
          card.dataset.pzKind = tab.dataset.pzTab;
          card.querySelectorAll("[data-pz-tab]").forEach((t) =>
            t.classList.toggle("on", t === tab));
          paint();
          const arr = blocksOrDefault();
          const block = arr.find((x) => x.id === id);
          if (block && block.kind !== tab.dataset.pzTab) {
            block.kind = tab.dataset.pzTab;
            dashBlocks = arr;
            await saveBlocks();
          }
          return;
        }
        if (e.target.closest("[data-pz-new]")) {
          const games = puzzleGames.get(id);
          if (games) delete games[kind()];
          paint();
          refocus();
          return;
        }
        const digit = e.target.closest("[data-pz-digit]");
        if (digit) {
          puzzleDigit(game(), kind(), Number(digit.dataset.pzDigit));
          countIfSolved(game(), kind());
          paint();
          refocus();
          return;
        }
        const cell = e.target.closest("[data-pz-cell]");
        if (cell && game()) {
          puzzleCellClick(game(), kind(), cell.dataset.pzCell);
          countIfSolved(game(), kind());
          paint();
          refocus();
        }
      });

      card.addEventListener("contextmenu", (e) => {
        const cell = e.target.closest("[data-pz-cell]");
        if (!cell || kind() !== "mines" || !game()) return;
        e.preventDefault();
        window.CRGames.Minesweeper.toggleFlag(game().board, Number(cell.dataset.pzCell));
        paint();
      });

      card.addEventListener("keydown", (e) => {
        const k = kind();
        if (k !== "sudoku" && k !== "kakuro") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[1-9]$/.test(e.key)) puzzleDigit(game(), k, Number(e.key));
        else if (["0", "Backspace", "Delete"].includes(e.key)) puzzleDigit(game(), k, 0);
        else if (ARROWS[e.key]) puzzleMove(game(), k, ...ARROWS[e.key]);
        else return;
        countIfSolved(game(), k);
        /* The key was the puzzle's. Other screens listen on the whole
           document -- Training takes 1-9 as "jump to a section" -- and a
           digit typed into a Sudoku is not a shortcut. */
        e.preventDefault();
        e.stopPropagation();
        paint();
      });
    });
  }

  /* ---- Quick recipe ---------------------------------------------------------

     Cam: "3 simple options, each presented one at a time. First a place to
     type the title then press enter to get to the next one. The next one is
     for ingredients and should just be paste list then press enter, then
     same one for directions. Then on pressing enter it will save it to
     recipes and return to the start of the quick recipe menu. I can then go
     into recipe app later and fill in the additional detail."

     Enter moves on, because that is the whole ask. Shift+Enter still makes a
     new line, for anyone typing a list rather than pasting one. The pasted
     lists are split with the recipe builder's own splitter, so bullets and
     step numbers come off exactly as they would in Recipes.

     What is typed is held here as it is typed, so the dashboard redrawing
     for some other reason halfway through does not lose it. */
  const QR_STEPS = [
    {key: "title", label: "Title", hint: "Enter for the ingredients"},
    {key: "ingredients", label: "Ingredients",
     hint: "Paste the list, then Enter", placeholder: "Paste the ingredients…"},
    {key: "directions", label: "Directions",
     hint: "Paste the method, then Enter to save", placeholder: "Paste the directions…"},
  ];
  const quickRecipes = new Map();   // block id -> {step, title, ingredients, directions}

  function quickRecipeState(id) {
    if (!quickRecipes.has(id)) {
      quickRecipes.set(id, {step: 0, title: "", ingredients: "", directions: "", note: ""});
    }
    return quickRecipes.get(id);
  }

  function quickRecipeBlockBody(b) {
    return `<div class="panel dash-card dash-qr" data-qr="${escA(b.id)}">
      <div class="dash-w-h">
        <b>Quick recipe</b>
        <button class="btn btn-quiet dash-circuit-again" data-qr-open
                title="Open Recipes">Recipes →</button>
      </div>
      <div class="dash-qr-step">${quickRecipeInner(b.id)}</div>
    </div>`;
  }

  function quickRecipeInner(id) {
    const st = quickRecipeState(id);
    const step = QR_STEPS[st.step];
    return `<div class="dash-qr-steps">
        ${QR_STEPS.map((s, i) => `<span class="${i === st.step ? "on" : ""}
          ${i < st.step ? "done" : ""}">${i + 1}. ${s.label}</span>`).join("")}
      </div>
      ${st.step === 0
        ? `<input class="input dash-qr-field" data-qr-field
                  value="${escA(st.title)}" placeholder="Recipe title">`
        : `<div class="dash-qr-title">${esc(st.title)}</div>
           <textarea class="input dash-qr-field" data-qr-field rows="5"
             placeholder="${escA(step.placeholder)}">${esc(st[step.key])}</textarea>`}
      <div class="dash-qn-row">
        <span class="dash-qn-hint">${esc(st.note || step.hint)}</span>
        ${st.step > 0 ? `<button class="btn btn-quiet" data-qr-back>Back</button>` : ""}
        <button class="btn btn-primary" data-qr-next>${st.step === 2 ? "Save" : "Next"}</button>
      </div>`;
  }

  /** Into the Kitchen's recipes, in the same shape the recipe builder saves,
      with everything not asked for here left blank to fill in later. */
  async function saveQuickRecipe(st) {
    if (!kitchen.data) {
      toast("The Kitchen isn't loaded, so there's nowhere to save it.", "error");
      return false;
    }
    const cookery = window.CP && window.CP.Cookery;
    const split = (cookery && cookery.splitPastedLines)
      || ((t) => String(t || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
    if (!Array.isArray(kitchen.data.recipes)) kitchen.data.recipes = [];
    kitchen.data.recipes.push({
      id: newId(), created: new Date().toISOString(),
      name: st.title.trim(), tags: [], source: "", servings: "", images: [],
      description: "", ingredients: split(st.ingredients),
      steps: split(st.directions), notes: "",
    });
    await kitchen.save();
    return true;
  }

  function wireQuickRecipes(page) {
    page.querySelectorAll("[data-qr]").forEach((card) => {
      const id = card.dataset.qr;
      const box = card.querySelector(".dash-qr-step");
      const paint = () => {
        box.innerHTML = quickRecipeInner(id);
        const field = box.querySelector("[data-qr-field]");
        field.focus({preventScroll: true});
        field.setSelectionRange(field.value.length, field.value.length);
      };

      const advance = async () => {
        const st = quickRecipeState(id);
        if (st.saving) return;                  // Enter held down, or pressed twice
        if (st.step === 0 && !st.title.trim()) {
          toast("Give the recipe a title first.", "error");
          return;
        }
        if (st.step < 2) { st.step++; st.note = ""; paint(); return; }
        st.saving = true;
        const saved = await saveQuickRecipe(st);
        st.saving = false;
        if (!saved) return;
        const name = st.title.trim();
        quickRecipes.set(id, {step: 0, title: "", ingredients: "", directions: "",
                              note: `Saved “${name}” to Recipes.`});
        toast(`“${name}” saved to Recipes.`);
        paint();
      };

      card.addEventListener("input", (e) => {
        if (!e.target.matches("[data-qr-field]")) return;
        const st = quickRecipeState(id);
        st[QR_STEPS[st.step].key] = e.target.value;
      });
      card.addEventListener("keydown", (e) => {
        if (!e.target.matches("[data-qr-field]")) return;
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          advance();
        }
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-qr-next]")) advance();
        else if (e.target.closest("[data-qr-back]")) {
          const st = quickRecipeState(id);
          if (st.step > 0) { st.step--; paint(); }
        } else if (e.target.closest("[data-qr-open]")) host.go("recipes");
      });
    });
  }

  /* ---- Fleeting viewer ------------------------------------------------------

     Cam: "A viewer on the dashboard so i can navigate through the fleeting
     notes and read them from the widget window, it should be scrollable,
     further to view i should be able to delete from the viewer (Which will
     delete from the fleeting notes)."

     One note at a time, oldest first -- the head of the queue -- with the
     arrows (or the keyboard's) to walk it. Deleting goes through Fleeting's
     own delete, so the notes after it close up exactly as they do there; the
     viewer then stays at the same place in the queue, which is now the note
     that came next.

     The queue is re-read every time the dashboard draws, so a note jotted on
     the Fleeting screen or in Quick note is there without a restart. The
     last read is drawn first, so nothing flashes while it comes back. */
  let fleetNotes = null;            // the queue as last read; null before the first
  const fleetAt = new Map();        // block id -> which note is showing

  function fleetIndex(id) {
    const len = (fleetNotes || []).length;
    return Math.max(0, Math.min(len - 1, fleetAt.get(id) || 0));
  }

  /* Text size (2026-10-02). Cam: "Add settings to the fleeting notes viewer so
     i can scale up the text, ensure that the text box is scrollable so when it
     is to large i can scroll through it." A− / A+, kept on the block itself
     (like the Puzzle block's kind); the text box has a ceiling and scrolls. The
     desktop board's Fleeting card has the same steps (FleetingCard.qml). */
  const FV_SCALES = [1, 1.2, 1.4, 1.7, 2, 2.4];

  function fleetScale(id) {
    const b = blocksOrDefault().find((x) => x.id === id);
    const v = Number(b && b.textScale);
    return FV_SCALES.includes(v) ? v : 1;
  }

  async function fleetResize(id, d) {
    const blocks = blocksOrDefault();
    const b = blocks.find((x) => x.id === id);
    if (!b) return false;
    const i = FV_SCALES.indexOf(fleetScale(id));
    const j = Math.max(0, Math.min(FV_SCALES.length - 1, i + d));
    if (j === i) return false;
    b.textScale = FV_SCALES[j];
    dashBlocks = blocks;
    await saveBlocks();
    return true;
  }

  function fleetViewBlockBody(b) {
    return `<div class="panel dash-card dash-fv" data-fv="${escA(b.id)}"
                 tabindex="0">${fleetViewInner(b.id)}</div>`;
  }

  function fleetViewInner(id) {
    const notes = fleetNotes;
    const at = fleetIndex(id);
    const many = notes && notes.length;
    const head = `<div class="dash-w-h">
      <b>Fleeting</b>
      <span class="dash-fv-nav">
        <button class="btn btn-quiet dash-circuit-again" data-fv-step="-1"
                title="Previous note" ${many && at > 0 ? "" : "disabled"}>‹</button>
        <span class="dash-fv-count">${many ? `${at + 1} of ${notes.length}` : ""}</span>
        <button class="btn btn-quiet dash-circuit-again" data-fv-step="1"
                title="Next note" ${many && at < notes.length - 1 ? "" : "disabled"}>›</button>
      </span>
    </div>`;
    if (!notes) return head + `<p class="cm-page-sub">Reading the queue…</p>`;
    if (!notes.length) {
      return head + `<p class="cm-page-sub">No fleeting notes. Anything jotted in
        Quick note or on the Fleeting screen shows up here.</p>`;
    }
    const n = notes[at];
    const when = n.written ? new Date(n.written * 1000).toLocaleString() : "";
    const scale = fleetScale(id);
    return head + `
      <div class="dash-fv-meta">Fleeting note ${n.n}${when ? ` · ${esc(when)}` : ""}</div>
      <div class="dash-fv-text" style="font-size:calc(0.875rem * ${scale})">${esc(n.text).replace(/\n/g, "<br>") || "<i>Empty</i>"}</div>
      <div class="dash-qn-row">
        <button class="btn btn-quiet" data-fv-open title="See them all">Fleeting →</button>
        <span class="dash-fv-size">
          <button class="btn btn-quiet" data-fv-size="-1" title="Smaller text"
                  ${scale > FV_SCALES[0] ? "" : "disabled"}>A−</button>
          <button class="btn btn-quiet" data-fv-size="1" title="Bigger text"
                  ${scale < FV_SCALES[FV_SCALES.length - 1] ? "" : "disabled"}>A+</button>
        </span>
        <span class="dash-qn-hint"></span>
        <button class="btn btn-danger" data-fv-del>Delete</button>
      </div>`;
  }

  const paintFleetViewer = (card) => { card.innerHTML = fleetViewInner(card.dataset.fv); };

  async function refreshFleetViewers(root) {
    if (!root.querySelector("[data-fv]") || !SS.Fleeting || !SS.Fleeting.list) return;
    const got = await SS.Fleeting.list();
    fleetNotes = Array.isArray(got) ? got : [];
    root.querySelectorAll("[data-fv]").forEach(paintFleetViewer);
  }

  async function deleteShownFleeting(card) {
    const note = (fleetNotes || [])[fleetIndex(card.dataset.fv)];
    if (!note || !SS.Fleeting || !SS.Fleeting.remove) return;
    const text = note.text || "";
    const yes = await confirmDlg({
      title: `Delete fleeting note ${note.n}?`,
      body: (text ? `“${text.slice(0, 90)}${text.length > 90 ? "…" : ""}”`
        : "This note is empty.") + " The notes after it move up a number.",
      yes: "Delete",
    });
    if (!yes) return;
    const res = await SS.Fleeting.remove(note.n);
    if (!res || res.error) { toast((res && res.error) || "That didn't work.", "error"); return; }
    toast(`Deleted fleeting note ${note.n}.`);
    await refreshFleetViewers(card.closest(".page") || document);
  }

  function wireFleetViewers(page) {
    page.querySelectorAll("[data-fv]").forEach((card) => {
      const id = card.dataset.fv;
      const step = (d) => {
        const len = (fleetNotes || []).length;
        if (!len) return;
        fleetAt.set(id, Math.max(0, Math.min(len - 1, fleetIndex(id) + d)));
        paintFleetViewer(card);
        card.focus({preventScroll: true});
      };
      card.addEventListener("click", (e) => {
        const s = e.target.closest("[data-fv-step]");
        const z = e.target.closest("[data-fv-size]");
        if (s) step(Number(s.dataset.fvStep));
        else if (z) fleetResize(id, Number(z.dataset.fvSize)).then((changed) => {
          if (changed) { paintFleetViewer(card); card.focus({preventScroll: true}); }
        });
        else if (e.target.closest("[data-fv-open]")) host.go("fleeting:list");
        else if (e.target.closest("[data-fv-del]")) deleteShownFleeting(card);
      });
      card.addEventListener("keydown", (e) => {
        const d = {ArrowLeft: -1, ArrowRight: 1}[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();              // the viewer's, not a shortcut elsewhere
        step(d);
      });
    });
    refreshFleetViewers(page);
  }

  function renderBlockBody(b) {
    if (b.type === "music") return musicBlockBody(b);
    if (b.type === "circuit") return circuitBlockBody();
    if (b.type === "quicknote") return quickNoteBlockBody();
    if (b.type === "puzzle") return puzzleBlockBody(b);
    if (b.type === "quickrecipe") return quickRecipeBlockBody(b);
    if (b.type === "fleetview") return fleetViewBlockBody(b);
    if (b.type === "randommovie") return randomMovieBlockBody();
    if (b.type === "randomalbum") return randomAlbumBlockBody();
    if (b.type === "randompull") return randomPullBlockBody(b);
    const today = todayD();
    const todayKey = iso(today);
  
    if (b.type === "today") {
      const todayEvents = eventsOn(todayKey);
      return `<div class="panel dash-card">
        <h3>${fmtLongDate(today)} <a data-go="calendar">Open calendar &rarr;</a></h3>
        ${todayEvents.length ? todayEvents.map((e) => `
          <div class="dash-list-row" data-go-event="${escA(e.id)}">
            <span>${esc(e.name)}</span>
            <span class="stamp" style="margin:0">${esc(fmtTime12(e.startTime))}</span>
          </div>`).join("") : `<p class="cm-empty" style="text-align:left;padding:6px 0">
          Nothing scheduled today.</p>`}
      </div>`;
    }
  
    if (b.type === "upcoming") {
      const upcoming = data.events
        .filter((e) => e.date > todayKey)
        .sort((a, z) => a.date.localeCompare(z.date)
          || (a.startTime || "").localeCompare(z.startTime || ""))
        .slice(0, 5);
      return `<div class="panel dash-card">
        <h3>Upcoming</h3>
        ${upcoming.length ? upcoming.map((e) => `
          <div class="dash-list-row" data-go-event="${escA(e.id)}">
            <span>${esc(e.name)}</span>
            <span class="stamp" style="margin:0">${fmtLongDate(fromISO(e.date))}</span>
          </div>`).join("") : `<p class="cm-empty" style="text-align:left;padding:6px 0">
          Nothing else on the calendar yet.</p>`}
      </div>`;
    }
  
    if (b.type === "photos") {
      const recentPhotos = [...data.photos]
        .sort((a, z) => (z.created || "").localeCompare(a.created || ""))
        .slice(0, 6);
      return `<div class="panel dash-card">
        <h3>Recent photos <a data-go="photos">All photos &rarr;</a></h3>
        ${recentPhotos.length ? `<div class="dash-photo-row">
          ${recentPhotos.map((p) => `<div class="dash-photo"
            data-go-photo="${escA(p.id)}">
            <div class="ex-photo-loading">&nbsp;</div></div>`).join("")}
          </div>` : `<p class="cm-empty" style="text-align:left;padding:6px 0">
          No photos yet.</p>`}
      </div>`;
    }
  
    if (b.type === "week") {
      /* v6 — the next seven days. Shows the SHAPE of the week: which days
         are busy, which are clear, without having to open the calendar. */
      const start = todayD();
      const days = Array.from({length: 7}, (_, i) => addDays(start, i));
      return `<div class="panel dash-card">
        <h3>This week <a data-go="calendar">Calendar &rarr;</a></h3>
        <div class="wk-strip">
          ${days.map((dt, i) => {
            const key = iso(dt);
            const evts = eventsOn(key);
            const stamped = evts.find((e) => e.stamp && EVENT_STAMPS[e.stamp]);
            return `<div class="wk-day ${i === 0 ? "wk-today" : ""}"
                         data-wk="${key}">
              <div class="wk-dow">${i === 0 ? "Today"
                : WEEKDAY_LABELS[weekday(dt)]}</div>
              <div class="wk-num">${dt.d}</div>
              ${stamped
                ? `<div class="wk-stamp">${EVENT_STAMPS[stamped.stamp].glyph}</div>`
                : `<div class="wk-count ${evts.length ? "" : "wk-clear"}">${
                    evts.length || ""}</div>`}
            </div>`;
          }).join("")}
        </div>
        <div class="wk-detail" id="wk-detail-${escA(b.id)}"></div>
      </div>`;
    }
  
    if (b.type === "album") {
      /* v6 — a shortcut into one album, with a cover so it's recognisable
         at a glance rather than being a labelled button. */
      const album = (data.albums || []).find((a) => a.id === b.albumId);
      const count = album
        ? data.photos.filter((p) => (p.albumIds || []).includes(album.id)).length
        : 0;
      const cover = album
        ? data.photos.find((p) => (p.albumIds || []).includes(album.id))
        : null;
      return `<div class="panel dash-card album-card"
                   ${album ? `data-album-go="${escA(album.id)}"` : ""}>
        ${album ? `
          <div class="album-cover" ${cover
            ? `data-album-cover="${escA(cover.storedName)}"` : ""}>
            ${cover ? `<div class="ex-photo-loading">&nbsp;</div>`
              : `<span class="album-cover-empty">No photos yet</span>`}
          </div>
          <div class="album-card-meta">
            <b>${esc(album.name)}</b>
            <span class="stamp">${count} photo${count === 1 ? "" : "s"}</span>
          </div>`
          : `<h3>Album</h3>
             <p class="cm-empty" style="text-align:left;padding:10px 0;margin:0">
               Press the gear to pick an album.</p>`}
      </div>`;
    }
  
    if (b.type === "quickadd") {
      /* v6 — add an event without leaving the dashboard. Deliberately
         only the two fields that matter; anything more and it may as
         well be the full dialog. */
      return `<div class="panel dash-card">
        <h3>Quick add</h3>
        <input class="input qa-name" data-qa-name="${escA(b.id)}"
               placeholder="What's happening?" style="width:100%">
        <div class="cm-row" style="gap:8px;margin-top:8px">
          <input class="input" type="date" data-qa-date="${escA(b.id)}"
                 value="${iso(todayD())}" style="flex:1">
          <button class="btn btn-save" data-qa-go="${escA(b.id)}">Add</button>
        </div>
        <p class="stamp" style="margin:8px 0 0">Goes straight on the
          calendar. Open it there to add times or a stamp.</p>
      </div>`;
    }
  
    if (b.type === "onthisday") {
      /* v5 — Cam: photos from this date in previous years.
  
         Uses the photo's EXIF taken date where it has one, falling back
         to the import date. That distinction matters: without EXIF this
         widget would show when a photo was ADDED, so a 2019 holiday snap
         imported last week would appear as last week — which makes the
         whole thing meaningless. */
      const hits = onThisDayPhotos();
      return `<div class="panel dash-card">
        <h3>On this day <a data-go="photos">All photos &rarr;</a></h3>
        ${hits.length ? `
          <div class="otd-row">
            ${hits.slice(0, 6).map((h) => `
              <div class="otd-photo" data-otd="${escA(h.photo.id)}"
                   title="${escA(h.yearsAgo === 1 ? "1 year ago"
                     : h.yearsAgo + " years ago")}">
                <div class="ex-photo-loading">&nbsp;</div>
                <span class="otd-badge">${h.yearsAgo}y</span>
              </div>`).join("")}
          </div>
          <p class="stamp" style="margin:10px 0 0">${
            hits.length === 1 ? "One photo from"
              : hits.length + " photos from"} this date in
            ${[...new Set(hits.map((h) => h.year))].sort().join(", ")}.</p>`
          : `<p class="cm-empty" style="text-align:left;padding:10px 0;margin:0">
               Nothing from this date in earlier years \u2014 yet.</p>`}
      </div>`;
    }
  
    if (b.type === "countdown") {
      /* v5 — days until a date. Either a date Cam picks, or the next
         birthday from the contacts book, which needs no setting up. */
      const info = countdownInfo(b);
      return `<div class="panel dash-card countdown-card">
        <h3>${esc(b.title || "Countdown")}</h3>
        ${info ? `
          <div class="cd-days ${info.days === 0 ? "cd-today" : ""}">${
            info.days === 0 ? "Today" : info.days}</div>
          ${info.days !== 0 ? `<div class="cd-unit">${
            info.days === 1 ? "day to go" : "days to go"}</div>` : ""}
          <div class="cd-what">${esc(info.label)}</div>
          <div class="cd-when">${esc(info.when)}</div>`
          : `<p class="cm-empty" style="padding:16px 4px;margin:0">
               ${b.mode === "birthday"
                 ? "No birthdays in your contacts yet."
                 : "Press the gear to pick a date."}</p>`}
      </div>`;
    }
  
    if (b.type === "notice") {
      /* v5 — Cam: "i love the notice board." A single pinned message,
         deliberately NOT a notes system — one panel the family sees,
         edited in place. */
      const text = (b.text || "").trim();
      return `<div class="panel dash-card notice-card">
        <h3>${esc(b.title || "Notice board")}
          <a data-notice-edit="${escA(b.id)}">${text ? "Edit" : "Write one"}</a></h3>
        ${text ? `<div class="notice-text">${esc(text)}</div>
          ${b.updated ? `<div class="notice-when">Updated ${
            new Date(b.updated).toLocaleDateString()}</div>` : ""}`
          : `<p class="cm-empty" style="text-align:left;padding:10px 0;margin:0">
               Nothing pinned \u2014 bins, reminders, whatever needs saying.</p>`}
      </div>`;
    }
  
    if (b.type === "phonebook") {
      /* v5 — Cam: "A phone book would be cool where i can search and it
         will come up with the contact, further it will display 3 contacts
         that i save as favourites."
  
         The search box is deliberately NOT re-rendered through render():
         typing would lose focus on every keystroke. It updates its own
         results list instead — see wirePhonebook. */
      const favs = (data.contacts || []).filter((ct) => ct.favourite).slice(0, 3);
      return `<div class="panel dash-card">
        <h3>Phone book <a data-go="contacts">All contacts &rarr;</a></h3>
        <input class="input pb-search" data-pb-search="${escA(b.id)}"
               placeholder="Search name, phone, email\u2026">
        <div class="pb-results" data-pb-results="${escA(b.id)}"></div>
        <div class="pb-favs" data-pb-favs="${escA(b.id)}">
          ${favs.length ? favs.map((ct) => `
            <div class="pb-fav" data-pb-contact="${escA(ct.id)}">
              <div class="pb-avatar">${esc(initialsOf(ct.name))}</div>
              <div class="pb-fav-meta">
                <div class="pb-fav-name">${esc(ct.name)}</div>
                ${ct.phone ? `<div class="pb-fav-line">${esc(ct.phone)}</div>`
                  : (ct.email ? `<div class="pb-fav-line">${esc(ct.email)}</div>` : "")}
              </div>
            </div>`).join("")
            : `<p class="cm-empty" style="padding:14px 4px;margin:0;font-size:13px">
                 No favourites yet \u2014 open a contact and star them to
                 pin them here.</p>`}
        </div>
      </div>`;
    }
  
    if (b.type === "frame") {
      return `<div class="panel dash-card dash-frame-card">
        <h3>${esc(b.title || "Photo frame")}
          <span class="dash-frame-links">
            <a data-frame-full="${escA(b.id)}">Fullscreen</a>
            <a data-frame-next="${escA(b.id)}">Next &rarr;</a>
          </span></h3>
        <div class="dash-frame" data-frame="${escA(b.id)}">
          <div class="ex-photo-loading">Loading&hellip;</div>
        </div>
        <p class="dash-frame-cap" data-frame-cap="${escA(b.id)}"></p>
        <p class="dash-frame-src">${esc(frameSourceLabel(b))}</p>
      </div>`;
    }
  
    return `<div class="panel dash-card"><p class="cm-empty">Unknown block.</p></div>`;
  }
  
  function wireDashboardBlocks(page, blocks) {
    page.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", () => { sub = el.dataset.go; render(); }));
    page.querySelectorAll("[data-go-event]").forEach((el) =>
      el.addEventListener("click", () => {
        const ev = data.events.find((x) => x.id === el.dataset.goEvent);
        if (ev) { sub = "calendar"; render(); setTimeout(() => openEventDialog(ev), 60); }
      }));
  
    /* recent-photo thumbnails */
    const recentPhotos = [...data.photos]
      .sort((a, z) => (z.created || "").localeCompare(a.created || ""))
      .slice(0, 6);
    page.querySelectorAll("[data-go-photo]").forEach((el) =>
      el.addEventListener("click", () => {
        openPhotoViewer(el.dataset.goPhoto, recentPhotos.map((x) => x.id));
      }));
    recentPhotos.forEach(async (p) => {
      const tile = page.querySelector(`[data-go-photo="${p.id}"]`);
      if (!tile) return;
      /* CP.thumb, not CP.Store.thumb: the cached one. These are the same
         photos the library has usually already fetched, so on most visits
         this costs nothing at all -- and coming back to the dashboard
         never re-fetches what it drew last time. */
      const url = await CP.thumb(p.storedName);
      const loading = tile.querySelector(".ex-photo-loading");
      if (url && loading) {
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit";
        loading.replaceWith(img);
      }
    });
  
    wirePhonebook(page);
  
    /* On this day: thumbnails, not full photos - this widget can show six
       at once and the frame lag showed exactly what full-size costs */
    const otd = onThisDayPhotos();
    page.querySelectorAll("[data-otd]").forEach((el) =>
      el.addEventListener("click", () => {
        openPhotoViewer(el.dataset.otd, otd.map((h) => h.photo.id));
      }));
    otd.slice(0, 6).forEach(async (h) => {
      const tile = page.querySelector(`[data-otd="${h.photo.id}"]`);
      if (!tile) return;
      const url = await CP.thumb(h.photo.storedName);
      const loading = tile.querySelector(".ex-photo-loading");
      if (url && loading) {
        const img = document.createElement("img");
        img.src = url;
        loading.replaceWith(img);
      }
    });
  
    /* week strip: picking a day shows what's on it, in place */
    page.querySelectorAll("[data-wk]").forEach((el) =>
      el.addEventListener("click", () => {
        const key = el.dataset.wk;
        const strip = el.closest(".dash-card");
        const detail = strip.querySelector(".wk-detail");
        if (!detail) return;
        strip.querySelectorAll("[data-wk]").forEach((d) =>
          d.classList.toggle("wk-picked", d === el));
        const evts = eventsOn(key);
        const dt = fromISO(key);
        detail.innerHTML = `
          <div class="wk-detail-h">${esc(fmtLongDate(dt))}</div>
          ${evts.length ? evts.map((e) => `
            <div class="wk-evt">
              ${e.stamp && EVENT_STAMPS[e.stamp]
                ? `<span>${EVENT_STAMPS[e.stamp].glyph}</span>` : ""}
              <span class="wk-evt-name">${esc(e.name)}</span>
              ${e.startTime ? `<span class="stamp" style="margin:0">${
                esc(fmtTime12(e.startTime))}</span>` : ""}
            </div>`).join("")
            : `<p class="stamp" style="margin:4px 0 0">Nothing on.</p>`}`;
      }));
  
    /* album shortcut */
    page.querySelectorAll("[data-album-go]").forEach((el) =>
      el.addEventListener("click", () => {
        photoAlbumFilter = el.dataset.albumGo;
        sub = "photos";
        render();
      }));
    page.querySelectorAll("[data-album-cover]").forEach(async (el) => {
      const url = await CP.thumb(el.dataset.albumCover);
      const loading = el.querySelector(".ex-photo-loading");
      if (url && loading) {
        const img = document.createElement("img");
        img.src = url;
        loading.replaceWith(img);
      }
    });
  
    /* quick add */
    page.querySelectorAll("[data-qa-go]").forEach((btn) =>
      btn.addEventListener("click", () => quickAddEvent(page, btn.dataset.qaGo)));
    page.querySelectorAll("[data-qa-name]").forEach((input) =>
      input.addEventListener("keydown", (e) => {
        /* Enter submits - having to reach for the mouse would defeat the
           point of a quick-add box */
        if (e.key === "Enter") { e.preventDefault(); quickAddEvent(page, input.dataset.qaName); }
      }));
  
    page.querySelectorAll("[data-notice-edit]").forEach((el) =>
      el.addEventListener("click", () => {
        const b = blocks.find((x) => x.id === el.dataset.noticeEdit);
        if (b) noticeDialog(b);
      }));
  
    for (const b of blocks) if (b.type === "frame") startFrame(b);
    page.querySelectorAll("[data-frame-next]").forEach((el) =>
      el.addEventListener("click", () => {
        const b = blocks.find((x) => x.id === el.dataset.frameNext);
        if (b) advanceFrame(b, true);
      }));
    page.querySelectorAll("[data-frame-full]").forEach((el) =>
      el.addEventListener("click", () => {
        const b = blocks.find((x) => x.id === el.dataset.frameFull);
        if (!b) return;
        openFullscreenFrame({
          source: b.source || (b.random ? "random" : "album"),
          albumId: b.albumId, seconds: b.seconds, title: b.title,
        });
      }));
  }
  
  function onThisDayPhotos() {
    const today = todayD();
    const out = [];
    for (const p of data.photos) {
      const stamp = p.takenDate || (p.created || "").slice(0, 10);
      if (!stamp) continue;
      const dt = fromISO(stamp);
      if (!dt) continue;
      if (dt.m !== today.m || dt.d !== today.d) continue;
      const yearsAgo = today.y - dt.y;
      if (yearsAgo < 1) continue;
      out.push({photo: p, year: dt.y, yearsAgo});
    }
    return out.sort((a, b) => a.yearsAgo - b.yearsAgo);
  }
  
  function countdownInfo(block) {
    const today = todayD();
  
    if (block.mode === "birthday") {
      /* the NEXT birthday from the contacts book - no setting up, and it
         moves along on its own as each one passes */
      let best = null;
      for (const ct of (data.contacts || [])) {
        if (!ct.birthday) continue;
        const b = fromISO(ct.birthday);
        if (!b) continue;
        let next = D(today.y, b.m, b.d);
        /* 29 Feb in a non-leap year lands on the 28th, matching how the
           calendar already shows those birthdays */
        if (b.m === 2 && b.d === 29 && monthEnd(D(today.y, 2, 1)).d === 28) {
          next = D(today.y, 2, 28);
        }
        if (cmp(next, today) < 0) next = D(today.y + 1, b.m, Math.min(b.d, 28));
        const days = daysBetween(today, next);
        if (!best || days < best.days) {
          const turning = next.y - b.y;
          best = {days, label: `${ct.name}${turning > 0 ? ` turns ${turning}` : ""}`,
                  when: fmtLongDate(next)};
        }
      }
      return best;
    }
  
    if (!block.date) return null;
    const target = fromISO(block.date);
    if (!target) return null;
    const days = daysBetween(today, target);
    if (days < 0) return null;          // already been and gone
    return {days, label: block.label || "", when: fmtLongDate(target)};
  }
  
  function daysBetween(a, b) {
    const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
    return Math.round(ms / 86400000);
  }
  
  function albumBlockDialog(block) {
    const albums = [...(data.albums || [])]
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!albums.length) {
      toast("Make an album on the Photos page first.", "error");
      return;
    }
    const d = openDlg("Album shortcut", `
      <label class="dlg-label" style="margin-top:0">Which album</label>
      <select class="input" id="ab-select" style="width:100%">
        ${albums.map((a) => {
          const n = data.photos.filter((p) =>
            (p.albumIds || []).includes(a.id)).length;
          const label = `${a.name} (${n} photo${n === 1 ? "" : "s"})`;
          return `<option value="${escA(a.id)}"${
            a.id === block.albumId ? " selected" : ""}>${esc(label)}</option>`;
        }).join("")}
      </select>`);
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      block.albumId = d.body.querySelector("#ab-select").value;
      dashBlocks = blocksOrDefault();
      await saveBlocks();
      d.close();
      render();
    });
  }
  
  function countdownDialog(block) {
    const d = openDlg("Countdown", `
      <label class="dlg-label" style="margin-top:0">Title</label>
      <input class="input" id="cd-title" style="width:100%"
             value="${escA(block.title || "Countdown")}">
  
      <label class="dlg-label">Count down to</label>
      <div class="fr-source">
        <button type="button" class="fr-source-opt" id="cd-mode-date">
          <b>A date</b>
          <span class="stamp">Something you pick</span>
        </button>
        <button type="button" class="fr-source-opt" id="cd-mode-bday">
          <b>Next birthday</b>
          <span class="stamp">From your contacts, updates itself</span>
        </button>
      </div>
  
      <div id="cd-date-wrap" hidden>
        <label class="dlg-label">Date</label>
        <input class="input" id="cd-date" type="date" style="width:100%"
               value="${escA(block.date || "")}">
        <label class="dlg-label">What is it?</label>
        <input class="input" id="cd-label" style="width:100%"
               value="${escA(block.label || "")}" placeholder="Holiday">
      </div>`);
  
    let mode = block.mode === "birthday" ? "birthday" : "date";
    const paint = () => {
      d.body.querySelector("#cd-mode-date").classList.toggle("on", mode === "date");
      d.body.querySelector("#cd-mode-bday").classList.toggle("on", mode === "birthday");
      d.body.querySelector("#cd-date-wrap").hidden = mode !== "date";
    };
    d.body.querySelector("#cd-mode-date").onclick = () => { mode = "date"; paint(); };
    d.body.querySelector("#cd-mode-bday").onclick = () => { mode = "birthday"; paint(); };
    paint();
  
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      block.title = d.body.querySelector("#cd-title").value.trim() || "Countdown";
      block.mode = mode;
      if (mode === "date") {
        const date = d.body.querySelector("#cd-date").value;
        if (!date || !fromISO(date)) {
          toast("Pick a date to count down to.", "error");
          return;
        }
        if (daysBetween(todayD(), fromISO(date)) < 0) {
          toast("That date has already passed.", "error");
          return;
        }
        block.date = date;
        block.label = d.body.querySelector("#cd-label").value.trim();
      }
      dashBlocks = blocksOrDefault();
      await saveBlocks();
      d.close();
      render();
    });
  }
  
  function noticeDialog(block) {
    const d = openDlg("Notice board", `
      <label class="dlg-label" style="margin-top:0">Heading</label>
      <input class="input" id="nb-title" style="width:100%"
             value="${escA(block.title || "Notice board")}">
      <label class="dlg-label">Message</label>
      <textarea class="input" id="nb-text" rows="5"
        placeholder="Bins go out Tuesday\u2026">${esc(block.text || "")}</textarea>`);
    d.btn("Cancel", "btn-quiet", d.close);
    if ((block.text || "").trim()) {
      d.btn("Clear", "btn-danger", async () => {
        block.text = "";
        block.updated = "";
        dashBlocks = blocksOrDefault();
        await saveBlocks();
        d.close();
        render();
      });
    }
    d.btn("Save", "btn-save", async () => {
      block.title = d.body.querySelector("#nb-title").value.trim() || "Notice board";
      const text = d.body.querySelector("#nb-text").value.trim();
      /* only stamp the date when the message actually changed - otherwise
         fixing a typo in the heading would claim the notice is new */
      if (text !== (block.text || "")) block.updated = new Date().toISOString();
      block.text = text;
      dashBlocks = blocksOrDefault();
      await saveBlocks();
      d.close();
      render();
    });
  }
  
  function wirePhonebook(page) {
    page.querySelectorAll("[data-pb-search]").forEach((input) => {
      const id = input.dataset.pbSearch;
      const results = page.querySelector(`[data-pb-results="${id}"]`);
      const favs = page.querySelector(`[data-pb-favs="${id}"]`);
  
      const paint = () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
          results.innerHTML = "";
          results.classList.remove("open");
          if (favs) favs.hidden = false;    // favourites return when the search clears
          return;
        }
        if (favs) favs.hidden = true;       // results take the space instead
        const hits = (data.contacts || []).filter((ct) =>
          [ct.name, ct.phone, ct.email, ct.address]
            .some((f) => (f || "").toLowerCase().includes(q)))
          .slice(0, 6);
        results.classList.add("open");
        results.innerHTML = hits.length ? hits.map((ct) => `
          <div class="pb-hit" data-pb-contact="${escA(ct.id)}">
            <div class="pb-avatar">${esc(initialsOf(ct.name))}</div>
            <div class="pb-fav-meta">
              <div class="pb-fav-name">${esc(ct.name)}</div>
              ${ct.phone ? `<div class="pb-fav-line">${esc(ct.phone)}</div>` : ""}
              ${ct.email ? `<div class="pb-fav-line">${esc(ct.email)}</div>` : ""}
            </div>
          </div>`).join("")
          : `<p class="cm-empty" style="padding:12px 4px;margin:0;font-size:13px">
               Nobody matches that.</p>`;
        wirePhonebookRows(results);
      };
  
      input.addEventListener("input", paint);
    });
    page.querySelectorAll("[data-pb-favs]").forEach(wirePhonebookRows);
  }
  
  function wirePhonebookRows(root) {
    root.querySelectorAll("[data-pb-contact]").forEach((el) =>
      el.addEventListener("click", () => {
        const ct = (data.contacts || []).find((x) => x.id === el.dataset.pbContact);
        if (ct) contactDialog(ct);
      }));
  }
  
  function frameSourceLabel(block) {
    if (block.random || block.source === "random") return "Random \u2014 whole library";
    if (block.source === "album" && block.albumId) {
      const a = data.albums.find((x) => x.id === block.albumId);
      return a ? a.name : "Album (missing)";
    }
    if (Array.isArray(block.photoIds) && block.photoIds.length) {
      return `${block.photoIds.length} chosen photos`;
    }
    return "Random \u2014 whole library";
  }
  
  function startFrame(block) {
    const existing = frameTimers.get(block.id);
    if (existing) clearInterval(existing);
    advanceFrame(block, false);
    const secs = Math.max(3, block.seconds || 8);
    frameTimers.set(block.id, setInterval(() => advanceFrame(block, true), secs * 1000));
  }
  
  function framePickerDialog(block) {
    const albums = [...data.albums].sort((a, b) => a.name.localeCompare(b.name));
    const current = (block.source === "album" && block.albumId)
      ? block.albumId : "";
  
    const d = openDlg("Photo frame", `
      <label class="dlg-label" style="margin-top:0">Name</label>
      <input class="input" id="fr-title" style="width:100%"
             value="${escA(block.title || "Photo frame")}">
  
      <label class="dlg-label">Where the photos come from</label>
      <div class="fr-source">
        <button type="button" class="fr-source-opt" id="fr-random">
          <b>Random</b>
          <span class="stamp">Anything from the whole library</span>
        </button>
        <button type="button" class="fr-source-opt" id="fr-album">
          <b>An album</b>
          <span class="stamp">Just the photos in one album</span>
        </button>
      </div>
  
      <div id="fr-album-wrap" hidden>
        <label class="dlg-label">Which album</label>
        ${albums.length ? `
          <select class="input" id="fr-album-select" style="width:100%">
            ${albums.map((a) => {
              const n = data.photos.filter((p) =>
                (p.albumIds || []).includes(a.id)).length;
              /* the label is built on ONE line deliberately: a newline
                 inside an <option> becomes literal whitespace in the
                 dropdown, which renders as an awkward gap */
              const label = `${a.name} (${n} photo${n === 1 ? "" : "s"})`;
              return `<option value="${escA(a.id)}"${
                a.id === current ? " selected" : ""}>${esc(label)}</option>`;
            }).join("")}
          </select>`
          : `<p class="cm-empty" style="text-align:left;padding:8px 0;margin:0">
               No albums yet \u2014 make one on the Photos page first.</p>`}
      </div>
  
      <label class="dlg-label">Seconds per photo</label>
      <input class="input" id="fr-secs" type="number" min="3" max="600"
             value="${block.seconds || 8}" style="width:120px">`);
  
    let source = (block.source === "album" && albums.length) ? "album" : "random";
  
    const paint = () => {
      d.body.querySelector("#fr-random").classList.toggle("on", source === "random");
      d.body.querySelector("#fr-album").classList.toggle("on", source === "album");
      d.body.querySelector("#fr-album-wrap").hidden = source !== "album";
    };
    d.body.querySelector("#fr-random").onclick = () => { source = "random"; paint(); };
    d.body.querySelector("#fr-album").onclick = () => {
      if (!albums.length) {
        toast("Make an album on the Photos page first.", "error");
        return;
      }
      source = "album";
      paint();
    };
    paint();
  
    d.btn("Cancel", "btn-quiet", d.close);
    d.btn("Save", "btn-save", async () => {
      block.title = d.body.querySelector("#fr-title").value.trim() || "Photo frame";
      block.seconds = Math.max(3, Math.min(600,
        +d.body.querySelector("#fr-secs").value || 8));
      block.source = source;
      block.random = source === "random";
      if (source === "album") {
        const sel = d.body.querySelector("#fr-album-select");
        if (!sel || !sel.value) {
          toast("Pick an album, or choose Random.", "error");
          return;
        }
        block.albumId = sel.value;
      } else {
        block.albumId = null;
      }
      /* the old hand-picked list is cleared once a real source is set,
         so it can't quietly override the new choice later */
      block.photoIds = [];
      dashBlocks = blocksOrDefault();
      frameIndex.delete(block.id);
      await saveBlocks();
      d.close();
      render();
    });
  }
  
  function openFullscreenFrame(opts) {
    fsFrame = {
      source: opts.source || "random",
      albumId: opts.albumId || null,
      seconds: Math.max(3, opts.seconds || 8),
      title: opts.title || "",
      index: -1,
    };
    const veil = document.getElementById("fs-frame-veil");
    veil.innerHTML = `
      <div class="fs-stage" id="fs-stage">
        <p class="cm-empty" style="color:rgba(255,255,255,.6)">Loading&hellip;</p>
      </div>
      <div class="fs-bar" id="fs-bar">
        <span class="fs-cap" id="fs-cap"></span>
        <span style="flex:1"></span>
        <button class="fs-btn" id="fs-prev" title="Previous">&#8592;</button>
        <button class="fs-btn" id="fs-pause" title="Pause">&#10074;&#10074;</button>
        <button class="fs-btn" id="fs-next" title="Next">&#8594;</button>
        <button class="fs-btn" id="fs-exit" title="Exit (Esc)">&#10005;</button>
      </div>`;
    veil.classList.add("open");
  
    /* ask the browser for real fullscreen where it's available - on a
       second monitor that's the difference between a window and an
       actual photo frame */
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => { /* refused; the veil still fills the window */ });
    }
  
    veil.querySelector("#fs-exit").onclick = closeFullscreenFrame;
    veil.querySelector("#fs-next").onclick = () => fsAdvance(1);
    veil.querySelector("#fs-prev").onclick = () => fsAdvance(-1);
    const pause = veil.querySelector("#fs-pause");
    pause.onclick = () => {
      if (fsTimer) {
        clearInterval(fsTimer);
        fsTimer = null;
        pause.innerHTML = "&#9654;";
        pause.title = "Play";
      } else {
        fsStartTimer();
        pause.innerHTML = "&#10074;&#10074;";
        pause.title = "Pause";
      }
    };
  
    /* the controls fade out of the way, since the point is the photo */
    let hideTimer = null;
    const showBar = () => {
      const bar = document.getElementById("fs-bar");
      if (!bar) return;
      bar.classList.remove("faded");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bar.classList.add("faded"), 2600);
    };
    veil.onmousemove = showBar;
    showBar();
  
    fsAdvance(1);
    fsStartTimer();
  }
  
  function fsStartTimer() {
    if (fsTimer) clearInterval(fsTimer);
    if (!fsFrame) return;
    fsTimer = setInterval(() => fsAdvance(1), fsFrame.seconds * 1000);
  }
  
  function addBlockDialog() {
    const present = new Set(blocksOrDefault().map((b) => b.type));
    const available = Object.entries(BLOCK_TYPES)
      .filter(([key]) => CONFIGURABLE.includes(key) || !present.has(key));
  
    if (!available.length) {
      toast("Every block is already on the dashboard.");
      return;
    }
    /* Each block gets its own icon and its name and hint on separate lines:
       Cam: "Modernize the cards here to please." They used to run together on
       one line, so "Phone book Search contacts, plus favourites" read as a
       single sentence. */
    const d = openDlg("Add a block", `
      <div class="dash-add-grid">
        ${available.map(([key, t]) => `
          <button type="button" class="dash-add-opt" data-add="${key}">
            <span class="dash-add-ic">${ic(BLOCK_ICONS[key] || "i-grid")}</span>
            <span class="dash-add-text">
              <b>${esc(t.name)}</b>
              <span class="dash-add-hint">${esc(t.hint)}</span>
            </span>
          </button>`).join("")}
      </div>`, true);
    d.body.querySelectorAll("[data-add]").forEach((b) =>
      b.addEventListener("click", async () => {
        const type = b.dataset.add;
        /* A random part, not just the clock. The id was the timestamp
           alone, which was safe while a type could only appear once;
           now that Cam can add a second countdown, two blocks created in
           the same millisecond would share an id, and the gear and the
           remove cross both find a block BY id -- so removing the second
           countdown would take the first one away instead. */
        const block = {id: "b-" + newId(), type};
        if (type === "frame") {
          block.title = "Photo frame";
          block.random = true;
          block.photoIds = [];
          block.seconds = 8;
        } else if (type === "countdown") {
          block.title = "Countdown";
          /* defaults to the next birthday: it works immediately with
             nothing to set up, which a blank date field wouldn't */
          block.mode = "birthday";
        } else if (type === "notice") {
          block.title = "Notice board";
          block.text = "";
        }
        dashBlocks = [...blocksOrDefault(), block];
        await saveBlocks();
        d.close();
        render();
        if (type === "frame") framePickerDialog(block);
        else if (type === "countdown") countdownDialog(block);
        else if (type === "notice") noticeDialog(block);
        else if (type === "album") albumBlockDialog(block);
      }));
    d.btn("Cancel", "btn-quiet", d.close);
  }
  
  function newContact() {
    return {id: newId(), name: "", email: "", phone: "", address: "",
            birthday: "", notes: "", created: new Date().toISOString()};
  }
  
  function renderContacts(page) {
    const q = contactSearch.trim().toLowerCase();
    const all = [...(data.contacts || [])]
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const list = q ? all.filter((ct) =>
      [ct.name, ct.email, ct.phone, ct.address]
        .some((f) => (f || "").toLowerCase().includes(q))) : all;
  
    page.innerHTML = `
      <h2 class="cm-page-h">Contacts</h2>
      <p class="cm-page-sub">Everyone's details in one place \u2014 add a
        birthday and it shows up on the calendar.</p>
  
      <div class="cm-row" style="gap:10px;margin-bottom:16px">
        <button class="btn btn-save" id="ct-new">+ New contact</button>
        <input class="input" id="ct-search" style="flex:1;max-width:340px"
               placeholder="Search name, email, phone\u2026"
               value="${escA(contactSearch)}">
        <button class="btn" id="ct-export" ${all.length ? "" : "disabled"}
                title="Save the whole book to your desktop">
          ${ic("i-export")} Export all</button>
      </div>
  
      ${list.length ? `<div class="contact-grid">
        ${list.map((ct) => `
          <div class="contact-card" data-contact="${escA(ct.id)}">
            <div class="contact-avatar">${esc(initialsOf(ct.name))}</div>
            <div class="contact-meta">
              <div class="contact-name">${esc(ct.name || "Unnamed")}${
                ct.favourite ? ` <span class="contact-star"
                  title="On the dashboard phone book">\u2605</span>` : ""}</div>
              ${ct.phone ? `<div class="contact-line">${esc(ct.phone)}</div>` : ""}
              ${ct.email ? `<div class="contact-line">${esc(ct.email)}</div>` : ""}
              ${ct.birthday ? `<div class="contact-line contact-bday">
                \u{1F382} ${esc(fmtBirthday(ct.birthday))}</div>` : ""}
            </div>
          </div>`).join("")}
      </div>`
        : `<p class="cm-empty">${q ? "Nobody matches that search."
            : "No contacts yet \u2014 add someone with + New contact."}</p>`}`;
  
    page.querySelector("#ct-new").onclick = () => contactDialog(newContact(), true);
    /* deliberately exports ALL contacts, not the current search results —
       "export all" that quietly dropped everyone filtered out by a search
       box left open would be a nasty surprise */
    page.querySelector("#ct-export").onclick = exportContactsDialog;
    const search = page.querySelector("#ct-search");
    search.addEventListener("input", () => {
      contactSearch = search.value;
      renderContacts(page);
      /* keep the caret where it was - re-rendering on every keystroke
         would otherwise throw focus away mid-word */
      const again = page.querySelector("#ct-search");
      again.focus();
      again.setSelectionRange(again.value.length, again.value.length);
    });
    page.querySelectorAll("[data-contact]").forEach((el) =>
      el.addEventListener("click", () => {
        const ct = (data.contacts || []).find((x) => x.id === el.dataset.contact);
        if (ct) contactDialog(ct);
      }));
  }
  
  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "\u{1F464}";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  function fmtBirthday(isoStr) {
    const b = fromISO(isoStr);
    if (!b) return "";
    return `${b.d} ${MONTHS[b.m - 1]}`;
  }
  
  function contactDialog(contact, isNew) {
    const d = openDlg(isNew ? "New contact" : (contact.name || "Contact"), `
      <label class="dlg-label" style="margin-top:0">Name</label>
      <input class="input" id="ct-name" style="width:100%"
             value="${escA(contact.name)}" placeholder="Jane Smith">
  
      <div class="cm-row" style="gap:10px">
        <div style="flex:1">
          <label class="dlg-label">Phone</label>
          <input class="input" id="ct-phone" style="width:100%"
                 value="${escA(contact.phone)}" placeholder="0400 000 000">
        </div>
        <div style="flex:1">
          <label class="dlg-label">Birthday</label>
          <input class="input" id="ct-bday" type="date" style="width:100%"
                 value="${escA(contact.birthday)}">
        </div>
      </div>
  
      <label class="dlg-label">Email</label>
      <input class="input" id="ct-email" style="width:100%"
             value="${escA(contact.email)}" placeholder="jane@example.com">
  
      <label class="dlg-label">Address</label>
      <textarea class="input" id="ct-address" rows="2"
                placeholder="12 Example Street\u2026">${esc(contact.address)}</textarea>
  
      <label class="dlg-label">Notes</label>
      <textarea class="input" id="ct-notes" rows="2">${esc(contact.notes)}</textarea>
  
      <label class="cm-row" style="gap:9px;margin-top:16px;cursor:pointer">
        <input type="checkbox" id="ct-fav" ${contact.favourite ? "checked" : ""}>
        <span>Favourite \u2014 pin to the dashboard phone book</span>
      </label>
  
      <p class="stamp" style="margin:12px 0 0">A birthday shows on the
        calendar every year, with their age.</p>`);
  
    d.btn("Cancel", "btn-quiet", d.close);
    if (!isNew) {
      d.btn("Delete", "btn-danger", async () => {
        const ok = await confirmDlg({
          title: `Delete ${contact.name || "this contact"}?`,
          body: "Their details and their birthday on the calendar both go. "
            + "This can't be undone.",
          yes: "Delete"});
        if (!ok) return;
        data.contacts = (data.contacts || []).filter((x) => x.id !== contact.id);
        await save();
        d.close();
        render();
        toast("Contact deleted.");
      });
    }
    d.btn(isNew ? "Add contact" : "Save", "btn-save", async () => {
      const name = d.body.querySelector("#ct-name").value.trim();
      if (!name) { toast("Give the contact a name.", "error"); return; }
      const bday = d.body.querySelector("#ct-bday").value;
      if (bday && !fromISO(bday)) {
        toast("That birthday doesn't look like a real date.", "error");
        return;
      }
      /* v5 — the phone book widget shows three favourites, so a fourth
         would simply never appear. Said plainly rather than silently
         accepting a star that does nothing. */
      const wantFav = d.body.querySelector("#ct-fav").checked;
      if (wantFav && !contact.favourite) {
        const current = (data.contacts || [])
          .filter((ct) => ct.favourite && ct.id !== contact.id).length;
        if (current >= 3) {
          toast("The phone book shows three favourites \u2014 unstar "
            + "someone first.", "error");
          return;
        }
      }
      Object.assign(contact, {
        name,
        favourite: wantFav,
        phone: d.body.querySelector("#ct-phone").value.trim(),
        email: d.body.querySelector("#ct-email").value.trim(),
        address: d.body.querySelector("#ct-address").value.trim(),
        notes: d.body.querySelector("#ct-notes").value.trim(),
        birthday: bday,
      });
      data.contacts = data.contacts || [];
      if (isNew) data.contacts.push(contact);
      await save();
      d.close();
      render();
    });
  }

  function closeFullscreenFrame() {
    if (fsTimer) { clearInterval(fsTimer); fsTimer = null; }
    fsFrame = null;
    const veil = document.getElementById("fs-frame-veil");
    veil.classList.remove("open");
    veil.innerHTML = "";
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
  
  function exportContactsDialog() {
    const list = contactsForExport();
    if (!list.length) {
      toast("There are no contacts to export yet.", "error");
      return;
    }
    const d = openDlg(`Export ${list.length} contact${list.length === 1 ? "" : "s"}`, `
      <p class="stamp" style="margin:0 0 14px">The file is saved to your
        desktop, ready to attach or send.</p>
      ${Object.entries(CONTACT_EXPORTS).map(([key, f]) => `
        <button class="btn" data-fmt="${key}"
                style="width:100%;text-align:left;display:block;margin-bottom:8px;
                       padding:11px 13px;height:auto">
          <b>${esc(f.label)}</b> <span class="stamp">(.${f.ext})</span><br>
          <span class="stamp">${esc(f.hint)}</span>
        </button>`).join("")}`);
    d.btn("Cancel", "btn-quiet", d.close);
  
    d.body.querySelectorAll("[data-fmt]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const fmt = CONTACT_EXPORTS[btn.dataset.fmt];
        btn.disabled = true;
        const stamp = new Date().toISOString().slice(0, 10);
        const res = await CP.Store.exportText(
          `Hearth contacts ${stamp}.${fmt.ext}`, fmt.build(list));
        btn.disabled = false;
        if (res && res.error) { toast(res.error, "error"); return; }
        d.close();
        /* naming the file, not just saying "done" — an export you can't
           find afterwards may as well not have happened */
        toast(`Saved to your desktop as ${fileNameOf(res.path)}`, "good");
      }));
  }

  /* ---- carried over late ---------------------------------------------------
     These were missed when Home was lifted out of KinCrux: the scan that found
     its functions matched "function x(" and every one of these is an
     "async function x(". saveBlocks is the costly one -- every change to the
     dashboard's layout (add, remove, reorder) called it and threw, so nothing
     Cam did to the layout was ever saved. */

async function saveBlocks() {
    await CP.Store.setPrefs({dashBlocks});
  }
  
  async function advanceFrame(block, step) {
    const el = document.querySelector(`[data-frame="${block.id}"]`);
    if (!el) { /* block is gone from the page */ return; }
    const photos = framePhotosFor(block);
    if (!photos.length) {
      el.innerHTML = `<p class="cm-empty" style="margin:0">No photos chosen yet.</p>`;
      return;
    }
    let i = frameIndex.get(block.id);
    if (i === undefined) {
      i = block.random ? Math.floor(Math.random() * photos.length) : 0;
    } else if (step) {
      i = block.random ? Math.floor(Math.random() * photos.length)
                       : (i + 1) % photos.length;
    }
    frameIndex.set(block.id, i);
    const p = photos[Math.min(i, photos.length - 1)];
    if (!p) return;
  
    /* v5 - a frame-sized copy, NOT the full original. The frame was
       decoding several megabytes into the page every few seconds, which
       is what made the dashboard lag. */
    const result = await CP.Store.frame(p.storedName, "library");
    const live = document.querySelector(`[data-frame="${block.id}"]`);
    if (!live) return;          // dashboard moved on while loading
    if (result && result.dataUrl) {
      live.innerHTML = `<img src="${result.dataUrl}" alt="">`;
    } else {
      live.innerHTML = `<p class="cm-empty" style="margin:0">Photo missing.</p>`;
    }
    const cap = document.querySelector(`[data-frame-cap="${block.id}"]`);
    if (cap) {
      cap.textContent = p.caption || p.originalName.replace(/\.[^.]+$/, "");
    }
  }
  
  async function fsAdvance(dir) {
    if (!fsFrame) return;
    const photos = framePhotosFor({
      source: fsFrame.source, albumId: fsFrame.albumId,
      random: fsFrame.source === "random",
    });
    const stage = document.getElementById("fs-stage");
    if (!stage) return;
    if (!photos.length) {
      stage.innerHTML = `<p class="cm-empty" style="color:rgba(255,255,255,.6)">
        No photos to show.</p>`;
      return;
    }
    if (fsFrame.source === "random") {
      fsFrame.index = Math.floor(Math.random() * photos.length);
    } else {
      fsFrame.index = (fsFrame.index + dir + photos.length) % photos.length;
    }
    const p = photos[fsFrame.index];
    if (!p) return;
    /* v5 - the frame-sized copy here too. At 1280px it still fills a
       monitor cleanly, and it's a fraction of the bytes of the original,
       which matters when a slideshow is loading a new one every few
       seconds for hours. */
    const result = await CP.Store.frame(p.storedName, "library");
    const live = document.getElementById("fs-stage");
    if (!live || !fsFrame) return;      // closed while loading
    if (result && result.dataUrl) {
      live.innerHTML = `<img src="${result.dataUrl}" alt="">`;
    }
    const cap = document.getElementById("fs-cap");
    if (cap) {
      cap.textContent = p.caption || p.originalName.replace(/\.[^.]+$/, "");
    }
  }
  
  async function quickAddEvent(page, blockId) {
    const nameEl = page.querySelector(`[data-qa-name="${blockId}"]`);
    const dateEl = page.querySelector(`[data-qa-date="${blockId}"]`);
    if (!nameEl || !dateEl) return;
    const name = nameEl.value.trim();
    const date = dateEl.value;
    if (!name) { toast("What's the event?", "error"); return; }
    if (!date || !fromISO(date)) { toast("Pick a date.", "error"); return; }
  
    data.events.push({id: newId(), created: new Date().toISOString(),
      name, date, startTime: "", endTime: "", notes: "",
      repeat: "none", repeatUntil: "", stamp: ""});
    await save();
    /* clear the box but keep the date: adding several things to the same
       day is the common case, and re-picking the date each time would be
       irritating */
    nameEl.value = "";
    render();
    toast(`Added to ${fmtLongDate(fromISO(date))}.`, "good");
    const again = document.querySelector(`[data-qa-name="${blockId}"]`);
    if (again) again.focus();
  }
  
  function contactsForExport() {
    return [...(data.contacts || [])].sort((a, b) => {
      const an = (a.name || "").trim(), bn = (b.name || "").trim();
      if (!an !== !bn) return an ? -1 : 1;
      return an.localeCompare(bn);
    });
  }

  /* ---- carried over late (again) -------------------------------------------
     Cam: "when adding a photo frame to the dashboard it gets stuck on loading
     and no photo appears." advanceFrame called framePhotosFor on its first
     line and it did not exist here, so the frame threw before it could draw
     and sat on "Loading..." for ever. It was missed twice: the first sweep
     matched "function x(" only, the second added "async function x(" -- and
     fileNameOf is a const arrow, which neither looked for. This sweep covered
     every form. */

  const fileNameOf = (p) => String(p || "").split(/[\\/]/).pop();

  function framePhotosFor(block) {
    if (block.random || block.source === "random") return data.photos;
  
    if (block.source === "album" && block.albumId) {
      const inAlbum = data.photos.filter((p) =>
        (p.albumIds || []).includes(block.albumId));
      /* an album that's been emptied or deleted shouldn't leave a dead
         frame - fall back to the library rather than showing nothing */
      return inAlbum.length ? inAlbum : data.photos;
    }
  
    /* a frame created before albums were the unit */
    if (Array.isArray(block.photoIds) && block.photoIds.length) {
      return block.photoIds
        .map((id) => data.photos.find((p) => p.id === id))
        .filter(Boolean);
    }
    return data.photos;
  }


  window.SS.Home = {
    VIEWS: ["home:dashboard", "home:calendar", "home:contacts"],
    PREFIX: "home:",
    async mount(hostEl, which) {
      /* The saved layout is read before the first draw, or the dashboard
         flashes its defaults and then rearranges itself. */
      await loadBlocks();
      hostEl.style.display = "";
      hostEl.innerHTML = "";
      const page = document.createElement("div");
      /* ss-home scopes Home's stylesheet. Training has a calendar using the
         same class names, and unscoped the two restyle each other. */
      page.className = "page ss-home";
      hostEl.appendChild(page);
      if (which === "home:calendar") renderCalendarPage(page);
      else if (which === "home:contacts") renderContacts(page);
      /* Personal Effects moved out to its own main section: Stuff → Media
         (ui/stuff/stuff.js). */
      else renderDashboard(page);
    },
    _test: {todayD, iso, fromISO, addDays, addMonths, blocksOrDefault},
  };
})();
