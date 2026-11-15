  // ---- Creature tells (2026-10-16; approved in note 13 -- "bosses show what they're about to do (charging, burrowing), and
  //      the right answer (a net, a bash, a dodge) beats it" -- for Parts 4-8, bosses first; built after Part 14) ----------
  //   - every BOSS_TELLS.every rounds a boss WINDS UP (its turn) and the fight says so;
  //   - its next turn: held (trapped, netted, stunned, slowed), in smoke, or against Aegis -> the move BREAKS and it's
  //     stunned BOSS_TELLS.stagger round(s); otherwise the blow lands BOSS_TELLS.mult times as hard, likelier to hit;
  //   - a boss's own dice only change in boss fights (rnd(b) isn't drawn for a tell), so hunts play out the same.
  var BOSS_TELLS = CONTENT("BOSS_TELLS");
  /** The creature's turn starts here (battleRound, packRound): "wind" (it winds up), "broken" (answered), "strike" (the blow
   *  this turn is the big one: battleRound/packRound read b.tellHit), or "" (an ordinary turn). */
  function bossTell(s, pl, b, at, log) {
    var T = BOSS_TELLS.list[b.mon];
    if (!T || b.duel || !MONSTERS[b.mon].boss) return "";
    var held = b.fx ? fxHeld(b, "them") : "";
    if (b.tell) {
      b.tell = null;
      if (held || b.smoke > 0 || b.aegis > 0) {
        log({ by: "them", hit: 0, tellBroken: T.move, why: held || (b.smoke > 0 ? "smoke" : "shield") });
        addEffect(b, "them", "stunned", { rounds: BOSS_TELLS.stagger, lvl: 99 }, at);
        return "broken";
      }
      b.tellHit = T.move;
      return "strike";
    }
    if (held || b.smoke > 0) return "";
    if (b.n > 1 && b.n % BOSS_TELLS.every === 0) {
      b.tell = { move: T.move, wind: T.wind };
      log({ by: "them", hit: 0, tell: T.move, wind: T.wind });
      return "wind";
    }
    return "";
  }
  /** The big blow's multipliers (damage, accuracy) for this turn, once. */
  function tellMult(b) {
    if (!b.tellHit) return 1;
    var g = HUNTS[b.ground], lv = g ? g.level : 50, m = BOSS_TELLS.mult.filter(function (x) { return lv < x[0]; })[0][1];
    return b.me && b.me.style === "defensive" ? 1 + (m - 1) / 2 : m;           // braced: half the extra
  }
  function tellAcc(b) { return b.tellHit ? BOSS_TELLS.acc : 1; }
