"""Glowing window borders in every theme (window_glow.py), and the desktop
widgets' see-through slider (desktop_widgets.get/set_opacity).

Cam (2026-10-02): "I like how the neuronet theme has a light up border around
the windows, are you able to provide a toggle switch that then overrides each
themes windows border behavious to do the same in the respective themes ...
All new ones will default to a random colour" -- and "desktop widgets
settings have the ability to adjust the opaque and transparent slider".

Everything in a made-up HOME; Hyprland is never reloaded here. The generated
Lua is run by a real Lua (lua5.4) with a stand-in for Hyprland's hl.config.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
sys.path.insert(0, APP)
PLUG = os.path.join(APP, "system", "omarchy", "plugins")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


def read(*p):
    with open(os.path.join(*p), encoding="utf-8") as f:
        return f.read()


print("\nGlowing window borders, and the widgets' slider\n")
import window_glow as wg  # noqa: E402

pal = wg.palette()
ok("NeuroNet knows the themes that were on Cam's desktop (38 on 2026-10-02)", len(pal) == 38, len(pal))
ok("  NeuroNet's own glow exactly as its theme draws it (green into cyan)",
   pal.get("neuronet") == ["5fa665", "00e5ff"] and pal.get("neuronet-light") == ["2e6b38", "007c8c"])
ok("  each with two colours of its own", all(len(v) == 2 and v[0] != v[1]
   and all(re.fullmatch(r"[0-9a-f]{6}", c) for c in v) for v in pal.values()))
ok("  e.g. a stock theme: accent and its cyan (nord)", pal.get("nord") == ["81a1c1", "88c0d0"])
ok("a new theme gets colours picked from its name -- the same each time",
   wg.name_colours("brand-new") == wg.name_colours("brand-new") != wg.name_colours("another"))

home = tempfile.mkdtemp(prefix="nn-glow-")
try:
    # a made-up computer: one supported theme, one new one
    themes = os.path.join(home, ".config", "omarchy", "themes")
    for t in ("nord", "my-new-theme"):
        os.makedirs(os.path.join(themes, t))
    st = os.path.join(home, ".local", "state", "omarchy", "current")
    os.makedirs(st)
    open(os.path.join(st, "theme.name"), "w").write("my-new-theme\n")
    os.environ["XDG_STATE_HOME"] = os.path.join(home, ".local", "state")
    L = wg.listing(home)
    by = {t["name"]: t for t in L["themes"]}
    ok("Settings lists every theme, off to start, the current one marked",
       L["on"] is False and L["current"] == "my-new-theme" and "nord" in by and "my-new-theme" in by)
    ok("  a supported one with its own colours, a new one marked new with its picked ones",
       by["nord"]["supported"] and by["nord"]["colours"] == ["#81a1c1", "#88c0d0"]
       and not by["my-new-theme"]["supported"]
       and by["my-new-theme"]["colours"] == ["#" + c for c in wg.name_colours("my-new-theme")])
    r = wg.set_on(True, home, reload=False)
    lua = wg.lua_path(home)
    ok("switching it on saves it and writes the Lua Hyprland loads", r == {"ok": True, "on": True}
       and wg.is_on(home) and os.path.exists(lua) and "local on = true" in read(lua))
    wg.set_on(False, home, reload=False)
    ok("  off: the Lua sets nothing (each theme's own border back)", "local on = false" in read(lua) and not wg.is_on(home))

    if shutil.which("lua5.4") or shutil.which("lua"):
        exe = shutil.which("lua5.4") or shutil.which("lua")
        run = os.path.join(home, "run.lua")
        open(run, "w").write('hl = { config = function(t) local a = t.general.col.active_border\n'
                             '  print(a.colors[1] .. " " .. a.colors[2] .. " " .. a.angle .. " " .. t.decoration.shadow.color) end }\n'
                             'dofile(arg[1])\n')
        env = dict(os.environ, XDG_STATE_HOME=os.path.join(home, ".local", "state"))
        def glow(theme, on=True):
            open(os.path.join(st, "theme.name"), "w").write(theme + "\n")
            open(lua, "w").write(wg.lua_source(on, pal))
            return subprocess.run([exe, run, lua], env=env, capture_output=True, text=True).stdout.strip()
        ok("in Hyprland: nord glows in nord's colours, as the NeuroNet theme does",
           glow("nord") == "rgba(81a1c1ff) rgba(88c0d0ff) 45 rgba(81a1c166)", glow("nord"))
        a, b = wg.name_colours("my-new-theme")
        ok("  a new theme in its picked colours (Lua and Python agree)",
           glow("my-new-theme") == "rgba(%sff) rgba(%sff) 45 rgba(%s66)" % (a, b, a), glow("my-new-theme"))
        ok("  switched off: nothing", glow("nord", on=False) == "")
    else:
        print("  skip  the Lua in a real Lua (none here)")
finally:
    os.environ.pop("XDG_STATE_HOME", None)
    shutil.rmtree(home, ignore_errors=True)

block = read(APP, "system", "hypr", "hyprland.lua.block")
ok("the NeuroNet block in hyprland.lua loads it after the theme, only if it's there",
   'local f = os.getenv("HOME") .. "/.local/state/neuronet/glow.lua"' in block and "dofile(f)" in block
   and "\n" not in [l for l in block.splitlines() if "dofile" in l][0])
ok("  and install.sh makes it for each computer", 'window_glow.py" --refresh' in read(APP, "system", "install.sh"))
ui = read(APP, "ui", "widgets", "widgets.js")
ok("Settings -> Appearance has the switch and every theme's swatch",
   "window_glow_get" in ui and "window_glow_set" in ui and "glow-sw" in ui
   and 'id="set-glow"' in read(APP, "ui", "app.js"))

ok("the desktop widgets' slider went with them (3 Nov 2026)", "dw-glass" not in ui)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
