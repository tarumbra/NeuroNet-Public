  // ---- people explaining things (PT20, 2026-10-18) -- the words are content (TALKS); a talk shows once by itself -------------
  var TALKS = CONTENT("TALKS");
  /** seen {key} -- a talk (or anything shown once) has been seen. */
  function seenAct(s, action, opts, now) {
    if (action !== "seen") return null;
    var k = String(opts.key || "").replace(/[^a-z0-9:_-]/gi, "").slice(0, 40);
    if (!k) return no(s, "Nothing to mark.");
    s.seen = s.seen || {}; s.seen[k] = now;
    return { ok: true, msg: "", state: s };
  }
  /** A talk, ready to show: who says it (their name and look), the title, the lines with their numbers filled in. */
  function talkView(s, key) {
    var T = TALKS[key]; if (!T) return null;
    var who = T.who === "tutor" ? (GUILD.tutors[(s.player || {}).cls] || {}) : PEOPLE[T.who] || WORKSHOPS[T.who] || {};
    var nums = { price: (CRYPT_STOCK.lifeessence || {}).price, daily: (CRYPT_STOCK.lifeessence || {}).daily, free: TALENT_RULES.freeRespecTo };
    var fill = function (t) { return t.replace(/\{(\w+)\}/g, function (m, k) { return nums[k] != null ? Number(nums[k]).toLocaleString() : m; }); };
    return { key: key, title: T.title, name: who.standIn || who.who || who.name || "", look: who.look || null, lines: T.lines.map(fill), show: T.show || [], go: T.go || null,
             seen: !!((s.seen || {})[key]) };
  }
