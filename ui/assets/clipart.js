/* ==========================================================================
   Clip art -- the built-in set, for Assets, the Scrapbook, Boards and the
   Paper creator's covers.

   Cam (2026-10-03): "if you can add some graphics like clip art (At a later
   date i will purchase some digitally and provide it to you to add".

   Every piece here is original line-and-fill art drawn for NeuroNet, in ONE
   colour (c) plus white highlights, so the editor's palette recolours it.
   Bought clip art does not go in this file: it is uploaded into Assets
   (neuronet_data/assets/), which keeps the files as they came.

   [id, name, group, view width, view height, default colour, draw(c)]
   ========================================================================== */
(function () {
  "use strict";
  const SS = window.SS = window.SS || {};

  const GROUPS = ["Nature", "Doodles", "Travel", "Home & hobbies", "Celebrations", "Banners & labels"];

  /* small helpers so the art reads as shapes */
  const ln = (c, w) => `fill="none" stroke="${c}" stroke-width="${w || 4}" stroke-linecap="round" stroke-linejoin="round"`;
  const HI = `fill="#ffffff" fill-opacity=".35"`;
  function star(cx, cy, R, r, n) {
    let d = "";
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r : R;
      d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + "Z";
  }
  function petals(cx, cy, n, len, wid, c, extra) {
    let out = "";
    for (let i = 0; i < n; i++) {
      out += `<ellipse cx="${cx}" cy="${cy - len / 2}" rx="${wid}" ry="${len / 2}" fill="${c}" ${extra || ""}
        transform="rotate(${(360 / n) * i} ${cx} ${cy})"/>`;
    }
    return out;
  }

  const LIST = [
    /* ------------------------------------------------------------ Nature */
    ["leaf", "Leaf", "Nature", 100, 100, "#2f7d4f", (c) => `
      <path d="M18 84C14 44 40 14 86 12c2 46-26 74-68 72z" fill="${c}"/>
      <path d="M20 82C40 60 58 40 78 22M44 58l-14-4M56 44l-6-14M60 46l14 2M46 62l10 8" ${ln("#ffffff", 3)} stroke-opacity=".55"/>`],
    ["sprig", "Fern sprig", "Nature", 100, 100, "#3f8f5a", (c) => `
      <path d="M50 96C50 70 52 40 50 6" ${ln(c, 4)}/>
      ${[16, 30, 44, 58, 72].map((y, i) => {
        const s = 1 - i * 0.12;
        return `<path d="M50 ${y + 8}C${50 - 34 * s} ${y + 6} ${50 - 38 * s} ${y - 6} ${50 - 40 * s} ${y - 10}C${50 - 24 * s} ${y - 8} ${50 - 10 * s} ${y} 50 ${y + 8}z" fill="${c}"/>
          <path d="M50 ${y + 8}C${50 + 34 * s} ${y + 6} ${50 + 38 * s} ${y - 6} ${50 + 40 * s} ${y - 10}C${50 + 24 * s} ${y - 8} ${50 + 10 * s} ${y} 50 ${y + 8}z" fill="${c}"/>`;
      }).reverse().join("")}`],
    ["flower", "Flower", "Nature", 100, 100, "#c2185b", (c) => `
      ${petals(50, 50, 5, 44, 15, c)}
      <circle cx="50" cy="50" r="13" fill="#ffffff" fill-opacity=".85"/><circle cx="50" cy="50" r="8" fill="${c}"/>`],
    ["daisy", "Daisy", "Nature", 100, 100, "#d98e04", (c) => `
      ${petals(50, 50, 12, 46, 7, c, 'fill-opacity=".85"')}
      <circle cx="50" cy="50" r="14" fill="${c}"/><circle cx="46" cy="46" r="5" ${HI}/>`],
    ["tulip", "Tulip", "Nature", 100, 120, "#c0392b", (c) => `
      <path d="M50 116V58" ${ln(c, 4)}/><path d="M50 98C34 96 24 84 22 70c14 2 24 12 28 28zM50 90c12-2 22-12 24-26-12 2-22 12-24 26z" fill="${c}" fill-opacity=".7"/>
      <path d="M28 18c8 6 14 10 22 10s14-4 22-10c4 22 2 40-22 42-24-2-26-20-22-42z" fill="${c}"/>
      <path d="M50 28l-8 30M50 28l8 30" ${ln("#ffffff", 2.5)} stroke-opacity=".45"/>`],
    ["mushroom", "Mushroom", "Nature", 100, 100, "#c0392b", (c) => `
      <path d="M38 56h24l4 34c0 4-4 6-16 6s-16-2-16-6z" fill="${c}" fill-opacity=".45"/>
      <path d="M8 56C8 30 28 12 50 12s42 18 42 44c-10 4-26 6-42 6S18 60 8 56z" fill="${c}"/>
      <circle cx="32" cy="34" r="7" fill="#ffffff"/><circle cx="58" cy="26" r="5" fill="#ffffff"/>
      <circle cx="72" cy="44" r="6" fill="#ffffff"/><circle cx="46" cy="48" r="4" fill="#ffffff"/>`],
    ["pine", "Pine tree", "Nature", 100, 120, "#2f6b45", (c) => `
      <rect x="44" y="96" width="12" height="20" rx="2" fill="${c}" fill-opacity=".6"/>
      <path d="M50 4L22 44h14L14 74h16L6 100h88L70 74h16L64 44h14z" fill="${c}"/>`],
    ["cactus", "Cactus", "Nature", 100, 120, "#3f8f5a", (c) => `
      <path d="M40 112V30a10 10 0 0 1 20 0v82z" fill="${c}"/>
      <path d="M40 74H28a10 10 0 0 1-10-10V46a6 6 0 0 1 12 0v16h10zM60 62h12V36a6 6 0 0 1 12 0v26a12 12 0 0 1-12 12H60z" fill="${c}"/>
      <path d="M50 28v76M24 50v10M78 42v14" ${ln("#ffffff", 2)} stroke-opacity=".4"/>
      <rect x="26" y="104" width="48" height="12" rx="3" fill="${c}" fill-opacity=".55"/>`],
    ["sun", "Sun", "Nature", 100, 100, "#f1a90f", (c) => `
      <circle cx="50" cy="50" r="22" fill="${c}"/>
      ${Array.from({length: 12}, (_, i) => `<path d="M50 6v14" ${ln(c, 5)} transform="rotate(${i * 30} 50 50)"/>`).join("")}
      <circle cx="43" cy="43" r="7" ${HI}/>`],
    ["moon", "Moon", "Nature", 100, 100, "#c9a14a", (c) => `
      <path d="M62 8A44 44 0 1 0 92 70 36 36 0 0 1 62 8z" fill="${c}"/>
      <circle cx="34" cy="56" r="6" fill="#ffffff" fill-opacity=".25"/><circle cx="46" cy="76" r="4" fill="#ffffff" fill-opacity=".25"/>
      <path d="${star(80, 22, 8, 3, 4)}" fill="${c}"/>`],
    ["cloud", "Cloud", "Nature", 120, 80, "#7aa7d6", (c) => `
      <path d="M28 70a20 20 0 0 1-2-40 26 26 0 0 1 48-10 20 20 0 0 1 30 14 18 18 0 0 1-4 36z" fill="${c}"/>
      <path d="M30 44a14 14 0 0 1 14-10" ${ln("#ffffff", 4)} stroke-opacity=".5"/>`],
    ["raindrop", "Raindrop", "Nature", 80, 100, "#3498db", (c) => `
      <path d="M40 6C28 30 12 46 12 64a28 28 0 0 0 56 0C68 46 52 30 40 6z" fill="${c}"/>
      <path d="M26 66a14 14 0 0 0 10 14" ${ln("#ffffff", 4)} stroke-opacity=".55"/>`],
    ["mountains", "Mountains", "Nature", 140, 90, "#5b6f8a", (c) => `
      <path d="M4 86L48 18l22 32 14-18 52 54z" fill="${c}"/>
      <path d="M48 18l-12 18 8-2 6 6 6-6 6 6zM84 32l-8 10 6-1 4 4 4-4 5 3z" fill="#ffffff" fill-opacity=".85"/>`],
    ["wave", "Wave", "Nature", 140, 70, "#2b6cb0", (c) => `
      <path d="M4 60c18 0 22-12 34-26 16-18 42-18 52 2-12-6-26 0-26 14 0 12 14 18 26 12 14-6 20-16 46-14v20H4z" fill="${c}"/>
      <path d="M70 36c4-8 14-12 22-8" ${ln("#ffffff", 3)} stroke-opacity=".6"/>`],
    ["feather", "Feather", "Nature", 100, 120, "#8d6e63", (c) => `
      <path d="M78 6C40 14 20 50 26 94l8-6c4-30 18-56 44-82z" fill="${c}"/>
      <path d="M78 6c4 40-14 72-44 82l-8 6C40 60 56 30 78 6z" fill="${c}" fill-opacity=".7"/>
      <path d="M18 116L78 6" ${ln(c, 3)}/><path d="M44 56l-10-4M52 42l-10-6M38 72l-8-2M58 36l8 2M50 56l10 2" ${ln("#ffffff", 2)} stroke-opacity=".5"/>`],
    ["butterfly", "Butterfly", "Nature", 120, 100, "#7d4fa8", (c) => `
      <path d="M58 46C46 18 18 6 10 18s8 34 48 32zM62 46c12-28 40-40 48-28s-8 34-48 32z" fill="${c}"/>
      <path d="M58 52C40 54 20 66 26 82s26 4 32-22zM62 52c18 2 38 14 32 30s-26 4-32-22z" fill="${c}" fill-opacity=".75"/>
      <rect x="57" y="34" width="6" height="44" rx="3" fill="${c}"/>
      <path d="M58 36c-4-10-10-16-16-18M62 36c4-10 10-16 16-18" ${ln(c, 2.5)}/>
      <circle cx="28" cy="24" r="5" ${HI}/><circle cx="92" cy="24" r="5" ${HI}/>`],
    ["paw", "Paw print", "Nature", 100, 100, "#5b4636", (c) => `
      <path d="M50 52c16 0 30 16 30 28 0 10-8 14-16 12-6-2-10-4-14-4s-8 2-14 4c-8 2-16-2-16-12 0-12 14-28 30-28z" fill="${c}"/>
      <ellipse cx="24" cy="42" rx="9" ry="12" transform="rotate(-20 24 42)" fill="${c}"/>
      <ellipse cx="40" cy="22" rx="9" ry="13" transform="rotate(-6 40 22)" fill="${c}"/>
      <ellipse cx="60" cy="22" rx="9" ry="13" transform="rotate(6 60 22)" fill="${c}"/>
      <ellipse cx="76" cy="42" rx="9" ry="12" transform="rotate(20 76 42)" fill="${c}"/>`],
    ["bird", "Bird", "Nature", 120, 90, "#2b6cb0", (c) => `
      <path d="M20 50c0-18 16-30 34-28 10 1 16 6 22 12l18-4-12 12c4 22-12 40-36 40-14 0-24-6-30-14L4 72l16-10c-2-4 0-8 0-12z" fill="${c}"/>
      <path d="M40 46c10-2 22 2 30 12-12 4-24 2-30-12z" fill="#ffffff" fill-opacity=".35"/>
      <circle cx="70" cy="34" r="3.5" fill="#ffffff"/>`],

    /* ----------------------------------------------------------- Doodles */
    ["sparkle", "Sparkle", "Doodles", 100, 100, "#f1c40f", (c) => `
      <path d="M50 4C54 36 64 46 96 50 64 54 54 64 50 96 46 64 36 54 4 50 36 46 46 36 50 4z" fill="${c}"/>
      <path d="M84 10c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="${c}"/>`],
    ["star", "Star", "Doodles", 100, 100, "#f1c40f", (c) => `
      <path d="${star(50, 53, 46, 19, 5)}" fill="${c}" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M38 40l10-20" ${ln("#ffffff", 4)} stroke-opacity=".45"/>`],
    ["heart", "Heart", "Doodles", 100, 90, "#c2185b", (c) => `
      <path d="M50 86C14 60 4 42 4 26A23 23 0 0 1 50 16a23 23 0 0 1 46 10c0 16-10 34-46 60z" fill="${c}"/>
      <path d="M18 26a12 12 0 0 1 12-12" ${ln("#ffffff", 5)} stroke-opacity=".5"/>`],
    ["heart-line", "Heart outline", "Doodles", 100, 90, "#c2185b", (c) => `
      <path d="M50 82C18 58 8 42 8 27A20 20 0 0 1 50 18a20 20 0 0 1 42 9c0 15-10 31-42 55z" ${ln(c, 5)}/>
      <path d="M50 74C26 56 18 44 18 32" ${ln(c, 2)} stroke-dasharray="4 5"/>`],
    ["arrow-curly", "Curly arrow", "Doodles", 140, 80, "#1f2430", (c) => `
      <path d="M6 60c20 4 30-6 30-18s-14-16-18-6 8 22 30 22c26 0 48-14 76-34" ${ln(c, 4)}/>
      <path d="M108 20l18 4-6 18" ${ln(c, 4)}/>`],
    ["swirl", "Swirl", "Doodles", 100, 100, "#7d4fa8", (c) => `
      <path d="M52 52c0-6-8-8-12-4-6 6 0 16 10 16 12 0 20-12 16-24-6-16-28-20-40-6-14 16-6 44 20 46 26 2 44-22 38-46" ${ln(c, 5)}/>`],
    ["burst", "Burst", "Doodles", 100, 100, "#e67e22", (c) => `
      <path d="${star(50, 50, 48, 34, 14)}" fill="${c}"/>
      <circle cx="50" cy="50" r="24" fill="#ffffff" fill-opacity=".9"/>`],
    ["bolt", "Lightning", "Doodles", 80, 110, "#f1c40f", (c) => `
      <path d="M50 4L10 64h26l-8 42 44-62H46z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`],
    ["check", "Tick", "Doodles", 100, 90, "#27ae60", (c) => `
      <path d="M8 50l26 28L92 10" ${ln(c, 12)}/>`],
    ["bubble", "Speech bubble", "Doodles", 120, 100, "#2b6cb0", (c) => `
      <path d="M14 8h92a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8H48L24 96l6-20H14a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" ${ln(c, 5)}/>`],
    ["scribble", "Underline", "Doodles", 160, 40, "#c0392b", (c) => `
      <path d="M6 22c20-10 40 6 60-2s34-10 52-2 24 6 36-2M14 32c30-6 60 2 90-2s30-4 46-2" ${ln(c, 4)}/>`],
    ["circle-doodle", "Circled", "Doodles", 140, 100, "#c0392b", (c) => `
      <path d="M96 14C70 2 22 8 10 40c-10 28 26 50 64 48 38-2 62-24 56-48-4-20-32-30-64-28" ${ln(c, 4)}/>`],

    /* ------------------------------------------------------------ Travel */
    ["plane", "Paper plane", "Travel", 120, 90, "#2b6cb0", (c) => `
      <path d="M4 42L116 4 84 84 58 58z" fill="${c}"/>
      <path d="M116 4L58 58l-6 26 20-18" fill="${c}" fill-opacity=".6"/>
      <path d="M116 4L58 58" ${ln("#ffffff", 2)} stroke-opacity=".6"/>`],
    ["compass", "Compass", "Travel", 100, 100, "#8d6e63", (c) => `
      <circle cx="50" cy="50" r="44" ${ln(c, 4)}/><circle cx="50" cy="50" r="36" ${ln(c, 1.5)}/>
      <path d="M50 10l9 40-9 40-9-40z" fill="${c}"/><path d="M10 50l40-9 40 9-40 9z" fill="${c}" fill-opacity=".55"/>
      <path d="M50 10l9 40H41z" fill="#ffffff" fill-opacity=".35"/><circle cx="50" cy="50" r="5" fill="#ffffff"/>`],
    ["anchor", "Anchor", "Travel", 100, 110, "#1f3a5f", (c) => `
      <circle cx="50" cy="14" r="9" ${ln(c, 5)}/><path d="M50 23v80M30 40h40" ${ln(c, 6)}/>
      <path d="M12 66c4 22 20 36 38 36s34-14 38-36" ${ln(c, 6)}/><path d="M4 70l10-12 10 12M76 70l10-12 10 12" ${ln(c, 5)}/>`],
    ["balloon-air", "Hot-air balloon", "Travel", 100, 120, "#c0392b", (c) => `
      <path d="M50 4C24 4 8 22 8 44c0 22 22 38 30 52h24c8-14 30-30 30-52C92 22 76 4 50 4z" fill="${c}"/>
      <path d="M50 4c-12 0-20 18-20 40s6 38 8 52M50 4c12 0 20 18 20 40s-6 38-8 52" ${ln("#ffffff", 2.5)} stroke-opacity=".55"/>
      <path d="M38 96l2 10M62 96l-2 10" ${ln(c, 2)}/><rect x="38" y="104" width="24" height="14" rx="3" fill="${c}" fill-opacity=".7"/>`],
    ["camera", "Camera", "Travel", 120, 90, "#1f2430", (c) => `
      <path d="M14 22h22l8-12h32l8 12h22a8 8 0 0 1 8 8v46a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" fill="${c}"/>
      <circle cx="60" cy="52" r="22" fill="#ffffff" fill-opacity=".9"/><circle cx="60" cy="52" r="15" fill="${c}"/>
      <circle cx="54" cy="46" r="5" ${HI}/><rect x="16" y="30" width="14" height="7" rx="2" fill="#ffffff" fill-opacity=".6"/>`],
    ["pin", "Map pin", "Travel", 80, 110, "#c0392b", (c) => `
      <path d="M40 106C26 80 6 62 6 40a34 34 0 0 1 68 0c0 22-20 40-34 66z" fill="${c}"/>
      <circle cx="40" cy="40" r="13" fill="#ffffff"/>`],
    ["suitcase", "Suitcase", "Travel", 110, 100, "#8d6e63", (c) => `
      <path d="M40 22V12a6 6 0 0 1 6-6h18a6 6 0 0 1 6 6v10" ${ln(c, 5)}/>
      <rect x="6" y="22" width="98" height="70" rx="8" fill="${c}"/>
      <path d="M30 22v70M80 22v70" ${ln("#ffffff", 4)} stroke-opacity=".45"/>
      <rect x="6" y="50" width="98" height="6" fill="#000000" fill-opacity=".15"/>`],
    ["ticket", "Ticket", "Travel", 140, 70, "#d98e04", (c) => `
      <path d="M6 8h128v18a9 9 0 0 0 0 18v18H6V44a9 9 0 0 0 0-18z" fill="${c}"/>
      <path d="M100 10v50" ${ln("#ffffff", 2.5)} stroke-dasharray="4 5" stroke-opacity=".8"/>
      <path d="M22 26h60M22 36h44M22 46h52" ${ln("#ffffff", 3)} stroke-opacity=".6"/>`],

    /* ---------------------------------------------------- Home & hobbies */
    ["cup", "Coffee cup", "Home & hobbies", 110, 100, "#6b3a26", (c) => `
      <path d="M12 36h70v28a26 26 0 0 1-26 26H38a26 26 0 0 1-26-26z" fill="${c}"/>
      <path d="M82 44h6a12 12 0 0 1 0 24h-8" ${ln(c, 6)}/>
      <path d="M34 26c-6-8 6-12 0-20M50 26c-6-8 6-12 0-20M66 26c-6-8 6-12 0-20" ${ln(c, 3.5)}/>
      <path d="M22 50c0 12 6 22 16 26" ${ln("#ffffff", 4)} stroke-opacity=".4"/>`],
    ["teapot", "Teapot", "Home & hobbies", 120, 100, "#2f7d4f", (c) => `
      <path d="M26 40h60c6 8 8 18 8 26 0 18-14 28-38 28S18 84 18 66c0-8 2-18 8-26z" fill="${c}"/>
      <path d="M94 54c10-2 16-12 20-22-10 0-16 6-20 12M22 52c-14-4-16 14-4 20" ${ln(c, 6)}/>
      <path d="M38 40c0-10 8-16 18-16s18 6 18 16" fill="${c}" fill-opacity=".7"/><circle cx="56" cy="20" r="5" fill="${c}"/>
      <path d="M32 58c0 10 6 18 14 22" ${ln("#ffffff", 4)} stroke-opacity=".4"/>`],
    ["book", "Open book", "Home & hobbies", 130, 90, "#2b6cb0", (c) => `
      <path d="M65 20C50 10 28 8 6 12v66c22-4 44-2 59 8 15-10 37-12 59-8V12c-22-4-44-2-59 8z" fill="${c}"/>
      <path d="M65 20v66" ${ln("#ffffff", 2)} stroke-opacity=".7"/>
      <path d="M18 30c12-2 26 0 36 4M18 44c12-2 26 0 36 4M18 58c12-2 26 0 36 4M76 34c10-4 24-6 36-4M76 48c10-4 24-6 36-4M76 62c10-4 24-6 36-4" ${ln("#ffffff", 2.5)} stroke-opacity=".5"/>`],
    ["pencil", "Pencil", "Home & hobbies", 140, 50, "#d98e04", (c) => `
      <path d="M24 10h96a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H24L4 25z" fill="${c}"/>
      <path d="M24 10L4 25l20 15z" fill="#f2d7a8"/><path d="M4 25l7-5v10z" fill="#33302b"/>
      <path d="M112 10v30" ${ln("#ffffff", 3)} stroke-opacity=".6"/><path d="M28 25h80" ${ln("#ffffff", 2)} stroke-opacity=".35"/>`],
    ["envelope", "Envelope", "Home & hobbies", 120, 84, "#c0392b", (c) => `
      <rect x="6" y="8" width="108" height="70" rx="6" fill="${c}"/>
      <path d="M8 12l52 38 52-38" ${ln("#ffffff", 4)} stroke-opacity=".7"/>
      <path d="M8 76l38-30M112 76L74 46" ${ln("#ffffff", 2.5)} stroke-opacity=".4"/>`],
    ["key", "Key", "Home & hobbies", 130, 60, "#c9a14a", (c) => `
      <circle cx="28" cy="30" r="22" fill="${c}"/><circle cx="28" cy="30" r="9" fill="#ffffff"/>
      <path d="M48 26h76v10h-10v12h-10V36H92v8H82v-8H48z" fill="${c}"/>`],
    ["bulb", "Light bulb", "Home & hobbies", 90, 120, "#f1c40f", (c) => `
      <path d="M45 6a34 34 0 0 0-20 62c4 4 6 10 6 16h28c0-6 2-12 6-16A34 34 0 0 0 45 6z" fill="${c}"/>
      <rect x="30" y="88" width="30" height="8" rx="2" fill="${c}" fill-opacity=".7"/><rect x="32" y="99" width="26" height="8" rx="2" fill="${c}" fill-opacity=".7"/>
      <path d="M38 110h14" ${ln(c, 5)}/><path d="M28 34a18 18 0 0 1 14-14" ${ln("#ffffff", 5)} stroke-opacity=".55"/>`],
    ["note-music", "Music notes", "Home & hobbies", 100, 100, "#1f2430", (c) => `
      <path d="M36 74V18l52-10v56" ${ln(c, 5)}/><path d="M36 30l52-10" ${ln(c, 9)}/>
      <ellipse cx="26" cy="76" rx="13" ry="10" transform="rotate(-20 26 76)" fill="${c}"/>
      <ellipse cx="78" cy="66" rx="13" ry="10" transform="rotate(-20 78 66)" fill="${c}"/>`],
    ["house", "House", "Home & hobbies", 100, 100, "#c0392b", (c) => `
      <path d="M50 8L6 46h12v46h64V46h12z" fill="${c}"/><rect x="64" y="14" width="10" height="20" fill="${c}"/>
      <rect x="40" y="62" width="20" height="30" rx="2" fill="#ffffff" fill-opacity=".85"/>
      <rect x="24" y="52" width="12" height="12" fill="#ffffff" fill-opacity=".7"/><rect x="64" y="52" width="12" height="12" fill="#ffffff" fill-opacity=".7"/>`],
    ["plant", "Pot plant", "Home & hobbies", 100, 120, "#2f7d4f", (c) => `
      <path d="M50 70C48 50 34 36 14 34c2 20 16 34 36 36zM50 70c2-26 16-46 38-52 0 26-14 46-38 52zM50 70c-4-20-2-40 6-58 8 18 6 38-6 58z" fill="${c}"/>
      <path d="M26 72h48l-6 42H32z" fill="${c}" fill-opacity=".65"/><rect x="22" y="68" width="56" height="10" rx="3" fill="${c}"/>`],
    ["scissors", "Scissors", "Home & hobbies", 120, 90, "#5b6070", (c) => `
      <circle cx="22" cy="24" r="14" ${ln(c, 6)}/><circle cx="22" cy="66" r="14" ${ln(c, 6)}/>
      <path d="M34 30l80 38M34 60l80-38" ${ln(c, 7)}/><circle cx="62" cy="45" r="3.5" fill="#ffffff"/>`],

    /* ------------------------------------------------------ Celebrations */
    ["balloon", "Balloon", "Celebrations", 80, 120, "#c2185b", (c) => `
      <path d="M40 4C20 4 8 20 8 38c0 22 18 40 32 44 14-4 32-22 32-44C72 20 60 4 40 4z" fill="${c}"/>
      <path d="M34 82h12l-6 8z" fill="${c}"/><path d="M40 90c-8 8 8 14 0 22s4 8 0 8" ${ln(c, 2)}/>
      <path d="M22 30a16 16 0 0 1 10-14" ${ln("#ffffff", 5)} stroke-opacity=".55"/>`],
    ["gift", "Gift", "Celebrations", 100, 100, "#c0392b", (c) => `
      <rect x="10" y="40" width="80" height="54" rx="4" fill="${c}"/><rect x="4" y="28" width="92" height="16" rx="3" fill="${c}"/>
      <rect x="44" y="28" width="12" height="66" fill="#ffffff" fill-opacity=".75"/>
      <path d="M50 28C40 8 20 8 24 20s18 8 26 8zM50 28c10-20 30-20 26-8s-18 8-26 8z" ${ln(c, 5)}/>`],
    ["crown", "Crown", "Celebrations", 120, 90, "#c9a14a", (c) => `
      <path d="M10 76L4 22l30 24L60 8l26 38 30-24-6 54z" fill="${c}"/>
      <rect x="10" y="74" width="100" height="12" rx="3" fill="${c}"/>
      <circle cx="60" cy="52" r="7" fill="#ffffff" fill-opacity=".8"/><circle cx="32" cy="58" r="5" fill="#ffffff" fill-opacity=".6"/><circle cx="88" cy="58" r="5" fill="#ffffff" fill-opacity=".6"/>`],
    ["cake", "Cake", "Celebrations", 100, 110, "#c2185b", (c) => `
      <rect x="12" y="58" width="76" height="44" rx="6" fill="${c}"/>
      <path d="M12 70c8 8 12-6 19 2s12-6 19 2 12-6 19 2 12-6 19 0" ${ln("#ffffff", 5)} stroke-opacity=".85"/>
      <rect x="22" y="36" width="56" height="24" rx="5" fill="${c}" fill-opacity=".75"/>
      <path d="M50 34V20" ${ln(c, 4)}/><path d="M50 4c-6 6-6 12 0 14 6-2 6-8 0-14z" fill="${c}"/>`],
    ["bunting", "Bunting", "Celebrations", 160, 70, "#c0392b", (c) => `
      <path d="M4 10c50 16 102 16 152 0" ${ln(c, 2.5)}/>
      ${[[12, 14, 1], [44, 20, 0.6], [76, 22, 1], [108, 20, 0.6], [140, 14, 1]].map(([x, y, o]) =>
        `<path d="M${x - 12} ${y - 2}h24L${x} ${y + 34}z" fill="${c}" fill-opacity="${o}"/>`).join("")}`],
    ["confetti", "Confetti", "Celebrations", 100, 100, "#7d4fa8", (c) => `
      ${[[14, 18, 20], [40, 10, -30], [70, 20, 50], [86, 46, -10], [24, 48, 70], [52, 40, 10], [12, 78, -40], [44, 72, 30], [76, 76, -60], [62, 92, 15]]
        .map(([x, y, r], i) => i % 3 === 0 ? `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}"/>`
          : `<rect x="${x - 7}" y="${y - 3}" width="14" height="6" rx="2" fill="${c}" fill-opacity="${i % 2 ? 0.6 : 1}" transform="rotate(${r} ${x} ${y})"/>`).join("")}`],

    /* -------------------------------------------------- Banners & labels */
    ["banner", "Ribbon banner", "Banners & labels", 180, 70, "#c0392b", (c) => `
      <path d="M4 26h30v36H4l10-18z" fill="${c}" fill-opacity=".7"/><path d="M176 26h-30v36h30l-10-18z" fill="${c}" fill-opacity=".7"/>
      <path d="M24 18h20v44l-20-8zM156 18h-20v44l20-8z" fill="#000000" fill-opacity=".25"/>
      <rect x="24" y="8" width="132" height="46" rx="3" fill="${c}"/>`],
    ["tag", "Gift tag", "Banners & labels", 140, 80, "#c9a67a", (c) => `
      <path d="M34 6h98a6 6 0 0 1 6 6v56a6 6 0 0 1-6 6H34L4 40z" fill="${c}"/>
      <circle cx="30" cy="40" r="7" fill="#ffffff"/><path d="M30 40C14 30 6 52-4 50" ${ln("#8d6e63", 2.5)}/>`],
    ["label", "Label", "Banners & labels", 160, 80, "#2f3a4f", (c) => `
      <path d="M20 4h120a16 16 0 0 0 16 16v40a16 16 0 0 0-16 16H20A16 16 0 0 0 4 60V20A16 16 0 0 0 20 4z" fill="${c}"/>
      <path d="M24 12h112a12 12 0 0 0 12 12v32a12 12 0 0 0-12 12H24a12 12 0 0 0-12-12V24a12 12 0 0 0 12-12z" ${ln("#ffffff", 2)} stroke-opacity=".7"/>`],
    ["laurel", "Laurel wreath", "Banners & labels", 120, 110, "#2f7d4f", (c) => {
      /* the left stem is a curve; leaves sit ON it in pairs, pointing along
         it, and the right half is the left mirrored */
      const P = [[56, 100], [22, 94], [10, 58], [26, 16]];
      const at = (t) => {
        const u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        const d = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
        const x = k.reduce((s, v, i) => s + v * P[i][0], 0), y = k.reduce((s, v, i) => s + v * P[i][1], 0);
        const dx = d.reduce((s, v, i) => s + v * P[i][0], 0), dy = d.reduce((s, v, i) => s + v * P[i][1], 0);
        return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
      };
      let half = `<path d="M${P[0]}C${P[1]} ${P[2]} ${P[3]}" ${ln(c, 3)}/>`;
      for (let i = 0; i < 6; i++) {
        const [x, y, ang] = at(0.16 + i * 0.16);
        for (const side of [-1, 1]) {
          const r = ang + 90 + side * 38;         // each leaf leans off the stem
          half += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5" ry="11" fill="${c}"
            transform="rotate(${r.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)}) translate(0 -9)"/>`;
        }
      }
      half += `<ellipse cx="${P[3][0]}" cy="${P[3][1]}" rx="5" ry="11" fill="${c}" transform="rotate(20 ${P[3][0]} ${P[3][1]}) translate(0 -6)"/>`;
      return `<g>${half}</g><g transform="translate(120 0) scale(-1 1)">${half}</g>`;
    }],
    ["corner", "Corner flourish", "Banners & labels", 100, 100, "#1f2430", (c) => `
      <path d="M6 94V30C6 16 16 6 30 6h64" ${ln(c, 3)}/><path d="M14 94V38c0-14 10-24 24-24h56" ${ln(c, 1.5)}/>
      <path d="M30 40c10 0 14 8 10 14s-14 4-14-4 10-14 22-10c14 4 16 24 4 30" ${ln(c, 2.5)}/>
      <circle cx="6" cy="94" r="4" fill="${c}"/><circle cx="94" cy="6" r="4" fill="${c}"/>`],
    ["divider", "Divider", "Banners & labels", 200, 30, "#1f2430", (c) => `
      <path d="M6 15h74M120 15h74" ${ln(c, 2)}/>
      <path d="M100 4l10 11-10 11-10-11z" fill="${c}"/><circle cx="84" cy="15" r="3" fill="${c}"/><circle cx="116" cy="15" r="3" fill="${c}"/>`],
    ["frame-oval", "Oval frame", "Banners & labels", 100, 120, "#8d6e63", (c) => `
      <ellipse cx="50" cy="60" rx="44" ry="54" ${ln(c, 5)}/><ellipse cx="50" cy="60" rx="37" ry="47" ${ln(c, 1.5)}/>
      ${Array.from({length: 16}, (_, i) => {
        const a = (Math.PI * 2 * i) / 16;
        return `<circle cx="${(50 + 44 * Math.cos(a)).toFixed(1)}" cy="${(60 + 54 * Math.sin(a)).toFixed(1)}" r="3" fill="${c}"/>`;
      }).join("")}`],
  ];

  const BY_ID = new Map(LIST.map((a) => [a[0], a]));

  /** One piece on its own, as an SVG (for buttons and the Assets page). */
  function svg(id, colour, size) {
    const a = BY_ID.get(id);
    if (!a) return "";
    const s = size || 64;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a[3]} ${a[4]}" width="${s}" height="${s}"
      preserveAspectRatio="xMidYMid meet" aria-hidden="true">${a[6](colour || a[5])}</svg>`;
  }

  SS.ClipArt = {
    LIST, GROUPS,
    find: (id) => BY_ID.get(id) || null,
    svg,
  };
})();
