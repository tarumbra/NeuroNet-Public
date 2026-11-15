"""system/retire.sh (2026-10-15): files a release dropped are taken out of an installed NeuroNet.

An update copies the new release over the old one and never deletes, so the removed NeuroPets/NeuroFarm desktop cards
would have stayed in an updated NeuroNet (and been installed as widgets again). install.sh and install-app.sh run
retire.sh with system/retired.txt. Everything here happens in a scratch folder.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import tempfile  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def touch(root, rel, text="x"):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as f:
        f.write(text)


print("\nFiles a release dropped (system/retire.sh)\n")
listed = [l.strip() for l in open(os.path.join(APP, "system", "retired.txt")) if l.strip() and not l.startswith("#")]
ok("the list names the desktop cards and their commands, none of which the release still has",
   {"neuropets-call", "system/omarchy/plugins/neuronet.board/PetCard.qml"} <= set(listed)
   and not [f for f in listed if os.path.exists(os.path.join(APP, f))], [f for f in listed if os.path.exists(os.path.join(APP, f))])
ok("both installers run it", all('bash "$SYS/retire.sh" "$APP" ${CHECK:+--check}' in open(os.path.join(APP, "system", s)).read()
                                  for s in ("install.sh", "install-app.sh")))

tmp = tempfile.mkdtemp(prefix="nn-retire-")
try:
    app, outside = os.path.join(tmp, "NeuroNet"), os.path.join(tmp, "outside.txt")
    touch(app, "system/retired.txt", "# a note\nold-command\nsystem/gone/Card.qml\n../outside.txt\n/etc/hostname\nkeepdir\n*\n")
    touch(app, "old-command"); touch(app, "system/gone/Card.qml"); touch(app, "keep.py"); touch(tmp, "outside.txt")
    os.makedirs(os.path.join(app, "keepdir"))
    run = lambda *a: subprocess.run(["bash", os.path.join(APP, "system", "retire.sh"), app] + list(a), capture_output=True, text=True)
    r = run("--check")
    ok("--check only says what it would take out", r.returncode == 0 and "would take out old-command" in r.stdout
       and os.path.exists(os.path.join(app, "old-command")))
    r = run()
    ok("it takes out the listed files", r.returncode == 0 and not os.path.exists(os.path.join(app, "old-command"))
       and not os.path.exists(os.path.join(app, "system/gone/Card.qml")), r.stdout + r.stderr)
    ok("  and nothing else: not a file it doesn't list, not outside the folder, not a folder",
       os.path.exists(os.path.join(app, "keep.py")) and os.path.exists(outside) and os.path.isdir(os.path.join(app, "keepdir")))
    ok("  run again, it has nothing to do", run().stdout.strip() == "")
    touch(app, "old-command"); os.makedirs(os.path.join(app, ".git"))
    r = run()
    ok("never in a git checkout (where NeuroNet is made)", r.returncode == 0 and os.path.exists(os.path.join(app, "old-command")))
    # neuronet-setup takes the old neuropets-call / neurofarm-call shims out -- and only says so with --check
    home = os.path.join(tmp, "home")
    shim = open(os.path.join(APP, "system", "bin", "neuronet-shim")).read()
    for c in ("neuropets-call", "neurofarm-call"):
        touch(home, ".local/bin/" + c, shim)
    touch(home, ".local/bin/neuropets-call-mine", "#!/bin/sh\necho mine\n")
    fake = os.path.join(tmp, "fakebin")                      # never the real services (a stand-in systemctl)
    touch(fake, "systemctl", "#!/bin/sh\nexit 0\n"); os.chmod(os.path.join(fake, "systemctl"), 0o755)
    env = {"HOME": home, "PATH": fake + os.pathsep + os.environ.get("PATH", ""), "XDG_CONFIG_HOME": os.path.join(home, ".config"),
           "XDG_DATA_HOME": os.path.join(home, ".local/share"), "XDG_STATE_HOME": os.path.join(home, ".local/state")}
    setup = lambda *a: subprocess.run(["bash", os.path.join(APP, "system", "bin", "neuronet-setup"), "--app-only", "--data", os.path.join(tmp, "data")] + list(a),
                                      capture_output=True, text=True, env=env)
    r = setup("--check")
    ok("neuronet-setup --check says it would take out the old -call shims, and leaves them", "would take out" in r.stdout
       and os.path.exists(os.path.join(home, ".local/bin/neuropets-call")), r.stdout + r.stderr)
    r = setup()
    ok("  neuronet-setup takes them out (ours only: a file of the same kind that isn't our shim stays)",
       not os.path.exists(os.path.join(home, ".local/bin/neuropets-call")) and not os.path.exists(os.path.join(home, ".local/bin/neurofarm-call"))
       and os.path.exists(os.path.join(home, ".local/bin/neuropets-call-mine")), r.stdout + r.stderr)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
