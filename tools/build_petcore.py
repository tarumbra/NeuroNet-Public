#!/usr/bin/env python3
"""Build NeuroPets' rules file from its parts (2026-10-10 audit, H-1 / SE-1) and its content (2026-10-15, FUT-3).

ui/pet/petcore.js is ONE plain script on purpose: the same file runs in the game's page and in node (the tests and
tools), so it can't use modules. It is *built* from the parts in ui/pet/core/ (NN-name.js, joined in order) -- edit the
parts, never petcore.js itself.

CONTENT IS JSON (2026-10-15, Cam: "Move to JSON"): a part's plain data -- items, workshops, spots, monsters, people,
prices -- lives beside it in ui/pet/content/NN-name.json, one key per table. In the part, CONTENT("KEY") stands where
the table was written; the build puts the JSON there, so the game runs exactly what it did. Keys called "//" are notes
(the comments that were in the code) and are left out. Every CONTENT() must have its key, and every key must be used.
Tables that need code (worked out from other tables, functions) stay in the parts.

    python3 tools/build_petcore.py           join ui/pet/core/*.js (with ui/pet/content/*.json) into ui/pet/petcore.js
    python3 tools/build_petcore.py --check   exit 1 if petcore.js isn't exactly that (the tests run this)
    python3 tools/build_petcore.py --split   (once) cut petcore.js into parts at its section headings

After building, run the tests (python3 test/test_pet.py; node test/test_pet*.js)."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
PET = os.path.join(APP, "ui", "pet")
OUT = os.path.join(PET, "petcore.js")
PARTS = os.path.join(PET, "core")
CONTENT_DIR = os.path.join(PET, "content")
CONTENT_CALL = re.compile(r'CONTENT\("((?:[^"\\]|\\.)*)"\)')
HEAD = re.compile(r"^  // (?:====|----) (.*)")


def parts():
    return sorted(f for f in os.listdir(PARTS) if re.match(r"^\d\d-.*\.js$", f))


def no_notes(v):
    """The value without its "//" notes."""
    if isinstance(v, dict):
        return {k: no_notes(x) for k, x in v.items() if k != "//"}
    if isinstance(v, list):
        return [no_notes(x) for x in v]
    return v


def content_of(part):
    """ui/pet/content/<part>.json as {key: value}, or {} when the part has none."""
    p = os.path.join(CONTENT_DIR, part[:-3] + ".json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return {k: v for k, v in json.load(fh).items() if k != "//"}


def part_source(f):
    """A part with its CONTENT("KEY") calls filled in from its JSON."""
    with open(os.path.join(PARTS, f), encoding="utf-8", newline="") as fh:
        text = fh.read()
    tables, used = content_of(f), set()

    def fill(m):
        key = json.loads('"%s"' % m.group(1))
        if key not in tables:
            raise SystemExit('%s: CONTENT("%s") has no key in ui/pet/content/%s.json' % (f, key, f[:-3]))
        used.add(key)
        return json.dumps(no_notes(tables[key]), ensure_ascii=False, separators=(", ", ": "))
    text = CONTENT_CALL.sub(fill, text)
    unused = [k for k in tables if k not in used]
    if unused:
        raise SystemExit("ui/pet/content/%s.json: %s not used by %s" % (f[:-3], ", ".join(unused), f))
    return text


def joined():
    stray = [j for j in (os.listdir(CONTENT_DIR) if os.path.isdir(CONTENT_DIR) else [])
             if j.endswith(".json") and j[:-5] + ".js" not in parts()]
    if stray:
        raise SystemExit("ui/pet/content/: no part for " + ", ".join(stray))
    return "".join(part_source(f) for f in parts())


def slug(text):
    words = re.findall(r"[a-z0-9]+", re.sub(r"\(.*", "", text.lower()))
    return "-".join(words[:5]) or "part"


def split():
    with open(OUT, encoding="utf-8", newline="") as fh:
        lines = fh.read().splitlines(keepends=True)
    cuts = [0] + [i for i, l in enumerate(lines) if HEAD.match(l)]
    os.makedirs(PARTS, exist_ok=True)
    names = []
    for n, start in enumerate(cuts):
        end = cuts[n + 1] if n + 1 < len(cuts) else len(lines)
        name = "%02d-%s.js" % (n, "header-pets-and-eggs" if n == 0 else slug(HEAD.match(lines[start]).group(1)))
        with open(os.path.join(PARTS, name), "w", encoding="utf-8", newline="") as fh:
            fh.write("".join(lines[start:end]))
        names.append((name, end - start))
    with open(OUT, encoding="utf-8", newline="") as fh:
        same = fh.read() == joined()
    for name, n in names:
        print("  %-60s %5d lines" % (name, n))
    print("%d parts; joined back %s." % (len(names), "byte-for-byte the same" if same else "DIFFERENT -- something is wrong"))
    return 0 if same else 1


def main():
    args = sys.argv[1:]
    if "--split" in args:
        return split()
    if not os.path.isdir(PARTS) or not parts():
        print("No parts in ui/pet/core/ -- run with --split first."); return 1
    text = joined()
    with open(OUT, encoding="utf-8", newline="") as fh:
        current = fh.read()
    if "--check" in args:
        if current != text:
            print("ui/pet/petcore.js is out of date with ui/pet/core/ -- run python3 tools/build_petcore.py"); return 1
        print("petcore.js is up to date with its %d parts" % len(parts())); return 0
    if current != text:
        with open(OUT, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
    print("Built ui/pet/petcore.js from %d parts (%s)." % (len(parts()), "changed" if current != text else "unchanged"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
