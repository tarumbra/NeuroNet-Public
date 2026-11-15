# NeuroPets rules, in parts

`ui/pet/petcore.js` is **built** from these files: they're joined in name order into one plain script, because the same
file has to run in the game's page and in node (the tests and tools), so it can't use modules.

- **Edit a part here, never `petcore.js`.** Then run `python3 tools/build_petcore.py`, which rebuilds `petcore.js`. Then run
  the tests.
- **Content is JSON (2026-10-15).** A part's plain data (items, workshops and recipes, spots, monsters, people, prices,
  tiers) lives in `ui/pet/content/<same name>.json`, one key per table; the part says `CONTENT("KEY")` where the table goes
  and the build puts it there. `"//"` keys in the JSON are notes (left out of the game). Times are milliseconds. Tables that
  need code (worked out from other tables, or holding functions) stay in the part. `tools/pet_content.js` gives node tools
  the parts with their content filled in.
- **Each part is one feature's data and rules together** (e.g. `37-the-oasis-and-the-harbourmasters.js` adds the Oasis
  region, its spots, people and contracts). New features get a new numbered part near the end, before `40-the-pace-of-gathering.js`
  if they add gathering spots (the pace step rescales every spot once, last).
- **Safety nets:**
  - `test/test_pet_golden.js` replays a scripted day and must match its fingerprint. After a deliberate rules change,
    run `node test/test_pet_golden.js --update` and say so in the commit.
  - `test/test_pet_content.js` checks every id, level and recipe source.
  - `node tools/balance_sim.js --check` flags XP/hour outliers.
- **Don't change what an earlier part defined.** Put a new value in the first definition. Only the listed rules may rewrite
  content (the conversions, the pace, the economy, recipe xp), each with its reason in `tools/content_patches.json`;
  `node tools/content_patches.js` shows what each part changes, and the content test fails on anything unlisted.
- **Recipe xp is derived** (`40-zz-recipe-xp.js`): a recipe's `xp` in the data is only a placeholder (any number above 0
  means "this gives xp"); the real number is its materials' gathering hours x the xp an hour at its level.
- **Save upgrades are numbered** (`MIGRATIONS` in `10-mod-packs.js`): to change an old save once, append a step (never
  renumber or remove one) and test it in `test/test_pet_migrations.js`.

## Adding a skill (2026-10-11, the skill registry)

Every skill declares itself once, in `01-a-the-skill-registry.js`. The rules' `SKILL_ORDER` and `GATHERING`, the skills
table's names, the economy's coin speeds, and the shell's skill pages, the Player page's columns, icons and benches all read
it. A new skill is:

1. **Its registry entry** (in `ui/pet/content/01-a-the-skill-registry.json`, `SKILL_REG`): id, name, verb, group (gathering / making / combat), icon, and either `trips: true` + `coins`
   (a gathering skill with spots on the map), a `bench` (a making skill) or its own `page`. Old saves get it at level 1 on
   their own.
2. **Its content**: spots (`SKILLS[id].spots`, and their places in `SCENE_ART`) or recipes (a workshop with `skill: id`),
   plus level unlocks and, if a quest opens it, a story gate.
3. **Its art**: the skill icon (an icon sheet cell) and its spots painted on their scenes.

`test/test_pet_registry.js` adds a made-up skill with one entry and checks it lands everywhere.
