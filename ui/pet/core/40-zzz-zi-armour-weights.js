  // ---- armour weights (V17, 2026-10-20, Cam: "armour should give class specific bonuses and anti bonus for example wearing
  //      berserker or paladin (metal armours) as a mage will cause a reduction on magic. How old school runescape handles
  //      armour." Carried with every answer (a)): every piece of armour is Heavy, Light or Cloth.
  //   - ATTACK BY STYLE: a piece's accuracy bonus is split into melee / ranged / magic. Heavy costs Magic (bronze -1 a piece ..
  //     rune -6, platebody and platelegs double) and a little Ranged; Light gives a little Ranged and its body costs a little
  //     Magic; Cloth gives Magic (its own mag, as before) and costs nothing. Armour's Attack bonus counts for melee only.
  //   - DEFENCE BY KIND OF ATTACK: a piece's Defence counts in full or in part against crush / slash / pierce / magic
  //     (ARMOUR.weights[w].vs) -- plate is half as good against magic, robes half as good against blows.
  //   - CLASS FIT: your class's weight (ARMOUR.fit) gives +10% of each piece's Defence and +1 accuracy a piece, for your class's
  //     own style -- on top of the class bonuses some pieces had already (snake, armadillo, bat, mage hats).
  //   Nothing is locked by weight: you may wear what you like, and pay for it. Pets are unchanged (their gear has no weight).
  var ARMOUR = CONTENT("ARMOUR");
  var ARMOUR_WEIGHT = (function () { var o = {}; Object.keys(ARMOUR.items).forEach(function (w) { ARMOUR.items[w].forEach(function (id) { o[id] = w; }); }); return o; })();
  var ATTACK_TYPES = ["crush", "slash", "pierce", "magic"];
  /** heavy | light | cloth | "" (jewellery, quivers, pets' things, weapons). */
  function weightOf(id) { return ARMOUR_WEIGHT[id] || ""; }
  function armourTier(id) {
    var r = ((ITEMS[id] || {}).gear || {}).req || {};
    return Math.max(1, Math.min(6, 1 + Math.floor(Math.max(r.defence || 0, r.attack || 0) / 10)));
  }
  /** What a piece does to your accuracy, style by style: {melee, ranged, magic} (its own mag/rng/att aside). */
  function weightAcc(id) {
    var w = weightOf(id), W = ARMOUR.weights[w], out = { melee: 0, ranged: 0, magic: 0 };
    if (!W) return out;
    var g = ITEMS[id].gear, t = armourTier(id), big = g.slot === "torso" || g.slot === "legs";
    if (w === "heavy") {
      out.magic = W.magPerTier * t * (big ? W.bigX : 1);
      if (big) out.ranged = -Math.ceil(-W.rngBigPerTier * t);
    } else if (w === "light") {
      if (big) out.ranged = W.rngBig;
      var forArcane = (g.clsBonus && g.clsBonus.cls === "arcane") || g.cls === "arcane";   // bat leather was made for the Arcane
      if (g.slot === "torso" && !forArcane) out.magic = Math.max(W.magBodyMax, -Math.ceil(-W.magBodyPerTier * t));
    }
    return out;
  }
  function armourFits(cls, id) { return !!cls && !!weightOf(id) && ARMOUR.fit[cls] === weightOf(id); }
  /** gearSum's share (called from it): a piece's style accuracy, its defence by kind of attack, the class fit. */
  function weighPiece(t, id, g, cls) {
    var w = weightOf(id), W = ARMOUR.weights[w];
    if (!W) return;
    var a = weightAcc(id);
    t.styleAcc.melee += a.melee; t.styleAcc.ranged += a.ranged; t.styleAcc.magic += a.magic;
    var d = g.def || 0, fit = armourFits(cls, id);
    if (fit) { t.fit++; t.fitDef += d * ARMOUR.fitDef; d *= 1 + ARMOUR.fitDef; }
    ATTACK_TYPES.forEach(function (k) { t.defVs[k] += d * ((W.vs[k] === undefined ? 1 : W.vs[k]) - 1); });
    t.weights[w] = (t.weights[w] || 0) + 1;
  }
  /** After the pieces: the fit's Defence lands on your Defence, and defVs becomes your whole Defence against each kind. */
  function weighDone(t) {
    t.fitDef = Math.round(t.fitDef);
    t.def += t.fitDef;
    ATTACK_TYPES.forEach(function (k) { t.defVs[k] = Math.max(0, t.def + Math.round(t.defVs[k])); });
  }
  /** Your Defence against this kind of attack, and the share of each blow your armour takes off. */
  function defVs(me, atk) { return me.def + ((me.defBy && me.defBy[atk]) || 0); }
  function drVs(me, atk) { return me.drBy && me.drBy[atk] !== undefined ? me.drBy[atk] : me.dr || 0; }
  /** The fight's view of a gearSum: how far each kind of attack is from your plain Defence, and what that cuts. */
  function defByOf(g, def) {
    var by = {}, dr = {};
    ATTACK_TYPES.forEach(function (k) { by[k] = (g.defVs ? g.defVs[k] : g.def) - g.def; dr[k] = armourCut(def + by[k]); });
    return { by: by, dr: dr };
  }
  /** Your style's accuracy from armour: the weights, and the fit for your class's own way. */
  function styleAccOf(g, cls, style) {
    var k = style === "magic" ? "magic" : style === "ranged" ? "ranged" : "melee";
    return ((g.styleAcc || {})[k] || 0) + (cls && clsFits(cls, style) ? (g.fit || 0) * ARMOUR.fitAcc : 0);
  }
  /** For an item's description: "Heavy armour: Magic -12, Ranged -3; half Defence against magic; suits Berserkers and Paladins". */
  function weightText(id) {
    var w = weightOf(id), W = ARMOUR.weights[w];
    if (!W) return "";
    var a = weightAcc(id), bits = [], sgn = function (n) { return (n > 0 ? "+" : "−") + Math.abs(n); };
    if (a.magic) bits.push("Magic " + sgn(a.magic));
    if (a.ranged) bits.push("Ranged " + sgn(a.ranged));
    var how = function (m) { return m === 0.5 ? "half" : m === 1.5 ? "1½×" : Math.round(m * 100) + "%"; }, groups = [];
    ATTACK_TYPES.filter(function (k) { return W.vs[k] !== 1; }).forEach(function (k) {
      var gr = groups.filter(function (x) { return x.m === W.vs[k]; })[0];
      if (gr) gr.ks.push(k); else groups.push({ m: W.vs[k], ks: [k] }); });
    var vs = groups.map(function (x) { return how(x.m) + " against " + (x.ks.length === 3 && x.ks.indexOf("magic") < 0 ? "blows" : x.ks.join(" and ")); });
    var who = Object.keys(ARMOUR.fit).filter(function (c) { return ARMOUR.fit[c] === w && CLASSES[c]; }).map(clsPlural);
    return W.name + " armour" + (bits.length ? ": " + bits.join(", ") : "") + (vs.length ? "; Defence " + vs.join(", ") : "") +
           (who.length ? "; suits " + who.slice(0, -1).join(", ") + (who.length > 1 ? " and " : "") + who[who.length - 1] : "");
  }
  /** Put on something that hurts your way of fighting: say so, once, as you put it on (the UX head's ask). */
  function weightWarn(pl, id) {
    var cls = pl.cls ? CLASSES[pl.cls] : null, a = weightAcc(id), wp = ITEMS[(pl.gear || {}).weapon], ws = wp && wp.gear ? wp.gear.style || "melee" : "melee";
    var styles = cls ? (cls.styles || [cls.style]).filter(function (x) { return x !== "pack"; }) : [ws];
    var hurt = styles.filter(function (x) { return (a[x === "magic" ? "magic" : x === "ranged" ? "ranged" : "melee"] || 0) < 0; })[0];
    if (!hurt) return "";
    var n = a[hurt === "magic" ? "magic" : "ranged"];
    return " " + ARMOUR.weights[weightOf(id)].name + " armour: " + (hurt === "magic" ? "Magic" : "Ranged") + " −" + Math.abs(n) + " -- your " + (hurt === "magic" ? "spells" : "arrows") + " will miss more.";
  }
  /** The Gear card's stats grid: attack by style and Defence by kind of attack, from what you wear. */
  function armourView(pl) {
    var g = gearSum(pl.gear, pl.cls, pl.enchants), cls = pl.cls ? CLASSES[pl.cls] : null, fitW = pl.cls ? ARMOUR.fit[pl.cls] || "" : "";
    var att = { melee: g.att + styleAccOf(g, cls, "melee"), ranged: g.rng + styleAccOf(g, cls, "ranged"), magic: g.mag + styleAccOf(g, cls, "magic") };
    return { att: att, def: g.def, defVs: g.defVs, fit: g.fit, fitDef: g.fitDef, fitWeight: fitW, fitName: fitW ? ARMOUR.weights[fitW].name : "",
             weights: g.weights, types: ATTACK_TYPES };
  }
