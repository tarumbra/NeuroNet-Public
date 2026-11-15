#!/bin/bash
# drives.sh -- remember this computer's data drives, and set them up again on
# a fresh install, at the same places (so NeuroNet's paths still hold).
#
#   bash system/drives.sh save             on the old system: remember the drives
#                                          mounted under /mnt or /media (no sudo)
#   sudo bash system/drives.sh restore     on the new one: each remembered drive
#                                          that's plugged in is mounted at its old
#                                          place, now and at every start
#   sudo bash system/drives.sh restore --check   say what it would do; change nothing
#   bash system/drives.sh list             what's remembered
#
# Cam, 2026-10-14, moving to CachyOS: "can you also make the drives
# automatically ... you have access to the drives and locations you could
# build it into the script?"
#
# The list is kept ON the drive NeuroNet is on (<data>/drives.json), so it is
# there when that drive is. On a fresh install, connect that one drive first --
#   sudo mount -m -L "Cam's Collective" /mnt/Cams_Collective
# -- then run restore from it. Drives are found by UUID, never by device name
# (sda/nvme0n1 can change between installs). Each line goes into /etc/fstab
# with "nofail", so the computer still starts with a drive unplugged. fstab is
# backed up first and checked with findmnt --verify after; a bad result puts
# the old one back. Nothing on any drive is changed: the files' owner is only
# checked (and a chown for NeuroNet's folder offered).
set -euo pipefail

SYS="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP="$(cd "$SYS/.." && pwd)"
FSTAB="${NEURONET_FSTAB:-/etc/fstab}"            # tests point these elsewhere
FILE="${NEURONET_DRIVES:-$APP/neuronet_data/drives.json}"
BYUUID="${NEURONET_BYUUID:-/dev/disk/by-uuid}"
STAMP="$(date +%Y%m%d-%H%M%S)-$$"   # -pid: two runs in one second never share a backup

say()  { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[31mdrives.sh: %s\033[0m\n' "$*" >&2; exit 1; }

cmd="${1:-}"; shift || true
CHECK=""; YES=""
for a in "$@"; do case "$a" in --check) CHECK=1 ;; --yes|-y) YES=1 ;; *) die "unknown option $a" ;; esac; done

case "$cmd" in
# ---------------------------------------------------------------- save --
save)
  [ -d "$(dirname "$FILE")" ] || die "no data folder at $(dirname "$FILE")"
  python3 - "$FSTAB" "$FILE" <<'PY'
import json, os, subprocess, sys
fstab, out = sys.argv[1:3]
drives = []
for line in open(fstab, encoding="utf-8"):
    f = line.split()
    if not f or f[0].startswith("#") or len(f) < 4:
        continue
    src, where, fs, opts = f[:4]
    if not (where.startswith("/mnt/") or where.startswith("/media/")) or not src.startswith("UUID="):
        continue
    where = where.replace("\\040", " ")
    uuid = src[5:]
    def lsblk(col):
        r = subprocess.run(["lsblk", "-no", col, "/dev/disk/by-uuid/" + uuid], capture_output=True, text=True)
        return r.stdout.strip()
    try:
        st = os.stat(where)
        owner = {"uid": st.st_uid, "gid": st.st_gid}
    except OSError:
        owner = None
    drives.append({"uuid": uuid, "where": where, "fs": fs, "options": opts,
                   "label": lsblk("LABEL"), "size": lsblk("SIZE"), "owner": owner})
json.dump({"saved": __import__("datetime").date.today().isoformat(), "drives": drives},
          open(out, "w"), indent=2)
for d in drives:
    print("  remembered %s (%s%s) at %s" % (d["uuid"], d["size"] or "?", ", " + d["label"] if d["label"] else "", d["where"]))
if not drives:
    print("  no drives under /mnt or /media in " + fstab)
PY
  say "kept in $FILE"
  ;;

# ---------------------------------------------------------------- list --
list)
  [ -f "$FILE" ] || die "nothing remembered yet ($FILE) -- run: bash system/drives.sh save"
  jq -r '"saved " + .saved, (.drives[] | "  \(.where)  \(.size) \(.label)  UUID=\(.uuid)")' "$FILE"
  ;;

# ---------------------------------------------------------------- restore --
restore)
  if [ "$(id -u)" != 0 ] && [ -z "${NEURONET_FSTAB:-}" ] && [ -z "$CHECK" ]; then
    exec sudo bash "$0" restore "$@"
  fi
  [ -f "$FILE" ] || die "nothing remembered ($FILE). Is the drive with NeuroNet mounted?"
  command -v jq >/dev/null || die "jq is missing: sudo pacman -S jq"
  PERSON="${SUDO_USER:-$(id -un)}"
  PUID="$(id -u "$PERSON")"; PGID="$(id -g "$PERSON")"
  echo "Drives remembered on $(jq -r .saved "$FILE"):"
  added=0; changed_fstab=""
  while IFS=$'\t' read -r uuid where fs opts label size; do
    name="$where ($size${label:+, $label})"
    if [ ! -e "$BYUUID/$uuid" ]; then
      warn "$name isn't plugged in here (UUID $uuid) -- skipped; run this again once it is"
      continue
    fi
    if grep -qE "^[[:space:]]*UUID=$uuid[[:space:]]" "$FSTAB"; then
      say "$name: already in $FSTAB"
    else
      case ",$opts," in *,nofail,*) ;; *) opts="$opts,nofail" ;; esac
      fwhere="${where// /\\040}"
      if [ -n "$CHECK" ]; then say "would add $name to $FSTAB"
      else
        # backed up just before the first change (a run that changes nothing makes no backup)
        [ -n "$changed_fstab" ] || cp -a "$FSTAB" "$FSTAB.bak.$STAMP"
        printf 'UUID=%s %s %s %s 0 2\n' "$uuid" "$fwhere" "$fs" "$opts" >> "$FSTAB"
        say "$name: added to $FSTAB"; changed_fstab=1
      fi
      added=$((added + 1))
    fi
    if [ -n "$CHECK" ]; then [ -d "$where" ] || say "would make $where"; continue; fi
    mkdir -p "$where"
  done < <(jq -r '.drives[] | [.uuid, .where, .fs, .options, (.label // ""), (.size // "")] | @tsv' "$FILE")

  [ -n "$CHECK" ] && { echo "Nothing was changed."; exit 0; }
  if [ -n "$changed_fstab" ]; then
    # a line fstab can't read is what must never be left in it (the computer
    # wouldn't start cleanly); findmnt's other errors are about this machine's
    # devices -- and only plugged-in drives were added
    findmnt --verify --tab-file "$FSTAB" >/tmp/drives-verify.$$ 2>&1 || true
    if grep -qE "^[1-9][0-9]* parse error" /tmp/drives-verify.$$; then
      cat /tmp/drives-verify.$$; rm -f /tmp/drives-verify.$$
      cp -a "$FSTAB.bak.$STAMP" "$FSTAB"
      die "the new $FSTAB didn't check out, so the old one is back."
    fi
    rm -f /tmp/drives-verify.$$
    say "$FSTAB backed up as $FSTAB.bak.$STAMP"
    [ -z "${NEURONET_FSTAB:-}" ] && systemctl daemon-reload 2>/dev/null || true
  fi
  [ -z "${NEURONET_FSTAB:-}" ] && { mount -a 2>&1 | sed 's/^/  /' || true; }

  # mounted, and still the person's?
  echo "Now:"
  while IFS=$'\t' read -r where ouid; do
    if [ -z "${NEURONET_FSTAB:-}" ] && ! findmnt -rno TARGET "$where" >/dev/null 2>&1; then
      warn "$where is not mounted"; continue
    fi
    uid="$(stat -c %u "$where" 2>/dev/null || echo ?)"
    if [ "$uid" = "$PUID" ] || [ "$ouid" = "null" ]; then say "$where: mounted, belongs to $PERSON"
    else
      warn "$where belongs to user number $uid, but $PERSON is $PUID."
      if [ -d "$where/NeuroNet" ] && [ "$APP" = "$where/NeuroNet" ]; then
        if [ -n "$YES" ] || { read -r -p "  Make NeuroNet's folder $PERSON's? [y/N] " a; [[ "$a" =~ ^[Yy] ]]; }; then
          chown -R "$PUID:$PGID" "$where/NeuroNet" && say "NeuroNet's folder is $PERSON's now"
        fi
      fi
      say "for everything on it: sudo chown -R $PERSON: \"$where\""
    fi
  done < <(jq -r '.drives[] | [.where, (.owner.uid // "null" | tostring)] | @tsv' "$FILE")
  echo "Done. Next: bash $SYS/install-app.sh (as $PERSON, not sudo)"
  ;;

*) sed -n '2,13p' "$0"; exit 2 ;;
esac
