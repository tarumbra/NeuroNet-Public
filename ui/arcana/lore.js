/* NeuroArcana's deck lore (Cam, 2 Nov 2026: "make different decks hold different rarities and even have better abilities
   ... a certain deck have an affinity which makes it better against a specific type ... have the keepers have 2 spreads
   they use and not random cards all the time ... themed in a way that makes sense to the deep lore of tarot, oracle").
   Data only; core.js reads it (window.ArcanaLore in the page, require() in Node). See docs/DESIGN.md "Deck identity".

   SIGNATURES  a deck's own cards: one rarity higher (never past Epic), +1 Power, and the deck's own ability in place of
               the card's usual one. Tarot cards by id, oracle cards by o_N (the number in Cam's art folder).
   LEANS       how every card of a deck leans (it replaced the hidden +1 tilt): stats baked into the card (pow, harm,
               heal, guard, cel) and fx read in the clash (always on, even reversed -- it is the deck's nature).
   AFFINITY    each deck hunts one kind of card (+2 Power against it) and fears another (-1).
               kinds: major, court (Page-King), pip (Ace-10), oracle.
   KEEPERS     the keepers' own spreads. Early keepers one, the later ones (and every main keeper) two, which they take
               in turn. "id" is drawn from the keeper's own deck (or the next one found); "slug|id" from that deck. */
(function (root) {
  "use strict";

  // fx kinds the clash understands (besides those in core.js ABILITIES): die {map: [six Power values, faces 1-6]},
  // dice2 (two dice, the higher one: same map), coin {up: [fx], down: [fx]} (heads: the sun, tails: the moon),
  // steal n (Win: take n celestials from them), powIf when: late (rounds 3-4) | bid3 (3+ stars) | rev (played reversed)
  // | first (round 1), powPer per: <suit> (each other card of that suit in your spread, at most 3)
  var SIGNATURES = {
    "murder-of-crows": {
      death: { name: "Carrion Feast", text: "Win: heal half the Harm dealt and steal 1 celestial", fx: [{ k: "drain" }, { k: "steal", n: 1 }] },
      moon: { name: "Night Omen", text: "A coin: the sun, their card -5 Power; the moon, -1", fx: [{ k: "coin", up: [{ k: "foePow", n: 5 }], down: [{ k: "foePow", n: 1 }] }] },
      "3_swords": { name: "Pecking Wound", text: "Win: they are poisoned 1", fx: [{ k: "poison", n: 1 }] },
      king_swords: { name: "King of Crows", text: "Win: +2 Harm and steal 1 celestial", fx: [{ k: "harm", n: 2 }, { k: "steal", n: 1 }] }
    },
    "splendor-solis": {
      sun: { name: "Rubedo", text: "+3 Power, and Win: +2 celestials", fx: [{ k: "pow", n: 3 }, { k: "celWin", n: 2 }] },
      magician: { name: "The Adept", text: "Its Power becomes the higher of the two cards', +1", fx: [{ k: "copy" }, { k: "pow", n: 1 }] },
      ace_pentacles: { name: "Philosophers' Gold", text: "Win: +2 celestials", fx: [{ k: "celWin", n: 2 }] },
      "10_pentacles": { name: "The Great Work", text: "+1 Power for each other Pentacle in your spread (up to 3)", fx: [{ k: "powPer", n: 1, per: "pentacles" }] }
    },
    "old-school-tarot": {
      emperor: { name: "The Old Order", text: "The other card has -3 Power", fx: [{ k: "foePow", n: 3 }] },
      hierophant: { name: "Old Ways", text: "+2 Power, and +1 for each other Major in your spread", fx: [{ k: "pow", n: 2 }, { k: "powPer", n: 1, per: "major" }] },
      "2_pentacles": { name: "Juggler's Luck", text: "A coin: the sun, +4 Power; the moon, nothing", fx: [{ k: "coin", up: [{ k: "pow", n: 4 }], down: [] }] },
      knight_wands: { name: "The Old Charge", text: "+3 Power, and Win: +1 Harm", fx: [{ k: "pow", n: 3 }, { k: "harm", n: 1 }] }
    },
    "tarot-of-divine": {
      star: { name: "Wish Upon a Star", text: "Win or lose: gain 3 celestials", fx: [{ k: "celWin", n: 3 }, { k: "celLose", n: 3 }] },
      fool: { name: "Once Upon a Time", text: "+6 Power when you spend no celestials, and Win: heal 2", fx: [{ k: "powIf", n: 6, when: "nocel" }, { k: "heal", n: 2 }] },
      queen_cups: { name: "Fairy Godmother", text: "Win: heal 4 Spirit", fx: [{ k: "heal", n: 4 }] },
      "7_cups": { name: "Glass Slipper", text: "A die: 1-2 nothing, 3-4 +2 Power, 5-6 +4", fx: [{ k: "die", map: [0, 0, 2, 2, 4, 4] }] }
    },
    "secrets-of-the-witches-garden": {
      high_priestess: { name: "Hedge Secret", text: "Cancels the other card's ability, and it has -1 Power", fx: [{ k: "cancel" }, { k: "foePow", n: 1 }] },
      devil: { name: "Bewitchment", text: "Win: they are poisoned 2", fx: [{ k: "poison", n: 2 }] },
      queen_wands: { name: "The Witch Queen", text: "Win: they lose 2 celestials, and heal 2", fx: [{ k: "burn", n: 2 }, { k: "heal", n: 2 }] },
      "7_pentacles": { name: "Patient Harvest", text: "+3 Power in rounds 3 and 4", fx: [{ k: "powIf", n: 3, when: "late" }] }
    },
    "wonderland-in-tarot": {
      fool: { name: "Down the Rabbit Hole", text: "A coin: the sun, +5 Power; the moon, -1", fx: [{ k: "coin", up: [{ k: "pow", n: 5 }], down: [{ k: "pow", n: -1 }] }] },
      queen_cups: { name: "Off With Their Heads", text: "Win: +3 Harm", fx: [{ k: "harm", n: 3 }] },
      moon: { name: "The Cheshire Grin", text: "Cancels the other card's ability; can't be cancelled", fx: [{ k: "cancel" }], immune: true },
      "3_cups": { name: "A Mad Tea Party", text: "Win: heal 2 and +1 celestial", fx: [{ k: "heal", n: 2 }, { k: "celWin", n: 1 }] }
    },
    "ryder-smith": {
      magician: { name: "The Classic Mirror", text: "Its Power becomes the higher of the two cards', +1", fx: [{ k: "copy" }, { k: "pow", n: 1 }] },
      sun: { name: "Bright Day", text: "+4 Power, and Win: +1 Harm", fx: [{ k: "pow", n: 4 }, { k: "harm", n: 1 }] },
      ace_cups: { name: "The Grail", text: "Win: heal 3 Spirit", fx: [{ k: "heal", n: 3 }] },
      "10_swords": { name: "Rock Bottom", text: "+4 Power while you have less Spirit", fx: [{ k: "powIf", n: 4, when: "behind" }] }
    },
    "gilded-observatory": {
      wheel: { name: "The Orrery", text: "Two dice, the higher counts: 1 is nothing, 2-6 that much Power", fx: [{ k: "dice2", map: [0, 2, 3, 4, 5, 6] }] },
      star: { name: "The Pole Star", text: "Win or lose: gain 2 celestials; +2 Power if you bid 3 or more", fx: [{ k: "celWin", n: 2 }, { k: "celLose", n: 2 }, { k: "powIf", n: 2, when: "bid3" }] },
      hermit: { name: "The Telescope", text: "+5 Power while you have less Spirit", fx: [{ k: "powIf", n: 5, when: "behind" }] },
      page_pentacles: { name: "The Star Chart", text: "Win: +2 celestials", fx: [{ k: "celWin", n: 2 }] }
    },
    "carnival-of-souls": {
      o_2: { name: "The Crystal Ball", text: "A coin: the sun, their card -4 Power; the moon, yours +1", fx: [{ k: "coin", up: [{ k: "foePow", n: 4 }], down: [{ k: "pow", n: 1 }] }] },
      o_10: { name: "Pulling the Strings", text: "Its Power becomes the higher of the two cards'", fx: [{ k: "copy" }] },
      o_16: { name: "Breathe Fire", text: "+3 Power, and Win: +2 Harm, but you take 1", fx: [{ k: "pow", n: 3 }, { k: "harm", n: 2 }, { k: "recoil", n: 1 }] }
    },
    "the-viking-oracle": {
      o_32: { name: "Allfather", text: "+2 Power, and Win: +2 celestials", fx: [{ k: "pow", n: 2 }, { k: "celWin", n: 2 }] },
      o_41: { name: "Mjolnir", text: "Win: +3 Harm", fx: [{ k: "harm", n: 3 }] },
      o_30: { name: "The Trickster", text: "A coin: the sun, cancels their ability and -3 Power; the moon, -2 Power to yours", fx: [{ k: "coin", up: [{ k: "cancel" }, { k: "foePow", n: 3 }], down: [{ k: "pow", n: -2 }] }] }
    },
    "the-rooted-woman-oracle": {
      o_1: { name: "The Cauldron", text: "Win: heal 4 Spirit", fx: [{ k: "heal", n: 4 }] },
      o_3: { name: "The Battle Crow", text: "Win: +3 Harm", fx: [{ k: "harm", n: 3 }] },
      o_5: { name: "The Winter Hag", text: "The other card has -3 Power", fx: [{ k: "foePow", n: 3 }] }
    },
    "deadly-apothecary-oracle": {
      o_13: { name: "Deadly Nightshade", text: "Win: they are poisoned 2", fx: [{ k: "poison", n: 2 }] },
      o_24: { name: "Wolfsbane", text: "Win: +2 Harm, and they are poisoned 1", fx: [{ k: "harm", n: 2 }, { k: "poison", n: 1 }] },
      o_8: { name: "Socrates' Cup", text: "The other card has -2 Power, and Win: they are poisoned 1", fx: [{ k: "foePow", n: 2 }, { k: "poison", n: 1 }] }
    }
  };

  // how each deck leans: a trade, never a free gift (the Mathematician: about even, so a lean is a style, not a tier)
  var LEANS = {
    "murder-of-crows": { name: "Carrion", text: "+1 Harm, -1 Power", pow: -1, harm: 1 },
    "splendor-solis": { name: "Transmutation", text: "-1 Harm; Win: +1 celestial", harm: -1, cel: 1 },
    "old-school-tarot": { name: "Steadfast", text: "+1 Power, -1 Harm", pow: 1, harm: -1 },
    "tarot-of-divine": { name: "Happily Ever After", text: "-1 Power; Win: heal 1", pow: -1, heal: 1 },
    "secrets-of-the-witches-garden": { name: "Thorned", text: "-1 Harm; the other card -1 Power", harm: -1, fx: [{ k: "foePow", n: 1 }] },
    "wonderland-in-tarot": { name: "Topsy-Turvy", text: "Played reversed: +2 Power (+1 after the reversed card's -1)", fx: [{ k: "powIf", n: 2, when: "rev" }] },
    "ryder-smith": { name: "Classic", text: "No lean: the deck the others learned from" },
    "gilded-observatory": { name: "Starlit", text: "Bid 3 or more celestials: +1 Power", fx: [{ k: "powIf", n: 1, when: "bid3" }] },
    "carnival-of-souls": { name: "Showtime", text: "+2 Power in the first round, -1 Harm", harm: -1, fx: [{ k: "powIf", n: 2, when: "first" }] },
    "the-viking-oracle": { name: "Shield Wall", text: "-1 Power; Lose: take 1 less Harm", pow: -1, guard: 1 },
    "the-rooted-woman-oracle": { name: "Deep Roots", text: "-1 Harm; Win: heal 1", harm: -1, heal: 1 },
    "deadly-apothecary-oracle": { name: "Toxic", text: "-1 Power, -1 Harm; Win: they are poisoned 1", pow: -1, harm: -1, fx: [{ k: "poison", n: 1 }] }
  };
  // a deck without its own lean (one the player added) takes one of these, by its name
  var LEAN_POOL = ["murder-of-crows", "old-school-tarot", "tarot-of-divine", "secrets-of-the-witches-garden", "the-viking-oracle", "the-rooted-woman-oracle"];

  var KINDS = { major: "Majors", court: "court cards", pip: "Aces and numbers", oracle: "oracle cards" };
  var AFFINITY = {
    "murder-of-crows": { hunt: "major", fear: "court", why: "Crows circle the great omens, and scatter from the king's archers." },
    "splendor-solis": { hunt: "pip", fear: "oracle", why: "The alchemist turns base metal to gold; prophecy is not his art." },
    "old-school-tarot": { hunt: "oracle", fear: "major", why: "The old deck scorns the new oracles, and bows to its own trumps." },
    "tarot-of-divine": { hunt: "court", fear: "major", why: "In every fairy tale the wicked queen falls; fate is another matter." },
    "secrets-of-the-witches-garden": { hunt: "major", fear: "pip", why: "A witch hexes the powers that be, and fears the village with its torches." },
    "wonderland-in-tarot": { hunt: "court", fear: "pip", why: "Alice faces down the Queen's court, but the card-soldiers are everywhere." },
    "ryder-smith": { hunt: "pip", fear: "oracle", why: "The classic scenes know every number by heart." },
    "gilded-observatory": { hunt: "oracle", fear: "court", why: "A star chart reads what the oracles only guess; courts want it kept quiet." },
    "carnival-of-souls": { hunt: "court", fear: "major", why: "The carnival mocks every crown, and fears Death walking the midway." },
    "the-viking-oracle": { hunt: "major", fear: "oracle", why: "The north raids the halls of the great, and fears the Norns' own threads." },
    "the-rooted-woman-oracle": { hunt: "court", fear: "pip", why: "Sovereignty judges kings; the land's many hands are harder to judge." },
    "deadly-apothecary-oracle": { hunt: "court", fear: "oracle", why: "The poisoner's oldest trade is in kings; the other spirits know her craft." }
  };
  var AFFINITY_N = { hunt: 2, fear: 1 };

  // ---- the keepers' spreads ---------------------------------------------------------------------------------------
  // Each keeper's own Major, cards of their field's element (the Golden Dawn's attribution), and cards from the Major's
  // own story; the later ones wake combos on purpose (the Trinity, a Royal Court, the Path...) so they're worth reading.
  var FOOL = {
    1: { decks: ["old-school-tarot"], note: "The tools of the trade laid out on the table -- a Sword sharpest among them.",
      spreads: [["magician", "ace_swords", "2_swords", "3_swords", "4_swords", "2_wands", "2_cups", "2_pentacles"]] },
    2: { decks: ["secrets-of-the-witches-garden"], note: "Still water and veiled cups: dreams, secrets, a blindfold.",
      spreads: [["high_priestess", "ace_cups", "2_cups", "4_cups", "7_cups", "2_swords", "8_swords", "2_pentacles"]] },
    3: { decks: ["tarot-of-divine"], note: "A garden in harvest: Pentacles in bloom.",
      spreads: [["empress", "ace_pentacles", "3_pentacles", "6_pentacles", "9_pentacles", "10_pentacles", "3_cups", "6_cups"]] },
    4: { decks: ["old-school-tarot"], note: "Iron and fire: Wands in ranks, and a Pentacle held tight.",
      spreads: [["emperor", "ace_wands", "2_wands", "3_wands", "4_wands", "7_wands", "4_pentacles", "2_swords"]] },
    5: { decks: ["splendor-solis"], note: "The craftsman's chapel: Pentacles of tradition.",
      spreads: [["hierophant", "ace_pentacles", "3_pentacles", "4_pentacles", "8_pentacles", "10_pentacles", "2_cups", "6_cups"]] },
    6: { decks: ["tarot-of-divine"], note: "A choice of hearts and blades -- the Lovers love their own deck.",
      spreads: [["lovers", "2_cups", "ace_swords", "2_swords", "3_swords", "5_swords", "6_swords", "10_cups"]] },
    7: { decks: ["old-school-tarot"], note: "A main keeper. The chariot crosses the water: a tide of Cups, a knight or a queen riding with it.",
      spreads: [["chariot", "ace_cups", "3_cups", "6_cups", "9_cups", "knight_cups", "7_wands", "2_pentacles"],
        ["chariot", "ace_cups", "2_cups", "5_cups", "8_cups", "queen_cups", "6_swords", "3_wands"]] },
    8: { decks: ["wonderland-in-tarot"], note: "Courage under fire: a few Wands that will not break, steadied by Pentacles.",
      spreads: [["strength", "ace_wands", "3_wands", "6_wands", "9_wands", "4_pentacles", "7_pentacles", "2_cups"]] },
    9: { decks: ["gilded-observatory"], note: "One lantern on a dark mountain: patient, careful Pentacles.",
      spreads: [["hermit", "ace_pentacles", "4_pentacles", "7_pentacles", "8_pentacles", "9_pentacles", "page_pentacles", "4_swords"]] },
    10: { decks: ["gilded-observatory"], note: "The wheel turns -- and one spread brings the Sun to ride it.",
      spreads: [["wheel", "star", "ace_wands", "2_wands", "3_wands", "8_wands", "10_wands", "knight_wands"],
        ["wheel", "sun", "ace_wands", "4_wands", "6_wands", "7_wands", "king_wands", "3_pentacles"]] },
    11: { decks: ["old-school-tarot"], note: "The scales and the sword: a court of Swords, an Emperor or a Hierophant behind the bench.",
      spreads: [["justice", "emperor", "ace_swords", "2_swords", "6_swords", "9_swords", "queen_swords", "king_swords"],
        ["justice", "hierophant", "ace_swords", "3_swords", "7_swords", "10_swords", "knight_swords", "2_pentacles"]] },
    12: { decks: ["tarot-of-divine"], note: "He gives up the round to win the road: Cups that wait, and celestials when he loses.",
      spreads: [["hanged_man", "ace_cups", "4_cups", "5_cups", "6_cups", "8_cups", "page_cups", "4_swords"],
        ["hanged_man", "death", "star", "ace_cups", "2_cups", "7_cups", "10_cups", "queen_cups"]] },
    13: { decks: ["murder-of-crows"], note: "The pale horse in black water: endings, and the crows that follow them -- a knight or a king of Cups riding behind.",
      spreads: [["death", "ace_cups", "5_cups", "6_cups", "8_cups", "knight_cups", "9_swords", "10_swords"],
        ["death", "ace_cups", "2_cups", "4_cups", "7_cups", "king_cups", "3_swords", "10_swords"]] },
    14: { decks: ["splendor-solis"], note: "A main keeper. Fire tempered with water: the alchemist's Great Work.",
      spreads: [["temperance", "sun", "ace_wands", "3_wands", "6_wands", "queen_wands", "king_wands", "ace_cups"],
        ["temperance", "magician", "star", "ace_wands", "8_wands", "knight_wands", "queen_cups", "2_cups"]] },
    15: { decks: ["secrets-of-the-witches-garden"], note: "Earthly chains: greed in Pentacles, and the Lovers in his shadow.",
      spreads: [["devil", "ace_pentacles", "4_pentacles", "5_pentacles", "9_pentacles", "queen_pentacles", "king_pentacles", "7_swords"],
        ["devil", "lovers", "moon", "ace_pentacles", "6_pentacles", "10_pentacles", "page_pentacles", "knight_pentacles"]] },
    16: { decks: ["murder-of-crows"], note: "Lightning and war: Wands that burn the tower down.",
      spreads: [["tower", "chariot", "ace_wands", "5_wands", "10_wands", "knight_wands", "king_wands", "10_swords"],
        ["tower", "emperor", "ace_wands", "7_wands", "9_wands", "page_wands", "queen_wands", "3_swords"]] },
    17: { decks: ["gilded-observatory"], note: "She charts the three lights -- the Celestial Trinity, or the Hermit's lantern and the Wheel.",
      spreads: [["star", "moon", "sun", "ace_swords", "2_swords", "6_swords", "page_swords", "4_cups"],
        ["star", "hermit", "wheel", "ace_swords", "8_swords", "queen_swords", "6_cups", "3_pentacles"]] },
    18: { decks: ["secrets-of-the-witches-garden"], note: "Tidal magic: a court of Cups under a witch's moon.",
      spreads: [["moon", "high_priestess", "ace_cups", "7_cups", "9_cups", "page_cups", "knight_cups", "queen_cups"],
        ["moon", "star", "devil", "ace_cups", "2_cups", "4_cups", "8_cups", "king_cups"]] },
    19: { decks: ["splendor-solis"], note: "The whole Royal Court of Wands -- or two kings under the Sun and the Star.",
      spreads: [["sun", "ace_wands", "3_wands", "6_wands", "page_wands", "knight_wands", "queen_wands", "king_wands"],
        ["sun", "star", "ace_wands", "6_wands", "king_wands", "king_cups", "10_pentacles", "3_cups"]] },
    20: { decks: ["old-school-tarot"], note: "The herald's trumpet: Death and the Sun rising, or a Page of every suit.",
      spreads: [["judgement", "death", "sun", "ace_wands", "6_wands", "10_wands", "page_wands", "knight_wands"],
        ["judgement", "star", "ace_wands", "8_wands", "page_wands", "page_cups", "page_swords", "page_pentacles"]] },
    21: { decks: ["gilded-observatory"], note: "A main keeper. The dance at the end of the road: the four Aces, every element in one hand -- or the Path of the first three.",
      spreads: [["world", "star", "ace_wands", "ace_cups", "ace_swords", "ace_pentacles", "queen_pentacles", "10_pentacles"],
        ["world", "magician", "high_priestess", "empress", "ace_pentacles", "knight_pentacles", "10_pentacles", "4_cups"]] }
  };
  var C = "carnival-of-souls", V = "the-viking-oracle", R = "the-rooted-woman-oracle", A = "deadly-apothecary-oracle";
  var ORACLE = {
    1: { decks: [C], note: "The barker's tricks: sleight of hand and the fire eater.",
      spreads: [["o_1", "o_14", "o_16", "o_11", "o_7", "ace_wands", "3_wands", "8_wands"]] },
    2: { decks: [C], note: "Madame Pythia reads your fortune -- and her crystal ball flips a coin.",
      spreads: [["o_2", "o_4", "o_9", "o_18", "o_10", "wheel", "ace_wands", "7_cups"]] },
    3: { decks: [C], note: "A main keeper. Three Morts and the memento mori -- or the Puppeteer's troupe.",
      spreads: [["o_3", "o_12", "o_20", "o_21", "o_22", "o_16", "death", "king_wands"],
        ["o_10", "o_13", "o_27", "o_26", "o_15", "o_30", "devil", "knight_wands"]] },
    4: { decks: [V], note: "The first runes carved: wealth, strength, the thorn and the god's breath.",
      spreads: [["o_1", "o_2", "o_3", "o_4", "o_6", "o_17", "magician", "ace_swords"]] },
    5: { decks: [V], note: "Valkyries and the winter huntress.",
      spreads: [["o_42", "o_34", "o_27", "o_15", "o_17", "o_19", "strength", "queen_swords"]] },
    6: { decks: [V], note: "A main keeper. The Norns at the World-Tree's well -- or the gods at Ragnarok.",
      spreads: [["o_45", "o_39", "o_44", "o_37", "o_14", "o_32", "high_priestess", "king_swords"],
        ["o_32", "o_41", "o_30", "o_26", "o_33", "o_29", "tower", "knight_swords"]] },
    7: { decks: [R], note: "Forest, well and crossroads: a hedge-witch's country.",
      spreads: [["o_43", "o_10", "o_9", "o_26", "o_23", "o_52", "empress", "ace_pentacles"]] },
    8: { decks: [R], note: "Ceridwen's cauldron: change, initiation, the grail.",
      spreads: [["o_1", "o_2", "o_11", "o_40", "o_24", "o_21", "temperance", "queen_pentacles"]] },
    9: { decks: [R], note: "A main keeper. The Morrigan with the war-goddesses -- or with the old women of dreams.",
      spreads: [["o_3", "o_6", "o_34", "o_5", "o_4", "o_42", "death", "king_pentacles"],
        ["o_3", "o_22", "o_32", "o_47", "o_37", "o_49", "moon", "knight_pentacles"]] },
    10: { decks: [A], note: "The gentle herbs first: nettle, snowdrop and foxglove.",
      spreads: [["o_1", "o_15", "o_10", "o_19", "o_6", "o_30", "ace_cups", "3_cups"]] },
    11: { decks: [A], note: "Hemlock and henbane: the apprentice's first poisons.",
      spreads: [["o_8", "o_7", "o_11", "o_12", "o_4", "o_36", "page_cups", "7_cups"]] },
    12: { decks: [A], note: "A main keeper. Belladonna, monkshood and the death cap -- or the sleeping poppy.",
      spreads: [["o_13", "o_24", "o_35", "o_2", "o_14", "o_31", "queen_cups", "death"],
        ["o_23", "o_28", "o_3", "o_8", "o_20", "o_21", "devil", "king_cups"]] },
    13: { decks: [C, V, R, A], note: "The Veiled Oracle draws on every realm: the seers of all four, and the trumps of fate.",
      spreads: [[C + "|o_2", V + "|o_39", R + "|o_3", A + "|o_13", "high_priestess", "moon", "star", "world"],
        [C + "|o_9", V + "|o_32", R + "|o_1", A + "|o_14", "magician", "wheel", "judgement", "fool"]] }
  };
  // how many spreads a keeper keeps: one early; the later keepers and the main ones two, taken in turn
  var api = { SIGNATURES: SIGNATURES, LEANS: LEANS, LEAN_POOL: LEAN_POOL, KINDS: KINDS, AFFINITY: AFFINITY, AFFINITY_N: AFFINITY_N, KEEPERS: { fool: FOOL, oracle: ORACLE } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ArcanaLore = api;
})(typeof window !== "undefined" ? window : this);
