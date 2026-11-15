"""How alike NeuroPets is to other games (2026-10-18 audit). Each feature is scored 0 (absent), 0.5 (partly / a lighter
version) or 1 (alike) for NeuroPets and each game. A game's similarity is 100 x (1 - the average gap), over every feature:
a feature both lack counts as alike, so the number reads "how close the two designs are", not "how big". The team's
scores, from the sources at the back of the report and play knowledge; the method is in the report so anyone can rescore.
"""
GAMES = ["RPG MO", "RuneScape 3", "Old School RS", "Melvor Idle", "Neopets", "Kingdom of Loathing", "IdleOn", "Idle Clans", "FarmVille"]
#  feature                                         NP   RPGMO RS3  OSRS Melvor Neo  KoL  IdleOn IClans FarmV
FEATURES = [
 ("Skills", [
  ("Many trainable skills (20+)",                    1,   0.5,  1,   1,   1,   0,   0,   0.5,  1,   0),
  ("Gathering skills (mine, fish, chop, forage)",    1,   1,    1,   1,   1,   0,   0,   1,    1,   0.5),
  ("Making skills (smith, cook, craft, fletch)",     1,   1,    1,   1,   1,   0.5, 0.5, 1,    1,   0.5),
  ("Tool tiers (bronze to rune)",                    1,   1,    1,   1,   1,   0,   0,   0.5,  1,   0),
  ("Runecrafting / magic from runes",                1,   0.5,  1,   1,   1,   0,   0,   0,    0,   0),
  ("Farming and crops",                              1,   1,    1,   1,   1,   0,   0,   0.5,  1,   1),
  ("Livestock / husbandry",                          1,   0.5,  1,   0.5, 0,   0,   0,   0.5,  0,   1),
  ("Construction / a house you build",               1,   1,    1,   1,   0,   0.5, 0.5, 0.5,  0.5, 1),
  ("Thieving / larceny",                             1,   0,    1,   1,   1,   0,   0,   0,    1,   0),
  ("XP curve to a high cap",                         1,   1,    1,   1,   1,   0,   0.5, 1,    1,   0.5),
 ]),
 ("Combat", [
  ("Classes you choose",                             1,   0,    0.5, 0,   0,   0,   1,   1,    0,   0),
  ("Talent trees",                                   1,   0,    0.5, 0,   0.5, 0,   1,   1,    0,   0),
  ("Melee, ranged and magic styles",                 1,   1,    1,   1,   1,   0.5, 1,   1,    1,   0),
  ("Necromancy / raising the dead",                  1,   0,    1,   0,   0,   0,   0,   0,    0,   0),
  ("Round-by-round battles you watch",               1,   1,    0.5, 0.5, 1,   1,   1,   0.5,  1,   0),
  ("Idle hunting (fights run while away)",           1,   0,    0,   0,   1,   0,   0,   1,    1,   0),
  ("Bosses with unique drops",                       1,   1,    1,   1,   1,   0.5, 1,   1,    1,   0),
  ("Specials / abilities in a fight",                1,   0.5,  1,   1,   1,   1,   1,   1,    0.5, 0),
  ("Food and potions in combat",                     1,   1,    1,   1,   1,   1,   1,   1,    1,   0),
  ("Gear slots you equip, worn on your figure",      1,   1,    1,   1,   0.5, 0.5, 1,   1,    0.5, 0),
  ("A bestiary / monster knowledge",                 1,   0,    1,   0.5, 1,   0,   0.5, 0.5,  0.5, 0),
  ("Slayer-style tracking of one creature",          1,   0,    1,   1,   1,   0,   0,   0,    0,   0),
  ("Duels / ranked mage tower",                      1,   0.5,  0.5, 0.5, 0,   1,   0.5, 0,    0,   0),
 ]),
 ("Pets", [
  ("Collect pets",                                   1,   1,    1,   1,   1,   1,   1,   1,    1,   0.5),
  ("Pets have needs (feed, play, clean)",            1,   0,    0,   0,   0,   1,   0,   0,    0,   0),
  ("Pets grow and age",                              1,   0,    0,   0,   0,   0.5, 0.5, 0,    0,   0),
  ("Hatching eggs",                                  1,   1,    0,   0,   0,   0.5, 0,   1,    0,   0.5),
  ("Breeding pets",                                  1,   1,    0,   0,   0,   0,   0,   1,    0,   0),
  ("Pets that fight (battle pets, moves, types)",    1,   0.5,  0.5, 0,   0,   1,   0.5, 1,    0,   0),
  ("Pets that work / boost skills",                  1,   0.5,  0.5, 0.5, 1,   0,   1,   1,    0.5, 0),
  ("Pet colours / looks (petpets, paint)",           1,   0.5,  0,   0,   0,   1,   0,   0,    0,   0),
  ("Pet expeditions",                                1,   0,    0,   0,   0,   0,   0.5, 0.5,  0,   0),
 ]),
 ("World", [
  ("A painted map with regions",                     1,   1,    1,   1,   0,   1,   1,   1,    0.5, 0),
  ("Islands reached by ship",                        1,   1,    1,   1,   0,   1,   0.5, 0,    0,   0),
  ("Quests with people in places",                   1,   1,    1,   1,   0,   0.5, 1,   1,    0.5, 0.5),
  ("A main story in chapters",                       1,   0.5,  1,   1,   0,   0.5, 1,   0.5,  0,   0),
  ("Hidden secrets / exploration",                   1,   0.5,  1,   1,   0,   1,   1,   0.5,  0,   0),
  ("Dungeons (the Pyramid, the crypt)",              1,   1,    1,   1,   0.5, 0.5, 1,   1,    0.5, 0),
  ("Day and night",                                  1,   0,    0,   0,   0,   0.5, 0.5, 0,    0,   0),
  ("Tutorial guide with a character",                1,   0.5,  1,   1,   0.5, 0.5, 0.5, 1,    1,   1),
 ]),
 ("Economy", [
  ("Coins from selling what you make",               1,   1,    1,   1,   1,   1,   1,   1,    1,   1),
  ("NPC shops with stock",                           1,   1,    1,   1,   1,   1,   1,   1,    1,   1),
  ("A bank / store room",                            1,   1,    1,   1,   1,   1,   0.5, 1,    1,   0),
  ("Player-to-player trading / market",              0,   1,    1,   1,   0,   1,   1,   0.5,  1,   0.5),
  ("Recycling / salvage",                            1,   0,    1,   0.5, 0,   0,   0.5, 0,    0,   0),
  ("Tool wear and repairs",                          1,   0,    0.5, 0.5, 0,   0,   0,   0,    0,   0),
 ]),
 ("Idle and time", [
  ("Progress while offline / app closed",            1,   0,    0,   0,   1,   0.5, 0,   1,    1,   1),
  ("Timed growth (crops, hatching, eggs)",           1,   0.5,  1,   1,   1,   0.5, 0,   1,    1,   1),
  ("Daily limits / energy",                          0,   0,    0,   0,   0,   1,   1,   0,    0,   1),
  ("Active play is faster than idle",                1,   1,    1,   1,   0.5, 0,   0,   1,    0.5, 0),
 ]),
 ("Social and platform", [
  ("Multiplayer world (other players around you)",   0,   1,    1,   1,   0,   0.5, 0.5, 0.5,  0.5, 0.5),
  ("Clans / guilds",                                 0,   1,    1,   1,   0,   1,   1,   1,    1,   0.5),
  ("PvP",                                            0,   1,    1,   1,   0,   1,   1,   0,    0,   0),
  ("Real-money shop / premium currency",             0,   1,    1,   1,   0,   1,   1,   1,    1,   1),
  ("Runs in a browser",                              0.5, 1,    0.5, 0.5, 1,   1,   1,   0.5,  0.5, 1),
  ("Single-player, no account, works offline",       1,   0,    0,   0,   0.5, 0,   0,   0,    0,   0),
  ("Mods / modding built in",                        1,   0,    0,   0,   1,   0,   0,   0,    0,   0),
  ("Save slots and game modes (NG+, hardcore)",      1,   0,    0.5, 1,   1,   0,   0.5, 0,    0.5, 0),
 ]),
 ("Look and feel", [
  ("Hand-painted art",                               1,   0,    1,   0,   0.5, 1,   0,   0.5,  0.5, 1),
  ("Pixel art",                                      0.5, 1,    0,   0.5, 0.5, 0,   0,   1,    0.5, 0),
  ("Menu-driven (no walking avatar)",                1,   0,    0,   0,   1,   1,   1,   0.5,  1,   0),
  ("Tile grid world you walk",                       0.5, 1,    1,   1,   0,   0,   0,   0.5,  0,   1),
  ("Cozy / humorous tone",                           1,   0.5,  0.5, 0.5, 0.5, 1,   1,   1,    0.5, 1),
 ]),
]

SOURCES = [
 ("RPG MO: 18 skills, 285+ pets you can breed, 37 worlds, guild wars", "https://www.gamingonlinux.com/2017/10/rpg-mo-is-a-rather-retro-free-to-play-mmo-that-has-linux-support"),
 ("RuneScape 3: 29 skills, Necromancy the 29th, Archaeology", "https://runescape.wiki/w/Skills"),
 ("RuneScape 3: Necromancy", "https://runescape.wiki/w/Necromancy_training"),
 ("Old School RuneScape: skills and their groups", "https://oldschool.runescape.wiki/w/Skills"),
 ("Melvor Idle: 8 combat and 15 non-combat skills, 40+ pets, offline progress", "https://www.gamingonlinux.com/2021/06/melvor-idle-is-probably-one-of-the-best-idle-games-around/page=1/"),
 ("Melvor Idle (store page)", "https://www.moddb.com/games/melvor-idle"),
 ("Neopets: virtual pets, Neopoints, lands, Battledome, shops, trading", "https://en.wikipedia.org/wiki/Neopets"),
 ("Neopets: how it works", "https://electronics.howstuffworks.com/neopet.htm"),
 ("Kingdom of Loathing: 40 adventures a day, six classes, 100+ familiars", "https://massivelyop.com/2021/10/09/the-game-archaeologist-kingdom-of-loathing/"),
 ("Kingdom of Loathing (Giant Bomb)", "https://www.giantbomb.com/games/3030-34916/"),
 ("Legends of IdleOn: classes, 12 skills, pet battles, offline grinding", "https://idleon.wiki/wiki/Class"),
 ("Legends of IdleOn (Notebookcheck)", "https://www.notebookcheck.net/New-free-to-play-MMORPG-is-now-trending-on-Steam-and-it-features-offline-progression-with-Very-Positive-reviews.1191930.0.html"),
 ("Idle Clans: 21 skills, clans, 12-hour offline progress", "https://wiki.idleclans.com/index.php/Getting_started"),
 ("FarmVille: crops, livestock, neighbours, Farm Cash", "https://tvtropes.org/pmwiki/pmwiki.php/Videogame/FarmVille"),
 ("FarmVille (The Globe and Mail)", "https://www.theglobeandmail.com/life/old-macdonalds-virtual-farm/article1202289"),
]


def flat():
    return [(cat, name, row[0], row[1:]) for cat, rows in FEATURES for name, *row in rows]


def similarity():
    """{game: percent} overall, and {category: {game: percent}}."""
    rows = flat()
    overall = {g: round(100 * (1 - sum(abs(np - s[i]) for _, _, np, s in rows) / len(rows)), 1) for i, g in enumerate(GAMES)}
    cats = {}
    for cat, _ in FEATURES:
        rs = [r for r in rows if r[0] == cat]
        cats[cat] = {g: round(100 * (1 - sum(abs(np - s[i]) for _, _, np, s in rs) / len(rs)), 1) for i, g in enumerate(GAMES)}
    return overall, cats


def shared():
    """Of NeuroPets' own features, the share each game also has (score-weighted)."""
    rows = [r for r in flat() if r[2] > 0]
    return {g: round(100 * sum(min(np, s[i]) for _, _, np, s in rows) / sum(np for _, _, np, _ in rows), 1) for i, g in enumerate(GAMES)}


def unique():
    """NeuroPets features no listed game has in full."""
    return [(cat, name) for cat, name, np, s in flat() if np >= 1 and max(s) < 1]


if __name__ == "__main__":
    o, c = similarity()
    print(len(flat()), "features"); print(o); print(shared()); print(unique())
