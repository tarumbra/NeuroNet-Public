"""Everything inside NeuroNet -- the old apps' data brought in, once.

Cam: "migrate all the data so it lives within the NeuroNet directory, my goal
is to fully replace camily and all other apps with this one, so it needs to
be standalone."

A made-up computer laid out like Cam's: NeuroNet with kincrux_money/ in its
own folder, Camily beside it with camily_data/ and cookery_data/, and a stray
camily_data/ in the home folder that must never be picked up once the real
one is home.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import importlib.util, json, os, shutil, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def put(path, data="x"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(data)


def tree(top):
    """Every path under the app folder (data aside), to see what an import touches."""
    return {os.path.relpath(os.path.join(d, n), top) for d, ds, fs in os.walk(top)
            if "neuronet_data" not in os.path.relpath(d, top).split(os.sep)
            for n in ds + fs if n != "__pycache__" and "__pycache__" not in d}


before = tree(APP)
had_adopted = os.path.isfile(os.path.join(APP, "neuronet_data", "adopted.json"))
spec = importlib.util.spec_from_file_location("nn", os.path.join(APP, "neuronet.py"))
nn = importlib.util.module_from_spec(spec)
sys.modules["nn"] = nn
spec.loader.exec_module(nn)
logs = []
nn._log_line = lambda m: logs.append(m)
kb = nn.kitchen_backend

print("\nEverything inside NeuroNet\n")
# (used to look for kincrux_money/ or adopted.json, which only exist in Cam's
# own install -- so it failed in a fresh clone. Compare before and after.)
ok("loading NeuroNet's code moves nothing -- only starting the app does",
   tree(APP) == before
   and os.path.isfile(os.path.join(APP, "neuronet_data", "adopted.json")) == had_adopted,
   sorted(tree(APP) ^ before)[:5])
src = __import__("backend_src").backend_source(APP)
ok("  main() brings the old folders in before the window opens",
   src.index("adopt_at_startup()", src.index("def main():")) < src.index("webview.create_window", src.index("def main():")))
ok("NeuroNet tells the Kitchen where its data is, rather than letting it search",
   kb is not None and kb.ROOT_PROVIDER is nn.kitchen_root)

with tempfile.TemporaryDirectory() as tmp:
    app = os.path.join(tmp, "Cams", "NeuroNet")
    root = os.path.join(app, "neuronet_data")
    home = os.path.join(tmp, "home")
    put(os.path.join(root, "neuronet.json"), "{}")
    put(os.path.join(tmp, "Cams", "Camily", "camily_data", "camily.json"), '{"events": [{"name": "Birthday"}]}')
    put(os.path.join(tmp, "Cams", "Camily", "camily_data", "photos", "p1.jpg"), "photo")
    put(os.path.join(tmp, "Cams", "Camily", "cookery_data", "cookery.json"), '{"recipes": [{"name": "Soup"}]}')
    put(os.path.join(app, "kincrux_money", "cashbox.json"), '{"payments": {"x": 1}}')
    put(os.path.join(home, "camily_data", "camily.json"), '{"events": [{"name": "STRAY"}]}')

    done = nn.adopt_outside_data(root=root, here=app, home=home)
    ok("family, kitchen and money are all brought in",
       [d["part"] for d in done] == ["family", "kitchen", "money"], done)
    ok("  from where Camily kept them, not the stray copy in the home folder",
       "Birthday" in open(os.path.join(root, "family", "camily.json")).read())
    ok("  every file, photos included",
       os.path.isfile(os.path.join(root, "family", "photos", "p1.jpg"))
       and os.path.isfile(os.path.join(root, "kitchen", "cookery.json"))
       and os.path.isfile(os.path.join(root, "money", "cashbox.json")))
    ok("  Camily's own folders are left exactly as they were",
       os.path.isfile(os.path.join(tmp, "Cams", "Camily", "camily_data", "photos", "p1.jpg"))
       and os.path.isfile(os.path.join(tmp, "Cams", "Camily", "cookery_data", "cookery.json")))
    ok("  NeuroNet's own old kincrux_money/ leaves the app folder, kept aside in the data",
       not os.path.exists(os.path.join(app, "kincrux_money"))
       and os.path.isfile(os.path.join(root, "adopted-originals", "kincrux_money", "cashbox.json")))
    ok("  and what was done is written down", len(json.load(open(os.path.join(root, "adopted.json")))) == 3)
    ok("a second launch changes nothing", nn.adopt_outside_data(root=root, here=app, home=home) == [])

    # Changes made in NeuroNet from now on are never adopted over.
    put(os.path.join(root, "family", "camily.json"), '{"events": [{"name": "Made in NeuroNet"}]}')
    put(os.path.join(tmp, "Cams", "Camily", "camily_data", "camily.json"), '{"events": [{"name": "Old Camily edit"}]}')
    nn.adopt_outside_data(root=root, here=app, home=home)
    ok("  nor ever copies the old app over what NeuroNet has since changed",
       "Made in NeuroNet" in open(os.path.join(root, "family", "camily.json")).read())

    # Through the real Kitchen functions.
    nn.data_dir = lambda: root
    got = [os.path.relpath(f(), root) for f in (kb.data_file, kb.cookery_file, kb.money_file, kb.photos_dir)]
    ok("the Kitchen, Home and Money read only from inside NeuroNet's data",
       got == ["family/camily.json", "kitchen/cookery.json", "money/cashbox.json", "family/photos"], got)

    # Export now: one part plus settings; import still knows the old parts.
    nn.prefs_file = lambda: os.path.join(app, "neuronet_prefs.json")
    api = nn.Api.__new__(nn.Api)
    # 2026-09-29: settings live in the data folder (Cam: "In data folder"),
    # Kitchen's too, so an export's one part carries them -- a settings file
    # still beside the app (as this made-up one is) goes as its own part.
    ok("an export is the data folder, and settings only if they're outside it",
       [a["key"] for a in api._transfer_areas()] == ["neuronet", "settings"],
       [a["key"] for a in api._transfer_areas()])
    nn.prefs_file = lambda: os.path.join(root, "neuronet_prefs.json")
    ok("  settings in the data folder go with it -- the export is one part",
       [a["key"] for a in api._transfer_areas()] == ["neuronet"],
       [a["key"] for a in api._transfer_areas()])
    nn.prefs_file = lambda: os.path.join(app, "neuronet_prefs.json")
    ok("  and an import still sends an older export's family, recipes and money to their new homes",
       {a["key"]: os.path.relpath(a["path"], root) for a in api._transfer_areas(for_import=True)
        if a["key"] in ("family", "recipes", "money")} == {"family": "family", "recipes": "kitchen", "money": "money"})

with tempfile.TemporaryDirectory() as tmp:
    # A copy that doesn't check out is thrown away, and tried again next time.
    app = os.path.join(tmp, "NeuroNet"); root = os.path.join(app, "neuronet_data")
    put(os.path.join(root, "neuronet.json"), "{}")
    put(os.path.join(tmp, "Camily", "camily_data", "camily.json"), '{"events": []}')
    real = nn._tree_listing
    calls = []

    def lying(path):
        calls.append(path)
        got = real(path)
        return got if len(calls) % 2 else {}          # the copy "comes up short"
    nn._tree_listing = lying
    done = nn.adopt_outside_data(root=root, here=app, home=os.path.join(tmp, "h"))
    nn._tree_listing = real
    ok("a copy that doesn't match is not put in place",
       done == [] and not os.path.exists(os.path.join(root, "family", "camily.json"))
       and not os.path.exists(os.path.join(root, "family.adopting")), os.listdir(root))
    ok("  it says so in the log", any("could not bring family" in m for m in logs))
    old_dd = nn.data_dir
    nn.data_dir = lambda: root
    ok("  and for now the Kitchen uses it where it still is, rather than an empty one",
       kb.data_file() == os.path.join(tmp, "Camily", "camily_data", "camily.json"), kb.data_file())
    nn.ADOPT_FAILED.clear()
    nn.data_dir = old_dd
    ok("  and the next launch brings it in", [d["part"] for d in
       nn.adopt_outside_data(root=root, here=app, home=os.path.join(tmp, "h"))] == ["family"])

    # A family/ folder already made by an earlier launch (no camily.json yet).
    app2 = os.path.join(tmp, "N2"); root2 = os.path.join(app2, "neuronet_data")
    put(os.path.join(root2, "family", "photos", "new.jpg"), "taken since")
    put(os.path.join(tmp, "camily_data", "camily.json"), '{"events": [{"name": "Old"}]}')
    put(os.path.join(tmp, "camily_data", "photos", "new.jpg"), "older copy")
    nn.adopt_outside_data(root=root2, here=app2, home=os.path.join(tmp, "h"))
    ok("an early empty family/ is filled in, and what is already there wins",
       os.path.isfile(os.path.join(root2, "family", "camily.json"))
       and open(os.path.join(root2, "family", "photos", "new.jpg")).read() == "taken since")

# A library somewhere other than inside the app (library_path.txt, a test's
# sandbox) is never adopted into -- it can't pull in, or move, the real ones.
with tempfile.TemporaryDirectory() as tmp:
    nn.data_dir = lambda: os.path.join(tmp, "elsewhere")
    ok("a data folder outside the app is left to itself", nn.adopt_at_startup() == []
       and not os.path.exists(os.path.join(tmp, "elsewhere", "money")))

pkg = open(os.path.join(APP, "package.sh")).read()
ok("update zips never carry the old data folders", all(f"--exclude='./{n}'" in pkg
   for n in ("kincrux_money", "cashbox_data", "cookery_data")))

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
