/* NeuroArcana's rules (prototype v2, 2026-11-01) -- everything the game decides, and nothing it draws.
   Pure: act(state, action, opts, now) -> { ok, state, events } on a copy; view(state, now) -> what the page shows.
   Random numbers are seeded and kept in the save (s.rng, a battle's own b.rng), so nothing re-rolls by quitting, and the
   tests and the balance tool can replay anything. No recursion over save data; every loop is bounded.
   Loaded by the page (window.ArcanaCore) and by Node (module.exports) alike. See docs/DESIGN.md.

   v2 (Cam, 1 Nov): a deck of 8, four drawn at random for each battle; combos woken by the whole deck; Fury; cards earn
   XP in battle and unlock level boons; oracle cards; a combo book filled in as combos are first used; the starter deck
   and the tutorial's steps; the AI paces its celestials; a grindier economy. */
(function (root) {
  "use strict";
  var DAY = 86400000;
  // the decks' own lore (ui/arcana/lore.js): signature cards, leans, affinities, the keepers' spreads
  var LORE = typeof module !== "undefined" && module.exports ? require("./lore.js") : (root.ArcanaLore || { SIGNATURES: {}, LEANS: {}, LEAN_POOL: [], KINDS: {}, AFFINITY: {}, AFFINITY_N: { hunt: 2, fear: 1 }, KEEPERS: { fool: {}, oracle: {} } });

  // ---- seeded random numbers (mulberry32): the state holds a 32-bit number ----------------------------------------
  function rand(o) {
    o.rng = (o.rng + 0x6D2B79F5) | 0;
    var t = o.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
  var pickOf = function (o, list) { return list[Math.floor(rand(o) * list.length)]; };
  function shuffle(o, a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand(o) * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var dayOf = function (t) { var d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };

  // ---- the 78 cards of a tarot deck ------------------------------------------------------------------------------
  var MAJORS = ["fool", "magician", "high_priestess", "empress", "emperor", "hierophant", "lovers", "chariot", "strength", "hermit", "wheel",
    "justice", "hanged_man", "death", "temperance", "devil", "tower", "star", "moon", "sun", "judgement", "world"];
  var MAJOR_NAMES = ["The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
    "Strength", "The Hermit", "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower", "The Star", "The Moon",
    "The Sun", "Judgement", "The World"];
  var ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
  var SUITS = ["wands", "cups", "swords", "pentacles"];
  var SUIT = {
    wands: { name: "Wands", element: "Fire", glyph: "🜂" }, cups: { name: "Cups", element: "Water", glyph: "🜄" },
    swords: { name: "Swords", element: "Air", glyph: "🜁" }, pentacles: { name: "Pentacles", element: "Earth", glyph: "🜃" },
    major: { name: "Major Arcana", element: "Spirit", glyph: "✦" }, oracle: { name: "Oracle", element: "Spirit", glyph: "☽" }
  };
  // the elements' wheel: each quenches the next (Cups > Wands > Swords > Pentacles > Cups)
  var BEATS = { cups: "wands", wands: "swords", swords: "pentacles", pentacles: "cups" };
  // ---- fields (Q9, 1 Nov: Cam's idea, after Forbidden Memories' field types) -- every battle is fought on an element:
  // the field's suit +2 Power, the suit it beats -1, on both sides. Keepers take theirs from the Golden Dawn's astrology
  // (Waite and Smith's tradition), read as elements; the oracle realms one each; other battles a random one.
  var FIELDS = ["fire", "water", "air", "earth"];
  var FIELD = { fire: { name: "Field of Fire", suit: "wands" }, water: { name: "Field of Water", suit: "cups" },
    air: { name: "Field of Air", suit: "swords" }, earth: { name: "Field of Earth", suit: "pentacles" } };
  var FIELD_UP = 2, FIELD_DOWN = 1;
  //                 -, I Mercury, II Moon, III Venus, IV Aries, V Taurus, VI Gemini, VII Cancer, VIII Leo, IX Virgo, X Jupiter,
  //                 XI Libra, XII Water, XIII Scorpio, XIV Sagittarius, XV Capricorn, XVI Mars, XVII Aquarius, XVIII Pisces,
  //                 XIX the Sun, XX Fire, XXI Saturn
  var MAJOR_FIELD = [null, "air", "water", "earth", "fire", "earth", "air", "water", "fire", "earth", "fire",
    "air", "water", "water", "fire", "earth", "fire", "air", "water", "fire", "fire", "earth"];
  var REALM_FIELD = { "carnival-of-souls": "fire", "the-viking-oracle": "air", "the-rooted-woman-oracle": "earth", "deadly-apothecary-oracle": "water" };
  /** A card's Power on a field: +2 for the field's own suit, -1 for the suit the field's suit beats. */
  function fieldMod(field, key) {
    var F = FIELD[field], c = card(key);
    if (!F || !c) return 0;
    return c.suit === F.suit ? FIELD_UP : BEATS[F.suit] === c.suit ? -FIELD_DOWN : 0;
  }
  // ---- Seals (Q9, 1 Nov: traps "like Yu-Gi-Oh", Cam's pick A): set one before a battle; it waits face down and springs
  // once, when its moment comes, and is spent. Keepers set them too, unseen until they spring. Orrin sells them; keepers
  // drop them. (lantern and hourglass work on your screen, so only you can set them.)
  var SEALS = [
    { id: "mirror", name: "Mirror Seal", when: "you lose a clash by 1 Might or less", text: "the clash is a draw instead", price: 160 },
    { id: "thorn", name: "Thorn Seal", when: "you first take Harm", text: "they take 2 Harm", price: 120 },
    { id: "veil", name: "Veil Seal", when: "they first light Fury", text: "their Fury is snuffed (they keep the stars)", price: 120 },
    { id: "tide", name: "Tide Seal", when: "a Cups card wins against you", text: "you heal what it dealt", price: 120 },
    { id: "ember", name: "Ember Seal", when: "your Wands card wins", text: "+2 Harm", price: 120 },
    { id: "gale", name: "Gale Seal", when: "they bid 6 or more stars", text: "2 of them are blown out", price: 140 },
    { id: "root", name: "Root Seal", when: "your Spirit falls below 6", text: "heal 4", price: 140 },
    { id: "lantern", name: "Lantern Seal", when: "round 3 begins", text: "you see the card they've chosen", price: 160, mine: true },
    { id: "hourglass", name: "Hourglass Seal", when: "your turn timer runs out", text: "10 more seconds", price: 80, mine: true },
    { id: "crown", name: "Crown Seal", when: "your Major wins", text: "+2 celestials", price: 140 },
    { id: "chain", name: "Chain Seal", when: "they play a Major", text: "its ability is silenced", price: 160 },
    { id: "fool", name: "Fool's Seal", when: "the first round", text: "a coin flip: +3 Power or -3", price: 80 }
  ];
  var SEAL = {};
  SEALS.forEach(function (x) { SEAL[x.id] = x; });
  function onField(c, field) { var m = fieldMod(field, c.key); if (m) { c.pow = Math.max(0, c.pow + m); c.field = m; } return c; }
  var RANKS = ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "page", "knight", "queen", "king"];
  var RANK_NAMES = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];
  var COURT = { page: 1, knight: 1, queen: 1, king: 1 };
  var CARD_IDS = MAJORS.slice();
  SUITS.forEach(function (su) { RANKS.forEach(function (r) { CARD_IDS.push(r + "_" + su); }); });

  // ---- rarity (Cam: courts rarer than the Majors because together they combo; the World the rarest of all) ----------
  // need: XP from level n to n+1 is need x n (grindy, Cam 1 Nov); xp: what one sacrificed double gives
  var RARITIES = ["common", "uncommon", "rare", "epic", "mythic"];
  var RARITY = {
    // need x1.5 (Cam, 1 Nov: "the leveling up of cards goes too quick and needs to be slowed down a little")
    common: { name: "Common", tier: 0, odds: 0.58, xp: 2, need: 18, max: 3, value: 40 },
    uncommon: { name: "Uncommon", tier: 1, odds: 0.14, xp: 4, need: 21, max: 3, value: 80 },
    rare: { name: "Rare", tier: 2, odds: 0.18, xp: 8, need: 24, max: 4, value: 160 },
    epic: { name: "Epic", tier: 3, odds: 0.095, xp: 12, need: 30, max: 4, value: 300 },
    mythic: { name: "Mythic", tier: 4, odds: 0.005, xp: 30, need: 38, max: 5, value: 1200 }
  };
  function rarityOf(id) {
    if (id === "world") return "mythic";
    if (id === "wheel") return "epic";                      // (Q13 q3 / the buff audit, 2 Nov: the strongest Rare)
    if (MAJORS.indexOf(id) >= 0) return "rare";
    var r = id.split("_")[0];
    return COURT[r] ? "epic" : r === "ace" ? "uncommon" : "common";
  }

  // ---- abilities: data, not code. fx kinds are applied in clashCalc() / playRound() ---------------------------------
  // pow n | powIf {n, when: nocel|behind|deckmate} | powPer {n, per: major|suit} | foePow n | harm n (on a win)
  // heal n (on a win) | drain | celWin n | celLose n | guard n | cancel | recoil n | free n | copy | die/dice2 {map} | coin {up, down} | steal n | poison n | burn n
  // (lore.js adds the signature cards' own, and the when/per kinds clashCalc() reads)
  // (Q11 i3, Cam 2 Nov "Build next": ten more cards that toss or roll, now the board shows them -- each worth about what it was)
  var ABILITIES = {
    fool: { name: "Leap of Faith", text: "+6 Power when you spend no celestials", fx: [{ k: "powIf", n: 6, when: "nocel" }] },
    magician: { name: "Mirror", text: "Its Power becomes the higher of the two cards', +1", fx: [{ k: "copy" }, { k: "pow", n: 1 }] },
    high_priestess: { name: "Veil", text: "Cancels the other card's ability", fx: [{ k: "cancel" }] },
    empress: { name: "Abundance", text: "A coin -- Win: heal 4 Spirit on the sun, 2 on the moon", fx: [{ k: "coin", up: [{ k: "heal", n: 4 }], down: [{ k: "heal", n: 2 }] }] },
    emperor: { name: "Authority", text: "The other card has -3 Power", fx: [{ k: "foePow", n: 3 }] },
    hierophant: { name: "Tradition", text: "+1 Power for each other Major in your spread", fx: [{ k: "powPer", n: 1, per: "major" }] },
    lovers: { name: "Union", text: "+3 Power if another card of its deck is in your spread", fx: [{ k: "powIf", n: 3, when: "deckmate" }] },
    chariot: { name: "Charge", text: "A die -- Win: +1 to +3 Harm (1-2: +1, 3-4: +2, 5-6: +3)", fx: [{ k: "die", stat: "harm", map: [1, 1, 2, 2, 3, 3] }] },
    strength: { name: "Fortitude", text: "Lose: take 3 less Harm", fx: [{ k: "guard", n: 3 }] },
    hermit: { name: "Solitude", text: "+4 Power while you have less Spirit", fx: [{ k: "powIf", n: 4, when: "behind" }] },
    // (Cam, 2 Nov: "instead of random 0-5 boost have 0-6 boost based of die roll"): a die, shown on the clash screen
    wheel: { name: "Fortune", text: "A die: a 1 is nothing, 2-6 that much Power", fx: [{ k: "die", map: [0, 2, 3, 4, 5, 6] }] },
    justice: { name: "Balance", text: "Weighs two dice, the lower counts: 3-6 that much Power; and Win: they lose 1 celestial", fx: [{ k: "dice2", low: true, map: [0, 0, 3, 4, 5, 6] }, { k: "burn", n: 1 }] },
    hanged_man: { name: "Surrender", text: "A coin -- Lose: gain 5 celestials on the sun, 1 on the moon", fx: [{ k: "coin", up: [{ k: "celLose", n: 5 }], down: [{ k: "celLose", n: 1 }] }] },
    death: { name: "Ending", text: "Win: heal half the Harm dealt", fx: [{ k: "drain" }] },
    temperance: { name: "Measure", text: "A coin: 3 free celestials on the sun, 1 on the moon", fx: [{ k: "coin", up: [{ k: "free", n: 3 }], down: [{ k: "free", n: 1 }] }] },
    devil: { name: "Temptation", text: "A coin -- Win: on the sun they lose 2 Spirit after every round to come; on the moon, nothing", fx: [{ k: "coin", up: [{ k: "poison", n: 2 }], down: [] }] },
    tower: { name: "Upheaval", text: "A die -- Win: +3 to +7 Harm, but you take 2", fx: [{ k: "die", stat: "harm", map: [3, 4, 4, 5, 6, 7] }, { k: "recoil", n: 2 }] },
    star: { name: "Hope", text: "Win or lose: gain 2 celestials", fx: [{ k: "celWin", n: 2 }, { k: "celLose", n: 2 }] },
    moon: { name: "Illusion", text: "A coin: the other card -4 Power on the sun, -2 on the moon", fx: [{ k: "coin", up: [{ k: "foePow", n: 4 }], down: [{ k: "foePow", n: 2 }] }] },
    sun: { name: "Radiance", text: "A die: +1 to +5 Power (1: +1, 2: +2, 3-4: +3, 5: +4, 6: +5), and Win: +1 Harm", fx: [{ k: "die", map: [1, 2, 3, 3, 4, 5] }, { k: "harm", n: 1 }] },
    judgement: { name: "Rebirth", text: "A coin -- Win: heal 6 Spirit on the sun, 2 on the moon", fx: [{ k: "coin", up: [{ k: "heal", n: 6 }], down: [{ k: "heal", n: 2 }] }] },
    world: { name: "Completion", text: "+1 Power for each suit in your spread; can't be cancelled", fx: [{ k: "powPer", n: 1, per: "suit" }], immune: true },
    ace: { name: "Seed", text: "+2 Power", fx: [{ k: "pow", n: 2 }] },
    page: { name: "Message", text: "Win or lose: gain 1 celestial", fx: [{ k: "celWin", n: 1 }, { k: "celLose", n: 1 }] },
    knight: { name: "Charge of Arms", text: "+2 Power", fx: [{ k: "pow", n: 2 }] },
    queen: { name: "Grace", text: "Win: heal 3 Spirit", fx: [{ k: "heal", n: 3 }] },
    king: { name: "Command", text: "Win: +2 Harm", fx: [{ k: "harm", n: 2 }] },
    // the oracle cards' gifts, given out by card (o_*)
    o_foresight: { name: "Foresight", text: "+2 Power", fx: [{ k: "pow", n: 2 }] },
    o_ward: { name: "Warding", text: "Lose: take 2 less Harm", fx: [{ k: "guard", n: 2 }] },
    o_hex: { name: "Hex", text: "The other card has -2 Power", fx: [{ k: "foePow", n: 2 }] },
    o_favour: { name: "Favour", text: "Win: gain 1 celestial", fx: [{ k: "celWin", n: 1 }] },
    o_mend: { name: "Mending", text: "Win: heal 2 Spirit", fx: [{ k: "heal", n: 2 }] },
    o_bite: { name: "Bite", text: "Win: +2 Harm", fx: [{ k: "harm", n: 2 }] },
    o_calm: { name: "Calm", text: "1 free celestial", fx: [{ k: "free", n: 1 }] }
  };
  var ORACLE_ABS = ["o_foresight", "o_ward", "o_hex", "o_favour", "o_mend", "o_bite", "o_calm"];
  var MAJOR_STATS = { fool: [3, 3], magician: [4, 3], high_priestess: [5, 3], empress: [5, 4], emperor: [6, 4], hierophant: [4, 4], lovers: [4, 4],
    chariot: [6, 4], strength: [6, 3], hermit: [5, 4], wheel: [4, 4], justice: [5, 4], hanged_man: [5, 3], death: [6, 5], temperance: [4, 3],
    devil: [5, 3], tower: [6, 3], star: [4, 3], moon: [4, 3], sun: [5, 3], judgement: [5, 3], world: [8, 5] };
  var COURT_STATS = { page: [5, 3], knight: [6, 3], queen: [6, 4], king: [7, 4] };

  // ---- the decks: each has a perk woken by enough of its cards in a deck of 8 (Harmony: 5 tarot, 3 oracle) --------
  var PERKS = {
    "murder-of-crows": { name: "Murder", text: "+1 Harm to every card", side: { harm: 1 } },
    "splendor-solis": { name: "Alchemical Gold", text: "+2 celestials", side: { cel: 2 } },
    "old-school-tarot": { name: "Old School", text: "+1 Power to every card", side: { pow: 1 } },
    "tarot-of-divine": { name: "Divine Grace", text: "Heal 1 Spirit on every win", side: { heal: 1 } },
    "secrets-of-the-witches-garden": { name: "Hex", text: "Their cards have -1 Power", side: { hex: 1 } },
    "wonderland-in-tarot": { name: "Curiouser", text: "+3 Spirit", side: { spirit: 3 } },
    "ryder-smith": { name: "Classic", text: "+1 Power to every card", side: { pow: 1 } },
    "gilded-observatory": { name: "Clear Skies", text: "+1 celestial and +2 Spirit", side: { cel: 1, spirit: 2 } },
    "carnival-of-souls": { name: "Masquerade", text: "Their cards have -1 Power", side: { hex: 1 } },
    "the-viking-oracle": { name: "Shield Wall", text: "Your cards take 1 less Harm", side: { guard: 1 } },
    "the-rooted-woman-oracle": { name: "Deep Roots", text: "+3 Spirit", side: { spirit: 3 } },
    "deadly-apothecary-oracle": { name: "Bitter Draught", text: "+1 Harm to every card", side: { harm: 1 } }
  };
  var PERK_LIST = Object.keys(PERKS).map(function (k) { return PERKS[k]; });
  // Full Spreads (Cam, 1 Nov: "if I use all of Alice cards then it gets Looking Glass ... this will give more reason to
  // build spreads with cards from all the same decks" -- the rest from the team): all eight cards from one deck
  var FULL = {
    "wonderland-in-tarot": { name: "Looking Glass", text: "Every round you see the card they've chosen (not their stars)", lore: "Through the glass, everything shows its other side." },
    "murder-of-crows": { name: "Unkindness", text: "Each round you win, the crows steal a celestial from them for you", lore: "A murder of crows takes what glitters." },
    "splendor-solis": { name: "Philosopher's Stone", text: "Once a battle, the first clash you lose turns to gold: it deals you no Harm", lore: "Lead into gold, loss into gain." },
    "old-school-tarot": { name: "Old School", text: "Your Majors +3 Power", lore: "The old trumps, as they were always played." },
    "tarot-of-divine": { name: "Happily Ever After", text: "Your card in the last round +4 Power", lore: "Every tale ends where it should." },
    "secrets-of-the-witches-garden": { name: "Witch's Brew", text: "Each round you lose, they're poisoned 1", lore: "Hurt the witch, and drink her garden." },
    "ryder-smith": { name: "The Original", text: "+1 Power and +1 Harm to every card", lore: "The deck the others learned from." },
    "carnival-of-souls": { name: "Showstopper", text: "Your first card +3 Power and +1 Harm", lore: "Open with the biggest act." },
    "the-viking-oracle": { name: "Berserker", text: "Below two-thirds of your Spirit, your cards +3 Power", lore: "Wounded, the north fights harder." },
    "the-rooted-woman-oracle": { name: "Old Growth", text: "+4 Spirit", lore: "Roots that deep don't come up." },
    "gilded-observatory": { name: "Star Chart", text: "Every round you see how many stars they've bid (not their card)", lore: "Map their sky, and you know their reach." },
    "deadly-apothecary-oracle": { name: "Antidote", text: "You can't be poisoned, and each round you win poisons them 1", lore: "Who brews the poison keeps the cure." }
  };
  var LOOKING_GLASS = "wonderland-in-tarot", STAR_CHART = "gilded-observatory";
  var DEFAULT_DECKS = ["Murder Of Crows", "Splendor Solis", "Old School Tarot", "Tarot Of Divine", "Secrets Of The Witches Garden", "Wonderland In Tarot"];
  var slug = function (name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "deck"; };

  // ---- the catalogue: every card of every complete deck ---------------------------------------------------------
  var CAT = { decks: [], cards: [], index: {}, byDeck: {}, byRarity: {}, art: false };
  function defaultName(id) {
    var m = MAJORS.indexOf(id);
    if (m >= 0) return MAJOR_NAMES[m];
    var p = id.split("_");
    return RANK_NAMES[RANKS.indexOf(p[0])] + " of " + SUIT[p[1]].name;
  }
  function makeCard(deck, id, extra) {
    var m = MAJORS.indexOf(id), p = id.split("_"), suit = m >= 0 ? "major" : p[1], rank = m >= 0 ? m : RANKS.indexOf(p[0]) + 1;
    var rar = rarityOf(id), pow, harm, ab = null;
    if (m >= 0) { pow = MAJOR_STATS[id][0]; harm = MAJOR_STATS[id][1]; ab = id; }
    else if (COURT[p[0]]) { pow = COURT_STATS[p[0]][0]; harm = COURT_STATS[p[0]][1]; ab = p[0]; }
    else if (p[0] === "ace") { pow = 5; harm = 3; ab = "ace"; }
    else { var n = rank; pow = 1 + Math.ceil(n / 2); harm = 2 + Math.floor((n - 2) / 3); }
    // the same card in another deck isn't the same (Cam, 2 Nov): the deck's lean, and its signature cards (lore.js) --
    // these replaced a hidden +1 tilt by deck
    return finishCard(deck, id, suit, rank, rar, pow, harm, ab, extra, m >= 0 ? ROMAN[m] : "");
  }
  // ---- the difficulty layers (Cam, 2 Nov, Q12: "Easy mode should just contain the card game before any of these deck
  //      depth changes ... normal can have ... the deck bonuses ... Then these changes now will be for the Hard mode"):
  //      each system asks F.<feature> -- no difficulty is a copy of the rules. deep = the decks' identity (signature cards,
  //      leans, hunts and fears), the keepers' own spreads and (later) their temperaments.
  var FEATURES = {
    easy: { harmony: false, full: false, fields: false, seals: false, underdog: false, deep: false },
    normal: { harmony: true, full: true, fields: true, seals: true, underdog: true, deep: false },
    hard: { harmony: true, full: true, fields: true, seals: true, underdog: true, deep: true },
    free: { harmony: true, full: true, fields: true, seals: true, underdog: true, deep: true }
  };
  var F = FEATURES.hard;
  /** Which difficulties are open (Cam, 2 Nov: "Normal and Hard should be locked until you have beaten The World on Easy";
      Q12 q2: Hard after The World on Normal), from the achievement diary kept across every save ({easy|normal|hard: {id}}). */
  function diffsOpen(diary) {
    var w = function (d) { return !!(diary && diary[d] && diary[d]["keeper-fool-21"]); };
    return { free: true, easy: true, normal: w("easy") || w("normal") || w("hard"), hard: w("normal") || w("hard") };
  }
  /** A battle's layer: the one it began with (B.tier), else the save's. */
  function tierOf(B) { return B && B.tier && FEATURES[B.tier] ? FEATURES[B.tier] : F; }
  /** The save's layer, for every rule that follows (and the catalogue: plain cards below Hard). */
  function useTier(s) {
    F = FEATURES[s && s.diff] || FEATURES.hard;
    var set = F.deep ? CAT.deepSet : CAT.plainSet;
    if (set && CAT.index !== set.index) { CAT.index = set.index; CAT.cards = set.cards; CAT.byRarity = set.byRarity; }
    return F;
  }
  /** A deck's lean ({name, text, pow, harm, heal, guard, cel, fx}): its own, or one by its name for a deck we don't know. */
  function leanOf(sl) {
    if (LORE.LEANS[sl]) return LORE.LEANS[sl];
    var pool = LORE.LEAN_POOL;
    return pool.length ? LORE.LEANS[pool[hash(sl) % pool.length]] : null;
  }
  /** A deck's affinity ({hunt, fear, why}): its own, or one by its name. */
  var KIND_IDS = ["major", "court", "pip", "oracle"];
  function affinityOf(sl) {
    if (LORE.AFFINITY[sl]) return LORE.AFFINITY[sl];
    var h = hash("aff:" + sl), hunt = KIND_IDS[h % 4], fear = KIND_IDS[(h % 4 + 1 + (h >>> 4) % 3) % 4];
    return { hunt: hunt, fear: fear, why: "" };
  }
  /** What kind of card it is, for affinities: major, court (Page-King), pip (Ace-10) or oracle. */
  function kindOf(c) { return c.suit === "major" ? "major" : c.suit === "oracle" ? "oracle" : COURT[String(c.id).split("_")[0]] ? "court" : "pip"; }
  /** A signature card: one rarity higher (never past Epic; Mythic stays), +1 Power, the deck's own ability. */
  function signify(c) {
    var S = (LORE.SIGNATURES[c.deck] || {})[c.id];
    if (!S) return c;
    var t = RARITIES.indexOf(c.rarity);
    if (t < RARITIES.indexOf("epic")) { c.rarity = RARITIES[t + 1]; c.sigUp = true; }
    c.pow += 1;
    var abId = "sig:" + c.deck + ":" + c.id;
    ABILITIES[abId] = { name: S.name, text: S.text, fx: S.fx, immune: !!S.immune, sig: true };
    c.ab = abId; c.sig = S.name;
    return c;
  }
  /** The lean on a card's own numbers (Power and Harm never below 1). */
  function lean(c) {
    var L = leanOf(c.deck);
    c.base = { heal: 0, guard: 0, cel: 0 };
    if (!L) return c;
    c.pow = Math.max(1, c.pow + (L.pow || 0)); c.harm = Math.max(1, c.harm + (L.harm || 0));
    c.base.heal = L.heal || 0; c.base.guard = L.guard || 0; c.base.cel = L.cel || 0;
    return c;
  }
  /** An oracle card: its rarity, numbers and gift come from its name (the same every time). */
  function makeOracle(deck, id, i, extra) {
    var h = hash(deck.slug + ":" + ((extra && extra.name) || id)), r = h % 100;
    var rar = r < 45 ? "common" : r < 70 ? "uncommon" : r < 90 ? "rare" : "epic";
    var base = { common: [3, 2], uncommon: [4, 3], rare: [5, 3], epic: [6, 4] }[rar];
    var pow = base[0] + (h >>> 8) % 3 - (rar === "common" ? 0 : 1), harm = base[1] + (h >>> 12) % 2;
    var ab = rar === "common" ? null : ORACLE_ABS[(h >>> 16) % ORACLE_ABS.length];
    return finishCard(deck, id, "oracle", i + 1, rar, pow, harm, ab, extra, String(i + 1));
  }
  function finishCard(deck, id, suit, rank, rar, pow, harm, ab, extra, numeral) {
    extra = extra || {};
    var c = { key: deck.slug + ":" + id, deck: deck.slug, deckName: deck.name, kind: deck.kind, id: id, name: extra.name || defaultName(id), suit: suit, rank: rank,
      numeral: numeral, rarity: rar, pow: pow, harm: harm, ab: ab, img: extra.img || "", up: extra.up || "", rev: extra.rev || "", sig: "" };
    var plain = JSON.parse(JSON.stringify(c)); plain.base = { heal: 0, guard: 0, cel: 0 };     // (Easy and Normal: no lean, no signature)
    c = lean(signify(c)); c.plain = plain;
    return c;
  }
  var str = function (v, n) { return typeof v === "string" ? v.slice(0, n) : ""; };
  /** Build the catalogue from the art manifest ({decks: [{name, slug, kind, cards: [{id, name, img, up, rev}]}]}) --
      tarot decks only when complete (78), oracle decks as they are -- or, with none, six tarot decks with plain faces. */
  function useCatalogue(manifest) {
    var decks = [];
    var list = manifest && Array.isArray(manifest.decks) ? manifest.decks : null;
    if (list) list.slice(0, 40).forEach(function (d) {
      if (!d || typeof d.name !== "string" || !Array.isArray(d.cards)) return;
      var kind = d.kind === "oracle" ? "oracle" : "tarot", have = {}, ids = [];
      d.cards.slice(0, 120).forEach(function (c) {
        if (!c || typeof c.id !== "string" || have[c.id]) return;
        if (kind === "tarot" ? CARD_IDS.indexOf(c.id) >= 0 : /^o_[0-9]{1,3}$/.test(c.id)) { have[c.id] = c; ids.push(c.id); }
      });
      if (kind === "tarot" && !CARD_IDS.every(function (id) { return have[id]; })) return;
      if (kind === "oracle" && ids.length < 12) return;
      decks.push({ name: d.name.slice(0, 60), slug: slug(d.slug || d.name), kind: kind, cover: str(d.cover, 80), have: have, ids: kind === "tarot" ? CARD_IDS : ids });
    });
    CAT.art = decks.length > 0;
    if (!decks.length) decks = DEFAULT_DECKS.map(function (n) { return { name: n, slug: slug(n), kind: "tarot", cover: "", have: {}, ids: CARD_IDS }; });
    CAT.decks = []; CAT.cards = []; CAT.index = {}; CAT.byDeck = {}; CAT.byRarity = {};
    RARITIES.forEach(function (r) { CAT.byRarity[r] = []; });
    var P = { cards: [], index: {}, byRarity: {} };
    RARITIES.forEach(function (r) { P.byRarity[r] = []; });
    decks.forEach(function (d) {
      var perk = PERKS[d.slug] || PERK_LIST[hash(d.slug) % PERK_LIST.length];
      var D = { name: d.name, slug: d.slug, kind: d.kind, cover: d.cover, perk: perk, harmony: d.kind === "oracle" ? 3 : 5 };
      CAT.decks.push(D);
      CAT.byDeck[d.slug] = [];
      d.ids.forEach(function (id, i) {
        var h = d.have[id] || {};
        var ex = { name: str(h.name, 60), img: str(h.img, 80), up: str(h.up, 4000), rev: str(h.rev, 4000) };
        var c = d.kind === "oracle" ? makeOracle(D, id, i, ex) : makeCard(D, id, ex);
        var pc = c.plain; delete c.plain;
        CAT.cards.push(c); CAT.index[c.key] = c; CAT.byDeck[d.slug].push(c.key); CAT.byRarity[c.rarity].push(c.key);
        P.cards.push(pc); P.index[pc.key] = pc; P.byRarity[pc.rarity].push(pc.key);
      });
    });
    CAT.deepSet = { cards: CAT.cards, index: CAT.index, byRarity: CAT.byRarity }; CAT.plainSet = P;
    useTier({ diff: F === FEATURES.easy ? "easy" : F === FEATURES.normal ? "normal" : "hard" });
    buildCombos();
    return CAT;
  }
  var card = function (key) { return CAT.index[key] || null; };
  var deckOf = function (sl) { return CAT.decks.filter(function (d) { return d.slug === sl; })[0] || null; };

  // ---- levels: boons unlocked one a level (Cam: "bonuses for each card which is unlocked as you level the card") ----
  // level 2 +1 Power, 3 the suit's own boon, 4 +1 Harm, 5 (the World) +1 Power
  var BOON = { pow: "+1 Power", harm: "+1 Harm", heal: "Win: heal 1 Spirit", guard: "Lose: take 1 less Harm", cel: "Win: +1 celestial" };
  var SUIT_BOON = { wands: "pow", cups: "heal", swords: "harm", pentacles: "guard", major: "cel", oracle: "heal" };
  // the Altar (Cam, 2 Nov: "sacrificing cards that are higher then level one should give bonus xp ... maxed level cards should
  // give a good bonus xp to make it worthwhile training cards up then sacrificing them"): a card's training goes with it
  var SAC = { perLevel: 0.75, maxed: 1.5 };
  /** The XP one copy gives at the Altar: its rarity's worth, +75% for each level above 1, and half as much again when maxed. */
  function sacrificeXp(k, lv) { var c = card(k); if (!c) return 0; lv = clamp(lv | 0 || 1, 1, maxLv(k));
    return Math.round(RARITY[c.rarity].xp * (1 + SAC.perLevel * (lv - 1)) * (lv >= maxLv(k) && lv > 1 ? SAC.maxed : 1)); }
  /** How many copies may go: every spare -- and a trained card's last copy too, if it isn't in your spread. */
  function sacrificeable(s, k) { var H = s.cards[k]; if (!H || !H.n) return 0; return H.n - (H.lv > 1 && s.spread.indexOf(k) < 0 ? 0 : 1); }
  function maxLv(key) { var c = card(key); return c ? RARITY[c.rarity].max : 1; }
  function xpNeed(key, lv) { var c = card(key); return c ? RARITY[c.rarity].need * lv : 99; }
  function boonsOf(key) {
    var c = card(key);
    if (!c) return [];
    var seq = ["pow", SUIT_BOON[c.suit], "harm", "pow"], out = [];
    for (var lv = 2; lv <= RARITY[c.rarity].max; lv++) out.push({ lv: lv, k: seq[lv - 2], text: (lv % 2 === 1 ? (seq[lv - 2] === "pow" ? "+2 Power" : "+1 Power, " + BOON[seq[lv - 2]]) : BOON[seq[lv - 2]]) });
    return out;
  }
  /** A card's numbers at a level: {pow, harm, heal, guard, cel} with its boons so far. */
  function statsOf(key, lv, gilded) {
    var c = card(key), o = { pow: 0, harm: 0, heal: 0, guard: 0, cel: 0 };
    if (!c) return o;
    lv = clamp(lv | 0 || 1, 1, RARITY[c.rarity].max);
    o.pow = c.pow; o.harm = c.harm;
    if (c.base) { o.heal += c.base.heal; o.guard += c.base.guard; o.cel += c.base.cel; }      // the deck's lean
    boonsOf(key).forEach(function (b) { if (b.lv <= lv) o[b.k]++; });
    o.pow += Math.floor((lv - 1) / 2);                   // (the buff audit, 2 Nov: +1 Power at level 3 and 5 as well -- maxed only won 59%; every level overshot to 83%)
    if (gilded) o[SUIT_BOON[c.suit]]++;                   // gilded: the suit's own boon once more (Game Developer, voted 1 Nov)
    return o;
  }

  // ---- the economy (Moonstones) -- grindy on purpose (Cam, 1 Nov); see docs/BALANCE.md --------------------------------
  // win: Moonstones for a win; lose: what a loss costs (Cam, 1 Nov: "if I lose a battle I lose Moonstones ... depends on the
  // difficulty of the battle and the level I am up to"; with none left, nothing is lost)
  var ECON = {
    start: 500, starter: 500, tutorial: 300,
    // (a deck's own booster: 800, Cam 2 Nov -- was 1,500)
    pack: { price: 600, n: 5 }, deckPack: { price: 800, n: 5 }, pity: 40, premium: 2.5,
    // a loss always costs less than the win would have paid (Cam, 1 Nov: "so I just lose less than I would have won"):
    // about half, growing with renown to at most three quarters
    skirmish: { easy: { win: 20, lose: 10 }, normal: { win: 45, lose: 22 }, hard: { win: 90, lose: 45 } }, loseCap: 0.6,
    // a card's XP in a skirmish follows the difficulty (Cam, 1 Nov: "the easy skirmish should earn less card exp per win"):
    // round: for winning its clash, win: more if the battle is won too
    skirmishXp: { easy: { round: 1, win: 0 }, normal: { round: 1, win: 1 }, hard: { round: 2, win: 1 } },
    journey: { first: 100, per: 15, replay: 20, rper: 2, lose: 15, lper: 10 },
    gauntlet: { base: 25, per: 15 },
    keeps: { minCards: 12 },
    streak: { per: 0.05, max: 5 },
    // a knockout (their Spirit to nothing, not a win on points) pays more (Cam, 1 Nov: "we need to gain bonus if we knocked
    // them out"): +25% Moonstones, and every card that won its clash +1 XP
    ko: { gold: 0.25, xp: 1 },
    // a duel with another player on the home network (Cam, 1 Nov: "3 exp for winning a fight, 1 if you lose -- only player
    // vs player"): each card you played, whatever its clash; a knockout adds ECON.ko.xp; never the difficulty's multiplier
    pvp: { win: 3, draw: 2, loss: 1, gold: 20 },
    // low-level cards earn their place (Game Developer, Q10, Cam 1 Nov: all recommended): the Underdog -- a card meeting a
    // higher-level card gets +1 Might a level below, up to +2, and its round's XP twice if it wins; the Apprentice's
    // Circuit -- a weekly road of 7 Pages where a spread's levels add up to at most cap; first-pass pay first + per x
    // (station - 1), replays replay; a loss costs nothing; the end: a Seal and a card from a deck you're completing
    underdog: { per: 1, max: 2 },
    circuit: { n: 7, cap: 12, first: 60, per: 15, replay: 15 },      // gold: the winner's Moonstones (Cam, 1 Nov: "the loser loses nothing")
    // the player's own level (Cam, 1 Nov: "player levels ... when the player levels up they get some Moonstones and 1 random
    // card"): XP from every battle (a win more, a knockout a little more; the roads and the Trial count most); the next
    // level needs need + per x (level - 1); each level pays gold + goldPer x level and one card drawn like a booster's
    player: { win: 10, draw: 5, loss: 4, ko: 3, max: 100, need: 60, per: 20, gold: 50, goldPer: 10,
      mode: { journey: 1.5, trial: 1.5, circuit: 1.3, gauntlet: 1.2, keeps: 1.2, lan: 1.2, skirmish: 1 }, skirmish: { easy: 0.6, normal: 1, hard: 1.4 } },                    // each win in a row: +5% Moonstones, up to +25% (a loss resets it)
    omen: { every: 7, gift: 3 },                      // the daily card 7 days running: 3 free cards (softened from a booster, Q9)
    mulligan: 1,                                      // the celestials a mulligan costs
    // the difficulty, chosen when a save begins (Cam, PT61): mulligans a battle (each offers 2 random cards from the rest
    // of the deck), money and card XP; Free is the sandbox -- everything open, the testing tools, no achievements
    diff: {
      free: { name: "Free", mull: 4, gold: 1.5, xp: 1, ach: false },
      easy: { name: "Easy", mull: 4, gold: 1.25, xp: 1, ach: true },
      normal: { name: "Normal", mull: 2, gold: 1, xp: 1.25, ach: true },
      hard: { name: "Hard", mull: 1, gold: 0.8, xp: 1.75, ach: true }     // (softened, Q12 q4: was no mulligans, 0.6x)
    },
    mullOffer: 2,
    gild: { common: 100, uncommon: 150, rare: 250, epic: 400, mythic: 800 },   // + one spare copy
    asc: { max: 10, first: 0.3, per: 0.1 },           // Ascension: a first pass at level N pays (0.3 + 0.1N) of the station's first-win pay                          // Play for Keeps: the cards are the stakes, never Moonstones
    trial: { win: 200, lose: 60 }, mission: 50, levelFee: 40, renownLoss: 0.5,
    xp: { round: 1, win: 1, draw: 0 }                 // a card's XP: a round it wins (+1), and +1 more if the battle is won too
  };
  function deckPrice(s, sl) {
    var sum = 0;
    (CAT.byDeck[sl] || []).forEach(function (k) { if (!owned(s, k)) sum += RARITY[card(k).rarity].value; });
    return Math.round(sum * ECON.premium / 10) * 10;
  }

  // ---- the battle's numbers ---------------------------------------------------------------------------------------
  var A11Y = { text: [1, 1.12, 1.25, 1.4, 1.6], read: ["parchment", "sepia", "night", "contrast"], bookText: [0.9, 1, 1.15, 1.3, 1.5], lines: ["normal", "relaxed", "spacious"], bookFont: ["serif", "plain"] };
  var DECK = 8, HAND = 4, ROUNDS = 4, SPIRIT = 18, CELESTIALS = 12, MIGHT_PER_CEL = 2, EDGE = 2;
  var FURY = { cost: 2, harm: 2 };
  var REVERSED = 1;                                     // a reversed card's Power lost (Q11, 2 Nov)                     // Cam: "a fury which takes celestials and increases the damage"

  // ---- combos: the book of every one there is, filled in as you first wake each in battle ---------------------------
  var COMBOS = [];
  var EL = { wands: ["pow", "Kindled", "+{n} Power to your Wands", "Fire answers fire: Wands together burn brighter."],
    cups: ["heal", "Flowing", "Your Cups heal {n} Spirit on a win", "Water gathers: Cups together refill what was spent."],
    swords: ["harm", "Sharpened", "+{n} Harm to your Swords", "Air hones steel: Swords together cut deeper."],
    pentacles: ["guard", "Grounded", "Your Pentacles take {n} less Harm", "Earth holds: Pentacles together stand their ground."] };
  var CROWNS = { king: ["Council of Kings", "+1 Harm to every card", "Four thrones in agreement."], queen: ["Coven of Queens", "Heal 2 Spirit on every win", "Four queens keep the hearth."],
    knight: ["The Cavalry", "+2 Power to every card", "Four riders, one charge."], page: ["The Heralds", "+2 celestials", "Four messengers bring the stars."] };
  function buildCombos() {
    COMBOS = [];
    SUITS.forEach(function (su) {
      var e = EL[su];
      COMBOS.push({ id: "suit-" + su, group: "Elements", name: e[1] + " " + SUIT[su].name, need: "3 or more " + SUIT[su].name + " in your spread", text: e[2].replace("{n}", "1") + " (+2 with five or more)", lore: e[3] });
    });
    SUITS.forEach(function (su) { COMBOS.push({ id: "pure-" + su, group: "Elements", name: "Pure " + SUIT[su].element, need: "All 8 cards " + SUIT[su].name, text: "+2 celestials, on top of the suit's own", lore: "One element, unmixed." }); });
    SUITS.forEach(function (su) { COMBOS.push({ id: "court-" + su, group: "Courts", name: "Royal Court of " + SUIT[su].name, need: "The Page, Knight, Queen and King of " + SUIT[su].name + " (any decks)", text: "+1 Power to every card", lore: "A whole court, assembled." }); });
    Object.keys(CROWNS).forEach(function (r) { COMBOS.push({ id: "crown-" + r, group: "Courts", name: CROWNS[r][0], need: "A " + r[0].toUpperCase() + r.slice(1) + " of every suit", text: CROWNS[r][1], lore: CROWNS[r][2] }); });
    COMBOS.push({ id: "path", group: "Major Arcana", name: "The Path", need: "Three Majors in a row (say VII, VIII, IX)", text: "+2 Power to those Majors", lore: "Steps of the Fool's road, walked in order." });
    COMBOS.push({ id: "trinity", group: "Major Arcana", name: "Celestial Trinity", need: "The Star, the Moon and the Sun", text: "+2 celestials", lore: "The three lights of the sky." });
    COMBOS.push({ id: "luck", group: "Humble Cards", name: "Beginner's Luck", need: "Four or more Lv1 cards in your spread", text: "+2 celestials", lore: "Fresh hands, and the stars lean close to watch." });
    COMBOS.push({ id: "novice", group: "Humble Cards", name: "The Novice's Road", need: "All eight cards Lv1 or Lv2", text: "+1 Harm to every card", lore: "No one here has learned to hold back." });
    COMBOS.push({ id: "journey", group: "Major Arcana", name: "The Journey", need: "The Fool and the World", text: "+1 Power to every card", lore: "The beginning and the end, together." });
    CAT.decks.forEach(function (d) { if (FULL[d.slug]) COMBOS.push({ id: "full-" + d.slug, group: "Full Spreads", name: FULL[d.slug].name, need: "All eight cards from " + d.name, text: FULL[d.slug].text, lore: FULL[d.slug].lore }); });
    CAT.decks.forEach(function (d) { COMBOS.push({ id: "harmony-" + d.slug, group: d.kind === "oracle" ? "Oracle Circles" : "Deck Harmony", name: d.perk.name, need: d.harmony + " or more cards from " + d.name, text: d.perk.text, lore: "The deck remembers itself." }); });
  }
  buildCombos();
  useCatalogue(null);

  /** What a deck of 8 wakes: {list: [{id, name, text}], per: [{pow, harm, heal, guard}] by card, side: {...}} */
  // the balance bench's switch (tools/audit_buffs.js): one combo, perk, ability, lean or Seal at a time can be set aside to
  // measure what it's worth -- never set in play
  var BAL_OFF = {}, BAL_ANY = false;
  function balanceOff(o) { BAL_OFF = o || {}; BAL_ANY = Object.keys(BAL_OFF).length > 0; }
  function resonance(keys, levels) {
    var cs = keys.map(card).filter(Boolean), per = cs.map(function () { return { pow: 0, harm: 0, heal: 0, guard: 0 }; });
    var side = { cel: 0, spirit: 0, hex: 0, heal: 0, guard: 0 }, list = [];
    var prev = BAL_ANY ? JSON.stringify([per, side]) : "";
    var add = function (id) {
      if (BAL_ANY) {                                                // (the bench: undo this combo's effect, as if it never woke)
        if (BAL_OFF[id]) { var r = JSON.parse(prev); per.forEach(function (p, i) { Object.keys(p).forEach(function (k) { p[k] = r[0][i][k]; }); }); Object.keys(side).forEach(function (k) { if (!(k in r[1])) delete side[k]; }); Object.keys(r[1]).forEach(function (k) { side[k] = r[1][k]; }); return; }
        prev = JSON.stringify([per, side]);
      }
      var C0 = COMBOS.filter(function (x) { return x.id === id; })[0]; list.push({ id: id, name: C0 ? C0.name : id, text: C0 ? C0.text : "" }); };
    SUITS.forEach(function (su) {
      var n = cs.filter(function (c) { return c.suit === su; }).length;
      if (n < 3) return;
      var amt = n >= 5 ? 2 : 1;                                     // (the buff audit, 2 Nov: five or more doubles it)
      cs.forEach(function (c, i) { if (c.suit === su) per[i][EL[su][0]] += amt; });
      add("suit-" + su);
      if (n >= DECK) { side.cel += 2; add("pure-" + su); }
    });
    var has = function (id) { return cs.some(function (c) { return c.id === id; }); };
    SUITS.forEach(function (su) {
      if (["page", "knight", "queen", "king"].every(function (r) { return has(r + "_" + su); })) { per.forEach(function (p) { p.pow += 1; }); add("court-" + su); }
    });
    Object.keys(CROWNS).forEach(function (r) {
      if (!SUITS.every(function (su) { return has(r + "_" + su); })) return;
      if (r === "king") per.forEach(function (p) { p.harm += 1; });
      if (r === "queen") side.heal += 2;
      if (r === "knight") per.forEach(function (p) { p.pow += 2; });
      if (r === "page") side.cel += 2;
      add("crown-" + r);
    });
    var majors = cs.map(function (c, i) { return c.suit === "major" ? { n: c.rank, i: i } : null; }).filter(Boolean);
    var hasM = function (n) { return majors.some(function (m) { return m.n === n; }); }, inPath = {};
    majors.forEach(function (m) { if (hasM(m.n + 1) && hasM(m.n + 2)) inPath[m.n] = inPath[m.n + 1] = inPath[m.n + 2] = 1; });
    if (Object.keys(inPath).length) { majors.forEach(function (m) { if (inPath[m.n]) per[m.i].pow += 2; }); add("path"); }
    if (hasM(17) && hasM(18) && hasM(19)) { side.cel += 2; add("trinity"); }
    if (hasM(0) && hasM(21)) { per.forEach(function (p) { p.pow += 1; }); add("journey"); }
    // the humble cards (Q10): only when the levels are known (a battle, the spread on the Cards page)
    if (Array.isArray(levels) && levels.length === cs.length && cs.length === DECK) {
      if (levels.filter(function (l) { return (l | 0) <= 1; }).length >= 4) { side.cel += 2; add("luck"); }
      if (levels.every(function (l) { return (l | 0) <= 2; })) { per.forEach(function (p) { p.harm += 1; }); add("novice"); }
    }
    var byDeck = {};
    cs.forEach(function (c) { byDeck[c.deck] = (byDeck[c.deck] || 0) + 1; });
    Object.keys(byDeck).forEach(function (d) {
      var D = deckOf(d);
      if (!F.harmony || !D || byDeck[d] < D.harmony) return;
      var P = D.perk.side;
      if (P.pow) per.forEach(function (p) { p.pow += P.pow; });
      if (P.harm) per.forEach(function (p) { p.harm += P.harm; });
      if (P.guard) per.forEach(function (p) { p.guard += P.guard; });
      side.cel += P.cel || 0; side.spirit += P.spirit || 0; side.hex += P.hex || 0; side.heal += P.heal || 0;
      add("harmony-" + d);
    });
    // a Full Spread: all eight from one deck
    if (F.full && cs.length === DECK && cs.every(function (c) { return c.deck === cs[0].deck; }) && FULL[cs[0].deck]) {
      var fd = cs[0].deck;
      side.full = fd;
      if (fd === "old-school-tarot") cs.forEach(function (c, i) { if (c.suit === "major") per[i].pow += 3; });
      if (fd === "ryder-smith") per.forEach(function (p) { p.pow += 1; p.harm += 1; });
      if (fd === "the-rooted-woman-oracle") side.spirit += 4;
      add("full-" + fd);
    }
    return { list: list, per: per, side: side };
  }

  // ---- a new player and keeping a save sound ---------------------------------------------------------------------
  function empty() { return { v: 1, game: "neuroarcana" }; }
  var owned = function (s, k) { return !!(s.cards[k] && s.cards[k].n > 0); };
  function fresh(now, seed) {
    // the tutorial begins with Orrin's Starter Deck still to buy (Cam: "purchasing first deck")
    return { v: 1, game: "neuroarcana", made: now, rng: (seed != null ? seed : (now ^ 0x9e3779b9)) | 0, moon: ECON.start, cards: {}, spread: [],
      stats: { battles: 0, wins: 0, losses: 0, draws: 0, packs: 0, harm: 0 }, camp: { fool: { cleared: 0, best: 0 }, oracle: { cleared: 0, best: 0 } }, unlocks: { oracle: false, lenormand: false }, streak: 0, omenRun: { n: 0, day: "" }, decks: [], gauntlet: null, daily: null, missions: null,
      trial: null, journal: [], pity: 0, battle: null, combos: {}, tut: 0, tutPaid: false, prefs: { music: true, vol: 0.5, sfx: true, motion: true }, seen: {} };
  }
  function num(v, d, lo, hi) { v = typeof v === "number" && isFinite(v) ? v : d; return clamp(v, lo, hi); }
  /** A loaded save made sound: wrong types replaced, sizes capped, unknown cards kept (a deck may come back) but never
      played. Saves from before v2: the deck filled to 8, and the combos already in play written into the book. */
  function normal(state) {
    if (!state || typeof state !== "object" || state.game !== "neuroarcana" || !state.made) return empty();
    var s = JSON.parse(JSON.stringify(state));
    s.rng = (s.rng | 0) || 1;
    s.moon = Math.floor(num(s.moon, 0, 0, 1e9));
    s.cards = s.cards && typeof s.cards === "object" && !Array.isArray(s.cards) ? s.cards : {};
    Object.keys(s.cards).slice(0, 5000).forEach(function (k) {
      var c = s.cards[k];
      if (!c || typeof c !== "object") { delete s.cards[k]; return; }
      c.n = Math.floor(num(c.n, 0, 0, 9999)); c.lv = Math.floor(num(c.lv, 1, 1, 5)); c.xp = Math.floor(num(c.xp, 0, 0, 9999));
      if (c.g !== undefined) c.g = c.g === true;
      if (card(k)) c.lv = Math.min(c.lv, maxLv(k));
    });
    var oldSpread = Array.isArray(s.spread) ? s.spread.filter(function (k) { return typeof k === "string" && card(k); }) : [];
    s.spread = oldSpread.filter(function (k, i, a) { return owned(s, k) && a.indexOf(k) === i; }).slice(0, DECK);
    if (s.combos == null || typeof s.combos !== "object" || Array.isArray(s.combos)) {
      // (v1 saves: Cam's hand had Kindled Wands and Sharpened Swords awake -- two of a suit was enough then)
      s.combos = {};
      if (s.stats && s.stats.battles > 0) SUITS.forEach(function (su) { if (oldSpread.filter(function (k) { return card(k).suit === su; }).length >= 2) s.combos["suit-" + su] = 1; });
    }
    if (s.spread.length < DECK && Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }).length >= DECK && !(s.battle && !s.battle.over)) s.spread = fillDeck(s, s.spread);
    s.stats = s.stats && typeof s.stats === "object" ? s.stats : {};
    ["battles", "wins", "losses", "draws", "packs", "harm"].forEach(function (k) { s.stats[k] = Math.floor(num(s.stats[k], 0, 0, 1e9)); });
    // the roads (v2 saves had s.journey.cleared: the Fool's Journey)
    var oldJ = s.journey && typeof s.journey === "object" ? Math.floor(num(s.journey.cleared, 0, 0, 21)) : 0;
    s.camp = s.camp && typeof s.camp === "object" ? s.camp : { fool: { cleared: oldJ, best: oldJ } };
    Object.keys(CAMPAIGNS).forEach(function (id) {
      var J = s.camp[id] && typeof s.camp[id] === "object" ? s.camp[id] : {}, n = CAMPAIGNS[id].n;
      var ap = J.ascPass && typeof J.ascPass === "object" ? J.ascPass : {}, apc = {};
      Object.keys(ap).forEach(function (a) { if (/^([1-9]|10)$/.test(a)) apc[a] = Math.floor(num(ap[a], 0, 0, n)); });
      s.camp[id] = { cleared: Math.floor(num(J.cleared, 0, 0, n)), best: Math.floor(num(J.best, 0, 0, n)), asc: Math.floor(num(J.asc, 0, 0, ECON.asc.max)),
        ascBest: Math.floor(num(J.ascBest, 0, 0, ECON.asc.max)), ascPass: apc };
      if (s.camp[id].best >= n && !s.camp[id].ascBest) s.camp[id].ascBest = 1;       // (the road beaten before Ascension existed)
      s.camp[id].asc = Math.min(s.camp[id].asc, s.camp[id].ascBest);
      s.camp[id].best = Math.max(s.camp[id].best, s.camp[id].cleared);
    });
    delete s.journey;
    s.unlocks = s.unlocks && typeof s.unlocks === "object" ? s.unlocks : {};
    s.unlocks = { oracle: !!s.unlocks.oracle || s.camp.fool.best >= 21, lenormand: !!s.unlocks.lenormand };
    s.streak = Math.floor(num(s.streak, 0, 0, 999));
    s.ngp = Math.floor(num(s.ngp, 0, 0, NGP.maxCycle));
    s.legacy = Array.isArray(s.legacy) ? s.legacy.filter(function (b) { return LEGACY.some(function (x) { return x.id === b; }); }) : [];
    // the Library (2 Nov): what the page tells the rules of the codex, for the achievements -- {pages read, books finished}
    s.lib = s.lib && typeof s.lib === "object" ? { pages: Math.floor(num(s.lib.pages, 0, 0, 5000)), books: (Array.isArray(s.lib.books) ? s.lib.books : []).filter(function (b) { return typeof b === "string" && /^[a-z]{1,20}$/.test(b); }).slice(0, 40) } : { pages: 0, books: [] };
    s.ach = s.ach && typeof s.ach === "object" && !Array.isArray(s.ach) ? s.ach : {};
    ["bestStreak", "gauntletBest", "trialWins", "keepsWon", "sealsSprung", "moonWon", "moonLost"].forEach(function (k) { s.stats[k] = Math.floor(num(s.stats[k], 0, 0, 1e12)); });
    // the profile's numbers (Cam, 1 Nov): by mode, by card, by deck
    ["byMode", "played", "cardWins", "decks"].forEach(function (k) { if (!s.stats[k] || typeof s.stats[k] !== "object" || Array.isArray(s.stats[k])) s.stats[k] = {}; });
    // the save's kind (Cam, 1 Nov: "a designated Sandbox save (blocks all achievements)"): a save that used the testing
    // tools before saves had kinds is a sandbox one; a sandbox stays a sandbox
    s.diff = ECON.diff[s.diff] ? s.diff : s.kind === "sandbox" || s.sandbox ? "free" : "normal";
    s.kind = s.diff === "free" ? "sandbox" : "normal";
    useTier(s);
    if (s.battle && s.battle.tier && FEATURES[s.battle.tier]) useTier({ diff: s.battle.tier });
    if (s.diff === "free" && !s.freeOpen) freeOpen(s);
    s.name = typeof s.name === "string" ? s.name.replace(/\s+/g, " ").trim().slice(0, 30) : "";
    s.face = typeof s.face === "string" && (card(s.face) || isBadge(s.face)) ? s.face : null;
    var sl = s.seals && typeof s.seals === "object" && !Array.isArray(s.seals) ? s.seals : {};
    s.seals = {};
    Object.keys(sl).forEach(function (id) { if (SEAL[id]) { var n = Math.floor(num(sl[id], 0, 0, 999)); if (n) s.seals[id] = n; } });
    s.sealSet = SEAL[s.sealSet] && s.seals[s.sealSet] ? s.sealSet : null;
    s.omenRun = s.omenRun && typeof s.omenRun === "object" ? { n: Math.floor(num(s.omenRun.n, 0, 0, 9999)), day: String(s.omenRun.day || "") } : { n: 0, day: "" };
    if (!s.omenRun.n && s.daily && s.daily.day) s.omenRun = { n: 1, day: s.daily.day };      // (drawn before the run was counted)
    // saved decks (Cam: "I want to be able to save spreads ... switch through past ones")
    s.decks = Array.isArray(s.decks) ? s.decks.filter(function (d) { return d && typeof d.id === "string" && typeof d.name === "string" && Array.isArray(d.keys); }).slice(0, 24) : [];
    s.decks.forEach(function (d) { d.name = d.name.slice(0, 40); d.keys = d.keys.filter(function (k) { return typeof k === "string"; }).slice(0, DECK); });
    s.journal = Array.isArray(s.journal) ? s.journal.filter(function (e) { return e && typeof e === "object" && typeof e.id === "string"; }).slice(-2000) : [];
    // the Book of Keepers (Story Writer, voted 1 Nov): keepers beaten before it existed get their pages now
    if (!s.keeperBook || typeof s.keeperBook !== "object") {
      s.keeperBook = {};
      Object.keys(CAMPAIGNS).forEach(function (id) { for (var st = 1; st <= s.camp[id].best; st++) bookPage(s, id, st, num(s.made, Date.now(), 0, 9e15)); });
    }
    s.journal.forEach(function (e) { e.notes = typeof e.notes === "string" ? e.notes.slice(0, 4000) : ""; e.cards = Array.isArray(e.cards) ? e.cards.slice(0, 12) : []; });
    // the keepers' spreads (2 Nov): which one each keeper plays next, and which you've faced
    ["keeperRot", "keeperFaced"].forEach(function (k) {
      var o = s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) ? s[k] : {};
      s[k] = {};
      Object.keys(o).slice(0, 200).forEach(function (x) { if (/^(fool|oracle):\d+(:\d)?$/.test(x)) s[k][x] = Math.floor(num(o[x], 0, 0, 1e6)); });
    });
    s.pity = Math.floor(num(s.pity, 0, 0, 999));
    s.tut = s.tut == null ? null : Math.floor(num(s.tut, 0, 0, 99));
    s.tutPaid = !!s.tutPaid;
    s.prefs = s.prefs && typeof s.prefs === "object" ? s.prefs : {};
    s.prefs = { music: s.prefs.music !== false, vol: num(s.prefs.vol, 0.5, 0, 1), sfx: s.prefs.sfx !== false, motion: s.prefs.motion !== false,    // (the frames are always on now: Cam, 2 Nov)
      timer: [0, 15, 20, 30, 45, 60].indexOf(s.prefs.timer) >= 0 ? s.prefs.timer : 30, text: A11Y.text.indexOf(s.prefs.text) >= 0 ? s.prefs.text : 1,
      // accessibility and reading (Cam, 2 Nov: "an accessibility menu with reading settings ... this will make the app better for everyone")
      read: A11Y.read.indexOf(s.prefs.read) >= 0 ? s.prefs.read : "parchment", bookText: A11Y.bookText.indexOf(s.prefs.bookText) >= 0 ? s.prefs.bookText : 1,
      lines: A11Y.lines.indexOf(s.prefs.lines) >= 0 ? s.prefs.lines : "normal", bookFont: A11Y.bookFont.indexOf(s.prefs.bookFont) >= 0 ? s.prefs.bookFont : "serif",
      hc: s.prefs.hc === true, cb: s.prefs.cb === true, wide: s.prefs.wide === true, focus: s.prefs.focus === true };
    s.seen = s.seen && typeof s.seen === "object" ? s.seen : {};
    if (typeof s.plv !== "number") {
      s.plv = 1; s.pxp = s.made ? Math.round((s.stats.wins || 0) * ECON.player.win + (s.stats.losses || 0) * ECON.player.loss + (s.stats.draws || 0) * ECON.player.draw) : 0;
      while (s.plv < ECON.player.max && s.pxp >= plvNeed(s.plv)) { s.pxp -= plvNeed(s.plv); s.plv++; }
    }
    s.plv = Math.floor(num(s.plv, 1, 1, ECON.player.max)); s.pxp = Math.floor(num(s.pxp, 0, 0, 1e7));
    if (s.battle && (typeof s.battle !== "object" || !Array.isArray(s.battle.sides) || s.battle.v !== 2)) s.battle = null;
    if (s.gauntlet && typeof s.gauntlet !== "object") s.gauntlet = null;
    return s;
  }

  // ---- collecting ------------------------------------------------------------------------------------------------
  function useSeal(s, id) { s.stats.sealsSprung++; if (s.seals[id]) { s.seals[id]--; if (!s.seals[id]) { delete s.seals[id]; if (s.sealSet === id) s.sealSet = null; } } }
  function keepsCount(s) { return Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }).length; }
  function addCard(s, k) {
    var c = s.cards[k];
    if (!c) c = s.cards[k] = { n: 0, lv: 1, xp: 0 };
    c.n++;
    return c.n === 1;
  }
  /** Is a deck open to this player? Tarot always; the oracle decks once the World is beaten (Cam, 1 Nov). */
  function deckOpen(s, sl) { var D = deckOf(sl); return !!D && (D.kind === "tarot" || !!(s && s.unlocks && s.unlocks.oracle)); }
  /** One card as a booster draws it: a rarity by the odds, then any card of it (from one deck if given; else from the
      decks open to the player -- tarot only, until the oracle decks are won). */
  function drawCard(o, deckSlug, oracleOpen) {
    var x = rand(o), acc = 0, rar = "common";
    for (var i = 0; i < RARITIES.length; i++) { acc += RARITY[RARITIES[i]].odds; if (x < acc) { rar = RARITIES[i]; break; } }
    var from = function (r) { return deckSlug ? (CAT.byDeck[deckSlug] || []).filter(function (k) { return card(k).rarity === r; }) : CAT.byRarity[r].filter(function (k) { return oracleOpen || card(k).kind !== "oracle"; }); };
    var pool = from(rar);
    for (var t = RARITY[rar].tier; t >= 0 && !pool.length; t--) pool = from(RARITIES[t]);   // (an oracle deck has no mythic)
    return pool[Math.floor(rand(o) * pool.length)];
  }
  // ---- the Apprentice's Circuit (Q10): a new week (from Monday) brings seven new Pages, each on their suit's field ----
  function circuitWeek(now) { return Math.floor((now / 864e5 + 3) / 7); }
  function circuitStations(week) {
    var o = { rng: hash("circuit:" + week) | 0 }, pages = CAT.cards.filter(function (c) { return c.kind === "tarot" && /^page_/.test(c.id); }).map(function (c) { return c.key; }), out = [];
    // the suits: all four, then three more, never the same twice running
    var suits = SUITS.slice(); shuffle(o, suits);
    while (suits.length < ECON.circuit.n) { var nx = pickOf(o, SUITS.filter(function (su) { return su !== suits[suits.length - 1]; })); suits.push(nx); }
    for (var st = 1; st <= ECON.circuit.n; st++) {
      var pool = pages.filter(function (k) { return card(k).suit === suits[st - 1]; });
      if (!pool.length) pool = pages;
      if (!pool.length) break;
      var k = pickOf(o, pool), c = card(k);
      pages = pages.filter(function (x) { return x !== k; });
      out.push({ n: st, key: k, name: c.name, deck: c.deckName, field: !F.fields ? null : FIELDS.filter(function (f) { return FIELD[f].suit === c.suit; })[0] || null,
        power: 0.15 + 0.1 * (st - 1), pay: ECON.circuit.first + ECON.circuit.per * (st - 1) });
    }
    return out;
  }
  /** This week's run (a new week starts it again). */
  function circuitNow(s, now) {
    var wk = circuitWeek(now);
    if (!s.circuit || s.circuit.week !== wk) s.circuit = { week: wk, cleared: 0, humble: true };
    return s.circuit;
  }
  var spreadLevels = function (s, keys) { return (keys || s.spread).reduce(function (a, k) { return a + (s.cards[k] ? s.cards[k].lv : 1); }, 0); };
  /** The best spread under the Circuit's cap: the strongest cards, as long as eight still fit. */
  function humbleSpread(s) {
    var mine = Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); });
    mine.sort(function (a, b) { return cardScore(s, b) - cardScore(s, a) || s.cards[a].lv - s.cards[b].lv || (a < b ? -1 : 1); });
    var out = [], sum = 0;
    mine.forEach(function (k) { var lv = s.cards[k].lv; if (out.length < DECK && sum + lv + (DECK - out.length - 1) <= ECON.circuit.cap) { out.push(k); sum += lv; } });
    return out.length === DECK ? out : null;
  }
  /** The XP the player's level needs to reach the next. */
  function plvNeed(lv) { return ECON.player.need + ECON.player.per * (lv - 1); }
  /** XP for the player; each level up pays Moonstones and one card (events: playerXp, then levelUp for each level). */
  function playerXp(s, add) {
    add = Math.max(0, Math.round(add));
    if (!add || s.plv >= ECON.player.max) return [];
    var ev = [], from = s.plv;
    s.pxp += add;
    while (s.plv < ECON.player.max && s.pxp >= plvNeed(s.plv)) {
      s.pxp -= plvNeed(s.plv); s.plv++;
      var gold = ECON.player.gold + ECON.player.goldPer * s.plv, k = drawCard(s, null, !!(s.unlocks && s.unlocks.oracle));
      s.moon += gold;
      ev.push({ kind: "levelUp", lv: s.plv, gold: gold, card: { key: k, isNew: addCard(s, k) } });
    }
    if (s.plv >= ECON.player.max) s.pxp = 0;
    ev.unshift({ kind: "playerXp", add: add, from: from, lv: s.plv, xp: s.pxp, need: s.plv >= ECON.player.max ? 0 : plvNeed(s.plv) });
    return ev;
  }
  /** What a finished battle is worth to the player's level (res: from that player's side). */
  function battlePxp(mode, diff, res, ko) {
    var P = ECON.player, base = res === "win" ? P.win + (ko ? P.ko : 0) : res === "draw" ? P.draw : P.loss;
    return base * (P.mode[mode] || 1) * (mode === "skirmish" ? P.skirmish[diff] || 1 : 1);
  }
  function openPack(s, deckSlug) {
    var n = deckSlug ? ECON.deckPack.n : ECON.pack.n, got = [];
    for (var i = 0; i < n; i++) got.push(drawCard(s, deckSlug, !!(s.unlocks && s.unlocks.oracle)));
    var world = got.some(function (k) { return card(k).id === "world"; }), D = deckSlug ? deckOf(deckSlug) : null;
    if (!D || D.kind === "tarot") {
      s.pity = world ? 0 : s.pity + 1;
      if (!world && s.pity >= ECON.pity) {
        var sl = deckSlug || pickOf(s, CAT.decks.filter(function (d) { return d.kind === "tarot"; })).slug;
        got[got.length - 1] = sl + ":world"; s.pity = 0;
      }
    }
    got.sort(function (a, b) { return RARITY[card(a).rarity].tier - RARITY[card(b).rarity].tier; });
    return got.map(function (k) { return { key: k, isNew: addCard(s, k) }; });
  }
  /** Free (the sandbox): everything open -- both roads to their ends, the oracle decks, Ascension X, Moonstones aplenty. */
  function freeOpen(s) {
    s.freeOpen = true; s.unlocks.oracle = true; s.moon += 100000;
    ["fool", "oracle"].forEach(function (id) { var n = CAMPAIGNS[id].n; s.camp[id].cleared = n; s.camp[id].best = n; });
    s.camp.fool.ascBest = ECON.asc.max;
  }
  // ---- New Game+ (Cam, 1 Nov: "a new game plus game mode ... after beating the World we can start a new game, come up
  // with ideas of what bonus you can get when you start again"): a new save, the same name, picture and difficulty, one
  // cycle further on -- keepers stronger (+1 Power, +2 Spirit a cycle, up to 5), Journey wins +20% a cycle -- and two
  // Legacy boons carried over from the save that beat the World
  var NGP = { boons: 2, maxCycle: 5, pay: 0.2, pow: 1, spirit: 2 };
  var LEGACY = [
    { id: "heirloom", name: "Heirloom Spread", text: "Your current spread of eight comes with you (back to level 1), instead of the Starter Spread" },
    { id: "inherit", name: "Inheritance", text: "10% of your Moonstones (up to 5,000)" },
    { id: "pages", name: "Remembered Pages", text: "The Combo Book and the Book of Keepers stay written" },
    { id: "starlight", name: "Starlight", text: "+1 celestial in every battle" },
    { id: "friends", name: "Old Friends", text: "The first win against each keeper pays double" },
    { id: "gilded", name: "Gilded Memory", text: "Your best gilded card (or best maxed one) comes with you, maxed and gilded" }
  ];
  /** The new save a New Game+ begins: from a save that has beaten the World, and the boons chosen. */
  function newGamePlus(old, boons, now, seed, diff) {
    var o = normal(old);
    if (!o.made || o.camp.fool.best < CAMPAIGNS.fool.n) return { error: "New Game+ opens when you beat the World." };
    boons = (Array.isArray(boons) ? boons : []).filter(function (b, i, a) { return LEGACY.some(function (x) { return x.id === b; }) && a.indexOf(b) === i; });
    if (boons.length !== NGP.boons) return { error: "Choose " + NGP.boons + " Legacy boons." };
    var s = fresh(now, seed);
    s.diff = o.diff === "free" ? "free" : ECON.diff[diff] && diff !== "free" ? diff : o.diff;   // (another layer may be chosen; a sandbox stays one)
    s.kind = o.kind; s.name = o.name; s.face = o.face; s.prefs = JSON.parse(JSON.stringify(o.prefs));
    s.plv = o.plv; s.pxp = o.pxp;                                    // (the player's level goes on with them)
    s.ngp = Math.min(NGP.maxCycle, (o.ngp || 0) + 1); s.legacy = boons.slice(); s.tut = null; s.tutPaid = true;
    if (s.diff === "free") freeOpen(s);
    if (boons.indexOf("heirloom") >= 0 && o.spread.length === DECK) { o.spread.forEach(function (k) { s.cards[k] = { n: 1, lv: 1, xp: 0 }; }); s.spread = o.spread.slice(); s.moon = 0; }
    if (boons.indexOf("inherit") >= 0) s.moon += Math.min(5000, Math.floor(o.moon * 0.1));
    if (boons.indexOf("pages") >= 0) { s.combos = JSON.parse(JSON.stringify(o.combos)); s.journal = o.journal.filter(function (e) { return e.kind === "keeper"; }).map(function (e) { return JSON.parse(JSON.stringify(e)); }); s.keeperBook = JSON.parse(JSON.stringify(o.keeperBook || {})); }
    if (boons.indexOf("gilded") >= 0) {
      var pool = Object.keys(o.cards).filter(function (k) { return card(k) && o.cards[k].n > 0 && (o.cards[k].g || o.cards[k].lv >= maxLv(k)); })
        .sort(function (a, b) { return (o.cards[b].g ? 1 : 0) - (o.cards[a].g ? 1 : 0) || RARITY[card(b).rarity].tier - RARITY[card(a).rarity].tier; });
      if (pool.length) { var gk = pool[0], had = s.cards[gk]; s.cards[gk] = { n: had ? had.n : 1, lv: maxLv(gk), xp: 0, g: true }; s.legacyCard = gk; }
    }
    return { state: s };
  }
  /** A gift of n cards drawn as a Starlight booster draws them (no World pity -- a gift isn't a booster). */
  function giftCards(s, n) {
    var got = [];
    for (var i = 0; i < n; i++) got.push(drawCard(s, null, !!(s.unlocks && s.unlocks.oracle)));
    got.sort(function (a, b) { return RARITY[card(a).rarity].tier - RARITY[card(b).rarity].tier; });
    return got.map(function (k) { return { key: k, isNew: addCard(s, k) }; });
  }
  /** Orrin's Starter Deck: 8 different cards -- three of one suit (so a combo wakes), three more commons, an uncommon and a rare. */
  function starterDeck(s) {
    var su = pickOf(s, SUITS), out = [];
    var pickFrom = function (pred) { var pool = CAT.cards.filter(function (c) { return c.kind === "tarot" && pred(c) && !out.some(function (k) { return card(k).id === c.id; }); }); return pool[Math.floor(rand(s) * pool.length)].key; };
    for (var i = 0; i < 3; i++) out.push(pickFrom(function (c) { return c.rarity === "common" && c.suit === su; }));
    for (var j = 0; j < 3; j++) out.push(pickFrom(function (c) { return c.rarity === "common" && c.suit !== su; }));
    out.push(pickFrom(function (c) { return c.rarity === "uncommon"; }));
    out.push(pickFrom(function (c) { return c.rarity === "rare"; }));
    return out;
  }
  function deckDone(s, sl) { var ks = CAT.byDeck[sl] || []; return ks.length > 0 && ks.every(function (k) { return owned(s, k); }); }
  function deckHave(s, sl) { return (CAT.byDeck[sl] || []).filter(function (k) { return owned(s, k); }).length; }

  // ---- the daily card (divination) -------------------------------------------------------------------------------
  var OMENS = {
    wands: [{ pow: 2, suit: "wands", text: "+2 Power to your Wands today" }, { pow: 1, suit: "wands", text: "+1 Power to your Wands today" }],
    cups: [{ spirit: 4, text: "+4 Spirit in every battle today" }, { spirit: 2, text: "+2 Spirit in every battle today" }],
    swords: [{ harm: 2, suit: "swords", text: "+2 Harm to your Swords today" }, { harm: 1, suit: "swords", text: "+1 Harm to your Swords today" }],
    pentacles: [{ gold: 0.3, text: "+30% Moonstones from battles today" }, { gold: 0.15, text: "+15% Moonstones from battles today" }],
    major: [{ cel: 2, text: "+2 celestials in every battle today" }, { cel: 1, text: "+1 celestial in every battle today" }],
    oracle: [{ xp: 1, text: "+1 XP for every card in every battle today" }, { spirit: 2, text: "+2 Spirit in every battle today" }],
    world: [{ cel: 3, gold: 0.3, text: "+3 celestials and +30% Moonstones today" }, { cel: 2, gold: 0.15, text: "+2 celestials and +15% Moonstones today" }]
  };
  function omen(d) {
    if (!d || !card(d.key)) return null;
    var c = card(d.key), list = c.id === "world" ? OMENS.world : OMENS[c.suit];
    return list[d.rev ? 1 : 0];
  }
  function dailyOn(s, now) { return s.daily && s.daily.day === dayOf(now) ? s.daily : null; }

  // ---- missions: three a day ------------------------------------------------------------------------------------
  var MISSIONS = [
    { id: "win3", text: "Win 3 battles", goal: 3 }, { id: "cups3", text: "Win a battle with 3+ Cups in your spread", goal: 1 },
    { id: "wands3", text: "Win a battle with 3+ Wands in your spread", goal: 1 }, { id: "swords3", text: "Win a battle with 3+ Swords in your spread", goal: 1 },
    { id: "pent3", text: "Win a battle with 3+ Pentacles in your spread", goal: 1 }, { id: "harm40", text: "Deal 40 Harm", goal: 40 },
    { id: "zero", text: "Win a round spending no celestials", goal: 1 }, { id: "rev", text: "Win a round with a reversed card", goal: 1 },
    { id: "major", text: "Win 3 rounds with Major Arcana", goal: 3 }, { id: "pack", text: "Open a booster", goal: 1 },
    { id: "combo", text: "Win a battle with 2+ combos awake", goal: 1 }, { id: "battles5", text: "Fight 5 battles", goal: 5 },
    { id: "fury", text: "Win 2 rounds with Fury", goal: 2 }, { id: "oracle", text: "Win a round with an oracle card", goal: 1 }
  ];
  function missionsFor(s, now) {
    var day = dayOf(now);
    if (s.missions && s.missions.day === day) return s.missions;
    var o = { rng: hash(day + ":" + s.made) | 0 }, ids = shuffle(o, MISSIONS.map(function (m) { return m.id; })).slice(0, 3);
    s.missions = { day: day, list: ids.map(function (id) { return { id: id, prog: 0, claimed: false }; }) };
    return s.missions;
  }
  function progress(s, now, id, n) {
    var M = missionsFor(s, now), ev = [];
    M.list.forEach(function (m) {
      if (m.id !== id || m.claimed) return;
      var goal = MISSIONS.filter(function (x) { return x.id === id; })[0].goal, was = m.prog;
      m.prog = Math.min(goal, m.prog + n);
      if (was < goal && m.prog >= goal) ev.push({ kind: "missionDone", id: id });
    });
    return ev;
  }

  // ---- foes: the keepers of the Fool's Journey and the rest --------------------------------------------------------
  var KEEPER_NAMES = ["", "The Magician's Apprentice", "The Veiled Priestess", "The Garden Empress", "The Iron Emperor", "The Hierophant's Choir",
    "The Twin Lovers", "The Charioteer", "The Lion Tamer", "The Lantern Hermit", "The Wheelwright", "The Magistrate", "The Hanged Wanderer",
    "The Pale Rider", "The Alchemist", "The Horned One", "The Tower Warden", "The Star Gazer", "The Moon Witch", "The Sun King", "The Last Herald",
    "The World Dancer"];
  // The story writer's second road (see docs/STORY.md): once the World falls, the oracle decks open, and with them the
  // Veiled Pilgrimage -- thirteen keepers across the four oracle realms, then the Veiled Oracle herself. Beating her opens
  // the Cartomancer's Parlour (the Lenormand cards come later; Cam named it 1 Nov).
  var PILGRIMAGE = [
    { name: "The Barker at the Gate", realm: "carnival-of-souls" }, { name: "Madame Pythia", realm: "carnival-of-souls" }, { name: "The Ringmaster of Bones", realm: "carnival-of-souls" },
    { name: "The Rune-Carver", realm: "the-viking-oracle" }, { name: "The Shield-Maiden", realm: "the-viking-oracle" }, { name: "The Seer of the World-Tree", realm: "the-viking-oracle" },
    { name: "The Hedge-Witch", realm: "the-rooted-woman-oracle" }, { name: "Ceridwen's Keeper", realm: "the-rooted-woman-oracle" }, { name: "The Morrigan", realm: "the-rooted-woman-oracle" },
    { name: "The Herbalist", realm: "deadly-apothecary-oracle" }, { name: "The Poisoner's Apprentice", realm: "deadly-apothecary-oracle" }, { name: "The Apothecary Queen", realm: "deadly-apothecary-oracle" },
    { name: "The Veiled Oracle", realm: null }];
  var CAMPAIGNS = {
    fool: { name: "The Fool's Journey", n: 21, keeper: function (st) { return KEEPER_NAMES[st]; }, power: function (st) { return st === 21 ? 1.1 : -0.35 + 1.3 * (st - 1) / 20; } },
    oracle: { name: "The Veiled Pilgrimage", n: PILGRIMAGE.length, keeper: function (st) { return PILGRIMAGE[st - 1].name; }, power: function (st) { return st === PILGRIMAGE.length ? 1.25 : 0.55 + 0.6 * (st - 1) / (PILGRIMAGE.length - 2); } }
  };
  // the main keepers (Cam, 1 Nov: "every 7 keepers are main keepers, so if you lose you have to return to the start, all
  // names are then hidden again ... The Chariot, Temperance and The World"); the Pilgrimage's is the Veiled Oracle
  var MAIN_KEEPERS = { fool: [7, 14, 21], oracle: [3, 6, 9, 12, 13] };       // the Pilgrimage: each realm's last, and the Veiled Oracle (Q9)
  function isMain(id, st) { return (MAIN_KEEPERS[id] || []).indexOf(st) >= 0; }
  var campOf = function (id) { return CAMPAIGNS[id] ? id : "fool"; };
  function campOpen(s, id) { return id === "fool" || (id === "oracle" && !!s.unlocks.oracle && CAT.decks.some(function (d) { return d.kind === "oracle"; })); }
  function stationReward(id, st) { return Math.round((ECON.journey.first + ECON.journey.per * st) * (id === "oracle" ? 1.6 : 1)); }
  function stationLoss(id, st) { return Math.round((ECON.journey.lose + ECON.journey.lper * st) * (id === "oracle" ? 1.6 : 1)); }
  /** What losing at a station costs you now: never more than 60% of what winning it would pay (a replayed station pays less). */
  function journeyLoss(s, id, st) { return Math.min(stationLoss(id, st), Math.round(ECON.loseCap * stationPay(s, id, st))); }
  /** What winning a station pays now: its first-win pay once ever; at Ascension N, a share of it on the first pass at that
      level; otherwise the replay pay. */
  function stationPay(s, id, st) {
    var J = s.camp[id];
    if (J.asc > 0) return (J.ascPass[J.asc] || 0) < st ? Math.round(stationReward(id, st) * (ECON.asc.first + ECON.asc.per * J.asc)) : stationReplay(id, st);
    return st > J.best ? stationReward(id, st) : stationReplay(id, st);
  }
  /** Ascension (Game Developer, voted 1 Nov): after the World, walk the road again at level 1-10; every keeper gains more. */
  function ascTwist(n) {
    return { n: n, spirit: 2 * ((n >= 1) + (n >= 5) + (n >= 9)), cel: (n >= 2) + (n >= 6), harm: (n >= 3) + (n >= 7), pow: (n >= 4) + (n >= 8) + (n >= 10), ai: 0.03 * n };
  }
  function ascText(n) {
    var t = ascTwist(n), out = [];
    if (t.spirit) out.push("+" + t.spirit + " Spirit"); if (t.cel) out.push("+" + t.cel + " celestial" + (t.cel > 1 ? "s" : "")); if (t.harm) out.push("+" + t.harm + " Harm"); if (t.pow) out.push("+" + t.pow + " Power");
    return out.join(", ");
  }
  /** A page in the Book of Keepers: written into the journal the first time a keeper is beaten. */
  function bookPage(s, id, st, at) {
    var k = id + ":" + st;
    if (s.keeperBook[k]) return null;
    s.keeperBook[k] = at;
    var tarot = CAT.decks.filter(function (d) { return d.kind === "tarot"; })[0], mk = id === "fool" && tarot ? tarot.slug + ":" + MAJORS[st] : null;
    var e = { id: "k" + at.toString(36) + id + st, at: at, kind: "keeper", camp: id, station: st, title: "The Book of Keepers -- " + CAMPAIGNS[id].keeper(st),
      spread: "keeper", cards: mk && card(mk) ? [{ key: mk, rev: false, pos: id === "fool" ? ROMAN[st] : "" }] : [], notes: "" };
    s.journal.push(e);
    return e;
  }
  function stationReplay(id, st) { return Math.round((ECON.journey.replay + ECON.journey.rper * st) * (id === "oracle" ? 1.6 : 1)); }
  /** How far you've come: the best station ever passed on the Fool's Journey, as 0..1 -- foes elsewhere grow with it
      (Cam: "the battles should scale up in difficulty"), and so does what a lost skirmish costs. */
  function renown(s) { return clamp(((s.camp && s.camp.fool && s.camp.fool.best) || 0) / 21, 0, 1); }

  /** A foe's deck of 8 at a strength from about 0 (a new player's) to 1 (endgame): rarer and higher-level cards as it
      rises, leaning to one suit so its combos wake; a Journey keeper always holds its own Major. */
  function foeSpread(o, power, major, realm, favour, keeper) {
    var suit = favour || pickOf(o, SUITS), keys = [], levels = [];
    var oracleKeys = CAT.cards.filter(function (c) { return c.kind === "oracle" && (!realm || c.deck === realm); }).map(function (c) { return c.key; });
    if (realm && !oracleKeys.length) oracleKeys = CAT.cards.filter(function (c) { return c.kind === "oracle"; }).map(function (c) { return c.key; });
    var tierP = [0.62 - 0.4 * power, 0.12, 0.16 + 0.12 * power, 0.08 + 0.22 * power, 0.02 + 0.06 * power].map(function (x) { return Math.max(0.005, x); });
    if (power < 0) { tierP[4] = 0; tierP[3] = Math.min(tierP[3], 0.02); }      // (gentle foes: no World, hardly a court card)
    var sum = tierP.reduce(function (a, b) { return a + b; }, 0);
    var tarot = CAT.decks.filter(function (d) { return d.kind === "tarot"; });
    if (major != null) keys.push(pickOf(o, tarot).slug + ":" + MAJORS[major]);
    var guard = 0;
    while (keys.length < DECK && guard++ < 400) {
      var x = rand(o) * sum, acc = 0, rar = "common";
      for (var i = 0; i < RARITIES.length; i++) { acc += tierP[i]; if (x < acc) { rar = RARITIES[i]; break; } }
      var pool = CAT.byRarity[rar].filter(function (k) { return card(k).kind !== "oracle"; });
      // a keeper of an oracle realm plays mostly its realm's cards (its circle wakes); the Veiled Oracle any of them
      if (realm !== undefined && oracleKeys.length && rand(o) < 0.75) { var po = oracleKeys.filter(function (k) { return card(k).rarity === rar; }); pool = po.length ? po : oracleKeys; }
      else if (keeper && favour && keys.filter(function (q) { return card(q).suit === favour; }).length < 5) { var pf = CAT.cards.filter(function (c) { return c.suit === favour && c.kind !== "oracle"; }).map(function (c) { return c.key; }); var pr = pf.filter(function (q) { return card(q).rarity === rar; }); pool = pr.length ? pr : pf; }
      else if (!keeper && rar !== "mythic" && rand(o) < Math.max(0, 0.3 + 0.5 * power)) { var p2 = pool.filter(function (k) { return card(k).suit === suit; }); if (p2.length) pool = p2; }
      var k = pool[Math.floor(rand(o) * pool.length)];
      if (keys.some(function (q) { return card(q).id === card(k).id && card(q).deck === card(k).deck; })) continue;
      keys.push(k);
    }
    keys.forEach(function (k) { levels.push(clamp(1 + Math.floor(Math.max(0, power) * maxLv(k) * (0.6 + 0.6 * rand(o))), 1, maxLv(k))); });
    return { keys: keys, levels: levels };
  }
  var DIFF = { easy: -0.5, normal: 0.1, hard: 0.45 };
  var SHARP = { per: 0.015, max: 0.45 };                            // (a skirmish foe per win in a row: up to +0.45 power, i.e. Easy's foes at a Normal-and-a-half by 30)
  /** A keeper's own spreads (lore.js), resolved to cards you can hold: [[keys]] (empty when the decks they need are missing).
      "id" comes from the keeper's own decks in order, then any deck of its kind; "slug|id" from that deck. */
  function keeperSpreads(cid, st) {
    var K = (LORE.KEEPERS[cid] || {})[st];
    if (!K) return [];
    var tarot = CAT.decks.filter(function (d) { return d.kind === "tarot"; }).map(function (d) { return d.slug; });
    // how many of a Journey keeper's tarot cards come from their own deck (the balance run, 2 Nov: eight of one deck woke
    // its Harmony and Full Spread for every keeper): four up to the Hermit (no Harmony); six from the Wheel on (Harmony);
    // never eight (with reversing costing a Power, Q11, XIV and XXI's Full Spreads made them walls). The rest come from
    // one other deck, by station.
    var own = cid !== "fool" ? DECK : st >= 10 ? 6 : 4;
    var home = K.decks.filter(function (sl) { return tarot.indexOf(sl) >= 0; })[0] || tarot[0];
    var others = tarot.filter(function (sl) { return sl !== home; }), alt = others.length ? others[(st * 7 + (cid === "fool" ? 0 : 3)) % others.length] : home;
    var resolve = function (e, j) {
      var bar = e.indexOf("|"), id = bar >= 0 ? e.slice(bar + 1) : e, isO = /^o_/.test(id);
      var order = bar >= 0 ? [e.slice(0, bar)] : isO ? K.decks : j < own ? K.decks.concat(tarot) : [alt].concat(K.decks, tarot);
      for (var i = 0; i < order.length; i++) if (card(order[i] + ":" + id)) return order[i] + ":" + id;
      return null;
    };
    return K.spreads.map(function (sp) {
      var t = 0, keys = sp.map(function (e) { return resolve(e, /^o_|\|/.test(e) ? -1 : t++); });
      return keys.every(Boolean) && keys.length === DECK && keys.filter(function (k, i) { return keys.indexOf(k) === i; }).length === DECK ? keys : null;
    }).filter(Boolean);
  }
  /** Which of a keeper's spreads comes next: they take them in turn, one challenge after another. */
  function keeperTurn(s, cid, st) { var n = keeperSpreads(cid, st).length; return n ? (s.keeperRot[cid + ":" + st] || 0) % n : 0; }
  function foeLevels(o, power, keys) { return keys.map(function (k) { return clamp(1 + Math.floor(Math.max(0, power) * maxLv(k) * (0.6 + 0.6 * rand(o))), 1, maxLv(k)); }); }

  // ---- a battle ----------------------------------------------------------------------------------------------------
  /** A side: its deck of 8 wakes the combos; four of it are drawn to fight. */
  /** One drawn card's battle numbers: its level, its share of the deck's combos, the daily omen. */
  /** Whether a foe sets a Seal, and which: keepers further along the road more often, the main keepers always. */
  function foeSeal(o, mode, opts, ren) {
    if (mode === "tutorial" || mode === "keeps") return null;
    var p = mode === "journey" ? (isMain(opts.camp, opts.station) ? 1 : opts.camp === "oracle" ? 0.7 : 0.15 + 0.03 * opts.station) : 0.2 + 0.4 * ren;
    if (rand(o) >= p) return null;
    return pickOf(o, SEALS.filter(function (x) { return !x.mine; })).id;
  }
  function battleCard(keys, levels, i, R, omenD, gilds) {
    var k = keys[i], st = statsOf(k, levels[i], gilds && gilds[i]), c = card(k), p = R.per[i], om = omenD && omenD.suit === c.suit ? omenD : null;
    return { key: k, lv: levels[i], pow: st.pow + p.pow + (om && om.pow || 0), harm: st.harm + p.harm + (om && om.harm || 0), heal: p.heal + st.heal, guard: p.guard + st.guard, celWin: st.cel, used: false, won: 0 };
  }
  function side(name, keys, levels, omenD, o, keep, gilds) {
    var R = resonance(keys, levels), idx = keys.map(function (k, i) { return i; });
    shuffle(o, idx);
    if (keep != null) { var at = idx.indexOf(keep); if (at >= HAND) { idx[at] = idx[0]; idx[0] = keep; } }
    var hand = idx.slice(0, HAND);
    var cards = hand.map(function (i) { return battleCard(keys, levels, i, R, omenD, gilds); });
    var spirit = SPIRIT + R.side.spirit + (omenD && omenD.spirit || 0);
    return { name: name, deck: keys.slice(), cards: cards, spirit: spirit, max: spirit, cel: CELESTIALS + R.side.cel + (omenD && omenD.cel || 0), hex: R.side.hex, healWin: R.side.heal,
      poison: 0, combos: R.list.map(function (x) { return x.id; }), comboN: R.list.length, full: R.side.full || null };
  }
  var TWISTS = [
    { id: "lean", name: "Lean Skies", text: "Only 8 celestials each", cel: -4 },
    { id: "flood", name: "Star Flood", text: "18 celestials each", cel: 6 },
    { id: "arcana", name: "Arcana Rising", text: "Major Arcana have +2 Power", major: 2 },
    { id: "brief", name: "Brief Candle", text: "Only 10 Spirit each", spirit: -8 },
    { id: "shadow", name: "Shadow Play", text: "Every card is played reversed", rev: true },
    { id: "wrath", name: "Night of Wrath", text: "Fury costs only 1 celestial", fury: 1 }
  ];
  // the tutorial's two battles: a gentle foe, then one that teaches Fury
  var TUT_FOES = [{ name: "Vesper's apprentice", power: -0.4, skill: 0 }, { name: "Vesper", power: -0.1, skill: 0.25 }];
  function startBattle(s, mode, opts, now) {
    // a duel with a friend at any layer (Cam, 2 Nov: "you should be able to choose the difficulty of the battle ... practice
    // your skills with friends and work on spreads together")
    var duelTier = (mode === "duel" || mode === "lan") && opts && FEATURES[opts.tier] && opts.tier !== "free" ? opts.tier : null;
    if (duelTier) useTier({ diff: duelTier });
    var o = { rng: rand(s) * 4294967296 | 0 }, power, major = null, name, twist = null, skill = null;
    var realm, ren = renown(s);
    if (mode === "journey") {
      var cid = campOf(opts.camp), CP = CAMPAIGNS[cid], st = clamp(opts.station | 0, 1, CP.n);
      power = CP.power(st); name = CP.keeper(st); opts = { camp: cid, station: st };
      if (cid === "fool") major = st; else realm = PILGRIMAGE[st - 1].realm;
    }
    else if (mode === "circuit") { var CS = circuitStations(circuitWeek(now)), cst = CS[clamp(opts.station | 0, 1, CS.length) - 1]; power = cst.power; name = cst.name; opts = { station: cst.n, week: circuitWeek(now), page: cst.key, field: cst.field, lv1: s.spread.every(function (k) { return s.cards[k].lv <= 1; }) }; }
    else if (mode === "gauntlet") { var g = s.gauntlet ? s.gauntlet.wins : 0; power = clamp(0.15 + 0.1 * g + 0.3 * ren, 0, 1.2); name = "Gauntlet foe " + (g + 1); }
    else if (mode === "trial") { var tday = dayOf(now), to = { rng: hash("trial:" + tday) | 0 }; twist = pickOf(to, TWISTS); power = 0.5 + 0.3 * ren; name = "Trial of " + twist.name; o.rng = to.rng; }
    else if (mode === "duel" || mode === "lan") { power = 0.1; name = "Player 2"; opts = { deck: opts.deck || "", p2: opts.p2 || null }; }
    else if (mode === "keeps") { power = DIFF.normal + 0.15 + 0.3 * ren; name = "A gambler at the crossroads"; opts = {}; }
    else if (mode === "tutorial") { var tf = TUT_FOES[clamp(opts.n | 0, 0, 1)]; power = tf.power; skill = tf.skill; name = tf.name; opts = { n: opts.n | 0 }; }
    else { var dfc = DIFF[opts.diff] != null ? opts.diff : "normal"; power = DIFF[dfc] + 0.3 * ren; name = { easy: "A curious novice", normal: "A wandering reader", hard: "A seasoned mystic" }[dfc];
      // (Cam, 2 Nov: "the longer a streak goes in skirmish the sharper the AI gets") -- every win in a row sharpens the next
      // reader a little (stronger cards, keener play), up to a cap; a loss resets the streak and them with it
      var sharp = Math.min(SHARP.max, (s.streak || 0) * SHARP.per); power += sharp;
      if (sharp >= 0.1) name += " (" + (sharp >= SHARP.max ? "the sharpest yet" : sharp >= 0.25 ? "much sharper" : "sharper") + ")";
      opts = { diff: dfc, sharp: sharp }; }
    var field = mode === "tutorial" || !F.fields ? null : mode === "circuit" ? opts.field : mode === "journey" ? (opts.camp === "fool" ? MAJOR_FIELD[opts.station] : REALM_FIELD[realm] || pickOf(o, FIELDS)) : pickOf(o, FIELDS);
    var foe = foeSpread(o, power, major, realm, field ? FIELD[field].suit : null, mode === "journey"), keeper = null, om = mode === "duel" || mode === "lan" ? null : dailyOn(s, now) ? omen(s.daily) : null;
    // hot-seat (Q8/Q9): player 2 plays one of your saved decks at your levels, or the ready-made deck above
    var duelDeck = mode === "duel" && opts.deck ? (opts.deck === "current" ? { keys: s.spread.slice() } : s.decks.filter(function (d) { return d.id === opts.deck; })[0] || null) : null;
    if (duelDeck && duelDeck.keys.length === DECK && duelDeck.keys.every(function (k) { return card(k); })) foe = { keys: duelDeck.keys.slice(), levels: duelDeck.keys.map(function (k) { return s.cards[k] ? s.cards[k].lv : 1; }) };
    // player 2 in a duel may be another save: {name, face, keys, levels} read from it (Cam: "another player can have a separate save")
    var p2 = (mode === "duel" || mode === "lan") && opts.p2 && Array.isArray(opts.p2.keys) && opts.p2.keys.length === DECK && opts.p2.keys.every(function (k) { return card(k); }) ? opts.p2 : null;
    if (p2) foe = { keys: p2.keys.slice(), levels: p2.keys.map(function (k, i) { return clamp((p2.levels && p2.levels[i]) | 0 || 1, 1, maxLv(k)); }) };
    if (p2) name = String(p2.name || "Player 2").slice(0, 30);
    // a keeper plays their own spread (Cam, 2 Nov: "the keepers have 2 spreads they use and not random cards all the time")
    if (mode === "journey" && F.deep) {
      var KS = keeperSpreads(opts.camp, opts.station);
      // (Cam, 2 Nov, Q13: Hard's keepers a level higher -- their fixed spreads were weaker than Normal's random rare decks)
      if (KS.length) { var ki = keeperTurn(s, opts.camp, opts.station); foe = { keys: KS[ki].slice(), levels: foeLevels(o, power, KS[ki]).map(function (l, j) { return Math.min(maxLv(KS[ki][j]), l + 1); }) }; keeper = { i: ki, n: KS.length }; }
    }
    if (mode === "circuit") {                                        // (the Pages keep to the cap too)
      var tot = function () { return foe.levels.reduce(function (a, l) { return a + l; }, 0); };
      while (tot() > ECON.circuit.cap) { var hi = foe.levels.indexOf(Math.max.apply(null, foe.levels)); foe.levels[hi]--; }
    }
    var you = side(mode === "duel" ? (s.name || "Player 1") : (s.name || "You"), s.spread.slice(), s.spread.map(function (k) { return s.cards[k].lv; }), om, o, null, s.spread.map(function (k) { return !!s.cards[k].g; }));
    var them = side(name, foe.keys, foe.levels, null, o, major != null ? 0 : null);
    // (Hard's keepers: a level higher only -- the audit's +3 Spirit made Hard's road 63-141 days; Cam took it back, 2 Nov)
    if (power < 0) them.cel = Math.max(6, them.cel + Math.round(power * 5));   // (gentle foes bring fewer celestials)
    [you, them].forEach(function (sd) {
      if (twist && twist.cel) sd.cel = Math.max(1, sd.cel + twist.cel);
      if (twist && twist.spirit) { sd.spirit = Math.max(4, sd.spirit + twist.spirit); sd.max = sd.spirit; }
      if (twist && twist.major) sd.cards.forEach(function (c) { if (card(c.key).suit === "major") c.pow += twist.major; });
    });
    if (field) [you, them].forEach(function (sd) { sd.cards.forEach(function (c) { onField(c, field); }); });
    you.face = s.face; them.face = mode === "circuit" ? opts.page : p2 && typeof p2.face === "string" && (card(p2.face) || isBadge(p2.face)) ? p2.face : null;
    you.plv = s.plv; them.plv = p2 ? clamp(p2.plv | 0 || 1, 1, ECON.player.max) : 0;
    if (s.ngp && mode === "journey") { them.spirit += NGP.spirit * s.ngp; them.max = them.spirit; them.cards.forEach(function (c) { c.pow += NGP.pow * s.ngp; }); }
    if (s.legacy && s.legacy.indexOf("starlight") >= 0 && mode !== "duel" && mode !== "tutorial") you.cel += 1;
    var AT = mode === "journey" && opts.camp === "fool" && s.camp.fool.asc > 0 ? ascTwist(s.camp.fool.asc) : null;
    if (AT) { them.spirit += AT.spirit; them.max = them.spirit; them.cel += AT.cel; them.cards.forEach(function (c) { c.pow += AT.pow; c.harm += AT.harm; }); }
    var ai = skill != null ? skill : mode === "journey" ? clamp(0.35 + 0.6 * power, 0, 1) : mode === "trial" ? 0.8 : clamp(0.25 + power, 0, 1);
    return { v: 2, tier: duelTier || s.diff, temper: F.deep && mode === "journey" ? temperOf(opts.camp, opts.station) : null, mode: mode, opts: opts || {}, twist: twist, keeper: keeper, rng: o.rng, round: 0, sides: [you, them], log: [], over: false, result: null,
      ai: AT ? Math.min(1, ai + AT.ai) : ai, asc: AT ? AT.n : 0, field: field, mulls: mode === "duel" || mode === "lan" ? 0 : ECON.diff[s.diff] ? ECON.diff[s.diff].mull : 2, offer: null, seal: mode === "duel" || mode === "lan" || !F.seals ? [null, null] : [mode !== "tutorial" && s.sealSet && s.seals[s.sealSet] ? s.sealSet : null, foeSeal(o, mode, opts, ren)], sprung: [false, false], gold: om && om.gold || 0, xpBonus: om && om.xp || 0, fury: twist && twist.fury ? twist.fury : FURY.cost };
  }

  /** A card's ability with its chances settled: a coin becomes the side it lands on, a die stays (its value is read
      later). luck: [die, die, coin] numbers 0..1 for this card, or null (the AI's guess: the coin's two sides averaged). */
  function settle(ab, luck, out) {
    if (!ab) return [];
    var fx = [];
    ab.fx.forEach(function (e) {
      if (e.k !== "coin") { fx.push(e); return; }
      if (!luck) {                                                   // (a guess: half of each side's Power)
        var avg = function (k) { return ((e.up || []).concat(e.down || [])).reduce(function (a, x) { return a + (x.k === k ? x.n : 0); }, 0) / 2; };
        fx.push({ k: "pow", n: avg("pow") }, { k: "foePow", n: avg("foePow") });
        return;
      }
      var up = luck[2] < 0.5;
      out.push({ kind: "coin", face: up ? "sun" : "moon", text: ab.name + ": " + (up ? "the sun" : "the moon") });
      fx = fx.concat(up ? e.up || [] : e.down || []);
    });
    return fx;
  }
  /** One card's numbers in a clash: {pow, cel, might, harm, fx, on, chance, aff}. ch = {card, cel, rev, fury}. luck: this
      card's [die, die, coin] (null when the AI weighs its options). */
  function clashCalc(B, a, ch, chFoe, luck, foeLuck) {
    var A = B.sides[a], F = B.sides[1 - a], c = A.cards[ch.card], f = F.cards[chFoe.card], C = card(c.key), FC = card(f.key), TF = tierOf(B);
    var rev = !!ch.rev || !!(B.twist && B.twist.rev), frev = !!chFoe.rev || !!(B.twist && B.twist.rev);
    var ab = C.ab && !(BAL_ANY && BAL_OFF["ab:" + C.ab]) ? ABILITIES[C.ab] : null, fab = FC.ab && !(BAL_ANY && BAL_OFF["ab:" + FC.ab]) ? ABILITIES[FC.ab] : null;
    var sil = B.silenced || [false, false];
    var on = !!ab && !rev && !frev && !sil[a], fon = !!fab && !frev && !rev && !sil[1 - a];
    var chance = [], foeChance = [];
    var myFx = on ? settle(ab, luck, chance) : [], foeFx = fon ? settle(fab, luck === null ? null : foeLuck || null, foeChance) : [];
    var cancels = function (fx) { return fx.some(function (e) { return e.k === "cancel"; }); };
    var myOn = on && !(cancels(foeFx) && !ab.immune), foeOn = fon && !(cancels(myFx) && !fab.immune);
    if (!myOn) chance = [];
    // reversed costs a Power (Cam, Q11, 2 Nov: a plain card reversed for free switched off the other's ability 70% of
    // the time); so does the other card if it's reversed, for the Copy rule's sake
    var pow = c.pow - F.hex - (rev ? REVERSED : 0), fpow = f.pow - A.hex - (frev ? REVERSED : 0), cel = ch.cel, harm = c.harm + (ch.fury ? FURY.harm : 0);
    if (BEATS[C.suit] === FC.suit) pow += EDGE;
    if (BEATS[FC.suit] === C.suit) fpow += EDGE;
    var mineFx = myOn ? myFx : [], theirFx = foeOn ? foeFx : [];
    var deckCards = A.deck.map(card).filter(Boolean);
    var when = function (w) {
      return w === "nocel" ? ch.cel === 0 : w === "behind" ? A.spirit < F.spirit : w === "deckmate" ? deckCards.filter(function (x) { return x.deck === C.deck; }).length > 1
        : w === "late" ? B.round >= 2 : w === "bid3" ? ch.cel >= 3 : w === "rev" ? rev : w === "first" ? B.round === 0 : false;
    };
    var dieOf = function (e, mean) {                                   // a die (or the higher of two) through its map
      var map = e.map || [0, 1, 2, 3, 4, 5];
      if (!luck) return mean;
      var d1 = 1 + Math.floor(luck[0] * 6), d2 = 1 + Math.floor(luck[1] * 6), face = e.k === "dice2" ? (e.low ? Math.min(d1, d2) : Math.max(d1, d2)) : d1;
      chance.push({ kind: "die", low: !!e.low, faces: e.k === "dice2" ? [d1, d2] : [d1], value: map[face - 1], text: (ab ? ab.name : "A die") + ": " + (map[face - 1] ? "+" + map[face - 1] + (e.stat === "harm" ? " Harm if it wins" : " Power") : "nothing") });
      return map[face - 1];
    };
    mineFx.forEach(function (e) {
      if (e.k === "pow") pow += e.n;
      if (e.k === "powIf" && when(e.when)) pow += e.n;
      if (e.k === "powPer") {
        if (e.per === "major") pow += e.n * Math.min(4, deckCards.filter(function (x) { return x.suit === "major"; }).length - 1);
        else if (e.per === "suit") pow += e.n * SUITS.filter(function (su) { return deckCards.some(function (x) { return x.suit === su; }); }).length;
        else pow += e.n * Math.min(3, Math.max(0, deckCards.filter(function (x) { return x.suit === e.per; }).length - (C.suit === e.per ? 1 : 0)));
      }
      if (e.k === "free") cel += e.n;
      if (e.k === "die" || e.k === "dice2") { var mp = e.map || [0, 1, 2, 3, 4, 5];
        var mean = e.k !== "dice2" ? mp.reduce(function (x, y) { return x + y; }, 0) / 6 : e.low ? (11 * mp[0] + 9 * mp[1] + 7 * mp[2] + 5 * mp[3] + 3 * mp[4] + mp[5]) / 36 : (mp[0] + 3 * mp[1] + 5 * mp[2] + 7 * mp[3] + 9 * mp[4] + 11 * mp[5]) / 36;
        var dv = dieOf(e, mean); if (e.stat === "harm") harm += dv; else pow += dv; }
      if (e.k === "harm") harm += e.n;
    });
    theirFx.forEach(function (e) { if (e.k === "foePow") pow -= e.n; });
    // the decks' leans: always on, reversed or not (they are the deck's nature, not an ability)
    var L = TF.deep && !(BAL_ANY && BAL_OFF["lean:" + C.deck]) ? leanOf(C.deck) : null, FL = TF.deep && !(BAL_ANY && BAL_OFF["lean:" + FC.deck]) ? leanOf(FC.deck) : null;
    if (L && L.fx) L.fx.forEach(function (e) { if (e.k === "powIf" && when(e.when)) pow += e.n; });
    if (FL && FL.fx) FL.fx.forEach(function (e) { if (e.k === "foePow") pow -= e.n; });
    // affinities (Cam, 2 Nov): a deck hunts one kind of card and fears another
    var AF = affinityOf(C.deck), fk = kindOf(FC), aff = !TF.deep ? 0 : AF.hunt === fk ? LORE.AFFINITY_N.hunt : AF.fear === fk ? -LORE.AFFINITY_N.fear : 0;
    pow += aff;
    if (A.full === "tarot-of-divine" && B.round === ROUNDS - 1) pow += 4;
    // (the buff audit, 2 Nov: Showstopper and Berserker brought into line)
    if (A.full === "carnival-of-souls" && B.round === 0) { pow += 3; harm += 1; }
    if (A.full === "the-viking-oracle" && A.spirit < A.max * 2 / 3) pow += 3;
    // Mushroom Growth (Cam, 2 Nov): on Hard, Wonderland's Full Spread rolls a die each round -- 4-6: +3 Power
    if (A.full === "wonderland-in-tarot" && TF.deep) { var mv = !luck ? 1.5 : (luck[3] != null ? 1 + Math.floor(luck[3] * 6) : 1) >= 4 ? 3 : 0;
      if (luck) chance.push({ kind: "die", faces: [1 + Math.floor((luck[3] || 0) * 6)], value: mv, text: "Mushroom Growth: " + (mv ? "+3 Power" : "nothing this round") }); pow += mv; }
    if (mineFx.some(function (e) { return e.k === "copy"; })) pow = Math.max(pow, fpow);
    pow = Math.max(0, Math.round(pow));
    var ud = !TF.underdog ? 0 : Math.min(ECON.underdog.max, Math.max(0, ((f.lv | 0) - (c.lv | 0)) * ECON.underdog.per));    // the Underdog
    var lwin = L && L.fx ? L.fx.filter(function (e) { return e.k === "poison"; }) : [];
    // (Cam, 2 Nov, Q13: "drop underdogs extra might but keep the exp") -- ud now only marks a card below the other: twice the XP if it wins
    return { pow: pow, cel: cel, might: pow + MIGHT_PER_CEL * cel, ud: ud, harm: harm, fx: mineFx.concat(lwin), on: myOn, rev: rev, fury: !!ch.fury, chance: chance, aff: aff };
  }
  /** The winner (0 / 1 / -1 a draw): more Might; level Might -- the card with more Harm, then the higher level (Cam, 1 Nov:
      "I seem to always win when we have even amount"). */
  function winnerOf(B, ra, rb, ca, cb) {
    if (ra.might !== rb.might) return ra.might > rb.might ? 0 : 1;
    if (ra.harm !== rb.harm) return ra.harm > rb.harm ? 0 : 1;
    var la = B.sides[0].cards[ca].lv, lb = B.sides[1].cards[cb].lv;
    if (la !== lb) return la > lb ? 0 : 1;
    return -1;
  }
  var spend = function (B, ch) { return ch.cel + (ch.fury ? B.fury : 0); };
  function validChoice(B, i, ch) {
    var S = B.sides[i];
    return ch && Number.isInteger(ch.card) && ch.card >= 0 && ch.card < S.cards.length && !S.cards[ch.card].used && Number.isInteger(ch.cel) && ch.cel >= 0 && spend(B, ch) <= S.cel;
  }
  /** Play one round: both choices revealed at once. Returns the round's story for the page. */
  function playRound(B, chs) {
    var rolls = [[rand(B), rand(B), rand(B), rand(B)], [rand(B), rand(B), rand(B), rand(B)]], seal = B.seal || [null, null], sprung = B.sprung || (B.sprung = [false, false]), springs = [];
    var has = function (i, id) { return seal[i] === id && !sprung[i]; }, spring = function (i) { sprung[i] = true; springs.push(i + ":" + seal[i]); };
    var isMajor = function (i) { var c = card(B.sides[i].cards[chs[i].card].key); return c && c.suit === "major"; };
    chs = [Object.assign({}, chs[0]), Object.assign({}, chs[1])];
    // before the clash: Veil snuffs their Fury (stars kept), Chain silences their Major
    B.silenced = [false, false];
    [0, 1].forEach(function (i) {
      var j = 1 - i;
      if (has(i, "veil") && chs[j].fury) { chs[j].fury = false; spring(i); }
      if (has(i, "chain") && isMajor(j)) { B.silenced[j] = true; spring(i); }
    });
    var r = [clashCalc(B, 0, chs[0], chs[1], rolls[0], rolls[1]), clashCalc(B, 1, chs[1], chs[0], rolls[1], rolls[0])];
    B.silenced = null;
    // the Might seals: Gale blows out 2 of a big bid, the Fool's Seal flips a coin in round 1
    [0, 1].forEach(function (i) {
      var j = 1 - i;
      if (has(i, "gale") && chs[j].cel >= 6) { r[j].cel -= 2; r[j].might -= 2 * MIGHT_PER_CEL; spring(i); }
      if (has(i, "fool") && B.round === 0) { var up = rand(B) < 0.5; r[i].pow += up ? 3 : -3; r[i].might += up ? 3 : -3; spring(i); r[i].chance.push({ kind: "coin", face: up ? "sun" : "moon", text: "Fool's Seal: " + (up ? "the sun, +3 Power" : "the moon, -3 Power") }); }
    });
    var w = winnerOf(B, r[0], r[1], chs[0].card, chs[1].card);
    // Mirror: a narrow loss becomes a draw
    [0, 1].forEach(function (i) { if (w === 1 - i && has(i, "mirror") && r[1 - i].might - r[i].might <= 1) { w = -1; spring(i); } });
    if (w >= 0) {
      if (has(w, "ember") && card(B.sides[w].cards[chs[w].card].key).suit === "wands") { r[w].harm += 2; spring(w); }
      if (has(w, "crown") && isMajor(w)) { B.sides[w].cel += 2; spring(w); }
    }
    // the coins and dice of this clash, shown in the middle of the board before the Might is counted (Cam, 2 Nov)
    var chance = [];
    [0, 1].forEach(function (i) { (r[i].chance || []).forEach(function (x) { chance.push(Object.assign({ who: i }, x)); }); });
    var story = { round: B.round + 1, ch: chs, r: r, winner: w, harm: 0, notes: [], seals: springs, chance: chance };
    [0, 1].forEach(function (i) { var S = B.sides[i]; S.cel -= spend(B, chs[i]); S.cards[chs[i].card].used = true; });
    if (w >= 0) {
      var W = B.sides[w], L = B.sides[1 - w], wc = W.cards[chs[w].card], lc = L.cards[chs[1 - w].card], wr = r[w], lr = r[1 - w];
      wc.won = 1;
      if (wr.ud > 0) wc.udWon = 1;                                   // (an underdog's win: its round XP twice)
      var guard = lc.guard + lr.fx.reduce(function (a, e) { return a + (e.k === "guard" ? e.n : 0); }, 0);
      var harm = Math.max(0, wr.harm - guard);
      if (L.full === "splendor-solis" && !L.stone) { L.stone = true; harm = 0; story.notes.push((1 - w) + ":full:splendor-solis"); }     // (audit 2 Nov: no +2 celestials)
      L.spirit -= harm; story.harm = harm;
      var li = 1 - w;
      if (harm > 0 && has(li, "thorn")) { W.spirit -= 2; spring(li); story.notes.push(w + ":recoil2"); }
      if (harm > 0 && has(li, "tide") && card(wc.key).suit === "cups") { L.spirit = Math.min(L.max, L.spirit + harm); spring(li); story.notes.push(li + ":heal" + harm); }
      if (has(li, "root") && L.spirit > 0 && L.spirit < 6) { L.spirit = Math.min(L.max, L.spirit + 4); spring(li); story.notes.push(li + ":heal4"); }
      var heal = wc.heal + W.healWin;
      if (wc.celWin) { W.cel += wc.celWin; story.notes.push(w + ":cel+" + wc.celWin); }
      wr.fx.forEach(function (e) {
        if (e.k === "heal") heal += e.n;
        if (e.k === "drain") heal += Math.floor(harm / 2);
        if (e.k === "celWin") { W.cel += e.n; story.notes.push(w + ":cel+" + e.n); }
        if (e.k === "recoil") { W.spirit -= e.n; story.notes.push(w + ":recoil" + e.n); }
        if (e.k === "poison") { L.poison += e.n; story.notes.push((1 - w) + ":poison"); }
        if (e.k === "burn") { var b = Math.min(L.cel, e.n); L.cel -= b; story.notes.push((1 - w) + ":burn" + b); }
        if (e.k === "steal") { var st2 = Math.min(L.cel, e.n); L.cel -= st2; W.cel += st2; if (st2) { story.notes.push((1 - w) + ":burn" + st2); story.notes.push(w + ":cel+" + st2); } }
      });
      lr.fx.forEach(function (e) { if (e.k === "celLose") { L.cel += e.n; story.notes.push((1 - w) + ":cel+" + e.n); } });
      if (W.full === "murder-of-crows" && L.cel > 0) { L.cel--; W.cel++; story.notes.push(w + ":cel+1"); story.notes.push(w + ":full:murder-of-crows"); }
      if (L.full === "secrets-of-the-witches-garden" && W.full !== "deadly-apothecary-oracle") { W.poison += 1; story.notes.push(w + ":poison"); }
      if (W.full === "deadly-apothecary-oracle" && L.full !== "deadly-apothecary-oracle") { L.poison += 1; story.notes.push((1 - w) + ":poison"); }
      if (heal > 0) { var before = W.spirit; W.spirit = Math.min(W.max, W.spirit + heal); if (W.spirit > before) story.notes.push(w + ":heal" + (W.spirit - before)); }
    }
    B.round++;
    [0, 1].forEach(function (i) { var S = B.sides[i]; if (S.full === "deadly-apothecary-oracle") S.poison = 0; if (S.poison > 0 && S.spirit > 0) { S.spirit -= S.poison; story.notes.push(i + ":poisoned" + S.poison); } });
    // (the buff audit, 2 Nov: Old Growth no longer heals every round)
    story.spirit = [B.sides[0].spirit, B.sides[1].spirit];
    story.cel = [B.sides[0].cel, B.sides[1].cel];
    B.log.push({ round: story.round, you: chs[0], foe: chs[1], winner: w, harm: story.harm, might: [r[0].might, r[1].might] });
    if (B.sides[0].spirit <= 0 || B.sides[1].spirit <= 0 || B.round >= ROUNDS) finish(B);
    story.ko = B.over && (B.sides[0].spirit <= 0 || B.sides[1].spirit <= 0);
    return story;
  }
  function finish(B) {
    var a = B.sides[0], b = B.sides[1], res;
    if (a.spirit <= 0 && b.spirit <= 0) res = "draw";
    else if (b.spirit <= 0) res = "win"; else if (a.spirit <= 0) res = "loss";
    else if (a.spirit !== b.spirit) res = a.spirit > b.spirit ? "win" : "loss";
    else {                                                            // (level on Spirit: whoever won more rounds)
      var wa = B.log.filter(function (l) { return l.winner === 0; }).length, wb = B.log.filter(function (l) { return l.winner === 1; }).length;
      res = wa === wb ? "draw" : wa > wb ? "win" : "loss";
    }
    B.over = true; B.result = res;
  }

  // ---- the AI: expected value over its options against the other side's remaining cards ---------------------------
  // v2 (Cam: "The AI player uses all their celestials in the first couple of turns -- is this intended?" -- no): a
  // celestial is worth what it could win in the rounds still to come, and it never bids more than about twice its fair
  // share unless the blow would end the battle.
  // ---- keeper temperaments (Q11 i1, Cam 2 Nov "Build next"; Hard's layer): each keeper plays to its card -- the scouting
  //      tent names it, so reading the keeper matters as much as their cards
  var TEMPERS = {
    rash: { name: "Rash", text: "spends its stars early and big" },
    patient: { name: "Patient", text: "hoards its stars for the last rounds" },
    furious: { name: "Furious", text: "lights Fury whenever it can" },
    veiled: { name: "Veiled", text: "turns its cards reversed to cancel your abilities" },
    steady: { name: "Steady", text: "plays the odds, no more" }
  };
  var MAJOR_TEMPER = { fool: "rash", magician: "steady", high_priestess: "veiled", empress: "patient", emperor: "steady", hierophant: "patient", lovers: "steady",
    chariot: "rash", strength: "patient", hermit: "patient", wheel: "rash", justice: "steady", hanged_man: "patient", death: "furious", temperance: "patient",
    devil: "furious", tower: "rash", star: "patient", moon: "veiled", sun: "rash", judgement: "furious", world: "steady" };
  function temperOf(camp, st) {
    if (camp === "fool") return MAJOR_TEMPER[MAJORS[st]] || "steady";
    return ["veiled", "rash", "patient", "furious", "steady"][(st | 0) % 5];
  }
  function aiChoose(B, me, skill) {
    var T = me === 1 && B.temper ? B.temper : null;
    var A = B.sides[me], F = B.sides[1 - me], left = ROUNDS - B.round;
    var mine = [], theirs = [];
    A.cards.forEach(function (c, i) { if (!c.used) mine.push(i); });
    F.cards.forEach(function (c, i) { if (!c.used) theirs.push(i); });
    var share = F.cel / Math.max(1, left), guesses = [0, Math.floor(share / 2), Math.round(share), Math.min(F.cel, Math.ceil(share * 1.6)), F.cel];
    var gw = [0.15, 0.2, 0.35, 0.2, 0.1];
    var harms = A.cards.concat(F.cards).filter(function (c) { return !c.used; }).map(function (c) { return c.harm; });
    var avgHarm = harms.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, harms.length);
    var celValue = left > 1 ? (0.45 + 0.35 * skill) * avgHarm * (left - 1) / Math.max(4, A.cel) : 0;
    var cap = left > 1 ? Math.ceil(A.cel / left * 1.5) : A.cel;
    if (T === "rash") { celValue *= 0.45; cap += 3; }                // (spends early)
    if (T === "patient") { celValue *= 1.7; cap = Math.max(1, cap - 1); }   // (keeps them back)
    var best = null, bestScore = -1e9, o = { rng: B.rng };
    for (var mi = 0; mi < mine.length; mi++) {
      var mc = A.cards[mine[mi]];
      var lethal = mc.harm + FURY.harm + 3 >= F.spirit;
      for (var fu = 0; fu < 2; fu++) {
        if (fu && A.cel < B.fury) continue;
        for (var cel = 0; cel + (fu ? B.fury : 0) <= A.cel; cel++) {
          if (cel + (fu ? B.fury : 0) > cap && !lethal) break;
          for (var rv = 0; rv < 2; rv++) {
            var ch = { card: mine[mi], cel: cel, rev: !!rv, fury: !!fu }, ev = 0;
            for (var ti = 0; ti < theirs.length; ti++) {
              for (var gi = 0; gi < guesses.length; gi++) {
                var fch = { card: theirs[ti], cel: Math.min(F.cel, guesses[gi]), rev: false };
                var r0 = clashCalc(B, me, ch, fch, null), r1 = clashCalc(B, 1 - me, fch, ch, null);
                var p = (gw[gi] / theirs.length), win = r0.might > r1.might ? 1 : r0.might < r1.might ? 0 : 0.5;
                var dealt = Math.max(0, r0.harm), taken = Math.max(0, r1.harm);
                var kill = dealt >= F.spirit ? 6 : 0, die = taken >= A.spirit ? 6 : 0;
                ev += p * (win * (dealt + kill) - (1 - win) * (taken + die));
                if (T === "veiled" && rv && card(F.cards[theirs[ti]].key).ab) ev += p * 0.9;     // (reverses to cancel your ability)
              }
            }
            var keep = (mc.pow + mc.harm) * 0.08 * (left - 1) / ROUNDS;
            var score = ev - (cel + (fu ? B.fury : 0)) * celValue - keep - (rv ? 0.05 : 0) + (rand(o) - 0.5) * (1 - skill) * 6 + (T === "furious" && fu ? 1.2 : 0);
            if (score > bestScore) { bestScore = score; best = ch; }
          }
        }
      }
    }
    B.rng = o.rng;
    if (B.twist && B.twist.rev) best.rev = true;
    return best;
  }

  // ---- after a battle: Moonstones, missions and the cards' own experience --------------------------------------------
  function reward(s, B, now) {
    var res = B.result, win = res === "win", loss = res === "loss", gold = 0, cost = 0, ev = [];
    if (B.mode === "lan") return pvpEnd(s, B, 0, now);
    if (B.mode === "duel") { var MD = s.stats.byMode[B.mode] || (s.stats.byMode[B.mode] = { w: 0, l: 0, d: 0 }); MD[win ? "w" : loss ? "l" : "d"]++; return [{ kind: "result", result: res, gold: 0, lost: 0, mode: B.mode, streak: s.streak, bonus: 0 }]; }
    if (B.mode === "skirmish") { var t = ECON.skirmish[B.opts.diff] || ECON.skirmish.normal; if (win) gold = t.win; if (loss) cost = Math.round(t.lose * (1 + ECON.renownLoss * renown(s))); }
    if (B.mode === "journey") {
      var cid = campOf(B.opts.camp), CP = CAMPAIGNS[cid], J = s.camp[cid], st = B.opts.station | 0;
      if (win) {
        // the first time past a station pays well (once ever: a road walked again after the World pays replays)
        gold = stationPay(s, cid, st);
        if (s.ngp) gold = Math.round(gold * (1 + NGP.pay * s.ngp));
        if (s.legacy.indexOf("friends") >= 0 && st > J.best) gold *= 2;
        if (J.asc > 0) { if ((J.ascPass[J.asc] || 0) < st) J.ascPass[J.asc] = st; }
        if (st > J.best) { J.best = st; ev.push({ kind: "station", camp: cid, n: st }); }
        var page = bookPage(s, cid, st, now);
        // keepers drop Seals: always the first time, two in five after
        if (F.seals && (page || rand(s) < 0.4)) { var dropS = pickOf(s, SEALS).id; s.seals[dropS] = (s.seals[dropS] || 0) + 1; if (!s.sealSet) s.sealSet = dropS; ev.push({ kind: "sealDrop", id: dropS }); }
        if (page) ev.push({ kind: "keeperPage", camp: cid, n: st, entry: page.id });
        // the last keeper beaten at Ascension N opens Ascension N+1
        if (st === CP.n && J.ascBest < ECON.asc.max && J.asc + 1 > J.ascBest) { J.ascBest = J.asc + 1; ev.push({ kind: "ascension", camp: cid, n: J.ascBest }); }
        if (st > J.cleared) J.cleared = st;
        if (st === CP.n) {
          // the end of the road (Cam: "a real reward for beating the World"): the oracle decks and their Pilgrimage;
          // the Pilgrimage's end opens the Cartomancer's Parlour
          if (cid === "fool" && !s.unlocks.oracle) { s.unlocks.oracle = true; ev.push({ kind: "unlock", what: "oracle" }); }
          if (cid === "oracle" && !s.unlocks.lenormand) { s.unlocks.lenormand = true; ev.push({ kind: "unlock", what: "lenormand" }); }
        }
      }
      if (loss) {
        cost = journeyLoss(s, cid, st);
        // a main keeper (the Chariot, Temperance, the World) sends you back to the start of the road, its names hidden again
        if (isMain(cid, st)) { J.cleared = 0; ev.push({ kind: "roadReset", camp: cid, station: st }); }
      }
    }
    // Play for Keeps (Cam, 1 Nov: "if you win you can select one of their cards and if they win they can select one of
    // your cards (limited to the hand you play in battle)"): a win lets you choose one of their four (keepsClaim); a loss,
    // and they take the best of your four -- one copy, so a double is the first to go
    if (B.mode === "keeps") {
      if (win) { B.keeps = { won: null }; ev.push({ kind: "keepsWin" }); }
      if (loss) {
        var best = B.sides[0].cards.map(function (bc) { return bc.key; }).filter(function (k) { return owned(s, k) && card(k); })
          .sort(function (a, b) { return RARITY[card(b).rarity].tier - RARITY[card(a).rarity].tier || s.cards[b].lv - s.cards[a].lv || card(b).pow - card(a).pow; })[0];
        if (best) { s.cards[best].n--; B.keeps = { lost: best }; ev.push({ kind: "keepsLost", key: best, last: s.cards[best].n === 0 }); }
      }
    }
    if (B.mode === "circuit") {
      var CI = circuitNow(s, now), cs = B.opts.station | 0, fresh = B.opts.week === CI.week;
      if (win && fresh && cs > CI.cleared) {
        gold = ECON.circuit.first + ECON.circuit.per * (cs - 1); CI.cleared = cs; CI.humble = CI.humble && !!B.opts.lv1;
        ev.push({ kind: "circuitStation", n: cs });
        if (cs === ECON.circuit.n) {
          var sid = F.seals ? pickOf(s, SEALS).id : null; if (sid) { s.seals[sid] = (s.seals[sid] || 0) + 1; if (!s.sealSet) s.sealSet = sid; }
          // a card from the deck you're nearest to completing (any missing card of it); none left to complete, a booster's
          var near = CAT.decks.filter(function (d) { return deckOpen(s, d.slug) && !deckDone(s, d.slug); }).sort(function (a, b) { return deckHave(s, b.slug) / CAT.byDeck[b.slug].length - deckHave(s, a.slug) / CAT.byDeck[a.slug].length; })[0];
          var miss = near ? CAT.byDeck[near.slug].filter(function (k) { return !owned(s, k); }) : [];
          var ck = miss.length ? pickOf(s, miss) : drawCard(s, null, !!(s.unlocks && s.unlocks.oracle));
          s.stats.circuits = (s.stats.circuits || 0) + 1; if (CI.humble) s.stats.circuitHumble = 1;
          ev.push({ kind: "circuitDone", seal: sid, card: { key: ck, isNew: addCard(s, ck) }, deck: near ? near.name : null, humble: CI.humble });
        }
      } else if (win) gold = ECON.circuit.replay;
    }
    if (B.mode === "trial") { if (win) gold = ECON.trial.win; if (loss) cost = ECON.trial.lose; s.trial = { day: dayOf(now), done: true, won: win }; }
    if (B.mode === "gauntlet") {
      var G = s.gauntlet;
      if (win) { G.wins++; G.pot += Math.round((ECON.gauntlet.base + ECON.gauntlet.per * G.wins) * ECON.diff[s.diff].gold); ev.push({ kind: "gauntletWin", wins: G.wins, pot: G.pot }); }
      // a lost streak costs half the pot (Cam, 1 Nov: "gauntlet doesn't cost anything when you lose ... make it cost half
      // of the pot"): the pot is gone and half its worth comes off your Moonstones; a draw ends the run, keeping half
      else if (loss) { cost = Math.floor(G.pot / 2); ev.push({ kind: "gauntletEnd", wins: G.wins, kept: 0, cost: cost }); s.gauntlet = null; }
      else { gold = Math.floor(G.pot / 2); ev.push({ kind: "gauntletEnd", wins: G.wins, kept: gold, cost: 0 }); s.gauntlet = null; }
    }
    if (gold && B.gold) gold = Math.round(gold * (1 + B.gold));
    if (gold) gold = Math.round(gold * ECON.diff[s.diff].gold);
    // the win streak (Mathematician, voted yes 1 Nov): +5% for each win in a row before this one, up to +25%
    var bonus = 0;
    if (B.mode !== "tutorial" && B.mode !== "keeps") {
      if (win) { bonus = Math.min(s.streak, ECON.streak.max) * ECON.streak.per; if (gold && bonus) gold = Math.round(gold * (1 + bonus)); s.streak++; }
      else if (loss) s.streak = 0;
    }
    var ko = win && B.mode !== "tutorial" && B.sides[1].spirit <= 0, koGold = ko && gold ? Math.round(gold * ECON.ko.gold) : 0;
    gold += koGold;
    s.moon += gold;
    var lost = Math.min(cost, s.moon);                               // (with nothing left, nothing is lost)
    s.moon -= lost;
    s.stats.battles++;
    s.stats[win ? "wins" : res === "loss" ? "losses" : "draws"]++;
    // the profile's numbers: by mode (duels too), by card, by deck (the eight, in any order), Moonstones in and out
    var M = s.stats.byMode[B.mode] || (s.stats.byMode[B.mode] = { w: 0, l: 0, d: 0 });
    M[win ? "w" : loss ? "l" : "d"]++;
    if (B.mode !== "tutorial") {
      B.log.forEach(function (l) { var k = B.sides[0].cards[l.you.card] && B.sides[0].cards[l.you.card].key; if (!k) return; s.stats.played[k] = (s.stats.played[k] || 0) + 1; if (l.winner === 0) s.stats.cardWins[k] = (s.stats.cardWins[k] || 0) + 1; });
      var sig = B.sides[0].deck.slice().sort().join("|"), DK = s.stats.decks[sig] || (s.stats.decks[sig] = { n: 0, w: 0, at: 0 });
      DK.n++; if (win) DK.w++; DK.at = now;
      var sigs = Object.keys(s.stats.decks);
      if (sigs.length > 120) sigs.sort(function (a, b) { return s.stats.decks[a].n - s.stats.decks[b].n; }).slice(0, sigs.length - 120).forEach(function (k) { delete s.stats.decks[k]; });
      s.stats.moonWon += gold; s.stats.moonLost += lost;
    }
    // what the achievements count
    if (B.mode !== "tutorial" && B.mode !== "duel") {
      s.stats.bestStreak = Math.max(s.stats.bestStreak, s.streak);
      if (B.mode === "gauntlet" && s.gauntlet) s.stats.gauntletBest = Math.max(s.stats.gauntletBest, s.gauntlet.wins);
      if (B.mode === "trial" && win) s.stats.trialWins++;
      if (win && B.sides[0].spirit >= B.sides[0].max) s.stats.flawless = 1;
      if (win && B.log.length && B.log.every(function (l) { return !l.you.cel && !l.you.fury; })) s.stats.nostars = 1;
      var last = B.log[B.log.length - 1];
      if (win && last && last.winner === 0 && last.you.fury && B.sides[1].spirit <= 0) s.stats.furyKo = 1;
    }
    // only a card that won its own clash gains XP (Cam, 1 Nov: "not all the cards gain experience, only the ones who won
    // in a one on one fight"): +1 for the round, +1 more if the battle was won too; the oracle's daily card adds one more
    var xps = [];
    B.sides[0].cards.forEach(function (bc) {
      var h = s.cards[bc.key];
      if (!h || !card(bc.key)) return;
      var XP = B.mode === "skirmish" ? ECON.skirmishXp[B.opts.diff] || ECON.xp : ECON.xp;
      var add = bc.won ? XP.round + (bc.udWon ? XP.round : 0) + (win ? XP.win : res === "draw" ? ECON.xp.draw : 0) + (B.xpBonus || 0) + (ko ? ECON.ko.xp : 0) : 0;
      if (add) add = Math.max(1, Math.round(add * ECON.diff[s.diff].xp));
      if (!add || h.lv >= maxLv(bc.key)) return;
      var from = h.lv;
      h.xp += add;
      while (h.lv < maxLv(bc.key) && h.xp >= xpNeed(bc.key, h.lv)) { h.xp -= xpNeed(bc.key, h.lv); h.lv++; }
      if (h.lv >= maxLv(bc.key)) h.xp = 0;
      xps.push({ key: bc.key, xp: add, from: from, to: h.lv, max: h.lv >= maxLv(bc.key) });
    });
    if (xps.length) ev.push({ kind: "cardXp", list: xps });
    ev = ev.concat(progress(s, now, "battles5", 1));
    if (win) {
      ev = ev.concat(progress(s, now, "win3", 1));
      var cs = B.sides[0].deck.map(card), n = function (su) { return cs.filter(function (c) { return c && c.suit === su; }).length; };
      if (n("cups") >= 3) ev = ev.concat(progress(s, now, "cups3", 1));
      if (n("wands") >= 3) ev = ev.concat(progress(s, now, "wands3", 1));
      if (n("swords") >= 3) ev = ev.concat(progress(s, now, "swords3", 1));
      if (n("pentacles") >= 3) ev = ev.concat(progress(s, now, "pent3", 1));
      if (B.sides[0].comboN >= 2) ev = ev.concat(progress(s, now, "combo", 1));
    }
    ev.push({ kind: "result", result: res, gold: gold, lost: lost, mode: B.mode, streak: s.streak, bonus: bonus, ko: ko, koGold: koGold });
    if (B.mode !== "tutorial") ev = ev.concat(playerXp(s, battlePxp(B.mode, B.opts && B.opts.diff, res, ko)));
    return ev;
  }
  /** The end of a duel on the home network, for one side (me: 0 the host, 1 the guest -- each game does its own): the
   *  record, and XP for every card that side played (ECON.pvp, + a knockout's). Nothing else changes hands. */
  function pvpEnd(s, B, me, now) {
    var res = me === 1 ? ({ win: "loss", loss: "win" }[B.result] || B.result) : B.result, win = res === "win", ko = B.sides[1 - me].spirit <= 0 && win;
    var MD = s.stats.byMode.lan || (s.stats.byMode.lan = { w: 0, l: 0, d: 0 }), wl = win ? "w" : res === "loss" ? "l" : "d";
    MD[wl]++;
    // the multiplayer record (Cam, 1 Nov: "stats should include multiplayer stats"): each opponent by name, knockouts, winnings
    var PV = s.stats.pvp || (s.stats.pvp = { peers: {}, ko: 0, koed: 0, gold: 0 }), foe = String(B.sides[1 - me].name || "Someone").slice(0, 30);
    var PP = PV.peers[foe] || (PV.peers[foe] = { w: 0, l: 0, d: 0, at: 0 });
    PP[wl]++; PP.at = now || 0;
    if (ko) PV.ko++;
    if (res === "loss" && B.sides[me].spirit <= 0) PV.koed++;
    var gold = win ? ECON.pvp.gold : 0;
    s.moon += gold; PV.gold += gold;
    var add = (ECON.pvp[res] || 0) + (ko ? ECON.ko.xp : 0), xps = [];
    B.sides[me].cards.forEach(function (bc) {
      var h = s.cards[bc.key];
      if (!h || !h.n || !card(bc.key) || h.lv >= maxLv(bc.key) || !add) return;
      var from = h.lv;
      h.xp += add;
      while (h.lv < maxLv(bc.key) && h.xp >= xpNeed(bc.key, h.lv)) { h.xp -= xpNeed(bc.key, h.lv); h.lv++; }
      if (h.lv >= maxLv(bc.key)) h.xp = 0;
      xps.push({ key: bc.key, xp: add, from: from, to: h.lv, max: h.lv >= maxLv(bc.key) });
    });
    var ev = xps.length ? [{ kind: "cardXp", list: xps }] : [];
    ev.push({ kind: "result", result: res, gold: gold, lost: 0, mode: "lan", streak: s.streak, bonus: 0, ko: ko, koGold: 0 });
    return ev.concat(playerXp(s, battlePxp("lan", null, res, ko)));
  }

  // ---- achievements (Cam, PT61: "the art director create prompts for achievements and an achievement diary, for example
  // 'Beat Magician Keeper' Easy, Normal and Hard ... the achievements can be selected as your profile picture"). Each is
  // earned in a save of a difficulty (Easy / Normal / Hard -- never Free); the page keeps a diary across every save.
  // art: a keeper's portrait, or an icon; t(s): is it done?
  var ACH = [];
  (function () {
    for (var st = 1; st <= 21; st++) (function (n) { ACH.push({ id: "keeper-fool-" + n, group: "The Fool's Journey", name: "Beat " + KEEPER_NAMES[n], face: "fool-" + n, t: function (s) { return s.camp.fool.best >= n; } }); })(st);
    PILGRIMAGE.forEach(function (P, i) { var n = i + 1; ACH.push({ id: "keeper-oracle-" + n, group: "The Veiled Pilgrimage", name: "Beat " + P.name, face: "oracle-" + n, t: function (s) { return s.camp.oracle.best >= n; } }); });
    [[1, "I"], [5, "V"], [10, "X"]].forEach(function (a) { ACH.push({ id: "asc-" + a[0], group: "Ascension", name: "Open Ascension " + a[1], icon: "laurel", t: function (s) { return s.camp.fool.ascBest >= a[0]; } }); });
    [[50, "Fifty cards"], [150, "A hundred and fifty cards"], [300, "Three hundred cards"]].forEach(function (a) { ACH.push({ id: "cards-" + a[0], group: "Collecting", name: a[1], text: "Own " + a[0] + " different cards", icon: "deckpack", t: function (s) { return Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }).length >= a[0]; } }); });
    // the Library (Cam, 2 Nov: "Lore unlocks can even have achievements that unlock as well")
    [[1, "lib-1", "The first page", "Read a page in the Library"], [25, "lib-25", "A reader", "Read 25 pages"], [70, "lib-70", "A scholar", "Read 70 pages"], [140, "lib-all", "Every page of lore", "Read all 140 pages of the twelve lore books"]].forEach(function (x) {
      ACH.push({ id: x[1], group: "The Library", name: x[2], text: x[3], icon: "journal", t: function (s) { return s.lib.pages >= x[0]; } }); });
    [["major", "The Major Arcana", "Collect all 22 pages of the Major Arcana"], ["minor", "The Minor Arcana", "Collect all 56 pages of the Minor Arcana"], ["chronicle", "The whole story", "Finish The Gilded Observatory"],
      ["field", "Field-tested", "Finish the Field Guide"]].forEach(function (x) {
      ACH.push({ id: "book-" + x[0], group: "The Library", name: x[1], text: x[2], icon: "combobook", t: function (s) { return s.lib.books.indexOf(x[0]) >= 0; } }); });
    ACH.push({ id: "deck-done", group: "Collecting", name: "A whole deck", text: "Complete a tarot or oracle deck", icon: "chest", t: function (s) { return CAT.decks.some(function (d) { var ks = CAT.byDeck[d.slug] || []; return ks.length && ks.every(function (k) { return owned(s, k); }); }); } });
    ACH.push({ id: "max-card", group: "Collecting", name: "Mastered", text: "Raise a card to its top level", icon: "celestial", t: function (s) { return Object.keys(s.cards).some(function (k) { return card(k) && s.cards[k].n > 0 && s.cards[k].lv >= maxLv(k); }); } });
    ACH.push({ id: "gild", group: "Collecting", name: "Gilded", text: "Gild a card", icon: "laurel", t: function (s) { return Object.keys(s.cards).some(function (k) { return s.cards[k].g; }); } });
    ACH.push({ id: "gild-deck", group: "Collecting", name: "A gilded spread", text: "Play a spread of eight gilded cards", icon: "laurel", t: function (s) { return s.spread.length === DECK && s.spread.every(function (k) { return s.cards[k] && s.cards[k].g; }); } });
    [[10, "Ten pages"], [29, "The whole book"]].forEach(function (a) { ACH.push({ id: "combos-" + a[0], group: "The Combo Book", name: a[1], text: "Write " + (a[0] === 29 ? "every page of" : a[0] + " pages in") + " the Combo Book", icon: "combobook", t: function (s) { return Object.keys(s.combos).length >= Math.min(a[0], COMBOS.length); } }); });
    [[5, "Five in a row"], [10, "Ten in a row"]].forEach(function (a) { ACH.push({ id: "streak-" + a[0], group: "Battle", name: a[1], text: "Win " + a[0] + " battles in a row", icon: "fury", t: function (s) { return s.stats.bestStreak >= a[0]; } }); });
    [[5, "Gauntlet runner"], [10, "Gauntlet master"]].forEach(function (a) { ACH.push({ id: "gauntlet-" + a[0], group: "Battle", name: a[1], text: a[0] + " wins in one Gauntlet run", icon: "gauntlet", t: function (s) { return s.stats.gauntletBest >= a[0]; } }); });
    ACH.push({ id: "circuit-1", group: "Battle", name: "The Apprentice's Circuit", text: "Beat all seven Pages of a week's Circuit", icon: "laurel", t: function (s) { return (s.stats.circuits || 0) >= 1; } });
    ACH.push({ id: "circuit-humble", group: "Battle", name: "Humble beginnings", text: "Beat the Circuit with eight Lv1 cards every time", icon: "laurel", t: function (s) { return !!s.stats.circuitHumble; } });
    ACH.push({ id: "trial-7", group: "Battle", name: "Seven trials", text: "Win 7 Daily Trials", icon: "trial", t: function (s) { return s.stats.trialWins >= 7; } });
    ACH.push({ id: "keeps-5", group: "Battle", name: "For keeps", text: "Win 5 cards in Play for Keeps", icon: "chest", t: function (s) { return s.stats.keepsWon >= 5; } });
    ACH.push({ id: "seals-10", group: "Battle", name: "Seal-breaker", text: "Spring 10 of your Seals", icon: "sealed", t: function (s) { return s.stats.sealsSprung >= 10; } });
    ACH.push({ id: "flawless", group: "Feats", name: "Untouched", text: "Win a battle without losing any Spirit", icon: "spirit", t: function (s) { return !!s.stats.flawless; } });
    ACH.push({ id: "nostars", group: "Feats", name: "Starless", text: "Win a battle without bidding a single star", icon: "celestial", t: function (s) { return !!s.stats.nostars; } });
    ACH.push({ id: "fury-ko", group: "Feats", name: "Fury's end", text: "Knock out a foe with Fury", icon: "fury", t: function (s) { return !!s.stats.furyKo; } });
    ACH.push({ id: "ngp-1", group: "New Game+", name: "Once more", text: "Begin a New Game+", icon: "laurel", t: function (s) { return s.ngp >= 1; } });
    ACH.push({ id: "ngp-world", group: "New Game+", name: "The World again", text: "Beat the World in New Game+", icon: "laurel", t: function (s) { return s.ngp >= 1 && s.camp.fool.best >= 21; } });
    ACH.push({ id: "ngp-5", group: "New Game+", name: "The fifth turning", text: "Reach New Game+ V", icon: "laurel", t: function (s) { return s.ngp >= 5; } });
    ACH.push({ id: "omen-30", group: "Divination", name: "A month of omens", text: "Draw the daily card 30 days running", icon: "daily", t: function (s) { return s.omenRun.n >= 30; } });
    ACH.push({ id: "readings-25", group: "Divination", name: "The reader", text: "Make 25 readings", icon: "journal", t: function (s) { return s.journal.filter(function (e) { return e.kind === "reading"; }).length >= 25; } });
  })();
  /** A badge as a profile picture: "ach:<id>:<easy|normal|hard>" (the page offers only ones earned). */
  function isBadge(k) { var m = /^ach:([a-z0-9-]{1,60}):(easy|normal|hard)$/.exec(String(k || "")); return !!(m && ACH_BY[m[1]]); }
  var ACH_BY = {};
  ACH.forEach(function (a) { ACH_BY[a.id] = a; });
  /** Achievements newly done in this save (never in a Free one): written into s.ach and returned. */
  function achieve(s, now) {
    if (!s.made || !ECON.diff[s.diff] || !ECON.diff[s.diff].ach) return [];
    if (!s.ach || typeof s.ach !== "object") s.ach = {};
    var got = [];
    ACH.forEach(function (a) { if (!s.ach[a.id]) { try { if (a.t(s)) { s.ach[a.id] = now; got.push(a.id); } } catch (e) { /* not yet */ } } });
    return got;
  }

  // ---- the tutorial's steps (the page walks through them with the guides; the rules only keep where you are) --------
  var TUT_STEPS = ["welcome", "starter", "card", "deck", "combos", "daily", "battle1", "battle2", "farewell"];

  // ---- what the player does -------------------------------------------------------------------------------------
  function no(s, msg) { return { ok: false, error: msg, state: s, events: [] }; }
  function act(state, action, opts, now) {
    var r = act0(state, action, opts, now);
    if (r.ok && r.state && r.state.made) { var got = achieve(r.state, now); if (got.length) r.events.push({ kind: "achieved", ids: got, diff: r.state.diff }); }
    return r;
  }
  function act0(state, action, opts, now) {
    opts = opts || {};
    var s = normal(state), ev = [];
    var done = function (msg) { return { ok: true, msg: msg || "", state: s, events: ev }; };
    if (action === "start") {
      if (s.made) return no(s, "Your collection has begun already.");
      s = fresh(now, opts.seed);
      if (opts.skipTutorial) s.tut = null;
      s.diff = ECON.diff[opts.diff] ? opts.diff : opts.kind === "sandbox" ? "free" : "normal";
      s.kind = s.diff === "free" ? "sandbox" : "normal";
      if (s.diff === "free") freeOpen(s);
      if (typeof opts.name === "string") s.name = opts.name.replace(/\s+/g, " ").trim().slice(0, 30);
      if (typeof opts.face === "string" && card(opts.face)) s.face = opts.face;
      return done("Welcome, seeker.");
    }
    if (!s.made) return no(s, "Begin your collection first.");
    missionsFor(s, now);

    if (action === "buyStarter") {                                  // Orrin's Starter Deck: your first 8 cards
      if (Object.keys(s.cards).some(function (k) { return owned(s, k); })) return no(s, "You have a spread already.");
      if (s.moon < ECON.starter) return no(s, "The Starter Spread is " + ECON.starter + " Moonstones.");
      s.moon -= ECON.starter;
      var st = starterDeck(s);
      st.forEach(function (k) { addCard(s, k); });
      s.spread = st.slice();
      ev.push({ kind: "pack", deck: null, starter: true, cards: st.map(function (k) { return { key: k, isNew: true }; }) });
      return done("");
    }
    if (action === "spread") {                                      // {keys: [8 card keys]}
      var ks = Array.isArray(opts.keys) ? opts.keys.filter(function (k, i, a) { return typeof k === "string" && card(k) && owned(s, k) && a.indexOf(k) === i; }) : [];
      if (ks.length !== DECK) return no(s, "A spread is " + DECK + " different cards you own.");
      if (s.battle && !s.battle.over) return no(s, "Finish your battle first.");
      s.spread = ks;
      return done("Spread set.");
    }
    if (action === "humbleSpread") {                                 // the best spread under the Circuit's cap
      var hs = humbleSpread(s);
      if (!hs) return no(s, "You need eight cards whose levels add up to " + ECON.circuit.cap + " or less.");
      if (spreadLevels(s) > ECON.circuit.cap && s.spread.length === DECK) {
        var bk = s.decks.filter(function (d) { return d.name === "Before the Circuit"; })[0];
        if (bk) bk.keys = s.spread.slice(); else if (s.decks.length < 24) s.decks.push({ id: "d" + now.toString(36) + "c", name: "Before the Circuit", keys: s.spread.slice() });
      }
      s.spread = hs;
      return done("A humble spread: levels " + spreadLevels(s) + " of " + ECON.circuit.cap + ". Your last spread is saved as \u201cBefore the Circuit\u201d.");
    }
    if (action === "deckSave") {                                    // {name}: the deck as it is, kept under a name
      var nm = String(opts.name || "").trim().slice(0, 40);
      if (!nm) return no(s, "Give the spread a name.");
      if (s.spread.length !== DECK) return no(s, "A spread is " + DECK + " cards.");
      var had = s.decks.filter(function (d) { return d.name.toLowerCase() === nm.toLowerCase(); })[0];
      if (had) had.keys = s.spread.slice();
      else { if (s.decks.length >= 24) return no(s, "You can keep 24 spreads -- delete one first."); s.decks.push({ id: "d" + now.toString(36) + Math.floor(rand(s) * 1e4).toString(36), name: nm, keys: s.spread.slice() }); }
      return done(had ? "\u201c" + nm + "\u201d updated." : "Saved as \u201c" + nm + "\u201d.");
    }
    if (action === "deckUse") {                                     // {id}: switch to a saved deck
      var sd = s.decks.filter(function (d) { return d.id === opts.id; })[0];
      if (!sd) return no(s, "There's no such spread.");
      if (s.battle && !s.battle.over) return no(s, "Finish your battle first.");
      var okKeys = sd.keys.filter(function (k, i, a) { return card(k) && owned(s, k) && a.indexOf(k) === i; });
      if (okKeys.length !== DECK) return no(s, "That spread is missing " + (DECK - okKeys.length) + " card" + (DECK - okKeys.length === 1 ? "" : "s") + " you no longer have.");
      s.spread = okKeys.slice();
      return done("Now playing \u201c" + sd.name + "\u201d.");
    }
    if (action === "deckDelete") {
      var nb = s.decks.length;
      s.decks = s.decks.filter(function (d) { return d.id !== opts.id; });
      return nb === s.decks.length ? no(s, "There's no such spread.") : done("");
    }
    if (action === "battle") {                                      // {mode, camp?, station?, diff?, n?}
      if (s.battle && !s.battle.over) return no(s, "You're in a battle already.");
      if (s.spread.length !== DECK) return no(s, "Build a spread of " + DECK + " cards first.");
      var mode = ["skirmish", "journey", "gauntlet", "trial", "tutorial", "keeps", "duel", "lan", "circuit"].indexOf(opts.mode) >= 0 ? opts.mode : "skirmish";
      if (mode === "lan" && !(opts.p2 && Array.isArray(opts.p2.keys))) return no(s, "A duel on the home network needs the other player's spread.");
      if (mode === "circuit") {
        var CW = circuitNow(s, now), want = opts.station | 0;
        if (want < 1 || want > ECON.circuit.n || want > CW.cleared + 1) return no(s, "Beat the Pages in order.");
        if (spreadLevels(s) > ECON.circuit.cap) return no(s, "Your spread's levels add up to " + spreadLevels(s) + " -- the Circuit allows " + ECON.circuit.cap + ".");
      }
      if (mode === "keeps" && keepsCount(s) < ECON.keeps.minCards) return no(s, "Play for Keeps needs at least " + ECON.keeps.minCards + " different cards in your collection.");
      if (mode === "journey") {
        var jc = campOf(opts.camp);
        if (!campOpen(s, jc)) return no(s, "That road isn't open to you yet.");
        if ((opts.station | 0) < 1 || (opts.station | 0) > Math.min(CAMPAIGNS[jc].n, s.camp[jc].cleared + 1)) return no(s, "That station is further along the road.");
      }
      if (mode === "trial" && s.trial && s.trial.day === dayOf(now)) return no(s, "Today's trial is done -- a new one tomorrow.");
      if (mode === "tutorial" && s.tut == null) return no(s, "The tutorial is over.");
      if (mode === "gauntlet" && !s.gauntlet) s.gauntlet = { wins: 0, pot: 0 };
      s.battle = startBattle(s, mode, { camp: opts.camp, station: opts.station | 0, diff: opts.diff, n: opts.n | 0, deck: typeof opts.deck === "string" ? opts.deck : "", p2: opts.p2 && typeof opts.p2 === "object" ? opts.p2 : null, tier: opts.tier }, now);
      if (s.battle.keeper) {                                        // (the keeper takes their next spread next time; this one is known now)
        var kk = s.battle.opts.camp + ":" + s.battle.opts.station;
        s.keeperRot[kk] = (s.keeperRot[kk] || 0) + 1; s.keeperFaced[kk + ":" + s.battle.keeper.i] = 1;
      }
      // the combo book: an entry is found the first time you take its combo into battle
      var found = s.battle.sides[0].combos.filter(function (id) { return !s.combos[id]; });
      found.forEach(function (id) { s.combos[id] = now; });
      if (found.length) ev.push({ kind: "discover", ids: found });
      ev.push({ kind: "battle" });
      return done("");
    }
    if (action === "duelMove") {                                   // {a, b}: player 1's and player 2's choices
      var BD = s.battle;
      if (!BD || BD.over || (BD.mode !== "duel" && BD.mode !== "lan")) return no(s, "There's no duel on.");
      var ca = { card: opts.a && opts.a.card | 0, cel: opts.a && opts.a.cel | 0, rev: !!(opts.a && opts.a.rev), fury: !!(opts.a && opts.a.fury) };
      var cb = { card: opts.b && opts.b.card | 0, cel: opts.b && opts.b.cel | 0, rev: !!(opts.b && opts.b.rev), fury: !!(opts.b && opts.b.fury) };
      if (!validChoice(BD, 0, ca) || !validChoice(BD, 1, cb)) return no(s, "That isn't a fair move.");
      var sd = playRound(BD, [ca, cb]);
      ev.push({ kind: "round", story: sd });
      if (BD.over) ev = ev.concat(reward(s, BD, now));
      return done("");
    }
    if (action === "move") {                                        // {card, cel, rev, fury}
      var B = s.battle;
      if (!B || B.over) return no(s, "There's no battle on.");
      var ch = { card: opts.card | 0, cel: opts.cel | 0, rev: !!opts.rev, fury: !!opts.fury };
      if (!validChoice(B, 0, ch)) return no(s, ch.fury ? "Fury needs " + B.fury + " celestials on top of those you bid." : "You can't play that.");
      var mineBefore = B.sprung ? B.sprung[0] : false;
      if (B.seal && B.seal[0] === "lantern" && !B.sprung[0] && B.round === 2) { B.sprung[0] = true; ev.push({ kind: "seal", side: 0, id: "lantern" }); }
      if (B.mode === "duel" || B.mode === "lan") return no(s, "In a duel, both players choose.");
      var foe = aiChoose(B, 1, B.ai), story = playRound(B, [ch, foe]);
      if (B.seal && B.seal[0] && B.sprung[0] && !mineBefore) useSeal(s, B.seal[0]);
      if (story.winner === 0) {
        if (ch.cel === 0) ev = ev.concat(progress(s, now, "zero", 1));
        if (ch.rev) ev = ev.concat(progress(s, now, "rev", 1));
        if (ch.fury) ev = ev.concat(progress(s, now, "fury", 1));
        var cs0 = card(B.sides[0].cards[ch.card].key);
        if (cs0.suit === "major") ev = ev.concat(progress(s, now, "major", 1));
        if (cs0.suit === "oracle") ev = ev.concat(progress(s, now, "oracle", 1));
        s.stats.harm += story.harm; ev = ev.concat(progress(s, now, "harm40", story.harm));
      }
      ev.push({ kind: "round", story: story });
      if (B.over) ev = ev.concat(reward(s, B, now));
      return done("");
    }
    if (action === "forfeit") {
      var B2 = s.battle;
      if (!B2 || B2.over) return no(s, "There's no battle on.");
      B2.sides[0].spirit = 0; finish(B2); B2.result = "loss";
      ev = ev.concat(reward(s, B2, now));
      return done("You walked away.");
    }
    if (action === "leaveBattle") {
      if (s.battle && !s.battle.over) return no(s, "The battle isn't over.");
      if (s.battle && s.battle.keeps && s.battle.keeps.won === null) return no(s, "Choose the card you'll keep first.");
      s.battle = null; return done("");
    }
    // the mulligan (Combat Designer, voted yes 1 Nov): once a battle, before the first round, swap one of your four for
    // one of the other four in your deck, for a celestial
    // (Cam, N70/PT61: "a little overpowered ... only show 2 of the other cards"; and the number by difficulty)
    if (action === "mulliganOffer") {                               // the two cards this mulligan offers (fixed once shown)
      var BO = s.battle, mo = BO && BO.sides[0];
      if (!BO || BO.over || BO.round !== 0 || BO.log.length) return no(s, "A mulligan is only before the first round.");
      if (!(BO.mulls > 0)) return no(s, "No mulligans left in this battle.");
      if (!BO.offer) {
        var spare = mo.deck.filter(function (k) { return !mo.cards.some(function (c) { return c.key === k; }); });
        shuffle(BO, spare); BO.offer = spare.slice(0, ECON.mullOffer);
      }
      ev.push({ kind: "offer", keys: BO.offer.slice() });
      return done("");
    }
    if (action === "mulligan") {                                    // {card: index in your four, with: one of the offer}
      var BM = s.battle, me = BM && BM.sides[0];
      if (!BM || BM.over || BM.round !== 0 || BM.log.length) return no(s, "A mulligan is only before the first round.");
      if (!(BM.mulls > 0)) return no(s, "No mulligans left in this battle.");
      if (me.cel < ECON.mulligan) return no(s, "A mulligan costs " + ECON.mulligan + " celestial.");
      var ci = opts.card | 0, wi = me.deck.indexOf(opts.with);
      if (!BM.offer || BM.offer.indexOf(opts.with) < 0) return no(s, "Choose one of the two cards offered.");
      if (!me.cards[ci] || wi < 0 || me.cards.some(function (c) { return c.key === opts.with; })) return no(s, "Swap one of your four for one still in your spread.");
      var lv = me.deck.map(function (k) { return s.cards[k] ? s.cards[k].lv : 1; });
      me.cards[ci] = onField(battleCard(me.deck, lv, wi, resonance(me.deck, lv), dailyOn(s, now) ? omen(s.daily) : null, me.deck.map(function (k) { return !!(s.cards[k] && s.cards[k].g); })), BM.field);
      me.cel -= ECON.mulligan; BM.mulls--; BM.offer = null;
      ev.push({ kind: "mulligan", out: opts.card | 0, key: opts.with });
      return done("");
    }
    // the sandbox (QA Lead, voted yes 1 Nov): testing tools from Settings -- s.sandbox marks a save that's used them
    if (action === "sandbox") {                                     // {op, n?}
      if (s.diff !== "free") return no(s, "Testing tools are for Free (sandbox) saves -- make one from Saves.");
      s.sandbox = true;
      if (opts.op === "moon") s.moon += 1000;
      else if (opts.op === "road") { var to = clamp(opts.n | 0, 0, 20); s.camp.fool.cleared = to; s.camp.fool.best = Math.max(s.camp.fool.best, to); }
      else if (opts.op === "world") { s.camp.fool.cleared = 21; s.camp.fool.best = 21; s.unlocks.oracle = true; }
      else if (opts.op === "maxdeck") s.spread.forEach(function (k) { if (s.cards[k]) { s.cards[k].lv = maxLv(k); s.cards[k].xp = 0; } });
      else if (opts.op === "cards") { for (var q = 0; q < 3; q++) ev.push({ kind: "pack", deck: null, cards: openPack(s, null) }); }
      else if (opts.op === "win") { var BW = s.battle; if (!BW || BW.over) return no(s, "There's no battle on."); BW.sides[1].spirit = 0; finish(BW); BW.result = "win"; ev = ev.concat(reward(s, BW, now)); }
      else if (opts.op === "daily") { s.daily = null; }
      else return no(s, "No such tool.");
      return done("");
    }
    // the profile picture (Cam, 1 Nov: "draw a random card for a profile picture which appears in battle like the
    // Keepers does"): drawn from all the cards in the game, or set to one
    if (action === "libSync") { s.lib = { pages: Math.max(0, Math.floor(+opts.pages || 0)), books: Array.isArray(opts.books) ? opts.books.slice(0, 40) : [] }; s.lib = normal(Object.assign({}, s, { lib: s.lib })).lib; return done(""); }
    if (action === "drawFace") { var all = CAT.cards.filter(function (c) { return c.key !== s.face; }); if (!all.length) return no(s, "No cards to draw."); s.face = all[Math.floor(rand(s) * all.length)].key; return done(""); }
    if (action === "setFace") { if (!card(opts.key) && !isBadge(opts.key)) return no(s, "There's no such card or badge."); s.face = opts.key; return done(""); }
    if (action === "rename") { var nm = String(opts.name || "").replace(/\s+/g, " ").trim().slice(0, 30); if (!nm) return no(s, "Give the save a name."); s.name = nm; return done(""); }
    // a trade across the home network: one copy of each card given leaves, one of each taken arrives (both sides confirmed
    // on their own screens first -- app.js)
    if (action === "lanEnd") {                                       // the guest's game, when the host's battle ends
      var LB = s.battle;
      if (!LB || LB.mode !== "lan" || !LB.over) return no(s, "There's no finished duel.");
      if (LB.xpDone) return no(s, "");
      LB.xpDone = true;
      ev = ev.concat(pvpEnd(s, LB, 1, now));
      return done("");
    }
    if (action === "tradeApply") {                                  // {give: [keys], get: [keys]}
      var give = Array.isArray(opts.give) ? opts.give.slice(0, 12) : [], get = Array.isArray(opts.get) ? opts.get.slice(0, 12) : [];
      if (s.battle && !s.battle.over) return no(s, "Finish your battle first.");
      if (!give.length && !get.length) return no(s, "Nothing to trade.");
      var need = {};
      give.forEach(function (k) { need[k] = (need[k] || 0) + 1; });
      var bad = Object.keys(need).filter(function (k) { return !card(k) || !s.cards[k] || s.cards[k].n < need[k]; });
      if (bad.length) return no(s, "You don't have enough of a card you offered.");
      if (get.some(function (k) { return !card(k); })) return no(s, "A card they offered isn't in this game.");
      give.forEach(function (k) { s.cards[k].n--; });
      var gotNew = get.map(function (k) { return { key: k, isNew: addCard(s, k) }; });
      s.spread = s.spread.filter(function (k) { return owned(s, k); });
      if (s.spread.length < DECK) s.spread = fillDeck(s, s.spread);
      s.stats.traded = (s.stats.traded || 0) + 1;
      s.stats.tradeGave = (s.stats.tradeGave || 0) + give.length; s.stats.tradeGot = (s.stats.tradeGot || 0) + get.length;
      if (typeof opts.peer === "string" && opts.peer) { var TP = s.stats.tradeWith || (s.stats.tradeWith = {}), tn = opts.peer.slice(0, 30); TP[tn] = (TP[tn] || 0) + 1; }
      ev.push({ kind: "traded", gave: give, got: gotNew });
      return done("Traded.");
    }
    if (action === "buySeal") {                                     // {id}
      var SB = SEAL[opts.id];
      if (!SB) return no(s, "There's no such Seal.");
      if (s.moon < SB.price) return no(s, "You need " + SB.price + " Moonstones.");
      s.moon -= SB.price; s.seals[SB.id] = (s.seals[SB.id] || 0) + 1;
      if (!s.sealSet) s.sealSet = SB.id;
      ev.push({ kind: "sealGot", id: SB.id });
      return done(SB.name + " -- yours.");
    }
    if (action === "setSeal") {                                     // {id | null}: the Seal you take into battles
      if (opts.id == null || opts.id === "") { s.sealSet = null; return done(""); }
      if (!SEAL[opts.id] || !s.seals[opts.id]) return no(s, "You don't have that Seal.");
      s.sealSet = opts.id; return done("");
    }
    if (action === "hourglass") {                                   // the turn timer ran out with the Hourglass Seal set
      var BH = s.battle;
      if (!BH || BH.over || !BH.seal || BH.seal[0] !== "hourglass" || BH.sprung[0]) return no(s, "");
      BH.sprung[0] = true; useSeal(s, "hourglass");
      ev.push({ kind: "seal", side: 0, id: "hourglass" });
      return done("");
    }
    if (action === "ascend") {                                      // {n}: walk the Fool's Journey from the start at Ascension n (0 = plain)
      var JA = s.camp.fool, an = opts.n | 0;
      if (s.battle && !s.battle.over) return no(s, "Finish your battle first.");
      if (an < 0 || an > JA.ascBest) return no(s, "That Ascension isn't open yet.");
      JA.asc = an; JA.cleared = 0;
      return done(an ? "Ascension " + an + ": the road begins again, and every keeper is stronger." : "The road begins again.");
    }
    if (action === "gild") {                                        // {key}: a maxed card, a spare copy and a fee
      var gk = opts.key, gh = s.cards[gk];
      if (!gh || !card(gk) || gh.n < 1) return no(s, "You don't have that card.");
      if (gh.g) return no(s, "It's gilded already.");
      if (gh.lv < maxLv(gk)) return no(s, "Only a card at its top level can be gilded.");
      if (gh.n < 2) return no(s, "Gilding takes a spare copy of the card.");
      var fee = ECON.gild[card(gk).rarity];
      if (s.moon < fee) return no(s, "Gilding costs " + fee + " Moonstones.");
      gh.n--; gh.g = true; s.moon -= fee;
      ev.push({ kind: "gilded", key: gk });
      return done(card(gk).name + " is gilded.");
    }
    if (action === "keepsClaim") {                                  // {key}: the card you take after winning Play for Keeps
      var BK = s.battle;
      if (!BK || !BK.over || BK.mode !== "keeps" || !BK.keeps || BK.keeps.won !== null) return no(s, "There's nothing to claim.");
      if (!BK.sides[1].cards.some(function (c) { return c.key === opts.key; }) || !card(opts.key)) return no(s, "That card wasn't in their hand.");
      var isNew = addCard(s, opts.key); BK.keeps.won = opts.key; s.stats.keepsWon++;
      ev.push({ kind: "keepsClaimed", key: opts.key, isNew: isNew });
      return done("It's yours.");
    }
    if (action === "cashOut") {
      if (!s.gauntlet || (s.battle && !s.battle.over)) return no(s, "Nothing to cash out.");
      var pot = s.gauntlet.pot; s.moon += pot; ev.push({ kind: "cashOut", gold: pot, wins: s.gauntlet.wins }); s.gauntlet = null;
      return done("You took " + pot + " Moonstones from the Gauntlet.");
    }
    if (action === "buyPack") {                                     // {deck?}
      var dsl = opts.deck ? String(opts.deck) : null;
      if (dsl && !CAT.byDeck[dsl]) return no(s, "There's no such deck.");
      if (dsl && !deckOpen(s, dsl)) return no(s, "The oracle decks open when you beat the World.");
      var price = dsl ? ECON.deckPack.price : ECON.pack.price;
      if (s.moon < price) return no(s, "You need " + price + " Moonstones.");
      s.moon -= price; s.stats.packs++;
      ev.push({ kind: "pack", deck: dsl, cards: openPack(s, dsl) });
      ev = ev.concat(progress(s, now, "pack", 1));
      if (s.spread.length < DECK) s.spread = fillDeck(s, s.spread);
      return done("");
    }
    if (action === "buyDeck") {                                     // {deck}: every card of it you're missing
      var sl = String(opts.deck || "");
      if (!CAT.byDeck[sl]) return no(s, "There's no such deck.");
      if (!deckOpen(s, sl)) return no(s, "The oracle decks open when you beat the World.");
      if (deckDone(s, sl)) return no(s, "You have every card of that deck.");
      var dp = deckPrice(s, sl);
      if (s.moon < dp) return no(s, "Completing it costs " + dp + " Moonstones.");
      s.moon -= dp;
      var gotKeys = CAT.byDeck[sl].filter(function (k) { return !owned(s, k); });
      gotKeys.forEach(function (k) { addCard(s, k); });
      ev.push({ kind: "deckDone", deck: sl, cards: gotKeys });
      return done(deckOf(sl).name + " is complete -- it's yours for readings.");
    }
    if (action === "sacrifice") {                                   // {target, feed: {key: n}}: doubles into a card's levels
      var tk = String(opts.target || ""), T = s.cards[tk];
      if (!T || !T.n || !card(tk)) return no(s, "You don't have that card.");
      if (T.lv >= maxLv(tk)) return no(s, "It's at its highest level.");
      var feed = opts.feed && typeof opts.feed === "object" ? opts.feed : {}, xp = 0, used = {};
      Object.keys(feed).slice(0, 200).forEach(function (k) {
        var n = Math.floor(Number(feed[k]) || 0), H = s.cards[k];
        if (n <= 0 || !H || !card(k)) return;
        n = Math.min(n, (k === tk ? H.n - 1 : sacrificeable(s, k)) - (used[k] || 0));       // (its own spares feed it too; never its last copy)
        if (n <= 0) return;
        used[k] = (used[k] || 0) + n; xp += n * sacrificeXp(k, H.lv);
      });
      if (!xp) return no(s, "Choose cards to sacrifice -- doubles, or a trained card that isn't in your spread.");
      var fee = ECON.levelFee * T.lv;
      if (s.moon < fee) return no(s, "The Altar asks " + fee + " Moonstones.");
      s.moon -= fee;
      Object.keys(used).forEach(function (k) { var H = s.cards[k]; H.n -= used[k]; if (H.n <= 0) { H.n = 0; H.lv = 1; H.xp = 0; delete H.g; } });   // (a card given whole starts again if it comes back)
      var from = T.lv;
      T.xp += xp;
      while (T.lv < maxLv(tk) && T.xp >= xpNeed(tk, T.lv)) { T.xp -= xpNeed(tk, T.lv); T.lv++; }
      if (T.lv >= maxLv(tk)) T.xp = 0;
      ev.push({ kind: "levelUp", key: tk, from: from, to: T.lv, max: T.lv >= maxLv(tk), xp: xp });
      return done(T.lv > from ? card(tk).name + " rose to level " + T.lv + "." : card(tk).name + " took " + xp + " XP.");
    }
    if (action === "daily") {
      if (dailyOn(s, now)) return no(s, "You've drawn today's card. Another tomorrow.");
      var mine = Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }).sort();
      if (!mine.length) return no(s, "You have no cards to draw from.");
      var dk = mine[Math.floor(rand(s) * mine.length)], drev = rand(s) < 0.3;
      s.daily = { day: dayOf(now), key: dk, rev: drev };
      var entry = { id: "j" + now.toString(36) + Math.floor(rand(s) * 1e6).toString(36), at: now, kind: "daily", title: "Card of the day", spread: "daily",
        cards: [{ key: dk, rev: drev, pos: "Today" }], notes: "" };
      s.journal.push(entry);
      // the Omen streak (Economist, voted yes 1 Nov): draw it on days running; every 7th, a free Starlight booster
      var today = dayOf(now), yday = dayOf(now - 864e5);
      s.omenRun = { n: s.omenRun.day === yday ? s.omenRun.n + 1 : 1, day: today };
      var gift = s.omenRun.n % ECON.omen.every === 0 ? giftCards(s, ECON.omen.gift) : null;
      ev.push({ kind: "daily", key: dk, rev: drev, omen: omen(s.daily), entry: entry.id, run: s.omenRun.n, gift: gift });
      return done("");
    }
    if (action === "claim") {
      var M = missionsFor(s, now), m = M.list.filter(function (x) { return x.id === opts.id; })[0];
      var goal = m && MISSIONS.filter(function (x) { return x.id === m.id; })[0].goal;
      if (!m || m.claimed || m.prog < goal) return no(s, "That mission isn't done.");
      m.claimed = true; s.moon += ECON.mission;
      ev.push({ kind: "claim", gold: ECON.mission });
      return done("+" + ECON.mission + " Moonstones.");
    }
    if (action === "reading") {                                     // {deck, spread}
      // (Cam, 1 Nov: "It will pull from the cards I have unlocked ... once fully unlocked I can pick to read from that
      // specific deck") -- "collection": every card you own; a deck's slug: that deck, once it's complete
      var rsl = String(opts.deck || ""), SP = SPREADS[opts.spread], coll = rsl === "collection";
      if (!SP) return no(s, "There's no such spread.");
      var poolKeys = coll ? Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }) : CAT.byDeck[rsl];
      if (!coll && !deckDone(s, rsl)) return no(s, "Complete a deck to read with it alone -- or read from your whole collection.");
      if (!poolKeys || SP.pos.length > poolKeys.length) return no(s, "You need " + SP.pos.length + " cards for this spread.");
      var deckKeys = shuffle(s, poolKeys.slice()), drawn = SP.pos.map(function (pos, i) { return { key: deckKeys[i], rev: rand(s) < 0.3, pos: pos }; });
      var e2 = { id: "j" + now.toString(36) + Math.floor(rand(s) * 1e6).toString(36), at: now, kind: "reading", title: SP.name + " -- " + (coll ? "your collection" : deckOf(rsl).name),
        spread: opts.spread, deck: rsl, cards: drawn, notes: "" };
      s.journal.push(e2);
      ev.push({ kind: "reading", entry: e2.id });
      return done("");
    }
    if (action === "note") {
      var je = s.journal.filter(function (e) { return e.id === opts.id; })[0];
      if (!je) return no(s, "There's no such entry.");
      je.notes = String(opts.text == null ? "" : opts.text).slice(0, 4000);
      return done("");
    }
    if (action === "unjournal") {
      var before = s.journal.length;
      s.journal = s.journal.filter(function (e) { return e.id !== opts.id; });
      return before === s.journal.length ? no(s, "There's no such entry.") : done("");
    }
    if (action === "tut") {                                         // {step}: where the tutorial is (forward only), or "done"
      if (s.tut == null && !opts.restart) return no(s, "The tutorial is over.");
      if (opts.restart) { s.tut = Object.keys(s.cards).some(function (k) { return owned(s, k); }) ? 2 : 0; return done(""); }
      if (opts.step === "done") {
        s.tut = null;
        if (!s.tutPaid) { s.tutPaid = true; s.moon += ECON.tutorial; ev.push({ kind: "tutPaid", gold: ECON.tutorial }); }
        return done("");
      }
      var to = TUT_STEPS.indexOf(opts.step);
      if (to < 0) return no(s, "There's no such step.");
      s.tut = Math.max(s.tut, to);
      return done("");
    }
    if (action === "prefs") {
      ["music", "sfx", "motion"].forEach(function (k) { if (typeof opts[k] === "boolean") s.prefs[k] = opts[k]; });
      if (typeof opts.vol === "number" && isFinite(opts.vol)) s.prefs.vol = clamp(opts.vol, 0, 1);
      if ([0, 15, 20, 30, 45, 60].indexOf(opts.timer) >= 0) s.prefs.timer = opts.timer;
      if (A11Y.text.indexOf(opts.text) >= 0) s.prefs.text = opts.text;
      ["read", "bookText", "lines", "bookFont"].forEach(function (k) { if (A11Y[k].indexOf(opts[k]) >= 0) s.prefs[k] = opts[k]; });
      ["hc", "cb", "wide", "focus"].forEach(function (k) { if (typeof opts[k] === "boolean") s.prefs[k] = opts[k]; });
      return done("");
    }
    if (action === "seen") { if (typeof opts.key === "string" && opts.key.length < 80) s.seen[opts.key] = 1; return done(""); }
    return no(s, "Unknown action.");
  }

  var SPREADS = {
    one: { name: "One Card", pos: ["The heart of it"] },
    three: { name: "Past, Present, Future", pos: ["Past", "Present", "Future"] },
    mbs: { name: "Mind, Body, Spirit", pos: ["Mind", "Body", "Spirit"] },
    choice: { name: "Two Paths", pos: ["Where you stand", "The first path", "The second path", "What you need to know"] },
    cross: { name: "Five-Card Cross", pos: ["The present", "The past", "The future", "The cause", "The potential"] },
    horseshoe: { name: "Horseshoe", pos: ["The past", "The present", "Hidden influences", "Obstacles", "Others around you", "What to do", "The outcome"] },
    self: { name: "Know Thyself", pos: ["Who am I?", "What are my needs?", "How do I meet them?"] },
    celtic: { name: "Celtic Cross", pos: ["The present", "The challenge", "The root", "The recent past", "What may come", "The near future",
      "Yourself", "Your surroundings", "Hopes and fears", "The outcome"] }
  };

  /** A deck of 8 from a collection, roughly the strongest with an eye to combos (for "Best deck" and a new player). */
  function cardScore(s, k) { var st = statsOf(k, s.cards[k] ? s.cards[k].lv : 1); return st.pow + st.harm + (card(k).ab ? 2 : 0) + st.heal + st.guard + st.cel; }
  function fillDeck(s, start) {
    var mine = Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); });
    mine.sort(function (a, b) { return cardScore(s, b) - cardScore(s, a) || (a < b ? -1 : 1); });
    var out = (start || []).filter(function (k) { return mine.indexOf(k) >= 0; });
    mine.forEach(function (k) { if (out.length < DECK && out.indexOf(k) < 0) out.push(k); });
    return out;
  }
  function bestSpread(s) {
    var mine = Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); });
    mine.sort(function (a, b) { return cardScore(s, b) - cardScore(s, a) || (a < b ? -1 : 1); });
    var out = fillDeck(s, []);
    var val = function (ks) { var R = resonance(ks); return ks.reduce(function (a, k) { return a + cardScore(s, k); }, 0) + R.list.length * 4; };
    var top = mine.slice(0, 80), cur = val(out);
    for (var pass = 0; pass < 3 && out.length === DECK; pass++) {
      for (var i = 0; i < DECK; i++) for (var j = 0; j < top.length; j++) {
        if (out.indexOf(top[j]) >= 0) continue;
        var t = out.slice(); t[i] = top[j];
        var v = val(t);
        if (v > cur) { out = t; cur = v; }
      }
    }
    return out;
  }

  // ---- scouting (Cam, 2 Nov: "a reason to mix and match and adjust your deck according to who you are versing") --------
  /** Who you'll face, before you face them: the battle a "battle" action would start now (nothing changes -- the same
      seed gives the same foe, whichever spread you bring), and how each of your spreads matches up against it. */
  function scout(state, mode, opts, now) {
    var s = normal(JSON.parse(JSON.stringify(state)));
    if (!s.made || s.spread.length !== DECK) return null;
    opts = opts || {};
    var B = startBattle(s, mode, { camp: opts.camp, station: opts.station | 0, diff: opts.diff, n: opts.n | 0 }, now), T = B.sides[1];
    var keys = T.deck, cs = keys.map(card), kinds = { major: 0, court: 0, pip: 0, oracle: 0 }, suits = {}, decks = {};
    cs.forEach(function (c) { kinds[kindOf(c)]++; suits[c.suit] = (suits[c.suit] || 0) + 1; decks[c.deck] = (decks[c.deck] || 0) + 1; });
    var K = B.keeper, faced = K ? !!s.keeperFaced[B.opts.camp + ":" + B.opts.station + ":" + K.i] : false;
    var lv = foeLevelsOf(B);
    // your cards that hunt / fear something they bring, and the Power that's worth in an average clash (any of yours
    // against any of theirs)
    var match = function (ks) {
      var hunt = 0, fear = 0, sum = 0;
      ks.map(card).filter(Boolean).forEach(function (c) { var A = affinityOf(c.deck); if (kinds[A.hunt]) hunt++; if (kinds[A.fear]) fear++;
        sum += (kinds[A.hunt] || 0) * LORE.AFFINITY_N.hunt - (kinds[A.fear] || 0) * LORE.AFFINITY_N.fear; });
      return { hunt: hunt, fear: fear, edge: Math.round(sum / (DECK * DECK) * 10) / 10 };
    };
    var spreads = [{ id: "", name: "Your spread now", current: true, m: match(s.spread) }].concat(s.decks.filter(function (d) {
      return d.keys.length === DECK && d.keys.every(function (k, i, a) { return card(k) && owned(s, k) && a.indexOf(k) === i; }) && d.keys.join() !== s.spread.join();
    }).map(function (d) { return { id: d.id, name: d.name, current: false, m: match(d.keys) }; }));
    var K0 = K ? (LORE.KEEPERS[B.opts.camp] || {})[B.opts.station] : null;
    return {
      mode: mode, name: T.name, field: B.field, twist: B.twist, seal: !!B.seal[1], temper: B.temper ? Object.assign({ id: B.temper }, TEMPERS[B.temper]) : null,
      keeper: K ? { i: K.i, n: K.n, faced: faced, note: K0 ? K0.note : "" } : null,
      cards: K && faced ? keys.map(function (k, i) { return { key: k, lv: lv[i] }; }) : null,
      kinds: kinds, suits: suits, combos: T.combos.slice(),
      decks: Object.keys(decks).map(function (sl) { var D = deckOf(sl), A = affinityOf(sl), L = leanOf(sl); return { slug: sl, name: D ? D.name : sl, n: decks[sl], hunt: A.hunt, fear: A.fear, lean: L ? { name: L.name, text: L.text } : null }; })
        .sort(function (a, b) { return b.n - a.n; }),
      spreads: spreads
    };
  }
  function foeLevelsOf(B) { return B.sides[1].deck.map(function (k) { var c = B.sides[1].cards.filter(function (x) { return x.key === k; })[0]; return c ? c.lv : 0; }); }

  // ---- what the page shows ----------------------------------------------------------------------------------------
  function cardView(s, k) {
    var c = card(k), h = s.cards[k] || { n: 0, lv: 1, xp: 0 }, st = statsOf(k, h.lv);
    return { key: k, id: c.id, name: c.name, deck: c.deck, deckName: c.deckName, kind: c.kind, suit: c.suit, rank: c.rank, numeral: c.numeral, rarity: c.rarity,
      pow: st.pow, harm: st.harm, ab: c.ab ? ABILITIES[c.ab] : null, img: c.img, up: c.up, rev: c.rev,
      boons: boonsOf(k).map(function (b) { return { lv: b.lv, text: b.text, k: b.k, on: h.n > 0 && h.lv >= b.lv }; }),
      n: h.n, lv: h.lv, xp: h.xp, need: h.lv < maxLv(k) ? xpNeed(k, h.lv) : 0, max: maxLv(k), maxed: h.n > 0 && h.lv >= maxLv(k), gilded: !!h.g,
      gildFee: ECON.gild[card(k).rarity], gildBoon: BOON[SUIT_BOON[card(k).suit]], sig: c.sig, kindOf: kindOf(c), lean: leanOf(c.deck), aff: affinityOf(c.deck) };
  }
  function view(state, now) {
    var s = normal(state);
    if (!s.made) return { made: false, art: CAT.art, decks: CAT.decks.length, cards: CAT.cards.length };
    var M = missionsFor(s, now), D = dailyOn(s, now), R = resonance(s.spread, s.spread.map(function (k) { return s.cards[k] ? s.cards[k].lv : 1; }));
    return {
      made: true, art: CAT.art, features: F, moon: s.moon, circuit: (function () { var CI = s.circuit && s.circuit.week === circuitWeek(now) ? s.circuit : { cleared: 0, humble: true }; return { cleared: CI.cleared, humble: CI.humble, stations: circuitStations(circuitWeek(now)), levels: spreadLevels(s), cap: ECON.circuit.cap, resets: (circuitWeek(now) + 1) * 7 * 864e5 - 3 * 864e5 }; })(), plv: s.plv, pxp: s.pxp, pneed: s.plv >= ECON.player.max ? 0 : plvNeed(s.plv), kind: s.kind, diff: s.diff, ngp: s.ngp, legacy: s.legacy, ngpOpen: s.camp.fool.best >= CAMPAIGNS.fool.n, name: s.name, face: s.face, seals: s.seals, sealSet: s.sealSet, streak: s.streak, omenRun: s.omenRun, sandbox: !!s.sandbox, stats: s.stats, prefs: s.prefs, tut: s.tut, tutStep: s.tut == null ? null : TUT_STEPS[s.tut],
      spread: s.spread.map(function (k) { return cardView(s, k); }),
      combos: R.list.map(function (x) { return { id: x.id, name: x.name, text: x.text, known: !!s.combos[x.id] }; }),
      book: COMBOS.filter(function (x) { return (F.harmony || !/^harmony-/.test(x.id)) && (F.full || !/^full-/.test(x.id)); }).map(function (x) { var mush = F.deep && x.id === "full-" + LOOKING_GLASS; return { id: x.id, group: x.group, name: mush ? "Mushroom Growth" : x.name, need: x.need, text: mush ? "Each round a die: 4-6, your card +3 Power" : x.text, lore: mush ? "One side makes you grow taller, and the other side makes you grow shorter." : x.lore, known: !!s.combos[x.id], awake: R.list.some(function (y) { return y.id === x.id; }) }; }),
      owned: Object.keys(s.cards).filter(function (k) { return owned(s, k) && card(k); }).length, total: CAT.cards.length,
      decks: CAT.decks.map(function (d) { return { slug: d.slug, name: d.name, kind: d.kind, open: deckOpen(s, d.slug), cover: d.cover, perk: d.perk, have: deckHave(s, d.slug), of: CAT.byDeck[d.slug].length, done: deckDone(s, d.slug), price: deckPrice(s, d.slug) }; }),
      daily: D ? { key: D.key, rev: D.rev, card: cardView(s, D.key), omen: omen(D) } : null,
      missions: M.list.map(function (m) { var X = MISSIONS.filter(function (x) { return x.id === m.id; })[0]; return { id: m.id, text: X.text, goal: X.goal, prog: m.prog, claimed: m.claimed }; }),
      journey: { cleared: s.camp.fool.cleared, best: s.camp.fool.best },
      camps: Object.keys(CAMPAIGNS).map(function (id) { var CP = CAMPAIGNS[id], J = s.camp[id]; return { id: id, name: CP.name, n: CP.n, open: campOpen(s, id), cleared: J.cleared, best: J.best, asc: J.asc, ascBest: J.ascBest,
        stations: Array.from({ length: CP.n }, function (_, i) { var st = i + 1, known = st <= J.cleared; return { n: st, known: known, field: !F.fields ? null : id === "fool" ? MAJOR_FIELD[st] : PILGRIMAGE[i].realm ? REALM_FIELD[PILGRIMAGE[i].realm] : null, main: isMain(id, st), keeper: known ? CP.keeper(st) : "", name: !known ? "" : id === "fool" ? MAJOR_NAMES[st] : (PILGRIMAGE[i].realm ? (deckOf(PILGRIMAGE[i].realm) || {}).name || "" : "All four realms"),
          numeral: id === "fool" ? ROMAN[st] : String(st), open: st <= J.cleared + 1, cleared: st <= J.cleared, passed: st <= J.best, reward: stationPay(s, id, st), loss: journeyLoss(s, id, st), last: st === CP.n }; }) }; }),
      unlocks: s.unlocks, decksSaved: s.decks.map(function (d) { return { id: d.id, name: d.name, keys: d.keys, ok: d.keys.length === DECK && d.keys.every(function (k) { return owned(s, k) && card(k); }), current: d.keys.join() === s.spread.join() }; }),
      renown: renown(s), lossFor: { easy: Math.round(ECON.skirmish.easy.lose * (1 + ECON.renownLoss * renown(s))), normal: Math.round(ECON.skirmish.normal.lose * (1 + ECON.renownLoss * renown(s))), hard: Math.round(ECON.skirmish.hard.lose * (1 + ECON.renownLoss * renown(s))) },
      gauntlet: s.gauntlet, trial: { done: !!(s.trial && s.trial.day === dayOf(now)), twist: pickOf({ rng: hash("trial:" + dayOf(now)) | 0 }, TWISTS) },
      battle: s.battle, pity: s.pity, journal: s.journal.slice().reverse(), hasCards: Object.keys(s.cards).some(function (k) { return owned(s, k); })
    };
  }

  var api = {
    act: act, view: view, normal: normal, fresh: fresh, empty: empty, useCatalogue: useCatalogue, card: card, cardView: cardView, deckOf: deckOf, catalogue: function () { return CAT; },
    resonance: resonance, statsOf: statsOf, boonsOf: boonsOf, maxLv: maxLv, xpNeed: xpNeed, startBattle: startBattle, playRound: playRound, aiChoose: aiChoose, clashCalc: clashCalc,
    foeSpread: foeSpread, bestSpread: bestSpread, fillDeck: fillDeck, starterDeck: starterDeck, openPack: openPack, drawCard: drawCard, deckPrice: deckPrice, deckDone: deckDone, omen: omen,
    rand: rand, hash: hash, dayOf: dayOf, combos: function () { return COMBOS; }, CAMPAIGNS: CAMPAIGNS, PILGRIMAGE: PILGRIMAGE, renown: renown, deckOpen: deckOpen,
    stationReward: stationReward, stationLoss: stationLoss, journeyLoss: journeyLoss, NGP: NGP, LEGACY: LEGACY, newGamePlus: newGamePlus, FULL: FULL, LOOKING_GLASS: LOOKING_GLASS, STAR_CHART: STAR_CHART, ACH: ACH, ACH_BY: ACH_BY, achieve: achieve, SEALS: SEALS, SEAL: SEAL, FIELD: FIELD, FIELDS: FIELDS, MAJOR_FIELD: MAJOR_FIELD, fieldMod: fieldMod, stationPay: stationPay, ascTwist: ascTwist, ascText: ascText, isMain: isMain, MAIN_KEEPERS: MAIN_KEEPERS, keepsCount: keepsCount, stationReplay: stationReplay,
    MAJORS: MAJORS, MAJOR_NAMES: MAJOR_NAMES, SUITS: SUITS, SUIT: SUIT, BEATS: BEATS, CARD_IDS: CARD_IDS, RARITIES: RARITIES, RARITY: RARITY, ABILITIES: ABILITIES, PERKS: PERKS,
    ECON: ECON, plvNeed: plvNeed, SPREADS: SPREADS, TWISTS: TWISTS, MISSIONS: MISSIONS, DIFF: DIFF, DECK: DECK, HAND: HAND, SPREAD: DECK, ROUNDS: ROUNDS, SPIRIT: SPIRIT,
    SHARP: SHARP, A11Y: A11Y, sacrificeXp: sacrificeXp, sacrificeable: sacrificeable, SAC: SAC, FEATURES: FEATURES, useTier: useTier, balanceOff: balanceOff, diffsOpen: diffsOpen, TEMPERS: TEMPERS, temperOf: temperOf, features: function () { return F; },
    scout: scout, kindOf: kindOf, leanOf: leanOf, affinityOf: affinityOf, LORE: LORE, keeperSpreads: keeperSpreads, keeperTurn: keeperTurn,
    REVERSED: REVERSED, CELESTIALS: CELESTIALS, MIGHT_PER_CEL: MIGHT_PER_CEL, FURY: FURY, KEEPER_NAMES: KEEPER_NAMES, TUT_STEPS: TUT_STEPS, BOON: BOON
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ArcanaCore = api;
})(typeof window !== "undefined" ? window : this);
