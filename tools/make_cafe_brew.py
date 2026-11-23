#!/usr/bin/env python3
"""The barista counter's sound (21 Nov 2026, Cam: "fix the barista counter with coffee sounds because at the moment it
has the cooking sounds"): ui/cafe/sfx/brew.ogg, an espresso machine pulling a shot. There was no coffee recording on
any of the computers, so this one is made, not recorded: the pump's low buzz, the coffee running into the cup with a
little gurgle, and a puff of steam at the end, 2.6 s with a long fade like the blender's (blend.ogg), cut the same way
(peak -1 dB, mono Opus 64k). It plays once as the coffee is started, never running on behind.

A real recording beats it: put it at ~/Music/Neurocafe Coffee.<mp3|wav|...> and run
    python3 tools/cut_cafe_sounds.py brew
(its CUTS entry "brew" takes the first 2.6 s; move the start if the machine takes a moment to begin).
    python3 tools/make_cafe_brew.py [out.ogg]"""
import os, re, subprocess, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "cafe", "sfx", "brew.ogg")
LEN = 2.6

# the pump: a vibratory pump's buzz at mains rate, a few harmonics, softened
PUMP = "aevalsrc='0.20*sin(2*PI*50*t)+0.12*sin(2*PI*100*t)+0.07*sin(2*PI*150*t)+0.04*sin(2*PI*200*t)':s=48000:d={d}," \
       "lowpass=f=500,afade=t=in:d=0.12".format(d=LEN)
# the coffee running into the cup: low noise in a liquid band, wobbling (the gurgle), from 0.35 s
POUR = "anoisesrc=c=brown:a=0.9:s=48000:d={d},bandpass=f=650:width_type=h:w=500,tremolo=f=9:d=0.55," \
       "afade=t=in:d=0.25,adelay=350:all=1".format(d=LEN - 0.35)
# a short breath of steam near the end, quiet and high
STEAM = "anoisesrc=c=white:a=0.08:s=48000:d=1.0,highpass=f=3500,lowpass=f=9000,afade=t=in:d=0.3,afade=t=out:st=0.4:d=0.6," \
        "adelay=1450:all=1"


def run(args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True, capture_output=True, text=True)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    graph = f"{PUMP}[p];{POUR}[c];{STEAM}[s];[p][c][s]amix=inputs=3:normalize=0:duration=first," \
            f"atrim=0:{LEN},afade=t=out:st={LEN - 0.9:.2f}:d=0.9[a]"
    raw = out + ".wav"
    run(["-filter_complex", graph, "-map", "[a]", "-ac", "1", raw])
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
    gain = -1.0 - (float(m.group(1)) if m else 0.0)
    run(["-i", raw, "-af", f"volume={gain:.2f}dB", "-ac", "1", "-c:a", "libopus", "-b:a", "64k", out])
    os.remove(raw)
    print("made", out)


if __name__ == "__main__":
    main()
