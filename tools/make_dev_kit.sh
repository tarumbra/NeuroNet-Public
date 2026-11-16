#!/bin/bash
# make_dev_kit.sh -- the folder that makes another computer a NeuroNet workstation (2026-10-24, Cam's laptop:
# "I want to be able to work on the laptop like this PC").
#
#   bash tools/make_dev_kit.sh [DIR] [--no-github] [--name NAME]     default DIR: /mnt/Cams_Collective/NeuroNet-laptop-dev
#
#   --name NAME   which computer it's for ("ThinkPad"): names its key on GitHub and its own memory note there
#                 (16 Nov 2026, the third workstation; without it, "second workstation" as before)
#
# Puts system/enable-dev.sh beside:
#   dev.json         the repository (ssh) and the name/email commits are made with
#   dev_key(.pub)    a NEW developer key, made here and added to the repository on GitHub as a deploy key
#                    WITH WRITE ACCESS (with `gh`, logged in on this computer) -- it can push to NeuroNet's
#                    repository and nothing else; remove it any time: GitHub > NeuroNet > Settings > Deploy keys.
#                    (--no-github: make the key but don't add it -- for tests, or to add it by hand)
#   art/<folder>/    the games' art folders in ~/Pictures (the sheets the cutters read): NeuroCafe, NeuroFarm,
#                    NeuroPets, its reference UI, the pixel pet art
#   claude-memory/   Claude Code's memory of the project, from this computer
#   apps/<App>/      the standalone apps (NeuroCafe, NeuroCode, NeuroArcana, NeuroTrain, NeuroTV) as git clones of
#                    this computer's ~/Work copies, pointing at GitHub -- no node_modules or builds (16 Nov 2026)
# Send the folder to that computer (LocalSend, a USB stick), then there:  bash enable-dev.sh
# The kit holds a key that can push: delete the folder when you're done (the computer keeps its own copy).
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
OUT="" GITHUB="1" NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-github) GITHUB=""; shift ;;
    --name) NAME="${2:?a name}"; shift 2 ;;
    *) OUT="$1"; shift ;;
  esac
done
KEYNAME="${NAME:-second workstation}"
APPS_SRC="${NEURO_APPS_DIR:-$HOME/Work}"
APPS=(NeuroCafe NeuroCode NeuroArcana NeuroTrain NeuroTV)
OUT="${OUT:-/mnt/Cams_Collective/NeuroNet-laptop-dev}"
MEMORY="${NEURONET_CLAUDE_MEMORY:-$HOME/.claude/projects/-home-cam-Work/memory}"
ARTROOT="${NEURONET_ART:-$HOME/Pictures}"
ART_FOLDERS=("NeuroCafe Art Assets" "NeuroFarm Art Assets" "NeuroPets Art Assets" "NeuroPets Reference UI" "Pixel Pet Asset Art")

url=$(git -C "$HERE" remote get-url origin)
slug=$(printf '%s' "$url" | sed -E 's#^(https://github.com/|git@github.com:)##; s#\.git$##')
[[ "$slug" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "can't tell the GitHub repository from $url" >&2; exit 1; }
mkdir -p "$OUT"
install -m 755 "$HERE/system/enable-dev.sh" "$OUT/enable-dev.sh"
install -m 755 "$HERE/system/bin/neuronet-dev" "$OUT/neuronet-dev"
jq -n --arg repo "git@github.com:$slug.git" --arg name "$(git -C "$HERE" config user.name)" --arg email "$(git -C "$HERE" config user.email)" \
  --arg machine "$NAME" '{repo: $repo, name: $name, email: $email} + (if $machine == "" then {} else {machine: $machine} end)' > "$OUT/dev.json"

if [ ! -f "$OUT/dev_key" ]; then
  ssh-keygen -q -t ed25519 -N "" -C "NeuroNet developer: $KEYNAME ($(date +%Y-%m-%d))" -f "$OUT/dev_key"
  chmod 600 "$OUT/dev_key"
  if [ -n "$GITHUB" ]; then
    gh repo deploy-key add "$OUT/dev_key.pub" --allow-write -R "$slug" --title "NeuroNet developer: $KEYNAME ($(date +%Y-%m-%d))"
    echo "added to $slug as a deploy key that can push"
  else
    echo "(--no-github: the key isn't on GitHub -- add $OUT/dev_key.pub to $slug > Settings > Deploy keys, with write access)"
  fi
else
  echo "(the kit has a key already: $OUT/dev_key)"
fi

mkdir -p "$OUT/art"
for f in "${ART_FOLDERS[@]}"; do [ -d "$ARTROOT/$f" ] && rsync -a --delete "$ARTROOT/$f/" "$OUT/art/$f/"; done
if [ -d "$MEMORY" ]; then mkdir -p "$OUT/claude-memory" && rsync -a --delete "$MEMORY/" "$OUT/claude-memory/"; fi

# the standalone apps: fresh clones of the committed work here, pointing at GitHub like the originals
mkdir -p "$OUT/apps"
for a in "${APPS[@]}"; do
  src="$APPS_SRC/$a"
  [ -d "$src/.git" ] || continue
  rm -rf "$OUT/apps/$a"
  git clone -q --no-hardlinks "$src" "$OUT/apps/$a"
  remote=$(git -C "$src" remote get-url origin 2>/dev/null || true)
  [ -n "$remote" ] && git -C "$OUT/apps/$a" remote set-url origin "$remote"
  echo "app: $a ($(git -C "$OUT/apps/$a" log -1 --format=%h))"
done

cat > "$OUT/README.txt" <<TXT
NeuroNet: make this computer a NeuroNet workstation${NAME:+ ($NAME)} (like the PC: change the code, commit, push, release)

On that computer, logged in as yourself, CLOSE NeuroNet and NeuroCafe, open a terminal in this folder and run:

    bash enable-dev.sh

It finds NeuroNet, asks before changing anything, and:
  - makes the NeuroNet folder a git checkout of main (the code there now is kept first in
    ~/.local/state/neuronet/before-dev/; NeuroNet's DATA is never touched)
  - puts the developer key in ~/.ssh/neuronet_dev (it can push to NeuroNet's repository, nothing else)
  - commits as $(git -C "$HERE" config user.name) <$(git -C "$HERE" config user.email)>
  - switches the daily auto-update off (a checkout is updated with git: neuronet-dev pull)
  - merges the games' art folders (NeuroCafe, NeuroFarm, NeuroPets...) into ~/Pictures
  - gives Claude Code its memory of the project (start Claude Code in ~/Work; another folder: --claude-dir DIR)
  - puts the standalone apps (NeuroCafe, NeuroCode, NeuroArcana, NeuroTrain, NeuroTV) in ~/Work if they aren't there,
    and builds NeuroTV. Their GitHub repositories are private: run  gh auth login  once so they can update and push.
To only see what it would do:  bash enable-dev.sh --check
If it can't find NeuroNet:  bash enable-dev.sh --app /path/to/NeuroNet

Then, on either computer:  neuronet-dev pull  before you start;  git commit  and  git push  when you finish.
Work on one computer at a time, and push before switching.

This folder holds a key that can PUSH to NeuroNet's repository: delete it when you're done (the computer keeps its
own copy). If it's ever lost, remove it on GitHub: NeuroNet > Settings > Deploy keys.
TXT
echo "developer kit: $OUT ($(du -sh "$OUT" | cut -f1))"
