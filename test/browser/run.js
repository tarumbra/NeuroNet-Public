/* NeuroPets in a real browser (2026-10-13, audit SE-11: "132 tests read the source text ... move behaviour checks to
   the headless-browser harness"). Each scenario opens the real game (ui/pet/index.html, the real pet.js and game.js) in
   headless Chromium with a stand-in bridge (stub.js): its save is made here with the real rules, and whatever the game
   saves stays in the page -- nothing reads or writes neuronet_data. The checks click real buttons and look at the save.

   Run: node test/browser/run.js [app dir]      (skips, passing, when there's no Chromium) */
const fs = require("fs"), os = require("os"), path = require("path"), vm = require("vm"), cp = require("child_process");
const APP = process.argv[2] || path.join(__dirname, "..", "..");
const PET = path.join(APP, "ui", "pet");
const chrome = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"].map((c) => { try { return cp.execFileSync("which", [c], {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch (e) { return ""; } }).find(Boolean);
if (!chrome) { console.log("  skipped: no Chromium on this machine\n\n  0 passed, 0 failed\n"); process.exit(0); }

const ctx = {window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(PET, "petcore.js"), "utf8"), ctx);
const C = ctx.window.PetCore || ctx.PetCore;
const N = Date.now(), H = 3600e3;

/** A player well into the game: the Farm built and stocked, a caravel, things in the bag. */
function bigSave() {
  const T = N - 3 * 24 * H;
  let s = C.act(C.advance(C.empty(), T), "player", {name: "Tester"}, T).state; s.story = {on: false};
  s.player.skills.farming = C.XP[40]; s.player.skills.construction = C.XP[50]; s.player.skills.husbandry = C.XP[30]; s.coins = 900000; s.dev = {infinite: true};
  Object.assign(s.bag, {plank: 40, rope: 10, potato: 40}); s = C.act(s, "quest", {region: "ranch"}, T).state;
  C.RANCH_ORDER.filter((b) => b !== "coop").forEach((b) => { const r = C.act(s, "ranchbuild", {building: b}, T); if (r.ok) s = r.state; });
  ["bee", "cow", "sheep", "pig", "pony", "duck"].forEach((k) => { s = C.act(s, "ranchbuy", {kind: k}, T).state; });
  s = C.act(s, "ranchfeed", {building: "all"}, T).state;
  delete s.dev;
  Object.assign(s.bag, {tomatoseed: 3, smokedfish: 5, trout: 6, oak: 2, oats: 9});
  s.ship = {tier: 3, parts: {}};
  return C.advance(s, N);
}
const fresh = () => C.advance(C.empty(), N);

const SCENARIOS = [
  { name: "every page opens without an error", save: bigSave, run: async (t) => {
      const views = SS.Pet.VIEWS.filter((v) => v !== "dev:tools");
      for (const v of views) {
        const before = t.errors().length;
        await t.go(v);
        const host = t.$("#np-host");
        t.ok("  " + v, host && host.children.length > 0 && t.errors().length === before, t.errors().slice(before).join(" | "));
      }
    } },
  { name: "the Farm: a scroll for every place, shelves and the show ring work", save: bigSave, run: async (t) => {
      await t.go("pet:ranch");
      t.ok("  the painting has a clickable scroll for all 17 places", t.$$(".pp-spot").length === 17, t.$$(".pp-spot").length);
      const seeds = t.saved().bag.tomatoseed;
      await t.click('[data-ranch-culture="0"][data-b="glass"]');
      t.ok("  Plant in the Greenhouse takes a tomato seed and fills a bed", t.saved().bag.tomatoseed === seeds - 1 && t.saved().ranch.b.glass.slots.length === 1);
      await t.click("[data-ranch-show]");
      t.ok("  Show sends an animal into the ring (one show a day)", !!t.saved().ranch.b.showring.showAt && !!t.$("[data-ranch-show][disabled]"));
      t.ok("  bees have no Feed, Muck out or Brush buttons", !t.$('#pp-ranch-hives [data-ranch="ranchfeed"]') && !!t.$('#pp-ranch-coop [data-ranch="ranchfeed"]'));
    } },
  { name: "the Shipyard: sailing with provisions", save: bigSave, run: async (t) => {
      await t.go("pet:shipyard");
      const box = t.$("[data-provisions]");
      t.ok("  the provisions tick is there, on to start with (2026-10-15)", box && box.checked);
      await t.click("[data-sail]");
      const s = t.saved();
      t.ok("  setting sail takes 3 smoked fish and halves the voyage", s.player.voyage && s.player.voyage.fed === 1 && s.bag.smokedfish === 2
           && s.player.voyage.until - s.player.voyage.since <= 8 * 60e3, JSON.stringify(s.player.voyage));
    } },
  { name: "Battle Re-work Part 1: the off hand, re-tempering, and Swap in a fight", save: () => {
      let s = bigSave(); Object.assign(s.bag, {bronzesword: 1, ironsword: 1, bronzebar: 10, oak: 10}); s.player.skills.attack = C.XP[20];
      s.player.gear.weapon = "bronzesword"; delete s.player.gear.offhand;
      s.player.wear = Object.assign(s.player.wear || {}, {bronzesword: Math.ceil(C.weaponDur("bronzesword") * 0.8)});
      return s;
    }, run: async (t) => {
      await t.go("pet:gear");
      await t.click('[data-pane="gear"] [data-doll="offhand"]');
      t.ok("  the figure's Off hand slot offers your other weapons, right by the slot", !!t.$('.pp-picker [data-pick="ironsword"]'));
      await t.click('.pp-picker [data-pick="ironsword"]'); await t.sleep(500);
      t.ok("  choosing one carries it in the off hand", t.saved().player.gear.offhand === "ironsword");
      t.ok("  a worn weapon shows its blows left, and sends you to the Grindstone (one home for re-tempering, C4 D3)", !t.$("[data-retemper]") && /blows left/.test(t.$(".pp-slot-wear").textContent) && !!t.$(".pp-retemper-at"));
      await SS.Pet.act("retemper", {item: "bronzesword"}); await t.sleep(300);
      t.ok("  re-tempering makes it as good as new, once", (t.saved().player.wear || {}).bronzesword === 0 && t.saved().player.tempered.bronzesword === true && !t.$(".pp-retemper-at"));
      const r = await SS.Pet.act("hunt", {ground: "farmyard", roll: 0.5});
      await t.go("pet:hunt"); await t.sleep(3500);
      await t.click('[data-kittab="combat"]');                          // (N22, 2026-10-20: Swap lives in the Kit's Combat tab)
      const sw = t.$('[data-kswap="1"]');
      t.ok("  hunting: both weapons on your card, and Swap hands in the Kit's Combat tab", !!t.$("#pp-you-weapons .pp-bweapon") && !!sw,
           JSON.stringify({err: r && r.error, arena: !!t.$("#pp-arena"), battle: !!t.saved().player.battle, job: !!t.saved().player.job, weapons: (t.$("#pp-you-weapons") || {}).innerHTML, cmds: (t.$("#pp-cmds") || {}).textContent}));
      if (sw) { sw.dispatchEvent(new MouseEvent("click", {bubbles: true})); await t.sleep(600); }
      t.ok("  Swap puts the iron sword in your hand", t.saved().player.gear.weapon === "ironsword" && t.saved().player.gear.offhand === "bronzesword");
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "spells as battle moves (2026-10-15): Cast, pick a spell", save: () => {
      let s = bigSave(); s.player.skills.magic = C.XP[20]; Object.assign(s.bag, {oakwand: 1, airrune: 200, mindrune: 200, waterrune: 200});
      s.player.gear.weapon = "oakwand"; s.player.loadout = ["windstrike", "waterstrike"]; return s;
    }, run: async (t) => {
      await SS.Pet.act("hunt", {ground: "farmyard", roll: 0.5}); await t.go("pet:hunt");
      await t.click('[data-kittab="magic"]');                           // (N22: your next spell from the Kit's Magic tab)
      for (let i = 0; i < 20 && !t.$("[data-kcast]"); i++) await t.sleep(500);
      t.ok("  in a fight with a wand: the Magic tab's loaded spells cast next", t.$$("[data-kcast]").length === 2 && /Cast next/.test(t.$(".np-kit-body").textContent));
      await t.click('[data-kcast][data-kspell="waterstrike"]');
      const b = SS.Pet._test.current().s.player.battle;
      t.ok("  picking Water strike makes it the next cast (or it was just cast)", (b && b.castNext === "waterstrike") || (b && b.rounds.some((x) => x.w === "Water strike")) || !b);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Hunter's traps and nets (2026-10-15, Battle Re-work Part 4): Tools in a fight, the hunt plan", save: () => {
      let s = bigSave(); s.player.cls = "hunter"; s.player.classes = {hunter: {xp: C.XP[20], talents: {}, builds: {}, respecs: 0}};
      Object.assign(s.bag, {shortbow: 1, bronzearrow: 300, ropesnare: 6, twinenet: 4, leatherquiver: 1}); s.player.gear.weapon = "shortbow"; s.player.gear.quiver = "leatherquiver"; s.player.gear.ammo = "bronzearrow"; return s;
    }, run: async (t) => {
      await t.go("pet:hunt");
      t.ok("  the Hunting page has no plan line any more (2026-10-20): the plan is the Kit's Combat tab", !t.$(".pp-planline"));
      await t.click('[data-kittab="combat"]');
      t.ok("  the Combat tab has the traps and nets: which creatures, a trap as fights open, a net above a line", !!t.$("#np-kit .pp-toolson") && !!t.$("#np-kit .pp-trapopen") && !!t.$("#np-kit .pp-netabove"));
      const sel = t.$("#np-kit .pp-toolson"); sel.value = "all"; sel.dispatchEvent(new Event("change")); await t.sleep(300);
      t.ok("  'every creature' saves", t.saved().player.combat.toolsOn === "all");
      await SS.Pet.act("hunt", {ground: "farmyard", roll: 0.5}); await t.go("pet:hunt");
      for (let i = 0; i < 20 && !SS.Pet._test.current().s.player.battle; i++) await t.sleep(500);
      await t.click('[data-kittab="bag"]');                             // (N22: traps from the bag, not a menu)
      t.ok("  in a fight: the snare and the net are in the Kit's bag, and the fight has no Tools button", !!t.$('[data-kitem="ropesnare"]') && !!t.$('[data-kitem="twinenet"]') && !t.$('[data-menu="tools"]'));
      await t.click('[data-kitem="ropesnare"]');
      const b = SS.Pet._test.current().s.player.battle;
      t.ok("  picking the snare makes it your next turn (or it's already down)", !b || b.toolNext && b.toolNext.item === "ropesnare" || b.rounds.some((x) => x.tool === "ropesnare"));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Berserker's fury (2026-10-15, Battle Re-work Part 5): the bar is fury, the Special button counts it", save: () => {
      let s = bigSave(); s.player.cls = "berserker"; s.player.classes = {berserker: {xp: C.XP[30], talents: {}, builds: {}, respecs: 0}};
      Object.assign(s.bag, {steellongsword: 1}); s.player.gear.weapon = "steellongsword"; s.player.combat.special = "cleave"; s.player.fury = 100; return s;
    }, run: async (t) => {
      await SS.Pet.act("hunt", {ground: "farmyard", roll: 0.5}); await t.go("pet:hunt");
      for (let i = 0; i < 20 && !SS.Pet._test.current().s.player.battle; i++) await t.sleep(500);
      await t.sleep(600);
      t.ok("  in a fight, the special bar is fury (its own colour)", !!t.$("#pp-you-spec.fury"));
      await t.click('[data-kittab="combat"]');                          // (N22: the special lives in the Kit's Combat tab)
      t.ok("  and the Kit's Combat tab calls the bar Fury, with Cleave on it", /Fury/.test(t.$(".np-kit-body").textContent) && /Cleave/.test((t.$("[data-kspec]") || {}).textContent || ""), (t.$(".np-kit-body") || {}).textContent);
      await t.sleep(300);                                               // (the save starts with 100 fury: it lasts the hunt -- PT4)
      const sb = t.$("[data-kspec]");
      t.ok("  with 100 fury the special is ready to fire -- in a fight or between them (PT4 f2)", sb && (!sb.disabled || /next/.test(sb.textContent)), sb && (sb.outerHTML + " | fury " + SS.Pet._test.current().s.player.fury));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Character sheet (2026-10-15, Cam's Q1): tabs, your figure's slots, spells on Combat, the Spellbook pop-up", save: () => {
      let s = bigSave(); s.player.skills.magic = C.XP[20]; Object.assign(s.bag, {oakwand: 1, airrune: 200, mindrune: 200, waterrune: 200});
      s.player.loadout = ["windstrike"];
      const T = N - 2 * 24 * H; s = C.act(s, "hatch", {egg: "starter", roll: 0.3}, T).state; s = C.advance(s, N);   // a pet, for its figure
      return s;
    }, run: async (t) => {
      await t.click(".np-me");
      t.ok("  your name in the top bar opens the Character sheet on You -- who you are, once (I1: no second figure)", SS.Pet.view === "pet:skills" && !!t.$('.pl-tab[data-pane="you"]:not([hidden]) .pl-hero') && !t.$('[data-pane="you"] .pl-doll'));
      await t.click('.pl-tabbtn[data-tab="gear"]');
      t.ok("  Gear: your figure with every slot, once", t.$$('[data-pane="gear"] .pl-doll:not(.pl-petdoll)').length === 1 && !t.$('#pl-gear .pp-shop:first-child .pp-npc'));
      await t.click('[data-pane="gear"] [data-doll="helmet"]');
      t.ok("  a slot on your figure opens its picker right there: what's in it and what fits", !!t.$(".pp-picker") && /Helmet|Head/i.test(t.$(".pp-picker-head").textContent), (t.$(".pp-picker") || {}).textContent);
      await t.click('.pl-tabbtn[data-tab="combat"]');
      t.ok("  Combat: how you fight, the hunt plan and your three spells", !!t.$('[data-pane="combat"] .pp-style') && !!t.$('[data-pane="combat"] .pp-food') && !!t.$('[data-pane="combat"] [data-sp-on="waterstrike"]'));
      await t.click('[data-pane="combat"] [data-sp-on="waterstrike"]');
      t.ok("  adding Water strike puts it in your three", t.saved().player.loadout.join() === "windstrike,waterstrike");
      t.ok("  and the sheet stays on Combat after the save", !t.$('.pl-tab[data-pane="combat"]').hidden);
      await t.go("pet:storeroom");
      t.ok("  Equipment has left the Storeroom", !t.$('.pp-spot[data-key="pet:gear"]'));
      await t.go("pet:library"); await t.click('.pp-spot[data-key="pet:spellbook"]');
      t.ok("  the Library's Spellbook is the Arcane's book, open at its spells: unlock level, element, runes (C4 D5)", !!t.$(".gh-bookmodal #gh-spells") && /unlocks at Magic 5/.test(t.$(".gh-bookmodal").textContent) && /Water — may slow/.test(t.$(".gh-bookmodal").textContent));
      await t.click('.gh-bookmodal [data-sheet-tab="combat"]');
      t.ok("  its button goes straight to the sheet's Combat tab", SS.Pet.view === "pet:skills" && !t.$('.pl-tab[data-pane="combat"]').hidden);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Talents tab (2026-10-15, Battle Re-work Part 3): your class's tree, spend a point, respec, a build", save: () => {
      let s = bigSave(); s.player.skills.attack = C.XP[30]; s.player.cls = "berserker";
      s.player.classes = {berserker: {xp: C.XP[30], talents: {}, builds: {}, respecs: 0}}; return s;
    }, run: async (t) => {
      await t.click(".np-me"); await t.click('.pl-tabbtn[data-tab="talents"]');
      const pane = () => t.$('.pl-tab[data-pane="talents"]');
      t.ok("  your class, its level and 15 points; three branches, all filled (Part 5)", !pane().hidden && /Berserker/.test(pane().textContent) && /15/.test(pane().textContent)
           && t.$$('[data-pane="talents"] [data-talent]').length === 24);
      await t.click('[data-pane="talents"] [data-talent="heavyhands"]');
      t.ok("  a click spends a point (Heavy hands rank 1), and the sheet stays on Talents", (t.saved().player.classes.berserker.talents.heavyhands || 0) === 1 && !pane().hidden);
      await t.click('[data-pane="talents"] [data-talent="executioner"]');
      t.ok("  a locked node says why instead (no point spent)", !t.saved().player.classes.berserker.talents.executioner);
      window.prompt = () => "Glass cannon"; await t.click('[data-pane="talents"] [data-build-save="0"]');
      t.ok("  Save here keeps the build by name", t.saved().player.classes.berserker.builds[0].name === "Glass cannon" && !!t.$('[data-pane="talents"] [data-build-load="0"]'));
      window.confirm = () => true; await t.click("#pl-respec");
      t.ok("  respec gives every point back (class level 30: it costs coins)", !Object.keys(t.saved().player.classes.berserker.talents).some((k) => t.saved().player.classes.berserker.talents[k]));
      await t.click('[data-pane="talents"] [data-build-load="0"]');
      t.ok("  and Use puts the build back", t.saved().player.classes.berserker.talents.heavyhands === 1);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the sandbox: click a skill to set its level (2026-10-15, Cam PT6)", save: bigSave, run: async (t) => {
      await NP.sandbox(true); await t.sleep(400);
      await t.click(".np-me"); await t.click('.pl-tabbtn[data-tab="skills"]');
      window.prompt = () => "33";
      await t.click('.pl-skill[data-k="magic"]'); await t.sleep(400);
      t.ok("  in the sandbox, clicking Magic asks for a level and sets it", window.PetCore.levelOf(SS.Pet._test.current().s.player.skills.magic) === 33);
      await NP.sandbox(false); await t.sleep(300);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Guild hall (2026-10-16, Battle Re-work Part 9): tutors, switching, benches, books", save: () => {
      let s = bigSave(); s.player.cls = "hunter"; s.player.classes = {hunter: {xp: C.XP[20], talents: {}, builds: {}, respecs: 0}}; s.player.freeSwitch = 1;
      s.coins = 5000; return s;
    }, run: async (t) => {
      await t.go("pet:guild"); await t.sleep(400);
      t.ok("  the Guild hall opens: the Guildmaster and six tutors", !!t.$(".gh-master") && t.$$(".gh-tutor").length === 6, (t.$("#np-host") || {}).textContent && t.errors().join(" | "));
      await t.click('[data-talk="paladin"]');
      t.ok("  Talk: the tutor's own words", /Paladin/.test(document.body.textContent) && !!t.$(".gh-talk"));
      document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"})); const x = t.$(".pp-item-sheet .pp-shop-x"); if (x) x.click(); await t.sleep(200);
      window.confirm = () => true; await t.click('[data-become="paladin"]'); await t.sleep(300);
      t.ok("  Become a Paladin (the free switch)", t.saved().player.cls === "paladin" && !t.saved().player.freeSwitch);
      await t.click('[data-gtab="benches"]');
      t.ok("  Class benches: only a class's own things", t.$$("[data-gbench]").length === 6 && !!t.$("[data-gmake]"));
      await t.click('[data-gtab="books"]'); await t.click('[data-gbuy="paladinbook"]'); await t.sleep(300);
      t.ok("  a book bought goes in the bag", t.saved().bag.paladinbook === 1);
      await t.go("pet:guild"); await t.click('[data-gtab="books"]'); await t.click('[data-gread="paladin"]');
      t.ok("  and reads: the tree with its numbers, the specials, builds", !!t.$(".gh-book") && /Bulwark/.test(t.$(".gh-book").textContent) && /Builds/.test(t.$(".gh-book").textContent));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the fight from the Kit (N22, 2026-10-20): no fight buttons; stances, special, Bash and Run on Combat; Skills; eat and wear from the bag", save: () => {
      let s = bigSave(); s.player.cls = "paladin"; s.player.classes = {paladin: {xp: C.XP[20], talents: {}, builds: {}, respecs: 0}};
      Object.assign(s.bag, {steelsword: 1, steelkiteshield: 1, ironsword: 1, cookedsalmon: 5}); ["attack", "defence", "hitpoints"].forEach((k) => { s.player.skills[k] = C.XP[25]; }); s.player.hp = 12; s.player.gear.weapon = "steelsword"; s.player.gear.offhand = "steelkiteshield"; s.player.combat.special = "smite"; return s;
    }, run: async (t) => {
      await SS.Pet.act("hunt", {ground: "pasture", roll: 0.5}); await t.go("pet:hunt");
      for (let i = 0; i < 20 && !SS.Pet._test.current().s.player.battle; i++) await t.sleep(400);
      t.ok("  the Kit is open on the Hunting page (whatever the setting), and the fight has no buttons", !!t.$("#np-kit:not([hidden]) .np-kit-tabs") && !t.$$("#pp-cmds button").length && !t.$("#pp-cmds").textContent.trim());   // (and no writing there either, 2026-10-20)
      t.ok("  five tabs: Bag, Gear, Combat, Magic, Skills", t.$$("[data-kittab]").map((x) => x.dataset.kittab).join() === "bag,gear,combat,magic,skills");
      await t.click('[data-kittab="combat"]');
      t.ok("  Combat: a stance for each style, yours marked", t.$$("[data-kstyle]").length === Object.keys(window.PetCore.STYLES).length && !!t.$('[data-kstyle].on'));
      await t.click('[data-kstyle="defensive"]');
      t.ok("  clicking Defensive makes it your stance", t.saved().player.combat.style === "defensive");
      t.ok("  your special's bar, every special to pick, Shield bash and Run", !!t.$("[data-kspec]") && t.$$(".np-kit-specs [data-kspecpick]").length === 4 && !!t.$("[data-kbash]")   /* (V18: the class's three and the sword's Lunge) */ && !!t.$("[data-krun]"), [!!t.$("[data-kspec]"), t.$$("[data-kspecpick]").length, !!t.$("[data-kbash]"), !!t.$("[data-krun]"), !!t.saved().player.battle].join());
      await t.click('[data-kspecpick="smite"]');
      t.ok("  no errors so far", !t.errors().length, t.errors().join(" | "));
      await t.click('[data-kittab="bag"]');
      await t.click('[data-kitem="cookedsalmon"]');
      t.ok("  clicking food in the bag eats it mid-fight (your next attack)", t.saved().bag.cookedsalmon === 4, [t.saved().player.hp, t.saved().bag.cookedsalmon, !!t.saved().player.battle]);
      await t.click('[data-kitem="ironsword"]');
      const b = t.saved().player.battle;
      t.ok("  clicking a sword in the bag wears it -- in this fight, now", t.saved().player.gear.weapon === "ironsword" && (!b || b.me.wid === "ironsword"), b && b.me.wid);
      await t.click('[data-kittab="skills"]');
      t.ok("  Skills: every skill with its level over the top level", t.$$("[data-kskill]").length === window.PetCore.SKILL_REG.length && /50/.test(t.$("[data-kskill] .np-kit-lv").textContent));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the place editor (2026-10-15): drag a scroll, type a number, save", save: bigSave, run: async (t) => {
      await NP.sandbox(true); await t.sleep(400);
      await t.go("dev:places");
      t.ok("  it's in the sandbox's sidebar, and opens on a scene", !!t.$('#np-nav [data-go="dev:places"]') && !!t.$("#pe-scene") && !!t.$(".pp-pe-map image"));
      const sel = t.$("#pe-scene"); sel.value = "ranch"; sel.dispatchEvent(new Event("change")); await t.sleep(300);
      t.ok("  the Farm shows a scroll for every place", t.$$('.pp-pe-place').length === Object.keys(window.SCENE_PLACES.ranch).length);
      const rect = t.$('.pp-pe-place[data-pe="coop"] .pp-pe-scroll'), svg = t.$(".pp-pe-map"), box = rect.getBoundingClientRect(), m = svg.getScreenCTM();
      const x0 = box.left + box.width / 2, y0 = box.top + box.height / 2, before = window.SCENE_PLACES.ranch.coop.at.slice();
      const ev = (type, x, y, target) => (target || svg).dispatchEvent(new PointerEvent(type, {bubbles: true, clientX: x, clientY: y, pointerId: 7}));
      ev("pointerdown", x0, y0, rect); ev("pointermove", x0 + 100 * m.a, y0 + 50 * m.d); ev("pointerup", x0 + 100 * m.a, y0 + 50 * m.d);
      await t.sleep(300);
      const x = t.$('[data-pe-f="x"]');
      t.ok("  dragging the coop's scroll moves it (100 across, 50 down) and chooses it", x && Math.abs(+x.value - (before[0] + 100)) <= 1 && Math.abs(+t.$('[data-pe-f="y"]').value - (before[1] + 50)) <= 1, x && x.value);
      const w = t.$('[data-pe-f="w"]'); w.value = "321"; w.dispatchEvent(new Event("change")); await t.sleep(200);
      t.ok("  nothing is written until Save", !window.__places && !t.$("#pe-save").disabled);
      await t.click("#pe-save");
      t.ok("  Save sends every scene, with the coop moved and resized", window.__places && window.__places.ranch.coop.at[2] === 321 && Math.abs(window.__places.ranch.coop.at[0] - before[0] - 100) <= 1
           && Object.keys(window.__places).length === Object.keys(window.SCENE_PLACES).length && window.__places["//"]);
      t.ok("  and the game uses the new places at once", window.SCENE_PLACES.ranch.coop.at[2] === 321);
      await t.click("#pe-del");
      t.ok("  a place taken off the picture is offered again under \"Not on the picture yet\"", !t.$('.pp-pe-place[data-pe="coop"]') && !!t.$('[data-pe-add="coop"]'));
      await t.click('[data-pe-add="coop"]');
      t.ok("  and one click puts it back (in the middle, chosen)", !!t.$('.pp-pe-place.on[data-pe="coop"]'));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "your estate is on the main island's map", save: bigSave, run: async (t) => {
      await t.go("pet:world");
      t.ok("  the map has Your estate, and the list under it", !!t.$("svg .pp-estate-spot") && !!t.$('.pp-world-row[data-region="estate"]'));
      await t.click("svg .pp-estate-spot");
      t.ok("  clicking it opens the estate", SS.Pet.page ? SS.Pet.page() === "pet:estate" : /Estate/.test(t.$("#np-title").textContent), t.$("#np-title").textContent);
      t.ok("  and Back goes to the Map, not the Village", !!t.$('#np-pathbar [data-go="pet:world"]') && !t.$('#np-pathbar [data-go="pet:village"]'));
    } },
  { name: "Cook all in the kitchen (2026-10-14)", save: () => { const s = bigSave(); s.bag.berry = 10; s.bag.acorn = 10; s.bag.treat = 0; return s; }, run: async (t) => {
      await t.go("shop:kitchen");
      const b = t.$('.pp-make[data-times="all"][data-make="treat"]');
      t.ok("  the treat has a \"Cook all (5)\" button beside Cook", !!b && /Cook all \(5\)/.test(b.textContent), b && b.textContent);
      await t.click('.pp-make[data-times="all"][data-make="treat"]');
      const s = t.saved();
      t.ok("  clicked: 5 treats, the berries used up", s.bag.treat === 5 && !s.bag.berry, JSON.stringify({treat: s.bag.treat, berry: s.bag.berry}));
      t.ok("  and the button's gone (nothing left to cook twice)", !t.$('.pp-make[data-times="all"][data-make="treat"]'));
    } },
  { name: "a new game: Amunet's tutorial", save: fresh, run: async (t) => {
      await t.sleep(1500);
      t.ok("  a brand-new game opens with the tutorial over the page", !!t.$(".np-tutor"));
    } },
  { name: "the Beast Pen (2026-10-16, Battle Re-work Part 11a): the hatch choice, Warden Briar, training", save: () => {
      let s = bigSave(); s.hatchery.push({kind: "wolf/grey", egg: "starter", started: N - 24 * H, hatchAt: N - 1000});
      s = C.advance(s, N); s.bag.grainfeed = 8; return s;
    }, run: async (t) => {
      await t.go("pet:pets");
      t.ok("  a new pet's card asks: keep it at home, or the Beast Pen", !!t.$("[data-topen]") && !!t.$("[data-petkeep]"));
      window.confirm = () => true; await t.click("[data-topen]"); await t.sleep(400);
      t.ok("  To the Beast Pen: it's a battle pet now", (t.saved().beasts || []).length === 1);
      await t.go("pet:estate");
      t.ok("  the estate has the Beast Pen", !!t.$('.pp-spot[data-key="pet:pen"]'));
      await t.click('.pp-spot[data-key="pet:pen"]');
      t.ok("  the Pen: Warden Briar, the stalls and the wolf, a Beast type", SS.Pet.view === "pet:pen" && /Warden Briar/.test(document.body.textContent) && !!t.$(".pen-beast .pen-type.t-beast"));
      const sel = t.$(".pen-train"); sel.value = "attack"; sel.dispatchEvent(new Event("change")); await t.sleep(300);
      await t.click("#pen-feed"); await t.sleep(300);
      const b = (t.saved().beasts || [])[0] || {};
      t.ok("  train attack and fill the troughs", b.train === "attack" && b.fedUntil > Date.now() && t.saved().bag.grainfeed === 4, JSON.stringify(b));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Beast Master (2026-10-16, Battle Re-work Part 11b): the pack, a fight, a move", save: () => {
      let s = bigSave(); s.player.freeSwitch = 1; s = C.act(s, "class", {cls: "beastmaster", guild: true}, N).state;
      s.beasts = [["Fang", "wolf/grey"], ["Hoot", "owl/storm"]].map(([n, k]) => ({id: n, name: n, species: k.split("/")[0], colour: k.split("/")[1], born: N - 9 * 24 * H, hatchAt: N - 9 * 24 * H, joined: N, xp: C.XP[15], stat: {}, train: "", trainAt: N, fedUntil: 0, restUntil: 0, wins: 0, faints: 0}));
      return s;
    }, run: async (t) => {
      await t.click(".np-me"); await t.click('.pl-tabbtn[data-tab="combat"]');
      t.ok("  the Combat tab: Your pack, with your battle pets to add", /Your pack/.test(t.$('[data-pane="combat"]').textContent) && !!t.$('[data-packadd="Fang"]'));
      await t.click('[data-packadd="Fang"]'); await t.sleep(300); await t.click('[data-packadd="Hoot"]'); await t.sleep(300);
      t.ok("  Fang fights, Hoot waits on the bench", (t.saved().player.combat.pack || []).join() === "Fang,Hoot" && /Bench: Hoot/.test(t.$('[data-pane="combat"]').textContent));
      await SS.Pet.act("hunt", {ground: "farmyard", roll: 0.5}); await t.go("pet:hunt");
      for (let i = 0; i < 20 && !t.$('[data-menu="moves"]'); i++) await t.sleep(500);
      t.ok("  in a fight: Fang in your place, the pack's health, and Moves / Feed", !t.$("#pp-packpet").hidden && t.$$(".pp-packpet-chip").length === 2 && !!t.$('[data-menu="moves"]') && !!t.$('[data-menu="petfeed"]'));
      await t.click('[data-menu="moves"]');
      t.ok("  Moves: Fang's moves", !!t.$('[data-pmove="0:bite"]'));
      await t.click('[data-pmove="0:bite"]'); await t.sleep(300);
      const b = SS.Pet._test.current().s.player.battle;
      t.ok("  picking Bite: it's Fang's move now (or the fight just ended)", !b || b.pack.pets[0].last === "bite");
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "Use with... in the Kit's bag (V2; the Bag page went 2026-10-20): a Hunter's knife and twigs make arrow shafts", save: () => {
      let s = bigSave(); s.player.cls = "hunter"; s.player.classes = {hunter: {xp: C.XP[10], talents: {}, builds: {}, respecs: 0}};
      Object.assign(s.bag, {bronzeknife: 1, twigs: 20, feather: 3}); return s;
    }, run: async (t) => {
      await t.go("pet:estate"); await t.click('[data-kittab="bag"]');
      await t.click('#np-kit [data-kitem="twigs"]');
      t.ok("  Use with...: a bar says so, the knife lights up, the feathers don't", !!t.$(".np-kit-use") && !!t.$('#np-kit .np-kit-slot.use-ok[data-kitem="bronzeknife"]') && !!t.$('#np-kit .np-kit-slot.dim[data-kitem="feather"]'));
      await t.click('#np-kit [data-kitem="feather"]');
      t.ok("  a dim one does nothing", !!t.$(".np-kit-use") && !t.errors().length);
      await t.click('#np-kit .np-kit-slot.use-ok[data-kitem="bronzeknife"]'); await t.sleep(400);
      t.ok("  the knife: the twigs become arrow shafts", t.saved().bag.arrowshaft === 20 && !t.saved().bag.twigs && !t.$(".np-kit-use"));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the side bar (2026-10-20): no Bag page, search, quick slots by drag, the plan on Combat, skills' xp, the How to Play book", save: () => {
      let s = bigSave(); s.player.cls = "hunter"; s.player.classes = {hunter: {xp: C.XP[10], talents: {}, builds: {}, respecs: 0}};
      Object.assign(s.bag, {bronzeknife: 1, twigs: 20, ropesnare: 4, cookedsalmon: 3, howtoplay: 1}); s.player.skills.foraging = C.XP[12] + 40; return s;
    }, run: async (t) => {
      await t.go("pet:estate");
      t.ok("  no Bag button above the page", !t.$('#np-pathbar [data-go="pet:bag"]'));
      SS.go("pet:bag"); await t.sleep(400);
      t.ok("  an old link to the Bag page opens the Kit's bag instead (and stays on the page)", SS.Pet.view === "pet:estate" && !!t.$('[data-kittab="bag"].on'));
      const q = t.$(".np-kit-search"); q.value = "twig"; q.dispatchEvent(new Event("input")); await t.sleep(100);
      t.ok("  the bag's search", t.$$("#np-kit .np-kit-grid:not(.np-kit-worn) [data-kitem]").filter((e) => !e.hidden).map((e) => e.dataset.kitem).join() === "twigs");
      q.value = ""; q.dispatchEvent(new Event("input"));
      await t.click('[data-kittab="combat"]');
      t.ok("  Combat holds the plan: quick slots, traps and nets", t.$$("#np-kit .np-kit-quick [data-quick]").length === 4 && !!t.$("#np-kit .pp-trapopen") && !!t.$("#np-kit .pp-toolson"));
      await t.click('[data-kittab="bag"]');
      const dt = new DataTransfer(), from = t.$('#np-kit [data-kitem="ropesnare"]');
      from.dispatchEvent(new DragEvent("dragstart", {bubbles: true, dataTransfer: dt}));
      await t.click('[data-kittab="combat"]');
      const to = t.$('#np-kit .np-kit-quick [data-quick="3"]');
      to.dispatchEvent(new DragEvent("dragover", {bubbles: true, cancelable: true, dataTransfer: dt}));
      to.dispatchEvent(new DragEvent("drop", {bubbles: true, cancelable: true, dataTransfer: dt})); await t.sleep(400);
      t.ok("  dragging a snare from the bag onto quick slot 4 puts it there", (t.saved().player.quick || [])[3] === "ropesnare", JSON.stringify(t.saved().player.quick));
      await t.click('[data-kittab="skills"]');
      const tip = t.$('[data-kskill="foraging"] .np-kit-tip');
      t.ok("  a skill's hover: its xp, the next level's xp and what's left", tip && /XP: [\d,]+/.test(tip.textContent) && /Next level at: [\d,]+/.test(tip.textContent) && /Remaining: [\d,]+/.test(tip.textContent), tip && tip.textContent);
      await t.click('[data-kittab="bag"]'); await t.click('#np-kit [data-kitem="howtoplay"]');
      t.ok("  How to Play opens as a book, at its contents", !!t.$(".gh-guide .gh-contents") && t.$$(".gh-guide .gh-contents .gh-link").length === window.PetCore.HOW_TO_PLAY.chapters.length);
      await t.click('.gh-guide .gh-contents [data-bookto="7"]');
      t.ok("  a chapter: its title, its photo, its words and its tips", /Fighting/.test(t.$(".gh-guide .gh-chapter").textContent) && !!t.$(".gh-guide .gh-shot") && !!t.$(".gh-guide .gh-tips"));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the Necromancer (2026-10-16, Battle Re-work Part 13): the Archmage's offer, the Necromancer's ground, raising", save: () => {
      let s = bigSave(); s.player.cls = "arcane"; s.player.classes = {arcane: {xp: C.XP[50], talents: {}, builds: {}, respecs: 0}};
      s.player.skills.magic = C.XP[50]; s.mageRank = C.MAGE_RANKS.length - 1; s.player.necro = {offered: N};
      Object.assign(s.bag, {bloodbook: 1, bloodrune: 250, lifeessence: 12});
      s.graveyard = [{name: "Fang", kind: "Wolf", species: "wolf", colour: "grey", rarity: "Common", level: 30, ageDays: 4, area: "the Jungle", cause: "fell to a tiger", at: N - 9e7, cleared: 0, gear: [], battle: true,
                      pet: {id: "Fang", name: "Fang", species: "wolf", colour: "grey", xp: C.XP[30]}}];
      return s;
    }, run: async (t) => {
      SS.Pet.toRegion("magetower"); await t.go("pet:world");
      t.ok("  the mage tower: the Archmage's offer, Yes and No", !!t.$(".pp-necro-offer") && !!t.$('[data-necro="accept"]') && !!t.$('[data-necro="decline"]'));
      await t.click('[data-necro="accept"]'); await t.sleep(300);
      t.ok("  Yes: he names the Blood Book and the runes; you have them", /Blood Book/.test(t.$(".pp-necro-offer").textContent) && !t.$('[data-necro="learn"]').disabled);
      await t.click('[data-necro="learn"]'); await t.sleep(300);
      t.ok("  handed over: you know Necromancy", !!(t.saved().player.necro || {}).taught && !t.saved().bag.bloodbook);
      await t.go("pet:graveyard");
      t.ok("  the graveyard: the Necromancer's ground, and Raise on Fang's headstone (6 life essence)", !!t.$(".pp-necro-ground") && /6 life essence/.test(t.$(".pp-graves").textContent) && !!t.$(".pp-grave [data-raise=\"0\"]"));
      await t.click('[data-raise="0"]'); await t.sleep(300);
      t.ok("  Raise: Fang is risen (a battle pet again), the grave empties, 6 essence spent", (t.saved().beasts || []).some((b) => b.risen && b.id === "Fang") && !(t.saved().graveyard || []).length && t.saved().bag.lifeessence === 6);
      t.ok("  ... and listed among your risen", /Fang/.test(t.$(".pp-necro-ground").textContent) && !!t.$('[data-risenpotion="Fang"]'));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "the tutorial's red box (I2, 2026-10-16): a window over the page -- it points at the window's close button first", save: () => {
      let s = bigSave(); s.player.cls = ""; s = C.act(s, "tutorial", {op: "restart"}, N).state; return s;
    }, run: async (t) => {
      await t.click(".np-me");
      t.ok("  no class yet: the You tab sends you to the Guild hall, with no class list of its own (C4 D2)", !!t.$('[data-pane="you"] .pp-class-guild') && !t.$('[data-pane="you"] [data-cls]'));
      t.ok("  the tutorial is pointing at something", SS.Pet._test.current().s.tutorial && !SS.Pet._test.current().s.tutorial.done);
      await t.click('.pl-tabbtn[data-tab="gear"]');
      await t.click('[data-pane="gear"] [data-doll="helmet"]'); await t.sleep(500);
      const ring = t.$(".np-tutor-ring"), x = t.$(".pp-picker-x");
      const near = (a, b) => Math.abs(a - b) < 12, rr = ring && ring.getBoundingClientRect(), xr = x && x.getBoundingClientRect();
      t.ok("  with a window open, the red box is on its ✕", !!(rr && xr && near(rr.left, xr.left) && near(rr.top, xr.top)), JSON.stringify({rr, xr}));
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "New Game Plus legacies (2026-10-16, Battle Re-work Part 12): the legacy shown, a battle pet chosen, the game started", save: () => {
      let s = bigSave(); s = C.act(s, "class", {cls: "beastmaster"}, N).state;
      s.player.classes.beastmaster.xp = C.XP[36]; s.hunt.jungle = {wins: 1, kills: 30};
      const b = (id, lv) => ({id, name: id, species: "wolf", colour: "grey", born: N - 9 * 24 * H, hatchAt: N - 9 * 24 * H, joined: N, xp: C.XP[lv], stat: {}, train: "",
                              trainAt: N, fedUntil: 0, restUntil: 0, wins: 3, faints: 0});
      s.beasts = [b("Fang", 30), b("Hoot", 12)];
      return s;
    }, run: async (t) => {
      await t.go("pet:saves");
      await t.click('[data-new="2"]');
      const from = t.$("#pp-ng-from"); from.value = "1"; from.dispatchEvent(new Event("change")); await t.sleep(300);
      const L = t.$(".pp-legacy");
      t.ok("  the legacy: Beast Master level 36, 3 free points, a prestige mark", !!L && /Beast Master level 36/.test(L.textContent) && /3 free talent points/.test(L.textContent) && /Prestige mark 1/.test(L.textContent), L && L.textContent);
      const pick = t.$("#pp-ng-beast");
      t.ok("  the old Pen's pets to choose from, highest first", !!pick && pick.options.length === 2 && pick.options[0].value === "Fang");
      pick.value = "Hoot"; pick.dispatchEvent(new Event("change"));
      t.$$("[data-pet]").slice(0, 3).forEach((c) => { if (!c.checked) { c.checked = true; c.dispatchEvent(new Event("change")); } }); await t.sleep(300);
      await t.click("#pp-ng-go"); await t.sleep(500);
      const s = t.saved();
      t.ok("  the new game: New Game Plus 1, mark 1, Hoot back at battle level 5", s.ngPlus === 1 && s.marks === 1 && s.beasts.length === 1 && s.beasts[0].id === "Hoot" && window.PetCore.levelOf(s.beasts[0].xp) === 5, JSON.stringify({ng: s.ngPlus, m: s.marks, b: s.beasts}));
      t.ok("  the points wait for the Beast Master", s.player.legacyPts && s.player.legacyPts.beastmaster === 3);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "a crate opens (2026-10-20: the crate stuck shaking after its hint line went)", save: () => { const s = bigSave(); s.bag.woodcrate = 1; return s; }, run: async (t) => {
      await t.go("pet:estate"); await t.click('[data-kittab="bag"]'); await t.click('#np-kit [data-kitem="woodcrate"]');
      t.ok("  clicking it in the bag opens the crate window", !!t.$(".pp-crate-card .pp-crate"));
      await t.click(".pp-crate-card .pp-crate");
      for (let i = 0; i < 40 && t.$(".pp-crate-card .pp-modal-close[hidden]"); i++) await t.sleep(300);
      t.ok("  it opens, shows what was inside, and Close appears", !t.$(".pp-crate-card .pp-modal-close[hidden]") && t.$$(".pp-crate-card .pp-prize").length > 0 && /You found/.test(t.$(".pp-crate-hint").textContent));
      t.ok("  the crate's gone from the bag", !t.saved().bag.woodcrate);
      t.ok("  no errors", !t.errors().length, t.errors().join(" | "));
    } },
  { name: "names are shown as text, never run", save: () => { const s = bigSave(); s.player.name = '<img src=x onerror="window.__xss=1">'; return s; }, run: async (t) => {
      for (const v of ["pet:skills", "pet:dash", "pet:house"]) await t.go(v);
      t.ok("  a name with HTML in it (an old save) doesn't run as code", !window.__xss && !t.$('#np-host img[src="x"]'));
    } },
];

const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const html = fs.readFileSync(path.join(PET, "index.html"), "utf8")
  .replace('<script src="game.js"></script>', '<script src="stub.js"></script><script src="game.js"></script><script src="checks.js"></script><script src="scenario.js"></script>');
let pass = 0, fail = 0;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "np-browser-"));
try {
  SCENARIOS.forEach((sc, i) => {
    const dir = path.join(root, "s" + i);
    fs.mkdirSync(dir);
    fs.readdirSync(PET).filter((f) => f !== "index.html").forEach((f) => fs.symlinkSync(path.join(PET, f), path.join(dir, f)));
    fs.copyFileSync(path.join(__dirname, "stub.js"), path.join(dir, "stub.js"));
    fs.copyFileSync(path.join(__dirname, "checks.js"), path.join(dir, "checks.js"));
    fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(sc.save()));
    fs.writeFileSync(path.join(dir, "scenario.js"), "window.__SCENARIO = " + sc.run.toString() + ";\n");
    fs.writeFileSync(path.join(dir, "index.html"), html);
    let dom = "";
    try {
      dom = cp.execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", "--user-data-dir=" + path.join(dir, "profile"),
        "--window-size=1500,1200", "--virtual-time-budget=60000", "--dump-dom", "file://" + path.join(dir, "index.html")],
        {encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20});
    } catch (e) { dom = String(e.stdout || ""); }
    const m = dom.match(/<pre id="__results">([\s\S]*?)<\/pre>/);
    console.log(sc.name);
    if (!m) { fail++; console.log("  FAIL  the page never finished (no results)"); return; }
    JSON.parse(unesc(m[1])).forEach((r) => {
      if (r.ok) { pass++; console.log("  ok    " + r.name.trim()); } else { fail++; console.log("  FAIL  " + r.name.trim() + (r.detail ? "  -- " + r.detail : "")); }
    });
  });
} finally { fs.rmSync(root, {recursive: true, force: true}); }
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
