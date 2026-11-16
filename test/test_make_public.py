"""The public release: the code without Cam's data (15 November 2026).

Cam: "we will need a copy of neuronet which doesnt send over this data, so
think a public release version as well." tools/make_public.py, on a
throwaway repository; nothing is pushed anywhere.
"""
import os
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json  # noqa: E402
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


def sh(*args, cwd):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                          env=dict(os.environ, GIT_AUTHOR_NAME="Cam", GIT_AUTHOR_EMAIL="cam@example.com",
                                   GIT_COMMITTER_NAME="Cam", GIT_COMMITTER_EMAIL="cam@example.com"))


def write(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w").write(text)


print("\nThe public release\n")
tmp = tempfile.mkdtemp(prefix="nn-public-")
try:
    priv = os.path.join(tmp, "private")
    os.makedirs(os.path.join(priv, "tools"))
    shutil.copy(os.path.join(APP, "tools", "make_public.py"), os.path.join(priv, "tools", "make_public.py"))
    sh("git", "init", "-q", "-b", "main", cwd=priv)
    write(priv, "VERSION", "1.0.1\n")
    write(priv, "neuronet.py", "print('hi')\n")
    write(priv, "system/starter/starter.json", json.dumps({"collections": [{"doc": "media", "items": [{"title": "Dust Bunny"}]}]}))
    sh("git", "add", "-A", cwd=priv)
    sh("git", "commit", "-qm", "1.0.1", cwd=priv)
    sh("git", "tag", "-a", "v1.0.1", "-m", "1.0.1", cwd=priv)
    tree = os.path.join(tmp, "public")
    r = subprocess.run([sys.executable, os.path.join(priv, "tools", "make_public.py"), "--tree", tree, "--repo", "", "--no-push"],
                       capture_output=True, text=True, cwd=priv)
    ok("make_public makes the public copy of a release", r.returncode == 0 and os.path.isfile(os.path.join(tree, "neuronet.py")),
       r.stdout + r.stderr)
    ok("  without Cam's data (no starter)", not os.path.exists(os.path.join(tree, "system", "starter", "starter.json")))
    log = sh("git", "log", "--format=%an <%ae>|%s", "--all", cwd=tree).stdout.strip().splitlines()
    ok("  one commit, tagged the same version, by 'NeuroNet' (not Cam's name or email)",
       log == ["NeuroNet <neuronet@users.noreply.github.com>|NeuroNet 1.0.1"]
       and sh("git", "tag", cwd=tree).stdout.split() == ["v1.0.1"], log)
    hist = sh("git", "log", "-p", "--all", cwd=tree).stdout
    ok("  and none of the private history comes with it", "Dust Bunny" not in hist)

    # the next release: one more commit on top
    write(priv, "VERSION", "1.0.2\n")
    write(priv, "neuronet.py", "print('hello')\n")
    sh("git", "commit", "-qam", "1.0.2", cwd=priv)
    sh("git", "tag", "-a", "v1.0.2", "-m", "1.0.2", cwd=priv)
    r = subprocess.run([sys.executable, os.path.join(priv, "tools", "make_public.py"), "--tree", tree, "--repo", "", "--no-push"],
                       capture_output=True, text=True, cwd=priv)
    ok("the next release is one more commit, with the new code",
       r.returncode == 0 and sh("git", "rev-list", "--count", "HEAD", cwd=tree).stdout.strip() == "2"
       and open(os.path.join(tree, "neuronet.py")).read() == "print('hello')\n"
       and sorted(sh("git", "tag", cwd=tree).stdout.split()) == ["v1.0.1", "v1.0.2"], r.stderr)
    r = subprocess.run([sys.executable, os.path.join(priv, "tools", "make_public.py"), "--tree", tree, "--version", "9.9.9", "--no-push"],
                       capture_output=True, text=True, cwd=priv)
    ok("a version that isn't released yet is refused", r.returncode == 1 and "no v9.9.9" in r.stderr)
    # a public install clones the public repository, and the private note stays home
    priv2 = os.path.join(tmp, "private2")
    os.makedirs(os.path.join(priv2, "tools"))
    shutil.copy(os.path.join(APP, "tools", "make_public.py"), os.path.join(priv2, "tools", "make_public.py"))
    sh("git", "init", "-q", "-b", "main", cwd=priv2)
    write(priv2, "VERSION", "1.0.3\n")
    write(priv2, "system/install-neuronet.sh", 'REPO="${NEURONET_REPO:-git@github.com:tarumbra/NeuroNet.git}"\n')
    write(priv2, "tools/public.json", json.dumps({"about": "Cam and Manthies", "repo": "x"}))
    sh("git", "add", "-A", cwd=priv2)
    sh("git", "commit", "-qm", "1.0.3", cwd=priv2)
    sh("git", "tag", "-a", "v1.0.3", "-m", "1.0.3", cwd=priv2)
    bare = os.path.join(tmp, "public.git")
    sh("git", "init", "-q", "--bare", "-b", "main", bare, cwd=tmp)
    tree2 = os.path.join(tmp, "public2")
    r = subprocess.run([sys.executable, os.path.join(priv2, "tools", "make_public.py"), "--tree", tree2, "--repo", bare],
                       capture_output=True, text=True, cwd=priv2)
    inst = open(os.path.join(tree2, "system", "install-neuronet.sh")).read() if r.returncode == 0 else ""
    ok("a public install clones the public repository, not the private one",
       bare in inst and "tarumbra/NeuroNet.git" not in inst, r.stdout + r.stderr + inst)
    ok("  tools/public.json (the private side's note) stays out",
       not os.path.exists(os.path.join(tree2, "tools", "public.json")))
    ok("  and it's pushed there", "v1.0.3" in sh("git", "tag", cwd=bare).stdout.split())
    src = open(os.path.join(APP, "tools", "make_public.py"), encoding="utf-8").read()
    ok("the real tool leaves out the starter", '"system/starter/starter.json"' in src.split("PRIVATE = (")[1].split(")")[0])
    upd = open(os.path.join(APP, "system", "bin", "neuronet-update"), encoding="utf-8").read()
    ok("a computer on the public release fetches no starter files (none named)",
       "want=$(jq -r '.files.tag // empty' \"$app/system/starter/starter.json\" 2>/dev/null)" in upd)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
