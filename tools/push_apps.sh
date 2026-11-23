#!/bin/bash
# tools/push_apps.sh -- push every standalone app with a NeuroNet release (Cam, 2026-11-08: "when i push and release
# NeuroNet updates as well can you push this at the same time as well as all the other stand alone applications").
#
#     bash tools/push_apps.sh            push them all
#     bash tools/push_apps.sh --dry-run  say what it would do, change nothing
#
# In NeuroNet main since 8 Nov 2026 (I14): it used to live only in the PC's old NeuroNet-dev checkout, so a release from
# the laptop had to push the games by hand. The apps are in ~/Work/<App> (NEURO_APPS_DIR to change) -- the same list
# neuronet-dev pull brings up to date (system/bin/neuronet-dev APPS).
#
# For each app: not on this computer, or no GitHub repo yet -> skipped. Changes not committed, or behind GitHub -> left
# alone and named (the script ends with exit 1, so a release notices). Otherwise its branch and tags are pushed, never
# forced. An app in RELEASES whose version (package.json) has a tag v<version> but no GitHub release yet gets one: the
# Linux build (npm run build:linux, electron-builder's dir) as <App>-<version>-linux-x64.tar.gz, its notes the
# version's section of CHANGELOG.md ("## <version>, ...").
set -u
APPS=(NeuroCafe NeuroCode NeuroArcana NeuroTrain NeuroTV NeuroScribe)
RELEASES=(NeuroCode)            # the ones published as builds; NeuroCafe joins at its first standalone release (I22)
root="${NEURO_APPS_DIR:-$HOME/Work}"
dry=""; [ "${1:-}" = "--dry-run" ] && dry=1
bad=0

say() { printf '%s: %s\n' "$1" "$2"; }
releases() { local r; for r in "${RELEASES[@]}"; do [ "$r" = "$1" ] && return 0; done; return 1; }

# the version's own section of the CHANGELOG: from its "## <version>" line to the next "## "
notes_for() {
  awk -v v="$2" 'index($0, "## " v) == 1 && substr($0, length(v) + 4, 1) ~ /^([, ]|)$/ { on = 1; next } on && /^## / { exit } on { print }' "$1/CHANGELOG.md" 2>/dev/null
}

release() {
  local a="$1" d="$2" ver tag repo out tarball
  ver=$(jq -r '.version // empty' "$d/package.json" 2>/dev/null); [ -n "$ver" ] || return 0
  tag="v$ver"
  git -C "$d" rev-parse -q --verify "refs/tags/$tag" >/dev/null || { say "$a" "$ver has no tag yet, no release"; return 0; }
  repo=$(git -C "$d" remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')
  command -v gh >/dev/null || { say "$a" "gh isn't here: can't check or make the $tag release"; bad=1; return 0; }
  if gh release view "$tag" -R "$repo" >/dev/null 2>&1; then say "$a" "release $tag already on GitHub"; return 0; fi
  [ -n "$dry" ] && { say "$a" "would build and publish release $tag"; return 0; }
  out=$(cd "$d" && npm run --silent build:linux 2>&1) || { say "$a" "the build failed, no release:"; printf '%s\n' "$out" | tail -5; bad=1; return 0; }
  [ -d "$d/dist/linux-unpacked" ] || { say "$a" "the build made no dist/linux-unpacked, no release"; bad=1; return 0; }
  tarball="$d/dist/$a-$ver-linux-x64.tar.gz"
  tar -C "$d/dist" -czf "$tarball" --transform "s#^linux-unpacked#$a-$ver#" linux-unpacked
  notes_for "$d" "$ver" > "$d/dist/release-notes-$ver.md"
  if gh release create "$tag" "$tarball" -R "$repo" --title "$a $ver" --notes-file "$d/dist/release-notes-$ver.md" >/dev/null; then
    say "$a" "released $tag on GitHub ($(du -h "$tarball" | cut -f1))"
  else say "$a" "couldn't publish the $tag release (gh release create failed)"; bad=1; fi
}

for a in "${APPS[@]}"; do
  d="$root/$a"
  [ -d "$d/.git" ] || { say "$a" "not on this computer"; continue; }
  git -C "$d" remote get-url origin >/dev/null 2>&1 || { say "$a" "no GitHub repo yet, skipped"; continue; }
  if [ -n "$(git -C "$d" status --porcelain --untracked-files=no)" ]; then say "$a" "changes not committed, NOT pushed (commit them first)"; bad=1; continue; fi
  br=$(git -C "$d" branch --show-current)
  git -C "$d" fetch -q origin "$br" 2>/dev/null || { say "$a" "couldn't reach GitHub, NOT pushed"; bad=1; continue; }
  behind=$(git -C "$d" rev-list --count "HEAD..origin/$br" 2>/dev/null || echo 0)
  if [ "$behind" != 0 ]; then say "$a" "$behind commits on GitHub aren't here, NOT pushed (pull it first)"; bad=1; continue; fi
  ahead=$(git -C "$d" rev-list --count "origin/$br..HEAD" 2>/dev/null || echo 0)
  if [ -n "$dry" ]; then say "$a" "would push $ahead commits on $br, and its tags"
  elif git -C "$d" push -q origin "$br" 2>/dev/null && git -C "$d" push -q --tags origin 2>/dev/null; then
    say "$a" "pushed ($ahead new on $br): $(git -C "$d" log -1 --format='%h %s' | cut -c1-60)"
  else say "$a" "the push was refused, NOT pushed"; bad=1; continue; fi
  releases "$a" && release "$a" "$d"
done
exit $bad
