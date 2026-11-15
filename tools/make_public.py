#!/usr/bin/env python3
"""The public release: NeuroNet without Cam's data (15 November 2026).

    python3 tools/make_public.py [--version 1.0.184] [--tree DIR] [--repo URL] [--no-push]

Cam: "we will need a copy of neuronet which doesnt send over this data, so
think a public release version as well."

A release on the private repository carries Cam's own data with it
(system/starter/starter.json and the starter-files tag: recipes, Training,
decks, notes, Collaboration, Media). The public release is the same code
with none of it: this takes the tagged release (v<version>), leaves out
everything in PRIVATE, and commits what's left as ONE new commit in a
repository of its own (default ~/.cache/neuronet-public), tagged the same
v<version>. Only that snapshot goes public, never the private history (old
releases' starter data is in it). A computer that updates from the public
repository gets the code; neuronet-update finds no starter there and
fetches nothing more, and starter_data.py merges nothing.

The repository it pushes to: --repo, else tools/public.json {"repo": ...}.
With neither, it's made and committed here and nothing is pushed.
"""
import json
import os
import shutil
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Never in a public release: Cam's own data, and the tools that make it.
PRIVATE = (
    "system/starter/starter.json",       # recipes, Training, decks, notes, Collaboration, Media
)


def git(*args, cwd, check=True):
    return subprocess.run(["git", *args], cwd=cwd, check=check, capture_output=True, text=True)


def arg(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


def public_repo(argv):
    if "--repo" in argv:
        return arg(argv, "--repo")
    try:
        with open(os.path.join(APP, "tools", "public.json"), encoding="utf-8") as f:
            return json.load(f).get("repo") or ""
    except (OSError, ValueError):
        return ""


def main(argv, app=APP):
    version = arg(argv, "--version") or open(os.path.join(app, "VERSION")).read().strip()
    tag = "v" + version
    tree = os.path.abspath(arg(argv, "--tree") or os.path.expanduser("~/.cache/neuronet-public"))
    repo = public_repo(argv)
    if git("rev-parse", "-q", "--verify", "refs/tags/" + tag, cwd=app, check=False).returncode:
        print(f"make_public: there's no {tag} here yet (release it first)", file=sys.stderr)
        return 1

    if not os.path.isdir(os.path.join(tree, ".git")):
        os.makedirs(tree, exist_ok=True)
        if repo and git("ls-remote", "--heads", repo, cwd=tree, check=False).stdout.strip():
            shutil.rmtree(tree)
            subprocess.run(["git", "clone", "-q", repo, tree], check=True, capture_output=True)
        else:
            git("init", "-q", "-b", "main", cwd=tree)
        if repo and git("remote", cwd=tree).stdout.strip() == "":
            git("remote", "add", "origin", repo, cwd=tree)
    if git("rev-parse", "-q", "--verify", "refs/tags/" + tag, cwd=tree, check=False).returncode == 0:
        print(f"  {tag} is already in the public release")
        return push(tree, tag, repo, argv)

    # the tree is exactly the release, less PRIVATE
    for name in os.listdir(tree):
        if name != ".git":
            p = os.path.join(tree, name)
            shutil.rmtree(p) if os.path.isdir(p) and not os.path.islink(p) else os.remove(p)
    archive = subprocess.run(["git", "archive", tag], cwd=app, check=True, capture_output=True).stdout
    subprocess.run(["tar", "-x", "-C", tree], input=archive, check=True)
    for rel in PRIVATE:
        p = os.path.join(tree, rel)
        if os.path.lexists(p):
            os.remove(p)
    left = [rel for rel in PRIVATE if os.path.lexists(os.path.join(tree, rel))]
    if left:
        print("make_public: refusing, these are still there: " + ", ".join(left), file=sys.stderr)
        return 1

    git("add", "-A", ".", cwd=tree)
    # always this name: Cam's own name and email stay off the public repository
    anon = ["-c", "user.name=NeuroNet", "-c", "user.email=neuronet@users.noreply.github.com"]
    git(*anon, "commit", "-q", "--allow-empty", "-m", f"NeuroNet {version}", cwd=tree)
    git(*anon, "tag", "-a", tag, "-m", f"NeuroNet {version}", cwd=tree)
    print(f"  public {tag} made in {tree} (without: {', '.join(PRIVATE)})")
    return push(tree, tag, repo, argv)


def push(tree, tag, repo, argv):
    if "--no-push" in argv:
        return 0
    if not repo:
        print("  no public repository yet (tools/public.json), so nothing was pushed")
        return 0
    r = git("push", "origin", "main", tag, cwd=tree, check=False)
    if r.returncode:
        print("make_public: the push failed:\n" + r.stderr, file=sys.stderr)
        return 1
    print(f"  pushed {tag} to {repo}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
