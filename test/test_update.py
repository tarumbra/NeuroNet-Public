"""neuronet-update (NeuroNet System plan, Stage 6): installed machines keep
themselves up to date from NeuroNet's releases (git tags v<version>).

A made-up release history in a local git repository stands in for GitHub;
an "installed" NeuroNet in a temporary home is updated from it. Every
command the updater touches the desktop with (neuronet-path, neuronet-quick,
hyprctl, pgrep, notify-send, install.sh) is a stand-in, so the real NeuroNet
on this computer is never seen, let alone restarted."""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPDATE = os.path.join(APP, "system", "bin", "neuronet-update")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def sh(*a, cwd=None):
    subprocess.run(a, cwd=cwd, check=True, capture_output=True)


def write(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)


t = tempfile.mkdtemp(prefix="nn-update-")
home, stub, src = os.path.join(t, "home"), os.path.join(t, "bin"), os.path.join(t, "src")
app = os.path.join(home, "NeuroNet")

# ---- the release history (stands in for the private GitHub repository) -------------
INSTALL_STUB = '#!/bin/bash\necho "install.sh $*" >> "$HOME/../calls.log"\n'
write(os.path.join(src, "VERSION"), "1.0.0\n")
write(os.path.join(src, "neuronet.py"), "# NeuroNet 1.0.0\n")
write(os.path.join(src, "system", "install.sh"), INSTALL_STUB, 0o755)
write(os.path.join(src, "neuronet_data", "neuronet.json"), '{"photos": ["from the repo -- must never land"]}')
sh("git", "init", "-q", "-b", "main", cwd=src)
sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A", cwd=src)
sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "1.0.0", cwd=src)
sh("git", "tag", "v1.0.0", cwd=src)
# the starter's pictures and files, on their own branch and tag (2026-10-06)
G = ("-c", "user.email=t@t", "-c", "user.name=t")
sh("git", "checkout", "-q", "--orphan", "starter-files", cwd=src)
sh("git", "rm", "-rqf", ".", cwd=src)
write(os.path.join(src, "TAG"), "starter-files-abc\n")
write(os.path.join(src, "photos", "creme.jpg"), "a recipe photo\n")
sh("git", *G, "add", "-A", cwd=src)
sh("git", *G, "commit", "-qm", "starter files", cwd=src)
sh("git", "tag", "starter-files-abc", cwd=src)
sh("git", "checkout", "-q", "main", cwd=src)
write(os.path.join(src, "system", "starter", "starter.json"), json.dumps({"files": {"tag": "starter-files-abc", "sha1": {}}}))
sh("git", *G, "add", "-A", cwd=src)
write(os.path.join(src, "VERSION"), "1.1.0\n")
write(os.path.join(src, "neuronet.py"), "# NeuroNet 1.1.0\n")
write(os.path.join(src, "CHANGELOG.md"), "## 1.1.0\n")
sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "1.1.0", cwd=src)
sh("git", "add", "CHANGELOG.md", cwd=src)
sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "notes", cwd=src)
sh("git", "tag", "v1.1.0", cwd=src)
write(os.path.join(src, "VERSION"), "1.2.0-dev\n")                   # untagged work: never taken
sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "dev", cwd=src)
bare = os.path.join(t, "neuronet.git")
sh("git", "clone", "-q", "--bare", src, bare)

# ---- an installed NeuroNet 1.0.0 (from the ISO: no .git) with its data ---------------
write(os.path.join(app, "VERSION"), "1.0.0\n")
write(os.path.join(app, "neuronet.py"), "# NeuroNet 1.0.0\n")
write(os.path.join(app, "system", "install.sh"), INSTALL_STUB, 0o755)
write(os.path.join(app, "neuronet_data", "neuronet.json"), '{"photos": ["mine"]}')
write(os.path.join(app, "neuronet.log"), "my log\n")
write(os.path.join(home, ".config", "neuronet", "update.json"), json.dumps({"repo": "file://" + bare}))

for name, body in {
    "neuronet-path": '#!/bin/bash\ncase "$1" in app) echo "%s" ;; data) echo "%s/neuronet_data" ;; esac\n' % (app, app),
    "neuronet-quick": '#!/bin/bash\necho "neuronet-quick $*" >> "$HOME/../calls.log"\n',
    "notify-send": '#!/bin/bash\necho "notify $*" >> "$HOME/../calls.log"\n',
    "hyprctl": '#!/bin/bash\necho "[]"\n',
    "pgrep": "#!/bin/bash\nexit 1\n",            # no NeuroNet running here -- never the real one
    "systemctl": '#!/bin/bash\necho "systemctl $*" >> "$HOME/../calls.log"\n',
}.items():
    write(os.path.join(stub, name), body, 0o755)
env = dict(os.environ, HOME=home, PATH=stub + ":" + os.environ["PATH"],
           XDG_CONFIG_HOME=os.path.join(home, ".config"), XDG_STATE_HOME=os.path.join(home, ".local", "state"))
env.pop("GIT_SSH_COMMAND", None)
calls = os.path.join(t, "calls.log")
state = os.path.join(home, ".local", "state", "neuronet")


def run(*args):
    r = subprocess.run(["bash", UPDATE, *args], env=env, capture_output=True, text=True, timeout=120)
    return r.returncode, r.stdout + r.stderr


def read(p):
    with open(p) as f:
        return f.read()


try:
    code, out = run("--check")
    ok("--check: says what's installed and the newest release (tags only, not work in progress)",
       code == 0 and "installed: 1.0.0" in out and "newest release: 1.1.0" in out, out)
    ok("  and changes nothing", read(os.path.join(app, "VERSION")).strip() == "1.0.0")

    open(calls, "w").close()
    code, out = run()
    ok("an update to 1.1.0 runs to the end", code == 0 and "done: NeuroNet 1.1.0" in out, out[-600:])
    ok("  the new code is in place", read(os.path.join(app, "VERSION")).strip() == "1.1.0"
       and "1.1.0" in read(os.path.join(app, "neuronet.py"))
       and os.path.isfile(os.path.join(app, "CHANGELOG.md")))
    ok("  THE DATA IS UNTOUCHED (the repo's neuronet_data never lands)",
       json.load(open(os.path.join(app, "neuronet_data", "neuronet.json"))) == {"photos": ["mine"]})
    ok("  and so is NeuroNet's log", read(os.path.join(app, "neuronet.log")) == "my log\n")
    ok("  the version before is kept, without the data",
       read(os.path.join(state, "previous", "VERSION")).strip() == "1.0.0"
       and not os.path.exists(os.path.join(state, "previous", "neuronet_data")))
    ok("  the desktop layer updated offline, without asking",
       "install.sh --yes --offline --no-start" in read(calls), read(calls))
    ok("  and it's recorded", json.load(open(os.path.join(state, "update.json")))["version"] == "1.1.0"
       and "1.0.0 -> 1.1.0" in read(os.path.join(state, "update.log")))

    sf = os.path.join(state, "starter-files")
    ok("  the starter's pictures and files are fetched under their own tag",
       read(os.path.join(sf, "TAG")).strip() == "starter-files-abc" and os.path.isfile(os.path.join(sf, "photos", "creme.jpg"))
       and not os.path.exists(os.path.join(sf, ".git")))
    write(os.path.join(sf, "kept"), "x")

    open(calls, "w").close()
    code, out = run()
    ok("run again: already the newest, nothing done", code == 0 and "1.1.0 is the newest" in out
       and read(calls) == "", out)
    ok("  and the starter files, unchanged, aren't downloaded again", os.path.isfile(os.path.join(sf, "kept")))
    shutil.rmtree(sf)
    code, out = run()
    ok("  missing ones are fetched even with no new release (a new computer, or a failed download)",
       read(os.path.join(sf, "TAG")).strip() == "starter-files-abc" and "1.1.0 is the newest" in out, out)

    os.makedirs(os.path.join(app, ".git"))
    code, out = run()
    ok("never on a NeuroNet that's a git checkout (the one it's developed in)",
       code == 0 and "git checkout" in out, out)
    os.rmdir(os.path.join(app, ".git"))

    os.remove(os.path.join(home, ".config", "neuronet", "update.json"))
    code, out = run()
    ok("not set up for updates (no update.json): does nothing", code == 0 and "not set up" in out, out)
    write(os.path.join(home, ".config", "neuronet", "update.json"), json.dumps({"repo": "file://" + t + "/nope.git"}))
    code, out = run()
    ok("the repository out of reach (offline): says so, nothing changes",
       code == 0 and "couldn't reach" in out and read(os.path.join(app, "VERSION")).strip() == "1.1.0", out)

    code, out = run("--enable")
    ok("--enable switches the daily check on", "enable --now neuronet-update.timer" in read(calls), read(calls))
finally:
    shutil.rmtree(t, ignore_errors=True)

# The daily check never ran when Cam logged in more than 10 minutes after boot (2026-10-03):
# a user timer is started at login, so OnBootSec was already past and OnUnitActiveSec had
# nothing to count from. It must count from login and keep a calendar.
_timer = [l.strip() for l in open(os.path.join(APP, "system", "templates", "neuronet-update.timer.in"), encoding="utf-8")
          if l.strip() and not l.strip().startswith("#")]
ok("the daily check runs whenever you log in (10 min after login, and daily by the calendar, catching up)",
   "OnStartupSec=10min" in _timer and "OnCalendar=daily" in _timer and "Persistent=true" in _timer
   and not any(l.startswith(("OnBootSec", "OnUnitActiveSec")) for l in _timer), _timer)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
