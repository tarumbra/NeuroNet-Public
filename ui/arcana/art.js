/* NeuroArcana's own art (the art director, 2026-11-01): the card back, the foil booster packs, the guides' portraits and
   the ornaments -- all SVG, drawn here so the game has a look of its own (not Cam's deck art, which is the cards' faces
   for now). The "Gilded Observatory": midnight enamel, antique gold, verdigris and starlight. */
(function (root) {
  "use strict";
  var GOLD = "#e3c27a", GOLD2 = "#a9803a", INK = "#0b0d26";

  // ---- the card back: a night sky in a gilded frame -- a sun and moon eye in an eight-pointed star, moon phases above
  // and below, a ring of the zodiac's twelve marks ----
  function back(id) {
    id = id || "b";
    var ticks = "", phases = "", stars = "";
    for (var i = 0; i < 24; i++) { var a = i * Math.PI / 12, r1 = 52, r2 = i % 2 ? 55 : 58; ticks += '<line x1="' + (80 + r1 * Math.sin(a)).toFixed(1) + '" y1="' + (130 - r1 * Math.cos(a)).toFixed(1) + '" x2="' + (80 + r2 * Math.sin(a)).toFixed(1) + '" y2="' + (130 - r2 * Math.cos(a)).toFixed(1) + '"/>'; }
    [[-30, "M0 -5a5 5 0 1 0 0 10a3.5 5 0 1 1 0-10z"], [-15, "M0 -5a5 5 0 0 0 0 10z"], [0, "M0 -5a5 5 0 1 0 0.01 0z"], [15, "M0 -5a5 5 0 0 1 0 10z"], [30, "M0 -5a5 5 0 1 1 0 10a3.5 5 0 1 0 0-10z"]]
      .forEach(function (p) { phases += '<path transform="translate(' + (80 + p[0]) + ' 34)" d="' + p[1] + '"/><path transform="translate(' + (80 + p[0]) + ' 226) rotate(180)" d="' + p[1] + '"/>'; });
    [[26, 60], [134, 70], [30, 196], [130, 190], [52, 92], [108, 168], [20, 128], [140, 130]].forEach(function (s, k) { stars += '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + (k % 3 ? 0.9 : 1.4) + '"/>'; });
    return '<svg class="aa-backart" viewBox="0 0 160 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>'
      + '<radialGradient id="' + id + 'g" cx="50%" cy="50%" r="65%"><stop offset="0" stop-color="#3b2a7a"/><stop offset=".55" stop-color="#1a1446"/><stop offset="1" stop-color="#0a0b24"/></radialGradient>'
      + '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e0a2"/><stop offset=".5" stop-color="' + GOLD + '"/><stop offset="1" stop-color="' + GOLD2 + '"/></linearGradient></defs>'
      + '<rect width="160" height="260" fill="url(#' + id + 'g)"/>'
      + '<g fill="none" stroke="url(#' + id + 'm)"><rect x="7" y="7" width="146" height="246" rx="8" stroke-width="2"/><rect x="12" y="12" width="136" height="236" rx="5" stroke-width=".7"/>'
      + '<circle cx="80" cy="130" r="58" stroke-width="1"/><circle cx="80" cy="130" r="46" stroke-width=".6" stroke-dasharray="2 3"/><g stroke-width=".8">' + ticks + '</g>'
      + '<path d="M80 72 L89 117 L138 130 L89 143 L80 188 L71 143 L22 130 L71 117Z" stroke-width="1.2"/><path d="M80 92 L86 124 L118 130 L86 136 L80 168 L74 136 L42 130 L74 124Z" stroke-width=".7"/>'
      + '<path d="M18 18 q14 2 16 16 M142 18 q-14 2 -16 16 M18 242 q14 -2 16 -16 M142 242 q-14 -2 -16 -16" stroke-width="1"/></g>'
      + '<circle cx="80" cy="130" r="13" fill="url(#' + id + 'm)"/><path d="M80 119a11 11 0 1 0 0.01 0z" fill="#1a1446" transform="translate(5 0)"/>'
      + '<circle cx="80" cy="130" r="3.2" fill="#fff6d8"/>'
      + '<g fill="url(#' + id + 'm)">' + phases + '</g><g fill="#fff3cf" opacity=".85">' + stars + '</g></svg>';
  }

  // ---- a booster: a crimped foil packet. Starlight is violet-silver; a deck's own takes its colour and its cover ----
  var PACK_TONES = { starlight: ["#c9b6ff", "#7b5cff", "#2c1c78"], starter: ["#ffe2a3", "#d99a3a", "#5a3410"], deck: ["#9fe8d6", "#3a9e8c", "#123a3a"] };
  function pack(kind, title, cover, id) {
    id = id || "p";
    var t = PACK_TONES[kind] || PACK_TONES.starlight, zig = "", zigb = "";
    for (var i = 0; i <= 20; i++) { zig += (i * 10) + "," + (i % 2 ? 6 : 0) + " "; zigb += (200 - i * 10) + "," + (i % 2 ? 314 : 320) + " "; }
    var label = cover
      ? '<clipPath id="' + id + 'c"><circle cx="100" cy="150" r="46"/></clipPath><image href="' + cover + '" x="54" y="90" width="92" height="140" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + 'c)"/><circle cx="100" cy="150" r="46" fill="none" stroke="' + GOLD + '" stroke-width="3"/>'
      : '<g transform="translate(100 150)"><circle r="46" fill="' + INK + '" opacity=".55"/><circle r="46" fill="none" stroke="' + GOLD + '" stroke-width="3"/><path d="M0 -36 L8 -8 L36 0 L8 8 L0 36 L-8 8 L-36 0 L-8 -8Z" fill="' + GOLD + '"/><circle r="6" fill="#fff6d8"/></g>';
    return '<svg class="aa-packart" viewBox="0 0 200 320" aria-hidden="true"><defs>'
      + '<linearGradient id="' + id + 'f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + t[0] + '"/><stop offset=".35" stop-color="' + t[1] + '"/><stop offset=".55" stop-color="' + t[0] + '"/><stop offset=".8" stop-color="' + t[2] + '"/><stop offset="1" stop-color="' + t[1] + '"/></linearGradient>'
      + '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
      + '<polygon points="0,0 ' + zig + '200,0 200,320 ' + zigb + '0,320" fill="url(#' + id + 'f)"/>'
      + '<g opacity=".35" stroke="#fff" stroke-width=".6" fill="none">' + [40, 70, 100, 130, 160].map(function (y) { return '<path d="M0 ' + (y * 2) + ' Q100 ' + (y * 2 - 40) + ' 200 ' + (y * 2) + '"/>'; }).join("") + '</g>'
      + '<rect class="aa-sheen" x="-120" y="0" width="90" height="320" fill="url(#' + id + 's)" transform="skewX(-18)"/>'
      + '<line x1="0" y1="52" x2="200" y2="52" stroke="' + INK + '" stroke-opacity=".35" stroke-dasharray="4 3"/>'
      + '<rect x="18" y="66" width="164" height="230" rx="10" fill="none" stroke="' + GOLD + '" stroke-width="1.5" opacity=".9"/>' + label
      + titleLines(title || "Starlight").map(function (ln, k, all) { return '<text x="100" y="' + (all.length > 1 ? 222 + k * 18 : 228) + '" text-anchor="middle" font-family="Cinzel Decorative, Cinzel, Georgia, serif" font-size="' + (all.length > 1 ? 13 : 15) + '" font-weight="700" fill="#fff8e4" stroke="' + INK + '" stroke-width=".6" paint-order="stroke"' + (ln.length > (all.length > 1 ? 16 : 13) ? ' textLength="152" lengthAdjust="spacingAndGlyphs"' : "") + '>' + esc(ln) + '</text>'; }).join("")
      + '<text x="100" y="' + (titleLines(title || "Starlight").length > 1 ? 266 : 250) + '" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="10" letter-spacing="3" fill="' + GOLD + '">BOOSTER · 5 CARDS</text>'
      + '<text x="100" y="40" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" letter-spacing="2" fill="' + INK + '" opacity=".6">TEAR HERE</text></svg>';
  }
  /** A pack's name in one line, or two when it's long (Cam, 2 Nov: names clipped off the foil), split at the space nearest the middle. */
  function titleLines(t) {
    t = String(t); if (t.length <= 14) return [t];
    var mid = t.length / 2, best = -1;
    for (var i = 0; i < t.length; i++) if (t[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  // ---- the guides: four portraits in gold line on enamel medallions ----
  function medallion(bg, inner) {
    return '<svg class="aa-npcart" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="nm' + bg.slice(1) + '" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="' + bg + '"/><stop offset="1" stop-color="' + INK + '"/></radialGradient></defs>'
      + '<circle cx="60" cy="60" r="57" fill="url(#nm' + bg.slice(1) + ')"/><circle cx="60" cy="60" r="57" fill="none" stroke="' + GOLD + '" stroke-width="3"/><circle cx="60" cy="60" r="51" fill="none" stroke="' + GOLD + '" stroke-width=".8" stroke-dasharray="2 3"/>'
      + '<g fill="none" stroke="' + GOLD + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>';
  }
  var NPC = {
    selene: { name: "Selene", role: "the Seer", art: medallion("#4a2f8f",
      '<path d="M30 104 C32 70 40 46 60 30 C80 46 88 70 90 104"/><path d="M44 104 C46 80 50 64 60 56 C70 64 74 80 76 104"/><path d="M52 66 q8 6 16 0"/><circle cx="54" cy="72" r="1.5" fill="' + GOLD + '"/><circle cx="66" cy="72" r="1.5" fill="' + GOLD + '"/>'
      + '<path d="M60 14 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16z" fill="' + GOLD + '" stroke="none"/><path d="M22 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z M96 30 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="' + GOLD + '" stroke="none"/>') },
    orrin: { name: "Orrin", role: "the Merchant", art: medallion("#7a4a12",
      '<path d="M26 46 h68 M36 46 C38 30 50 24 60 24 C70 24 82 30 84 46"/><path d="M40 46 C40 64 48 76 60 76 C72 76 80 64 80 46"/><path d="M50 60 q4 3 8 0 M62 60 q4 3 8 0"/><path d="M48 70 q12 10 24 0"/>'
      + '<path d="M34 108 C36 90 46 82 60 82 C74 82 84 90 86 108"/><path d="M92 74 v12 M86 86 h12 v16 h-12z"/><circle cx="92" cy="94" r="3" fill="' + GOLD + '" stroke="none"/>') },
    archivist: { name: "The Archivist", role: "keeper of the Combo Book", art: medallion("#1f5c58",
      '<path d="M32 98 C30 62 42 36 60 36 C78 36 90 62 88 98 Z"/><path d="M40 40 l-6 -14 14 8 M80 40 l6 -14 -14 8"/><circle cx="49" cy="58" r="9"/><circle cx="71" cy="58" r="9"/><path d="M58 58 h4"/>'
      + '<circle cx="49" cy="58" r="3" fill="' + GOLD + '" stroke="none"/><circle cx="71" cy="58" r="3" fill="' + GOLD + '" stroke="none"/><path d="M56 70 l4 6 4 -6"/><path d="M44 86 q16 8 32 0 M46 94 q14 6 28 0"/>') },
    vesper: { name: "Vesper", role: "the Duelist", art: medallion("#7a1f34",
      '<path d="M40 34 C42 22 52 18 60 18 C68 18 78 22 80 34 C80 52 72 64 60 64 C48 64 40 52 40 34Z"/><path d="M40 38 h40 M44 38 q6 -8 12 0 M64 38 q6 -8 12 0"/><path d="M60 4 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="' + GOLD + '" stroke="none"/>'
      + '<path d="M30 108 C32 82 44 70 60 70 C76 70 88 82 90 108"/><path d="M22 70 L50 98 M24 62 l-6 6 M98 70 L70 98 M96 62 l6 6"/>') }
  };

  // ---- ornaments ----
  var CORNER = '<svg viewBox="0 0 40 40"><g fill="none" stroke="' + GOLD + '" stroke-width="1.4"><path d="M2 38 V14 Q2 2 14 2 H38"/><path d="M8 38 V18 Q8 8 18 8 H38" stroke-width=".6"/><circle cx="12" cy="12" r="2.4" fill="' + GOLD + '"/><path d="M20 2 q2 6 8 8 M2 20 q6 2 8 8"/></g></svg>';
  var cornerURL = "url(\"data:image/svg+xml," + encodeURIComponent(CORNER.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')) + "\")";
  // a zodiac wheel, faint behind everything
  function wheel() {
    var g = "", glyphs = "♈♉♊♋♌♍♎♏♐♑♒♓";
    for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; g += '<line x1="' + (300 + 220 * Math.sin(a)) + '" y1="' + (300 - 220 * Math.cos(a)) + '" x2="' + (300 + 280 * Math.sin(a)) + '" y2="' + (300 - 280 * Math.cos(a)) + '"/>'
      + '<text x="' + (300 + 250 * Math.sin(a + Math.PI / 12)) + '" y="' + (300 - 250 * Math.cos(a + Math.PI / 12) + 9) + '" text-anchor="middle" font-size="26" fill="' + GOLD + '" stroke="none">' + glyphs[i] + '</text>'; }
    return '<svg viewBox="0 0 600 600" class="aa-wheel" aria-hidden="true"><g fill="none" stroke="' + GOLD + '" stroke-width="1.2"><circle cx="300" cy="300" r="290"/><circle cx="300" cy="300" r="280"/><circle cx="300" cy="300" r="220"/><circle cx="300" cy="300" r="140" stroke-dasharray="3 6"/>'
      + g + '<path d="M300 90 L330 270 L510 300 L330 330 L300 510 L270 330 L90 300 L270 270Z"/></g></svg>';
  }

  root.ArcanaArt = { back: back, pack: pack, NPC: NPC, cornerURL: cornerURL, wheel: wheel };
})(typeof window !== "undefined" ? window : this);
