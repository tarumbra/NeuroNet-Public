/* The Library (Cam, 2 Nov 2026: "Lore should also be hidden in the game when you beat certain keepers, battles, reach stat
   milestones ... think of lore like cartomancy history, tarot history ... a Library tab ... the books unlocked are shown as
   covers on a shelf, ones undiscovered will have a question mark ... a Major Arcana book ... beat the keepers to collect
   their pages ... a minor arcana [book] ... a wide variety of ways to unlock the pages ... so it is a surprise ... a full
   deep lore rich story for our deck ... present all lore in that new conversational manner").

   Data and rules only; the page reads it (window.ArcanaLibrary) and Node require()s it for the tests. The words live in
   library-text.js (window.ArcanaLibraryText), filled in book by book. What you've found is kept in the codex
   (codex.library {pageId: [at, read]}), across every save, like the Archive's intel.

   An unlock rule is {k, ...}:
     tut                      the starting tutorial is behind you
     taught ch                a tutorial chapter (II, III) has been had
     keeper camp n            station n of that road beaten in this save
     stat stat n              s.stats[stat] >= n (battles, wins, packs, harm, ...)
     plv n                    player level
     daily n / reading n      days drawn / readings laid, in this save's journal
     owned n / decks n        cards owned / decks completed
     combos n                 combos written in the Combo Book
     ngp n                    New Game+ cycle
     world diff               The World beaten at that difficulty (the diary, any save)
     diff d                   this save is at least that layer (normal / hard)
     card id how n            a minor card, by its id across every deck: beat / lost / won / played / own / max / decks /
                              pulled / daily / reading (see cardCount) */
(function (root) {
  "use strict";
  var T = (root && root.ArcanaLibraryText) || (typeof module !== "undefined" && module.exports ? require("./library-text.js") : {});

  // ---- the minor arcana's ways in: every card a different road, so a page is a surprise ----
  var SUITS = ["wands", "cups", "swords", "pentacles"];
  var RANKS = ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "page", "knight", "queen", "king"];
  var HOWS = [
    ["won", 3, "Win three clashes with it"], ["beat", 2, "Beat it twice"], ["pulled", 1, "Find it in a booster"], ["played", 6, "Play it six times"],
    ["lost", 2, "Lose to it twice"], ["daily", 1, "Draw it as a card of the day"], ["max", 1, "Raise a copy all the way"], ["decks", 2, "Own it from two decks"],
    ["reading", 1, "Lay it in a reading"], ["won", 6, "Win six clashes with it"], ["beat", 4, "Beat it four times"], ["own", 1, "Own a copy"],
    ["played", 12, "Play it twelve times"], ["lost", 4, "Lose to it four times"]
  ];
  function minorRule(rank, suit) {                                   // (the same card always the same way in; neighbours differ)
    var h = HOWS[(RANKS.indexOf(rank) * 5 + SUITS.indexOf(suit) * 3) % HOWS.length];
    return { k: "card", id: rank + "_" + suit, how: h[0], n: h[1], hint: h[2] };
  }

  var MAJOR_IDS = ["fool", "magician", "high_priestess", "empress", "emperor", "hierophant", "lovers", "chariot", "strength", "hermit", "wheel",
    "justice", "hanged_man", "death", "temperance", "devil", "tower", "star", "moon", "sun", "judgement", "world"];
  var MAJOR_NAMES = ["The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
    "Strength", "The Hermit", "The Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower", "The Star",
    "The Moon", "The Sun", "Judgement", "The World"];
  var ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
  var RANK_NAME = { ace: "Ace", page: "Page", knight: "Knight", queen: "Queen", king: "King" };
  var SUIT_NAME = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" };
  var NUM_NAME = ["", "", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  var minorName = function (rank, suit) { return (RANK_NAME[rank] || NUM_NAME[+rank]) + " of " + SUIT_NAME[suit]; };

  // ---- the books, in their order on the shelf ----
  var BOOKS = [
    { id: "guide", title: "The Seeker's Guide", by: "Selene, with notes from Orrin", cover: "#4b2a7a", glyph: "✦",
      pages: [
        { id: "guide-1", title: "A Door Most People Miss", unlock: { k: "tut" } },
        { id: "guide-2", title: "Cards, and What They Carry", unlock: { k: "tut" } },
        { id: "guide-3", title: "Eight in the Hand", unlock: { k: "tut" } },
        { id: "guide-4", title: "The Clash", unlock: { k: "tut" } },
        { id: "guide-5", title: "Combos and the Book", unlock: { k: "tut" } },
        { id: "guide-6", title: "The Fool's Road", unlock: { k: "tut" } },
        { id: "guide-7", title: "The Shop and the Altar", unlock: { k: "tut" } },
        { id: "guide-8", title: "Days, Readings and the Archive", unlock: { k: "tut" } },
        { id: "guide-9", title: "When the Decks Wake", unlock: { k: "taught", ch: "II" } },
        { id: "guide-10", title: "When the Decks Remember", unlock: { k: "taught", ch: "III" } }
      ] },
    { id: "major", title: "The Major Arcana", by: "the Archivist", cover: "#2a2a6e", glyph: "☉",
      pages: MAJOR_IDS.map(function (id, n) { return { id: "major-" + id, title: ROMAN[n] + " · " + MAJOR_NAMES[n], unlock: n === 0 ? { k: "tut" } : { k: "keeper", camp: "fool", n: n } }; }) },
    { id: "minor", title: "The Minor Arcana", by: "the Archivist, and a great many readers before her", cover: "#1f4a52", glyph: "⚘",
      pages: [].concat.apply([], SUITS.map(function (su) { return RANKS.map(function (rk) { return { id: "minor-" + rk + "_" + su, title: minorName(rk, su), unlock: minorRule(rk, su) }; }); })) },
    { id: "field", title: "The Field Guide", by: "Vesper", cover: "#6e2a2a", glyph: "⚔", gen: true,
      pages: [
        { id: "field-elements", title: "Which Element Beats Which", unlock: { k: "stat", stat: "wins", n: 5 } },
        { id: "field-kinds", title: "Majors, Courts, Pips and Omens", unlock: { k: "stat", stat: "battles", n: 12 } },
        { id: "field-fields", title: "The Four Grounds", unlock: { k: "diff", d: "normal" } },
        { id: "field-decks", title: "Every Deck's Voice", unlock: { k: "combos", n: 8 } },
        { id: "field-seals", title: "Seals, and When They Spring", unlock: { k: "stat", stat: "sealsSprung", n: 1 } },
        { id: "field-hunts", title: "Who Hunts Whom", unlock: { k: "diff", d: "hard" } },
        { id: "field-tempers", title: "Reading a Keeper", unlock: { k: "keeper", camp: "fool", n: 4, diff: "hard" } }
      ] },
    { id: "chronicle", title: "The Gilded Observatory", by: "set down by Selene", cover: "#5a3a12", glyph: "✧",
      pages: [
        { id: "chron-1", title: "Before the Lamps", unlock: { k: "keeper", camp: "fool", n: 3 } },
        { id: "chron-2", title: "The Dimming", unlock: { k: "keeper", camp: "fool", n: 7 } },
        { id: "chron-3", title: "The Orrery-Wrights", unlock: { k: "keeper", camp: "fool", n: 10 } },
        { id: "chron-4", title: "Why Every Deck", unlock: { k: "keeper", camp: "fool", n: 14 } },
        { id: "chron-5", title: "The Keepers' Oath", unlock: { k: "keeper", camp: "fool", n: 18 } },
        { id: "chron-6", title: "The Dancer at the End", unlock: { k: "keeper", camp: "fool", n: 21 } },
        { id: "chron-7", title: "Beyond the Veil", unlock: { k: "keeper", camp: "oracle", n: 7 } },
        { id: "chron-8", title: "The Oracle's Bargain", unlock: { k: "keeper", camp: "oracle", n: 13 } },
        { id: "chron-9", title: "The Wheel Turns Again", unlock: { k: "ngp", n: 1 } },
        { id: "chron-10", title: "What the Stars Remember", unlock: { k: "world", diff: "hard" } }
      ] },
    { id: "painted", title: "The Painted Road", by: "a history of the tarot, told by Orrin", cover: "#3a5a2a", glyph: "♣",
      pages: [
        { id: "painted-1", title: "Triumphs in Milan", unlock: { k: "plv", n: 3 } },
        { id: "painted-2", title: "Marseille", unlock: { k: "plv", n: 6 } },
        { id: "painted-3", title: "An Egyptian Fancy", unlock: { k: "plv", n: 9 } },
        { id: "painted-4", title: "Etteilla's Trade", unlock: { k: "plv", n: 12 } },
        { id: "painted-5", title: "Letters of Fire", unlock: { k: "plv", n: 15 } },
        { id: "painted-6", title: "A Deck for Everyone", unlock: { k: "plv", n: 18 } },
        { id: "painted-7", title: "The Teachers", unlock: { k: "plv", n: 21 } }
      ] },
    { id: "pixie", title: "Pixie", by: "on Pamela Colman Smith, by Selene", cover: "#7a3a5a", glyph: "✎",
      pages: [
        { id: "pixie-1", title: "A Girl Called Pixie", unlock: { k: "owned", n: 60 } },
        { id: "pixie-2", title: "Mr Waite's Commission", unlock: { k: "owned", n: 120 } },
        { id: "pixie-3", title: "Pictures on Every Card", unlock: { k: "decks", n: 1 } },
        { id: "pixie-4", title: "The Sola Busca", unlock: { k: "owned", n: 220 } },
        { id: "pixie-5", title: "What She Was Paid", unlock: { k: "decks", n: 2 } }
      ] },
    { id: "lenormand", title: "The Lady of the Rue de Tournon", by: "on Lenormand and cartomancy, by Orrin", cover: "#2a5a6e", glyph: "♠",
      pages: [
        { id: "len-1", title: "Reading Ordinary Cards", unlock: { k: "daily", n: 3 } },
        { id: "len-2", title: "Mademoiselle Lenormand", unlock: { k: "daily", n: 7 } },
        { id: "len-3", title: "The Game of Hope", unlock: { k: "daily", n: 14 } },
        { id: "len-4", title: "Thirty-Six Small Pictures", unlock: { k: "daily", n: 21 } },
        { id: "len-5", title: "Kipper and the Gypsy Cards", unlock: { k: "daily", n: 30 } }
      ] },
    { id: "mind", title: "The Deep Water", by: "on Jung and the hidden mind, by the Archivist", cover: "#24365e", glyph: "☾",
      pages: [
        { id: "mind-1", title: "Why a Picture Speaks", unlock: { k: "reading", n: 1 } },
        { id: "mind-2", title: "Dr Jung's Archetypes", unlock: { k: "reading", n: 3 } },
        { id: "mind-3", title: "Meaningful Coincidence", unlock: { k: "reading", n: 6 } },
        { id: "mind-4", title: "Active Imagination", unlock: { k: "reading", n: 10 } },
        { id: "mind-5", title: "Reading for Yourself", unlock: { k: "reading", n: 15 } }
      ] },
    { id: "dee", title: "The Queen's Conjurer", by: "on John Dee, by Vesper", cover: "#3a2a1a", glyph: "⌖",
      pages: [
        { id: "dee-1", title: "A Mathematician at Court", unlock: { k: "stat", stat: "wins", n: 40 } },
        { id: "dee-2", title: "The Black Mirror", unlock: { k: "stat", stat: "wins", n: 80 } },
        { id: "dee-3", title: "Kelley and the Angels", unlock: { k: "stat", stat: "wins", n: 130 } },
        { id: "dee-4", title: "A Library Lost", unlock: { k: "stat", stat: "wins", n: 200 } }
      ] },
    { id: "thoth", title: "The Book of Thoth", by: "on Crowley and Lady Harris, by Vesper", cover: "#5e1f2a", glyph: "⚚",
      pages: [
        { id: "thoth-1", title: "The Golden Dawn", unlock: { k: "world", diff: "easy" } },
        { id: "thoth-2", title: "The Wickedest Man in the World", unlock: { k: "world", diff: "normal" } },
        { id: "thoth-3", title: "Lady Frieda Harris", unlock: { k: "ngp", n: 1 } },
        { id: "thoth-4", title: "Lust, Art and the Aeon", unlock: { k: "ngp", n: 2 } }
      ] },
    { id: "oracle", title: "Oracles and Omens", by: "on divination, by Selene", cover: "#4a4a20", glyph: "⚶",
      pages: [
        { id: "oracle-1", title: "Asking the World a Question", unlock: { k: "stat", stat: "battles", n: 25 } },
        { id: "oracle-2", title: "Bones, Coins and Yarrow", unlock: { k: "stat", stat: "battles", n: 60 } },
        { id: "oracle-3", title: "Oracle Decks", unlock: { k: "keeper", camp: "oracle", n: 3 } },
        { id: "oracle-4", title: "How Readers Read Now", unlock: { k: "stat", stat: "battles", n: 120 } },
        { id: "oracle-5", title: "The Reader's Ethics", unlock: { k: "stat", stat: "battles", n: 200 } }
      ] }
  ];
  var PAGE = {};
  BOOKS.forEach(function (b) { b.pages.forEach(function (p, i) { p.book = b.id; p.n = i + 1; PAGE[p.id] = p; }); });

  // ---- reading the save for a rule ----
  var num = function (v) { return typeof v === "number" && isFinite(v) ? v : 0; };
  var LAYER = { easy: 0, normal: 1, hard: 2, free: 2 };
  function idOf(key) { return String(key || "").split(":")[1] || ""; }
  /** How often a minor card (by id, any deck) has done `how` in this save (and, for faced cards, the codex). */
  function cardCount(id, how, s, cx, H) {
    var keys = Object.keys(s.cards || {}).filter(function (k) { return idOf(k) === id; }), n = 0;
    if (how === "own") return keys.filter(function (k) { return s.cards[k].n > 0; }).length;
    if (how === "decks") return keys.filter(function (k) { return s.cards[k].n > 0; }).length;
    if (how === "max") return keys.filter(function (k) { return s.cards[k].n > 0 && s.cards[k].lv >= (H && H.maxLv ? H.maxLv(k) : 3); }).length;
    if (how === "won" || how === "played") { var src = how === "won" ? (s.stats && s.stats.cardWins) || {} : (s.stats && s.stats.played) || {}; Object.keys(src).forEach(function (k) { if (idOf(k) === id) n += num(src[k]); }); return n; }
    if (how === "beat" || how === "lost") { var cards = (cx && cx.cards) || {}; Object.keys(cards).forEach(function (k) { if (idOf(k) === id) n += num(cards[k][how === "beat" ? 2 : 3]); }); return n; }
    if (how === "pulled") return cx && cx.pulled && cx.pulled[id] ? 1 : 0;
    if (how === "daily" || how === "reading") return (s.journal || []).filter(function (e) { return e.kind === how && (e.cards || []).some(function (c) { return idOf(c.key) === id; }); }).length;
    return 0;
  }
  /** Is this rule met? s is a normalised save; cx the codex; diary the achievement diary {easy|normal|hard: {id}}. */
  function met(u, s, cx, diary, H) {
    if (!u || !s || !s.made) return false;
    var st = s.stats || {};
    if (u.diff && (LAYER[s.diff] || 0) < LAYER[u.diff] && u.k !== "diff") return false;
    switch (u.k) {
      case "tut": return s.tut == null;
      case "taught": return !!(cx && cx.taught && cx.taught[u.ch]);
      case "keeper": return num(s.camp && s.camp[u.camp] && s.camp[u.camp].best) >= u.n;
      case "stat": return num(st[u.stat]) >= u.n;
      case "plv": return num(s.plv) >= u.n;
      case "daily": case "reading": return (s.journal || []).filter(function (e) { return e.kind === u.k; }).length >= u.n;
      case "owned": return Object.keys(s.cards || {}).filter(function (k) { return s.cards[k].n > 0; }).length >= u.n;
      case "decks": return num(H && H.decksDone) >= u.n;
      case "combos": return Object.keys(s.combos || {}).length >= u.n;
      case "ngp": return num(s.ngp) >= u.n;
      case "world": return !!(diary && diary[u.diff] && diary[u.diff]["keeper-fool-21"]);
      case "diff": return (LAYER[s.diff] || 0) >= LAYER[u.d];
      case "card": return cardCount(u.id, u.how, s, cx, H) >= u.n;
      case "own": return !!(s.cards && s.cards[u.key] && s.cards[u.key].n > 0);
    }
    return false;
  }
  /** The pages this save has earned that the codex hasn't got yet, in shelf order. */
  function check(s, cx, diary, H) {          // H: {maxLv(key), decksDone} from the rules
    var have = (cx && cx.library) || {}, out = [];
    if (!s || !s.made || s.tut != null) return out;                 // (the Library opens when the starting tutorial ends)
    BOOKS.forEach(function (b) { b.pages.forEach(function (p) { if (!have[p.id] && met(p.unlock, s, cx, diary, H)) out.push(p.id); }); });
    return out;
  }
  function hintOf(u) {
    if (!u) return "";
    switch (u.k) {
      case "tut": return "Finish the starting tutorial";
      case "taught": return "Play your first " + (u.ch === "II" ? "Normal" : "Hard") + " save";
      case "keeper": return "Beat " + (u.camp === "fool" ? "station " + ROMAN[u.n] + " of the Fool's Journey" : "keeper " + u.n + " of the Veiled Pilgrimage") + (u.diff ? " on " + u.diff[0].toUpperCase() + u.diff.slice(1) : "");
      case "stat": return { wins: "Win " + u.n + " battles", battles: "Fight " + u.n + " battles", sealsSprung: "Spring a Seal", packs: "Open " + u.n + " boosters" }[u.stat] || "Keep playing";
      case "plv": return "Reach player level " + u.n;
      case "daily": return "Draw " + u.n + " cards of the day";
      case "reading": return "Lay " + u.n + " reading" + (u.n > 1 ? "s" : "");
      case "owned": return "Own " + u.n + " cards";
      case "decks": return "Complete " + u.n + " deck" + (u.n > 1 ? "s" : "");
      case "combos": return "Write " + u.n + " pages in the Combo Book";
      case "ngp": return "Begin New Game+ " + ROMAN[u.n];
      case "world": return "Beat The World on " + u.diff[0].toUpperCase() + u.diff.slice(1);
      case "diff": return "Play a " + u.d[0].toUpperCase() + u.d.slice(1) + " save";
      case "card": return u.hint || "A secret";
      case "own": return "Collect this card";
    }
    return "";
  }
  // ---- the deck guidebooks (Cam, 2 Nov: "the books would be great however the meaning page for each card can only be
  //      unlocked when you acquire the card ... this would push the oracle cards to later game"): one book per deck, in that
  //      deck's own guidebook words (NeuroNet's decks carry them), a page for each card, found when the card is yours ----
  var LORE_N = BOOKS.length;                                         // (the lore books come first; the decks' after them)
  function code(slug) { return String(slug).split("-").map(function (w) { return w[0]; }).join("").slice(0, 8); }
  var clean = function (t) { return String(t || "").replace(/\r/g, "").replace(/^\s*upright\s*[:\-]\s*/i, "").trim(); };
  /** Build the deck guidebooks from the catalogue ({decks, cards}); called again whenever the catalogue changes. */
  function deckBooks(cat) {
    BOOKS.splice(LORE_N);
    Object.keys(PAGE).forEach(function (id) { if (/^g-/.test(id)) { delete PAGE[id]; delete T[id]; } });
    ((cat && cat.decks) || []).forEach(function (d) {
      var cards = (cat.cards || []).filter(function (c) { return c.deck === d.slug && clean(c.up); });
      if (!cards.length) return;
      var b = { id: "deck-" + d.slug, title: d.name, by: "its own guidebook, copied out word for word by the Archivist", deck: d.slug, cover: "#3a2a5a", glyph: "✦", cover_img: d.cover || "", pages: [] };
      cards.forEach(function (c, i) {
        var id = "g-" + code(d.slug) + "-" + c.id;
        var paras = ["Upright, it reads like this.", "> " + clean(c.up)];
        if (clean(c.rev)) paras.push("And turned reversed, like this.", "> " + clean(c.rev));
        T[id] = paras;
        var p = { id: id, title: c.name, key: c.key, unlock: { k: "own", key: c.key }, book: b.id, n: i + 1 };
        b.pages.push(p); PAGE[id] = p;
      });
      BOOKS.push(b);
    });
    return BOOKS.length - LORE_N;
  }

  // ---- correspondences (Cam, 2 Nov: "the numerology and astrology of each of the cards"): a table at the foot of every
  //      Major and Minor page -- the Golden Dawn's attributions, Marseille's and Crowley's names, the numbers ----
  var LETTER = ["Aleph", "Beth", "Gimel", "Daleth", "Heh", "Vav", "Zayin", "Cheth", "Teth", "Yod", "Kaph", "Lamed", "Mem", "Nun", "Samekh", "Ayin", "Peh", "Tzaddi", "Qoph", "Resh", "Shin", "Tau"];
  var SKY = ["Air", "Mercury", "the Moon", "Venus", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Jupiter", "Libra", "Water", "Scorpio", "Sagittarius", "Capricorn", "Mars", "Aquarius", "Pisces", "the Sun", "Fire (and Spirit)", "Saturn (and Earth)"];
  var MARSEILLE = ["Le Mat", "Le Bateleur", "La Papesse", "L'Imperatrice", "L'Empereur", "Le Pape", "L'Amoureux", "Le Chariot", "La Force (XI)", "L'Ermite", "La Roue de Fortune", "La Justice (VIII)",
    "Le Pendu", "(the nameless arcanum)", "Temperance", "Le Diable", "La Maison Dieu", "L'Etoile", "La Lune", "Le Soleil", "Le Jugement", "Le Monde"];
  var THOTH = ["The Fool", "The Magus", "The Priestess", "The Empress", "The Emperor (Tzaddi)", "The Hierophant", "The Lovers", "The Chariot", "Lust (XI)", "The Hermit", "Fortune", "Adjustment (VIII)",
    "The Hanged Man", "Death", "Art", "The Devil", "The Tower", "The Star (Heh)", "The Moon", "The Sun", "The Aeon", "The Universe"];
  var GDT = { wands: ["Dominion", "Established Strength", "Perfected Work", "Strife", "Victory", "Valour", "Swiftness", "Great Strength", "Oppression"],
    cups: ["Love", "Abundance", "Blended Pleasure", "Loss in Pleasure", "Pleasure", "Illusionary Success", "Abandoned Success", "Material Happiness", "Perfected Success"],
    swords: ["Peace Restored", "Sorrow", "Rest from Strife", "Defeat", "Earned Success", "Unstable Effort", "Shortened Force", "Despair and Cruelty", "Ruin"],
    pentacles: ["Harmonious Change", "Material Works", "Earthly Power", "Material Trouble", "Material Success", "Success Unfulfilled", "Prudence", "Material Gain", "Wealth"] };
  var THT = { wands: ["Dominion", "Virtue", "Completion", "Strife", "Victory", "Valour", "Swiftness", "Strength", "Oppression"], cups: ["Love", "Abundance", "Luxury", "Disappointment", "Pleasure", "Debauch", "Indolence", "Happiness", "Satiety"],
    swords: ["Peace", "Sorrow", "Truce", "Defeat", "Science", "Futility", "Interference", "Cruelty", "Ruin"], pentacles: ["Change", "Works", "Power", "Worry", "Success", "Failure", "Prudence", "Gain", "Wealth"] };
  var DECAN = { wands: ["Mars in Aries", "the Sun in Aries", "Venus in Aries", "Saturn in Leo", "Jupiter in Leo", "Mars in Leo", "Mercury in Sagittarius", "the Moon in Sagittarius", "Saturn in Sagittarius"],
    cups: ["Venus in Cancer", "Mercury in Cancer", "the Moon in Cancer", "Mars in Scorpio", "the Sun in Scorpio", "Venus in Scorpio", "Saturn in Pisces", "Jupiter in Pisces", "Mars in Pisces"],
    swords: ["the Moon in Libra", "Saturn in Libra", "Jupiter in Libra", "Venus in Aquarius", "Mercury in Aquarius", "the Moon in Aquarius", "Jupiter in Gemini", "Mars in Gemini", "the Sun in Gemini"],
    pentacles: ["Jupiter in Capricorn", "Mars in Capricorn", "the Sun in Capricorn", "Mercury in Taurus", "the Moon in Taurus", "Saturn in Taurus", "the Sun in Virgo", "Venus in Virgo", "Mercury in Virgo"] };
  var EL = { wands: "Fire", cups: "Water", swords: "Air", pentacles: "Earth" }, SIGNS = { wands: "Aries, Leo, Sagittarius", cups: "Cancer, Scorpio, Pisces", swords: "Libra, Aquarius, Gemini", pentacles: "Capricorn, Taurus, Virgo" };
  var COURT = { page: ["Princess", "Earth"], knight: ["Prince", "Air"], queen: ["Queen", "Water"], king: ["Knight", "Fire"] };
  var digits = function (n) { while (n > 9) n = String(n).split("").reduce(function (a, d) { return a + +d; }, 0); return n; };
  /** [[label, value]] for a Major or Minor page; null for any other. */
  function corrOf(id) {
    var m = /^major-(.+)$/.exec(id || "");
    if (m) { var n = MAJOR_IDS.indexOf(m[1]); if (n < 0) return null;
      var rows = [["Number", ROMAN[n] + (n ? " (" + n + ")" : " (zero)")]];
      if (n > 9) rows.push(["Reduces to", digits(n) + " -- " + MAJOR_NAMES[digits(n)]]);
      return rows.concat([["Hebrew letter", LETTER[n]], ["Astrology", SKY[n]], ["Marseille", MARSEILLE[n]], ["Thoth", THOTH[n]]]); }
    m = /^minor-([a-z0-9]+)_([a-z]+)$/.exec(id || "");
    if (!m) return null;
    var rk = m[1], su = m[2], out = [];
    if (COURT[rk]) out.push(["Rank", RANK_NAME[rk]], ["Thoth court", COURT[rk][0] + " of " + (su === "pentacles" ? "Disks" : SUIT_NAME[su])], ["Element", COURT[rk][1] + " of " + EL[su]]);
    else if (rk === "ace") out.push(["Number", "1"], ["Golden Dawn", "the Root of the Powers of " + EL[su]], ["Element", EL[su]]);
    else { var i = +rk - 2; out.push(["Number", rk], ["Golden Dawn", "Lord of " + GDT[su][i]], ["Thoth", THT[su][i]], ["Decan", DECAN[su][i]], ["Element", EL[su]]); }
    out.push(["Signs of the suit", SIGNS[su]]);
    return out;
  }

  /** A page's words: paragraphs (from library-text.js). Generated pages (the Field Guide) are drawn by the page itself. */
  function textOf(id) { return (T && T[id]) || null; }

  var API = { BOOKS: BOOKS, PAGE: PAGE, deckBooks: deckBooks, corrOf: corrOf, loreCount: function () { return LORE_N; }, met: met, check: check, hintOf: hintOf, textOf: textOf, cardCount: cardCount, MAJOR_IDS: MAJOR_IDS, MAJOR_NAMES: MAJOR_NAMES, ROMAN: ROMAN };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.ArcanaLibrary = API;
})(typeof window !== "undefined" ? window : this);
