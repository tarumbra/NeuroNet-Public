/* Scribe > Collaboration (2026-10-15): the page, in jsdom with a stand-in Api (nothing on disk). Claude's play test is a
   form: ✓ / ✗ / not tried and a note per check, a choice per question, words per prompt -- saved as you go -- and
   "Done -- over to Claude". Cam starts his own Bugs and Ideas from + New. The files are collab.py's (test_collab.py). */
"use strict";
const fs = require("fs"), path = require("path"), {JSDOM} = require("jsdom");
const APP = process.argv[2] || path.join(__dirname, ".."), UI = path.join(APP, "ui");
let pass = 0, fail = 0;
const out = [];
const ok = (name, cond, detail) => { if (cond) { pass++; out.push("  ok    " + name); } else { fail++; out.push("  FAIL  " + name + (detail ? "\n          " + detail : "")); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms || 60));

(async () => {
  const docs = {PT1: {ref: "PT1", type: "playtest", title: "Battle Re-work, Parts 1 and 2", project: "NeuroPets", from: "claude", status: "open",
    created: "2026-10-15T12:00:00", updated: "2026-10-15T12:00:00", intro: "Try **these**.", sections: [{title: "Fights", items: [
      {id: "a1", kind: "check", text: "Press Swap in a fight", expect: "It costs your next attack", result: null, note: ""},
      {id: "q1", kind: "choice", text: "Keep it?", options: [{id: "a", label: "Yes", rec: true}, {id: "b", label: "No", rec: false}], answer: null, note: ""},
      {id: "t1", kind: "text", text: "Anything else?", answer: ""}]}]}};
  const saves = [];
  const gone = [];
  const sum = (d) => ({by: d.by || "", ref: d.ref, type: d.type, title: d.title, project: d.project, from: d.from, status: d.status, updated: d.updated, created: d.created, items: 3, done: 0, fails: 0});
  let n = 0;
  const known = {
    library_info: async () => ({root: "/d", found: true, photoFiles: 0}), photo_get_data: async () => ({photos: [], albums: [], folders: [], photoTagList: []}),
    get_prefs: async () => ({}), set_prefs: async () => ({ok: true}),
    collab_list: async () => Object.values(docs).map(sum),
    collab_get: async (ref) => docs[ref] ? JSON.parse(JSON.stringify(docs[ref])) : {error: "gone"},
    collab_save: async (d) => { saves.push(JSON.parse(JSON.stringify(d))); docs[d.ref] = JSON.parse(JSON.stringify(d)); return Object.assign({}, d, {updated: "2026-10-15T12:0" + (++n % 10) + ":00"}); },
    // projects (2026-10-17): as collab.py's -- General for documents without one, the names documents carry, and the made ones
    collab_projects: async () => projectsNow(),
    collab_project_use: async (name) => { activeProject = name || ""; return projectsNow(); },
    collab_project_new: async (name) => { made.push(name); activeProject = name; return projectsNow(); },
    collab_project_delete: async (name, how) => { gone.push([name, how]); Object.values(docs).forEach((d) => { if (d.project === name) { if (how === "delete") delete docs[d.ref]; else d.project = ""; } });
      made.splice(0, made.length, ...made.filter((m) => m !== name)); activeProject = ""; return projectsNow(); },
    collab_new: async (typ, title, project) => { const ref = {bug: "B", idea: "I"}[typ] + (typ === "bug" && docs.B1 ? "2" : "1"); docs[ref] = {ref, type: typ, title: "A bug", project: project || "", from: "cam", status: "open",
      created: "x", updated: "x", intro: "", sections: [{title: "The bug", items: [{id: "t1", kind: "text", text: "Steps", answer: ""}]}]}; return docs[ref]; },
    collab_delete: async (ref) => { delete docs[ref]; return {ok: true}; },
  };
  let activeProject = ""; const made = [];
  function projectsNow() {
    const names = ["General"].concat(made);
    Object.values(docs).forEach((d) => { const pn = d.project || "General"; if (!names.includes(pn)) names.push(pn); });
    return {projects: names.map((pn) => ({name: pn, docs: Object.values(docs).filter((d) => (d.project || "General") === pn).length, waiting: 0})), active: activeProject};
  }
  const api = new Proxy({}, {get: (t, nm) => (typeof nm === "string" ? async (...a) => (known[nm] ? known[nm](...a) : {}) : undefined)});
  const html = fs.readFileSync(path.join(UI, "index.html"), "utf8");
  const dom = new JSDOM(html, {runScripts: "outside-only", url: "file://" + UI + "/index.html"});
  const w = dom.window;
  w.pywebview = {api};
  const errors = [];
  w.addEventListener("error", (e) => errors.push(String(e.message || e)));
  w.addEventListener("unhandledrejection", (e) => errors.push(String(e.reason && e.reason.message || e.reason)));
  w.matchMedia = w.matchMedia || (() => ({matches: false, addListener() {}, removeListener() {}}));
  w.scrollTo = () => {}; w.requestAnimationFrame = w.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const src of [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])) { try { w.eval(fs.readFileSync(path.join(UI, src), "utf8")); } catch (e) { /* ignore */ } }
  await wait(800);
  const $ = (s) => w.document.querySelector(s), $$ = (s) => [...w.document.querySelectorAll(s)];

  w.SS.go("collab:board"); await wait(600);
  ok("Scribe has Collaboration: the desk lists PT1, waiting for you", $$(".cb-row").length === 1 && /PT1/.test($(".cb-row").textContent) && /Waiting for you/.test($(".cb-row").textContent));
  ok("  and with nothing open it says how it works (\"refer to PT1\")", /refer to PT1/.test($(".cb-blank").textContent));
  $('.cb-row[data-ref="PT1"]').click(); await wait(400);
  ok("PT1 opens as a form: Claude's intro, a check with what should happen, a choice marked recommended, a prompt",
     /Try these/.test($(".cb-intro").textContent) && /Should: It costs your next attack/.test($(".cb-check").textContent) && $(".cb-rec") && $(".cb-text textarea"));
  $('[data-result="fail"][data-item="a1"]').click(); await wait(50);
  const note = $('textarea[data-item="a1"]'); note.value = "It didn't cost a turn"; note.dispatchEvent(new w.Event("input"));
  const radio = $('input[data-answer="a"]'); radio.checked = true; radio.dispatchEvent(new w.Event("change"));
  const words = $('textarea[data-item="t1"]'); words.value = "Loved the wear bars."; words.dispatchEvent(new w.Event("input"));
  await wait(1000);
  const last = saves[saves.length - 1], its = last && last.sections[0].items;
  ok("✗ Problem, a note, a choice and words are saved as you go", its && its[0].result === "fail" && its[0].note === "It didn't cost a turn" && its[1].answer === "a" && its[2].answer === "Loved the wear bars.", JSON.stringify(its));
  ok("  the list shows it: 3 of 3, one ✗", /3\/3/.test($(".cb-row").textContent) && /1 ✗/.test($(".cb-row").textContent), $(".cb-row").textContent);
  $('[data-status="answered"]').click(); await wait(500);
  ok("Done -- over to Claude: saved as answered, and it says what to write in a prompt", docs.PT1.status === "answered" && /refer to PT1/.test($(".cb-foot").textContent));
  $('[data-new="bug"]').click(); await wait(500);
  ok("+ Bug starts B1 from its template and opens it, title ready to type", docs.B1 && $(".cb-ref.big").textContent === "B1" && w.document.activeElement === $("#cb-title"));
  ok("  your own can be deleted (Claude's can't)", !!$("#cb-del"));
  // votes (2026-10-16): the team's ballots, read only; your vote and override; the count
  docs.V1 = {ref: "V1", type: "vote", title: "Class books", project: "NeuroPets", from: "claude", by: "", status: "open", created: "x", updated: "x", intro: "The proposal",
    sections: [{title: "The team", items: [{id: "gd", kind: "ballot", voter: "Game Developer", vote: "yes", text: "Clean."}, {id: "se", kind: "ballot", voter: "Software Engineer", vote: "no", text: "Scope."}]},
               {title: "You", items: [{id: "cam", kind: "choice", text: "Your vote", options: [{id: "yes", label: "Yes"}, {id: "no", label: "No"}, {id: "abstain", label: "Abstain"}], answer: null, note: ""},
                                      {id: "override", kind: "choice", text: "Override", options: [{id: "accept", label: "Accept"}, {id: "yes", label: "Yes anyway"}, {id: "no", label: "No anyway"}], answer: null, note: ""}]}]};
  docs.C1 = {ref: "C1", type: "concern", title: "Save size", project: "NeuroPets", from: "claude", by: "Software Engineer", status: "open", created: "x", updated: "x", intro: "", sections: [{title: "", items: [{id: "t1", kind: "text", text: "Reply", answer: ""}]}]};
  w.SS.go("settings:stats"); await wait(400); w.SS.go("collab:board"); await wait(800);
  const v1 = $('.cb-row[data-ref="V1"]'); if (v1) v1.click(); await wait(400);
  ok("a vote: each stakeholder's ballot and reason, read only, and the count waiting for yours", $$(".cb-ballot").length === 2 && /Game Developer/.test($(".cb-ballot").textContent)
     && !$(".cb-ballot textarea, .cb-ballot input") && /waiting for your vote/.test($(".cb-tally").textContent));
  const yes = $('input[data-item="cam"][data-answer="yes"]'); yes.checked = true; yes.dispatchEvent(new w.Event("change")); await wait(900);
  ok("  your yes makes it 2-1: carried", /Carried/.test($(".cb-tally").textContent) && /Yes 2 · No 1/.test($(".cb-tally").textContent), $(".cb-tally").textContent);
  const ov = $('input[data-item="override"][data-answer="no"]'); ov.checked = true; ov.dispatchEvent(new w.Event("change")); await wait(900);
  ok("  and your override decides over the count", /Not carried \(your override\)/.test($(".cb-tally").textContent), $(".cb-tally").textContent);
  ok("a concern raised by a section head says who raised it", /from the Software Engineer/.test($('.cb-row[data-ref="C1"]').textContent));
  ok("+ Vote and + Concern start your own", !!$('[data-new="vote"]') && !!$('[data-new="concern"]'));
  // projects (Cam, 2026-10-17: "the ability in collaboration to be broken into projects (think vaults in the notes app)")
  docs.PT2 = {ref: "PT2", type: "playtest", title: "The Marketplace", project: "Market/Thief", from: "claude", status: "open", created: "x", updated: "x", intro: "", sections: [{title: "", items: [{id: "t1", kind: "text", text: "How was it?", answer: ""}]}]};
  w.SS.go("settings:stats"); await wait(400); w.SS.go("collab:board"); await wait(800);
  const sel = $("#cb-proj");
  ok("projects: a picker over the list -- every project, General, and the projects documents are in", sel && [...sel.options].map((o) => o.value).join("|") === "|General|NeuroPets|Market/Thief",
     sel && [...sel.options].map((o) => o.value).join("|"));
  ok("  every project: each row says its project", /Market\/Thief/.test($('.cb-row[data-ref="PT2"]').textContent));
  sel.value = "Market/Thief"; sel.dispatchEvent(new w.Event("change")); await wait(500);
  ok("  pick one: only its documents", $$(".cb-row").map((r) => r.dataset.ref).join() === "PT2" && activeProject === "Market/Thief", $$(".cb-row").map((r) => r.dataset.ref).join());
  $('[data-new="bug"]').click(); await wait(600);
  ok("  + Bug inside a project starts it there", docs.B2 && docs.B2.project === "Market/Thief" && $$(".cb-row").some((r) => r.dataset.ref === "B2"), JSON.stringify(docs.B2 && docs.B2.project));
  const move = $("#cb-proj-move"); move.value = "General"; move.dispatchEvent(new w.Event("change")); await wait(900);
  ok("  a document's Project picker moves it (out of this project's list)", docs.B2.project === "" && !$$(".cb-row").some((r) => r.dataset.ref === "B2"), JSON.stringify(docs.B2.project));
  ok("  + Project starts a new one", !!$("#cb-proj-new"));
  // (2026-11-18, Cam: "a way to delete projects in collaboration")
  { const sp = $("#cb-proj"); sp.value = "General"; sp.dispatchEvent(new w.Event("change")); await wait(400); }
  ok("  General can't be deleted (no Delete beside it)", !$("#cb-proj-del"));
  { const sp = $("#cb-proj"); sp.value = "Market/Thief"; sp.dispatchEvent(new w.Event("change")); await wait(400); }
  $("#cb-proj-del").click(); await wait(300);
  const btns = $$("#modal-veil button").map((b) => b.textContent.trim());
  ok("  Delete on a project with documents asks: Cancel, Move to General, or delete them too", btns.includes("Cancel") && btns.includes("Move to General") && btns.includes("Delete it too"), btns.join("|"));
  $$("#modal-veil button").find((b) => b.textContent.trim() === "Move to General").click(); await wait(700);
  ok("  moved: the project's gone from the picker, its document is in General, and the desk shows every project",
     gone.length === 1 && gone[0][1] === "move" && docs.PT2.project === "" && ![...$("#cb-proj").options].some((o) => o.value === "Market/Thief") && $("#cb-proj").value === "", JSON.stringify(gone));
  const sel2 = $("#cb-proj"); sel2.value = ""; sel2.dispatchEvent(new w.Event("change")); await wait(500);
  ok("  back to every project", $$(".cb-row").length >= 5 && activeProject === "");
  ok("no errors on the page", !errors.length, errors.join(" | "));
  console.log("\nCollaboration (the page)\n\n" + out.join("\n") + `\n\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
