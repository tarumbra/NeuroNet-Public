  // ---- the How to Play book (2026-10-20) ------------------------------------------------------------------------------------
  //      Cam: "a how to play book you get after the tutorial you can read which will be a detailed stylized guide of the game and
  //      all the features including photos (also store as a pdf within the ebook section of scribe (which will also be refferenced
  //      in after the tutorial". Amunet hands it over with her farewell gifts; a save past the tutorial gets it once (migration).
  //      Its chapters are HOW_TO_PLAY.chapters: the game's book and the PDF (tools/make_guide.js) read the same words.
  var HOW_TO_PLAY = CONTENT("HOW_TO_PLAY");
  ITEMS[HOW_TO_PLAY.item.id] = { name: HOW_TO_PLAY.item.name, gem: HOW_TO_PLAY.item.gem, bound: HOW_TO_PLAY.item.bound, guide: true, about: HOW_TO_PLAY.item.about };
  // (Amunet's farewell gifts list it: TUTORIAL_FINAL in 40-zzz-d's content)
  /** Does this save have the book already (bag or bank)? */
  function hasGuide(s) { var id = HOW_TO_PLAY.item.id; return ((s.bag || {})[id] || 0) > 0 || ((s.storage || {})[id] || 0) > 0; }
