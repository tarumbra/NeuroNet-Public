#!/bin/bash
# run a command inside the VM's desktop session: the whole environment of the
# Omarchy shell (Quickshell, started by Hyprland) -- OMARCHY_PATH included
pid=$(pgrep -x quickshell | head -1)
while IFS= read -r -d '' kv; do export "$kv"; done < /proc/$pid/environ
exec bash -c "$*"
