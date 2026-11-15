# NeuroPets balance tools

Simulations that drive NeuroPets' real rules (`ui/pet/petcore.js`) in Node, for balance work.
They never touch a save or the app. Written for the 2026-10-04 balance audit (report:
https://claude.ai/artifact/B5d65hhycpCeYGKjAZyfsH), kept so the audit can be re-run after each
round of fixes and compared.

Run everything: `tools/balance/run_all.sh` (combat sims take a few minutes), or
`tools/balance/run_all.sh quick` for the table-only ones. Or any one: `node tools/balance/gear.js`.

| Script | What it measures |
|---|---|
| `core.js` | Loads petcore.js (shared by the rest) |
| `cost.js` | Seconds of gathering behind one of each item (best spot, good tool, monster drops, recipes) |
| `gather.js` | XP/hour per spot and hours from 1 to 50 for each gathering skill (best tool and spot per level) |
| `making.js` | Hours of gathering and coins in fees to take each making skill to 50 (best XP-per-material recipe) |
| `coins.js` | Best coins/hour by level, hunting coins/hour, workshop fees vs sale prices, Alchemist value in/out |
| `gear.js` | Every player item by slot with requirements and stats; flags items dominated by another |
| `materials.js` | Items nothing uses (sell-only) and items with no source in the cost model |
| `tools.js` | Hours each tool lasts at the hardest spots it works, and its mending cost |
| `hunt.js` | `player(level, cls, style, armour?, weapon?)` and `hunt(state, ground, hours, seed)` helpers; run alone: 12h idle hunts at each area's entry level |
| `sustain.js` | The level at which each area first lasts a full 12-hour idle hunt |
| `bosses.js` | Boss wins out of 12 by player level (metal armour) |
| `bosses_bossgear.js` | Late bosses and hunts with Grizzly, Gorgon and Sylvan gear |
| `classes.js` | Battle Re-work (2026-10-15): each class hunting the ground of its level -- kills, coins and XP an hour, food, deaths, hours a weapon lasts; flags classes outside +-15% of the level's average; writes `classes.csv` |

Assumptions (also in the report's Method section): Berserker on Accurate unless stated; Attack,
Defence and Ranged at the same level and Hitpoints equal to it (generous -- real Hitpoints lags);
armour and sword matched to level (bronze, iron 10, steel 20, mithril 30); companion boosts and
gear XP bonuses left out of gathering rates.

Known false positives in `materials.js`: farm tools (rake, hoe, watering can), fragments (used by
"combine") and the plant pot are used by actions rather than recipes.
