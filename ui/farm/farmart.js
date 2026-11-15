/* ==========================================================================
   NeuroFarm -- its own pictures (2026-10-07).
   ==========================================================================
   Most crops and fruit are NeuroPets' (ui/pet/petart.js -- carrots, potatoes,
   pumpkins, apples ...). These are the farm's own: wheat, the kitchen's
   dishes, sprouts, the trees, the tonics, the silo. Drawn with PetArt.draw,
   in the same 16x16 pixel style. o outline, a main, h highlight, d dark,
   x detail, g leaf, s stem.
   ========================================================================== */
var FarmArt = (function () {
  "use strict";
  var INK = "#3a2a24";
  var S = {
    wheat: ["................", "......x..x......", ".....xax.xax....", ".....xax.xax..x.", "......xa.xa..xax", "...x..ga.ga..xax",
            "..xax.g...g...xa", "..xax.g...g...g.", "...xa.g...g..g..", "....g.g...g.g...", ".....gg...gg....", "......g..g......",
            ".......gg.......", ".......gg.......", ".......gg.......", "................"],
    sprout: ["................", "................", "................", "................", "................", "................",
             "................", "................", "......g..g......", ".....ggg.gg.....", "......g.g.......", ".......g........",
             ".......g........", "......sss.......", "................", "................"],
    seedling: ["................", "................", "................", "................", ".....gg..gg.....", "....gggg.ggg....",
               "...gghgg.gghg...", "....gggg.ggg....", ".....ggg.gg.....", "......g.gg......", ".......gg.......", ".......g........",
               ".......g........", "......sss.......", "................", "................"],
    loaf: ["................", "................", "................", "................", "....oooooooo....", "...oahahahaao...",
           "..oahhahhahhao..", "..oaaaaaaaaaao..", "..oaaaaaaaaaao..", "..odaaaaaaaado..", "...odddddddddo..", "....oooooooo....",
           "................", "................", "................", "................"],
    jar: ["................", "................", ".....oooooo.....", ".....oxxxxo.....", "....oooooooo....", "...oahhaaaaao...",
          "...oahaaaaaao...", "...oaaaaaaaao...", "...oaaxxxxaao...", "...oaaxxxxaao...", "...oaaaaaaaao...", "...odaaaaaado...",
          "....odddddo.....", ".....oooooo.....", "................", "................"],
    pie: ["................", "................", "................", "................", "................", "....oooooooo....",
          "...ohhxhhxhhho..", "..ohaaxaaxaaaho.", "..oaaaxaaxaaaao.", "..oxxxxxxxxxxxo.", ".odddddddddddddo", "..oddddddddddo..",
          "...oooooooooo...", "................", "................", "................"],
    bowl: ["................", "................", "................", "................", "................", "....xx.xx.xx....",
           "..oooooooooooo..", "..oaahaaxaaaao..", "...oaaaaaaaao...", "...oddddddddo...", "....odddddddo...", ".....oooooo.....",
           "................", "................", "................", "................"],
    flask: ["................", "......oooo......", "......oxxo......", "......oxxo......", ".....oaaaao.....", "....oahaaaao....",
            "...oahaaaaaao...", "...oaaaaaaaao...", "...oaaaaaaaao...", "...odaaaaaado...", "....oddddddo....", ".....oooooo.....",
            "................", "................", "................", "................"],
    silo: ["......oooo......", ".....ohhhho.....", "....ohaaaaho....", "....oaaaaaao....", "....oddddddo....", "....oaaaaaao....",
           "....oaaaaaao....", "....oddddddo....", "....oaaaaaao....", "....oaaaaaao....", "....oddddddo....", "....oaaxxaao....",
           "....oaaxxaao....", "....oaaxxaao....", "...oooooooooo...", "................"],
    stove: ["................", "...oooooooooo...", "...oxxxoxxxxo...", "...oooooooooo...", "...oaaaaaaaao...", "...oahhhhhhao...",
            "...oaodddodao...", "...oaodxxodao...", "...oaoddddoao...", "...oaooooooao...", "...oaaaaaaaao...", "...oddddddddo...",
            "...oooooooooo...", "...oo......oo...", "................", "................"],
    // part 2 (2026-10-07): what animals give, and what the dairy and sewing room make
    egg: ["................", "................", "................", "......oooo......", ".....ohaaao.....", "....ohaaaaao....",
          "....ohaaaaao....", "...oaaaaaaaao...", "...oaaaaaaaao...", "...oaaaaaaado...", "...oaaaaaaado...", "....oaaaaddo....",
          ".....odddoo.....", "......oooo......", "................", "................"],
    bottle: ["................", "......oooo......", "......oxxo......", "......oooo......", ".....ohaao......", ".....ohaao......",
             "....ohaaaao.....", "....ohaaaao.....", "....oaxxxao.....", "....oaxxxao.....", "....oaaaaao.....", "....oaaaado.....",
             "....oaaaado.....", ".....ooooo......", "................", "................"],
    block: ["................", "................", "................", "................", "................", "....oooooooo....",
            "...ohhhhhhhho...", "..ohhhhhhhhao...", "..oooooooooaao..", "..oaaaaaaaoaao..", "..oaaxxaaaoaao..", "..oaaaaaaaoao...",
            "..oddddddddo....", "..oooooooooo....", "................", "................"],
    wedge: ["................", "................", "................", "................", "............oo..", ".........oooho..",
            "......oooahhho..", "...oooaaaahhao..", "..ohhhhhhhhaao..", "..oaaxaaaaaaao..", "..oaaaaaxaaaao..", "..oaxaaaaaaxao..",
            "..oaaaaxaaaado..", "..oddddddddddo..", "..oooooooooooo..", "................"],
    cup: ["................", "................", "................", "................", "....xx.x........", "..oooooooooooo..",
          "..oxxxxxxxxxxo..", "..ohaaaaaaaaao..", "...ohaaaaaaao...", "...oaaaaaaaao...", "...oaaaaaaaao...", "....oaaaaaao....",
          "....odddddddo...", ".....ooooooo....", "................", "................"],
    cone: ["................", ".....oooooo.....", "....ohhaaaao....", "...ohaaaaaaao...", "...oaaaaaaaao...", "...oaaaaaaado...",
           "...oddddddddo...", "....oxxxxxxo....", "....oxdxxdxo....", ".....oxxxxo.....", ".....oxdxxo.....", "......oxxo......",
           "......oxxo......", ".......oo.......", "................", "................"],
    plate: ["................", "................", "................", "................", "................", "......ooooo.....",
            "....ooaahaaoo...", "...oaahhaaxaao..", "..oaaaaaaxaaaao.", ".oooooooooooooo.", "owwwwwwwwwwwwwwo", ".oddddddddddddo.",
            "..oooooooooooo..", "................", "................", "................"],
    cake: ["................", "................", "......x.........", ".....xxx........", "...ooooooooo....", "..ohhhhhhhhho...",
           "..oxxhxxhxxhho..", "..oaaaaaaaaaao..", "..oaaaaaaaaaao..", "..oxxxxxxxxxxo..", "..oaaaaaaaaaao..", "..oaaaaaaaaado..",
           "..oddddddddddo..", ".oooooooooooooo.", "................", "................"],
    skein: ["................", "................", "................", ".....oooooo.....", "...ooahahahoo...", "..oahahahahaho..",
            "..ohahahahahao..", ".oahahahahahaho.", ".ohahahahahahao.", ".oahahahahahaho.", "..ohahahahahao..", "..oahahahahaho..",
            "...oodhdhdhoo...", ".....oooooo..x..", "............x...", "...........x...."],
    shirt: ["................", "................", "....ooo..ooo....", "..oooaaooaaooo..", ".oaaaaaxxaaaaao.", "oaaaaaaaaaaaaaao",
            "oaaoaaaaaaaaoaao", "oaaoaaaaaaaaoaao", "ooooaaaaaaaaoooo", "...oaaaaaaaao...", "...oaaaaaaaao...", "...ohhhhhhhho...",
            "...oaaaaaaaao...", "...oooooooooo...", "................", "................"],
    folded: ["................", "................", "................", "..oooooooooooo..", ".ohhhhhhhhhhhhho", ".oaxaaxaaxaaxaao", ".oaaaaaaaaaaaaao",
             ".oooooooooooooo.", ".ohhhhhhhhhhhhho", ".oaaxaaxaaxaaxao", ".oaaaaaaaaaaaaao", ".oooooooooooooo.", ".oddddddddddddo.",
             ".oaxaaxaaxaaxaao", ".oooooooooooooo.", "................"],
    coin: ["................", "................", "................", ".....oooooo.....", "....ohhhaaao....", "...ohhaaaaado...",
           "...ohaaxxaado...", "...ohaxaaaado...", "...oaaxaaaado...", "...oaaaxxaado...", "...oaaaaaaddo...", "....oadddddo....",
           ".....oooooo.....", "................", "................", "................"],
    round: ["................", ".......gg.......", "......gsgg......", "....oooooooo....", "...ohhaaaaaao...", "..ohhaaaaaaaao..", "..ohaaaaaaaaao..", "..oaaaaaaaaaao..", "..oaaaaaaaaaao..", "..oaaaaaaaaado..", "..oaaaaaaaaado..", "...oaaaaaaddo...", "....oaadddo.....", ".....oooooo.....", "................", "................"],
    bulb: ["......g..g......", "......g.gg......", ".......gg.......", "......oxxo......", "....ohhaaaao....", "...ohaaaaaaao...", "..ohaaaaaaaaao..", "..ohaaaaaaaaao..", "..oaaaaaaaaaao..", "..oaaaaaaaaado..", "...oaaaaaaado...", "....oaaaaddo....", ".....oaado......", "......oxo.......", ".......x........", "................"],
    leafy: ["................", "................", ".....oo..oo.....", "...oohhoohhoo...", "..ohhaahhaahho..", ".ohaahaaaahaaho.", ".oaahaaggaahaao.", "oaahaaggggaahaao", "oahaagggggaahao.", ".oaaaggggggaaao.", ".oaaaaggggaaaao.", "..oaaaaaaaaaao..", "...odddddddddo..", "....oooooooooo..", "................", "................"],
    pod: ["................", "..........ggg...", ".........ggo....", "........ohao....", ".......ohaao....", "......ohaaao....", ".....ohaaado....", "....ohaaado.....", "...ohaaaddo.....", "..ohaaaddo......", "..oaaaddo.......", "..oaddoo........", "...ooo..........", "................", "................", "................"],
    flower: ["................", "....x..x..x.....", "...xax.xax.xax..", "..xaaaxaaaxaax..", "..xaaoooooaax...", ".xaaoddddddoaax.", "..xaodhddhdoax..", "..xaoddddddoaax.", ".xaaoddhdddoax..", "..xaaoooooaax...", "...xaaxaaaxax...", "....x..gx..x....", "......ggg.......", "......ggg.......", "........g.......", "........g......."],
    bunch: ["........gg......", ".......gs.......", "...oo.osoo......", "..ohaoohaao.....", "..oaaooaaaoo....", "..ooohaoohao....", ".ohaoaaooaao....", ".oaaoooohaoo....", "..oohaooaaoo....", "...oaaoohaoo....", "....oooaaao.....", ".....ohaoo......", ".....oaao.......", "......oo........", "................", "................"],
    cane: ["......g...g.....", ".....gg..gg.....", "....g.g.g..g....", "......o...o.....", ".....oho.oho....", ".....oao.oao....", ".....odo.odo....", ".....oxo.oxo....", ".....oho.oho....", ".....oao.oao....", ".....odo.odo....", ".....oxo.oxo....", ".....oho.oho....", ".....oao.oao....", ".....ooo.ooo....", "................"],
    beans: ["................", "................", "................", "...oooo.........", "..ohaaao..oooo..", "..oaxaao.ohaaao.", "..oaxaao.oaxaao.", "..oaxado.oaxaao.", "...oooo..oaxado.", "....oooo..oooo..", "...ohaaao.......", "...oaxaao.......", "...oaxado.......", "....oooo........", "................", "................"],
    cocoapod: ["................", "......ss........", ".....oooo.......", "....ohaaao......", "...ohaxaaao.....", "...oaaxaaao.....", "..ohaaxaaaao....", "..oaaaxaaaao....", "..oaaaxaaado....", "..oaaaxaaado....", "...oaaxaado.....", "...oaaxaado.....", "....oaxado......", ".....oooo.......", "................", "................"],
    pineapple: ["......g.g.......", ".....ggggg......", "....gg.g.gg.....", "......ggg.......", ".....oooooo.....", "....ohaxaxao....", "...ohxaxaxado...", "...oaxaxaxaxo...", "...oxaxaxaxao...", "...oaxaxaxaxo...", "...oxaxaxaxdo...", "...oaxaxaxado...", "....oxaxaddo....", ".....oooooo.....", "................", "................"],
    cherries: ["..........g.....", ".........ggg....", "........s.......", "......ss.s......", ".....s....s.....", "....s......s....", "..oooo....oooo..", ".ohhaao..ohhaao.", ".ohaaao..ohaaao.", ".oaaaao..oaaaao.", ".oaaado..oaaado.", "..oddo....oddo..", "...oo......oo...", "................", "................", "................"],
    sack: ["................", "......oooo......", ".....oxxxxo.....", "......oxxo......", ".....ohaaao.....", "....ohaaaaao....", "...ohaaaaaaao...", "...oaaaaaaaao...", "..oaaaaaaaaaao..", "..oaadddaaaaao..", "..oaaddddaaado..", "..oaaaaaaaaado..", "...oaaaaaaado...", "....ooooooooo...", "................", "................"],
    glass: ["................", "................", "....oooooooo....", "....o......o....", "....oxxxxxxo....", "....ohaaaaao....", "....ohaaaaao....", "....oaaaaaao....", "....oaaaaaao....", "....oaaaaado....", ".....oaaaao.....", ".....oaaado.....", ".....oooooo.....", "................", "................", "................"],
    mug: ["................", "................", "................", "...oooooooo.....", "...oxxxxxxo.....", "...ohaaaaaoooo..", "...ohaaaaaoaao..", "...oaaaaaao.ao..", "...oaaaaaao.ao..", "...oaaaaaaoaao..", "...oaaaaaaooo...", "...oddddddo.....", "....oooooo......", "................", "................", "................"],
    bar: ["................", "................", "................", "..oooooooooooo..", "..ohhohhohhoho..", "..ohaohaohaoao..", "..oooooooooooo..", "..ohaohaohaoao..", "..oaaoaaoaaoao..", "..oooooooooooo..", "..oxxxxxxxxxxo..", "..oxxxwwxxxxxo..", "..oxxxxxxxxxxo..", "..oooooooooooo..", "................", "................"],
    pizza: ["................", "................", "....oooooooo....", "...oddddddddo...", "..oddhhhhhhddo..", ".odhaxaaaaxahdo.", ".odhaaawaaaahdo.", ".odhaaaaaaxahdo.", ".odhxaawaaaahdo.", ".odhaaaaxaaahdo.", "..odhaaaaaahdo..", "...oddhhhhddo...", "....oddddddo....", ".....oooooo.....", "................", "................"],
    bolt: ["................", "................", "................", "................", "...oooooooo.....", "..ohhhhhhhho....",
           ".ohaaaaaaaaho...", ".oaaaaaaaaaao...", ".oaaaaaaaaaao...", ".odaaaaaaaado...", "..oddddddddoooo.", "...ooooooooaaao.",
           "..........oaaao.", "...........oooo.", "................", "................"]
  };
  // a tree, 32x32 (2x2 tiles): a canopy, a trunk, and its fruit (f) when ready
  var TREE = [
    "................................", "..........gggggggggg............", "........gggggggggggggg..........", "......gggghgggggggggggg.........",
    ".....gggghhggfgggggggfggg.......", "....ggghhgggggggggggggggggg.....", "...gggggggggggfggggggggggggg....", "...ggggggfgggggggggggfggggggg...",
    "..ggggggggggggggggggggggggggg...", "..gggggggggggggggggfgggggggggg..", "..gggfgggggggggggggggggggggggg..", "..ggggggggggggfgggggggggfgggg...",
    "...ggggggggggggggggggggggggggg..", "...gggggggfggggggggggggggggg....", "....ggggggggggggggggfgggggg.....", ".....gggggggggggggggggggggg.....",
    "......gggggggsssgggggggg........", "........ggggsssssgggg...........", "............sssss...............", "............sssss...............",
    "............sssss...............", "............sssss...............", "...........ssssss...............", "...........ssssss...............",
    "..........sssssss...............", "..........sssssss...............", ".........sssssssss..............", "........sss.sssss.sss...........",
    "................................", "................................", "................................", "................................"];
  var ITEMS = {
    wheat: ["wheat", { a: "#e8c860", x: "#c8962a", g: "#9aa040" }],
    bread: ["loaf", { a: "#d8963a", h: "#f2c070", d: "#9a5a22" }],
    strawberryjam: ["jar", { a: "#d83a4a", h: "#f08a90", d: "#8a1a24", x: "#f2ece0" }],
    applepie: ["pie", { a: "#e8b060", h: "#f8d8a0", d: "#a8743a", x: "#c84a3a" }],
    melonsorbet: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#f08a9a" }],
    fruitsalad: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#f2c43c" }],
    growtonic: ["flask", { a: "#5fbf5a", h: "#c8f0a8", d: "#2f7a2a", x: "#a8743a" }],
    freshtonic: ["flask", { a: "#5ab8e0", h: "#c8f0ff", d: "#2a6a9a", x: "#a8743a" }],
    sprout: ["sprout", { g: "#7cc06a", s: "#8a5a32" }],
    seedling: ["seedling", { g: "#5fa84a", h: "#9ad07a", s: "#8a5a32" }],
    silo: ["silo", { a: "#c8ccd4", h: "#f2f4f8", d: "#8a9098", x: "#8a3a2a" }],
    kitchen: ["stove", { a: "#c0503a", h: "#e88a6a", d: "#7a2a1e", x: "#f2c43c" }],
    egg: ["egg", { a: "#f4e8d4", h: "#ffffff", d: "#d8c4a4" }],
    milk: ["bottle", { a: "#f6f6f2", h: "#ffffff", d: "#cfd4d8", x: "#5a9ad8" }],
    goatmilk: ["bottle", { a: "#f2eedc", h: "#ffffff", d: "#cfc8b0", x: "#8aa84a" }],
    butter: ["block", { a: "#f6dc70", h: "#fff2b0", d: "#c8a83a", x: "#e8c050" }],
    cheese: ["wedge", { a: "#f2c43c", h: "#fae08a", d: "#c8962a", x: "#c8962a" }],
    goatcheese: ["wedge", { a: "#f2ece0", h: "#ffffff", d: "#c8c0ac", x: "#d8d0bc" }],
    yoghurt: ["cup", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#e05a6a" }],
    icecream: ["cone", { a: "#f6b0b8", h: "#fde0e4", d: "#d07888", x: "#d8a050" }],
    omelette: ["plate", { a: "#f2d040", h: "#fae890", x: "#5fa84a", w: "#f2f4f8", d: "#a8b0b8" }],
    pancakes: ["plate", { a: "#d8a050", h: "#f6dc70", x: "#8a4a20", w: "#f2f4f8", d: "#a8b0b8" }],
    quiche: ["pie", { a: "#e8c060", h: "#f8e0a0", d: "#a8743a", x: "#f2c43c" }],
    cake: ["cake", { a: "#f6e0d0", h: "#ffffff", d: "#c8a890", x: "#e04a5a" }],
    yarn: ["skein", { a: "#e8e0d0", h: "#ffffff", d: "#b8ac98", x: "#8a7a64" }],
    sweater: ["shirt", { a: "#c04a4a", h: "#e88080", x: "#8a2a2a" }],
    linenshirt: ["shirt", { a: "#e8e0c8", h: "#ffffff", x: "#b8ac90" }],
    blanket: ["folded", { a: "#5a7ac8", h: "#8aa8e8", d: "#3a5a9a", x: "#f2ece0" }],
    quilt: ["folded", { a: "#e07a5a", h: "#f2c43c", d: "#5a9a6a", x: "#5a7ac8" }],
    linen: ["bolt", { a: "#e0d6b8", h: "#f6f0dc", d: "#b0a480" }],
    cloth: ["bolt", { a: "#f2f2ee", h: "#ffffff", d: "#c4c8cc" }],
    tomato: ["round", { a: "#e0402e", h: "#f08a7a", d: "#a82a1e", g: "#5fa84a", s: "#3f7a2a" }],
    onion: ["bulb", { a: "#d8a050", h: "#f0c888", d: "#a8743a", g: "#7cc06a", x: "#8a5a32" }],
    beetroot: ["bulb", { a: "#8a1e48", h: "#c04a78", d: "#5a0e2e", g: "#5fa84a", x: "#5a0e2e" }],
    lettuce: ["leafy", { a: "#8ad06a", h: "#c8f0a8", d: "#4f8a37", g: "#e8f8c8" }],
    cucumber: ["pod", { a: "#4f9a3a", h: "#8ad06a", d: "#2f6a22", g: "#e8d040" }],
    chilli: ["pod", { a: "#e0302a", h: "#f88070", d: "#901a14", g: "#4f8a37" }],
    sunflower: ["flower", { a: "#f2c43c", x: "#c8902a", d: "#6a4428", h: "#8a5a32", g: "#5fa84a" }],
    rice: ["wheat", { a: "#f2ece0", x: "#c8b890", g: "#9aa040" }],
    grapes: ["bunch", { a: "#7a3aa8", h: "#b07ad8", g: "#5fa84a", s: "#7a4a2a" }],
    sugarcane: ["cane", { a: "#a8c860", h: "#d8f0a0", d: "#7a9a3a", x: "#5a6a2a", g: "#5fa84a" }],
    coffeebean: ["beans", { a: "#6a3e22", h: "#9a6a42", d: "#3e2212", x: "#2a160a" }],
    cocoa: ["cocoapod", { a: "#c87a2a", h: "#f0b060", d: "#8a4a14", x: "#a85a1a", s: "#5a8a3a" }],
    pineapple: ["pineapple", { a: "#e8b830", h: "#f8e080", d: "#a87a1a", x: "#a87a1a", g: "#4f9a3a" }],
    cherry: ["cherries", { a: "#c8202e", h: "#f08080", d: "#801018", g: "#5fa84a", s: "#5a8a3a" }],
    orange: ["round", { a: "#f2902a", h: "#f8c070", d: "#c0601a", g: "#5fa84a", s: "#3f7a2a" }],
    lemon: ["round", { a: "#f2e040", h: "#fff4a0", d: "#c0a820", g: "#5fa84a", s: "#3f7a2a" }],
    peach: ["round", { a: "#f6a878", h: "#ffd8b8", d: "#d8706a", g: "#5fa84a", s: "#3f7a2a" }],
    coconut: ["round", { a: "#8a5a32", h: "#b0845a", d: "#5a3418", g: "#8a5a32", s: "#5a3418" }],
    sugar: ["sack", { a: "#f2ece0", h: "#ffffff", d: "#c8c0b0", x: "#a8743a" }],
    orangejuice: ["glass", { a: "#f2902a", h: "#f8c070", d: "#c0601a", x: "#fff4d0" }],
    lemonade: ["glass", { a: "#f6ec8a", h: "#fffad0", d: "#d8c850", x: "#ffffff" }],
    grapejuice: ["glass", { a: "#7a2a8a", h: "#b06ac0", d: "#4a1458", x: "#e8c8f0" }],
    sunfloweroil: ["bottle", { a: "#f2c43c", h: "#fae08a", d: "#c8902a", x: "#8a5a32" }],
    coconutmilk: ["bottle", { a: "#f6f2ea", h: "#ffffff", d: "#d0c8b8", x: "#8a5a32" }],
    coffee: ["mug", { a: "#6a3e22", h: "#9a6a42", d: "#3e2212", x: "#f2ece0" }],
    mocha: ["mug", { a: "#8a5a3a", h: "#c09070", d: "#5a3418", x: "#fff4e0" }],
    chocolate: ["bar", { a: "#6a3a22", h: "#9a6040", x: "#c8402e", w: "#f2c43c" }],
    tomatosoup: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#e0402e" }],
    borscht: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#a01e50" }],
    chillistew: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#c0401e" }],
    salad: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#7cc06a" }],
    friedrice: ["bowl", { a: "#f2ece0", h: "#ffffff", d: "#c8b8a0", x: "#f2d870" }],
    cherrypie: ["pie", { a: "#e8b060", h: "#f8d8a0", d: "#a8743a", x: "#c8202e" }],
    lemontart: ["pie", { a: "#f2e070", h: "#fff4a0", d: "#c8a040", x: "#f6ec8a" }],
    peachcobbler: ["pie", { a: "#e8a060", h: "#f8c8a0", d: "#a8643a", x: "#f6a878" }],
    pickles: ["jar", { a: "#7aa04a", h: "#b8d08a", d: "#4a6a2a", x: "#f2ece0" }],
    pizza: ["pizza", { a: "#f2c050", h: "#f8e0a0", d: "#c88a3a", x: "#c8302a", w: "#5fa84a" }],
    pineapplecake: ["cake", { a: "#f6d870", h: "#fff4c0", d: "#c8a040", x: "#e8b830" }],
    instanttonic: ["flask", { a: "#f2c43c", h: "#fff4a0", d: "#c8902a", x: "#a8743a" }],
    mill: ["sack", { a: "#e8d8b0", h: "#fff4d8", d: "#b8a478", x: "#8a5a32" }],
    coin: ["coin", { a: "#f2c43c", h: "#fff0a0", d: "#c8902a", x: "#a8741a" }],
    dairy: ["bottle", { a: "#f6f6f2", h: "#ffffff", d: "#cfd4d8", x: "#5a9ad8" }],
    loom: ["skein", { a: "#c86a8a", h: "#f0a8c0", d: "#8a3a5a", x: "#8a7a64" }]
  };
  var FRUIT = { apple: "#e04040", pear: "#c8d040", mango: "#f2a03c", banana: "#f2e04a", goldapple: "#f2c43c",
                cherry: "#c8202e", orange: "#f2902a", lemon: "#f2e040", peach: "#f6a878", coconut: "#8a5a32" };
  var BORROW = { wood: "oak" };                                // NeuroPets' log stands in for wood
  function item(id) {
    if (BORROW[id] && typeof PetArt !== "undefined") return PetArt.itemArt(BORROW[id]);
    var a = ITEMS[id];
    if (!a) return null;
    var pal = { o: INK };
    for (var k in a[1]) pal[k] = a[1][k];
    return { rows: S[a[0]], pal: pal };
  }
  // ---- buildings (part 2), drawn by rule rather than by hand: 32 x 32 ----------------------------
  function canvas(w, h) { var g = []; for (var y = 0; y < h; y++) { g.push([]); for (var x = 0; x < w; x++) g[y].push("."); } return g; }
  function fill(g, x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = c; }
  function box(g, x0, y0, x1, y1, c) { fill(g, x0, y0, x1, y1, "o"); fill(g, x0 + 1, y0 + 1, x1 - 1, y1 - 1, c); }
  function roof(g, top, bottom, x0, x1, c) {                 // a pitched roof: each row a little wider
    var mid = (x0 + x1) / 2, rows = bottom - top;
    for (var y = top; y <= bottom; y++) {
      var half = Math.round((x1 - x0) / 2 * (y - top + 1) / (rows + 1)) + 1, a = Math.floor(mid - half), b = Math.ceil(mid + half);
      fill(g, a, y, b, y, "o"); if (b - a > 1) fill(g, a + 1, y, b - 1, y, (y - top) % 3 === 2 ? "r" : c);
    }
  }
  function strip(g) { return g.map(function (r) { return r.join(""); }); }
  var BUILDINGS = {};
  (function () {
    // the barn: red, a white-trimmed door with its cross, a hay loft
    var g = canvas(32, 32);
    roof(g, 2, 12, 1, 30, "d");
    box(g, 3, 12, 28, 30, "a");
    for (var y = 14; y < 30; y += 3) fill(g, 4, y, 27, y, "b");
    box(g, 13, 5, 18, 10, "y"); fill(g, 14, 8, 17, 9, "h");
    box(g, 10, 18, 21, 30, "w"); fill(g, 11, 19, 20, 29, "a");
    for (var i = 0; i < 10; i++) { g[19 + i][11 + i] = "w"; g[19 + i][20 - i] = "w"; }
    fill(g, 0, 31, 31, 31, "o");
    BUILDINGS.barn = { rows: strip(g), pal: { a: "#c0412f", b: "#a8382a", d: "#7a2a22", r: "#5a2018", w: "#f2ece0", y: "#3a2a24", h: "#e8c860" } };
    // the coop: a little wooden house on legs, a ramp, a round door
    g = canvas(32, 32);
    roof(g, 3, 12, 2, 29, "d");
    box(g, 5, 12, 26, 25, "a");
    for (y = 14; y < 25; y += 2) fill(g, 6, y, 25, y, "b");
    box(g, 13, 16, 18, 25, "y"); fill(g, 14, 17, 17, 17, "o");
    box(g, 20, 15, 24, 19, "w");
    fill(g, 6, 26, 7, 30, "o"); fill(g, 24, 26, 25, 30, "o");
    for (i = 0; i < 6; i++) fill(g, 12 - i * 2, 26 + i, 14 - i * 2, 26 + i, "b");
    fill(g, 0, 31, 31, 31, "g");
    BUILDINGS.coop = { rows: strip(g), pal: { a: "#c89a5a", b: "#a8763a", d: "#6a8aa8", r: "#4a6a88", w: "#a8d0e8", y: "#3a2a24", g: "#5fa84a" } };
    // the shearer's shed: a lean-to, with shears on its sign
    g = canvas(32, 32);
    roof(g, 4, 12, 1, 30, "d");
    box(g, 4, 12, 27, 30, "a");
    for (y = 14; y < 30; y += 2) fill(g, 5, y, 26, y, "b");
    box(g, 12, 18, 19, 30, "y");
    box(g, 6, 15, 10, 19, "w"); box(g, 21, 15, 25, 19, "w");
    BUILDINGS.shearshed = { rows: strip(g), pal: { a: "#9a8a6a", b: "#7a6a4a", d: "#5a6a4a", r: "#3a4a2a", w: "#f2ece0", y: "#3a2a24" } };
  })();
  function building(kind) {
    var b = BUILDINGS[kind];
    if (!b) return null;
    var pal = { o: INK };
    for (var k in b.pal) pal[k] = b.pal[k];
    return { rows: b.rows, pal: pal };
  }
  /** A tree, ripe (its fruit showing) or not. */
  function tree(kind, ripe) {
    var pal = { g: "#4a9a3a", h: "#7cc06a", s: "#7a4a2a", f: ripe ? FRUIT[kind] || "#e04040" : "#4a9a3a" };
    return { rows: TREE, pal: pal };
  }
  return { item: item, tree: tree, building: building, ITEMS: ITEMS, BORROW: BORROW };
})();
// the page finds it on window
if (typeof window !== "undefined") window.FarmArt = FarmArt;
