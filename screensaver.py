"""The screensaver: NeuroNet's name, or Omarchy's.

Cam (2026-10-02): "Also something to move the application and system to be
closer to a whole app integration will be for a screen saver the same one as
omarchy but replace omarchy with the Neuronet logo. Still keep the old one as
well so i can change if i want to."

Omarchy's screensaver (omarchy-screensaver) plays random effects over the
text in ~/.config/omarchy/branding/screensaver.txt. So NeuroNet's is the same
screensaver with NeuroNet's name in that file -- block letters drawn like
Omarchy's own (system/omarchy/branding/screensaver-neuronet.txt).

The old one is kept: the first time NeuroNet's goes in, whatever was there
(Omarchy's logo, or Cam's own text) is saved beside it as
screensaver-omarchy.txt, and "omarchy" puts exactly that back -- or Omarchy's
own logo.txt if there's no copy.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
NEURONET_ART = os.path.join(HERE, "system", "omarchy", "branding", "screensaver-neuronet.txt")
CHOICES = ("neuronet", "omarchy")


def _paths(home=None):
    home = home or os.path.expanduser("~")
    branding = os.path.join(home, ".config", "omarchy", "branding")
    return {"live": os.path.join(branding, "screensaver.txt"),
            "kept": os.path.join(branding, "screensaver-omarchy.txt")}


def _omarchy_logo():
    return os.path.join(os.environ.get("OMARCHY_PATH") or "/usr/share/omarchy", "logo.txt")


def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return None


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def current(home=None):
    """"neuronet" when NeuroNet's name is the screensaver, else "omarchy"."""
    live, ours = _read(_paths(home)["live"]), _read(NEURONET_ART)
    return "neuronet" if live is not None and ours is not None and live.strip() == ours.strip() else "omarchy"


def use(which, home=None):
    """Make `which` ("neuronet" | "omarchy") the screensaver. {ok, using} or {error}."""
    if which not in CHOICES:
        return {"error": "There's no screensaver called %s." % which}
    p = _paths(home)
    if which == "neuronet":
        art = _read(NEURONET_ART)
        if art is None:
            return {"error": "NeuroNet's screensaver art is missing from this install."}
        live = _read(p["live"])
        # the old one, kept the first time (never overwritten with NeuroNet's)
        if live is not None and live.strip() != art.strip() and not os.path.exists(p["kept"]):
            _write(p["kept"], live)
        _write(p["live"], art)
    else:
        kept = _read(p["kept"])
        if kept is None:
            kept = _read(_omarchy_logo())
        if kept is None:
            return {"error": "Couldn't find Omarchy's screensaver to put back."}
        _write(p["live"], kept)
    return {"ok": True, "using": which}


def default_for_new_install(home=None):
    """The installer: NeuroNet's name -- but only over Omarchy's own, untouched
    logo (or none), never over text Cam wrote himself. -> True if it switched."""
    live, logo = _read(_paths(home)["live"]), _read(_omarchy_logo())
    if live is None or (logo is not None and live.strip() == logo.strip()):
        return bool(use("neuronet", home).get("ok"))
    return False


if __name__ == "__main__":                     # system/install.sh
    import sys
    if sys.argv[1:] == ["--default"]:
        print("switched" if default_for_new_install() else "kept")
    elif len(sys.argv) == 2 and sys.argv[1] in CHOICES:
        r = use(sys.argv[1])
        print(r.get("error") or "screensaver: " + r["using"])
    else:
        print("screensaver: " + current())
