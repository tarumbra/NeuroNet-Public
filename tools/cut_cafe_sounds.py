#!/usr/bin/env python3
"""The Sound Engineer's cuts for NeuroCafe (3 Nov 2026): Cam's recordings in ~/Music/NeuroCafe Sound Assets ->
ui/cafe/sfx/<name>.ogg (Effects/) and ui/cafe/music/<name>.ogg (Music/). Like NeuroArcana's tools/cut_sounds.py: each
effect is one take cut out of its recording, with a short fade in, a gentle fade out, the loudest moment brought to -1 dB,
saved as small mono Opus; how loud each plays is the game's business (cafe.js SFX -- these four sit low, under the
music). A song is loudness-normalised to -23 LUFS like lofi.ogg, so the radio doesn't jump between them.
The other sounds in ui/cafe/sfx/ are NeuroArcana's (see sfx/CREDITS.txt).
    python3 tools/cut_cafe_sounds.py [name ...]   (only those; NC_SFX_SRC=<folder> to read elsewhere)"""
import os, re, subprocess, sys

SRC = os.path.expanduser(os.environ.get("NC_SFX_SRC", "~/Music/NeuroCafe Sound Assets"))
UI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe")

# name in the game: (recording, start s, end s, fade out s) -- takes picked from each file's waveform
CUTS = {
    "sizzle": ("Effects/stove sizzle", 1.00, 2.40, 0.50),   # a dish goes on the stove (a steady stretch, faded both ends)
    "clean": ("Effects/clean", 2.00, 3.20, 0.40),           # a stove scrubbed clean (1.2 s of the long scrub)
    "plate": ("Effects/eating", 3.05, 4.00, 0.20),          # a dish served (two fork taps on a plate, not the loud one at 8.6 s)
    # (8 Nov 2026, Cam: "add this to the milkshake maker when selecting and making a milkshake ... cuts the sound so it
    # makes sense and doesnt keep playing in the back ground"): the recording is 25 s of one steady whir, so the take is
    # its start, the blender spinning up (the first half second is lower), a short whir, and a long fade as it winds down
    "blend": ("~/Music/Neurocafe Milkshake", 0.00, 2.60, 0.90),
    # (21 Nov 2026) the barista counter: brew.ogg is MADE by tools/make_cafe_brew.py until there's a recording here
    "brew": ("~/Music/Neurocafe Coffee", 0.00, 2.60, 0.90),
}
SONGS = {"jazz": "Music/cafe Jazz"}                         # the café radio's second song (Cam: "another option to the lofi")


def src(stem):
    if stem.startswith("~"):                                   # (a recording kept outside the assets folder)
        d, base = os.path.split(os.path.expanduser(stem))
        hit = [n for n in sorted(os.listdir(d)) if os.path.splitext(n)[0] == base] if os.path.isdir(d) else []
        return os.path.join(d, hit[0]) if hit else None
    d, base = os.path.split(stem)
    if not os.path.isdir(os.path.join(SRC, d)):
        return None
    for name in sorted(os.listdir(os.path.join(SRC, d))):
        if os.path.splitext(name)[0] == base:
            return os.path.join(SRC, d, name)
    return None


def peak(path, a, b):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-ss", str(a), "-to", str(b), "-i", path, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else 0.0


def main():
    done, missing, only = [], [], set(sys.argv[1:])
    for name, (stem, a, b, fade) in CUTS.items():
        if only and name not in only:
            continue
        p = src(stem)
        if not p:
            missing.append(stem); continue
        gain = -1.0 - peak(p, a, b)
        af = f"afade=t=in:d=0.02,afade=t=out:st={b - a - fade:.3f}:d={fade},volume={gain:.2f}dB"
        out = os.path.join(UI, "sfx", name + ".ogg")
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(a), "-to", str(b), "-i", p, "-af", af,
                        "-ac", "1", "-c:a", "libopus", "-b:a", "64k", out], check=True)
        done.append(name)
    for name, stem in SONGS.items():
        if only and name not in only:
            continue
        p = src(stem)
        if not p:
            missing.append(stem); continue
        # (the recording starts and ends with a third of a second of silence: trimmed, so it loops round without a gap)
        af = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-23:TP=-2,volume=-1.4dB"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", p, "-af", af, "-ar", "48000", "-c:a", "libopus", "-b:a", "128k",
                        os.path.join(UI, "music", name + ".ogg")], check=True)
        done.append(name)
    print("cut:", ", ".join(done))
    if missing:
        print("missing:", ", ".join(missing)); sys.exit(1)


if __name__ == "__main__":
    main()
