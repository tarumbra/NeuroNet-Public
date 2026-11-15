/* ==========================================================================
   CF.Calc — the daily-use numbers, ported from Coach Cam desktop.

   Formulas are carried across verbatim rather than re-derived, so a number
   worked out on the phone matches the one on the desktop exactly. All
   weights are kg, as they are on the desktop.
   ========================================================================== */
CF.Calc = (() => {
  "use strict";

  const num = (x) => (Math.abs(x - Math.round(x)) < 0.05
    ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1));

  /** Estimated 1RM: four classic formulas plus their average. One rep is
      the lift itself; Brzycki blows up past 36 reps, so it caps there. */
  function est1RM(w, r) {
    if (!(w > 0) || !(r >= 1)) return null;
    if (r === 1) return { epley: w, brzycki: w, lombardi: w, oconner: w, avg: w };
    const epley = w * (1 + r / 30);
    const brzycki = w * 36 / (37 - Math.min(r, 36));
    const lombardi = w * Math.pow(r, 0.10);
    const oconner = w * (1 + 0.025 * r);
    return { epley, brzycki, lombardi, oconner, avg: (epley + brzycki + lombardi + oconner) / 4 };
  }

  const DOTS_COEF = {
    male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000000731],
    female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
  };

  function dotsScore(liftKg, bwKg, sex) {
    if (!(liftKg > 0) || !(bwKg >= 40) || bwKg > 210) return null;
    const c = DOTS_COEF[sex] || DOTS_COEF.male;
    const d = c[0] + c[1] * bwKg + c[2] * bwKg ** 2 + c[3] * bwKg ** 3 + c[4] * bwKg ** 4;
    return 500 / d * liftKg;
  }

  const DEFAULT_PLATES = [
    { kg: 25, pairs: 2 }, { kg: 20, pairs: 4 }, { kg: 15, pairs: 2 },
    { kg: 10, pairs: 2 }, { kg: 5, pairs: 2 }, { kg: 2.5, pairs: 2 },
    { kg: 1.25, pairs: 2 },
  ];
  const DEFAULT_BARS = [20, 15, 10, 7.5];

  /** Greedy per-side solution from an inventory of plate pairs. */
  function plateLoad(target, bar, plates) {
    if (!(target > 0) || !(bar > 0) || target < bar) return null;
    let perSide = (target - bar) / 2;
    const out = [];
    const inv = [...plates].filter((p) => p.kg > 0 && p.pairs > 0).sort((a, b) => b.kg - a.kg);
    for (const p of inv) {
      const n = Math.min(p.pairs, Math.floor((perSide + 1e-9) / p.kg));
      if (n > 0) { out.push({ kg: p.kg, n }); perSide -= n * p.kg; }
    }
    const loaded = target - perSide * 2;
    return { perSide: out, loaded, short: Math.round(perSide * 2 * 100) / 100 };
  }

  /** Zones 1–5. Plain %HRmax, or Karvonen when a resting HR is supplied. */
  function hrZones(maxHR, restHR = null) {
    if (!(maxHR > 100)) return null;
    const bands = [[0.50, 0.60], [0.60, 0.70], [0.70, 0.80], [0.80, 0.90], [0.90, 1.00]];
    const karvonen = restHR !== null && restHR > 20 && restHR < maxHR;
    return bands.map(([lo, hi], i) => ({
      zone: i + 1,
      lo: Math.round(karvonen ? restHR + lo * (maxHR - restHR) : lo * maxHR),
      hi: Math.round(karvonen ? restHR + hi * (maxHR - restHR) : hi * maxHR),
      method: karvonen ? "karvonen" : "pct",
    }));
  }

  /** "mm:ss" or plain seconds → seconds, or null. */
  function parseTime(text) {
    const t = String(text || "").trim();
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const m = /^(\d+):([0-5]?\d)(?:\.(\d+))?$/.exec(t);
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]) + (m[3] ? parseFloat("0." + m[3]) : 0);
  }

  const fmtTime = (secs) => {
    const s = Math.max(0, secs);
    return `${Math.floor(s / 60)}:${(s % 60).toFixed(s % 1 ? 1 : 0).padStart(s % 1 ? 4 : 2, "0")}`;
  };

  /* ---- the phone's calculator screens ---------------------------------- */

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function panel({ title, hint, fields, outId }) {
    return `<div class="calc">
      <h3>${esc(title)}</h3>
      ${hint ? `<p class="calc-hint">${esc(hint)}</p>` : ""}
      ${fields}
      <div class="calc-out" id="${outId}"></div>
    </div>`;
  }

  const field = (id, label, attrs = 'inputmode="decimal"') =>
    `<div class="field"><label for="${id}">${esc(label)}</label>
      <input id="${id}" ${attrs}></div>`;

  const TABS = ["Strength", "Conditioning", "Load"];

  function render(container, tab, onTab) {
    container.innerHTML = `
      <div class="chips" id="calcTabs">
        ${TABS.map((t) => `<button class="chip ${t === tab ? "on" : ""}" data-tab="${t}">${t}</button>`).join("")}
      </div>
      <div id="calcBody"></div>`;
    container.querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => onTab(b.dataset.tab)));
    const body = container.querySelector("#calcBody");
    ({ Strength: strength, Conditioning: conditioning, Load: load })[tab](body);
  }

  /* ---- Strength -------------------------------------------------------- */

  function strength(body) {
    body.innerHTML =
      panel({
        title: "1RM and working loads",
        hint: "Estimate a one-rep max from a set you actually did, then read the percentages off it.",
        outId: "rmOut",
        fields: `<div class="field-pair">
            ${field("rmW", "Weight lifted (kg)")}
            ${field("rmR", "Reps", 'inputmode="numeric" value="5"')}
          </div>
          <div class="field"><label for="rmF">Percentages from</label>
            <select id="rmF">${["Average", "Epley", "Brzycki", "Lombardi", "O'Conner"]
              .map((f) => `<option>${f}</option>`).join("")}</select></div>`,
      }) +
      panel({
        title: "Plate loader",
        hint: "What to hang on each side to reach a target, using a standard gym set.",
        outId: "plOut",
        fields: `<div class="field-pair">
            ${field("plT", "Target total (kg)")}
            <div class="field"><label for="plB">Bar</label>
              <select id="plB">${DEFAULT_BARS.map((b) => `<option>${b}</option>`).join("")}</select></div>
          </div>`,
      }) +
      panel({
        title: "Relative strength and DOTS",
        hint: "Lift divided by bodyweight, plus DOTS points for comparing across bodyweights.",
        outId: "rsOut",
        fields: `<div class="field-pair">
            ${field("rsL", "Lift (kg)")}
            ${field("rsB", "Bodyweight (kg)")}
          </div>
          <div class="field"><label for="rsS">Coefficients</label>
            <select id="rsS"><option value="male">Male</option><option value="female">Female</option></select></div>`,
      });

    const live = (ids, fn) => ids.forEach((id) =>
      body.querySelector("#" + id).addEventListener("input", fn));

    const runRM = () => {
      const out = body.querySelector("#rmOut");
      const w = parseFloat(body.querySelector("#rmW").value);
      const r = parseInt(body.querySelector("#rmR").value, 10);
      const est = est1RM(w, r);
      if (!est) { out.innerHTML = ""; return; }
      const pick = { Average: "avg", Epley: "epley", Brzycki: "brzycki",
        Lombardi: "lombardi", "O'Conner": "oconner" }[body.querySelector("#rmF").value];
      const oneRM = est[pick];
      const pcts = [95, 90, 85, 80, 75, 70, 65, 60];
      out.innerHTML = `
        <div class="out-big">${num(oneRM)} kg</div>
        <div class="out-label">estimated 1RM</div>
        <table class="out-table"><tbody>
          ${[["Epley", est.epley], ["Brzycki", est.brzycki], ["Lombardi", est.lombardi],
             ["O'Conner", est.oconner], ["Average", est.avg]]
            .map(([k, v]) => `<tr><td>${k}</td><td>${num(v)} kg</td></tr>`).join("")}
        </tbody></table>
        <table class="out-table"><thead><tr><th>Percentage</th><th>Load</th></tr></thead><tbody>
          ${pcts.map((p) => `<tr><td>${p}%</td><td>${num(oneRM * p / 100)} kg</td></tr>`).join("")}
        </tbody></table>`;
    };
    live(["rmW", "rmR"], runRM);
    body.querySelector("#rmF").addEventListener("change", runRM);

    const runPlates = () => {
      const out = body.querySelector("#plOut");
      const t = parseFloat(body.querySelector("#plT").value);
      const bar = parseFloat(body.querySelector("#plB").value);
      const r = plateLoad(t, bar, DEFAULT_PLATES);
      if (!r) { out.innerHTML = ""; return; }
      out.innerHTML = `
        <div class="out-big">${num(r.loaded)} kg</div>
        <div class="out-label">${r.short > 0
          ? `closest reachable — ${num(r.short)} kg short of target`
          : "on the bar, including the bar"}</div>
        <table class="out-table"><thead><tr><th>Per side</th><th>Count</th></tr></thead><tbody>
          ${r.perSide.length
            ? r.perSide.map((p) => `<tr><td>${num(p.kg)} kg</td><td>&times; ${p.n}</td></tr>`).join("")
            : `<tr><td colspan="2">Bar only</td></tr>`}
        </tbody></table>`;
    };
    live(["plT"], runPlates);
    body.querySelector("#plB").addEventListener("change", runPlates);

    const runRS = () => {
      const out = body.querySelector("#rsOut");
      const lift = parseFloat(body.querySelector("#rsL").value);
      const bw = parseFloat(body.querySelector("#rsB").value);
      if (!(lift > 0) || !(bw > 0)) { out.innerHTML = ""; return; }
      const dots = dotsScore(lift, bw, body.querySelector("#rsS").value);
      out.innerHTML = `
        <div class="out-big">${(lift / bw).toFixed(2)}&times;</div>
        <div class="out-label">bodyweight</div>
        <table class="out-table"><tbody>
          <tr><td>DOTS points</td><td>${dots !== null ? dots.toFixed(1)
            : "needs 40–210 kg bodyweight"}</td></tr>
        </tbody></table>`;
    };
    live(["rsL", "rsB"], runRS);
    body.querySelector("#rsS").addEventListener("change", runRS);
  }

  /* Cam: "MAS Calculator has intervals starting at 110% MAS i need one
     for 100% and 105% as well please."

     100% is MAS itself -- the speed the test measured, which is the
     reference every other row is a percentage of, and the one worth
     seeing written down. 105% and 110% are the long-interval end,
     115-120% the short-shuttle end. Held here rather than inline so
     the list is in one place if it ever changes again. */
  const MAS_INTENSITIES = [1.00, 1.05, 1.10, 1.15, 1.20];

  /* ---- Conditioning ---------------------------------------------------- */

  function conditioning(body) {
    body.innerHTML =
      panel({
        title: "MAS from a 1600 m test",
        hint: "Maximum aerobic speed, and the distances to set out for shuttle intervals at 100–120%.",
        outId: "masOut",
        fields: `<div class="field-pair">
            ${field("masT", "1600 m time (mm:ss)", 'inputmode="text" placeholder="6:20"')}
            ${field("masI", "Interval length (s)", 'inputmode="numeric" value="15"')}
          </div>`,
      }) +
      panel({
        title: "Heart rate zones",
        hint: "Enter a measured max, or an age to estimate it. Adding a resting HR switches to the Karvonen reserve method.",
        outId: "hrOut",
        fields: `<div class="field-pair">
            ${field("hrMax", "Max HR", 'inputmode="numeric"')}
            ${field("hrAge", "or age", 'inputmode="numeric"')}
          </div>
          ${field("hrRest", "Resting HR (optional)", 'inputmode="numeric"')}`,
      }) +
      panel({
        title: "Target pace and splits",
        hint: "A distance and a goal time, broken into the splits to hold.",
        outId: "paceOut",
        fields: `<div class="field-pair">
            ${field("pcD", "Distance (m)", 'inputmode="numeric"')}
            ${field("pcT", "Goal time (mm:ss)", 'inputmode="text" placeholder="20:00"')}
          </div>
          ${field("pcS", "Split every (m)", 'inputmode="numeric" value="400"')}`,
      });

    const live = (ids, fn) => ids.forEach((id) =>
      body.querySelector("#" + id).addEventListener("input", fn));

    live(["masT", "masI"], () => {
      const out = body.querySelector("#masOut");
      const t = parseTime(body.querySelector("#masT").value);
      const interval = parseInt(body.querySelector("#masI").value, 10) || 15;
      if (!t || t <= 0) { out.innerHTML = ""; return; }
      const mas = Math.round(1600 / t * 100) / 100;
      out.innerHTML = `
        <div class="out-big">${mas} m/s</div>
        <div class="out-label">maximum aerobic speed</div>
        <table class="out-table"><thead><tr><th>Intensity</th><th>Distance per ${interval}s</th></tr></thead><tbody>
          ${MAS_INTENSITIES.map((m) => `<tr><td>${Math.round(m * 100)}% &middot; ${(mas * m).toFixed(2)} m/s</td>
            <td>${(mas * m * interval).toFixed(1)} m</td></tr>`).join("")}
        </tbody></table>`;
    });

    live(["hrMax", "hrAge", "hrRest"], () => {
      const out = body.querySelector("#hrOut");
      let max = parseFloat(body.querySelector("#hrMax").value);
      const age = parseFloat(body.querySelector("#hrAge").value);
      if (!(max > 100) && age > 0) max = 220 - age;
      const restRaw = body.querySelector("#hrRest").value.trim();
      const rest = restRaw ? parseFloat(restRaw) : null;
      const zones = hrZones(max, rest);
      if (!zones) { out.innerHTML = ""; return; }
      const names = ["Recovery", "Easy aerobic", "Aerobic / tempo", "Threshold", "Max effort"];
      out.innerHTML = `
        <div class="out-label">Max HR ${Math.round(max)}${zones[0].method === "karvonen"
          ? ` &middot; resting ${Math.round(rest)}, Karvonen` : " &middot; %HRmax"}</div>
        <table class="out-table"><thead><tr><th>Zone</th><th>bpm</th></tr></thead><tbody>
          ${zones.map((z, i) => `<tr><td>${z.zone} &middot; ${names[i]}</td><td>${z.lo}–${z.hi}</td></tr>`).join("")}
        </tbody></table>`;
    });

    live(["pcD", "pcT", "pcS"], () => {
      const out = body.querySelector("#paceOut");
      const dist = parseFloat(body.querySelector("#pcD").value);
      const time = parseTime(body.querySelector("#pcT").value);
      const split = parseFloat(body.querySelector("#pcS").value) || 400;
      if (!(dist > 0) || !(time > 0)) { out.innerHTML = ""; return; }
      const perM = time / dist;
      const rows = [];
      for (let d = split; d <= dist + 0.001; d += split) {
        rows.push([d, fmtTime(Math.round(d * perM))]);
      }
      if (rows.length && rows[rows.length - 1][0] < dist) rows.push([dist, fmtTime(Math.round(time))]);
      out.innerHTML = `
        <div class="out-big">${fmtTime(Math.round(perM * 1000))} /km</div>
        <div class="out-label">${(dist / time).toFixed(2)} m/s &middot; ${fmtTime(Math.round(perM * split))} per ${split} m</div>
        <table class="out-table"><thead><tr><th>Distance</th><th>Elapsed</th></tr></thead><tbody>
          ${rows.slice(0, 30).map(([d, t]) => `<tr><td>${d} m</td><td>${t}</td></tr>`).join("")}
        </tbody></table>`;
    });
  }

  /* ---- Load ------------------------------------------------------------ */

  function load(body) {
    body.innerHTML =
      panel({
        title: "Volume load",
        hint: "Sets × reps × weight — the tonnage a session actually moved.",
        outId: "vlOut",
        fields: `<div class="field-pair">
            ${field("vlS", "Sets", 'inputmode="numeric"')}
            ${field("vlR", "Reps", 'inputmode="numeric"')}
          </div>
          ${field("vlW", "Weight (kg)")}`,
      }) +
      panel({
        title: "Session RPE load",
        hint: "Duration in minutes × session RPE (0–10). The standard internal-load number.",
        outId: "slOut",
        fields: `<div class="field-pair">
            ${field("slM", "Duration (min)", 'inputmode="numeric"')}
            ${field("slR", "Session RPE", 'inputmode="decimal"')}
          </div>`,
      });

    const live = (ids, fn) => ids.forEach((id) =>
      body.querySelector("#" + id).addEventListener("input", fn));

    live(["vlS", "vlR", "vlW"], () => {
      const out = body.querySelector("#vlOut");
      const s = parseFloat(body.querySelector("#vlS").value);
      const r = parseFloat(body.querySelector("#vlR").value);
      const w = parseFloat(body.querySelector("#vlW").value);
      if (!(s > 0) || !(r > 0) || !(w > 0)) { out.innerHTML = ""; return; }
      out.innerHTML = `<div class="out-big">${num(s * r * w)} kg</div>
        <div class="out-label">${num(s)} × ${num(r)} × ${num(w)} kg &middot; ${num(s * r)} total reps</div>`;
    });

    live(["slM", "slR"], () => {
      const out = body.querySelector("#slOut");
      const m = parseFloat(body.querySelector("#slM").value);
      const r = parseFloat(body.querySelector("#slR").value);
      if (!(m > 0) || !(r >= 0)) { out.innerHTML = ""; return; }
      out.innerHTML = `<div class="out-big">${num(m * r)} AU</div>
        <div class="out-label">${num(m)} min × RPE ${num(r)}</div>`;
    });
  }

  return { render, TABS, est1RM, dotsScore, plateLoad, hrZones, parseTime, num,
    MAS_INTENSITIES };
})();
