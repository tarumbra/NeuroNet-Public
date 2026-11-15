/* ==========================================================================
   Grid — the engine. A spreadsheet inside a note.

   Cam: "More table features to mimic Excel ... a new tool in the notes bottom
   toolbar and called Grid (Which will be a table but will mimic Excel with
   extra functionality." Chosen abilities: formulas, sort and filter, cell
   formatting, charts, paste to and from Excel, fill down and series, a frozen
   header row, and conditional colouring.

   THIS FILE HAS NO SCREEN CODE. Every rule a spreadsheet can get wrong —
   formulas, fill, sorting, number formats, rules, pasting — lives here as
   plain functions over plain data, so each can be tested on its own. The
   interactive grid (grid-view.js) only draws what this computes.

   WHERE A GRID LIVES. Inside a note, as a fenced block:

       ```grid
       {"v": 1, "rows": [...], ...}
       ```

   The vault stays plain Markdown. NeuroNet draws the block as a working
   spreadsheet; Obsidian, or any text editor, shows readable data. One row
   of cells per line, so a change to one cell is a one-line change.

   Loaded as a plain script in the browser (window.SSGrid) and as a module in
   the tests. Deliberately NOT on the CC namespace: Notes and Celestial both
   use that name, and a third tenant is how one tool breaks another.
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SSGrid = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = 1;

  /* ------------------------------------------------------------ addresses */

  /** 0 -> "A", 25 -> "Z", 26 -> "AA" — spreadsheet column letters. */
  function colName(i) {
    let s = "";
    i += 1;
    while (i > 0) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function colIndex(letters) {
    let n = 0;
    for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  const REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})$/;

  /** "B12" -> {c: 1, r: 11}. "$B$12" keeps its $ marks for fill. */
  function parseRef(text) {
    const m = REF_RE.exec(String(text).trim());
    if (!m) return null;
    return {c: colIndex(m[2]), r: Number(m[4]) - 1, absC: !!m[1], absR: !!m[3]};
  }

  function refName(c, r) { return colName(c) + (r + 1); }

  /** "A1:B3" -> {c1, r1, c2, r2}, normalised so c1 <= c2 and r1 <= r2. */
  function parseRange(text) {
    const parts = String(text).split(":");
    const a = parseRef(parts[0]);
    const b = parts.length > 1 ? parseRef(parts[1]) : a;
    if (!a || !b) return null;
    return {c1: Math.min(a.c, b.c), r1: Math.min(a.r, b.r),
            c2: Math.max(a.c, b.c), r2: Math.max(a.r, b.r)};
  }

  /* --------------------------------------------------------------- model */

  function blank(rows = 5, cols = 4) {
    return {
      v: VERSION,
      cols: Array.from({length: cols}, () => ({w: 110})),
      rows: Array.from({length: rows}, () => Array(cols).fill("")),
      freeze: 1,          // header rows kept on screen while scrolling
      fmt: {},            // "B2" -> {b, i, color, bg, align, num}
      cond: [],           // [{range, op, value, bg, color}]
      filter: null,       // {col, op, value} — a view, never deletes rows
      chart: null,        // {type, labels, series: [range], title}
    };
  }

  /** Every row the same width, every cell a string, every field present.
      Anything unrecognised is kept, so a newer build's settings survive an
      older build opening and saving the same note. */
  function normalise(m) {
    const out = Object.assign(blank(0, 0), m);
    const width = Math.max(1, (m.cols || []).length,
                           ...(m.rows || []).map((r) => (r || []).length));
    out.rows = (m.rows || []).map((r) => {
      const row = (r || []).map((c) => (c == null ? "" : String(c)));
      while (row.length < width) row.push("");
      return row;
    });
    if (!out.rows.length) out.rows = [Array(width).fill("")];
    out.cols = Array.from({length: width}, (_, i) =>
      Object.assign({w: 110}, (m.cols || [])[i] || {}));
    out.fmt = Object.assign({}, m.fmt || {});
    out.cond = Array.isArray(m.cond) ? m.cond.slice() : [];
    out.freeze = Math.max(0, Math.min(Number(m.freeze) || 0, out.rows.length));
    return out;
  }

  /**
   * Text -> model. NEVER loses data: text that cannot be read comes back as
   * {error, raw}, and the view shows it untouched with the reason, rather
   * than replacing it with an empty grid that would be saved over it.
   */
  function parse(text) {
    const src = String(text || "").trim();
    if (!src) return normalise(blank());
    try {
      const data = JSON.parse(src);
      if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
        return {error: "This grid block has no rows.", raw: text};
      }
      return normalise(data);
    } catch (e) {
      return {error: "This grid block could not be read: " + e.message, raw: text};
    }
  }

  /** Model -> text. One row per line, so the block reads as data in any
      editor and a one-cell change is a one-line change in the file. */
  function serialize(m) {
    const n = normalise(m);
    const lines = ["{", `  "v": ${VERSION},`];
    lines.push(`  "cols": ${JSON.stringify(n.cols)},`);
    lines.push(`  "freeze": ${n.freeze},`);
    lines.push('  "rows": [');
    n.rows.forEach((r, i) =>
      lines.push("    " + JSON.stringify(r) + (i < n.rows.length - 1 ? "," : "")));
    lines.push("  ],");
    lines.push(`  "fmt": ${JSON.stringify(n.fmt)},`);
    lines.push(`  "cond": ${JSON.stringify(n.cond)},`);
    lines.push(`  "filter": ${JSON.stringify(n.filter)},`);
    // Anything this build does not know about is written back unchanged.
    const known = new Set(["v", "cols", "freeze", "rows", "fmt", "cond", "filter", "chart"]);
    for (const k of Object.keys(n)) {
      if (!known.has(k)) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(n[k])},`);
    }
    lines.push(`  "chart": ${JSON.stringify(n.chart)}`);
    lines.push("}");
    return lines.join("\n");
  }

  /* ------------------------------------------------------------ formulas */

  class GridError {
    constructor(code) { this.code = code; }
    toString() { return this.code; }
  }
  const E = {
    REF: new GridError("#REF!"), DIV0: new GridError("#DIV/0!"),
    NAME: new GridError("#NAME?"), VALUE: new GridError("#VALUE!"),
    CIRC: new GridError("#CIRC!"), NUM: new GridError("#NUM!"),
    PARSE: new GridError("#ERROR!"),
  };
  const isErr = (v) => v instanceof GridError;

  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        let j = i + 1, s = "";
        while (j < src.length) {
          if (src[j] === '"' && src[j + 1] === '"') { s += '"'; j += 2; continue; }
          if (src[j] === '"') break;
          s += src[j++];
        }
        if (j >= src.length) throw E.PARSE;
        toks.push({t: "str", v: s}); i = j + 1; continue;
      }
      const num = /^\d+(\.\d+)?(e[+-]?\d+)?%?|^\.\d+%?/i.exec(src.slice(i));
      if (num) {
        let v = parseFloat(num[0]);
        if (num[0].endsWith("%")) v /= 100;
        toks.push({t: "num", v}); i += num[0].length; continue;
      }
      const word = /^\$?[A-Za-z]{1,3}\$?\d{1,6}(:\$?[A-Za-z]{1,3}\$?\d{1,6})?|^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
      if (word) {
        const w = word[0];
        if (/\d/.test(w) && REF_RE.test(w.split(":")[0])) {
          toks.push({t: w.includes(":") ? "range" : "ref", v: w});
        } else {
          toks.push({t: "name", v: w.toUpperCase()});
        }
        i += w.length; continue;
      }
      const two = src.slice(i, i + 2);
      if (["<=", ">=", "<>"].includes(two)) { toks.push({t: "op", v: two}); i += 2; continue; }
      if ("+-*/^&=<>(),:".includes(ch)) { toks.push({t: "op", v: ch}); i++; continue; }
      throw E.PARSE;
    }
    return toks;
  }

  /* A small recursive-descent parser. Precedence, lowest first:
     comparison, &, + -, * /, ^, unary -, then values. */
  function parseFormula(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const take = (v) => {
      const t = toks[p];
      if (!t || (v && t.v !== v)) throw E.PARSE;
      p++; return t;
    };
    function cmp() {
      let l = cat();
      while (peek() && ["=", "<>", "<", ">", "<=", ">="].includes(peek().v)) {
        const op = take().v; l = {k: "bin", op, l, r: cat()};
      }
      return l;
    }
    function cat() {
      let l = add();
      while (peek() && peek().v === "&") { take(); l = {k: "bin", op: "&", l, r: add()}; }
      return l;
    }
    function add() {
      let l = mul();
      while (peek() && (peek().v === "+" || peek().v === "-")) {
        const op = take().v; l = {k: "bin", op, l, r: mul()};
      }
      return l;
    }
    function mul() {
      let l = pow();
      while (peek() && (peek().v === "*" || peek().v === "/")) {
        const op = take().v; l = {k: "bin", op, l, r: pow()};
      }
      return l;
    }
    function pow() {
      const l = unary();
      if (peek() && peek().v === "^") { take(); return {k: "bin", op: "^", l, r: pow()}; }
      return l;
    }
    function unary() {
      if (peek() && (peek().v === "-" || peek().v === "+")) {
        const op = take().v; return {k: "neg", neg: op === "-", x: unary()};
      }
      return atom();
    }
    function atom() {
      const t = peek();
      if (!t) throw E.PARSE;
      if (t.t === "num") { p++; return {k: "num", v: t.v}; }
      if (t.t === "str") { p++; return {k: "str", v: t.v}; }
      if (t.t === "ref") { p++; return {k: "ref", ref: parseRef(t.v)}; }
      if (t.t === "range") { p++; return {k: "range", range: parseRange(t.v)}; }
      if (t.t === "name") {
        p++;
        if (t.v === "TRUE" || t.v === "FALSE") return {k: "bool", v: t.v === "TRUE"};
        take("(");
        const args = [];
        if (peek() && peek().v !== ")") {
          args.push(cmp());
          while (peek() && peek().v === ",") { take(); args.push(cmp()); }
        }
        take(")");
        return {k: "fn", name: t.v, args};
      }
      if (t.v === "(") { p++; const e = cmp(); take(")"); return e; }
      throw E.PARSE;
    }
    const ast = cmp();
    if (p !== toks.length) throw E.PARSE;
    return ast;
  }

  /** Text as a spreadsheet reads a typed value: numbers are numbers,
      "12%" is 0.12, TRUE/FALSE are booleans, everything else text. */
  function literal(raw) {
    const s = String(raw).trim();
    if (s === "") return "";
    if (/^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number(s);
    if (/^[-+]?(\d+(\.\d*)?|\.\d+)%$/.test(s)) return Number(s.slice(0, -1)) / 100;
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
    const u = s.toUpperCase();
    if (u === "TRUE") return true;
    if (u === "FALSE") return false;
    return raw;
  }

  function toNum(v) {
    if (isErr(v)) throw v;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === "" || v == null) return 0;
    const n = literal(v);
    if (typeof n === "number") return n;
    throw E.VALUE;
  }

  const numbersIn = (vals) => vals.filter((v) => typeof v === "number");

  const FUNCS = {
    SUM: (a) => numbersIn(a.flat()).reduce((x, y) => x + y, 0),
    AVERAGE: (a) => {
      const n = numbersIn(a.flat());
      if (!n.length) throw E.DIV0;
      return n.reduce((x, y) => x + y, 0) / n.length;
    },
    MIN: (a) => { const n = numbersIn(a.flat()); return n.length ? Math.min(...n) : 0; },
    MAX: (a) => { const n = numbersIn(a.flat()); return n.length ? Math.max(...n) : 0; },
    COUNT: (a) => numbersIn(a.flat()).length,
    COUNTA: (a) => a.flat().filter((v) => v !== "" && v != null).length,
    ROUND: (a) => {
      const d = a.length > 1 ? toNum(a[1]) : 0, f = Math.pow(10, d);
      return Math.round(toNum(a[0]) * f) / f;
    },
    ABS: (a) => Math.abs(toNum(a[0])),
    SQRT: (a) => { const x = toNum(a[0]); if (x < 0) throw E.NUM; return Math.sqrt(x); },
    IF: (a) => (truthy(a[0]) ? a[1] : (a.length > 2 ? a[2] : false)),
    MEDIAN: (a) => {
      const n = numbersIn(a.flat()).sort((x, y) => x - y);
      if (!n.length) throw E.NUM;
      const m = Math.floor(n.length / 2);
      return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2;
    },
  };
  // Functions whose arguments are ranges keep them as lists of cell values;
  // the rest take single values.
  const RANGE_FUNCS = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "MEDIAN"]);

  function truthy(v) {
    if (isErr(v)) throw v;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      if (v.toUpperCase() === "TRUE") return true;
      if (v.toUpperCase() === "FALSE" || v === "") return false;
      throw E.VALUE;
    }
    return false;
  }

  /**
   * Every cell's value. Formulas are evaluated on demand and remembered; a
   * cell met again while it is still being worked out is a loop (=A1 in A1,
   * or A1 -> B1 -> A1), and gets #CIRC! instead of hanging the app.
   */
  function computeAll(m) {
    const rows = m.rows;
    const cache = new Map();
    const busy = new Set();
    const cell = (c, r) => {
      if (r < 0 || c < 0 || r >= rows.length || c >= (rows[r] || []).length) return E.REF;
      const key = c + "," + r;
      if (cache.has(key)) return cache.get(key);
      const raw = rows[r][c];
      if (typeof raw !== "string" || !raw.startsWith("=")) {
        const v = literal(raw == null ? "" : raw);
        cache.set(key, v); return v;
      }
      if (busy.has(key)) return E.CIRC;
      busy.add(key);
      let v;
      try {
        v = evalNode(parseFormula(raw.slice(1)));
        if (typeof v === "number" && !isFinite(v)) v = E.NUM;
        if (Array.isArray(v)) v = E.VALUE;       // a bare range is not a value
      } catch (e) {
        v = isErr(e) ? e : E.PARSE;
      }
      busy.delete(key);
      cache.set(key, v);
      return v;
    };
    function rangeVals(g) {
      if (!g) throw E.REF;
      const out = [];
      for (let r = g.r1; r <= g.r2; r++) {
        for (let c = g.c1; c <= g.c2; c++) {
          const v = cell(c, r);
          if (isErr(v)) throw v;
          out.push(v);
        }
      }
      return out;
    }
    function evalNode(n) {
      switch (n.k) {
        case "num": case "str": case "bool": return n.v;
        case "ref": {
          if (!n.ref) throw E.REF;
          const v = cell(n.ref.c, n.ref.r);
          if (isErr(v)) throw v;
          return v;
        }
        case "range": return rangeVals(n.range);
        case "neg": { const x = toNum(evalNode(n.x)); return n.neg ? -x : x; }
        case "bin": {
          const l = evalNode(n.l), r = evalNode(n.r);
          if (Array.isArray(l) || Array.isArray(r)) throw E.VALUE;
          switch (n.op) {
            case "+": return toNum(l) + toNum(r);
            case "-": return toNum(l) - toNum(r);
            case "*": return toNum(l) * toNum(r);
            case "/": { const d = toNum(r); if (d === 0) throw E.DIV0; return toNum(l) / d; }
            case "^": return Math.pow(toNum(l), toNum(r));
            case "&": return String(l) + String(r);
            default: return compare(n.op, l, r);
          }
        }
        case "fn": {
          const f = FUNCS[n.name];
          if (!f) throw E.NAME;
          if (RANGE_FUNCS.has(n.name)) {
            return f(n.args.map((a) => {
              const v = evalNode(a);
              return Array.isArray(v) ? v : [v];
            }));
          }
          return f(n.args.map((a) => {
            const v = evalNode(a);
            if (Array.isArray(v)) throw E.VALUE;
            return v;
          }));
        }
      }
      throw E.PARSE;
    }
    return rows.map((row, r) => row.map((_, c) => cell(c, r)));
  }

  function compare(op, l, r) {
    const both = typeof l === "number" && typeof r === "number";
    const a = both ? l : String(l).toLowerCase(), b = both ? r : String(r).toLowerCase();
    switch (op) {
      case "=": return a === b;
      case "<>": return a !== b;
      case "<": return a < b;
      case ">": return a > b;
      case "<=": return a <= b;
      case ">=": return a >= b;
    }
    return false;
  }

  /* ------------------------------------------------ moving formulas about */

  /**
   * Shift every relative reference in a formula by (dr rows, dc cols) —
   * what Excel does when a formula is filled or a row moves. A $ keeps that
   * part fixed. A reference pushed off the top or left becomes #REF!.
   * Text inside quotes is left alone.
   */
  function shiftFormula(formula, dr, dc) {
    if (typeof formula !== "string" || !formula.startsWith("=")) return formula;
    let out = "", inStr = false;
    const src = formula;
    for (let i = 0; i < src.length;) {
      const ch = src[i];
      if (ch === '"') { inStr = !inStr; out += ch; i++; continue; }
      if (inStr) { out += ch; i++; continue; }
      const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![A-Za-z0-9_(])/.exec(src.slice(i));
      const prev = out.slice(-1);
      if (m && !/[A-Za-z0-9_.]/.test(prev)) {
        const c = colIndex(m[2]) + (m[1] ? 0 : dc);
        const r = Number(m[4]) - 1 + (m[3] ? 0 : dr);
        out += (c < 0 || r < 0) ? "#REF!" : `${m[1]}${colName(c)}${m[3]}${r + 1}`;
        i += m[0].length;
        continue;
      }
      out += ch; i++;
    }
    return out;
  }

  /**
   * Fill cells from a starting block, like dragging Excel's fill handle.
   *
   *   numbers that step evenly (1, 2 / 5, 10) continue the step;
   *   a single number is copied;
   *   text ending in a number ("Week 1") counts up;
   *   formulas are copied with their references shifted;
   *   anything else repeats.
   *
   * `seed` is the list of raw cells being extended; `count` how many to add.
   * `along` says which way the fill runs, for shifting formula references.
   */
  function fillSeries(seed, count, along = "down") {
    const out = [];
    const nums = seed.map((s) => literal(s));
    const allNums = seed.length && nums.every((v) => typeof v === "number");
    let step = 0;
    if (allNums && seed.length >= 2) {
      const steps = nums.slice(1).map((v, i) => v - nums[i]);
      const even = steps.every((s) => Math.abs(s - steps[0]) < 1e-9);
      if (even) step = steps[0];
    }
    const textNum = seed.length && seed.every((s) => /^(.*?)(\d+)$/.test(String(s)) &&
      !String(s).startsWith("=") && typeof literal(s) !== "number");
    for (let k = 0; k < count; k++) {
      const i = seed.length + k;               // position in the full run
      const src = seed[k % seed.length];
      if (allNums && step !== 0) {
        const v = nums[nums.length - 1] + step * (k + 1);
        out.push(String(Math.round(v * 1e10) / 1e10));
      } else if (typeof src === "string" && src.startsWith("=")) {
        const d = i - (k % seed.length);
        out.push(along === "down" ? shiftFormula(src, d, 0) : shiftFormula(src, 0, d));
      } else if (textNum && seed.length === 1) {
        const m = /^(.*?)(\d+)$/.exec(String(seed[0]));
        out.push(m[1] + (Number(m[2]) + k + 1));
      } else {
        out.push(src);
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------- sort */

  /**
   * Sort the rows below the frozen header by one column's VALUES.
   *
   * Rows move whole — their cells, their formats. A moved row's formulas
   * have their relative references shifted by how far it moved, so a total
   * in column D that read =B5+C5 still reads its own row afterwards. Blanks
   * always sort last, whichever way, as Excel does. Stable: equal values
   * keep their order.
   */
  function sortRows(m, col, dir = "asc") {
    const vals = computeAll(m);
    const head = m.freeze;
    const idx = [];
    for (let r = head; r < m.rows.length; r++) idx.push(r);
    const key = (r) => vals[r][col];
    idx.sort((a, b) => {
      const x = key(a), y = key(b);
      const bx = x === "" || x == null, by = y === "" || y == null;
      if (bx !== by) return bx ? 1 : -1;
      if (bx) return a - b;
      let c;
      if (typeof x === "number" && typeof y === "number") c = x - y;
      else c = String(x).localeCompare(String(y), undefined, {numeric: true, sensitivity: "base"});
      if (c === 0) return a - b;
      return dir === "desc" ? -c : c;
    });
    const out = normalise(m);
    const newRows = m.rows.slice(0, head).map((r) => r.slice());
    const newFmt = {};
    for (const [addr, f] of Object.entries(m.fmt || {})) {
      const ref = parseRef(addr);
      if (ref && ref.r < head) newFmt[addr] = f;
    }
    idx.forEach((oldR, i) => {
      const newR = head + i, dr = newR - oldR;
      newRows.push(m.rows[oldR].map((raw) => shiftFormula(raw, dr, 0)));
      m.rows[oldR].forEach((_, c) => {
        const f = (m.fmt || {})[refName(c, oldR)];
        if (f) newFmt[refName(c, newR)] = f;
      });
    });
    out.rows = newRows;
    out.fmt = newFmt;
    return out;
  }

  /* -------------------------------------------------------------- filter */

  const FILTER_OPS = ["=", "<>", ">", "<", ">=", "<=", "contains", "blank", "not blank"];

  function passes(v, op, target) {
    const blankV = v === "" || v == null;
    if (op === "blank") return blankV;
    if (op === "not blank") return !blankV;
    if (op === "contains") return String(v).toLowerCase().includes(String(target).toLowerCase());
    const t = literal(target);
    return compare(op, typeof v === "number" && typeof t === "number" ? v : v,
                   typeof v === "number" && typeof t === "number" ? t : target);
  }

  /** Which rows are shown. A filter only HIDES rows — it never deletes one —
      and the frozen header is always shown. */
  function visibleRows(m, vals) {
    vals = vals || computeAll(m);
    const out = [];
    for (let r = 0; r < m.rows.length; r++) {
      if (r < m.freeze || !m.filter) { out.push(r); continue; }
      const f = m.filter;
      if (passes(vals[r][f.col], f.op, f.value)) out.push(r);
    }
    return out;
  }

  /* ------------------------------------------------------ number formats */

  const NUM_FORMATS = {
    general: {name: "General"},
    int: {name: "Whole number", d: 0},
    d1: {name: "1 decimal place", d: 1},
    d2: {name: "2 decimal places", d: 2},
    thousands: {name: "Thousands separator", d: 0, sep: true},
    pct: {name: "Percent", d: 0, pct: true},
    pct1: {name: "Percent, 1 decimal", d: 1, pct: true},
    money: {name: "Currency", d: 2, sep: true, pre: "$"},
  };

  /** What a cell shows. Errors show their code; formats apply to numbers
      only — a format on a text cell is ignored rather than mangling it. */
  function display(v, fmtKey) {
    if (isErr(v)) return v.code;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v !== "number") return v == null ? "" : String(v);
    const f = NUM_FORMATS[fmtKey];
    if (!f || fmtKey === "general") {
      return String(Math.round(v * 1e10) / 1e10);
    }
    let x = f.pct ? v * 100 : v;
    let s = Math.abs(x).toFixed(f.d);
    if (f.sep) {
      const [i, d] = s.split(".");
      s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : "");
    }
    return (x < 0 ? "-" : "") + (f.pre || "") + s + (f.pct ? "%" : "");
  }

  /* ------------------------------------------------ conditional colouring */

  /** The colours conditional rules give one cell — later rules win, as in
      Excel's "applies to" list read top to bottom. */
  function condStyle(m, c, r, vals) {
    let style = null;
    for (const rule of m.cond || []) {
      const g = parseRange(rule.range);
      if (!g || c < g.c1 || c > g.c2 || r < g.r1 || r > g.r2) continue;
      const v = vals[r][c];
      if (isErr(v)) continue;
      if (passes(v, rule.op, rule.value)) {
        style = Object.assign(style || {}, rule.bg ? {bg: rule.bg} : {},
                              rule.color ? {color: rule.color} : {});
      }
    }
    return style;
  }

  /* ------------------------------------------------- to and from Excel */

  /**
   * Excel's clipboard text -> rows. Tab-separated, one line per row, and a
   * cell containing a tab, newline or quote is wrapped in quotes with the
   * quotes doubled. A trailing newline (Excel always adds one) does not make
   * an empty last row.
   */
  function fromTSV(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    const s = String(text).replace(/\r\n?/g, "\n");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"' && cell === "") q = true;
      else if (ch === "\t") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /** Rows -> text Excel pastes cell for cell. */
  function toTSV(rows) {
    return rows.map((r) => r.map((c) => {
      const s = c == null ? "" : String(c);
      return /[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join("\t")).join("\n");
  }

  /* --------------------------------------------------------------- charts */

  /** The numbers a chart draws: one label per point, and one list of values
      per series. Non-numbers become gaps rather than zeros — a zero would
      draw a false dip to the axis. */
  function chartData(m, vals) {
    vals = vals || computeAll(m);
    const ch = m.chart;
    if (!ch) return null;
    const cells = (range) => {
      const g = parseRange(range);
      if (!g) return [];
      const out = [];
      for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) {
        out.push(r < vals.length && c < (vals[r] || []).length ? vals[r][c] : "");
      }
      return out;
    };
    const labels = cells(ch.labels).map((v) => display(v));
    const series = (ch.series || []).map((s) => ({
      range: s,
      name: s,
      values: cells(s).map((v) => (typeof v === "number" ? v : null)),
    }));
    return {type: ch.type || "line", title: ch.title || "", labels, series};
  }

  /* ------------------------------------------------------ drawing a chart

     Returns an SVG as text: no chart library, nothing fetched, and it works
     offline like the rest of NeuroNet. Kept here with the other pure
     functions -- it is arithmetic (scales, positions) and a string -- so the
     awkward parts can be tested directly.

     TWO HONEST-DRAWING RULES:
       a gap in the data BREAKS the line rather than dropping to zero, which
       would draw a dip that never happened;
       bars are measured from zero, because a bar's length is read as its
       size and a cut-off axis makes small differences look enormous.
     A line chart may start its axis away from zero -- a line is read by its
     shape, not its area -- but only when every value is well clear of it. */

  const SERIES_COLORS = ["#4f8cff", "#f2994a", "#27ae60", "#c86dd7", "#e74c3c", "#16a085"];

  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
    return 10 * mag;
  }

  function chartSVG(data, opts) {
    opts = opts || {};
    const W = opts.width || 680, H = opts.height || 260;
    const padL = 54, padR = 14, padT = data.title ? 30 : 14, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const fg = "var(--text, #ddd)", faint = "var(--text-faint, #888)";
    const line = "var(--border, #555)";
    const series = (data.series || []).filter((s) => s.values.some((v) => v != null));
    const all = series.flatMap((s) => s.values.filter((v) => v != null));

    if (!series.length || !all.length) {
      return `<svg viewBox="0 0 ${W} ${H}" class="ssg-chart-svg" role="img" aria-label="Chart with no numbers yet">
        <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${faint}"
          font-size="13">Nothing to chart yet — pick cells with numbers in them.</text></svg>`;
    }

    let lo = Math.min(...all), hi = Math.max(...all);
    const bars = data.type === "bar";
    // Bars always from zero; a line may float, but only well clear of zero.
    if (bars || lo > 0 && lo < (hi - lo) * 1.5) lo = Math.min(0, lo);
    if (hi < 0) hi = 0;
    if (hi === lo) { hi = lo + 1; }
    const step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const y = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;

    const n = Math.max(1, data.labels.length);
    const slot = plotW / n;
    const xMid = (i) => padL + slot * (i + 0.5);

    let out = `<svg viewBox="0 0 ${W} ${H}" class="ssg-chart-svg" role="img" aria-label="${
      esc(data.title || "Chart")}">`;
    if (data.title) {
      out += `<text x="${W / 2}" y="18" text-anchor="middle" fill="${fg}" font-size="13" font-weight="600">${esc(data.title)}</text>`;
    }
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = y(v);
      out += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="${line}" stroke-width="1" opacity="${v === 0 ? 0.9 : 0.35}"/>`;
      out += `<text x="${padL - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" fill="${faint}" font-size="11">${esc(display(Math.round(v * 1e6) / 1e6))}</text>`;
    }
    // Labels, thinned out when there are more than will fit.
    const everyN = Math.ceil(n / Math.max(1, Math.floor(plotW / 62)));
    data.labels.forEach((lab, i) => {
      if (i % everyN) return;
      out += `<text x="${xMid(i).toFixed(1)}" y="${H - padB + 18}" text-anchor="middle" fill="${faint}" font-size="11">${esc(String(lab).slice(0, 12))}</text>`;
    });

    series.forEach((s, si) => {
      const color = SERIES_COLORS[si % SERIES_COLORS.length];
      if (bars) {
        const groupW = slot * 0.7, barW = Math.max(2, groupW / series.length);
        s.values.forEach((v, i) => {
          if (v == null) return;                      // a gap draws no bar
          const top = Math.min(y(v), y(0)), bottom = Math.max(y(v), y(0));
          const x = xMid(i) - groupW / 2 + barW * si;
          out += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, bottom - top).toFixed(1)}" fill="${color}" rx="1"/>`;
        });
      } else {
        // Gaps break the line into separate runs.
        let run = [];
        const flush = () => {
          // Only the joining line here. Every point, including one left on
          // its own by gaps either side, is drawn by the pass below -- doing
          // it in both places stacked two circles on the same spot.
          if (run.length > 1) {
            out += `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${run.join(" ")}"/>`;
          }
          run = [];
        };
        s.values.forEach((v, i) => {
          if (v == null) { flush(); return; }
          run.push(`${xMid(i).toFixed(1)},${y(v).toFixed(1)}`);
        });
        flush();
        s.values.forEach((v, i) => {
          if (v == null) return;
          out += `<circle cx="${xMid(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5" fill="${color}"/>`;
        });
      }
      if (series.length > 1) {
        const lx = padL + si * 110, ly = H - 8;
        out += `<rect x="${lx}" y="${ly - 8}" width="9" height="9" rx="2" fill="${color}"/>`;
        out += `<text x="${lx + 14}" y="${ly}" fill="${faint}" font-size="11">${esc(s.name)}</text>`;
      }
    });
    return out + "</svg>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return {
    VERSION, colName, colIndex, parseRef, parseRange, refName, chartSVG, SERIES_COLORS,
    blank, normalise, parse, serialize,
    parseFormula, computeAll, literal, isErr, E,
    shiftFormula, fillSeries, sortRows,
    FILTER_OPS, visibleRows, NUM_FORMATS, display, condStyle,
    fromTSV, toTSV, chartData, FUNCS,
  };
});
