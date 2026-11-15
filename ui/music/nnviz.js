// NeuroNet's visualizers -- ONE file, drawn by the app (ui/music/chords.js,
// a <canvas>) and by the desktop Music widget (neuronet.board/MusicCard.qml,
// a QML Canvas). The SAME file is in system/omarchy/plugins/neuronet.board/
// nnviz.js -- keep them identical (test/test_visualizers.py checks).
//
// Cam (2026-10-02): "I want a different visualiser then the ones we currently
// have, i want a free flowing modern visualiser" -- from his picture: layered
// neon ribbons, a silk mesh of fine lines, mirrored rounded bars, an LED dot
// matrix, a glowing pulse line, crossing sine waves; purple into cyan.
//
// draw(ctx, style, bands, t, w, h, pal, cache)
//   bands  32 levels 0..1, low to high (the track's spectrum at this moment)
//   t      seconds (drives the flowing motion; it moves gently with no sound)
//   pal    {a, b, c}: three colours -- the left/low end, the right/high end,
//          and a highlight. PALETTES.neon is the picture's; "theme" is made
//          by the caller from the app's accent.
//   cache  an object kept between frames (gradients are made once per size,
//          never per frame -- a gradient per frame leaked memory once,
//          2026-09-29)
// Plain ES5, no globals touched: QML's JavaScript imports it as a library.

var STYLES = [
  ["ribbons", "Ribbons"], ["silk", "Silk"], ["bars", "Bars"],
  ["dots", "Dots"], ["pulse", "Pulse"], ["waves", "Waves"]
];
var PALETTES = {
  neon: { a: "#7b2ff7", b: "#00e5ff", c: "#ff2bd6" },
  aurora: { a: "#00c48c", b: "#3d7dff", c: "#a6ff4d" },
  sunset: { a: "#ff4f6d", b: "#ffb300", c: "#ff2bd6" }
};

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// The level at a point x (0..1) across the spectrum, smoothly in between bands.
function levelAt(bands, x) {
  var n = bands.length;
  if (!n) return 0;
  var p = clamp01(x) * (n - 1), i = Math.floor(p), f = p - i;
  var a = bands[Math.max(0, i - 1)] || 0, b = bands[i] || 0;
  var c = bands[Math.min(n - 1, i + 1)] || 0, d = bands[Math.min(n - 1, i + 2)] || 0;
  // Catmull-Rom: no corners
  var v = 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
  return clamp01(v);
}
function energy(bands) {
  var s = 0;
  for (var i = 0; i < bands.length; i++) s += bands[i] || 0;
  return bands.length ? s / bands.length : 0;
}
// fades a curve out at both ends, so a ribbon flows in and out of the edges
function taper(x) { return Math.sin(Math.PI * clamp01(x)); }

function grad(ctx, cache, key, x0, y0, x1, y1, stops) {
  var g = cache[key];
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    var n = 0;
    for (var k in cache) n++;
    if (n > 200) for (var k2 in cache) delete cache[k2];
    cache[key] = g;
  }
  return g;
}
function withAlpha(hex, a) {
  var h = String(hex).replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

// Layered translucent waves, each riding a different part of the spectrum.
function drawRibbons(ctx, bands, t, w, h, pal, cache) {
  var mid = h / 2, layers = 5, steps = 72;
  var across = grad(ctx, cache, "rib" + w, 0, 0, w, 0, [0, pal.a, 0.55, pal.c, 1, pal.b]);
  var e = energy(bands);
  ctx.globalCompositeOperation = "lighter";      // where ribbons cross, they glow
  for (var L = 0; L < layers; L++) {
    var speed = 0.6 + L * 0.23, freq = 2.2 + L * 0.7, phase = L * 1.7;
    var amp = h * (0.20 + 0.42 * e) * (1 - L * 0.11);
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = i / steps;
      var lv = levelAt(bands, (x * 0.8 + L * 0.05) % 1);
      var y = mid + Math.sin(x * freq * Math.PI + t * speed + phase) * amp * (0.35 + lv) * taper(x)
                  + Math.sin(x * 9 + t * 1.9 + L) * h * 0.02 * lv;
      if (i === 0) ctx.moveTo(x * w, y); else ctx.lineTo(x * w, y);
    }
    for (var j = steps; j >= 0; j--) {
      var x2 = j / steps;
      var lv2 = levelAt(bands, (x2 * 0.8 + L * 0.05) % 1);
      var y2 = mid - Math.sin(x2 * freq * Math.PI + t * speed * 0.8 + phase + 0.9) * amp * 0.5 * (0.35 + lv2) * taper(x2);
      ctx.lineTo(x2 * w, y2);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.20 + 0.08 * (layers - L) / layers;
    ctx.fillStyle = across;
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = across;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Many fine lines in one flowing sheet -- the silk mesh.
function drawSilk(ctx, bands, t, w, h, pal, cache) {
  var mid = h / 2, lines = 26, steps = 64;
  var across = grad(ctx, cache, "silk" + w, 0, 0, w, 0, [0, pal.a, 0.5, pal.c, 1, pal.b]);
  var e = energy(bands);
  ctx.strokeStyle = across;
  ctx.lineWidth = 1;
  for (var k = 0; k < lines; k++) {
    var f = k / (lines - 1);
    ctx.globalAlpha = 0.18 + 0.5 * Math.sin(Math.PI * f);
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = i / steps;
      var lv = levelAt(bands, x);
      var amp = h * (0.12 + 0.30 * e + 0.18 * lv);
      var y = mid + Math.sin(x * 2.6 * Math.PI + t * 0.9 + f * 2.4) * amp * taper(x) * (0.55 + 0.45 * Math.cos(f * 3 + t * 0.5))
                  + (f - 0.5) * h * 0.18 * taper(x);
      if (i === 0) ctx.moveTo(x * w, y); else ctx.lineTo(x * w, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Mirrored rounded bars, purple into cyan, with soft caps.
function drawBars(ctx, bands, t, w, h, pal, cache) {
  var n = 48, gap = Math.max(2, w / n * 0.35), bw = (w - gap * (n - 1)) / n, mid = h / 2;
  var across = grad(ctx, cache, "bar" + w, 0, 0, w, 0, [0, pal.a, 0.5, pal.c, 1, pal.b]);
  ctx.fillStyle = across;
  for (var i = 0; i < n; i++) {
    var x = i / (n - 1);
    var lv = levelAt(bands, x);
    var half = Math.max(bw / 2, (0.06 + 0.88 * lv) * h * 0.46 * (0.75 + 0.25 * Math.sin(t * 3 + i * 0.6)));
    var bx = i * (bw + gap), r = Math.min(bw / 2, half);
    ctx.globalAlpha = 0.85;
    roundRect(ctx, bx, mid - half, bw, half * 2, r);
    ctx.fill();
    ctx.globalAlpha = 0.25;                 // the reflection's glow
    roundRect(ctx, bx - 1, mid - half - 2, bw + 2, half * 2 + 4, r + 1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// An LED dot matrix, lit from the middle out.
function drawDots(ctx, bands, t, w, h, pal, cache) {
  var cols = 36, rows = 15;
  var cw = w / cols, rh = h / rows, r = Math.max(1.2, Math.min(cw, rh) * 0.32);
  var midRow = (rows - 1) / 2;
  var across = grad(ctx, cache, "dot" + w, 0, 0, w, 0, [0, pal.a, 0.5, pal.c, 1, pal.b]);
  ctx.fillStyle = across;
  for (var c = 0; c < cols; c++) {
    var lv = levelAt(bands, c / (cols - 1));
    var lit = Math.round((0.08 + 0.92 * lv) * midRow * (0.85 + 0.15 * Math.sin(t * 4 + c)));
    for (var rr = 0; rr < rows; rr++) {
      var d = Math.abs(rr - midRow);
      ctx.globalAlpha = d <= lit ? 0.95 - 0.5 * (d / (midRow + 1)) : 0.08;
      ctx.beginPath();
      ctx.arc(c * cw + cw / 2, rr * rh + rh / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// One glowing line that breathes with the music.
function drawPulse(ctx, bands, t, w, h, pal, cache) {
  var mid = h / 2, steps = 160;
  var across = grad(ctx, cache, "pul" + w, 0, 0, w, 0, [0, pal.a, 0.5, pal.c, 1, pal.b]);
  for (var pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = i / steps;
      var lv = levelAt(bands, x);
      var y = mid + taper(x) * h * 0.42 * (0.08 + lv) *
        (Math.sin(x * 34 + t * 5) * 0.6 + Math.sin(x * 11 - t * 2.3) * 0.4);
      if (i === 0) ctx.moveTo(x * w, y); else ctx.lineTo(x * w, y);
    }
    ctx.strokeStyle = across;
    ctx.globalAlpha = pass === 0 ? 0.25 : 1;
    ctx.lineWidth = pass === 0 ? 7 : 1.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Three sine waves crossing, outlined.
function drawWaves(ctx, bands, t, w, h, pal, cache) {
  var mid = h / 2, steps = 90, cols = [pal.a, pal.b, pal.c];
  var e = energy(bands);
  for (var k = 0; k < 3; k++) {
    var lowHigh = levelAt(bands, k / 2);
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var x = i / steps;
      var y = mid + taper(x) * h * (0.12 + 0.28 * lowHigh + 0.1 * e)
        * Math.sin(x * (2 + k) * Math.PI + t * (0.8 + k * 0.35) + k * 2.1);
      if (i === 0) ctx.moveTo(x * w, y); else ctx.lineTo(x * w, y);
    }
    ctx.strokeStyle = cols[k];
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

var DRAW = { ribbons: drawRibbons, silk: drawSilk, bars: drawBars, dots: drawDots, pulse: drawPulse, waves: drawWaves };

function draw(ctx, style, bands, t, w, h, pal, cache) {
  if (!ctx || !(w > 2) || !(h > 2)) return;
  var fn = DRAW[style] || drawRibbons;
  ctx.save();
  fn(ctx, bands || [], t || 0, w, h, pal || PALETTES.neon, cache || {});
  ctx.restore();
}

// The quiet motion when nothing plays: a soft, slow swell (never blank).
function idleBands(t, n) {
  var out = [];
  for (var i = 0; i < (n || 32); i++) out.push(0.06 + 0.05 * (1 + Math.sin(t * 0.8 + i * 0.35)) / 2);
  return out;
}

// Reading a spectrum published for the desktop (see chords.js CH.Spectrum):
// a string of one character per level, "0" (48) + 0..63.
function bandsAt(spec, seconds) {
  if (!spec || !spec.data || !spec.fps || !spec.bands) return null;
  var nb = spec.bands, frames = Math.floor(spec.data.length / nb);
  if (!frames) return null;
  var p = Math.max(0, seconds) * spec.fps, i = Math.min(frames - 1, Math.floor(p)), f = p - Math.floor(p);
  var j = Math.min(frames - 1, i + 1), out = [];
  for (var b = 0; b < nb; b++) {
    var v0 = spec.data.charCodeAt(i * nb + b) - 48, v1 = spec.data.charCodeAt(j * nb + b) - 48;
    out.push(clamp01((v0 + (v1 - v0) * f) / 63));
  }
  return out;
}

if (typeof window !== "undefined") window.NNViz = { STYLES: STYLES, PALETTES: PALETTES, draw: draw, idleBands: idleBands, bandsAt: bandsAt, levelAt: levelAt };
