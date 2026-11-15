  // ---- Battle Re-work Part 6: the Arcane -- elements, battle staves, the 4th spell (2026-10-15) ---------------------
  //      The plan (note 03): "The trick: the elements. Fire burns over time. Water slows ... Earth lowers its defence. Air
  //      pushes it off balance (-accuracy). Creatures already have weaknesses. Elements would add elemental weaknesses to
  //      the creature table." And the staves: "battle staff (a melee staff that also gives an element); enchanted battle
  //      staff (built at the enchanting table: a battle staff with an enchantment, such as burn, freeze or drain)".
  //   - a spell that lands may put its element's effect on the creature (ELEMENTS, through Part 1's effects);
  //   - ELEMENT_WEAK: a creature weak to an element takes more from it, one that resists it less;
  //   - a BATTLE STAFF's bash is a real blow, swung with your Magic -- out of runes, an Arcane still fights;
  //   - the Arcana branch's Fourth sigil: a 4th spell in your loadout (loadoutMax).
  var ARCANE_ITEMS = CONTENT("ARCANE_ITEMS");
  Object.keys(ARCANE_ITEMS).forEach(function (k) { if (k !== "//") { ITEMS[k] = ARCANE_ITEMS[k]; WEAR[k] = copy(ITEMS[k].gear.req); WEAPONS[k] = ["crush", "wood"]; } });
  var ARCANE_RECIPES = CONTENT("ARCANE_RECIPES");
  ["altar", "enchanting"].forEach(function (w) { ARCANE_RECIPES[w].forEach(function (r) { WORKSHOPS[w].recipes.push(r); }); });
  var SPELL_ELEMENT = CONTENT("SPELL_ELEMENT");
  var ELEMENTS = CONTENT("ELEMENTS");
  EFFECTS.offbalance = CONTENT("OFF_BALANCE");
  var ELEMENT_WEAK = CONTENT("ELEMENT_WEAK");
  var ELEMENT_FX = Object.keys(ELEMENTS).filter(function (k) { return k !== "//"; }).map(function (k) { return ELEMENTS[k].fx; });

  /** A spell's element ("" none). */
  function spellElement(id) { return SPELL_ELEMENT[id] || ""; }
  /** How a creature takes an element: x weak, x resist, else 1. */
  function elementMult(monId, el) {
    var E = ELEMENT_WEAK[el];
    if (!E) return 1;
    return E.weak.indexOf(monId) >= 0 ? ELEMENT_WEAK.weak : E.resist.indexOf(monId) >= 0 ? ELEMENT_WEAK.resist : 1;
  }
  /** Spells you can have loaded: three, four with Fourth sigil. */
  function loadoutMax(pl) { return LOADOUT_MAX + ((pl && talentSum(pl).slot) || 0); }
  /** A cast's damage multiplier for its element, Primal power and Avatar (called by battleRound). */
  function castMult(pl, b, cast) {
    if (!cast) return 1;
    var tl = (b.me && b.me.tal) || {}, el = cast.element || "", m = el ? elementMult(b.mon, el) : 1;
    if (m > 1 && tl.elemWeakDmg) m += tl.elemWeakDmg;                                  // Attunement
    if (tl.magPct) m *= 1 + tl.magPct;                                                  // Primal power
    if (tl.elemDmg && ((b.fx && b.fx.them) || []).some(function (e) { return ELEMENT_FX.indexOf(e.kind) >= 0 && e.rounds > 0; })) m *= 1 + tl.elemDmg;   // Avatar
    return m;
  }
  /** A spell landed for d: its element's effect, now and then; a draining staff's heal. */
  function castLanded(s, pl, b, cast, d, at) {
    var el = cast.element, E = el && ELEMENTS[el], me = b.me || {}, tl = me.tal || {};
    if (me.drain) pl.hp = Math.min(maxHp(pl), pl.hp + Math.max(1, Math.round(d * me.drain)));
    if (!E || b.mhp <= 0) return;
    var chance = E.chance + (me.elemEl === el ? me.elemBoost || 0 : 0) + (tl.elemChance || 0);
    if (rnd(b) >= chance) return;
    var landed = 0;
    if (E.fx === "burning") landed = addEffect(b, "them", "burning", { rounds: E.rounds, power: Math.max(1, Math.round(cast.base / E.burnDiv)) + (tl.burnPow || 0) + (me.burnPow || 0) }, at);
    else landed = addEffect(b, "them", E.fx, { rounds: E.rounds + (E.fx === "slowed" ? (tl.slowRounds || 0) + (me.slowRounds || 0) : 0) }, at);
    if (landed > 0) feat(pl, "elements");                                       // for Ilse's quest (Part 9)
  }
  Object.keys(SPELL_ELEMENT).forEach(function (id) { if (SPELLS[id]) SPELLS[id].element = SPELL_ELEMENT[id]; });
