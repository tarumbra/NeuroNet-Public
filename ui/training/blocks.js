/* ==========================================================================
   CF.Blocks — what colour a training block is, and what it is called.

   Extracted so the main app and Lens agree. It was defined inside app.js,
   which Lens does not load; copying it into the viewer would have meant two
   lists of block colours drifting apart, and a session that looked one way
   in the app and another way in the window beside it.

   The colours themselves are theme variables, so every theme's palette
   applies here without this file knowing any of them.
   ========================================================================== */
window.CF = window.CF || {};

CF.Blocks = (() => {
  "use strict";

  /* Warm-up and cool-down have their own colours rather than a letter's.
     They sit outside the A/B/C cycle deliberately — nothing inside them is
     paired — and their hues are chosen to stay clear of the letters
     actually in use. Same mapping as the Word exporter. */
  const SPECIAL = { W: "warmup", Z: "cooldown" };
  const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

  /** The letter that groups a block: A1 and A2 are both "A". */
  function letterOf(block) {
    const match = String(block || "").trim().toUpperCase().match(/^([A-Z]+)/);
    return match ? match[1][0] : "";
  }

  /** The CSS variable carrying this block's colour. */
  function colourVar(block) {
    const letter = letterOf(block);
    if (!letter) return "var(--block-neutral)";
    if (SPECIAL[letter]) return `var(--block-${SPECIAL[letter]})`;
    const index = (letter.charCodeAt(0) - 65) % LETTERS.length;
    return `var(--block-${LETTERS[index]})`;
  }

  /** What a group of blocks is called on screen. */
  function title(letter) {
    if (letter === "W") return "Warm-up";
    if (letter === "Z") return "Cool-down";
    if (!letter || letter === "?") return "Exercises";
    return `Block ${letter}`;
  }

  /**
   * Group items by their block letter, in the order they appear.
   *
   * Two or more items sharing a letter are performed together — A1 then A2
   * then back to A1 — so the group is marked as alternating. One item alone
   * under a letter is not, and saying so would be wrong.
   */
  function group(items) {
    const out = [];
    for (const item of items || []) {
      const letter = letterOf(item.block) || "?";
      let entry = out.find((g) => g.letter === letter);
      if (!entry) {
        entry = { letter, title: title(letter), items: [] };
        out.push(entry);
      }
      entry.items.push(item);
    }
    for (const entry of out) {
      entry.alternating = entry.items.length > 1
        && entry.letter !== "W" && entry.letter !== "Z" && entry.letter !== "?";
    }
    return out;
  }

  return { colourVar, letterOf, title, group, SPECIAL };
})();
