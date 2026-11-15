#!/bin/bash
# NeuroPets balance audit: every simulation, in order. Pure rules (no saves, no app), so it is safe to run
# any time. The combat ones take a few minutes. Usage: tools/balance/run_all.sh [quick]
cd "$(dirname "$0")"
for f in gather making coins gear materials tools bosspace; do echo; echo "===== $f"; node "$f.js"; done
[ "$1" = quick ] && exit 0
for f in hunt sustain bosses bosses_bossgear classes; do echo; echo "===== $f"; timeout 900 node "$f.js"; done
