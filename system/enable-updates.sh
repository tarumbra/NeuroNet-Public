#!/bin/bash
# enable-updates.sh -- switch on NeuroNet's automatic updates on a computer that was set up
# before the auto-update ISO (2026-10-21, Cam: "set Manthies' computer to update from github --
# her pc was set up prior to the auto update iso").
#
# Run it ON that computer, as the person who uses NeuroNet (not root), from the update kit
# folder (tools/make_update_kit.sh makes it: this script + update.json + update_key):
#
#   bash enable-updates.sh                 find NeuroNet, ask before changing anything
#   bash enable-updates.sh --app DIR       NeuroNet is in DIR
#   bash enable-updates.sh --yes           don't ask (still stops on anything wrong)
#   bash enable-updates.sh --check         say what it would do, change nothing
#
# What it does:
#   1. finds the NeuroNet folder (--app, ~/.config/neuronet/paths.json, or the usual places)
#      and refuses a git checkout (that one's updated with git)
#   2. makes sure git, jq, rsync and ssh are there (offers to install them with pacman)
#   3. puts the repository and its READ-ONLY key in ~/.config/neuronet/ (update.json,
#      update_key -- the same as a computer from the ISO gets at its first login)
#   4. checks GitHub answers with that key, and says which release is newest
#   5. writes ~/.config/neuronet/paths.json if this NeuroNet is older than it
#   6. runs the NEWEST release's own neuronet-update once: the current code is kept in
#      ~/.local/state/neuronet/previous, the new code copied over it, the desktop layer
#      put in again (system/install.sh, or install-app.sh where NeuroNet was set up without
#      Omarchy) -- NeuroNet's DATA FOLDER IS NEVER TOUCHED
#   7. switches the daily check on (neuronet-update --enable)
# After that it's like any computer from the ISO: `neuronet-update --check` says what it has.
set -uo pipefail

HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
CONFDIR="${XDG_CONFIG_HOME:-$HOME/.config}/neuronet"
APP="" YES="" CHECK=""
while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="${2:?folder}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    --check) CHECK=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "enable-updates: I don't know \"$1\" (try --help)" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[32mok\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33m!!\033[0m  %s\n' "$*"; }
die()  { printf '\033[31menable-updates: %s\033[0m\n' "$*" >&2; exit 1; }
ask()  { [ -n "$YES" ] || [ -n "$CHECK" ] && return 0
         [ -t 0 ] || die "it needs to ask first -- run it in a terminal, or with --yes"
         read -r -p "    $1 [Y/n] " a; [ -z "$a" ] || [[ "$a" =~ ^[Yy] ]]; }

[ "$(id -u)" -ne 0 ] || die "run it as the person who uses NeuroNet, not as root (no sudo)"

# ---- 1. where NeuroNet is ------------------------------------------------------------------
say "Finding NeuroNet"
if [ -z "$APP" ] && [ -f "$CONFDIR/paths.json" ]; then
  APP=$(jq -r '.app // empty' "$CONFDIR/paths.json" 2>/dev/null || python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("app",""))' "$CONFDIR/paths.json")
fi
if [ -z "$APP" ]; then
  for d in "$HOME/Data_Drive/NeuroNet" "$HOME/DataDrive/NeuroNet" "$HOME/NeuroNet" "$HOME/Documents/NeuroNet" /mnt/*/NeuroNet; do
    [ -f "$d/neuronet.py" ] && { APP="$d"; break; }
  done
fi
[ -n "$APP" ] || die "couldn't find NeuroNet -- run it again with --app /the/NeuroNet/folder"
APP="$(realpath -m -- "$APP")"
[ -f "$APP/neuronet.py" ] || die "$APP has no neuronet.py -- that isn't a NeuroNet folder"
case "$APP" in /|/home|/mnt|/usr|/usr/*|/etc|/var|/opt|"$(realpath -m -- "$HOME")") die "$APP can't be NeuroNet's folder" ;; esac
[ -e "$APP/.git" ] && die "$APP is a git checkout -- that one's updated with git, not automatically"
DATA="$APP/neuronet_data"
if [ -f "$CONFDIR/paths.json" ]; then
  d=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("data") or "")' "$CONFDIR/paths.json" 2>/dev/null)
  [ -n "$d" ] && DATA="$d"
fi
have=$(tr -d ' \n' 2>/dev/null < "$APP/VERSION"); have="${have:-older than 1.0 (no VERSION file)}"
ok "NeuroNet: $APP"
ok "its data: $DATA (never touched)"
ok "installed: $have"
ask "Is that the right NeuroNet?" || die "stopped -- run it with --app /the/right/folder"

# ---- 2. the tools it needs -------------------------------------------------------------------
say "Checking the tools"
missing=()
for t in git jq rsync ssh python3; do command -v "$t" >/dev/null || missing+=("$t"); done
if [ ${#missing[@]} -gt 0 ]; then
  pk=(); for t in "${missing[@]}"; do case "$t" in ssh) pk+=(openssh) ;; *) pk+=("$t") ;; esac; done
  warn "missing: ${missing[*]}"
  [ -n "$CHECK" ] && { warn "(--check: would install ${pk[*]})"; } || {
    command -v pacman >/dev/null || die "install ${pk[*]} and run this again"
    ask "Install ${pk[*]} now (asks for your password)?" || die "stopped -- install ${pk[*]} first"
    sudo pacman -S --needed --noconfirm "${pk[@]}" || die "couldn't install ${pk[*]}"
  }
fi
ok "git, jq, rsync, ssh, python3"

# ---- 3. the repository and its read-only key ---------------------------------------------
say "The update settings"
[ -f "$HERE/update.json" ] || die "no update.json beside this script -- run it from the update kit (tools/make_update_kit.sh)"
repo=$(jq -r '.repo // empty' "$HERE/update.json"); [ -n "$repo" ] || die "update.json beside this script has no repo"
ok "repository: $repo"
if [ -n "$CHECK" ]; then
  ok "(--check: would write $CONFDIR/update.json and update_key)"
else
  mkdir -p "$CONFDIR"
  if [ -f "$HERE/update_key" ]; then
    install -m 600 "$HERE/update_key" "$CONFDIR/update_key"
    jq --arg k "$CONFDIR/update_key" '.key = $k' "$HERE/update.json" > "$CONFDIR/update.json.new" && mv "$CONFDIR/update.json.new" "$CONFDIR/update.json"
  else
    warn "no update_key beside this script: using this computer's own ssh key for GitHub"
    jq 'del(.key)' "$HERE/update.json" > "$CONFDIR/update.json"
  fi
  ok "written: $CONFDIR/update.json"
fi

# ---- 4. can it reach GitHub? ------------------------------------------------------------------
say "Asking GitHub for the newest release"
key="$CONFDIR/update_key"; [ -n "$CHECK" ] && key="$HERE/update_key"
[ -f "$key" ] && export GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes"
newest=$(git ls-remote --tags --refs "$repo" 'v*' 2>/dev/null | sed -n 's#.*refs/tags/v##p' | grep -E '^[0-9]+(\.[0-9]+)*$' | sort -V | tail -1)
[ -n "$newest" ] || die "GitHub didn't answer (no internet, or the key isn't accepted) -- nothing else changed"
ok "newest release: $newest"
[ -n "$CHECK" ] && { say "--check: stopping here. Without --check it updates NeuroNet $have -> $newest and switches the daily check on."; exit 0; }

# ---- 5. paths.json (NeuroNet before 2026-09-29 didn't have it) ------------------------------
if [ ! -f "$CONFDIR/paths.json" ]; then
  jq -n --arg a "$APP" --arg d "$DATA" '{app: $a, data: $d}' > "$CONFDIR/paths.json"
  ok "written: $CONFDIR/paths.json"
fi

# ---- 6. the first update, by the newest release's own updater --------------------------------
say "Updating NeuroNet $have -> $newest"
ask "Go ahead? (your data stays exactly as it is; the old code is kept)" || die "stopped before updating -- the settings are in place; run neuronet-update later"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
git -c advice.detachedHead=false clone -q --depth 1 --branch "v$newest" "$repo" "$work/rel" || die "couldn't download v$newest -- nothing changed"
chmod +x "$work/rel/system/bin/"* 2>/dev/null
# its neuronet-update finds NeuroNet with its own neuronet-path (this computer's may be missing or older)
PATH="$work/rel/system/bin:$HOME/.local/bin:$PATH" bash "$work/rel/system/bin/neuronet-update" \
  || die "the update didn't finish -- see above (the old code is in ~/.local/state/neuronet/previous)"

# ---- 7. the daily check -----------------------------------------------------------------------
say "Switching the daily update check on"
export PATH="$HOME/.local/bin:$PATH"
if command -v neuronet-update >/dev/null; then
  neuronet-update --enable || warn "couldn't switch the daily check on -- run: neuronet-update --enable"
else
  bash "$APP/system/bin/neuronet-setup" --app "$APP" --data "$DATA" >/dev/null && neuronet-update --enable \
    || warn "couldn't switch the daily check on -- run: bash $APP/system/bin/neuronet-setup, then neuronet-update --enable"
fi
say "Done: NeuroNet $(tr -d ' \n' < "$APP/VERSION" 2>/dev/null) -- it now checks GitHub for a newer release every day."
echo "    neuronet-update --check   shows what's installed and what's newest"
echo "    If NeuroNet was open, close it and open it again to use the new version."
