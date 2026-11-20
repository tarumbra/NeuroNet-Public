#!/bin/bash
# enable-dev.sh -- make this computer a second NeuroNet workstation (2026-10-24, Cam: "I want to be able
# to work on the laptop like this PC. It is now my second workstation").
#
# Run it ON that computer, as the person who uses NeuroNet (not root), from the developer kit folder
# (tools/make_dev_kit.sh makes it: this script + dev.json + dev_key + art/ + claude-memory/):
#
#   bash enable-dev.sh                      find NeuroNet, ask before changing anything
#   bash enable-dev.sh --app DIR            NeuroNet is in DIR
#   bash enable-dev.sh --claude-dir DIR     the folder you start Claude Code in (default ~/Work)
#   bash enable-dev.sh --yes                don't ask (still stops on anything wrong)
#   bash enable-dev.sh --check              say what it would do, change nothing
#
# What it does:
#   1. finds the NeuroNet folder (--app, ~/.config/neuronet/paths.json, or the usual places) and its
#      data folder -- NEURONET'S DATA IS NEVER TOUCHED
#   2. makes sure the tools are there: git, jq, rsync, ssh, python3 (+ Pillow), node, chromium
#      (offers to install what's missing with pacman)
#   3. puts the DEVELOPER KEY in ~/.ssh/neuronet_dev (it can push to NeuroNet's GitHub repository, and
#      nothing else) and checks GitHub answers with it
#   4. makes the NeuroNet folder a git checkout of main, in place: the code there now is kept first in
#      ~/.local/state/neuronet/before-dev/, then main's code is checked out over it (the data folder,
#      the log and anything git ignores stay as they are). The checkout pushes with the developer key.
#   5. sets the name and email commits are made with (in this checkout only)
#   6. puts the desktop layer in again for this code (as neuronet-update does)
#   7. switches the daily update check off -- a checkout is updated with git: `neuronet-dev pull`
#   8. copies the games' art folders (art/<folder>: NeuroCafe, NeuroFarm, NeuroPets...) into ~/Pictures -- merged,
#      nothing deleted
#   9. copies Claude's memory of the project (claude-memory/) to ~/.claude/projects/<the folder>/memory,
#      merged (a file that differs here is kept beside it), with a note of this computer's folders
#      (workstation_laptop.md, or workstation_<machine>.md when dev.json names the machine)
#  10. puts the standalone apps (apps/<App>) in ~/Work when they aren't there yet (never over one that is),
#      and builds NeuroTV (qmake6); neuronet-dev pull installs their node packages
# After that: `neuronet-dev pull` before you start, commit and `git push` when you're done -- on either
# computer. Releases (tools/make_starter.py, the tags) can be made from here too.
set -uo pipefail

HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
CONFDIR="${XDG_CONFIG_HOME:-$HOME/.config}/neuronet"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/neuronet"
APP="" YES="" CHECK="" CLAUDE_DIR="$HOME/Work"
while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="${2:?folder}"; shift 2 ;;
    --claude-dir) CLAUDE_DIR="${2:?folder}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    --check) CHECK=1; shift ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "enable-dev: I don't know \"$1\" (try --help)" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1m==>\033[0m %s\n' "$*"; }
ok()   { printf '    \033[32mok\033[0m  %s\n' "$*"; }
warn() { printf '    \033[33m!!\033[0m  %s\n' "$*"; }
die()  { printf '\033[31menable-dev: %s\033[0m\n' "$*" >&2; exit 1; }
ask()  { [ -n "$YES" ] || [ -n "$CHECK" ] && return 0
         [ -t 0 ] || die "it needs to ask first -- run it in a terminal, or with --yes"
         read -r -p "    $1 [Y/n] " a; [ -z "$a" ] || [[ "$a" =~ ^[Yy] ]]; }
would() { [ -n "$CHECK" ] && { echo "    (would) $*"; return 0; }; return 1; }
jget() { jq -r "$1 // empty" "$2" 2>/dev/null; }

[ "$(id -u)" -ne 0 ] || die "run it as the person who uses NeuroNet, not as root (no sudo)"
[ -f "$HERE/dev.json" ] || die "no dev.json beside this script -- run it from the developer kit folder"
REPO=$(jget .repo "$HERE/dev.json"); NAME=$(jget .name "$HERE/dev.json"); EMAIL=$(jget .email "$HERE/dev.json")
[ -n "$REPO" ] || die "dev.json has no repo"

# ---- 1. where NeuroNet is ------------------------------------------------------------------
say "Finding NeuroNet"
if [ -z "$APP" ] && [ -f "$CONFDIR/paths.json" ]; then APP=$(jget .app "$CONFDIR/paths.json"); fi
if [ -z "$APP" ]; then
  for d in "$HOME/Data_Drive/NeuroNet" "$HOME/DataDrive/NeuroNet" "$HOME/NeuroNet" "$HOME/Documents/NeuroNet" /mnt/*/NeuroNet; do
    [ -f "$d/neuronet.py" ] && { APP="$d"; break; }
  done
fi
[ -n "$APP" ] && [ -f "$APP/neuronet.py" ] || die "couldn't find NeuroNet -- give its folder: bash enable-dev.sh --app /path/to/NeuroNet"
APP="$(realpath -- "$APP")"
case "$APP" in /|/usr|/etc|/home|/mnt|/var|/opt|"$(realpath -m -- "$HOME")") die "$APP isn't a NeuroNet folder of its own -- not touching it" ;; esac
DATA=""
[ -f "$CONFDIR/paths.json" ] && DATA=$(jget .data "$CONFDIR/paths.json")
[ -n "$DATA" ] || DATA="$APP/neuronet_data"
ok "NeuroNet: $APP ($(tr -d ' \n' < "$APP/VERSION" 2>/dev/null || echo "no VERSION"))"
ok "its data: $DATA (never touched)"
ALREADY=""; [ -e "$APP/.git" ] && ALREADY=1 && ok "it's a git checkout already -- only the rest is set up"

# ---- 2. tools --------------------------------------------------------------------------------
say "Checking the tools"
missing=()
for t in git jq rsync ssh python3 node; do command -v "$t" >/dev/null || missing+=("$t"); done
command -v chromium >/dev/null || command -v chromium-browser >/dev/null || missing+=(chromium)
python3 -c 'import PIL' 2>/dev/null || missing+=(python-pillow)
if [ ${#missing[@]} -eq 0 ]; then ok "git, jq, rsync, ssh, python3 + Pillow, node, chromium"
else
  warn "missing: ${missing[*]}"
  pkgs=(); for m in "${missing[@]}"; do case "$m" in ssh) pkgs+=(openssh) ;; node) pkgs+=(nodejs) ;; python3) pkgs+=(python) ;; *) pkgs+=("$m") ;; esac; done
  if command -v pacman >/dev/null && ask "install ${pkgs[*]} with pacman (it asks for your password)?"; then
    would "sudo pacman -S --needed ${pkgs[*]}" || sudo pacman -S --needed --noconfirm "${pkgs[@]}" || die "couldn't install ${pkgs[*]}"
  fi
  for t in git jq rsync ssh; do command -v "$t" >/dev/null || [ -n "$CHECK" ] || die "$t is needed"; done
fi

# ---- 3. the developer key ------------------------------------------------------------------
say "The developer key"
KEY="$HOME/.ssh/neuronet_dev"
SSHC=""
if [ -f "$HERE/dev_key" ]; then
  if would "copy dev_key to $KEY (600)"; then :; else
    mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
    install -m 600 "$HERE/dev_key" "$KEY"
    [ -f "$HERE/dev_key.pub" ] && install -m 644 "$HERE/dev_key.pub" "$KEY.pub"
  fi
  SSHC="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  ok "$KEY -- pushes to NeuroNet's repository only (remove it on GitHub: Settings > Deploy keys)"
else
  warn "no dev_key in the kit: this computer's own GitHub login will be used"
fi
if [ -z "$CHECK" ]; then
  tip=$(GIT_SSH_COMMAND="${SSHC:-ssh}" git ls-remote "$REPO" refs/heads/main 2>&1 | awk '$1 ~ /^[0-9a-f]{40}$/ {print $1}' | head -1)
  [[ "$tip" =~ ^[0-9a-f]{40}$ ]] || die "GitHub didn't answer with the key ($REPO): $tip"
  ok "GitHub answers: main is at ${tip:0:7}"
fi

# ---- 4. the checkout -------------------------------------------------------------------------
say "Making $APP a git checkout of main"
if [ -n "$ALREADY" ]; then ok "(it is one)"
elif ask "keep the code that's there now, then check out main over it? (the data isn't touched)"; then
  excl=(--exclude=/neuronet_data --exclude=/neuronet.log --exclude=/library_path.txt --exclude='*.bak' --exclude=__pycache__)
  case "$DATA" in "$APP"/*) excl+=("--exclude=/${DATA#"$APP"/}") ;; esac
  if would "keep the code in $STATE/before-dev/, git init, fetch main and the release tags, check out main"; then :; else
    rm -rf "$STATE/before-dev"; mkdir -p "$STATE/before-dev"
    rsync -a "${excl[@]}" "$APP/" "$STATE/before-dev/" || die "couldn't keep the current code -- nothing changed"
    ok "the code there now is kept in $STATE/before-dev/"
    ( cd "$APP" && git init -q -b main && git remote add origin "$REPO" \
      && { [ -z "$SSHC" ] || git config core.sshCommand "$SSHC"; } \
      && GIT_SSH_COMMAND="${SSHC:-ssh}" git fetch -q origin main 'refs/tags/v*:refs/tags/v*' \
      && git checkout -q -f -B main origin/main && git branch -q -u origin/main main ) \
      || die "the checkout didn't finish -- the code before is in $STATE/before-dev/ (copy it back with rsync -a)"
    [ -d "$DATA" ] && ok "the data folder is still there: $DATA"
    ok "$APP is main ($(cd "$APP" && git log -1 --format='%h %s' | cut -c1-70))"
  fi
else die "stopped: nothing changed"; fi
if [ -n "$ALREADY" ] && [ -n "$SSHC" ] && [ -z "$CHECK" ]; then git -C "$APP" config core.sshCommand "$SSHC"; ok "the checkout pushes with the developer key"; fi

# ---- 5. who commits ----------------------------------------------------------------------------
if [ -n "$NAME" ] && [ -n "$EMAIL" ]; then
  would "git config user.name \"$NAME\" / user.email $EMAIL (this checkout only)" || { git -C "$APP" config user.name "$NAME"; git -C "$APP" config user.email "$EMAIL"; }
  ok "commits as $NAME <$EMAIL>"
fi

# ---- 6. the desktop layer, for this code --------------------------------------------------------
say "The desktop layer"
if would "put the desktop layer in again (install.sh / install-app.sh, as neuronet-update does)"; then :
elif [ -f "$STATE/install-app.json" ]; then
  desk=$(jget .desktop "$STATE/install-app.json")
  bash "$APP/system/install-app.sh" --yes --no-packages ${desk:+--desktop "$desk"} >/dev/null 2>&1 && ok "shortcuts and launchers again" || warn "the shortcuts and launchers didn't fully update (run system/install-app.sh)"
else
  bash "$APP/system/install.sh" --yes --offline --no-start >/dev/null 2>&1 && ok "the desktop layer again" || warn "the desktop layer didn't fully update (run system/install.sh)"
fi
mkdir -p "$HOME/.local/bin" 2>/dev/null
if [ -f "$APP/system/bin/neuronet-dev" ]; then
  would "link neuronet-dev into ~/.local/bin" || ln -sf "$APP/system/bin/neuronet-dev" "$HOME/.local/bin/neuronet-dev"
  ok "neuronet-dev (pull, status) in ~/.local/bin"
elif [ -f "$HERE/neuronet-dev" ]; then                       # (main from before it was pushed: the kit's copy)
  would "put the kit's neuronet-dev in ~/.local/bin" || install -m 755 "$HERE/neuronet-dev" "$HOME/.local/bin/neuronet-dev"
  ok "neuronet-dev (pull, status) in ~/.local/bin (the kit's copy)"
fi

# ---- 7. the daily update check: off ----------------------------------------------------------------
say "Automatic updates"
if would "systemctl --user disable --now neuronet-update.timer"; then :; else
  systemctl --user disable --now neuronet-update.timer >/dev/null 2>&1
  ok "the daily update check is off (it never updates a checkout anyway): neuronet-dev pull instead"
fi

# ---- 8. the art -----------------------------------------------------------------------------------
if [ -d "$HERE/art" ]; then
  say "The games' art"
  for f in "$HERE/art/"*/; do
    [ -d "$f" ] || continue
    n=$(basename "$f"); ART="$HOME/Pictures/$n"
    would "merge art/$n into $ART (newer files over older, nothing deleted)" || { mkdir -p "$ART" && rsync -a --update "$f" "$ART/" && ok "$n -> $ART"; }
  done
fi

# ---- 9. Claude's memory ------------------------------------------------------------------------------
if [ -d "$HERE/claude-memory" ]; then
  say "Claude's memory of the project"
  key=$(printf '%s' "$(realpath -m -- "$CLAUDE_DIR")" | sed 's#[^A-Za-z0-9]#-#g')
  MEM="$HOME/.claude/projects/$key/memory"
  if would "merge claude-memory/ into $MEM (start Claude Code in $CLAUDE_DIR)"; then :; else
    mkdir -p "$MEM" "$CLAUDE_DIR"
    stamp=$(date +%Y%m%d-%H%M%S)
    for f in "$HERE/claude-memory/"*; do
      n=$(basename "$f"); [ -f "$f" ] || continue
      if [ -f "$MEM/$n" ] && ! cmp -s "$f" "$MEM/$n"; then cp -p "$MEM/$n" "$MEM/$n.laptop-$stamp"; fi
      cp -p "$f" "$MEM/$n"
    done
    MACHINE=$(jget .machine "$HERE/dev.json")
    if [ -n "$MACHINE" ]; then
      slug=$(printf '%s' "$MACHINE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')
      NOTE="workstation_${slug//-/_}.md" NOTENAME="workstation-$slug" WHO="$MACHINE"
    else
      NOTE="workstation_laptop.md" NOTENAME="workstation-laptop" WHO="the laptop"
    fi
    cat > "$MEM/$NOTE" <<MD
---
name: $NOTENAME
description: this is Cam's workstation '$WHO' (set up from a dev kit) -- where NeuroNet, its data and the art are here, vs the PC's paths in the other notes
metadata:
  type: project
---
Set up by system/enable-dev.sh on $(date +%Y-%m-%d) (this computer: $WHO; host $(hostname 2>/dev/null || cat /etc/hostname)). The other memory notes were written on the PC, whose paths differ:
- NeuroNet (a git checkout of main, pushes with ~/.ssh/neuronet_dev): **$APP** (on the PC: /mnt/Cams_Collective/NeuroNet)
- its data: **$DATA** (on the PC: /mnt/Cams_Collective/NeuroNet/neuronet_data)
- the games' art (NeuroCafe/NeuroFarm/NeuroPets Art Assets...): **$HOME/Pictures/** (on the PC: /home/cam/Pictures/)
- the starter-files worktree for releases: ~/.cache/neuronet-starter-files (tools/make_starter.py makes it here)

**Why:** Cam works on both computers. **How to apply:** \`neuronet-dev pull\` before starting; commit and push when done, so the other computer can pull. Releases can be made here too, but the starter data is built from THIS computer's data -- release from whichever computer has the newest Collaboration notes, recipes and training. Never \`git push --force\`. See [[project-neuronet]], [[project-neurocafe]].
MD
    grep -q "$NOTE" "$MEM/MEMORY.md" 2>/dev/null || printf '%s\n' "- [Workstation: $WHO]($NOTE) — the computer '$WHO': its NeuroNet/data/art paths vs the PC's" >> "$MEM/MEMORY.md"
    ok "merged into $MEM (start Claude Code in $CLAUDE_DIR)"
  fi
fi

# ---- 10. the standalone apps ---------------------------------------------------------------------------
if [ -d "$HERE/apps" ]; then
  say "The standalone apps"
  WORKDIR="${NEURO_APPS_DIR:-$HOME/Work}"
  for f in "$HERE/apps/"*/; do
    [ -d "$f/.git" ] || continue
    n=$(basename "$f"); dest="$WORKDIR/$n"
    if [ -e "$dest" ]; then ok "$n: already in $WORKDIR (left as it is)"; continue; fi
    would "copy apps/$n to $dest" && continue
    mkdir -p "$WORKDIR" && cp -a "$f" "$dest" && ok "$n -> $dest"
    if [ "$n" = NeuroTV ] && [ -x "$dest/bin/build" ]; then
      if command -v qmake6 >/dev/null; then
        (cd "$dest" && sh bin/build >/dev/null 2>&1) && ok "NeuroStream built (Super+Alt+W)" || warn "NeuroStream didn't build: run bin/build in $dest"
      else warn "NeuroStream needs qt6-base, qt6-declarative and mpv to build: then run bin/build in $dest"; fi
    fi
  done
  command -v gh >/dev/null && gh auth status >/dev/null 2>&1 || warn "the apps' GitHub repositories are private: run  gh auth login  once, so neuronet-dev pull can update them"
fi

echo
say "Done. Before you start work:  neuronet-dev pull      When you finish:  git commit, then git push"
say "To make this computer's data a copy of the main PC's (the pictures, the decks, the games' saves):  neuronet-dev mirror setup cam@<the PC's address>, then neuronet-dev mirror copy"
[ -n "$CHECK" ] && echo "    (--check: nothing was changed)"
exit 0
