#!/bin/bash
# retire.sh <NeuroNet folder> [--check] -- take out the files system/retired.txt lists (2026-10-15).
# An update copies a release over the old one and never deletes, so files a release dropped stay behind; this
# removes them. Never in a git checkout (that's where NeuroNet is made -- git looks after it), files only, and
# only paths inside the folder.
set -u
app="${1:?usage: retire.sh <NeuroNet folder> [--check]}"; check="${2:-}"
list="$app/system/retired.txt"
[ -f "$list" ] || exit 0
[ -e "$app/.git" ] && exit 0
while IFS= read -r f || [ -n "$f" ]; do
  case "$f" in ""|"#"*|/*|*..*|*"*"*) continue ;; esac
  [ -f "$app/$f" ] || [ -L "$app/$f" ] || continue
  if [ "$check" = --check ]; then echo "  would take out $f (no longer part of NeuroNet)"
  else rm -f -- "$app/$f" && echo "  Took out $f (no longer part of NeuroNet)"; fi
done < "$list"
exit 0
