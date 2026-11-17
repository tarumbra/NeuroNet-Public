"""system/bin/neuronet-dev-mirror (2026-11-08, Cam: "think like this laptop becomes a duplicate of the main PC").

Two temporary homes stand in for the main PC and this computer; the "ssh" is a stand-in that runs the command in the
PC's home, so the real data, the network and the session here are never seen."""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
import subprocess  # noqa: E402
import tempfile  # noqa: E402

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = os.path.join(APP, "system", "bin", "neuronet-dev-mirror")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + ("\n          " + str(detail)[-1500:] if detail else ""))


def write(path, text, mode=0o755):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)


def main():
    with tempfile.TemporaryDirectory(prefix="nn-mirror-") as t:
        pc, me, bins = os.path.join(t, "pc"), os.path.join(t, "me"), os.path.join(t, "bin")
        pc_app, pc_data = os.path.join(pc, "mnt", "NeuroNet"), os.path.join(pc, "mnt", "NeuroNet", "neuronet_data")
        my_app = os.path.join(me, "NeuroNet")
        my_data = os.path.join(my_app, "neuronet_data")
        for home, app, data in ((pc, pc_app, pc_data), (me, my_app, my_data)):
            write(os.path.join(home, ".local", "bin", "neuronet-path"),
                  f'#!/bin/sh\ncase "$1" in app) echo {app} ;; data) echo {data} ;; esac\n')
        # this computer's own neuronet-path comes first on PATH
        write(os.path.join(bins, "neuronet-path"), open(os.path.join(me, ".local", "bin", "neuronet-path")).read())
        # the stand-in ssh: drops the host, runs the command in the PC's home
        rsh = os.path.join(bins, "fake-ssh")
        write(rsh, f'#!/bin/sh\n[ "$1" = -l ] && shift 2\nshift\nHOME={pc} exec sh -c "$*"\n')
        # the PC: decks at full size, a card file naming its own folders, a cafe, two game folders
        write(os.path.join(pc_data, "cards", "images", "Splendor Solis The Fool.jpg"), "BIG" * 5000, 0o644)
        write(os.path.join(pc_data, "cards", "celestial.json"),
              json.dumps({"tarotDecks": [{"name": "Splendor Solis"}], "icon": pc_app + "/icons/x.png",
                          "music": "/mnt/Cams_Collective/Music/nowhere.mp3"}), 0o600)
        write(os.path.join(pc_data, "cafe", "cafe.json"), '{"level": 40}', 0o644)
        write(os.path.join(pc, ".local", "share", "NeuroArcana-dev", "arcana.json"), '{"gold": 900}', 0o644)
        write(os.path.join(pc, ".local", "share", "NeuroArcana", "art", "cards.json"), '{"decks": []}', 0o644)
        # this computer: the starter copy, something of its own, nothing of the games
        write(os.path.join(my_data, "cards", "celestial.json"), '{"tarotDecks": []}', 0o600)
        write(os.path.join(my_data, "laptop-only.txt"), "mine", 0o644)
        # the working notes are neuronet-dev pull's: a newer note here, an older one on the PC
        write(os.path.join(my_data, "notes", "vault", "Guide.md"), "newer, on the laptop", 0o644)
        write(os.path.join(pc_data, "notes", "vault", "Guide.md"), "older, on the PC", 0o644)
        write(os.path.join(pc_data, "collab", "PT1.json"), '{"from": "' + pc_app + '"}', 0o644)

        env = {k: v for k, v in os.environ.items() if not k.startswith("XDG_")}
        env.update(HOME=me, PATH=bins + os.pathsep + env["PATH"], NEURONET_MIRROR_RSH=rsh,
                   NEURONET_MIRROR_OPEN="no-such-program-nn-mirror-test")

        def run(*args, extra=None):
            return subprocess.run(["python3", MIRROR, my_app, *args], env={**env, **(extra or {})},
                                  capture_output=True, text=True, timeout=120)

        r = run("check")
        ok("no main PC named yet: says how to name it", r.returncode == 2 and "mirror setup" in r.stdout, r.stdout + r.stderr)
        r = run("check", "cam@pc")
        ok("check: says what a copy would bring", r.returncode == 0 and "NeuroNet's data: would bring 3 files" in r.stdout
           and "NeuroArcana-dev: would bring 1 files" in r.stdout and "would take out 1" in r.stdout, r.stdout + r.stderr)
        ok("  and changes nothing here", open(os.path.join(my_data, "cards", "celestial.json")).read() == '{"tarotDecks": []}'
           and os.path.exists(os.path.join(my_data, "laptop-only.txt")))
        ok("  the PC's address is remembered", json.load(open(os.path.join(me, ".config", "neuronet", "mirror.json"))) == {"main": "cam@pc"})

        p = subprocess.Popen(["python3", "-c", "import time; time.sleep(30)", "nn-mirror-test-open-1"])
        try:
            r = run("copy", extra={"NEURONET_MIRROR_OPEN": "nn-mirror-test-open-1"})
            ok("copy refuses while NeuroNet or a game is open here", r.returncode == 1 and "close it first" in r.stdout, r.stdout)
        finally:
            p.kill()
            p.wait()

        r = run("check", "cam@pc", extra={"NEURONET_MIRROR_OPEN": "nn-mirror-test-open-[2]"})
        ok("  (and the PC's own check doesn't count itself as open)", "open on the PC" not in r.stdout, r.stdout)
        r = run("copy")  # the remembered PC
        cel = json.load(open(os.path.join(my_data, "cards", "celestial.json")))
        ok("copy: the PC's data here, file for file", r.returncode == 0 and cel["tarotDecks"] == [{"name": "Splendor Solis"}]
           and open(os.path.join(my_data, "cards", "images", "Splendor Solis The Fool.jpg")).read() == "BIG" * 5000
           and json.load(open(os.path.join(my_data, "cafe", "cafe.json"))) == {"level": 40}, r.stdout + r.stderr)
        ok("  the games' saves and art too, only the ones the PC has",
           json.load(open(os.path.join(me, ".local", "share", "NeuroArcana-dev", "arcana.json"))) == {"gold": 900}
           and os.path.exists(os.path.join(me, ".local", "share", "NeuroArcana", "art", "cards.json"))
           and not os.path.exists(os.path.join(me, ".local", "share", "NeuroCafe-dev")), r.stdout)
        ok("  the working notes left to neuronet-dev pull (never copied over, never taken out)",
           open(os.path.join(my_data, "notes", "vault", "Guide.md")).read() == "newer, on the laptop"
           and not os.path.exists(os.path.join(my_data, "collab")), r.stdout)
        ok("  the PC's folder names changed to this computer's", cel["icon"] == my_app + "/icons/x.png" and "changed to this computer's in 1 files" in r.stdout, r.stdout)
        ok("  and what's only on the PC is said", "only on the PC: /mnt/Cams_Collective/Music" in r.stdout, r.stdout)
        ok("  file modes kept (the card file stays private)", os.stat(os.path.join(my_data, "cards", "celestial.json")).st_mode & 0o777 == 0o600)
        kept = os.path.join(me, ".local", "state", "neuronet", "mirror-replaced")
        run_dir = os.path.join(kept, os.listdir(kept)[0]) if os.path.isdir(kept) else ""
        ok("  what was only here is gone, but kept aside first", not os.path.exists(os.path.join(my_data, "laptop-only.txt"))
           and os.path.exists(os.path.join(run_dir, "NeuroNets-data", "laptop-only.txt"))
           and json.load(open(os.path.join(run_dir, "NeuroNets-data", "cards", "celestial.json"))) == {"tarotDecks": []}, r.stdout)

        r = run("check")
        ok("a second check: only the file whose folder names were changed differs", r.returncode == 0
           and "NeuroNet's data: would bring 1 files" in r.stdout and "NeuroArcana-dev: would bring 0 files" in r.stdout, r.stdout)

        # a small computer leaves the music out (16 Nov 2026, the ThinkPad): never copied, never taken out
        write(os.path.join(pc_data, "chords", "library", "song.mp3"), "MUSIC" * 1000, 0o644)
        write(os.path.join(my_data, "chords", "mine.json"), "{}", 0o644)
        r = run("leave", "chords")
        ok("leave chords: remembered", r.returncode == 0 and "left out of the copy here: chords" in r.stdout
           and json.load(open(os.path.join(me, ".config", "neuronet", "mirror.json")))["leave"] == ["chords"], r.stdout + r.stderr)
        r = run("leave", "../x")
        ok("  only a folder's own name", r.returncode == 2, r.stdout)
        r = run("copy")
        ok("  the copy leaves it out, and this computer's own copy of it stays", r.returncode == 0 and "left out here: chords" in r.stdout
           and not os.path.exists(os.path.join(my_data, "chords", "library")) and os.path.exists(os.path.join(my_data, "chords", "mine.json")), r.stdout + r.stderr)
        r = run("leave", "--none")
        ok("  --none: everything comes again", r.returncode == 0 and "nothing left out" in r.stdout and "left out here" not in run("check").stdout, r.stdout)

        r = run("check", "cam@pc", extra={"NEURONET_MIRROR_RSH": "false"})
        ok("the PC can't be reached: said, with the first-time step", r.returncode == 1 and "can't reach the main PC" in r.stdout
           and "mirror setup" in r.stdout, r.stdout)
    print(f"\n  {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
