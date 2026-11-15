/* The Grid engine, tested on its own — no screen, no browser.
   Every rule a spreadsheet can get wrong: formulas and their errors, fill,
   sorting, filtering, number formats, conditional colours, and Excel's
   clipboard format. */
const path = require("path");
const G = require(path.join(__dirname, "..", "ui", "notes", "grid.js"));

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log("  ok    " + name); }
  else { failed++; console.log("  FAIL  " + name + (detail !== undefined ? "\n          " + JSON.stringify(detail) : "")); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Build a grid from rows and return every computed value. */
function calc(rows) { return G.computeAll(G.normalise({rows})); }
const one = (formula, rows = []) => {
  const r = rows.length ? rows.map((x) => x.slice()) : [[""]];
  r[0][0] = formula;
  return calc(r)[0][0];
};
const code = (v) => (G.isErr(v) ? v.code : v);

console.log("\nGrid engine\n");

// ---- addresses ----------------------------------------------------------
ok("column letters", eq([0, 25, 26, 51, 52, 701, 702].map(G.colName),
  ["A", "Z", "AA", "AZ", "BA", "ZZ", "AAA"]));
ok("and back again", [0, 25, 26, 51, 52, 701, 702].every((i) => G.colIndex(G.colName(i)) === i));
ok("a reference keeps its $ marks", eq(G.parseRef("$B$12"), {c: 1, r: 11, absC: true, absR: true}));
ok("a range is normalised whichever way it is written",
  eq(G.parseRange("C3:A1"), {c1: 0, r1: 0, c2: 2, r2: 2}));

// ---- saving -------------------------------------------------------------
const model = G.normalise({rows: [["Name", "Kg"], ["Squat", "100"]], future: {x: 1}});
const back = G.parse(G.serialize(model));
ok("a grid survives saving and reloading", eq(back.rows, model.rows));
ok("a setting from a newer build is kept, not dropped", eq(back.future, {x: 1}));
ok("one row per line, so a one-cell edit is a one-line change",
  G.serialize(model).split("\n").filter((l) => l.trim().startsWith('["')).length === 2);
const broken = G.parse('{"rows": [["a", ');
ok("text that cannot be read is kept exactly as it was, not replaced",
  broken.error && broken.raw === '{"rows": [["a", ');
ok("rows are padded to the same width", eq(G.normalise({rows: [["a"], ["b", "c", "d"]]}).rows[0], ["a", "", ""]));

// ---- formulas -----------------------------------------------------------
ok("precedence: 2+3*4 = 14", one("=2+3*4") === 14);
ok("brackets: (2+3)*4 = 20", one("=(2+3)*4") === 20);
ok("powers bind right to left: 2^3^2 = 512", one("=2^3^2") === 512);
ok("unary minus: -2^2 = 4, as Excel has it", one("=-2^2") === 4);
ok("percent: 50%*200 = 100", one("=50%*200") === 100);
const sheet = [["", "10", "20", "30", "text", ""]];
ok("SUM of a range", one("=SUM(B1:D1)", sheet) === 60);
ok("SUM skips text in a range", one("=SUM(B1:E1)", sheet) === 60);
ok("AVERAGE", one("=AVERAGE(B1:D1)", sheet) === 20);
ok("MIN and MAX", one("=MIN(B1:D1)", sheet) === 10 && one("=MAX(B1:D1)", sheet) === 30);
ok("COUNT counts numbers, COUNTA anything filled",
  one("=COUNT(B1:F1)", sheet) === 3 && one("=COUNTA(B1:F1)", sheet) === 4);
ok("MEDIAN", one("=MEDIAN(B1:D1)", sheet) === 20);
ok("ROUND", one("=ROUND(2.567, 2)") === 2.57);
ok("IF chooses", one('=IF(B1>5, "heavy", "light")', sheet) === "heavy");
ok("text joins with &", one('="Set "&B1', sheet) === "Set 10");
ok("comparisons give TRUE/FALSE", one("=B1<C1", sheet) === true);
ok("a blank cell counts as zero in arithmetic", one("=F1+5", sheet) === 5);
ok("a whole training load: sets x reps x kg", one("=B1*C1*D1", sheet) === 6000);

// ---- formula errors -----------------------------------------------------
ok("divide by zero is #DIV/0!", code(one("=1/0")) === "#DIV/0!");
ok("a reference off the grid is #REF!", code(one("=Z99")) === "#REF!");
ok("an unknown function is #NAME?", code(one("=NOPE(1)")) === "#NAME?");
ok("text in arithmetic is #VALUE!", code(one("=E1+1", sheet)) === "#VALUE!");
ok("broken typing is #ERROR!, not a crash", code(one("=2+*3")) === "#ERROR!");
ok("a cell referring to itself is #CIRC!, not a freeze", code(one("=A1")) === "#CIRC!");
const loop = calc([["=B1", "=A1"]]);
ok("a loop through two cells is #CIRC! in both", code(loop[0][0]) === "#CIRC!" && code(loop[0][1]) === "#CIRC!");
const spread = calc([["=1/0", "=A1+1"]]);
ok("an error carries through to the cells that use it", code(spread[0][1]) === "#DIV/0!");
ok("SUM over a range holding an error reports that error", code(calc([["=1/0", "=SUM(A1:A1)"]])[0][1]) === "#DIV/0!");

// ---- moving formulas ----------------------------------------------------
ok("relative references move", G.shiftFormula("=B2*C2", 1, 0) === "=B3*C3");
ok("$ keeps a column or row fixed", G.shiftFormula("=$B2*C$2+$D$4", 2, 1) === "=$B4*D$2+$D$4");
ok("ranges move", G.shiftFormula("=SUM(B2:B5)", 3, 0) === "=SUM(B5:B8)");
ok("text in quotes is left alone", G.shiftFormula('="B2 is "&B2', 1, 0) === '="B2 is "&B3');
ok("function names are not mistaken for cells", G.shiftFormula("=SUM(A1)+ROUND(A1,2)", 1, 0) === "=SUM(A2)+ROUND(A2,2)");
ok("pushed off the top becomes #REF!", G.shiftFormula("=A1", -1, 0) === "=#REF!");
ok("plain values are never touched", G.shiftFormula("B2", 1, 0) === "B2");

// ---- fill ---------------------------------------------------------------
ok("1, 2 continues 3, 4, 5", eq(G.fillSeries(["1", "2"], 3), ["3", "4", "5"]));
ok("5, 10 continues 15, 20", eq(G.fillSeries(["5", "10"], 2), ["15", "20"]));
ok("decimal steps stay clean: 0.1, 0.2 -> 0.3, 0.4", eq(G.fillSeries(["0.1", "0.2"], 2), ["0.3", "0.4"]));
ok("a single number is copied", eq(G.fillSeries(["7"], 2), ["7", "7"]));
ok('"Week 1" counts up', eq(G.fillSeries(["Week 1"], 3), ["Week 2", "Week 3", "Week 4"]));
ok("a formula fills down with its references moved", eq(G.fillSeries(["=B2*2"], 2), ["=B3*2", "=B4*2"]));
ok("and fills right the same way", eq(G.fillSeries(["=B2*2"], 1, "right"), ["=C2*2"]));
ok("plain text repeats", eq(G.fillSeries(["Squat"], 2), ["Squat", "Squat"]));

// ---- sorting ------------------------------------------------------------
const lifts = G.normalise({
  freeze: 1,
  rows: [["Lift", "Kg", "x2"], ["Squat", "100", "=B2*2"], ["Bench", "", "=B3*2"],
         ["Deadlift", "140", "=B4*2"], ["Press", "60", "=B5*2"]],
  fmt: {B4: {b: true}},
});
const asc = G.sortRows(lifts, 1, "asc");
ok("the header row stays put", eq(asc.rows[0], ["Lift", "Kg", "x2"]));
ok("sorted by value, blanks last", eq(asc.rows.slice(1).map((r) => r[0]), ["Press", "Squat", "Deadlift", "Bench"]));
const desc = G.sortRows(lifts, 1, "desc");
ok("descending, blanks STILL last", eq(desc.rows.slice(1).map((r) => r[0]), ["Deadlift", "Squat", "Press", "Bench"]));
const av = G.computeAll(asc);
ok("every moved formula still reads its own row",
  asc.rows.slice(1).every((r, i) => av[i + 1][2] === (av[i + 1][1] === "" ? 0 : av[i + 1][1] * 2)));
ok("formatting moves with its row (Deadlift's bold)", !!asc.fmt[G.refName(1, asc.rows.findIndex((r) => r[0] === "Deadlift"))]);
ok("text sorts naturally: Set 2 before Set 10",
  eq(G.sortRows(G.normalise({freeze: 0, rows: [["Set 10"], ["Set 2"], ["Set 1"]]}), 0).rows.map((r) => r[0]),
    ["Set 1", "Set 2", "Set 10"]));
ok("equal values keep their order (stable)",
  eq(G.sortRows(G.normalise({freeze: 0, rows: [["b", "1"], ["a", "1"], ["c", "0"]]}), 1).rows.map((r) => r[0]),
    ["c", "b", "a"]));

// ---- filter -------------------------------------------------------------
const f = Object.assign(G.normalise(lifts), {filter: {col: 1, op: ">=", value: "100"}});
ok("a filter shows matching rows", eq(G.visibleRows(f), [0, 1, 3]));
// A filter the header row itself FAILS ("Lift" is not "Squat"), so this
// proves the header is kept on purpose rather than by luck. An earlier
// version used ">= 100", which the header text happens to pass as text.
ok("the header is always shown, even when it fails the filter",
  eq(G.visibleRows(Object.assign(G.normalise(lifts), {filter: {col: 0, op: "=", value: "Squat"}})), [0, 1]));
ok("filtering never deletes a row", f.rows.length === 5);
ok("contains is case-insensitive",
  eq(G.visibleRows(Object.assign(G.normalise(lifts), {filter: {col: 0, op: "contains", value: "LIFT"}})), [0, 3]));
ok("blank / not blank",
  eq(G.visibleRows(Object.assign(G.normalise(lifts), {filter: {col: 1, op: "blank"}})), [0, 2]));

// ---- number formats -----------------------------------------------------
ok("general", G.display(1234.5) === "1234.5");
ok("2 decimal places", G.display(3.14159, "d2") === "3.14");
ok("thousands", G.display(1234567, "thousands") === "1,234,567");
ok("percent", G.display(0.125, "pct1") === "12.5%");
ok("currency, negative", G.display(-1234.5, "money") === "-$1,234.50");
ok("a format on text leaves the text alone", G.display("Squat", "money") === "Squat");
ok("floating-point noise is hidden: 0.1+0.2 shows 0.3", G.display(one("=0.1+0.2")) === "0.3");

// ---- conditional colouring ---------------------------------------------
const rules = G.normalise({rows: [["", "80"], ["", "120"]],
  cond: [{range: "B1:B2", op: ">", value: "100", bg: "#fdd"},
         {range: "B1:B2", op: "<", value: "90", color: "#080"}]});
const rv = G.computeAll(rules);
ok("over target is coloured", eq(G.condStyle(rules, 1, 1, rv), {bg: "#fdd"}));
ok("a second rule applies to its own cells", eq(G.condStyle(rules, 1, 0, rv), {color: "#080"}));
ok("outside the rule's range is untouched", G.condStyle(rules, 0, 0, rv) === null);

// ---- Excel's clipboard --------------------------------------------------
const tsv = "Lift\tKg\nSquat\t100\n\"Note, with\ttab\"\t\"says \"\"hi\"\"\"\n";
ok("Excel's copied text becomes rows", eq(G.fromTSV(tsv), [["Lift", "Kg"], ["Squat", "100"], ["Note, with\ttab", 'says "hi"']]));
ok("Excel's trailing newline does not add an empty row", G.fromTSV("a\tb\n").length === 1);
ok("Windows line endings too", eq(G.fromTSV("a\r\nb\r\n"), [["a"], ["b"]]));
ok("a round trip out to Excel and back is exact",
  eq(G.fromTSV(G.toTSV([["a\tb", 'q"x'], ["line\nbreak", ""]])), [["a\tb", 'q"x'], ["line\nbreak", ""]]));

// ---- charts -------------------------------------------------------------
const ch = G.normalise({rows: [["Mon", "10"], ["Tue", "x"], ["Wed", "30"]],
  chart: {type: "bar", labels: "A1:A3", series: ["B1:B3"], title: "Load"}});
const cd = G.chartData(ch);
ok("chart labels", eq(cd.labels, ["Mon", "Tue", "Wed"]));
ok("a non-number is a gap, not a false zero", eq(cd.series[0].values, [10, null, 30]));

// ---- drawing a chart ----------------------------------------------------
const svgOf = (rows, chart) => G.chartSVG(G.chartData(G.normalise({rows, chart})), {width: 600, height: 240});
const bar = svgOf([["Mon", "10"], ["Tue", "30"], ["Wed", "20"]],
  {type: "bar", labels: "A1:A3", series: ["B1:B3"], title: "Load"});
ok("a chart is an SVG, drawn here — nothing fetched", bar.startsWith("<svg") && bar.endsWith("</svg>"));
ok("the title is drawn", bar.includes("Load"));
ok("every label is drawn", ["Mon", "Tue", "Wed"].every((l) => bar.includes(l)));
ok("one bar per value", (bar.match(/<rect /g) || []).length === 3);
{
  // Bars must be measured from zero: 10 against 30 should be a third the
  // height. A cut-off axis would make it look tiny instead.
  const hs = [...bar.matchAll(/<rect [^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
  ok("bars are measured from zero, so 10 vs 30 is a third the height",
    Math.abs(hs[0] / hs[1] - 1 / 3) < 0.02, hs);
}
{
  const line = svgOf([["Mon", "10"], ["Tue", "x"], ["Wed", "30"]],
    {type: "line", labels: "A1:A3", series: ["B1:B3"]});
  const runs = [...line.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => m[1].split(" ").length);
  const dots = (line.match(/<circle /g) || []).length;
  ok("a gap BREAKS the line instead of dropping to zero", runs.length === 0 && dots === 2, {runs, dots});
}
{
  const neg = svgOf([["a", "-20"], ["b", "40"]], {type: "bar", labels: "A1:A2", series: ["B1:B2"]});
  ok("negative values are handled", (neg.match(/<rect /g) || []).length === 2);
}
{
  const two = svgOf([["a", "1", "5"], ["b", "2", "6"]],
    {type: "line", labels: "A1:A2", series: ["B1:B2", "C1:C2"]});
  ok("two series get two colours and a key",
    new Set([...two.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((m) => m[1])).size === 2
    && two.includes("B1:B2") && two.includes("C1:C2"));
}
ok("no numbers yet says so, rather than drawing an empty frame",
  svgOf([["a", "x"]], {type: "bar", labels: "A1:A1", series: ["B1:B1"]}).includes("Nothing to chart yet"));
ok("a label with < or & cannot break the drawing",
  svgOf([['<script>&', "1"], ["b", "2"]], {type: "bar", labels: "A1:A2", series: ["B1:B2"]}).includes("&lt;script&gt;&amp;"));

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
