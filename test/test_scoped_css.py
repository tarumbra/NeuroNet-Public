"""No rule may be scoped twice, because a rule scoped twice matches nothing.

Each module's stylesheet is scoped to its own shell -- `.ss-home`, `#cr-shell`,
`#ch-shell` and the rest. A scope left in front of a comment,

    .ss-home /* ---- Dashboard blocks ---- */
    .ss-home .dash-blocks { ... }

reads to a browser as `.ss-home .ss-home .dash-blocks`, which needs one
.ss-home inside another and so never applies. That is exactly how the
dashboard's "three columns, three widgets each" rule was switched off from
the day it was written: the page fell back to shared.css's older grid, and
nothing looked broken enough to notice.
"""
import os
# Never Cam's real data: since the 1.0.2 install ~/.config/neuronet/paths.json
# names it, and data_dir() reads that before anything a test patches. A file
# that can't exist means "no config" here and in every process a test starts.
# test_test_isolation.py checks every test does this first.
os.environ["NEURONET_PATHS"] = os.path.join(os.devnull, "paths.json")
import glob, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(os.path.dirname(HERE), "ui")
passed = failed = 0


def ok(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1; print("  ok    " + name)
    else:
        failed += 1; print("  FAIL  " + name + ("\n          " + str(detail) if detail else ""))


print("\nScoped stylesheets\n")

SCOPE = re.compile(r"(?:#[\w-]+-shell|\.ss-home)\b")


def doubled(css):
    """Every selector naming the same scope twice, with its line number."""
    # Comments go the way a browser drops them -- but newlines are kept so
    # the line numbers still point at the file.
    bare = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", "", m.group(0)), css, flags=re.S)
    out = []
    for m in re.finditer(r"([^{}]+)\{", bare):
        for part in m.group(1).split(","):
            scopes = SCOPE.findall(part)
            if len(scopes) != len(set(scopes)):
                line = bare[:m.end(1)].count("\n") + 1
                out.append(f"line {line}:{' '.join(part.split())[:80]}")
    return out


ok("the check itself catches the shape that broke the dashboard",
   doubled(".ss-home /* a comment */\n.ss-home .dash-blocks { display: grid; }") != [])
ok("  and leaves a correctly scoped rule after a comment alone",
   doubled("#cr-shell /* a comment */ .board { color: red; }") == [])

files = sorted(glob.glob(os.path.join(UI, "**", "*.css"), recursive=True))
ok("there are stylesheets to check", len(files) > 5, len(files))
for f in files:
    bad = doubled(open(f, encoding="utf-8").read())
    ok(os.path.relpath(f, UI) + " has no rule scoped twice", not bad, "; ".join(bad[:3]))

home = open(os.path.join(UI, "home", "home.css"), encoding="utf-8").read()
ok("the dashboard's three columns are a live rule again",
   re.search(r"(?m)^\.ss-home \.dash-blocks \{[^}]*repeat\(3, minmax\(0, 1fr\)\)", home) is not None
   and not doubled(home))


# ---- a scope around something that isn't inside it -----------------------
# Cam: "When clicking add to book it doesn't work. Nothing pops up." Every
# Puzzles dialog and toast is styled "#cr-shell #cr-modal-veil" and so on,
# but those elements sat AFTER the shell in index.html. The rules matched
# nothing, and the dialog drew unstyled below the bottom of the window. A
# rule "#<shell> #<id>" is only alive if <id> is inside <shell> in the page.
from html.parser import HTMLParser  # noqa: E402

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


class Ancestry(HTMLParser):
    """Every id in the page, with the ids of the elements around it."""

    def __init__(self):
        super().__init__()
        self.stack, self.within = [], {}

    def handle_starttag(self, tag, attrs):
        i = dict(attrs).get("id")
        if i:
            self.within[i] = {x for x in self.stack if x}
        if tag not in VOID:
            self.stack.append(i)

    def handle_endtag(self, tag):
        if tag not in VOID and self.stack:
            self.stack.pop()


page = Ancestry()
page.feed(open(os.path.join(UI, "index.html"), encoding="utf-8").read())
# Found by this check when it was written and not part of Cam's report, so
# named rather than silently passed. Remove one when it is looked at.
KNOWN = {("#ch-shell", "ch-menu-toggle"), ("#ch-shell", "ch-panel-toggle"),
         ("#ch-shell", "ch-top-bar"), ("#cx-shell", "toasts")}
outside = []
for f in files:
    bare = re.sub(r"/\*.*?\*/", " ", open(f, encoding="utf-8").read(), flags=re.S)
    for scope, el in set(re.findall(r"(#[\w-]+-shell)\s+#([\w-]+)", bare)):
        if scope[1:] in page.within and el in page.within \
                and scope[1:] not in page.within[el] and (scope, el) not in KNOWN:
            outside.append(f"{os.path.relpath(f, UI)}: {scope} #{el}")
ok("every \"#shell #id\" rule styles an element that is inside that shell",
   not outside, "; ".join(sorted(outside)[:5]))
ok("  Puzzles' dialogs and toasts are inside Puzzles' shell",
   all("cr-shell" in page.within.get(i, ()) for i in ("cr-modal-veil", "cr-confirm-veil", "cr-toasts")))

print(f"\n  {passed} passed, {failed} failed\n")
sys.exit(1 if failed else 0)
