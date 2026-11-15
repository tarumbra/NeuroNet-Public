#!/usr/bin/env bash
# Builds the zip Cam installs. It REFUSES to ship a data folder.
#
# That matters more now than it used to. neuronet_data/ lives INSIDE the
# app folder (Cam: "so it lives together"), which means an update is
# unzipped straight over it. A data folder inside the zip would land on
# top of the real one -- at best shadowing it, at worst overwriting a
# library of photos, music, saved games and training with an old or empty
# copy. With no data folder in the zip, unzipping an update over an
# existing install cannot touch the data at all.
#
# The other half of the protection is not in code: never DELETE the old
# NeuroNet folder and drop a new one in. That takes the data with it.
# See the README, "Updating NeuroNet".
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="/mnt/user-data/outputs"
STAGE="$(mktemp -d)"
DEST="$STAGE/NeuroNet"
mkdir -p "$DEST" "$OUT"

# tar rather than rsync: rsync is not on every machine and this has to
# build wherever Cam runs it.
(cd "$HERE" && tar -cf - \
   --exclude='__pycache__' --exclude='./.[!.]*' --exclude='*_data' \
   --exclude='node_modules' --exclude='library_path.txt' \
   --exclude='*_prefs.json' \
   --exclude='*.zip' --exclude='*.log' \
   --exclude='./Movies' --exclude='./movies' --exclude='./Movie' \
   --exclude='./movie' --exclude='./Films' --exclude='./films' \
   --exclude='./kincrux_money' --exclude='./cashbox_data' --exclude='./camily_data' \
   --exclude='./cookery_data' --exclude='./kincrux_cookery' .) | (cd "$DEST" && tar -xf -)
# kincrux_money/ and friends: data folders from before everything moved into
# neuronet_data/ (see adopt_outside_data). kincrux_money/ in particular sat in
# the app folder without a *_data name, so every update zip carried Cam's
# money file -- and unzipping one over the install put that old copy back.
# Movies/: Cam's films, for the Shelf's Play button (media_shelf.py). Gigabytes
# each, and his -- an update must neither carry them nor, unzipped over the
# install, have anything to do with them.
# *.log: the first-launch data move writes neuronet.log into the app
# folder, and without this Cam's own log would ship in every update.
#
# *_prefs.json: SETTINGS ARE CAM'S, AND WERE SHIPPING.
#
# This was found while testing the NeuroNet rename, and it had been true
# for a long time. A synapsoul_prefs.json sat in the source tree holding
# {"view": "all"}, nothing excluded it, so it went into every update zip
# -- and the README says to unzip an update straight over the install.
# Nineteen bytes landing on top of Cam's real settings file: theme, text
# size, UI scale, favourites, nav order, which subsections are hidden,
# all back to nothing, quietly, on every single update.
#
# It also blocked the rename migration, which is how it surfaced. The
# adopter will not write over an existing neuronet_prefs.json -- rightly
# -- so a shipped one meant Cam's real settings were never picked up.
#
# The app writes this file itself on the first save. It never belonged in
# a package, and the guard below now refuses to build one that has it.

if find "$DEST" -maxdepth 3 -type d -name '*_data' | grep -q .; then
  echo "REFUSING TO BUILD: a data folder is inside the package:"
  find "$DEST" -maxdepth 3 -type d -name '*_data'
  exit 1
fi
echo "  no data folder inside the package"

# The same refusal for settings, for the same reason: an update is
# unzipped over the install, so anything of Cam's in here lands on top of
# his own copy. An exclude can be defeated by a file named slightly
# differently; this checks what actually got staged.
if find "$DEST" -maxdepth 2 -name '*prefs*.json' | grep -q .; then
  echo "REFUSING TO BUILD: a settings file is inside the package:"
  find "$DEST" -maxdepth 2 -name '*prefs*.json'
  exit 1
fi
echo "  no settings file inside the package"

rm -f "$OUT/NeuroNet.zip"
(cd "$STAGE" && zip -qr "$OUT/NeuroNet.zip" NeuroNet)
echo "  $(du -h "$OUT/NeuroNet.zip" | cut -f1)  ->  $OUT/NeuroNet.zip"
rm -rf "$STAGE"
