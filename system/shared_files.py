#!/usr/bin/env python3
"""The files NeuroNet's widgets share, each from ONE source (2026-10-06).

The audit found the same code copied by hand: DeskSpace.qml, desklayout.js and
WidgetMenu.qml in six widgets, NeuroNetPaths.qml in seven, the card tools'
bar, service and journal script in three, and NeuroPets' engine and art and
the visualiser both in the app and on the desktop board. Tests kept the copies
equal, but a forgotten copy was still the likeliest bug.

system/omarchy/shared.json names each file's source and the widgets that
carry it. This script:

  shared_files.py              check: every copy is its source (exit 1 if not)
  shared_files.py --write      make the copies in system/omarchy/plugins from
                               the sources (after editing a source)
  shared_files.py --into DIR   put the sources into DIR/<widget>/ -- the
                               installer builds the widgets this way, so what
                               is installed always comes from the source
  shared_files.py --adopt      after collect.sh: an edit made in ONE copy (or
                               in the source) becomes the source and every
                               copy; two different edits stop with both named
"""
import json
import os
import shutil
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGINS = os.path.join(APP, "system", "omarchy", "plugins")


def entries():
    with open(os.path.join(APP, "system", "omarchy", "shared.json"), encoding="utf-8") as f:
        return json.load(f)["files"]


def read(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except OSError:
        return None


def copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def drift(plugins=PLUGINS):
    """[(copy path, source path)] for every copy that isn't its source."""
    out = []
    for e in entries():
        src = os.path.join(APP, e["from"])
        want = read(src)
        for w in e["to"]:
            dst = os.path.join(plugins, w, e["name"])
            if os.path.isdir(os.path.join(plugins, w)) and read(dst) != want:
                out.append((dst, src))
    return out


def write(plugins=PLUGINS):
    return sum(write_one(e, plugins) for e in entries())


def adopt():
    """One changed copy wins; more than one different change is a conflict."""
    problems = []
    for e in entries():
        src = os.path.join(APP, e["from"])
        base = read(src)
        copies = [os.path.join(PLUGINS, w, e["name"]) for w in e["to"]
                  if os.path.isdir(os.path.join(PLUGINS, w))]
        edits = {}
        for c in copies:
            body = read(c)
            if body is not None and body != base:
                edits.setdefault(body, []).append(c)
        if len(edits) > 1:
            problems.append(e["name"] + ": edited differently in " + ", ".join(
                os.path.relpath(c, APP) for cs in edits.values() for c in cs))
            continue
        if edits:
            where = next(iter(edits.values()))
            copy(where[0], src)
            print("  shared   " + e["name"] + " <- " + os.path.relpath(where[0], APP))
        write_one(e)
    return problems


def write_one(e, plugins=PLUGINS):
    src = os.path.join(APP, e["from"])
    n = 0
    for w in e["to"]:
        if os.path.isdir(os.path.join(plugins, w)):
            dst = os.path.join(plugins, w, e["name"])
            if read(dst) != read(src):
                copy(src, dst)
                n += 1
    return n


def main(argv):
    if "--into" in argv:
        write(os.path.abspath(argv[argv.index("--into") + 1]))
        return 0
    if "--write" in argv:
        print(f"  {write()} copies made from their sources")
        return 0
    if "--adopt" in argv:
        problems = adopt()
        for p in problems:
            print("  CONFLICT " + p)
        return 1 if problems else 0
    d = drift()
    for dst, src in d:
        print("  differs  " + os.path.relpath(dst, APP) + "  (source: " + os.path.relpath(src, APP) + ")")
    return 1 if d else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
