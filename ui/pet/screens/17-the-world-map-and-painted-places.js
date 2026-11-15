  // ---- the world map (2026-10-07, Cam: "Now start work on the neopets like world navigation") --------
  // The map: every region around the village, open or locked, with how much of it you've found. Click
  // one to go there: its places (spots, hunting ground, expedition) on its own scene, its secrets, and
  // Explore -- half an hour out, and now and then something hidden turns up.
  let worldRegion = "";
  // The painted map (2026-10-09, Cam's new picture of the main island: art/worldmap.webp, 2000x1116 -- Frostpeak is an
  // island of its own now, on the sea chart). Each region is a rough outline of where it's painted (the click area,
  // the fog when locked, the glow on hover) and `label` is the middle of its painted scroll [left, right, y] -- the
  // badges sit around that. Later outlines win a click, so the small places (caves, village, tower) come last. A mod
  // pack's own map uses the same layout.
  // (2026-10-16, Cam's new map of the main island -- the estate painted in, by the Mage tower: outlines and scrolls redrawn)
  const WORLD_ART = {
    meadow: {pts: "140,430 260,410 420,400 530,420 520,500 440,540 300,540 150,520", label: [340, 500, 474]},
    pasture: {pts: "140,540 300,540 440,545 560,560 560,650 460,680 320,690 200,670 150,620", label: [258, 398, 607]},
    forest: {pts: "720,170 830,90 1000,60 1200,60 1240,140 1200,280 1100,330 950,360 800,340 720,260", label: [925, 1073, 210]},
    deepforest: {pts: "1220,100 1400,100 1600,140 1740,220 1750,340 1650,440 1500,470 1400,440 1250,330 1210,200", label: [1320, 1508, 200]},
    coast: {pts: "1420,460 1560,420 1680,400 1800,420 1840,520 1800,620 1800,720 1700,680 1560,620 1470,590", label: [1580, 1746, 564]},
    jungle: {pts: "700,780 800,740 1000,620 1200,600 1380,620 1400,700 1380,800 1300,900 1200,1000 900,1000 720,960", label: [1106, 1288, 785]},
    deepjungle: {pts: "1320,760 1450,700 1600,690 1740,720 1760,860 1700,980 1550,1040 1400,1020 1320,900", label: [1422, 1628, 932]},
    farmyard: {pts: "350,720 470,690 600,700 740,760 740,880 640,960 480,960 360,900", label: [480, 670, 857]},
    crystalcaves: {pts: "1030,410 1150,340 1260,340 1360,400 1360,560 1220,580 1080,570 1020,500", label: [1102, 1323, 547]},
    village: {pts: "600,560 640,470 760,430 900,440 1000,500 1040,600 980,700 870,720 740,710 640,680", label: [770, 970, 685]},
    magetower: {pts: "90,250 170,120 300,40 450,50 560,120 700,150 700,230 600,280 500,290 420,330 260,390 200,390 100,300", label: [503, 703, 178]},
    mistyisle: {pts: "70,940 140,850 190,820 300,870 340,960 300,1040 100,1040", label: [108, 305, 993]}};
  const WORLD_W = 2000, WORLD_H = 1116;
  // regions not on the main island's map: the other islands and the Open Sea (on the sea chart, 2026-10-09) -- and in
  // the list under the map
  const WORLD_SOON = ["frostpeak", "desert", "nile", "oasis", "sandport", "frosthaven", "opensea", "icecavern", "summit", "hollowcrypt"];   // (the Hollow Crypt: reached from the Misty Isle)
  // The sea chart (2026-10-09, Cam's picture: art/seachart.webp, 2000x1116): the islands and the sea between them. The
  // Map opens on the main island; "Sea chart" shows this. main = the main island (its map, or sail home), islands =
  // sail there (or go ashore if you're on it), regions (Open Sea, Misty Isle) = go there, shipyard = Hal's page.
  const SEA_ART = {
    main: {pts: "120,560 250,400 500,400 900,380 1300,330 1500,480 1580,700 1520,880 1430,1000 1000,1080 600,1060 350,960 150,780", label: [536, 836, 418]},
    shipyard: {pts: "1350,780 1450,700 1780,720 1800,900 1550,1000 1380,960", label: [1470, 1730, 1040], chip: "The Shipyard"},
    opensea: {pts: "700,200 1250,180 1350,260 1250,380 900,380 700,330", label: [878, 1172, 290]},
    frostpeak: {pts: "70,170 140,60 300,60 500,90 640,170 610,300 450,330 200,340 70,320", label: [239, 528, 64]},
    desert: {pts: "1380,200 1560,70 1800,60 1920,180 1900,330 1750,440 1550,440 1470,330 1380,260", label: [1572, 1808, 420]},
    mistyisle: {pts: "60,960 120,860 190,820 310,880 330,1000 290,1090 80,1080", label: [94, 298, 1025]}};
  const SEA_BLURB = {frostpeak: "Snow, pines and the Yeti's summit. Frosthaven's harbour waits with its inn and an estate for sale.",
    desert: "Sand, the Nile and the Sphinx. Sandport's market never sleeps -- and there's an estate for sale."};
  // ---- painted places (2026-10-08, Cam's pictures: "Here the areas of the map that are unlocked") ---------
  // Where each place's scroll is painted on its scene: art/places.js (window.SCENE_PLACES, moved there 2026-10-15 so
  // Developer -> Place editor can write it; the format is at its top). "//" there holds notes, not a scene.
  const SCENE_ART = Object.assign({}, window.SCENE_PLACES || {});
  delete SCENE_ART["//"];
