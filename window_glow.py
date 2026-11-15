"""Glowing window borders in every Omarchy theme.

Cam (2026-10-02): "I like how the neuronet theme has a light up border around
the windows, are you able to provide a toggle switch that then overrides each
themes windows border behavious to do the same in the respective themes ...
apply this for every theme that is saved at this present time on the machine
(use these as the apps default supported themes with respective colours). All
new ones will default to a random colour if the setting is turned on."

THE LOOK is the NeuroNet theme's (~/.config/omarchy/themes/neuronet/
hyprland.lua): the focused window's border a two-colour gradient at 45°, a
soft glow round it in the first colour, the others dim.

THE COLOURS. system/omarchy/glow-themes.json -- every theme on Cam's desktop
on 2026-10-02, two colours each, taken from the theme itself (its own border
gradient where it has one, else its accent and its cyan). Made once by
`python3 window_glow.py --build`; those are NeuroNet's supported themes. A
theme added since gets a colour picked from its name: random-looking, but
the same every time, so it doesn't change at each reload.

HOW. Settings -> Appearance -> Glowing window borders writes
~/.local/state/neuronet/glow.lua (the colours + a little Lua that reads the
current theme's name) and reloads Hyprland. The NeuroNet block in
~/.config/hypr/hyprland.lua dofile()s it after Omarchy's defaults and the
theme -- so it overrides the theme's border, and a theme switch needs nothing
from NeuroNet. Switched off, the file sets nothing and each theme's own border
is back.
"""
import json
import os
import re
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
PALETTE_FILE = os.path.join(HERE, "system", "omarchy", "glow-themes.json")


def _home(home=None):
    return home or os.path.expanduser("~")


def lua_path(home=None):
    return os.path.join(_home(home), ".local", "state", "neuronet", "glow.lua")


def settings_path(home=None):
    return os.path.join(_home(home), ".config", "omarchy", "neuronet-glow.json")


# ------------------------------------------------------------- the colours

_HEX = re.compile(r"#?([0-9a-fA-F]{6})")
_RGBA = re.compile(r"rgba?\(\s*([0-9a-fA-F]{6})")


def _toml_colours(path):
    out = {}
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                m = re.match(r'\s*([a-z_]+)\s*=\s*"([^"]*)"', line)
                if m:
                    out[m.group(1)] = m.group(2)
    except OSError:
        pass
    return out


def _border_colours(text):
    return [c.lower() for c in _RGBA.findall(text or "")]


def theme_colours(theme_dir):
    """Two colours for one theme folder, from the theme itself, or None."""
    t = _toml_colours(os.path.join(theme_dir, "colors.toml"))
    grad = _border_colours(t.get("hyprland_active_border", ""))
    if not grad:
        for name in ("hyprland.lua", "hyprland.conf"):
            try:
                with open(os.path.join(theme_dir, name), encoding="utf-8") as f:
                    src = f.read()
            except OSError:
                continue
            m = re.search(r"active_border[^\n]*", src)
            if m:
                grad = _border_colours(m.group(0))
                if not grad:                       # a variable: find where it's set
                    var = re.search(r"(\$?\w+)\s*$", m.group(0).strip())
                    if var:
                        d = re.search(re.escape(var.group(1)) + r"\s*=\s*([^\n]*)", src)
                        grad = _border_colours(d.group(1)) if d else []
            if grad:
                break
    accent = _HEX.match(t.get("accent", "") or "")
    first = accent.group(1).lower() if accent else (grad[0] if grad else None)
    if not first:
        return None
    second = None
    for g in grad:
        if g != first:
            second = g
            break
    if not second:
        for key in ("cyan", "bright_cyan", "blue", "magenta"):
            m = _HEX.match(t.get(key, "") or "")
            if m and m.group(1).lower() != first:
                second = m.group(1).lower()
                break
    return [first, second or _lighter(first)]


def _lighter(hex6, k=0.45):
    r, g, b = (int(hex6[i:i + 2], 16) for i in (0, 2, 4))
    return "%02x%02x%02x" % tuple(int(v + (255 - v) * k) for v in (r, g, b))


def theme_dirs(home=None):
    """Every installed theme folder, by name (Cam's own over Omarchy's)."""
    found = {}
    for base in (os.path.join(os.environ.get("OMARCHY_PATH") or "/usr/share/omarchy", "themes"),
                 os.path.join(_home(home), ".config", "omarchy", "themes")):
        try:
            for name in sorted(os.listdir(base)):
                p = os.path.join(base, name)
                if os.path.isdir(p):
                    found[name] = p
        except OSError:
            pass
    return found


def build_palette(home=None):
    """{theme: [colour, colour]} for every theme installed now."""
    out = {}
    for name, d in sorted(theme_dirs(home).items()):
        c = theme_colours(d)
        if c:
            out[name] = c
    return out


def palette():
    try:
        with open(PALETTE_FILE, encoding="utf-8") as f:
            d = json.load(f)
        return {k: v for k, v in d.get("themes", {}).items() if isinstance(v, list) and len(v) == 2}
    except (OSError, ValueError):
        return {}


def name_colours(name):
    """A theme NeuroNet doesn't know: two bright colours from its name -- the
    same rule as the Lua (glow.lua), so the panel shows what the border does."""
    h = 0
    for ch in name.encode("utf-8"):
        h = (h * 31 + ch) % 2147483647
    hue = h % 360
    return [_hsl(hue, 0.75, 0.58), _hsl((hue + 150) % 360, 0.85, 0.62)]


def _hsl(h, s, l):
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h // 60) % 6]
    return "%02x%02x%02x" % tuple(int(round((v + m) * 255)) for v in (r, g, b))


# ------------------------------------------------------------- the switch

def is_on(home=None):
    try:
        with open(settings_path(home), encoding="utf-8") as f:
            return bool(json.load(f).get("on"))
    except (OSError, ValueError):
        return False


def lua_source(on, pal):
    rows = "\n".join('  ["%s"] = { "%s", "%s" },' % (k.replace('"', ''), a, b) for k, (a, b) in sorted(pal.items()))
    return """-- NeuroNet: glowing window borders in every theme (window_glow.py).
-- Made by NeuroNet -- Settings -> Appearance -> Glowing window borders.
-- Loaded by the NeuroNet block in ~/.config/hypr/hyprland.lua, after the theme.
local on = %s
if not on then return end

local colours = {
%s
}

local function theme_name()
  local state = os.getenv("XDG_STATE_HOME") or (os.getenv("HOME") .. "/.local/state")
  local f = io.open(state .. "/omarchy/current/theme.name", "r")
  if not f then return "" end
  local n = (f:read("l") or ""):gsub("%%s+$", "")
  f:close()
  return n
end

-- a theme NeuroNet doesn't know: two bright colours from its name (as window_glow.py)
local function hsl(h, s, l)
  local c = (1 - math.abs(2 * l - 1)) * s
  local x = c * (1 - math.abs((h / 60) %% 2 - 1))
  local m = l - c / 2
  local t = ({ {c, x, 0}, {x, c, 0}, {0, c, x}, {0, x, c}, {x, 0, c}, {c, 0, x} })[math.floor(h / 60) %% 6 + 1]
  return string.format("%%02x%%02x%%02x", math.floor((t[1] + m) * 255 + 0.5),
    math.floor((t[2] + m) * 255 + 0.5), math.floor((t[3] + m) * 255 + 0.5))
end
local function from_name(name)
  local h = 0
  for i = 1, #name do h = (h * 31 + name:byte(i)) %% 2147483647 end
  local hue = h %% 360
  return { hsl(hue, 0.75, 0.58), hsl((hue + 150) %% 360, 0.85, 0.62) }
end

local name = theme_name()
local c = colours[name] or from_name(name)
local active = { colors = { "rgba(" .. c[1] .. "ff)", "rgba(" .. c[2] .. "ff)" }, angle = 45 }
local inactive = "rgba(" .. c[1] .. "33)"

hl.config({
  general = { col = { active_border = active, inactive_border = inactive } },
  group = { col = { border_active = active, border_inactive = inactive } },
  decoration = {
    shadow = {
      enabled = true,
      range = 14,
      render_power = 3,
      color = "rgba(" .. c[1] .. "66)",
      color_inactive = "rgba(00000099)",
    },
  },
})
""" % ("true" if on else "false", rows)


def write_lua(on, home=None):
    p = lua_path(home)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(lua_source(on, palette()))
    os.replace(tmp, p)
    return p


def set_on(on, home=None, reload=True):
    """Switch the glow on or off for every theme. {ok, on} or {error}."""
    on = bool(on)
    try:
        sp = settings_path(home)
        os.makedirs(os.path.dirname(sp), exist_ok=True)
        with open(sp + ".tmp", "w", encoding="utf-8") as f:
            json.dump({"on": on}, f, indent=1)
        os.replace(sp + ".tmp", sp)
        write_lua(on, home)
    except OSError as e:
        return {"error": "Couldn't save the setting: %s" % e}
    if reload:
        try:
            subprocess.run(["hyprctl", "reload"], capture_output=True, timeout=10)
        except (OSError, subprocess.SubprocessError):
            pass
    return {"ok": True, "on": on}


def listing(home=None):
    """For Settings: on/off, the current theme, and every installed theme with
    the colours its border will glow in (supported, or picked from its name)."""
    pal = palette()
    state = os.environ.get("XDG_STATE_HOME") or os.path.join(_home(home), ".local", "state")
    try:
        with open(os.path.join(state, "omarchy", "current", "theme.name"), encoding="utf-8") as f:
            current = f.read().strip()
    except OSError:
        current = ""
    names = sorted(set(theme_dirs(home)) | set(pal))
    themes = [{"name": n, "colours": ["#" + c for c in (pal.get(n) or name_colours(n))],
               "supported": n in pal} for n in names]
    return {"on": is_on(home), "current": current, "themes": themes}


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["--build"]:
        pal = build_palette()
        os.makedirs(os.path.dirname(PALETTE_FILE), exist_ok=True)
        with open(PALETTE_FILE, "w", encoding="utf-8") as f:
            json.dump({"made": "2026-10-02", "note": "Every Omarchy theme on Cam's desktop then: "
                       "NeuroNet's supported themes for the window glow (window_glow.py).",
                       "themes": pal}, f, indent=1, sort_keys=True)
            f.write("\n")
        print("%d themes" % len(pal))
    elif sys.argv[1:] == ["--refresh"]:            # install.sh: the Lua file for this NeuroNet
        write_lua(is_on())
        print("glow: %s" % ("on" if is_on() else "off"))
    else:
        print(json.dumps(listing(), indent=1))
