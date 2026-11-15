/* The browser suite's stand-in for neuropets.py's bridge (2026-10-13, audit SE-11). It serves the scenario's save from
   state.json and keeps whatever the game saves in memory -- nothing is written anywhere, and no real data is read. */
window.SS = window.SS || {};
(function () {
  const req = new XMLHttpRequest();
  req.open("GET", "state.json", false); req.send();
  let saved = JSON.parse(req.responseText);
  window.__saves = 0;
  window.__errors = [];
  window.addEventListener("error", (e) => window.__errors.push(String(e.message || e)));
  window.addEventListener("unhandledrejection", (e) => window.__errors.push("promise: " + String(e.reason && e.reason.message || e.reason)));
  SS.Store = {
    async call(name, args) {
      if (name === "pet_load") return JSON.parse(JSON.stringify(saved));
      if (name === "pet_save") { saved = JSON.parse(JSON.stringify(args[0])); window.__saves++; return {ok: true}; }
      if (name === "hello") return {version: "test"};
      if (name === "pet_settings") return {dailySaves: false};
      if (name === "pet_slots") return {active: 1, slots: [JSON.parse(JSON.stringify(saved)), null, null]};   // pet.py slots()
      if (name === "pet_mods") return [];
      if (name === "pet_newgame") { saved = JSON.parse(JSON.stringify(args[1])); window.__saves++; return JSON.parse(JSON.stringify(saved)); }   // (Part 12)
      if (name === "places_save") { window.__places = JSON.parse(JSON.stringify(args[0])); return {ok: true}; }   // the place editor (2026-10-15)
      return {};
    },
  };
  window.__saved = () => saved;
})();
