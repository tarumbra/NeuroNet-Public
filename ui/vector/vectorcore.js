/* ==========================================================================
   Vector -- the engine (no page): drawings as plain JSON, the shapes, moving
   / scaling / turning, exact bounds, smoothing a freehand line, and the SVG
   that is drawn, saved and exported.

   Cam (2026-10-04), after being told honestly that a home-built vector tool
   covers the everyday 80% and Inkscape the rest: "please get started on the
   vector tool in Neuronet".

   A drawing: {kind: "vector", v: 1, name, w, h, bg, layers: [{id, name,
   visible, locked, items}]}, layers bottom first, items bottom first.
     path   {t:"path", subs:[{nodes, closed}], rule}  nodes {x, y, ix, iy,
            ox, oy, smooth} -- handles in ABSOLUTE coordinates (a node with no
            handle has them equal to x, y), so every transform is one
            function over points
     text   {t:"text", x, y, text, font, size, weight, italic, rot}
     image  {t:"image", src, x, y, w, h, rot}
     group  {t:"group", items}
   Paint: null (none), "#rrggbb", or {type:"linear"|"radial", angle,
   stops:[[offset, colour]]}. Shape-combining and SVG import need real curve
   maths and are Paper.js's (vector.js); everything here is plain and tested
   in node (test_vector.js).
   ========================================================================== */
var VectorCore = (function () {
  "use strict";

  var n = 0;
  function uid(p) { return (p || "v") + Date.now().toString(36) + (n++).toString(36); }
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };

  /* ---------------------------------------------------------- the drawing */

  function newDoc(w, h, name) {
    return {kind: "vector", v: 1, name: name || "Drawing", w: w || 1024, h: h || 1024, bg: null,
            layers: [{id: uid("L"), name: "Layer 1", visible: true, locked: false, items: []}]};
  }

  function style(o) {
    return Object.assign({fill: "#9ad07a", stroke: "#1f2430", sw: 2, opacity: 1, cap: "round", join: "round", dash: null}, o || {});
  }

  /* ------------------------------------------------------------ the shapes */

  function node(x, y) { return {x: x, y: y, ix: x, iy: y, ox: x, oy: y, smooth: false}; }

  function pathFrom(subs, st) {
    return Object.assign({id: uid("p"), t: "path", subs: subs, rule: "nonzero"}, style(st));
  }

  function polyline(points, closed, st) {
    return pathFrom([{nodes: points.map(function (p) { return node(p[0], p[1]); }), closed: !!closed}], st);
  }

  function rect(x, y, w, h, rx, st) {
    var ax = Math.min(x, x + w), ay = Math.min(y, y + h), W = Math.abs(w), H = Math.abs(h);
    var r = Math.min(Math.max(0, rx || 0), W / 2, H / 2);
    if (!r) return polyline([[ax, ay], [ax + W, ay], [ax + W, ay + H], [ax, ay + H]], true, st);
    var k = r * 0.5523, nodes = [];
    var add = function (x1, y1, ix, iy, ox, oy) { nodes.push({x: x1, y: y1, ix: ix, iy: iy, ox: ox, oy: oy, smooth: false}); };
    add(ax + r, ay, ax + r - k, ay, ax + r, ay);
    add(ax + W - r, ay, ax + W - r, ay, ax + W - r + k, ay);
    add(ax + W, ay + r, ax + W, ay + r - k, ax + W, ay + r);
    add(ax + W, ay + H - r, ax + W, ay + H - r, ax + W, ay + H - r + k);
    add(ax + W - r, ay + H, ax + W - r + k, ay + H, ax + W - r, ay + H);
    add(ax + r, ay + H, ax + r, ay + H, ax + r - k, ay + H);
    add(ax, ay + H - r, ax, ay + H - r + k, ax, ay + H - r);
    add(ax, ay + r, ax, ay + r, ax, ay + r - k);
    return pathFrom([{nodes: nodes, closed: true}], st);
  }

  /** An ellipse: four smooth nodes (the 0.5523 bezier circle). */
  function ellipse(cx, cy, rx, ry, st) {
    rx = Math.abs(rx); ry = Math.abs(ry);
    var kx = rx * 0.5523, ky = ry * 0.5523;
    var nodes = [
      {x: cx + rx, y: cy, ix: cx + rx, iy: cy - ky, ox: cx + rx, oy: cy + ky, smooth: true},
      {x: cx, y: cy + ry, ix: cx + kx, iy: cy + ry, ox: cx - kx, oy: cy + ry, smooth: true},
      {x: cx - rx, y: cy, ix: cx - rx, iy: cy + ky, ox: cx - rx, oy: cy - ky, smooth: true},
      {x: cx, y: cy - ry, ix: cx - kx, iy: cy - ry, ox: cx + kx, oy: cy - ry, smooth: true},
    ];
    return pathFrom([{nodes: nodes, closed: true}], st);
  }

  function polygon(cx, cy, r, sides, st) {
    var pts = [], k = Math.max(3, sides | 0);
    for (var i = 0; i < k; i++) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / k;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return polyline(pts, true, st);
  }

  function star(cx, cy, R, r, points, st) {
    var pts = [], k = Math.max(3, points | 0);
    for (var i = 0; i < k * 2; i++) {
      var a = -Math.PI / 2 + (Math.PI * i) / k, rr = i % 2 ? r : R;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    return polyline(pts, true, st);
  }

  function text(x, y, words, st) {
    return Object.assign({id: uid("t"), t: "text", x: x, y: y, text: words || "Text", font: "sans-serif", size: 48,
                          weight: 400, italic: false, rot: 0}, style(Object.assign({stroke: null, sw: 0}, st || {})));
  }

  function image(src, x, y, w, h) {
    return {id: uid("i"), t: "image", src: src, x: x, y: y, w: w, h: h, rot: 0, opacity: 1};
  }

  /* ------------------------------------------------------------ path data */

  var hasOut = function (a) { return a.ox !== a.x || a.oy !== a.y; };
  var hasIn = function (b) { return b.ix !== b.x || b.iy !== b.y; };
  function seg(a, b) {
    if (!hasOut(a) && !hasIn(b)) return "L" + r3(b.x) + " " + r3(b.y);
    return "C" + r3(a.ox) + " " + r3(a.oy) + " " + r3(b.ix) + " " + r3(b.iy) + " " + r3(b.x) + " " + r3(b.y);
  }

  function pathD(it) {
    return (it.subs || []).map(function (s) {
      var ns = s.nodes;
      if (!ns.length) return "";
      var d = "M" + r3(ns[0].x) + " " + r3(ns[0].y);
      for (var i = 1; i < ns.length; i++) d += seg(ns[i - 1], ns[i]);
      if (s.closed && ns.length > 1) {
        var last = ns[ns.length - 1], first = ns[0];
        if (hasOut(last) || hasIn(first)) d += seg(last, first);
        d += "Z";
      }
      return d;
    }).join("");
  }

  /* ---------------------------------------------------------- transforms
     A matrix is [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */

  var I = [1, 0, 0, 1, 0, 0];
  function mul(m, k) {        // m then k
    return [k[0] * m[0] + k[2] * m[1], k[1] * m[0] + k[3] * m[1], k[0] * m[2] + k[2] * m[3], k[1] * m[2] + k[3] * m[3],
            k[0] * m[4] + k[2] * m[5] + k[4], k[1] * m[4] + k[3] * m[5] + k[5]];
  }
  function translate(dx, dy) { return [1, 0, 0, 1, dx, dy]; }
  function scaleAbout(sx, sy, cx, cy) { return [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy]; }
  function rotateAbout(deg, cx, cy) {
    var a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  }
  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /** Every point of an item moved by m. Text and pictures keep their own
      angle and size; a skew is approximated by its rotation and scale. */
  function transform(it, m) {
    if (it.t === "path") {
      it.subs.forEach(function (s) {
        s.nodes.forEach(function (nd) {
          var p = apply(m, nd.x, nd.y), i = apply(m, nd.ix, nd.iy), o = apply(m, nd.ox, nd.oy);
          nd.x = p[0]; nd.y = p[1]; nd.ix = i[0]; nd.iy = i[1]; nd.ox = o[0]; nd.oy = o[1];
        });
      });
      var det = Math.abs(m[0] * m[3] - m[1] * m[2]);
      if (it.sw && det && Math.abs(det - 1) > 1e-9) it.sw *= Math.sqrt(det);   // strokes scale with the shape
    } else if (it.t === "group") {
      it.items.forEach(function (c) { transform(c, m); });
    } else if (it.t === "text") {
      var p = apply(m, it.x, it.y);
      var sx = Math.hypot(m[0], m[1]);
      it.x = p[0]; it.y = p[1];
      it.size = Math.max(1, it.size * sx);
      it.rot = (it.rot || 0) + (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    } else if (it.t === "image") {
      var c = apply(m, it.x + it.w / 2, it.y + it.h / 2);
      var kx = Math.hypot(m[0], m[1]), ky = Math.hypot(m[2], m[3]);
      it.w = Math.max(1, it.w * kx); it.h = Math.max(1, it.h * ky);
      it.x = c[0] - it.w / 2; it.y = c[1] - it.h / 2;
      it.rot = (it.rot || 0) + (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    }
    return it;
  }

  /* -------------------------------------------------------------- bounds */

  /** Where a cubic's x (or y) turns: t in (0,1). */
  function extrema(p0, p1, p2, p3) {
    var a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0, out = [];
    if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) out.push(-c / b); }
    else {
      var D = b * b - 4 * a * c;
      if (D >= 0) { var q = Math.sqrt(D); out.push((-b + q) / (2 * a), (-b - q) / (2 * a)); }
    }
    return out.filter(function (t) { return t > 0 && t < 1; });
  }
  function cubicAt(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }

  /** [x, y, w, h], exact for curves; text is measured with `measure` (a
      function (it) -> width) when given, else estimated. */
  function bounds(it, measure) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    var add = function (x, y) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    if (it.t === "path") {
      it.subs.forEach(function (s) {
        var ns = s.nodes, k = ns.length;
        ns.forEach(function (nd) { add(nd.x, nd.y); });
        var count = s.closed ? k : k - 1;
        for (var i = 0; i < count; i++) {
          var a = ns[i], b = ns[(i + 1) % k];
          if (!hasOut(a) && !hasIn(b)) continue;
          extrema(a.x, a.ox, b.ix, b.x).forEach(function (t) { add(cubicAt(a.x, a.ox, b.ix, b.x, t), cubicAt(a.y, a.oy, b.iy, b.y, t)); });
          extrema(a.y, a.oy, b.iy, b.y).forEach(function (t) { add(cubicAt(a.x, a.ox, b.ix, b.x, t), cubicAt(a.y, a.oy, b.iy, b.y, t)); });
        }
      });
    } else if (it.t === "group") {
      it.items.forEach(function (c) { var b = bounds(c, measure); add(b[0], b[1]); add(b[0] + b[2], b[1] + b[3]); });
    } else {
      var w, h, ox, oy, cx, cy;
      if (it.t === "text") {
        var lines = String(it.text || "").split("\n");
        w = measure ? measure(it) : Math.max.apply(null, lines.map(function (l) { return l.length; })) * it.size * 0.56;
        h = it.size * 1.2 * lines.length;
        ox = it.x; oy = it.y - it.size * 0.9; cx = it.x; cy = it.y;
      } else {
        w = it.w; h = it.h; ox = it.x; oy = it.y; cx = it.x + w / 2; cy = it.y + h / 2;
      }
      var m = it.rot ? rotateAbout(it.rot, cx, cy) : I;
      [[ox, oy], [ox + w, oy], [ox + w, oy + h], [ox, oy + h]].forEach(function (p) { var q = apply(m, p[0], p[1]); add(q[0], q[1]); });
    }
    if (x0 === Infinity) return [0, 0, 0, 0];
    return [x0, y0, x1 - x0, y1 - y0];
  }

  function unionBounds(items, measure) {
    if (!items.length) return null;
    var bs = items.map(function (i) { return bounds(i, measure); });
    var x0 = Math.min.apply(null, bs.map(function (b) { return b[0]; })), y0 = Math.min.apply(null, bs.map(function (b) { return b[1]; }));
    var x1 = Math.max.apply(null, bs.map(function (b) { return b[0] + b[2]; })), y1 = Math.max.apply(null, bs.map(function (b) { return b[1] + b[3]; }));
    return [x0, y0, x1 - x0, y1 - y0];
  }

  /* ------------------------------------------------------- freehand lines

     A pencil stroke: points thinned (Ramer-Douglas-Peucker), then a smooth
     curve through what's left (Catmull-Rom made into bezier handles). */
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    var far = 0, at = 0;
    for (var i = 1; i < pts.length - 1; i++) {
      var d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > far) { far = d; at = i; }
    }
    if (far <= eps) return [a, b];
    return rdp(pts.slice(0, at + 1), eps).slice(0, -1).concat(rdp(pts.slice(at), eps));
  }

  function smoothPath(points, closed, eps, st) {
    var pts = rdp(points, eps === undefined ? 2 : eps);
    var nodes = pts.map(function (p) { return node(p[0], p[1]); }), k = nodes.length;
    for (var i = 0; i < k; i++) {
      var prev = nodes[closed ? (i - 1 + k) % k : Math.max(0, i - 1)], next = nodes[closed ? (i + 1) % k : Math.min(k - 1, i + 1)];
      if (prev === nodes[i] || next === nodes[i]) continue;
      var tx = (next.x - prev.x) / 6, ty = (next.y - prev.y) / 6;
      nodes[i].ix = nodes[i].x - tx; nodes[i].iy = nodes[i].y - ty;
      nodes[i].ox = nodes[i].x + tx; nodes[i].oy = nodes[i].y + ty;
      nodes[i].smooth = true;
    }
    return pathFrom([{nodes: nodes, closed: !!closed}], st);
  }

  /** A node made smooth (handles in a line, both sides as long as the
      longer) or a corner (handles off). */
  function setSmooth(nd, smooth) {
    if (!smooth) { nd.ix = nd.ox = nd.x; nd.iy = nd.oy = nd.y; nd.smooth = false; return nd; }
    var dx = nd.ox - nd.ix, dy = nd.oy - nd.iy;
    if (!dx && !dy) { dx = 30; dy = 0; } else { var l = Math.hypot(dx, dy); dx = (dx / l) * Math.max(15, l / 2); dy = (dy / l) * Math.max(15, l / 2); }
    nd.ix = nd.x - dx; nd.iy = nd.y - dy; nd.ox = nd.x + dx; nd.oy = nd.y + dy; nd.smooth = true;
    return nd;
  }

  /** A handle dragged: the other one follows (mirrored in angle) on a smooth node. */
  function moveHandle(nd, which, x, y, breakIt) {
    if (which === "in") { nd.ix = x; nd.iy = y; } else { nd.ox = x; nd.oy = y; }
    if (nd.smooth && !breakIt) {
      var hx = which === "in" ? nd.ix : nd.ox, hy = which === "in" ? nd.iy : nd.oy;
      var ox = which === "in" ? nd.ox : nd.ix, oy = which === "in" ? nd.oy : nd.iy;
      var other = Math.hypot(ox - nd.x, oy - nd.y), a = Math.atan2(hy - nd.y, hx - nd.x) + Math.PI;
      var nx = nd.x + other * Math.cos(a), ny = nd.y + other * Math.sin(a);
      if (which === "in") { nd.ox = nx; nd.oy = ny; } else { nd.ix = nx; nd.iy = ny; }
    }
    if (breakIt) nd.smooth = false;
    return nd;
  }

  function moveNode(nd, dx, dy) {
    nd.x += dx; nd.y += dy; nd.ix += dx; nd.iy += dy; nd.ox += dx; nd.oy += dy;
    return nd;
  }

  /* ------------------------------------------------------------- the SVG */

  function paint(p, defs, key) {
    if (!p) return "none";
    if (typeof p === "string") return esc(p);
    var id = key, stops = (p.stops || [[0, "#ffffff"], [1, "#000000"]]).map(function (s) {
      return '<stop offset="' + r3(s[0]) + '" stop-color="' + esc(s[1]) + '"' + (s[2] !== undefined && s[2] < 1 ? ' stop-opacity="' + r3(s[2]) + '"' : "") + "/>";
    }).join("");
    if (p.type === "radial") {
      defs.push('<radialGradient id="' + id + '" cx="0.5" cy="0.5" r="0.5">' + stops + "</radialGradient>");
    } else {
      var a = ((p.angle || 0) * Math.PI) / 180, cx = Math.cos(a) / 2, cy = Math.sin(a) / 2;
      defs.push('<linearGradient id="' + id + '" x1="' + r3(0.5 - cx) + '" y1="' + r3(0.5 - cy) + '" x2="' + r3(0.5 + cx) + '" y2="' + r3(0.5 + cy) + '">' + stops + "</linearGradient>");
    }
    return "url(#" + id + ")";
  }

  var FONTS = {
    "sans-serif": "Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    "serif": "Georgia, 'DejaVu Serif', 'Times New Roman', serif",
    "mono": "'JetBrains Mono', 'DejaVu Sans Mono', 'Courier New', monospace",
    "hand": "'Segoe Print', 'Bradley Hand', 'URW Chancery L', 'Z003', cursive",
    "display": "Impact, 'Arial Black', 'DejaVu Sans', sans-serif",
  };

  function strokeAttrs(it, defs, key) {
    var s = paint(it.stroke, defs, key + "s");
    if (s === "none" || !it.sw) return ' stroke="none"';
    return ' stroke="' + s + '" stroke-width="' + r3(it.sw) + '" stroke-linecap="' + esc(it.cap || "round") + '" stroke-linejoin="' + esc(it.join || "round") + '"'
      + (it.dash && it.dash.length ? ' stroke-dasharray="' + it.dash.map(r3).join(" ") + '"' : "");
  }

  /** One item as SVG. `opts.ids` adds data-id (the editor hits by it);
      `opts.prefix` keeps gradient ids apart between drawings on one page. */
  function itemSVG(it, defs, opts) {
    opts = opts || {};
    var key = (opts.prefix || "g") + "-" + it.id, idAttr = opts.ids ? ' data-id="' + esc(it.id) + '"' : "";
    var op = it.opacity !== undefined && it.opacity < 1 ? ' opacity="' + r3(it.opacity) + '"' : "";
    if (it.hidden) return "";
    if (it.t === "path") {
      return '<path' + idAttr + ' d="' + pathD(it) + '" fill="' + paint(it.fill, defs, key + "f") + '"'
        + (it.rule === "evenodd" ? ' fill-rule="evenodd"' : "") + strokeAttrs(it, defs, key) + op + "/>";
    }
    if (it.t === "text") {
      var lines = String(it.text || "").split("\n");
      var tr = it.rot ? ' transform="rotate(' + r3(it.rot) + " " + r3(it.x) + " " + r3(it.y) + ')"' : "";
      return '<text' + idAttr + ' x="' + r3(it.x) + '" y="' + r3(it.y) + '" font-family="' + esc(FONTS[it.font] || it.font) + '" font-size="' + r3(it.size)
        + '" font-weight="' + (it.weight || 400) + '"' + (it.italic ? ' font-style="italic"' : "") + ' fill="' + paint(it.fill, defs, key + "f") + '"'
        + strokeAttrs(it, defs, key) + op + tr + ' xml:space="preserve">'
        + lines.map(function (l, i) { return i ? '<tspan x="' + r3(it.x) + '" dy="' + r3(it.size * 1.2) + '">' + esc(l) + "</tspan>" : esc(l); }).join("")
        + "</text>";
    }
    if (it.t === "image") {
      var cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      return '<image' + idAttr + ' href="' + esc(it.src) + '" x="' + r3(it.x) + '" y="' + r3(it.y) + '" width="' + r3(it.w) + '" height="' + r3(it.h)
        + '" preserveAspectRatio="none"' + op + (it.rot ? ' transform="rotate(' + r3(it.rot) + " " + r3(cx) + " " + r3(cy) + ')"' : "") + "/>";
    }
    if (it.t === "group") {
      return '<g' + idAttr + op + ">" + it.items.map(function (c) { return itemSVG(c, defs, {prefix: opts.prefix}); }).join("") + "</g>";
    }
    return "";
  }

  /** The whole drawing as an SVG file's text. */
  function docSVG(doc, opts) {
    opts = opts || {};
    var defs = [], body = "";
    (doc.layers || []).forEach(function (l) {
      if (!l.visible && !opts.hiddenToo) return;
      if (l.guide && !opts.guides) return;         // a template's guide: seen while drawing, never saved
      body += '<g' + (opts.ids ? ' data-layer="' + esc(l.id) + '"' : ' id="' + esc(String(l.name || "layer").replace(/[^\w-]/g, "_")) + '"') + ">"
        + l.items.map(function (it) { return itemSVG(it, defs, {ids: opts.ids, prefix: opts.prefix}); }).join("") + "</g>";
    });
    var bg = doc.bg && !opts.noBg ? '<rect width="' + doc.w + '" height="' + doc.h + '" fill="' + esc(doc.bg) + '"/>' : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + doc.w + " " + doc.h + '" width="' + (opts.width || doc.w) + '" height="' + (opts.height || doc.h) + '">'
      + (defs.length ? "<defs>" + defs.join("") + "</defs>" : "") + bg + body + "</svg>";
  }

  /* ------------------------------------------------------------- finding */

  /** An item anywhere in the drawing: {item, layer, list, index}. */
  function find(doc, id) {
    for (var li = 0; li < doc.layers.length; li++) {
      var hit = findIn(doc.layers[li].items, id);
      if (hit) { hit.layer = doc.layers[li]; return hit; }
    }
    return null;
  }
  function findIn(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return {item: list[i], list: list, index: i};
    }
    return null;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function reId(it) {
    it.id = uid(it.t ? it.t[0] : "x");
    if (it.items) it.items.forEach(reId);
    return it;
  }

  /** Align items to the box `to` ([x,y,w,h]); `how` left|hcentre|right|top|vcentre|bottom. */
  function align(items, how, to, measure) {
    items.forEach(function (it) {
      var b = bounds(it, measure), dx = 0, dy = 0;
      if (how === "left") dx = to[0] - b[0];
      if (how === "hcentre") dx = to[0] + to[2] / 2 - (b[0] + b[2] / 2);
      if (how === "right") dx = to[0] + to[2] - (b[0] + b[2]);
      if (how === "top") dy = to[1] - b[1];
      if (how === "vcentre") dy = to[1] + to[3] / 2 - (b[1] + b[3] / 2);
      if (how === "bottom") dy = to[1] + to[3] - (b[1] + b[3]);
      if (dx || dy) transform(it, translate(dx, dy));
    });
  }

  /** Even gaps between three or more items, across (x) or down (y). */
  function distribute(items, axis, measure) {
    if (items.length < 3) return false;
    var k = axis === "y" ? 1 : 0;
    var list = items.map(function (it) { return {it: it, b: bounds(it, measure)}; }).sort(function (a, b) { return a.b[k] - b.b[k]; });
    var first = list[0].b, last = list[list.length - 1].b;
    var total = list.reduce(function (s, x) { return s + x.b[k + 2]; }, 0);
    var gap = (last[k] + last[k + 2] - first[k] - total) / (list.length - 1), at = first[k] + first[k + 2] + gap;
    for (var i = 1; i < list.length - 1; i++) {
      var d = at - list[i].b[k];
      transform(list[i].it, k ? translate(0, d) : translate(d, 0));
      at += list[i].b[k + 2] + gap;
    }
    return true;
  }

  return {
    uid: uid, newDoc: newDoc, style: style, node: node, pathFrom: pathFrom, polyline: polyline, rect: rect, ellipse: ellipse,
    polygon: polygon, star: star, text: text, image: image, pathD: pathD, mul: mul, translate: translate,
    scaleAbout: scaleAbout, rotateAbout: rotateAbout, apply: apply, transform: transform, bounds: bounds,
    unionBounds: unionBounds, rdp: rdp, smoothPath: smoothPath, setSmooth: setSmooth, moveHandle: moveHandle,
    moveNode: moveNode, paint: paint, itemSVG: itemSVG, docSVG: docSVG, find: find, clone: clone, reId: reId,
    align: align, distribute: distribute, FONTS: FONTS, I: I,
  };
})();
if (typeof module !== "undefined") module.exports = VectorCore;
