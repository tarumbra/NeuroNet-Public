"""Separate vaults in Notes (2026-10-12, Cam: "Another feature would be seperate vaults. Think like the seperate cash
books.") and folders that start collapsed ("i want the notes sidebar to be collapsed by default"). Throwaway folders
only -- never Cam's notes."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import re
import shutil
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import notes_backend  # noqa: E402

passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def titles(tree):
    out = []
    for n in tree:
        out.append(n.get("path"))
        out += titles(n.get("children") or [])
    return out


tmp = tempfile.mkdtemp(prefix="nn-vaults-")
try:
    notes = os.path.join(tmp, "data", "notes")
    notes_backend.DATA_DIR_PROVIDER = lambda: notes
    main = notes_backend.vault_dir()
    os.makedirs(os.path.join(main, "Game"))
    with open(os.path.join(main, "Game", "Plan.md"), "w") as f: f.write("the plan")
    api = notes_backend.NotesApi()

    v = api.list_vaults()
    ok("to start there's one vault, the main one, and it's open", v == {"active": "main", "vaults": [{"id": "main", "name": "Main vault"}]}, v)
    ok("  the main vault is where it always was (Fleeting, the board and shipping still write there)", main == os.path.join(notes, "vault")
       and notes_backend.active_vault_dir() == main)

    v = api.new_vault("Work")
    ok("a new vault gets its own folder and opens", v["active"] == "v1" and [x["name"] for x in v["vaults"]] == ["Main vault", "Work"]
       and os.path.isdir(os.path.join(notes, "vaults", "v1")), v)
    ok("  it starts empty", api.list_tree() == [], api.list_tree())
    r = api.create_note("", "Monday")
    ok("  a note made now lands in it, not in the main vault", os.path.isfile(os.path.join(notes, "vaults", "v1", "Monday.md"))
       and not os.path.exists(os.path.join(main, "Monday.md")), r)
    api.create_folder("", "Meetings")
    ok("  its tree shows only its own notes", sorted(titles(api.list_tree())) == ["Meetings", "Monday.md"], titles(api.list_tree()))
    ok("  vault_dir() still means the main vault", notes_backend.vault_dir() == main)
    ok("  each vault keeps its own pictures", notes_backend.attachments_dir() == os.path.join(notes, "vaults", "v1", "attachments"))

    ok("the main vault's notes don't ship from here, and nothing here ships",
       api.ship_list() == [] and "Only the main vault" in api.set_ship("Monday.md", True).get("error", ""))

    ok("the same name twice is refused", "already" in api.new_vault("work").get("error", "") and "already" in api.new_vault("Main vault").get("error", ""))
    ok("  and a name is needed", "name" in api.new_vault("   ").get("error", ""))
    ok("  path characters are taken out of a name", api.new_vault("a/b:c")["vaults"][-1]["name"] == "abc")

    v = api.switch_vault("main")
    ok("switching back opens the main vault, with its notes", v["active"] == "main" and "Game/Plan.md" in titles(api.list_tree()))
    ok("  and the other vault's notes are still there", os.path.isfile(os.path.join(notes, "vaults", "v1", "Monday.md")))
    ok("there's no switching to a vault that isn't there", "no vault" in api.switch_vault("v99").get("error", "")
       and "no vault" in api.switch_vault("../x").get("error", ""))

    v = api.rename_vault("main", "Cam's notes")
    ok("any vault can be renamed, the main one too", v["vaults"][0]["name"] == "Cam's notes")
    v = api.rename_vault("v1", "Office")
    ok("  and another", [x["name"] for x in v["vaults"]][1] == "Office")

    ok("the main vault can't be deleted", "can't" in api.delete_vault("main").get("error", ""))
    api.switch_vault("v1")
    v = api.delete_vault("v1")
    bins = os.listdir(os.path.join(notes, "deleted vaults"))
    ok("deleting a vault moves its folder aside (not erased) and opens the main vault", v["active"] == "main" and "v1" not in [x["id"] for x in v["vaults"]]
       and not os.path.exists(os.path.join(notes, "vaults", "v1")) and len(bins) == 1 and bins[0].startswith("Office - ")
       and os.path.isfile(os.path.join(notes, "deleted vaults", bins[0], "Monday.md")), (v, bins))
    v = api.new_vault("Again")
    ok("  a vault made after one was deleted starts empty (the old notes stay set aside)", v["active"] == "v1" and api.list_tree() == []
       and os.path.isfile(os.path.join(notes, "deleted vaults", bins[0], "Monday.md")))

    with open(os.path.join(notes, "vaults.json"), "w") as f: f.write("{broken")
    ok("a damaged vaults.json falls back to the main vault", api.list_vaults()["active"] == "main" and notes_backend.active_vault_dir() == main)

    # ---- moving things to another vault (2026-10-12) ----
    with open(os.path.join(notes, "vaults.json"), "w") as f: f.write("{}")
    api.switch_vault("main")
    att = os.path.join(main, "attachments"); os.makedirs(att, exist_ok=True)
    with open(os.path.join(att, "pic.png"), "wb") as f: f.write(b"PIC-A")
    with open(os.path.join(att, "clash.png"), "wb") as f: f.write(b"MINE")
    os.makedirs(os.path.join(main, "Farm", "Art"))
    with open(os.path.join(main, "Farm", "Plan.md"), "w") as f: f.write("see ![[pic.png]] and ![x](clash.png)")
    with open(os.path.join(main, "Farm", "Art", "Sheet.md"), "w") as f: f.write("![[clash.png|200]]")
    with open(os.path.join(main, "Loose.md"), "w") as f: f.write("![[pic.png]]")
    api.set_ship("Farm", True)
    v = api.new_vault("Farm vault"); fv = v["active"]
    api.create_folder("", "Projects")
    fvdir = os.path.join(notes, "vaults", fv)
    os.makedirs(os.path.join(fvdir, "attachments"), exist_ok=True)
    with open(os.path.join(fvdir, "attachments", "clash.png"), "wb") as f: f.write(b"THEIRS")
    api.switch_vault("main")
    ok("the picker sees another vault's folders", api.vault_folders(fv) == {"folders": [{"path": "Projects", "name": "Projects", "depth": 0}]}, api.vault_folders(fv))
    r = api.move_to_vault("Farm", fv, "Projects")
    ok("a folder moves into another vault's folder, everything inside it with it", r.get("ok") and r["path"] == "Projects/Farm"
       and os.path.isfile(os.path.join(fvdir, "Projects", "Farm", "Art", "Sheet.md")) and not os.path.exists(os.path.join(main, "Farm")), r)
    ok("  the pictures its notes show are copied across (this vault keeps its own)", open(os.path.join(fvdir, "attachments", "pic.png"), "rb").read() == b"PIC-A"
       and os.path.isfile(os.path.join(att, "pic.png")) and r["pictures"] == 2, r)
    moved = open(os.path.join(fvdir, "Projects", "Farm", "Plan.md")).read(); sheet = open(os.path.join(fvdir, "Projects", "Farm", "Art", "Sheet.md")).read()
    ok("  a picture whose name is taken there by a different one is renamed, and the notes point at the new name",
       open(os.path.join(fvdir, "attachments", "clash.png"), "rb").read() == b"THEIRS" and re.search(r"!\[x\]\((clash .+?\.png)\)", moved)
       and open(os.path.join(fvdir, "attachments", re.search(r"!\[x\]\((clash .+?\.png)\)", moved).group(1)), "rb").read() == b"MINE"
       and "![[" + re.search(r"!\[x\]\((clash .+?\.png)\)", moved).group(1) + "|200]]" in sheet, (moved, sheet, os.listdir(os.path.join(fvdir, "attachments"))))
    ok("  it no longer ships (only the main vault does)", not any(p.startswith("Farm") for p in api.ship_list()), api.ship_list())
    r = api.move_to_vault("Loose.md", fv, "")
    ok("a note moves to another vault's top; the same picture isn't copied twice", r.get("ok") and r["path"] == "Loose.md" and r["pictures"] == 0
       and len(os.listdir(os.path.join(fvdir, "attachments"))) == 3, r)
    ok("not into the vault it's already in", "already" in api.move_to_vault("Game", "main", "").get("error", ""))
    ok("  not into a vault that isn't there", "no vault" in api.move_to_vault("Game", "v77", "").get("error", ""))
    ok("  not out past the other vault's folder", "isn't in the other vault" in api.move_to_vault("Game", fv, "../../vault").get("error", "")
       and "isn't in the other vault" in api.move_to_vault("Game", fv, "attachments").get("error", ""))
    ok("  not the pictures folder itself", "can't be moved" in api.move_to_vault("attachments", fv, "").get("error", ""))
    api.switch_vault(fv)
    r = api.move_to_vault("Projects/Farm/Art", "main", "")
    ok("and back again, from the other vault to the main one", r.get("ok") and os.path.isfile(os.path.join(main, "Art", "Sheet.md")), r)
    api.switch_vault("main")

    src = open(os.path.join(APP, "api", "desktop.py")).read()
    ok("the bridge passes the vault calls through", all("def notes_%s(" % k in src for k in ("list_vaults", "switch_vault", "new_vault", "rename_vault", "delete_vault", "vault_folders", "move_to_vault")))

    js = open(os.path.join(APP, "ui", "notes", "app.js")).read()
    html = open(os.path.join(APP, "ui", "index.html")).read()
    ok("the sidebar has the vault bar above the search", html.index('id="cx-vault-bar"') < html.index('id="cx-search-wrap"')
       and "function renderVaultBar()" in js and "await loadVaults();" in js)
    ok("  switching saves what's open and closes the tabs first", re.search(r"async function leaveVault\(\) \{\s*if \(dirty\) await flushSave\(\);\s*await closeSplit\(\);", js) is not None)
    ok("  a new vault isn't given the three starter notes", 'if (!tree.length && vaultsInfo.active === "main")' in js)
    ok("folders start collapsed, except the ones holding the note on screen", "function foldNewFolders()" in js
       and re.search(r"tree = await CC\.Store\.listTree\(\);\s*foldNewFolders\(\);", js) is not None and "if (!holdsOpen) collapsed.add(f.path);" in js)
    ok("Move to... lists the other vaults and their folders, and saves an open note before it goes", "async function moveToVault(path, type, vault, folder)" in js
       and 'data-vault="${esc(vid)}"' in js and 'class="cx-move-vault-pick"' in js and re.search(r"if \(dirty && inside\(currentPath\)\) await flushSave\(\);", js) is not None)
    ok("Notes reads the tree again when you come back to it or the window (notes written from outside show up)",
       'window.addEventListener("focus", () => refreshFromOutside());' in js and "window.CC.Shell.refresh()" in open(os.path.join(APP, "ui", "notes", "bridge.js")).read())
    css = open(os.path.join(APP, "ui", "notes", "notes.css")).read()
    ok("a folded folder's arrow points right, an open one's down", "transform: rotate(90deg);" in css and ".cx-tree-row.cx-collapsed .cx-caret { transform: none; }" in css)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n  %d passed, %d failed\n" % (passed, failed))
sys.exit(1 if failed else 0)
