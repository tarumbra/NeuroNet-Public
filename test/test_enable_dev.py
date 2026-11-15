"""system/enable-dev.sh, system/bin/neuronet-dev and tools/make_dev_kit.sh (2026-10-24, Cam: "a script to
change the laptop with a developer key ... I want to be able to work on the laptop like this PC").

An installed NeuroNet (a plain folder, auto-updated, with its data inside) is made a git checkout of main in
place. A local bare git repository stands in for GitHub; the home, the config and state folders are
temporary; every desktop command (systemctl, sudo, pacman, chromium, neuronet-path) and the release's
install.sh are stand-ins -- so the real NeuroNet, its repository and the session here are never seen."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-1500:] if detail else ""))


def sh(args, env, cwd=None, inp=None):
    return subprocess.run(args, env=env, cwd=cwd, input=inp, capture_output=True, text=True, timeout=120)


def write(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)


def art_test():
    """neuronet-dev-art: two computers' ~/Pictures kept in step through an `art` branch on a stand-in GitHub."""
    tmp = tempfile.mkdtemp(prefix="nn-dev-art-")
    try:
        env0 = {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
        gh = os.path.join(tmp, "github.git")
        sh(["git", "init", "-q", "--bare", "-b", "main", gh], env0)
        base = os.path.join(tmp, "kit-art")                      # the art both had on 24 October
        write(os.path.join(base, "Cafe Art", "Icons", "old.jpeg"), "old sheet")
        tool = os.path.join(APP, "system", "bin", "neuronet-dev-art")
        pcs = {}
        for name in ("pc", "laptop"):
            home = os.path.join(tmp, name)
            app = os.path.join(home, "NeuroNet")
            sh(["git", "init", "-q", "-b", "main", app], env0)
            sh(["git", "remote", "add", "origin", gh], env0, app)
            pics = os.path.join(home, "Pictures")
            write(os.path.join(pics, "Cafe Art", "Icons", "old.jpeg"), "old sheet")
            env = dict(env0, HOME=home, XDG_STATE_HOME=os.path.join(home, ".state"), NEURONET_ART_HOME=pics, NEURONET_ART_FOLDERS="Cafe Art",
                       NEURONET_ART_BASELINE="")             # (no kit on this computer -- never the real one on this drive)
            pcs[name] = (app, pics, env)
        lapp, lpics, lenv = pcs["laptop"]
        r = sh(["python3", tool, lapp], lenv)
        ok("art: no art branch yet and no kit here -- it says to start it on the PC, and does nothing", r.returncode == 0 and "on the PC first" in r.stdout
           and not sh(["git", "ls-remote", "--heads", gh, "art"], env0).stdout.strip(), r.stdout + r.stderr)
        papp, ppics, penv = pcs["pc"]
        write(os.path.join(ppics, "Cafe Art", "Icons", "Sheet 31.jpeg"), "made on the PC")
        r = sh(["python3", tool, papp], dict(penv, NEURONET_ART_BASELINE=base))
        ok("the PC starts the art branch from the 24 October art, and sends only what's new since", r.returncode == 0 and "started the art branch" in r.stdout and "1 sent" in r.stdout
           and "files/Cafe Art/Icons/Sheet 31.jpeg" in sh(["git", "ls-tree", "-r", "--name-only", "art"], env0, gh).stdout
           and "old.jpeg" not in sh(["git", "ls-tree", "-r", "--name-only", "art"], env0, gh).stdout.replace("BASELINE.tsv", ""), r.stdout + r.stderr)
        write(os.path.join(lpics, "Cafe Art", "Icons", "Sheet 19.jpeg"), "made on the laptop")
        write(os.path.join(lpics, "Cafe Art", "Icons", "Sheet 31.jpeg"), "the laptop's own, different")
        r = sh(["python3", tool, lapp], lenv)
        ok("the laptop gets the PC's new art and sends its own; a file that differs on both is left as it is here",
           r.returncode == 0 and "1 sent" in r.stdout and "kept yours of 1" in r.stdout
           and open(os.path.join(lpics, "Cafe Art", "Icons", "Sheet 31.jpeg")).read() == "the laptop's own, different", r.stdout + r.stderr)
        r = sh(["python3", tool, papp], penv)
        ok("back on the PC: the laptop's sheet comes across (Cam: \"make the neuronet-dev pull from now on copy new art across\")",
           r.returncode == 0 and "1 new from the other computer" in r.stdout and open(os.path.join(ppics, "Cafe Art", "Icons", "Sheet 19.jpeg")).read() == "made on the laptop", r.stdout + r.stderr)
        r = sh(["python3", tool, papp], penv)
        ok("  and again: nothing to do, nothing deleted anywhere", r.returncode == 0 and "0 new from the other computer, 0 sent" in r.stdout
           and all(os.path.exists(os.path.join(p, "Cafe Art", "Icons", f)) for p in (ppics, lpics) for f in ("old.jpeg", "Sheet 19.jpeg", "Sheet 31.jpeg")), r.stdout + r.stderr)
        dev = open(os.path.join(APP, "system", "bin", "neuronet-dev")).read()
        ok("neuronet-dev pull runs it (also when it won't pull the code), and `neuronet-dev art` on its own", dev.count("art_sync") >= 4 and "  art) art_sync ;;" in dev)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def data_test():
    """neuronet-dev-data: two computers' working notes (Collaboration, Scribe, Claude's memory) kept in step both ways
    through a `devdata` branch on a stand-in GitHub (8 Nov 2026, Cam: "so i can take off where i left off")."""
    tmp = tempfile.mkdtemp(prefix="nn-dev-data-")
    try:
        env0 = {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
        gh = os.path.join(tmp, "github.git")
        sh(["git", "init", "-q", "--bare", "-b", "main", gh], env0)
        tool = os.path.join(APP, "system", "bin", "neuronet-dev-data")
        pcs = {}
        for name in ("pc", "laptop"):
            home = os.path.join(tmp, name)
            app = os.path.join(home, "NeuroNet")
            sh(["git", "init", "-q", "-b", "main", app], env0)
            sh(["git", "remote", "add", "origin", gh], env0, app)
            d = {"collab": os.path.join(home, "data", "collab"), "notes": os.path.join(home, "data", "notes"), "claude-memory": os.path.join(home, "mem")}
            env = dict(env0, HOME=home, XDG_STATE_HOME=os.path.join(home, ".state"), NEURONET_DEVDATA_AREAS=":".join(f"{k}={v}" for k, v in d.items()))
            pcs[name] = (app, d, env)
        papp, pd, penv = pcs["pc"]
        lapp, ld, lenv = pcs["laptop"]
        rd = lambda p: open(p).read() if os.path.exists(p) else None
        write(os.path.join(pd["collab"], "PT83.json"), '{"answered": true}')
        write(os.path.join(pd["notes"], "vaults", "v8", "Plans.md"), "the newest plan")
        write(os.path.join(pd["notes"], "vaults", "v8", "Old.md"), "to be deleted later")
        write(os.path.join(pd["claude-memory"], "MEMORY.md"), "- the index")
        write(os.path.join(pd["notes"], ".trash", "x.md"), "hidden")
        r = sh(["python3", tool, papp], penv)
        files = sh(["git", "ls-tree", "-r", "--name-only", "devdata"], env0, gh).stdout
        ok("notes: the PC starts the devdata branch and sends its Collaboration, notes and memory (not hidden folders)",
           r.returncode == 0 and "4 sent" in r.stdout and "files/collab/PT83.json" in files and "files/notes/vaults/v8/Plans.md" in files
           and "files/claude-memory/MEMORY.md" in files and ".trash" not in files, r.stdout + r.stderr + files)
        write(os.path.join(ld["notes"], "vaults", "v8", "Plans.md"), "a fresh install's old plan")
        write(os.path.join(ld["notes"], "vaults", "v8", "Laptop only.md"), "written on the laptop")
        r = sh(["python3", tool, lapp], lenv)
        ok("the laptop's first time: the PC's copies win, its own differing one saved aside, its new note sent",
           r.returncode == 0 and rd(os.path.join(ld["notes"], "vaults", "v8", "Plans.md")) == "the newest plan" and rd(os.path.join(ld["collab"], "PT83.json")) == '{"answered": true}'
           and rd(os.path.join(ld["claude-memory"], "MEMORY.md")) == "- the index" and "1 sent" in r.stdout and "first time" in r.stdout
           and any("a fresh install's old plan" == rd(os.path.join(rt, f)) for rt, _, fs in os.walk(os.path.join(lenv["XDG_STATE_HOME"], "neuronet", "devdata-conflicts")) for f in fs), r.stdout + r.stderr)
        # on the laptop while travelling: a PT answered, a note deleted
        write(os.path.join(ld["collab"], "PT83.json"), '{"answered": true, "t2": "pass"}')
        os.remove(os.path.join(ld["notes"], "vaults", "v8", "Old.md"))
        r = sh(["python3", tool, lapp], lenv)
        ok("  its changes go up (a deletion too)", r.returncode == 0 and "1 sent" in r.stdout and "1 deleted there" in r.stdout, r.stdout + r.stderr)
        r = sh(["python3", tool, papp], penv)
        ok("back on the PC: the laptop's work comes across, and the deleted note goes (copied aside first)",
           r.returncode == 0 and rd(os.path.join(pd["collab"], "PT83.json")) == '{"answered": true, "t2": "pass"}' and rd(os.path.join(pd["notes"], "vaults", "v8", "Laptop only.md")) == "written on the laptop"
           and not os.path.exists(os.path.join(pd["notes"], "vaults", "v8", "Old.md")) and "1 deleted here" in r.stdout
           and any(f == "Old.md" for _, _, fs in os.walk(os.path.join(penv["XDG_STATE_HOME"], "neuronet", "devdata-replaced")) for f in fs), r.stdout + r.stderr)
        # the same note changed on both: the newer wins on both, the other kept aside
        p_plan, l_plan = os.path.join(pd["notes"], "vaults", "v8", "Plans.md"), os.path.join(ld["notes"], "vaults", "v8", "Plans.md")
        write(p_plan, "PC edit (older)"); os.utime(p_plan, (1000, 1000))
        sh(["python3", tool, papp], penv)
        write(l_plan, "laptop edit (newer)")
        r = sh(["python3", tool, lapp], lenv)
        ok("a note changed on both: the newer wins, the other copy saved aside and said",
           r.returncode == 0 and rd(l_plan) == "laptop edit (newer)" and "changed on both" in r.stdout
           and any("PC edit (older)" == rd(os.path.join(rt, f)) for rt, _, fs in os.walk(os.path.join(lenv["XDG_STATE_HOME"], "neuronet", "devdata-conflicts")) for f in fs), r.stdout + r.stderr)
        sh(["python3", tool, papp], penv)
        r = sh(["python3", tool, papp], penv)
        ok("  and on the PC too; then nothing more to do", rd(p_plan) == "laptop edit (newer)" and "0 from the other computer, 0 sent" in r.stdout, r.stdout + r.stderr)
        dev = open(os.path.join(APP, "system", "bin", "neuronet-dev")).read()
        ok("neuronet-dev pull runs it (also when it won't pull the code), and `neuronet-dev data` on its own", dev.count("data_sync") >= 4 and "  data) data_sync ;;" in dev)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    tmp = tempfile.mkdtemp(prefix="nn-enable-dev-")
    try:
        home = os.path.join(tmp, "home")
        stubs = os.path.join(tmp, "stubs")
        log = os.path.join(tmp, "calls.log")
        os.makedirs(home)
        env = {"HOME": home, "XDG_CONFIG_HOME": os.path.join(home, ".config"), "XDG_STATE_HOME": os.path.join(home, ".local/state"),
               "XDG_DATA_HOME": os.path.join(home, ".local/share"), "XDG_CACHE_HOME": os.path.join(home, ".cache"),
               "PATH": stubs + ":/usr/bin:/bin", "LANG": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1",
               "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
        for cmd in ("systemctl", "sudo", "pacman", "chromium", "notify-send"):
            write(os.path.join(stubs, cmd), f'#!/bin/bash\necho "{cmd} $*" >> "{log}"\n', 0o755)

        # "GitHub": main with release 1.0.2 of a small NeuroNet
        gh = os.path.join(tmp, "github.git")
        src = os.path.join(tmp, "src")
        sh(["git", "init", "-q", "--bare", "-b", "main", gh], env)
        sh(["git", "init", "-q", "-b", "main", src], env)
        write(os.path.join(src, "neuronet.py"), "print('new')\n")
        write(os.path.join(src, "VERSION"), "1.0.2\n")
        write(os.path.join(src, ".gitignore"), "/neuronet_data/\nneuronet.log\n")
        write(os.path.join(src, "system", "install.sh"), f'#!/bin/bash\necho "install.sh $*" >> "{log}"\n', 0o755)
        write(os.path.join(src, "system", "starter", "starter.json"), json.dumps({"files": {}}))
        # (main without neuronet-dev, as GitHub's is until these scripts are pushed: the kit's copy is used)
        sh(["git", "add", "-A"], env, src)
        sh(["git", "commit", "-qm", "1.0.2"], env, src)
        sh(["git", "tag", "v1.0.2"], env, src)
        sh(["git", "push", "-q", gh, "main", "v1.0.2"], env, src)
        tip = sh(["git", "rev-parse", "HEAD"], env, src).stdout.strip()

        # the laptop's NeuroNet: an installed copy of 1.0.1 (no .git), its data inside, the auto-update on
        app = os.path.join(home, "DataDrive", "NeuroNet")
        write(os.path.join(app, "neuronet.py"), "print('old')\n")
        write(os.path.join(app, "VERSION"), "1.0.1\n")
        write(os.path.join(app, "old_only.py"), "gone upstream\n")
        write(os.path.join(app, "neuronet_data", "notes", "mine.md"), "my notes\n")
        write(os.path.join(app, "neuronet.log"), "a log\n")
        write(os.path.join(home, ".config", "neuronet", "paths.json"), json.dumps({"app": app, "data": os.path.join(app, "neuronet_data")}))
        write(os.path.join(stubs, "neuronet-path"), f'#!/bin/bash\n[ "$1" = app ] && echo "{app}" || echo "{app}/neuronet_data"\n', 0o755)

        # the kit (as tools/make_dev_kit.sh makes it -- without a key: the local "GitHub" needs none)
        kit = os.path.join(tmp, "kit")
        os.makedirs(kit)
        shutil.copy(os.path.join(APP, "system", "enable-dev.sh"), os.path.join(kit, "enable-dev.sh"))
        shutil.copy(os.path.join(APP, "system", "bin", "neuronet-dev"), os.path.join(kit, "neuronet-dev"))
        write(os.path.join(kit, "dev.json"), json.dumps({"repo": gh, "name": "Tarumbra", "email": "tarumbra@example.com"}))
        write(os.path.join(kit, "art", "NeuroCafe Art Assets", "Icons", "sheet.jpeg"), "art")
        write(os.path.join(kit, "art", "NeuroPets Art Assets", "Pets", "pet- Sheet 1.jpeg"), "pets")
        write(os.path.join(kit, "claude-memory", "MEMORY.md"), "- [NeuroCafe](project_neurocafe.md) — the cafe\n")
        write(os.path.join(kit, "claude-memory", "project_neurocafe.md"), "from the PC\n")
        mem = os.path.join(home, ".claude", "projects", "-" + os.path.join(home, "Work").strip("/").replace("/", "-").replace(".", "-").replace("_", "-"), "memory")
        write(os.path.join(mem, "project_neurocafe.md"), "the laptop's own\n")

        # --check first: nothing changes
        r = sh(["bash", os.path.join(kit, "enable-dev.sh"), "--check", "--claude-dir", os.path.join(home, "Work")], env)
        ok("--check says what it would do and changes nothing", r.returncode == 0 and "(would)" in r.stdout and not os.path.exists(os.path.join(app, ".git"))
           and open(os.path.join(app, "neuronet.py")).read() == "print('old')\n", r.stdout + r.stderr)

        r = sh(["bash", os.path.join(kit, "enable-dev.sh"), "--yes", "--claude-dir", os.path.join(home, "Work")], env)
        ok("it runs through", r.returncode == 0, r.stdout + r.stderr)
        head = sh(["git", "rev-parse", "HEAD"], env, app).stdout.strip()
        ok("the NeuroNet folder is a git checkout of main, in place (main's code there now)", head == tip and open(os.path.join(app, "VERSION")).read() == "1.0.2\n"
           and sh(["git", "rev-parse", "--abbrev-ref", "main@{upstream}"], env, app).stdout.strip() == "origin/main", r.stdout)
        ok("  its data, log and a file git doesn't know are untouched", open(os.path.join(app, "neuronet_data", "notes", "mine.md")).read() == "my notes\n"
           and open(os.path.join(app, "neuronet.log")).read() == "a log\n" and os.path.exists(os.path.join(app, "old_only.py")))
        before = os.path.join(home, ".local", "state", "neuronet", "before-dev")
        ok("  the code before is kept (not the data)", open(os.path.join(before, "neuronet.py")).read() == "print('old')\n" and not os.path.exists(os.path.join(before, "neuronet_data")))
        ok("commits are made as Cam (this checkout only)", sh(["git", "config", "user.name"], env, app).stdout.strip() == "Tarumbra"
           and sh(["git", "config", "--global", "user.name"], env).stdout.strip() == "")
        calls = open(log).read() if os.path.exists(log) else ""
        ok("the desktop layer is put in again, and the daily auto-update switched off", "install.sh --yes --offline --no-start" in calls and "systemctl --user disable --now neuronet-update.timer" in calls, calls)
        ok("neuronet-dev is on the path (the kit's copy, while main hasn't got it)", os.access(os.path.join(home, ".local", "bin", "neuronet-dev"), os.X_OK))
        ok("every game's art folder is merged into ~/Pictures", os.path.exists(os.path.join(home, "Pictures", "NeuroCafe Art Assets", "Icons", "sheet.jpeg"))
           and os.path.exists(os.path.join(home, "Pictures", "NeuroPets Art Assets", "Pets", "pet- Sheet 1.jpeg")))
        backups = [n for n in os.listdir(mem) if n.startswith("project_neurocafe.md.laptop-")]
        ok("Claude's memory is merged (a differing note kept beside), with a note of this computer's folders", open(os.path.join(mem, "project_neurocafe.md")).read() == "from the PC\n"
           and len(backups) == 1 and app in open(os.path.join(mem, "workstation_laptop.md")).read() and "workstation_laptop.md" in open(os.path.join(mem, "MEMORY.md")).read(), os.listdir(mem))

        r2 = sh(["bash", os.path.join(kit, "enable-dev.sh"), "--yes", "--claude-dir", os.path.join(home, "Work")], env)
        ok("a second run: fine, the checkout left as it is", r2.returncode == 0 and "git checkout already" in r2.stdout
           and sh(["git", "rev-parse", "HEAD"], env, app).stdout.strip() == tip and open(os.path.join(mem, "MEMORY.md")).read().count("workstation_laptop.md") == 1, r2.stdout + r2.stderr)

        # the other computer pushes 1.0.3; neuronet-dev pull here takes it
        write(os.path.join(src, "VERSION"), "1.0.3\n")
        sh(["git", "commit", "-qam", "1.0.3"], env, src)
        sh(["git", "push", "-q", gh, "main"], env, src)
        dev = os.path.join(home, ".local", "bin", "neuronet-dev")
        open(log, "w").close()
        r = sh([dev, "pull"], env)
        ok("neuronet-dev pull: the newest main from GitHub", r.returncode == 0 and open(os.path.join(app, "VERSION")).read() == "1.0.3\n", r.stdout + r.stderr)
        ok("  and the desktop layer again for it (NeuroArcana's code came, its launcher and Super+Alt+Y didn't, 1 Nov 2026)",
           "install.sh --yes --offline --no-start" in open(log).read() and "desktop layer: up to date" in r.stdout, r.stdout + open(log).read())
        write(os.path.join(app, "neuronet.py"), "print('half done')\n")
        r = sh([dev, "pull"], env)
        ok("  but not over changes that aren't committed", r.returncode != 0 and "not committed" in r.stdout and "was NOT updated" in r.stdout and open(os.path.join(app, "neuronet.py")).read() == "print('half done')\n", r.stdout)
        r = sh([dev, "status"], env)
        ok("neuronet-dev status says what's not committed or pushed", r.returncode == 0 and "commits not pushed: 0" in r.stdout and "neuronet.py" in r.stdout, r.stdout + r.stderr)
        sh(["git", "checkout", "-q", "--", "neuronet.py"], env, app)
        write(os.path.join(app, "feature.py"), "x\n")
        sh(["git", "add", "feature.py"], env, app)
        sh(["git", "commit", "-qm", "work on the laptop"], env, app)
        r = sh(["git", "push", "-q", "origin", "main"], env, app)
        ok("work done here pushes to GitHub", r.returncode == 0 and sh(["git", "log", "-1", "--format=%s", "main"], env, gh).stdout.strip() == "work on the laptop", r.stderr)

        # the standalone games in ~/Work: pull brings each up to date, and installs its packages when they changed
        # (8 Nov 2026, Cam: "so i cant use neuronet-dev pull ... for neurocode?")
        write(os.path.join(stubs, "npm"), f'#!/bin/bash\necho "npm $* in $PWD" >> "{log}"\nmkdir -p node_modules\n', 0o755)
        cgh, csrc, capp = os.path.join(tmp, "code.git"), os.path.join(tmp, "code-src"), os.path.join(home, "Work", "NeuroCode")
        sh(["git", "init", "-q", "--bare", "-b", "master", cgh], env)
        sh(["git", "init", "-q", "-b", "master", csrc], env)
        write(os.path.join(csrc, "package.json"), '{"version": "0.9.0"}\n')
        write(os.path.join(csrc, "package-lock.json"), '{"v": 1}\n')
        sh(["git", "add", "-A"], env, csrc); sh(["git", "commit", "-qm", "0.9.0"], env, csrc); sh(["git", "push", "-q", cgh, "master"], env, csrc)
        sh(["git", "clone", "-q", cgh, capp], env)
        os.makedirs(os.path.join(capp, "node_modules"))
        write(os.path.join(csrc, "package.json"), '{"version": "0.9.1"}\n')
        sh(["git", "commit", "-qam", "0.9.1 Stop really stops"], env, csrc); sh(["git", "tag", "v0.9.1"], env, csrc); sh(["git", "push", "-q", cgh, "master", "v0.9.1"], env, csrc)
        open(log, "w").close()
        r = sh([dev, "pull"], env)
        ok("neuronet-dev pull also updates the games in ~/Work (packages unchanged: no npm install); ones not here are said",
           r.returncode == 0 and '"0.9.1"' in open(os.path.join(capp, "package.json")).read() and "NeuroCode: " in r.stdout and "Stop really stops" in r.stdout
           and "NeuroCafe: not on this computer" in r.stdout and "npm" not in open(log).read() and sh(["git", "tag"], env, capp).stdout.strip() == "v0.9.1", r.stdout + r.stderr)
        write(os.path.join(csrc, "package-lock.json"), '{"v": 2}\n')
        sh(["git", "commit", "-qam", "new packages"], env, csrc); sh(["git", "push", "-q", cgh, "master"], env, csrc)
        r = sh([dev, "apps"], env)
        ok("  its packages changed: npm install runs there", r.returncode == 0 and "NeuroCode: packages installed" in r.stdout and f"npm install --no-audit --no-fund --loglevel=error in {capp}" in open(log).read(), r.stdout + open(log).read())
        write(os.path.join(capp, "package.json"), '{"version": "half done"}\n')
        write(os.path.join(csrc, "README.md"), "x\n")
        sh(["git", "add", "-A"], env, csrc); sh(["git", "commit", "-qm", "readme"], env, csrc); sh(["git", "push", "-q", cgh, "master"], env, csrc)
        r = sh([dev, "apps"], env)
        ok("  but never over changes not committed there", "NeuroCode: changes not committed here" in r.stdout and "half done" in open(os.path.join(capp, "package.json")).read()
           and not os.path.exists(os.path.join(capp, "README.md")), r.stdout)

        # the kit maker, without touching GitHub
        out = os.path.join(tmp, "kit2")
        kenv = dict(env, NEURONET_CLAUDE_MEMORY=os.path.join(kit, "claude-memory"), NEURONET_ART=os.path.join(kit, "art"))   # (art/ stands in for ~/Pictures)
        r = sh(["bash", os.path.join(APP, "tools", "make_dev_kit.sh"), out, "--no-github"], kenv)
        d = json.load(open(os.path.join(out, "dev.json"))) if os.path.exists(os.path.join(out, "dev.json")) else {}
        ok("make_dev_kit.sh: the script, dev.json (ssh), a new key (600), the art, Claude's memory, a README", r.returncode == 0 and d.get("repo", "").startswith("git@github.com:")
           and oct(os.stat(os.path.join(out, "dev_key")).st_mode & 0o777) == "0o600" and os.path.exists(os.path.join(out, "dev_key.pub"))
           and os.path.exists(os.path.join(out, "art", "NeuroCafe Art Assets", "Icons", "sheet.jpeg")) and os.path.exists(os.path.join(out, "art", "NeuroPets Art Assets", "Pets", "pet- Sheet 1.jpeg")) and os.path.exists(os.path.join(out, "claude-memory", "MEMORY.md"))
           and os.path.exists(os.path.join(out, "README.txt")) and os.path.exists(os.path.join(out, "neuronet-dev")) and "--no-github" in r.stdout, r.stdout + r.stderr)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\n  {passed} passed, {failed} failed")
    return failed == 0


if __name__ == "__main__":
    art_test()
    data_test()
    raise SystemExit(0 if main() else 1)
