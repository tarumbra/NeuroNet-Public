/* ==========================================================================
   Pixel art -- the engine (no page, no canvas): pictures as RGBA arrays,
   the drawing tools, layers and frames, PNG and .aseprite files, palettes,
   and the NeuroPets templates.

   Cam (2026-10-04): "Create a pixel art creator in the creative section as
   well where i can make game assests think asesprite style with the side
   bars, layering, animation, colour palettes (default and ability to create
   or import palettes. Also the ability to export to asesprite or png ...
   Please provide starting pet templates i can build off as well".

   Plain functions on Uint8ClampedArray(w * h * 4), so every tool, the PNG
   writer and the .aseprite writer are tested in node (test_pixel.js) and the
   page (pixel.js) only draws and listens. Files are written here byte by
   byte: a PNG with stored (uncompressed) deflate blocks -- a pixel sprite is
   tiny -- and an .aseprite file per Aseprite's own published format.
   ========================================================================== */
var PixelCore = (function () {
  "use strict";

  /* ------------------------------------------------------------- colours */

  function hexToRgba(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    if (h.length === 6) h += "ff";
    if (!/^[0-9a-f]{8}$/i.test(h)) return [0, 0, 0, 0];
    return [0, 2, 4, 6].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  function rgbaToHex(c) {
    var s = "#" + [c[0], c[1], c[2]].map(function (v) { return ("0" + (v | 0).toString(16)).slice(-2); }).join("");
    return c[3] === undefined || c[3] === 255 ? s : s + ("0" + (c[3] | 0).toString(16)).slice(-2);
  }

  /* -------------------------------------------------------------- images */

  function blank(w, h) { return new Uint8ClampedArray(w * h * 4); }
  function get(img, w, x, y) { var i = (y * w + x) * 4; return [img[i], img[i + 1], img[i + 2], img[i + 3]]; }
  function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]; }

  function set(img, w, h, x, y, c) {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    var i = (y * w + x) * 4;
    img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = c[3];
  }

  /** A square brush of `size`, mirrored across the middle when `mirror`. */
  function dab(img, w, h, x, y, c, size, mirror) {
    var s = Math.max(1, size | 0), o = Math.floor((s - 1) / 2);
    for (var dy = 0; dy < s; dy++) for (var dx = 0; dx < s; dx++) {
      set(img, w, h, x - o + dx, y - o + dy, c);
      if (mirror) set(img, w, h, w - 1 - (x - o + dx), y - o + dy, c);
    }
  }

  /** Every point on a straight line (Bresenham), ends included. */
  function linePoints(x0, y0, x1, y1) {
    var pts = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (var guard = 0; guard < 100000; guard++) {
      pts.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return pts;
  }

  function line(img, w, h, x0, y0, x1, y1, c, size, mirror) {
    linePoints(x0, y0, x1, y1).forEach(function (p) { dab(img, w, h, p[0], p[1], c, size, mirror); });
  }

  function rect(img, w, h, x0, y0, x1, y1, c, filled, size, mirror) {
    var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (var y = ay; y <= by; y++) for (var x = ax; x <= bx; x++) {
      if (filled || x === ax || x === bx || y === ay || y === by) dab(img, w, h, x, y, c, filled ? 1 : size, mirror);
    }
  }

  /** An ellipse inside the box (x0,y0)-(x1,y1): outline, or filled. */
  function ellipse(img, w, h, x0, y0, x1, y1, c, filled, size, mirror) {
    var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    var cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5;
    var inside = function (x, y) { var u = (x - cx) / rx, v = (y - cy) / ry; return u * u + v * v <= 1; };
    for (var y = ay; y <= by; y++) for (var x = ax; x <= bx; x++) {
      if (!inside(x, y)) continue;
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) dab(img, w, h, x, y, c, filled ? 1 : size, mirror);
    }
  }

  /** Paint bucket: the touching area of the same colour (4-way). */
  function fill(img, w, h, x, y, c) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    var from = get(img, w, x, y);
    if (same(from, c)) return 0;
    var stack = [[x, y]], n = 0;
    while (stack.length) {
      var p = stack.pop(), px = p[0], py = p[1];
      if (px < 0 || py < 0 || px >= w || py >= h || !same(get(img, w, px, py), from)) continue;
      set(img, w, h, px, py, c); n++;
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    return n;
  }

  /** The cel moved by (dx, dy); what slides off the edge is gone. */
  function shift(img, w, h, dx, dy) {
    var out = blank(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      var i = (y * w + x) * 4, j = (ny * w + nx) * 4;
      out[j] = img[i]; out[j + 1] = img[i + 1]; out[j + 2] = img[i + 2]; out[j + 3] = img[i + 3];
    }
    return out;
  }

  function flip(img, w, h, horizontal) {
    var out = blank(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var sx = horizontal ? w - 1 - x : x, sy = horizontal ? y : h - 1 - y;
      var i = (sy * w + sx) * 4, j = (y * w + x) * 4;
      out[j] = img[i]; out[j + 1] = img[i + 1]; out[j + 2] = img[i + 2]; out[j + 3] = img[i + 3];
    }
    return out;
  }

  /** A picture put into a bigger (or smaller) canvas at (ox, oy). */
  function place(img, w, h, nw, nh, ox, oy) {
    var out = blank(nw, nh);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= nw || ny >= nh) continue;
      var i = (y * w + x) * 4, j = (ny * nw + nx) * 4;
      out[j] = img[i]; out[j + 1] = img[i + 1]; out[j + 2] = img[i + 2]; out[j + 3] = img[i + 3];
    }
    return out;
  }

  function scaleUp(img, w, h, k) {
    k = Math.max(1, k | 0);
    if (k === 1) return img;
    var out = blank(w * k, h * k), W = w * k;
    for (var y = 0; y < h * k; y++) for (var x = 0; x < W; x++) {
      var i = ((y / k | 0) * w + (x / k | 0)) * 4, j = (y * W + x) * 4;
      out[j] = img[i]; out[j + 1] = img[i + 1]; out[j + 2] = img[i + 2]; out[j + 3] = img[i + 3];
    }
    return out;
  }

  function isEmpty(img) {
    if (!img) return true;
    for (var i = 3; i < img.length; i += 4) if (img[i]) return false;
    return true;
  }

  /** `top` painted over `base` (both RGBA), top's alpha times `opacity` (0..255). */
  function over(base, top, opacity) {
    var k = (opacity === undefined ? 255 : opacity) / 255;
    for (var i = 0; i < base.length; i += 4) {
      var ta = (top[i + 3] / 255) * k;
      if (!ta) continue;
      var ba = base[i + 3] / 255, oa = ta + ba * (1 - ta);
      for (var c = 0; c < 3; c++) base[i + c] = Math.round((top[i + c] * ta + base[i + c] * ba * (1 - ta)) / oa);
      base[i + 3] = Math.round(oa * 255);
    }
    return base;
  }

  /* ------------------------------------------------------------ projects

     A project: {kind: "pixel", name, w, h, layers: [{id, name, visible,
     opacity}], frames: [{dur}], cels: {"<layer id>": [img|null per frame]},
     palette: {name, colours}}. Layers are listed bottom to top. */
  var nextId = 1;
  function layerId() { return "L" + Date.now().toString(36) + (nextId++); }

  function newProject(w, h, name) {
    var id = layerId(), cels = {};
    cels[id] = [blank(w, h)];
    return {kind: "pixel", name: name || "Sprite", w: w, h: h,
            layers: [{id: id, name: "Layer 1", visible: true, opacity: 255}],
            frames: [{dur: 100}], cels: cels, palette: null};
  }

  function cel(p, id, f) {
    var list = p.cels[id] || (p.cels[id] = []);
    if (!list[f]) list[f] = blank(p.w, p.h);
    return list[f];
  }

  /** Every visible layer of frame `f`, flattened. */
  function composite(p, f) {
    var out = blank(p.w, p.h);
    p.layers.forEach(function (l) {
      var c = (p.cels[l.id] || [])[f];
      if (l.visible && c) over(out, c, l.opacity);
    });
    return out;
  }

  function addLayer(p, name, at) {
    var id = layerId();
    var l = {id: id, name: name || "Layer " + (p.layers.length + 1), visible: true, opacity: 255};
    p.cels[id] = p.frames.map(function () { return null; });
    p.layers.splice(at === undefined ? p.layers.length : at, 0, l);
    return l;
  }

  function duplicateLayer(p, i) {
    var src = p.layers[i], l = addLayer(p, src.name + " copy", i + 1);
    l.opacity = src.opacity; l.visible = src.visible;
    p.cels[l.id] = (p.cels[src.id] || []).map(function (c) { return c ? new Uint8ClampedArray(c) : null; });
    return l;
  }

  function removeLayer(p, i) {
    if (p.layers.length < 2) return false;
    var l = p.layers.splice(i, 1)[0];
    delete p.cels[l.id];
    return true;
  }

  function moveLayer(p, i, by) {
    var j = i + by;
    if (j < 0 || j >= p.layers.length) return i;
    var l = p.layers.splice(i, 1)[0];
    p.layers.splice(j, 0, l);
    return j;
  }

  /** Layer i painted onto the one below it, then gone. */
  function mergeDown(p, i) {
    if (i < 1) return false;
    var top = p.layers[i], below = p.layers[i - 1];
    p.frames.forEach(function (_, f) {
      var t = (p.cels[top.id] || [])[f];
      if (t && top.visible) over(cel(p, below.id, f), t, top.opacity);
    });
    p.layers.splice(i, 1);
    delete p.cels[top.id];
    return true;
  }

  function addFrame(p, at, copyFrom) {
    var f = at === undefined ? p.frames.length : at;
    var dur = (p.frames[copyFrom === undefined ? f - 1 : copyFrom] || {dur: 100}).dur;
    p.frames.splice(f, 0, {dur: dur});
    p.layers.forEach(function (l) {
      var list = p.cels[l.id] || (p.cels[l.id] = []);
      var src = copyFrom === undefined ? null : list[copyFrom];
      list.splice(f, 0, src ? new Uint8ClampedArray(src) : null);
    });
    return f;
  }

  function removeFrame(p, f) {
    if (p.frames.length < 2) return false;
    p.frames.splice(f, 1);
    p.layers.forEach(function (l) { (p.cels[l.id] || []).splice(f, 1); });
    return true;
  }

  function moveFrame(p, f, by) {
    var g = f + by;
    if (g < 0 || g >= p.frames.length) return f;
    var fr = p.frames.splice(f, 1)[0];
    p.frames.splice(g, 0, fr);
    p.layers.forEach(function (l) {
      var list = p.cels[l.id] || [];
      var c = list.splice(f, 1)[0];
      list.splice(g, 0, c || null);
    });
    return g;
  }

  /** The canvas made w x h; everything keeps its place, offset by (ox, oy). */
  function resize(p, w, h, ox, oy) {
    Object.keys(p.cels).forEach(function (id) {
      p.cels[id] = p.cels[id].map(function (c) { return c ? place(c, p.w, p.h, w, h, ox || 0, oy || 0) : null; });
    });
    p.w = w; p.h = h;
  }

  /* ---- base64 (browser or node) and saving ---- */
  function toB64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.length).toString("base64");
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function fromB64(b64) {
    if (typeof Buffer !== "undefined") return new Uint8ClampedArray(Buffer.from(b64, "base64"));
    var s = atob(b64), out = new Uint8ClampedArray(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  /** A project as plain JSON (empty cels left out), and back. */
  function serialise(p) {
    var cels = {};
    Object.keys(p.cels).forEach(function (id) {
      cels[id] = p.cels[id].map(function (c) { return c && !isEmpty(c) ? toB64(c) : null; });
    });
    return {kind: "pixel", v: 1, name: p.name, w: p.w, h: p.h, layers: p.layers.map(function (l) { return Object.assign({}, l); }),
            frames: p.frames.map(function (f) { return {dur: f.dur}; }), cels: cels, palette: p.palette || null,
            fps: p.fps || null};
  }
  function deserialise(d) {
    var p = {kind: "pixel", name: d.name || "Sprite", w: d.w | 0, h: d.h | 0, layers: (d.layers || []).map(function (l) { return Object.assign({}, l); }),
             frames: (d.frames || [{dur: 100}]).map(function (f) { return {dur: f.dur || 100}; }), cels: {}, palette: d.palette || null};
    if (!p.w || !p.h || !p.layers.length) throw new Error("That isn't a pixel-art project.");
    p.layers.forEach(function (l) {
      var list = (d.cels || {})[l.id] || [];
      p.cels[l.id] = p.frames.map(function (_, f) {
        var c = list[f] ? fromB64(list[f]) : null;
        return c && c.length === p.w * p.h * 4 ? c : null;
      });
    });
    return p;
  }

  /* ------------------------------------------------------------- PNG */

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function adler32(bytes) {
    var a = 1, b = 0;
    for (var i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  }
  /** zlib data made of stored (uncompressed) deflate blocks. */
  function zlibStored(data) {
    var blocks = Math.max(1, Math.ceil(data.length / 65535));
    var out = new Uint8Array(2 + data.length + blocks * 5 + 4), o = 0;
    out[o++] = 0x78; out[o++] = 0x01;
    for (var b = 0; b < blocks; b++) {
      var start = b * 65535, len = Math.min(65535, data.length - start);
      out[o++] = b === blocks - 1 ? 1 : 0;
      out[o++] = len & 0xff; out[o++] = len >> 8; out[o++] = ~len & 0xff; out[o++] = (~len >> 8) & 0xff;
      out.set(data.subarray(start, start + len), o); o += len;
    }
    var ad = adler32(data);
    out[o++] = ad >>> 24; out[o++] = (ad >>> 16) & 0xff; out[o++] = (ad >>> 8) & 0xff; out[o++] = ad & 0xff;
    return out;
  }
  function be32(n) { return [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]; }
  function chunk(type, data) {
    var t = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
    var body = new Uint8Array(4 + data.length);
    body.set(t, 0); body.set(data, 4);
    var out = new Uint8Array(12 + data.length);
    out.set(be32(data.length), 0); out.set(body, 4); out.set(be32(crc32(body)), 8 + data.length);
    return out;
  }
  /** RGBA pixels -> the bytes of a PNG file. */
  function png(img, w, h) {
    var raw = new Uint8Array((w * 4 + 1) * h);
    for (var y = 0; y < h; y++) {
      raw[y * (w * 4 + 1)] = 0;                                  // filter: none
      raw.set(img.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
    }
    var ihdr = new Uint8Array([].concat(be32(w), be32(h), [8, 6, 0, 0, 0]));
    var parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr),
                 chunk("IDAT", zlibStored(raw)), chunk("IEND", new Uint8Array(0))];
    var size = parts.reduce(function (s, x) { return s + x.length; }, 0), out = new Uint8Array(size), o = 0;
    parts.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function pngDataUrl(img, w, h) { return "data:image/png;base64," + toB64(png(img, w, h)); }

  /** Every frame side by side (or in `cols` columns) -- a sprite sheet. */
  function spriteSheet(p, cols) {
    var n = p.frames.length, c = Math.max(1, Math.min(n, cols || n)), r = Math.ceil(n / c);
    var W = p.w * c, H = p.h * r, out = blank(W, H);
    for (var f = 0; f < n; f++) {
      var img = composite(p, f), ox = (f % c) * p.w, oy = Math.floor(f / c) * p.h;
      for (var y = 0; y < p.h; y++) out.set(img.subarray(y * p.w * 4, (y + 1) * p.w * 4), ((oy + y) * W + ox) * 4);
    }
    return {img: out, w: W, h: H};
  }

  /* --------------------------------------------------------- .aseprite

     Aseprite's file format (github.com/aseprite/aseprite/blob/main/docs/
     ase-file-specs.md): a 128-byte header, then each frame with its chunks
     -- in the first frame the palette and the layers (bottom to top), then
     in every frame one cel per non-empty layer: raw RGBA (cel type 0),
     cropped to what's drawn. Colour depth 32 (RGBA). */
  function aseprite(p) {
    var bytes = [], w8 = function (v) { bytes.push(v & 0xff); };
    var w16 = function (v) { w8(v); w8(v >> 8); };
    var w32 = function (v) { w16(v & 0xffff); w16((v >>> 16) & 0xffff); };
    var str = function (s) {
      var u = typeof TextEncoder !== "undefined" ? Array.from(new TextEncoder().encode(String(s))) : String(s).split("").map(function (c) { return c.charCodeAt(0) & 0xff; });
      w16(u.length); u.forEach(w8);
    };
    var colours = ((p.palette && p.palette.colours) || []).slice(0, 256);
    if (!colours.length) colours = ["#000000"];
    function chunkOut(type, body) {           // body: function writing into a fresh list
      var keep = bytes; bytes = [];
      body();
      var data = bytes; bytes = keep;
      w32(data.length + 6); w16(type);
      for (var i = 0; i < data.length; i++) bytes.push(data[i]);
    }
    var frames = [];
    p.frames.forEach(function (fr, f) {
      var keep = bytes; bytes = [];
      var count = 0;
      if (f === 0) {
        chunkOut(0x2019, function () {                     // palette
          w32(colours.length); w32(0); w32(colours.length - 1);
          for (var k = 0; k < 8; k++) w8(0);
          colours.forEach(function (hx) { var c = hexToRgba(hx); w16(0); w8(c[0]); w8(c[1]); w8(c[2]); w8(c[3]); });
        });
        count++;
        p.layers.forEach(function (l) {                     // layers, bottom first
          chunkOut(0x2004, function () {
            w16((l.visible ? 1 : 0) | 2); w16(0); w16(0); w16(0); w16(0); w16(0);
            w8(l.opacity === undefined ? 255 : l.opacity); w8(0); w8(0); w8(0);
            str(l.name || "Layer");
          });
          count++;
        });
      }
      p.layers.forEach(function (l, li) {
        var c = (p.cels[l.id] || [])[f];
        if (!c || isEmpty(c)) return;
        var x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
        for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
          if (c[(y * p.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        chunkOut(0x2005, function () {
          w16(li); w16(x0); w16(y0); w8(255); w16(0); w16(0);
          for (var k = 0; k < 5; k++) w8(0);
          w16(x1 - x0 + 1); w16(y1 - y0 + 1);
          for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
            var i = (yy * p.w + xx) * 4; w8(c[i]); w8(c[i + 1]); w8(c[i + 2]); w8(c[i + 3]);
          }
        });
        count++;
      });
      var body = bytes; bytes = keep;
      frames.push({body: body, count: count, dur: fr.dur || 100});
    });
    var out = [];
    bytes = out;
    var total = 128 + frames.reduce(function (s, fr) { return s + 16 + fr.body.length; }, 0);
    w32(total); w16(0xA5E0); w16(p.frames.length); w16(p.w); w16(p.h); w16(32);
    w32(1); w16(100); w32(0); w32(0); w8(0); w8(0); w8(0); w8(0);
    w16(colours.length === 256 ? 0 : colours.length); w8(1); w8(1); w16(0); w16(0); w16(16); w16(16);
    for (var r = 0; r < 84; r++) w8(0);
    frames.forEach(function (fr) {
      w32(16 + fr.body.length); w16(0xF1FA); w16(Math.min(fr.count, 0xffff)); w16(fr.dur); w8(0); w8(0); w32(fr.count);
      for (var i = 0; i < fr.body.length; i++) out.push(fr.body[i]);
    });
    return new Uint8Array(out);
  }

  /* ------------------------------------------------------------ palettes */

  var PALETTES = [
    {name: "PICO-8", colours: ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
      "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"]},
    {name: "DawnBringer 16", colours: ["#140c1c", "#442434", "#30346d", "#4e4a4e", "#854c30", "#346524", "#d04648", "#757161",
      "#597dce", "#d27d2c", "#8595a1", "#6daa2c", "#d2aa99", "#6dc2ca", "#dad45e", "#deeed6"]},
    {name: "Sweetie 16", colours: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179",
      "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"]},
    {name: "Endesga 32", colours: ["#be4a2f", "#d77643", "#ead4aa", "#e4a672", "#b86f50", "#733e39", "#3e2731", "#a22633",
      "#e43b44", "#f77622", "#feae34", "#fee761", "#63c74d", "#3e8948", "#265c42", "#193c3e", "#124e89", "#0099db",
      "#2ce8f5", "#ffffff", "#c0cbdc", "#8b9bb4", "#5a6988", "#3a4466", "#262b44", "#181425", "#ff0044", "#68386c",
      "#b55088", "#f6757a", "#e8b796", "#c28569"]},
    {name: "Game Boy", colours: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"]},
    {name: "Greys", colours: ["#000000", "#222222", "#444444", "#666666", "#888888", "#aaaaaa", "#cccccc", "#eeeeee", "#ffffff"]},
  ];

  /** A palette file's colours: GIMP .gpl, JASC .pal, Paint.NET .txt, or one
      hex colour a line (.hex, as Lospec gives them). */
  function parsePalette(text, name) {
    var lines = String(text || "").split(/\r?\n/), colours = [], title = name || "Imported";
    if (/^GIMP Palette/.test(lines[0])) {
      lines.slice(1).forEach(function (l) {
        var n = l.match(/^Name:\s*(.+)/);
        if (n) { title = n[1].trim(); return; }
        var m = l.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
        if (m) colours.push(rgbaToHex([+m[1], +m[2], +m[3], 255]));
      });
    } else if (/^JASC-PAL/.test(lines[0])) {
      lines.slice(3).forEach(function (l) {
        var m = l.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
        if (m) colours.push(rgbaToHex([+m[1], +m[2], +m[3], 255]));
      });
    } else {
      lines.forEach(function (l) {
        var t = l.trim();
        if (!t || t[0] === ";" || t[0] === "/") return;
        var m = t.match(/^#?([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/i);
        if (!m) return;
        var h = m[1];
        if (h.length === 8) h = h.slice(2);                     // Paint.NET: AARRGGBB
        colours.push(rgbaToHex(hexToRgba(h)));
      });
    }
    var seen = {};
    colours = colours.filter(function (c) { if (seen[c]) return false; seen[c] = 1; return true; }).slice(0, 256);
    return {name: title, colours: colours};
  }

  /** The unique colours of a picture (an imported palette image), up to 256. */
  function paletteFromImage(img) {
    var seen = {}, out = [];
    for (var i = 0; i < img.length && out.length < 256; i += 4) {
      if (img[i + 3] < 128) continue;
      var hx = rgbaToHex([img[i], img[i + 1], img[i + 2], 255]);
      if (!seen[hx]) { seen[hx] = 1; out.push(hx); }
    }
    return out;
  }

  function gpl(pal) {
    return "GIMP Palette\nName: " + (pal.name || "Palette") + "\nColumns: 8\n#\n" + pal.colours.map(function (hx) {
      var c = hexToRgba(hx);
      return [c[0], c[1], c[2]].map(function (v) { return ("   " + v).slice(-3); }).join(" ") + "\t" + hx.slice(1);
    }).join("\n") + "\n";
  }

  /* ---------------------------------------------- NeuroPets as pixels */

  /** Text-grid art (rows + palette letters, "." see-through) as pixels. */
  function fromRows(rows, pal, only) {
    var h = rows.length, w = h ? rows[0].length : 0, img = blank(w, h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = rows[y].charAt(x);
      if (ch === "." || !pal[ch] || (only && !only(ch))) continue;
      set(img, w, h, x, y, hexToRgba(pal[ch]));
    }
    return {img: img, w: w, h: h};
  }

  /* The templates: every NeuroPets sprite. Pets (the three species in every
     colour) come as a little idle animation on three layers -- Outline,
     Colour, Face -- so recolouring and redrawing the face are easy. The
     hunt's animals, items, eggs and the player come as one layer, one frame. */
  var FACE = {e: 1, w: 1, p: 1, t: 1};
  function templates(PetArt, PetCore) {
    if (!PetArt) return [];
    var out = [];
    var named = function (table, id) { return PetCore && PetCore[table] && PetCore[table][id] && PetCore[table][id].name; };
    Object.keys(PetArt.COLOURS).forEach(function (sp) {
      Object.keys(PetArt.COLOURS[sp]).forEach(function (col) {
        out.push({id: "pet:" + sp + "/" + col, name: cap(col) + " " + sp, group: "Pets", kind: "pet", sp: sp, col: col});
      });
    });
    Object.keys(PetArt.MONSTER_ART).forEach(function (id) {
      var m = PetArt.monster(id);
      if (m && m.rows && m.pal) out.push({id: "creature:" + id, name: named("MONSTERS", id) || cap(id), group: "Creatures", kind: "creature", src: id});
    });
    Object.keys(PetArt.EGG_LOOKS).forEach(function (k) {
      out.push({id: "egg:" + k, name: cap(k) + " egg", group: "Eggs", kind: "egg", src: k});
    });
    out.push({id: "avatar:you", name: "You (player)", group: "People", kind: "avatar"});
    Object.keys(PetArt.ITEM_ART).forEach(function (id) {
      if (PetArt.itemArt(id)) out.push({id: "item:" + id, name: named("ITEMS", id) || cap(id), group: "Items", kind: "item", src: id});
    });
    return out;
  }
  function cap(s) { s = String(s).replace(/([a-z])([A-Z])/g, "$1 $2"); return s.charAt(0).toUpperCase() + s.slice(1); }

  /** A template's first picture (for its button and the Assets page). */
  function templateArt(PetArt, t) {
    if (t.kind === "pet") return {rows: PetArt.frame(t.sp, "ok"), pal: PetArt.palette(t.sp, t.col)};
    if (t.kind === "creature") return PetArt.monster(t.src);
    if (t.kind === "egg") return PetArt.item("egg", t.src);
    if (t.kind === "avatar") return PetArt.avatar({});
    return PetArt.itemArt(t.src);
  }

  /** A project made from a template, `scale` times as big, on a canvas
      `size` square (centred), with the NeuroPets palette chosen. */
  function fromTemplate(PetArt, t, opts) {
    opts = opts || {};
    var k = Math.max(1, opts.scale | 0 || 1);
    var art = templateArt(PetArt, t);
    var sw = art.rows[0].length * k, sh = art.rows.length * k;
    var W = Math.max(sw, opts.size || sw), H = Math.max(sh, opts.size || sh);
    var p = newProject(W, H, t.name);
    p.palette = {name: "NeuroPets", colours: neuroPetsPalette(PetArt)};
    var ox = Math.floor((W - sw) / 2), oy = Math.floor((H - sh) / 2);
    var pic = function (rows, pal, only) {
      var r = fromRows(rows, pal, only);
      return place(scaleUp(r.img, r.w, r.h, k), r.w * k, r.h * k, W, H, ox, oy);
    };
    if (t.kind !== "pet") {
      p.cels[p.layers[0].id][0] = pic(art.rows, art.pal);
      p.layers[0].name = "Sprite";
      return p;
    }
    /* a pet: Outline / Colour / Face, and a four-frame idle (open, blink,
       open, happy) */
    var pal = PetArt.palette(t.sp, t.col);
    var moods = [["ok", false], ["ok", true], ["ok", false], ["happy", false]];
    var durs = [600, 120, 500, 400];
    p.layers = [{id: layerId(), name: "Colour", visible: true, opacity: 255},
                {id: layerId(), name: "Outline", visible: true, opacity: 255},
                {id: layerId(), name: "Face", visible: true, opacity: 255}];
    p.cels = {};
    p.layers.forEach(function (l) { p.cels[l.id] = []; });
    p.frames = moods.map(function (m, f) {
      var rows = PetArt.frame(t.sp, m[0], m[1]);
      p.cels[p.layers[0].id][f] = pic(rows, pal, function (ch) { return ch !== "o" && !FACE[ch]; });
      p.cels[p.layers[1].id][f] = pic(rows, pal, function (ch) { return ch === "o"; });
      p.cels[p.layers[2].id][f] = pic(rows, pal, function (ch) { return !!FACE[ch]; });
      return {dur: durs[f]};
    });
    return p;
  }

  /** Every colour the NeuroPets sprites use, darkest first. */
  function neuroPetsPalette(PetArt) {
    var seen = {}, out = [];
    var add = function (pal) { Object.keys(pal || {}).forEach(function (k) { var c = String(pal[k]).toLowerCase(); if (/^#[0-9a-f]{6}$/.test(c) && !seen[c]) { seen[c] = 1; out.push(c); } }); };
    Object.keys(PetArt.COLOURS).forEach(function (sp) { Object.keys(PetArt.COLOURS[sp]).forEach(function (col) { add(PetArt.palette(sp, col)); }); });
    Object.keys(PetArt.MONSTER_ART).forEach(function (id) { var m = PetArt.monster(id); if (m) add(m.pal); });
    var lum = function (h) { var c = hexToRgba(h); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; };
    return out.sort(function (a, b) { return lum(a) - lum(b); }).slice(0, 256);
  }

  return {
    hexToRgba: hexToRgba, rgbaToHex: rgbaToHex, blank: blank, get: get, set: set, dab: dab, linePoints: linePoints,
    line: line, rect: rect, ellipse: ellipse, fill: fill, shift: shift, flip: flip, place: place, scaleUp: scaleUp,
    isEmpty: isEmpty, over: over, newProject: newProject, cel: cel, composite: composite, addLayer: addLayer,
    duplicateLayer: duplicateLayer, removeLayer: removeLayer, moveLayer: moveLayer, mergeDown: mergeDown,
    addFrame: addFrame, removeFrame: removeFrame, moveFrame: moveFrame, resize: resize, serialise: serialise,
    deserialise: deserialise, toB64: toB64, fromB64: fromB64, png: png, pngDataUrl: pngDataUrl, spriteSheet: spriteSheet,
    aseprite: aseprite, crc32: crc32, PALETTES: PALETTES, parsePalette: parsePalette, paletteFromImage: paletteFromImage,
    gpl: gpl, fromRows: fromRows, templates: templates, templateArt: templateArt, fromTemplate: fromTemplate,
    neuroPetsPalette: neuroPetsPalette,
  };
})();
if (typeof module !== "undefined") module.exports = PixelCore;
