#!/usr/bin/env python3
"""No test may reach Cam's real data.

What happened (2026-10-01): the full suite wrote song.mp3 into Cam's music,
fake recordings into Meditation, 5-byte photos and junk notes into his
library, and replaced his photo index with an empty one. The tests patch
app_dir() to a temporary folder -- but since the 1.0.2 install,
~/.config/neuronet/paths.json names the real data folder, and data_dir()
reads that FIRST. Every patch was beside the point.

So every test starts by pointing NEURONET_PATHS (which paths_file() honours,
and so does system/bin/neuronet-path) at a file that cannot exist, before
it imports anything. Child processes inherit it. This test holds every test
file to that, and proves the variable really does keep data_dir() off the
real config.

A test that removes NEURONET_PATHS for a child process (the installer test
does, to check the real lookup) must give that child its own HOME and
XDG_CONFIG_HOME, so "the real lookup" lands in a sandbox.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import ast
import glob
import json
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
fails = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        fails.append(what)


def first_statements(path):
    body = ast.parse(open(path, encoding="utf-8").read()).body
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    return body[:2]


def is_guard(stmts):
    """`import os` then os.environ["NEURONET_PATHS"] = <something>."""
    if len(stmts) < 2:
        return False
    imp, assign = stmts
    if not (isinstance(imp, ast.Import) and [a.name for a in imp.names] == ["os"]):
        return False
    if not (isinstance(assign, ast.Assign) and len(assign.targets) == 1):
        return False
    t = assign.targets[0]
    return (isinstance(t, ast.Subscript) and ast.unparse(t.value) == "os.environ"
            and ast.unparse(t.slice).strip("'\"") == "NEURONET_PATHS")


# 1. every Python test sets it, first thing
tests = sorted(glob.glob(os.path.join(HERE, "test_*.py")))
check(len(tests) > 40, "found the Python tests (%d)" % len(tests))
for path in tests:
    check(is_guard(first_statements(path)),
          "%s points NEURONET_PATHS away before anything else" % os.path.basename(path))

# 2. one that drops it for a child gives the child its own HOME and config
for path in tests:
    src = open(path, encoding="utf-8").read()
    if 'pop("NEURONET_PATHS"' in src or "pop('NEURONET_PATHS'" in src:
        check("HOME=" in src and "XDG_CONFIG_HOME=" in src,
              "%s drops NEURONET_PATHS only with a sandbox HOME" % os.path.basename(path))

# 2b. (2026-10-15) a scratch folder given to a module BEFORE neuronet or neuropets is imported doesn't hold: the import
#     points the module back at NeuroNet's data folder. test_pet_sandboxes.py did that and NeuroNet moved Cam's real data
#     into test/ (moved straight back; test_data_dir_guard.py). So: any `X.DATA_DIR_PROVIDER = ...` must come after the
#     file's last top-level import of neuronet/neuropets/neurofarm -- or set it again after.
for path in tests:
    src = open(path, encoding="utf-8").read()
    lines = src.splitlines()
    imps = [i for i, l in enumerate(lines) if __import__("re").match(r"\s*(import|from)\s+(neuronet|neuropets)\b", l)]
    provs = [i for i, l in enumerate(lines) if "DATA_DIR_PROVIDER = " in l and not l.strip().startswith("#")]
    if imps and provs:
        check(max(provs) > max(imps), "%s points DATA_DIR_PROVIDER at its scratch folder after importing neuronet/neuropets" % os.path.basename(path))

# 3. it works: with a real-looking paths.json on the machine, the app (in a
#    child process, as most tests run it) still keeps to its own folder.
with tempfile.TemporaryDirectory() as t:
    real = os.path.join(t, "real-data")
    os.makedirs(real)
    cfg = os.path.join(t, "config", "neuronet")
    os.makedirs(cfg)
    json.dump({"data": real}, open(os.path.join(cfg, "paths.json"), "w"))
    probe = (
        "import sys; sys.path.insert(0, %r); sys.path.insert(0, %r)\n"
        "import neuronet\n"
        "neuronet.app_dir = lambda: %r\n"
        "print(neuronet.paths_file()); print(neuronet.data_dir())\n"
    ) % (APP, os.path.join(APP, "crux", "py"), os.path.join(t, "app"))
    os.makedirs(os.path.join(t, "app"))
    base = dict(os.environ, XDG_CONFIG_HOME=os.path.join(t, "config"))

    def ask(env):
        r = subprocess.run([sys.executable, "-c", probe], env=env, capture_output=True,
                           text=True, timeout=120)
        lines = r.stdout.strip().splitlines()
        return lines[-2:] if len(lines) >= 2 else ["", r.stderr[-400:]]

    # control: without the guard, the config IS read -- the danger is real
    unguarded = dict(base)
    unguarded.pop("NEURONET_PATHS", None)
    _, d = ask(unguarded)
    check(d == real, "without NEURONET_PATHS the app follows paths.json (%s)" % d)
    # guarded (inherited from this process, as every test's children are)
    pf, d = ask(base)
    check(pf == os.environ["NEURONET_PATHS"], "the child reads the guarded paths file")
    check(d != real and not d.startswith(real), "with it, the app keeps off the configured data (%s)" % d)
    # the shell helper the desktop scripts use honours it too
    r = subprocess.run(["bash", os.path.join(APP, "system", "bin", "neuronet-path"), "data"],
                       env=base, capture_output=True, text=True, timeout=30)
    check(real not in r.stdout, "neuronet-path ignores paths.json too (%r)" % r.stdout.strip())

print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
