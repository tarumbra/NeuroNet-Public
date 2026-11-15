"""The NeuroNet ISO's pieces (system/iso/, NeuroNet System plan Stage 5).

  * the neuronet package's depends cover everything integration/deps.txt
    installs from Arch's own repositories (so the ISO's offline mirror has it)
  * neuronet-firstboot: runs install.sh --offline once per person, copies
    NeuroNet to ~/NeuroNet, gives a NEW NeuroNet the desktop's theme, never
    touches existing settings, and never runs twice
  * customize.py still applies to Omarchy's ISO builder (when a checkout is
    at ~/NeuroNet-VM/omarchy-iso or $OMARCHY_ISO_CHECKOUT)
All in temporary folders; the full ISO build and install are checked in the
VM (system/vm/README.md)."""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISO = os.path.join(APP, "system", "iso")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


# ---- the package's depends ---------------------------------------------------------
pkgbuild = open(os.path.join(ISO, "pkg", "PKGBUILD")).read()
depends = set(re.search(r"^depends=\(([^)]*)\)", pkgbuild, re.M).group(1).split())
wanted = set()
for line in open(os.path.join(APP, "integration", "deps.txt")):
    if line.startswith("#") or not line.strip():
        continue
    kind = line.split()[0]
    m = re.search(r"omarchy pkg add ([a-z0-9 .-]+?)(\s+\(|$)", line)
    if kind in ("cmd", "python") and m:
        wanted |= set(m.group(1).split())
missing = sorted(wanted - depends)
ok("the package depends on every required library deps.txt installs from Arch", not missing, missing)
ok("  and the AUR's python-pptx is only optional (the offline mirror can't carry it)",
   "python-pptx" not in depends and "python-pptx" in pkgbuild)

# ---- neuronet-firstboot -------------------------------------------------------------
t = tempfile.mkdtemp(prefix="nn-firstboot-")
home, src, stub = os.path.join(t, "home"), os.path.join(t, "opt", "NeuroNet"), os.path.join(t, "bin")  # t/opt = /opt/neuronet
for d in (home, os.path.join(src, "system"), stub):
    os.makedirs(d)
open(os.path.join(src, "neuronet.py"), "w").write("# NeuroNet\n")
# a stand-in install.sh: says how it was run, and writes paths.json as the real one does
open(os.path.join(src, "system", "install.sh"), "w").write(
    '#!/bin/bash\necho "install.sh $*" >> "$HOME/../calls.log"\n'
    'mkdir -p "$HOME/.config/neuronet"\n'
    'echo "{\\"app\\": \\"$HOME/NeuroNet\\", \\"data\\": \\"$HOME/NeuroNet/neuronet_data\\"}" > "$HOME/.config/neuronet/paths.json"\n')
for name, body in {"pgrep": "#!/bin/sh\nexit 0\n",
                   "neuronet-quick": '#!/bin/sh\necho "neuronet-quick $*" >> "$HOME/../calls.log"\n',
                   "notify-send": '#!/bin/sh\necho "notify $*" >> "$HOME/../calls.log"\n'}.items():
    open(os.path.join(stub, name), "w").write(body)
    os.chmod(os.path.join(stub, name), 0o755)
env = dict(os.environ, HOME=home, PATH=stub + ":" + os.environ["PATH"], USER="someone",
           XDG_STATE_HOME=os.path.join(home, ".local", "state"), XDG_CONFIG_HOME=os.path.join(home, ".config"),
           NEURONET_FIRSTBOOT_SRC=src, NEURONET_FIRSTBOOT_SETTLE="0")
fb = os.path.join(ISO, "neuronet-firstboot")
calls = os.path.join(t, "calls.log")


def run_fb():
    return subprocess.run(["bash", fb], env=env, capture_output=True, text=True, timeout=60)


r = run_fb()
log = open(calls).read() if os.path.exists(calls) else ""
prefs = os.path.join(home, "NeuroNet", "neuronet_data", "neuronet_prefs.json")
ok("first login: NeuroNet copied to ~/NeuroNet", os.path.isfile(os.path.join(home, "NeuroNet", "neuronet.py")), r.stderr)
ok("  install.sh run offline, without asking, and NeuroNet started after",
   "install.sh --yes --offline --no-start" in log and log.index("install.sh") < log.index("neuronet-quick start"), log)
ok("  a new NeuroNet takes the desktop's theme (Follow Omarchy)",
   os.path.isfile(prefs) and json.load(open(prefs)) == {"theme": "omarchy"})
ok("  and it's marked done", os.path.exists(os.path.join(home, ".local", "state", "neuronet", "firstboot.done")))
open(calls, "w").close()
run_fb()
ok("the next login it does nothing", open(calls).read() == "")

# someone with a NeuroNet already: settings kept
os.remove(os.path.join(home, ".local", "state", "neuronet", "firstboot.done"))
json.dump({"theme": "plum", "view": "photos"}, open(prefs, "w"))
run_fb()
ok("existing settings are never touched", json.load(open(prefs)) == {"theme": "plum", "view": "photos"})

# a package with an update set-up: this person's, key private, daily check on
os.remove(os.path.join(home, ".local", "state", "neuronet", "firstboot.done"))
opt = os.path.join(t, "opt")
open(os.path.join(opt, "update.json"), "w").write('{"repo": "git@github.com:someone/NeuroNet.git"}')
open(os.path.join(opt, "update_key"), "w").write("-----KEY-----\n")
open(os.path.join(stub, "neuronet-update"), "w").write('#!/bin/sh\necho "neuronet-update $*" >> "$HOME/../calls.log"\n')
os.chmod(os.path.join(stub, "neuronet-update"), 0o755)
env["NEURONET_FIRSTBOOT_OPT"] = opt
open(calls, "w").close()
run_fb()
conf = os.path.join(home, ".config", "neuronet")
u = json.load(open(os.path.join(conf, "update.json")))
ok("updates: the repository and a key of their own, private to them",
   u == {"repo": "git@github.com:someone/NeuroNet.git", "key": os.path.join(conf, "update_key")}
   and oct(os.stat(os.path.join(conf, "update_key")).st_mode & 0o777) == "0o600", u)
ok("  and the daily check switched on", "neuronet-update --enable" in open(calls).read())
os.remove(os.path.join(opt, "update.json"))

# install.sh failing: says so, not marked done
os.remove(os.path.join(home, ".local", "state", "neuronet", "firstboot.done"))
open(os.path.join(home, "NeuroNet", "system", "install.sh"), "w").write("#!/bin/bash\nexit 3\n")
open(calls, "w").close()
r = run_fb()
ok("if the set-up fails it says so, and tries again next login",
   r.returncode != 0 and "notify" in open(calls).read()
   and not os.path.exists(os.path.join(home, ".local", "state", "neuronet", "firstboot.done")))
shutil.rmtree(t)

# ---- customize.py on Omarchy's builder -----------------------------------------------
checkout = os.environ.get("OMARCHY_ISO_CHECKOUT", os.path.expanduser("~/NeuroNet-VM/omarchy-iso"))
if os.path.isdir(os.path.join(checkout, ".git")):
    t = tempfile.mkdtemp(prefix="nn-iso-")
    subprocess.run(["git", "clone", "-q", checkout, t + "/o"], check=True)
    r = subprocess.run([sys.executable, os.path.join(ISO, "customize.py"), t + "/o"], capture_output=True, text=True)
    ok("customize.py applies to omarchy-iso as it is", r.returncode == 0, (r.stdout + r.stderr)[-400:])
    pkgs = open(t + "/o/builder/archinstall.packages").read().split()
    ok("  the offline mirror carries neuronet and its depends",
       "neuronet" in pkgs and all(d in pkgs for d in depends))
    b0 = open(t + "/o/builder/build-iso.sh").read()
    ok("  and the installer INSTALLS neuronet (added to the ISO's omarchy-base.packages, which it installs)",
       re.search(r'omarchy-base\.packages"\n# NeuroNet[^\n]*\nprintf .*neuronet.*>> "\$build_cache_dir/airootfs/usr/share/omarchy-iso/omarchy-base\.packages"', b0) is not None)
    ok("  the ISO is called NeuroNet", 'iso_name="neuronet"' in open(t + "/o/configs/profiledef.sh").read()
       and "NeuroNet" in open(t + "/o/configs/grub/grub.cfg").read())
    b = open(t + "/o/builder/build-iso.sh").read()
    ok("  the offline mirror takes the local package and doesn't try to download it",
       "/neuronet-pkgs/neuronet-*.pkg.tar.zst" in b and "grep -Fxv neuronet" in b)
    ok("  and asks for T2 Mac firmware by its new name (apple-bcm-firmware-fetcher)",
       "s/^apple-bcm-firmware$/apple-bcm-firmware-fetcher/" in b)
    r2 = subprocess.run(["bash", "-n", t + "/o/builder/build-iso.sh"], capture_output=True, text=True)
    r3 = subprocess.run(["bash", "-n", t + "/o/bin/omarchy-iso-make"], capture_output=True, text=True)
    ok("  and the edited scripts still parse", r2.returncode == 0 and r3.returncode == 0, r2.stderr + r3.stderr)
    shutil.rmtree(t)
else:
    print("  skip  no omarchy-iso checkout for customize.py")

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
