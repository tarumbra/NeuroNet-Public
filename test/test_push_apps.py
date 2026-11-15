"""tools/push_apps.sh (I14, 8 Nov 2026): every standalone app pushed with a NeuroNet release, from either computer --
on throwaway apps with throwaway "GitHub" remotes (bare repos in a scratch folder), gh and npm stubbed. Never the real
~/Work apps or GitHub.
"""
import os
# Never Cam's real data (test_test_isolation.py): a paths file that can't exist, before anything else.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import json
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
TOOL = os.path.join(APP, "tools", "push_apps.sh")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  FAIL  " + name + (f"\n          {detail}" if detail else ""))


def git(d, *a):
    return subprocess.run(["git", "-C", d, *a], capture_output=True, text=True, check=True).stdout.strip()


print("\nPushing the standalone apps (tools/push_apps.sh)\n")
tmp = tempfile.mkdtemp(prefix="nn-pushapps-")
try:
    work, remotes, bin_ = os.path.join(tmp, "Work"), os.path.join(tmp, "remotes"), os.path.join(tmp, "bin")
    for d in (work, remotes, bin_):
        os.makedirs(d)
    genv = dict(os.environ, GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t", GIT_CONFIG_GLOBAL=os.devnull)

    def make(name, version="1.2.3"):
        bare = os.path.join(remotes, name + ".git")
        subprocess.run(["git", "init", "-q", "--bare", "-b", "main", bare], check=True)
        d = os.path.join(work, name)
        subprocess.run(["git", "clone", "-q", bare, d], check=True, env=genv, capture_output=True)
        subprocess.run(["git", "-C", d, "checkout", "-q", "-b", "main"], env=genv, capture_output=True)
        json.dump({"name": name.lower(), "version": version}, open(os.path.join(d, "package.json"), "w"))
        open(os.path.join(d, "CHANGELOG.md"), "w").write(f"# {name}\n\n## {version}0, not this one\n\nnope\n\n## {version}, the one (8 November 2026)\n\n- it works\n\n## 1.0.0, older\n\nold\n")
        subprocess.run(["git", "-C", d, "add", "-A"], env=genv, check=True)
        subprocess.run(["git", "-C", d, "commit", "-qm", "first"], env=genv, check=True)
        subprocess.run(["git", "-C", d, "push", "-q", "origin", "main"], env=genv, check=True, capture_output=True)
        return d, bare

    cafe, cafe_bare = make("NeuroCafe")
    code, code_bare = make("NeuroCode")
    # NeuroArcana: not on this computer at all
    log = os.path.join(tmp, "gh.log")
    open(os.path.join(bin_, "gh"), "w").write(f'#!/bin/bash\necho "$@" >> {log}\n[ "$1 $2" = "release view" ] && exit 1\nexit 0\n')
    open(os.path.join(bin_, "npm"), "w").write('#!/bin/bash\nmkdir -p dist/linux-unpacked && echo app > dist/linux-unpacked/app\n')
    for f in ("gh", "npm"):
        os.chmod(os.path.join(bin_, f), 0o755)
    env = dict(genv, NEURO_APPS_DIR=work, PATH=bin_ + ":" + os.environ["PATH"])

    def run(*a):
        return subprocess.run(["bash", TOOL, *a], capture_output=True, text=True, env=env, timeout=120)

    # a new commit on each, and a version tag on NeuroCode
    for d in (cafe, code):
        open(os.path.join(d, "new.txt"), "w").write("x")
        subprocess.run(["git", "-C", d, "add", "-A"], env=genv, check=True)
        subprocess.run(["git", "-C", d, "commit", "-qm", "second"], env=genv, check=True)
    subprocess.run(["git", "-C", code, "tag", "v1.2.3"], env=genv, check=True)
    # GitHub urls for the release's repo name: the bare repos stand in
    dr = run("--dry-run")
    ok("--dry-run says what it would do and changes nothing", dr.returncode == 0 and "would push 1 commits" in dr.stdout
       and "would build and publish release v1.2.3" in dr.stdout and git(cafe_bare, "rev-parse", "main") != git(cafe, "rev-parse", "HEAD"), dr.stdout + dr.stderr)
    r = run()
    ok("each app's branch and tags pushed; one that isn't here is said so", r.returncode == 0 and git(cafe_bare, "rev-parse", "main") == git(cafe, "rev-parse", "HEAD")
       and git(code_bare, "rev-parse", "main") == git(code, "rev-parse", "HEAD") and "v1.2.3" in git(code_bare, "tag") and "NeuroArcana: not on this computer" in r.stdout, r.stdout + r.stderr)
    calls = open(log).read()
    tarball = os.path.join(code, "dist", "NeuroCode-1.2.3-linux-x64.tar.gz")
    ok("NeuroCode's new version tag gets a GitHub release: the Linux build as a tarball, its own CHANGELOG section as notes",
       "release create v1.2.3 " + tarball in calls and "--title NeuroCode 1.2.3" in calls and os.path.isfile(tarball)
       and open(os.path.join(code, "dist", "release-notes-1.2.3.md")).read().strip() == "- it works", calls)
    ok("  NeuroCafe isn't built or released (not yet a standalone release)", "NeuroCafe" not in calls)
    # uncommitted work, and behind GitHub: left alone, named, exit 1
    open(os.path.join(cafe, "package.json"), "a").write(" ")
    other = os.path.join(tmp, "other")
    subprocess.run(["git", "clone", "-q", code_bare, other], env=genv, check=True, capture_output=True)
    open(os.path.join(other, "o.txt"), "w").write("o")
    subprocess.run(["git", "-C", other, "add", "-A"], env=genv, check=True)
    subprocess.run(["git", "-C", other, "commit", "-qm", "from the other computer"], env=genv, check=True)
    subprocess.run(["git", "-C", other, "push", "-q", "origin", "main"], env=genv, check=True, capture_output=True)
    r = run()
    ok("changes not committed, or behind GitHub: NOT pushed, named, and the script fails so a release notices",
       r.returncode == 1 and "NeuroCafe: changes not committed, NOT pushed" in r.stdout and "NeuroCode: 1 commits on GitHub aren't here, NOT pushed" in r.stdout, r.stdout)
    ok("never forced", "--force" not in open(TOOL).read() and " -f " not in open(TOOL).read())
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
