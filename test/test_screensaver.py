"""The screensaver: NeuroNet's name in Omarchy's screensaver (screensaver.py).

Cam (2026-10-02): "a screen saver the same one as omarchy but replace omarchy
with the Neuronet logo. Still keep the old one as well so i can change if i
want to."

All in a made-up HOME and Omarchy folder -- never Cam's own branding.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil, subprocess, sys, tempfile

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


print("\nThe screensaver\n")
root = tempfile.mkdtemp(prefix="nn-saver-")
try:
    omarchy = os.path.join(root, "omarchy")
    os.makedirs(omarchy)
    LOGO = " OMARCHY LOGO \n"
    open(os.path.join(omarchy, "logo.txt"), "w").write(LOGO)
    os.environ["OMARCHY_PATH"] = omarchy
    import screensaver as sv
    art = open(sv.NEURONET_ART, encoding="utf-8").read()
    ok("NeuroNet's art is in the app, in Omarchy's block letters, about its size",
       "███" in art and "▄" in art and "▀" in art and len(art.splitlines()) == 8
       and max(len(l) for l in art.splitlines()) <= 100)

    home = os.path.join(root, "home")
    branding = os.path.join(home, ".config", "omarchy", "branding")
    live = os.path.join(branding, "screensaver.txt")
    kept = os.path.join(branding, "screensaver-omarchy.txt")
    read = lambda p: open(p, encoding="utf-8").read()

    os.makedirs(branding)
    open(live, "w").write(LOGO)
    ok("Omarchy's logo in place: it says omarchy", sv.current(home) == "omarchy")
    r = sv.use("neuronet", home)
    ok("switch to NeuroNet: NeuroNet's name is the screensaver", r.get("ok") and read(live) == art
       and sv.current(home) == "neuronet", r)
    ok("  and the old one is kept beside it", read(kept) == LOGO)
    sv.use("neuronet", home)
    ok("  switching again never overwrites the kept one with NeuroNet's", read(kept) == LOGO)
    r = sv.use("omarchy", home)
    ok("switch back: exactly the old one", r.get("ok") and read(live) == LOGO and sv.current(home) == "omarchy")

    # Cam's own words, not Omarchy's logo: kept and put back as they were
    shutil.rmtree(home)
    os.makedirs(branding)
    open(live, "w").write("Cam's own words\n")
    sv.use("neuronet", home)
    sv.use("omarchy", home)
    ok("text Cam wrote himself comes back as he wrote it", read(live) == "Cam's own words\n")
    ok("the installer never replaces text Cam wrote", sv.default_for_new_install(home) is False
       and read(live) == "Cam's own words\n")

    # a new install: Omarchy's untouched logo, or nothing at all
    shutil.rmtree(home)
    os.makedirs(branding)
    open(live, "w").write(LOGO)
    ok("a new install with Omarchy's own logo gets NeuroNet's", sv.default_for_new_install(home) is True
       and sv.current(home) == "neuronet" and read(kept) == LOGO)
    shutil.rmtree(home)
    ok("  and so does one with none yet", sv.default_for_new_install(home) is True and sv.current(home) == "neuronet")
    ok("  'omarchy' with no kept copy uses Omarchy's logo.txt", sv.use("omarchy", home).get("ok") and read(live) == LOGO)
    ok("an unknown name is refused", "error" in sv.use("matrix", home))

    # the installer's command line
    shutil.rmtree(home)
    os.makedirs(branding)
    open(live, "w").write(LOGO)
    env = dict(os.environ, HOME=home, OMARCHY_PATH=omarchy)
    outp = subprocess.run([sys.executable, os.path.join(APP, "screensaver.py"), "--default"],
                          env=env, capture_output=True, text=True).stdout.strip()
    ok("install.sh's call switches a new install", outp == "switched" and read(live) == art, outp)
    inst = read(os.path.join(APP, "system", "install.sh"))
    ok("  and install.sh makes it", 'screensaver.py" --default' in inst)
finally:
    shutil.rmtree(root, ignore_errors=True)

ui = open(os.path.join(APP, "ui", "widgets", "widgets.js"), encoding="utf-8").read()
ok("Settings -> Screensaver has the choice and a preview",
   'data-saver="neuronet"' in ui and 'data-saver="omarchy"' in ui and "screensaver_preview" in ui)
api = __import__("backend_src").backend_source(APP)
ok("  backed by the Api", all(f"def {n}(self" in api for n in ("screensaver_get", "screensaver_set", "screensaver_preview")))

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
