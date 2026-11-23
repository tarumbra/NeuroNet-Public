#!/bin/bash
# install-app.sh -- NeuroNet on an Arch computer running Hyprland, WITHOUT
# Omarchy: the app, NeuroPets and NeuroCafe, their commands, launcher entries
# and shortcuts. No desktop widgets, bar widget, themes or Omarchy menu --
# those are Omarchy's shell (system/install.sh does them, on Omarchy).
#
#   bash system/install-app.sh                 install (asks before changing anything)
#   bash system/install-app.sh --yes           ... without asking
#   bash system/install-app.sh --check         say what would change; change nothing
#   bash system/install-app.sh --data DIR      keep NeuroNet's data in DIR
#   bash system/install-app.sh --no-packages   don't install software, only report what's missing
#   bash system/install-app.sh --no-keys       no Hyprland shortcuts
#   bash system/install-app.sh --uninstall     take it out again
#   bash system/install-app.sh --desktop kde   KDE Plasma (found by itself when you're in it)
#
# Cam, 2026-10-14: "Lets say i want to move to CachyOS running hyperland DE,
# but i dont want any of the desktop widgets." Made for CachyOS; works on any
# Arch with Hyprland.
#
#   software   what integration/deps.txt lists, with pacman (the Omarchy-only
#              lines are skipped; python-pptx is from the AUR -- with yay or
#              paru if there is one, else it's only reported)
#   where      ~/.config/neuronet/paths.json, NeuroNet's commands in
#              ~/.local/bin and the launcher entries, by neuronet-setup --app-only
#   KDE        Plasma instead of Hyprland (2026-10-14, "please commence building
#              a KDE mode"): the same Super(Meta)+Alt keys as KDE global
#              shortcuts (~/.local/share/kglobalaccel/net.neuronet.shortcuts.desktop
#              -- they're under System Settings -> Shortcuts -> NeuroNet, to change),
#              any taken by KDE or one of its apps left out and named, and
#              NeuroNet started hidden at login (~/.config/autostart). The apps
#              show and hide their own windows there; neuronet-raise brings them
#              forward.
#   Hyprland   ~/.config/hypr/neuronet.lua or neuronet.conf -- whichever kind
#              of config this Hyprland uses -- and one line in hyprland.lua/.conf
#              that loads it: the shortcuts (any keys already taken are left
#              out), NeuroNet started hidden at login, its window rule. If
#              Hyprland reports errors, it's all put back as it was.
#
# Nothing is lost: a file it changes is kept as <file>.bak.<date>. NeuroNet's
# data is never touched -- by install or uninstall. Safe to run again.
set -euo pipefail

SYS="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="$(cd "$SYS/.." && pwd)"
HYPR="${XDG_CONFIG_HOME:-$HOME/.config}/hypr"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/neuronet"
RECORD="$STATE/install-app.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
BEGIN_L="-- >>> NeuroNet (install-app.sh)"; END_L="-- <<< NeuroNet (install-app.sh)"
BEGIN_C="# >>> NeuroNet (install-app.sh)";  END_C="# <<< NeuroNet (install-app.sh)"

YES="" CHECK="" DATA="" NOPKG="" NOKEYS="" UNINSTALL="" DESK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    --check) CHECK=1; shift ;;
    --data) DATA="${2:?folder}"; shift 2 ;;
    --no-packages) NOPKG=1; shift ;;
    --no-keys) NOKEYS=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --desktop) DESK="${2:?hyprland or kde}"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "install-app.sh: unknown option $1 (see --help)" >&2; exit 2 ;;
  esac
done

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
say()  { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[31minstall-app.sh: %s\033[0m\n' "$*" >&2; exit 1; }
would() { say "would $*"; }
ask() { [ -n "$YES" ] && return 0; read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }
# root in a container has no sudo; everyone else uses it
SUDO=(); [ "$(id -u)" = 0 ] || SUDO=(sudo)
hypr_live() { command -v hyprctl >/dev/null 2>&1 && hyprctl version >/dev/null 2>&1; }

# which kind of config this Hyprland reads: Lua (0.5x, Omarchy's) or hyprlang
if [ -f "$HYPR/hyprland.lua" ]; then KIND=lua; MAIN="$HYPR/hyprland.lua"; OURS="$HYPR/neuronet.lua"
  BEGIN="$BEGIN_L"; END="$END_L"
  LOADER='do local f = (os.getenv("XDG_CONFIG_HOME") or (os.getenv("HOME") .. "/.config")) .. "/hypr/neuronet.lua"; local h = io.open(f, "r"); if h then h:close(); dofile(f) end end'
else KIND=conf; MAIN="$HYPR/hyprland.conf"; OURS="$HYPR/neuronet.conf"
  BEGIN="$BEGIN_C"; END="$END_C"
  LOADER="source = $OURS"
fi

# Hyprland or KDE Plasma: as asked; else the one you're in; else what's installed
if [ -z "$DESK" ]; then
  case "${XDG_CURRENT_DESKTOP:-}" in
    *KDE*) DESK=kde ;;
    *Hyprland*) DESK=hyprland ;;
    *) if command -v plasmashell >/dev/null 2>&1 && ! command -v Hyprland >/dev/null 2>&1; then DESK=kde; else DESK=hyprland; fi ;;
  esac
fi
case "$DESK" in hyprland|kde) ;; *) die "--desktop is hyprland or kde" ;; esac
KAPPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
KFILE="$KAPPS/net.neuronet.shortcuts.desktop"
KLINK="${XDG_DATA_HOME:-$HOME/.local/share}/kglobalaccel/net.neuronet.shortcuts.desktop"
KAUTO="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/neuronet.desktop"

# take our block out of the main config (back to as it was before)
unload() {
  [ -f "$MAIN" ] && grep -qxF -e "$BEGIN" "$MAIN" || return 0
  cp -a "$MAIN" "$MAIN.bak.$STAMP"
  python3 - "$MAIN" "$BEGIN" "$END" <<'PY'
import sys
f, b, e = sys.argv[1:4]
out, skip = [], False
for l in open(f, encoding="utf-8").read().splitlines():
    if l == b: skip = True; continue
    if l == e: skip = False; continue
    if not skip: out.append(l)
while out and out[-1] == "": out.pop()
open(f, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
}

# ===================================================================== uninstall
if [ -n "$UNINSTALL" ]; then
  bold "Taking NeuroNet out"
  say "NeuroNet itself ($APP) and its data are left exactly where they are."
  if [ -z "$CHECK" ]; then ask "Go ahead?" || die "nothing was changed."; fi
  gone=( "$OURS" "$KFILE" "$KLINK" "$KAUTO" "$HOME/.local/share/applications/NeuroNet.desktop"
         "$HOME/.local/share/applications/NeuroPets.desktop" "$HOME/.local/share/applications/NeuroFarm.desktop" "$HOME/.local/share/applications/NeuroCafe.desktop" "$HOME/.local/share/applications/NeuroArcana.desktop" "$HOME/.local/share/applications/NeuroTrain.desktop" "$HOME/.local/share/applications/NeuroTV.desktop" "$HOME/.local/share/applications/NeuroStream.desktop" "$HOME/.local/share/applications/NeuroScribe.desktop"
         "$HOME/.config/systemd/user/neuronet-update.service" "$HOME/.config/systemd/user/neuronet-update.timer"
         "$HOME/.config/neuronet/paths.json" )
  for c in neuronet-path neuronet-doctor neuronet-update neuronet-quick neuronet-call neuronet-music neuronet-menu \
           neuronet-capture neuronet-snip neuronet-rotate neuronet-open neuronet-shell neuronet-desk-edit neuropets neuropets-call neurofarm neurofarm-call neurocafe neuroarcana neurotrain neurotv neurostream neuroscribe; do
    gone+=("$HOME/.local/bin/$c")
  done
  if [ -f "$MAIN" ] && grep -qxF -e "$BEGIN" "$MAIN"; then
    if [ -n "$CHECK" ]; then would "take the NeuroNet line out of $MAIN"
    else unload; say "Took the NeuroNet line out of $MAIN (backup: .bak.$STAMP)"; fi
  fi
  for f in "${gone[@]}"; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    if [ -n "$CHECK" ]; then would "remove $f"; else mv -- "$f" "$f.removed.$STAMP"; say "Removed $f (kept as .removed.$STAMP)"; fi
  done
  if [ -z "$CHECK" ]; then
    hypr_live && { hyprctl reload >/dev/null 2>&1 || true; }
    systemctl --user daemon-reload 2>/dev/null || true
    [ -f "$RECORD" ] && mv -- "$RECORD" "$RECORD.removed.$STAMP"
    bold "Done. NeuroNet and its data are still in $APP -- run python3 neuronet.py there, or install again."
  fi
  exit 0
fi

# ===================================================================== checks
[ -f "$APP/neuronet.py" ] || die "$APP isn't a NeuroNet folder."
command -v pacman >/dev/null || die "this isn't an Arch computer (no pacman)."
command -v python3 >/dev/null || [ -z "$NOPKG$CHECK" ] || die "python3 is missing (sudo pacman -S python)."
if command -v omarchy >/dev/null 2>&1; then
  warn "This computer has Omarchy: system/install.sh gives you the whole desktop layer."
  warn "install-app.sh still works here, but don't use both."
fi
if [ "$DESK" = hyprland ]; then
  command -v Hyprland >/dev/null 2>&1 || command -v hyprland >/dev/null 2>&1 \
    || warn "Hyprland isn't installed: NeuroNet will run, but its shortcuts need Hyprland."
fi

bold "NeuroNet (app only, $([ "$DESK" = kde ] && echo "KDE Plasma" || echo Hyprland)) -- $APP"
if [ -z "$CHECK" ]; then
  say "This installs NeuroNet's software, its commands and launcher entries, and its $([ "$DESK" = kde ] && echo "KDE" || echo Hyprland) shortcuts."
  ask "Go ahead?" || die "nothing was changed."
fi

# ------------------------------------------------------------- 1. software --
# files a release dropped (system/retired.txt): an update never deletes, so take them out here (2026-10-15)
bash "$SYS/retire.sh" "$APP" ${CHECK:+--check}

bold "1. Software"
pkgs=(); aur=(); missing=()
while read -r kind name how; do
  case "$kind" in ''|\#*) continue ;; esac
  ok=yes
  case "$kind" in
    cmd|optional) command -v "$name" >/dev/null 2>&1 || ok=no ;;
    python) python3 -c "import $name" >/dev/null 2>&1 || ok=no ;;
  esac
  [ "$ok" = yes ] && continue
  cmd=$(sed -E 's/ *\(.*$//' <<<"$how")
  case "$name" in uwsm-app|omarchy) continue ;; esac
  if [ "$DESK" = kde ]; then
    case "$name" in hyprctl|grim|slurp) continue ;; esac   # KDE: KWin and Spectacle instead
  else
    case "$name" in hyprctl) cmd="omarchy pkg add hyprland" ;; grim|slurp) cmd="omarchy pkg add $name" ;; esac
  fi
  case "$cmd" in
    "omarchy pkg aur add "*) read -ra p <<<"${cmd#omarchy pkg aur add }"; aur+=("${p[@]}") ;;
    "omarchy pkg add "*)     read -ra p <<<"${cmd#omarchy pkg add }"; pkgs+=("${p[@]}") ;;
    *) missing+=("$name -- $how") ;;
  esac
done < "$APP/integration/deps.txt"
# KDE: capture (Super+Alt+X) uses Spectacle, Plasma's own
[ "$DESK" = kde ] && ! command -v spectacle >/dev/null 2>&1 && pkgs+=(spectacle)
for m in "${missing[@]+"${missing[@]}"}"; do warn "missing: $m"; done
if [ ${#pkgs[@]} = 0 ] && [ ${#aur[@]} = 0 ]; then say "everything is here"
elif [ -n "$CHECK" ]; then
  [ ${#pkgs[@]} -gt 0 ] && would "install: ${pkgs[*]}"
  [ ${#aur[@]} -gt 0 ] && would "install from the AUR: ${aur[*]}"
elif [ -n "$NOPKG" ]; then
  [ ${#pkgs[@]} -gt 0 ] && warn "not installed (--no-packages): sudo pacman -S --needed ${pkgs[*]}"
  [ ${#aur[@]} -gt 0 ] && warn "not installed (--no-packages), from the AUR: ${aur[*]}"
else
  if [ ${#pkgs[@]} -gt 0 ]; then
    say "installing: ${pkgs[*]}"
    conf=(); [ -n "$YES" ] && conf=(--noconfirm)
    "${SUDO[@]}" pacman -S --needed "${conf[@]+"${conf[@]}"}" "${pkgs[@]}" || die "pacman couldn't install them (see above)."
  fi
  if [ ${#aur[@]} -gt 0 ]; then
    helper=$(command -v paru || command -v yay || true)
    if [ -n "$helper" ] && [ "$(id -u)" != 0 ]; then
      "$helper" -S --needed ${YES:+--noconfirm} "${aur[@]}" || warn "couldn't install ${aur[*]} from the AUR (PowerPoint export only)"
    else warn "not installed, from the AUR: ${aur[*]} (PowerPoint export only) -- paru -S ${aur[*]}"; fi
  fi
fi
# the one that matters most: without qtpy pywebview quietly falls back to GTK
# and the shortcuts can't find the window (see deps.txt)
if [ -z "$CHECK" ] && ! python3 -c "import webview, qtpy, PyQt6.QtWebEngineWidgets" >/dev/null 2>&1; then
  warn "NeuroNet's window libraries aren't all here yet (pywebview, qtpy, PyQt6 WebEngine) -- it won't open until they are."
fi

# ------------------------------------------------------------- 2. where --
bold "2. Commands and launcher entries"
setup=(bash "$SYS/bin/neuronet-setup" --app-only)
[ -n "$DATA" ] && setup+=(--data "$DATA")
[ -n "$CHECK" ] && setup+=(--check)
"${setup[@]}"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *)
  warn "~/.local/bin isn't on your PATH: the shortcuts use full paths, but to type neuronet-quick add it to your shell's PATH." ;; esac

# ------------------------------------------------------------- 3. shortcuts --
BIN="$HOME/.local/bin"
  # keys (mods key), what, command -- SUPER = 64, ALT = 8
  KEYS=$(cat <<EOF
N|NeuroScribe|$BIN/neuroscribe
B|Creative|$BIN/neuronet-quick creative
T|NeuroTrain|$BIN/neurotrain
W|NeuroStream|$BIN/neurostream
P|Photos|$BIN/neuronet-quick photos
M|M&T: music|$BIN/neuronet-quick music
C|Cashbox (Money)|$BIN/neuronet-quick money
H|Home|$BIN/neuronet-quick home
Z|Mindfulness|$BIN/neuronet-quick mind
Q|Puzzles|$BIN/neuronet-quick games
D|Divination|$BIN/neuronet-quick divination
I|M&T: media|$BIN/neuronet-quick stuff
R|Kitchen|$BIN/neuronet-quick cookery
E|Code (IDE)|$BIN/neuronet-quick code
O|NeuroNet (whole app; again to hide)|$BIN/neuronet-quick full
X|snip: into Photos and NeuroNet Snips|$BIN/neuronet-capture
backslash|music: play / pause|$BIN/neuronet-music play-pause
bracketright|music: next track|$BIN/neuronet-music next
bracketleft|music: previous track|$BIN/neuronet-music previous
G|NeuroPets (again to tuck it away)|$BIN/neuropets toggle
Y|NeuroArcana|$BIN/neuroarcana
J|NeuroCafe (again to tuck it away)|$BIN/neurocafe toggle
EOF
)

if [ "$DESK" = kde ]; then
  bold "3. KDE Plasma shortcuts"
  if [ -n "$NOKEYS" ]; then say "left alone (--no-keys)"
  else
    # the shortcuts file (KDE global shortcuts): written by Python, which also
    # finds the keys KDE or its apps already use -- the apps' own defaults
    # (share/kglobalaccel/*.desktop, e.g. Spectacle's Meta+Alt+R) and what's
    # set here (~/.config/kglobalshortcutsrc)
    out=$(KEYS="$KEYS" KFILE="$KFILE" CHECK="$CHECK" python3 - <<'KPY'
import configparser, glob, os, shutil, time
keys = [l.split("|", 2) for l in os.environ["KEYS"].splitlines() if l.strip()]
kfile, check = os.environ["KFILE"], os.environ["CHECK"]
mine = os.path.basename(kfile)
norm = lambda k: k.replace(" ", "").lower()
taken = {}
dirs = [os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")] + \
       (os.environ.get("XDG_DATA_DIRS") or "/usr/local/share:/usr/share").split(":")
for d in dirs:
    for f in sorted(glob.glob(os.path.join(d, "kglobalaccel", "*.desktop"))):
        if os.path.basename(f) == mine:
            continue
        cp = configparser.RawConfigParser(strict=False, interpolation=None)
        cp.optionxform = str
        try:
            cp.read(f, encoding="utf-8")
        except Exception:
            continue
        app = cp.get("Desktop Entry", "Name", fallback=os.path.basename(f))
        for sec in cp.sections():
            for k in cp.get(sec, "X-KDE-Shortcuts", fallback="").split(","):
                if k.strip():
                    what = app if sec == "Desktop Entry" else app + ": " + cp.get(sec, "Name", fallback=sec)
                    taken.setdefault(norm(k.replace("\\\\", "\\")), what)
rc = os.path.join(os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config"), "kglobalshortcutsrc")
section = ""
try:
    for line in open(rc, encoding="utf-8", errors="replace"):
        line = line.rstrip("\n")
        if line.startswith("["):
            section = line
            continue
        if "=" not in line or mine in section or line.startswith("_k_friendly_name"):
            continue
        name, val = line.split("=", 1)
        parts = val.split(",")
        for k in (parts[0] if parts else "").split("\t"):
            if k.strip() and k.strip() != "none":
                owner = section.strip("[]").split("][")[-1]
                taken.setdefault(norm(k), owner + ": " + (parts[2] if len(parts) > 2 else name))
except OSError:
    pass
KEYNAME = {"backslash": "\\", "bracketright": "]", "bracketleft": "["}
esc = lambda v: v.replace("\\", "\\\\")
main, actions, skipped = None, [], []
for i, (key, what, cmd) in enumerate(keys):
    shown = KEYNAME.get(key, key)
    k = "Meta+Alt+" + shown
    hit = taken.get(norm(k))
    if hit:
        skipped.append("Super+Alt+%s (%s) -- KDE already uses it for %s" % (shown, what, hit))
        k = ""
    if cmd.endswith("neuronet-quick full"):
        main = (k, cmd)
    else:
        actions.append(("a%d" % i, what, cmd, k))
text = ["[Desktop Entry]", "Type=Application", "Name=NeuroNet",
        "Comment=NeuroNet's keyboard shortcuts (system/install-app.sh writes this file; change the keys in System Settings -> Shortcuts)",
        "Exec=" + main[1], "NoDisplay=true", "StartupNotify=false",
        "Actions=" + ";".join(a[0] for a in actions) + ";"]
if main[0]:
    text.append("X-KDE-Shortcuts=" + esc(main[0]))
for aid, what, cmd, k in actions:
    text += ["", "[Desktop Action %s]" % aid, "Name=NeuroNet " + what, "Exec=" + cmd]
    if k:
        text.append("X-KDE-Shortcuts=" + esc(k))
text = "\n".join(text) + "\n"
for sk in skipped:
    print("skipped " + sk)
try:
    same = open(kfile, encoding="utf-8").read() == text
except OSError:
    same = False
if same:
    print("same")
elif check:
    print("would " + kfile)
else:
    os.makedirs(os.path.dirname(kfile), exist_ok=True)
    if os.path.exists(kfile):
        shutil.copy2(kfile, kfile + ".bak." + time.strftime("%Y%m%d-%H%M%S"))
    open(kfile, "w", encoding="utf-8").write(text)
    print("wrote " + kfile)
KPY
)
    while IFS= read -r l; do
      case "$l" in skipped\ *) warn "not added: ${l#skipped }" ;; same) say "shortcuts already in place" ;;
        would\ *) would "write ${l#would }" ;; wrote\ *) say "wrote ${l#wrote }" ;; "") ;; *) say "$l" ;; esac
    done <<<"$out"
    # KDE reads apps' shortcuts from kglobalaccel/ (as Spectacle's: a link to its launcher)
    if [ "$(readlink "$KLINK" 2>/dev/null)" != "$KFILE" ]; then
      if [ -n "$CHECK" ]; then would "link $KLINK"
      else mkdir -p "$(dirname "$KLINK")"; ln -sfn "$KFILE" "$KLINK"; say "linked $KLINK"; fi
    fi
    auto="[Desktop Entry]
Type=Application
Name=NeuroNet (in the background)
Comment=Starts NeuroNet hidden at login, so its reminders and timers run (system/install-app.sh)
Exec=$BIN/neuronet-quick start
NoDisplay=true
X-KDE-autostart-phase=2
"
    if [ -f "$KAUTO" ] && cmp -s "$KAUTO" <(printf '%s' "$auto"); then :
    elif [ -n "$CHECK" ]; then would "write $KAUTO (NeuroNet starts hidden at login)"
    else mkdir -p "$(dirname "$KAUTO")"; printf '%s' "$auto" > "$KAUTO"; say "wrote $KAUTO (NeuroNet starts hidden at login)"; fi
    if [ -z "$CHECK" ]; then
      # tell KDE now (it reads them at login too)
      for b in kbuildsycoca6 kbuildsycoca5; do command -v "$b" >/dev/null 2>&1 && { "$b" >/dev/null 2>&1 || true; break; }; done
      say "To change a key: System Settings -> Keyboard -> Shortcuts -> NeuroNet."
    fi
  fi
else
bold "3. Hyprland ($KIND config)"
if [ -n "$NOKEYS" ]; then say "left alone (--no-keys)"
elif [ ! -f "$MAIN" ]; then warn "no $MAIN -- start Hyprland once (it writes one), then run this again for the shortcuts."
else
  # keys already taken here (not by NeuroNet): read from the running Hyprland
  taken=""
  if hypr_live; then
    taken=$(hyprctl binds -j 2>/dev/null | jq -r '.[] | select((.arg // "") | test("neuronet|neuropets|neurofarm|neurocafe|neuroarcana|neurotrain|neurotv|neurostream|neuroscribe") | not)
              | "\(.modmask) \(.key | ascii_downcase)"' 2>/dev/null || true)
  fi
  body=""; skipped=()
  while IFS='|' read -r key what cmd; do
    k=$(tr '[:upper:]' '[:lower:]' <<<"$key")
    if grep -qx "72 $k" <<<"$taken"; then skipped+=("SUPER+ALT+$key ($what)"); continue; fi
    if [ "$KIND" = lua ]; then
      body+="hl.bind(\"SUPER + ALT + $key\", hl.dsp.exec_cmd(\"$cmd\"), { description = \"NeuroNet $what\" })"$'\n'
    else
      body+="bindd = SUPER ALT, $key, NeuroNet $what, exec, $cmd"$'\n'
    fi
  done <<<"$KEYS"
  if [ "$KIND" = lua ]; then
    text="-- NeuroNet's shortcuts and window (system/install-app.sh writes this file; run it again to remake it)
-- NeuroNet starts hidden at login, so its reminders and timers run
hl.on(\"hyprland.start\", function() hl.exec_cmd(\"$BIN/neuronet-quick start\") end)
-- only the main window (titled NeuroNet): it lives in its own special workspace, shown and hidden by the shortcuts
hl.window_rule({ match = { class = \"^(NeuroNet|neuronet[.]py)\$\", title = \"^NeuroNet\$\" }, workspace = \"special:neuronet silent\", float = true })
$body"
  else
    text="# NeuroNet's shortcuts and window (system/install-app.sh writes this file; run it again to remake it)
# NeuroNet starts hidden at login, so its reminders and timers run
exec-once = $BIN/neuronet-quick start
# only the main window (titled NeuroNet): it lives in its own special workspace, shown and hidden by the shortcuts
windowrule = match:class ^(NeuroNet|neuronet[.]py)\$, match:title ^NeuroNet\$, workspace special:neuronet silent, float on
$body"
  fi
  for s in "${skipped[@]+"${skipped[@]}"}"; do warn "not added, the keys are taken here: $s"; done
  if [ -f "$OURS" ] && cmp -s "$OURS" <(printf '%s' "$text"); then same_file=1; else same_file=""; fi
  loaded=""; grep -qxF -e "$BEGIN" "$MAIN" && loaded=1
  if [ -n "$same_file" ] && [ -n "$loaded" ]; then say "already in place"
  elif [ -n "$CHECK" ]; then
    [ -z "$same_file" ] && would "write $OURS"
    [ -z "$loaded" ] && would "add a line to $MAIN that loads it"
  else
    [ -f "$OURS" ] && [ -z "$same_file" ] && cp -a "$OURS" "$OURS.bak.$STAMP"
    printf '%s' "$text" > "$OURS"; say "wrote $OURS"
    if [ -z "$loaded" ]; then
      cp -a "$MAIN" "$MAIN.bak.$STAMP"
      printf '\n%s\n%s\n%s\n' "$BEGIN" "$LOADER" "$END" >> "$MAIN"
      say "$MAIN loads it (backup: .bak.$STAMP)"
    fi
    if hypr_live; then
      hyprctl reload >/dev/null 2>&1 || true
      errs=$(hyprctl configerrors 2>/dev/null | grep -v '^\s*$' || true)
      if [ -n "$errs" ] && grep -qi neuronet <<<"$errs"; then
        warn "Hyprland didn't like it, so it's put back as it was:"; printf '    %s\n' "$errs" | head -8
        unload; mv -- "$OURS" "$OURS.rejected.$STAMP"
        [ -f "$OURS.bak.$STAMP" ] && mv -- "$OURS.bak.$STAMP" "$OURS"
        hyprctl reload >/dev/null 2>&1 || true
      fi
    fi
  fi
fi
fi

# ------------------------------------------------------------- done --
if [ -n "$CHECK" ]; then bold "That's what it would do. Nothing was changed."; exit 0; fi
mkdir -p "$STATE"
# neuronet-update reads it: an update re-runs this installer, for the same desktop
jq -n --arg app "$APP" --arg desk "$DESK" --arg kind "$KIND" --arg when "$STAMP" \
  '{app: $app, desktop: $desk, hyprland: $kind, installed: $when}' > "$RECORD" 2>/dev/null \
  || printf '{"app": "%s", "desktop": "%s", "hyprland": "%s", "installed": "%s"}\n' "$APP" "$DESK" "$KIND" "$STAMP" > "$RECORD"
bold "Done. Open NeuroNet from your launcher or with Super+Alt+O; NeuroPets with Super+Alt+G."
say "Its data: $(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("data") or d["app"] + "/neuronet_data")' "${XDG_CONFIG_HOME:-$HOME/.config}/neuronet/paths.json" 2>/dev/null)"
say "Bringing your data from another computer: copy its neuronet_data folder there, with NeuroNet closed."
