"""Code -> Guides, Data Structures and Research -- the back end.

Cam (2026-10-01): "Code mainsection is also going to have guides ... Algorthm
research (new tool, where i can annotate, highlight and make text boxes
around a code base i wrote ...). Also then a data structures sub section
(... implementations in Python and Javascript ...). All guides, data
structures ect. Need to have the ability to add more."

Through NeuroNet's own Api (code_lib_<name>), on a data folder made here, so
nothing of Cam's is touched. What it holds NeuroNet to:
  * every call the interface makes is a code_lib_ method
  * the built-in library is listed, and Cam's additions join it
  * editing a built-in saves HIS copy (an update can't overwrite it), and
    "Back to NeuroNet's" brings the built-in back; deleting a built-in only
    hides it
  * a name can't reach outside the library, a study can't read outside its
    folder, and a study never writes to the folder it studies
  * EVERY built-in implementation and every `run` snippet in the built-in
    guides actually runs and passes its own checks -- a library that teaches
    broken code is worse than none
The interface half is test_code_library.js.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, os, re, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)

tmp = tempfile.mkdtemp(prefix="nn-codelib-")
DATA = os.path.join(tmp, "data")
os.makedirs(DATA)
with open(os.path.join(tmp, "paths.json"), "w") as f:
    json.dump({"data": DATA}, f)
os.environ["NEURONET_PATHS"] = os.path.join(tmp, "paths.json")
os.environ["XDG_STATE_HOME"] = os.path.join(tmp, "state")

import neuronet  # noqa: E402
import code_library  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


api = neuronet.Api()
LIB = os.path.join(DATA, "code", "library")

# ---- the bridge -------------------------------------------------------------------
ui = ""
for name in ("library.js", "guides.js", "structures.js", "research.js"):
    with open(os.path.join(APP, "ui", "code", name), encoding="utf-8") as f:
        ui += f.read()
asked = set(re.findall(r'CL\.call\(\s*"([a-z_]+)"', ui))
missing = sorted(n for n in asked if not callable(getattr(api, "code_lib_" + n, None)))
ok("every call the library makes is answered by NeuroNet as code_lib_<name>",
   asked and not missing, missing or asked)
ok("  NeuroNet's list of them is code_library's", tuple(neuronet.CODE_LIB_CALLS) == tuple(code_library.CALLS),
   set(neuronet.CODE_LIB_CALLS) ^ set(code_library.CALLS))

# ---- the built-in library ---------------------------------------------------------
g = api.code_lib_list("guides")
ok("the built-in guides are listed", len(g["items"]) >= 10, g.get("error") or len(g["items"]))
ok("  each has a title, a blurb and a topic",
   all(i["title"] and i["blurb"] and i["topic"] != "Other" for i in g["items"]),
   [i["slug"] for i in g["items"] if not (i["title"] and i["blurb"])])
ok("  and is NeuroNet's", {i["origin"] for i in g["items"]} == {"builtin"})
s = api.code_lib_list("structures")
ok("the built-in data structures are listed", len(s["items"]) >= 10, s.get("error") or len(s["items"]))
ok("  every one in Python AND JavaScript",
   all({"python", "javascript"} <= set(i["languages"]) for i in s["items"]),
   [i["slug"] for i in s["items"] if not {"python", "javascript"} <= set(i["languages"])])
ok("  the languages that can be added are offered", "rust" in s["languages"] and "typescript" in s["languages"])
r = api.code_lib_read("structures", "stack")
ok("a structure reads with its code", "class Stack" in r.get("code", {}).get("python", "")
   and "class Stack" in r["code"].get("javascript", ""), r)
ok("nothing was written to the data folder by reading", not os.path.exists(LIB) or not os.listdir(LIB),
   os.listdir(LIB) if os.path.exists(LIB) else "")

# ---- adding, editing, removing ----------------------------------------------------
r = api.code_lib_save("guides", None, {"title": "List slicing", "blurb": "a[1:3]",
                                       "topic": "Python", "text": "```python\nprint([1,2,3][1:])\n```"})
ok("a new guide is saved as markdown in neuronet_data/code/library/guides",
   r.get("slug") == "list-slicing" and os.path.isfile(os.path.join(LIB, "guides", "list-slicing.md")), r)
ok("  and is listed as Cam's", any(i["slug"] == "list-slicing" and i["origin"] == "mine"
                                   for i in api.code_lib_list("guides")["items"]))
r2 = api.code_lib_save("guides", None, {"title": "List slicing", "text": "again"})
ok("  a second with the same title gets its own name", r2.get("slug") == "list-slicing-2", r2)
ok("  a title is required", "error" in api.code_lib_save("guides", None, {"title": "  "}))

r = api.code_lib_save("guides", "big-o", {"title": "Big-O, my way", "blurb": "mine",
                                          "topic": "Fundamentals", "text": "My notes"})
ok("editing a built-in saves Cam's copy", r.get("origin") == "edited" and r.get("text") == "My notes"
   and os.path.isfile(os.path.join(LIB, "guides", "big-o.md")), r)
ok("  the built-in itself is untouched",
   "My notes" not in open(os.path.join(APP, "code_library", "guides", "big-o.md")).read())
r = api.code_lib_remove("guides", "big-o")
ok("  'Back to NeuroNet's' removes his copy and the built-in shows again",
   r.get("was") == "edited" and api.code_lib_read("guides", "big-o").get("origin") == "builtin", r)

r = api.code_lib_remove("guides", "git-basics")
lst = api.code_lib_list("guides")
ok("deleting a built-in hides it", r.get("was") == "builtin"
   and all(i["slug"] != "git-basics" for i in lst["items"])
   and any(i["slug"] == "git-basics" for i in lst["hidden"]), r)
ok("  and the file is still there", os.path.isfile(os.path.join(APP, "code_library", "guides", "git-basics.md")))
api.code_lib_unhide("guides", "git-basics")
ok("  'Show hidden' brings it back", any(i["slug"] == "git-basics" for i in api.code_lib_list("guides")["items"]))
r = api.code_lib_remove("guides", "list-slicing-2")
ok("deleting Cam's own deletes it", r.get("was") == "mine"
   and not os.path.exists(os.path.join(LIB, "guides", "list-slicing-2.md")), r)

r = api.code_lib_save("structures", None, {"title": "Deque", "category": "Linear", "blurb": "both ends",
                                           "text": "## About", "code": {"python": "print('d')",
                                                                        "rust": "fn main() {}"}})
ok("a new structure is a folder: about.md and one file per language",
   r.get("slug") == "deque" and sorted(os.listdir(os.path.join(LIB, "structures", "deque")))
   == ["about.md", "python.py", "rust.rs"], r)
r = api.code_lib_save("structures", "stack", {"title": "Stack", "category": "Linear",
                                              "text": "mine", "code": {"rust": "fn main() {}"}})
ok("adding a language to a built-in keeps the built-in's other languages",
   r.get("origin") == "edited" and set(r.get("languages", [])) == {"python", "javascript", "rust"}
   and "class Stack" in r["code"]["python"], r)
r = api.code_lib_save("structures", "stack", {"title": "Stack", "code": {"rust": None}})
ok("  and a language can be taken away again", r.get("languages") == ["python", "javascript"], r)
ok("  an unknown language is refused",
   "error" in api.code_lib_save("structures", "stack", {"title": "S", "code": {"cobol": "x"}}))
api.code_lib_remove("structures", "stack")

for bad in ("../../paths", "a/b", "", "UPPER", None):
    if "error" not in api.code_lib_read("guides", bad) or "error" not in api.code_lib_remove("structures", bad):
        ok("a name can't reach outside the library (%r)" % (bad,), False)
        break
else:
    ok("a name can't reach outside the library", True)
ok("an unknown library is refused", "error" in api.code_lib_list("secrets"))

# ---- running code -------------------------------------------------------------------
r = api.code_lib_run("python", "print(6 * 7)")
ok("Python runs, in a folder of its own", r.get("ok") and r.get("output", "").strip() == "42", r)
r = api.code_lib_run("python", "raise SystemExit('nope')")
ok("  a failure says so", r.get("ok") is False and "nope" in r.get("output", ""), r)
r = api.code_lib_run("python", "import os; open('left.txt', 'w').write('x'); print(os.getcwd())")
ok("  and leaves nothing behind", r.get("ok") and not os.path.exists(r["output"].strip()), r)
old = code_library.RUN_TIMEOUT
code_library.RUN_TIMEOUT = 1
r = api.code_lib_run("python", "while True: pass")
code_library.RUN_TIMEOUT = old
ok("  a loop that never ends is stopped", r.get("ok") is False and "Stopped" in r.get("output", ""), r)

HAVE_NODE = bool(shutil.which("node"))
if HAVE_NODE:
    r = api.code_lib_run("javascript", "console.log([1,2].map(n => n * 2).join())")
    ok("JavaScript runs (node)", r.get("ok") and r["output"].strip() == "2,4", r)
else:
    print("  --    node isn't installed: JavaScript isn't run here")

# ---- EVERY built-in implementation passes its own checks ----------------------------
bad = []
for item in api.code_lib_list("structures")["items"]:
    if item["origin"] != "builtin":
        continue
    full = api.code_lib_read("structures", item["slug"])
    for lang, text in full["code"].items():
        if lang == "javascript" and not HAVE_NODE:
            continue
        r = api.code_lib_run(lang, text)
        if not r.get("ok") or "all checks passed" not in r.get("output", ""):
            bad.append("%s/%s: %s" % (item["slug"], lang, r.get("output", "")[-300:]))
ok("every built-in data structure runs and passes its own checks", not bad, "\n".join(bad))

# ---- EVERY runnable snippet in the built-in guides runs ----------------------------
FENCE = re.compile(r"^(`{3,})(\w+) run\s*\n(.*?)^\1\s*$", re.M | re.S)
bad, count = [], 0
for item in api.code_lib_list("guides")["items"]:
    if item["origin"] != "builtin":
        continue
    for m in FENCE.finditer(item["text"]):
        lang = {"python": "python", "py": "python", "js": "javascript", "javascript": "javascript"}[m.group(2)]
        if lang == "javascript" and not HAVE_NODE:
            continue
        count += 1
        r = api.code_lib_run(lang, m.group(3))
        if not r.get("ok"):
            bad.append("%s: %s" % (item["slug"], r.get("output", "")[-300:]))
ok("every `run` snippet in the built-in guides runs (%d)" % count, count >= 15 and not bad, "\n".join(bad) or count)

# ---- research -----------------------------------------------------------------------
CODEBASE = os.path.join(tmp, "my-app")
os.makedirs(os.path.join(CODEBASE, "src"))
os.makedirs(os.path.join(CODEBASE, "node_modules", "junk"))
with open(os.path.join(CODEBASE, "src", "main.py"), "w") as f:
    f.write("def main():\n    print('hi')\n")
with open(os.path.join(CODEBASE, "logo.png"), "wb") as f:
    f.write(b"\x89PNG\r\n\x1a\n\0\0\0")
with open(os.path.join(tmp, "secret.txt"), "w") as f:
    f.write("outside")
before = sorted(os.walk(CODEBASE))

st = api.code_lib_study_create("", CODEBASE)
ok("a study is made over a folder, named after it", st.get("slug") == "my-app" and st.get("name") == "my-app", st)
ok("  a folder that isn't there is refused", "error" in api.code_lib_study_create("x", os.path.join(tmp, "nope")))
t = api.code_lib_study_tree("my-app")
names = json.dumps(t)
ok("its tree lists the code and skips node_modules", "main.py" in names and "node_modules" not in names, t)
png = [n for n in t["tree"] if n["name"] == "logo.png"]
ok("  a binary file is listed but not readable", png and png[0]["readable"] is False, png)
f = api.code_lib_study_file("my-app", "src/main.py")
ok("a file reads, with its language", f.get("language") == "python" and "def main" in f.get("text", ""), f)
ok("  a path can't leave the folder", "error" in api.code_lib_study_file("my-app", "../secret.txt"))
ok("  nor a binary be read as text", "error" in api.code_lib_study_file("my-app", "logo.png"))

ann = [{"id": "a1", "kind": "box", "file": "src/main.py", "start": {"line": 1, "col": 0},
        "end": {"line": 2, "col": 15}, "colour": "blue", "label": "Entry point",
        "text": "Where it **starts**.", "quote": "def main():\n    print('hi')"},
       {"id": "a2", "kind": "highlight", "file": "src/main.py", "start": {"line": 2, "col": 4},
        "end": {"line": 2, "col": 15}, "colour": "nope", "quote": "print('hi')"}]
r = api.code_lib_study_save("my-app", {"annotations": ann, "overview": "A tiny app."})
ok("annotations and the overview are saved", len(r.get("annotations", [])) == 2 and r["overview"] == "A tiny app.", r)
ok("  an unknown colour becomes yellow", r["annotations"][1]["colour"] == "yellow")
ok("  an unknown kind is refused", "error" in api.code_lib_study_save(
    "my-app", {"annotations": [dict(ann[0], kind="graffiti")]}))
ok("the study lives in neuronet_data/code/library/research",
   os.path.isfile(os.path.join(LIB, "research", "my-app.json")))
lst = api.code_lib_studies()
ok("studies are listed with their note count", lst and lst[0]["notes"] == 2 and lst[0]["found"], lst)
md = api.code_lib_study_markdown("my-app").get("text", "")
ok("a study exports as one markdown review",
   "# my-app" in md and "## src/main.py" in md and "Box: Entry point (lines 1-2)" in md
   and "```python\ndef main():" in md and "A tiny app." in md, md)
ok("the folder being studied was never written to", sorted(os.walk(CODEBASE)) == before)
api.code_lib_study_delete("my-app")
ok("deleting a study deletes only the notes", not os.path.exists(os.path.join(LIB, "research", "my-app.json"))
   and os.path.isfile(os.path.join(CODEBASE, "src", "main.py")))

shutil.rmtree(tmp, ignore_errors=True)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
