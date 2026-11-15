/* ==========================================================================
   The training numbers — frozen contract.
   ==========================================================================
   Coach Cam's calculators are the same shape of risk as Cashbox's date
   maths: pure functions, carried across verbatim on purpose, and with
   nothing enforcing that. Its own header says the formulas "are carried
   across verbatim rather than re-derived, so a number worked out on the
   phone matches the one on the desktop exactly" — an intention with no
   test behind it.

   So this runs against EITHER app:

     node test_training_contract.js /home/claude/survey/coach-cam_3/coach-cam
     node test_training_contract.js /home/claude/kincrux

   It is run against the ORIGINAL first. A test that has not passed on
   the code it was derived from has not earned the right to judge a port.

   Expected values are computed by hand from the published formulas in
   the comments below, NOT captured from a run of the code — a snapshot
   of the current output would happily freeze a bug in place.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = process.argv[2] || path.join(__dirname, "..");

/* The file lives at the app root in Coach Cam and under ui/ once ported. */
const CANDIDATES = [
  "calculators.js",
  "ui/calculators.js",
  "ui/training/calculators.js",
];
let src = null, found = null;
for (const rel of CANDIDATES) {
  const p = path.join(APP, rel);
  if (fs.existsSync(p)) { src = fs.readFileSync(p, "utf8"); found = rel; break; }
}
if (!src) {
  console.error("No calculators.js under " + APP + "\n  looked in: "
    + CANDIDATES.join(", "));
  process.exit(1);
}

/* It is an IIFE assigned to CF.Calc, so give it a CF to hang itself on
   rather than trying to reach into the closure. */
const sandbox = {CF: {}, window: {}, document: undefined, console};
sandbox.window.CF = sandbox.CF;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename: found});
const C = sandbox.CF.Calc;
if (!C) { console.error("calculators.js did not define CF.Calc"); process.exit(1); }

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, detail) {
  if (cond) { pass++; out.push("  ok    " + name); }
  else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
}
/* Formula results are floating point. Compare to a tolerance, and say
   what the gap actually was when it fails. */
function near(name, got, want, tol = 1e-6) {
  const good = got !== null && got !== undefined && Math.abs(got - want) <= tol;
  ok(name, good, good ? "" : `got ${got}, expected ${want} (±${tol})`);
}

/* ---------------------------------------------------------------- est1RM */
/* Epley    w(1 + r/30)
   Brzycki  w·36/(37 − min(r,36))
   Lombardi w·r^0.10
   O'Conner w(1 + 0.025r)                                                  */
{
  ok("one rep is the lift itself, not an estimate",
    JSON.stringify(C.est1RM(100, 1))
      === JSON.stringify({epley: 100, brzycki: 100, lombardi: 100, oconner: 100, avg: 100}),
    JSON.stringify(C.est1RM(100, 1)));

  const e = C.est1RM(100, 10);
  near("Epley at 100kg x 10", e.epley, 100 * (1 + 10 / 30));
  near("Brzycki at 100kg x 10", e.brzycki, 100 * 36 / 27);
  near("Lombardi at 100kg x 10", e.lombardi, 100 * Math.pow(10, 0.10));
  near("O'Conner at 100kg x 10", e.oconner, 125);
  near("the average is of all four", e.avg,
    (e.epley + e.brzycki + e.lombardi + e.oconner) / 4);

  /* Brzycki's denominator hits zero at 37 reps and goes NEGATIVE beyond
     it. The cap is the only thing between this and a nonsense answer. */
  const cap = C.est1RM(100, 36), over = C.est1RM(100, 50);
  near("Brzycki caps at 36 reps", cap.brzycki, 100 * 36 / 1);
  ok("past the cap Brzycki does not go negative or infinite",
    over.brzycki === cap.brzycki && isFinite(over.brzycki),
    "36 reps -> " + cap.brzycki + ", 50 reps -> " + over.brzycki);
  ok("but the other three keep climbing past the cap",
    over.epley > cap.epley && over.oconner > cap.oconner, "");

  ok("no weight is not a lift", C.est1RM(0, 5) === null, "");
  ok("negative weight is not a lift", C.est1RM(-100, 5) === null, "");
  ok("zero reps is not a set", C.est1RM(100, 0) === null, "");
  ok("more reps never estimates a lower 1RM",
    C.est1RM(100, 5).avg < C.est1RM(100, 12).avg, "");
}

/* -------------------------------------------------------------- dotsScore */
/* 500·lift / (a + b·bw + c·bw² + d·bw³ + e·bw⁴), coefficients per sex.   */
{
  const M = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000000731];
  const F = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  const poly = (c, bw) =>
    c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4;

  near("DOTS, male 200kg at 80kg bodyweight",
    C.dotsScore(200, 80, "male"), 500 / poly(M, 80) * 200, 1e-9);
  near("DOTS, female 120kg at 60kg bodyweight",
    C.dotsScore(120, 60, "female"), 500 / poly(F, 60) * 120, 1e-9);

  ok("an unknown sex falls back to the male coefficients",
    Math.abs(C.dotsScore(200, 80, "other") - C.dotsScore(200, 80, "male")) < 1e-12, "");

  /* The 40–210kg bounds are not fussiness: the quartic is only fitted
     over that range and turns over outside it. */
  ok("below 40kg bodyweight is refused", C.dotsScore(200, 39.9, "male") === null, "");
  ok("40kg exactly is allowed", C.dotsScore(200, 40, "male") !== null, "");
  ok("210kg exactly is allowed", C.dotsScore(200, 210, "male") !== null, "");
  ok("above 210kg bodyweight is refused", C.dotsScore(200, 210.1, "male") === null, "");
  ok("a zero lift scores nothing", C.dotsScore(0, 80, "male") === null, "");

  ok("a heavier lifter scores lower for the same lift",
    C.dotsScore(200, 120, "male") < C.dotsScore(200, 80, "male"), "");
  ok("the score is linear in the lift",
    Math.abs(C.dotsScore(400, 80, "male") - 2 * C.dotsScore(200, 80, "male")) < 1e-9, "");
}

/* -------------------------------------------------------------- plateLoad */
{
  const INV = [
    {kg: 25, pairs: 2}, {kg: 20, pairs: 4}, {kg: 15, pairs: 2},
    {kg: 10, pairs: 2}, {kg: 5, pairs: 2}, {kg: 2.5, pairs: 2},
    {kg: 1.25, pairs: 2},
  ];
  const total = (r) => r.perSide.reduce((s, p) => s + p.kg * p.n, 0);

  /* 100kg on a 20kg bar is 40 a side: 25 + 15. */
  const a = C.plateLoad(100, 20, INV);
  ok("100kg on a 20kg bar loads 40 a side", total(a) === 40, JSON.stringify(a.perSide));
  ok("and nothing is left over", a.short === 0, String(a.short));
  ok("the loaded total is what was asked for", a.loaded === 100, String(a.loaded));

  /* Greedy takes the biggest plate first, so 40 is 25+15, not 20+20. */
  ok("it takes the heaviest plate that fits first",
    a.perSide[0].kg === 25, JSON.stringify(a.perSide));

  /* The inventory is finite. This rack holds 197.5kg a side, so 415kg
     on a 20kg bar is everything it has.

     My first draft of this asserted 300kg must come up short. It does
     not — 140 a side is 2x25 + 4x20 + 1x10, comfortably inside the
     rack. The test was wrong, not the code. Both cases are kept: 300kg
     proves the limit is respected while still reachable, 500kg proves
     the shortfall is reported rather than hidden. */
  const big = C.plateLoad(300, 20, INV);
  ok("it never uses more plates than exist",
    big.perSide.every((p) => p.n <= (INV.find((i) => i.kg === p.kg) || {}).pairs),
    JSON.stringify(big.perSide));
  ok("300kg is fully loadable from this rack",
    big.short === 0 && big.loaded === 300, `loaded ${big.loaded} short ${big.short}`);

  const over = C.plateLoad(500, 20, INV);
  ok("beyond the rack it reports the shortfall rather than pretending",
    over.short > 0 && Math.abs(over.loaded + over.short - 500) < 1e-9,
    `loaded ${over.loaded} short ${over.short}`);
  ok("and it loads everything the rack has before giving up",
    Math.abs(over.loaded - 415) < 1e-9, `loaded ${over.loaded}, rack maximum 415`);

  /* 1.25s exist, so an odd 2.5 total is reachable. */
  const odd = C.plateLoad(22.5, 20, INV);
  ok("a 1.25 a side is reachable", total(odd) === 1.25 && odd.short === 0,
    JSON.stringify(odd));

  /* Floating point: (62.5 - 20)/2 = 21.25, which is 20 + 1.25 exactly,
     but only if the epsilon in the floor() is doing its job. */
  const fp = C.plateLoad(62.5, 20, INV);
  ok("no float dust leaves a phantom shortfall", fp.short === 0,
    `short ${fp.short} on ${JSON.stringify(fp.perSide)}`);

  ok("the bar alone needs no plates",
    C.plateLoad(20, 20, INV).perSide.length === 0, "");
  ok("below the bar is refused", C.plateLoad(15, 20, INV) === null, "");
  ok("no bar is refused", C.plateLoad(100, 0, INV) === null, "");
  ok("plates with no pairs are ignored",
    total(C.plateLoad(100, 20, [{kg: 25, pairs: 0}, {kg: 20, pairs: 4}])) === 40, "");
  ok("an empty rack loads nothing and is honest about it",
    C.plateLoad(100, 20, []).short === 80, "");
}

/* ---------------------------------------------------------------- hrZones */
{
  const z = C.hrZones(200);
  ok("there are five zones", z.length === 5, String(z.length));
  ok("plain percentage when no resting HR is given",
    z.every((x) => x.method === "pct"), "");
  ok("zone 1 is 50-60% of max", z[0].lo === 100 && z[0].hi === 120,
    JSON.stringify(z[0]));
  ok("zone 5 tops out at max", z[4].hi === 200, JSON.stringify(z[4]));
  ok("the zones are contiguous",
    z.every((x, i) => i === 0 || x.lo === z[i - 1].hi), JSON.stringify(z));

  /* Karvonen: rest + pct x (max - rest). At 200/50 that is 50 + 0.5x150. */
  const k = C.hrZones(200, 50);
  ok("a resting HR switches to Karvonen",
    k.every((x) => x.method === "karvonen"), "");
  ok("Karvonen zone 1 starts at rest + 50% of reserve",
    k[0].lo === 125, JSON.stringify(k[0]));
  ok("Karvonen still tops out at max", k[4].hi === 200, JSON.stringify(k[4]));
  ok("Karvonen zones sit above plain percentage zones",
    k[0].lo > z[0].lo, "");

  /* A resting HR at or above max would invert the reserve. */
  ok("a resting HR above max falls back to percentage",
    C.hrZones(200, 250).every((x) => x.method === "pct"), "");
  ok("an implausible resting HR falls back to percentage",
    C.hrZones(200, 5).every((x) => x.method === "pct"), "");
  ok("a max HR of 100 or less is refused", C.hrZones(100) === null, "");
}

/* -------------------------------------------------------------- parseTime */
{
  ok("plain seconds", C.parseTime("90") === 90, String(C.parseTime("90")));
  ok("decimal seconds", C.parseTime("9.5") === 9.5, String(C.parseTime("9.5")));
  ok("mm:ss", C.parseTime("1:30") === 90, String(C.parseTime("1:30")));
  ok("m:ss with a single-digit minute", C.parseTime("4:05") === 245,
    String(C.parseTime("4:05")));
  ok("tenths after the seconds", C.parseTime("1:30.5") === 90.5,
    String(C.parseTime("1:30.5")));
  ok("minutes are not capped at 59", C.parseTime("90:00") === 5400,
    String(C.parseTime("90:00")));
  ok("surrounding space is ignored", C.parseTime("  1:30  ") === 90, "");

  /* 60+ seconds past the colon is a typo, not 1:75 = 135. */
  ok("more than 59 seconds is rejected rather than silently carried",
    C.parseTime("1:75") === null, String(C.parseTime("1:75")));
  ok("nonsense is null", C.parseTime("abc") === null, "");
  ok("empty is null", C.parseTime("") === null, "");
  ok("null input is null", C.parseTime(null) === null, "");
  ok("a bare colon is null", C.parseTime(":") === null, "");
  ok("negative time is null", C.parseTime("-5") === null,
    String(C.parseTime("-5")));
}

/* ------------------------------------------------------------ MAS table */
/* Cam: "MAS Calculator has intervals starting at 110% MAS i need one for
   100% and 105% as well please."

   MAS itself is 1600 / time. The table is the distance to set out for an
   interval of N seconds at each intensity: MAS x intensity x seconds. */
if (!C.MAS_INTENSITIES) {
  /* The original Coach Cam had 110/115/120 written inline in the render
     function. Cam asked for 100% and 105% as well, so this is the one
     place KinCrux DELIBERATELY differs from it -- a change, not a
     regression. Skipped rather than failed when running against the
     original, so the rest of the contract stays meaningful there. */
  out.push("  --    MAS intensities: this build predates the 100/105% "
    + "change, skipped");
} else {
  const I = C.MAS_INTENSITIES;
  ok("the intensity list is exposed rather than buried inline",
    Array.isArray(I), typeof I);
  ok("it starts at 100%, not 110%", I[0] === 1.00, String(I[0]));
  ok("105% is there", I.includes(1.05), I.join(", "));
  ok("and the original 110, 115 and 120 are all still there",
    [1.10, 1.15, 1.20].every((x) => I.includes(x)), I.join(", "));
  ok("five intensities in all", I.length === 5, String(I.length));
  ok("they are in ascending order",
    I.every((x, i) => i === 0 || x > I[i - 1]), I.join(", "));

  /* A 6:20 1600m is 380s, so MAS is 1600/380 = 4.2105 m/s. Worked out
     here from the formula, not read off the app. */
  const mas = Math.round(1600 / 380 * 100) / 100;
  near("a 6:20 1600m gives 4.21 m/s", mas, 4.21, 1e-9);
  near("100% of it over 15s is 63.1m", mas * 1.00 * 15, 63.15, 1e-9);
  near("105% over 15s is 66.3m", mas * 1.05 * 15, 66.3075, 1e-9);
  near("110% over 15s is 69.5m", mas * 1.10 * 15, 69.465, 1e-9);
  ok("100% is MAS itself, unscaled", mas * I[0] === mas, "");
}

/* -------------------------------------------------------------------- num */
{
  /* Within 0.05 of whole, show it whole; otherwise one decimal. */
  ok("a whole number loses its decimal", C.num(100) === "100", C.num(100));
  ok("near-whole rounds to whole", C.num(99.98) === "100", C.num(99.98));
  ok("just outside the threshold keeps a decimal", C.num(99.9) === "99.9",
    C.num(99.9));
  ok("one decimal place, not two", C.num(102.347) === "102.3", C.num(102.347));
  ok("it always shows the decimal when it shows one",
    C.num(102.04) === "102" && C.num(102.4) === "102.4",
    C.num(102.04) + " / " + C.num(102.4));
  ok("zero is zero", C.num(0) === "0", C.num(0));
  ok("negatives keep their sign", C.num(-12.34) === "-12.3", C.num(-12.34));
}

console.log("\nThe training numbers — frozen contract");
console.log("  source: " + path.join(APP, found) + "\n");
out.forEach((l) => console.log(l));
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
