/* ==========================================================================
   Scrapbook — the materials.

   Cam: "Scrapbook, which should have the same toolbar as boards, but also
   contain a collapseable scrapbook materials (this will have designed
   coloured tapes, frames, stickers (Which i can make from any photo). Any
   other common scrapbook materials you suggest) The paper will be
   selectable from different colours and will allow each page to have a
   different type of paper. Furthermore it will have a cover which the
   material can be changed from wood, fur, colour, metal, ect."

   Everything here is DRAWN -- SVG, no image files, nothing fetched -- so a
   page works offline and exports exactly as it looks: the Boards editor
   draws these through SS.ScrapArt.itemSVG, the same routine for the screen
   and for Export PNG.

   Item kinds this file owns (beside Boards' own text, photo, shapes, lines):
     tape     washi, masking and clear tape, torn at both ends
     frame    a photo frame -- Polaroid, film strip, torn, scalloped ...
     sticker  a sticker made from a photo (the sticker book)
     emb      embellishments -- ribbon, buttons, doily, ticket stub ...
     word     titles and labels -- label maker, typewriter, banner ...
   Each keeps its colour in `fill`, so Boards' own palette recolours it.
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* A small steady random, from a string: the torn end of a strip of tape
     must tear the same way every time it is drawn, or it would flicker
     while being dragged. */
  function seeded(str) {
    let h = 2166136261;
    for (const ch of String(str || "x")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 10000) / 10000;
    };
  }
  /* SVG ids are page-wide: two tapes with one pattern id would share it.
     Made from the item's own id, so each is its own and stays the same. */
  const idFor = (it, what) => `sa-${what}-${String(it.id || "x").replace(/[^A-Za-z0-9_-]/g, "")}`;
  let serial = 0;                               // for covers drawn side by side

  const HAND = "'Segoe Print','Bradley Hand','URW Chancery L','Z003',cursive";
  const TYPE = "'Courier New','Nimbus Mono PS','Liberation Mono',monospace";
  const SERIF = "Georgia,'DejaVu Serif',serif";

  /* ------------------------------------------------------------------ tape */

  const TAPES = [
    ["stripes", "Striped washi", "#e58fa1"], ["dots", "Polka-dot washi", "#6fa8dc"],
    ["check", "Gingham washi", "#e06666"], ["floral", "Floral washi", "#93c47d"],
    ["hearts", "Heart washi", "#c27ba0"], ["stars", "Star washi", "#3d5a99"],
    ["chevron", "Chevron washi", "#f6b26b"], ["solid", "Plain washi", "#8e7cc3"],
    ["masking", "Masking tape", "#e9dcb5"], ["clear", "Clear tape", "#ffffff"],
  ];

  function tapePattern(style, pid, x, y) {
    const p = (w, h, body, extra) => `<pattern id="${pid}" patternUnits="userSpaceOnUse"
      x="${x}" y="${y}" width="${w}" height="${h}" ${extra || ""}>${body}</pattern>`;
    const W = "#ffffff";
    switch (style) {
      case "stripes": return p(16, 16, `<rect width="7" height="16" fill="${W}" opacity=".45"/>`, `patternTransform="rotate(45 ${x} ${y})"`);
      case "dots": return p(18, 18, `<circle cx="9" cy="9" r="3.2" fill="${W}" opacity=".8"/>`);
      case "check": return p(20, 20, `<rect width="10" height="20" fill="${W}" opacity=".3"/><rect width="20" height="10" fill="${W}" opacity=".3"/>`);
      case "floral": return p(34, 34, `<g transform="translate(17 17)" fill="${W}" opacity=".85">${
        [0, 72, 144, 216, 288].map((a) => `<ellipse rx="3.4" ry="6" transform="rotate(${a}) translate(0 -6)"/>`).join("")}</g>
        <circle cx="17" cy="17" r="2.6" fill="#ffe08a"/>`);
      case "hearts": return p(26, 24, `<path d="M13 19c-6-4.5-8-7-8-9.6A3.6 3.6 0 0 1 13 7.6a3.6 3.6 0 0 1 8 1.8C21 12 19 14.5 13 19z" fill="${W}" opacity=".75"/>`);
      case "stars": return p(28, 28, `<path d="${starPath(14, 14, 7, 3, 5)}" fill="#ffe08a" opacity=".9"/>`);
      case "chevron": return p(24, 14, `<path d="M0 10l6-6 6 6 6-6 6 6" fill="none" stroke="${W}" stroke-width="3" opacity=".6"/>`);
      case "masking": return p(60, 12, `<path d="M0 4h18M24 8h22M50 3h8" stroke="#a8956a" stroke-width=".7" opacity=".45"/>`);
      default: return "";
    }
  }

  function tapeSVG(it) {
    const x = it.x || 0, y = it.y || 0, w = Math.max(20, it.w || 200), h = Math.max(10, it.h || 44);
    const style = it.style || "stripes";
    const def = TAPES.find((t) => t[0] === style) || TAPES[0];
    const fill = it.fill && it.fill !== "none" ? it.fill : def[2];
    /* the torn ends: a zigzag down each short side */
    const rnd = seeded(it.id), steps = Math.max(4, Math.round(h / 6)), tear = Math.min(7, w / 8);
    const left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const yy = y + (h * i) / steps;
      left.push(`${(x + rnd() * tear).toFixed(1)},${yy.toFixed(1)}`);
      right.push(`${(x + w - rnd() * tear).toFixed(1)},${yy.toFixed(1)}`);
    }
    const poly = left.concat(right.reverse()).join(" ");
    const pid = idFor(it, "tp");
    const pat = tapePattern(style, pid, x, y);
    const base = style === "clear"
      ? `<polygon points="${poly}" fill="#ffffff" opacity=".32" stroke="#ffffff" stroke-opacity=".7" stroke-width="1"/>
         <line x1="${x + tear}" y1="${y + h * 0.3}" x2="${x + w - tear}" y2="${y + h * 0.3}" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/>`
      : `<polygon points="${poly}" fill="${esc(fill)}" opacity="${style === "masking" ? 0.92 : 0.86}"/>
         ${pat ? `<polygon points="${poly}" fill="url(#${pid})"/>` : ""}`;
    return `<g data-id="${esc(it.id)}">${pat ? `<defs>${pat}</defs>` : ""}${base}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  /* ---------------------------------------------------------------- frames */

  const FRAMES = [
    ["polaroid", "Polaroid", "#ffffff"], ["film", "Film strip", "#1b1b1b"],
    ["torn", "Torn edge", "#fbf6ea"], ["scallop", "Scalloped", "#f4c7c3"],
    ["ornate", "Vintage ornate", "#c9a14a"], ["corners", "Photo corners", "#1f2430"],
    ["mat", "Mat board", "#f3efe6"], ["round", "Round", "#ffffff"],
    ["stitched", "Stitched", "#d9c3a0"],
  ];
  const FRAME_SIZE = {polaroid: [300, 360], film: [420, 260], round: [300, 300]};

  /* Where the photo sits inside each frame. */
  function frameInner(style, x, y, w, h) {
    const m = Math.min(w, h);
    switch (style) {
      case "polaroid": return [x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.07 - h * 0.2];
      case "film": return [x + w * 0.04, y + h * 0.17, w * 0.92, h * 0.66];
      case "torn": return [x + m * 0.09, y + m * 0.09, w - m * 0.18, h - m * 0.18];
      case "scallop": return [x + m * 0.1, y + m * 0.1, w - m * 0.2, h - m * 0.2];
      case "ornate": return [x + m * 0.12, y + m * 0.12, w - m * 0.24, h - m * 0.24];
      case "mat": return [x + m * 0.13, y + m * 0.13, w - m * 0.26, h - m * 0.26];
      case "stitched": return [x + m * 0.08, y + m * 0.08, w - m * 0.16, h - m * 0.16];
      case "round": return [x + m * 0.06, y + m * 0.06, w - m * 0.12, h - m * 0.12];
      default: return [x, y, w, h];                       // corners: the photo fills it
    }
  }

  function frameSVG(it) {
    const x = it.x || 0, y = it.y || 0, w = Math.max(30, it.w || 300), h = Math.max(30, it.h || 300);
    const style = it.style || "polaroid";
    const def = FRAMES.find((f) => f[0] === style) || FRAMES[0];
    const c = it.fill && it.fill !== "none" ? it.fill : def[2];
    const [ix, iy, iw, ih] = frameInner(style, x, y, w, h);
    const cid = idFor(it, "fc"), m = Math.min(w, h), rnd = seeded(it.id);
    let back = "", front = "";
    switch (style) {
      case "polaroid":
        back = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c)}" stroke="#00000022"/>`;
        if (it.text) {
          front = `<text x="${x + w / 2}" y="${iy + ih + (y + h - iy - ih) * 0.62}" text-anchor="middle"
            font-family="${HAND}" font-style="italic" font-size="${Math.round(h * 0.07)}" fill="${esc(it.stroke || "#33302b")}">${esc(it.text)}</text>`;
        }
        break;
      case "film": {
        back = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c)}"/>`;
        const n = Math.max(6, Math.round(w / 34)), hw = w / n;
        for (let i = 0; i < n; i++) {
          const hx = x + i * hw + hw * 0.28;
          front += `<rect x="${hx}" y="${y + h * 0.045}" width="${hw * 0.44}" height="${h * 0.075}" rx="2" fill="#f2efe6"/>
                    <rect x="${hx}" y="${y + h * 0.88}" width="${hw * 0.44}" height="${h * 0.075}" rx="2" fill="#f2efe6"/>`;
        }
        break;
      }
      case "torn": {
        const pts = [], k = 9, edge = m * 0.035;
        for (let i = 0; i <= k * 4; i++) {
          const t = (i % k) / k, side = Math.floor(i / k) % 4, j = (rnd() - 0.5) * edge * 2;
          if (side === 0) pts.push([x + w * t, y + Math.abs(j)]);
          if (side === 1) pts.push([x + w - Math.abs(j), y + h * t]);
          if (side === 2) pts.push([x + w * (1 - t), y + h - Math.abs(j)]);
          if (side === 3) pts.push([x + Math.abs(j), y + h * (1 - t)]);
        }
        back = `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${esc(c)}" stroke="#00000018"/>`;
        break;
      }
      case "scallop": {
        const r = m * 0.06, nx = Math.max(3, Math.round(w / (r * 2))), ny = Math.max(3, Math.round(h / (r * 2)));
        let bumps = "";
        for (let i = 0; i <= nx; i++) bumps += `<circle cx="${x + (w * i) / nx}" cy="${y}" r="${r}"/><circle cx="${x + (w * i) / nx}" cy="${y + h}" r="${r}"/>`;
        for (let i = 0; i <= ny; i++) bumps += `<circle cx="${x}" cy="${y + (h * i) / ny}" r="${r}"/><circle cx="${x + w}" cy="${y + (h * i) / ny}" r="${r}"/>`;
        back = `<g fill="${esc(c)}">${bumps}<rect x="${x}" y="${y}" width="${w}" height="${h}"/></g>`;
        break;
      }
      case "ornate": {
        const t = m * 0.05;
        back = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c)}"/>
          <rect x="${x + t * 0.5}" y="${y + t * 0.5}" width="${w - t}" height="${h - t}" fill="none" stroke="#00000040" stroke-width="${t * 0.2}"/>
          <rect x="${x + t * 1.6}" y="${y + t * 1.6}" width="${w - t * 3.2}" height="${h - t * 3.2}" fill="none" stroke="#ffffff66" stroke-width="${t * 0.3}"/>`;
        front = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy]) => `
          <circle cx="${cx + (cx > x ? -t * 1.2 : t * 1.2)}" cy="${cy + (cy > y ? -t * 1.2 : t * 1.2)}" r="${t * 0.9}" fill="${esc(c)}" stroke="#00000055" stroke-width="${t * 0.15}"/>
          <circle cx="${cx + (cx > x ? -t * 1.2 : t * 1.2)}" cy="${cy + (cy > y ? -t * 1.2 : t * 1.2)}" r="${t * 0.35}" fill="#ffffff88"/>`).join("");
        break;
      }
      case "corners": {
        const s = m * 0.16;
        front = `<g fill="${esc(c)}">
          <polygon points="${x - 2},${y - 2} ${x + s},${y - 2} ${x - 2},${y + s}"/>
          <polygon points="${x + w + 2},${y - 2} ${x + w - s},${y - 2} ${x + w + 2},${y + s}"/>
          <polygon points="${x - 2},${y + h + 2} ${x + s},${y + h + 2} ${x - 2},${y + h - s}"/>
          <polygon points="${x + w + 2},${y + h + 2} ${x + w - s},${y + h + 2} ${x + w + 2},${y + h - s}"/></g>`;
        break;
      }
      case "mat":
        back = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(c)}" stroke="#00000020"/>`;
        front = `<rect x="${ix - 3}" y="${iy - 3}" width="${iw + 6}" height="${ih + 6}" fill="none" stroke="#00000030" stroke-width="2"/>`;
        break;
      case "round":
        back = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${esc(c)}" stroke="#00000022"/>`;
        break;
      case "stitched":
        back = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${m * 0.03}" fill="${esc(c)}"/>`;
        front = `<rect x="${x + m * 0.04}" y="${y + m * 0.04}" width="${w - m * 0.08}" height="${h - m * 0.08}" rx="${m * 0.02}"
          fill="none" stroke="${esc(it.stroke && it.stroke !== c ? it.stroke : "#6b4f2a")}" stroke-width="${Math.max(1.5, m * 0.008)}" stroke-dasharray="${m * 0.03} ${m * 0.02}"/>`;
        break;
    }
    const clipShape = style === "round"
      ? `<ellipse cx="${ix + iw / 2}" cy="${iy + ih / 2}" rx="${iw / 2}" ry="${ih / 2}"/>`
      : `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/>`;
    // where the photo sits in the window: the editor's rule (fx / fy / zoom),
    // so moving it with a right-click shows the same here as in a page export
    const photo = it.src
      ? (SS.BoardEditor && SS.BoardEditor.photoImage
        ? SS.BoardEditor.photoImage(it, [ix, iy, iw, ih], `clip-path="url(#${cid})"`)
        : `<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" href="${esc(it.src)}"
           preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>`)
      : `<g clip-path="url(#${cid})"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="#e7e3da"/>
         <text x="${ix + iw / 2}" y="${iy + ih / 2}" text-anchor="middle" fill="#8a8478"
           font-size="${Math.max(11, Math.round(Math.min(iw, ih) * 0.07))}" font-family="${SERIF}">Double-click for a photo</text></g>`;
    return `<g data-id="${esc(it.id)}"><defs><clipPath id="${cid}">${clipShape}</clipPath></defs>
      ${back}${photo}${front}</g>`;
  }

  /* -------------------------------------------------------------- stickers */

  function stickerSVG(it) {
    const x = it.x || 0, y = it.y || 0, w = Math.max(10, it.w || 200), h = Math.max(10, it.h || 200);
    const fid = idFor(it, "sh");
    return `<g data-id="${esc(it.id)}"><defs><filter id="${fid}" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="1.5" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".28"/></filter></defs>
      ${it.src ? `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${esc(it.src)}"
        preserveAspectRatio="xMidYMid meet" filter="url(#${fid})"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#eee" stroke="#aaa" stroke-dasharray="6 4"/>`}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  /* --------------------------------------------------------- embellishments
     Each is drawn in its own little box (vw x vh) and stretched to the
     item's size. [style, name, vw, vh, default width, default colour, draw] */
  function starPath(cx, cy, R, r, n) {
    let d = "";
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r : R;
      d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return d + "Z";
  }

  const EMBS = [
    ["ribbon", "Ribbon bow", 120, 80, 180, "#c0392b", (c) => `
      <path d="M60 40C40 10 8 8 10 30s30 22 50 10z" fill="${c}"/><path d="M60 40C80 10 112 8 110 30S80 52 60 40z" fill="${c}"/>
      <path d="M56 44L36 78l12-2 8 4 4-34zM64 44l20 34-12-2-8 4-4-34z" fill="${c}" opacity=".9"/>
      <path d="M60 40C44 18 18 16 18 30" fill="none" stroke="#00000030" stroke-width="2"/>
      <ellipse cx="60" cy="40" rx="9" ry="8" fill="${c}" stroke="#00000035" stroke-width="2"/>`],
    ["twine", "Twine", 220, 40, 260, "#b08d57", (c) => `
      <path d="M4 20C30 6 50 34 76 20s46-14 72 0 46 14 68 0" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
      <path d="M4 22C30 8 50 36 76 22s46-14 72 0 46 14 68 0" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.4" stroke-dasharray="5 4"/>`],
    ["button", "Button", 60, 60, 70, "#e67e22", (c) => `
      <circle cx="30" cy="30" r="28" fill="${c}"/><circle cx="30" cy="30" r="21" fill="none" stroke="#00000030" stroke-width="2"/>
      <g fill="#00000055"><circle cx="24" cy="24" r="3.6"/><circle cx="36" cy="24" r="3.6"/><circle cx="24" cy="36" r="3.6"/><circle cx="36" cy="36" r="3.6"/></g>
      <path d="M14 18A20 20 0 0 1 30 8" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`],
    ["clip", "Paper clip", 40, 110, 46, "#9aa3ad", (c) => `
      <path d="M26 30V88a8 8 0 0 1-16 0V18a12 12 0 0 1 24 0v66" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M26 30V88" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.4"/>`],
    ["pin", "Push pin", 50, 74, 50, "#c0392b", (c) => `
      <path d="M25 44L25 72" stroke="#8d939a" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 40h26l-4-10V14l5-6H11l5 6v16z" fill="${c}"/>
      <path d="M17 10v18" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`],
    ["doily", "Doily", 100, 100, 200, "#ffffff", (c) => {
      let s = "";
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        s += `<circle cx="${(50 + 44 * Math.cos(a)).toFixed(2)}" cy="${(50 + 44 * Math.sin(a)).toFixed(2)}" r="6.4"/>`;
      }
      let holes = "";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        holes += `<circle cx="${(50 + 34 * Math.cos(a)).toFixed(2)}" cy="${(50 + 34 * Math.sin(a)).toFixed(2)}" r="2.6"/>`;
        holes += `<circle cx="${(50 + 22 * Math.cos(a + 0.2)).toFixed(2)}" cy="${(50 + 22 * Math.sin(a + 0.2)).toFixed(2)}" r="2"/>`;
      }
      return `<g fill="${c}" opacity=".95">${s}<circle cx="50" cy="50" r="44"/></g>
        <g fill="#00000022">${holes}</g><circle cx="50" cy="50" r="12" fill="none" stroke="#00000022" stroke-width="1.5"/>`;
    }],
    ["flower", "Pressed flower", 100, 100, 130, "#e8a0bf", (c) => `
      <path d="M50 54C52 70 46 84 40 98" fill="none" stroke="#7c9a5b" stroke-width="2.4"/>
      <g fill="${c}" opacity=".78">${[0, 60, 120, 180, 240, 300].map((a) =>
        `<ellipse cx="50" cy="30" rx="10" ry="19" transform="rotate(${a} 50 46)"/>`).join("")}</g>
      <circle cx="50" cy="46" r="7" fill="#f4d35e"/><circle cx="50" cy="46" r="7" fill="none" stroke="#00000020"/>`],
    ["leaf", "Leaf", 60, 100, 70, "#6a8f4e", (c) => `
      <path d="M30 96C8 70 6 30 30 4c24 26 22 66 0 92z" fill="${c}" opacity=".9"/>
      <path d="M30 96V10M30 30l-10-8M30 30l10-8M30 50l-13-9M30 50l13-9M30 70l-12-8M30 70l12-8" fill="none" stroke="#00000035" stroke-width="1.6"/>`],
    ["glitter", "Glitter", 100, 100, 140, "#d4af37", (c, rnd) => {
      let s = "";
      for (let i = 0; i < 70; i++) {
        const x = 8 + rnd() * 84, y = 8 + rnd() * 84, r = 0.6 + rnd() * 1.8;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`;
      }
      for (let i = 0; i < 6; i++) s += `<path d="${starPath(10 + rnd() * 80, 10 + rnd() * 80, 4 + rnd() * 3, 1, 4)}"/>`;
      return `<g fill="${c}">${s}</g>`;
    }],
    ["sequins", "Sequins", 100, 100, 120, "#7d4fa8", (c, rnd) => {
      let s = "";
      for (let i = 0; i < 14; i++) {
        const x = 12 + rnd() * 76, y = 12 + rnd() * 76, r = 5 + rnd() * 4;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="#00000040"/>
          <path d="M${(x - r * 0.5).toFixed(1)} ${(y - r * 0.3).toFixed(1)}a${(r * 0.6).toFixed(1)} ${(r * 0.6).toFixed(1)} 0 0 1 ${(r * 0.6).toFixed(1)} ${(-r * 0.4).toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.3"/>`;
      }
      return s;
    }],
    ["ticket", "Ticket stub", 180, 80, 220, "#f4d35e", (c) => `
      <path d="M0 6A6 6 0 0 0 6 0h168a6 6 0 0 0 6 6v26a8 8 0 0 0 0 16v26a6 6 0 0 0-6 6H6a6 6 0 0 0-6-6V48a8 8 0 0 0 0-16z" fill="${c}"/>
      <path d="M132 4v72" stroke="#00000045" stroke-width="1.5" stroke-dasharray="4 3"/>
      <rect x="10" y="10" width="114" height="60" fill="none" stroke="#00000035" stroke-width="1.4"/>
      <text x="67" y="47" text-anchor="middle" font-family="${TYPE}" font-weight="700" font-size="17" fill="#00000099">ADMIT ONE</text>
      <text x="156" y="44" text-anchor="middle" font-family="${TYPE}" font-size="11" fill="#00000080" transform="rotate(-90 156 40)">No. 0427</text>`],
    ["tag", "Gift tag", 150, 80, 170, "#d9c3a0", (c) => `
      <path d="M36 4h108a4 4 0 0 1 4 4v64a4 4 0 0 1-4 4H36L4 40z" fill="${c}"/>
      <circle cx="30" cy="40" r="6" fill="#ffffff" stroke="#00000030" stroke-width="2"/>
      <path d="M24 40C14 30 8 12 2 2" fill="none" stroke="#8a6a3e" stroke-width="2"/>
      <path d="M44 14h96M44 66h96" stroke="#00000020" stroke-width="1.2"/>`],
    ["label", "Bracket label", 160, 60, 180, "#ffffff", (c) => `
      <path d="M14 0h132l14 14v32l-14 14H14L0 46V14z" fill="${c}" stroke="#00000035" stroke-width="1.5"/>
      <path d="M17 6h126l11 11v26l-11 11H17L6 43V17z" fill="none" stroke="#00000030" stroke-width="1.2"/>`],
    ["stamp", "Postage stamp", 80, 100, 110, "#2b6cb0", (c) => {
      let holes = "";
      for (let i = 0; i <= 8; i++) holes += `<circle cx="${i * 10}" cy="0" r="3.4"/><circle cx="${i * 10}" cy="100" r="3.4"/>`;
      for (let i = 0; i <= 10; i++) holes += `<circle cx="0" cy="${i * 10}" r="3.4"/><circle cx="80" cy="${i * 10}" r="3.4"/>`;
      return `<mask id="MASK"><rect width="80" height="100" fill="#fff"/><g fill="#000">${holes}</g></mask>
        <rect width="80" height="100" fill="#fbf8f0" mask="url(#MASK)"/>
        <rect x="9" y="9" width="62" height="70" fill="${c}"/>
        <path d="M9 64l18-20 12 12 10-8 22 16v15H9z" fill="#ffffff55"/><circle cx="54" cy="28" r="7" fill="#ffffff88"/>
        <text x="40" y="92" text-anchor="middle" font-family="${SERIF}" font-size="9" fill="#333">POSTAGE</text>`;
    }],
    ["postmark", "Postmark", 130, 80, 160, "#5b6070", (c) => `
      <g fill="none" stroke="${c}" opacity=".75"><circle cx="40" cy="40" r="34" stroke-width="2.5"/><circle cx="40" cy="40" r="25" stroke-width="1.4"/>
      <path d="M78 22c8-6 14 6 22 0s14 6 22 0M78 40c8-6 14 6 22 0s14 6 22 0M78 58c8-6 14 6 22 0s14 6 22 0" stroke-width="2.4"/></g>
      <text x="40" y="44" text-anchor="middle" font-family="${TYPE}" font-size="11" font-weight="700" fill="${c}" opacity=".8">2026</text>`],
    ["heart", "Heart", 100, 90, 110, "#c2185b", (c) => `
      <path d="M50 86C14 60 2 42 2 26A24 24 0 0 1 50 16a24 24 0 0 1 48 10c0 16-12 34-48 60z" fill="${c}"/>
      <path d="M18 24a14 14 0 0 1 14-10" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`],
    ["star", "Star", 100, 100, 110, "#f1c40f", (c) => `
      <path d="${starPath(50, 52, 48, 20, 5)}" fill="${c}" stroke="#00000025" stroke-width="2" stroke-linejoin="round"/>`],
    ["staple", "Staple", 70, 20, 60, "#9aa3ad", (c) => `
      <path d="M4 16V6h62v10" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M6 7h58" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>`],
  ];

  function embSVG(it) {
    const def = EMBS.find((e) => e[0] === it.style) || EMBS[0];
    const [, , vw, vh, , colour, draw] = def;
    const x = it.x || 0, y = it.y || 0, w = Math.max(8, it.w || def[4]), h = Math.max(8, it.h || def[4] * vh / vw);
    const c = esc(it.fill && it.fill !== "none" ? it.fill : colour);
    const art = draw(c, seeded(it.id)).replace(/MASK/g, idFor(it, "mk"));
    return `<g data-id="${esc(it.id)}"><svg x="${x}" y="${y}" width="${w}" height="${h}"
      viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="none" overflow="visible">${art}</svg>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  /* ----------------------------------------------------------------- words */

  const WORDS = [
    ["label", "Label maker", "#1f2430", "MEMORIES"],
    ["typewriter", "Typewriter slip", "#ffffff", "the best day"],
    ["hand", "Handwritten", "#33302b", "Summer 2026"],
    ["letters", "Letter stickers", "#e06666", "FUN"],
    ["banner", "Pennant banner", "#6fa8dc", "HOORAY"],
    ["rubber", "Rubber stamp", "#c0392b", "APPROVED"],
    ["card", "Journal card", "#fbf6ea", "Write about this day…"],
  ];

  /** The size words need, so a title is made to fit its words. */
  function wordSize(style, text, size) {
    const t = String(text || " "), lines = t.split("\n"), n = Math.max(...lines.map((l) => l.length), 1);
    const s = size || 28;
    switch (style) {
      case "letters": return [Math.max(1, t.replace(/\s/g, "").length) * s * 1.5 + (t.split(" ").length - 1) * s * 0.6, s * 1.6];
      case "banner": return [Math.max(1, t.length) * s * 1.35 + s, s * 2.4];
      case "card": return [Math.max(260, Math.min(520, n * s * 0.5)), Math.max(180, lines.length * s * 1.5 + s * 2)];
      case "hand": return [n * s * 0.56 + 10, lines.length * s * 1.3 + 8];
      default: return [n * s * 0.66 + s * 1.2, s * 1.7];
    }
  }

  function wordSVG(it) {
    const style = it.style || "label";
    const def = WORDS.find((d) => d[0] === style) || WORDS[0];
    const c = esc(it.fill && it.fill !== "none" ? it.fill : def[2]);
    const text = String(it.text == null ? def[3] : it.text);
    const x = it.x || 0, y = it.y || 0;
    const [nw, nh] = wordSize(style, text, 28);
    const w = Math.max(20, it.w || nw), h = Math.max(12, it.h || nh);
    /* drawn at its natural size, then stretched to the box -- so the
       resize handle scales the words with their background */
    const sx = w / nw, sy = h / nh, s = 28;
    let art = "";
    switch (style) {
      case "label":
        art = `<rect width="${nw}" height="${nh}" rx="5" fill="${c}"/>
          <text x="${nw / 2}" y="${nh * 0.66}" text-anchor="middle" font-family="${TYPE}" font-weight="700"
            font-size="${s}" letter-spacing="3" fill="#ffffff" fill-opacity=".92">${esc(text.toUpperCase())}</text>`;
        break;
      case "typewriter":
        art = `<rect x="2" y="3" width="${nw - 2}" height="${nh - 2}" fill="#00000022"/>
          <rect width="${nw - 2}" height="${nh - 3}" fill="${c}"/>
          <text x="${s * 0.6}" y="${nh * 0.64}" font-family="${TYPE}" font-size="${s}" fill="#262626">${esc(text)}</text>`;
        break;
      case "hand":
        art = text.split("\n").map((l, i) => `<text x="4" y="${s * (1 + i * 1.3)}" font-family="${HAND}"
          font-style="italic" font-size="${s}" fill="${esc(it.stroke && it.stroke !== "#1f2430" ? it.stroke : def[2])}">${esc(l)}</text>`).join("");
        break;
      case "letters": {
        let cx = s * 0.75;
        for (const ch of text) {
          if (/\s/.test(ch)) { cx += s * 0.6; continue; }
          art += `<circle cx="${cx}" cy="${nh / 2}" r="${s * 0.7}" fill="${c}"/>
            <circle cx="${cx}" cy="${nh / 2}" r="${s * 0.7}" fill="none" stroke="#ffffff" stroke-width="2.5"/>
            <text x="${cx}" y="${nh / 2 + s * 0.34}" text-anchor="middle" font-family="${SERIF}" font-weight="700"
              font-size="${s}" fill="#ffffff">${esc(ch.toUpperCase())}</text>`;
          cx += s * 1.5;
        }
        break;
      }
      case "banner": {
        art = `<path d="M0 ${s * 0.3}Q${nw / 2} ${s * 0.9} ${nw} ${s * 0.3}" fill="none" stroke="#8a6a3e" stroke-width="2"/>`;
        [...text].forEach((ch, i) => {
          const fx = s * 0.5 + i * s * 1.35, t = (fx + s * 0.6) / nw, sag = s * 0.3 + 4 * s * 0.15 * t * (1 - t) * 2;
          art += `<path d="M${fx} ${sag}h${s * 1.2}l${-s * 0.6} ${s * 1.8}z" fill="${c}" ${i % 2 ? 'opacity=".82"' : ""}/>
            ${/\s/.test(ch) ? "" : `<text x="${fx + s * 0.6}" y="${sag + s * 0.85}" text-anchor="middle" font-family="${SERIF}"
              font-weight="700" font-size="${s * 0.8}" fill="#ffffff">${esc(ch.toUpperCase())}</text>`}`;
        });
        break;
      }
      case "rubber":
        art = `<g opacity=".8"><rect x="3" y="3" width="${nw - 6}" height="${nh - 6}" rx="6" fill="none" stroke="${c}" stroke-width="4"/>
          <text x="${nw / 2}" y="${nh * 0.66}" text-anchor="middle" font-family="${TYPE}" font-weight="700"
            font-size="${s}" letter-spacing="2" fill="${c}">${esc(text.toUpperCase())}</text></g>`;
        break;
      case "card": {
        const lines = text.split("\n");
        let rules = "";
        for (let ly = s * 2; ly < nh - 8; ly += s * 1.5) rules += `<line x1="16" y1="${ly + 6}" x2="${nw - 16}" y2="${ly + 6}" stroke="#7aa0c4" stroke-opacity=".45"/>`;
        art = `<rect width="${nw}" height="${nh}" rx="4" fill="${c}" stroke="#00000025"/>
          <rect width="${nw}" height="${s * 0.9}" rx="4" fill="#e06666" fill-opacity=".55"/>${rules}
          ${lines.map((l, i) => `<text x="18" y="${s * 2 + i * s * 1.5}" font-family="${HAND}" font-style="italic"
            font-size="${s * 0.82}" fill="#33302b">${esc(l)}</text>`).join("")}`;
        break;
      }
    }
    return `<g data-id="${esc(it.id)}"><g transform="translate(${x} ${y}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})">${art}</g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  /* --------------------------------------------------------------- papers
     Cam: "The paper will be selectable from different colours and will
     allow each page to have a different type of paper." A paper is a type
     (the texture) in a colour. */
  const PAPERS = [
    ["cardstock", "Cardstock"], ["kraft", "Kraft"], ["linen", "Linen"],
    ["dotted", "Dotted"], ["lined", "Lined"], ["squared", "Squared"],
    ["watercolour", "Watercolour"], ["vintage", "Vintage"], ["cork", "Cork"],
    ["glitter", "Glitter card"],
  ];
  const PAPER_COLOURS = [
    "#f6f1e7", "#ffffff", "#f8e1e4", "#e3eedd", "#dcebf5", "#e8e1f2",
    "#fbf0c9", "#f6d9c4", "#c9a67a", "#9fb8a0", "#2f3a4f", "#26272b",
  ];
  const PAPER_DEFAULT_COLOUR = {kraft: "#c9a67a", cork: "#c19a6b"};

  function paperSVG(kind, colour, w, h) {
    const c = esc(colour || PAPER_DEFAULT_COLOUR[kind] || "#f6f1e7");
    const n = ++serial, pid = `sa-paper${n}`;
    const base = `<rect width="${w}" height="${h}" fill="${c}"/>`;
    const pat = (pw, ph, body) => `<defs><pattern id="${pid}" patternUnits="userSpaceOnUse" width="${pw}" height="${ph}">${body}</pattern></defs>`;
    const over = `<rect width="${w}" height="${h}" fill="url(#${pid})"/>`;
    const noise = (freq, op, id) => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0"/></filter>`;
    switch (kind) {
      case "kraft":
        return `<defs>${noise("0.9", "0.22", `sa-pn${n}`)}</defs>${base}<rect width="${w}" height="${h}" filter="url(#sa-pn${n})"/>`;
      case "linen":
        return base + pat(6, 6, `<path d="M0 .5h6M.5 0v6" stroke="#000" stroke-opacity=".07"/>`) + over;
      case "dotted":
        return base + pat(30, 30, `<circle cx="15" cy="15" r="1.8" fill="#000" fill-opacity=".18"/>`) + over;
      case "lined":
        return base + pat(40, 40, `<path d="M0 39.5h40" stroke="#4a78a8" stroke-opacity=".28"/>`) + over
          + `<path d="M120 0V${h}" stroke="#c0392b" stroke-opacity=".3" stroke-width="2"/>`;
      case "squared":
        return base + pat(32, 32, `<path d="M32 .5H0M.5 0v32" stroke="#4a78a8" stroke-opacity=".2"/>`) + over;
      case "watercolour":
        return `<defs><filter id="sa-wc${n}" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="4" seed="3"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.2 1.05"/></filter>
            ${noise("0.6", "0.08", `sa-pn${n}`)}</defs>${base}
          <rect width="${w}" height="${h}" filter="url(#sa-wc${n})"/><rect width="${w}" height="${h}" filter="url(#sa-pn${n})"/>`;
      case "vintage":
        return `<defs><radialGradient id="sa-vg${n}" cx="50%" cy="50%" r="72%">
            <stop offset="55%" stop-color="#7a5a2a" stop-opacity="0"/><stop offset="100%" stop-color="#7a5a2a" stop-opacity=".38"/></radialGradient>
            ${noise("0.5", "0.12", `sa-pn${n}`)}</defs>${base}
          <rect width="${w}" height="${h}" fill="#c9a66b" fill-opacity=".18"/>
          <rect width="${w}" height="${h}" filter="url(#sa-pn${n})"/><rect width="${w}" height="${h}" fill="url(#sa-vg${n})"/>`;
      case "cork":
        return `<defs><filter id="sa-ck${n}" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="2" seed="11"/>
            <feColorMatrix type="matrix" values="0 0 0 0 .25  0 0 0 0 .15  0 0 0 0 .05  0 0 0 2.2 -1"/></filter></defs>
          ${base}<rect width="${w}" height="${h}" filter="url(#sa-ck${n})"/>`;
      case "glitter":
        return `<defs><filter id="sa-gl${n}" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="5"/>
            <feColorMatrix type="matrix" values="0 0 0 0 .86  0 0 0 0 .72  0 0 0 0 .3  0 0 0 9 -5.5"/></filter>
            <filter id="sa-gw${n}" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves="1" seed="12"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -5.9"/></filter></defs>
          ${base}<rect width="${w}" height="${h}" filter="url(#sa-gl${n})"/><rect width="${w}" height="${h}" filter="url(#sa-gw${n})"/>`;
      default:                                              // cardstock
        return `<defs>${noise("0.8", "0.06", `sa-pn${n}`)}</defs>${base}<rect width="${w}" height="${h}" filter="url(#sa-pn${n})"/>`;
    }
  }

  /* ---------------------------------------------------------------- covers
     Cam: "it will have a cover which the material can be changed from wood,
     fur, colour, metal, ect." */
  const COVERS = [
    ["wood", "Wood", "#8b5a2b"], ["fur", "Fur", "#d8c3a5"], ["colour", "Colour", "#2f7d4f"],
    ["metal", "Metal", "#a9b0b8"], ["leather", "Leather", "#6b3a26"], ["linen", "Linen", "#cdbfa6"],
    ["denim", "Denim", "#3b5b85"], ["velvet", "Velvet", "#6a1b4d"], ["cork", "Cork", "#c19a6b"],
    ["kraft", "Kraft", "#b98f5f"],
  ];
  const COVER_COLOURS = ["#8b5a2b", "#5a3a1e", "#d8c3a5", "#f2efe8", "#2f7d4f", "#2b6cb0",
                         "#6a1b4d", "#c2185b", "#c0392b", "#d98e04", "#a9b0b8", "#c9a14a",
                         "#1f2430", "#3b5b85"];

  /** A cover, as an SVG of its own (w x h). Each drawing gets its own ids,
      so a shelf of covers never shares one cover's grain. */
  /** One material filling w x h (corners rounded by rx): its defs and body,
      and the label plate and ink that suit it. Shared by the scrapbook shelf's
      covers and the Paper creator's notebook covers. */
  function materialParts(key, c, w, h, rx) {
    const n = ++serial, u = (s) => `sm${n}-${s}`;
    let defs = "", body = "", plate = "#fbf6ea", ink = "#33302b";
    const rect = (extra) => `<rect width="${w}" height="${h}" rx="${rx}" ${extra}/>`;
    switch (key) {
      case "wood":
        defs = `<filter id="${u("f")}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="${n % 9 + 1}"/>
          <feColorMatrix type="matrix" values="0 0 0 0 .18  0 0 0 0 .09  0 0 0 0 .02  0 0 0 1.4 -.35"/></filter>`;
        body = rect(`fill="${c}"`) + rect(`filter="url(#${u("f")})"`);
        for (let i = 1; i < 4; i++) body += `<line x1="0" y1="${(h * i) / 4}" x2="${w}" y2="${(h * i) / 4}" stroke="#00000040" stroke-width="2"/>`;
        break;
      case "fur": {
        /* soft clumps of light and shade, fine strands both ways, and a
           fuzzy edge (the whole cover pushed about by noise) */
        const strands = (id, freq, seed, rgb, a, b) => `<filter id="${u(id)}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}"/>
          <feColorMatrix type="matrix" values="0 0 0 0 ${rgb}  0 0 0 0 ${rgb}  0 0 0 0 ${rgb}  ${a} 0 0 0 ${b}"/></filter>`;
        defs = `<filter id="${u("f")}" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4" result="t"/>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="${Math.max(6, w * 0.06)}" xChannelSelector="R" yChannelSelector="G"/></filter>`
          + strands("k", "0.03", 8, 0, 1.3, -0.45) + strands("l", "0.7 0.18", 9, 1, 1.6, -0.62)
          + strands("d", "0.6 0.16", 3, 0, 1.7, -0.7);
        body = `<g filter="url(#${u("f")})">${rect(`fill="${c}"`)}${rect(`filter="url(#${u("k")})"`)}
          ${rect(`filter="url(#${u("d")})"`)}${rect(`filter="url(#${u("l")})"`)}</g>`;
        break;
      }
      case "metal":
        defs = `<linearGradient id="${u("l")}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".45" stop-color="#ffffff" stop-opacity="0"/>
            <stop offset=".6" stop-color="#000000" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity=".3"/></linearGradient>
          <filter id="${u("f")}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.9" numOctaves="2" seed="2"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 -.1"/></filter>`;
        body = rect(`fill="${c}"`) + rect(`filter="url(#${u("f")})"`) + rect(`fill="url(#${u("l")})"`);
        [[0.07, 0.06], [0.93, 0.06], [0.07, 0.94], [0.93, 0.94]].forEach(([fx, fy]) => {
          body += `<circle cx="${w * fx}" cy="${h * fy}" r="${w * 0.018}" fill="#d9dde2" stroke="#00000055"/>`;
        });
        plate = "#d9dde2"; ink = "#2b2f36";
        break;
      case "leather":
        defs = `<filter id="${u("f")}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.09" numOctaves="2" seed="6"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.15"/></filter>`;
        body = rect(`fill="${c}"`) + rect(`filter="url(#${u("f")})"`)
          + `<rect x="${w * 0.04}" y="${w * 0.04}" width="${w * 0.92}" height="${h - w * 0.08}" rx="${w * 0.02}" fill="none"
              stroke="#f2e6cf" stroke-opacity=".7" stroke-width="${Math.max(1.5, w * 0.006)}" stroke-dasharray="${w * 0.02} ${w * 0.014}"/>`;
        break;
      case "linen":
        defs = `<pattern id="${u("p")}" patternUnits="userSpaceOnUse" width="5" height="5">
          <path d="M0 .5h5M.5 0v5" stroke="#000" stroke-opacity=".12"/></pattern>`;
        body = rect(`fill="${c}"`) + rect(`fill="url(#${u("p")})"`);
        break;
      case "denim":
        defs = `<pattern id="${u("p")}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(35)">
          <rect width="3" height="6" fill="#ffffff" fill-opacity=".1"/></pattern>`;
        body = rect(`fill="${c}"`) + rect(`fill="url(#${u("p")})"`)
          + `<rect x="${w * 0.05}" y="${w * 0.05}" width="${w * 0.9}" height="${h - w * 0.1}" fill="none" stroke="#e6a23c"
              stroke-width="${Math.max(1.5, w * 0.007)}" stroke-dasharray="${w * 0.025} ${w * 0.015}"/>`;
        break;
      case "velvet":
        defs = `<radialGradient id="${u("r")}" cx="35%" cy="30%" r="80%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".28"/><stop offset=".6" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity=".35"/></radialGradient>`;
        body = rect(`fill="${c}"`) + rect(`fill="url(#${u("r")})"`);
        break;
      case "cork":
        defs = `<filter id="${u("f")}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="11"/>
          <feColorMatrix type="matrix" values="0 0 0 0 .25  0 0 0 0 .15  0 0 0 0 .05  0 0 0 2.2 -1"/></filter>`;
        body = rect(`fill="${c}"`) + rect(`filter="url(#${u("f")})"`);
        break;
      case "kraft":
        defs = `<filter id="${u("f")}" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .25 0"/></filter>`;
        body = rect(`fill="${c}"`) + rect(`filter="url(#${u("f")})"`)
          /* the band down a scrapbook's kraft cover -- not on a whole page,
             where it would sit on a notebook's fold */
          + (rx ? `<path d="M${w * 0.5} 0V${h}" stroke="#f2e6cf" stroke-opacity=".6" stroke-width="${w * 0.03}"/>` : "");
        break;
      default:                                              // colour: book cloth
        body = rect(`fill="${c}"`);
    }
    return {defs, body, plate, ink};
  }

  /** A material as a whole page's background (square corners, no binding,
      no label) -- a notebook cover printed edge to edge. */
  function materialSVG(material, colour, w, h) {
    const mat = COVERS.find((m) => m[0] === material) || COVERS[0];
    const p = materialParts(mat[0], esc(colour || mat[2]), w, h, 0);
    return `<defs>${p.defs}</defs>${p.body}`;
  }

  function coverSVG(cover, w, h) {
    cover = cover || {};
    const n = ++serial, u = (s) => `sc${n}-${s}`;
    const mat = COVERS.find((m) => m[0] === cover.material) || COVERS[0];
    const c = esc(cover.colour || mat[2]);
    const title = String(cover.title || "");
    const {defs, body, plate, ink} = materialParts(mat[0], c, w, h, w * 0.025);
    /* the binding: a darker strip down the left with two posts */
    const spine = `<rect width="${w * 0.08}" height="${h}" fill="#000000" fill-opacity=".22"/>
      <line x1="${w * 0.08}" y1="0" x2="${w * 0.08}" y2="${h}" stroke="#ffffff" stroke-opacity=".18"/>
      <circle cx="${w * 0.04}" cy="${h * 0.22}" r="${w * 0.014}" fill="#d9dde2" stroke="#00000066"/>
      <circle cx="${w * 0.04}" cy="${h * 0.78}" r="${w * 0.014}" fill="#d9dde2" stroke="#00000066"/>`;
    const fs = Math.max(10, Math.min(w * 0.085, (w * 0.62) / Math.max(4, title.length) * 1.7));
    const label = title ? `<g>
      <rect x="${w * 0.2}" y="${h * 0.36}" width="${w * 0.68}" height="${h * 0.2}" rx="${w * 0.015}" fill="${plate}"
        stroke="#00000040" stroke-width="${Math.max(1, w * 0.004)}"/>
      <rect x="${w * 0.215}" y="${h * 0.36 + w * 0.015}" width="${w * 0.65}" height="${h * 0.2 - w * 0.03}" rx="${w * 0.01}"
        fill="none" stroke="${ink}" stroke-opacity=".35"/>
      <text x="${w * 0.54}" y="${h * 0.46 + fs * 0.35}" text-anchor="middle" font-family="${SERIF}" font-size="${fs.toFixed(1)}"
        fill="${ink}">${esc(title)}</text></g>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <defs>${defs}<clipPath id="${u("c")}"><rect width="${w}" height="${h}" rx="${w * 0.025}"/></clipPath></defs>
      <g clip-path="url(#${u("c")})">${body}${spine}</g>${label}</svg>`;
  }

  /* ---------------------------------------------------- the catalogue
     What the materials panel offers, and what a new piece looks like. */
  function make(kind, style) {
    if (kind === "tape") {
      const t = TAPES.find((x) => x[0] === style) || TAPES[0];
      return {k: "tape", style: t[0], fill: t[2], w: 220, h: 46, rot: -8};
    }
    if (kind === "frame") {
      const f = FRAMES.find((x) => x[0] === style) || FRAMES[0];
      const [w, h] = FRAME_SIZE[f[0]] || [320, 260];
      return {k: "frame", style: f[0], fill: f[2], w, h};
    }
    if (kind === "emb") {
      const e = EMBS.find((x) => x[0] === style) || EMBS[0];
      return {k: "emb", style: e[0], fill: e[5], w: e[4], h: Math.round((e[4] * e[3]) / e[2])};
    }
    if (kind === "clip") {
      const a = SS.ClipArt && SS.ClipArt.find(style);
      if (!a) return null;
      const w = 180;
      return {k: "clip", art: a[0], name: a[1], w, h: Math.round((w * a[4]) / a[3])};
    }
    if (kind === "word") {
      const d = WORDS.find((x) => x[0] === style) || WORDS[0];
      const [w, h] = wordSize(d[0], d[3], 28);
      return {k: "word", style: d[0], fill: d[2], text: d[3], w: Math.round(w), h: Math.round(h)};
    }
    return null;
  }

  const OWN = new Set(["tape", "frame", "sticker", "emb", "word", "clip", "asset"]);

  /* --------------------------------------------------- clip art and assets
     Cam (2026-10-03): "add some graphics like clip art ... lets add a new
     feature called assets". Built-in clip art (ui/assets/clipart.js) is
     drawn in one colour the palette changes; an asset is a picture from the
     Assets library, kept on the page as a copy (like a sticker) so the page
     never loses it -- but without a sticker's drop shadow. */
  function clipSVG(it) {
    const a = SS.ClipArt && SS.ClipArt.find(it.art);
    const x = it.x || 0, y = it.y || 0, w = Math.max(8, it.w || 180), h = Math.max(8, it.h || 180);
    if (!a) {
      return `<g data-id="${esc(it.id)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eee" stroke="#aaa" stroke-dasharray="6 4"/></g>`;
    }
    const c = esc(it.fill && it.fill !== "none" ? it.fill : a[5]);
    return `<g data-id="${esc(it.id)}"><svg x="${x}" y="${y}" width="${w}" height="${h}"
      viewBox="0 0 ${a[3]} ${a[4]}" preserveAspectRatio="xMidYMid meet" overflow="visible">${a[6](c)}</svg>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  function assetSVG(it) {
    const x = it.x || 0, y = it.y || 0, w = Math.max(8, it.w || 200), h = Math.max(8, it.h || 200);
    return `<g data-id="${esc(it.id)}">${it.src ? `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${esc(it.src)}"
        preserveAspectRatio="${it.fit === "fill" ? "none" : it.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eee" stroke="#aaa" stroke-dasharray="6 4"/>`}
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/></g>`;
  }

  function itemSVG(it) {
    switch (it.k) {
      case "tape": return tapeSVG(it);
      case "frame": return frameSVG(it);
      case "sticker": return stickerSVG(it);
      case "emb": return embSVG(it);
      case "word": return wordSVG(it);
      case "clip": return clipSVG(it);
      case "asset": return assetSVG(it);
    }
    return "";
  }

  /* ------------------------------------------------- stickers from photos

     Cam: "stickers (Which i can make from any photo)". A sticker is a photo
     cut to a shape -- or cut out from its background -- with a white
     die-cut border round it, like a real printed sticker.

     The pixel work is plain arrays here, without a canvas, so the cut-out
     can be tested (test_scrapbook.js) as well as used. */

  /** Which pixels are the SUBJECT: everything not joined to the edge of the
      picture by a run of colour close to the background's. The background
      colour is the middle (median) of the edge pixels -- a photo of a cup on
      a table has mostly table round its edge. `tol` is how different from
      that colour still counts as background (0-255). -> Uint8Array, 1 = keep */
  function cutoutMask(px, w, h, tol) {
    const n = w * h, keep = new Uint8Array(n).fill(1);
    const edge = [];
    for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
    for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
    const chan = (k) => edge.map((i) => px[i * 4 + k]).sort((a, b) => a - b)[edge.length >> 1];
    const bg = [chan(0), chan(1), chan(2)];
    const t2 = (tol == null ? 40 : tol) ** 2 * 3;
    const near = (i) => {
      const dr = px[i * 4] - bg[0], dg = px[i * 4 + 1] - bg[1], db = px[i * 4 + 2] - bg[2];
      return px[i * 4 + 3] < 20 || dr * dr + dg * dg + db * db <= t2;
    };
    const stack = [];
    for (const i of edge) if (keep[i] && near(i)) { keep[i] = 0; stack.push(i); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && keep[j] && near(j)) { keep[j] = 0; stack.push(j); }
    }
    return keep;
  }

  /** Small specks left over from the cut-out are dropped: any patch of kept
      pixels smaller than `minArea`. */
  function dropSpecks(mask, w, h, minArea) {
    const seen = new Uint8Array(w * h), out = mask.slice();
    for (let s = 0; s < w * h; s++) {
      if (!mask[s] || seen[s]) continue;
      const patch = [s], stack = [s];
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j >= 0 && mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); patch.push(j); }
        }
      }
      if (patch.length < minArea) for (const i of patch) out[i] = 0;
    }
    return out;
  }

  /** The mask grown outward by `r` pixels (a chamfer distance, two passes)
      -- the white border round a die-cut sticker. */
  function grow(mask, w, h, r) {
    const BIG = 1e9, d = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : BIG;
    const A = 1, B = Math.SQRT2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x > 0) d[i] = Math.min(d[i], d[i - 1] + A);
        if (y > 0) {
          d[i] = Math.min(d[i], d[i - w] + A);
          if (x > 0) d[i] = Math.min(d[i], d[i - w - 1] + B);
          if (x < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + B);
        }
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + A);
        if (y < h - 1) {
          d[i] = Math.min(d[i], d[i + w] + A);
          if (x < w - 1) d[i] = Math.min(d[i], d[i + w + 1] + B);
          if (x > 0) d[i] = Math.min(d[i], d[i + w - 1] + B);
        }
      }
    }
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = d[i] <= r ? 1 : 0;
    return out;
  }

  /** A shape, as a mask over a w x h picture, inset by `pad` so the border
      fits round it. */
  const SHAPES = [["cutout", "Cut out"], ["circle", "Circle"], ["rounded", "Rounded"],
                  ["heart", "Heart"], ["star", "Star"], ["scallop", "Scalloped"], ["square", "As it is"]];
  function shapeMask(shape, w, h, pad) {
    const m = new Uint8Array(w * h);
    const iw = w - pad * 2, ih = h - pad * 2, cx = w / 2, cy = h / 2;
    const star = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * i) / 5 - Math.PI / 2, r = i % 2 ? 0.42 : 1;
      star.push([cx + (iw / 2) * r * Math.cos(a), cy + (ih / 2) * r * Math.sin(a) + ih * 0.04]);
    }
    const inPoly = (x, y, P) => {
      let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        if ((P[i][1] > y) !== (P[j][1] > y)
            && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside;
      }
      return inside;
    };
    const rr = Math.min(iw, ih) * 0.14;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5 - cx) / (iw / 2), v = (y + 0.5 - cy) / (ih / 2);   // -1..1 across the inset box
        let on = false;
        switch (shape) {
          case "circle": on = u * u + v * v <= 1; break;
          case "heart": {
            const X = u * 1.25, Y = -(v * 1.25) + 0.25;
            on = (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
            break;
          }
          case "star": on = inPoly(x + 0.5, y + 0.5, star); break;
          case "scallop": {
            const a = Math.atan2(v, u), r = Math.hypot(u, v);
            on = r <= 0.9 + 0.1 * Math.abs(Math.cos(a * 7));
            break;
          }
          case "rounded": {
            const dx = Math.max(0, Math.abs(x + 0.5 - cx) - (iw / 2 - rr)), dy = Math.max(0, Math.abs(y + 0.5 - cy) - (ih / 2 - rr));
            on = Math.abs(u) <= 1 && Math.abs(v) <= 1 && dx * dx + dy * dy <= rr * rr;
            break;
          }
          default: on = Math.abs(u) <= 1 && Math.abs(v) <= 1;
        }
        m[y * w + x] = on ? 1 : 0;
      }
    }
    return m;
  }

  /** The finished sticker's pixels: the photo where the mask keeps it, the
      white border round it, clear everywhere else. `px` is the photo already
      drawn onto a w x h picture with room for the border. -> {pixels, empty} */
  function stickerPixels(px, w, h, {shape, border, tol}) {
    const pad = Math.max(0, Math.round(border || 0)) + 2;
    let keep = shape === "cutout"
      ? dropSpecks(cutoutMask(px, w, h, tol), w, h, Math.max(12, Math.round(w * h * 0.002)))
      : shapeMask(shape, w, h, pad);
    if (shape === "cutout") {                    // the cut-out never runs into the border's room
      const inset = shapeMask("square", w, h, pad);
      keep = keep.map((v, i) => v & inset[i]);
    }
    const ring = border > 0 ? grow(keep, w, h, border) : keep;
    const out = new Uint8ClampedArray(w * h * 4);
    let kept = 0;
    for (let i = 0; i < w * h; i++) {
      if (keep[i]) {
        out[i * 4] = px[i * 4]; out[i * 4 + 1] = px[i * 4 + 1]; out[i * 4 + 2] = px[i * 4 + 2]; out[i * 4 + 3] = 255;
        kept += 1;
      } else if (ring[i]) {
        out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255; out[i * 4 + 3] = 255;
      }
    }
    return {pixels: out, empty: kept < 20};
  }

  /** A picture (data URL) made smaller -- photos on a page are kept at a
      sensible size, so a scrapbook full of them still saves quickly. A page
      that cannot draw it (no canvas) keeps the original. */
  function shrink(url, max, type) {
    return new Promise((resolve) => {
      const img = new Image();
      const give = (v) => { clearTimeout(timer); resolve(v); };
      const timer = setTimeout(() => give(url), 8000);
      img.onload = () => {
        try {
          const k = Math.min(1, (max || 1400) / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          if (k >= 1 && !type) { give(url); return; }
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          give(c.toDataURL(type || "image/jpeg", 0.88));
        } catch (e) { give(url); }
      };
      img.onerror = () => give(url);
      img.src = url;
    });
  }

  /** Make a sticker from a photo's data URL. -> a PNG data URL, or null if
      the cut-out left nothing (a photo the same colour all over). */
  const ROUND_SHAPES = new Set(["circle", "heart", "star", "scallop"]);

  function makeSticker(url, opts) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const border = Math.max(0, Number(opts.border) || 0);
          const room = border + 4, max = 520;
          /* a circle, heart, star or scallop is cut from the middle square
             of the photo, so it keeps its shape (not squashed to the photo's) */
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
          if (ROUND_SHAPES.has(opts.shape)) {
            const side = Math.min(sw, sh);
            sx = (sw - side) / 2; sy = (sh - side) / 2; sw = sh = side;
          }
          const k = Math.min(1, max / Math.max(sw, sh));
          const iw = Math.max(8, Math.round(sw * k)), ih = Math.max(8, Math.round(sh * k));
          const w = iw + room * 2, h = ih + room * 2;
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, sx, sy, sw, sh, room, room, iw, ih);
          const data = ctx.getImageData(0, 0, w, h);
          if (opts.shape === "cutout") {
            /* the edge of the picture is its own background, not the
               clear room round it -- carried out to the canvas edge */
            const p = data.data;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                if (x >= room && x < room + iw && y >= room && y < room + ih) continue;
                const sx = Math.min(room + iw - 1, Math.max(room, x)), sy = Math.min(room + ih - 1, Math.max(room, y));
                const s = (sy * w + sx) * 4, d = (y * w + x) * 4;
                p[d] = p[s]; p[d + 1] = p[s + 1]; p[d + 2] = p[s + 2]; p[d + 3] = p[s + 3];
              }
            }
          }
          const res = stickerPixels(data.data, w, h, opts);
          if (res.empty) { resolve(null); return; }
          data.data.set(res.pixels);
          ctx.putImageData(data, 0, 0);
          resolve(trimmed(c));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("That photo could not be read."));
      img.src = url;
    });
  }

  /* The sticker cropped to what is in it: no clear margin to grab by mistake. */
  function trimmed(c) {
    const ctx = c.getContext("2d"), {width: w, height: h} = c;
    const p = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (p[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    if (x1 < 0) return c.toDataURL("image/png");
    const o = document.createElement("canvas");
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  }

  SS.ScrapArt = {
    TAPES, FRAMES, EMBS, WORDS, PAPERS, PAPER_COLOURS, COVERS, COVER_COLOURS, SHAPES,
    owns: (k) => OWN.has(k),
    hasPaper: (k) => PAPERS.some((p) => p[0] === k),
    itemSVG, paperSVG, coverSVG, materialSVG, make, wordSize,
    /** A frame's window, where its photo shows: [x, y, w, h]. */
    photoBox: (it) => it && it.k === "frame"
      ? frameInner(it.style || "polaroid", it.x || 0, it.y || 0, Math.max(30, it.w || 300), Math.max(30, it.h || 300))
      : null,
    cutoutMask, dropSpecks, grow, shapeMask, stickerPixels, makeSticker, shrink,
  };
})();
