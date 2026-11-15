// Loads NeuroPets' rules (ui/pet/petcore.js) into Node, the same way test/test_pet.py does.
const fs = require("fs"), path = require("path"), vm = require("vm");
const cx = {}; vm.createContext(cx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "ui", "pet", "petcore.js"), "utf8") + ";this.C = PetCore;", cx);
// Sailing (audit SE-1, 2026-10-19): the islands' grounds (Frostpeak, the Desert, the Nile) need you ON that island. A sim
// "arrives" there before it hunts or fights a boss -- the voyage itself is a ship's business, not combat's -- and is back on
// the main island for everything else.
const act0 = cx.C.act;
cx.C.act = function (s, action, opts, now) {
  if ((action === "hunt" || action === "boss") && opts && opts.ground && s && s.player) {
    const isle = (cx.C.REGIONS[opts.ground] || {}).isle || "";
    if (s.player.island !== isle) { s = JSON.parse(JSON.stringify(s)); s.player.island = isle; s.player.voyage = null; }
  }
  return act0.call(this, s, action, opts, now);
};
module.exports = cx.C;
