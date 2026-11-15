"""system/enable-updates.sh (2026-10-21, Cam: "a script to set Manthies' computer to update from
github -- her pc was set up prior to the auto update iso").

A computer from before Stage 6: a NeuroNet folder with no VERSION, no paths.json, no update
settings. The update kit (the script beside update.json) is run there; a local git repository with
two releases stands in for GitHub. Every desktop command (systemctl, hyprctl, pgrep, notify-send,
busctl, neuronet-quick, sudo, pacman) and the release's install.sh are stand-ins in a temporary home,
so the real NeuroNet and session on this computer are never seen."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(APP, "system", "enable-updates.sh")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-1500:] if detail else ""))


def write(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)


def sh(*a, cwd=None):
    subprocess.run(a, cwd=cwd, check=True, capture_output=True)


G = ("-c", "user.email=t@t", "-c", "user.name=t")
t = tempfile.mkdtemp(prefix="nn-enable-")
home, stub, src, kit = (os.path.join(t, n) for n in ("home", "bin", "src", "kit"))
app = os.path.join(home, "Data_Drive", "NeuroNet")
calls = os.path.join(t, "calls.log")

# ---- "GitHub": two releases, each carrying the real updater and path finder ------------------
for v in ("1.0.124", "1.0.125"):
    write(os.path.join(src, "VERSION"), v + "\n")
    write(os.path.join(src, "neuronet.py"), f"# NeuroNet {v}\n")
    write(os.path.join(src, "system", "install.sh"), f'#!/bin/bash\necho "install.sh $*" >> "{calls}"\n', 0o755)
    os.makedirs(os.path.join(src, "system", "bin"), exist_ok=True)
    for b in ("neuronet-update", "neuronet-path"):
        shutil.copy(os.path.join(APP, "system", "bin", b), os.path.join(src, "system", "bin", b))
    # neuronet-setup: puts the updater in ~/.local/bin, as the real one does
    write(os.path.join(src, "system", "bin", "neuronet-setup"),
          f'#!/bin/bash\necho "neuronet-setup $*" >> "{calls}"\nmkdir -p "$HOME/.local/bin"\ncp "$(dirname "$0")/neuronet-update" "$(dirname "$0")/neuronet-path" "$HOME/.local/bin/"\n', 0o755)
    if v == "1.0.124":
        sh("git", "init", "-q", "-b", "main", cwd=src)
    sh("git", *G, "add", "-A", cwd=src)
    sh("git", *G, "commit", "-qm", v, cwd=src)
    sh("git", "tag", "v" + v, cwd=src)

# ---- the stand-ins ------------------------------------------------------------------------------
for name in ("systemctl", "hyprctl", "notify-send", "busctl", "neuronet-quick", "sudo", "pacman", "omarchy-restart-waybar"):
    write(os.path.join(stub, name), f'#!/bin/bash\necho "{name} $*" >> "{calls}"\n', 0o755)
write(os.path.join(stub, "pgrep"), "#!/bin/bash\nexit 1\n", 0o755)          # no NeuroNet running here

# ---- the kit: the script beside update.json (no key: the repo is a local folder) -----------------
os.makedirs(kit)
shutil.copy(SCRIPT, os.path.join(kit, "enable-updates.sh"))
write(os.path.join(kit, "update.json"), json.dumps({"repo": src}))


def old_neuronet():
    """A NeuroNet from before the updater: code, data, no VERSION, no paths.json."""
    if os.path.exists(home):
        shutil.rmtree(home)
    write(os.path.join(app, "neuronet.py"), "# NeuroNet from September\n")
    write(os.path.join(app, "neuronet_data", "neuronet.json"), '{"mine": true}')
    write(os.path.join(app, "notes.py"), "# her own file\n")
    open(calls, "w").close()


def run(*args):
    env = {"HOME": home, "PATH": stub + ":/usr/bin:/bin", "NEURONET_PATHS": os.path.join(home, ".config", "neuronet", "paths.json"),
           "XDG_CONFIG_HOME": os.path.join(home, ".config"), "XDG_STATE_HOME": os.path.join(home, ".local", "state"),
           "GIT_CONFIG_GLOBAL": os.devnull, "LANG": "C.UTF-8"}
    return subprocess.run(["bash", os.path.join(kit, "enable-updates.sh"), *args], env=env, capture_output=True, text=True, timeout=120, stdin=subprocess.DEVNULL)


print("\nenable-updates.sh: a computer set up before the auto-update ISO\n")
old_neuronet()
r = run("--check")
conf = os.path.join(home, ".config", "neuronet")
ok("--check finds NeuroNet in ~/Data_Drive and the newest release, and changes nothing",
   r.returncode == 0 and app in r.stdout and "newest release: 1.0.125" in r.stdout and not os.path.exists(conf)
   and open(os.path.join(app, "neuronet.py")).read() == "# NeuroNet from September\n", r.stdout + r.stderr)

r = run("--yes")
read = lambda p: open(p).read() if os.path.exists(p) else None
ok("it runs to the end", r.returncode == 0 and "Done: NeuroNet 1.0.125" in r.stdout, r.stdout + r.stderr)
ok("NeuroNet is now the newest release", read(os.path.join(app, "VERSION")) == "1.0.125\n" and read(os.path.join(app, "neuronet.py")) == "# NeuroNet 1.0.125\n")
ok("  its data is exactly as it was", read(os.path.join(app, "neuronet_data", "neuronet.json")) == '{"mine": true}')
ok("  the old code is kept (~/.local/state/neuronet/previous)", read(os.path.join(home, ".local", "state", "neuronet", "previous", "neuronet.py")) == "# NeuroNet from September\n")
upd = json.load(open(os.path.join(conf, "update.json"))) if os.path.exists(os.path.join(conf, "update.json")) else {}
ok("the update settings are in place (repository; no key in the kit: none written)", upd.get("repo") == src and "key" not in upd)
paths = json.load(open(os.path.join(conf, "paths.json"))) if os.path.exists(os.path.join(conf, "paths.json")) else {}
ok("paths.json written for this older NeuroNet", paths.get("app") == app and paths.get("data") == os.path.join(app, "neuronet_data"))
log = read(calls) or ""
ok("the desktop layer went in again (the release's install.sh)", "install.sh --yes --offline --no-start" in log, log)
ok("the daily check is switched on (systemctl --user enable --now neuronet-update.timer)", "systemctl --user enable --now neuronet-update.timer" in log, log)
ok("nothing was installed with sudo or pacman (the tools were there)", "sudo" not in log and "pacman" not in log, log)

# a key in the kit is installed private to her, and update.json points at it
write(os.path.join(kit, "update_key"), "-----BEGIN OPENSSH PRIVATE KEY-----\nnot a real key\n", 0o600)
old_neuronet()
r = run("--check")
ok("with a key in the kit, --check still changes nothing", not os.path.exists(conf))
os.remove(os.path.join(kit, "update_key"))

# refusals
old_neuronet()
os.makedirs(os.path.join(app, ".git"))
r = run("--yes")
ok("a git checkout is refused (it's updated with git)", r.returncode != 0 and "git checkout" in r.stderr and not os.path.exists(os.path.join(conf, "update.json")), r.stderr)
shutil.rmtree(os.path.join(app, ".git"))
shutil.move(os.path.join(kit, "update.json"), os.path.join(t, "update.json.away"))
r = run("--yes")
ok("without update.json beside it, it stops before changing anything", r.returncode != 0 and "update.json" in r.stderr and not os.path.exists(conf), r.stderr)
shutil.move(os.path.join(t, "update.json.away"), os.path.join(kit, "update.json"))
r = run("--yes", "--app", os.path.join(home, "nowhere"))
ok("a folder that isn't NeuroNet is refused", r.returncode != 0 and "isn't a NeuroNet folder" in r.stderr, r.stderr)
write(os.path.join(kit, "update.json"), json.dumps({"repo": os.path.join(t, "no-such-repo")}))
r = run("--yes")
ok("GitHub not answering: it says so and stops before updating", r.returncode != 0 and "didn't answer" in r.stderr and read(os.path.join(app, "neuronet.py")) == "# NeuroNet from September\n", r.stderr)

ok("make_update_kit.sh puts the script, update.json and the key in a folder outside the repo",
   all(s in open(os.path.join(APP, "tools", "make_update_kit.sh")).read() for s in ("enable-updates.sh", "update_key", "NeuroNet-ISO/update-kit")))

shutil.rmtree(t, ignore_errors=True)
print(f"\n  {passed} passed, {failed} failed\n")
raise SystemExit(1 if failed else 0)
